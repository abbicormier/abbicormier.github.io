// ============================================================
// ECONOMICS GRAPH GENERATOR - Core Engine
// ============================================================

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 800, H = 600;
const PAD = { top: 50, right: 80, bottom: 70, left: 75 };

// ---- Utility ----
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function val(id) {
  const e = document.getElementById(id);
  if (!e) return '';
  if (e.type === 'checkbox') return e.checked;
  if (e.type === 'number') return parseFloat(e.value) || 0;
  return e.value;
}

function toggleVal(field) {
  const btns = document.querySelectorAll(`[data-field="${field}"]`);
  for (const b of btns) { if (b.classList.contains('active')) return b.dataset.val; }
  return 'answer';
}

// ---- Coordinate transforms ----
function plotX(qVal, cfg) {
  const { qtyMin, qtyMax } = cfg;
  return PAD.left + (qVal - qtyMin) / (qtyMax - qtyMin) * (W - PAD.left - PAD.right);
}
function plotY(pVal, cfg) {
  const { priceMin, priceMax } = cfg;
  return PAD.top + (1 - (pVal - priceMin) / (priceMax - priceMin)) * (H - PAD.top - PAD.bottom);
}
function unplotX(px, cfg) {
  const { qtyMin, qtyMax } = cfg;
  return qtyMin + (px - PAD.left) / (W - PAD.left - PAD.right) * (qtyMax - qtyMin);
}
function unplotY(py, cfg) {
  const { priceMin, priceMax } = cfg;
  return priceMax - (py - PAD.top) / (H - PAD.top - PAD.bottom) * (priceMax - priceMin);
}

// ---- Line math ----
function verticalLine(q) {
  return { vertical: true, q, slope: Infinity, intercept: NaN, evalAt: () => NaN, qAt: () => q };
}

function lineFromPoints(q1, p1, q2, p2) {
  if (Math.abs(q2 - q1) < 1e-9) return verticalLine(q1); // perfectly inelastic
  const slope = (p2 - p1) / (q2 - q1);
  const intercept = p1 - slope * q1;
  return { slope, intercept, evalAt: q => slope * q + intercept,
    qAt: p => Math.abs(slope) < 1e-9 ? q1 : (p - intercept) / slope };
}

// The same line moved dq along the quantity axis and dp along the price axis.
function shiftLine(line, dq = 0, dp = 0) {
  if (line.vertical) return verticalLine(line.q + dq);
  return { slope: line.slope, intercept: line.intercept + dp - line.slope * dq,
    evalAt: q => line.evalAt(q - dq) + dp, qAt: p => line.qAt(p - dp) + dq };
}

function intersect(lineA, lineB) {
  if (lineA.vertical && lineB.vertical) return null;
  if (lineA.vertical) return { q: lineA.q, p: lineB.evalAt(lineA.q) };
  if (lineB.vertical) return { q: lineB.q, p: lineA.evalAt(lineB.q) };
  if (Math.abs(lineA.slope - lineB.slope) < 1e-9) return null;
  const q = (lineB.intercept - lineA.intercept) / (lineA.slope - lineB.slope);
  const p = lineA.evalAt(q);
  if (!isFinite(q) || !isFinite(p)) return null;
  return { q, p };
}

// ---- Auto-range: compute nice axis bounds from data ----
function niceStep(range) {
  // Pick a "nice" tick step for the given range
  if (range <= 0) return 1;
  const rough = range / 8; // aim for ~8 ticks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / mag;
  if (frac <= 1) return mag;
  if (frac <= 2.5) return 2 * mag;
  if (frac <= 5) return 5 * mag;
  return 10 * mag;
}

