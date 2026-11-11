const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
function fixture() {
  const calls = [], values = {}, state = { ready: false, active: 'S1', error: null };
  const ready = () => assert.equal(state.ready, true);
  const hit = name => (...args) => { ready(); calls.push([name, ...args]); if (state.error?.name === name) throw state.error.value; return values[name] || null; };
  const geometry = Object.fromEntries(['hitPoint','hitEndpointPoint','hitExplicitPoint','hitLine','hitCircle','hitArcEndpoint','hitArc','hitSpline'].map(name => [name, hit(name)]));
  const scene = Object.fromEntries(['hitHatchAt','hitReferenceImageAt','hitDimension','hitBlockRotationHandle','hitBlockInstance','hitDerivedGeometryForDrag','hitGeometryInstance','hitSketchIdentityElement','hitAnnotationElement','hitAnnotationTarget','hitDerivedProjectionOperand','hitBlockProjectionOperand','hitReferenceTarget'].map(name => [name, hit(name)]));
  scene.activeSketchId = () => { ready(); return state.active; };
  const canvasHover = sandbox.window.CanvasHover.create({ isEndpointPoint: () => false });
  const api = sandbox.window.CanvasHitInteraction.create({ canvasHover, sameArcEndpoint: (a,b) => a?.arc === b?.arc && a?.endpoint === b?.endpoint,
    isActiveSketchConstraint: constraint => constraint.sketchId === state.active, geometry, scene });
  assert.deepEqual(calls, []); state.ready = true;
  return { api, canvasHover, calls, values, state, p: { x: 8, y: 12 }, names: () => calls.map(call => call[0]) };
}

function sceneFixture(configure = () => {}, buildScene = ports => sandbox.window.CanvasHitInteraction.createScene(ports)) {
  const empty = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [], annotations: [], referenceImages: [], blockInstances: [], geometryInstances: [], hatches: [] });
  const state = { ready: false, scope: empty(), dimensionScope: empty(), mode: 'select', active: 'S1', pending: null, command: null,
    hidden: false, locked: false, blocks: [], instances: [], reads: [], error: null };
  const read = name => { assert.equal(state.ready, true); state.reads.push(name); if (state.error) throw state.error; };
  const point = (id, x, y, sketchId = 'S1') => Object.assign(new sandbox.window.GeometrySolver.Point(id, x, y), { sketchId });
  const viewport = { get scale() { read('scale'); return state.scale || 1; } };
  const visible = {
    isVisibleSketchId(id) { assert.equal(this, visible); read('visibleSketch'); return !state.hidden && Boolean(id); },
    isVisibleSketchElement(item) { assert.equal(this, visible); read('visibleElement'); return !state.hidden && item.visible !== false; },
    isVisibleValue(value) { assert.equal(this, visible); read('visibleValue'); return value !== false; },
  };
  const dimensions = { placement: { defaultDimensionForTarget: () => ({}) },
    metrics: { dimensionTextDrawingMetrics: () => ({ height: 10, gap: 2 }), dimensionTextWidth: () => 20 },
    layout(target) { assert.equal(this, dimensions); read('layout'); return target.layout; } };
  const geometryReads = Object.fromEntries(['Points','Lines','Circles','Arcs','Splines'].map(kind => [
    `allGeometry${kind}`, () => { read(kind); return state.scope[kind.toLowerCase()]; } ]));
  Object.assign(geometryReads, { allHatches: () => { read('hatches'); return state.scope.hatches; },
    geometryInstanceBundles: () => { read('instances'); return state.instances; }, blockProjectionBundles: () => { read('blocks'); return state.blocks; } });
  const ports = { currentScope: () => { read('scope'); return state.scope; }, dimensionScope: () => { read('dimensionScope'); return state.dimensionScope; },
    viewport, geometryAppearance: visible, dimensions, geometryReads,
    pointUsage: { isExplicitPoint: () => true, isSelectableEndpointPoint: () => false, isPointUsedByPrimitive: () => false, isReferencePoint: () => false },
    sketchContext: { activeSketchId: () => { read('active'); return state.active; }, elementSketchId: item => item.sketchId,
      isEditableSketchId: () => { read('editable'); return !state.locked; }, isActiveSketchConstraint: item => item.sketchId === state.active,
      constraintSketchId: item => item.sketchId, operandRelationForSketch: id => id === state.active ? 'active' : 'reference', referenceSourceSketchIds: () => ['S2'] },
    catalog: { blockDefinitionById: () => null }, projections: { blockProjectionBundle: item => item.bundle },
    hatches: { resolvedHatchBoundary: () => ({ ok: true }), hatchContainsSelectablePoint: (item, resolved, p) => p.x === item.x },
    effectiveDimensionAppearance: () => ({ visible: true, fixedDisplaySize: false }), dimensionLabelForConstraint: () => 'D',
    dimensionUsesExpression: () => false, annotationBounds: () => null, hitAnnotationElement: (...args) => { read('annotation'); state.annotationArgs = args; return state.annotationHit || null; },
    hatchAppearanceForDisplay: () => ({ visible: true }), targetFromConstraint: item => item.target, drawingOrderOwner: item => item,
    referenceImageWorldToLocal: (item, p) => ({ x: p.x - item.x, y: p.y - item.y }), pointInExpandedBox: () => false,
    readMode: () => { read('mode'); return state.mode; }, readPendingCommand: () => { read('pending'); return state.pending; },
    readConstraintCommand: () => { read('command'); return state.command; },
    operandValues: { makeConstraintOperand: (kind, value) => ({ kind, ...value }), operandFromReferenceTarget: value => value },
  };
  configure(ports, state);
  const scene = buildScene(ports);
  assert.deepEqual(state.reads, []);
  const queries = scene.createQueries();
  assert.deepEqual(state.reads, []); state.ready = true;
  return { state, scene, queries, point, empty, ports };
}

function commandPanelFixture() {
  const calls = [], marker = new Error('panel query failed');
  const f = sceneFixture((ports, state) => {
    ports.sketchContext.referenceSourceSketchIds = () => { calls.push(['reference']); if (state.fail === 'reference') throw marker; return ['S2']; };
    ports.hatches.hatchFaceAt = function(point, options) {
      assert.equal(this, ports.hatches); calls.push(['face', point, options.includeConstruction]);
      if (state.fail === 'face') throw marker; return { ok: Boolean(state.face) };
    };
  });
  const gesture = sandbox.window.BlankCanvasGesture.create({});
  const blankCanvasGesture = { isBlank(hits) { assert.equal(this, blankCanvasGesture); calls.push(['blank', hits]); return f.state.forceBlank || gesture.isBlank(hits); } };
  const instanceSourceCommand = { get instance() { calls.push(['source']); return f.state.instance; } };
  const hatchCommand = { get includeConstruction() { calls.push(['construction']); return f.state.includeConstruction; } };
  const canvasHover = sandbox.window.CanvasHover.create({ isEndpointPoint: () => false });
  f.state.ready = false; const before = f.state.reads.slice();
  const api = f.queries.createInteraction({ canvasHover, sameArcEndpoint: () => false, hitBlockRotationHandle: () => null,
    hitAnnotationTarget: () => null, blankCanvasGesture, instanceSourceCommand, hatchCommand });
  assert.deepEqual(f.state.reads, before); assert.deepEqual(calls, []); f.state.ready = true;
  return { ...f, api, calls, canvasHover, marker, p: { x: 0, y: 0 }, names: () => calls.map(call => call[0]) };
}

