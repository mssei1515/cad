const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/constraint_target_session.js', 'src/commands/constraint_target_command.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function fixture() {
 const events = [], state = { annotation: false, editable: true, operands: [], resolution: null, ready: false, target: null, operand: null, accepted: true, toggled: true };
 const session = sandbox.window.ConstraintTargetSession.create({ acceptTarget: (type, operands, operand) => state.accepted ? { ok: true, operands: [...operands, operand] } : { ok: false, error: "invalid" } });
 const anchor = { active: false, click: operand => { events.push("anchor"); return "anchorResult"; } };
 const command = sandbox.window.ConstraintTargetCommand.create({ session,
  annotationAnchorConstraints: anchor, hitConstraintOperand: () => { events.push("hit"); return state.operand; },
  invalidConstraintTargetHint: () => "invalid", toggleGeometryFixedOperand: () => { events.push("fixGeometry"); return state.toggled; },
  toggleSelectedFixed: () => { events.push("fixSelected"); return state.toggled; },
  updateGeometrySelectionUI: () => events.push("selectionUI"), startDistanceValueInput: () => events.push("value"),
  types: { Circle: class Circle {}, Arc: class Arc {} },
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
 return { command, session, events, state, anchor };
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


test('operand click delegates to active annotation anchors before ordinary target handling', () => {
 const f = fixture(); f.anchor.active = true; assert.equal(f.command.operandClick({}, 'distance'), 'anchorResult'); assert.deepEqual(f.events, ['hit', 'anchor']);
});
test('fixed operand rejects reference or derived targets without clearing selection', () => {
 const f = fixture(); f.state.operand = { kind: 'point', relation: 'reference', point: {} };
 assert.equal(f.command.operandClick({}, 'fixed'), true); assert.deepEqual(f.events, ['hit', 'hint:error']);
 f.events.length = 0; f.state.operand.relation = 'active'; f.state.operand.element = { derivedProjection: true };
 f.command.operandClick({}, 'fixed'); assert.deepEqual(f.events, ['hit', 'hint:error']);
});
test('fixed operand routes projected geometry individually and restores the pending command after clearing', () => {
 const f = fixture(); const operand = { kind: 'point', relation: 'active', point: {}, element: { blockProjection: true } }; f.state.operand = operand;
 f.session.begin('fixed', []); const pending = f.session.command;
 assert.equal(f.command.operandClick({}, 'fixed'), true); assert.equal(f.session.command, pending); assert.equal(f.session.operands.length, 0);
 assert.deepEqual(f.events, ['hit', 'clear', 'sync', 'fixGeometry', 'clear', 'selectionUI', 'toolbar', 'buttons', 'draw']);
});
test('blank dimension click confirms line length and enters value input in the original order', () => {
 const f = fixture(); f.state.resolution = { action: 'place-dimension', target: { kind: 'line-length' } };
 assert.equal(f.command.operandClick({}, 'distance'), true); assert.deepEqual(f.events, ['hit', 'distance', 'value']);
});
test('operand rejection returns feedback without resolution or redraw and accepted errors redraw after sync', () => {
 const f = fixture(); f.state.accepted = false; f.command.operandClick({}, 'parallel'); assert.deepEqual(f.events, ['hit', 'hint:error']);
 f.events.length = 0; f.state.accepted = true; f.state.operand = {}; f.state.resolution = { error: 'invalid' };
 f.command.operandClick({}, 'parallel'); assert.deepEqual(f.events, ['hit', 'sync', 'hint:error', 'draw']);
});
test('valid operand click routes commit or dimension placement and unfinished selection feedback', () => {
 for (const [resolution, tail] of [[{ action: 'commit', constraint: {} }, ['commit']], [{ action: 'place-dimension', target: { kind: 'line-length' } }, ['distance']], [null, ['selectionUI', 'hint:normal', 'draw']]]) {
  const f = fixture(); f.state.operand = {}; f.state.resolution = resolution; f.command.operandClick({}, 'distance');
  assert.deepEqual(f.events, ['hit', 'sync', ...tail]); assert.equal(f.session.operands[0], f.state.operand);
 }
});
