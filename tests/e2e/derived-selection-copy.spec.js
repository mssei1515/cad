const { test, expect, openTestDocument, completeBlockEdit } = require('./test-fixture');
const state = page => page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
const client = (page, p) => page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), p);
async function rectangle(page, a, b, additive = false) {
  const start = await client(page,a), end = await client(page,b);
  if (additive) await page.keyboard.down('Shift');
  await page.mouse.move(start.x,start.y); await page.mouse.down();
  await page.mouse.move(end.x,end.y,{steps:8}); await page.mouse.up();
  if (additive) await page.keyboard.up('Shift');
}
async function fixture(page,type) {
  await openTestDocument(page); await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  const data=(await state(page)).serialized, sketchId=data.activeSketchId;
  data.constraints=[];
  const item={id:'I1',type,sketchId,sources:[{kind:'line',path:[data.lines[0].id]}],appearanceOverride:{color:'#cc3344'}};
  if(type==='mirror') item.axis={kind:'line',path:[data.lines[1].id]};
  if(type==='pattern') Object.assign(item,{direction:{kind:'line',path:[data.lines[2].id]},spacing:80,copies:2,reversed:false});
  if(type==='free') Object.assign(item,{x:40,y:0,origin:{x:-55,y:15},rotation:0,mirrorX:false,mirrorY:false});
  if(type==='sketchProjection') {
    data.sketches.push({...data.sketches.find(s=>s.id===sketchId),id:'S2',name:'Child',parentSketchId:sketchId});
    data.activeSketchId='S2';item.sketchId='S2';
  }
  data.geometryInstances=[item];
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d,'derived-copy.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
  await page.evaluate(()=>window.__jot2dTest.focusWorldForTest({x:30,y:0},2));
  return data;
}
for(const type of ['mirror','pattern','free','sketchProjection']) test(type+' rectangle selection, copy/paste, history and reload retain references',async({page})=>{
  await fixture(page,type);
  const instance=(await state(page)).instances[0],points=instance.points;
  const a={x:Math.min(...points.map(p=>p.x))-4,y:Math.min(...points.map(p=>p.y))-4};
  const b={x:Math.max(...points.map(p=>p.x))+4,y:Math.max(...points.map(p=>p.y))+4};
  await rectangle(page,a,b);expect((await state(page)).selectedIds).toEqual(['I1']);
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  let current=await state(page);expect(current.instances).toHaveLength(2);expect(current.instances.every(i=>i.valid)).toBe(true);
  const copy=current.serialized.geometryInstances.find(i=>i.id!=='I1');
  expect(copy.sources).toEqual(current.serialized.geometryInstances[0].sources);expect(copy.appearanceOverride).toEqual({color:'#cc3344'});
  await page.locator('#undoBtn').click();expect((await state(page)).instances).toHaveLength(1);
  await page.locator('#redoBtn').click();current=await state(page);expect(current.instances).toHaveLength(2);
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d),current.serialized)).toMatchObject({success:true});
  expect((await state(page)).instances.every(i=>i.valid)).toBe(true);
});

test('rectangle selection copies sources, axes and chained instances to new references',async({page})=>{
  const data=await fixture(page,'mirror');
  data.geometryInstances.push({...data.geometryInstances[0],id:'I2',sources:[{kind:'line',path:['I1',data.lines[0].id]}]});
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d,'chain.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
  await rectangle(page,{x:-65,y:-65},{x:75,y:65});
  expect((await state(page)).selectedIds.sort()).toEqual(['I1','I2']);
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  const current=await state(page);expect(current.instances).toHaveLength(4);expect(current.instances.every(i=>i.valid)).toBe(true);
  const copies=current.serialized.geometryInstances.filter(i=>!['I1','I2'].includes(i.id));
  expect(copies[0].sources[0].path[0]).not.toBe(data.lines[0].id);
  expect(copies[0].axis.path[0]).not.toBe(data.lines[1].id);
  expect(copies[1].sources[0].path[0]).toBe(copies[0].id);
  await rectangle(page,{x:140,y:70},{x:150,y:80});expect((await state(page)).selectedIds).toEqual([]);
});

test('invalid cross-sketch paste rolls back; copying source and axis permits a retry',async({page})=>{
  const data=await fixture(page,'mirror');
  data.sketches.push({...data.sketches.find(s=>s.id===data.activeSketchId),id:'S2',name:'Other',parentSketchId:data.activeSketchId});
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d,'owners.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
  await rectangle(page,{x:20,y:10},{x:60,y:40});await page.keyboard.press('Control+c');
  await page.locator('.sketch-item[data-id="S2"]').hover(); await page.locator('.sketch-item[data-id="S2"] .sketchEditBtn').click();
  const before=(await state(page)).serialized;await page.keyboard.press('Control+v');
  await expect(page.locator('#hint')).toContainText(/参照先|referenced/);
  let current=(await state(page)).serialized;expect(current.geometryInstances).toEqual(before.geometryInstances);expect(current.points).toEqual(before.points);
  await page.locator('.sketch-item[data-id="S1"]').hover(); await page.locator('.sketch-item[data-id="S1"] .sketchEditBtn').click();
  await rectangle(page,{x:-65,y:-65},{x:75,y:65});await page.keyboard.press('Control+c');
  await page.locator('.sketch-item[data-id="S2"]').hover(); await page.locator('.sketch-item[data-id="S2"] .sketchEditBtn').click();await page.keyboard.press('Control+v');
  current=(await state(page)).serialized;expect(current.geometryInstances).toHaveLength(2);
  expect(current.geometryInstances[1].sketchId).toBe('S2');expect((await state(page)).instances.every(i=>i.valid)).toBe(true);
});

