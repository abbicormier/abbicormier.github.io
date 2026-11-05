// ==============================================================
// GRAPH TYPE REGISTRY
// New graph types plug in through GraphTypes.register().
// tools/econ-graph/README.md documents the contract.
// ==============================================================

const SD_DEFAULTS = { supply: [50, 2, 300, 12], demand: [50, 12, 300, 2] };

const C = {
  supply: '#c0392b', demand: '#2471a3', shiftSupply: '#e74c3c', shiftDemand: '#3498db',
  social: '#27ae60', policy: '#d35400', tax: '#8e44ad', ink: '#222', guide: '#999',
};

// Areas with economic meaning. Exports and themes read data-region, so shade these by
// name with shade() rather than by a raw color.
const REGIONS = {
  cs: { color: '#2471a3', label: 'CS' },
  ps: { color: '#c0392b', label: 'PS' },
  dwl: { color: '#7f8c8d', label: 'DWL' },
  revenue: { color: '#8e44ad', label: 'Tax revenue' },
  cost: { color: '#d35400', label: 'Govt cost' },
  profit: { color: '#27ae60', label: 'Profit' },
  loss: { color: '#e74c3c', label: 'Loss' },
  gain: { color: '#27ae60', label: 'Gains' },
  neutral: { color: '#f39c12', label: '' },
};

// ---- Pure math (no DOM), safe to call from compute() and from the Node tests ----

// Area of a simple polygon given as [[q, p], ...]
function polyArea(points) {
  let sum = 0;
  points.forEach(([q, p], i) => {
    const [qNext, pNext] = points[(i + 1) % points.length];
    sum += q * pNext - qNext * p;
  });
  return Math.abs(sum) / 2;
}

// Axis ranges that show every point. Economics graphs start at the origin.
function rangeFromPoints(points) {
  const qs = points.map(pt => pt[0]).filter(Number.isFinite);
  const ps = points.map(pt => pt[1]).filter(Number.isFinite);
  const qHi = Math.max(...qs, 1) * 1.05, pHi = Math.max(...ps, 1) * 1.05;
  const qtyStep = niceStep(qHi), priceStep = niceStep(pHi);
  return {
    qtyMin: 0, qtyMax: +(Math.ceil(qHi / qtyStep) * qtyStep).toFixed(10), qtyStep,
    priceMin: 0, priceMax: +(Math.ceil(pHi / priceStep) * priceStep).toFixed(10), priceStep,
  };
}

function fmtNum(n, digits = 2) { return +(+n).toFixed(digits); }

// ---- Drawing helpers for registered types ----

// Everything drawn into a layer belongs to one build step. Steps are cumulative and
// numbered from 1; anything drawn straight onto the panel always shows.
function layer(svg, step) { return el('g', { 'data-step': step }, svg); }

function shade(svg, points, cfg, kind, label) {
  const region = REGIONS[kind];
  const pts = points.map(([q, p]) => `${plotX(q, cfg)},${plotY(p, cfg)}`).join(' ');
  el('polygon', { points: pts, fill: region.color, stroke: 'none', opacity: 0.25, 'data-region': kind }, svg);
  const text = label === undefined ? region.label : label;
  if (text) {
    const cq = points.reduce((s, pt) => s + pt[0], 0) / points.length;
    const cp = points.reduce((s, pt) => s + pt[1], 0) / points.length;
    textBg(svg, plotX(cq, cfg), plotY(cp, cfg) + 4, text, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: region.color });
  }
}

