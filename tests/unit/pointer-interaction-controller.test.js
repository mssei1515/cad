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
