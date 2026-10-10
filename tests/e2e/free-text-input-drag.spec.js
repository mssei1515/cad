const { test, expect, openTestDocument } = require('./test-fixture');

async function selectFirstAnnotation(page) {
  const sketch = page.locator('.sketch-item[data-id="S1"]');
  if (await sketch.getAttribute('aria-expanded') !== 'true') await sketch.locator('.sketchExpandBtn').click();
  const group = page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="annotation"]');
  if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
  await page.locator('.sketch-object-row[data-object-kind="annotation"][data-id="AN1"]').click();
}

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

for (const type of ['text', 'leader']) {
  for (const inactive of [false, true]) {
    test(`${type} expression inserts an ${inactive ? 'inactive' : 'active'} annotation parameter and persists`, async ({ page }) => {
      await fixture(page);
      const positions = await page.evaluate(({ type, inactive }) => {
        const api = window.__jot2dTest;
        const data = api.serializedModelForTest();
        const sketchId = data.activeSketchId;
        if (inactive) data.sketches.push({ id: 'NOTES', name: 'Notes', parentSketchId: sketchId, kind: 'sketch', appearance: {} });
        data.annotations = [
          { id: 'AN1', type, sketchId, x: 0, y: -45, text: '', start: { x: -30, y: -30 }, elbow: { x: -20, y: -45 }, end: { x: 0, y: -45 }, parameterEnabled: true, geometryRef: { kind: 'point', path: [data.points[0].id] }, parameterName: 'result', expression: '0' },
          { id: 'AN2', type, sketchId: inactive ? 'NOTES' : sketchId, x: 70, y: -45, text: '', start: { x: 40, y: -30 }, elbow: { x: 50, y: -45 }, end: { x: 70, y: -45 }, geometryRef: { kind: 'point', path: [data.points[0].id] }, parameterEnabled: true, parameterName: 'sourceNote', expression: '1 / 3' },
        ];
        if (type === 'leader') for (const annotation of data.annotations) {
          annotation.shelfReferenceScale = 2;
          annotation.start = { x: data.points[0].x, y: data.points[0].y };
          annotation.attachment = { kind: 'point' };
        }
        const result = api.loadDocumentFixtureForDragTest(data, 'annotation-reference.jot2d');
        if (!result.success) throw Error(JSON.stringify(result));
        api.focusWorldForTest({ x: 50, y: 0 }, 2);
        return data.annotations.map(a => api.worldClientPositionForTest(type === 'leader' ? { x: a.end.x - 10, y: a.end.y } : a));
      }, { type, inactive });
      if (type === 'leader') {
        const sketch = page.locator('.sketch-item[data-id="S1"]');
        if (await sketch.getAttribute('aria-expanded') !== 'true') await sketch.locator('.sketchExpandBtn').click();
        const group = page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="annotation"]');
        if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
        await page.locator('.sketch-object-row[data-object-kind="annotation"][data-id="AN1"]').click();
      } else await page.mouse.click(positions[0].x, positions[0].y);
      const input = page.locator('[data-property="annotation-expression"]');
      await input.fill('0');
      await input.selectText();
      await page.mouse.click(positions[1].x, positions[1].y);
      await expect(input).toBeFocused();
      await expect(input).toHaveValue('="sourceNote"');
      await input.press('Tab');
      const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
      expect(saved.annotations[0].expression).toBe('"sourceNote"');
      expect(saved.annotations[0].x).toBe(0);
      await page.click('#undoBtn');
      expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations[0].expression).toBe('0');
      await page.click('#redoBtn');
      expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'saved.jot2d'), saved)).success).toBe(true);
      expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations[0].expression).toBe('"sourceNote"');
      await selectFirstAnnotation(page);
      const precision = page.locator('[data-annotation-style="precision"]');
      await expect(precision).toHaveValue('auto');
      for (const digits of [0, 2, 10]) {
        await precision.selectOption(String(digits));
        const state = await page.evaluate(type => window.__jot2dTest.annotationAppearanceStateForTest(type), type);
        expect(state.displayedText).toBe((1 / 3).toFixed(digits));
        expect(state.serialized.expression).toBe('"sourceNote"');
      }
      await page.click('#undoBtn');
      expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations[0].style.precision).toBe(2);
      await page.click('#redoBtn');
      const rounded = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
      expect(rounded.annotations[0].style.precision).toBe(10);
      expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'rounded.jot2d'), rounded)).success).toBe(true);
      expect((await page.evaluate(type => window.__jot2dTest.annotationAppearanceStateForTest(type), type)).displayedText).toBe('0.3333333333');
      await selectFirstAnnotation(page);
      await precision.selectOption('auto');
      expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations[0].style.precision).toBeNull();

    });
  }
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
    expect((await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('text'))).displayedText).toBe('First note42');
    await page.click('#undoBtn');
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations[0].expression).toBe('0');
    await page.click('#redoBtn');
    expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'saved.jot2d'), saved)).success).toBe(true);
    expect((await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('text'))).displayedText).toBe('First note42');
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

for (const body of ['Updated note', '  Updated\nsecond line  ', '']) {
  const prefix = 'Custom prefix';
  test(`free text copies current body ${JSON.stringify(body)} on every parameter enable after reload`, async ({ page }) => {
    const positions = await fixture(page);
    await page.mouse.click(positions.notes[0].x, positions.notes[0].y);
    const enabled = page.locator('[data-property="annotation-parameter-enabled"]');
    const affix = page.locator('[data-annotation-style="prefix"]');
    await enabled.check();
    await expect(affix).toHaveValue('First note');
    await page.click('#undoBtn');
    let saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(saved.annotations[0].parameterEnabled).toBe(false);
    expect(saved.annotations[0].style.prefix || '').toBe('');
    await page.click('#redoBtn');
    await page.mouse.click(positions.notes[0].x, positions.notes[0].y);
    await expect(affix).toHaveValue('First note');
    await affix.fill(prefix);
    await affix.press('Tab');
    await enabled.uncheck();
    saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(saved.annotations[0].text).toBe(prefix);
    expect(saved.annotations[0].style.prefix).toBe(prefix);
    expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).success).toBe(true);
    await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 2));
    const point = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 0, y: -45 }));
    await page.mouse.click(point.x, point.y);
    await page.locator('[data-property="annotation-text"]').fill(body);
    await page.locator('[data-property="annotation-text"]').press('Tab');
    await enabled.check();
    await expect(affix).toHaveValue(body);
    const changed = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(changed.annotations[0].text).toBe(body);
    expect(changed.annotations[0].parameterName).toBe(saved.annotations[0].parameterName);
    expect(changed.annotations[0].expression).toBe(saved.annotations[0].expression);
    await page.click('#undoBtn');
    const undone = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(undone.annotations[0].parameterEnabled).toBe(false);
    expect(undone.annotations[0].style.prefix).toBe(prefix);
    await page.click('#redoBtn');
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).annotations[0].style.prefix).toBe(body);
  });
}
