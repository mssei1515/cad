const { test, expect, openTestDocument } = require('./test-fixture');
const data = page => page.evaluate(() => window.__jot2dTest.serializedModelForTest());
const state = (page, type = 'text') => page.evaluate(type => window.__jot2dTest.annotationAppearanceStateForTest(type), type);

for (const [command, kind, expected] of [['coincident', 'circle', 'on-circle'], ['concentric', 'circle', 'concentric'], ['coincident', 'spline', 'on-spline']]) test(`${command} accepts an annotation anchor and ${kind}, including reload`, async ({ page }) => {
  await setup(page); await create(page);
  const seed = await data(page), ids = ['P91', 'P92', 'P93'];
  seed.points.push(...ids.map((id, i) => ({ id, x: -20 + i * 20, y: 20, kind: 'explicit', sketchId: 'S1', construction: false })));
  if (kind === 'circle') seed.circles.push({ id: 'C91', center: ids[1], radius: 10, sketchId: 'S1', construction: false });
  else seed.splines.push({ id: 'SP91', definitionMode: 'fit', degree: 3, fitPoints: ids, endCondition: 'natural', closed: false, sketchId: 'S1', construction: false });
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), seed)).success).toBe(true);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 30, y: 0 }, 3));
  const first = await state(page); await clickWorld(page, { x: first.textLayout.anchorX, y: first.textLayout.anchorY });
  const before = await data(page);
  await page.locator(`[data-constraint=${command}]`).click(); await clickWorld(page, { x: 10, y: 20 });
  const result = await state(page); expect(result.serialized.anchorConstraints[0].type).toBe(expected);
  if (expected === 'concentric') { expect(result.textLayout.anchorX).toBeCloseTo(0, 6); expect(result.textLayout.anchorY).toBeCloseTo(20, 6); }
  else if (kind === 'circle') expect(Math.hypot(result.textLayout.anchorX, result.textLayout.anchorY - 20)).toBeCloseTo(10, 6);
  else expect(result.textLayout.anchorY).toBeCloseTo(20, 6);
  const saved = await data(page); expect(saved.points).toEqual(before.points); expect(saved.circles).toEqual(before.circles); expect(saved.splines).toEqual(before.splines);
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  const loaded = await state(page); expect(loaded.textLayout.anchorX).toBeCloseTo(result.textLayout.anchorX, 6); expect(loaded.textLayout.anchorY).toBeCloseTo(result.textLayout.anchorY, 6);
});
async function clickWorld(page, point) {
  const client = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), point);
  await page.mouse.click(client.x, client.y);
}
async function dragWorld(page, start, end) {
  const positions = await page.evaluate(([a, b]) => [a, b].map(p => window.__jot2dTest.worldClientPositionForTest(p)), [start, end]);
  await page.mouse.move(positions[0].x, positions[0].y); await page.mouse.down();
  await page.mouse.move(positions[1].x, positions[1].y, { steps: 6 }); await page.mouse.up();
}
async function setup(page) {
  await openTestDocument(page);
  await page.evaluate(() => { window.__jot2dTest.resetForReadOnlyDuplicateDimension(); window.__jot2dTest.focusWorldForTest({ x: 30, y: 0 }, 3); });
}

