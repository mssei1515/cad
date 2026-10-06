const { test, expect, openTestDocument } = require('./test-fixture');

async function setup(page) {
  await openTestDocument(page);
  await page.evaluate(() => {
    const api = window.__jot2dTest;
    api.resetForReadOnlyDuplicateDimension();
    api.focusWorldForTest({ x: 50, y: 0 }, 3);
  });
}
async function clickWorld(page, point) {
  const client = await page.evaluate(point => window.__jot2dTest.worldClientPositionForTest(point), point);
  await page.mouse.click(client.x, client.y);
}
async function createLeader(page, endX = 85) {
  await page.locator('#annotationLeaderBtn').click();
  await expect(page.locator('#commandPanel')).toBeHidden();
  await clickWorld(page, { x: 0, y: 0 });
  await clickWorld(page, { x: 70, y: -30 });
  await expect(page.locator('#commandPanel')).toBeHidden();
  expect((await data(page)).annotations).toHaveLength(0);
  page.once('dialog', dialog => dialog.accept('Leader'));
  await clickWorld(page, { x: endX, y: -5 });
  return (await data(page)).annotations[0];
}
async function data(page) { return page.evaluate(() => window.__jot2dTest.serializedModelForTest()); }
async function selectLeader(page) {
  const sketch = page.locator('.sketch-item[data-id="S1"]');
  if (await sketch.getAttribute('aria-expanded') !== 'true') await sketch.locator('.sketchExpandBtn').click();
  const group = page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="annotation"]');
  if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
  await page.locator('.sketch-object-row[data-object-kind="annotation"]').first().click();
}

test('three clicks preserve free elbow, horizontal end in either direction and relative attachment', async ({ page }) => {
  await setup(page);
  const before = await data(page);
  for (const endX of [85, 40]) {
    if (endX === 40) await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), before);
    const item = await createLeader(page, endX);
    expect(item.start.x).toBeCloseTo(0, 0);
    expect(item.elbow.x).toBeCloseTo(70, 0);
    expect(item.elbow.y).toBeCloseTo(-30, 0);
    expect(item.end.x).toBeCloseTo(endX, 0);
    expect(item.end.y).toBe(item.elbow.y);
    expect(item.attachment).toEqual({ kind: 'line', t: expect.any(Number) });
    expect(item.style).toEqual({});
    expect(item.appearanceInheritance).toBe(true);
    await page.locator('#undoBtn').click();
    expect((await data(page)).annotations).toHaveLength(0);
    await page.locator('#redoBtn').click();
    expect((await data(page)).annotations[0]).toEqual(item);
  }
});

test('shared defaults, sketch and individual overrides survive save/reload and expose arrow angles only for arrows', async ({ page }) => {
  await setup(page);
  await createLeader(page);
  await page.locator('.app-menu > summary').first().click();
  await page.locator('#documentSettingsBtn').click();
  await page.locator('#documentTerminatorTerminatorType').selectOption('filledArrow');
  await page.locator('#documentTerminatorArrowheadAngle').fill('45');
  await page.locator('#documentTerminatorArrowheadAngle').press('Tab');
  await page.locator('#documentLeaderTextHeight').fill('7');
  await page.locator('#documentLeaderTextHeight').press('Tab');
  await page.locator('#documentSettingsDialog footer button').click();
  await selectLeader(page);
  let metrics = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  expect(metrics.style).toEqual(expect.objectContaining({ terminatorType: 'filledArrow', arrowheadAngle: 45, terminatorSize: 4, textHeight: 7 }));
  const dimension = await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest(0));
  expect(dimension.effective).toEqual(expect.objectContaining({ terminatorType: "filledArrow", arrowheadAngle: 45 }));
  await page.locator('#annotationTerminatorType').selectOption('dot');
  await expect(page.locator('#annotationArrowheadAngle')).toBeHidden();
  await page.locator('#annotationTerminatorType').selectOption('none');
  await expect(page.locator('#annotationArrowheadAngle')).toBeHidden();
  await page.locator('#annotationTerminatorType').selectOption('arrow');
  await expect(page.locator('#annotationArrowheadAngle')).toBeVisible();
  await page.locator('#annotationArrowheadAngle').fill('60');
  await page.locator('#annotationArrowheadAngle').press('Tab');
  const saved = await data(page);
  expect(saved.defaultTerminatorAppearance.arrowheadAngle).toBe(45);
  expect(saved.defaultDimensionAppearance).not.toHaveProperty('arrowheadAngle');
  expect(saved.annotations[0].style.arrowheadAngle).toBe(60);
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).toEqual(expect.objectContaining({ success: true }));
  await selectLeader(page);
  await page.locator('#annotationArrowheadAngle').fill('');
  await page.locator('#annotationArrowheadAngle').press('Tab');
  metrics = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  expect(metrics.style.arrowheadAngle).toBe(45);
});

