const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/constraints/reference_constraint_state.js', 'utf8'), sandbox);
function fixture() {
  const state = { scope: { constraints: [] }, allowed: () => true };
  const validity = sandbox.window.ReferenceConstraintState.create({ currentScope: () => state.scope,
    constraintSketchId: constraint => constraint.sketchId,
    isReferenceSourceSketchId: (source, owner) => state.allowed(source, owner) });
  const edge = (owner, source) => ({ sketchId: owner, reference: true, referenceSketchId: source, enabled: true });
  return { state, validity, edge };
}
test('refresh validates accepted references in stored order without changing persisted constraints', () => {
  const f = fixture(), ab = f.edge('A', 'B'), bc = f.edge('B', 'C'), ca = f.edge('C', 'A');
  f.state.scope.constraints = [ab, bc, ca];
  const before = JSON.stringify(f.state.scope.constraints);
  f.validity.refreshReferenceConstraintValidity();
  assert.equal(f.validity.referenceConstraintErrorInfo(ca), '循環参照');
  assert.equal(f.validity.constraintIsOperational(ca), false);
  assert.equal(f.validity.constraintIsOperational(ab), true);
  assert.equal(JSON.stringify(f.state.scope.constraints), before);
  f.state.scope.constraints = [ca, bc, ab];
  f.validity.refreshReferenceConstraintValidity();
  assert.equal(f.validity.referenceConstraintErrorInfo(ab), '循環参照');
  assert.equal(f.validity.referenceConstraintErrorInfo(ca), null);
});
test('out-of-scope edges do not contribute to cycle detection and range failure takes precedence', () => {
  const f = fixture(), ab = f.edge('A', 'B'), ba = f.edge('B', 'A'), self = f.edge('C', 'C');
  f.state.allowed = (source, owner) => owner === 'B';
  f.state.scope.constraints = [ab, ba, self];
  f.validity.refreshReferenceConstraintValidity();
  assert.equal(f.validity.referenceConstraintErrorInfo(ab), '参照範囲外');
  assert.equal(f.validity.referenceConstraintErrorInfo(ba), null);
  assert.equal(f.validity.referenceConstraintErrorInfo(self), '参照範囲外');
  assert.equal(f.validity.errorCount, 2);
  assert.equal(f.validity.referenceConstraintErrorCountForSketch('A'), 1);
  assert.equal(f.validity.referenceConstraintErrorCountForSketch('B'), 0);
});
test('disabled, non-reference and missing-reference entries retain existing operational rules', () => {
  const f = fixture(), disabled = f.edge('A', 'A'), plain = { sketchId: 'A' }, missing = { sketchId: 'A', reference: true };
  disabled.enabled = false;
  f.state.scope.constraints = [disabled, plain, missing];
  f.validity.refreshReferenceConstraintValidity();
  assert.equal(f.validity.errorCount, 0);
  assert.equal(f.validity.constraintIsOperational(disabled), false);
  assert.equal(f.validity.constraintIsOperational(plain), true);
  assert.equal(f.validity.constraintIsOperational(missing), true);
  disabled.enabled = true; f.validity.refreshReferenceConstraintValidity();
  assert.equal(f.validity.referenceConstraintErrorInfo(disabled), '循環参照');
});
test('proposed cycles follow only operational edges and handle repeated references and unrelated cycles', () => {
  const f = fixture(), ab = f.edge('A', 'B'), bc = f.edge('B', 'C'), disabled = f.edge('D', 'A');
  disabled.enabled = false;
  f.state.scope.constraints = [ab, f.edge('A', 'B'), bc, disabled, f.edge('X', 'Y'), f.edge('Y', 'X')];
  assert.equal(f.validity.wouldCreateReferenceCycle('C', 'A'), true);
  assert.equal(f.validity.wouldCreateReferenceCycle('A', 'C'), false);
  assert.equal(f.validity.wouldCreateReferenceCycle('A', 'D'), false);
  assert.equal(f.validity.wouldCreateReferenceCycle('Z', 'X'), false);
  assert.equal(f.validity.wouldCreateReferenceCycle('A', 'A'), true);
  f.state.allowed = (_source, owner) => owner !== 'B'; f.validity.refreshReferenceConstraintValidity();
  assert.equal(f.validity.wouldCreateReferenceCycle('C', 'A'), false);
});
test('diagnostic snapshots cannot mutate the owned state and refresh reads the current workspace', () => {
  const f = fixture(), invalid = f.edge('A', 'A'); f.state.scope.constraints = [invalid];
  const snapshot = f.validity.refreshReferenceConstraintValidity();
  snapshot.clear(); const reasons = f.validity.errorReasons(); reasons.length = 0;
  assert.equal(f.validity.errorCount, 1);
  assert.equal(f.validity.referenceConstraintErrorInfo({ ...invalid }), null);
  f.state.scope = { constraints: [] }; f.validity.refreshReferenceConstraintValidity();
  assert.equal(f.validity.errorCount, 0);
  f.state.scope = { constraints: [invalid] }; f.validity.refreshReferenceConstraintValidity();
  f.validity.clear(); assert.equal(f.validity.errorCount, 0);
  assert.equal(f.validity.constraintIsOperational(invalid), true);
  assert.equal(fixture().validity.errorCount, 0);
});
