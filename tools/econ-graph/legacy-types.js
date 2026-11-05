// ==============================================================
// GRAPH TYPE RENDERERS
// ==============================================================

function renderBasicSD(svg, cfg) {
  drawCurve(svg, cfg.supply, cfg, '#c0392b', cfg.s0Label);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', cfg.d0Label);

  const eq = intersect(cfg.supply, cfg.demand);
  if (eq) {
    drawEquilibrium(svg, eq.q, eq.p, cfg.eqLabel, cfg);
    updateEqDisplay(eq, cfg);
  }
}

function renderShift(svg, cfg) {
  const shiftCurve = val('shiftCurve');
  const shiftDir = val('shiftDir');
  const shiftAmt = val('shiftAmt');
  const shiftLabel = val('shiftLabel');
  const shiftEqLabel = val('shiftEqLabel');
  const mode = toggleVal('shiftMode');

  // Draw originals
  drawCurve(svg, cfg.supply, cfg, '#c0392b', cfg.s0Label);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', cfg.d0Label);

  const eq = intersect(cfg.supply, cfg.demand);
  if (eq) drawEquilibrium(svg, eq.q, eq.p, cfg.eqLabel, cfg);

  if (mode === 'answer') {
    const offset = shiftDir === 'right' ? shiftAmt : -shiftAmt;
    let shifted;
    if (shiftCurve === 'supply') {
      shifted = lineFromPoints(val('s0_q1') + offset, val('s0_p1'), val('s0_q2') + offset, val('s0_p2'));
      drawCurve(svg, shifted, cfg, '#e74c3c', shiftLabel);
      const newEq = intersect(shifted, cfg.demand);
      if (newEq) { drawEquilibrium(svg, newEq.q, newEq.p, shiftEqLabel, cfg); updateEqDisplay(newEq, cfg, 'New '); return; }
    } else {
      shifted = lineFromPoints(val('d0_q1') + offset, val('d0_p1'), val('d0_q2') + offset, val('d0_p2'));
      drawCurve(svg, shifted, cfg, '#3498db', shiftLabel);
      const newEq = intersect(cfg.supply, shifted);
      if (newEq) { drawEquilibrium(svg, newEq.q, newEq.p, shiftEqLabel, cfg); updateEqDisplay(newEq, cfg, 'New '); return; }
    }
  }
  if (eq) updateEqDisplay(eq, cfg);
}