// Dot at (q, p) with dashed guides to both axes. The axes get the values, or qLabel and
// pLabel (Q0, P0) on conceptual graphs.
function markPoint(svg, q, p, cfg, opts = {}) {
  const { label, qLabel, pLabel, color = C.ink, guides = true } = opts;
  const x = plotX(q, cfg), y = plotY(p, cfg);
  const x0 = plotX(cfg.qtyMin, cfg), y0 = plotY(cfg.priceMin, cfg);
  if (guides) {
    el('line', { x1: x, y1: y, x2: x, y2: y0, stroke: C.guide, 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    el('line', { x1: x, y1: y, x2: x0, y2: y, stroke: C.guide, 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    if (cfg.symbolic) {
      if (qLabel) el('text', { x, y: y0 + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 'bold', fill: color }, svg).textContent = qLabel;
      if (pLabel) el('text', { x: x0 - 10, y: y + 4, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 'bold', fill: color }, svg).textContent = pLabel;
    } else {
      drawInterceptLabels(svg, q, p, cfg, { color: C.supply });
    }
  }
  el('circle', { cx: x, cy: y, r: 5.5, fill: color, stroke: 'white', 'stroke-width': 2 }, svg);
  if (label) textBg(svg, x + 8, y - 12, label, { 'font-size': 15, 'font-weight': 'bold', fill: color });
}

// ---- The registry ----

const GraphTypes = (() => {
  const types = new Map();
  const domId = (def, fieldId) => `${def.id}__${fieldId}`;

  function register(def) {
    if (types.has(def.id)) throw new Error(`Duplicate graph type: ${def.id}`);
    types.set(def.id, def);
  }
  const get = id => types.get(id);
  const all = () => [...types.values()];

  function fieldDefault(f) {
    if (f.value !== undefined) return f.value;
    if (f.options) return f.options[0][0];
    return f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '';
  }

  // Field values with nothing read from the page, for tests and scripted builds
  function defaults(def) {
    const v = { goodName: 'the good', qtyUnit: '', pricePrefix: '$' };
    (def.fields || []).forEach(f => { if (f.id) v[f.id] = fieldDefault(f); });
    if (def.steps) { v.mode = 'answer'; v.step = def.steps.length; }
    if (def.usesSD) {
      v.supply = lineFromPoints(...SD_DEFAULTS.supply);
      v.demand = lineFromPoints(...SD_DEFAULTS.demand);
      v.s0Label = 'S0'; v.d0Label = 'D0'; v.eqLabel = 'A';
    }
    return v;
  }

  function readValues(def, base) {
    const v = { goodName: base.goodName, qtyUnit: base.qtyUnit, pricePrefix: base.pricePrefix };
    (def.fields || []).forEach(f => {
      if (!f.id) return;
      v[f.id] = f.type === 'toggle' ? toggleVal(domId(def, f.id)) : val(domId(def, f.id));
    });
    if (def.steps) {
      v.mode = toggleVal(domId(def, '__mode'));
      v.step = +val(domId(def, '__step'));
    }
    if (def.usesSD) {
      v.supply = base.supply; v.demand = base.demand;
      v.s0Label = base.s0Label; v.d0Label = base.d0Label; v.eqLabel = base.eqLabel;
    }
    return v;
  }

  function panelConfig(panel, base, i) {
    const useAuto = val('autoRange') !== false;
    const range = rangeFromPoints(panel.points || []);
    const cfg = { ...base, ...(useAuto || i > 0 ? range : {}) };
    if (panel.x) cfg.xAxisTitle = panel.x;
    if (panel.y) cfg.yAxisTitle = panel.y;
    if (panel.yPrefix !== undefined) cfg.yTickPrefix = panel.yPrefix;
    if (useAuto && i === 0) {
      const fields = { qtyMin: 'qtyMin', qtyMax: 'qtyMax', qtyStep: 'qtyStep', priceMin: 'priceMin', priceMax: 'priceMax', priceStep: 'priceStep' };
      Object.keys(fields).forEach(k => { const e = document.getElementById(fields[k]); if (e) e.value = range[k]; });
    }
    return cfg;
  }

  // opts.values builds from given values instead of the form; opts.stepLimit overrides the step shown
  function build(def, base, forExport, opts = {}) {
    const v = opts.values || readValues(def, base);
    const model = def.compute(v);
    const panels = def.panels(v, model);
    const cols = Math.min(def.cols || panels.length, panels.length);
    const rows = Math.ceil(panels.length / cols);
    const cw = cols * W, ch = rows * H;

    const root = document.createElementNS(SVG_NS, 'svg');
    root.setAttribute('xmlns', SVG_NS);
    root.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
    const font = `font-family: ${base.font}, Arial, sans-serif;`;
    if (forExport) {
      root.setAttribute('width', cw);
      root.setAttribute('height', ch);
      root.setAttribute('style', font);
    } else {
      root.setAttribute('width', '100%');
      root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      root.setAttribute('style', `${font} max-width: ${cw}px;`);
    }
    el('rect', { x: 0, y: 0, width: cw, height: ch, fill: 'white' }, root);

    // Each panel is a nested svg with the usual W x H coordinates, so the drawing helpers work unchanged
    panels.forEach((panel, i) => {
      const inner = el('svg', { x: (i % cols) * W, y: Math.floor(i / cols) * H, width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root);
      const cfg = panelConfig(panel, base, i);
      if (cfg.showGrid && !cfg.symbolic) drawGrid(inner, cfg);
      drawAxes(inner, cfg);
      if (panel.title) {
        el('text', { x: (PAD.left + W - PAD.right) / 2, y: 28, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 'bold', fill: C.ink }, inner).textContent = panel.title;
      }
      resetEqLabels();
      resetInterceptLabels();
      panel.draw(inner, cfg, model, v);
    });

    if (def.steps) {
      const limit = opts.stepLimit !== undefined ? opts.stepLimit
        : v.mode === 'question' ? (def.questionStep || 1) : v.step;
      root.querySelectorAll('[data-step]').forEach(g => {
        if (+g.getAttribute('data-step') > limit) g.remove();
      });
    }

    if (base.annotation) {
      textBg(root, cw - PAD.right - 8, ch - PAD.bottom - 10, base.annotation, { 'font-size': 15, 'font-weight': 'bold', fill: '#2563eb', 'text-anchor': 'end' });
    }
    if (!forExport && def.summary) showReadout(def.summary(model, v));
    return root;
  }

  function showReadout(rows) {
    const box = document.getElementById('graph-readout');
    if (!box) return;
    box.textContent = rows.map(([label, value]) => `${label}: ${value}`).join('   |   ');
  }

  // ---- Form generation ----

  function fieldNode(def, f) {
    const wrap = document.createElement('div');
    if (f.type === 'header') {
      wrap.className = 'section-header';
      wrap.textContent = f.label;
      return wrap;
    }
    const id = domId(def, f.id);
    const initial = fieldDefault(f);
    if (f.type === 'checkbox') {
      wrap.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.id = id; input.checked = initial;
      const label = document.createElement('label');
      label.htmlFor = id; label.textContent = f.label;
      wrap.append(input, label);
      return wrap;
    }
    wrap.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = f.label;
    wrap.appendChild(label);
    if (f.type === 'toggle') {
      const group = document.createElement('div');
      group.className = 'toggle-group';
      f.options.forEach(([value, text]) => {
        const btn = document.createElement('button');
        btn.className = 'toggle-btn' + (value === initial ? ' active' : '');
        btn.dataset.field = id; btn.dataset.val = value; btn.textContent = text;
        group.appendChild(btn);
      });
      wrap.appendChild(group);
    } else if (f.type === 'select') {
      const select = document.createElement('select');
      select.id = id;
      f.options.forEach(([value, text]) => select.add(new Option(text, value, false, value === initial)));
      wrap.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.type = f.type || 'number'; input.id = id; input.value = initial;
      ['step', 'min', 'max'].forEach(k => { if (f[k] !== undefined) input.setAttribute(k, f[k]); });
      wrap.appendChild(input);
    }
    return wrap;
  }

  function sectionNode(def) {
    const section = document.createElement('div');
    section.id = `section-${def.id}`;
    section.className = 'hidden';
    section.appendChild(fieldNode(def, { type: 'header', label: def.label }));
    if (def.steps) {
      section.appendChild(fieldNode(def, { type: 'toggle', id: '__mode', label: 'Mode', options: [['answer', 'Answer Key'], ['question', 'Question (blank)']] }));
      section.appendChild(fieldNode(def, {
        type: 'select', id: '__step', label: 'Show through step', value: String(def.steps.length),
        options: def.steps.map((name, i) => [String(i + 1), `${i + 1}. ${name}`]),
      }));
    }
    (def.fields || []).forEach(f => section.appendChild(fieldNode(def, f)));
    if (def.presets) {
      const row = document.createElement('div');
      row.className = 'form-group';
      const label = document.createElement('label');
      label.textContent = 'Quick presets';
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
      def.presets.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'toggle-btn';
        btn.textContent = preset.label;
        btn.addEventListener('click', () => {
          Object.entries(preset.values).forEach(([id, value]) => {
            const e = document.getElementById(domId(def, id)) || document.getElementById(id);
            if (!e) return;
            if (e.type === 'checkbox') e.checked = value; else e.value = value;
          });
          render();
        });
        btns.appendChild(btn);
      });
      row.append(label, btns);
      section.appendChild(row);
    }
    return section;
  }

  function mount() {
    const buttons = document.getElementById('graph-type-buttons');
    const sections = document.getElementById('registered-sections');
    all().forEach(def => {
      const btn = document.createElement('button');
      btn.className = 'graph-type-btn px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200';
      btn.dataset.type = def.id;
      btn.textContent = def.label;
      if (def.group) btn.title = def.group;
      buttons.appendChild(btn);
      sections.appendChild(sectionNode(def));
      // A registered type can take over from one of the original hand-written types
      const replaced = def.replaces && buttons.querySelector(`[data-type="${def.replaces}"]`);
      if (replaced) replaced.style.display = 'none';
    });
  }

  // ---- Economics tests: run compute() and check the numbers, with no drawing ----

  function assertions(failures) {
    return {
      near(actual, expected, label = 'value', tol = 1e-6) {
        if (!(Math.abs(actual - expected) <= tol)) failures.push(`${label}: expected ${expected}, got ${actual}`);
      },
      ok(condition, label = 'condition') {
        if (!condition) failures.push(`${label}: not true`);
      },
    };
  }

  function runEconTests() {
    const results = [];
    all().forEach(def => {
      // A type with no economics tests is a failure, not a pass
      if (!def.tests || !def.tests.length) {
        results.push({ type: def.id, name: '(no tests)', failures: ['Every graph type needs at least one economics test'] });
        return;
      }
      def.tests.forEach(t => {
        const failures = [];
        try {
          const v = { ...defaults(def), ...(t.v || {}) };
          t.check(def.compute(v), assertions(failures), v);
        } catch (e) {
          failures.push(`threw: ${e.message}`);
        }
        results.push({ type: def.id, name: t.name, failures });
      });
    });
    return results;
  }

  return { register, get, all, defaults, build, mount, runEconTests, assertions };
})();