test('scene press defaults to disabled Block rotation handles while explicit callbacks retain priority', () => {
  const f=sceneFixture(), canvasHover=sandbox.window.CanvasHover.create({isEndpointPoint:()=>false});
  const ports={canvasHover,sameArcEndpoint:()=>false,hitAnnotationTarget:()=>null};
  const reads=f.state.reads.slice();
  const api=f.queries.createInteraction(ports);
  assert.deepEqual(f.state.reads,reads);
  assert.equal(api.press.read({x:500,y:500}).hitBlockHandle,null);
  const handle={id:'handle'},calls=[];
  const custom=f.queries.createInteraction({...ports,hitBlockRotationHandle:function(x,y){'use strict';assert.equal(this,undefined);calls.push([x,y]);return handle;}});
  assert.equal(custom.press.read({x:7,y:9}).hitBlockHandle,handle);
  assert.deepEqual(calls,[[7,9]]);
  const invalid=f.queries.createInteraction({...ports,hitBlockRotationHandle:null});
  assert.throws(()=>invalid.press.read({x:7,y:9}),/not a function/);
});

test('command panel blank query shares the press snapshot, excludes annotations and leaves hover unchanged', () => {
  const f = commandPanelFixture(), selected = f.point('hover', 5, 5);
  f.canvasHover.update({ point: selected }); const before = { ...f.canvasHover.current };
  assert.ok(Object.isFrozen(f.api)); assert.equal(f.api.isBlankCommandPanelPoint(f.p), true); assert.deepEqual(f.names(), ['blank']);
  f.calls.length = 0; const annotation = { element: { id: 'AN', sketchId: 'S1' }, part: 'frame' }; f.state.annotationHit = annotation;
  assert.equal(f.api.isBlankCommandPanelPoint(f.p), false); assert.deepEqual(f.names(), ['blank']);
  assert.equal(f.calls[0][1].annotationHit, annotation); assert.equal(f.calls[0][1].blankAnnotationHit, annotation);
  assert.deepEqual({ ...f.canvasHover.current }, before);
});

test('command panel blank query rejects projection sources only in current projection modes and preserves source identity', () => {
  const f = commandPanelFixture(), source = f.point('source', 0, 0, 'S2');
  f.state.scope.points.push(source); f.state.forceBlank = true; f.state.mode = 'sketch-projection';
  assert.equal(f.api.isBlankCommandPanelPoint(f.p), false); assert.deepEqual(f.names(), ['blank', 'reference']);
  f.calls.length = 0; f.state.mode = 'instance-sources'; f.state.instance = { type: 'free' };
  assert.equal(f.api.isBlankCommandPanelPoint(f.p), true); assert.deepEqual(f.names(), ['blank', 'source']);
  f.calls.length = 0; f.state.instance = { type: 'sketchProjection' };
  assert.equal(f.api.isBlankCommandPanelPoint(f.p), false); assert.deepEqual(f.names(), ['blank', 'source', 'reference']);
  f.calls.length = 0; f.state.scope = f.empty(); assert.equal(f.api.isBlankCommandPanelPoint(f.p), true);
  f.calls.length = 0; f.state.fail = 'reference';
  assert.throws(() => f.api.isBlankCommandPanelPoint(f.p), error => error === f.marker);
  assert.deepEqual(f.names(), ['blank', 'source', 'reference']); assert.equal(source.sketchId, 'S2');
});

test('command panel blank query reads current Hatch options only after ordinary blank and propagates errors without mutation', () => {
  const f = commandPanelFixture(); f.state.mode = 'hatch'; f.state.includeConstruction = false;
  assert.equal(f.api.isBlankCommandPanelPoint(f.p), true); assert.deepEqual(f.names(), ['blank', 'construction', 'face']);
  assert.equal(f.calls.at(-1)[1], f.p); assert.equal(f.calls.at(-1)[2], false);
  f.calls.length = 0; f.state.mode = 'hatch-repair'; f.state.face = true; f.state.includeConstruction = true;
  assert.equal(f.api.isBlankCommandPanelPoint(f.p), false); assert.equal(f.calls.at(-1)[2], true);
  f.calls.length = 0; f.state.annotationHit = { element: { id: 'AN', sketchId: 'S1' } };
  assert.equal(f.api.isBlankCommandPanelPoint(f.p), false); assert.deepEqual(f.names(), ['blank']);
  f.calls.length = 0; f.state.annotationHit = null; f.state.fail = 'face'; const before = { ...f.canvasHover.current };
  assert.throws(() => f.api.isBlankCommandPanelPoint(f.p), error => error === f.marker);
  assert.deepEqual(f.names(), ['blank', 'construction', 'face']); assert.deepEqual({ ...f.canvasHover.current }, before);
});

test('scene stages defer reads and keep current mode, scope, scale and source identity', () => {
  const f = sceneFixture(), { state, queries, scene } = f;
  assert.ok(Object.isFrozen(scene)); assert.ok(Object.isFrozen(queries));
  const p = f.point('P', 8, 0, 'S2'); state.scope.points.push(p);
  assert.equal(queries.geometry.hitPoint(0, 0), p);
  state.scale = 2; assert.equal(queries.geometry.hitPoint(0, 0), null); state.scale = 1;
  for (const field of ['pending', 'command']) {
    state[field] = {}; assert.equal(scene.policy.ordinarySelectionMode(), false); assert.equal(queries.geometry.hitPoint(0, 0), null); state[field] = null;
  }
  state.mode = 'line'; assert.equal(queries.geometry.hitPoint(0, 0), null);
  state.active = 'S2'; assert.equal(queries.geometry.hitPoint(0, 0), p);
  state.locked = true; assert.equal(queries.geometry.hitPoint(0, 0), null); state.locked = false;
  state.hidden = true; assert.equal(queries.geometry.hitPoint(0, 0), null); state.hidden = false;
  state.scope = f.empty(); const next = f.point('P', 0, 0, 'S2'); state.scope.points.push(next);
  assert.equal(queries.geometry.hitPoint(0, 0), next); assert.notEqual(next, p);
});

test('scene dimension queries keep their separate live scope, receiver and explicit inactive options', () => {
  const f = sceneFixture(), { state, queries } = f;
  const target = { layout: { text: { x: 0, y: 0 }, hitA: { x: -10, y: 0 }, hitB: { x: 10, y: 0 } } };
  const constraint = { id: 'D', sketchId: 'S2', target, dimension: {} }; state.dimensionScope.constraints.push(constraint);
  assert.equal(queries.dimensions.hitDimension(0, 0).constraint, constraint);
  assert.equal(queries.geometry.hitSketchIdentityElement(0, 0).item, constraint);
  state.mode = 'line'; assert.equal(queries.dimensions.hitDimension(0, 0), null);
  assert.equal(queries.dimensions.hitDimension(0, 0, { activeOnly: false }).constraint, constraint);
  state.dimensionScope = f.empty(); assert.equal(queries.dimensions.hitDimension(0, 0), null);
  assert.equal(state.scope.constraints.length, 0);
  state.dimensionScope.constraints.push(constraint); state.mode = 'select'; state.error = new Error('scope failed');
  assert.throws(() => queries.dimensions.hitDimension(0, 0), error => error === state.error);
  assert.equal(state.dimensionScope.constraints[0], constraint);
});

