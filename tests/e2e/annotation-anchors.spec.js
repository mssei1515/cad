const { test, expect, openTestDocument } = require('./test-fixture');
const data = page => page.evaluate(() => window.__jot2dTest.serializedModelForTest());
const state = (page, type = 'text') => page.evaluate(type => window.__jot2dTest.annotationAppearanceStateForTest(type), type);
async function clickWorld(page, point) {
  const client = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), point);
  await page.mouse.click(client.x, client.y);
}
async function setup(page) {
  await openTestDocument(page);
  await page.evaluate(() => { window.__jot2dTest.resetForReadOnlyDuplicateDimension(); window.__jot2dTest.focusWorldForTest({ x: 30, y: 0 }, 3); });
}
async function create(page, leader = false) {
  await page.locator('#annotationTextBtn').click();
  await page.locator('#commandPanel [data-setting=withLeader]').setChecked(leader);
  await page.locator('#commandPanel [data-setting=text]').fill('AB\nC');
  await page.locator('#commandPanel .command-panel-settings-group summary').click();
  await page.locator('#commandPanel input[data-setting=anchorPosition][value=right-top]').check();
  await page.locator('#commandPanel [data-setting="style.framePaddingX"]').fill('2');
  await page.locator('#commandPanel [data-setting="style.framePaddingX"]').press('Tab');
  await page.locator('#commandPanel [data-setting="style.framePaddingY"]').fill('1');
  await page.locator('#commandPanel [data-setting="style.framePaddingY"]').press('Tab');
  if (leader) { await clickWorld(page, { x: 0, y: 0 }); await clickWorld(page, { x: 35, y: -25 }); await clickWorld(page, { x: 65, y: -25 }); }
  else await clickWorld(page, { x: 50, y: -30 });
  await page.locator('#commandPanel [data-action=finish]').click();
}
test('nine anchor choices preserve placement independently of multiline alignment and frame settings', async ({ page }) => {
  await setup(page); expect((await data(page)).defaultLeaderAppearance.textHeight).toBe(5);
  await create(page);
  const first = await state(page), anchor = { x: first.textLayout.anchorX, y: first.textLayout.anchorY };
  expect(first.serialized).toMatchObject({ anchorPosition: 'right-top', style: { framePaddingX: 2, framePaddingY: 1 } });
  await expect(page.locator('.annotation-anchor-grid input[data-property=annotation-anchor-position]')).toHaveCount(9);
  for (const position of ['left-top', 'center-top', 'right-top', 'left-middle', 'center-middle', 'right-middle', 'left-bottom', 'center-bottom', 'right-bottom']) {
    await page.locator(`input[data-property=annotation-anchor-position][value="${position}"]`).check();
    const item = await state(page); expect(item.textLayout.anchorX).toBeCloseTo(anchor.x, 8); expect(item.textLayout.anchorY).toBeCloseTo(anchor.y, 8);
  }
  await page.locator('#annotationTextAlign').selectOption('center');
  await page.locator('#annotationFrameVisible').selectOption('true');
  await page.locator('#annotationFrameLineType').selectOption('dashed');
  await page.locator('#annotationFrameColor').fill('#ff0000'); await page.locator('#annotationFrameColor').press('Tab');
  await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'jot2d-annotation-anchor-preview.png') });
  const saved = await data(page); expect(saved.version).toBe(25);
  expect(saved.annotations[0].style).toMatchObject({ textAlign: 'center', frameVisible: true, frameLineType: 'dashed', frameColor: '#ff0000' });
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  const loaded = await state(page); expect(loaded.textLayout.anchorX).toBeCloseTo(anchor.x, 8); expect(loaded.textLayout.anchorY).toBeCloseTo(anchor.y, 8);
  const labels = await page.evaluate(p => window.__jot2dTest.snapLabelsAtWorldForTest(p), anchor);
  expect(labels.some(label => label.includes('注記基準点') || label.includes('Annotation anchor'))).toBe(true);
});
test('coincidence follows a geometry point, preserves geometry and supports history, reload and removal', async ({ page }) => {
  await setup(page); await create(page);
  const before = await data(page), target = before.points.find(point => point.id === before.lines[0].p2);
  await page.locator('[data-constraint=coincident]').click(); await clickWorld(page, target);
  await expect(page.locator('#commandPanel')).toHaveAttribute('data-command', 'annotation-anchor-constraint');
  await page.locator('#commandPanel [data-action=finish]').click();
  const constrained = await data(page); expect(constrained.points).toEqual(before.points);
  expect(constrained.annotations[0].anchorConstraints[0]).toMatchObject({ type: 'coincident', geometryRef: { kind: 'point', path: [target.id] } });
  expect((await state(page)).textLayout.anchorX).toBeCloseTo(target.x, 8);
  await page.locator('#undoBtn').click(); expect((await data(page)).annotations[0].anchorConstraints).toBeUndefined();
  await page.locator('#redoBtn').click(); expect((await data(page)).annotations[0].anchorConstraints).toHaveLength(1);
  const moved = structuredClone(constrained); const point = moved.points.find(p => p.id === target.id); point.x += 12; point.y += 7;
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), moved)).success).toBe(true);
  const reloaded = await state(page); expect(reloaded.textLayout.anchorX).toBeCloseTo(point.x, 8); expect(reloaded.textLayout.anchorY).toBeCloseTo(point.y, 8);
  await clickWorld(page, { x: reloaded.textLayout.x + reloaded.textLayout.width / 2, y: reloaded.textLayout.y });
  await page.locator('[data-property-action=annotation-anchor-clear]').click();
  expect((await data(page)).annotations[0].anchorConstraints).toBeUndefined();
  expect((await state(page)).textLayout.anchorX).toBeCloseTo(point.x, 8);
});
test('horizontal and vertical distance constraints control separate axes and reject duplicate axes', async ({ page }) => {
  await setup(page); await create(page);
  const before = await data(page), target = before.points.find(point => point.id === before.lines[0].p2);
  await page.locator('[data-constraint=horizontal]').click(); await clickWorld(page, target); await page.locator('#commandPanel [data-action=finish]').click();
  expect((await state(page)).textLayout.anchorY).toBeCloseTo(0, 8);
  await page.locator('[data-constraint=distance]').click(); await clickWorld(page, target);
  await page.locator('#commandPanel [data-setting=axis]').selectOption('x');
  await page.locator('#commandPanel [data-setting=value]').fill('25'); await page.locator('#commandPanel [data-setting=value]').press('Tab');
  await page.locator('#commandPanel [data-action=finish]').click();
  expect((await state(page)).textLayout.anchorX).toBeCloseTo(target.x + 25, 8);
  await page.locator('[data-constraint=vertical]').click(); await clickWorld(page, target); await page.locator('#commandPanel [data-action=finish]').click();
  expect((await data(page)).annotations[0].anchorConstraints).toHaveLength(2);
  await expect(page.locator('#commandPanel')).toBeVisible(); await page.locator('#commandPanel [data-action=cancel]').click();
});
test('fixed anchor stays fixed through text edits and both text and leader anchors survive save', async ({ page }) => {
  await setup(page); await create(page, true);
  const before = await state(page, 'leader');
  await page.locator('#fixPointBtn').click();
  await page.locator('[data-property=annotation-text]').fill('A much longer label\nSecond row'); await page.locator('[data-property=annotation-text]').press('Tab');
  const after = await state(page, 'leader'); expect(after.textLayout.anchorX).toBeCloseTo(before.textLayout.anchorX, 8); expect(after.textLayout.anchorY).toBeCloseTo(before.textLayout.anchorY, 8);
  const saved = await data(page); expect(saved.annotations[0].anchorConstraints[0].type).toBe('fixed');
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  expect((await state(page, 'leader')).textLayout).toEqual(after.textLayout);
});
test('leader arrow and text anchor follow separate geometry targets', async ({ page }) => {
  await setup(page);
  const seed = await data(page); seed.points.push({ id: 'P99', x: 80, y: 20, kind: 'explicit', sketchId: 'S1', construction: false });
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), seed)).success).toBe(true);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 30, y: 0 }, 3));
  await create(page, true);
  await page.locator('[data-constraint=coincident]').click(); await clickWorld(page, { x: 80, y: 20 }); await page.locator('#commandPanel [data-action=finish]').click();
  const before = await state(page, 'leader'), moved = await data(page);
  moved.constraints = []; moved.points.filter(point => point.id !== 'P99').forEach(point => { point.x += 20; point.y += 10; });
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), moved)).success).toBe(true);
  const after = await state(page, 'leader'); expect(after.resolvedStart.x - before.resolvedStart.x).toBeCloseTo(20, 8);
  expect(after.textLayout.anchorX).toBeCloseTo(80, 8); expect(after.textLayout.anchorY).toBeCloseTo(20, 8);
  moved.points.find(point => point.id === 'P99').x = 100;
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), moved)).success).toBe(true);
  expect((await state(page, 'leader')).textLayout.anchorX).toBeCloseTo(100, 8);
});
