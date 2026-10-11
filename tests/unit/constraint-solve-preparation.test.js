const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const p of ['src/geometry/geometry_kernel.js','src/geometry/spline_geometry.js','src/solver/constraint_solver.js','src/solver/constraint_solve_preparation.js']) vm.runInContext(fs.readFileSync(p,'utf8'),sandbox);
const G=sandbox.window.GeometrySolver, K=sandbox.window.GeometryKernel;
const point=(x,y)=>new G.Point('p',x,y), line=(x1,y1,x2,y2)=>new G.Line('l',point(x1,y1),point(x2,y2));
const arc=(x,y,r,start=0,end=Math.PI)=>new G.Arc('a',point(x,y),r,start,end);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9, String(a)+' != '+String(b));
function fixture() {
 const fixed=new Set(), state={ sync:0, plan:null }, solver={maxStepNorm:2,syncLineOrientationHints:()=>state.sync++};
 const preparation=sandbox.window.ConstraintSolvePreparation.create({ solver,types:G,hasDirectRadiusDimension:a=>fixed.has(a),
  unwrapAngleNear:K.unwrapAngleNear,hypot2:G.hypot2,arcEndpointPoint:K.arcEndpointPoint,lineNormal:K.lineNormal,
  offsetChainDraft:(...args)=>{state.args=args;return state.plan;},vectorNorm:G.vectorNorm,minimumOrientationLength:1e-8,minimumLineLength:1e-4 });
 return {preparation,fixed,state,solver};
}
test('arc endpoint on support line expands only free radius and leaves directly dimensioned radius intact',()=>{
 const f=fixture(), support=line(-10,0,10,0);support.orientationHint='horizontal'; const a=arc(0,5,1);
 f.preparation.precondition(new G.ArcEndpointOnLineConstraint(a,'start',support));
 assert.ok(a.radiusValue>5);near(K.arcEndpointPoint(a,'start').y,0);assert.equal(f.state.sync,1);
 const pinned=arc(0,5,1);f.fixed.add(pinned);f.preparation.precondition(new G.ArcEndpointOnLineConstraint(pinned,'end',support));
 assert.equal(pinned.radiusValue,1);assert.equal(pinned.endAngle,Math.PI);
});
test('endpoint coincidence preserves angle winding and directly dimensioned radius',()=>{
 const f=fixture(), a=arc(0,0,1,4*Math.PI,5*Math.PI),p=point(0,3);
 f.preparation.precondition(new G.ArcEndpointCoincidentConstraint(a,'start',p));near(a.radiusValue,3);near(a.startAngle,4*Math.PI+Math.PI/2);
 assert.equal(a.endAngle,5*Math.PI);f.fixed.add(a);f.preparation.precondition(new G.ArcEndpointCoincidentConstraint(a,'end',point(4,0)));
 assert.equal(a.radiusValue,3);near(a.endAngle,6*Math.PI);
 const radius=a.radiusValue;f.preparation.precondition(new G.ArcEndpointCoincidentConstraint(a,'start',a.center));assert.equal(a.radiusValue,radius);
});
test('arc pair preserves the directly dimensioned source and adjusts the other endpoint',()=>{
 const f=fixture(),a=arc(0,0,5),b=arc(10,0,1);f.fixed.add(a);
 f.preparation.precondition(new G.ArcEndpointArcEndpointCoincidentConstraint(a,'start',b,'end'));
 near(a.radiusValue,5);near(K.arcEndpointPoint(b,'end').x,5);near(K.arcEndpointPoint(b,'end').y,0);
});
test('line and arc offsets update existing geometry while preserving source references',()=>{
 const f=fixture(),s=line(0,0,10,0),o=line(50,50,60,50),p1=o.p1;
 f.preparation.precondition(new G.OffsetConstraint(s,o,3,1));near(o.p1.x,0);near(o.p1.y,3);near(o.p2.x,10);assert.equal(o.p1,p1);assert.equal(s.p1.y,0);
 const a=arc(2,3,5,0.5,2),b=arc(0,0,1);const center=b.center;
 f.preparation.precondition(new G.OffsetConstraint(a,b,2,-1));assert.equal(b.center,center);near(b.center.x,2);near(b.radiusValue,3);near(b.startAngle,0.5);near(b.endAngle,2);
});
test('offset chain requires a complete valid plan and retains offset objects and point identities',()=>{
 const f=fixture(),s=line(0,0,10,0),o=line(0,0,1,1),a=arc(0,0,1),p=o.p1;
 const c=new G.OffsetChainConstraint([s,s],[o,a],3,-1,[true,false],true);
 f.state.plan={ok:false};f.preparation.precondition(c);assert.equal(o.p2.x,1);
 f.state.plan={ok:true,geometries:[line(4,5,6,7)]};f.preparation.precondition(c);assert.equal(o.p2.x,1);
 f.state.plan={ok:true,geometries:[line(4,5,6,7),arc(8,9,10,1,2)]};f.preparation.precondition(c);
 assert.equal(o.p1,p);near(o.p1.x,4);near(o.p2.y,7);near(a.center.x,8);near(a.radiusValue,10);
 assert.equal(f.state.args[0][0].geometry,s);assert.equal(f.state.args[0][0].reversed,true);assert.equal(f.state.args[3],true);
});
test('step norm handles scalar and vector errors and restores nested temporary changes after exceptions',()=>{
 const f=fixture();assert.equal(f.preparation.stepNorm(null),2);assert.equal(f.preparation.stepNorm({error:()=>[3,4]}),7.5);
 assert.equal(f.preparation.stepNorm({error:()=>1}),2);assert.equal(f.preparation.stepNorm({error:()=>4}),6);
 const failure=new Error('solve failed');assert.throws(()=>f.preparation.withStepNorm(7.5,()=>{
  assert.equal(f.solver.maxStepNorm,7.5);f.preparation.withStepNorm(Infinity,()=>assert.equal(f.solver.maxStepNorm,7.5));
  f.preparation.withStepNorm(10,()=>assert.equal(f.solver.maxStepNorm,10));assert.equal(f.solver.maxStepNorm,7.5);throw failure;
 }),error=>error===failure);assert.equal(f.solver.maxStepNorm,2);
 assert.equal(f.preparation.withStepNorm(1,()=>42),42);assert.equal(f.solver.maxStepNorm,2);
});
