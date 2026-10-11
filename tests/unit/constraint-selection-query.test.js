const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/editing/constraint_selection_query.js','utf8'),sandbox);
function fixture() {
 const calls=[],session={command:null,operands:[]},targets={},selection={points:[],lines:[],circles:[],arcs:[],splines:[],blockInstances:[],geometryInstances:[],annotations:[],hatches:[],referenceImages:[],currentConstraintTargets:()=>targets};
 selection.selectedElementCount=()=>[selection.points,selection.lines,selection.circles,selection.arcs,selection.splines,selection.blockInstances,selection.geometryInstances,selection.annotations,selection.hatches,selection.referenceImages].reduce((n,a)=>n+a.length,0);
 const state={edit:true,mode:true,eligible:true,target:{kind:'line-length'},constraint:{},resolution:null,converted:[]};
 const query=sandbox.window.ConstraintSelectionQuery.create({session,selection,
  candidates:{distanceTargetFromTargets:t=>{assert.equal(t,targets);calls.push('target');return state.target;},
   canApplyConstraintToTargets:(type,t,id)=>{assert.equal(t,targets);calls.push(['eligible',type,id]);return state.eligible;},
   constraintFromTargets:(type,t,id)=>{assert.equal(t,targets);calls.push(['constraint',type,id]);return state.constraint;}},
  resolveConstraintIntent:(type,operands)=>{calls.push(['resolve',type,operands]);return state.resolution;},
  constraintOperandsFromSelection:()=>{calls.push('convert');return state.converted;},activeSketchId:()=> 'S',isGeometryMode:()=>state.mode,
  elementSketchId:item=>item.sketchId,canEditSketch:(id,op)=>{calls.push(['edit',id,op]);return state.edit;},
  findLineFixedConstraint:item=>item.fixedConstraint, selectedGeometryItems:()=>[...selection.points,...selection.lines,...selection.circles,...selection.arcs,...selection.splines],
 });return {query,calls,session,selection,state};
}
test('mode gating prevents capability analysis while unrelated command type falls back to current selection',()=>{
 const f=fixture();f.state.mode=false;assert.equal(f.query.canApply('parallel'),false);assert.deepEqual(f.calls,[]);
 f.state.mode=true;f.session.command={type:'distance'};f.session.operands=[{}];assert.equal(f.query.canApply('parallel'),true);
 assert.deepEqual(f.calls,[['eligible','parallel','S']]);
});
test('matching command capabilities use its ordered operands and propagate rejection without changing session',()=>{
 const f=fixture(),operand={};f.session.command={type:'parallel'};f.session.operands=[operand];f.state.resolution={action:'commit'};
 assert.equal(f.query.canApply('parallel'),true);assert.equal(f.calls[0][2],f.session.operands);
 f.state.resolution={error:'invalid',constraint:{}};assert.equal(f.query.canApply('parallel'),false);assert.equal(f.session.operands[0],operand);
 f.state.resolution=null;assert.equal(f.query.canApply('parallel'),false);
});
test('completion keeps its existing distance target versus other constraint checks independent of mode for collected operands',()=>{
 const f=fixture();f.state.mode=false;f.session.operands=[{}];f.state.resolution={target:{}};
 assert.equal(f.query.canComplete('distance'),true);assert.equal(f.query.canComplete('parallel'),false);
 f.state.resolution={constraint:{}};assert.equal(f.query.canComplete('parallel'),true);assert.equal(f.query.canComplete('distance'),false);
 f.state.resolution={error:'invalid'};assert.equal(f.query.canComplete('distance'),false);
});
test('line-length completion waits while a command is active but other valid distance targets can complete',()=>{
 const f=fixture();assert.equal(f.query.canComplete('distance'),true);f.session.command={type:'distance'};assert.equal(f.query.canComplete('distance'),false);
 f.state.target={kind:'point-point'};assert.equal(f.query.canComplete('distance'),true);
 for(const target of [null,{kind:'invalid'}]){f.state.target=target;assert.equal(f.query.canComplete('distance'),false);}
 f.state.mode=false;assert.equal(f.query.canComplete('parallel'),false);
});
test('current intent prioritizes session operands before selected Splines and preserves returned intent identity',()=>{
 const f=fixture(),operand={},intent={constraint:{}};f.state.resolution=intent;f.selection.splines=[{}];f.session.operands=[operand];
 assert.equal(f.query.resolution('coincident'),intent);assert.equal(f.calls[0][2],f.session.operands);assert.equal(f.calls.includes('convert'),false);
 f.calls.length=0;f.session.operands=[];f.state.converted=[{}];assert.equal(f.query.resolution('tangent'),intent);
 assert.equal(f.calls[0],'convert');assert.equal(f.calls[1][2],f.state.converted);assert.equal(f.selection.splines.length,1);
});
test('ordinary selection resolves distance errors and typed constraint values with current owner without touching selection',()=>{
 const f=fixture();const distance=f.query.resolution('distance');assert.equal(distance.target,f.state.target);assert.equal(distance.sketchId,'S');assert.equal(distance.type,'distance');
 f.state.target={kind:'invalid',reason:'bad target'};assert.equal(f.query.resolution('distance').error,'bad target');
 f.state.target=null;assert.equal(f.query.resolution('distance'),null);
 const normal=f.query.resolution('horizontal');assert.equal(normal.constraint,f.state.constraint);assert.equal(normal.sketchId,'S');
 f.state.constraint=null;assert.equal(f.query.resolution('horizontal'),null);assert.deepEqual(f.selection.splines,[]);
});