function autoRange(type) {
  // Collect all points that must be visible for this graph type
  const qs = [], ps = [];
  const addPt = (q, p) => { if (isFinite(q) && isFinite(p)) { qs.push(q); ps.push(p); } };
  const addLine = (line, qLo, qHi) => { addPt(qLo, line.evalAt(qLo)); addPt(qHi, line.evalAt(qHi)); };

  // Supply and demand control points
  const sq1 = val('s0_q1'), sp1 = val('s0_p1'), sq2 = val('s0_q2'), sp2 = val('s0_p2');
  const dq1 = val('d0_q1'), dp1 = val('d0_p1'), dq2 = val('d0_q2'), dp2 = val('d0_p2');
  const supply = lineFromPoints(sq1, sp1, sq2, sp2);
  const demand = lineFromPoints(dq1, dp1, dq2, dp2);

  if (type === 'budget') {
    // Budget constraint: axes are quantities of goods
    const px = val('budgetPx'), py = val('budgetPy'), inc = val('budgetIncome');
    const maxX = px > 0 ? inc / px : inc;
    const maxY = py > 0 ? inc / py : inc;
    addPt(0, 0); addPt(maxX, 0); addPt(0, maxY);
    if (val('budgetShowSecond')) {
      const px2 = val('budgetPx2'), py2 = val('budgetPy2'), inc2 = val('budgetIncome2');
      addPt(px2 > 0 ? inc2 / px2 : inc2, 0);
      addPt(0, py2 > 0 ? inc2 / py2 : inc2);
    }
    // Add bundle points
    ['A','B','C','D','E','F'].forEach(b => {
      if (val(`b${b}_on`)) addPt(val(`b${b}_x`), val(`b${b}_y`));
    });
  } else if (type === 'cost-curves') {
    const acMinQ = val('ccAcMinQ'), acMinP = val('ccAcMinP');
    const FC = val('ccFixedCost');
    const mr = val('ccMr');
    // Derive cubic TC coefficients (50% ratio)
    const b_ = FC / (acMinQ * acMinQ);
    const c_ = FC / (acMinQ * acMinQ * acMinQ);
    const a_ = acMinP - FC / acMinQ;
    const mcFn_ = q => a_ - 2 * b_ * q + 3 * c_ * q * q;
    const avcFn_ = q => a_ - b_ * q + c_ * q * q;
    // Profit-max Q
    const disc_ = 4 * b_ * b_ - 12 * c_ * (a_ - mr);
    const optQ = disc_ >= 0 ? (2 * b_ + Math.sqrt(disc_)) / (6 * c_) : acMinQ;
    const avcMinQ_ = b_ / (2 * c_);
    const mcMinQ_ = b_ / (3 * c_);
    qs.push(0);
    addPt(acMinQ, acMinP);
    addPt(avcMinQ_, avcFn_(avcMinQ_));
    addPt(mcMinQ_, mcFn_(mcMinQ_));
    addPt(optQ, mr);
    // Include MC at a point past optQ for upper range
    const farQ = optQ * 1.3;
    addPt(farQ, mcFn_(farQ));
    // Also include MC at acMinQ so price range covers the full visible MC curve
    addPt(acMinQ, mcFn_(acMinQ));
    addPt(acMinQ * 1.1, mcFn_(acMinQ * 1.1));
  } else {
    // All S&D based graphs: include curve control points (NOT intercepts)
    addPt(sq1, sp1); addPt(sq2, sp2);
    addPt(dq1, dp1); addPt(dq2, dp2);
    // Include the equilibrium
    const eq = intersect(supply, demand);
    if (eq) addPt(eq.q, eq.p);

    // Type-specific extra points
    if (type === 'shift') {
      const amt = val('shiftAmt');
      const dir = val('shiftDir') === 'right' ? 1 : -1;
      const off = amt * dir;
      if (val('shiftCurve') === 'supply') {
        const s1 = lineFromPoints(sq1 + off, sp1, sq2 + off, sp2);
        addPt(sq1 + off, sp1); addPt(sq2 + off, sp2);
        const eq2 = intersect(s1, demand);
        if (eq2) addPt(eq2.q, eq2.p);
      } else {
        const d1 = lineFromPoints(dq1 + off, dp1, dq2 + off, dp2);
        addPt(dq1 + off, dp1); addPt(dq2 + off, dp2);
        const eq2 = intersect(supply, d1);
        if (eq2) addPt(eq2.q, eq2.p);
      }
    } else if (type === 'tax') {
      const tax = val('taxAmt');
      // Tax shifts supply up — include shifted control points
      addPt(sq1, sp1 + tax); addPt(sq2, sp2 + tax);
      // Include buyer/seller prices at new equilibrium
      const taxedSupply = lineFromPoints(sq1, sp1 + tax, sq2, sp2 + tax);
      const eqTax = intersect(taxedSupply, demand);
      if (eqTax) { addPt(eqTax.q, eqTax.p); addPt(eqTax.q, supply.evalAt(eqTax.q)); }
    } else if (type === 'subsidy') {
      const sub = val('subsidyAmt');
      addPt(sq1, sp1 - sub); addPt(sq2, sp2 - sub);
      const subSupply = lineFromPoints(sq1, sp1 - sub, sq2, sp2 - sub);
      const eqSub = intersect(subSupply, demand);
      if (eqSub) { addPt(eqSub.q, eqSub.p); addPt(eqSub.q, supply.evalAt(eqSub.q)); }
    } else if (type === 'price-control') {
      const cp = val('controlPrice');
      ps.push(cp);
      // Include where the control price intersects both curves
      const qS = supply.qAt(cp), qD = demand.qAt(cp);
      if (isFinite(qS) && qS > 0) addPt(qS, cp);
      if (isFinite(qD) && qD > 0) addPt(qD, cp);
    } else if (type === 'quota') {
      const qQ = val('quotaQty');
      addPt(qQ, supply.evalAt(qQ)); addPt(qQ, demand.evalAt(qQ));
    } else if (type === 'externality') {
      const ext = val('extAmt');
      const extType = val('extType');
      // Only add the relevant social curve's control points
      if (extType === 'neg-prod' || extType === 'pos-prod') {
        const sign = extType === 'neg-prod' ? 1 : -1;
        addPt(sq1, sp1 + ext * sign); addPt(sq2, sp2 + ext * sign);
      } else {
        const sign = extType === 'pos-cons' ? 1 : -1;
        addPt(dq1, dp1 + ext * sign); addPt(dq2, dp2 + ext * sign);
      }
    } else if (type === 'trade') {
      const wp = val('worldPrice');
      ps.push(wp);
      const qS = supply.qAt(wp), qD = demand.qAt(wp);
      if (isFinite(qS) && qS > 0) addPt(qS, wp);
      if (isFinite(qD) && qD > 0) addPt(qD, wp);
    }
  }

  // Filter out nonsense values
  const validQs = qs.filter(v => isFinite(v) && Math.abs(v) < 1e6);
  let validPs = ps.filter(v => isFinite(v) && Math.abs(v) < 1e6);
  if (validQs.length < 2 || validPs.length < 2) return null; // can't auto-range

  // ---- PASS 1: Compute Q range from control points ----
  let qLo = Math.min(...validQs), qHi = Math.max(...validQs);
  const needsExtraRoom = false; // labels are well-positioned now, no extra padding needed
  const qPadFrac = 0.15;
  const qPad = Math.max((qHi - qLo) * qPadFrac, 5);
  qLo = Math.max(0, qLo - qPad);
  qHi = qHi + qPad;

  // ---- PASS 2: Evaluate ALL curves at Q range edges to get true P range ----
  // Curves extend edge-to-edge when drawn, so we must include their values at qLo/qHi
  if (type !== 'budget' && type !== 'cost-curves') {
    // Add supply & demand values at the Q range boundaries
    const addEdge = (line) => {
      const pAtLo = line.evalAt(qLo), pAtHi = line.evalAt(qHi);
      if (isFinite(pAtLo)) validPs.push(pAtLo);
      if (isFinite(pAtHi)) validPs.push(pAtHi);
    };
    addEdge(supply); addEdge(demand);

    // Also add edge values for shifted/social curves
    if (type === 'tax') {
      const tax = val('taxAmt');
      const taxedS = { evalAt: q => supply.evalAt(q) + tax };
      addEdge(taxedS);
    } else if (type === 'subsidy') {
      const sub = val('subsidyAmt');
      const subS = { evalAt: q => supply.evalAt(q) - sub };
      addEdge(subS);
    } else if (type === 'shift') {
      const amt = val('shiftAmt');
      const dir = val('shiftDir') === 'right' ? 1 : -1;
      const off = amt * dir;
      if (val('shiftCurve') === 'supply') {
        const s1 = lineFromPoints(sq1 + off, sp1, sq2 + off, sp2);
        addEdge(s1);
      } else {
        const d1 = lineFromPoints(dq1 + off, dp1, dq2 + off, dp2);
        addEdge(d1);
      }
    } else if (type === 'externality') {
      const ext = val('extAmt');
      const extType = val('extType');
      const isProduction = extType.includes('prod');
      const isNeg = extType.includes('neg');
      const sign = isNeg ? 1 : -1;
      if (isProduction) {
        addEdge({ evalAt: q => supply.evalAt(q) + ext * sign });
      } else {
        addEdge({ evalAt: q => demand.evalAt(q) + ext * sign });
      }
    }
  }

  validPs = validPs.filter(v => isFinite(v) && Math.abs(v) < 1e6);
  let pLo = Math.min(...validPs), pHi = Math.max(...validPs);

  const pRange = pHi - pLo;
  const pPadFrac = 0.1;
  const pPadTop = Math.max(pRange * pPadFrac, 0.5);
  const pPadBot = Math.max(pRange * pPadFrac, 0.5);
  pLo = Math.max(0, pLo - pPadBot);
  pHi = pHi + pPadTop;

  // Round Q to nice numbers first
  const qStep = niceStep(qHi - qLo);
  qLo = Math.floor(qLo / qStep) * qStep;
  qHi = Math.ceil(qHi / qStep) * qStep;

  // ---- PASS 3: Q rounding may have expanded Q range. Re-check curve P values at rounded boundaries ----
  if (type !== 'budget' && type !== 'cost-curves') {
    const recheck = (line) => {
      const pL = line.evalAt(qLo), pH = line.evalAt(qHi);
      if (isFinite(pL) && pL > 0) pHi = Math.max(pHi, pL);
      if (isFinite(pH) && pH > 0) pHi = Math.max(pHi, pH);
    };
    recheck(supply); recheck(demand);
    // Re-check shifted/social curves too
    if (type === 'shift') {
      const off = val('shiftAmt') * (val('shiftDir') === 'right' ? 1 : -1);
      if (val('shiftCurve') === 'supply') recheck(lineFromPoints(sq1+off,sp1,sq2+off,sp2));
      else recheck(lineFromPoints(dq1+off,dp1,dq2+off,dp2));
    } else if (type === 'tax') {
      recheck({ evalAt: q => supply.evalAt(q) + val('taxAmt'), qAt: () => NaN });
    } else if (type === 'subsidy') {
      recheck({ evalAt: q => supply.evalAt(q) - val('subsidyAmt'), qAt: () => NaN });
    } else if (type === 'externality') {
      const ext = val('extAmt'), et = val('extType');
      const sign = et.includes('neg') ? 1 : -1;
      if (et.includes('prod')) recheck({ evalAt: q => supply.evalAt(q) + ext*sign, qAt: () => NaN });
      else recheck({ evalAt: q => demand.evalAt(q) + ext*sign, qAt: () => NaN });
    }
    // Re-apply padding to the potentially expanded pHi
    const pRange2 = pHi - pLo;
    pHi = pHi + Math.max(pRange2 * 0.05, 0.5); // small extra bump after recheck
  }

  // Round P to nice numbers
  const pStep = niceStep(pHi - pLo);
  pLo = Math.floor(pLo / pStep) * pStep;
  pHi = Math.ceil(pHi / pStep) * pStep;

  // Ensure min < max
  if (qLo >= qHi) qHi = qLo + qStep;
  if (pLo >= pHi) pHi = pLo + pStep;

  return { qtyMin: qLo, qtyMax: qHi, qtyStep: qStep, priceMin: pLo, priceMax: pHi, priceStep: pStep };
}

