const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/geometry_drag_test_driver.js'), 'utf8'), sandbox);

function fixture(composed = false) {
  const calls = [], point = { id: 'P1', x: 10, y: 20 }, session = { sketchId: 'S2' };
  let scope = { points: [point] }, available = true, tick = 0, throws = false;
  const constraints = [{}], vector = [3, 4];
  const ports = {
    currentScope: () => scope,
    buildDragSession: (kind, item, start) => { calls.push(['build', kind, item, { ...start }]); return available ? session : null; },
    attachLocalSolveContext: value => { assert.equal(value, session); calls.push(['attach']); },
    dragResultForSession: (value, target) => {
      assert.equal(value, session); calls.push(['preview', { ...target }]);
      if (throws) throw Error('preview failed');
      point.x = target.x; point.y = target.y;
      return { success: false, blocked: true, errorNorm: 0.1, acceptError: 0.2, iterations: 2, targetConstraints: [{}, {}] };
    },
    solveFinalDragSession: value => { assert.equal(value, session); calls.push(['final']); point.x = 99; return { success: true, errorNorm: 0, iterations: 3 }; },
    normalizeArcSweeps: () => calls.push(['normalize']),
    sketchSolveConstraints: id => { calls.push(['constraints', id]); return constraints; },
    computeErrorVector: value => { assert.equal(value, constraints); calls.push(['errors']); return vector; },
    vectorNorm: value => { assert.equal(value, vector); calls.push(['norm']); return 5; },
    targetConstraintCount: value => { assert.equal(value, session); calls.push(['count']); return 2; },
    now: () => ++tick,
  };
  const solver = { computeErrorVectorForConstraints(value) { assert.equal(this, solver); return ports.computeErrorVector(value); } };
  const api = composed ? sandbox.window.GeometryDragTestDriver.createExecutionSupport({
    feature: { build: ports.buildDragSession, prepare: ports.attachLocalSolveContext, preview: ports.dragResultForSession,
      finish: ports.solveFinalDragSession, targetConstraintCount: ports.targetConstraintCount }, solver,
    currentScope: ports.currentScope, normalizeArcSweeps: ports.normalizeArcSweeps, vectorNorm: ports.vectorNorm,
    sketchSolveConstraints: ports.sketchSolveConstraints, now: ports.now, readConstraintStatuses: () => { calls.push(['status']); return { stable: true }; },
  }) : null;
  const driver = composed ? { drag: api.guidedPointDragForTest, path: api.guidedPointDragPathForTest }
    : sandbox.window.GeometryDragTestDriver.createPointDriver(ports);
  const geometry = composed ? api.geometryDragPathForTest : sandbox.window.GeometryDragTestDriver.createGeometryDriver({ ...ports,
    readConstraintStatuses: () => { calls.push(['status']); return { stable: true }; } }).path;
  return { driver, geometry, api, point, calls, setScope: value => { scope = value; }, unavailable: () => { available = false; }, fail: () => { throws = true; } };
}

test('execution assembly preserves all three public routes, live scope and failure short-circuiting without constructor work', () => {
  for (const run of [f => f.driver.drag('P1', 2, -1), f => f.driver.path('P1', [[2, -1], [-3, 4]]),
    f => f.geometry({ kind: 'point', id: 'P1', inspectConstraints: true }, [[2, -1], [-3, 4]])]) {
    const legacy = fixture(), composed = fixture(true);
    assert.deepEqual(composed.calls, []);
    assert.deepEqual(Object.keys(composed.api), ['guidedPointDragForTest', 'guidedPointDragPathForTest', 'geometryDragPathForTest']);
    assert.deepEqual(run(composed), run(legacy)); assert.deepEqual(composed.calls, legacy.calls);
    assert.equal(composed.calls[0][2], composed.point);
  }
  const f = fixture(true); f.setScope({ points: [] });
  assert.equal(f.driver.drag('P1', 1, 1), null); assert.equal(f.geometry({ kind: 'point', id: 'P1' }, []), null);
  assert.deepEqual(f.calls, []); f.setScope({ points: [f.point] }); f.unavailable();
  assert.equal(f.driver.path('P1', []), null);
  assert.equal(f.geometry({ kind: 'point', id: 'P1' }, []).sessionAvailable, false);
  const failed = fixture(true); failed.fail();
  assert.throws(() => failed.geometry({ kind: 'point', id: 'P1' }, [[1, 1]]), /preview failed/);
  assert.deepEqual(failed.calls.map(c => c[0]), ['build', 'attach', 'preview']);
});

