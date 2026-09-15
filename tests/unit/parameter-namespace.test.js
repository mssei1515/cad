const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const sandbox = { window: {} };
vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, "index.html"), "utf8").match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith("src/"))) {
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