test('scene regions and identity forward inactive options and annotation arguments', () => {
  const f = sceneFixture(), { state, queries } = f;
  const hatch = { id: 'H', sketchId: 'S2', x: 100 }, image = { id: 'I', sketchId: 'S2', x: 200, y: 0, pixelWidth: 10, pixelHeight: 10 };
  state.scope.hatches.push(hatch); state.scope.referenceImages.push(image);
  assert.equal(queries.regions.hitHatchAt(100, 0), hatch); assert.equal(queries.regions.hitReferenceImageAt(200, 0), image);
  state.mode = 'line'; assert.equal(queries.regions.hitHatchAt(100, 0), null); assert.equal(queries.regions.hitReferenceImageAt(200, 0), null);
  assert.equal(queries.geometry.hitSketchIdentityElement(100, 0, { allowInactiveGeometry: true }).item, hatch);
  assert.deepEqual(state.annotationArgs.slice(0, 2), [100, 0]); assert.equal(state.annotationArgs[2].activeOnly, false);
  assert.equal(queries.regions.hitReferenceImageAt(200, 0, { activeOnly: false }), image);
  assert.throws(() => queries.regions.hitReferenceImageAt(0, 0, null), /null/);
});

test('scene operands use shared live projection readers and retain original point references', () => {
  const f = sceneFixture(), { state, queries } = f;
  const p = f.point('P', 0, 0), projected = f.point('BP', 50, 0, 'S2'); state.scope.points.push(p);
  assert.equal(queries.operands.hitConstraintOperand({ x: 0, y: 0 }, 'fixed').point, p);
  const bundle = { instance: { sketchId: 'S2' }, points: [projected], lines: [], circles: [], arcs: [], splines: [] };
  state.blocks.push(bundle); assert.equal(queries.operands.hitBlockProjectionOperand(50, 0).point, projected);
  state.blocks = []; assert.equal(queries.operands.hitBlockProjectionOperand(50, 0), null);
  state.instances.push(bundle); assert.equal(queries.operands.hitDerivedProjectionOperand(50, 0).point, projected);
  state.hidden = true; assert.equal(queries.operands.hitDerivedProjectionOperand(50, 0), null);
  state.hidden = false; state.error = new Error('query failed');
  assert.throws(() => queries.operands.hitDerivedProjectionOperand(50, 0), error => error === state.error);
  assert.equal(state.instances[0], bundle); assert.equal(bundle.points[0], projected);
});

test('scene interaction attaches later without reads and shares live geometry with press and hover', () => {
  const f = sceneFixture(), { state, queries } = f;
  const p = f.point('P', 0, 0); state.scope.points.push(p);
  const canvasHover = sandbox.window.CanvasHover.create({ isEndpointPoint: () => false });
  state.ready = false; const beforeReads = state.reads.slice();
  const api = queries.createInteraction({ canvasHover, sameArcEndpoint: () => false, hitBlockRotationHandle: () => null, hitAnnotationTarget: () => null });
  assert.deepEqual(state.reads, beforeReads); state.ready = true;
  const hit = api.press.read({ x: 0, y: 0 }); assert.equal(hit.hitP, p); assert.equal(canvasHover.current.point, null);
  api.hover.updateOrdinary({ x: 0, y: 0 }); assert.equal(canvasHover.current.point, p);
  state.scope = f.empty(); const next = f.point('P', 0, 0); state.scope.points.push(next);
  assert.equal(api.press.read({ x: 0, y: 0 }).hitP, next);
  api.hover.updateOrdinary({ x: 0, y: 0 }); assert.equal(canvasHover.current.point, next);
  state.hidden = true; assert.equal(api.press.read({ x: 0, y: 0 }).hitP, null);
  api.hover.updateOrdinary({ x: 0, y: 0 }); assert.equal(canvasHover.current.point, null);
});

test('scene interaction keeps annotation priority and projected exclusion and preserves hover on reader errors', () => {
  const f = sceneFixture(), { state, queries } = f;
  const p = f.point('P', 0, 0); state.scope.points.push(p);
  const canvasHover = sandbox.window.CanvasHover.create({ isEndpointPoint: () => false });
  let target = { id: 'T' }, handle = null;
  const api = queries.createInteraction({ canvasHover, sameArcEndpoint: () => false,
    hitBlockRotationHandle: () => handle, hitAnnotationTarget: () => target });
  const annotation = { id: 'AN', sketchId: 'S1' }; state.annotationHit = { element: annotation, part: 'frame', resizeX: 1, resizeY: -1 };
  api.hover.updateOrdinary({ x: 0, y: 0 }); assert.equal(canvasHover.current.annotation, annotation); assert.equal(canvasHover.current.point, null);
  api.hover.updateConstraint({ x: 0, y: 0 }, 'fixed'); assert.equal(canvasHover.current.annotation, null); assert.equal(canvasHover.current.point, p);
  state.annotationHit.part = 'anchor'; api.hover.updateConstraint({ x: 0, y: 0 }, 'fixed'); assert.equal(canvasHover.current.annotation, annotation);
  annotation.blockProjection = true; api.hover.updateOrdinary({ x: 0, y: 0 }); assert.equal(canvasHover.current.annotation, null); assert.equal(canvasHover.current.point, p);
  assert.equal(api.press.read({ x: 0, y: 0 }).annotationTargetHit, target);
  target = { id: 'T2' }; handle = { id: 'B', sketchId: 'S1' };
  const hit = api.press.read({ x: 0, y: 0 }); assert.equal(hit.annotationTargetHit, target); assert.equal(hit.hitBlockHandle, handle);
  const before = { ...canvasHover.current }; state.error = new Error('scene read failed');
  assert.throws(() => api.hover.updateOrdinary({ x: 0, y: 0 }), error => error === state.error);
  assert.deepEqual({ ...canvasHover.current }, before);
  assert.throws(() => api.press.read({ x: 0, y: 0 }), error => error === state.error);
});

test('shared hit composition defers reads and press filtering keeps source references and hover unchanged across active Sketch changes', () => {
  const f = fixture(); assert.ok(Object.isFrozen(f.api)); assert.deepEqual(Object.keys(f.api), ['press','hover']);
  const line = { id: 'L', sketchId: 'S1' }, circle = { id: 'C', sketchId: 'S2' };
  f.values.hitLine = line; f.values.hitCircle = circle; const previous = f.canvasHover.current, before = { ...previous };
  let hits = f.api.press.read(f.p); assert.equal(hits.hitL, line); assert.equal(hits.hitC, null); assert.equal(hits.sketchIdentity.item, line); assert.equal(f.canvasHover.current, previous); assert.deepEqual({ ...f.canvasHover.current }, before);
  f.calls.length = 0; f.state.active = 'S2'; hits = f.api.press.readDoubleClick(f.p);
  assert.equal(hits.hitL, null); assert.equal(hits.hitC, circle);
  assert.deepEqual(f.names(), ['hitLine','hitPoint','hitCircle','hitArcEndpoint','hitArc','hitSpline','hitDimension','hitBlockInstance','hitAnnotationElement']);
  const derived = { instance: {} }; f.values.hitDerivedGeometryForDrag = derived; assert.equal(f.api.press.derivedGeometryAt(f.p), derived);
  assert.equal(f.canvasHover.current, previous); assert.deepEqual({ ...f.canvasHover.current }, before); assert.deepEqual(line, { id: 'L', sketchId: 'S1' });
});

