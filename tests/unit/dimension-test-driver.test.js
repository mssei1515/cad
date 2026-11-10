const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/dimension_test_driver.js'), 'utf8'), sandbox);

test('Sketch visibility fixture restores fillText on either capture failure without widening rollback', () => {
  for (const failAt of [0, 1, 2]) {
    const original = () => { throw Error('original fillText should be intercepted'); };
    const ctx = { fillText: original }, failure = new Error('draw failed');
    let scope, count = 0;
    const sketchById = id => {
      const sketch = scope.sketches.find(value => value.id === id);
      sketch.appearance ||= {};
      return sketch;
    };
    const fixture = sandbox.window.DimensionTestDriver.createSketchVisibilityFixture({
      resetModelState: () => { scope = { activeSketchId: 'S1', sketches: [{ id: 'S1' }], constraints: [] }; },
      currentScope: () => scope, activeSketchId: () => scope.activeSketchId, rootSketchId: 'ROOT',
      addPoint: (x, y) => ({ x, y }), addLine: (p1, p2) => ({ p1, p2, length: () => p2.x - p1.x }),
      dimensionFromAnchor: (target, point) => ({ ...point }),
      addDistanceConstraintFromTarget: (target, value, dimension, options) => scope.constraints.push({ sketchId: options.sketchId, dimension }),
      ctx, sketchById, isDimensionConstraint: () => true, constraintSketchId: value => value.sketchId,
      isVisibleSketchId: id => sketchById(id).appearance.visible !== false,
      drawDimensions: () => {
        assert.equal(scope.activeSketchId, 'S1');
        count++; ctx.fillText('label' + count);
        if (count === failAt) throw failure;
      },
    });
    if (failAt) assert.throws(() => fixture.reset(), error => error === failure);
    else {
      const result = fixture.reset();
      assert.deepEqual(Array.from(result.drawnDimensionLabels), ['label1']);
      assert.deepEqual(Array.from(result.labelsAfterHidingSecondSketch), ['label2']);
      assert.deepEqual(Array.from(result.dimensionSketchIds), ['S1', 'S2']);
    }
    assert.equal(ctx.fillText, original);
    assert.equal(sketchById('S2').appearance.visible, failAt === 2 ? false : failAt === 1 ? undefined : true);
  }
});

test('arrow observation restores the current viewport scale and propagates appearance or rendering failure', () => {
  for (const failureAt of ['appearance', 'stroke', 'points', 'projection']) {
    const failure = new Error(failureAt), updates = [];
    const viewport = { scale: 2, update: values => { updates.push(values.scale); viewport.scale = values.scale; } };
    const step = (name, value) => { assert.equal(viewport.scale, 0.05); if (failureAt === name) throw failure; return value; };
    const fixture = sandbox.window.DimensionTestDriver.createTerminatorFixture({
      viewport,
      readDefaultAppearance: () => step('appearance', { terminatorSize: 3 }),
      metrics: {
        dimensionStrokeWidth: () => step('stroke', 1),
        dimensionOpenArrowheadRenderPoints: () => step('points', [{ x: 1, y: 0 }, { x: 3, y: 2 }]),
        dimensionOpenArrowJoinProjection: () => step('projection', 1),
      },
      screenPxPerMm: 4, outsideShaftLengthFactor: 2,
    });
    // The viewport changes after factory creation; restoration must use the call-time value.
    viewport.scale = 7;
    assert.throws(() => fixture.arrowAlignment({ viewportScale: -1 }), error => error === failure);
    assert.equal(viewport.scale, 7);
    assert.deepEqual(updates, [0.05, 7]);
  }
});

