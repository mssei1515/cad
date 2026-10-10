const { test, expect, openTestDocument, revealToolbarTool } = require('./test-fixture');

function fixture(active = 'S2', locked = false) {
  return { version: 11, documentName: 'Sketch permissions', activeSketchId: active,
    sketches: [{ id: 'ROOT', name: 'Root Sketch', kind: 'root', parentSketchId: null },
      { id: 'S1', name: 'Source', kind: 'sketch', parentSketchId: 'ROOT', locked },
      { id: 'S2', name: 'Destination', kind: 'sketch', parentSketchId: 'ROOT' }],
    points: [{ id: 'P1', x: -60, y: 0, kind: 'endpoint', sketchId: 'S1' },
      { id: 'P2', x: 60, y: 0, kind: 'endpoint', sketchId: 'S1' },
      { id: 'P3', x: -40, y: 60, kind: 'endpoint', sketchId: 'S2' },
      { id: 'P4', x: 40, y: 60, kind: 'endpoint', sketchId: 'S2' }],
    lines: [{ id: 'L1', p1: 'P1', p2: 'P2', sketchId: 'S1' }, { id: 'L2', p1: 'P3', p2: 'P4', sketchId: 'S2' }],
    constraints: [{ type: 'distance', p1: 'P1', p2: 'P2', target: 120, expression: '120', parameterName: 'd1', sketchId: 'S1', enabled: true,
      dimension: { kind: 'aligned', offset: 25 } }],
    circles: [], arcs: [], splines: [], annotations: [], hatches: [], referenceImages: [],
    blockDefinitions: [], blockInstances: [], parameters: [], nextDimensionParameterIndex: 2 };
}
async function setup(page, data) {
  await openTestDocument(page);
  const result = await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), data);
  expect(result.success).toBe(true);
  await page.evaluate(() => window.__jot2dTest.fitAllGeometryForTest());
}
const state = page => page.evaluate(() => window.__jot2dTest.serializedModelForTest());
const position = (page, x, y) => page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), { x, y });
async function selectLine(page) { const p = await position(page, 0, 0); await page.mouse.click(p.x, p.y); return p; }
async function group(page, category) {
  const row = page.locator('.sketch-item[data-id="S1"]');
  const expand = row.locator('.sketchExpandBtn');
  if (await expand.getAttribute('aria-expanded') !== 'true') await expand.click();
  const g = page.locator(`.sketch-group-row[data-sketch-id="S1"][data-category="${category}"]`);
  if (await g.getAttribute('aria-expanded') !== 'true') await g.click();
}

for (const active of ['S1', 'S2']) for (const locked of [false, true]) {
  test(`existing edits preserve owner and drawing sketch: drawing=${active}, locked=${locked}`, async ({ page }) => {
    await setup(page, fixture(active, locked));
    const before = await state(page);
    const p = await selectLine(page);
    await group(page, 'line');
    await expect(page.locator('.sketch-object-row[data-id="L1"]')).toHaveClass(/selected/);
    const construction = page.locator('#propertiesPanel [data-property="construction"]');
    if (locked) await expect(construction).toBeDisabled(); else await expect(construction).toBeEnabled();
    await construction.evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
    expect((await state(page)).lines.find(l => l.id === 'L1').construction).toBe(!locked);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 25, p.y - 20, { steps: 5 }); await page.mouse.up();
    const moved = await state(page);
    expect(moved.activeSketchId).toBe(active);
    expect(moved.points.filter(p => p.sketchId === 'S2')).toEqual(before.points.filter(p => p.sketchId === 'S2'));
    if (locked) expect(moved.points).toEqual(before.points);
    else {
      expect(moved.points).not.toEqual(before.points);
      const [a,b] = moved.points.filter(p => p.sketchId === 'S1');
      expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeCloseTo(120, 3);
    }
    await page.keyboard.press('Delete');
    expect((await state(page)).lines.some(l => l.id === 'L1')).toBe(locked);
    expect((await state(page)).activeSketchId).toBe(active);
  });
}

