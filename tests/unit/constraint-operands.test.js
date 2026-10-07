const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('src/constraints/operands.js', 'utf8'), sandbox);
function create() {
  const relations = new Map([['S1', 'active'], ['S2', 'reference'], ['S3', 'descendant']]);
  const values = sandbox.window.ConstraintOperands.create({ elementSketchId: element => element?.sketchId || null,
    operandRelationForSketch: id => relations.get(id) || null,
    sameArcEndpoint: (a, b) => a?.arc === b?.arc && a?.endpoint === b?.endpoint });
  return { values, relations };
}

test('operand generation preserves geometry identity and reads the current sketch relation', () => {
  const { values: v, relations } = create(), point = { id: 'P1', sketchId: 'S1' };
  const operand = v.makeConstraintOperand('point', { point });
  assert.equal(operand.point, point); assert.equal(operand.element, point); assert.equal(operand.relation, 'active');
  relations.set('S1', 'reference'); assert.equal(v.makeConstraintOperand('point', { point }).relation, 'reference');
  assert.equal(v.makeConstraintOperand('point', { point, sketchId: 'S3' }).relation, 'descendant');
  assert.equal(v.makeConstraintOperand('point', { point, sketchId: 'unrelated' }), null);
  assert.equal(v.makeConstraintOperand('point', {}), null);
});

test('supported reference and subject conversions retain spline parameter and endpoint without cloning geometry', () => {
  const { values: v } = create();
  for (const kind of ['point', 'line', 'primitive', 'spline']) {
    const geometry = { sketchId: 'S2' }, target = { kind, [kind]: geometry, sketchId: 'S2', parameter: 0.7, endpoint: 'end' };
    const operand = v.operandFromReferenceTarget(target), restored = v.referenceTargetFromOperand(operand), subject = v.subjectFromOperand(operand);
    assert.equal(restored[kind], geometry); assert.equal(subject[kind], geometry);
    assert.equal(restored.sketchId, 'S2'); assert.equal('sketchId' in subject, false);
    assert.equal(v.referenceSubjectElement(subject), geometry); assert.equal(v.referenceSubjectSketchId(subject), 'S2');
    if (kind === 'spline') { assert.equal(restored.parameter, 0.7); assert.equal(subject.endpoint, 'end'); }
  }
  assert.equal(v.operandFromReferenceTarget(null), null); assert.equal(v.referenceTargetFromOperand(null), null);
  assert.equal(v.subjectFromOperand(null), null); assert.equal(v.referenceSubjectElement(null), null);
});

test('operand equality uses object identity, kind and arc endpoint rather than serialized IDs', () => {
  const { values: v } = create(), arc = { id: 'A1', sketchId: 'S1' }, other = { ...arc };
  const start = { kind: 'arc-endpoint', arc, endpoint: 'start' }, end = { ...start, endpoint: 'end' };
  assert.equal(v.sameConstraintOperand(start, { ...start }), true); assert.equal(v.sameConstraintOperand(start, end), false);
  assert.equal(v.sameConstraintOperand(start, { ...start, arc: other }), false);
  assert.equal(v.subjectFromOperand(start).arc, arc); assert.equal(v.referenceTargetFromOperand(start), null);
  assert.equal(v.operandFromReferenceTarget(start), null);
  const a = { kind: 'primitive', primitive: arc };
  assert.equal(v.sameConstraintOperand(a, { ...a }), true); assert.equal(v.sameConstraintOperand(a, { kind: 'primitive', primitive: other }), false);
  assert.equal(v.sameConstraintOperand(a, start), false); assert.equal(v.sameConstraintOperand(null, a), false);
  assert.equal(v.operandElement({ kind: 'other', element: arc }), arc);
  assert.equal(v.referenceSubjectElement({ kind: 'other', element: arc }), null);
});