test('Sketch leader overrides are independent of dimensions, restored by history and persist sparsely', async ({ page }) => {
  await setup(page); await createLeader(page);
  await page.locator('.sketch-item[data-id="S1"] .sketch-name').click();
  const section = page.locator('[data-property-section="leader"]');
  await section.locator('summary').click();
  await page.locator('#sketchLeaderTextHeight').fill('9');
  await page.locator('#sketchLeaderTextHeight').press('Tab');
  await page.locator('#sketchLeaderTerminatorType').selectOption('filledArrow');
  await page.locator('#sketchLeaderArrowheadAngle').fill('70');
  await page.locator('#sketchLeaderArrowheadAngle').press('Tab');
  let metrics = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  expect(metrics.style).toEqual(expect.objectContaining({ textHeight: 9, terminatorType: 'filledArrow', arrowheadAngle: 70 }));
  expect((await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest(0))).effective.arrowheadAngle).toBe(30);
  await selectLeader(page);
  await page.locator('#annotationTextHeight').fill('12');
  await page.locator('#annotationTextHeight').press('Tab');
  expect((await data(page)).annotations[0].style).toEqual({ textHeight: 12 });
  await page.locator('#undoBtn').click();
  expect((await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'))).style.textHeight).toBe(9);
  const saved = await data(page);
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved);
  expect((await data(page)).sketches.find(s => s.id === 'S1').leaderAppearance).toEqual({ textHeight: 9, terminatorType: 'filledArrow', arrowheadAngle: 70 });
});

test('old complete styles and new relative attachments survive moving geometry and reloading', async ({ page }) => {
  await setup(page); await createLeader(page);
  const saved = await data(page);
  const modern = saved.annotations[0];
  for (const point of saved.points) { point.x += 100; point.y += 20; }
  saved.annotations.push({ ...modern, id: 'AN2', appearanceInheritance: false, textPlacement: undefined, attachment: undefined,
    style: { terminatorType: 'filledArrow', terminatorSize: 2.5, textHeight: 4, color: '#123456' }, rotation: 0.3 });
  delete saved.defaultTerminatorAppearance;
  saved.defaultDimensionAppearance.terminatorType = 'dot';
  saved.defaultDimensionAppearance.terminatorSize = 6;
  saved.defaultDimensionAppearance.arrowheadAngle = 55;
  saved.version = 22;
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).toEqual(expect.objectContaining({ success: true }));
  const next = await data(page);
  expect(next.defaultTerminatorAppearance).toEqual({ terminatorType: 'dot', terminatorSize: 6, arrowheadAngle: 55 });
  expect(next.annotations[1].style).toEqual(expect.objectContaining({ arrowheadAngle: 27, terminatorSize: 2.5, color: '#123456' }));
  expect(next.annotations[1].rotation).toBe(0.3);
  expect(next.annotations[1]).not.toHaveProperty('attachment');
  const metrics = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  expect(metrics.resolvedStart.x).toBeCloseTo(100, 0);
  expect(metrics.resolvedStart.y).toBeCloseTo(20, 0);
});

