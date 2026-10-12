const { test, expect, openTestDocument } = require('./test-fixture');
async function setup(page) {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  const data = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest().serialized);
  data.version = 25;
  const sketchId = data.activeSketchId;
  data.points = [{ id: 'P1', x: 20, y: 10, fixed: true, kind: 'explicit', sketchId }, { id: 'P2', x: 40, y: 10, fixed: true, kind: 'endpoint', sketchId }];
  data.lines = [{ id: 'L1', p1: 'P1', p2: 'P2', construction: false, sketchId }]; data.geometryInstances = [];
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d, 'unified.jot2d', { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
  return errors;
}
async function click(page, point) { const p = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), point); await page.mouse.click(p.x, p.y); }
const saved = page => page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest().serialized);
test('unified linear creation, midpoint anchor, total count and round trip', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolFreeInstance'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="destination"]').click(); await click(page, { x: 30, y: 40 });
  await page.locator('#commandPanel [data-setting="count"]').fill('3'); await page.locator('#commandPanel [data-setting="count"]').press('Tab');
  await page.locator('#commandPanel [data-action="finish"]').click();
  const data = await saved(page), instance = data.geometryInstances[0];
  expect(instance).toMatchObject({ type: 'free', count: 3, reflected: false, rotationLocked: true, placement: { kind: 'linear' }, anchor: { relation: { kind: 'lineMidpoint' } } });
  expect(data.version).toBe(26);
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), data)).toMatchObject({ success: true });
  expect((await saved(page)).geometryInstances).toEqual(data.geometryInstances); expect(errors).toEqual([]);
});
test('circular creation has no destination input and preserves signed angle intervals', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolFreeInstance'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 20, y: 10 });
  await page.locator('#commandPanel [data-setting="placement"]').selectOption('circular');
  await expect(page.locator('#commandPanel [data-input="destination"]')).toHaveCount(0);
  await page.locator('#commandPanel [data-setting="angleStep"]').fill('-90'); await page.locator('#commandPanel [data-setting="angleStep"]').press('Tab');
  await page.locator('#commandPanel [data-action="finish"]').click();
  expect((await saved(page)).geometryInstances[0].placement).toMatchObject({ kind: 'circular', angleMode: 'numeric', angleSign: -1 });
  expect(errors).toEqual([]);
});
test('direct interval dimension switches control, edits signed values and round trips', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolFreeInstance'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 20, y: 10 });
  await page.locator('#commandPanel [data-setting="placement"]').selectOption('circular');
  await page.locator('#commandPanel [data-action="finish"]').click();
  await page.click('[data-property-action="instance-angle-dimension"]'); await click(page, { x: 60, y: -10 });
  await page.locator('#dimensionValueInput').fill('-90'); await page.locator('#dimensionValueInput').press('Enter');
  let data = await saved(page);
  expect(errors).toEqual([]);
  expect(data.geometryInstances[0].placement, await page.locator('#hint').textContent()).toMatchObject({ angleMode: 'constraint', angleSign: -1 });
  expect(data.constraints.find(c => c.type === 'instanceAngleInterval').target).toBeCloseTo(-Math.PI / 2);
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), data)).toMatchObject({ success: true });
  expect((await saved(page)).constraints.find(c => c.type === 'instanceAngleInterval').target).toBeCloseTo(-Math.PI / 2);
  const id = data.geometryInstances[0].id;
  const deleted = await page.evaluate(id => window.__jot2dTest.deleteDerivedInstanceForTest(id), id);
  expect(deleted.deleted).toBe(true);
  expect((await saved(page)).constraints.some(c => c.type === 'instanceAngleInterval')).toBe(false);
  expect(errors).toEqual([]);
});
test('numeric offset constraints persist and source anchor replacement recalculates the array', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolFreeInstance'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 30, y: 10 });
  for (const [axis, value] of [['X', '0'], ['Y', '30']]) {
    const input = page.locator(`#commandPanel [data-setting="offset${axis}"]`); await input.fill(value); await input.press('Tab');
  }
  await page.locator('#commandPanel [data-action="finish"]').click();
  const before = await saved(page); expect(before.constraints.filter(c => c.type === 'instanceAxisOffset')).toHaveLength(2);
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), before)).toMatchObject({ success: true });
  expect((await saved(page)).constraints.filter(c => c.type === 'instanceAxisOffset')).toHaveLength(2);
  expect(errors).toEqual([]);
});
test('anchor edits recalculate all copies and referenced copies cannot be removed', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolFreeInstance'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="destination"]').click(); await click(page, { x: 30, y: 40 });
  const count = page.locator('#commandPanel [data-setting="count"]'); await count.fill('3'); await count.press('Tab');
  await page.locator('#commandPanel [data-action="finish"]').click();
  await page.click('[data-property-action="instance-anchor"]'); await click(page, { x: 20, y: 10 });
  await page.locator('#commandPanel [data-action="finish"]').click();
  let data = await saved(page); expect(data.geometryInstances[0].x).toBe(30); expect(data.geometryInstances[0].y).toBe(40);
  const state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  expect(state.instances[0].lines.map(line => line.p1.x)).toEqual([30, 40]);
  const id = data.geometryInstances[0].id;
  data.constraints.push({ type: 'horizontal', line: id + '@2@L1', enabled: true, sketchId: data.activeSketchId });
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), data)).toMatchObject({ success: true });
  await click(page, { x: 40, y: 40 });
  const property = page.locator('[data-free-instance-property="count"]'); await property.fill('2'); await property.press('Tab');
  expect((await saved(page)).geometryInstances[0].count).toBe(3);
  expect(errors).toEqual([]);
});
test('circular to linear needs a destination; interval input survives switching back', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolFreeInstance'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 20, y: 10 });
  const mode = page.locator('#commandPanel [data-setting="placement"]'); await mode.selectOption('circular');
  const angle = page.locator('#commandPanel [data-setting="angleStep"]'); await angle.fill('45'); await angle.press('Tab');
  await page.screenshot({ path: 'C:/dev/unified-instance-preview.png' });
  await mode.selectOption('linear'); await expect(page.locator('#commandPanel [data-action="finish"]')).toBeDisabled();
  await mode.selectOption('circular'); await expect(angle).toHaveValue('45'); await page.locator('#commandPanel [data-action="finish"]').click();
  await page.click('[data-property-action="instance-placement"]'); await mode.selectOption('linear');
  await expect(page.locator('#commandPanel [data-action="finish"]')).toBeDisabled();
  await page.locator('#commandPanel ul[data-input="destination"]').click(); await click(page, { x: 70, y: 10 });
  await page.locator('#commandPanel [data-action="finish"]').click(); expect((await saved(page)).geometryInstances[0].placementPointDefined).toBe(true);
  expect(errors).toEqual([]);
});
test('real drawing migrates old placement relations without changing generated IDs through saving', async ({ page }) => {
  const fs = require('node:fs'), path = require('node:path');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/thread-length.jot2d'), 'utf8'));
  const errors = []; page.on('pageerror', error => errors.push(error.message)); await openTestDocument(page);
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), data)).toMatchObject({ success: true });
  const normalized = await saved(page), source = normalized.lines.find(line => line.sketchId === normalized.activeSketchId);
  const direction = normalized.lines.find(line => line.sketchId === source.sketchId && line.id !== source.id);
  expect(direction).toBeTruthy(); normalized.version = 25;
  normalized.geometryInstances.push({ id: 'FI97', type: 'free', sketchId: source.sketchId, sources: [{ kind: 'line', path: [source.id] }], x: 75, y: 50, rotation: .3, origin: { x: 10, y: 20 }, mirrorX: false, mirrorY: true, appearanceOverride: {} },
    { id: 'MI97', type: 'mirror', sketchId: source.sketchId, sources: [{ kind: 'line', path: [source.id] }], axis: { kind: 'line', path: [direction.id] }, appearanceOverride: {} },
    { id: 'PI97', type: 'pattern', sketchId: source.sketchId, sources: [{ kind: 'line', path: [source.id] }], direction: { kind: 'line', path: [direction.id] }, spacing: 20, copies: 2, reversed: false, appearanceOverride: {} });
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), normalized)).toMatchObject({ success: true });
  const before = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest()); expect(before.instances.every(i => i.valid)).toBe(true);
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), before.serialized)).toMatchObject({ success: true });
  const after = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest()); expect(after.instances).toEqual(before.instances);
  expect(after.serialized.geometryInstances.every(i => i.type === 'free' || i.type === 'sketchProjection')).toBe(true);
  expect(errors).toEqual([]);
});
test('source editing can replace an anchor reference atomically with a copied helper point', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolFreeInstance'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="destination"]').click(); await click(page, { x: 30, y: 40 });
  await page.locator('#commandPanel [data-action="finish"]').click(); const before = await saved(page);
  await page.click('[data-property-action="instance-sources"]'); await click(page, { x: 30, y: 10 });
  await click(page, { x: 40, y: 10 }); await expect(page.locator('#commandPanel [data-action="finish"]')).toBeDisabled();
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 40, y: 10 });
  await page.locator('#commandPanel [data-action="finish"]').click();
  const after = await saved(page); expect(after.geometryInstances[0].sources).toEqual([{ kind: 'point', path: ['P2'] }]);
  expect(after.geometryInstances[0].anchor.relation).toEqual({ kind: 'point', target: { kind: 'point', path: ['P2'] } });
  await page.click('#undoBtn'); expect((await saved(page)).geometryInstances).toEqual(before.geometryInstances);
  await page.click('#redoBtn'); expect((await saved(page)).geometryInstances).toEqual(after.geometryInstances);
  expect(errors).toEqual([]);
});