test('single point drag delegates session identity and observes preview before final normalization', () => {
  const f = fixture(), result = f.driver.drag('P1', 2, -1);
  assert.deepEqual({ ...result.target }, { x: 12, y: 19 });
  assert.deepEqual({ ...result.preview.point }, { x: 12, y: 19 });
  assert.equal(result.final.point.x, 99); assert.equal(result.final.baseErrorNorm, 5);
  assert.equal(result.targetConstraintCount, 2);
  assert.deepEqual(f.calls.map(c => c[0]), ['build', 'attach', 'preview', 'final', 'normalize', 'constraints', 'errors', 'norm', 'count']);
  assert.equal(f.calls[0][2], f.point);
});

test('point path offsets remain relative to the original point and snapshots survive final solve', () => {
  const f = fixture(), result = f.driver.path('P1', [[2, -1], [-3, 4]]);
  assert.deepEqual(f.calls.filter(c => c[0] === 'preview'), [['preview', { x: 12, y: 19 }], ['preview', { x: 7, y: 24 }]]);
  assert.deepEqual({ ...result.startPoint }, { x: 10, y: 20 });
  assert.deepEqual({ ...result.previews[0].point }, { x: 12, y: 19 });
  assert.deepEqual({ ...result.previews[1].point }, { x: 7, y: 24 });
  assert.equal(result.previews[0].elapsedMs, 1); assert.equal(result.previews[1].targetConstraintCount, 2);
  assert.equal(result.previews[0].blocked, true); assert.equal(result.final.point.x, 99);
  assert.deepEqual(f.calls.slice(-5).map(c => c[0]), ['final', 'normalize', 'constraints', 'errors', 'norm']);
});

test('missing point and unavailable session retain null; preview errors stop without final solving', () => {
  const f = fixture(); f.setScope({ points: [] });
  assert.equal(f.driver.drag('P1', 1, 1), null); assert.equal(f.driver.path('P1', []), null);
  assert.deepEqual(f.calls, []);
  f.setScope({ points: [f.point] }); f.unavailable();
  assert.equal(f.driver.path('P1', []), null); assert.deepEqual(f.calls.map(c => c[0]), ['build']);
  const failed = fixture(); failed.fail();
  assert.throws(() => failed.driver.path('P1', [[1, 1]]), /preview failed/);
  assert.deepEqual(failed.calls.map(c => c[0]), ['build', 'attach', 'preview']);
});