test('Block leaders resolve definition Sketch defaults and transformed relative anchors', async ({ page }) => {
  await setup(page); await createLeader(page);
  const source = await data(page);
  const definition = {
    id: 'B1', name: 'Leader block', revision: 1, origin: { x: 0, y: 0 }, parentDefinitionId: null,
    sketches: source.sketches, activeSketchId: 'S1', points: source.points, lines: source.lines,
    circles: [], arcs: [], splines: [], constraints: [], annotations: source.annotations,
    hatches: [], nextHatchIndex: 1, referenceImages: [], blockInstances: [], geometryInstances: [], parameters: [], nextDimensionParameterIndex: 1
  };
  definition.sketches.find(s => s.id === 'S1').leaderAppearance = { textHeight: 8, rotation: 0.4, terminatorType: 'filledArrow' };
  source.points = []; source.lines = []; source.constraints = []; source.annotations = [];
  source.blockDefinitions = [definition];
  source.blockInstances = [{ id: 'BI1', definitionId: 'B1', sketchId: 'S1', x: 150, y: 100, rotation: Math.PI / 2, enabledSketchIds: ['S1'], appearanceOverride: { color: '#ff0000' } }];
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), source)).toEqual(expect.objectContaining({ success: true }));
  const state = await page.evaluate(() => window.__jot2dTest.annotationOwnershipStateForTest());
  expect(state.projected[0].effectiveStyle).toEqual(expect.objectContaining({ textHeight: 8, rotation: 0.4, terminatorType: 'filledArrow', color: '#ff0000' }));
  expect(state.projected[0].resolvedStart.x).toBeCloseTo(150, 0);
  expect(state.projected[0].resolvedStart.y).toBeCloseTo(100, 0);
  const roundtrip = await data(page);
  expect(roundtrip.blockDefinitions[0].annotations[0].style).toEqual({});
});

test('text gap is inherited and remains below rotated multiline text through zoom and reload', async ({ page }, testInfo) => {
  await setup(page); await createLeader(page);
  await selectLeader(page);
  await page.locator('[data-property="annotation-text"]').fill('First line\nSecond line');
  await page.locator('[data-property="annotation-text"]').press('Tab');
  await page.locator('#annotationTextGap').fill('3');
  await page.locator('#annotationTextGap').press('Tab');
  await page.locator('#annotationRotation').fill('30');
  await page.locator('#annotationRotation').press('Tab');
  const metrics = () => page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  const first = await metrics();
  expect(first.style.textGap).toBe(3);
  expect(first.serialized.end.y - first.textLayout.bounds.y2 - first.textLayout.strokeHalfWidth).toBeCloseTo(first.textLayout.gapWorld, 8);
  await page.screenshot({ path: testInfo.outputPath('leader-gap.png') });
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 6));
  const zoomed = await metrics();
  expect(zoomed.textLayout.gapWorld * 2).toBeCloseTo(first.textLayout.gapWorld, 8);
  await page.locator('#annotationFixedDisplaySize').check();
  const relative = await metrics();
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 3));
  expect((await metrics()).textLayout.gapWorld).toBeCloseTo(relative.textLayout.gapWorld, 8);
  const saved = await data(page);
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved);
  expect((await metrics()).style.textGap).toBe(3);
  await selectLeader(page);
  await page.locator('#annotationTextGap').fill('');
  await page.locator('#annotationTextGap').press('Tab');
  expect((await metrics()).style.textGap).toBe(1);
});

test('shelf and text stay screen-fixed, then size lock captures zoom and persists with inherited reset', async ({ page }) => {
  await setup(page); const leader = await createLeader(page);
  const metrics = () => page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  const screenLength = async () => {
    const geometry = (await metrics()).displayGeometry;
    return page.evaluate(({ elbow, end }) => {
      const a = window.__jot2dTest.worldClientPositionForTest(elbow), b = window.__jot2dTest.worldClientPositionForTest(end);
      return Math.hypot(b.x - a.x, b.y - a.y);
    }, geometry);
  };
  const length = await screenLength(), first = await metrics();
  expect(length).toBeCloseTo(45, 0);
  expect(leader.shelfReferenceScale).toBeCloseTo(3);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 6));
  expect(await screenLength()).toBeCloseTo(length, 8);
  const zoomed = await metrics();
  expect(zoomed.screenTextHeight).toBeCloseTo(first.screenTextHeight, 8);
  expect(zoomed.displayGeometry.elbow).toEqual(first.displayGeometry.elbow);
  await selectLeader(page);
  await expect(page.locator('#annotationFixedDisplaySize')).not.toBeChecked();
  await page.locator('#annotationFixedDisplaySize').check();
  expect(await screenLength()).toBeCloseTo(length, 8);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 3));
  expect(await screenLength()).toBeCloseTo(length / 2, 8);
  expect((await metrics()).screenTextHeight).toBeCloseTo(first.screenTextHeight / 2, 8);
  const saved = await data(page);
  expect(saved.annotations[0].elbow).toEqual(leader.elbow); expect(saved.annotations[0].end).toEqual(leader.end);
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved);
  expect(await screenLength()).toBeCloseTo(length / 2, 8);
  await selectLeader(page);
  await page.locator('[data-property-action="leader-size-default"]').click();
  expect(await screenLength()).toBeCloseTo(length, 8);
  await expect(page.locator('#annotationFixedDisplaySize')).not.toBeChecked();
  expect((await data(page)).annotations[0].style).not.toHaveProperty('fixedDisplaySize');
});

