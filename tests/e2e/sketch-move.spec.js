const { test, expect } = require('./test-fixture');
test.beforeEach(async ({ page }) => { await page.goto('/?test=1'); await page.waitForFunction(() => Boolean(window.__jot2dTest)); });
const state = page => page.evaluate(() => { const state = window.__jot2dTest.sketchMoveStateForTest(); delete state.serialized.savedAt; return state; });
async function fixture(page, hidden = false) {
  const { serialized: data } = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  data.points = data.points.slice(0, 2);
  data.points[0].x = 10; data.points[0].y = 20; data.points[0].fixed = true;
  data.points[1].x = 90; data.points[1].y = 20;
  data.lines = data.lines.slice(0, 1);
  data.lines[0].appearance = {}; data.lines[0].drawingOrder = 0;
  data.constraints = [{ type: 'horizontal', line: 'L1', sketchId: 'S1', reference: false }];
  data.sketches.push({ ...data.sketches.find(s => s.id === 'S1'), id: 'S2', name: '移動先', parentSketchId: 'ROOT', visible: !hidden, appearance: { color: '#dd0011', lineWidth: 3, visible: !hidden } });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'move.jot2d'), data)).success).toBe(true);
  return { data, client: await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 50, y: 20 })) };
}
async function start(page, client) {
  await page.mouse.click(client.x, client.y, { button: 'right' });
  await page.locator('[data-context-action="sketch-move"]').click();
  await expect(page.locator('.sketch-move-panel')).toBeVisible();
}
async function commit(page, id = 'S2') {
  await page.locator(`.sketch-item[data-id="${id}"] .sketchActivateBtn`).click();
  await expect(page.locator('[data-sketch-move-action="commit"]')).toBeEnabled();
  await page.locator('[data-sketch-move-action="commit"]').click();
  await expect(page.locator('.sketch-move-panel')).toHaveCount(0);
}
test('tree destination selection transfers geometry and constraints in one Undo step without switching active or visibility', async ({ page }) => {
  const { client } = await fixture(page, true);
  const before = (await state(page)).serialized;
  await start(page, client);
  await expect(page.locator('.sketch-item[data-id="ROOT"] .sketchActivateBtn')).toBeDisabled();
  await expect(page.locator('.sketch-item[data-id="S1"] .sketchActivateBtn')).toBeDisabled();
  await expect(page.locator('[data-sketch-move-action="commit"]')).toBeDisabled();
  await page.locator('.sketch-item[data-id="S2"] .sketchActivateBtn').click();
  let current = await state(page);
  expect(current.activeSketchId).toBe('S1'); expect(current.selected.lines).toEqual(['L1']);
  await page.keyboard.press('Delete');
  await page.mouse.click(client.x + 20, client.y + 20);
  expect((await state(page)).ownership.lines).toHaveLength(1);
  await page.locator('[data-sketch-move-action="commit"]').click();
  current = await state(page);
  expect(current.activeSketchId).toBe('S1'); expect(current.selected.lines).toEqual([]);
  expect(current.serialized.sketches).toEqual(before.sketches);
  expect(current.serialized.points).toEqual(before.points.map(p => ({ ...p, sketchId: 'S2' })));
  expect(current.serialized.lines).toEqual(before.lines.map(l => ({ ...l, sketchId: 'S2' })));
  expect(current.serialized.constraints).toEqual(before.constraints.map(c => ({ ...c, sketchId: 'S2' })));
  const saved = current.serialized;
  await page.keyboard.press('Control+z'); expect((await state(page)).serialized).toEqual(before);
  await page.keyboard.press('Control+y'); expect((await state(page)).serialized).toEqual(saved);
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'move.jot2d'), saved)).success).toBe(true);
  expect((await state(page)).serialized).toEqual(saved);
});

test('Block Definition editing moves within its own tree and supports Undo', async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.openReferenceImageBlockEditorForTest());
  await page.locator('#addSketchBtn').click();
  const target = (await state(page)).activeSketchId;
  await page.locator('.sketch-item[data-id="S1"] .sketchActivateBtn').dblclick();
  const before = (await state(page)).serialized;
  const client = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 0, y: 0 }));
  await start(page, client); await commit(page, target);
  let current = await state(page);
  expect(current.editingBlock).toBe(true); expect(current.activeSketchId).toBe('S1');
  expect(current.ownership.lines[0].sketchId).toBe(target);
  await page.keyboard.press('Control+z'); expect((await state(page)).serialized).toEqual(before);
  await page.keyboard.press('Control+y');
  const completed = await page.evaluate(() => window.__jot2dTest.completeReferenceImageBlockEditorForTest());
  expect(completed.blockDefinitions[0].lines[0].sketchId).toBe(target);
});