test('geometry path preserves line reference, fraction clamping and initial-relative previews', () => {
  const line = { id: 'L1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, length: () => 10 };
  const session = { sketchId: 'S1', lineDragPoint: { point: { id: 'P2' } } }, calls = [];
  let tick = 0;
  const status = { stable: true };
  const driver = sandbox.window.GeometryDragTestDriver.createGeometryDriver({
    currentScope: () => ({ lines: [line] }),
    buildDragSession: (kind, item, start) => { assert.equal(item, line); calls.push(['build', kind, { ...start }]); return session; },
    attachLocalSolveContext: value => assert.equal(value, session),
    dragResultForSession: (value, target) => { assert.equal(value, session); calls.push(['preview', { ...target }]); line.p1.x = target.x; return { success: false, blocked: true, guidedSubstepCount: 0 }; },
    solveFinalDragSession: () => { calls.push(['final']); line.p1.x = 50; return { success: true }; },
    normalizeArcSweeps: () => calls.push(['normalize']),
    sketchSolveConstraints: id => { assert.equal(id, 'S1'); return []; }, computeErrorVector: () => [0], vectorNorm: () => 0,
    now: () => ++tick, readConstraintStatuses: () => { calls.push(['status', line.p1.x]); return status; },
  });
  const result = driver.path({ kind: 'line', id: 'L1', fraction: 3, inspectConstraints: true }, [[2, 0], [-1, 0]]);
  assert.deepEqual(calls.slice(0, 5), [['build', 'line', { x: 10, y: 0 }], ['preview', { x: 12, y: 0 }], ['status', 12], ['preview', { x: 9, y: 0 }], ['status', 9]]);
  assert.equal(result.startState.p1.x, 0); assert.equal(result.previews[0].state.p1.x, 12);
  assert.equal(result.previews[1].state.p1.x, 9); assert.equal(result.final.state.p1.x, 50);
  assert.equal(result.previews[0].constraintState, status); assert.equal(result.previews[0].elapsedMs, 1);
  assert.equal(result.previews[0].radialObjective, false); assert.equal(result.representativePointId, 'P2');
  assert.deepEqual(calls.slice(-2), [['final'], ['normalize']]);
});

test('arc endpoint unavailable session preserves endpoint wrapper and initial snapshot without solving', () => {
  const arc = { id: 'A1', center: { x: 1, y: 2 }, radius: () => 3 }, calls = [];
  const end = { x: 4, y: 5 }, start = { x: 6, y: 7 };
  const driver = sandbox.window.GeometryDragTestDriver.createGeometryDriver({
    currentScope: () => ({ arcs: [arc] }),
    arcEndpointPoint: (item, endpoint) => { assert.equal(item, arc); calls.push(['endpoint', endpoint]); return endpoint === 'end' ? end : start; },
    buildDragSession: (kind, item, pointer) => { assert.equal(kind, 'arc-endpoint'); assert.equal(item.arc, arc); assert.equal(item.endpoint, 'end'); assert.equal(pointer, end); calls.push(['build']); return null; },
    attachLocalSolveContext: () => { throw Error('unexpected solve context'); },
  });
  assert.equal(driver.path({ kind: 'arc-endpoint', id: 'missing' }, []), null);
  const result = driver.path({ kind: 'arc-endpoint', id: 'A1', endpoint: 'end' }, []);
  assert.equal(result.sessionAvailable, false); assert.equal(result.startPointer, end);
  assert.equal(result.startState.draggedEndpoint, result.startState.end); assert.equal(result.final, null);
  assert.deepEqual(calls, [['endpoint', 'end'], ['build'], ['endpoint', 'start'], ['endpoint', 'end']]);
});


function responsiveFixture(configureTypes = types => types) {
 const events=[],state={scope:null,fail:false,result:{points:'serialized'}};
 class DistanceConstraint {constructor(a,b,value){Object.assign(this,{type:'distance',a,b,value});}}
 class ParallelConstraint {constructor(a,b){Object.assign(this,{type:'parallel',a,b});}}
 class PerpendicularConstraint {constructor(a,b){Object.assign(this,{type:'perpendicular',a,b});}}
 const driver=sandbox.window.GeometryDragTestDriver.createResponsiveFixture({
  resetModelState:()=>{events.push('reset');state.scope={points:[],lines:[],constraints:[]};},
  addPoint:(x,y,fixed,role)=>{const point={id:'P'+(state.scope.points.length+1),x,y,fixed,role};state.scope.points.push(point);return point;},
  addLine:(p1,p2)=>{const line={id:'L'+(state.scope.lines.length+1),p1,p2};state.scope.lines.push(line);return line;},
  pushModelConstraint:constraint=>state.scope.constraints.push(constraint),...configureTypes({DistanceConstraint,ParallelConstraint,PerpendicularConstraint}),
  ensureDimensionDefaults:()=>events.push('defaults'),solveAndRefresh:label=>{events.push(['solve',label]);if(state.fail)throw state.fail;},
  log:message=>events.push(['log',message]),fitAllGeometryToViewport:padding=>events.push(['fit',padding]),draw:()=>events.push('draw'),
  resetHistory:label=>events.push(['history',label]),serializeModel:()=>{events.push('serialize');return state.result;},
 });return {driver,state,events};
}

test('responsive drag fixture owns its sample and preserves shared point/line references and solve-to-history order',()=>{
 const f=responsiveFixture();assert.deepEqual(f.events,[]);assert.equal(f.driver.reset(),f.state.result);
 const {points,lines,constraints}=f.state.scope;assert.equal(points.length,4);assert.equal(lines.length,4);assert.equal(constraints.length,5);
 assert.deepEqual(points.map(p=>[p.x,p.y,p.fixed,p.role]),[[160,160,true,'endpoint'],[300,180,false,'endpoint'],[280,290,false,'endpoint'],[140,270,false,'endpoint']]);
 assert.equal(lines[0].p1,points[0]);assert.equal(lines[0].p2,points[1]);assert.equal(lines[3].p2,points[0]);
 assert.equal(constraints[0].a,points[0]);assert.equal(constraints[0].b,points[1]);assert.equal(constraints[0].value,140);assert.equal(constraints[1].value,100);
 assert.equal(constraints[2].a,lines[0]);assert.equal(constraints[2].b,lines[2]);assert.equal(constraints[3].a,lines[1]);assert.equal(constraints[3].b,lines[3]);
 assert.equal(constraints[4].type,'perpendicular');assert.equal(constraints[4].a,lines[0]);assert.equal(constraints[4].b,lines[1]);
 assert.deepEqual(f.events,['reset','defaults',['solve','サンプル復元'],['log','サンプルを復元しました'],['fit',160],'draw',['history','responsive line drag test'],'serialize']);
 const prior=f.state.scope;f.events.length=0;f.driver.reset();assert.notEqual(f.state.scope,prior);assert.equal(f.state.scope.points[0].id,'P1');assert.notEqual(f.state.scope.points[0],points[0]);
});

test('responsive sample solve errors propagate without fitting, resetting history or serializing a partial fixture',()=>{
 const f=responsiveFixture(),error=new Error('solve failed');f.state.fail=error;
 assert.throws(()=>f.driver.reset(),value=>value===error);assert.deepEqual(f.events,['reset','defaults',['solve','サンプル復元']]);
 assert.equal(f.state.scope.constraints.length,5);
});

test("responsive fixture captures explicit model types once and retains individual constructor overrides", () => {
  for (const override of [false, true]) {
    const reads = []; let captured, provider;
    const f = responsiveFixture(types => {
      captured = { ...types }; provider = { ...types };
      const modelTypes = new Proxy(provider, { get(target, name) {
        assert.equal(override, false, "individual constructors must take precedence"); reads.push(name); return target[name];
      } });
      return { modelTypes, ...(override ? types : {}) };
    });
    assert.deepEqual(f.events, []);
    assert.deepEqual(reads, override ? [] : ["DistanceConstraint", "ParallelConstraint", "PerpendicularConstraint"]);
    provider.DistanceConstraint = class Unexpected { constructor() { throw Error("types must be captured"); } };
    f.driver.reset();
    const constraints = f.state.scope.constraints;
    assert.equal(constraints[0] instanceof captured.DistanceConstraint, true);
    assert.equal(constraints[1].a, f.state.scope.points[1]);
    assert.equal(constraints[2] instanceof captured.ParallelConstraint, true);
    assert.equal(constraints[4] instanceof captured.PerpendicularConstraint, true);
    f.driver.reset();
    assert.deepEqual(reads, override ? [] : ["DistanceConstraint", "ParallelConstraint", "PerpendicularConstraint"]);
  }
});
