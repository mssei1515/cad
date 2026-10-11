const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/constraint_target_session.js', 'src/commands/constraint_target_command.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function fixture() {
 const events = [], state = { annotation: false, editable: true, operands: [], resolution: null, ready: false, target: null };
 const session = sandbox.window.ConstraintTargetSession.create({});
 const command = sandbox.window.ConstraintTargetCommand.create({ session,
  startAnnotationAnchorConstraint: () => { events.push('annotation'); return state.annotation; }, canStart: () => { events.push('guard'); return state.editable; },
  prepareStart: () => events.push('prepare'), prepareCancel: () => events.push('cancelPrepare'), constraintLabel: type => type,
  clearSelection: () => { events.push('clear'); session.clearOperands(); }, constraintOperandsFromSelection: () => state.operands,
  trimConstraintSelection: () => events.push('trim'), resolveConstraintIntent: () => state.resolution,
  startDistanceResolution: () => events.push('distance'), commitConstraintResolution: () => events.push('commit'),
  syncSelectionFromConstraintOperands: () => events.push('sync'), updateToolbar: () => events.push('toolbar'), updateConstraintButtons: () => events.push('buttons'),
  setHint: (text, kind) => events.push('hint:' + (kind || 'normal')), constraintTargetHint: () => 'targets', draw: () => events.push('draw'),
  blurConstraintControl: () => events.push('blur'), canCompleteConstraintCommand: () => state.ready,
  distanceTargetFromSelection: () => state.target, startDistanceCommand: () => events.push('lineLength'), addConstraint: () => events.push('add'),
 });
 return { command, session, events, state };
}
test('annotation delegation and permission denial do not prepare or change target session', () => {
 const f = fixture(); f.state.annotation = true; f.command.start('horizontal'); assert.deepEqual(f.events, ['annotation']); assert.equal(f.session.command, null);
 f.events.length = 0; f.state.annotation = false; f.state.editable = false; f.command.start('parallel'); assert.deepEqual(f.events, ['annotation', 'guard']);
});
test('symmetry start clears prior targets and starts a fresh session before feedback', () => {
 const f = fixture(); f.session.begin('parallel', [{}]); f.command.start('symmetry');
 assert.equal(f.session.command.type, 'symmetry'); assert.equal(f.session.operands.length, 0);
 assert.deepEqual(f.events, ['annotation', 'guard', 'prepare', 'toolbar', 'clear', 'trim', 'toolbar', 'buttons', 'hint:normal', 'draw']);
});
test('same target command toggles off after authoring preparation and preserves cancellation feedback order', () => {
 const f = fixture(); f.session.begin('parallel', [{}]); f.command.start('parallel');
 assert.equal(f.session.command, null); assert.equal(f.session.operands.length, 0);
 assert.deepEqual(f.events, ['annotation', 'guard', 'prepare', 'toolbar', 'cancelPrepare', 'hint:normal', 'buttons', 'toolbar', 'blur', 'draw']);
});
test('cancellation prepares even without pending command but emits no view effects in that case', () => {
 const f = fixture(); f.command.cancel(); assert.deepEqual(f.events, ['cancelPrepare']);
 f.events.length = 0; f.session.begin('distance', [{}]); f.command.cancel('');
 assert.deepEqual(f.events, ['cancelPrepare', 'buttons', 'toolbar', 'blur', 'draw']); assert.equal(f.session.command, null);
});
test('preselected start routes dimension placement or constraint commit without duplicate final feedback', () => {
 for (const [resolution, event] of [[{ action: 'place-dimension' }, 'distance'], [{ action: 'commit', constraint: {} }, 'commit']]) {
  const f = fixture(); f.state.operands = [{}]; f.state.resolution = resolution; f.command.start('distance');
  assert.equal(f.events.at(-1), event); assert.equal(f.events.includes('draw'), false); assert.equal(f.session.operands, f.state.operands);
 }
});
test('completion rejects resolution errors and routes valid resolution actions', () => {
 const f = fixture(); assert.equal(f.command.complete(), false); assert.equal(f.events.length, 0);
 f.session.begin('distance', [{}]); f.state.resolution = { error: 'invalid' }; assert.equal(f.command.complete(), false); assert.deepEqual(f.events, ['hint:error']);
 f.events.length = 0; f.state.resolution = { action: 'place-dimension' }; assert.equal(f.command.complete(), true); assert.deepEqual(f.events, ['distance']);
 f.events.length = 0; f.state.resolution = { action: 'commit', constraint: {} }; assert.equal(f.command.complete(), true); assert.deepEqual(f.events, ['commit']);
});
test('empty operand completion preserves invalid target and line-length fallback and ordinary constraint path', () => {
 const f = fixture(); f.session.begin('distance', []); f.state.target = { kind: 'invalid', reason: 'invalid' };
 assert.equal(f.command.complete(), false); assert.deepEqual(f.events, ['hint:error']);
 f.events.length = 0; f.state.target = { kind: 'line-length' }; assert.equal(f.command.complete(), true); assert.deepEqual(f.events, ['buttons', 'lineLength']);
 f.events.length = 0; assert.equal(f.command.completeLineLength(), true); assert.deepEqual(f.events, ['buttons', 'lineLength']);
 f.events.length = 0; f.state.ready = true; f.session.begin('parallel', []); assert.equal(f.command.complete(), true); assert.deepEqual(f.events, ['buttons', 'add']); assert.equal(f.command.completeLineLength(), false);
});