// ---- Build config from form ----
function getConfig() {
  const useAuto = val('autoRange');
  let qMin, qMax, qStep, pMin, pMax, pStep;
  if (useAuto) {
    // Registered types compute their own range per panel in GraphTypes.build
    const ar = GraphTypes.get(currentType) ? null : autoRange(currentType);
    if (ar) {
      qMin = ar.qtyMin; qMax = ar.qtyMax; qStep = ar.qtyStep;
      pMin = ar.priceMin; pMax = ar.priceMax; pStep = ar.priceStep;
    } else {
      qMin = val('qtyMin'); qMax = val('qtyMax'); qStep = val('qtyStep') || 50;
      pMin = val('priceMin'); pMax = val('priceMax'); pStep = val('priceStep') || 1;
    }
    // Write computed values into the manual fields so user can see them
    const setField = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setField('qtyMin', qMin); setField('qtyMax', qMax); setField('qtyStep', qStep);
    setField('priceMin', pMin); setField('priceMax', pMax); setField('priceStep', pStep);
    const mf = document.getElementById('manualRangeFields');
    if (mf) mf.style.opacity = '0.5';
  } else {
    qMin = val('qtyMin'); qMax = val('qtyMax'); qStep = val('qtyStep') || 50;
    pMin = val('priceMin'); pMax = val('priceMax'); pStep = val('priceStep') || 1;
    const mf = document.getElementById('manualRangeFields');
    if (mf) mf.style.opacity = '1';
  }
  if (qMin >= qMax) qMax = qMin + 100;
  if (pMin >= pMax) pMax = pMin + 10;

  const c = {
    type: currentType,
    goodName: val('goodName'),
    qtyUnit: val('qtyUnit'),
    pricePrefix: val('pricePrefix'),
    qtyMin: qMin, qtyMax: qMax, qtyStep: qStep,
    priceMin: pMin, priceMax: pMax, priceStep: pStep,
    supply: lineFromPoints(val('s0_q1'), val('s0_p1'), val('s0_q2'), val('s0_p2')),
    demand: lineFromPoints(val('d0_q1'), val('d0_p1'), val('d0_q2'), val('d0_p2')),
    s0Label: val('s0_label'), d0Label: val('d0_label'),
    eqLabel: val('eqLabel'),
    showDashed: val('showDashedLines'),
    showInterceptLabels: val('showInterceptLabels'),
    showGrid: val('showGrid'),
    symbolic: val('symbolicAxes'),
    font: val('fontFamily'),
    annotation: val('annotationText'),
  };
  // Budget constraint: override axis labels to show good names instead of price/quantity
  if (c.type === 'budget') {
    const gx = val('budgetGoodX') || 'Good X';
    const gy = val('budgetGoodY') || 'Good Y';
    c.xAxisTitle = `Quantity of ${gx}`;
    c.yAxisTitle = `Quantity of ${gy}`;
    c.yTickPrefix = ''; // no dollar sign on Y-axis for budget constraints
  }
  // Cost curves: override axis labels
  if (c.type === 'cost-curves') {
    c.xAxisTitle = 'Quantity';
    c.yAxisTitle = 'Cost / Revenue ($)';
  }
  return c;
}

