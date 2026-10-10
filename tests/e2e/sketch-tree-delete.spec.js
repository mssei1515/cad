const { test, expect, openTestDocument } = require('./test-fixture');

const state = page => page.evaluate(() => {
  const data = window.__jot2dTest.serializedModelForTest();
  delete data.savedAt;
  return data;
});

async function fixture(page, category, locked = false) {
  await openTestDocument(page);
  if (category === 'block') await page.evaluate(() => window.__jot2dTest.resetForBlockClipboardTest());
  else if (category === 'hatch') {
    const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
    await page.locator('#toolHatch').click();
    await page.mouse.click(fixture.client.x, fixture.client.y);
    await page.locator('#commandPanel [data-action="finish"]').click();
    await page.keyboard.press('Escape');
  } else await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  const data = await state(page);
  if (category === 'instance') data.geometryInstances = [{ id: 'FI1', type: 'free', sketchId: 'S1', sources: [{ kind: 'line', path: [data.lines[0].id] }], origin: { x: 0, y: 0 }, x: 100, y: 100, rotation: 0, mirrorX: false, mirrorY: false, appearanceOverride: {} }];
  data.sketches.find(sketch => sketch.id === 'S1').locked = locked;
  if (!data.sketches.some(sketch => sketch.id === 'S2')) data.sketches.push({ id: 'S2', name: 'Other', kind: 'sketch', parentSketchId: 'ROOT' });
  data.activeSketchId = 'S2';
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'tree-delete.jot2d', { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
  await page.locator('.sketch-item[data-id="S1"] .sketchExpandBtn').click();
  await page.locator(`.sketch-group-row[data-sketch-id="S1"][data-category="${category}"]`).click();
}

for (const [category, field, buttonClass] of [['block', 'blockInstances', 'removeBlockBtn'], ['hatch', 'hatches', 'removeHatchBtn'], ['instance', 'geometryInstances', 'removeInstanceBtn']]) {
  test(`${category} tree delete preserves sources and drawing destination and supports Undo/Redo`, async ({ page }) => {
    await fixture(page, category);
    const before = await state(page);
    await page.locator(`.sketch-object-row[data-object-kind="${category}"] .${buttonClass}`).click();
    const after = await state(page);
    expect(after[field]).toHaveLength(0);
    expect(after.activeSketchId).toBe('S2');
    // Deletion compacts drawing-order numbers; geometry and relative line order remain intact.
    const lineGeometry = lines => lines.map(({ drawingOrder, ...line }) => line);
    expect(lineGeometry(after.lines)).toEqual(lineGeometry(before.lines));
    expect(after.points).toEqual(before.points);
    expect(after.blockDefinitions).toEqual(before.blockDefinitions);
    await page.keyboard.press('Control+z');
    expect(await state(page)).toEqual(before);
    await page.keyboard.press('Control+y');
    expect(await state(page)).toEqual(after);
  });
  test(`${category} tree delete is disabled for a locked owner`, async ({ page }) => {
    await fixture(page, category, true);
    await expect(page.locator(`.sketch-object-row[data-object-kind="${category}"] .${buttonClass}`)).toBeDisabled();
  });
}

test('tree hatch deletion retains the existing dependency guard', async ({ page }) => {
  await fixture(page, 'hatch');
  const data = await state(page);
  data.geometryInstances = [{ id: 'FI1', type: 'free', sketchId: 'S1', sources: [{ kind: 'hatch', path: [data.hatches[0].id] }], origin: { x: 0, y: 0 }, x: 100, y: 100, rotation: 0, mirrorX: false, mirrorY: false, appearanceOverride: {} }];
  const result = await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), data);
  expect(result.success, JSON.stringify(result)).toBe(true);
  await page.locator('.sketch-item[data-id="S1"] .sketchExpandBtn').click();
  await page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="hatch"]').click();
  const before = await state(page);
  await page.locator('.removeHatchBtn').click();
  expect(await state(page)).toEqual(before);
  await expect(page.locator('.removeHatchBtn')).toBeVisible();
});

test('empty leaf sketch delete skips confirmation and supports Undo and Redo', async ({ page }) => {
  await openTestDocument(page);
  await page.locator('#addSketchBtn').click();
  const row = page.locator('.sketch-item[data-id="S1"]');
  const before = await state(page);
  let dialogs = 0;
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
  await row.locator('.sketchDeleteBtn').click();
  await expect(row).toHaveCount(0);
  expect(dialogs).toBe(0);
  await page.keyboard.press('Control+z');
  expect(await state(page)).toEqual(before);
  await page.keyboard.press('Control+y');
  await expect(row).toHaveCount(0);
});

test('wide chevron opens at its edge; sketch delete confirms, respects locks, and supports Undo', async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.locator('#addSketchBtn').click();
  const row = page.locator('.sketch-item[data-id="S1"]');
  const expand = row.locator('.sketchExpandBtn');
  await expect(expand).toHaveCSS('width', '24px');
  await expand.click({ position: { x: 1, y: 9 } });
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(row).not.toHaveClass(/selected/);
  await expand.click({ position: { x: 23, y: 9 } });
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  const before = await state(page);
  page.once('dialog', dialog => dialog.dismiss());
  await row.locator('.sketchDeleteBtn').click();
  expect(await state(page)).toEqual(before);
  await row.locator('.sketchLockBtn').click();
  await expect(row.locator('.sketchDeleteBtn')).toBeDisabled();
  await row.locator('.sketchLockBtn').click();
  page.once('dialog', dialog => dialog.accept());
  await row.locator('.sketchDeleteBtn').click();
  await expect(row).toHaveCount(0);
  expect((await state(page)).activeSketchId).toBe('S2');
  await page.keyboard.press('Control+z');
  expect(await state(page)).toEqual(before);
});
