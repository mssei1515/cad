const { test, expect, openTestDocument } = require('./test-fixture');
const dxf = (entities, units = 4) => [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, units, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES', ...entities, 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
const line = [0, 'LINE', 8, 'Layer A', 10, 0, 20, 0, 11, 30, 21, 20];
const upload = (page, text) => page.locator('#dxfFileInput').setInputFiles({ name: 'sample.dxf', mimeType: 'application/dxf', buffer: Buffer.from(text) });
const snapshot = page => page.evaluate(() => window.__jot2dTest.serializedModelForTest());
test.beforeEach(async ({ page }) => { await openTestDocument(page); });

test('menu import combines layers in active sketch, preserves geometry through undo/redo and jot2d reload', async ({ page }) => {
  await page.locator('#addSketchBtn').click();
  const before = await snapshot(page);
  await page.locator('.app-menu > summary').first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#dxfImportBtn').click();
  await (await chooser).setFiles({ name: 'sample.dxf', mimeType: 'application/dxf', buffer: Buffer.from(dxf([
    ...line, 0, 'CIRCLE', 8, 'Layer B', 10, 50, 20, 20, 40, 10,
    0, 'ARC', 10, 60, 20, 0, 40, 5, 50, 350, 51, 10,
    0, 'LWPOLYLINE', 90, 2, 70, 1, 10, 0, 20, 30, 42, 1, 10, 20, 20, 30,
  ])) });
  await expect.poll(async () => (await snapshot(page)).lines.length).toBe(2);
  let data = await snapshot(page);
  expect(data.circles).toHaveLength(1); expect(data.arcs).toHaveLength(2);
  expect(data.sketches).toHaveLength(before.sketches.length);
  for (const item of [...data.points, ...data.lines, ...data.circles, ...data.arcs]) expect(item.sketchId).toBe(before.activeSketchId);
  expect(data.points.some(p => p.x === 30 && p.y === -20)).toBe(true);
  expect(data.constraints).toHaveLength(0);
  await expect(page.locator('#documentSaveStatus')).toHaveAttribute('data-dirty', 'true');
  await page.keyboard.press('Control+z');
  expect((await snapshot(page)).lines).toHaveLength(0);
  await page.keyboard.press('Control+y');
  data = await snapshot(page); expect(data.lines).toHaveLength(2);
  // Save with the actual file command, then reopen its bytes with the normal reader.
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({ name: 'dxf-converted.jot2d', createWritable: async () => ({
      write: async text => { window.dxfSaved = text; }, close: async () => {},
    }) });
  });
  await page.keyboard.press('Control+s');
  await expect(page.locator('#documentSaveStatus')).toHaveAttribute('data-dirty', 'false');
  const saved = await page.evaluate(() => window.dxfSaved);
  await page.locator('#documentFileInput').setInputFiles({ name: 'dxf-converted.jot2d', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await expect(page).toHaveTitle('dxf-converted - Jot2D');
  const reloaded = await snapshot(page);
  for (const field of ['points', 'lines', 'circles', 'arcs']) expect(reloaded[field]).toEqual(data[field]);
});

test('unknown unit choice and partial import cancellation leave original drawing intact', async ({ page }) => {
  await upload(page, dxf(line, 0));
  await expect(page.locator('#choiceDialog')).toBeVisible();
  await page.locator('[data-choice-value="25.4"]').click();
  await expect.poll(async () => (await snapshot(page)).lines.length).toBe(1);
  expect((await snapshot(page)).points.some(p => Math.abs(p.x - 762) < 1e-9)).toBe(true);
  await upload(page, dxf([...line, 0, 'SPLINE']));
  await expect(page.locator('#choiceDialog')).toContainText('SPLINE: 1');
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).lines).toHaveLength(1);
  await upload(page, dxf([...line, 0, 'ELLIPSE']));
  await page.locator('[data-choice-value="true"]').click();
  await expect.poll(async () => (await snapshot(page)).lines.length).toBe(2);
  await upload(page, dxf(line).replace('EOF', 'BROKEN'));
  await expect(page.locator('#hint')).toContainText('DXF読込に失敗');
  expect((await snapshot(page)).lines).toHaveLength(2);
});

test('root and locked sketches reject import without changing drawing', async ({ page }) => {
  await page.locator('.sketch-item[data-id="ROOT"] .sketchActivateBtn').dblclick();
  await upload(page, dxf(line));
  await expect(page.locator('#hint')).toContainText('作図可能');
  expect((await snapshot(page)).points).toHaveLength(0);
  await page.locator('.sketch-item[data-id="S1"] .sketchActivateBtn').dblclick();
  const data = await snapshot(page);
  data.sketches.find(sketch => sketch.id === 'S1').locked = true;
  await page.evaluate(data => window.__jot2dTest.loadModelForDerivedInstanceTest(data), data);
  await upload(page, dxf(line));
  await expect(page.locator('#hint')).toContainText('作図可能');
  expect((await snapshot(page)).points).toHaveLength(0);
});

test('DXF in Block Editor belongs to its draft and supports local undo', async ({ page }) => {
  await upload(page, dxf(line));
  await expect.poll(async () => (await snapshot(page)).lines.length).toBe(1);
  await page.evaluate(() => window.__jot2dTest.openReferenceImageBlockEditorForTest({ preserveDocument: true }));
  const before = await snapshot(page);
  await upload(page, dxf(line));
  await expect.poll(async () => (await snapshot(page)).lines.length).toBe(before.lines.length + 1);
  await page.keyboard.press('Control+z');
  expect((await snapshot(page)).lines).toHaveLength(before.lines.length);
  await page.keyboard.press('Control+y');
  await page.evaluate(() => window.__jot2dTest.completeReferenceImageBlockEditorForTest());
  const result = await snapshot(page);
  expect(result.lines).toHaveLength(1);
  expect(result.blockDefinitions[0].lines).toHaveLength(before.lines.length + 1);
});
