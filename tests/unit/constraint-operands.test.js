const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('src/constraints/operands.js', 'utf8'), sandbox);
class TestArc {}
function create(overrides = {}) {
  const relations = new Map([['S1', 'active'], ['S2', 'reference'], ['S3', 'descendant']]);
  const values = sandbox.window.ConstraintOperands.create({ elementSketchId: element => element?.sketchId || null,
    operandRelationForSketch: id => relations.get(id) || null,
    sameArcEndpoint: (a, b) => a?.arc === b?.arc && a?.endpoint === b?.endpoint,
    Arc: TestArc, lineHasDirection: line => line.direction !== false, ...overrides });
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


test('ordinary target append moves repeated identity to the end and trims only the returned list', () => {
 const { values: v } = create(); const a = { kind: 'point', point: {} }, b = { kind: 'point', point: {} }, c = { kind: 'point', point: {} };
 const operands = [a, b]; const moved = v.appendTarget('coincident', operands, a, () => 'invalid');
 assert.deepEqual([...moved.operands], [b, a]); assert.deepEqual(operands, [a, b]);
 const trimmed = v.appendTarget('distance', operands, c, () => 'invalid'); assert.deepEqual([...trimmed.operands], [b, c]);
 assert.equal(trimmed.operands[1], c);
});
test('horizontal and vertical limits depend on the resulting target kinds', () => {
 const { values: v } = create(); const a = { kind: 'line', line: {} }, b = { kind: 'line', line: {} }, p = { kind: 'point', point: {} };
 assert.deepEqual([...v.appendTarget('horizontal', [a], b, () => 'invalid').operands], [b]);
 assert.deepEqual([...v.appendTarget('vertical', [p], b, () => 'invalid').operands], [p, b]);
});
test('symmetry rejects wrong stages, duplicate geometry, short lines and mismatched subject kinds without mutation', () => {
 const { values: v } = create(); const axis = { kind: 'line', line: {} }, point = { kind: 'point', point: {} };
 assert.equal(v.appendTarget('symmetry', [], point, () => 'invalid').error, 'invalid');
 const operands = [axis, point];
 assert.equal(v.appendTarget('symmetry', operands, { kind: 'line', line: {} }, () => 'invalid').ok, false);
 assert.equal(v.appendTarget('symmetry', [axis], { kind: 'line', line: axis.line }, () => 'invalid').ok, false);
 assert.match(v.appendTarget('symmetry', [], { kind: 'line', line: { direction: false } }, () => 'invalid').error, /短すぎ/);
 assert.deepEqual(operands, [axis, point]);
 const third = { kind: 'point', point: {} }; assert.deepEqual([...v.appendTarget('symmetry', operands, third, () => 'invalid').operands], [axis, point, third]);
 assert.match(v.appendTarget('symmetry', [axis, point, third], { kind: 'point', point: {} }, () => 'invalid').error, /3つ/);
});
test('symmetry accepts Arc subjects and operand filters preserve spline and endpoint eligibility', () => {
 const { values: v } = create(), axis = { kind: 'line', line: {} }, arc = { kind: 'primitive', primitive: new TestArc() };
 assert.equal(v.appendTarget('symmetry', [axis], arc, () => 'invalid').ok, true);
 assert.equal(v.appendTarget('symmetry', [axis], { kind: 'primitive', primitive: {} }, () => 'invalid').ok, false);
 const spline = { kind: 'spline', spline: {} }, endpoint = { kind: 'arc-endpoint', arc: {}, endpoint: 'start' };
 for (const type of ['coincident', 'tangent']) assert.equal(v.appendTarget(type, [], spline, () => 'invalid').ok, true);
 for (const type of ['equalRadius', 'distance', 'pointOnCircle']) assert.equal(v.appendTarget(type, [], spline, () => 'invalid').ok, false);
 assert.equal(v.appendTarget('pointOnCircle', [], endpoint, () => 'invalid').ok, true);
 assert.equal(v.appendTarget('distance', [], endpoint, () => 'invalid').ok, false);
});
test('invalid guidance is evaluated only on rejection and directional line guards keep their existing message', () => {
 const { values: v } = create(); let reads = 0; const hint = () => { reads++; return 'invalid'; };
 assert.equal(v.appendTarget('parallel', [], { kind: 'line', line: {} }, hint).ok, true); assert.equal(reads, 0);
 assert.equal(v.appendTarget('parallel', [], null, hint).error, 'invalid'); assert.equal(reads, 1);
 assert.match(v.appendTarget('parallel', [], { kind: 'line', line: { direction: false } }, hint).error, /短すぎ/); assert.equal(reads, 1);
});


test('selection conversion retains kind order and geometry identities without duplicating selected arc endpoints', () => {
 const { values } = create(), item = () => ({ sketchId: 'S1' });
 const p=item(),l=item(),c=item(),a=item(),whole=item(),excluded={sketchId:'other'};
 const selection={points:[p,excluded],lines:[l],circles:[c],arcs:[a,whole],arcEndpoint:{arc:a,endpoint:'end'},splines:[]};
 const result=values.fromSelection(selection,null);
 assert.deepEqual(Array.from(result,operand=>operand.kind),['point','line','primitive','primitive','arc-endpoint']);
 assert.equal(result[0].point,p);assert.equal(result[1].line,l);assert.equal(result[2].primitive,c);assert.equal(result[3].primitive,whole);assert.equal(result[4].arc,a);
 assert.equal(result[4].endpoint,'end');assert.deepEqual(selection.arcs,[a,whole]);assert.equal(selection.points[1],excluded);
});
test('Spline conversion uses explicit pointer, then start point, then origin, preserving sampling and endpoint rules', () => {
 const calls=[], curve={},start={x:3,y:4},pointer={x:5,y:6};let t=0.75;
 const { values }=create({closestSplinePoint:(...args)=>{calls.push(args);return t==null?null:{t};}});
 const spline={sketchId:'S2',curve:()=>curve,startPoint:()=>start};
 const selection={points:[],lines:[],circles:[],arcs:[],arcEndpoint:null,splines:[spline]};
 const first=values.fromSelection(selection,pointer)[0];assert.equal(first.spline,spline);assert.equal(first.parameter,0.75);assert.equal(first.endpoint,'end');assert.equal(first.relation,'reference');
 assert.equal(calls[0][0],curve);assert.equal(calls[0][1],pointer);assert.equal(calls[0][2].samplesPerSpan,28);
 t=0.5;assert.equal(values.fromSelection(selection,null)[0].endpoint,'start');assert.equal(calls[1][1],start);
 t=null;spline.startPoint=()=>null;assert.equal(values.fromSelection(selection,null)[0].parameter,0);assert.equal(calls[2][1].x,0);assert.equal(calls[2][1].y,0);
});