test('annotation interaction filtering distinguishes anchors, frames and text from body hits and projected geometry', () => {
  for (const [part, textBody, ordinary] of [['anchor',false,true],['frame',false,true],['frame-enable',false,true],['body',true,true],['body',false,false]]) {
    const f = fixture(), line = {}, annotation = { id: 'AN' }; const hit = { element: annotation, part, textBody, resizeX: -1, resizeY: 1 };
    f.values.hitLine = line; f.values.hitAnnotationElement = hit;
    f.api.hover.updateOrdinary(f.p);
    assert.equal(f.canvasHover.current.annotation, ordinary ? annotation : null); assert.equal(f.canvasHover.current.line, ordinary ? null : line);
    if (ordinary) assert.deepEqual(f.names(), ['hitAnnotationElement']);
    if (part === 'frame') { assert.equal(f.canvasHover.current.annotationHandle.element, annotation); assert.equal(f.canvasHover.current.annotationHandle.resizeX, -1); }
    f.api.hover.updateConstraint(f.p, 'coincident');
    assert.equal(f.canvasHover.current.annotation, part === 'anchor' ? annotation : null); assert.equal(f.canvasHover.current.line, part === 'anchor' ? null : line);
    annotation.blockProjection = true; f.api.hover.updateOrdinary(f.p);
    assert.equal(f.canvasHover.current.annotation, null); assert.equal(f.canvasHover.current.line, line);
    assert.equal(hit.element, annotation); assert.equal(hit.part, part);
  }
});

test('press and hover share current scene readers while keeping dimension and projected operand priority in their owners', () => {
  const f = fixture(), active = { id: 'D', sketchId: 'S1' }, inactive = { id: 'D2', sketchId: 'S2' }, endpoint = {}, line = {};
  f.values.hitDimension = { constraint: active }; f.values.hitEndpointPoint = endpoint; f.api.hover.updateOrdinary(f.p);
  assert.equal(f.canvasHover.current.dimension, active); assert.equal(f.canvasHover.current.point, null);
  f.values.hitDimension = { constraint: inactive }; f.calls.length = 0; f.api.hover.updateOrdinary(f.p);
  assert.equal(f.canvasHover.current.dimension, null); assert.equal(f.canvasHover.current.point, endpoint); assert.equal(f.canvasHover.current.endpointPoint, endpoint);
  f.calls.length = 0; f.values.hitDerivedProjectionOperand = { kind: 'line', line }; f.api.hover.updateConstraint(f.p, 'coincident');
  assert.equal(f.canvasHover.current.line, line); assert.equal(f.canvasHover.current.point, null);
  assert.deepEqual(f.names(), ['hitAnnotationElement','hitDerivedProjectionOperand']);
  f.values.hitAnnotationElement = { element: { id: 'AN', sketchId: 'S1' }, part: 'body' }; f.values.hitAnnotationTarget = { id: 'target' };
  const hits = f.api.press.read(f.p); assert.equal(hits.blankAnnotationHit, f.values.hitAnnotationElement); assert.equal(hits.annotationTargetHit, f.values.hitAnnotationTarget);
  assert.equal(f.canvasHover.current.line, line);
});

test('hit reader exceptions propagate without fabricating a press result or changing existing hover', () => {
  const f = fixture(), line = {}; f.canvasHover.update({ line }); const previous = f.canvasHover.current, before = { ...previous }, error = new Error('annotation query failed');
  f.state.error = { name: 'hitAnnotationElement', value: error };
  assert.throws(() => f.api.hover.updateOrdinary(f.p), value => value === error); assert.deepEqual(f.names(), ['hitAnnotationElement']); assert.equal(f.canvasHover.current, previous); assert.deepEqual({ ...f.canvasHover.current }, before);
  f.calls.length = 0; assert.throws(() => f.api.press.read(f.p), value => value === error); assert.equal(f.calls.at(-1)[0], 'hitAnnotationElement'); assert.equal(f.canvasHover.current, previous); assert.deepEqual({ ...f.canvasHover.current }, before);
  f.state.error = null; f.values.hitLine = line; f.api.hover.updateOrdinary(f.p); assert.equal(f.canvasHover.current.line, line);
});

test('context query shares live scope and visibility while preserving point and edited fit point priority', () => {
  const calls = [], f = sceneFixture(ports => {
    ports.pointUsage.isExplicitPoint = point => { calls.push('explicit'); return point.id !== 'endpoint'; };
    ports.pointUsage.isSelectableEndpointPoint = point => { calls.push('endpoint'); return true; };
    ports.sketchContext.isEditableSketchElement = () => { throw new Error('visibility is distinct from editing permission'); };
  });
  const { state, queries } = f; state.ready = false;
  const query = queries.createContextQuery({ editedFitPoints: () => state.edited, canvasContextAnnotationHit: () => null });
  assert.deepEqual(calls, []); assert.deepEqual(state.reads, []); state.ready = true;
  const explicit = f.point('explicit', 0, 0, 'S2'), endpoint = f.point('endpoint', 4, 0, 'S2');
  state.scope.points.push(explicit, endpoint); state.mode = 'line'; state.pending = {}; state.locked = true;
  assert.deepEqual(Array.from(query.candidatesAt({ x: 0, y: 0 }), target => target.item), [explicit, endpoint]);
  assert.deepEqual(calls, ['explicit','explicit','endpoint']);
  state.edited = [endpoint]; assert.equal(query.candidatesAt({ x: 0, y: 0 })[0].item, endpoint);
  assert.equal(query.candidatesAt({ x: 0, y: 0 }).length, 1);
  state.scale = 10; assert.deepEqual(Array.from(query.candidatesAt({ x: 0, y: 0 }), target => target.item), [explicit]);
  state.hidden = true; assert.equal(query.candidatesAt({ x: 0, y: 0 }).length, 0); state.hidden = false;
  const next = f.point('next', 0, 0); state.scope = f.empty(); state.scope.points.push(next);
  assert.equal(query.candidatesAt({ x: 0, y: 0 })[0].item, next);
  const error = new Error('scope failed'); state.error = error;
  assert.throws(() => query.candidatesAt({ x: 0, y: 0 }), actual => actual === error);
  assert.equal(state.scope.points[0], next);
});

