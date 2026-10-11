const { test, expect, openTestDocument } = require('./test-fixture');

test.beforeEach(async ({ page }) => { await openTestDocument(page); });

for (const reloadSharedVersion19 of [false, true]) {
  test(`rectangle projection retains shared sources and independent target endpoints, legacy reload ${reloadSharedVersion19}`, async ({ page }) => {
    const state = await page.evaluate(options => window.__jot2dTest.resetForSketchProjectionRectangleTest(options), { reloadSharedVersion19 });
    expect(state.constraints.map(link => link.kind)).toEqual(['line', 'line', 'line', 'line']);
    const sourceIds = state.constraints.flatMap(link => [link.source.p1, link.source.p2]);
    const targetIds = state.constraints.flatMap(link => [link.target.p1, link.target.p2]);
    expect(new Set(sourceIds).size).toBe(4);
    expect(new Set(targetIds).size).toBe(8);
    for (const link of state.constraints) {
      expect(link.target.points).toEqual(link.source.points);
      expect(link.sketchId).toBe('S3');
    }
  });

  test(`mixed projection retains shared source point and independent target points, legacy reload ${reloadSharedVersion19}`, async ({ page }) => {
    const state = await page.evaluate(options => window.__jot2dTest.resetForSketchProjectionSharedKindsTest(options), { reloadSharedVersion19 });
    expect(state.constraints.map(link => link.kind)).toEqual(['point', 'line', 'circle', 'arc', 'spline']);
    const pointIds = side => state.constraints.map(link => {
      const geometry = link[side];
      if (geometry.kind === 'point') return geometry.id;
      if (geometry.kind === 'line') return geometry.p1;
      if (geometry.kind === 'spline') return geometry.fitPoints[0].id;
      return geometry.center.id;
    });
    expect(new Set(pointIds('source')).size).toBe(1);
    expect(new Set(pointIds('target')).size).toBe(5);
    expect(state.constraints.every(link => link.sketchId === 'S3')).toBe(true);
  });
}
