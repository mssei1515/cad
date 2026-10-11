const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(path => path.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const names = ['PointAxisDistanceConstraint', 'DistanceConstraint', 'PointLineDistanceConstraint', 'LineLineDistanceConstraint', 'LineCircleDistanceConstraint', 'ConcentricRadiusDifferenceConstraint', 'LineAngleConstraint', 'RadiusConstraint', 'DiameterConstraint'];
const types = Object.fromEntries(names.map(name => [name, class { constructor(...args) { this.type = name; this.args = args; } }]));
const factory = sandbox.window.DimensionConstraintFactory.create({ types, linesAreParallel: (a, b) => a.parallel && b.parallel });
test('point axis and line length dimensions preserve supplied point identity and axis precedence', () => {
 const p1 = {}, p2 = {}, dimension = { axis: 'y' };
 const axis = factory.fromTarget({ kind: 'point-point', p1, p2, dimensionAxis: 'x' }, 12, dimension).constraint;
 assert.equal(axis.type, 'PointAxisDistanceConstraint'); assert.deepEqual([...axis.args], [p1, p2, 12, 'x']); assert.equal(axis.dimension, dimension);
 const length = factory.fromTarget({ kind: 'line-length', p1, p2 }, 12, dimension).constraint;
 assert.equal(length.type, 'DistanceConstraint'); assert.deepEqual([...length.args], [p1, p2, 12]);
});
test('supported dimension target kinds retain geometry references and angle converts degrees once', () => {
 const a = { parallel: true }, b = { parallel: true }, dimension = { angleStartFlip: 1, angleEndFlip: 2 };
 const cases = [
  [{ kind: 'point-line', point: a, line: b }, 'PointLineDistanceConstraint'],
  [{ kind: 'line-line', line1: a, line2: b }, 'LineLineDistanceConstraint'],
  [{ kind: 'line-circle', line: a, circle: b }, 'LineCircleDistanceConstraint'],
  [{ kind: 'radius-difference', a, b }, 'ConcentricRadiusDifferenceConstraint'],
 ];
 for (const [target, type] of cases) { const c = factory.fromTarget(target, 90, dimension).constraint; assert.equal(c.type, type); assert.deepEqual([...c.args], [a, b, 90]); }
 const angle = factory.fromTarget({ kind: 'angle', line1: a, line2: b }, 90, dimension).constraint;
 assert.equal(angle.type, 'LineAngleConstraint'); assert.deepEqual([...angle.args], [a, b, Math.PI / 2, 1, 2]);
});
test('radius and diameter prefix decoration does not change supplied placement or display', () => {
 const primitive = {}, dimension = { x: 1, display: { suffix: 'mm', prefix: 'old' } };
 for (const [kind, prefix] of [['radius', 'R'], ['diameter', 'Φ']]) {
  const c = factory.fromTarget({ kind, primitive }, 5, dimension).constraint;
  assert.equal(c.args[0], primitive); assert.notEqual(c.dimension, dimension); assert.notEqual(c.dimension.display, dimension.display);
  assert.equal(c.dimension.display.prefix, prefix); assert.equal(c.dimension.display.suffix, 'mm');
 }
 assert.equal(dimension.display.prefix, 'old');
});
test('invalid and nonparallel targets return construction results without UI or model effects', () => {
 for (const target of [null, { kind: 'invalid' }, { kind: 'unsupported' }]) assert.equal(factory.fromTarget(target, 1, {}).constraint, null);
 const result = factory.fromTarget({ kind: 'line-line', line1: {}, line2: {} }, 1, {});
 assert.equal(result.constraint, null); assert.equal(result.error, '線-線寸法は平行線のみです');
});
test('dimension target item query retains order, object identity and line-length ownership', () => {
 const a = {}, b = {}, query = sandbox.window.DimensionQueries.targetItems;
 for (const target of [{ kind: 'point-point', p1: a, p2: b }, { kind: 'point-line', point: a, line: b }, { kind: 'line-circle', line: a, circle: b }, { kind: 'radius-difference', a, b }, { kind: 'angle', line1: a, line2: b }]) assert.deepEqual([...query(target)], [a, b]);
 assert.deepEqual([...query({ kind: 'line-length', line: a, p1: b })], [a]); assert.deepEqual([...query({ kind: 'radius', primitive: a })], [a]); assert.equal(query({ kind: 'unknown' }).length, 0);
});