test('fixed anchor permits corner resizing and Escape restores the original font without history', async ({ page }) => {
  await setup(page); await create(page); await page.locator('#fixPointBtn').click();
  const first = await state(page), before = await data(page), corners = first.textLayout.frameCorners;
  const edge = { x: corners[0].x, y: (corners[0].y + corners[3].y) / 2 };
  await clickWorld(page, edge);
  const corner = corners[3];
  const start = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), corner);
  const end = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), { x: corner.x - 5, y: corner.y + 5 });
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 4 });
  expect((await state(page)).style.textHeight).toBeGreaterThan(first.style.textHeight);
  await page.keyboard.press('Escape'); await page.mouse.up();
  expect((await data(page)).annotations).toEqual(before.annotations);
  await clickWorld(page, edge);
  await dragWorld(page, corner, { x: corner.x - 5, y: corner.y + 5 });
  const resized = await state(page); expect(resized.style.textHeight).toBeGreaterThan(first.style.textHeight);
  expect(resized.textLayout.anchorX).toBeCloseTo(first.textLayout.anchorX, 8); expect(resized.textLayout.anchorY).toBeCloseTo(first.textLayout.anchorY, 8);
  await page.locator('#undoBtn').click(); expect((await data(page)).annotations).toEqual(before.annotations);
});
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
for (const leader of [false, true]) test(`command-first coincidence picks the ${leader ? 'leader' : 'text'} anchor and supports cancellation`, async ({ page }) => {
  await setup(page); await create(page, leader);
  const before = await data(page), first = await state(page, leader ? 'leader' : 'text');
  const anchor = { x: first.textLayout.anchorX, y: first.textLayout.anchorY };
  const target = before.points.find(point => point.id === before.lines[0].p2);
  await clickWorld(page, { x: 100, y: 50 });
  await page.locator('[data-constraint=coincident]').click();
  await clickWorld(page, anchor);
  await expect(page.locator('#commandPanel')).toHaveAttribute('data-command', 'annotation-anchor-constraint');
  expect((await data(page)).annotations[0].anchorConstraints).toBeUndefined();
  await page.keyboard.press('Escape');
  expect((await data(page)).annotations).toEqual(before.annotations);
  await clickWorld(page, { x: 100, y: 50 });
  await page.locator('[data-constraint=coincident]').click();
  await clickWorld(page, anchor); await clickWorld(page, target);
  const constrained = await data(page);
  expect(constrained.points).toEqual(before.points);
  expect(constrained.annotations[0].anchorConstraints[0]).toMatchObject({ type: 'coincident', geometryRef: { kind: 'point', path: [target.id] } });
  const placed = await state(page, leader ? 'leader' : 'text');
  expect(placed.textLayout.anchorX).toBeCloseTo(target.x, 8);
  expect(placed.textLayout.anchorY).toBeCloseTo(target.y, 8);
  await page.locator('#undoBtn').click(); expect((await data(page)).annotations[0].anchorConstraints).toBeUndefined();
  await page.locator('#redoBtn').click(); expect((await data(page)).annotations[0].anchorConstraints).toHaveLength(1);
});

test('coincidence follows a geometry point, preserves geometry and supports history, reload and removal', async ({ page }) => {
  await setup(page); await create(page);
  const before = await data(page), target = before.points.find(point => point.id === before.lines[0].p2);
  await page.locator('[data-constraint=coincident]').click(); await clickWorld(page, target);
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
  await page.locator('[data-constraint=horizontal]').click(); await clickWorld(page, target);
  expect((await state(page)).textLayout.anchorY).toBeCloseTo(0, 8);
  await page.locator('[data-constraint=distance]').click(); await clickWorld(page, target);
  await page.locator('#commandPanel [data-setting=axis]').selectOption('x');
  await page.locator('#commandPanel [data-setting=value]').fill('25'); await page.locator('#commandPanel [data-setting=value]').press('Tab');
  await page.locator('#commandPanel [data-action=finish]').click();
  expect((await state(page)).textLayout.anchorX).toBeCloseTo(target.x + 25, 8);
  await page.locator('[data-constraint=vertical]').click(); await clickWorld(page, target);
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
  await page.locator('[data-constraint=coincident]').click(); await clickWorld(page, { x: 80, y: 20 });
  const before = await state(page, 'leader'), moved = await data(page);
  moved.constraints = []; moved.points.filter(point => point.id !== 'P99').forEach(point => { point.x += 20; point.y += 10; });
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), moved)).success).toBe(true);
  const after = await state(page, 'leader'); expect(after.resolvedStart.x - before.resolvedStart.x).toBeCloseTo(20, 8);
  expect(after.textLayout.anchorX).toBeCloseTo(80, 8); expect(after.textLayout.anchorY).toBeCloseTo(20, 8);
  moved.points.find(point => point.id === 'P99').x = 100;
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), moved)).success).toBe(true);
  expect((await state(page, 'leader')).textLayout.anchorX).toBeCloseTo(100, 8);
});

