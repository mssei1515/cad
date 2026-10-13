const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/constraint_control_command.js'), 'utf8'), sandbox);
function fixture() {
  const f = { calls: [], session: {}, anchor: false, applicable: false, geometry: true, selected: false };
  const record = name => (...args) => f.calls.push([name, ...args]);
  f.session.replaceCommand = value => { f.calls.push(['replace', value.type]); f.session.command = value; };
  f.command = sandbox.window.ConstraintControlCommand.create({
    constraintTargetSession: f.session, cancelConstraintTargetCommand: record('cancel'), constraintLabel: type => type,
    startAnnotationAnchorConstraint: type => { f.calls.push(['anchor', type]); return f.anchor; },
    startConstraintTargetCommand: record('start'), canApplyConstraint: type => { f.calls.push(['applicable', type]); return f.applicable; },
    startDistanceCommand: record('distance'), cancelPendingCommand: record('pendingCancel'),
    updateToolbar: record('toolbar'), updateConstraintButtons: record('buttons'), addConstraint: record('add'),
    isGeometryMode: () => f.geometry, hasSelection: () => f.selected, toggleSelectedFixed: record('toggle'),
  });
  return f;
}

test('constraint activation cancels the current command before trying an annotation anchor', () => {
  const f = fixture(); f.anchor = true; f.session.command = { type: 'parallel' };
  f.command.activate('parallel');
  assert.deepEqual(f.calls, [['cancel', 'parallelの対象選択をキャンセルしました']]);
  f.calls.length = 0; f.session.command = null; f.command.activate('parallel');
  assert.deepEqual(f.calls, [['anchor', 'parallel']]);
});

test('symmetry starts target selection regardless of applicable selection and distance has its own transition', () => {
  const f = fixture(); f.applicable = true;
  f.command.activate('symmetry');
  assert.deepEqual(f.calls, [['anchor', 'symmetry'], ['start', 'symmetry']]);
  f.calls.length = 0; f.command.activate('distance');
  assert.deepEqual(f.calls, [['anchor', 'distance'], ['applicable', 'distance'], ['cancel', ''], ['distance']]);
});

test('ordinary applicable constraints preserve pending/command/UI/commit order and otherwise start selection', () => {
  const f = fixture(); f.applicable = true;
  f.command.activate('horizontal');
  assert.deepEqual(f.calls, [['anchor', 'horizontal'], ['applicable', 'horizontal'], ['cancel', ''], ['pendingCancel', ''],
    ['replace', 'horizontal'], ['toolbar'], ['buttons'], ['add', 'horizontal']]);
  assert.equal(f.session.command.type, 'horizontal');
  f.calls.length = 0; f.session.command = null; f.applicable = false; f.command.activate('horizontal');
  assert.deepEqual(f.calls, [['anchor', 'horizontal'], ['applicable', 'horizontal'], ['start', 'horizontal']]);
});

test('Fix activation keeps mode and anchor priority then chooses cancel, target selection or current selection', () => {
  const f = fixture(); f.geometry = false; f.command.activateFixed();
  assert.equal(f.calls.length, 0);
  f.geometry = true; f.anchor = true; f.session.command = { type: 'fixed' }; f.command.activateFixed();
  assert.deepEqual(f.calls, [['anchor', 'fixed']]);
  f.calls.length = 0; f.anchor = false; f.command.activateFixed();
  assert.deepEqual(f.calls, [['anchor', 'fixed'], ['cancel']]);
  f.calls.length = 0; f.session.command = null; f.command.activateFixed();
  assert.deepEqual(f.calls, [['anchor', 'fixed'], ['start', 'fixed']]);
  f.calls.length = 0; f.selected = true; f.command.activateFixed();
  assert.deepEqual(f.calls, [['anchor', 'fixed'], ['toggle']]);
});