test('context query keeps Document scope and shares dimension layout, projection, annotation and image readers', () => {
  const bundle = { points: [{ x: 0, y: 0 }], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [] };
  const calls = [], f = sceneFixture(ports => {
    ports.geometryReads.geometryInstanceBundle = function(item) { 'use strict'; assert.equal(this, undefined); calls.push(item); return bundle; };
  });
  const { state, queries } = f;
  const target = { layout: { text: { x: 0, y: 0 }, hitA: { x: -5, y: 0 }, hitB: { x: 5, y: 0 } } };
  const constraint = { id: 'document-dimension', sketchId: 'S2', target, dimension: {} };
  state.scope.constraints.push(constraint); state.dimensionScope.constraints.push({ ...constraint, id: 'presentation-only' });
  const instance = { id: 'instance', sketchId: 'S2' }, block = { id: 'block', sketchId: 'S2', bundle };
  state.scope.geometryInstances.push(instance); state.scope.blockInstances.push(block);
  const annotation = { id: 'annotation', sketchId: 'S2' }, image = { id: 'image', sketchId: 'S2', x: 0, y: 0, pixelWidth: 10, pixelHeight: 10 };
  state.scope.annotations.push(annotation); state.scope.referenceImages.push(image);
  const pointer = { x: 0, y: 0 }, hit = { distance: 0 }, error = new Error('annotation failed');
  const query = queries.createContextQuery({ editedFitPoints: () => null,
    canvasContextAnnotationHit(item, point) { assert.equal(item, annotation); assert.equal(point, pointer); if (state.failAnnotation) throw error; return hit; } });
  const candidates = query.candidatesAt(pointer);
  assert.deepEqual(Array.from(candidates, candidate => candidate.item), [constraint, annotation, block, instance, image]);
  assert.equal(candidates[1].hit, hit); assert.deepEqual(calls, [instance]);
  assert.equal(state.reads.includes('layout'), true); assert.equal(state.reads.includes('dimensionScope'), false);
  state.failAnnotation = true; calls.length = 0;
  assert.throws(() => query.candidatesAt(pointer), actual => actual === error);
  assert.deepEqual(calls, []); assert.equal(state.scope.annotations[0], annotation);
});

function workspaceSceneFixture(composed, probe = {}) {
  const w = sandbox.window, stages = [], captured = {}, restorations = [], effects = [];
  Object.assign(probe, { stages, captured, effects });
  const factories = {
    GeometryHitQuery: { createScopePolicy: "policy", createRegions: "regions", createDimensions: "dimensions", createInstances: "instances", create: "geometry" },
    OperandHitQuery: { create: "operands" }, RectangleSelectionFeature: { create: "rectangle-feature" },
    RectangleSelectionQuery: { create: "rectangle-query" }, CanvasSelectionInteraction: { createRectangleSelection: "selection" },
    InstanceCommandInput: { createRectangleSources: "sources" }, SelectionRectangle: { create: "rectangle" },
  };
  for (const [name, methods] of Object.entries(factories)) {
    const original = w[name], wrapped = { ...original }; restorations.push(() => { w[name] = original; });
    for (const [method, stage] of Object.entries(methods)) wrapped[method] = input => {
      stages.push(stage); captured[stage] = input; if (probe.failAt === stage) throw probe.error;
      const result = original[method](input); return probe.decorate ? probe.decorate(stage, result) : result;
    };
    w[name] = wrapped;
  }
  try {
    let owners, selection;
    const f = sceneFixture((ports, state) => {
      selection = w.CanvasSelection.create();
      const scope = w.CanvasSelection.createScopeQuery({ canvasSelection: selection, selectedGeometryItems: selection.selectedGeometryItems });
      ports.sketchContext.isActiveSketchElement = item => item.sketchId === state.active;
      Object.assign(ports, { targetFromConstraint: w.DimensionQueries.targetFromConstraint, drawingOrderOwner: w.DrawingOrder.drawingOrderOwner,
        hatchAppearanceForDisplay: w.HatchData.hatchAppearanceForDisplay, referenceImageWorldToLocal: w.ReferenceImageGeometry.referenceImageWorldToLocal,
        pointInExpandedBox: w.GeometryBounds.pointInExpandedBox });
      owners = { documentWorkspace: { workspace: { current: ports.currentScope }, sketches: ports.sketchContext, parameters: { dimensionUsesExpression: ports.dimensionUsesExpression } },
        readServices: { reads: ports.geometryReads, catalog: ports.catalog, projections: ports.projections, hatches: ports.hatches,
          geometryAppearance: ports.geometryAppearance, dimensionAppearance: { effectiveDimensionAppearance: ports.effectiveDimensionAppearance } },
        interaction: { pointUsage: ports.pointUsage, selection, scope, lifecycle: { readMode: ports.readMode } },
        sessions: { pending: { get current() { return ports.readPendingCommand(); } }, targets: { get command() { return ports.readConstraintCommand(); } } },
        viewport: ports.viewport, dimensionScope: ports.dimensionScope, dimensions: ports.dimensions, dimensionLabelForConstraint: ports.dimensionLabelForConstraint,
        annotationBounds: ports.annotationBounds, hitAnnotationElement: ports.hitAnnotationElement, operandValues: ports.operandValues };
      if (probe.configure) probe.configure(owners, state);
    }, ports => composed ? w.CanvasHitInteraction.createSceneForWorkspace(owners) : w.CanvasHitInteraction.createScene(ports));
    f.state.ready = false; stages.push("between");
    function effect(name) { "use strict"; return function(...args) { assert.equal(this, undefined); assert.equal(f.state.ready, true); effects.push([name, ...args]); if (f.state.failEffect === name) throw probe.error; }; }
    const canvas = { releasePointerCapture(id) { assert.equal(this, canvas); effects.push(["release", id]); if (f.state.releaseFails) throw new Error("capture already released"); } };
    const dimensionBounds = { read: constraint => { assert.equal(f.state.ready, true); return constraint.bounds || null; } };
    const source = { instance: { type: "mirror" }, addSources(items) { assert.equal(this, source); effects.push(["source", ...items]); } };
    const instances = { addSources(items) { assert.equal(this, instances); effects.push(["instances", ...items]); } };
    const projection = { command: { addByRect: effect("projection") }, sketchProjectionEntriesByRect: () => [{ item: f.state.scope.points[0] }] };
    const presentation = { setHint: effect("hint"), updateGeometrySelectionUI: effect("ui"), draw: effect("draw") };
    const clearSelection = () => { effects.push(["clear"]); f.state.clears = (f.state.clears || 0) + 1; selection.clear(); };
    const options = { dimensionBounds, instanceSourceCommand: source, geometryInstanceCommand: instances, sketchProjection: projection, canvas, clearSelection, presentation };
    const rectangle = composed ? f.scene.createRectangleSelection(options) : w.RectangleSelectionFeature.create({ currentScope: f.ports.dimensionScope,
      viewport: f.ports.viewport, canvasSelection: selection, selectionScope: owners.interaction.scope, sketches: f.ports.sketchContext, pointUsage: f.ports.pointUsage,
      appearance: f.ports.geometryAppearance, geometryReads: f.ports.geometryReads, projections: f.ports.projections, hatches: f.ports.hatches,
      dimensionBounds, annotationBounds: f.ports.annotationBounds, hatchAppearanceForDisplay: f.ports.hatchAppearanceForDisplay,
      readMode: f.ports.readMode, instanceSourceCommand: source, geometryInstanceCommand: instances, sketchProjection: projection,
      releasePointer: id => { try { canvas.releasePointerCapture(id); } catch (_) {} }, clearSelection,
      setHint: presentation.setHint, updateGeometrySelectionUI: presentation.updateGeometrySelectionUI, draw: presentation.draw });
    assert.deepEqual(f.state.reads, []); assert.deepEqual(effects, []); f.state.ready = true;
    function finish(options = {}, end = { x: 10, y: 10 }) {
      rectangle.rectangle.begin({ x: 0, y: 0 }, options); rectangle.rectangle.update(end); return rectangle.rectangle.finish({ pointerId: 7 });
    }
    return { ...f, owners, selection, rectangle, effects, stages, captured, options, finish, source, projection };
  } finally { for (const restore of restorations) restore(); }
}