test('dimension color observation forwards stroke calls and restores live selection, hover and Canvas method after success or failure', () => {
  for (const shouldFail of [false, true]) {
    const dimension = {}, constraint = {}, hovered = {}, point = {}, calls = [], failure = new Error('draw failed');
    const canvasSelection = { dimensionConstraint: null, constraint: null, set(key, value) { this[key] = value; } };
    const canvasHover = { current: { dimension: null, point }, update(values) { Object.assign(this.current, values); } };
    const originalStroke = function (...args) { assert.equal(this, ctx); calls.push(args); return 'forwarded'; };
    const ctx = { stroke: originalStroke, strokeStyle: '#ABCDEF' };
    const fixture = sandbox.window.DimensionTestDriver.createColorObservation({ canvasSelection, canvasHover, ctx,
      drawDimensions() {
        assert.equal(canvasSelection.dimensionConstraint, null);
        assert.equal(canvasSelection.constraint, null);
        assert.equal(canvasHover.current.dimension, null);
        assert.equal(ctx.stroke('path', 3), 'forwarded');
        ctx.strokeStyle = '#abcdef'; ctx.stroke('same color');
        ctx.strokeStyle = '#123456'; ctx.stroke('other color');
        if (shouldFail) throw failure;
      },
    });
    // Capture these live references at observation time, rather than at factory creation.
    canvasSelection.dimensionConstraint = dimension;
    canvasSelection.constraint = constraint;
    canvasHover.current.dimension = hovered;
    if (shouldFail) assert.throws(() => fixture.colors(), error => error === failure);
    else assert.deepEqual(Array.from(fixture.colors()), ['#abcdef', '#123456']);
    assert.equal(ctx.stroke, originalStroke);
    assert.equal(canvasSelection.dimensionConstraint, dimension);
    assert.equal(canvasSelection.constraint, constraint);
    assert.equal(canvasHover.current.dimension, hovered);
    assert.equal(canvasHover.current.point, point);
    assert.deepEqual(calls, [['path', 3], ['same color'], ['other color']]);
  }
});

