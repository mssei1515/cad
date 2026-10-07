const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const sandbox = { window: {} };
vm.createContext(sandbox);
// Namespace evaluation must initialize without persistence or UI modules.
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/parameters/parameter_engine.js", "src/constraints/dimension_queries.js", "src/parameters/namespace.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, DistanceConstraint, PointAxisDistanceConstraint, LineAngleConstraint } = sandbox.window.GeometrySolver;
const queries = sandbox.window.DimensionQueries;
const dimension = () => new DistanceConstraint(new Point("P1", 0, 0), new Point("P2", 3, 4), 12);
const namespace = constraints => ({ parameters: [], constraints, nextDimensionParameterIndex: 1 });
const create = currentParameterNamespace => sandbox.window.ParameterNamespace.create({ currentParameterNamespace, applicationText: (_ja, en) => en });

test("dimension queries distinguish geometric measurements, targets and the stored angle sector", () => {
  const distance = dimension();
  assert.equal(queries.measuredDimensionValue(queries.targetFromConstraint(distance)), 5);
  assert.equal(distance.target, 12);
  for (const [axis, expected] of [["x", 3], ["y", 4]]) {
    const axisDistance = new PointAxisDistanceConstraint(distance.p1, distance.p2, 20, axis);
    assert.equal(queries.measuredDimensionValue(queries.targetFromConstraint(axisDistance)), expected);
  }
  const a = new Line("L1", distance.p1, new Point("P3", 1, 0));
  const b = new Line("L2", distance.p1, new Point("P4", 0.5, Math.sqrt(3) / 2));
  const angle = new LineAngleConstraint(a, b, Math.PI / 2);
  const target = queries.targetFromConstraint(angle);
  assert.ok(Math.abs(queries.measuredDimensionValue(target) - 60) < 1e-10);
  assert.ok(Math.abs(queries.measuredDimensionValue(target, { angleStartFlip: 0, angleEndFlip: 1 }) - 120) < 1e-10);
  assert.equal(angle.target, Math.PI / 2);
});

test("automatic dimension names and default namespaces follow the active editing scope", () => {
  const document = namespace([dimension()]), block = namespace([dimension()]);
  let current = document;
  const api = create(() => current);
  api.ensureDimensionParameter(document.constraints[0]);
  current = block;
  api.ensureDimensionParameter(block.constraints[0]);
  assert.equal(document.constraints[0].parameterName, "d1");
  assert.equal(block.constraints[0].parameterName, "d1");
  block.constraints.push(Object.assign(dimension(), { parameterName: "d8", readOnlyDimension: true, expression: "999" }));
  api.ensureParameterNamespace(block);
  api.ensureParameterNamespace(block);
  assert.equal(block.nextDimensionParameterIndex, 9);
  assert.equal(document.nextDimensionParameterIndex, 2);
  assert.equal(block.constraints[1].expression, undefined);
  assert.equal(api.allocateDimensionParameterName(block), "d9");
});

test("namespace evaluation combines parameters, measured references and driving dimensions without moving geometry", () => {
  const reference = Object.assign(dimension(), { parameterName: "d1", readOnlyDimension: true });
  const driven = Object.assign(dimension(), { parameterName: "d2", expression: '"width" * 2 + "d1"' });
  const scope = namespace([reference, driven]);
  scope.parameters.push({ name: "width", expression: "10" });
  const api = create(() => scope);
  const result = api.evaluateParameterNamespace(scope);
  assert.equal(scope.parameters[0].evaluatedValue, 10);
  assert.equal(reference.target, 5);
  assert.equal(driven.target, 25);
  assert.equal(driven.p2.x, 3);
  assert.equal(driven.p2.y, 4);
  assert.equal(result.values, scope.parameterValues);
  assert.deepEqual(Array.from(scope.parameterDependencies.get("d2")), ["width", "d1"]);
  assert.deepEqual(Array.from(api.parameterDependents(scope, ["width"])), ["d2"]);
  assert.deepEqual(Array.from(api.parameterDependents(scope, ["width"], new Set([driven]))), []);
});

