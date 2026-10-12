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

test('blank double click discards pattern placement draft and keeps its sources', async ({ page }) => {
  await setup(page);
  const before = await saved(page);
  await page.click('#toolPattern'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="destination"]').click();
  const box = await page.locator('#canvas').boundingBox();
  await page.mouse.dblclick(box.x + 25, box.y + box.height - 25);
  await expect(page.locator('#commandPanel')).toBeHidden();
  const after = await saved(page);
  expect(after.geometryInstances).toEqual(before.geometryInstances);
  expect(after.lines).toEqual(before.lines);
});
test('unified linear creation, midpoint anchor, total count and round trip', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolPattern'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="destination"]').click(); await click(page, { x: 30, y: 40 });
  await page.locator('#commandPanel [data-setting="count"]').fill('3'); await page.locator('#commandPanel [data-setting="count"]').press('Tab');
  await page.locator('#commandPanel [data-action="finish"]').click();
  const data = await saved(page), instance = data.geometryInstances[0];
  expect(instance).toMatchObject({ type: 'pattern', count: 3, reflected: false, rotationLocked: true, placement: { kind: 'linear' }, anchor: { relation: { kind: 'lineMidpoint' } } });
  expect(data.version).toBe(26);
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), data)).toMatchObject({ success: true });
  expect((await saved(page)).geometryInstances).toEqual(data.geometryInstances); expect(errors).toEqual([]);
});
test('circular creation has no destination input and preserves signed angle intervals', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolCircularPattern'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 20, y: 10 });
  await expect(page.locator('#commandPanel [data-input="destination"]')).toHaveCount(0);
  await page.locator('#commandPanel [data-setting="angleStep"]').fill('-90'); await page.locator('#commandPanel [data-setting="angleStep"]').press('Tab');
  await page.locator('#commandPanel [data-action="finish"]').click();
  expect((await saved(page)).geometryInstances[0].placement).toMatchObject({ kind: 'circular', angleSign: -1 });
  expect(errors).toEqual([]);
});
test('direct interval dimension switches control, edits signed values and round trips', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolCircularPattern'); await click(page, { x: 30, y: 10 });
  await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page, { x: 20, y: 10 });
  await page.locator('#commandPanel [data-action="finish"]').click();
  await page.click('[data-property-action="instance-angle-dimension"]'); await click(page, { x: 60, y: -10 });
  await page.locator('#dimensionValueInput').fill('-90'); await page.locator('#dimensionValueInput').press('Enter');
  let data = await saved(page);
  expect(errors).toEqual([]);
  expect(data.geometryInstances[0].placement, await page.locator('#hint').textContent()).toMatchObject({ angleSign: -1 });
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
  await page.click('#toolPattern'); await click(page, { x: 30, y: 10 });
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
  await page.click('#toolPattern'); await click(page, { x: 30, y: 10 });
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
  const property = page.locator('[data-pattern-property="count"]'); await property.fill('2'); await property.press('Tab');
  expect((await saved(page)).geometryInstances[0].count).toBe(3);
  expect(errors).toEqual([]);
});
test('pattern kind stays fixed during creation and existing placement editing', async ({ page }) => {
 const errors = await setup(page);
 for (const [tool,type] of [['toolPattern','pattern'],['toolCircularPattern','circularPattern']]) {
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({}));
  await page.click('#'+tool); await click(page,{x:30,y:10});
  await page.locator('#commandPanel [data-input="origin"]').click(); await click(page,{x:20,y:10});
  await expect(page.locator('#commandPanel [data-setting="placement"]')).toHaveCount(0);
  if(type==='pattern'){await page.locator('#commandPanel [data-input="destination"]').click();await click(page,{x:70,y:10});}
  await page.locator('#commandPanel [data-action="finish"]').click();
  expect((await saved(page)).geometryInstances.at(-1).type).toBe(type);
  await page.click('[data-property-action="instance-placement"]');
  await expect(page.locator('#commandPanel [data-setting="placement"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
 }
 expect(errors).toEqual([]);
});
test('old synchronized data is rejected atomically', async ({ page }) => {
  await setup(page); const before = await saved(page), data = structuredClone(before);
  data.version = 25; data.geometryInstances = [{ id: 'FI1', type: 'free', sources: [{kind:'line',path:['L1']}], sketchId:data.activeSketchId, x:0,y:0,rotation:0,origin:{x:0,y:0},mirrorX:false,mirrorY:false }];
  expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d), data)).toMatchObject({success:false});
  const after = await saved(page); delete before.savedAt; delete after.savedAt; expect(after).toEqual(before);
});
test('source editing can replace an anchor reference atomically with a copied helper point', async ({ page }) => {
  const errors = await setup(page);
  await page.click('#toolPattern'); await click(page, { x: 30, y: 10 });
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

test('three tools are separate and mirror uses an axis with atomic history', async ({ page }) => {
 const errors = await setup(page); const data = await saved(page);
 data.points.push({id:'P3',x:30,y:30,kind:'explicit',fixed:true,sketchId:data.activeSketchId});
 expect(await page.evaluate(d => window.__jot2dTest.loadDocumentFixtureForDragTest(d,'mirror.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
 await expect(page.locator('#toolFreeInstance')).toHaveCount(0);
 for (const [id,label] of [['toolMirror','ミラー'],['toolPattern','直線パターン'],['toolCircularPattern','円形パターン']]) await expect(page.locator('#'+id)).toHaveAttribute('aria-label',label);
 await page.click('#toolMirror'); await click(page,{x:30,y:30});
 await page.locator('#commandPanel [data-input="reference"]').click(); await click(page,{x:30,y:10});
 await expect(page.locator('#commandPanel [data-input="origin"]')).toHaveCount(0);
 await page.locator('#commandPanel [data-action="finish"]').click();
 const first=await saved(page); expect(first.geometryInstances[0]).toMatchObject({type:'mirror',count:2,placement:{kind:'axisReflection',axis:{kind:'line',path:['L1']}}});
 const view=await page.evaluate(()=>window.__jot2dTest.derivedInstanceStateForTest()); expect(view.instances[0].points[0].y).toBeCloseTo(-10);
 await page.keyboard.press('Control+z'); expect((await saved(page)).geometryInstances).toHaveLength(0);
 await page.keyboard.press('Control+y'); expect((await saved(page)).geometryInstances).toEqual(first.geometryInstances);
 await page.click('#toolCircularPattern'); await expect(page.locator('#commandPanel [data-input="destination"]')).toHaveCount(0); await page.keyboard.press('Escape');
 expect(errors).toEqual([]);
});

test('circular controls show a clean default angle and reference anchor without reflection', async ({ page }) => {
 const errors=await setup(page); await page.click('#toolCircularPattern'); await click(page,{x:30,y:10});
 await expect(page.locator('#commandPanel [data-setting="angleStep"]')).toHaveValue('30');
 await expect(page.locator('#commandPanel [data-setting="reflected"]')).toHaveCount(0);
 await expect(page.locator('#propertiesPanel [data-pattern-property="reflected"]')).toHaveCount(0);
 await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page,{x:40,y:10});
 await expect(page.locator('#commandPanel ul[data-input="origin"]')).toContainText('線の端点: L1');
 await expect(page.locator('#propertiesPanel')).toContainText('線の端点: L1');
 await page.locator('#commandPanel [data-action="finish"]').click();
 await page.click('[data-property-action="instance-placement"]');
 await expect(page.locator('#commandPanel [data-setting="angleStep"]')).toHaveValue('30');
 expect(errors).toEqual([]);
});
test('linear copies accumulate angle, preserve spacing, and round trip', async ({ page }) => {
 const errors=await setup(page); await page.click('#toolPattern'); await click(page,{x:30,y:10});
 await page.locator('#commandPanel [data-input="origin"]').click(); await click(page,{x:20,y:10});
 await page.locator('#commandPanel [data-setting="offsetX"]').fill('30'); await page.locator('#commandPanel [data-setting="offsetX"]').press('Tab');
 await page.locator('#commandPanel [data-setting="offsetY"]').fill('0'); await page.locator('#commandPanel [data-setting="offsetY"]').press('Tab');
 await page.locator('#commandPanel [data-setting="rotation"]').fill('30'); await page.locator('#commandPanel [data-setting="rotation"]').press('Tab');
 await page.locator('#commandPanel [data-setting="count"]').fill('4'); await page.locator('#commandPanel [data-setting="count"]').press('Tab');
 await page.locator('#commandPanel [data-action="finish"]').click();
 const view=await page.evaluate(()=>window.__jot2dTest.derivedInstanceStateForTest()), lines=view.instances[0].lines;
 for(const [n,line] of lines.entries()) {
  expect(line.p1.x).toBeCloseTo(20+(n+1)*30,7); expect(line.p1.y).toBeCloseTo(10,7);
  expect(Math.atan2(line.p2.y-line.p1.y,line.p2.x-line.p1.x)).toBeCloseTo((n+1)*Math.PI/6,7);
 }
 const data=await saved(page); expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d),data)).toMatchObject({success:true});
 expect((await page.evaluate(()=>window.__jot2dTest.derivedInstanceStateForTest())).instances).toEqual(view.instances);
 expect(errors).toEqual([]);
});

test('circular controls omit locks and interval modes and preserve constrained interval on reload', async ({page}) => {
 await setup(page); await page.click('#toolCircularPattern'); await click(page,{x:30,y:10});
 for(const key of ['rotation','rotationLocked','angleMode']) {
  await expect(page.locator('#commandPanel [data-setting="'+key+'"]')).toHaveCount(0);
  await expect(page.locator('#propertiesPanel [data-pattern-property="'+key+'"]')).toHaveCount(0);
 }
 await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page,{x:20,y:10});
 await page.locator('#commandPanel [data-action="finish"]').click();
 await page.click('[data-property-action="instance-angle-dimension"]'); await click(page,{x:60,y:-10});
 await page.locator('#dimensionValueInput').fill('60'); await page.locator('#dimensionValueInput').press('Enter');
 const data=await saved(page), i=data.geometryInstances[0];
 expect(i).not.toHaveProperty('rotation'); expect(i).not.toHaveProperty('rotationLocked'); expect(i.placement).not.toHaveProperty('angleMode');
 expect(i.placement.angleStep).toBeCloseTo(Math.PI/3);
 expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d),data)).toMatchObject({success:true});
 expect((await saved(page)).geometryInstances).toEqual(data.geometryInstances);
});

test('old circular posture is ignored and copies use only occurrence times interval after reload', async ({page}) => {
 await setup(page); await page.click('#toolCircularPattern'); await click(page,{x:30,y:10});
 await page.locator('#commandPanel ul[data-input="origin"]').click(); await click(page,{x:20,y:10});
 await page.locator('#commandPanel [data-setting="count"]').fill('4'); await page.locator('#commandPanel [data-setting="count"]').press('Tab');
 await page.locator('#commandPanel [data-action="finish"]').click();
 const data=await saved(page); data.geometryInstances[0].rotation=.7;
 expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d),data)).toMatchObject({success:true});
 const view=await page.evaluate(()=>window.__jot2dTest.derivedInstanceStateForTest());
 for(const [n,line] of view.instances[0].lines.entries()) {
   expect(Math.atan2(line.p2.y-line.p1.y,line.p2.x-line.p1.x)).toBeCloseTo(-(n+1)*Math.PI/6,7);
   expect(line.p1.x).toBeCloseTo(20,7); expect(line.p1.y).toBeCloseTo(10,7);
 }
 expect((await saved(page)).geometryInstances[0]).not.toHaveProperty('rotation');
});