const editingSandbox={structuredClone,window:{}};vm.createContext(editingSandbox);
const editingSources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for(const source of editingSources.filter(p=>p.startsWith('src/')))vm.runInContext(fs.readFileSync(source,'utf8'),editingSandbox,{filename:source});
function editingSupportFixture(composed){
 const w=editingSandbox.window,state={ready:false,scope:null,pending:null,drawFailure:null,placementFailure:null},events=[],viewport={scale:2},selection=w.CanvasSelection.create();
 const ready=()=>assert.equal(state.ready,true),currentScope=()=>{ready();return state.scope;};
 const ctx={measureText:text=>({width:String(text).length*7}),fillText(){}};
 const rawDisplay=w.DimensionDisplay.create({ctx,viewport,currentLines:()=>currentScope().lines,minLineLength:12,
  effectiveDimensionAppearance:()=>w.Appearance.normalizeDimensionAppearance({}, {partial:false}),activeSketchId:()=>currentScope().activeSketchId});
 const display={placement:rawDisplay.placement,layouts:rawDisplay.layouts,metrics:rawDisplay.metrics,layout(...args){assert.equal(this,display);return rawDisplay.layout(...args);}};
 const resetModelState=()=>{ready();state.scope=w.DocumentState.create();selection.clear();state.pending=null;events.push('reset');};
 const geometry={addPoint(x,y,fixed,kind){ready();const p=new w.GeometrySolver.Point('P'+state.scope.points.length,x,y);p.fixed=Boolean(fixed);p.kind=kind;p.sketchId=state.scope.activeSketchId;state.scope.points.push(p);return p;},
  addLine(a,b){ready();const line=new w.GeometrySolver.Line('L'+state.scope.lines.length,a,b);line.sketchId=state.scope.activeSketchId;state.scope.lines.push(line);return line;}};
 const sketches={activeSketchId:()=>currentScope().activeSketchId,constraintSketchId:c=>c.sketchId,sketchById:id=>currentScope().sketches.find(s=>s.id===id)};
 const appearance={isVisibleSketchId:id=>sketches.sketchById(id)?.appearance?.visible!==false};
 const addDistanceConstraintFromTarget=(target,value,dimension,options)=>{const c=new w.GeometrySolver.DistanceConstraint(target.p1,target.p2,value);c.sketchId=options.sketchId;c.dimension=dimension;state.scope.constraints.push(c);return c;};
 const pendingCommandSession={get current(){ready();return state.pending;},replace(p){ready();state.pending=p;events.push('pending');}},constraintTargetSession={replaceCommand(command){ready();state.command=command;events.push('target');}};
 const dimensionValueInput={hidden:true},dimensions={startDistanceValueInput(pointer){assert.equal(this,dimensions);ready();events.push(['value',pointer]);if(state.placementFailure)throw state.placementFailure;state.pending={type:'distance-value'};dimensionValueInput.hidden=false;}};
 const layer={draw(){assert.equal(this,layer);ready();events.push('draw');ctx.fillText('dimension');if(state.drawFailure)throw state.drawFailure;}};
 const serializeModel=()=>structuredClone(currentScope()),serializeDimension=dimension=>structuredClone(dimension),dimensionLabelForConstraint=c=>String(c.target);
 const ports={geometry,display,sketches,appearance,currentScope,viewport,canvasSelection:selection,resetModelState,addDistanceConstraintFromTarget,dimensions,serializeModel,serializeDimension,constraintTargetSession,pendingCommandSession,dimensionValueInput,ctx,layer,dimensionLabelForConstraint};
 let assembled;
 if(composed==='ports')assembled={};
 else if(composed)assembled=w.DimensionTestDriver.createForEditing(ports);
 else{
  const support=w.DimensionTestDriver.createSupport({resetModelState,addPoint:geometry.addPoint,addLine:geometry.addLine,dimensionFromAnchor:display.placement.dimensionFromAnchor,addDistanceConstraintFromTarget,activeSketchId:sketches.activeSketchId,currentScope,
   isDimensionConstraint:w.DimensionQueries.isDimensionConstraint,dimensionLayout:(...args)=>display.layout(...args),hypot2:w.GeometrySolver.hypot2,targetFromConstraint:w.DimensionQueries.targetFromConstraint,serializeModel,constraintTargetSession,pendingCommandSession,dimensionValueInput,ctx,drawDimensions:()=>layer.draw(),constraintSketchId:sketches.constraintSketchId,canvasSelection:selection,viewport});
  const p=display.placement,fixtures=support.createFixtures({isReadOnlyDimension:w.DimensionQueries.isReadOnlyDimension,dimensionLabelForConstraint,defaultDimensionForTarget:p.defaultDimensionForTarget,startDistanceValueInput:pointer=>dimensions.startDistanceValueInput(pointer),dimensionWithLabelAt:p.dimensionWithLabelAt,
   angleDimensionLabelBasis:p.angleDimensionLabelBasis,angleDimensionLayout:display.layouts.angleDimensionLayout,angleDimensionLabelOffsets:p.angleDimensionLabelOffsets,setAngleDimensionLabelOffsets:p.setAngleDimensionLabelOffsets,angleDimensionFromLabelPoint:p.angleDimensionFromLabelPoint,serializeDimension,rootSketchId:w.SketchHierarchy.ROOT_SKETCH_ID,sketchById:sketches.sketchById,isVisibleSketchId:appearance.isVisibleSketchId});assembled={support,fixtures};
 }
 assert.deepEqual(events,[]);assert.equal(state.scope,null);state.ready=true;return{...assembled,ports,state,events,w};
}

test('editing dimension support matches direct fixtures with real placement, layout and geometry without construction reads',()=>{
 const results=[];for(const composed of [false,true]){
  const f=editingSupportFixture(composed);assert.ok(Object.isFrozen(f.support));assert.ok(Object.isFrozen(f.fixtures));
  const extension=f.fixtures.readOnly.pointPointRectangleDimensionExtensionVisibilityCases(),angle=f.fixtures.angleDimensionLabelFollowCase();
  assert.equal(f.state.scope.points.length>0,true);results.push(JSON.stringify({extension,angle,events:f.events}));
 }assert.equal(results[1],results[0]);
});

