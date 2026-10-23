const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} };
vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture() {
  const calls = [], state = { sketches: new Map(), snapFailure: null };
  let presentation;
  const feature = w.CanvasSelectionFeature.create({
    sketches: { sketchById: id => { calls.push('lookup:' + id); return state.sketches.get(id); } },
    guardSketchEdit: id => { calls.push('guard:' + id); return false; },
    clearSelection: () => { calls.push('clear'); return presentation.clearing.clear(); },
    updateGeometrySelectionUI: () => calls.push('ui'), draw: () => calls.push('draw'),
  });
  const hover = w.CanvasHover.create({ isEndpointPoint: () => false });
  const targets = w.ConstraintTargetSession.create({ acceptTarget: () => { throw new Error('unexpected target edit'); } });
  const pointer = w.PointerInteractionController.createSession();
  presentation = feature.createPresentation({ hover, constraintTargets: targets, pointer,
    projections: { blockProjectionBundle: () => { throw new Error('unexpected projection read'); } },
    constraintReferences: w.ConstraintReferences.create({ resolveGeometryRef: () => null }),
    clearSnap: () => { calls.push('snap'); if (state.snapFailure) throw state.snapFailure; },
  });
  return { feature, presentation, hover, targets, pointer, state, calls };
}
const point = (id, sketchId = 'S1') => Object.assign(new w.GeometrySolver.Point(id, 0, 0), { sketchId });

test('both construction phases defer work and share current selection, scope and dimension hover', () => {
  const f = fixture(), first = point('P1'), second = point('P2', 'S2'); assert.deepEqual(f.calls, []);
  f.feature.selection.set('points', [first]); assert.equal(f.feature.scope.selectionSketchId(), 'S1');
  f.feature.selection.set('points', [second]); assert.equal(f.feature.scope.selectionSketchId(), 'S2');
  const dimension = new w.GeometrySolver.DistanceConstraint(first, second, 10);
  f.feature.selection.clear(); f.feature.selection.set('constraint', dimension);
  assert.equal(f.presentation.highlight.isSelectedConstraintRelatedElement(first), true);
  f.presentation.highlight.setSidebarHover('constraint', dimension, new Set(), { redraw: false });
  assert.equal(f.hover.current.dimension, dimension); assert.equal(f.presentation.highlight.current.item, dimension);
  assert.equal(f.presentation.highlight.clearSidebarHover('constraint', dimension, { redraw: false }), true);
  assert.equal(f.hover.current.dimension, null); assert.deepEqual(f.calls, []);
});

test('identity selection uses the same clearing and keeps a locked identity selected before the guard', () => {
  const f = fixture(), first = point('P1'), second = point('P2', 'S2');
  f.state.sketches.set('S2', { locked: true }); f.feature.selection.set('points', [first]);
  f.targets.begin('distance', [{ kind: 'point', point: first }]); const command = f.targets.command;
  f.pointer.setLastPointer(first); f.hover.update({ point: first, annotation: first });
  f.presentation.highlight.setSidebarHover('geometry', first, new Set([first]), { redraw: false });
  assert.equal(f.feature.identity.selectInactive({}, { kind: 'point', item: second, sketchId: 'S2' }), undefined);
  assert.equal(f.feature.selection.points[0], second); assert.equal(f.feature.scope.selectionSketchId(), 'S2');
  assert.equal(f.targets.operands.length, 0); assert.equal(f.targets.command, command);
  assert.equal(f.pointer.readLastPointer(), first); assert.equal(f.hover.current.point, first);
  assert.equal(f.hover.current.annotation, null); assert.equal(f.presentation.highlight.current, null);
  assert.deepEqual(f.calls, ['clear', 'ui', 'draw', 'lookup:S2', 'guard:S2']);
});

test('document reset retains its distinct selection, target-command and annotation-hover boundaries', () => {
  const f = fixture(), item = point('P1'), operands = [{ item }];
  f.feature.selection.set('points', [item]); f.feature.selection.set('annotations', [item]);
  f.targets.begin('tangent', operands); const command = f.targets.command;
  f.pointer.setLastPointer(item); f.hover.update({ point: item, annotation: item, hatch: item, dimension: item });
  f.presentation.highlight.setSidebarHover('geometry', item, new Set([item]), { redraw: false });
  f.presentation.documentReset.reset();
  assert.equal(f.pointer.readLastPointer(), null); assert.equal(f.presentation.highlight.current, null);
  assert.equal(f.hover.current.point, null); assert.equal(f.hover.current.hatch, null); assert.equal(f.hover.current.dimension, null);
  assert.equal(f.hover.current.annotation, item); assert.equal(f.feature.selection.points[0], item);
  assert.equal(f.feature.selection.annotations.length, 0); assert.equal(f.targets.command, command); assert.equal(f.targets.operands, operands);
  assert.deepEqual(f.calls, ['snap']);
});

test('reset propagates a snap failure after pointer cleanup and before clearing later selection fields', () => {
  const f = fixture(), item = point('P1'), failure = new Error('snap failed');
  f.feature.selection.set('annotations', [item]); f.pointer.setLastPointer(item); f.hover.update({ point: item });
  f.state.snapFailure = failure;
  assert.throws(() => f.presentation.documentReset.reset(), error => error === failure);
  assert.equal(f.pointer.readLastPointer(), null); assert.equal(f.hover.current.point, null);
  assert.equal(f.feature.selection.annotations[0], item); assert.deepEqual(f.calls, ['snap']);
});