for (const order of ['both-selected', 'target-then-anchor', 'target-selected']) test(`coincidence accepts ${order}`, async ({ page }) => {
  await setup(page); await create(page);
  const before = await data(page), first = await state(page), anchor = { x: first.textLayout.anchorX, y: first.textLayout.anchorY };
  const target = before.points.find(point => point.id === before.lines[0].p1);
  if (order === 'both-selected') {
    await page.keyboard.down('Control'); await clickWorld(page, target); await page.keyboard.up('Control');
    await page.locator('[data-constraint=coincident]').click();
  } else {
    await clickWorld(page, { x: 100, y: 50 });
    if (order === 'target-selected') { await clickWorld(page, target); await page.locator('[data-constraint=coincident]').click(); }
    else { await page.locator('[data-constraint=coincident]').click(); await clickWorld(page, target); }
    await clickWorld(page, anchor);
  }
  expect((await data(page)).annotations[0].anchorConstraints[0].type).toBe('coincident');
  expect((await data(page)).points).toEqual(before.points);
  expect((await state(page)).textLayout.anchorX).toBeCloseTo(target.x, 6);
});

for (const leader of [false, true]) for (const route of ['blank', 'rectangle', 'geometry']) test(`${route} deselection disables armed handles before reselecting ${leader ? 'leaders' : 'text'}`, async ({ page }) => {
  await setup(page); await create(page, leader);
  const type = leader ? 'leader' : 'text', first = await state(page, type), before = await data(page);
  const corner = first.textLayout.frameCorners[3];
  await clickWorld(page, corner);
  expect((await page.evaluate(p => window.__jot2dTest.annotationHitAt(window.__jot2dTest.worldClientPositionForTest(p)), corner)).part).toBe('frame');
  if (route === 'rectangle') await dragWorld(page, { x: 80, y: 40 }, { x: 100, y: 50 });
  else await clickWorld(page, route === 'geometry' ? { x: 0, y: 0 } : { x: 100, y: 50 });
  await clickWorld(page, { x: first.textLayout.anchorX, y: first.textLayout.anchorY });
  expect((await page.evaluate(p => window.__jot2dTest.annotationHitAt(window.__jot2dTest.worldClientPositionForTest(p)), corner)).part).toBe('frame-enable');
  await dragWorld(page, corner, { x: corner.x - 6, y: corner.y + 6 });
  expect((await state(page, type)).style.textHeight).toBe(first.style.textHeight);
  expect((await data(page)).annotations).toEqual(before.annotations);
});

