const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/instance_transform_command.js'), 'utf8'), sandbox);
function fixture({ placing = false, subsetSuccess = true, dependentSuccess = true, blockSuccess = true } = {}) {
  const instance = { id: 'I1', definitionId: 'D1', sketchId: 'S1', x: 10, y: 20, rotation: 0, rotationLocked: true };
  const source = {}, other = {}, calls = [];
  const command = sandbox.window.InstanceTransformCommand.create({
    isPlacing: () => placing, currentScope: () => ({ blockInstances: [instance] }),
    snapshotModelState: () => ({ ...instance }), restoreModelState: snapshot => { Object.assign(instance, snapshot); calls.push('restore'); },
    geometryInstanceSourceObjects: () => new Set([source]),
    sketchSolveVariables: () => [source, instance, other].map(object => ({ object })), sketchSolveConstraints: () => [], sketchSolveLines: () => [],
    solver: { solveSubset: ({ variables }) => { assert.equal(variables.length, 1); assert.equal(variables[0].object, other); calls.push('subset'); return { success: subsetSuccess, errorNorm: 0 }; } },
    acceptError: 1e-4,
    stabilizeActiveParameterNamespace: (_id, { variableAllowed }) => {
      assert.equal(variableAllowed({ object: source }), false); assert.equal(variableAllowed({ object: instance }), false); assert.equal(variableAllowed({ object: other }), true);
      calls.push('stabilize'); return { success: true, dependent: { success: dependentSuccess } };
    },
    clearSketchSolveState: () => calls.push('clearSolve'), applicationText: (_ja, en) => en, setHint: () => calls.push('hint'), recordHistory: () => calls.push('history'),
    blockDefinitionById: () => ({ name: 'Part' }), blockLocalGeometryBounds: () => ({ center: { x: 2, y: 3 } }), blockInstanceEnabledSketchSet: () => new Set(['S1']),
    blockWorldPoint: (item, p) => ({ x: item.x + p.x * Math.cos(item.rotation) - p.y * Math.sin(item.rotation), y: item.y + p.x * Math.sin(item.rotation) + p.y * Math.cos(item.rotation) }),
    invalidateBlockProjectionCache: () => calls.push('invalidate'), updateBlockUI: () => calls.push('blockUI'), refreshConstraintAnalysis: () => calls.push('analysis'),
    updateUI: () => calls.push('ui'), draw: () => calls.push('draw'), snappedBlockRotation: angle => Math.round(angle / (Math.PI / 2)) * Math.PI / 2,
    solveSketchAndDependents: () => { calls.push('blockSolve'); return { success: blockSuccess }; }, updatePropertiesUI: () => calls.push('properties'),
  });
  return { command, instance, calls };
}

test('Free transform preserves source variables and pending placement edits skip solver and history', () => {
  const f = fixture(); assert.equal(f.command.changeFreeInstanceProperty(f.instance, 'rotation', '90'), true);
  assert.equal(f.instance.rotation, Math.PI / 2); assert.deepEqual(f.calls, ['subset', 'stabilize', 'history']);
  const pending = fixture({ placing: true }); assert.equal(pending.command.changeFreeInstanceProperty(pending.instance, 'mirrorX', true), true);
  assert.equal(pending.instance.mirrorX, true); assert.deepEqual(pending.calls, []);
});

test('Free transform restores failed local or dependent solves without recording history', () => {
  for (const options of [{ subsetSuccess: false }, { dependentSuccess: false }]) {
    const f = fixture(options); assert.equal(f.command.changeFreeInstanceProperty(f.instance, 'rotation', '90'), false);
    assert.equal(f.instance.rotation, 0); assert.equal(f.calls.includes('history'), false);
    assert.ok(f.calls.includes('restore')); assert.equal(f.calls.includes('clearSolve'), options.dependentSuccess === false);
  }
});

test('Block orthogonal rotation preserves the display center and a failed solve restores and resolves again', () => {
  const f = fixture(); assert.equal(f.command.setBlockInstanceOrthogonalRotation(f.instance, Math.PI / 2), true);
  assert.ok(Math.abs(f.instance.x - 15) < 1e-12); assert.ok(Math.abs(f.instance.y - 21) < 1e-12);
  assert.deepEqual(f.calls, ['invalidate', 'blockSolve', 'analysis', 'hint', 'ui', 'draw', 'history']);
  const failed = fixture({ blockSuccess: false }); assert.equal(failed.command.setBlockInstanceOrthogonalRotation(failed.instance, Math.PI / 2), false);
  assert.equal(failed.instance.x, 10); assert.equal(failed.instance.y, 20); assert.equal(failed.instance.rotation, 0);
  assert.deepEqual(failed.calls, ['invalidate', 'blockSolve', 'restore', 'blockSolve', 'analysis', 'hint', 'ui', 'draw']);
});

test('fixed Blocks reject rotation changes while unlocking requires no solver', () => {
  const f = fixture(); f.instance.fixed = true;
  assert.equal(f.command.setBlockInstanceRotationLocked(f.instance, false), false); assert.deepEqual(f.calls, ['hint', 'blockUI']);
  f.instance.fixed = false; f.calls.length = 0;
  assert.equal(f.command.setBlockInstanceRotationLocked(f.instance, false), true);
  assert.equal(f.instance.rotationLocked, false); assert.deepEqual(f.calls, ['analysis', 'hint', 'ui', 'draw', 'history']);
});
