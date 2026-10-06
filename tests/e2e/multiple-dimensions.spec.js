const {test,expect,openTestDocument}=require('./test-fixture');
async function fixture(page) {
 await openTestDocument(page);
 return page.evaluate(()=>{
  const t=window.__jot2dTest;t.resetForActiveSketchDimensionVisibility();const data=t.serializedModelForTest();
  for(const key of ['points','lines','constraints']) for(const item of data[key]) if(item.sketchId==='S2') item.sketchId='S1';
  const result=t.loadDocumentFixtureForDragTest(data,'multiple-dimensions.jot2d'); if(!result.success) throw new Error(JSON.stringify(result));
  t.fitForMultipleDimensionsForTest(); return [t.dimensionClientPositionForTest(0),t.dimensionClientPositionForTest(1)];
 });
}
async function state(page){return page.evaluate(()=>window.__jot2dTest.multipleDimensionSelectionForTest());}

test('bulk dimension size lock handles mixed state, zoom, undo and persistence',async({page})=>{
 await fixture(page);
 const positions=await page.evaluate(()=>{
  const t=window.__jot2dTest,data=t.serializedModelForTest();
  data.constraints[0].dimension.display={fixedDisplaySize:false,displayScale:2};
  const result=t.loadDocumentFixtureForDragTest(data,'mixed-lock.jot2d');if(!result.success)throw Error(JSON.stringify(result));
  t.focusWorldForTest({x:60,y:15},96/25.4*1.5);
  return [t.dimensionClientPositionForTest(0),t.dimensionClientPositionForTest(1)];
 });
 await page.mouse.click(positions[0].x,positions[0].y);
 await page.keyboard.down('Control');await page.mouse.click(positions[1].x,positions[1].y);await page.keyboard.up('Control');
 const checkbox=page.locator('[data-bulk-property="modelRelativeSize"]');
 await expect(page.locator('label[for="dimensionBulkSizeLock"]')).toHaveText('サイズロック');
 await expect(checkbox.locator('..')).toHaveAttribute('title','図形に対する注記の大きさを固定');
 await expect(checkbox).toHaveJSProperty('indeterminate',true);
 const before=await page.evaluate(()=>window.__jot2dTest.serializedModelForTest());
 await checkbox.check();
 const locked=await page.evaluate(()=>window.__jot2dTest.serializedModelForTest());
 expect(locked.constraints[0].dimension.display.displayScale).toBe(2);
 expect(locked.constraints[1].dimension.display.displayScale).toBeCloseTo(1.5);
 await expect(checkbox).toBeChecked();await expect(checkbox).toHaveJSProperty('indeterminate',false);
 await page.click('#undoBtn');expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toEqual(before.constraints);
 await page.click('#redoBtn');expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toEqual(locked.constraints);
 await page.evaluate(()=>window.__jot2dTest.focusWorldForTest({x:60,y:10},96/25.4*2));
 // Restoring history clears selection; select the restored dimensions again.
 const restoredPositions=await page.evaluate(()=>[0,1].map(i=>window.__jot2dTest.dimensionClientPositionForTest(i)));
 await page.mouse.click(restoredPositions[0].x,restoredPositions[0].y);
 await page.keyboard.down('Control');await page.mouse.click(restoredPositions[1].x,restoredPositions[1].y);await page.keyboard.up('Control');
 expect((await state(page)).dimensions).toEqual([0,1]);
 await checkbox.uncheck();
 const unlocked=await page.evaluate(()=>window.__jot2dTest.serializedModelForTest());
 for(let i=0;i<2;i++){
  expect(unlocked.constraints[i].dimension.display.fixedDisplaySize).toBe(true);
  expect(unlocked.constraints[i].dimension.display.displayScale).toBeUndefined();
  const {display:ignored,...placement}=unlocked.constraints[i].dimension;
  const {display:ignoredBefore,...original}=before.constraints[i].dimension;
  expect(placement).toEqual(original);expect(unlocked.constraints[i].value).toBe(before.constraints[i].value);
 }
 await page.click('#undoBtn');expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toEqual(locked.constraints);
 await page.click('#redoBtn');
 expect((await page.evaluate(data=>window.__jot2dTest.loadDocumentFixtureForDragTest(data,'saved-lock.jot2d'),unlocked)).success).toBe(true);
 expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toEqual(unlocked.constraints);
});
test('canvas additive dimensions edit common appearance, reload and delete with undo',async({page})=>{
 const positions=await fixture(page);
 await page.mouse.click(positions[0].x,positions[0].y);
 await page.keyboard.down('Control');await page.mouse.click(positions[1].x,positions[1].y);await page.keyboard.up('Control');
 expect((await state(page)).dimensions).toEqual([0,1]);expect((await state(page)).single).toBe(false);
 const before=await page.evaluate(()=>window.__jot2dTest.serializedModelForTest());
 await page.locator('[data-bulk-property="prefix"]').fill(' common ');await page.locator('[data-bulk-property="prefix"]').blur();
 await page.locator('[data-bulk-property="color"]').fill('#ff0000');await page.locator('[data-bulk-property="color"]').blur();
 const after=await page.evaluate(()=>window.__jot2dTest.serializedModelForTest());
 for(let i=0;i<2;i++){expect(after.constraints[i].value).toBe(before.constraints[i].value);expect({...after.constraints[i].dimension,display:undefined}).toEqual({...before.constraints[i].dimension,display:undefined});expect(after.constraints[i].dimension.display).toMatchObject({prefix:' common ',color:'#ff0000'});}
 await page.keyboard.press('Delete');expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toHaveLength(0);
 await page.keyboard.press('Control+z');expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toHaveLength(2);
 await page.keyboard.press('Control+y');expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toHaveLength(0);
 expect((await page.evaluate(data=>window.__jot2dTest.loadDocumentFixtureForDragTest(data,'saved.jot2d'),after)).success).toBe(true);
 expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints[1].dimension.display.prefix).toBe(' common ');
});
test('Shift toggle and mixed geometry retain dimensions, rectangular selection includes both',async({page})=>{
 const positions=await fixture(page);
 await page.mouse.click(positions[0].x,positions[0].y);
 await page.keyboard.down('Shift');await page.mouse.click(positions[1].x,positions[1].y);await page.keyboard.up('Shift');
 expect((await state(page)).dimensions).toEqual([0,1]);
 await page.keyboard.down('Shift');await page.mouse.click(positions[1].x,positions[1].y);await page.keyboard.up('Shift');
 expect((await state(page)).dimensions).toEqual([0]);
 const line=await page.evaluate(()=>window.__jot2dTest.worldClientPositionForTest({x:50,y:0}));
 await page.keyboard.down('Control');await page.mouse.click(line.x,line.y);await page.keyboard.up('Control');
 expect((await state(page)).dimensions).toEqual([0]);expect((await state(page)).lines).toHaveLength(1);
 await expect(page.locator('[data-bulk-property="color"]')).toBeVisible();await expect(page.locator('[data-bulk-property="prefix"]')).toHaveCount(0);
 const corners=await page.evaluate(()=>[{x:-20,y:-45},{x:180,y:100}].map(p=>window.__jot2dTest.worldClientPositionForTest(p)));
 await page.mouse.move(corners[0].x,corners[0].y);await page.mouse.down();await page.mouse.move(corners[1].x,corners[1].y,{steps:8});await page.mouse.up();
 expect((await state(page)).dimensions).toEqual([0,1]);
});

