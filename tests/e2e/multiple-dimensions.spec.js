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

async function selectBoth(page, positions) {
 await page.mouse.click(positions[0].x,positions[0].y);
 await page.keyboard.down('Control');await page.mouse.click(positions[1].x,positions[1].y);await page.keyboard.up('Control');
 expect((await state(page)).dimensions).toEqual([0,1]);
}
async function model(page){return page.evaluate(()=>window.__jot2dTest.serializedModelForTest());}
async function client(page,point){return page.evaluate(p=>window.__jot2dTest.worldClientPositionForTest(p),point);}

test('align to right-clicked dimension preserves values, geometry, labels, undo and saved placement',async({page})=>{
 const positions=await fixture(page);await selectBoth(page,positions);
 const before=await model(page);
 const reference=await client(page,{x:20,y:50});
 await page.mouse.click(reference.x,reference.y,{button:'right'});
 await expect(page.locator('[data-context-action="dimension-align"]')).toBeEnabled();
 await page.locator('[data-context-action="dimension-align"]').click();
 const aligned=await model(page);
 expect((await state(page)).dimensions).toEqual([0,1]);
 expect(aligned.constraints[0].dimension.y).toBeCloseTo(50);
 expect(aligned.constraints[1]).toEqual(before.constraints[1]);
 expect(aligned.points).toEqual(before.points);expect(aligned.lines).toEqual(before.lines);
 for(let i=0;i<2;i++) {
  expect(aligned.constraints[i].value).toBe(before.constraints[i].value);
  expect(aligned.constraints[i].expression).toBe(before.constraints[i].expression);
  expect(aligned.constraints[i].dimension.labelOffsetU).toBe(before.constraints[i].dimension.labelOffsetU);
 }
 await page.click('#undoBtn');expect((await model(page)).constraints).toEqual(before.constraints);
 await page.click('#redoBtn');expect((await model(page)).constraints).toEqual(aligned.constraints);
 expect((await page.evaluate(data=>window.__jot2dTest.loadDocumentFixtureForDragTest(data,'aligned.jot2d'),aligned)).success).toBe(true);
 expect((await model(page)).constraints).toEqual(aligned.constraints);
});

test('drag a selected dimension line moves parallel lines together preserving spacing and one undo',async({page})=>{
 const positions=await fixture(page);await selectBoth(page,positions);
 const before=await model(page);
 const start=await client(page,{x:15,y:-30}),end=await client(page,{x:23,y:-18});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up();
 const moved=await model(page);
 expect((await state(page)).dimensions).toEqual([0,1]);
 for(let i=0;i<2;i++) {
  expect(moved.constraints[i].dimension.y-before.constraints[i].dimension.y).toBeCloseTo(12,1);
  expect(moved.constraints[i].dimension.x).toBeCloseTo(before.constraints[i].dimension.x);
  expect(moved.constraints[i].dimension.labelOffsetU).toBe(before.constraints[i].dimension.labelOffsetU);
  expect(moved.constraints[i].value).toBe(before.constraints[i].value);
 }
 expect(moved.points).toEqual(before.points);expect(moved.lines).toEqual(before.lines);
 await page.click('#undoBtn');expect((await model(page)).constraints).toEqual(before.constraints);
 await page.click('#redoBtn');expect((await model(page)).constraints).toEqual(moved.constraints);
 expect((await page.evaluate(data=>window.__jot2dTest.loadDocumentFixtureForDragTest(data,'moved.jot2d'),moved)).success).toBe(true);
 expect((await model(page)).constraints).toEqual(moved.constraints);
});

test('nonparallel dimensions disable alignment and retain individual dragging',async({page})=>{
 await fixture(page);
 const positions=await page.evaluate(()=>{
  const t=window.__jot2dTest,data=t.serializedModelForTest();
  for(const point of data.points) if(point.y===80 && point.x===160){point.x=0;point.y=240;}
  const result=t.loadDocumentFixtureForDragTest(data,'nonparallel.jot2d');if(!result.success)throw Error(JSON.stringify(result));
  t.focusWorldForTest({x:60,y:100},2);
  return [t.dimensionClientPositionForTest(0),t.dimensionClientPositionForTest(1)];
 });
 await selectBoth(page,positions);const before=await model(page);
 await page.mouse.click(positions[0].x,positions[0].y,{button:'right'});
 await expect(page.locator('[data-context-action="dimension-align"]')).toBeDisabled();
 await page.keyboard.press('Escape');
 const start=await client(page,{x:15,y:-30}),end=await client(page,{x:15,y:-18});
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:6});await page.mouse.up();
 expect((await state(page)).dimensions).toEqual([0]);
 expect((await model(page)).constraints[1]).toEqual(before.constraints[1]);
});

test('dragging a selected label moves parallel lines together',async({page})=>{
 const positions=await fixture(page);await selectBoth(page,positions);
 const before=await model(page);
 const end=await client(page,{x:58,y:-18});
 await page.mouse.move(positions[0].x,positions[0].y);await page.mouse.down();
 await page.mouse.move(end.x,end.y,{steps:6});await page.mouse.up();
 expect((await state(page)).dimensions).toEqual([0,1]);
 const after=await model(page);
 for(let i=0;i<2;i++) {
  expect(after.constraints[i].dimension.y-before.constraints[i].dimension.y).toBeCloseTo(12,1);
  expect(after.constraints[i].dimension.labelOffsetU).toBe(before.constraints[i].dimension.labelOffsetU);
  expect(after.constraints[i].value).toBe(before.constraints[i].value);
 }
 expect(after.points).toEqual(before.points);
 await page.click('#undoBtn');expect((await model(page)).constraints).toEqual(before.constraints);
 await page.click('#redoBtn');expect((await model(page)).constraints).toEqual(after.constraints);
});

test('dragging a single selected label keeps individual editing',async({page})=>{
 const positions=await fixture(page);await page.mouse.click(positions[0].x,positions[0].y);
 const before=await model(page);
 await page.mouse.move(positions[0].x,positions[0].y);await page.mouse.down();
 await page.mouse.move(positions[0].x+30,positions[0].y+20,{steps:6});await page.mouse.up();
 expect((await state(page)).dimensions).toEqual([0]);
 const after=await model(page);expect(after.constraints[1]).toEqual(before.constraints[1]);
 expect(after.constraints[0].dimension).not.toEqual(before.constraints[0].dimension);
});

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
