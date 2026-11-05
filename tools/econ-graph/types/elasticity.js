// Ch 5 elasticity.

(() => {
  // Midpoint elasticity between two (q, p) points
  function midpointElasticity(q0, p0, q1, p1) {
    return ((q1 - q0) / ((q1 + q0) / 2)) / ((p1 - p0) / ((p1 + p0) / 2));
  }

  GraphTypes.register({
    id: 'elasticity-compare',
    label: 'Elastic vs Inelastic',
    group: 'Ch 5 Elasticity',
    steps: ['Starting point', 'Price rises'],
    fields: [
      { id: 'q0', label: 'Starting quantity', type: 'number', value: 100 },
      { id: 'p0', label: 'Starting price', type: 'number', value: 10, step: 0.5 },
      { id: 'p1', label: 'New price', type: 'number', value: 12, step: 0.5 },
      { id: 'qInelastic', label: 'New quantity, inelastic demand', type: 'number', value: 90 },
      { id: 'qElastic', label: 'New quantity, elastic demand', type: 'number', value: 50 },
    ],

    compute(v) {
      return {
        inelastic: lineFromPoints(v.q0, v.p0, v.qInelastic, v.p1),
        elastic: lineFromPoints(v.q0, v.p0, v.qElastic, v.p1),
        eInelastic: midpointElasticity(v.q0, v.p0, v.qInelastic, v.p1),
        eElastic: midpointElasticity(v.q0, v.p0, v.qElastic, v.p1),
      };
    },

    panels(v, m) {
      // Both panels share one scale, because steepness is the point of the comparison
      const points = [[v.q0 * 1.5, Math.max(v.p0, v.p1) * 1.5]];
      const panel = (title, line, q1) => ({
        title,
        points,
        draw(svg, cfg) {
          const start = layer(svg, 1), after = layer(svg, 2);
          drawCurve(start, line, cfg, C.demand, 'Demand');
          markPoint(start, v.q0, v.p0, cfg, { label: 'A', qLabel: 'Q0', pLabel: 'P0' });
          markPoint(after, q1, v.p1, cfg, { label: 'B', qLabel: 'Q1', pLabel: 'P1' });
        },
      });
      return [panel('Inelastic demand', m.inelastic, v.qInelastic), panel('Elastic demand', m.elastic, v.qElastic)];
    },

    summary(m) {
      return [['Inelastic demand elasticity', fmtNum(m.eInelastic)], ['Elastic demand elasticity', fmtNum(m.eElastic)]];
    },

    tests: [
      {
        name: 'midpoint elasticities land on the right sides of 1',
        check(m, t) {
          t.near(m.eInelastic, -0.5789, 'inelastic', 1e-3);
          t.near(m.eElastic, -3.6667, 'elastic', 1e-3);
          t.ok(Math.abs(m.eInelastic) < 1, 'inelastic is below 1');
          t.ok(Math.abs(m.eElastic) > 1, 'elastic is above 1');
        },
      },
      {
        name: 'no quantity response is perfectly inelastic, a vertical demand curve',
        v: { qInelastic: 100 },
        check(m, t) {
          t.ok(m.inelastic.vertical, 'demand is vertical');
          t.near(m.eInelastic, 0, 'elasticity');
        },
      },
    ],
  });
})();