test('editing dimension support keeps the current session, placement receiver and failure state for input continuation',()=>{
 for(const composed of [false,true]){
  const f=editingSupportFixture(composed),result=f.fixtures.readOnly.resetForReadOnlyDimensionPlacement();assert.equal(result.pendingType,'distance-value');assert.equal(result.inputHidden,false);assert.equal(f.events.at(-1)[0],'value');
  const error=new Error('placement failed');f.state.placementFailure=error;
  assert.throws(()=>f.fixtures.readOnly.resetForReadOnlyDimensionPlacement(),e=>e===error);assert.equal(f.state.pending.type,'distance-place');assert.equal(f.state.command.type,'distance');assert.equal(f.state.scope.constraints.length,1);
 }
});

test('editing dimension support shares the rendering owner and preserves the existing Canvas recovery boundary',()=>{
 for(const composed of [false,true]){
  const f=editingSupportFixture(composed),fillText=f.ports.ctx.fillText;f.fixtures.resetForActiveSketchDimensionVisibility();assert.equal(f.ports.ctx.fillText,fillText);assert.equal(f.events.filter(e=>e==='draw').length,2);
  const error=new Error('layer failed');f.state.drawFailure=error;assert.throws(()=>f.fixtures.resetForActiveSketchDimensionVisibility(),e=>e===error);assert.equal(f.ports.ctx.fillText,fillText);assert.equal(f.state.scope.constraints.length,2);
 }
});

function displayOwnerFixture(composed) {
 const f=editingSupportFixture(true),{w,ports:p,state}=f,reads=[];
 state.ready=false;
 const canvasStack=[];p.ctx.save=()=>canvasStack.push(p.ctx.font);p.ctx.restore=()=>{p.ctx.font=canvasStack.pop();};
 p.viewport.update=function(values){assert.equal(this,p.viewport);assert.equal(state.ready,true);Object.assign(this,values);};
 const readDocument=()=>{assert.equal(state.ready,true,'no eager document read');reads.push('document');if(state.readFailure)throw state.readFailure;return state.scope;};
 const document=new Proxy({}, {get(_target,key){return readDocument()[key];}});
 const appearance=w.GeometryAppearanceQuery.createDimension({document,currentSketches:()=>p.currentScope().sketches,activeSketchId:p.sketches.activeSketchId,
  isRootSketch:sketch=>sketch?.id===w.SketchHierarchy.ROOT_SKETCH_ID});
 const hover=w.CanvasHover.create({isEndpointPoint:()=>false}),input={canvasHover:hover,readDocument,appearance};
 const support=composed?f.createDisplayForEditing(input):f.support.createDisplay({
  Point:w.GeometrySolver.Point,Arc:w.GeometrySolver.Arc,placement:p.display.placement,layouts:p.display.layouts,metrics:p.display.metrics,
  circlePointAtAngle:w.GeometryKernel.circlePointAtAngle,screenPxPerMm:w.DimensionMetrics.DIMENSION_SCREEN_PX_PER_MM,
  outsideShaftLengthFactor:w.DimensionLayout.DIMENSION_OUTSIDE_SHAFT_LENGTH_FACTOR,fitMarginFactor:w.DimensionMetrics.DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR,
  canvasHover:hover,readDocument,normalizeDimensionAppearance:w.Appearance.normalizeDimensionAppearance,
  effectiveDimensionAppearanceForSketch:appearance.effectiveDimensionAppearanceForSketch,dimensionDisplayState:appearance.dimensionDisplayState,
  effectiveDimensionAppearance:appearance.effectiveDimensionAppearance,displayFactor:w.Appearance.annotationDisplayFactor,
  formatDimensionLabel:w.NumberDisplay.formatDimensionLabel,formatMeasuredDimensionLabel:w.NumberDisplay.formatMeasuredDimensionLabel,
  jisDimensionTextAngle:p.display.layouts.jisDimensionTextAngle,dimensionTextOffset:p.display.layouts.dimensionTextOffset});
 assert.deepEqual(reads,[]);assert.deepEqual(f.events,[]);assert.equal(state.scope,null);state.ready=true;
 return {...f,displaySupport:support,hover,reads};
}