test("angle expressions use degrees and failures preserve the caller's existing rollback responsibility", () => {
  const p = new Point("P1", 0, 0);
  const angle = new LineAngleConstraint(new Line("L1", p, new Point("P2", 1, 0)), new Line("L2", p, new Point("P3", 0, 1)), Math.PI / 2);
  const reference = Object.assign(dimension(), { readOnlyDimension: true });
  const scope = namespace([reference, angle]);
  const api = create(() => scope);
  api.ensureParameterNamespace(scope);
  assert.equal(angle.expression, "90");
  angle.expression = "60";
  api.evaluateParameterNamespace(scope);
  assert.ok(Math.abs(angle.target - Math.PI / 3) < 1e-12);
  angle.expression = "180";
  reference.target = 99;
  const failed = api.validateParameterNamespace(scope);
  assert.equal(failed.success, false);
  assert.match(failed.reason, /out of range/);
  assert.equal(reference.target, 5, "Reference measurement occurs before range validation; transactions own rollback");
  assert.ok(Math.abs(angle.target - Math.PI / 3) < 1e-12);
});

test("loaded namespace validation preserves version 10 requirements and legacy dimension migration", () => {
  const api = create(() => null);
  const legacy = namespace([dimension()]);
  api.prepareLoadedParameterNamespace(legacy, 9, "Document");
  assert.equal(legacy.constraints[0].parameterName, "d1");
  assert.equal(legacy.constraints[0].expression, "12");
  const modern = namespace([dimension()]);
  assert.throws(() => api.prepareLoadedParameterNamespace(modern, 22, "Block"), /Block: A dimension parameter name is missing/);
  modern.constraints[0].parameterName = "d1";
  assert.throws(() => api.prepareLoadedParameterNamespace(modern, 10, "Block"), /no Value \/ Expression/);
  modern.constraints[0].expression = "12";
  modern.nextDimensionParameterIndex = "2";
  assert.equal(api.prepareLoadedParameterNamespace(modern, 22, "Block"), modern);
  modern.parameters.push({ name: "width", expression: "1" }, { name: "width", expression: "2" });
  assert.equal(api.validateParameterNamespace(modern).error.code, "DUPLICATE_IDENTIFIER");
});

test("input expression prefixes, identifier rewrites and localized errors keep their existing rules", () => {
  let english = true;
  const api = sandbox.window.ParameterNamespace.create({ currentParameterNamespace: () => null, applicationText: (ja, en) => english ? en : ja });
  assert.equal(api.expressionFromUserInput(" -1.2e+3 "), "-1.2e+3");
  assert.equal(api.expressionFromUserInput(' = "width" * 2 '), '"width" * 2');
  assert.throws(() => api.expressionFromUserInput('"width" * 2'), error => error.code === "EXPRESSION_PREFIX_REQUIRED");
  assert.throws(() => api.expressionFromUserInput("=  "), error => error.code === "EMPTY_EXPRESSION");
  assert.equal(api.rewriteExpressionInputIdentifiers('="width" * 2', new Map([["width", "height"]])), '="height" * 2');
  assert.equal(api.rewriteExpressionInputIdentifiers('"width"', new Map([["width", "height"]])), '"width"');
  assert.equal(api.parameterErrorText({ code: "EMPTY_EXPRESSION" }), "Value / Expression is empty");
  english = false;
  assert.equal(api.parameterErrorText({ code: "EMPTY_EXPRESSION" }), "値 / 数式が空です");
});

test("renaming dimension symbols rewrites dependent expressions only in the active namespace", () => {
  const first = dimension(), second = dimension();
  first.parameterName = 'd1'; first.expression = '12';
  second.parameterName = 'd2'; second.expression = '"d1" * 2';
  const current = namespace([first, second]);
  current.parameters = [{ name: 'width', expression: '"d1" + "d2"' }];
  const other = namespace([dimension()]);
  const api = create(() => current);
  assert.equal(api.renameDimension(first, 'd20'), true);
  assert.equal(first.parameterName, 'd20');
  assert.equal(second.expression, '"d20" * 2');
  assert.equal(current.parameters[0].expression, '"d20" + "d2"');
  assert.equal(current.nextDimensionParameterIndex, 21);
  assert.equal(other.constraints[0].parameterName, undefined);
  assert.throws(() => api.renameDimension(first, 'width'), error => error.code === 'DUPLICATE_IDENTIFIER');
  assert.equal(first.parameterName, 'd20');
  assert.equal(second.expression, '"d20" * 2');
});

test('dimension draft evaluation uses measured references and leaves committed expressions and targets intact', () => {
  const edited = dimension(), reference = dimension();
  edited.parameterName = 'd1'; edited.expression = '12';
  reference.parameterName = 'd2'; reference.readOnlyDimension = true;
  const current = namespace([edited, reference]);
  current.parameters = [{ name: 'width', expression: '3' }];
  const api = create(() => current);
  assert.equal(api.evaluateDimensionExpressionDraft(edited, '"width" + "d2"'), 8);
  assert.equal(edited.target, 12); assert.equal(edited.expression, '12');
  assert.equal(reference.target, 12);
  assert.equal(api.evaluateDimensionExpressionDraft(null, '"d1" * 2'), 24);
  assert.throws(() => api.evaluateDimensionExpressionDraft(edited, '"d1"'), error => error.code === 'CYCLE');
  assert.equal(edited.expression, '12');
});