test('active Sketch tree dimensions allow additive selection',async({page})=>{
 await fixture(page);const sketch=page.locator('.sketch-item[data-id="S1"]');
 await sketch.locator('.sketchExpandBtn').click();await page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="constraint"]').click();
 const rows=page.locator('.sketch-object-row[data-sketch-id="S1"][data-object-kind="constraint"]');
 await rows.nth(0).click();await rows.nth(1).click({modifiers:['Control']});expect((await state(page)).dimensions).toEqual([0,1]);
 await rows.nth(0).click({modifiers:['Shift']});expect((await state(page)).dimensions).toEqual([1]);
 await rows.nth(0).click();expect((await state(page)).dimensions).toEqual([0]);
});

test('batch deletion rejects remaining expression dependents atomically',async({page})=>{
 await fixture(page);
 const positions=await page.evaluate(()=>{
  const t=window.__jot2dTest,data=t.serializedModelForTest();data.parameters=[{name:'kept',expression:JSON.stringify(data.constraints[0].parameterName)}];
  const result=t.loadDocumentFixtureForDragTest(data,'dependent.jot2d');if(!result.success)throw Error(JSON.stringify(result));t.fitForMultipleDimensionsForTest();
  return [t.dimensionClientPositionForTest(0),t.dimensionClientPositionForTest(1)];
 });
 await page.mouse.click(positions[0].x,positions[0].y);await page.keyboard.down('Control');await page.mouse.click(positions[1].x,positions[1].y);await page.keyboard.up('Control');
 await page.keyboard.press('Delete');
 expect((await page.evaluate(()=>window.__jot2dTest.serializedModelForTest())).constraints).toHaveLength(2);
 expect((await state(page)).dimensions).toEqual([0,1]);await expect(page.locator('#hint')).toContainText('参照されているため削除できません');
});
