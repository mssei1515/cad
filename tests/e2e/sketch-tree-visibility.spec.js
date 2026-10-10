const { test, expect, openTestDocument } = require('./test-fixture');
const state = page => page.evaluate(() => { const data = window.__jot2dTest.serializedModelForTest(); delete data.savedAt; return data; });
async function expand(page, category) {
  const sketch = page.locator('.sketch-item[data-id="S1"]');
  if (await sketch.getAttribute('aria-expanded') !== 'true') await sketch.locator('.sketchExpandBtn').click();
  const group = page.locator(`.sketch-group-row[data-sketch-id="S1"][data-category="${category}"]`);
  if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
}
async function fixture(page, category, locked = false) {
  await openTestDocument(page);
  if (category === 'block') await page.evaluate(() => window.__jot2dTest.resetForBlockClipboardTest());
  else if (category === 'spline') {
    const fixture = await page.evaluate(() => window.__jot2dTest.resetForSplineTest());
    await page.locator('#toolSpline').click();
    for (const point of fixture.clients) await page.mouse.click(point.x, point.y);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  }
  else if (category === 'hatch') {
    const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
    await page.locator('#toolHatch').click();
    await page.mouse.click(fixture.client.x, fixture.client.y);
    await page.locator('#commandPanel [data-action="finish"]').click();
    await page.keyboard.press('Escape');
  }
  else if (category === 'dimension') await page.evaluate(() => window.__jot2dTest.resetForReadOnlyDuplicateDimension());
  else if (category === 'instance') {
    await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
    const data = await state(page);
    data.geometryInstances = [{ id: 'FI1', type: 'free', sketchId: 'S1', sources: [{ kind: 'line', path: [data.lines[0].id] }], origin: { x: 0, y: 0 }, x: 100, y: 100, rotation: 0, mirrorX: false, mirrorY: false, appearanceOverride: {} }];
    await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), data);
  } else await page.evaluate(() => window.__jot2dTest.resetForSidebarInspection());
  const data = await state(page);
  data.sketches.find(sketch => sketch.id === 'S1').locked = locked;
  if (!data.sketches.some(sketch => sketch.id === 'S2')) data.sketches.push({ id: 'S2', name: 'Other', kind: 'sketch', parentSketchId: 'ROOT' });
  data.activeSketchId = 'S2';
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'visibility.jot2d', { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
  await expand(page, category);
  return page.locator(`.sketch-object-row[data-sketch-id="S1"][data-object-kind="${category === 'dimension' ? 'constraint' : category}"]`).first();
}

for (const category of ['point', 'line', 'circle', 'arc', 'spline', 'hatch', 'block', 'instance', 'dimension']) {
  test(`${category} tree and toolbar visibility share state, history and persistence`, async ({ page }) => {
    const row = await fixture(page, category);
    const before = await state(page);
    const eye = row.locator('.objectVisibilityBtn'), toolbar = page.locator('#selectionVisibilityBtn');
    await eye.click();
    await expect(eye).toHaveAttribute('aria-pressed', 'false');
    await expect(row).toHaveClass(/selected/);
    await expect(toolbar).toBeEnabled();
    await expect(toolbar).toHaveAttribute('aria-pressed', 'true');
    const hidden = await state(page);
    expect(hidden.activeSketchId).toBe('S2');
    await page.locator('#undoBtn').click();
    expect(await state(page)).toEqual(before);
    await page.locator('#redoBtn').click();
    expect(await state(page)).toEqual(hidden);
    await row.locator('.sketch-object-content').click();
    await toolbar.click();
    await expect(eye).toHaveAttribute('aria-pressed', 'true');
    await toolbar.click();
    expect(await state(page)).toEqual(hidden);
    expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), hidden)).toMatchObject({ success: true });
    await expand(page, category);
    await expect(eye).toHaveAttribute('aria-pressed', 'false');
    await eye.click();
    await expect(eye).toHaveAttribute('aria-pressed', 'true');
  });
  test(`${category} visibility respects its owner lock`, async ({ page }) => {
    const row = await fixture(page, category, true);
    await expect(row.locator('.objectVisibilityBtn')).toBeDisabled();
    await row.locator('.sketch-object-content').click();
    await expect(page.locator('#selectionVisibilityBtn')).toBeDisabled();
  });
}

