const { test, expect, openTestDocument } = require('./test-fixture');
const data = page => page.evaluate(() => window.__jot2dTest.serializedModelForTest());
const metrics = (page, type) => page.evaluate(type => window.__jot2dTest.annotationAppearanceStateForTest(type), type);
async function setup(page) {
  await openTestDocument(page);
  await page.evaluate(() => { window.__jot2dTest.resetForReadOnlyDuplicateDimension(); window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 3); });
}
async function clickWorld(page, p) {
  const point = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), p);
  await page.mouse.click(point.x, point.y);
}
async function createText(page) {
  await page.locator('#annotationTextBtn').click();
  await page.locator('#commandPanel [data-setting=withLeader]').uncheck();
  await page.locator('#commandPanel textarea').fill('Note\nSecond line');
  await clickWorld(page, { x: 40, y: -30 });
  await page.locator('#commandPanel [data-action=finish]').click();
}
async function selectNote(page) {
  const sketch = page.locator('.sketch-item[data-id="S1"]');
  if (await sketch.getAttribute('aria-expanded') !== 'true') await sketch.locator('.sketchExpandBtn').click();
  const group = page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="annotation"]');
  if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
  await page.locator('.sketch-object-row[data-object-kind="annotation"]').first().click();
}
test('single annotation entry, multiline draft, mode switching, cancellation and remembered setting', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#annotationLeaderBtn')).toHaveCount(0);
  await page.locator('#annotationTextBtn').click();
  await expect(page.locator('#commandPanel')).toBeVisible();
  const text = page.locator('#commandPanel textarea'), finish = page.locator('#commandPanel [data-action=finish]');
  await expect(finish).toBeDisabled();
  await text.fill('First'); await text.press('End'); await text.press('Enter'); await text.pressSequentially('Second');
  await expect(text).toHaveValue('First\nSecond'); await expect(text).toBeFocused();
  expect((await data(page)).annotations).toHaveLength(0);
  await clickWorld(page, { x: 40, y: -30 }); await expect(finish).toBeEnabled();
  await page.locator('#commandPanel [data-setting=withLeader]').check(); await expect(finish).toBeDisabled();
  await expect(text).toHaveValue('First\nSecond');
  await clickWorld(page, { x: 0, y: 0 }); await clickWorld(page, { x: 40, y: -30 }); await clickWorld(page, { x: 70, y: -10 });
  await expect(finish).toBeEnabled(); expect((await data(page)).annotations).toHaveLength(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('#commandPanel')).toBeHidden();
  expect((await data(page)).annotations[0]).toMatchObject({ type: 'leader', text: 'First\nSecond', appearanceInheritance: true });
  await expect(page.locator('#propertiesPanel .property-heading')).toHaveText('注記');
  await page.locator('#annotationTextBtn').click(); await expect(page.locator('#commandPanel [data-setting=withLeader]')).toBeChecked();
  await text.fill('cancel me'); await text.press('Escape');
  expect((await data(page)).annotations).toHaveLength(1);
  await page.locator('#undoBtn').click(); expect((await data(page)).annotations).toHaveLength(0);
  await page.locator('#redoBtn').click(); expect((await data(page)).annotations).toHaveLength(1);
});
for (const locked of [false, true]) test(`attach/detach preserves displayed text, parameter identity and history, lock ${locked}`, async ({ page }) => {
  await setup(page); await createText(page);
  await page.locator('[data-property="annotation-parameter-enabled"]').check();
  await page.locator('[data-property="annotation-expression"]').fill('1 / 3'); await page.locator('[data-property="annotation-expression"]').press('Tab');
  await page.locator('[data-annotation-style=precision]').selectOption('3');
  await page.locator('#annotationRotation').fill('25'); await page.locator('#annotationRotation').press('Tab');
  await page.locator('#annotationTextAlign').selectOption('center');
  if (locked) await page.locator('#annotationFixedDisplaySize').check();
  const before = await metrics(page, 'text');
  await page.locator('[data-property-action=annotation-attach]').click();
  await clickWorld(page, { x: 0, y: 0 });
  expect((await data(page)).annotations[0].type).toBe('text');
  await page.locator('#commandPanel [data-action=cancel]').click();
  expect((await data(page)).annotations[0]).toEqual(before.serialized);
  await page.locator('[data-property-action=annotation-attach]').click(); await clickWorld(page, { x: 0, y: 0 });
  await page.locator('#commandPanel [data-action=finish]').click();
  const attached = await metrics(page, 'leader');
  expect(attached.serialized.id).toBe(before.serialized.id);
  expect(attached.serialized.parameterName).toBe(before.serialized.parameterName);
  expect(attached.serialized.expression).toBe(before.serialized.expression);
  expect(attached.displayedText).toBe(before.displayedText);
  expect(attached.textMetrics).toEqual(before.textMetrics);
  expect(attached.serialized.textPlacement).toBe('text');
  const saved = await data(page);
  await page.locator('#undoBtn').click(); expect((await data(page)).annotations[0]).toEqual(before.serialized);
  await page.locator('#redoBtn').click(); expect((await data(page)).annotations[0]).toEqual(saved.annotations[0]);
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  await selectNote(page);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 0 }, 5));
  const zoomed = await metrics(page, 'leader');
  await page.locator('[data-property-action=annotation-detach]').click();
  const detached = await metrics(page, 'text');
  expect(detached.textMetrics).toEqual(zoomed.textMetrics);
  expect(detached.displayedText).toBe(before.displayedText);
  expect(detached.serialized.geometryRef).toBeUndefined();
  expect(detached.serialized.attachment).toBeUndefined();
  const final = await data(page);
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), final)).success).toBe(true);
  expect((await data(page)).annotations[0]).toEqual(final.annotations[0]);
});
test('text and leader inherit the same document and sketch text settings', async ({ page }) => {
  await setup(page); await createText(page);
  let saved = await data(page);
  saved.defaultLeaderAppearance.textHeight = 7;
  saved.defaultLeaderAppearance.rotation = 0.5;
  saved.sketches.find(s => s.id === 'S1').leaderAppearance = { color: '#abcdef' };
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  const text = await metrics(page, 'text');
  expect(text.style).toMatchObject({ color: '#abcdef', textHeight: 7, rotation: 0.5 });
  await selectNote(page);
  await page.locator('[data-property-action=annotation-attach]').click(); await clickWorld(page, { x: 0, y: 0 });
  await page.locator('#commandPanel [data-action=finish]').click();
  expect((await metrics(page, 'leader')).textMetrics).toEqual(text.textMetrics);
  let inherited = await data(page);
  expect(inherited.annotations[0].style).toEqual({});
  inherited.defaultLeaderAppearance.textHeight = 9;
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), inherited)).success).toBe(true);
  expect((await metrics(page, 'leader')).style.textHeight).toBe(9);
  await selectNote(page);
  await page.locator('[data-property-action=annotation-detach]').click();
  inherited = await data(page);
  expect(inherited.annotations[0].style).toEqual({});
  inherited.defaultLeaderAppearance.textHeight = 11;
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), inherited)).success).toBe(true);
  expect((await metrics(page, 'text')).style.textHeight).toBe(11);
  await selectNote(page);
  await page.locator('#annotationTextHeight').fill(''); await page.locator('#annotationTextHeight').press('Tab');
  expect((await metrics(page, 'text')).serialized.style.textHeight).toBeUndefined();
});

