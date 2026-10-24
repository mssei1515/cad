const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
for (const file of ['geometry/geometry_kernel','geometry/geometry_ref','geometry/spline_geometry','solver/constraint_solver','constraints/dimension_queries']) {
  vm.runInContext(fs.readFileSync('src/' + file + '.js','utf8'),sandbox,{filename:file});
}
const g = sandbox.window.GeometrySolver, query = sandbox.window.DimensionQueries;

test('bound dimension queries retain live scope, independent active Sketch, short circuit and primitive identity',()=>{
  const center = new g.Point('P1',0,0), circle = new g.Circle('C1',center,10), other = new g.Circle('C1',center,10);
  const radius = Object.assign(new g.RadiusConstraint(circle,10),{id:'radius',sketchId:'S1',enabled:false,dimension:{}});
  const marker = new Error('dimension getter'), first = {id:'other',sketchId:'other',get dimension(){throw marker;}};
  const last = {id:'last',sketchId:'S1',dimension:{}}, calls=[];
  const state={ready:false,active:'S1',scope:{activeSketchId:'different',constraints:[first,radius,last]}};
  const api=query.createModelQueries({currentScope:()=>{assert.equal(state.ready,true);calls.push('scope');return state.scope;},
    activeSketchId:()=>{assert.equal(state.ready,true);calls.push('active');return state.active;},
    constraintSketchId:constraint=>{calls.push(constraint.id);if(constraint===last)assert.fail('selection must short circuit');return constraint.sketchId;}});
  assert.deepEqual(calls,[]);state.ready=true;
  assert.equal(api.sketchHasDimensionConstraint(),true);assert.deepEqual(calls,['active','scope','other','radius']);
  assert.equal(api.hasDirectRadiusDimension(circle),false);radius.enabled=true;
  assert.equal(api.hasDirectRadiusDimension(circle),true);assert.equal(api.hasDirectRadiusDimension(other),false);
  calls.length=0;const constraints=state.scope.constraints;
  assert.throws(()=>api.sketchHasDimensionConstraint('other'),error=>error===marker);assert.equal(state.scope.constraints,constraints);assert.deepEqual(calls,['scope','other']);
  state.scope={activeSketchId:'S2',constraints:[Object.assign(new g.DiameterConstraint(other,20),{id:'diameter',sketchId:'S2'})]};
  assert.equal(api.hasDirectRadiusDimension(circle),false);assert.equal(api.hasDirectRadiusDimension(other),true);
  assert.equal(api.sketchHasDimensionConstraint(),false);state.scope.constraints[0].dimension={};assert.equal(api.sketchHasDimensionConstraint(),false);
  assert.equal(api.sketchHasDimensionConstraint('S2'),true);state.active='S2';assert.equal(api.sketchHasDimensionConstraint(),true);
  state.scope.constraints=[{id:'null',sketchId:null,dimension:{}}];calls.length=0;
  assert.equal(api.sketchHasDimensionConstraint(null),true);assert.deepEqual(calls,['scope','null']);
});

test('constraint measurements preserve default target/dimension, angle radians, explicit overrides and argument getter timing',()=>{
  const origin = new g.Point('P1',0,0), x = new g.Point('P2',10,0), y = new g.Point('P3',5,Math.sqrt(75));
  const line1 = new g.Line('L1',origin,x), line2 = new g.Line('L2',origin,y);
  const dimension={angleStartFlip:0,angleEndFlip:0};const constraint=new g.LineAngleConstraint(line1,line2,Math.PI/3);constraint.dimension=dimension;
  assert.ok(Math.abs(query.measuredConstraintTargetValue(constraint)-Math.PI/3)<1e-12);
  assert.ok(Math.abs(query.measuredConstraintTargetValue(constraint,undefined,{angleStartFlip:1,angleEndFlip:0})-2*Math.PI/3)<1e-12);
  assert.equal(constraint.dimension,dimension);assert.deepEqual(dimension,{angleStartFlip:0,angleEndFlip:0});
  assert.equal(query.measuredConstraintTargetValue(constraint,{kind:'line-length',line:line1},null),10);
  const instance={placement:{angleStep:-0.7}};
  assert.ok(Math.abs(query.measuredConstraintTargetValue(null,{kind:'angle',interval:true,instance})+0.7)<1e-12);
  assert.equal(instance.placement.angleStep,-0.7);assert.equal(Number.isNaN(query.measuredConstraintTargetValue(null)),true);
  const marker=new Error('default dimension');const value={get dimension(){throw marker;}};
  assert.throws(()=>query.measuredConstraintTargetValue(value,null),error=>error===marker);
  assert.equal(Number.isNaN(query.measuredConstraintTargetValue(value,null,null)),true);
});
