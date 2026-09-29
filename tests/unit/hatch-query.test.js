const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
function fixture() {
  const sandbox = { window: {} }; vm.createContext(sandbox);
  for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
  const engine = sandbox.window.HatchRegionEngine;
  const calls = { index: 0, resolve: 0 };
  sandbox.window.HatchRegionEngine = { ...engine,
    createRegionIndex: (...args) => { calls.index++; return engine.createRegionIndex(...args); },
    resolveBoundary: (...args) => { calls.resolve++; return engine.resolveBoundary(...args); },
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'src/geometry/hatch_query.js'), 'utf8'), sandbox);
  const { Point, Circle } = sandbox.window.GeometrySolver;
  const circle = Object.assign(new Circle('C1', new Point('P1', 0, 0), 10), { sketchId: 'S1' });
  let scope = { circles: [circle], lines: [], arcs: [], splines: [] }, projected = [], active = 'S1';
  const query = sandbox.window.HatchGeometryQuery.create({ currentScope: () => scope,
    boundaryGeometry: () => [...scope.lines, ...scope.circles, ...scope.arcs, ...scope.splines, ...projected],
    activeSketchId: () => active, effectiveAppearanceForElement: item => item.appearance || {}, applicationText: (_ja, en) => en,
  });
  return { query, calls, circle, get scope() { return scope; }, project: items => { projected = items; },
    activate: id => { active = id; }, setScope: next => { scope = next; },
    hatch() { return { sketchId: 'S1', boundaryLoops: query.hatchFaceAt({ x: 0, y: 0 }).boundaryLoops }; },
  };
}

test('face index reuse follows geometry, visibility and active sketch changes', () => {
  const f = fixture();
  assert.equal(f.query.hatchFaceAt({ x: 0, y: 0 }).ok, true);
  f.query.hatchFaceAt({ x: 1, y: 1 }); assert.equal(f.calls.index, 1);
  f.circle.radiusValue = 12;
  f.query.hatchFaceAt({ x: 1, y: 1 }); assert.equal(f.calls.index, 2);
  f.circle.appearance = { visible: false };
  assert.equal(f.query.hatchFaceAt({ x: 0, y: 0 }).ok, false); assert.equal(f.calls.index, 3);
  f.activate('S2'); f.query.hatchFaceAt({ x: 0, y: 0 }); assert.equal(f.calls.index, 4);
});

test('boundary results reuse unchanged references and refresh on mutation or individual invalidation', () => {
  const f = fixture(), hatch = f.hatch();
  const first = f.query.resolvedHatchBoundary(hatch);
  assert.equal(first.ok, true);
  assert.equal(f.query.resolvedHatchBoundary(hatch), first); assert.equal(f.calls.resolve, 1);
  f.circle.radiusValue = 20;
  const changed = f.query.resolvedHatchBoundary(hatch);
  assert.notEqual(changed, first); assert.equal(f.calls.resolve, 2);
  f.query.forget(hatch);
  assert.notEqual(f.query.resolvedHatchBoundary(hatch), changed); assert.equal(f.calls.resolve, 3);
  f.scope.circles = [];
  assert.equal(f.query.resolvedHatchBoundary(hatch).ok, false);
});

test('clear discards both caches and projected boundaries bypass local resolution', () => {
  const f = fixture(), hatch = f.hatch();
  f.query.resolvedHatchBoundary(hatch);
  f.query.clear();
  f.query.hatchFaceAt({ x: 0, y: 0 }); f.query.resolvedHatchBoundary(hatch);
  assert.equal(f.calls.index, 2); assert.equal(f.calls.resolve, 2);
  const resolved = { ok: true, loops: [] };
  assert.equal(f.query.resolvedHatchBoundary({ blockProjection: true, resolvedBoundary: resolved }), resolved);
  assert.equal(f.query.resolvedHatchBoundary({ blockProjection: true }).code, 'invalid-boundary');
  assert.equal(f.query.resolvedHatchBoundary(null).code, 'missing-hatch');
  assert.equal(f.calls.resolve, 2);
});

test('current scope includes projected elements while other scopes use their own arrays', () => {
  const f = fixture();
  const projected = Object.assign(Object.create(Object.getPrototypeOf(f.circle)), f.circle, { id: 'projected' });
  f.project([projected]);
  assert.equal(f.query.hatchPrimitivesForScope(f.scope, 'S1').length, 2);
  const other = { circles: [f.circle] };
  assert.equal(f.query.hatchPrimitivesForScope(other, 'S1').length, 1);
  f.circle.construction = true;
  assert.equal(f.query.hatchPrimitivesForScope(other, 'S1').length, 0);
  f.setScope({ lines: [], circles: [], arcs: [], splines: [] });
  assert.equal(f.query.hatchPrimitivesForScope(f.scope, 'S1')[0].id, 'projected');
});