test('other sketch dimension value solves its owner; new constraints and trim require drawing destination', async ({ page }) => {
  await setup(page, fixture());
  await group(page, 'constraint');
  await page.locator('.sketch-object-row[data-sketch-id="S1"][data-object-kind="constraint"]').click();
  const expression = page.locator('#propertiesPanel [data-property="constraint-expression"]');
  await expect(expression).toBeEnabled();
  const before = await state(page);
  await expression.fill('150'); await expression.press('Tab');
  const after = await state(page);
  expect(after.constraints[0].target).toBeCloseTo(150, 3);
  expect(after.constraints[0].sketchId).toBe('S1'); expect(after.activeSketchId).toBe('S2');
  expect(after.points.filter(p => p.sketchId === 'S2')).toEqual(before.points.filter(p => p.sketchId === 'S2'));
  await group(page, 'line'); await page.locator('.sketch-object-row[data-id="L1"]').click();
  await page.locator('[data-constraint="distance"]').click();
  await expect(page.locator('#hint')).toContainText(/作図先|drawing sketch/);
  await revealToolbarTool(page, '#toolTrim'); await page.locator('#toolTrim').click();
  await expect(page.locator('#hint')).toContainText(/作図先|drawing sketch/);
  expect((await state(page)).constraints).toEqual(after.constraints);
  expect((await state(page)).lines).toEqual(after.lines);
});

test('lock persists through reload and undo; locked destination rejects creation and paste', async ({ page }) => {
  await setup(page, fixture('S1'));
  await selectLine(page); await page.keyboard.press('Control+c');
  const lock = page.locator('.sketchLockBtn[data-id="S1"]');
  await lock.click(); await expect(lock).toHaveAttribute('aria-pressed', 'true');
  const before = await state(page);
  await page.keyboard.press('Control+v'); await page.locator('#toolLine').click();
  const p = await position(page, 0, 40); await page.mouse.click(p.x,p.y);
  expect((await state(page)).lines).toEqual(before.lines);
  expect((await state(page)).activeSketchId).toBe('S1');
  await page.keyboard.press('Escape'); await page.locator('#undoBtn').click();
  expect((await state(page)).sketches.find(s => s.id === 'S1').locked).toBe(false);
  await setup(page, before); await expect(lock).toHaveAttribute('aria-pressed', 'true');
  await group(page, 'constraint'); await page.locator('.sketch-object-row[data-object-kind="constraint"]').click();
  await expect(page.locator('#propertiesPanel [data-property="constraint-expression"]')).toBeDisabled();
});

test('selection does not redirect paste or new drawing and additive selection stays in one sketch', async ({ page }) => {
  await setup(page, fixture()); await selectLine(page);
  const other = await position(page, 0,60);
  await page.keyboard.down('Control'); await page.mouse.click(other.x,other.y); await page.keyboard.up('Control');
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).lines).toEqual(['L1']);
  await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
  let data=await state(page);
  expect(data.activeSketchId).toBe('S2'); expect(data.lines.filter(l=>l.sketchId==='S1')).toHaveLength(1);
  expect(data.lines.filter(l=>l.sketchId==='S2')).toHaveLength(2);
  await page.keyboard.press('Escape'); await page.locator('#toolLine').click();
  for(const xy of [[-20,30],[30,30]]) { const p=await position(page,...xy); await page.mouse.click(p.x,p.y); }
  await page.keyboard.press('Escape'); data=await state(page);
  expect(data.lines.filter(l=>l.sketchId==='S1')).toHaveLength(1);
  expect(data.lines.filter(l=>l.sketchId==='S2')).toHaveLength(3);
});

