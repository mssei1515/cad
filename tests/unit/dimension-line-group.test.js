const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
  'src/constraints/dimension_queries.js', 'src/rendering/dimension_placement.js', 'src/commands/dimension_line_group.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const { Point, Line } = sandbox.window.GeometrySolver;
const placement = sandbox.window.DimensionPlacement.create({ viewport: { scale: 2 } });
const command = sandbox.window.DimensionLineGroup.create({ placement, Line });
const plain = value => JSON.parse(JSON.stringify(value));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function entry(p1, p2, anchor, axis = null) {
  const target = { kind: 'line-length', p1: new Point('a', ...p1), p2: new Point('b', ...p2), dimensionAxis: axis };
  const constraint = { value: 100, expression: '100', dimension: { ...placement.dimensionFromAnchor(target, anchor),
    labelOffsetU: 17, display: { color: '#123456' } } };
  return { constraint, target };
}
test('align actual lines with different geometry origins and reversed directions', () => {
  const entries = [entry([0, 0], [100, 0], { x: 50, y: -30 }), entry([160, 80], [0, 80], { x: 80, y: 50 })];
  const group = command.group(entries, entries[0].constraint);
  const original = plain(entries[0].constraint);
  assert.equal(command.align(group), true);
  assert.deepEqual(plain(entries[0].constraint), original);
  close(placement.dimensionAnchor(entries[1].target, entries[1].constraint.dimension).y, -30);
  assert.notEqual(entries[0].constraint.dimension.offsetN, entries[1].constraint.dimension.offsetN);
  assert.equal(entries[1].constraint.dimension.labelOffsetU, 17);
  assert.deepEqual(plain(entries[1].constraint.dimension.display), { color: '#123456' });
  assert.equal(command.align(command.group(entries, entries[1].constraint)), false);
});
test('vertical, slanted and axis-projected groups translate normally from original snapshots', () => {
  for (const [p1, p2, axis] of [[[0, 0], [0, 100], null], [[0, 0], [100, 100], null], [[0, 0], [100, 100], 'x']]) {
    const entries = [entry(p1, p2, { x: 40, y: -30 }, axis), entry(p1.map(v => v + 20), p2.map(v => v + 20), { x: 60, y: -10 }, axis)];
    const group = command.group(entries, entries[0].constraint);
    command.translate(group, { x: 7, y: 9 });
    command.translate(group, { x: 14, y: 18 });
    const distance = 14 * group.normal.x + 18 * group.normal.y;
    for (const member of group.members) {
      const actual = placement.dimensionAnchor(member.target, member.constraint.dimension);
      close(actual.x, member.anchor.x + group.normal.x * distance);
      close(actual.y, member.anchor.y + group.normal.y * distance);
      assert.equal(member.constraint.value, 100); assert.equal(member.constraint.expression, '100');
      assert.equal(member.constraint.dimension.labelOffsetU, 17);
      assert.equal(member.constraint.dimension.axis, axis);
    }
  }
});
test('reject nonparallel, radial, angular, missing reference and single selections', () => {
  const a = entry([0, 0], [100, 0], { x: 50, y: -30 });
  const b = entry([0, 0], [0, 100], { x: 30, y: 50 });
  assert.equal(command.group([a, b], a.constraint), null);
  for (const kind of ['angle', 'radius', 'diameter', 'radius-difference', 'offset-distance']) {
    assert.equal(command.group([a, { constraint: {}, target: { kind } }], a.constraint), null);
  }
  assert.equal(command.group([a, a], {}), null);
  assert.equal(command.group([a], a.constraint), null);
});