test('legacy text keeps screen size when attached under model-relative document defaults', async ({ page }) => {
  await setup(page);
  const source = await data(page);
  source.defaultLeaderAppearance.fixedDisplaySize = false; source.defaultLeaderAppearance.displayScale = 0.4;
  source.defaultLeaderAppearance.textGap = 4;
  source.annotations = [{ id: 'AN1', type: 'text', sketchId: 'S1', x: 40, y: -30, rotation: 0.4, text: 'Legacy', style: { textHeight: 5 } }];
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), source)).success).toBe(true);
  await selectNote(page); const before = await metrics(page, 'text');
  await page.locator('[data-property-action=annotation-attach]').click(); await clickWorld(page, { x: 0, y: 0 });
  await page.locator('#commandPanel [data-action=finish]').click();
  const after = await metrics(page, 'leader');
  expect(after.textMetrics).toEqual(before.textMetrics);
  expect(after.style.fixedDisplaySize).toBe(true); expect(after.style.textGap).toBe(4);
});

test('attached text follows target deformation, resizes without moving text and detaches at the current position', async ({ page }) => {
  await setup(page); await createText(page);
  await page.locator('[data-property-action=annotation-attach]').click(); await clickWorld(page, { x: 0, y: 0 });
  await page.locator('#commandPanel [data-action=finish]').click();
  const before = await metrics(page, 'leader'), source = await data(page);
  const line = source.lines.find(l => l.id === source.annotations[0].geometryRef.path[0]);
  source.constraints = [];
  const p1 = source.points.find(p => p.id === line.p1), p2 = source.points.find(p => p.id === line.p2);
  p1.x += 10; p1.y += 10; p2.x += 30; p2.y -= 10;
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), source)).success).toBe(true);
  const after = await metrics(page, 'leader');
  expect(after.textMetrics.x - before.textMetrics.x).toBeCloseTo(after.resolvedStart.x - before.resolvedStart.x, 8);
  expect(after.textMetrics.y - before.textMetrics.y).toBeCloseTo(after.resolvedStart.y - before.resolvedStart.y, 8);
  await selectNote(page);
  const end = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), after.displayGeometry.end);
  await page.mouse.move(end.x, end.y); await page.mouse.down(); await page.mouse.move(end.x + 24, end.y + 12, { steps: 4 }); await page.mouse.up();
  const resized = await metrics(page, 'leader');
  expect(resized.textMetrics).toEqual(after.textMetrics);
  expect(resized.displayGeometry.elbow).toEqual(after.displayGeometry.elbow);
  expect(resized.displayGeometry.end.x - after.displayGeometry.end.x).toBeCloseTo(8, 0);
  await page.locator('[data-property-action=annotation-detach]').click();
  const detached = await metrics(page, 'text'); expect(detached.textMetrics).toEqual(resized.textMetrics);
  const final = await data(page); final.points.forEach(p => { p.x += 20; p.y += 10; });
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), final)).success).toBe(true);
  expect((await metrics(page, 'text')).textMetrics).toEqual(detached.textMetrics);
});

