const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/constraints/intent_resolver.js','utf8'), sandbox);
function fixture() {
 const state = { target: { kind: 'line-length' }, constraint: {}, allowed: true, cycle: false, editable: true, active: true }, calls = [];
 const types = Object.fromEntries(['PointOnSplineConstraint','SplineLineTangentConstraint','SplineSplineTangentConstraint'].map(name => [name, class { constructor(...args) { this.name = name; this.args = args; } }]));
 const candidates = { distanceTargetFromOperands: operands => { calls.push(['distance', operands]); return state.target; },
  symmetryConstraintFromOperands: operands => { calls.push(['symmetry', operands]); return state.constraint; },
  constraintFromTargets: (type, targets, sketchId) => { calls.push(['normal', type, targets, sketchId]); return state.constraint; },
  constraintTargetsFromOperands: operands => operands,
  referenceDistanceTargetForSubject: (subject, target) => { calls.push(['referenceDistance', subject, target]); return state.target; },
  referenceConstraintForType: (type, subject, target) => { calls.push(['reference', type, subject, target]); return state.constraint; } };
 const operands = { subjectFromOperand: operand => operand, referenceTargetFromOperand: operand => operand,
  referenceSubjectElement: subject => subject?.item, referenceSubjectSketchId: subject => subject?.sketchId };
 const resolver = sandbox.window.ConstraintIntentResolver.create({ candidates, operands, types, activeSketchId: () => 'S',
  isReferenceSourceSketchId: () => state.allowed, wouldCreateReferenceCycle: () => state.cycle,
  isActiveSketchElement: () => state.active, isEditableSketchElement: () => state.editable,
  descendantSketchIds: () => ['child'], applicationText: text => text, invalidConstraintTargetHint: () => 'invalid' });
 const operand = (relation = 'active', sketchId = 'S', kind = 'line') => ({ relation, sketchId, kind, item: {} });
 return { resolver, state, calls, operand };
}
test('descendant and mixed-owner rejection precede candidate creation without changing input', () => {
 const f = fixture(), a = f.operand(), child = f.operand('descendant','child'), input = [a, child];
 assert.match(f.resolver.resolve('distance',input).error,/子孫/); assert.deepEqual(f.calls, []); assert.deepEqual(input,[a,child]);
 assert.match(f.resolver.resolve('parallel',[a,f.operand('active','other')]).error,/別スケッチ/); assert.deepEqual(f.calls, []);
 assert.match(f.resolver.resolve('parallel',[f.operand('unknown')]).error,/拘束対象/);
});
test('ordinary distance keeps operand order and object identity while all-reference distance is measured in the active sketch', () => {
 const f = fixture(), a = f.operand(), b = f.operand(), input = [null,a,b];
 const result = f.resolver.resolve('distance',input); assert.equal(result.action,'place-dimension'); assert.equal(result.target,f.state.target);
 assert.deepEqual(Array.from(result.operands),[a,b]); assert.notEqual(result.operands,input); assert.equal(input[0],null); assert.equal(result.sketchId,'S');
 const measured = f.resolver.resolve('distance',[f.operand('reference','parent'),f.operand('reference','parent')]);
 assert.equal(measured.readOnlyDimension,true); assert.equal(measured.sketchId,'S'); assert.equal(measured.referenceSketchId,undefined);
 f.state.target = { kind:'invalid',reason:'bad target' }; assert.equal(f.resolver.resolve('distance',[a]).error,'bad target');
});
test('ordinary constraints dispatch to candidates while incomplete resolution returns null', () => {
 const f = fixture(), a = f.operand(); const result = f.resolver.resolve('horizontal',[a]);
 assert.equal(result.action,'commit'); assert.equal(result.constraint,f.state.constraint); assert.equal(f.calls[0][0],'normal');
 f.state.constraint = null; assert.equal(f.resolver.resolve('horizontal',[a]),null);
});
test('reference pair preserves subject and source roles and validates edit authority before generating', () => {
 const f = fixture(), a = f.operand(), r = f.operand('reference','parent');
 const result = f.resolver.resolve('distance',[r,a]); assert.equal(result.action,'place-dimension'); assert.equal(result.referenceSketchId,'parent');
 assert.equal(f.calls[0][1],a); assert.equal(f.calls[0][2],r);
 f.calls.length=0; f.state.editable=false; assert.match(f.resolver.resolve('parallel',[a,r]).error,/アクティブ/); assert.deepEqual(f.calls,[]);
 f.state.editable=true; f.state.allowed=false; r.sketchId='child'; assert.match(f.resolver.resolve('parallel',[a,r]).error,/子孫/);
 f.state.allowed=true; f.state.cycle=true; assert.match(f.resolver.resolve('parallel',[a,r]).error,/循環/);
});
test('reference target count errors keep incomplete and malformed pairs distinct', () => {
 const f = fixture(), a = f.operand(), r = f.operand('reference','parent');
 assert.equal(f.resolver.resolve('parallel',[r]),null);
 assert.match(f.resolver.resolve('parallel',[a,a,r]).error,/1つずつ/);
 assert.match(f.resolver.resolve('parallel',[a,f.operand('unknown') ,r]).error,/1つずつ/);
});
test('reference symmetry validates shared ancestor and cycles after constructing the ordered symmetry candidate', () => {
 const f = fixture(), a = f.operand(), r = f.operand('reference','parent'), r2 = f.operand('reference','parent');
 const result = f.resolver.resolve('symmetry',[r,a,r2]); assert.equal(result.action,'commit'); assert.equal(result.constraint,f.state.constraint);
 assert.equal(result.referenceSketchId,'parent'); assert.deepEqual(Array.from(result.operands),[r,a,r2]);
 r2.sketchId='other'; assert.match(f.resolver.resolve('symmetry',[r,a,r2]).error,/同じ先祖/);
 r2.sketchId='parent'; f.state.cycle=true; assert.match(f.resolver.resolve('symmetry',[r,a,r2]).error,/循環/);
 assert.equal(f.resolver.resolve('symmetry',[a,r]),null);
});
test('Spline constraints preserve picked parameter and endpoints; closed tangent rejects before construction', () => {
 const f = fixture(), p = {...f.operand('active','S','point'),point:{}}, s = {...f.operand('active','S','spline'),spline:{closed:false},parameter:0.25,endpoint:'end'};
 const on = f.resolver.resolve('coincident',[p,s]).constraint; assert.equal(on.name,'PointOnSplineConstraint'); assert.deepEqual([...on.args],[p.point,s.spline,0.25]);
 const l = {...f.operand(),line:{}}; const tangent = f.resolver.resolve('tangent',[l,s]).constraint;
 assert.deepEqual([...tangent.args],[s.spline,'end',l.line]);
 const s2 = {...s,spline:{},endpoint:'start'}; const pair = f.resolver.resolve('tangent',[s2,s]).constraint;
 assert.deepEqual([...pair.args],[s2.spline,'start',s.spline,'end']);
 s.spline.closed=true; assert.match(f.resolver.resolve('tangent',[l,s]).error,/閉じた/);
});