test('mixed geometry, annotation, and image retain identity and placement after save/reload', async ({ page }) => {
  const { client } = await fixture(page);
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 30; canvas.height = 20;
    canvas.getContext('2d').fillRect(0, 0, 30, 20); return canvas.toDataURL();
  });
  expect(await page.evaluate(url => window.__jot2dTest.importReferenceImageDataForTest(url), dataUrl)).toBe(true);
  const data = (await state(page)).serialized;
  data.referenceImages[0].x = -200; data.referenceImages[0].y = 120; data.referenceImages[0].scale = 1;
  data.annotations.push({ id: 'AN1', type: 'text', sketchId: 'S1', visible: true, text: 'move', position: { x: 20, y: 70 }, style: {} });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'move.jot2d'), data)).success).toBe(true);
  const before = (await state(page)).serialized;
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ['L1'], annotations: ['AN1'], referenceImages: ['IMG1'] }));
  await start(page, client); await commit(page);
  const saved = (await state(page)).serialized;
  for (const field of ['points', 'lines', 'annotations', 'referenceImages']) {
    expect(saved[field].map(({ sketchId, drawingOrder, ...item }) => item)).toEqual(before[field].map(({ sketchId, drawingOrder, ...item }) => item));
    expect(saved[field].every(item => item.sketchId === 'S2')).toBe(true);
  }
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'move.jot2d'), saved)).success).toBe(true);
  expect((await state(page)).serialized).toEqual(saved);
});
test('cancel preserves selection and ownership; shared geometry prevents starting a move', async ({ page }) => {
  const { data, client } = await fixture(page);
  await start(page, client); await page.locator('.sketch-item[data-id="S2"] .sketchActivateBtn').click();
  await page.keyboard.press('Escape');
  expect((await state(page)).active).toBe(false); expect((await state(page)).selected.lines).toEqual(['L1']);
  await start(page, client); await page.locator('[data-sketch-move-action="cancel"]').click();
  expect((await state(page)).ownership.lines[0].sketchId).toBe('S1');
  data.points.push({ ...data.points[1], id: 'P3', x: 110, y: 50 });
  data.lines.push({ ...data.lines[0], id: 'L2', p1: 'P2', p2: 'P3', drawingOrder: 1 });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'shared.jot2d'), data)).success).toBe(true);
  await page.mouse.click(client.x, client.y, { button: 'right' });
  await page.locator('[data-context-action="sketch-move"]').click();
  expect((await state(page)).active).toBe(false);
  await expect(page.locator('#hint')).toContainText('L2');
});
test('fill and all boundaries move together and inherit the destination appearance', async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.locator('#toolHatch').click(); await page.mouse.click(fixture.client.x, fixture.client.y); await page.keyboard.press('Escape');
  const data = (await state(page)).serialized;
  data.sketches.push({ ...data.sketches.find(s => s.id === 'S1'), id: 'S2', name: '移動先', parentSketchId: 'ROOT', appearance: { color: '#dd0011', lineWidth: 3 } });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'fill-move.jot2d'), data)).success).toBe(true);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ['L1', 'L2', 'L3', 'L4'], hatches: ['H1'] }));
  await start(page, fixture.client); await commit(page);
  const current = await state(page);
  for (const field of ['points', 'lines', 'hatches']) expect(current.serialized[field].every(item => item.sketchId === 'S2')).toBe(true);
  expect(current.serialized.hatches[0].appearance).toEqual(data.hatches[0].appearance);
  expect(current.serialized.lines[0].appearance).toEqual(data.lines[0].appearance);
  expect(current.serialized.lines.map(item => item.drawingOrder)).toEqual(data.lines.map(item => item.drawingOrder));
  await page.locator('.sketch-item[data-id="S2"] .sketchActivateBtn').dblclick();
  await page.mouse.click(fixture.boundaryClient.x, fixture.boundaryClient.y);
  await expect(page.locator('#propertiesPanel [data-appearance-key="color"]')).toHaveAttribute('placeholder', '既定 (#dd0011)');
});

test('whole nested Block moves without modifying Definition geometry or placement', async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForProjectedHatchTest());
  const data = fixture.serialized;
  data.sketches.push({ ...data.sketches.find(s => s.id === 'S1'), id: 'S2', name: '移動先', parentSketchId: 'ROOT' });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'block-move.jot2d'), data)).success).toBe(true);
  const before = (await state(page)).serialized;
  await start(page, fixture.client); await commit(page);
  const saved = (await state(page)).serialized;
  expect(saved.blockDefinitions).toEqual(before.blockDefinitions);
  expect(saved.blockInstances).toEqual(before.blockInstances.map(item => ({ ...item, sketchId: 'S2' })));
  await page.keyboard.press('Control+z'); expect((await state(page)).serialized).toEqual(before);
  await page.keyboard.press('Control+y'); expect((await state(page)).serialized).toEqual(saved);
});

test('image alone offers the move action from its context menu', async ({ page }) => {
  await fixture(page);
  const dataUrl = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20; return canvas.toDataURL(); });
  expect(await page.evaluate(url => window.__jot2dTest.importReferenceImageDataForTest(url), dataUrl)).toBe(true);
  const image = (await state(page)).serialized.referenceImages[0];
  const client = await page.evaluate(({ x, y }) => window.__jot2dTest.worldClientPositionForTest({ x, y }), image);
  await start(page, client); await commit(page);
  expect((await state(page)).ownership.referenceImages[0].sketchId).toBe('S2');
});

test('external ancestor reference follows its moved source and invalid destinations are disabled', async ({ page }) => {
  const { data, client } = await fixture(page);
  data.sketches.find(s => s.id === 'S2').parentSketchId = 'S1';
  data.sketches.push({ ...data.sketches[1], id: 'S3', name: '参照側', parentSketchId: 'S2' });
  data.sketches.push({ ...data.sketches[1], id: 'S4', name: '別系統', parentSketchId: 'ROOT' });
  data.points.push({ ...data.points[0], id: 'P3', sketchId: 'S3', fixed: false });
  data.constraints.push({ type: 'coincident', p1: 'P3', p2: 'P1', sketchId: 'S3', reference: true, referenceSketchId: 'S1' });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'reference-move.jot2d'), data)).success).toBe(true);
  await start(page, client);
  await expect(page.locator('.sketch-item[data-id="S4"] .sketchActivateBtn')).toBeDisabled();
  await commit(page);
  const reference = (await state(page)).serialized.constraints.find(c => c.type === 'coincident');
  expect(reference).toMatchObject({ sketchId: 'S3', reference: true, referenceSketchId: 'S2', p1: 'P3', p2: 'P1' });
});