// ---- SVG Builder ----
function buildSVG(cfg, forExport) {
  const registered = GraphTypes.get(cfg.type);
  if (registered) return GraphTypes.build(registered, cfg, forExport);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (forExport) {
    // Fixed dimensions for PNG/SVG/PPTX export (Image() needs explicit size)
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
  } else {
    // Responsive for on-screen preview
    svg.setAttribute('width', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('style', `font-family: ${cfg.font}, Arial, sans-serif; max-width: ${W}px;`);
  }
  if (forExport) svg.setAttribute('style', `font-family: ${cfg.font}, Arial, sans-serif;`);

  // Background
  el('rect', { x: 0, y: 0, width: W, height: H, fill: 'white' }, svg);

  // Grid
  if (cfg.showGrid && !cfg.symbolic) drawGrid(svg, cfg);

  // Axes
  drawAxes(svg, cfg);

  // Dispatch to graph-type renderer
  const renderers = {
    'supply-demand': renderBasicSD,
    'shift': renderShift,
    'tax': renderTax,
    'subsidy': renderSubsidy,
    'price-control': renderPriceControl,
    'quota': renderQuota,
    'externality': renderExternality,
    'budget': renderBudget,
    'trade': renderTrade,
    'cost-curves': renderCostCurves,
  };
  const render = renderers[cfg.type] || renderBasicSD;
  resetEqLabels();
  resetInterceptLabels();
  render(svg, cfg);

  // Annotation overlay — bottom-right inside the plot area
  if (cfg.annotation) {
    const ax = W - PAD.right - 8;
    const ay = H - PAD.bottom - 10;
    textBg(svg, ax, ay, cfg.annotation, {
      'font-size': 15, 'font-weight': 'bold', fill: '#2563eb', 'text-anchor': 'end'
    });
  }

  return svg;
}

// Ticks by index rather than repeated addition, so 0.4 + 0.4 + 0.4 can't print as 1.2000000000000002
function tickValues(min, max, step) {
  if (!(step > 0)) return [min, max];
  const out = [];
  for (let i = 0; min + i * step <= max + step * 1e-9; i++) out.push(+(min + i * step).toFixed(10));
  return out;
}

function drawGrid(svg, cfg) {
  const g = el('g', { class: 'grid' }, svg);
  const { qtyMin, qtyMax, qtyStep, priceMin, priceMax, priceStep } = cfg;

  // Vertical lines (quantity ticks)
  tickValues(qtyMin, qtyMax, qtyStep).forEach(q => {
    const x = plotX(q, cfg);
    el('line', { x1: x, y1: PAD.top, x2: x, y2: H - PAD.bottom, stroke: '#ddd', 'stroke-width': 1 }, g);
  });
  // Horizontal lines (price ticks)
  tickValues(priceMin, priceMax, priceStep).forEach(p => {
    const y = plotY(p, cfg);
    el('line', { x1: PAD.left, y1: y, x2: W - PAD.right, y2: y, stroke: '#ddd', 'stroke-width': 1 }, g);
  });
}

function drawAxes(svg, cfg) {
  const g = el('g', { class: 'axes' }, svg);
  const { qtyMin, qtyMax, qtyStep, priceMin, priceMax, priceStep, pricePrefix, goodName, qtyUnit } = cfg;
  const x0 = PAD.left, x1 = W - PAD.right, y0 = H - PAD.bottom, y1 = PAD.top;

  // X axis
  el('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: '#222', 'stroke-width': 2 }, g);
  // Y axis
  el('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: '#222', 'stroke-width': 2 }, g);

  // Conceptual graphs show no numbers on the axes
  if (!cfg.symbolic) {
    // X ticks & labels
    tickValues(qtyMin, qtyMax, qtyStep).slice(1).forEach(q => {
      const x = plotX(q, cfg);
      el('line', { x1: x, y1: y0, x2: x, y2: y0 + 5, stroke: '#222', 'stroke-width': 1.5 }, g);
      el('text', { x, y: y0 + 20, 'text-anchor': 'middle', 'font-size': 11, fill: '#333' }, g).textContent = q;
    });

    // Y ticks & labels
    const yTickPrefix = cfg.yTickPrefix !== undefined ? cfg.yTickPrefix : pricePrefix;
    tickValues(priceMin, priceMax, priceStep).slice(1).forEach(p => {
      const y = plotY(p, cfg);
      el('line', { x1: x0 - 5, y1: y, x2: x0, y2: y, stroke: '#222', 'stroke-width': 1.5 }, g);
      const label = Number.isInteger(p) ? yTickPrefix + p : yTickPrefix + p.toFixed(2);
      el('text', { x: x0 - 10, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#333' }, g).textContent = label;
    });
  }

  // Axis titles — allow override for budget constraints / cost curves
  const xTitle = cfg.xAxisTitle || (`Quantity of ${goodName}` + (qtyUnit ? ` (${qtyUnit})` : ''));
  el('text', { x: (x0 + x1) / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 'bold', fill: '#222' }, g).textContent = xTitle;

  const yTitle = cfg.yAxisTitle || `Price of ${goodName}`;
  const yt = el('text', { x: 18, y: (y0 + y1) / 2, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 'bold', fill: '#222', transform: `rotate(-90, 18, ${(y0 + y1) / 2})` }, g);
  yt.textContent = yTitle;

  // Optional: suppress price prefix on Y-axis tick labels (for non-monetary axes)
  // This is used by budget constraint which labels axes as quantities, not prices
}

// ---- Label with white background (readable over gridlines/curves) ----
function textBg(svg, x, y, text, attrs = {}) {
  const fontSize = parseFloat(attrs['font-size'] || 13);
  const anchor = attrs['text-anchor'] || 'start';
  const isBold = attrs['font-weight'] === 'bold';
  const charW = fontSize * (isBold ? 0.62 : 0.56);
  const padX = 3, padY = 2;
  const lines = String(text).split('\n');
  const lineH = fontSize * 1.25;
  const maxW = Math.max(...lines.map(l => l.length * charW));
  const totalH = lines.length * lineH;
  // Background rect
  let rx = x - padX;
  if (anchor === 'middle') rx = x - maxW / 2 - padX;
  else if (anchor === 'end') rx = x - maxW - padX;
  el('rect', {
    x: rx, y: y - fontSize + padY, width: maxW + padX * 2, height: totalH + padY * 2,
    fill: 'white', opacity: 0, rx: 2
  }, svg);
  if (lines.length === 1) {
    const t = el('text', { x, y, ...attrs }, svg);
    t.textContent = text;
    return t;
  }
  // Multiline: use <tspan> elements
  const t = el('text', { x, y, ...attrs }, svg);
  lines.forEach((line, i) => {
    const tspan = document.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', x);
    if (i > 0) tspan.setAttribute('dy', lineH);
    tspan.textContent = line;
    t.appendChild(tspan);
  });
  return t;
}

// ---- Draw a linear curve clipped to the plot area ----
function drawCurve(svg, line, cfg, color, label, dashed = false, thickness = 2.5, labelBelow = false) {
  const { qtyMin, qtyMax, priceMin, priceMax } = cfg;
  if (line.vertical) {
    const x = plotX(line.q, cfg);
    const attrs = { x1: x, y1: plotY(priceMin, cfg), x2: x, y2: plotY(priceMax, cfg), stroke: color, 'stroke-width': thickness };
    if (dashed) attrs['stroke-dasharray'] = '8,5';
    el('line', attrs, svg);
    if (label) textBg(svg, x + 6, PAD.top + 14, label, { 'font-size': 14, 'font-weight': 'bold', fill: color, 'text-anchor': 'start' });
    return;
  }
  // Find visible segment
  let q1 = qtyMin, q2 = qtyMax;
  let p1 = line.evalAt(q1), p2 = line.evalAt(q2);
  // Clip to price range, then clamp q within qty bounds
  if (p1 < priceMin) { q1 = line.qAt(priceMin); p1 = priceMin; }
  if (p1 > priceMax) { q1 = line.qAt(priceMax); p1 = priceMax; }
  if (p2 < priceMin) { q2 = line.qAt(priceMin); p2 = priceMin; }
  if (p2 > priceMax) { q2 = line.qAt(priceMax); p2 = priceMax; }
  q1 = Math.max(qtyMin, Math.min(qtyMax, q1));
  q2 = Math.max(qtyMin, Math.min(qtyMax, q2));

  const x1 = plotX(q1, cfg), y1 = plotY(p1, cfg);
  const x2 = plotX(q2, cfg), y2 = plotY(p2, cfg);

  const attrs = { x1, y1, x2, y2, stroke: color, 'stroke-width': thickness };
  if (dashed) attrs['stroke-dasharray'] = '8,5';
  el('line', attrs, svg);

  // Label along the curve, near the high-price end, always INSIDE the plot
  if (label) {
    const plotRight = W - PAD.right;
    const plotLeft = PAD.left;
    const plotTop = PAD.top;
    const plotBot = H - PAD.bottom;
    const isUpward = p2 > p1;
    let lx, ly, labelAnchor;

    const lineCount = String(label).split('\n').length;
    const yOffsetAbove = lineCount > 1 ? -10 - (lineCount - 1) * 16 : -10;
    const yOffsetBelow = 68;

    if (isUpward) {
      // Supply-like (upward slope): label near the top-right end
      const frac = labelBelow ? 1.0 : 0.85;
      lx = x1 + (x2 - x1) * frac;
      ly = y1 + (y2 - y1) * frac + (labelBelow ? yOffsetBelow : yOffsetAbove);
      labelAnchor = 'end';
    } else {
      // Demand-like (downward slope): label near the top-left end
      // Position 15% along the visible segment, offset above the line
      const frac = 0.15;
      lx = x1 + (x2 - x1) * frac;
      ly = y1 + (y2 - y1) * frac + yOffsetAbove;
      labelAnchor = 'start';
      // Keep clear of Y-axis
      if (lx < plotLeft + 15) lx = plotLeft + 15;
    }
    // Clamp within the plot area
    lx = Math.max(plotLeft + 5, Math.min(lx, plotRight - 5));
    ly = Math.max(plotTop + 14, Math.min(ly, plotBot - 5));
    textBg(svg, lx, ly, label, { 'font-size': 14, 'font-weight': 'bold', fill: color, 'text-anchor': labelAnchor });
  }
}

// ---- Draw intercept labels on axes for a given (q, p) point ----
// Draws small tick marks and value labels on X and Y axes where dashed lines meet them
let _interceptLabels = []; // track to avoid overlaps
function resetInterceptLabels() { _interceptLabels = []; }

function drawInterceptLabels(svg, q, p, cfg, opts = {}) {
  if (!cfg.showInterceptLabels || cfg.symbolic) return;
  const prefix = cfg.pricePrefix || '';
  const yTickPrefix = cfg.yTickPrefix !== undefined ? cfg.yTickPrefix : prefix;
  const x0 = plotX(cfg.qtyMin, cfg);
  const y0 = plotY(cfg.priceMin, cfg);
  const color = opts.color || '#c0392b';
  const fontSize = 11;

  // Check for overlap with existing intercept labels (only skip if essentially the same value)
  const tooClose = (val, axis) => {
    for (const prev of _interceptLabels) {
      if (prev.axis === axis && Math.abs(prev.val - val) < 0.05) return true;
    }
    return false;
  };

  // Helper: draw text with opaque white background to cover underlying axis tick labels
  const charW = fontSize * 0.62; // bold char width estimate
  const padX = 3, padY = 2;

  // X-axis intercept (quantity value)
  // Matches regular tick positioning: tick line y0 to y0+5, text at y0+20
  if (!opts.skipX && q > cfg.qtyMin && q < cfg.qtyMax && !tooClose(q, 'x')) {
    const px = plotX(q, cfg);
    el('line', { x1: px, y1: y0, x2: px, y2: y0 + 5, stroke: color, 'stroke-width': 1.5 }, svg);
    const qLabel = Math.abs(q - Math.round(q)) < 0.01 ? String(Math.round(q)) : q.toFixed(1);
    const tw = qLabel.length * charW;
    el('rect', { x: px - tw / 2 - padX, y: y0 + 20 - fontSize + padY, width: tw + padX * 2, height: fontSize * 1.25 + padY * 2, fill: 'white', rx: 2 }, svg);
    el('text', { x: px, y: y0 + 20, 'text-anchor': 'middle', 'font-size': fontSize, 'font-weight': 'bold', fill: color }, svg).textContent = qLabel;
    _interceptLabels.push({ axis: 'x', val: q });
  }

  // Y-axis intercept (price value)
  // Matches regular tick positioning: tick line x0-5 to x0, text at x0-10, y+4
  if (!opts.skipY && p > cfg.priceMin && p < cfg.priceMax && !tooClose(p, 'y')) {
    const py = plotY(p, cfg);
    el('line', { x1: x0 - 5, y1: py, x2: x0, y2: py, stroke: color, 'stroke-width': 1.5 }, svg);
    const pLabel = Math.abs(p - Math.round(p)) < 0.01 ? yTickPrefix + Math.round(p) : yTickPrefix + p.toFixed(2);
    const tw = pLabel.length * charW;
    el('rect', { x: x0 - 10 - tw - padX, y: py + 4 - fontSize + padY, width: tw + padX * 2, height: fontSize * 1.25 + padY * 2, fill: 'white', rx: 2 }, svg);
    el('text', { x: x0 - 10, y: py + 4, 'text-anchor': 'end', 'font-size': fontSize, 'font-weight': 'bold', fill: color }, svg).textContent = pLabel;
    _interceptLabels.push({ axis: 'y', val: p });
  }
}

// Track placed equilibrium labels for collision avoidance
let _eqLabels = [];
function resetEqLabels() { _eqLabels = []; }

// ---- Draw equilibrium marker ----
function drawEquilibrium(svg, q, p, label, cfg, color = '#222') {
  const x = plotX(q, cfg), y = plotY(p, cfg);

  if (cfg.showDashed) {
    el('line', { x1: x, y1: y, x2: x, y2: plotY(cfg.priceMin, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    el('line', { x1: x, y1: y, x2: plotX(cfg.qtyMin, cfg), y2: y, stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    drawInterceptLabels(svg, q, p, cfg, { color: '#c0392b' });
  }

  el('circle', { cx: x, cy: y, r: 5.5, fill: color, stroke: 'white', 'stroke-width': 2 }, svg);

  // Label slightly above and to the right of the point
  let lx = x + 6, ly = y - 14;
  // Collision avoidance: offset if too close to a previous label
  for (const prev of _eqLabels) {
    if (Math.abs(lx - prev.x) < 30 && Math.abs(ly - prev.y) < 20) {
      ly = prev.y + 22;
    }
  }
  _eqLabels.push({ x: lx, y: ly });
  textBg(svg, lx, ly, label, { 'font-size': 15, 'font-weight': 'bold', fill: color, 'text-anchor': 'middle' });
}

// ---- Draw horizontal line (price floor/ceiling/world price) ----
function drawHLine(svg, price, cfg, color, label, dashed = true, side = 'right') {
  const y = plotY(price, cfg);
  const x0 = PAD.left, x1 = W - PAD.right;
  const attrs = { x1: x0, y1: y, x2: x1, y2: y, stroke: color, 'stroke-width': 2 };
  if (dashed) attrs['stroke-dasharray'] = '10,5';
  el('line', attrs, svg);
  if (label) {
    const ly = y < PAD.top + 25 ? y + 18 : y - 8;
    if (side === 'left') {
      textBg(svg, x0 + 21, ly, label, { 'font-size': 11, 'font-weight': 'bold', fill: color, 'text-anchor': 'start' });
    } else {
      textBg(svg, x1 - 3, ly, label, { 'font-size': 11, 'font-weight': 'bold', fill: color, 'text-anchor': 'end' });
    }
  }
}

// ---- Draw vertical line ----
function drawVLine(svg, qty, cfg, color, label, dashed = true) {
  const x = plotX(qty, cfg);
  const y0 = H - PAD.bottom, y1 = PAD.top;
  const attrs = { x1: x, y1: y0, x2: x, y2: y1, stroke: color, 'stroke-width': 2 };
  if (dashed) attrs['stroke-dasharray'] = '10,5';
  el('line', attrs, svg);
  if (label) {
    textBg(svg, x, y1 - 8, label, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: color });
  }
}

// ---- Draw shaded polygon ----
function drawRegion(svg, points, cfg, color) {
  const pts = points.map(([q, p]) => `${plotX(q, cfg)},${plotY(p, cfg)}`).join(' ');
  el('polygon', { points: pts, fill: color, stroke: 'none', opacity: 0.25 }, svg);
}

// ---- Draw bracket annotation between two prices at a given quantity ----
// side: 'right' (default) or 'left' — which side of the reference point to draw
function drawBracket(svg, q, p1, p2, label, cfg, color = '#222', side = 'right') {
  const x = plotX(q, cfg), y1 = plotY(p1, cfg), y2 = plotY(p2, cfg);
  const dir = side === 'right' ? 1 : -1;
  // Top cap
  el('line', { x1: x, y1, x2: x + 8 * dir, y2: y1, stroke: color, 'stroke-width': 1.5 }, svg);
  // Vertical bar
  el('line', { x1: x + 8 * dir, y1, x2: x + 8 * dir, y2, stroke: color, 'stroke-width': 1.5 }, svg);
  // Bottom cap
  el('line', { x1: x, y1: y2, x2: x + 8 * dir, y2, stroke: color, 'stroke-width': 1.5 }, svg);
  // Label
  if (label) {
    const lx = x + 14 * dir;
    const anchor = side === 'right' ? 'start' : 'end';
    textBg(svg, lx, (y1 + y2) / 2 + 4, label, { 'font-size': 11, 'font-weight': 'bold', fill: color, 'text-anchor': anchor });
  }
}

// ---- Draw vertical arrow between two prices at a given quantity ----
// arrowDir: 'up' (arrowhead at top only), 'down' (at bottom only), 'both' (double-headed)
function drawVerticalArrow(svg, q, p1, p2, label, cfg, color = '#555', side = 'right', arrowDir = 'both') {
  const x = plotX(q, cfg), y1 = plotY(p1, cfg), y2 = plotY(p2, cfg);
  const rawTopY = Math.min(y1, y2), rawBotY = Math.max(y1, y2);
  // Inset arrow so it doesn't extend past the B/C dots
  const inset = 8;
  const topY = rawTopY + inset, botY = rawBotY - inset;
  const arrowSize = 6;
  const sw = 2.5;
  const dir = side === 'right' ? 1 : -1;

  // Vertical line
  el('line', { x1: x, y1: topY, x2: x, y2: botY, stroke: color, 'stroke-width': sw }, svg);
  // Top arrowhead
  if (arrowDir === 'up' || arrowDir === 'both') {
    el('line', { x1: x - arrowSize, y1: topY + arrowSize, x2: x, y2: topY, stroke: color, 'stroke-width': sw }, svg);
    el('line', { x1: x + arrowSize, y1: topY + arrowSize, x2: x, y2: topY, stroke: color, 'stroke-width': sw }, svg);
  }
  // Bottom arrowhead
  if (arrowDir === 'down' || arrowDir === 'both') {
    el('line', { x1: x - arrowSize, y1: botY - arrowSize, x2: x, y2: botY, stroke: color, 'stroke-width': sw }, svg);
    el('line', { x1: x + arrowSize, y1: botY - arrowSize, x2: x, y2: botY, stroke: color, 'stroke-width': sw }, svg);
  }
  // Label to the side, close to the arrow
  if (label) {
    const lx = x + 7 * dir;
    const anchor = side === 'right' ? 'start' : 'end';
    const lines = label.split('\n').length;
    const lineH = 13;
    const ly = (rawTopY + rawBotY) / 2 - (lines - 1) * lineH / 2 - 2;
    textBg(svg, lx, ly, label, { 'font-size': 11, 'font-weight': 'bold', fill: color, 'text-anchor': anchor });
  }
}

// ---- U-shaped curve (for cost curves) ----
function drawCostCurve(svg, evalFn, cfg, color, label, qRange, thickness = 2.5) {
  const startQ = qRange ? qRange[0] : cfg.qtyMin;
  const endQ = qRange ? qRange[1] : cfg.qtyMax;
  const steps = 100;
  const pts = [];
  let lastVisQ = startQ, lastVisP = evalFn(startQ);
  for (let i = 0; i <= steps; i++) {
    const q = startQ + (endQ - startQ) * i / steps;
    const p = evalFn(q);
    if (p >= cfg.priceMin && p <= cfg.priceMax && q > 0) {
      pts.push(`${plotX(q, cfg)},${plotY(p, cfg)}`);
      lastVisQ = q; lastVisP = p;
    }
  }
  if (pts.length > 1) {
    el('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': thickness }, svg);
  }
  if (label) {
    const lp = Math.min(lastVisP, cfg.priceMax);
    textBg(svg, plotX(Math.min(lastVisQ, cfg.qtyMax), cfg) + 5, plotY(lp, cfg), label, { 'font-size': 13, 'font-weight': 'bold', fill: color });
  }
}
