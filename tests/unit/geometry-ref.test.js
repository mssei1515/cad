const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadGeometryRef() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../geometry_ref.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "geometry_ref.js" });
  return sandbox.window.GeometryRef;
}

const geometryRef = loadGeometryRef();

test("direct geometry references preserve kind and canonical id", () => {
  const ref = geometryRef.create("line", ["L1"]);
  assert.equal(ref.kind, "line");
  assert.deepEqual(Array.from(ref.path), ["L1"]);
  assert.equal(geometryRef.id(ref), "L1");
  assert.equal(geometryRef.key(ref), "line:L1");
  assert.equal(geometryRef.key(geometryRef.parseId("line", "L1")), "line:L1");
});

test("nested projection references round trip through ids and typed keys", () => {
  const ref = geometryRef.parseKey("line:BI1@BI2@L1");
  assert.equal(ref.kind, "line");
  assert.deepEqual(Array.from(ref.path), ["BI1", "BI2", "L1"]);
  assert.equal(geometryRef.id(ref), "BI1@BI2@L1");
  assert.equal(geometryRef.key(ref), "line:BI1@BI2@L1");
  assert.equal(geometryRef.key(geometryRef.create("line", "BI1@BI2@L1")), "line:BI1@BI2@L1");
});

test("reference equality compares both kind and every path segment", () => {
  const ref = geometryRef.create("arc", ["BI1", "A1"]);
  assert.equal(geometryRef.equals(ref, geometryRef.parseKey("arc:BI1@A1")), true);
  assert.equal(geometryRef.equals(ref, geometryRef.parseKey("circle:BI1@A1")), false);
  assert.equal(geometryRef.equals(ref, geometryRef.parseKey("arc:BI2@A1")), false);
  assert.equal(geometryRef.equals(ref, null), false);
});

test("projection ancestry distinguishes owner, nested instances, and local geometry", () => {
  const nested = geometryRef.parseKey("point:BI1@BI2@BI3@P1");
  assert.deepEqual(Array.from(geometryRef.ancestorInstanceIds(nested)), ["BI1", "BI2", "BI3"]);
  assert.equal(geometryRef.ownerInstanceId(nested), "BI1");
  assert.equal(geometryRef.localElementId(nested), "P1");

  const direct = geometryRef.parseKey("point:P1");
  assert.deepEqual(Array.from(geometryRef.ancestorInstanceIds(direct)), []);
  assert.equal(geometryRef.ownerInstanceId(direct), null);
  assert.equal(geometryRef.localElementId(direct), "P1");
});

test("invalid references return null and valid values are immutable", () => {
  assert.equal(geometryRef.create("spline", ["S1"]), null);
  assert.equal(geometryRef.create("line", []), null);
  assert.equal(geometryRef.create("line", ["BI1", "", "L1"]), null);
  assert.equal(geometryRef.parseId("line", ""), null);
  assert.equal(geometryRef.parseId("line", "BI1@@L1"), null);
  assert.equal(geometryRef.parseKey("line"), null);
  assert.equal(geometryRef.parseKey("mesh:M1"), null);

  const ref = geometryRef.create("circle", ["BI1", "C1"]);
  assert.equal(Object.isFrozen(ref), true);
  assert.equal(Object.isFrozen(ref.path), true);
});

test("resolver delegates valid canonical references and rejects invalid inputs", () => {
  const resolved = { id: "BI1@BI2@L1" };
  const calls = [];
  const ref = geometryRef.parseKey("line:BI1@BI2@L1");

  assert.equal(geometryRef.resolve(ref, (kind, id) => {
    calls.push({ kind, id });
    return resolved;
  }), resolved);
  assert.deepEqual(calls, [{ kind: "line", id: "BI1@BI2@L1" }]);

  assert.equal(geometryRef.resolve(ref, () => undefined), null);
  assert.equal(geometryRef.resolve(ref, null), null);
  assert.equal(geometryRef.resolve({ kind: "line", path: [""] }, () => {
    throw new Error("invalid references must not reach the lookup");
  }), null);
});
