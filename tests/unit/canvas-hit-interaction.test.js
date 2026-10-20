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
