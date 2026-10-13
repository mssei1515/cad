const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/selection.js', 'src/editing/canvas_context_target.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
const { CanvasSelection, CanvasContextTarget } = sandbox.window;
function fixture() {
  const selection = CanvasSelection.create();
  const calls = [];
  const adapter = CanvasContextTarget.createSelection({
    canvasSelection: selection,
    sameArcEndpoint: (a, b) => a?.arc === b?.arc && a?.endpoint === b?.endpoint,
    clearSelection: () => { calls.push('clear'); selection.clear(); },
    arcEndpointPoint: (arc, endpoint) => { calls.push({ arc, endpoint }); return arc[endpoint]; },
  });
  return { selection, adapter, calls };
}

test('context selection preserves mixed sets by identity and supports explicit replacement', () => {
  const { selection, adapter, calls } = fixture();
  const line = { id: 'L1' }, point = { id: 'P1' };
  selection.set('lines', [line]); selection.set('points', [point]);
  const originalLines = selection.lines;
  adapter.select({ kind: 'line', item: line });
  assert.equal(selection.lines, originalLines);
  assert.equal(selection.points[0], point);
  assert.equal(calls.length, 0);
  assert.equal(adapter.isSelected({ kind: 'line', item: { id: 'L1' } }), false);
  adapter.select({ kind: 'blank', item: line }); adapter.select(null);
  assert.equal(calls.length, 0);
  adapter.select({ kind: 'line', item: line }, { preserveSelectedSet: false });
  assert.deepEqual(calls, ['clear']);
  assert.equal(selection.lines[0], line);
  assert.equal(selection.points.length, 0);
});

test('context endpoint and dimension selections retain original objects and hit provenance', () => {
  const { selection, adapter, calls } = fixture();
  const arc = { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } };
  adapter.select({ kind: 'arc-endpoint', item: arc, endpoint: 'end' });
  assert.equal(selection.arcs[0], arc);
  assert.equal(selection.arcEndpoint.arc, arc);
  assert.equal(adapter.isSelected({ kind: 'arc-endpoint', item: arc, endpoint: 'end' }), true);
  assert.equal(adapter.isSelected({ kind: 'arc-endpoint', item: arc, endpoint: 'start' }), false);
  const hit = { arc, endpoint: 'end', point: arc.end };
  const before = calls.length;
  assert.equal(adapter.constraintHits({ kind: 'arc-endpoint', item: arc, endpoint: 'end', hit }).hitArcEnd, hit);
  assert.equal(calls.length, before);
  const fallback = adapter.constraintHits({ kind: 'arc-endpoint', item: arc, endpoint: 'start' });
  assert.equal(fallback.hitArcEnd.point, arc.start);
  assert.equal(fallback.hitA, null);
  const first = {}, second = {};
  selection.set('dimensionConstraints', [first, second]);
  adapter.select({ kind: 'dimension', item: first });
  assert.equal(selection.dimensionConstraints.length, 2);
  adapter.select({ kind: 'dimension', item: first }, { preserveSelectedSet: false });
  assert.equal(selection.dimensionConstraint, first);
  assert.equal(selection.arcs.length, 0);
  assert.equal(selection.arcEndpoint, null);
  assert.equal(adapter.constraintHits(null).hitArcEnd, null);
});

test('Fix observation reads live batch and constraint owners without mutating selection', () => {
  const selection = CanvasSelection.create();
  const point = { fixed: true }, line = {}, block = { fixed: true };
  let batch = { points: [point], lines: [line] }, batchFixed = false, lineFixed = null, endpointFixed = null, geometry = [];
  const calls = [];
  const observation = CanvasContextTarget.createFixObservation({
    canvasSelection: selection,
    selectedFixedBatchTargets: () => batch,
    fixedBatchIsFullyFixed: value => { assert.equal(value, batch); calls.push('batch'); return batchFixed; },
    findLineFixedConstraint: value => { assert.equal(value, line); calls.push('line'); return lineFixed; },
    findArcEndpointFixedConstraint: (value, endpoint) => { assert.equal(value, line); assert.equal(endpoint, 'end'); return endpointFixed; },
    selectedGeometryItems: () => geometry,
  });
  selection.set('points', [point]); selection.set('lines', [line]);
  assert.equal(observation.state({ kind: 'line', item: line }).fixed, false);
  batchFixed = true;
  assert.equal(observation.state({ kind: 'line', item: line }).fixed, true);
  assert.deepEqual(calls, ['batch', 'batch']);
  batch = null;
  assert.equal(observation.state({ kind: 'point', item: point }).enabled, false);
  selection.set('lines', []);
  assert.equal(observation.state({ kind: 'point', item: point }).fixed, true);
  selection.set('points', []); selection.set('lines', [line]); lineFixed = {};
  assert.equal(observation.state({ kind: 'line', item: line }).fixed, true);
  endpointFixed = {};
  assert.equal(observation.state({ kind: 'arc-endpoint', item: line, endpoint: 'end' }).fixed, true);
  selection.set('lines', []); selection.set('blockInstances', [block]);
  assert.equal(observation.state({ kind: 'block', item: block }).enabled, true);
  geometry = [point];
  assert.equal(observation.state({ kind: 'block', item: block }).enabled, false);
  assert.equal(selection.blockInstances[0], block);
  assert.equal(observation.state({ kind: 'circle', item: {} }), null);
});
