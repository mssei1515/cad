const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/pointer_interaction_controller.js'), 'utf8'), sandbox);
function fixture() {
  const f={calls:[],mode:'select',pan:false,authoring:false,ordinary:true,constraint:true,pending:null,pendingConstraint:null,last:null,dimensionHit:null,identity:null};
  const record=name=>(...args)=>{f.calls.push(name);};
  f.hover={current:{spline:{id:'kept'}},update:values=>{Object.assign(f.hover.current,values);f.calls.push('hover');},clear:()=>{f.hover.current={};f.calls.push('clearHover');}};
  f.rectangle={active:false,update:record('rectangle')}; f.annotation={active:false,update:record('annotation')};
  f.image={dragging:false,calibrating:false,updateDrag:record('image')};f.dimension={active:false,update:record('dimension')};f.geometry={active:false,update:record('geometry')};
  const controller=sandbox.window.PointerInteractionController.create({canvasNavigation:{movePan:()=>{f.calls.push('pan');return f.pan;}},
    drawingPreview:{updateFreeInstance:record('free'),setPointer:record('pointer'),updateAuthoring:(mode,p,shift)=>{f.calls.push('authoring');f.authoringArgs=[mode,p,shift];return f.authoring;},updateTrim:record('trim'),updateOffset:(p,value)=>{f.calls.push('offset');f.offsetValue=value;}},
    canvasHover:f.hover,clearSnap:record('clearSnap'),draw:record('draw'),selectionRectangle:f.rectangle,annotationDrag:f.annotation,
    referenceImageInteraction:f.image,dimensionDrag:f.dimension,geometryDrag:f.geometry,
    pointerHover:{updateConstraint:(p,type)=>{f.calls.push('constraint:'+type);return f.constraint;},updateOrdinary:()=>{f.calls.push('ordinary');return f.ordinary;}},
    getMode:()=>f.mode,getPendingCommand:()=>f.pending,getPendingConstraintCommand:()=>f.pendingConstraint,
    setLastPointer:p=>{f.last=p;f.calls.push('last');},updateHatchPreview:record('hatch'),updateFilletRadiusPlacement:record('fillet'),
    updatePendingDistanceRetargetHover:record('retarget'),hitDimension:()=>{f.calls.push('hitDimension');return f.dimensionHit;},
    hitSketchIdentityElement:(x,y,options)=>{assert.equal(options.allowInactiveGeometry,true);return f.identity;}});
  f.point={x:3,y:4};f.move=()=>controller.move({x:30,y:40},f.point,true);return f;
}
test('pan consumes input before last pointer and free-instance placement takes priority over dragging',()=>{
  const f=fixture();f.pan=true;f.annotation.active=true;f.move();assert.deepEqual(f.calls,['pan']);assert.equal(f.last,null);
  f.pan=false;f.mode='free-instance-mirror';f.calls=[];f.move();assert.deepEqual(f.calls,['pan','last','free']);assert.equal(f.last,f.point);
});
test('hatch, rectangle, annotation, image and calibration preserve exclusive precedence',()=>{
  const f=fixture();f.mode='hatch-repair';f.rectangle.active=true;f.annotation.active=true;f.image.dragging=true;f.image.calibrating=true;
  f.move();assert.deepEqual(f.calls,['pan','last','clearSnap','clearHover','pointer','hatch','draw']);
  f.calls=[];f.mode='select';f.move();assert.deepEqual(f.calls,['pan','last','clearSnap','hover','rectangle','draw']);
  f.calls=[];f.rectangle.active=false;f.move();assert.deepEqual(f.calls,['pan','last','clearSnap','annotation']);
  f.calls=[];f.annotation.active=false;f.move();assert.deepEqual(f.calls,['pan','last','clearSnap','image']);
  f.calls=[];f.image.dragging=false;f.move();assert.deepEqual(f.calls,['pan','last','clearSnap','clearHover','draw']);
});
test('annotation and fillet placement precede dimension dragging and retain partial hover clearing',()=>{
  const f=fixture();f.pending={type:'annotation-text-place'};f.dimension.active=true;f.move();
  assert.equal(f.pending.pointer,f.point);assert.deepEqual(f.calls,['pan','last','hover','draw']);assert.equal(f.hover.current.spline.id,'kept');
  f.calls=[];f.pending={type:'fillet-radius-place'};f.move();assert.deepEqual(f.calls,['pan','last','clearSnap','hover','fillet','draw']);
  f.calls=[];f.pending=null;f.move();assert.deepEqual(f.calls,['pan','last','dimension']);
});
test('authoring consumption skips later stages while fallthrough allows distance placement before Trim',()=>{
  const f=fixture();f.mode='trim';f.pending={type:'distance-place',dimension:{}};f.authoring=true;f.move();
  assert.deepEqual(f.calls,['pan','last','authoring']);assert.equal(f.pending.pointer,undefined);
  f.authoring=false;f.calls=[];const c={id:'D'};f.dimensionHit={constraint:c};f.identity={id:'other'};f.move();
  assert.deepEqual(f.calls,['pan','last','authoring','clearSnap','hitDimension','hover','retarget','hover','draw']);
  assert.equal(f.pending.pointer,f.point);assert.equal(f.pending.dimension,null);assert.equal(f.hover.current.dimension,c);assert.equal(f.hover.current.sketchIdentity,f.identity);
  assert.equal(f.authoringArgs[2],true);
});
test('Trim and Offset consume input before hover and Offset receives value-entry state',()=>{
  const f=fixture();f.mode='trim';f.move();assert.deepEqual(f.calls,['pan','last','authoring','trim']);
  f.calls=[];f.mode='offset';f.pending={type:'offset-value'};f.move();assert.deepEqual(f.calls,['pan','last','authoring','offset']);assert.equal(f.offsetValue,true);
});
test('constraint hover consumes idle moves while ordinary hover falls through to geometry drag update',()=>{
  const f=fixture();f.pendingConstraint={type:'distance'};f.move();assert.deepEqual(f.calls,['pan','last','authoring','constraint:distance','draw']);
  f.calls=[];f.geometry.active=true;f.move();assert.deepEqual(f.calls,['pan','last','authoring','geometry']);
  f.calls=[];f.geometry.active=false;f.pendingConstraint=null;f.move();assert.deepEqual(f.calls,['pan','last','authoring','ordinary','draw','geometry']);
  f.calls=[];f.ordinary=false;f.move();assert.deepEqual(f.calls,['pan','last','authoring','ordinary','geometry']);
});