for (const leader of [false, true]) test(`frame resizing and text/anchor movement work for ${leader ? 'leaders' : 'text'}`, async ({ page }) => {
  await setup(page); await create(page, leader);
  const type = leader ? 'leader' : 'text', first = await state(page, type), before = await data(page);
  const anchor = { x: first.textLayout.anchorX, y: first.textLayout.anchorY }, corner = first.textLayout.frameCorners[3];
  expect((await page.evaluate(p => window.__jot2dTest.annotationHitAt(window.__jot2dTest.worldClientPositionForTest(p)), corner)).part).toBe('frame-enable');
  await clickWorld(page, corner);
  expect((await page.evaluate(p => window.__jot2dTest.annotationHitAt(window.__jot2dTest.worldClientPositionForTest(p)), corner)).part).toBe('frame');
  expect((await data(page)).annotations).toEqual(before.annotations);
  await dragWorld(page, corner, { x: corner.x - 6, y: corner.y + 6 });
  const resized = await state(page, type);
  expect(resized.style.textHeight).toBeGreaterThan(first.style.textHeight);
  expect(resized.textLayout.anchorX).toBeCloseTo(anchor.x, 8); expect(resized.textLayout.anchorY).toBeCloseTo(anchor.y, 8);
  expect(resized.serialized.style.framePaddingX).toBe(2); expect(resized.serialized.style.framePaddingY).toBe(1);
  await page.locator('#undoBtn').click(); expect((await data(page)).annotations).toEqual(before.annotations);
  await page.locator('#redoBtn').click(); expect((await state(page, type)).style.textHeight).toBeCloseTo(resized.style.textHeight, 8);
  const body = { x: resized.textLayout.x + resized.textLayout.left + resized.textLayout.width / 2, y: resized.textLayout.y };
  await dragWorld(page, body, { x: body.x + 10, y: body.y + 10 });
  const moved = await state(page, type); expect(moved.textLayout.anchorX).toBeCloseTo(anchor.x + 10, 6); expect(moved.textLayout.anchorY).toBeCloseTo(anchor.y + 10, 6);
  await dragWorld(page, { x: moved.textLayout.anchorX, y: moved.textLayout.anchorY }, { x: moved.textLayout.anchorX + 5, y: moved.textLayout.anchorY + 5 });
  const movedAnchor = await state(page, type); expect(movedAnchor.textLayout.anchorX).toBeCloseTo(anchor.x + 15, 6); expect(movedAnchor.textLayout.anchorY).toBeCloseTo(anchor.y + 15, 6);
  expect(movedAnchor.style.textHeight).toBeCloseTo(resized.style.textHeight, 8);
  await clickWorld(page, { x: 100, y: 50 });
  await clickWorld(page, { x: movedAnchor.textLayout.anchorX, y: movedAnchor.textLayout.anchorY });
  const reselectedCorner = movedAnchor.textLayout.frameCorners[3];
  expect((await page.evaluate(p => window.__jot2dTest.annotationHitAt(window.__jot2dTest.worldClientPositionForTest(p)), reselectedCorner)).part).toBe('frame-enable');
  const saved = await data(page); expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  expect((await state(page, type)).style.textHeight).toBeCloseTo(resized.style.textHeight, 8);
});

test('line coincidence, line distance and point symmetry use the ordinary constraint tools', async ({ page }) => {
  await setup(page); await create(page);
  const before = await data(page), line = before.lines[0], points = before.points, a = points.find(p => p.id === line.p1), b = points.find(p => p.id === line.p2);
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  await page.locator('[data-constraint=coincident]').click(); await clickWorld(page, middle);
  expect((await data(page)).annotations[0].anchorConstraints[0].type).toBe('on-line');
  expect((await state(page)).textLayout.anchorY).toBeCloseTo(0, 6);
  await page.locator('[data-property-action=annotation-anchor-clear]').click();
  await page.locator('[data-constraint=distance]').click(); await clickWorld(page, middle);
  await page.locator('#commandPanel [data-setting=value]').fill('10'); await page.locator('#commandPanel [data-setting=value]').press('Tab');
  await page.locator('#commandPanel [data-action=finish]').click();
  expect((await data(page)).annotations[0].anchorConstraints[0].type).toBe('distance-line');
  expect(Math.abs((await state(page)).textLayout.anchorY)).toBeCloseTo(10, 6);
  await page.locator('[data-property-action=annotation-anchor-clear]').click();
  const seed = await data(page); seed.points.push({ id: 'P99', x: 10, y: 15, kind: 'explicit', sketchId: 'S1', construction: false });
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), seed)).success).toBe(true);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 30, y: 0 }, 3));
  const first = await state(page); await clickWorld(page, { x: first.textLayout.anchorX, y: first.textLayout.anchorY });
  await page.locator('[data-constraint=symmetry]').click(); await clickWorld(page, { x: 10, y: 15 }); await clickWorld(page, middle);
  const result = await state(page); expect(result.serialized.anchorConstraints[0].type).toBe('symmetry');
  expect(result.textLayout.anchorX).toBeCloseTo(10, 6); expect(result.textLayout.anchorY).toBeCloseTo(-15, 6);
  expect((await data(page)).lines).toEqual(before.lines); expect((await data(page)).points.slice(0, points.length)).toEqual(points);
});
