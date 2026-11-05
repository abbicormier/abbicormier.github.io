// ==============================================================
// AUTOMATED TEST HARNESS
// ==============================================================

function runAllTests() {
  const results = [];
  const log = (msg, pass) => results.push({ msg, pass });

  // Save current state
  const savedType = currentType;
  const savedValues = {};
  document.querySelectorAll('input, select').forEach(el => {
    savedValues[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });

  // Force auto-range on for testing
  const arEl = document.getElementById('autoRange');
  if (arEl) arEl.checked = true;

  // Test configurations: [type, overrides, description]
  const tests = [
    ['supply-demand', {}, 'Basic S&D (defaults)'],
    ['supply-demand', { s0_q1: 20, s0_p1: 1, s0_q2: 200, s0_p2: 10, d0_q1: 20, d0_p1: 10, d0_q2: 200, d0_p2: 1 }, 'Basic S&D (small range)'],
    ['supply-demand', { s0_q1: 100, s0_p1: 5, s0_q2: 500, s0_p2: 25, d0_q1: 100, d0_p1: 25, d0_q2: 500, d0_p2: 5 }, 'Basic S&D (large range)'],
    ['shift', {}, 'Shift (defaults)'],
    ['shift', { shiftAmt: 100 }, 'Shift (large shift)'],
    ['tax', {}, 'Tax (defaults)'],
    ['tax', { taxAmt: 5 }, 'Tax (large tax)'],
    ['subsidy', {}, 'Subsidy (defaults)'],
    ['subsidy', { subsidyAmt: 5 }, 'Subsidy (large)'],
    ['price-control', {}, 'Price Floor (defaults)'],
    ['price-control', { controlPrice: 4, controlType: 'ceiling' }, 'Price Ceiling'],
    ['price-control', { controlPrice: 5 }, 'Price Floor (non-binding)'],
    ['quota', {}, 'Quota (defaults)'],
    ['externality', {}, 'Externality neg-prod (defaults)'],
    ['externality', { extType: 'neg-cons' }, 'Externality neg-cons'],
    ['externality', { extType: 'pos-prod' }, 'Externality pos-prod'],
    ['externality', { extType: 'pos-cons' }, 'Externality pos-cons'],
    ['externality', { extAmt: 5 }, 'Externality (large)'],
    ['budget', {}, 'Budget (defaults)'],
    ['budget', { budgetShowSecond: true }, 'Budget (two lines)'],
    ['trade', {}, 'Trade (defaults)'],
    ['trade', { worldPrice: 10 }, 'Trade (high wp)'],
    ['cost-curves', {}, 'Cost Curves (defaults)'],
  ];

  // Also test with annotation
  tests.push(['supply-demand', { annotationText: 'Spring 2025 - ECON 101' }, 'S&D + long annotation']);

  const plotLeft = PAD.left, plotRight = W - PAD.right;
  const plotTop = PAD.top, plotBot = H - PAD.bottom;

  tests.forEach(([type, overrides, desc]) => {
    // Reset to defaults
    Object.entries(savedValues).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = v;
      else el.value = v;
    });
    // Apply overrides
    Object.entries(overrides).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = v;
      else el.value = v;
    });
    currentType = type;

    // Force auto-range
    if (arEl) arEl.checked = true;

    // Build SVG in memory
    const cfg = getConfig();
    const svg = buildSVG(cfg);
    // Must attach to DOM briefly for getBBox to work
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.appendChild(svg);

    let issues = [];

    // CHECK 1: All <text> elements within SVG bounds (skip rotated labels)
    svg.querySelectorAll('text').forEach(t => {
      if (t.getAttribute('transform')) return; // skip rotated Y-axis title
      try {
        const bbox = t.getBBox();
        const txt = t.textContent.substring(0, 25);
        if (bbox.x < -5) issues.push(`"${txt}" off left`);
        if (bbox.x + bbox.width > W + 5) issues.push(`"${txt}" off right`);
        if (bbox.y < -5) issues.push(`"${txt}" off top`);
        if (bbox.y + bbox.height > H + 5) issues.push(`"${txt}" off bottom`);
      } catch (e) {}
    });

    // CHECK 2: Curve lines — endpoints shouldn't be AT the very edge of the plot
    svg.querySelectorAll('line').forEach(ln => {
      const sw = parseFloat(ln.getAttribute('stroke-width'));
      if (sw < 2) return; // skip grid/axis lines
      const color = ln.getAttribute('stroke') || '';
      if (color === '#222') return; // skip axis lines
      const y1 = +ln.getAttribute('y1'), y2 = +ln.getAttribute('y2');
      const x1 = +ln.getAttribute('x1'), x2 = +ln.getAttribute('x2');
      if (Math.abs(x1 - x2) < 2) return; // skip vertical lines (quota, etc.)
      if (Math.abs(y1 - plotTop) < 1) issues.push(`Curve ${color} clipped at TOP`);
      if (Math.abs(y2 - plotTop) < 1) issues.push(`Curve ${color} clipped at TOP`);
    });

    // CHECK 3: Text overlaps with other text
    const textBoxes = [];
    svg.querySelectorAll('text').forEach(t => {
      try {
        const bbox = t.getBBox();
        const txt = t.textContent.substring(0, 20);
        // Skip axis tick labels (they're expected to be close together)
        if (bbox.width < 30 && bbox.height < 15 && txt.match(/^\$?\d/)) return;
        textBoxes.push({ txt, x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height });
      } catch (e) {}
    });
    for (let i = 0; i < textBoxes.length; i++) {
      for (let j = i + 1; j < textBoxes.length; j++) {
        const a = textBoxes[i], b = textBoxes[j];
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
        if (overlapX && overlapY) {
          // Calculate overlap area
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          const area = ox * oy;
          const minArea = Math.min(a.w * a.h, b.w * b.h);
          if (area > minArea * 0.3) { // >30% overlap
            issues.push(`Overlap: "${a.txt}" + "${b.txt}"`);
          }
        }
      }
    }

    // CHECK 4: Auto-range produced valid values
    if (cfg.qtyMin >= cfg.qtyMax) issues.push(`Bad Q range: ${cfg.qtyMin} >= ${cfg.qtyMax}`);
    if (cfg.priceMin >= cfg.priceMax) issues.push(`Bad P range: ${cfg.priceMin} >= ${cfg.priceMax}`);
    if (cfg.qtyStep <= 0) issues.push(`Bad Q step: ${cfg.qtyStep}`);
    if (cfg.priceStep <= 0) issues.push(`Bad P step: ${cfg.priceStep}`);

    // CHECK 5: Reasonable tick count
    const qTicks = (cfg.qtyMax - cfg.qtyMin) / cfg.qtyStep;
    const pTicks = (cfg.priceMax - cfg.priceMin) / cfg.priceStep;
    if (qTicks < 3) issues.push(`Too few Q ticks: ${qTicks}`);
    if (qTicks > 15) issues.push(`Too many Q ticks: ${qTicks}`);
    if (pTicks < 3) issues.push(`Too few P ticks: ${pTicks}`);
    if (pTicks > 15) issues.push(`Too many P ticks: ${pTicks}`);

    document.body.removeChild(temp);

    if (issues.length === 0) {
      log(`✅ ${desc}: Q[${cfg.qtyMin},${cfg.qtyMax}]/${cfg.qtyStep} P[${cfg.priceMin},${cfg.priceMax}]/${cfg.priceStep}`, true);
    } else {
      log(`❌ ${desc}: ${issues.join('; ')}`, false);
    }
  });

  // Restore state
  Object.entries(savedValues).forEach(([id, v]) => {
    const e = document.getElementById(id);
    if (!e) return;
    if (e.type === 'checkbox') e.checked = v;
    else e.value = v;
  });
  currentType = savedType;
  render();

  // Display results
  const container = document.getElementById('testResults');
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  let html = `<div style="font-weight:bold; margin-bottom:4px; color:${passed === total ? '#22c55e' : '#ef4444'}">${passed}/${total} passed</div>`;
  results.forEach(r => {
    html += `<div style="color:${r.pass ? '#22c55e' : '#ef4444'}; margin:1px 0;">${r.msg}</div>`;
  });
  container.innerHTML = html;
}