test('completion stops at the consuming interaction and forwards the original pointer event', () => {
  const names = ['pan', 'image', 'annotation', 'dimension', 'rectangle', 'geometry'];
  for (const consumed of names) {
    const calls = [];
    const event = { pointerId: 7, type: 'pointerup' };
    const finish = name => input => { assert.equal(input, event); calls.push(name); return name === consumed; };
    const controller = sandbox.window.PointerInteractionController.create({
      canvasNavigation: { endPan: finish('pan') }, referenceImageInteraction: { finishDrag: finish('image') },
      annotationDrag: { finish: finish('annotation') }, dimensionDrag: { finish: finish('dimension') },
      selectionRectangle: { finish: finish('rectangle') }, geometryDrag: { finish: finish('geometry') },
      transientAuthoring: { hasLineStart: false }, recordHistory: () => assert.fail('consumed interaction must own its history'),
    });
    controller.finish(event);
    assert.deepEqual(calls, names.slice(0, names.indexOf(consumed) + 1));
  }
});

test('unconsumed completion records history except while a provisional line endpoint exists', () => {
  const history = [];
  const transientAuthoring = { hasLineStart: true };
  const idle = () => false;
  const controller = sandbox.window.PointerInteractionController.create({
    canvasNavigation: { endPan: idle }, referenceImageInteraction: { finishDrag: idle },
    annotationDrag: { finish: idle }, dimensionDrag: { finish: idle },
    selectionRectangle: { finish: idle }, geometryDrag: { finish: idle },
    transientAuthoring, recordHistory: label => history.push(label),
  });
  controller.finish({ pointerId: 3 });
  assert.deepEqual(history, []);
  transientAuthoring.hasLineStart = false;
  controller.finish({ pointerId: 3 });
  assert.deepEqual(history, ['操作']);
});


vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/canvas_press_query.js'), 'utf8'), sandbox);
function pressFixture() {
  const f={calls:[],mode:'select',pending:null,consume:null,repeat:false,calibrating:false,hits:{},point:{x:1,y:2}};
  const stage=name=>(...args)=>{f.calls.push(name);f[name+'Args']=args;return f.consume===name;};
  const input=name=>({click:stage(name)});
  const controller=sandbox.window.PointerInteractionController.create({getMode:()=>f.mode,getPendingCommand:()=>f.pending,
    canvasNavigation:{beginPan:stage('pan')},referenceImageInteraction:{get calibrating(){return f.calibrating;}},
    canvasHover:{update:stage('hover')},setLastPointer:stage('last'),press:{
      closeContextMenu:stage('close'),worldPoint:()=>{f.calls.push('world');return f.point;},screenPoint:()=>({x:10,y:20}),
      query:{read:p=>{assert.equal(p,f.point);f.calls.push('query');return f.hits;}},insertDimensionParameter:stage('parameter'),commitHatch:stage('hatch'),calibrateImage:stage('calibration'),
      blankGesture:{isRepeated:()=>{f.calls.push('repeat');return f.repeat;},handle:stage('blank'),suppressNext:stage('suppress')},
      placeFilletRadius:stage('fillet'),placeBlock:stage('block'),inputs:{instance:input('instance'),annotation:{place:stage('annotationPlace'),select:stage('annotationSelect')},constraint:input('constraint'),drawing:input('drawing'),selection:{begin:stage('selection')}}}});
  f.event={button:0,preventDefault:()=>f.calls.push('prevent')};f.down=()=>controller.down(f.event);return f;
}
test('press buttons return before world query and normal presses traverse the established input order',()=>{
  const f=pressFixture();f.event.button=2;f.down();assert.deepEqual(f.calls,['prevent']);
  f.event.button=1;f.calls=[];f.down();assert.deepEqual(f.calls,['close','pan']);
  f.event.button=0;f.calls=[];f.down();assert.deepEqual(f.calls,['close','world','last','query','hover','instance','repeat','annotationPlace','annotationSelect','constraint','drawing','selection']);
});
test('each consumed press stops subsequent command input',()=>{
  const order=['instance','repeat','annotationPlace','annotationSelect','constraint','drawing','selection'];
  for(const consumer of order.filter(x=>x!=='repeat')){const f=pressFixture();f.consume=consumer;f.down();assert.deepEqual(f.calls.slice(5),order.slice(0,order.indexOf(consumer)+1));}
});
test('dimension parameter insertion precedes Hatch and calibration while Hatch wins over calibration',()=>{
  const f=pressFixture();f.hits.hitD={};f.mode='hatch';f.calibrating=true;f.consume='parameter';f.down();assert.equal(f.calls.at(-1),'parameter');
  f.consume=null;f.calls=[];f.down();assert.deepEqual(f.calls.slice(5),['parameter','prevent','hatch']);
  f.mode='select';f.calls=[];f.down();assert.deepEqual(f.calls.slice(5),['parameter','prevent','calibration']);
});
test('blank double click suppresses native duplicate and Fillet and Block placement retain their positions',()=>{
  const f=pressFixture();f.repeat=true;f.consume='blank';f.down();assert.deepEqual(f.calls.slice(5),['instance','repeat','blank','suppress','prevent']);
  f.repeat=false;f.consume=null;f.pending={type:'fillet-radius-place'};f.calls=[];f.down();assert.deepEqual(f.calls.slice(5),['instance','repeat','annotationPlace','prevent','fillet']);
  f.pending=null;f.mode='block-place';f.calls=[];f.down();assert.deepEqual(f.calls.slice(5),['instance','repeat','annotationPlace','annotationSelect','constraint','prevent','block']);
});
test('press hit snapshot preserves handle and derived-geometry short circuits and direct classification',()=>{
  const values={},calls=[];
  const hit=name=>(x,y,options)=>{assert.equal(x,1);assert.equal(y,2);calls.push(name);if(name==='hitSketchIdentityElement')assert.equal(options.allowInactiveGeometry,true);return values[name]||null;};
  const geometry=Object.fromEntries(['hitPoint','hitLine','hitCircle','hitArcEndpoint','hitArc','hitSpline'].map(n=>[n,hit(n)]));
  const scene=Object.fromEntries(['hitHatchAt','hitReferenceImageAt','hitDimension','hitBlockRotationHandle','hitBlockInstance','hitDerivedGeometryForDrag','hitGeometryInstance','hitSketchIdentityElement','hitAnnotationElement','hitAnnotationTarget'].map(n=>[n,hit(n)]));
  const query=sandbox.window.CanvasPressQuery.create({geometry,scene}),point={x:1,y:2};
  values.hitPoint={blockProjection:true};values.hitBlockRotationHandle={id:'B'};values.hitDerivedGeometryForDrag={instance:{id:'I'}};
  const result=query.read(point);assert.equal(result.hitBlock,values.hitBlockRotationHandle);assert.equal(result.hitDerivedInstance,values.hitDerivedGeometryForDrag.instance);assert.equal(result.directGeometryHit,true);
  assert.equal(calls.includes('hitBlockInstance'),false);assert.equal(calls.includes('hitGeometryInstance'),false);assert.equal(result.inactiveHit,null);
  values.hitDerivedGeometryForDrag=null;values.hitBlockRotationHandle=null;calls.length=0;assert.equal(query.read(point).directGeometryHit,false);assert.ok(calls.includes('hitBlockInstance'));assert.ok(calls.includes('hitGeometryInstance'));
  values.hitSpline={id:'S'};assert.equal(query.read(point).directGeometryHit,true);
});
