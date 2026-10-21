const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/pending_command_session.js', 'src/editing/constraint_target_session.js', 'src/editing/drawing_preview.js', 'src/commands/geometry_deletion_command.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function fixture(overrides = {}) {
 const events = [], interactionEvents = [], state = { ready: false, mode: "line", editable: true, symbols: true, dependent: false, stable: true, solved: true };
 const point = { id: 'p1', sketchId: 'S1' }, annotation = { anchorId: 'p1' }, constraint = {};
 const plan = { pointSet: new Set([point]), lineSet: new Set(), circleSet: new Set(), arcSet: new Set(), splineSet: new Set(), constraintSet: new Set([constraint]) };
 const model = { geometryInstances: [{}], annotations: [annotation] };
 const hints = [];
 const interaction = name => () => { assert.equal(state.ready, true); interactionEvents.push(name); };
 const command = sandbox.window.GeometryDeletionCommand.create({ currentScope: () => { events.push('scope'); return model; },
  geometryDeletion: { plan: (input, candidates) => { assert.equal(input, model); events.push('plan'); return plan; }, apply: (input, actual) => { assert.equal(actual, plan); events.push('apply'); } },
  canvasSelection: { discardDeletedGeometry: () => events.push('selectionGeometry'), discardDeletedConstraints: () => events.push('selectionConstraints') },
  splineEditing: { forgetDeleted: () => events.push('spline') }, canvasHover: { current: { dimension: constraint }, update: () => events.push('hover') },
  guardSketchEdit: () => { events.push('edit'); return state.editable; }, elementSketchId: item => item.sketchId,
  geometryElementKey: item => item.id, geometryInstanceUsesRemovedGeometry: () => state.dependent,
  rejectReferencedGeometryDeletion: instances => { events.push('dependents'); return instances.length > 0; },
  annotationReferencesRemovedGeometry: (item, ids) => ids.has(item.anchorId),
  guardDimensionSymbolDeletion: items => { assert.equal(items.includes(annotation), true); events.push('symbols'); return state.symbols; },
  applicationText: text => text,
  resetGeometryDrag: interaction('geometry'), resetDimensionDrag: interaction('dimension'), resetAnnotationDrag: interaction('annotation'),
  pendingCommandSession: { clear: interaction('pending') }, constraintTargetSession: { clearCommand: interaction('constraint') },
  lineCommand: { reset: interaction('line') }, circularCommands: { resetCircle: interaction('circle'), resetArcs: interaction('arcs') },
  drawingPreview: { setPointer: value => { assert.equal(value, null); interactionEvents.push('pointer'); } },
  selectMode: () => { interactionEvents.push('select'); state.mode = 'select'; events.push('end'); },
  solveSketchAndDependents: id => { events.push('solve:' + id); return { success: state.solved, result: { errorNorm: 2 } }; },
  normalizeArcSweeps: () => events.push('normalize'), refreshView: () => events.push('view'), analysisStable: () => state.stable,
  setHint: (...args) => { hints.push(args); events.push('hint'); }, log: () => events.push('log'), recordHistory: () => events.push('history'),
  ...overrides,
 });
 assert.deepEqual(interactionEvents, []); state.ready = true;
 return { command, events, interactionEvents, state, point, plan, hints };
}
test('permission denial stops before scope lookup or interaction reset', () => {
 const f = fixture(); f.state.editable = false; assert.equal(f.command.remove({ points: [f.point] }), false); assert.deepEqual(f.events, ['edit']);
});
test('derived and symbol guards stop before model mutation, interaction end or history', () => {
 const f = fixture(); f.state.dependent = true; assert.equal(f.command.remove({ points: [f.point] }), false);
 assert.deepEqual(f.events, ['edit', 'scope', 'plan', 'dependents']);
 f.events.length = 0; f.state.dependent = false; f.state.symbols = false;
 assert.equal(f.command.remove({ points: [f.point] }), false); assert.deepEqual(f.events, ['edit', 'scope', 'plan', 'dependents', 'symbols']);
});
test('empty plan returns without interaction reset or history after dependency guard', () => {
 const f = fixture(); for (const set of Object.values(f.plan)) set.clear();
 assert.equal(f.command.remove(), false); assert.deepEqual(f.events, ['scope', 'plan', 'dependents']);
});
test('delete preserves selection and Spline cleanup order and solves each input owner once', () => {
 const f = fixture(); assert.equal(f.command.remove({ points: [f.point, f.point] }), true);
 assert.deepEqual(f.events, ['edit', 'edit', 'scope', 'plan', 'dependents', 'symbols', 'end', 'apply', 'selectionGeometry', 'spline', 'selectionConstraints', 'hover', 'solve:S1', 'normalize', 'view', 'hint', 'log', 'history']);
 assert.equal(f.hints[0][1], 'normal');
});
test('unsuccessful solve still records deletion with error feedback as existing behavior requires', () => {
 const f = fixture(); f.state.solved = false; assert.equal(f.command.remove({ points: [f.point] }), true);
 assert.equal(f.hints[0][1], 'error'); assert.equal(f.events.at(-1), 'history');
});


