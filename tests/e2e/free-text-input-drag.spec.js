const { test, expect, openTestDocument } = require('./test-fixture');

async function fixture(page, inactiveDimensions = false) {
  await openTestDocument(page);
  return page.evaluate(inactive => {
    const api = window.__jot2dTest;
    api.resetForParameterTest();
    const data = api.serializedModelForTest();
    if (inactive) {
      data.sketches.push({ id: 'NOTES', name: 'Notes', parentSketchId: data.activeSketchId, kind: 'sketch', appearance: {} });
      data.activeSketchId = 'NOTES';
    }
    data.annotations = [
      { id: 'AN1', type: 'text', sketchId: data.activeSketchId, x: 0, y: -45, text: 'First note' },
      { id: 'AN2', type: 'text', sketchId: data.activeSketchId, x: 70, y: -45, text: 'Second note' },
    ];
    const result = api.loadDocumentFixtureForDragTest(data, 'free-text.jot2d');
    if (!result.success) throw Error(JSON.stringify(result));
    api.focusWorldForTest({ x: 50, y: 0 }, 2);
    return {
      dimension: api.dimensionClientPositionForTest(1),
      name: api.serializedModelForTest().constraints.filter(c => c.dimension)[1].parameterName,
      notes: data.annotations.map(a => api.worldClientPositionForTest(a)),
    };
  }, inactiveDimensions);
}

for (const inactive of [false, true]) {
  test(`free text formula inserts a ${inactive ? 'inactive' : 'active'} Sketch dimension at the caret`, async ({ page }) => {
    const positions = await fixture(page, inactive);
    await page.mouse.click(positions.notes[0].x, positions.notes[0].y);
    await page.locator('[data-property="annotation-parameter-enabled"]').check();
    const input = page.locator('[data-property="annotation-expression"]');
    await input.fill('= + 2');
    await input.evaluate(el => el.setSelectionRange(1, 1));
    await page.mouse.click(positions.dimension.x, positions.dimension.y);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(`="${positions.name}" + 2`);
    await input.press('Tab');
    const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(saved.annotations[0].expression).toBe(`"${positions.name}" + 2`);
    expect((await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('text'))).displayedText).toBe('42');
    await page.click('#undoBtn');
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations[0].expression).toBe('0');
    await page.click('#redoBtn');
    expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'saved.jot2d'), saved)).success).toBe(true);
    expect((await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('text'))).displayedText).toBe('42');
  });
}

test('selected free texts drag together and undo/redo preserves both positions', async ({ page }) => {
  const positions = await fixture(page);
  await page.mouse.click(positions.notes[0].x, positions.notes[0].y);
  await page.keyboard.down('Control');
  await page.mouse.click(positions.notes[1].x, positions.notes[1].y);
  await page.keyboard.up('Control');
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  await page.mouse.move(positions.notes[0].x, positions.notes[0].y);
  await page.mouse.down();
  await page.mouse.move(positions.notes[0].x + 40, positions.notes[0].y - 20, { steps: 8 });
  await page.mouse.up();
  const after = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  for (let i = 0; i < 2; i++) {
    expect(after.annotations[i].x - before.annotations[i].x).toBeCloseTo(20);
    expect(after.annotations[i].y - before.annotations[i].y).toBeCloseTo(-10);
  }
  expect(after.points).toEqual(before.points);
  await expect(page.locator('[data-bulk-property="color"]')).toBeVisible();
  await page.click('#undoBtn');
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations).toEqual(before.annotations);
  await page.click('#redoBtn');
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations).toEqual(after.annotations);
});

test('multiple free texts size lock captures zoom with one undo and persists', async ({ page }) => {
  const positions = await fixture(page);
  await page.mouse.click(positions.notes[0].x, positions.notes[0].y);
  await page.keyboard.down('Control');
  await page.mouse.click(positions.notes[1].x, positions.notes[1].y);
  await page.keyboard.up('Control');
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  await page.locator('[data-bulk-property="modelRelativeSize"]').check();
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  for (const item of saved.annotations) {
    expect(item.style.fixedDisplaySize).toBe(false);
    expect(item.style.displayScale).toBeCloseTo(2 / (96 / 25.4));
  }
  await page.click('#undoBtn');
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations).toEqual(before.annotations);
  await page.click('#redoBtn');
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations).toEqual(saved.annotations);
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved);
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations).toEqual(saved.annotations);
});