test('display test composition remains cold and exposes the same real dimension precision, angle, radius and terminator measurements',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=displayOwnerFixture(composed),{appearance,cases}=f.displaySupport;f.ports.resetModelState();
  assert.equal(Object.isFrozen(appearance),true);assert.equal(Object.isFrozen(cases),true);
  assert.equal(Object.keys(appearance).length,6);assert.equal(Object.keys(cases).length,2);
  const precision=cases.dimensionDisplayPrecisionCases(),angles=cases.dimensionTextAngleCases();
  const radius=appearance.arcRadiusDimensionRenderPlanForTest('arrow',{label:'R30'}),fit=appearance.dimensionTerminatorFitForTest(80,'120','arrow',true);
  const arrow=appearance.dimensionArrowTipAlignmentForTest({viewportScale:5,highlighted:true});
  assert.equal(f.ports.viewport.scale,2);assert.equal(radius.arcRadius,30);assert.equal(Object.keys(precision).length,9);
  results.push(JSON.stringify({precision,angles,radius,fit,arrow}));
 }
 assert.equal(results[1],results[0]);
});

test('display test composition keeps the actual document, scope and appearance readers live across edits and replacement',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=displayOwnerFixture(composed),a=f.displaySupport.appearance;
  f.fixtures.readOnly.resetForReadOnlyDimensionPlacement();const original=f.state.scope;
  original.defaultDimensionAppearance={dimensionTextHeight:6};const first=a.dimensionAppearanceStateForTest();
  assert.equal(first.documentDefault.dimensionTextHeight,6);assert.equal(first.sketchEffective.dimensionTextHeight,6);
  original.defaultDimensionAppearance={dimensionTextHeight:8};f.ports.viewport.update({scale:4});
  const second=a.dimensionAppearanceStateForTest(),metrics=a.dimensionAppearanceRenderMetricsForTest();
  assert.equal(second.documentDefault.dimensionTextHeight,8);assert.equal(metrics.appearance.dimensionTextHeight,8);
  f.state.scope=f.w.DocumentState.create();f.state.scope.defaultDimensionAppearance={dimensionTextHeight:11};
  const replacement=a.dimensionAppearanceStateForTest();assert.equal(replacement.documentDefault.dimensionTextHeight,11);assert.equal(replacement.effective,null);
  assert.equal(original.constraints.length,1);assert.notEqual(f.state.scope,original);
  results.push(JSON.stringify({first,second,metrics,replacement}));
 }
 assert.equal(results[1],results[0]);
});

