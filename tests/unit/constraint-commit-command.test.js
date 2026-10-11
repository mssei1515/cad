const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/commands/constraint_commit_command.js', 'utf8'), sandbox);
function fixture() {
 const events = [], hints = [], model = { constraints: [] }, state = { editable: true, active: true, source: true, cycle: false, dimension: false, collapse: null, duplicate: null, trace: null };
 const result = { success: true, result: { errorNorm: 0, variableCount: 2, constraintCount: 1, iterations: 3, reason: 'ok' } };
 const constraint = { name: 'test', sketchId: 'S1' }; let time = 0;
 const command = sandbox.window.ConstraintCommitCommand.create({ guardSketchEdit: () => state.editable, activeSketchId: () => 'S1', constraintTargetsAreActive: () => state.active,
  snapshotModelState: () => { events.push('capture'); return { constraints: [...model.constraints] }; }, restoreModelState: saved => { events.push('restore'); model.constraints = saved.constraints; },
  solveStepNormForConstraint: () => 1, pushModelConstraint: c => { model.constraints.push(c); events.push('push'); }, preconditionNewConstraint: () => events.push('precondition'),
  withTemporarySolveStepNorm: (step, work) => work(), solveConstraintComponentAndDependents: () => { events.push('solve'); return result; },
  isDimensionConstraint: () => state.dimension, isReadOnlyDimension: () => false, stabilizeActiveParameterNamespace: () => { events.push('stabilize'); return result; },
  constraintSketchId: c => c.sketchId, lineCollapseQuery: { find: () => state.collapse }, redundantConstraintInfo: () => state.duplicate, acceptError: 0.001,
  addReadOnlyDimensionConstraint: c => { assert.equal(model.constraints.length, 0); events.push('readOnly'); return true; },
  clearSelection: () => events.push('clear'), refreshConstraintAnalysis: () => events.push('analysis'), updateUI: () => events.push('ui'), draw: () => events.push('draw'),
  setHint: (text, kind) => { hints.push([text, kind]); events.push('hint'); }, log: () => events.push('log'), recordHistory: () => events.push('history'),
  applicationText: text => text, isReferenceSourceSketchId: () => state.source, descendantSketchIds: () => [], wouldCreateReferenceCycle: () => state.cycle,
  sketchName: id => id, now: () => ++time, recordPerformance: trace => { state.trace = trace; events.push('performance'); },
 });
 return { command, model, state, events, hints, result, constraint };
}
test('ordinary authority and cross-Sketch guards reject before capture or mutation', () => {
 const f = fixture(); f.state.editable = false; assert.equal(f.command.ordinary('parallel', f.constraint), false); assert.equal(f.events.length, 0);
 f.state.editable = true; f.state.active = false; assert.equal(f.command.ordinary('parallel', f.constraint), false); assert.deepEqual(f.events, ['hint', 'log']);
});
test('successful ordinary commit preserves constraint identity, solve ordering and performance publication after history', () => {
 const f = fixture(); assert.equal(f.command.ordinary('parallel', f.constraint), true); assert.equal(f.model.constraints[0], f.constraint);
 assert.deepEqual(f.events, ['capture', 'push', 'precondition', 'solve', 'clear', 'analysis', 'ui', 'draw', 'hint', 'log', 'history', 'performance']);
 assert.equal(f.state.trace.type, 'parallel'); assert.equal(f.state.trace.solveVariableCount, 2); assert.equal(f.state.trace.solveIterations, 3);
});
test('ordinary solve rejection restores and reports without history, retaining the existing undefined return', () => {
 const f = fixture(); f.result.success = false; assert.equal(f.command.ordinary('parallel', f.constraint), undefined);
 assert.equal(f.model.constraints.length, 0); assert.deepEqual(f.events.slice(-5), ['restore', 'hint', 'ui', 'draw', 'log']); assert.equal(f.state.trace, null);
});
test('redundant dimension restores before read-only conversion and emits no ordinary history', () => {
 const f = fixture(); f.state.dimension = true; f.state.duplicate = { redundant: true };
 assert.equal(f.command.ordinary('distance', f.constraint), true); assert.deepEqual(f.events, ['capture', 'push', 'precondition', 'solve', 'stabilize', 'restore', 'readOnly']);
});
test('reference scope and cycle guards reject before marking or capture', () => {
 const f = fixture(); f.state.source = false; assert.equal(f.command.reference('parallel', f.constraint, 'S0'), false); assert.equal(f.constraint.reference, undefined);
 f.events.length = 0; f.state.source = true; f.state.cycle = true; assert.equal(f.command.reference('parallel', f.constraint, 'S0'), false); assert.deepEqual(f.events, ['hint', 'log']);
});
test('reference commit marks the same object and rejection restores model without ordinary performance', () => {
 const f = fixture(); assert.equal(f.command.reference('parallel', f.constraint, 'S0'), true);
 assert.equal(f.constraint.reference, true); assert.equal(f.constraint.referenceSketchId, 'S0'); assert.equal(f.constraint.name, '参照 test'); assert.equal(f.model.constraints[0], f.constraint); assert.equal(f.state.trace, null);
 const rejected = fixture(); rejected.result.result.errorNorm = 1;
 assert.equal(rejected.command.reference('parallel', rejected.constraint, 'S0'), false); assert.equal(rejected.model.constraints.length, 0);
 assert.equal(rejected.events.includes('history'), false);
});