function renderTax(svg, cfg) {
  const taxAmt = val('taxAmt');
  const taxOn = val('taxOn');
  const mode = toggleVal('taxMode');
  const showLabels = val('showTaxLabels');
  const showWedge = val('showTaxWedge');

  drawCurve(svg, cfg.supply, cfg, '#c0392b', cfg.s0Label);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', cfg.d0Label);

  const eq = intersect(cfg.supply, cfg.demand);
  if (eq) drawEquilibrium(svg, eq.q, eq.p, cfg.eqLabel, cfg);

  if (mode === 'answer') {
    let taxedLine;
    if (taxOn === 'sellers') {
      // Shift supply up by tax amount
      taxedLine = { slope: cfg.supply.slope, intercept: cfg.supply.intercept + taxAmt,
        evalAt: q => cfg.supply.evalAt(q) + taxAmt, qAt: p => cfg.supply.qAt(p - taxAmt) };
      drawCurve(svg, taxedLine, cfg, '#8e44ad', 'Supply with\ntax');
    } else {
      taxedLine = { slope: cfg.demand.slope, intercept: cfg.demand.intercept - taxAmt,
        evalAt: q => cfg.demand.evalAt(q) - taxAmt, qAt: p => cfg.demand.qAt(p + taxAmt) };
      drawCurve(svg, taxedLine, cfg, '#8e44ad', 'Demand with\ntax');
    }

    const newEq = taxOn === 'sellers' ? intersect(taxedLine, cfg.demand) : intersect(cfg.supply, taxedLine);
    if (newEq) {
      const buyerP = taxOn === 'sellers' ? newEq.p : newEq.p + taxAmt;
      const sellerP = taxOn === 'sellers' ? newEq.p - taxAmt : newEq.p;

      // Points B and C with labels to the LEFT so they don't crowd the arrow
      const bx = plotX(newEq.q, cfg), by = plotY(buyerP, cfg);
      const cx = plotX(newEq.q, cfg), cy = plotY(sellerP, cfg);

      // B dashed lines to axes
      if (cfg.showDashed) {
        el('line', { x1: bx, y1: by, x2: bx, y2: plotY(cfg.priceMin, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
        el('line', { x1: bx, y1: by, x2: plotX(cfg.qtyMin, cfg), y2: by, stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
        drawInterceptLabels(svg, newEq.q, buyerP, cfg, { color: '#c0392b' });
      }

      // Dashed line from y-axis to point C (seller's price)
      el('line', { x1: plotX(cfg.qtyMin, cfg), y1: cy, x2: cx, y2: cy, stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
      drawInterceptLabels(svg, newEq.q, sellerP, cfg, { color: '#c0392b', skipX: true });

      // Draw B dot and label above
      el('circle', { cx: bx, cy: by, r: 5.5, fill: '#222', stroke: 'white', 'stroke-width': 2 }, svg);
      textBg(svg, bx - 10, by - 14, 'B', { 'font-size': 15, 'font-weight': 'bold', fill: '#222', 'text-anchor': 'middle' });

      // Draw C dot and label above
      el('circle', { cx, cy, r: 5.5, fill: '#222', stroke: 'white', 'stroke-width': 2 }, svg);
      textBg(svg, cx - 10, cy - 14, 'C', { 'font-size': 15, 'font-weight': 'bold', fill: '#222', 'text-anchor': 'middle' });

      // Price labels near y-axis
      if (showLabels) {
        const labelX = plotX(cfg.qtyMin, cfg) + 15;
        textBg(svg, labelX, plotY(buyerP, cfg) - 10, `Buyer's price: ${cfg.pricePrefix}${buyerP.toFixed(2)}`, { 'font-size': 11, 'font-weight': 'bold', fill: '#c0392b' });
        textBg(svg, labelX, plotY(sellerP, cfg) - 10, `Seller's price: ${cfg.pricePrefix}${sellerP.toFixed(2)}`, { 'font-size': 11, 'font-weight': 'bold', fill: '#2471a3' });
      }

      if (showWedge) {
        // Vertical arrow between B and C, label to the right
        drawVerticalArrow(svg, newEq.q, buyerP, sellerP, `Tax:\n${cfg.pricePrefix}${taxAmt}`, cfg, '#8e44ad', 'right', 'up');
      }
    }
  }
  if (eq) updateEqDisplay(eq, cfg);
}

function renderSubsidy(svg, cfg) {
  const subsidyAmt = val('subsidyAmt');
  const mode = toggleVal('subsidyMode');
  const showLabels = val('showSubsidyLabels');

  drawCurve(svg, cfg.supply, cfg, '#c0392b', cfg.s0Label);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', cfg.d0Label);

  const eq = intersect(cfg.supply, cfg.demand);
  if (eq) drawEquilibrium(svg, eq.q, eq.p, cfg.eqLabel, cfg);

  if (mode === 'answer') {
    const subsidized = { slope: cfg.supply.slope, intercept: cfg.supply.intercept - subsidyAmt,
      evalAt: q => cfg.supply.evalAt(q) - subsidyAmt, qAt: p => cfg.supply.qAt(p + subsidyAmt) };
    drawCurve(svg, subsidized, cfg, '#27ae60', 'Supply with\nsubsidy', false, 2.5, true);

    const newEq = intersect(subsidized, cfg.demand);
    if (newEq) {
      const sellerP = newEq.p + subsidyAmt;
      const bx = plotX(newEq.q, cfg), by = plotY(newEq.p, cfg);
      const cx = plotX(newEq.q, cfg), cy = plotY(sellerP, cfg);

      // B dashed lines to axes
      if (cfg.showDashed) {
        el('line', { x1: bx, y1: by, x2: bx, y2: plotY(cfg.priceMin, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
        el('line', { x1: bx, y1: by, x2: plotX(cfg.qtyMin, cfg), y2: by, stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
        drawInterceptLabels(svg, newEq.q, newEq.p, cfg, { color: '#c0392b' });
      }

      // Dashed line from y-axis to point C
      el('line', { x1: plotX(cfg.qtyMin, cfg), y1: cy, x2: cx, y2: cy, stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
      drawInterceptLabels(svg, newEq.q, sellerP, cfg, { color: '#c0392b', skipX: true });

      // B dot and label above
      el('circle', { cx: bx, cy: by, r: 5.5, fill: '#222', stroke: 'white', 'stroke-width': 2 }, svg);
      textBg(svg, bx - 10, by - 14, 'B', { 'font-size': 15, 'font-weight': 'bold', fill: '#222', 'text-anchor': 'middle' });

      // C dot and label above
      el('circle', { cx, cy, r: 5.5, fill: '#222', stroke: 'white', 'stroke-width': 2 }, svg);
      textBg(svg, cx - 10, cy - 14, 'C', { 'font-size': 15, 'font-weight': 'bold', fill: '#222', 'text-anchor': 'middle' });

      if (showLabels) {
        const labelX = plotX(cfg.qtyMin, cfg) + 15;
        textBg(svg, labelX, plotY(newEq.p, cfg) - 10, `Buyer price: ${cfg.pricePrefix}${newEq.p.toFixed(2)}`, { 'font-size': 11, 'font-weight': 'bold', fill: '#2471a3' });
        textBg(svg, labelX, plotY(sellerP, cfg) - 10, `Seller receives: ${cfg.pricePrefix}${sellerP.toFixed(2)}`, { 'font-size': 11, 'font-weight': 'bold', fill: '#27ae60' });
      }
      // Vertical arrow between B and C, label to the right
      drawVerticalArrow(svg, newEq.q, sellerP, newEq.p, `Subsidy:\n${cfg.pricePrefix}${subsidyAmt}`, cfg, '#555', 'right', 'down');
    }
  }
  if (eq) updateEqDisplay(eq, cfg);
}

function renderPriceControl(svg, cfg) {
  const controlType = val('controlType');
  const controlPrice = val('controlPrice');
  const showBracket = val('showShortSurp');
  const mode = toggleVal('priceControlMode');

  drawCurve(svg, cfg.supply, cfg, '#c0392b', cfg.s0Label);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', cfg.d0Label);

  const eq = intersect(cfg.supply, cfg.demand);
  if (eq) drawEquilibrium(svg, eq.q, eq.p, cfg.eqLabel, cfg);

  const pcLabel = controlType === 'floor' ? 'Price Floor' : 'Price Ceiling';
  // Draw the dashed line without a label — we'll add the label at the end
  drawHLine(svg, controlPrice, cfg, '#d35400', '', true);

  if (mode === 'question') {
    // Question mode: just show S&D, equilibrium, and the price control line with label
    const py = plotY(controlPrice, cfg);
    textBg(svg, W - PAD.right - 3, py - 8, pcLabel, { 'font-size': 11, 'font-weight': 'bold', fill: '#d35400', 'text-anchor': 'end' });
    if (eq) updateEqDisplay(eq, cfg);
    return;
  }

  const qd = cfg.demand.qAt(controlPrice);
  const qs = cfg.supply.qAt(controlPrice);
  const isBindingFloor = controlType === 'floor' && controlPrice > (eq ? eq.p : 0);
  const isBindingCeiling = controlType === 'ceiling' && controlPrice < (eq ? eq.p : Infinity);

  // Intercept label for the control price on Y-axis
  drawInterceptLabels(svg, 0, controlPrice, cfg, { color: '#d35400', skipX: true });

  // Dashed lines from control price to Qs and Qd, with X-axis intercept labels
  if (isBindingFloor || isBindingCeiling) {
    const qdx = plotX(qd, cfg), qsx = plotX(qs, cfg), pcy = plotY(controlPrice, cfg);
    el('line', { x1: qdx, y1: pcy, x2: qdx, y2: plotY(cfg.priceMin, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    el('line', { x1: qsx, y1: pcy, x2: qsx, y2: plotY(cfg.priceMin, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    drawInterceptLabels(svg, qd, controlPrice, cfg, { color: '#d35400', skipY: true });
    drawInterceptLabels(svg, qs, controlPrice, cfg, { color: '#d35400', skipY: true });
  }

  if (showBracket && (isBindingFloor || isBindingCeiling)) {
    const xLeft = plotX(Math.min(qd, qs), cfg);
    const xRight = plotX(Math.max(qd, qs), cfg);
    // Floor (above eq): surplus bracket ABOVE the control line, label BELOW
    // Ceiling (below eq): shortage bracket BELOW the control line, label ABOVE
    const bracketAbove = isBindingFloor;
    const yBracket = plotY(controlPrice, cfg) + (bracketAbove ? -16 : 16);
    el('line', { x1: xLeft, y1: yBracket, x2: xRight, y2: yBracket, stroke: '#d35400', 'stroke-width': 2.5 }, svg);
    el('line', { x1: xLeft, y1: yBracket - 5, x2: xLeft, y2: yBracket + 5, stroke: '#d35400', 'stroke-width': 2 }, svg);
    el('line', { x1: xRight, y1: yBracket - 5, x2: xRight, y2: yBracket + 5, stroke: '#d35400', 'stroke-width': 2 }, svg);
    const txt = isBindingFloor ? `Surplus: ${Math.abs(qs - qd).toFixed(0)} units` : `Shortage: ${Math.abs(qd - qs).toFixed(0)} units`;
    const textY = bracketAbove ? yBracket - 8 : yBracket + 18;
    textBg(svg, (xLeft + xRight) / 2, textY, txt, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: '#d35400' });
    // Now place the "Price Floor"/"Price Ceiling" label on the OPPOSITE side from the bracket
    const labelY = plotY(controlPrice, cfg) + (bracketAbove ? 18 : -8);
    textBg(svg, W - PAD.right - 3, labelY, pcLabel, { 'font-size': 11, 'font-weight': 'bold', fill: '#d35400', 'text-anchor': 'end' });
  } else if (showBracket) {
    // Non-binding — label on the line, plus indication
    const py = plotY(controlPrice, cfg);
    textBg(svg, W - PAD.right - 3, py - 8, `${pcLabel} (non-binding)`, { 'font-size': 11, 'font-weight': 'bold', fill: '#d35400', 'text-anchor': 'end' });
  } else {
    // No bracket mode — just label the line
    const py = plotY(controlPrice, cfg);
    textBg(svg, W - PAD.right - 3, py - 8, pcLabel, { 'font-size': 11, 'font-weight': 'bold', fill: '#d35400', 'text-anchor': 'end' });
  }
  if (eq) updateEqDisplay(eq, cfg);
}

function renderQuota(svg, cfg) {
  const quotaQty = val('quotaQty');
  const quotaLabel = val('quotaLabel');
  const mode = toggleVal('quotaMode');

  drawCurve(svg, cfg.supply, cfg, '#c0392b', cfg.s0Label);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', cfg.d0Label);

  const eq = intersect(cfg.supply, cfg.demand);
  if (eq) drawEquilibrium(svg, eq.q, eq.p, cfg.eqLabel, cfg);

  drawVLine(svg, quotaQty, cfg, '#8e44ad', quotaLabel, true);

  if (mode === 'question') {
    if (eq) updateEqDisplay(eq, cfg);
    return;
  }

  // Show prices at quota quantity
  const pd = cfg.demand.evalAt(quotaQty);
  const ps = cfg.supply.evalAt(quotaQty);
  const x = plotX(quotaQty, cfg);
  const isBinding = eq && quotaQty < eq.q;

  if (isBinding) {
    // Buyer and seller price markers with dashed lines to Y-axis
    if (pd >= cfg.priceMin && pd <= cfg.priceMax) {
      el('line', { x1: plotX(cfg.qtyMin, cfg), y1: plotY(pd, cfg), x2: x, y2: plotY(pd, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
      el('circle', { cx: x, cy: plotY(pd, cfg), r: 4, fill: '#2471a3' }, svg);
      textBg(svg, x + 10, plotY(pd, cfg) + 4, `Buyer price: ${cfg.pricePrefix}${pd.toFixed(2)}`, { 'font-size': 11, 'font-weight': 'bold', fill: '#2471a3' });
      drawInterceptLabels(svg, quotaQty, pd, cfg, { color: '#2471a3', skipX: true });
    }
    if (ps >= cfg.priceMin && ps <= cfg.priceMax) {
      el('line', { x1: plotX(cfg.qtyMin, cfg), y1: plotY(ps, cfg), x2: x, y2: plotY(ps, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
      el('circle', { cx: x, cy: plotY(ps, cfg), r: 4, fill: '#c0392b' }, svg);
      textBg(svg, x + 10, plotY(ps, cfg) + 4, `Seller price: ${cfg.pricePrefix}${ps.toFixed(2)}`, { 'font-size': 11, 'font-weight': 'bold', fill: '#c0392b' });
      drawInterceptLabels(svg, quotaQty, ps, cfg, { color: '#c0392b', skipX: true });
    }
    // DWL triangle between quota qty and equilibrium qty
    if (eq) {
      drawRegion(svg, [
        [quotaQty, pd], [eq.q, eq.p], [quotaQty, ps]
      ], cfg, '#e74c3c');
      textBg(svg, plotX((quotaQty + eq.q) / 2, cfg), plotY((pd + ps) / 2, cfg) + 4, 'DWL', { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 'bold', fill: '#e74c3c' });
    }
    // Price wedge bracket — to the LEFT of the quota line so DWL triangle is visible
    drawBracket(svg, quotaQty - (cfg.qtyMax - cfg.qtyMin) * 0.02, pd, ps, `Wedge: ${cfg.pricePrefix}${(pd - ps).toFixed(2)}`, cfg, '#555', 'left');
  } else {
    // Non-binding quota
    textBg(svg, x + 10, plotY(eq ? eq.p : (cfg.priceMax + cfg.priceMin) / 2, cfg) - 20, 'Non-binding', { 'font-size': 12, 'font-weight': 'bold', fill: '#8e44ad' });
  }
  if (eq) updateEqDisplay(eq, cfg);
}

function renderExternality(svg, cfg) {
  const extType = val('extType');
  const extAmt = val('extAmt');
  const showDWLRegion = val('showDWL');
  const showLabels = val('showExtLabels');
  const mode = toggleVal('extMode');

  // Relabel supply/demand for externalities
  const isProduction = extType.includes('prod');
  const isNegative = extType.includes('neg');

  const supplyLabel = isProduction ? 'Marginal Private Cost\n(Supply)' : (cfg.s0Label || 'Supply');
  const demandLabel = !isProduction ? 'Marginal Private Benefit\n(Demand)' : (cfg.d0Label || 'Demand');

  drawCurve(svg, cfg.supply, cfg, '#c0392b', supplyLabel);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', demandLabel);

  if (mode === 'question') {
    const marketEq = intersect(cfg.supply, cfg.demand);
    if (marketEq) {
      drawEquilibrium(svg, marketEq.q, marketEq.p, 'Market', cfg, '#c0392b');
      updateEqDisplay(marketEq, cfg);
    }
    return;
  }

  // Social curve
  let socialLine;
  let socialLabel;
  if (isProduction && isNegative) {
    // MSC above supply
    socialLine = { slope: cfg.supply.slope, intercept: cfg.supply.intercept + extAmt,
      evalAt: q => cfg.supply.evalAt(q) + extAmt, qAt: p => cfg.supply.qAt(p - extAmt) };
    socialLabel = 'Marginal Social Cost';
  } else if (isProduction && !isNegative) {
    // MSC below supply (positive production externality = lower social cost)
    socialLine = { slope: cfg.supply.slope, intercept: cfg.supply.intercept - extAmt,
      evalAt: q => cfg.supply.evalAt(q) - extAmt, qAt: p => cfg.supply.qAt(p + extAmt) };
    socialLabel = 'Marginal Social Cost';
  } else if (!isProduction && isNegative) {
    // MSB below demand
    socialLine = { slope: cfg.demand.slope, intercept: cfg.demand.intercept - extAmt,
      evalAt: q => cfg.demand.evalAt(q) - extAmt, qAt: p => cfg.demand.qAt(p + extAmt) };
    socialLabel = 'Marginal Social Benefit';
  } else {
    // Positive consumption: MSB above demand
    socialLine = { slope: cfg.demand.slope, intercept: cfg.demand.intercept + extAmt,
      evalAt: q => cfg.demand.evalAt(q) + extAmt, qAt: p => cfg.demand.qAt(p - extAmt) };
    socialLabel = 'Marginal Social Benefit';
  }

  drawCurve(svg, socialLine, cfg, '#27ae60', showLabels ? socialLabel : '', false, 2.5);

  const marketEq = intersect(cfg.supply, cfg.demand);
  const efficientEq = isProduction ? intersect(socialLine, cfg.demand) : intersect(cfg.supply, socialLine);

  if (marketEq) {
    drawEquilibrium(svg, marketEq.q, marketEq.p, 'Market', cfg, '#c0392b');
  }
  if (efficientEq) {
    drawEquilibrium(svg, efficientEq.q, efficientEq.p, 'Efficient', cfg, '#27ae60');
  }

  if (showDWLRegion && marketEq && efficientEq) {
    // DWL triangle: market eq, efficient eq, and social curve at market quantity
    // This works for all 4 externality types
    const thirdP = socialLine.evalAt(marketEq.q);
    drawRegion(svg, [
      [marketEq.q, marketEq.p],
      [efficientEq.q, efficientEq.p],
      [marketEq.q, thirdP]
    ], cfg, '#e74c3c');
    // Position DWL label at centroid of triangle
    const cx = (marketEq.q * 2 + efficientEq.q) / 3;
    const cy = (marketEq.p + efficientEq.p + thirdP) / 3;
    textBg(svg, plotX(cx, cfg), plotY(cy, cfg) + 4, 'DWL', { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 'bold', fill: '#e74c3c' });
  }

  if (marketEq) updateEqDisplay(marketEq, cfg);
}

function renderBudget(svg, cfg) {
  const goodX = val('budgetGoodX');
  const goodY = val('budgetGoodY');
  const px = val('budgetPx');
  const py = val('budgetPy');
  const income = val('budgetIncome');
  const showSecond = val('budgetShowSecond');
  const showInfo = val('budgetShowInfo');

  const maxX = px > 0 ? income / px : income;
  const maxY = py > 0 ? income / py : income;

  // Budget line: from (0, maxY) to (maxX, 0)
  const budgetLine = lineFromPoints(0, maxY, maxX, 0);
  drawCurve(svg, budgetLine, cfg, '#2471a3', '', false, 2.5);

  // Label intercepts on the axes (bold, colored)
  textBg(svg, plotX(maxX, cfg), plotY(0, cfg) + 18, maxX.toFixed(1), { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: '#2471a3' });
  textBg(svg, plotX(0, cfg) - 8, plotY(maxY, cfg) + 4, maxY.toFixed(1), { 'text-anchor': 'end', 'font-size': 12, 'font-weight': 'bold', fill: '#2471a3' });

  if (showSecond) {
    const px2 = val('budgetPx2');
    const py2 = val('budgetPy2');
    const inc2 = val('budgetIncome2');
    const maxX2 = px2 > 0 ? inc2 / px2 : inc2;
    const maxY2 = py2 > 0 ? inc2 / py2 : inc2;
    const budgetLine2 = lineFromPoints(0, maxY2, maxX2, 0);
    drawCurve(svg, budgetLine2, cfg, '#e74c3c', '', true, 2);
    textBg(svg, plotX(maxX2, cfg), plotY(0, cfg) + 30, maxX2.toFixed(1), { 'text-anchor': 'middle', 'font-size': 11, fill: '#e74c3c' });
  }

  // Tangent line
  const showTangent = val('budgetShowTangent');
  if (showTangent) {
    const tx = val('budgetTangentX');
    const ty = val('budgetTangentY');
    // Draw tangent point
    const tpx = plotX(tx, cfg), tpy = plotY(ty, cfg);
    el('circle', { cx: tpx, cy: tpy, r: 5, fill: '#d35400', stroke: 'white', 'stroke-width': 1.5 }, svg);
    // Tangent line has the same slope as the budget line (since it's a straight line, tangent = line itself extended)
    // Draw a line through (tx, ty) with the budget line slope
    const slope = -maxY / maxX; // budget line slope in Good Y / Good X
    const tangentLine = { slope: slope, intercept: ty - slope * tx,
      evalAt: q => ty + slope * (q - tx), qAt: p => tx + (p - ty) / slope };
    drawCurve(svg, tangentLine, cfg, '#d35400', '', true, 1.5);
    textBg(svg, tpx + 8, tpy - 10, 'Optimal', { 'font-size': 11, 'font-weight': 'bold', fill: '#d35400' });
  }

  // Auto-placed points (above, below, on the budget line)
  const nAbove = val('budgetPtsAbove') || 0;
  const nBelow = val('budgetPtsBelow') || 0;
  const nOn = val('budgetPtsOn') || 0;
  if (nAbove + nBelow + nOn > 0) {
    // Use a seeded approach for consistent placement
    const ptLabels = ['P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    const ptColors = { above: '#27ae60', below: '#e74c3c', on: '#8e44ad' };
    let ptIdx = 0;
    const placedPts = [];
    // Helper: get Y on budget line at a given X
    const budgetY = (x) => maxY - (maxY / maxX) * x;
    // Spread points evenly along X range
    const totalPts = nAbove + nBelow + nOn;
    const step = maxX / (totalPts + 1);
    // Collect all points with their type
    const ptList = [];
    for (let i = 0; i < nAbove; i++) ptList.push('above');
    for (let i = 0; i < nOn; i++) ptList.push('on');
    for (let i = 0; i < nBelow; i++) ptList.push('below');
    ptList.forEach((type, i) => {
      const px_ = step * (i + 1);
      const lineY = budgetY(px_);
      const offset = (cfg.priceMax - cfg.priceMin) * 0.08;
      let py_;
      if (type === 'above') py_ = lineY + offset;
      else if (type === 'below') py_ = Math.max(0, lineY - offset);
      else py_ = lineY;
      const sx = plotX(px_, cfg), sy = plotY(py_, cfg);
      const lbl = ptLabels[ptIdx % ptLabels.length];
      const color = ptColors[type];
      el('circle', { cx: sx, cy: sy, r: 5, fill: color, stroke: 'white', 'stroke-width': 1.5 }, svg);
      textBg(svg, sx + 8, sy - 8, lbl, { 'font-size': 13, 'font-weight': 'bold', fill: color });
      ptIdx++;
    });
  }

  // Bundles
  const bundles = ['A', 'B', 'C', 'D', 'E', 'F'];
  const bColors = ['#c0392b', '#2471a3', '#27ae60', '#8e44ad', '#d35400', '#2c3e50'];
  bundles.forEach((b, i) => {
    const on = val(`b${b}_on`);
    if (!on) return;
    const bx = val(`b${b}_x`);
    const by = val(`b${b}_y`);
    if (bx === 0 && by === 0) return;
    const px_ = plotX(bx, cfg), py_ = plotY(by, cfg);
    el('circle', { cx: px_, cy: py_, r: 5, fill: bColors[i % bColors.length], stroke: 'white', 'stroke-width': 1.5 }, svg);
    textBg(svg, px_ + 8, py_ - 8, b, { 'font-size': 14, 'font-weight': 'bold', fill: bColors[i % bColors.length] });
  });

  if (showInfo) {
    // Position info box inside the top-left of the plot area so it doesn't get cut off
    const infoX = PAD.left + 10;
    const infoY = PAD.top + 15;
    textBg(svg, infoX, infoY, `Income: ${cfg.pricePrefix}${income}`, { 'font-size': 11, fill: '#555' });
    textBg(svg, infoX, infoY + 16, `P(${goodX}): ${cfg.pricePrefix}${px}`, { 'font-size': 11, fill: '#555' });
    textBg(svg, infoX, infoY + 32, `P(${goodY}): ${cfg.pricePrefix}${py}`, { 'font-size': 11, fill: '#555' });
  }

  document.getElementById('eqDisplay').textContent = `X-int: ${maxX.toFixed(1)}, Y-int: ${maxY.toFixed(1)}`;
}

function renderTrade(svg, cfg) {
  const worldPrice = val('worldPrice');
  const showRegions = val('showTradeRegions');
  const showLabels = val('showTradeLabels');
  const mode = toggleVal('tradeMode');

  drawCurve(svg, cfg.supply, cfg, '#c0392b', cfg.s0Label);
  drawCurve(svg, cfg.demand, cfg, '#2471a3', cfg.d0Label);

  const eq = intersect(cfg.supply, cfg.demand);
  if (eq) drawEquilibrium(svg, eq.q, eq.p, cfg.eqLabel, cfg);

  drawHLine(svg, worldPrice, cfg, '#27ae60', 'World Price', true);

  if (mode === 'question') {
    if (eq) updateEqDisplay(eq, cfg);
    return;
  }

  const qd = cfg.demand.qAt(worldPrice);
  const qs = cfg.supply.qAt(worldPrice);
  const isImporter = worldPrice < (eq ? eq.p : 0);

  // Dashed lines from Qs and Qd at world price to X-axis, with intercept labels
  if (cfg.showDashed) {
    const wpy = plotY(worldPrice, cfg);
    el('line', { x1: plotX(qs, cfg), y1: wpy, x2: plotX(qs, cfg), y2: plotY(cfg.priceMin, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    el('line', { x1: plotX(qd, cfg), y1: wpy, x2: plotX(qd, cfg), y2: plotY(cfg.priceMin, cfg), stroke: '#999', 'stroke-width': 1, 'stroke-dasharray': '5,4' }, svg);
    drawInterceptLabels(svg, qs, worldPrice, cfg, { color: '#27ae60', skipY: true });
    drawInterceptLabels(svg, qd, worldPrice, cfg, { color: '#27ae60', skipY: true });
    drawInterceptLabels(svg, 0, worldPrice, cfg, { color: '#27ae60', skipX: true });
  }

  if (showRegions) {
    // CS region (above world price, below demand)
    const dMax = cfg.demand.evalAt(cfg.qtyMin);
    drawRegion(svg, [
      [cfg.qtyMin, Math.min(dMax, cfg.priceMax)],
      [qd, worldPrice],
      [cfg.qtyMin, worldPrice]
    ], cfg, '#3498db');
    textBg(svg, plotX(cfg.qtyMin + (qd - cfg.qtyMin) * 0.3, cfg), plotY((worldPrice + Math.min(dMax, cfg.priceMax)) / 2, cfg), 'CS', { 'font-size': 11, 'font-weight': 'bold', fill: '#2471a3' });

    // PS region (below world price, above supply)
    const sMin = cfg.supply.evalAt(cfg.qtyMin);
    drawRegion(svg, [
      [cfg.qtyMin, worldPrice],
      [qs, worldPrice],
      [cfg.qtyMin, Math.max(sMin, cfg.priceMin)]
    ], cfg, '#e74c3c');
    textBg(svg, plotX(cfg.qtyMin + qs * 0.3, cfg), plotY((worldPrice + Math.max(sMin, cfg.priceMin)) / 2, cfg), 'PS', { 'font-size': 11, 'font-weight': 'bold', fill: '#c0392b' });
  }

  if (showLabels && Math.abs(qd - qs) > 1) {
    const label = isImporter ? 'Imports' : 'Exports';
    const leftQ = Math.min(qs, qd);
    const rightQ = Math.max(qs, qd);
    const midX = (plotX(leftQ, cfg) + plotX(rightQ, cfg)) / 2;

    if (isImporter) {
      // Import: solid line first, then text below
      const y = plotY(worldPrice, cfg) + 8;
      el('line', { x1: plotX(leftQ, cfg), y1: y, x2: plotX(rightQ, cfg), y2: y, stroke: '#27ae60', 'stroke-width': 2 }, svg);
      textBg(svg, midX, y + 16, `${label}: ${Math.abs(qd - qs).toFixed(0)} units`, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: '#27ae60' });
    } else {
      // Export: text and solid line ABOVE the world price line
      const wpY = plotY(worldPrice, cfg);
      const lineY = wpY - 8;
      el('line', { x1: plotX(leftQ, cfg), y1: lineY, x2: plotX(rightQ, cfg), y2: lineY, stroke: '#27ae60', 'stroke-width': 2 }, svg);
      textBg(svg, midX, lineY - 10, `${label}: ${Math.abs(qd - qs).toFixed(0)} units`, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: '#27ae60' });
    }
  }

  if (eq) updateEqDisplay(eq, cfg);
}

function renderCostCurves(svg, cfg) {
  const acMinQ = val('ccAcMinQ');
  const acMinP = val('ccAcMinP');
  const FC = val('ccFixedCost');
  const mr = val('ccMr');
  const showProfit = val('ccShowProfit');
  const mode = toggleVal('ccMode');

  // Derive cubic TC coefficients: TC(q) = FC + a*q - b*q² + c*q³
  // This guarantees MC crosses AC at AC's min and AVC at AVC's min.
  // AVC min at acMinQ/2, MC min at acMinQ/3.
  const Q = acMinQ;
  const b = FC / (Q * Q);
  const c = FC / (Q * Q * Q);
  const a = acMinP - FC / Q;

  // Cost functions
  const mcFn = q => a - 2 * b * q + 3 * c * q * q;
  const avcFn = q => a - b * q + c * q * q;
  const acFn = q => q > 0 ? FC / q + a - b * q + c * q * q : cfg.priceMax;

  // Derived minimum points (for display)
  const avcMinQ_ = b / (2 * c);
  const mcMinQ_ = b / (3 * c);

  // Profit-maximizing Q: solve MC(q) = MR → 3c*q² - 2b*q + (a - MR) = 0
  const disc = 4 * b * b - 12 * c * (a - mr);
  let optQ = acMinQ; // fallback
  if (disc >= 0) {
    // Take the larger root (upward-sloping portion of MC)
    optQ = (2 * b + Math.sqrt(disc)) / (6 * c);
  }

  const qRange = [Math.max(cfg.qtyMin + 0.5, 1), cfg.qtyMax];

  // Student mode: all curves black, labels kept but MR = P becomes just MR
  const isQuestion = (mode === 'question');
  const mcColor = isQuestion ? '#222' : '#e74c3c';
  const acColor = isQuestion ? '#222' : '#2471a3';
  const avcColor = isQuestion ? '#222' : '#8e44ad';
  const dotColor = '#222'; // all dots black in both modes

  // Draw curves (labels kept in both modes, colors change)
  drawCostCurve(svg, mcFn, cfg, mcColor, 'MC', qRange);
  drawCostCurve(svg, acFn, cfg, acColor, 'AC', qRange);
  drawCostCurve(svg, avcFn, cfg, avcColor, 'AVC', qRange);

  // MR horizontal line (student mode: just "MR", answer mode: "MR = P")
  drawHLine(svg, mr, cfg, '#222', isQuestion ? 'MR' : 'MR = P', false, 'left');
  drawInterceptLabels(svg, 0, mr, cfg, { color: '#222', skipX: true });

  // --- Key intersection points with large dots and dashed lines ---
  const dotR = 6; // substantial dot size

  // 1. MC ∩ AC (break-even point) = AC minimum at (acMinQ, acMinP)
  if (acMinQ > cfg.qtyMin && acMinQ < cfg.qtyMax && acMinP > cfg.priceMin && acMinP < cfg.priceMax) {
    const bex = plotX(acMinQ, cfg), bey = plotY(acMinP, cfg);
    el('line', { x1: bex, y1: bey, x2: bex, y2: plotY(cfg.priceMin, cfg), stroke: '#888', 'stroke-width': 1, 'stroke-dasharray': '4,3' }, svg);
    el('line', { x1: bex, y1: bey, x2: plotX(cfg.qtyMin, cfg), y2: bey, stroke: '#888', 'stroke-width': 1, 'stroke-dasharray': '4,3' }, svg);
    el('circle', { cx: bex, cy: bey, r: dotR, fill: dotColor, stroke: 'white', 'stroke-width': 1.5 }, svg);
    drawInterceptLabels(svg, acMinQ, acMinP, cfg, { color: '#222' });
  }

  // 2. MC ∩ AVC (shutdown point) = AVC minimum
  const avcMinP = avcFn(avcMinQ_);
  if (avcMinQ_ > cfg.qtyMin && avcMinQ_ < cfg.qtyMax && avcMinP > cfg.priceMin && avcMinP < cfg.priceMax) {
    const sdx = plotX(avcMinQ_, cfg), sdy = plotY(avcMinP, cfg);
    el('line', { x1: sdx, y1: sdy, x2: sdx, y2: plotY(cfg.priceMin, cfg), stroke: '#888', 'stroke-width': 1, 'stroke-dasharray': '4,3' }, svg);
    el('line', { x1: sdx, y1: sdy, x2: plotX(cfg.qtyMin, cfg), y2: sdy, stroke: '#888', 'stroke-width': 1, 'stroke-dasharray': '4,3' }, svg);
    el('circle', { cx: sdx, cy: sdy, r: dotR, fill: dotColor, stroke: 'white', 'stroke-width': 1.5 }, svg);
    drawInterceptLabels(svg, avcMinQ_, avcMinP, cfg, { color: '#222' });
  }

  // Profit-maximizing point (MC = MR)
  if (optQ > cfg.qtyMin && optQ < cfg.qtyMax) {
    const x = plotX(optQ, cfg);
    const y = plotY(mr, cfg);
    const acAtOpt = acFn(optQ);

    // Profit/loss rectangle (only in answer mode when toggled on)
    if (!isQuestion && showProfit) {
      if (mr > acAtOpt) {
        drawRegion(svg, [[0, mr], [optQ, mr], [optQ, acAtOpt], [0, acAtOpt]], cfg, '#27ae60');
        textBg(svg, plotX(optQ / 2, cfg), plotY((mr + acAtOpt) / 2, cfg) + 4, 'Profit', { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: '#27ae60' });
      } else if (mr < acAtOpt) {
        drawRegion(svg, [[0, acAtOpt], [optQ, acAtOpt], [optQ, mr], [0, mr]], cfg, '#e74c3c');
        textBg(svg, plotX(optQ / 2, cfg), plotY((mr + acAtOpt) / 2, cfg) + 4, 'Loss', { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 'bold', fill: '#e74c3c' });
      }
    }

    // Always draw: dashed lines from profit-max point to axes
    el('line', { x1: x, y1: y, x2: x, y2: plotY(cfg.priceMin, cfg), stroke: '#888', 'stroke-width': 1, 'stroke-dasharray': '4,3' }, svg);
    el('circle', { cx: x, cy: y, r: dotR, fill: dotColor, stroke: 'white', 'stroke-width': 1.5 }, svg);
    drawInterceptLabels(svg, optQ, mr, cfg, { color: '#222', skipY: true });

    // Always draw: AC at Q* point — dot, horizontal dashed line to y-axis, y-axis label
    const acY = plotY(acAtOpt, cfg);
    el('line', { x1: plotX(0, cfg), y1: acY, x2: plotX(optQ, cfg), y2: acY, stroke: '#888', 'stroke-width': 1, 'stroke-dasharray': '4,3' }, svg);
    el('circle', { cx: x, cy: acY, r: dotR, fill: dotColor, stroke: 'white', 'stroke-width': 1.5 }, svg);
    drawInterceptLabels(svg, 0, acAtOpt, cfg, { color: '#222', skipX: true });

    // Always draw: AVC at Q* point — dot, horizontal dashed line to y-axis, y-axis label
    const avcAtOpt = avcFn(optQ);
    const avcY = plotY(avcAtOpt, cfg);
    el('line', { x1: plotX(0, cfg), y1: avcY, x2: plotX(optQ, cfg), y2: avcY, stroke: '#888', 'stroke-width': 1, 'stroke-dasharray': '4,3' }, svg);
    el('circle', { cx: x, cy: avcY, r: dotR, fill: dotColor, stroke: 'white', 'stroke-width': 1.5 }, svg);
    drawInterceptLabels(svg, 0, avcAtOpt, cfg, { color: '#222', skipX: true });
  }

  const optQr_ = Math.round(optQ * 10) / 10;
  const optQr = optQr_ === Math.round(optQr_) ? Math.round(optQr_) : optQr_;
  document.getElementById('eqDisplay').textContent =
    `Q* = ${optQr}, P = ${cfg.pricePrefix}${mr}, AC min = ${cfg.pricePrefix}${acMinP} at Q=${acMinQ}`;
}

// ---- Equilibrium display ----
function updateEqDisplay(eq, cfg, prefix = '') {
  const d = document.getElementById('eqDisplay');
  const qRound = Math.round(eq.q * 10) / 10;
  const pRound = Math.round(eq.p * 100) / 100;
  d.textContent = `${prefix}Q = ${qRound}, P = ${cfg.pricePrefix}${pRound}`;
}