test('display test composition preserves viewport, Canvas method and live selection recovery and propagates original reader or painter failures',()=>{
 for(const composed of [false,true]){
  const f=displayOwnerFixture(composed),a=f.displaySupport.appearance,{ctx,canvasSelection:selection,layer}=f.ports;
  f.ports.resetModelState();const dimension={id:'dimension'},constraint={id:'constraint'},hovered={id:'hovered'},calls=[];
  selection.set('dimensionConstraint',dimension);selection.set('constraint',constraint);f.hover.update({dimension:hovered});
  ctx.stroke=function(...args){assert.equal(this,ctx);calls.push(args);return 'forwarded';};const originalStroke=ctx.stroke;
  layer.draw=function(){assert.equal(this,layer);ctx.strokeStyle='#123456';assert.equal(ctx.stroke('dimension',9),'forwarded');if(f.state.drawFailure)throw f.state.drawFailure;};
  assert.deepEqual(Array.from(a.drawnDimensionColorsForTest()),['#123456']);assert.deepEqual(calls,[['dimension',9]]);
  const paintError=new Error('dimension draw failed');f.state.drawFailure=paintError;
  assert.throws(()=>a.drawnDimensionColorsForTest(),value=>value===paintError);
  assert.equal(ctx.stroke,originalStroke);assert.equal(selection.dimensionConstraint,dimension);assert.equal(selection.constraint,constraint);assert.equal(f.hover.current.dimension,hovered);
  const readError=new Error('document read failed');f.state.readFailure=readError;
  assert.throws(()=>a.dimensionArrowTipAlignmentForTest({viewportScale:7}),value=>value===readError);assert.equal(f.ports.viewport.scale,2);
 }
});

function browserSupportFixture(owned) {
 const f=editingSupportFixture('ports'),{w,ports:p,state}=f;state.ready=false;
 const root=w.DocumentState.create();root.defaultDimensionAppearance={dimensionTextHeight:6};
 const canvasStack=[];p.ctx.save=()=>canvasStack.push(p.ctx.font);p.ctx.restore=()=>{p.ctx.font=canvasStack.pop();};
 p.viewport.update=function(values){assert.equal(this,p.viewport);assert.equal(state.ready,true);Object.assign(this,values);};
 p.viewport.worldToCanvasScreen=point=>{assert.equal(state.ready,true);return{x:point.x*p.viewport.scale,y:point.y*p.viewport.scale};};
 const hover=w.CanvasHover.create({isEndpointPoint:()=>false});
 const dimensionAppearance=w.GeometryAppearanceQuery.createDimension({document:root,currentSketches:()=>p.currentScope().sketches,
  activeSketchId:p.sketches.activeSketchId,isRootSketch:sketch=>sketch?.id===w.SketchHierarchy.ROOT_SKETCH_ID});
 const documentWorkspace=Object.freeze({document:root,workspace:Object.freeze({current:p.currentScope}),sketches:p.sketches});
 const interaction=Object.freeze({selection:p.canvasSelection,hover}),sessions=Object.freeze({targets:p.constraintTargetSession,pending:p.pendingCommandSession});
 const values={startEdit(hit){assert.equal(this,values);assert.equal(state.ready,true);if(state.editError)throw state.editError;f.events.push(['edit',hit]);return state.editResult;}};
 const interactionOptions={canvasDriver:{clientPosition:point=>({x:point.x+10,y:point.y+20})},dimensionValues:values,clearSelection:()=>p.canvasSelection.clear(),
  presentation:{updateUI:()=>f.events.push('ui'),draw:()=>f.events.push('draw')},fit:{},references:{},canvas:{},solving:{},checkpoint:{},analysis:{},dimensionDrag:{active:false}};
 const omitted=new Set(['sketches','currentScope','canvasSelection','constraintTargetSession','pendingCommandSession']);
 const fixtureOptions=Object.freeze({...Object.fromEntries(Object.entries(p).filter(([key])=>!omitted.has(key))),documentWorkspace,interaction,sessions});
 function build(appearance=dimensionAppearance){
  if(owned)return w.DimensionTestDriver.createBrowserSupportForWorkspace(fixtureOptions,interactionOptions,appearance);
  const stage=w.DimensionTestDriver.createForEditing(p),dimensionInteractionSupport=stage.createInteractionForEditing(interactionOptions);
  const dimensionDisplaySupport=stage.createDisplayForEditing({canvasHover:hover,readDocument:()=>root,appearance});
  return Object.freeze({dimensionDisplaySupport,dimensionFixtureSupport:stage.fixtures,dimensionInteractionSupport});
 }
 const browserSupport=build();assert.deepEqual(f.events,[]);assert.equal(state.scope,null);state.ready=true;
 return{...f,root,documentWorkspace,interaction,sessions,dimensionAppearance,interactionOptions,fixtureOptions,browserSupport,build};
}

