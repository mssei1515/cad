const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/dimension_drag.js', 'utf8'), sandbox);
function fixture(kind = 'distance', part = 'line') {
  const state = { commandActive: false, angleResult: {} }, events = [], constraint = {};
  const hit = { constraint, target: { kind }, part, dimension: { labelOffsetU: 7, display: { text: 'kept' } } };
  const command = sandbox.window.DimensionDrag.create({ dimensionAnchor: () => ({ x: 10, y: 20 }), migrateAngleDimensionLabelPlacement: () => {},
    canvasSelection: { set: (key, value) => events.push(['selection', key, value]) }, angleDimensionLabelOffsets: () => ({ radial: 4, tangent: 5 }), viewScale: () => 2,
    isDimensionConstraintCommandActive: () => state.commandActive, beginPointer: id => events.push(['begin', id]), endPointer: id => events.push(['end', id]),
    setHint: text => events.push(['hint', text]), clearSnap: () => events.push('snap'), hypot2: Math.hypot,
    angleDimensionFromLabelPoint: () => state.angleResult, dimensionWithLabelAt: (_target, dimension, p) => ({ ...dimension, labelX: p.x, labelY: p.y }),
    dimensionFromAnchor: (_target, anchor, options) => { assert.equal(options.allowPointAxis, false); return { x: anchor.x, y: anchor.y }; },
    setAngleDimensionLabelOffsets: (dimension, offsets) => Object.assign(dimension, offsets),
    syncAngleConstraintFromDimension: () => events.push('sync'), draw: () => events.push('draw'), continueCommandClick: (_event, hits) => events.push(['click', hits]),
    updateUI: () => events.push('ui'), updateGeometrySelectionUI: () => events.push('selectionUI'), syncDimensionValueInput: () => events.push('input'), recordHistory: label => events.push(['history', label]) });
  const begin = (hits = null) => command.begin({ pointerId: 3 }, hit, { x: 1, y: 2 }, hits);
  return { state, events, constraint, hit, command, begin };
}
test('dimension command click threshold returns to operand input without modifying layout or history', () => {
  const f = fixture(); f.state.commandActive = true; const hits = { hitP: {} }; f.begin(hits);
  f.command.update({ x: 2.5, y: 2 }); assert.equal(f.constraint.dimension, undefined);
  f.command.finish({ pointerId: 3 }); assert.equal(f.command.active, false); assert.equal(f.events.at(-1)[1], hits);
  assert.equal(f.events.some(e => e[0] === 'history'), false);
});
test('dimension line drag keeps display and label offsets and commits through layout notifications', () => {
  const f = fixture(); f.state.commandActive = true; f.begin(); f.command.update({ x: 4, y: 6 });
  assert.deepEqual([f.constraint.dimension.x, f.constraint.dimension.y, f.constraint.dimension.labelOffsetU], [13, 24, 7]);
  assert.equal(f.constraint.dimension.display.text, 'kept'); assert.notEqual(f.constraint.dimension.display, f.hit.dimension.display);
  f.events.length = 0; assert.equal(f.command.finish({ pointerId: 3 }), true);
  assert.deepEqual(f.events.map(e => Array.isArray(e) ? e[0] : e), ['end', 'hint', 'selectionUI', 'input', 'draw', 'history']);
});
test('radius labels anchor at the pointer and angle labels tolerate unresolved placement', () => {
  const radius = fixture('radius', 'label'); radius.begin(); radius.command.update({ x: 4, y: 6 });
  assert.deepEqual([radius.constraint.dimension.x, radius.constraint.dimension.y, radius.constraint.dimension.labelX], [4, 6, 4]);
  const angle = fixture('angle', 'label'); angle.begin(); angle.state.angleResult = null; angle.command.update({ x: 4, y: 6 }); assert.equal(angle.constraint.dimension, undefined);
  angle.state.angleResult = { radial: 9 }; angle.command.update({ x: 4, y: 6 }); assert.equal(angle.constraint.dimension.display.text, 'kept');
  angle.events.length = 0; angle.command.finish({ pointerId: 3 }); assert.equal(angle.events.includes('ui'), true); assert.equal(angle.events.includes('input'), false);
});
test('parallel group drag preserves selection and commits one history entry', () => {
  const events = [], reference = {}, group = {};
  const command = sandbox.window.DimensionDrag.create({
    dimensionAnchor: () => ({ x: 0, y: 0 }), migrateAngleDimensionLabelPlacement: () => {},
    canvasSelection: { set: key => events.push(key) }, isDimensionConstraintCommandActive: () => false,
    selectedLineGroup: constraint => { assert.equal(constraint, reference); return group; },
    translateLineGroup: (actual, delta) => { assert.equal(actual, group); events.push([delta.x, delta.y]); },
    beginPointer: () => {}, endPointer: () => {}, setHint: () => {}, clearSnap: () => {}, draw: () => {},
    updateGeometrySelectionUI: () => {}, syncDimensionValueInput: () => {}, recordHistory: () => events.push('history'),
  });
  command.begin({ pointerId: 1 }, { constraint: reference, target: { kind: 'line-length' }, part: 'line' }, { x: 2, y: 3 });
  command.update({ x: 9, y: 11 }); command.finish({ pointerId: 1 });
  assert.deepEqual(events, ['constraint', [7, 8], 'history']);
});

