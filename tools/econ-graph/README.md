# Economics Graph Generator: how it's built

The page is `tools/econ-graph-generator.html`. There is no build step: it loads the scripts in
this folder with plain `<script>` tags, in the order listed at the bottom of that file.

| File | What it holds |
|---|---|
| `engine.js` | Coordinates, line math, axes, curves, labels, and the original `autoRange` and `getConfig` |
| `registry.js` | `GraphTypes`, the shared colors and regions, and helpers for registered types |
| `legacy-types.js` | The ten original graph types, whose forms are written by hand in the HTML |
| `types/*.js` | Registered graph types, one family per file |
| `exports.js`, `themes.js` | PNG, SVG, PPTX, clipboard, and print themes |
| `ui.js`, `debug.js`, `layout-tests.js` | Page wiring, the debug overlay, the "Run Auto-Tests" button |
| `tests/` | Economics tests and the test page |

## Adding a graph type

Call `GraphTypes.register()` from the matching file in `types/`. `types/welfare.js` shows a
single panel and `types/elasticity.js` shows two. The buttons and the form are generated for you.

```js
GraphTypes.register({
  id: 'my-graph',            // unique; also used in the form field ids
  label: 'My Graph',         // button text
  group: 'Ch 7 Welfare',     // shown as the button's tooltip
  replaces: 'tax',           // hides this original type's button; do everything it did first
  usesSD: true,              // show the shared S0/D0 inputs; v.supply and v.demand are then lines
  usesLabels: true,          // show Good Name, Quantity Unit, Price Prefix (default true)
  cols: 2,                   // panels per row (default: all panels in one row)
  steps: ['Market', 'Tax'],  // build steps; adds the Answer Key/Question toggle and a step picker
  questionStep: 1,           // last step shown in Question mode (default 1)
  fields: [
    { type: 'header', label: 'Section title' },
    { id: 'amt', label: 'Tax', type: 'number', value: 2, step: 0.5 },
    { id: 'who', label: 'On', type: 'select', options: [['s', 'Sellers'], ['b', 'Buyers']] },
    { id: 'show', label: 'Show labels', type: 'checkbox', value: true },
    { id: 'kind', label: 'Kind', type: 'toggle', options: [['a', 'A'], ['b', 'B']] },
  ],
  presets: [{ label: 'Large tax', values: { amt: 5 } }],
  compute(v) { return { /* every number the graph shows */ }; },
  panels(v, m) {
    return [{
      title: 'Optional title',
      x: 'Quantity of labor',  // axis titles; default to Quantity/Price of the good
      y: 'Wage',
      yPrefix: '$',
      points: [[q, p]],        // everything that must be visible; axes start at the origin
      draw(svg, cfg) { /* drawing only */ },
    }];
  },
  summary(m, v) { return [['DWL', fmtNum(m.dwl)]]; },  // the readout under the preview
  tests: [{ name: 'hand-checked case', v: { amt: 4 }, check(m, t) { t.near(m.dwl, 50, 'DWL'); } }],
});
```

## Rules

1. **`compute(v)` is pure.** It takes values and returns numbers, with no access to the page. The
   tests run it without a browser. Do the economics there; `draw` only draws what it returns.
2. **Every type needs economics tests.** A type with none fails the suite. Expected values must be
   worked out by hand or from an accounting identity (for example, surplus before the tax equals
   surplus after it plus revenue plus DWL), never copied from what the code printed.
3. **Test the awkward cases**: non-binding policies, curves that meet off the axes, vertical and
   horizontal curves, and zero amounts.
4. **Shade with `shade()`** using a name from `REGIONS`, and take colors from `C`. Print themes and
   exports find regions through `data-region`, so a raw polygon will not print correctly.
5. **Draw through `layer(svg, step)`** when a type has steps. Steps are cumulative and start at 1.
   Draw shading first so curves sit on top. The order on screen follows the order drawn, not the
   step number.
6. **Conceptual axes must work.** With `cfg.symbolic` there are no numbers on the axes, so pass
   `qLabel` and `pLabel` (Q0, P0) to `markPoint`, and don't print numbers into labels when it is on.
7. **Use made-up examples** in defaults and presets. Never copy text, examples, or figures from a
   textbook, slide deck, homework, or exam into this public repository.
8. **Keep your top-level names to yourself.** Every script shares one global scope, and a second
   `const` with the same name stops that whole file from loading. Wrap each file in
   `(() => { ... })();`. If two of your files share helpers, expose one object named for the family,
   such as `const TradeKit = { ... };`.

## Helpers

- Curves: `lineFromPoints(q1, p1, q2, p2)` (handles vertical and horizontal), `verticalLine(q)`,
  `shiftLine(line, dq, dp)`, `intersect(a, b)` (returns `null` for parallel lines)
- Areas: `polyArea(points)`; ranges: `rangeFromPoints(points)`; numbers: `fmtNum(n, digits)`
- Drawing: `drawCurve`, `drawHLine`, `drawVLine`, `drawBracket`, `drawVerticalArrow`,
  `drawCostCurve`, `textBg`, `el`, plus `layer`, `shade`, and `markPoint`
- Scripted builds: `GraphTypes.build(def, base, forExport, { values, stepLimit })`

Panels are nested SVGs, each using the same `W` x `H` coordinates, so these helpers work inside
any panel. The whole canvas is `cols * W` wide and `rows * H` tall.

## Testing

```bash
node tools/econ-graph/tests/run.js
```

That runs the core and economics tests without a browser. For layout checks and a look at every
tested graph, serve the repository root and open `tests/index.html`:

```bash
python -m http.server 8765
```

Then visit `http://localhost:8765/tools/econ-graph/tests/index.html`. The main page's "Run
Auto-Tests" button covers the original ten types.
