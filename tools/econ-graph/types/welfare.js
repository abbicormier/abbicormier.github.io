// Ch 7 welfare: consumer surplus, producer surplus, deadweight loss.

GraphTypes.register({
  id: 'surplus',
  label: 'Surplus',
  group: 'Ch 7 Welfare',
  usesSD: true,
  steps: ['Supply and demand', 'Consumer surplus', 'Producer surplus'],

  compute(v) {
    const eq = intersect(v.supply, v.demand);
    const dTop = v.demand.evalAt(0);
    const sAtZero = v.supply.evalAt(0);
    // Supply starts on the price axis or, when its price intercept is negative, on the quantity axis
    const csPoly = [[0, dTop], [eq.q, eq.p], [0, eq.p]];
    const psPoly = sAtZero >= 0
      ? [[0, sAtZero], [eq.q, eq.p], [0, eq.p]]
      : [[0, 0], [v.supply.qAt(0), 0], [eq.q, eq.p], [0, eq.p]];
    const cs = polyArea(csPoly), ps = polyArea(psPoly);
    return { eq, dTop, csPoly, psPoly, cs, ps, total: cs + ps };
  },

  panels(v, m) {
    return [{
      points: [[0, m.dTop], [v.demand.qAt(0), 0], [v.supply.qAt(m.dTop), m.dTop]],
      draw(svg, cfg) {
        // Shading goes in first so the curves sit on top of it
        shade(layer(svg, 2), m.csPoly, cfg, 'cs', 'Consumer surplus');
        shade(layer(svg, 3), m.psPoly, cfg, 'ps', 'Producer surplus');
        const market = layer(svg, 1);
        drawCurve(market, v.supply, cfg, C.supply, v.s0Label);
        drawCurve(market, v.demand, cfg, C.demand, v.d0Label);
        markPoint(market, m.eq.q, m.eq.p, cfg, { label: v.eqLabel, qLabel: 'Q*', pLabel: 'P*' });
      },
    }];
  },

  summary(m, v) {
    return [
      ['Equilibrium', `Q = ${fmtNum(m.eq.q)}, P = ${v.pricePrefix}${fmtNum(m.eq.p)}`],
      ['Consumer surplus', fmtNum(m.cs)],
      ['Producer surplus', fmtNum(m.ps)],
      ['Total surplus', fmtNum(m.total)],
    ];
  },

  tests: [
    {
      name: 'default market splits surplus evenly',
      check(m, t) {
        t.near(m.eq.q, 175, 'equilibrium quantity');
        t.near(m.eq.p, 7, 'equilibrium price');
        t.near(m.cs, 612.5, 'consumer surplus');
        t.near(m.ps, 612.5, 'producer surplus');
      },
    },
    {
      name: 'supply with a negative price intercept gives a trapezoid of producer surplus',
      v: { supply: lineFromPoints(100, 0, 300, 4), demand: lineFromPoints(0, 10, 500, 0) },
      check(m, t) {
        t.near(m.eq.q, 300, 'equilibrium quantity');
        t.near(m.eq.p, 4, 'equilibrium price');
        t.near(m.cs, 900, 'consumer surplus');
        t.near(m.ps, 800, 'producer surplus');
      },
    },
  ],
});
