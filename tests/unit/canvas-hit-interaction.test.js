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

function sceneFixture(configure = () => {}) {
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
  const scene = sandbox.window.CanvasHitInteraction.createScene(ports);
  assert.deepEqual(state.reads, []);
  const queries = scene.createQueries();
  assert.deepEqual(state.reads, []); state.ready = true;
  return { state, scene, queries, point, empty };
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
