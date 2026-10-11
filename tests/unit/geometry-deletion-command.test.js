const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/commands/geometry_deletion_command.js', 'utf8'), sandbox);
function fixture() {
 const events = [], state = { editable: true, symbols: true, dependent: false, stable: true, solved: true };
 const point = { id: 'p1', sketchId: 'S1' }, annotation = { anchorId: 'p1' }, constraint = {};
 const plan = { pointSet: new Set([point]), lineSet: new Set(), circleSet: new Set(), arcSet: new Set(), splineSet: new Set(), constraintSet: new Set([constraint]) };
 const model = { geometryInstances: [{}], annotations: [annotation] };
 const hints = [];
 const command = sandbox.window.GeometryDeletionCommand.create({ currentScope: () => { events.push('scope'); return model; },
  geometryDeletion: { plan: (input, candidates) => { assert.equal(input, model); events.push('plan'); return plan; }, apply: (input, actual) => { assert.equal(actual, plan); events.push('apply'); } },
  canvasSelection: { discardDeletedGeometry: () => events.push('selectionGeometry'), discardDeletedConstraints: () => events.push('selectionConstraints') },
  splineEditing: { forgetDeleted: () => events.push('spline') }, canvasHover: { current: { dimension: constraint }, update: () => events.push('hover') },
  guardSketchEdit: () => { events.push('edit'); return state.editable; }, elementSketchId: item => item.sketchId,
  geometryElementKey: item => item.id, geometryInstanceUsesRemovedGeometry: () => state.dependent,
  rejectReferencedGeometryDeletion: instances => { events.push('dependents'); return instances.length > 0; },
  annotationReferencesRemovedGeometry: (item, ids) => ids.has(item.anchorId),
  guardDimensionSymbolDeletion: items => { assert.equal(items.includes(annotation), true); events.push('symbols'); return state.symbols; },
  applicationText: text => text, endInteraction: () => events.push('end'),
  solveSketchAndDependents: id => { events.push('solve:' + id); return { success: state.solved, result: { errorNorm: 2 } }; },
  normalizeArcSweeps: () => events.push('normalize'), refreshView: () => events.push('view'), analysisStable: () => state.stable,
  setHint: (...args) => { hints.push(args); events.push('hint'); }, log: () => events.push('log'), recordHistory: () => events.push('history'),
 });
 return { command, events, state, point, plan, hints };
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