test('copying a rotated free instance with its sources translates output only once',async({page})=>{
  const data=await fixture(page,'free');data.geometryInstances[0].rotation=Math.PI/3;data.geometryInstances[0].mirrorX=true;
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d,'rotated.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
  const before=(await state(page)).instances[0];
  await rectangle(page,{x:-65,y:-65},{x:90,y:65});await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  const current=await state(page),copy=current.instances.find(i=>i.id!=='I1');expect(copy.valid).toBe(true);
  const dx=copy.points[0].x-before.points[0].x,dy=copy.points[0].y-before.points[0].y;
  expect(dx).toBeGreaterThan(0);expect(dy).toBeCloseTo(dx,8);
  for(let i=0;i<copy.points.length;i++){expect(copy.points[i].x-before.points[i].x).toBeCloseTo(dx,8);expect(copy.points[i].y-before.points[i].y).toBeCloseTo(dy,8);}
});

test('legacy projection output IDs and attached dimensions reconnect on paste',async({page})=>{
  const data=await fixture(page,'sketchProjection');
  data.geometryInstances[0].legacyOutput={kind:'line',id:'OLDL1',pointIds:['OLDP1','OLDP2']};
  data.constraints=[{type:'distance',p1:'OLDP1',p2:'OLDP2',target:Math.hypot(30,20),expression:String(Math.hypot(30,20)),parameterName:'d1',sketchId:'S2',enabled:true,dimension:{kind:'aligned',offset:8}}];
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d,'legacy.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
  await rectangle(page,{x:-60,y:10},{x:-20,y:40});await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  const current=await state(page);expect(current.instances).toHaveLength(2);expect(current.instances.every(i=>i.valid)).toBe(true);
  expect(current.serialized.constraints).toHaveLength(2);
  const copy=current.serialized.constraints.find(c=>c.parameterName!=='d1');expect(copy.p1).toContain('@');expect(copy.p2).toContain('@');
  expect(current.serialized.geometryInstances[1].legacyOutput).toBeUndefined();
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d),current.serialized)).toMatchObject({success:true});
});

test('Block Editor copies local derived instances without modifying document instances',async({page})=>{
  const data=await fixture(page,'mirror');
  const definition={id:'B1',name:'Local mirror',parentDefinitionId:null,revision:1,origin:{x:0,y:0},blockInstances:[]};
  for(const key of ['sketches','activeSketchId','points','lines','circles','arcs','splines','constraints','geometryInstances','parameters','annotations','hatches','referenceImages','nextHatchIndex','nextDimensionParameterIndex'])definition[key]=structuredClone(data[key]);
  data.blockDefinitions=[definition];
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d,'scopes.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
  const original=(await state(page)).serialized.geometryInstances;
  await page.locator('.app-menu > summary').filter({hasText:/^(?:ブロック|Block)$/}).click();await page.locator('#openBlockDefinitionsBtn').click();
  await page.locator('.block-item[data-id="B1"] .blockEditBtn').click();
  await page.evaluate(()=>window.__jot2dTest.focusWorldForTest({x:30,y:0},2));
  await rectangle(page,{x:-65,y:-65},{x:75,y:65});await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  await completeBlockEdit(page);
  const saved=(await state(page)).serialized;expect(saved.geometryInstances).toEqual(original);expect(saved.blockDefinitions[0].geometryInstances).toHaveLength(2);
  expect(saved.blockDefinitions[0].geometryInstances[1].sources).not.toEqual(definition.geometryInstances[0].sources);
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d),saved)).toMatchObject({success:true});
});

test('a free instance copied with a projection keeps its independent paste displacement',async({page})=>{
  const data=await fixture(page,'sketchProjection');
  data.geometryInstances.push({id:'FI1',type:'free',sketchId:'S2',sources:[{kind:'line',path:['I1',data.lines[0].id]}],origin:{x:-55,y:15},x:30,y:0,rotation:0,mirrorX:false,mirrorY:false,appearanceOverride:{}});
  expect(await page.evaluate(d=>window.__jot2dTest.loadDocumentFixtureForDragTest(d,'projected-free.jot2d',{resetLoadedHistory:true}),data)).toMatchObject({success:true});
  const before=(await state(page)).instances.find(i=>i.id==='FI1');
  await rectangle(page,{x:-65,y:-10},{x:65,y:40});await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  const current=await state(page),copy=current.instances.find(i=>i.type==='free'&&i.id!=='FI1');expect(current.instances).toHaveLength(4);
  expect(copy.points[0].x-before.points[0].x).toBeGreaterThan(0);
  expect(copy.points[0].y-before.points[0].y).toBeCloseTo(copy.points[0].x-before.points[0].x,8);
});
