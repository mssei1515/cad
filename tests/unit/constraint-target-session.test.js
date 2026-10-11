const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/editing/constraint_target_session.js', 'utf8'), sandbox);
const create = sandbox.window.ConstraintTargetSession.create;
test('session instances own separate command and operands while preserving supplied geometry identity', () => {
 const a = create({}), b = create({}); const point = {}, operand = { kind: 'point', point }, operands = [operand];
 a.begin('distance', operands); assert.equal(a.command.type, 'distance'); assert.equal(a.operands, operands);
 assert.equal(a.operands[0].point, point); assert.equal(b.command, null); assert.equal(b.operands.length, 0);
});
test('rejected append preserves command and operand list and returns the original rejection', () => {
 const rejection = { ok: false, error: 'invalid' }, session = create({ acceptTarget: () => rejection });
 const operands = [{}]; session.begin('symmetry', operands); const command = session.command;
 assert.equal(session.append('symmetry', {}, () => 'invalid'), rejection);
 assert.equal(session.command, command); assert.equal(session.operands, operands);
});
test('accepted append delegates the current targets and adopts the accepted list without changing command', () => {
 const operands = [{}], candidate = {}, hint = () => 'invalid', next = [...operands, candidate];
 const session = create({ acceptTarget: (type, current, item, feedback) => {
  assert.equal(type, 'coincident'); assert.equal(current, operands); assert.equal(item, candidate); assert.equal(feedback, hint);
  return { ok: true, operands: next };
 } });
 session.begin('coincident', operands); const command = session.command;
 assert.equal(session.append('coincident', candidate, hint).ok, true); assert.equal(session.operands, next); assert.equal(session.command, command);
 assert.equal(operands.length, 1);
});
test('operand-only clearing and command-only clearing preserve the other state, while reset clears both', () => {
 const session = create({}), operands = [{}], annotationCommand = { annotationAnchor: {} };
 session.begin('fixed', operands); session.clearCommand(); assert.equal(session.command, null); assert.equal(session.operands, operands);
 session.replaceCommand(annotationCommand); session.clearOperands(); assert.equal(session.command, annotationCommand); assert.equal(session.operands.length, 0);
 session.replaceOperands(operands); session.reset(); assert.equal(session.command, null); assert.equal(session.operands.length, 0);
 assert.equal(operands.length, 1);
});
