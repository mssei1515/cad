const { test, expect, openTestDocument } = require('./test-fixture');

test.beforeEach(async ({ page }) => { await openTestDocument(page); });

test('source editing updates dependent geometry while preserving projection references', async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionSharedKindsTest());
  const result = await page.evaluate(() => window.__jot2dTest.moveSketchProjectionSourcesForTest(10, -5, { changeShape: true, changeSplineStructure: true }));
  expect(result.success).toBe(true);
  const links = new Map(result.state.constraints.map(link => [link.kind, link]));
  expect(links.get('point').source).toMatchObject({ x: -35, y: -25 });
  expect(links.get('point').target).toMatchObject({ x: -35, y: -25 });
  expect(links.get('circle').source.radius).toBe(21);
  expect(links.get('circle').target.radius).toBe(21);
  expect(links.get('arc').target.radius).toBe(links.get('arc').source.radius);
  expect(links.get('spline').source.fitPoints).toHaveLength(4);
  expect(links.get('spline').target.fitPoints).toHaveLength(4);
  expect(links.get('spline').target.closed).toBe(true);
});

test('projection chain keeps its upstream target reference through normal save reload', async ({ page }) => {
  expect(await page.evaluate(() => window.__jot2dTest.createSketchProjectionChainForTest())).toBeNull();
  await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionRectangleTest());
  const result = await page.evaluate(() => window.__jot2dTest.createSketchProjectionChainForTest());
  expect(result.success).toBe(true);
  const upstream = result.state.constraints.find(link => link.sketchId === 'S3');
  const downstream = result.state.constraints.find(link => link.sketchId === 'S4');
  expect(downstream.sourceId).toBe(upstream.targetId);
  expect(downstream.target.points).toEqual(upstream.target.points);
  const reloaded = await page.evaluate(version => window.__jot2dTest.reloadSketchProjectionForTest(String(version)), result.state.serialized.version);
  expect(reloaded.constraints.map(link => [link.sourceId, link.targetId, link.sketchId])).toEqual(result.state.constraints.map(link => [link.sourceId, link.targetId, link.sketchId]));
  expect(reloaded.sketches.filter(sketch => sketch.id === 'S4')).toHaveLength(1);
});

test('projection eligibility fixture respects ancestry, visibility and Root restrictions', async ({ page }) => {
  const result = await page.evaluate(() => window.__jot2dTest.sketchProjectionEligibilityForTest());
  expect(result).toEqual({ ancestor: true, hiddenAncestor: false, self: false, sibling: false, child: false, root: false });
});

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


test('projection appearance test action preserves its link and changes one undo step', async ({ page }) => {
  const before = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionSharedKindsTest());
  const initial = before.constraints.find(link => link.kind === 'line');
  const result = await page.evaluate(() => window.__jot2dTest.setSketchProjectionAppearanceForTest('line'));
  expect(result.changed).toBe(true);
  const changed = result.state.constraints.find(link => link.kind === 'line');
  expect(changed.sourceId).toBe(initial.sourceId);
  expect(changed.targetId).toBe(initial.targetId);
  expect(changed.appearanceColor.toLowerCase()).toBe('#8b5cf6');
  expect(result.state.constraints).toHaveLength(before.constraints.length);
  expect(result.state.history.undoCount).toBe(before.history.undoCount + 1);
  await page.keyboard.press('Control+z');
  const restored = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(restored.constraints.find(link => link.kind === 'line').appearanceColor).toBe(initial.appearanceColor);
  expect(restored.history.undoCount).toBe(before.history.undoCount);
});
