const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/dimension_test_driver.js'), 'utf8'), sandbox);
function fixture(build = sandbox.window.DimensionTestDriver.createInteractionSupport) {
  const events = [], state = { ready:false, scope:{ constraints:[] } }, selection = { dimensionConstraints:[], lines:[],
    get dimensionConstraint(){ return this.dimensionConstraints.length===1 ? this.dimensionConstraints[0] : null; },
    set(key,value){ assert.equal(this,selection); assert.equal(key,'dimensionConstraint'); this.dimensionConstraints=value?[value]:[]; events.push('select'); } };
  const ports = { currentScope:()=>{ assert.equal(state.ready,true,'no eager scope read'); return state.scope; }, isDimensionConstraint:c=>c.dimensional,
    targetFromConstraint:c=>c?{value:c.target}:null, dimensionLayout:(target,dimension)=>({text:{x:target.value,y:dimension.y}}), clientPosition:p=>({x:p.x+10,y:p.y+20}),
    startDimensionEditInput:value=>{ events.push(['edit',value]); return 'started'; }, clearSelection:()=>events.push('clear'), canvasSelection:selection,
    updateUI:options=>events.push(['ui', options ? JSON.parse(JSON.stringify(options)) : null]), draw:()=>events.push('draw'),
    viewport:{ update:value=>events.push(['viewport',JSON.parse(JSON.stringify(value))]) },
    pendingCommandSession:{current:null}, constraintTargetSession:{command:null}, dimensionValueInput:{hidden:true}, dimensionDrag:{active:false}, dimensionAnchor:(target,dimension)=>({x:target.value,y:dimension.y}),
  };
  const support=build(ports); assert.deepEqual(events,[]); state.ready=true;
  return {support,state,ports,events,selection};
}

test('shared dimension support defers each role and retains the live scope and selection capabilities',()=>{
  const f=fixture(ports=>{
    const shared=sandbox.window.DimensionTestDriver.createSupport(ports);
    assert.equal(Object.isFrozen(shared),true);
    assert.equal(typeof shared.createFixtures({}).angleDimensionLabelFollowCase,'function');
    assert.equal(typeof shared.createDisplay({}).appearance.drawnDimensionColorsForTest,'function');
    return shared.createInteraction({...ports,currentScope:()=>assert.fail('shared scope must be retained'),canvasSelection:null});
  });
  const first={dimensional:true,target:12,dimension:{y:3}};f.state.scope={constraints:[first]};
  assert.equal(f.support.selection.selectDimensionForPropertiesForTest(),true);assert.equal(f.selection.dimensionConstraint,first);
  f.state.scope={constraints:[]};f.events.length=0;assert.equal(f.support.selection.selectDimensionForPropertiesForTest(),false);assert.deepEqual(f.events,[]);
  f.support.selection.fitForMultipleDimensionsForTest();assert.deepEqual(f.events,[['viewport',{scale:2,x:350,y:250}],['ui',null],'draw']);
});

test('dimension interaction support retains twelve entry points in placement and selection groups',()=>{
  const f=fixture(); assert.deepEqual(Object.keys({...f.support.placement,...f.support.selection}),[
    'resetForDimensionCommandLineDrag','resetForLineLengthClickPlacement','resetForLineCircleAndRadiusDifferenceDimensions','lineCircleAndRadiusDifferenceState',
    'perturbRadiusDifferenceDimensionForTest','lineLengthClickPlacementState','dimensionCommandLineDragState','dimensionClientPositionForTest','startDimensionExpressionEditForTest',
    'selectDimensionForPropertiesForTest','multipleDimensionSelectionForTest','fitForMultipleDimensionsForTest',
  ]);
  for(const group of Object.values(f.support)){assert.equal(Object.isFrozen(group),true);for(const fn of Object.values(group))assert.equal(typeof fn,'function');}
});

test('selection and expression actions use current constraints and preserve object identity and display order',()=>{
  const f=fixture(), first={dimensional:true,target:12,dimension:{y:3}}, second={dimensional:true,target:24,dimension:{y:6}};
  f.state.scope={constraints:[first,second]};
  const point=f.support.selection.dimensionClientPositionForTest(1);assert.equal(point.x,34);assert.equal(point.y,26);
  assert.equal(f.support.selection.startDimensionExpressionEditForTest(1),'started');assert.equal(f.events[0][1].constraint,second);assert.equal(f.events[0][1].dimension,second.dimension);
  f.events.length=0;assert.equal(f.support.selection.selectDimensionForPropertiesForTest(1),true);
  assert.equal(f.selection.dimensionConstraint,second);assert.deepEqual(f.events,['clear','select',['ui',{refreshAnalysis:false}],'draw']);
  assert.equal(f.support.selection.multipleDimensionSelectionForTest().dimensions[0],1);
  f.state.scope={constraints:[]};f.events.length=0;assert.equal(f.support.selection.selectDimensionForPropertiesForTest(),false);assert.equal(f.support.selection.startDimensionExpressionEditForTest(),false);assert.deepEqual(f.events,[]);
});

test('placement observations follow live pending/drag state and fit keeps viewport then UI/draw sequencing',()=>{
  const f=fixture();f.state.scope={constraints:[{dimensional:true,target:8,dimension:{y:4}}]};
  f.ports.pendingCommandSession.current={type:'distance-place',target:{kind:'point-line'},pointer:{x:3,y:5}};f.ports.constraintTargetSession.command={type:'distance'};f.ports.dimensionDrag.active=true;
  f.selection.lines=[{id:'L4'}];const placement=f.support.placement.lineLengthClickPlacementState(),drag=f.support.placement.dimensionCommandLineDragState();
  assert.equal(placement.target,8);assert.equal(placement.pendingCommandType,'distance-place');assert.notEqual(placement.previewPointer,f.ports.pendingCommandSession.current.pointer);
  assert.equal(drag.dragging,true);assert.equal(drag.anchor.y,4);assert.equal(drag.selectedLineIds[0],'L4');
  f.support.selection.fitForMultipleDimensionsForTest();assert.deepEqual(f.events,[['viewport',{scale:2,x:350,y:250}],['ui',null],'draw']);
});