test('sketch row has aligned visibility, delete and lock controls without a rename button', async ({ page }) => {
  await setup(page, fixture());
  for (const id of ['S1', 'S2']) {
    const row = page.locator(`.sketch-item[data-id="${id}"]`);
    const boxes = await Promise.all(['.sketchVisibilityBtn', '.sketchLockBtn'].map(selector => row.locator(selector).boundingBox()));
    for (const box of boxes) expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(2);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    await expect(row.locator(".sketchDeleteBtn")).toBeVisible();
    await expect(row.locator(".sketchRenameBtn")).toHaveCount(0);
    await expect(row.locator(".sketchLockBtn svg")).toBeVisible();
    const bounds = await row.boundingBox();
    expect(Math.abs(boxes[1].x + boxes[1].width - bounds.x - bounds.width)).toBeLessThan(2);
  }
  await expect(page.locator('.sketch-item[data-id="ROOT"] .sketchDeleteBtn')).toHaveCount(0);
});

test('locked sketch visibility can change without unlocking or changing drawing destination', async ({ page }) => {
  await setup(page, fixture('S2', true));
  const visibility = page.locator('.sketch-item[data-id="S1"] .sketchVisibilityBtn');
  const style = () => visibility.evaluate(button => ({ background: getComputedStyle(button).backgroundColor, shadow: getComputedStyle(button).boxShadow }));
  await page.mouse.move(900, 400);
  const before = await style();
  await visibility.click();
  await page.mouse.move(900, 400);
  await expect(visibility).toHaveAttribute('aria-pressed', 'false');
  expect(await style()).toEqual(before);
  expect((await state(page)).sketches.find(sketch => sketch.id === 'S1').locked).toBe(true);
  await visibility.click();
  await expect(visibility).toHaveAttribute('aria-pressed', 'true');
  expect((await state(page)).activeSketchId).toBe('S2');
  await expect(page.locator('.sketch-item[data-id="S2"] .sketchVisibilityBtn')).toBeDisabled();
});

test('sketch rename lives in the context menu and does not change drawing destination', async ({ page }) => {
  await setup(page, fixture());
  const row = page.locator('.sketch-item[data-id="S1"]');
  await row.locator('.sketchActivateBtn').click({ button: 'right' });
  await expect(page.locator('#sketchContextMenu [data-context-action="sketch-edit"]')).toHaveText('作図先');
  page.once('dialog', dialog => dialog.accept('Renamed source'));
  await page.locator('#sketchContextMenu [data-context-action="sketch-rename"]').click();
  expect((await state(page)).activeSketchId).toBe('S2');
  expect((await state(page)).sketches.find(s=>s.id==='S1').name).toBe('Renamed source');
});

test('locked projected sketch follows source dimension changes and remains locked after reload', async ({ page }) => {
  const data = fixture('S1');
  data.sketches.find(s => s.id === 'S2').parentSketchId = 'S1';
  data.sketches.find(s => s.id === 'S2').locked = true;
  data.geometryInstances = [{ id: 'SPI1', type: 'sketchProjection', sketchId: 'S2', sources: [{ kind: 'line', path: ['L1'] }] }];
  await setup(page, data);
  const projected = () => page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest().instances.find(i => i.id === 'SPI1'));
  const before = await projected(); expect(before.valid).toBe(true);
  await group(page, 'constraint'); await page.locator('.sketch-object-row[data-object-kind="constraint"]').click();
  const input = page.locator('#propertiesPanel [data-property="constraint-expression"]');
  await input.fill('180'); await input.press('Tab');
  const after = await projected();
  const line = after.lines[0];
  expect(Math.hypot(line.p2.x-line.p1.x,line.p2.y-line.p1.y)).toBeCloseTo(180,3);
  expect(after.lines).not.toEqual(before.lines);
  const saved = await state(page);
  expect(saved.sketches.find(s=>s.id==='S2').locked).toBe(true);
  expect(saved.activeSketchId).toBe('S1');
  await setup(page, saved); expect((await projected()).lines).toEqual(after.lines);
});