test("Workspace hit scene keeps cold policy, query and late rectangle construction, exact scopes and existing owner identity", () => {
  for (const composed of [false, true]) {
    const f = workspaceSceneFixture(composed);
    assert.deepEqual(f.stages, ["policy", "regions", "dimensions", "instances", "geometry", "operands", "between", "rectangle-feature", "rectangle-query", "selection", "sources", "rectangle"]);
    assert.equal(f.captured.geometry.currentScope, f.ports.currentScope); assert.equal(f.captured.dimensions.currentScope, f.ports.dimensionScope);
    assert.equal(f.captured["rectangle-query"].currentScope, f.ports.dimensionScope); assert.notEqual(f.ports.currentScope, f.ports.dimensionScope);
    assert.equal(f.captured.selection.canvasSelection, f.selection); assert.equal(f.captured["rectangle-feature"].dimensionBounds, f.options.dimensionBounds);
    assert.equal(f.captured["rectangle-feature"].clearSelection, f.options.clearSelection);
    assert.equal(Object.isFrozen(f.scene), true); assert.equal(Object.isFrozen(f.rectangle), true); assert.equal(f.rectangle.rectangle.active, false);
  }
});

test("Workspace hit and rectangle scene retain independent live scopes, selection identity, zoom, visibility and all rectangle routes", () => {
  const results = [];
  for (const composed of [false, true]) {
    const f = workspaceSceneFixture(composed), p = f.point("workspace", 5, 5), q = f.point("display", 5, 5);
    f.state.scope.points.push(p); f.state.dimensionScope.points.push(q);
    assert.equal(f.queries.geometry.hitPoint(5, 5), p); f.finish(); assert.equal(f.selection.points[0], q);
    assert.deepEqual(f.effects.map(e => e[0]), ["release", "hint", "ui", "draw"]); f.effects.length = 0;
    f.finish({ kind: "instance-sources" }); assert.equal(f.effects[1][1], p); assert.equal(f.effects[1][0], "instances");
    f.state.mode = "instance-sources"; f.effects.length = 0; f.finish({ kind: "instance-sources" }); assert.equal(f.effects[1][0], "source"); assert.equal(f.effects[1][1], p);
    f.source.instance.type = "sketchProjection"; f.effects.length = 0; f.finish({ kind: "instance-sources" }); assert.equal(f.effects[1][1], p);
    f.effects.length = 0; f.finish({ kind: "sketch-projection" }, { x: -10, y: 10 }); assert.equal(f.effects[1][0], "projection"); assert.equal(f.effects[1][2], true);
    f.state.mode = "select"; f.state.scope = f.empty(); assert.equal(f.queries.geometry.hitPoint(5, 5), null);
    f.state.hidden = true; f.finish(); assert.equal(f.selection.points.length, 0); f.state.hidden = false;
    f.state.dimensionScope = f.empty(); f.state.dimensionScope.points.push(q); f.state.releaseFails = true;
    f.finish({}, { x: 2, y: 0 }); assert.equal(f.state.clears, 1); f.state.scale = 2;
    f.finish({}, { x: 2, y: 0 }); assert.equal(f.selection.points.length, 0);
    f.state.scale = 1; f.finish(); assert.equal(f.selection.points[0], q);
    const circle = new sandbox.window.GeometrySolver.Circle("C1", f.point("center", 0, 0), 5);
    const constraint = Object.assign(new sandbox.window.GeometrySolver.RadiusConstraint(circle, 5), { id: "D", sketchId: "S1", dimension: {}, bounds: { x1: 0, y1: 0, x2: 10, y2: 10 } });
    f.ports.dimensions.layout = () => ({ text: { x: 0, y: 0 }, hitA: { x: -10, y: 0 }, hitB: { x: 10, y: 0 } });
    f.state.dimensionScope.constraints.push(constraint); assert.equal(f.queries.dimensions.hitDimension(0, 0).constraint, constraint);
    f.finish(); assert.equal(f.selection.dimensionConstraints[0], constraint);
    constraint.sketchId = "S2"; f.state.pending = {}; assert.equal(f.scene.policy.ordinarySelectionMode(), false); assert.equal(f.queries.dimensions.hitDimension(0, 0), null); f.state.pending = null;
    f.state.command = {}; assert.equal(f.scene.policy.ordinarySelectionMode(), false); f.state.command = null;
    f.state.dimensionScope = f.empty(); assert.equal(f.queries.dimensions.hitDimension(0, 0), null);
    results.push(JSON.stringify({ effects: f.effects, selected: f.selection.points.map(point => point.id) }));
  }
  assert.equal(results[1], results[0]);
});

test("Workspace hit scene propagates constructor, scope and notification errors and retains release-capture swallowing and completed-session boundaries", () => {
  const order = ["policy", "regions", "dimensions", "instances", "geometry", "operands", "between", "rectangle-feature", "rectangle-query", "selection", "sources", "rectangle"];
  for (const composed of [false, true]) {
    for (const failAt of order.filter(name => name !== "between")) {
      const error = new Error(failAt), probe = { failAt, error }; assert.throws(() => workspaceSceneFixture(composed, probe), value => value === error);
      assert.deepEqual(probe.stages, order.slice(0, order.indexOf(failAt) + 1)); assert.deepEqual(probe.effects, []);
    }
    const error = new Error("scope"), f = workspaceSceneFixture(composed, { error }); f.state.error = error;
    assert.throws(() => f.queries.geometry.hitPoint(0, 0), value => value === error);
    assert.throws(() => f.finish(), value => value === error); assert.equal(f.rectangle.rectangle.active, false); assert.deepEqual(f.effects, [["release", 7]]);
    for (const name of ["hint", "ui", "draw"]) {
      const marker = new Error(name), g = workspaceSceneFixture(composed, { error: marker }); g.state.failEffect = name; g.state.releaseFails = true;
      assert.throws(() => g.finish(), value => value === marker); assert.equal(g.rectangle.rectangle.active, false); assert.equal(g.effects.at(-1)[0], name);
      assert.equal(g.rectangle.rectangle.finish({ pointerId: 7 }), false);
    }
  }
});


