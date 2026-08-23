const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadParameterEngine() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../parameter_engine.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "parameter_engine.js" });
  return sandbox.window.ParameterEngine;
}

const engine = loadParameterEngine();

test("evaluates precedence, parentheses, unary operators, and scientific notation", () => {
  assert.equal(engine.evaluate("2 + 3 * 4"), 14);
  assert.equal(engine.evaluate("(2 + 3) * 4"), 20);
  assert.equal(engine.evaluate("-2 + +5"), 3);
  assert.equal(engine.evaluate("1e2 / 2.5e1"), 4);
});

test("evaluates a case-sensitive dependency graph", () => {
  const result = engine.evaluateDefinitions([
    { name: "width", expression: "100" },
    { name: "Width", expression: "20" },
    { name: "height", expression: "width / 2 + Width" },
    { name: "d1", expression: "height + measured", kind: "dimension" },
  ], new Map([["measured", 5]]));
  assert.equal(result.values.get("width"), 100);
  assert.equal(result.values.get("height"), 70);
  assert.equal(result.values.get("d1"), 75);
});

test("rejects invalid names, reserved parameter names, duplicates, unknowns, and cycles", () => {
  assert.throws(() => engine.validateIdentifier("1width"), (error) => error.code === "INVALID_IDENTIFIER");
  assert.throws(() => engine.validateIdentifier("d12"), (error) => error.code === "RESERVED_IDENTIFIER");
  assert.equal(engine.validateIdentifier("d12", { dimension: true }), "d12");
  assert.throws(() => engine.evaluateDefinitions([{ name: "a", expression: "1" }, { name: "a", expression: "2" }]), (error) => error.code === "DUPLICATE_IDENTIFIER");
  assert.throws(() => engine.evaluateDefinitions([{ name: "a", expression: "missing" }]), (error) => error.code === "UNKNOWN_IDENTIFIER");
  assert.throws(() => engine.evaluateDefinitions([{ name: "a", expression: "a + 1" }]), (error) => error.code === "CYCLE");
  assert.throws(() => engine.evaluateDefinitions([{ name: "a", expression: "b" }, { name: "b", expression: "a" }]), (error) => error.code === "CYCLE");
  assert.throws(() => engine.evaluate("1 / 0"), (error) => error.code === "DIVISION_BY_ZERO");
});

test("rejects empty, malformed, and non-finite expressions", () => {
  assert.throws(() => engine.evaluate(""), (error) => error.code === "EMPTY_EXPRESSION");
  assert.throws(() => engine.evaluate("(1 + 2"), (error) => error.code === "EXPECTED_PAREN");
  assert.throws(() => engine.evaluate("1 + * 2"), (error) => error.code === "EXPECTED_VALUE");
  assert.throws(() => engine.evaluate("1e999"), (error) => error.code === "NON_FINITE");
});

test("rewrites identifier tokens without changing substrings or whitespace", () => {
  assert.equal(engine.rewriteIdentifiers("width + width2 + ( width )", { width: "span" }), "span + width2 + ( span )");
});