test('dimension draft ranges distinguish angles and lengths and resolve the supplied or current namespace', () => {
  const distance = dimension(), a = new Line('a', new Point('a1', 0, 0), new Point('a2', 1, 0));
  const b = new Line('b', new Point('b1', 0, 0), new Point('b2', 0, 1));
  const angle = new LineAngleConstraint(a, b, Math.PI / 2);
  let current = namespace([distance]);
  current.parameters = [{ name: 'width', expression: '200' }];
  const angleScope = namespace([angle]); angleScope.parameters = [{ name: 'width', expression: '45' }];
  const api = create(() => current);
  assert.equal(api.evaluateDimensionExpressionDraft(distance, '"width"'), 200);
  assert.equal(api.evaluateDimensionExpressionDraft(angle, '"width"', angleScope), 45);
  for (const expression of ['0', '-1', '180', '181']) {
    assert.throws(() => api.evaluateDimensionExpressionDraft(angle, expression, angleScope), /Dimension value is out of range/);
  }
  current = angleScope;
  assert.equal(api.evaluateDimensionExpressionDraft(null, '"width"'), 45);
  assert.equal(angle.target, Math.PI / 2);
});

test("annotation symbols share evaluation, rename and dependency guards without changing geometry", () => {
  const driven = dimension();
  driven.parameterName = "d1"; driven.expression = '"note" * 2';
  const scope = namespace([driven]);
  const annotation = { parameterEnabled: true, parameterName: "note", expression: '"width" / 2', text: 'retained' };
  scope.parameters = [{ name: 'width', expression: '120' }];
  scope.annotations = [annotation];
  const api = create(() => scope);
  api.evaluateParameterNamespace(scope);
  assert.equal(annotation.evaluatedParameterValue, 60);
  assert.equal(driven.target, 120);
  assert.equal(driven.p2.x, 3);
  assert.deepEqual([...api.parameterDependents(scope, ['width'])], ['note']);
  api.renameDimension(annotation, 'labelValue');
  assert.equal(driven.expression, '"labelValue" * 2');
  annotation.expression = '-2';
  scope.constraints = [];
  api.evaluateParameterNamespace(scope);
  assert.equal(annotation.evaluatedParameterValue, -2);
  annotation.parameterEnabled = false;
  assert.equal(api.symbolElementsInNamespace(scope).length, 0);
});


test('symbol deletion query finds dimension and enabled annotation references while excluding removed formulas', () => {
  const d = Object.assign(dimension(), { parameterName: 'Width', expression: '12' });
  const note = { type: 'text', parameterEnabled: true, parameterName: 'Label', expression: '"Width"*2' };
  const ns = namespace([d]); ns.annotations = [note]; ns.parameters = [{ name: 'Total', expression: '"Label"+"Width"' }];
  const api = create(() => ns);
  const first = api.symbolDeletionDependents([d]);
  assert.deepEqual(Array.from(first.removedNames), ['Width']); assert.deepEqual(Array.from(first.dependents), ['Total', 'Label']);
  const together = api.symbolDeletionDependents([d, note, d]);
  assert.deepEqual(Array.from(together.removedNames), ['Width', 'Label']); assert.deepEqual(Array.from(together.dependents), ['Total']);
  assert.equal(ns.constraints[0], d); assert.equal(ns.annotations[0], note);
});

test('symbol deletion query skips ordinary annotations and unnamed objects without normalizing the namespace', () => {
  const ns = { constraints: [] }, api = create(() => ns);
  for (const items of [null, [], [{ type: 'text', parameterEnabled: false, parameterName: 'Label' }], [dimension()]]) {
    const result = api.symbolDeletionDependents(items);
    assert.equal(result.removedNames.length, 0); assert.equal(result.dependents.length, 0);
  }
  assert.equal('parameters' in ns, false);
});

test('symbol deletion query uses an explicitly supplied Block namespace instead of the current document', () => {
  const d = Object.assign(dimension(), { parameterName: 'Width', expression: '12' });
  const document = namespace([]), block = namespace([d]); block.parameters = [{ name: 'Local', expression: '"Width"+1' }];
  const api = create(() => document), result = api.symbolDeletionDependents([d], block);
  assert.deepEqual(Array.from(result.dependents), ['Local']); assert.equal(document.parameters.length, 0);
});