test('displayed shelf endpoint remains selectable beyond stored coordinates and moves as one leader', async ({ page }) => {
  await setup(page); const leader = await createLeader(page);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 0.75));
  const geometry = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader').displayGeometry);
  expect(geometry.end.x).toBeGreaterThan(leader.end.x + 30);
  const client = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), geometry.end);
  expect(await page.evaluate(p => window.__jot2dTest.annotationHitAt(p), client)).toEqual({ type: 'leader', part: 'line' });
  await page.mouse.move(client.x, client.y); await page.mouse.down();
  await page.mouse.move(client.x + 15, client.y + 7.5, { steps: 4 }); await page.mouse.up();
  const moved = (await data(page)).annotations[0];
  expect(moved.elbow.x).toBeCloseTo(leader.elbow.x + 20, 0);
  expect(moved.end.x).toBeCloseTo(leader.end.x + 20, 0);
  expect(moved.end.y).toBe(moved.elbow.y);
  expect(moved.shelfReferenceScale).toBe(leader.shelfReferenceScale);
  await page.locator('#undoBtn').click();
  expect((await data(page)).annotations[0]).toEqual(leader);
});

test('Document size lock is inherited and creation preserves clicked shelf length at a different zoom', async ({ page }) => {
  await setup(page);
  await page.locator('.app-menu > summary').first().click(); await page.locator('#documentSettingsBtn').click();
  await page.locator('#documentLeaderFixedDisplaySize').check();
  await page.locator('#documentSettingsDialog footer button').click();
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 6));
  const leader = await createLeader(page, 40);
  const first = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  expect(first.style.fixedDisplaySize).toBe(false);
  expect(leader.style).toEqual({});
  expect(first.displayGeometry.end.x).toBeCloseTo(leader.end.x, 8);
  const before = first.displayGeometry.elbow.x - first.displayGeometry.end.x;
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 3));
  const next = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest('leader'));
  expect(next.displayGeometry.elbow.x - next.displayGeometry.end.x).toBeCloseTo(before, 8);
  const saved = await data(page);
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved);
  expect((await data(page)).annotations[0].shelfReferenceScale).toBe(leader.shelfReferenceScale);
  await selectLeader(page);
  await expect(page.locator('#annotationFixedDisplaySize')).toBeChecked();
  await expect(page.locator('[data-property-action="leader-size-default"]')).toBeDisabled();
});

test('Sketch size lock overrides Document and individual reset returns to the Sketch setting', async ({ page }) => {
  await setup(page); await createLeader(page);
  await page.locator('.sketch-item[data-id="S1"] .sketch-name').click();
  const section = page.locator('[data-property-section="leader"]');
  if (await section.getAttribute('open') === null) await section.locator('summary').click();
  await page.locator('#sketchLeaderFixedDisplaySize').check();
  expect((await data(page)).sketches.find(s => s.id === 'S1').leaderAppearance.fixedDisplaySize).toBe(false);
  await selectLeader(page);
  await expect(page.locator('#annotationFixedDisplaySize')).toBeChecked();
  await page.locator('#annotationFixedDisplaySize').uncheck();
  expect((await data(page)).annotations[0].style.fixedDisplaySize).toBe(true);
  await page.locator('[data-property-action="leader-size-default"]').click();
  await expect(page.locator('#annotationFixedDisplaySize')).toBeChecked();
  await page.locator('#undoBtn').click();
  expect((await data(page)).annotations[0].style.fixedDisplaySize).toBe(true);
  await page.locator('#redoBtn').click();
  expect((await data(page)).annotations[0].style).not.toHaveProperty('fixedDisplaySize');
});
