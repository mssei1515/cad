const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/parameters/parameter_engine.js', 'src/constraints/dimension_queries.js', 'src/parameters/namespace.js', 'src/parameters/dialog_draft.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { Point, DistanceConstraint } = sandbox.window.GeometrySolver;
function fixture() {
  const driving = new DistanceConstraint(new Point('P1', 0, 0), new Point('P2', 3, 4), 20);
  Object.assign(driving, { parameterName: 'd1', expression: '"width" * 2' });
  const measured = new DistanceConstraint(new Point('P3', 0, 0), new Point('P4', 3, 4), 100);
  Object.assign(measured, { parameterName: 'd2', readOnlyDimension: true });
  const scope = { parameters: [{ name: 'width', expression: '10' }], constraints: [driving, measured], nextDimensionParameterIndex: 3 };
  const namespace = sandbox.window.ParameterNamespace.create({ currentParameterNamespace: () => scope, applicationText: (ja, en) => en });
  const draft = sandbox.window.ParameterDialogDraft.create({ namespace }); draft.open({ key: 'document', namespace: scope });
  return { draft, scope, driving, measured };
}
const data = (row, field) => ({ parameterRow: String(row), parameterField: field });
test('draft edits are isolated and exposed rows are immutable snapshots', () => {
  const { draft, scope } = fixture(), before = draft.current;
  assert.equal(draft.isDirty(), false); assert.equal(before.namespace, scope); assert.equal(Object.isFrozen(before.parameters[0]), true);
  draft.updateInput(data(0, 'expression'), '12'); assert.equal(draft.isDirty(), true); assert.equal(scope.parameters[0].expression, '10'); assert.equal(before.parameters[0].expression, '10');
  assert.equal(draft.evaluate().values.get('d1'), 24); assert.equal(draft.evaluate().values.get('d2'), 5);
  draft.close(); assert.equal(draft.current, null); assert.equal(draft.isDirty(), false); assert.equal(draft.add(), false);
});
test('name commit rewrites dependent draft expressions without mutating model constraints', () => {
  const { draft, driving } = fixture(); draft.add(); draft.updateInput(data(1, 'expression'), '="width" + 3');
  draft.updateInput(data(0, 'name'), 'span'); draft.commitName(data(0, 'name'));
  const values = draft.evaluate().values; assert.equal(values.get('span'), 10); assert.equal(values.get('parameter1'), 13); assert.equal(values.get('d1'), 20);
  assert.equal(driving.expression, '"width" * 2'); assert.equal(draft.current.parameters[0].committedName, 'span');
  draft.updateInput(data(0, 'name'), 'width'); draft.commitName(data(0, 'name')); assert.equal(draft.evaluate().values.get('width'), 10);
});
test('read-only dimensions reject expression edits but allow draft names and use measured geometry', () => {
  const { draft, measured } = fixture();
  draft.updateInput({ dimensionRow: '1', dimensionField: 'expression' }, '999'); assert.equal(draft.current.dimensions[1].expression, ''); assert.equal(draft.isDirty(), false);
  draft.updateInput({ dimensionRow: '1', dimensionField: 'name' }, 'measured'); draft.commitName({ dimensionRow: '1', dimensionField: 'name' });
  measured.p2.x = 6; measured.p2.y = 8; assert.equal(draft.evaluate().values.get('measured'), 10); assert.equal(measured.parameterName, 'd2');
});
test('dependent deletion is blocked and unrelated syntax errors are left to evaluation', () => {
  const { draft } = fixture(); const blocked = draft.remove(0); assert.equal(blocked.removed, false); assert.equal(blocked.name, 'width'); assert.deepEqual(Array.from(blocked.dependencies), ['d1']);
  draft.updateInput({ dimensionRow: '0', dimensionField: 'expression' }, '20'); draft.add(); draft.updateInput(data(1, 'expression'), '(');
  assert.equal(draft.remove(0).removed, true); assert.equal(draft.current.parameters.length, 1); assert.throws(() => draft.evaluate()); assert.equal(draft.remove(99), null);
});
test('new names avoid parameter and dimension collisions and reopening discards uncommitted edits', () => {
  const { draft, scope } = fixture(); draft.updateInput({ dimensionRow: '0', dimensionField: 'name' }, 'parameter1'); draft.commitName({ dimensionRow: '0', dimensionField: 'name' });
  draft.add(); assert.equal(draft.current.parameters[1].name, 'parameter2'); assert.equal(draft.current.parameters[1].isNew, true);
  draft.open({ key: 'block:B1', namespace: scope }); assert.equal(draft.current.key, 'block:B1'); assert.equal(draft.current.parameters.length, 1); assert.equal(draft.isDirty(), false); assert.equal(draft.current.dimensions[0].name, 'd1');
});
test('draft evaluation reports symbol conflicts without changing the underlying namespace', () => {
  const { draft, scope } = fixture(); draft.add(); draft.updateInput(data(1, 'name'), 'width');
  assert.throws(() => draft.evaluate()); assert.equal(scope.parameters.length, 1); assert.equal(scope.parameters[0].name, 'width');
});
