// ==============================================================
// DEBUG OVERLAY
// ==============================================================

function addDebugOverlay(svg, cfg) {
  const g = el('g', { class: 'debug-overlay', opacity: 0.6 }, svg);
  const plotLeft = PAD.left, plotRight = W - PAD.right;
  const plotTop = PAD.top, plotBot = H - PAD.bottom;

  // 1. Draw plot safe area (green border)
  el('rect', {
    x: plotLeft, y: plotTop,
    width: plotRight - plotLeft, height: plotBot - plotTop,
    fill: 'none', stroke: '#22c55e', 'stroke-width': 2, 'stroke-dasharray': '6,3'
  }, g);

  // 2. Draw margin zones (red tint)
  const zones = [
    { x: 0, y: 0, w: W, h: plotTop },              // top margin
    { x: 0, y: plotBot, w: W, h: H - plotBot },     // bottom margin
    { x: 0, y: plotTop, w: plotLeft, h: plotBot - plotTop }, // left margin
    { x: plotRight, y: plotTop, w: W - plotRight, h: plotBot - plotTop }, // right margin
  ];
  zones.forEach(z => {
    el('rect', { x: z.x, y: z.y, width: z.w, height: z.h, fill: 'red', opacity: 0.08 }, g);
  });

  // 3. Bounding boxes around every <text> element
  const texts = svg.querySelectorAll('text');
  texts.forEach(t => {
    try {
      const bbox = t.getBBox();
      const inPlot = bbox.x >= plotLeft && bbox.x + bbox.width <= plotRight + 60 &&
                     bbox.y >= plotTop - 5 && bbox.y + bbox.height <= plotBot + 50;
      const inSVG = bbox.x >= -2 && bbox.x + bbox.width <= W + 2 &&
                    bbox.y >= -2 && bbox.y + bbox.height <= H + 2;
      let color = '#22c55e'; // green = good
      if (!inSVG) color = '#ef4444'; // red = clipped by SVG
      else if (!inPlot) color = '#f59e0b'; // yellow = in margin (may be ok)
      el('rect', {
        x: bbox.x - 1, y: bbox.y - 1,
        width: bbox.width + 2, height: bbox.height + 2,
        fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': '3,2'
      }, g);
    } catch (e) { /* getBBox can fail for hidden elements */ }
  });

  // 4. Bounding boxes around every <line> element (curves)
  svg.querySelectorAll('line').forEach(ln => {
    const sw = parseFloat(ln.getAttribute('stroke-width'));
    if (sw < 2) return; // skip grid lines
    const color = ln.getAttribute('stroke') || '';
    if (color === '#222') return; // skip axis lines
    const x1 = +ln.getAttribute('x1'), y1 = +ln.getAttribute('y1');
    const x2 = +ln.getAttribute('x2'), y2 = +ln.getAttribute('y2');
    if (Math.abs(x1 - x2) < 2) return; // skip vertical lines (quota, etc.)
    // Check if endpoints are at the very edge of plot (potential clipping)
    const atTop1 = Math.abs(y1 - plotTop) < 2, atTop2 = Math.abs(y2 - plotTop) < 2;
    if (atTop1) el('circle', { cx: x1, cy: y1, r: 6, fill: 'none', stroke: '#ef4444', 'stroke-width': 2 }, g);
    if (atTop2) el('circle', { cx: x2, cy: y2, r: 6, fill: 'none', stroke: '#ef4444', 'stroke-width': 2 }, g);
  });

  // 5. Legend
  const ly = 14;
  el('rect', { x: plotLeft, y: 2, width: 280, height: 18, fill: 'white', opacity: 0.9 }, g);
  el('rect', { x: plotLeft + 2, y: ly - 6, width: 8, height: 8, fill: '#22c55e' }, g);
  el('text', { x: plotLeft + 14, y: ly, 'font-size': 9, fill: '#333' }, g).textContent = 'OK';
  el('rect', { x: plotLeft + 32, y: ly - 6, width: 8, height: 8, fill: '#f59e0b' }, g);
  el('text', { x: plotLeft + 44, y: ly, 'font-size': 9, fill: '#333' }, g).textContent = 'In margin';
  el('rect', { x: plotLeft + 82, y: ly - 6, width: 8, height: 8, fill: '#ef4444' }, g);
  el('text', { x: plotLeft + 94, y: ly, 'font-size': 9, fill: '#333' }, g).textContent = 'Clipped!';
  el('circle', { cx: plotLeft + 142, cy: ly - 2, r: 4, fill: 'none', stroke: '#ef4444', 'stroke-width': 1.5 }, g);
  el('text', { x: plotLeft + 150, y: ly, 'font-size': 9, fill: '#333' }, g).textContent = 'Curve at edge';
}

// Patch render to add debug overlay
const _origRender = render;
render = function() {
  _origRender();
  if (val('debugOverlay')) {
    const svg = document.querySelector('#svgPreview svg');
    if (svg) addDebugOverlay(svg, getConfig());
  }
};
