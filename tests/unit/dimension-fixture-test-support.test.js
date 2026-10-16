const assert=require('node:assert/strict');const fs=require('node:fs');
const path=require('node:path');const vm=require('node:vm');const test=require('node:test');
const sandbox={window:{},structuredClone};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/testing/dimension_test_driver.js'),'utf8'),sandbox);
function fixture(){
  const events=[],state={ready:false,scope:{constraints:[],points:[],lines:[],activeSketchId:'S1'}};
  const pending={current:null,replace(value){assert.equal(this,pending);this.current=value;events.push('pending:'+value.type);}};
  const command={current:null,replaceCommand(value){assert.equal(this,command);this.current=value;events.push('command');}};
  const input={hidden:true};
  const ports={currentScope:()=>{assert.equal(state.ready,true,'no eager scope query');return state.scope;},
    resetModelState:()=>{state.scope={constraints:[],points:[],lines:[],activeSketchId:'S1'};events.push('reset');},
    addPoint:(x,y)=>{const p={x,y};state.scope.points.push(p);return p;},
    addLine:(p1,p2)=>{const line={p1,p2,length:()=>Math.hypot(p2.x-p1.x,p2.y-p1.y)};state.scope.lines.push(line);events.push('line');return line;},
    dimensionFromAnchor:(target,pointer)=>({pointer}), activeSketchId:()=>state.scope.activeSketchId,
    addDistanceConstraintFromTarget:(target,value,dimension,options)=>{events.push('distance');assert.equal(target.p1,state.scope.points[0]);assert.equal(value,100);assert.equal(options.sketchId,'S1');state.scope.constraints.push({dimensional:true,readonly:false,dimension});},
    constraintTargetSession:command,pendingCommandSession:pending,dimensionValueInput:input,
    isReadOnlyDimension:c=>c.readonly,isDimensionConstraint:c=>c.dimensional,
    startDistanceValueInput:point=>{events.push('start');assert.equal(point.y,-54);assert.equal(pending.current.type,'distance-place');state.scope.constraints.push({dimensional:true,readonly:true});input.hidden=false;pending.replace({type:'distance-value'});},
  };
  const support=sandbox.window.DimensionTestDriver.createFixtureSupport(ports);assert.deepEqual(events,[]);state.ready=true;
  return{support,state,events,pending,command,input};
}

test('Dimension fixture support exposes the same five entries and defers all preparation',()=>{
  const f=fixture();assert.deepEqual(Object.keys(f.support.readOnly),['resetForReadOnlyDuplicateDimension','resetForReadOnlyDimensionPlacement','pointPointRectangleDimensionExtensionVisibilityCases']);
  assert.equal(typeof f.support.angleDimensionLabelFollowCase,'function');assert.equal(typeof f.support.resetForActiveSketchDimensionVisibility,'function');
  assert.equal(Object.isFrozen(f.support),true);assert.equal(Object.isFrozen(f.support.readOnly),true);
  assert.equal(f.state.scope.constraints.length,0);assert.equal(f.pending.current,null);assert.equal(f.input.hidden,true);
});

test('read-only placement setup forwards live geometry and sessions and returns the existing input operation outcome',()=>{
  const f=fixture(),result=f.support.readOnly.resetForReadOnlyDimensionPlacement();
  assert.deepEqual(f.events,['reset','line','distance','command','pending:distance-place','start','pending:distance-value']);
  assert.equal(f.command.current.type,'distance');assert.equal(result.pendingType,'distance-value');assert.equal(result.inputHidden,false);
  assert.equal(result.readOnlyCount,1);assert.equal(result.dimensionCount,2);assert.equal(f.state.scope.lines[0].length(),100);
});