test('dimension browser support stays cold, shares real capabilities and keeps fixed Document reads separate from live Workspace',()=>{
 const results=[];for(const owned of [false,true]){
  const f=browserSupportFixture(owned),s=f.browserSupport;assert.ok(Object.isFrozen(s));
  assert.deepEqual(Object.keys(s),['dimensionDisplaySupport','dimensionFixtureSupport','dimensionInteractionSupport']);
  for(const value of Object.values(s))assert.ok(Object.isFrozen(value));
  f.state.scope=f.w.DocumentState.create();f.state.scope.defaultDimensionAppearance={dimensionTextHeight:19};
  const before=s.dimensionDisplaySupport.appearance.dimensionAppearanceStateForTest();assert.equal(before.documentDefault.dimensionTextHeight,6);
  const original=f.state.scope;f.state.scope=f.w.DocumentState.create();f.state.scope.defaultDimensionAppearance={dimensionTextHeight:31};f.root.defaultDimensionAppearance={dimensionTextHeight:8};
  const after=s.dimensionDisplaySupport.appearance.dimensionAppearanceStateForTest();assert.equal(after.documentDefault.dimensionTextHeight,8);
  assert.equal(original.defaultDimensionAppearance.dimensionTextHeight,19);assert.equal(f.documentWorkspace.document,f.root);
  assert.equal(f.interaction.selection,f.ports.canvasSelection);assert.equal(f.sessions.pending,f.ports.pendingCommandSession);
  results.push(JSON.stringify({before,after}));
 }assert.equal(results[1],results[0]);
});

test('dimension browser support retains real fixture Geometry, Selection, edit results and original operation exceptions',()=>{
 const results=[];for(const owned of [false,true]){
  const f=browserSupportFixture(owned),s=f.browserSupport;s.dimensionFixtureSupport.readOnly.resetForReadOnlyDimensionPlacement();
  const constraint=f.state.scope.constraints[0],selection=s.dimensionInteractionSupport.selection;
  const result=f.state.editResult={edited:true};assert.equal(selection.startDimensionExpressionEditForTest(),result);
  assert.equal(f.events.at(-1)[1].constraint,constraint);assert.equal(selection.selectDimensionForPropertiesForTest(),true);
  assert.equal(f.ports.canvasSelection.dimensionConstraint,constraint);const position=selection.dimensionClientPositionForTest();assert.ok(Number.isFinite(position.x));
  const error=new Error('dimension edit');f.state.editError=error;assert.throws(()=>selection.startDimensionExpressionEditForTest(),value=>value===error);
  f.state.scope=f.w.DocumentState.create();assert.equal(selection.startDimensionExpressionEditForTest(),false);
  results.push(JSON.stringify({position,events:f.events,selectedId:constraint.id}));
 }assert.equal(results[1],results[0]);
});

test('dimension browser support propagates final display dependency failures without changing model, Selection or prior support',()=>{
 for(const owned of [false,true]){
  const f=browserSupportFixture(owned),existing=f.browserSupport,error=new Error('display dependency');f.state.ready=false;
  const appearance=new Proxy(f.dimensionAppearance,{get(target,key){if(key==='effectiveDimensionAppearance')throw error;return Reflect.get(target,key);}});
  assert.throws(()=>f.build(appearance),value=>value===error);assert.equal(f.browserSupport,existing);
  assert.equal(f.state.scope,null);assert.equal(f.ports.canvasSelection.hasSelection(),false);assert.deepEqual(f.events,[]);
  assert.equal(f.root.defaultDimensionAppearance.dimensionTextHeight,6);assert.equal(Object.hasOwn(f.w,'__jot2dTest'),false);
 }
});
