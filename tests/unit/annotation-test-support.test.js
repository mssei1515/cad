const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/annotation_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { scope: { annotations: [] }, drag: {}, hit: { type: 'leader', part: 'body' } };
  const ports = { currentScope: () => { calls.push('scope'); return state.scope; }, canvas: { getBoundingClientRect: () => ({ left: 10, top: 20 }) },
    worldToCanvasScreen: point => ({ x: point.x*2, y: point.y*2 }), screenToWorld: point => ({ x: point.x/2, y: point.y/2 }),
    annotationLeaderDisplayGeometry: item => item,
    hitAnnotationElement: (x,y) => { calls.push(['hit',x,y]); return state.hit; }, readDragState: () => state.drag,
    resetModelState: () => { state.scope = { annotations: [] }; calls.push('reset'); }, addPoint: (x,y) => ({x,y}), addLine: (p1,p2) => ({p1,p2}),
    annotationLeaderTargetFromItem: () => ({ anchor: {x:0,y:35}, geometryRef: { id: 'L3' } }),
    pushAnnotation: item => { state.scope.annotations.push(item); calls.push(['annotation',item.type]); },
    defaultStyle: Object.freeze({ fontSize: 10 }), resizeCanvas: options => calls.push(['resize',options.centerWorld.x,options.centerWorld.y]),
  };
  const support = sandbox.window.AnnotationTestDriver.createSupport(ports); assert.deepEqual(calls, []);
  return { support, state, calls, ports };
}

test('Annotation test groups preserve the legacy seven names, lazy reads and coordinate/drag queries', () => {
  const f = fixture();
  const api = { ...f.support.fixtures, ...f.support.observations, ...f.support.interaction };
  assert.deepEqual(Object.keys(api), ['resetForAnnotationDrag', 'annotationSnapshot', 'annotationDimensionStateForTest', 'annotationAppearanceStateForTest', 'annotationOwnershipStateForTest', 'annotationHitAt', 'annotationDragActive']);
  for (const value of Object.values(api)) assert.equal(typeof value, 'function');
  for (const group of Object.values(f.support)) assert.equal(Object.isFrozen(group), true);
  assert.equal(api.annotationDragActive(), f.state.drag); f.state.drag = { changed: true }; assert.equal(api.annotationDragActive(), f.state.drag);
  const hit = api.annotationHitAt({ x:30, y:60 }); assert.equal(hit.type, 'leader'); assert.equal(hit.part, 'body');
  assert.deepEqual(f.calls, [['hit',10,20]]); f.state.hit = null; assert.equal(api.annotationHitAt({x:10,y:20}), null);
  f.state.scope = { annotations: [{ type:'text', x:3, y:4 }] };
  const snapshot = api.annotationSnapshot(); assert.equal(snapshot.text.world.x, 3); assert.equal(snapshot.text.viewport.y, 28);
});

test('Annotation drag fixture uses the same shared live snapshot and leaves the style template unchanged', () => {
  const f = fixture(), snapshot = f.support.fixtures.resetForAnnotationDrag();
  assert.equal(snapshot.leader.viewport.x, 234); assert.equal(snapshot.text.viewport.x, -170);
  assert.equal(f.state.scope.annotations.length, 2);
  assert.equal(f.state.scope.annotations[0].style.fontSize, 10); assert.notEqual(f.state.scope.annotations[0].style, f.ports.defaultStyle);
  assert.deepEqual(f.calls.slice(0,4), ['reset', ['annotation','leader'], ['annotation','text'], ['resize',20,20]]);
  f.state.scope.annotations[0].end.x = 130;
  assert.equal(f.support.observations.annotationSnapshot().leader.world.x, 130);
});