test('rotated Block projections preserve attached text layout and shared text appearance after reload', async ({ page }) => {
  await setup(page); await createText(page);
  await page.locator('[data-property-action=annotation-attach]').click(); await clickWorld(page, { x: 0, y: 0 });
  await page.locator('#commandPanel [data-action=finish]').click();
  const direct = await metrics(page, 'leader'), source = await data(page);
  const definition = { id: 'B1', name: 'Notes', revision: 1, origin: { x: 0, y: 0 }, parentDefinitionId: null,
    sketches: source.sketches, activeSketchId: 'S1', points: source.points, lines: source.lines, circles: [], arcs: [], splines: [], constraints: [],
    annotations: [...source.annotations, { id: 'AN2', type: 'text', sketchId: 'NOTES', text: 'Inherited', x: 20, y: 20, appearanceInheritance: true, style: {} }],
    hatches: [], nextHatchIndex: 1, referenceImages: [], blockInstances: [], geometryInstances: [], parameters: [], nextDimensionParameterIndex: 1 };
  definition.sketches.push({ id: 'NOTES', name: 'Notes', kind: 'sketch', parentSketchId: 'S1', appearance: {}, leaderAppearance: { rotation: 0.4, textHeight: 8 } });
  source.points = []; source.lines = []; source.constraints = []; source.annotations = [];
  source.blockDefinitions = [definition]; source.blockInstances = [{ id: 'BI1', definitionId: 'B1', sketchId: 'S1', x: 150, y: 100, rotation: Math.PI / 2, enabledSketchIds: ['S1', 'NOTES'], appearanceOverride: { color: '#ff0000' } }];
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), source)).success).toBe(true);
  const state = await page.evaluate(() => window.__jot2dTest.annotationOwnershipStateForTest());
  const leader = state.projected.find(a => a.type === 'leader'), text = state.projected.find(a => a.type === 'text');
  expect(leader.textLayout.x).toBeCloseTo(150 - direct.textMetrics.y, 8);
  expect(leader.textLayout.y).toBeCloseTo(100 + direct.textMetrics.x, 8);
  expect(leader.textLayout.rotation).toBeCloseTo(Math.PI / 2, 8);
  expect(text.effectiveStyle).toMatchObject({ textHeight: 8, rotation: 0.4, color: '#ff0000' });
  const saved = await data(page); expect(saved.blockDefinitions[0].annotations[0].textPlacement).toBe('text');
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  expect((await page.evaluate(() => window.__jot2dTest.annotationOwnershipStateForTest())).projected).toEqual(state.projected);
});

test('multiline annotation preserves leading and trailing newlines and clears old Properties on next creation', async ({ page }) => {
  await setup(page);
  const body = '\n first\n\n last\n';
  await page.locator('#annotationTextBtn').click(); await page.locator('#commandPanel textarea').fill(body);
  await clickWorld(page, { x: 40, y: -30 }); await page.locator('#commandPanel [data-action=finish]').click();
  await expect(page.locator('#annotationText')).toHaveValue(body);
  const saved = await data(page); expect(saved.annotations[0].text).toBe(body);
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).success).toBe(true);
  await selectNote(page); await expect(page.locator('#annotationText')).toHaveValue(body);
  await page.locator('#annotationTextBtn').click();
  await expect(page.locator('#annotationText')).toHaveCount(0);
  await page.locator('#commandPanel textarea').press('Escape');
  expect((await data(page)).annotations[0].text).toBe(body);
});

test('legacy screen-fixed text can reset size to shared document defaults before other edits', async ({ page }) => {
  await setup(page);
  const source = await data(page);
  source.defaultLeaderAppearance.fixedDisplaySize = false; source.defaultLeaderAppearance.displayScale = 0.4;
  source.annotations = [{ id: 'AN1', type: 'text', sketchId: 'S1', x: 40, y: -30, text: 'Legacy', style: { textHeight: 5 } }];
  expect((await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d, "legacy-note.jot2d", { resetLoadedHistory: true }), source)).success).toBe(true);
  await selectNote(page);
  await expect(page.locator('#annotationFixedDisplaySize')).not.toBeChecked();
  await expect(page.locator('[data-property-action=leader-size-default]')).toBeEnabled();
  await page.locator('[data-property-action=leader-size-default]').click();
  await expect(page.locator('#annotationFixedDisplaySize')).toBeChecked();
  expect((await metrics(page, 'text')).style.displayScale).toBeCloseTo(0.4);
  await page.locator('#undoBtn').click();
  expect((await metrics(page, 'text')).style.fixedDisplaySize).not.toBe(false);
});
