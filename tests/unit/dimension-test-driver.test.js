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
 const display={placement:rawDisplay.placement,layouts:rawDisplay.layouts,layout(...args){assert.equal(this,display);return rawDisplay.layout(...args);}};
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
 if(composed)assembled=w.DimensionTestDriver.createForEditing(ports);
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
