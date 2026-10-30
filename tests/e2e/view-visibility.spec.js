const { test, expect, openTestDocument } = require('./test-fixture');
async function showHidden(page, checked) {
  const menu = page.locator('.app-menu > summary').nth(2);
  await menu.click(); await page.locator('#viewShowHiddenElementsInput').setChecked(checked); await menu.click();
}
test('constraint status respects hidden geometry; show hidden is independent, temporary and outside history', async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ['L1'] }));
  await page.locator('#selectionVisibilityBtn').click();
  const before = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState(), selection: window.__jot2dTest.selectedGeometryIdsForTest() }));
  const visible = () => page.evaluate(() => window.__jot2dTest.appearanceStateForTest('line', 'L1').visible);
  expect(await visible()).toBe(false);
  await page.locator('#constraintStatusViewBtn').click(); expect(await visible()).toBe(false);
  await showHidden(page, true); expect(await visible()).toBe(true);
  await page.locator('#constraintStatusViewBtn').click(); expect(await visible()).toBe(true);
  await page.keyboard.down('Space'); expect(await visible()).toBe(true);
  await page.keyboard.up('Space'); expect(await visible()).toBe(true);
  await showHidden(page, false); expect(await visible()).toBe(false);
  await page.keyboard.down('Space'); expect(await visible()).toBe(false);
  await page.keyboard.up('Space'); expect(await visible()).toBe(false);
  const after = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState(), selection: window.__jot2dTest.selectedGeometryIdsForTest() }));
  delete before.model.savedAt; delete after.model.savedAt;
  expect(after).toEqual(before);
});
test('hidden Sketch dimensions are shown only by show hidden, and their stored settings survive', async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForActiveSketchDimensionVisibility());
  const fixture = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  fixture.sketches.find(sketch => sketch.id === "S2").appearance.visible = false;
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "hidden-sketch.jot2d"), fixture);
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  for (const status of [false, true]) {
    if (status) await page.locator('#constraintStatusViewBtn').click();
    expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest())).toEqual(['100']);
    await showHidden(page, true);
    expect(new Set(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest()))).toEqual(new Set(['100', '160']));
    await showHidden(page, false);
    expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest())).toEqual(['100']);
  }
  const after = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  delete before.savedAt; delete after.savedAt; expect(after).toEqual(before);
});
test('hidden internal Sketch hides its centerline outside the block after save and reload', async ({ page }) => {
  await openTestDocument(page);
  const root = { id: 'ROOT', name: 'Root Sketch', parentSketchId: null, kind: 'root' };
  const sketch = { id: 'S1', name: 'Hidden speaker', parentSketchId: 'ROOT', kind: 'sketch', appearance: { visible: false } };
  const data = {
    version: 8, documentName: 'Hidden speaker', sketches: [root, { ...sketch, appearance: {} }], activeSketchId: 'S1',
    blockDefinitions: [{ id: 'B1', name: 'Speaker', revision: 1, origin: { x: 0, y: 0 },
      sketches: [root, sketch], activeSketchId: 'S1',
      points: [{ id: 'P1', x: -50, y: 0, kind: 'endpoint', sketchId: 'S1' }, { id: 'P2', x: 50, y: 0, kind: 'endpoint', sketchId: 'S1' }],
      lines: [{ id: 'L1', p1: 'P1', p2: 'P2', construction: true, sketchId: 'S1' }], circles: [], arcs: [], constraints: [] }],
    blockInstances: [{ id: 'BI1', definitionId: 'B1', sketchId: 'S1', x: 0, y: 0, rotation: 0, enabledSketchIds: ['S1'] }],
    points: [], lines: [], circles: [], arcs: [], constraints: [],
  };
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'hidden-speaker.jot2d'), data);
  const visible = () => page.evaluate(() => window.__jot2dTest.appearanceStateForTest('line', 'BI1@L1').visible);
  const rendering = () => page.evaluate(() => window.__jot2dTest.constructionLineRenderingForTest('BI1@L1'));
  expect(await visible()).toBe(false);
  expect(await rendering()).toMatchObject({ overhangPx: null, endpointMarkerCount: 0 });
  await page.locator('#constraintStatusViewBtn').click(); expect(await visible()).toBe(false);
  await showHidden(page, true); expect(await visible()).toBe(true);
  expect(await rendering()).toMatchObject({ overhangPx: 12, endpointMarkerCount: 2 });
  await showHidden(page, false); expect(await visible()).toBe(false);
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(saved.blockDefinitions[0].sketches.find(s => s.id === 'S1').appearance.visible).toBe(false);
  expect(saved.blockInstances[0].enabledSketchIds).toEqual(['S1']);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'hidden-speaker.jot2d'), saved);
  expect(await visible()).toBe(false);
  expect(await rendering()).toMatchObject({ overhangPx: null, endpointMarkerCount: 0 });
});

test('active selected Sketch has no Edit button; Root has no Edit or Editing marker', async ({ page }) => {
  await openTestDocument(page); await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  const active = page.locator('.sketch-item[data-id="S1"]');
  await active.locator('.sketchActivateBtn').click(); await active.hover();
  await expect(active.locator('.sketchEditBtn')).toBeHidden();
  await expect(active.locator('.sketch-active-label')).toBeVisible();
  const root = page.locator('.sketch-item[data-id="ROOT"]');
  await root.locator('.sketchActivateBtn').click(); await root.hover();
  await expect(root.locator('.sketchEditBtn')).toBeHidden();
  await expect(root.locator('.sketch-active-label')).toHaveCount(0);
  await root.locator('.sketchActivateBtn').click({ button: 'right' });
  await expect(page.locator('#sketchContextMenu')).toBeHidden();
  await root.locator('.sketchActivateBtn').dblclick();
  await expect(root.locator('.sketchEditBtn')).toBeHidden();
  await expect(root.locator('.sketch-active-label')).toHaveCount(0);
});
