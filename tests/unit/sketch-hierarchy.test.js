const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/document/appearance.js", "src/document/sketch_hierarchy.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox);
}
const hierarchy = sandbox.window.SketchHierarchy;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Sketch appearance copy normalizes four layers independently without mutating the source", () => {
  const source = Object.freeze({ id: "S2", name: "Copied", parentSketchId: "S1", visible: false, locked: true,
    appearance: Object.freeze({ color: "#123456", lineWidth: 100 }),
    constructionAppearance: Object.freeze({ color: "#654321", lineWidth: "2" }),
    dimensionAppearance: Object.freeze({ prefix: "  D ", precision: "2", dimensionTextHeight: "4" }),
    leaderAppearance: Object.freeze({ textHeight: "5", frameVisible: true }) });
  const before = JSON.stringify(source), first = hierarchy.copyWithNormalizedAppearance(source), second = hierarchy.copyWithNormalizedAppearance(source);
  assert.notEqual(first, source); assert.equal(first.appearance.lineWidth, 10); assert.equal(first.constructionAppearance.lineWidth, 2);
  assert.equal(first.dimensionAppearance.precision, 2); assert.equal(first.dimensionAppearance.dimensionTextHeight, 4);
  assert.equal(first.dimensionAppearance.prefix, "  D "); assert.equal(first.leaderAppearance.textHeight, 5); assert.equal(first.leaderAppearance.frameVisible, true);
  for (const key of ["appearance", "constructionAppearance", "dimensionAppearance", "leaderAppearance"]) {
    assert.notEqual(first[key], source[key]); assert.notEqual(first[key], second[key]);
  }
  first.appearance.color = "#abcdef"; first.dimensionAppearance.prefix = "changed";
  assert.equal(second.appearance.color, "#123456"); assert.equal(second.dimensionAppearance.prefix, "  D ");
  assert.equal(JSON.stringify(source), before); assert.equal(first.id, "S2"); assert.equal(first.parentSketchId, "S1");
  assert.equal(first.visible, false); assert.equal(first.locked, true);
});

test("Sketch appearance copy keeps opaque fields and references and does not apply hierarchy repair", () => {
  const metadata = Object.freeze({ note: "shared" }), children = Object.freeze(["child"]);
  const source = { id: 42, name: "Root name", kind: "root", parentSketchId: "missing", metadata, children, customFlag: false };
  const copy = hierarchy.copyWithNormalizedAppearance(source);
  assert.equal(copy.metadata, metadata); assert.equal(copy.children, children); assert.equal(copy.id, 42);
  assert.equal(copy.name, "Root name"); assert.equal(copy.parentSketchId, "missing"); assert.equal(copy.customFlag, false);
  assert.equal(Object.hasOwn(source, "appearance"), false);
  assert.deepEqual(plain(copy.appearance), {}); assert.deepEqual(plain(copy.constructionAppearance), {});
  assert.deepEqual(plain(copy.dimensionAppearance), {}); assert.deepEqual(plain(copy.leaderAppearance), {});
});

test("empty Sketch appearance copies retain inheritance and avoid schema or ID defaults", () => {
  for (const source of [null, undefined, {}, { appearance: null, constructionAppearance: null, dimensionAppearance: null, leaderAppearance: null }]) {
    const copy = hierarchy.copyWithNormalizedAppearance(source);
    assert.deepEqual(Object.keys(copy).sort(), ["appearance", "constructionAppearance", "dimensionAppearance", "leaderAppearance"]);
    for (const value of Object.values(copy)) assert.deepEqual(plain(value), {});
    assert.equal(Object.hasOwn(copy, "id"), false);
  }
});

test("runtime normalization preserves identity and does not create a drawable Sketch", () => {
  const root = { id: "old", kind: "root", name: "Custom" };
  const scope = { sketches: [root, { id: "ROOT", kind: "root" }], activeSketchId: "missing" };
  hierarchy.ensure(scope);
  assert.equal(scope.sketches.length, 1);
  assert.equal(scope.sketches[0], root);
  assert.equal(root.id, "ROOT");
  assert.equal(root.name, "Custom");
  assert.equal(scope.activeSketchId, "ROOT");
  const child = { id: "S2", parentSketchId: "S2", visible: false };
  scope.sketches.push(child);
  hierarchy.ensure(scope);
  assert.equal(scope.sketches[1], child);
  assert.equal(child.parentSketchId, "ROOT");
  assert.equal(child.appearance.visible, false);
});

test("file restoration supplies a drawable fallback and keeps Document and Block root naming policies", () => {
  const items = [{ id: "legacy", kind: "root", name: "Custom", dimensionAppearance: { dimensionTextHeight: 10 } }];
  const before = JSON.stringify(items);
  const options = { dimensionAppearanceLoader: (value) => sandbox.window.Appearance.loadedDimensionAppearance(value, 1) };
  const doc = hierarchy.decode(items, options);
  const block = hierarchy.decode(items, { ...options, definition: true });
  assert.equal(doc.sketches[0].name, "Custom");
  assert.equal(block.sketches[0].name, "Root Sketch");
  assert.equal(doc.sketches[0].dimensionAppearance.dimensionTextHeight, 10 / (96 / 25.4));
  assert.deepEqual(plain(doc.sketches.map((s) => s.id)), ["ROOT", "S1"]);
  for (const id of [null, "ROOT", "unknown"]) assert.equal(doc.normalizeId(id), "S1");
  assert.equal(JSON.stringify(items), before);
  doc.sketches[1].name = "changed";
  assert.equal(block.sketches[1].name, "Sketch-1");
});

test("hierarchy traversal keeps sibling order, drawable ancestors and tree branch segments", () => {
  const { sketches } = hierarchy.decode([
    { id: "A" }, { id: "B", parentSketchId: "A" },
    { id: "C", parentSketchId: "B" }, { id: "D" },
  ]);
  assert.deepEqual(plain(hierarchy.descendantSketchIds(sketches, "A")), ["B", "C"]);
  assert.deepEqual(plain(hierarchy.ancestorSketchIds(sketches, "C")), ["B", "A"]);
  assert.deepEqual(plain(hierarchy.referenceSourceSketchIds(sketches, "C")), ["A", "B"]);
  assert.equal(hierarchy.isReferenceSourceSketchId(sketches, "ROOT", "C"), false);
  assert.equal(hierarchy.isReferenceSourceSketchId(sketches, "D", "C"), false);
  assert.equal(hierarchy.wouldCreateSketchCycle(sketches, "A", "C"), true);
  assert.equal(hierarchy.wouldCreateSketchCycle(sketches, "C", "D"), false);
  assert.equal(hierarchy.sketchDepth(sketches, hierarchy.sketchById(sketches, "C")), 3);
  assert.deepEqual(plain(hierarchy.orderedSketches(sketches).map((s) => s.id)), ["ROOT", "A", "B", "C", "D"]);
  const rows = hierarchy.sketchTreeRows(sketches);
  assert.deepEqual(plain(rows.map((r) => r.segments)), [[], ["blank", "tee"], ["blank", "pipe", "elbow"], ["blank", "pipe", "blank", "elbow"], ["blank", "elbow"]]);
  assert.equal(rows[1].sketch, sketches[1]);
  assert.equal(rows[1].hasChildren, true);
  const other = hierarchy.decode([{ id: "C" }]);
  assert.deepEqual(plain(hierarchy.ancestorSketchIds(other.sketches, "C")), []);
});
