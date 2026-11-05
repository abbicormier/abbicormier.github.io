// ==============================================================
// UI WIRING
// ==============================================================

let currentType = 'supply-demand';

// Add buttons and form sections for registered types before the wiring below looks them up
GraphTypes.mount();

function render() {
  document.getElementById('graph-readout').textContent = '';
  const cfg = getConfig();
  const svg = buildSVG(cfg);
  const container = document.getElementById('svgPreview');
  container.innerHTML = '';
  container.appendChild(svg);
}

// Graph type buttons
document.querySelectorAll('.graph-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.graph-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;

    // Show/hide type-specific sections
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
    const section = document.getElementById(`section-${currentType}`);
    if (section) section.classList.remove('hidden');

    // Registered types say what they use; the original types go by name
    const def = GraphTypes.get(currentType);
    const noSD = currentType === 'cost-curves' || currentType === 'budget';

    // Show/hide supply & demand inputs (not used by cost-curves or budget)
    const sdInputs = document.getElementById('sd-inputs');
    if (sdInputs) {
      sdInputs.style.display = (def ? def.usesSD : !noSD) ? '' : 'none';
    }

    // Show/hide Good Name, Qty Unit, Price Prefix (not relevant for budget or cost-curves)
    const sdLabels = document.getElementById('sd-labels');
    if (sdLabels) {
      sdLabels.style.display = (def ? def.usesLabels !== false : !noSD) ? '' : 'none';
    }

    // Swap range field labels for budget tab (Good X / Good Y instead of Qty / Price)
    const isBudget = currentType === 'budget';
    const lbl = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    lbl('lbl-qtyMin', isBudget ? 'Good X Min' : 'Qty Min');
    lbl('lbl-qtyMax', isBudget ? 'Good X Max' : 'Qty Max');
    lbl('lbl-qtyStep', isBudget ? 'Good X Step' : 'Qty Tick Step');
    lbl('lbl-priceMin', isBudget ? 'Good Y Min' : 'Price Min');
    lbl('lbl-priceMax', isBudget ? 'Good Y Max' : 'Price Max');
    lbl('lbl-priceStep', isBudget ? 'Good Y Step' : 'Price Tick Step');

    render();
  });
});

// Toggle buttons
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.parentElement;
    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

// Budget second line toggle
document.getElementById('budgetShowSecond').addEventListener('change', (e) => {
  document.getElementById('budget-second').classList.toggle('hidden', !e.target.checked);
  render();
});

// Budget tangent line toggle
document.getElementById('budgetShowTangent').addEventListener('change', (e) => {
  document.getElementById('budget-tangent').classList.toggle('hidden', !e.target.checked);
  render();
});

// Cost curve presets: compute nice MR values dynamically
function updateCCPresets() {
  const container = document.getElementById('ccPresets');
  if (!container) return;
  const acMinQ = val('ccAcMinQ');
  const acMinP = val('ccAcMinP');
  const FC = val('ccFixedCost');
  if (!acMinQ || !FC) return;

  const Q = acMinQ;
  const b = FC / (Q * Q), c = FC / (Q * Q * Q), a = acMinP - FC / Q;
  if (a <= 0) return;

  const mcFn = q => a - 2 * b * q + 3 * c * q * q;
  const acFn = q => q > 0 ? FC / q + a - b * q + c * q * q : 999;

  // Key Q values where points would collapse
  const avcMinQ = Q / 2; // AVC minimum = MC ∩ AVC

  // Test integer Q* values, find ones where MR = MC(q) is a nice integer
  const allPresets = [];
  for (let q = Math.max(2, Math.round(Q * 0.3)); q <= Math.round(Q * 1.6); q++) {
    const mr = mcFn(q);
    if (mr < 1 || mr > 200) continue;
    if (Math.abs(mr - Math.round(mr)) > 0.03) continue;
    const mrInt = Math.round(mr);
    const ac = acFn(q);
    const type = mrInt < Math.round(acMinP) ? 'Loss' : (Math.abs(mrInt - acMinP) < 0.5 ? 'Break-even' : 'Profit');
    // For non-break-even presets, skip if Q* coincides with AVC min, AC min, or MC min
    // (those cause dots to collapse or push AC@Q* off-graph, so students can't see all 5 points)
    const mcMinQ = Q / 3;
    if (type !== 'Break-even' && Math.abs(q - avcMinQ) < 1.5) continue;
    if (type !== 'Break-even' && Math.abs(q - Q) < 1.5) continue;
    if (type !== 'Break-even' && Math.abs(q - mcMinQ) < 1.5) continue;
    allPresets.push({ mr: mrInt, q: Math.round(q), type, ac });
  }
  // Pick a good spread: up to 2 losses, the break-even, and up to 2 profits
  const losses = allPresets.filter(p => p.type === 'Loss');
  const breakEven = allPresets.filter(p => p.type === 'Break-even');
  const profits = allPresets.filter(p => p.type === 'Profit');
  const presets = [];
  if (losses.length >= 2) { presets.push(losses[Math.floor(losses.length * 0.33)]); presets.push(losses[Math.floor(losses.length * 0.75)]); }
  else losses.forEach(p => presets.push(p));
  breakEven.forEach(p => presets.push(p));
  if (profits.length >= 2) { presets.push(profits[Math.floor(profits.length * 0.33)]); presets.push(profits[Math.floor(profits.length * 0.75)]); }
  else profits.forEach(p => presets.push(p));

  container.innerHTML = '';
  presets.forEach(p => {
    const btn = document.createElement('button');
    const colors = { 'Loss': '#e74c3c', 'Break-even': '#f39c12', 'Profit': '#27ae60' };
    btn.textContent = `${p.type}: MR=$${Math.round(p.mr)} \u2192 Q=${Math.round(p.q)}`;
    btn.style.cssText = `padding:3px 8px;font-size:11px;border:1px solid ${colors[p.type]};background:white;color:${colors[p.type]};border-radius:4px;cursor:pointer;font-weight:bold;`;
    btn.addEventListener('click', () => {
      document.getElementById('ccMr').value = p.mr;
      render();
    });
    container.appendChild(btn);
  });
}

// Re-render on any input change
document.querySelectorAll('input, select').forEach(input => {
  input.addEventListener('input', () => { updateCCPresets(); render(); });
  input.addEventListener('change', () => { updateCCPresets(); render(); });
});

// Initial render
updateCCPresets();
render();