function sessions() {
 const unexpected = () => { throw Error('cancel and reset must not replace clear operations'); };
 const pending = sandbox.window.PendingCommandSession.create({ clearPlacement: unexpected });
 const target = sandbox.window.ConstraintTargetSession.create({ acceptTarget: () => ({ ok: true }) });
 const preview = sandbox.window.DrawingPreview.create({ types: {}, hits: {} });
 const pendingValue = { type: 'annotation', annotationDraft: true }, operands = [{ id: 'operand' }], pointer = { x: 1, y: 2 }, trim = { id: 'trim' };
 pending.replace(pendingValue); target.begin('distance', operands); preview.setPointer(pointer); preview.setTrim(trim);
 return { pending, target, preview, pendingValue, operands, pointer, trim };
}

test('accepted deletion ends only its specified interaction subset and preserves operands and non-pointer preview state', () => {
 const session = sessions(), f = fixture({ pendingCommandSession: session.pending, constraintTargetSession: session.target, drawingPreview: session.preview });
 assert.equal(f.command.remove({ points: [f.point] }), true);
 assert.equal(session.pending.current, null); assert.equal(session.target.command, null); assert.equal(session.target.operands, session.operands);
 assert.equal(session.preview.pointer, null); assert.equal(session.preview.trim, session.trim); assert.equal(f.state.mode, 'select');
 assert.deepEqual(f.interactionEvents, ['geometry', 'dimension', 'annotation', 'line', 'circle', 'arcs', 'select']);
 const full = fixture(); full.command.remove({ points: [full.point] });
 assert.deepEqual(full.interactionEvents, ['geometry', 'dimension', 'annotation', 'pending', 'constraint', 'line', 'circle', 'arcs', 'pointer', 'select']);
 assert.ok(full.events.indexOf('symbols') < full.events.indexOf('end')); assert.ok(full.events.indexOf('end') < full.events.indexOf('apply'));
});

test('permission, dependency, empty-plan and symbol rejection leave real pending, operand, preview and mode state intact', () => {
 for (const reason of ['permission', 'dependency', 'empty', 'symbol']) {
  const session = sessions(), command = session.target.command;
  const f = fixture({ pendingCommandSession: session.pending, constraintTargetSession: session.target, drawingPreview: session.preview });
  if (reason === 'permission') f.state.editable = false;
  if (reason === 'dependency') f.state.dependent = true;
  if (reason === 'empty') for (const set of Object.values(f.plan)) set.clear();
  if (reason === 'symbol') f.state.symbols = false;
  assert.equal(f.command.remove({ points: [f.point] }), false);
  assert.equal(session.pending.current, session.pendingValue); assert.equal(session.target.command, command); assert.equal(session.target.operands, session.operands);
  assert.equal(session.preview.pointer, session.pointer); assert.equal(session.preview.trim, session.trim); assert.equal(f.state.mode, 'line');
  assert.deepEqual(f.interactionEvents, []); assert.equal(f.events.includes('apply'), false); assert.equal(f.events.includes('history'), false);
 }
});

test('an interaction reset error propagates before model mutation and leaves subsequent operations and feedback untouched', () => {
 for (const phase of ['dimension', 'arcs']) {
  let f; const marker = new Error(phase);
  const fail = () => { f.interactionEvents.push(phase); throw marker; };
  f = fixture(phase === 'dimension' ? { resetDimensionDrag: fail } : { circularCommands: { resetCircle: () => f.interactionEvents.push('circle'), resetArcs: fail } });
  assert.throws(() => f.command.remove({ points: [f.point] }), error => error === marker);
  assert.deepEqual(f.interactionEvents, phase === 'dimension' ? ['geometry', 'dimension'] : ['geometry', 'dimension', 'annotation', 'pending', 'constraint', 'line', 'circle', 'arcs']);
  assert.deepEqual(f.events, ['edit', 'scope', 'plan', 'dependents', 'symbols']); assert.equal(f.state.mode, 'line');
 }
});
