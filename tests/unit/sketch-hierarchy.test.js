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