test('fixed batch preserves references, owner and constraint authority; fully fixed needs every point and line',()=>{
 const f=fixture(),point={sketchId:'S',fixed:true},line={sketchId:'S',fixedConstraint:{}};
 f.selection.points.push(point);f.selection.lines.push(line);
 const batch=f.query.fixedBatch();assert.equal(batch.sketchId,'S');assert.equal(batch.points[0],point);assert.equal(batch.lines[0],line);
 assert.deepEqual(f.calls,[['edit','S','constraint']]);assert.equal(f.query.fullyFixed(batch),true);
 point.fixed=false;assert.equal(f.query.fullyFixed(batch),false);point.fixed=true;delete line.fixedConstraint;
 assert.equal(f.query.fullyFixed(batch),false);assert.equal(f.query.fullyFixed(null),false);
 f.state.edit=false;assert.equal(f.query.fixedBatch(),null);
});
test('fixed batch rejects mixed owners, unsupported types, projections and arc endpoints before authority lookup',()=>{
 for(const variant of ['mixed','circle','projection','endpoint']){
  const f=fixture();f.selection.points.push({sketchId:'S'});
  if(variant==='mixed')f.selection.lines.push({sketchId:'T'});
  if(variant==='circle')f.selection.circles.push({});
  if(variant==='projection')f.selection.points[0].blockProjection=true;
  if(variant==='endpoint')f.selection.arcEndpoint={};
  assert.equal(f.query.fixedBatch(),null);assert.deepEqual(f.calls,[]);
 }
});
test('Fix capability retains annotation, Block, projection instance and arc endpoint alternatives',()=>{
 const f=fixture();assert.equal(f.query.fixedToggleAllowed(),false);
 f.selection.annotations.push({});assert.equal(f.query.fixedToggleAllowed(),true);
 f.selection.hatches.push({});assert.equal(f.query.fixedToggleAllowed(),false);f.selection.hatches=[];f.selection.annotations=[];
 f.selection.blockInstances.push({});assert.equal(f.query.fixedToggleAllowed(),true);
 f.selection.lines.push({});assert.equal(f.query.fixedToggleAllowed(),false);f.selection.blockInstances=[];
 const instance={};f.selection.lines[0]={blockProjection:true,blockInstance:instance};
 f.selection.circles.push({blockProjection:true,blockInstance:instance});assert.equal(f.query.fixedToggleAllowed(),true);
 f.selection.circles[0].blockInstance={};assert.equal(f.query.fixedToggleAllowed(),false);
 f.selection.arcEndpoint={};assert.equal(f.query.fixedToggleAllowed(),true);
});
