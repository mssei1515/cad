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