test('angle line offsets survive dragging and reset discards the session without committing', () => {
  const f = fixture('angle'); f.begin(); f.command.update({ x: 4, y: 6 });
  assert.deepEqual([f.constraint.dimension.radial, f.constraint.dimension.tangent], [4, 5]); assert.equal(f.command.constraint, f.constraint);
  f.command.reset(); assert.equal(f.command.active, false); assert.equal(f.command.constraint, undefined); assert.equal(f.command.finish({ pointerId: 3 }), false);
  assert.equal(f.events.some(e => e[0] === 'history'), false);
});


function angleSyncFixture(){
 const calls=[],state={readOnly:false,signed:-2,onAngles:null,fail:null};
 class LineAngleConstraint{constructor(){this.values={startFlip:4,endFlip:5,target:6};for(const key of ['startFlip','endFlip','target'])Object.defineProperty(this,key,{get:()=>this.values[key],set:value=>{this.values[key]=value;calls.push([key,value]);}});}}
 const constraint=new LineAngleConstraint(),target={kind:'angle'},dimension={angleStartFlip:false,angleEndFlip:true};
 const service=sandbox.window.DimensionDrag.createAngleSynchronization({LineAngleConstraint,
  isReadOnlyDimension:value=>{assert.equal(value,constraint);calls.push('readOnly');return state.readOnly;},
  angleDimensionAngles:(value,pointer,placement)=>{assert.equal(value,target);assert.equal(pointer,null);assert.equal(placement,dimension);calls.push('angles');if(state.fail)throw state.fail;state.onAngles?.();return{signed:state.signed};},
 });return{service,constraint,target,dimension,calls,state};
}

test('angle synchronization rejects other constraint types, target kinds and absent placements before any model query',()=>{
 const f=angleSyncFixture();assert.deepEqual(f.calls,[]);
 assert.equal(f.service.sync({}, {get kind(){throw Error('wrong type must short circuit');}}, {}),undefined);
 assert.equal(f.service.sync(f.constraint,{kind:'distance'},f.dimension),undefined);
 assert.equal(f.service.sync(f.constraint,f.target,null),undefined);assert.deepEqual(f.calls,[]);
});

test('readonly angle placement does not calculate or overwrite flip and target values',()=>{
 const f=angleSyncFixture();f.state.readOnly=true;f.service.sync(f.constraint,f.target,f.dimension);
 assert.deepEqual(f.calls,['readOnly']);assert.deepEqual(f.constraint.values,{startFlip:4,endFlip:5,target:6});
});

test('angle synchronization calculates first then uses current flip flags and absolute angle while calculation errors preserve values',()=>{
 const f=angleSyncFixture();f.state.onAngles=()=>{f.dimension.angleStartFlip='true';};
 assert.equal(f.service.sync(f.constraint,f.target,f.dimension),undefined);
 assert.deepEqual(f.calls,['readOnly','angles',['startFlip',1],['endFlip',1],['target',2]]);
 f.calls.length=0;f.state.fail=new Error('angles failed');const prior={...f.constraint.values};
 assert.throws(()=>f.service.sync(f.constraint,f.target,f.dimension),value=>value===f.state.fail);
 assert.deepEqual(f.calls,['readOnly','angles']);assert.deepEqual(f.constraint.values,prior);
});
