// Checks on the shared math. Loaded by tests/index.html and tests/run.js.
const CORE_TESTS = [
  {
    name: 'a vertical curve meets a sloped curve at its quantity',
    check(t) {
      const eq = intersect(lineFromPoints(100, 2, 100, 9), lineFromPoints(0, 0, 200, 10));
      t.near(eq.q, 100, 'q');
      t.near(eq.p, 5, 'p');
    },
  },
  {
    name: 'a horizontal curve meets a sloped curve at its price',
    check(t) {
      const eq = intersect(lineFromPoints(0, 7, 300, 7), lineFromPoints(0, 0, 200, 10));
      t.near(eq.q, 140, 'q');
      t.near(eq.p, 7, 'p');
    },
  },
  {
    name: 'shifting a curve moves it by the amounts given',
    check(t) {
      const moved = shiftLine(lineFromPoints(0, 0, 100, 10), 50, 2);
      t.near(moved.evalAt(50), 2, 'value at the shifted origin');
      t.near(moved.qAt(2), 50, 'inverse at the shifted origin');
      t.near(moved.intercept, -3, 'intercept');
      t.near(shiftLine(lineFromPoints(40, 1, 40, 9), 10).q, 50, 'vertical curve');
    },
  },
  {
    name: 'decimal ticks print cleanly',
    check(t) {
      const ticks = tickValues(0, 2.8, 0.4);
      t.near(ticks.length, 8, 'tick count');
      t.ok(String(ticks[3]) === '1.2', `third step prints as ${ticks[3]}`);
      t.ok(tickValues(0, 10, 0).length === 2, 'a zero step cannot loop forever');
    },
  },
  {
    name: 'ranges start at the origin and contain every point',
    check(t) {
      const r = rangeFromPoints([[175, 7], [350, 14]]);
      t.near(r.qtyMin, 0, 'qtyMin');
      t.near(r.priceMin, 0, 'priceMin');
      t.ok(r.qtyMax >= 350, 'qtyMax');
      t.ok(r.priceMax >= 14, 'priceMax');
    },
  },
  {
    name: 'polygon area',
    check(t) {
      t.near(polyArea([[0, 14], [175, 7], [0, 7]]), 612.5, 'triangle');
      t.near(polyArea([[0, 0], [100, 0], [300, 4], [0, 4]]), 800, 'trapezoid');
    },
  },
];

function runCoreTests() {
  return CORE_TESTS.map(test => {
    const failures = [];
    try {
      test.check(GraphTypes.assertions(failures));
    } catch (e) {
      failures.push(`threw: ${e.message}`);
    }
    return { type: 'core', name: test.name, failures };
  });
}