test('toolbar applies visibility to mixed geometry and multiple dimensions in one history step', async ({ page }) => {
  await fixture(page, 'dimension');
  const before = await state(page);
  const dimensions = page.locator('.sketch-object-row[data-constraint-index] .sketch-object-content');
  await dimensions.nth(0).click();
  await dimensions.nth(1).click({ modifiers: ['Control'] });
  await expand(page, 'line');
  await page.locator('.sketch-object-row[data-object-kind="line"] .sketch-object-content').first().click({ modifiers: ['Control'] });
  await page.locator('#selectionVisibilityBtn').click();
  const hidden = await state(page);
  expect(hidden.constraints.filter(item => item.dimension).every(item => item.dimension.display.visible === false)).toBe(true);
  expect(hidden.lines[0].appearance.visible).toBe(false);
  const semantics = data => data.constraints.map(({ dimension, ...constraint }) => constraint);
  expect(semantics(hidden)).toEqual(semantics(before));
  await page.locator('#undoBtn').click();
  expect(await state(page)).toEqual(before);
});

test('hatch-only derived instance visibility uses the inherited source state', async ({ page }) => {
  await fixture(page, 'hatch');
  const data = await state(page);
  data.hatches[0].appearance.visible = false;
  data.geometryInstances = [{ id: 'FI1', type: 'free', sketchId: 'S1', sources: [{ kind: 'hatch', path: [data.hatches[0].id] }], origin: { x: 0, y: 0 }, x: 100, y: 100, rotation: 0, mirrorX: false, mirrorY: false, appearanceOverride: {} }];
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), data)).toMatchObject({ success: true });
  await expand(page, 'instance');
  const eye = page.locator('.sketch-object-row[data-object-kind="instance"] .objectVisibilityBtn');
  await expect(eye).toHaveAttribute('aria-pressed', 'false');
  await eye.click();
  await expect(eye).toHaveAttribute('aria-pressed', 'true');
  const shown = await state(page);
  expect(shown.geometryInstances[0].appearanceOverride.visible).toBe(true);
  expect(shown.hatches[0].appearance.visible).toBe(false);
});

test('constraint and reference dimensions appear only in the Dimension category', async ({ page }) => {
  await fixture(page, 'dimension');
  const data = await state(page);
  const dimensions = data.constraints.filter(constraint => constraint.dimension);
  expect(dimensions.some(constraint => constraint.readOnlyDimension)).toBe(true);
  await expect(page.locator('.sketch-group-row[data-category="dimension"] .sketch-group-label')).toHaveText('寸法');
  await expect(page.locator('.sketch-object-row[data-constraint-index]')).toHaveCount(dimensions.length);
  const ordinary = page.locator('.sketch-group-row[data-category="constraint"]');
  if (await ordinary.count()) {
    await ordinary.click();
    const indices = await page.locator('.sketch-object-row[data-constraint-index]').evaluateAll(rows => rows.map(row => Number(row.dataset.constraintIndex)));
    expect(indices).toHaveLength(new Set(indices).size);
  }
});

test('toolbar toggles a selected non-drawing sketch, including a locked sketch, and excludes Root and drawing sketch', async ({ page }) => {
  await fixture(page, 'line', true);
  const source = page.locator('.sketch-item[data-id="S1"]');
  await source.locator('.sketchActivateBtn').click();
  const toolbar = page.locator('#selectionVisibilityBtn');
  await expect(toolbar).toBeEnabled();
  await toolbar.click();
  await expect(source.locator('.sketchVisibilityBtn')).toHaveAttribute('aria-pressed', 'false');
  await toolbar.click();
  await expect(source.locator('.sketchVisibilityBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.sketch-item[data-id="S2"] .sketchActivateBtn').click();
  await expect(toolbar).toBeDisabled();
  await page.locator('.sketch-item[data-id="ROOT"] .sketchActivateBtn').click();
  await expect(toolbar).toBeDisabled();
});