function annotationPolicyFixture(composed, { real = false, failAt = null, probe = {} } = {}) {
 const w=sandbox.window,original=w.GeometryHitQuery;let owners,spatial,ordinarySelectionMode,captured;
 probe.rawCalls=[];probe.error=new Error(failAt||'annotation hit');
 w.GeometryHitQuery={...original,createScopePolicy(input){if(failAt==='policy')throw probe.error;return original.createScopePolicy(input);},
  create(input){captured=input;if(failAt==='geometry')throw probe.error;return original.create(input);}};
 let f;
 try{f=sceneFixture((ports,state)=>{
  probe.state=state;
  const query=real?w.AnnotationSpatialQuery.create({viewportScale:()=>1,annotationTextWorldHeight:()=>10,formatDisplayNumber:String,
   allAnnotations:()=>state.scope.annotations,isVisibleSketchId:id=>!(state.hiddenIds||[]).includes(id),activeSketchId:ports.sketchContext.activeSketchId,
   annotationLeaderAnchor:element=>element.start,annotationTextLayout:()=>({x:0,y:0,rotation:0,left:-5,width:10,height:10,bounds:{x1:-5,y1:-5,x2:5,y2:5}})})
   :{hitAnnotationElement:function(){'use strict';assert.equal(this,undefined);assert.equal(state.ready,true);state.reads.push('raw');probe.rawCalls.push([...arguments]);if(state.rawFailure)throw probe.error;return state.hitResult;}};
  spatial={...query};
  owners={documentWorkspace:{workspace:{current:ports.currentScope},sketches:ports.sketchContext,parameters:{dimensionUsesExpression:ports.dimensionUsesExpression}},
   readServices:{reads:ports.geometryReads,catalog:ports.catalog,projections:ports.projections,hatches:ports.hatches,geometryAppearance:ports.geometryAppearance,dimensionAppearance:{effectiveDimensionAppearance:ports.effectiveDimensionAppearance}},
   interaction:{pointUsage:ports.pointUsage,lifecycle:{readMode:ports.readMode}},sessions:{pending:{get current(){return ports.readPendingCommand();}},targets:{get command(){return ports.readConstraintCommand();}}},
   viewport:ports.viewport,dimensionScope:ports.dimensionScope,dimensions:ports.dimensions,dimensionLabelForConstraint:ports.dimensionLabelForConstraint,
   annotationBounds:ports.annotationBounds,operandValues:ports.operandValues};
 },()=>{
  if(composed==='prepared'){
   const preparation=w.CanvasHitInteraction.prepareSceneWithAnnotationsForWorkspace();probe.preparation=preparation;
   const unready=()=>assert.throws(()=>preparation.hitReferenceImageAt(),{name:'ReferenceError',message:"Cannot access 'regionHitQuery' before initialization"});
   unready();const scene=preparation.createScene({...owners,annotationSpatial:spatial});unready();return scene;
  }
  if(composed)return w.CanvasHitInteraction.createSceneWithAnnotationsForWorkspace({...owners,annotationSpatial:spatial});
  const {hitAnnotationElement:queryAnnotationElement}=spatial;
  function hitAnnotationElement(x,y,options={}){return queryAnnotationElement(x,y,{activeOnly:!ordinarySelectionMode(),...options});}
  const scene=w.CanvasHitInteraction.createSceneForWorkspace({...owners,hitAnnotationElement});ordinarySelectionMode=scene.policy.ordinarySelectionMode;
  return Object.freeze({...scene,hitAnnotationElement});
 });}finally{w.GeometryHitQuery=original;}
 return {...f,probe,spatial,captured};
}

test('annotation scene policy preserves bare query, argument narrowing, live policy order and caller option overrides',()=>{
 const traces=[];
 for(const composed of [false,true,'prepared']){
  const f=annotationPolicyFixture(composed),hit=f.scene.hitAnnotationElement,marker={},symbol=Symbol('option');f.state.hitResult=marker;
  assert.equal(Object.isFrozen(f.scene),true);assert.equal(hit(1,2,undefined,'ignored'),marker);assert.equal(f.probe.rawCalls.at(-1).length,3);assert.equal(f.probe.rawCalls.at(-1)[2].activeOnly,false);
  assert.deepEqual(f.state.reads,['mode','pending','command','raw']);
  f.state.mode='line';f.state.reads=[];hit(1,2);assert.equal(f.probe.rawCalls.at(-1)[2].activeOnly,true);assert.deepEqual(f.state.reads,['mode','raw']);
  f.state.mode='select';f.state.pending={};f.state.reads=[];hit(1,2);assert.deepEqual(f.state.reads,['mode','pending','raw']);
  f.state.pending=null;f.state.command={};hit(1,2);assert.equal(f.probe.rawCalls.at(-1)[2].activeOnly,true);f.state.command=null;
  const options={get activeOnly(){f.state.reads.push('option');return true;},[symbol]:marker};f.state.reads=[];hit(3,4,options);
  assert.deepEqual(f.state.reads,['mode','pending','command','option','raw']);assert.equal(f.probe.rawCalls.at(-1)[2][symbol],marker);assert.equal(f.probe.rawCalls.at(-1)[2].activeOnly,true);
  f.state.reads=[];assert.equal(f.captured.hitAnnotationElement(3,4,{activeOnly:false}),marker);assert.deepEqual(f.state.reads,['mode','pending','command','raw']);
  f.spatial.hitAnnotationElement=()=>assert.fail('raw query reference is captured once');assert.equal(hit(1,2,null),marker);
  f.state.reads=[];f.state.error=f.probe.error;assert.throws(()=>hit(1,2,options),error=>error===f.probe.error);assert.deepEqual(f.state.reads,['mode']);f.state.error=null;
  f.state.reads=[];assert.throws(()=>hit(1,2,{get activeOnly(){throw f.probe.error;}}),error=>error===f.probe.error);assert.deepEqual(f.state.reads,['mode','pending','command']);
  f.state.rawFailure=true;assert.throws(()=>hit(1,2),error=>error===f.probe.error);
  traces.push(JSON.stringify(f.probe.rawCalls.map(args=>[args[0],args[1],args[2].activeOnly])));
 }
 assert.equal(traces[1],traces[0]);assert.equal(traces[2],traces[0]);
});

test('annotation scene policy retains actual annotation identities and scope across selection, commands, visibility and model replacement',()=>{
 const traces=[];
 for(const composed of [false,true,'prepared']){
  const f=annotationPolicyFixture(composed,{real:true}),active={id:'A1',type:'text',text:'active',sketchId:'S1'},inactive={id:'A2',type:'text',text:'inactive',sketchId:'S2'};
  f.state.scope.annotations.push(active,inactive);const picks=[];
  const pick=(options,expected)=>{const hit=f.scene.hitAnnotationElement(0,0,options);assert.equal(hit?.element,expected);if(hit)assert.equal(hit.part,'label');picks.push(hit?.element.id||null);};
  pick(undefined,inactive);pick({activeOnly:true},active);pick({activeOnly:undefined},active);
  for(const field of ['pending','command']){f.state[field]={};pick(undefined,active);pick({activeOnly:false},inactive);f.state[field]=null;}
  f.state.mode='line';pick(undefined,active);f.state.active='S2';pick(undefined,inactive);f.state.mode='select';f.state.locked=true;pick(undefined,inactive);
  inactive.visible=false;pick(undefined,active);inactive.visible=true;f.state.hiddenIds=['S2'];pick(undefined,active);f.state.hiddenIds=[];
  f.state.scope=f.empty();pick(undefined,undefined);f.state.scope.annotations.push(inactive);pick(undefined,inactive);
  traces.push(JSON.stringify(picks));
 }
 assert.equal(traces[1],traces[0]);assert.equal(traces[2],traces[0]);
});

test('annotation scene construction fails at the original policy or geometry stage without invoking annotation or reading the model',()=>{
 for(const composed of [false,true,'prepared'])for(const failAt of ['policy','geometry']){const probe={};assert.throws(()=>annotationPolicyFixture(composed,{failAt,probe}),error=>error===probe.error);assert.deepEqual(probe.rawCalls,[]);assert.deepEqual(probe.state.reads,[]);}
});

test('prepared image hit uses the same live regions, order, bounds and scope policy as Canvas picking',()=>{
 const f=annotationPolicyFixture('prepared'),hit=f.probe.preparation.hitReferenceImageAt;
 const first={id:'I1',sketchId:'S1',x:0,y:0,rotation:Math.PI/2,scale:2,pixelWidth:20,pixelHeight:10};
 const last={...first,id:'I2',sketchId:'S2',locked:true};f.state.scope.referenceImages=[first,last];
 function pick(x,y,options,expected){assert.equal(hit(x,y,options),expected);assert.equal(f.queries.regions.hitReferenceImageAt(x,y,options),expected);}
 pick(0,20,undefined,last);pick(0,20.1,undefined,null);f.state.mode='line';pick(0,0,undefined,first);
 pick(0,0,{activeOnly:false},last);f.state.mode='select';f.state.pending={};pick(0,0,undefined,first);
 f.state.pending=null;f.state.command={};pick(0,0,undefined,first);f.state.command=null;
 last.visible=false;pick(0,0,undefined,first);last.visible=true;f.state.hidden=true;pick(0,0,undefined,null);f.state.hidden=false;
 f.state.scope=f.empty();pick(0,0,undefined,null);f.state.scope.referenceImages.push(last);pick(0,0,undefined,last);
 assert.throws(()=>hit(0,0,null),error=>error.name==='TypeError');
 const failure=new Error('live query');f.state.error=failure;assert.throws(()=>hit(0,0),error=>error===failure);
 assert.equal(f.state.scope.referenceImages[0],last);
});

test('prepared regions publish only after all queries finish and retain the actual receiver, arguments and prior completed generation',()=>{
 const w=sandbox.window,original=w.GeometryHitQuery,failure=new Error('region query'),calls=[];
 let fail=null,generation=0,fieldReads=0,methodFailure=false,malformed=false,value;
 const wrapper={...original};
 for(const name of ['createRegions','createDimensions','createInstances','create'])wrapper[name]=function(options){
  if(fail===name)throw failure;const result=original[name](options);if(name!=='createRegions')return result;
  if(malformed)return value;
  const marker={generation:++generation};const region={...result,get hitReferenceImageAt(){fieldReads++;return function(){'use strict';assert.equal(this,region);calls.push(Array.from(arguments));if(methodFailure)throw failure;return marker;};}};
  return Object.freeze(region);
 };
 w.GeometryHitQuery=wrapper;
 try{
  const f=annotationPolicyFixture('prepared'),preparation=f.probe.preparation,hit=preparation.hitReferenceImageAt;
  assert.equal(fieldReads,0);const options={activeOnly:false},extra={};const first=hit(1,2,options,extra);
  assert.deepEqual(calls.at(-1),[1,2,options,extra]);assert.equal(first.generation,1);assert.equal(fieldReads,1);
  for(const name of ['createRegions','createDimensions','createInstances','create']){
   fail=name;assert.throws(()=>f.scene.createQueries(),error=>error===failure);assert.equal(hit(),first);
  }
  fail=null;methodFailure=true;assert.throws(()=>hit(),error=>error===failure);methodFailure=false;
  const queries=f.scene.createQueries();const next=hit();assert.notEqual(next,first);assert.equal(queries.regions.hitReferenceImageAt(),next);
  const independent=w.CanvasHitInteraction.prepareSceneWithAnnotationsForWorkspace();assert.throws(()=>independent.hitReferenceImageAt(),error=>error.name==='ReferenceError');
  for(value of [undefined,null]){malformed=true;f.scene.createQueries();assert.throws(()=>hit(),error=>error.name==='TypeError');}
 }finally{w.GeometryHitQuery=original;}
});

test('Workspace hit entry points preserve query receivers, argument limits, fresh defaults and live operand read order',()=>{
 const calls=[],state={operands:[],error:null,fail:null},result={hit:true};let owners;
 const f=workspaceSceneFixture(true,{
  configure(o,s){owners=o;Object.defineProperty(o.sessions.targets,'operands',{get(){assert.equal(s.ready,true,'no operands read during construction');calls.push(['operands']);if(state.fail==='operands')throw state.error;return state.operands;}});},
  decorate(stage,raw){'use strict';const names={dimensions:'hitDimension',instances:'hitBlockInstance',operands:'hitConstraintOperand'};const name=names[stage];if(!name)return raw;
   const api={...raw,[name]:function(...args){assert.equal(this,stage==='operands'?undefined:api);calls.push([name,...args]);if(state.fail===name)throw state.error;return result;}};return Object.freeze(api);}
 });
 assert.deepEqual(calls,[]);assert.equal(Object.isFrozen(f.queries),true);
 const {hitDimension,hitBlockInstance,hitConstraintOperand}=f.queries;
 const point={x:3,y:7},hits={hitP:point},extra={extra:true};
 assert.equal(hitDimension(1,2,extra),result);assert.deepEqual(calls.pop(),['hitDimension',1,2,extra]);
 assert.equal(hitBlockInstance(1,2,false,extra),result);assert.deepEqual(calls.pop(),['hitBlockInstance',1,2,false,extra]);
 assert.equal(hitConstraintOperand(point,'symmetry',hits,extra),result);assert.deepEqual(calls.map(c=>c[0]),['operands','hitConstraintOperand']);
 assert.equal(calls[1].length,5);assert.equal(calls[1][3],state.operands);assert.equal(calls[1][4],hits);
 calls.length=0;hitConstraintOperand(point,'symmetry');const first=calls[1][4];calls.length=0;
 state.operands=[{kind:'line'}];hitConstraintOperand(point,'symmetry',undefined);assert.notEqual(calls[1][4],first);assert.deepEqual(Object.keys(first),[]);assert.equal(calls[1][3],state.operands);
 calls.length=0;hitConstraintOperand(point,'symmetry',null);assert.equal(calls[1][4],null);
 for(const name of ['operands','hitConstraintOperand','hitDimension','hitBlockInstance']){
  state.fail=name;state.error=new Error(name);calls.length=0;
  const action=name==='hitDimension'?()=>hitDimension(3,4):name==='hitBlockInstance'?()=>hitBlockInstance(3,4):()=>hitConstraintOperand(point,'fixed',hits);
  assert.throws(action,error=>error===state.error);
  assert.deepEqual(calls.map(c=>c[0]),name==='operands'?['operands']:name==='hitConstraintOperand'?['operands',name]:[name]);
 }
 assert.equal(owners.sessions.targets.command,null);
});

test('Workspace operand entry uses the current Target session through actual symmetry hit priority without mutating selection',()=>{
 const f=workspaceSceneFixture(true),p=f.point('p',3,4),line={id:'line',sketchId:'S1'},pointer={x:300,y:400},hits={hitP:p,hitL:line};
 f.owners.sessions.targets.operands=[];
 const selected=f.selection.points;
 const first=f.queries.hitConstraintOperand(pointer,'symmetry',hits);assert.equal(first.kind,'line');assert.equal(first.line,line);
 f.owners.sessions.targets.operands=[{kind:'line'},{kind:'point'}];
 const second=f.queries.hitConstraintOperand(pointer,'symmetry',hits);assert.equal(second.kind,'point');assert.equal(second.point,p);
 assert.equal(f.selection.points,selected);assert.equal(selected.length,0);assert.equal(f.owners.sessions.targets.operands.length,2);
});
