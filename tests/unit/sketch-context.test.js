const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/document/appearance.js", "src/document/sketch_hierarchy.js", "src/editing/workspace.js", "src/editing/sketch_context.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Circle, Spline } = sandbox.window.GeometrySolver;
const create = sandbox.window.SketchContext.create;
const scope = name => ({ sketches: [{ id: "S1", name, parentSketchId: "ROOT" }], activeSketchId: "S1" });

test("Sketch context follows explicit scope changes even when Document and Block reuse IDs", () => {
  const document = scope("Document Sketch"), block = scope("Block Sketch");
  const workspace = sandbox.window.EditingWorkspace.create(document);
  const context = create({ currentScope: workspace.current, constraintGraphNodes: () => [] });
  assert.equal(context.activeSketch().name, "Document Sketch");
  const before = JSON.stringify(document);
  workspace.activate(block);
  assert.equal(context.sketchName("S1"), "Block Sketch");
  assert.equal(context.activeSketch(), block.sketches[1]);
  assert.equal(JSON.stringify(document), before);
  workspace.activate(document);
  assert.equal(context.activeSketch().name, "Document Sketch");
});

test("membership keeps explicit ownership and falls back through constituent geometry", () => {
  const document = scope("Sketch");
  const context = create({ currentScope: () => document, constraintGraphNodes: () => [] });
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0), r = new Point("P3", 10, 10);
  p.sketchId = "S2";
  q.sketchId = "S3";
  const line = new Line("L1", p, q);
  assert.equal(context.elementSketchId(line), "S2");
  line.sketchId = "S4";
  assert.equal(context.elementSketchId(line), "S4");
  assert.equal(context.elementSketchId(new Circle("C1", q, 3)), "S3");
  assert.equal(context.elementSketchId(new Spline("SP1", [r, p, q])), "S2");
  assert.equal(context.elementSketchId(null), "S1");
  context.assignSketchId(r, "ROOT");
  assert.equal(r.sketchId, "S1");
  assert.equal(context.sameSketchElements([r, null], "S1"), true);
});

test("active, ancestor reference, descendant and unrelated Sketches remain distinct", () => {
  const document = scope("Parent");
  document.sketches.push({ id: "S2", name: "Active", parentSketchId: "S1" }, { id: "S3", name: "Sibling", parentSketchId: "ROOT" }, { id: "S4", name: "Child", parentSketchId: "S2" });
  document.activeSketchId = "S2";
  const context = create({ currentScope: () => document, constraintGraphNodes: () => [] });
  assert.equal(context.sketchRelationToActive("S2"), "active");
  assert.equal(context.sketchRelationToActive("S1"), "reference");
  assert.equal(context.sketchRelationToActive("S4"), "descendant");
  assert.equal(context.sketchRelationToActive("S3"), "inactive");
  assert.equal(context.wouldCreateSketchCycle("S1", "S4"), true);
  assert.equal(context.isEditableSketchId("S1"), false);
  assert.equal(context.isEditableSketchId("S2"), true);
});

test("constraint ownership and editing targets distinguish intrinsic source dependencies", () => {
  const document = scope("Sketch");
  const local = { sketchId: "S1" }, source = { sketchId: "SOURCE" };
  const context = create({
    currentScope: () => document,
    constraintGraphNodes: (_constraint, options) => options?.includeIntrinsicDependencies === false ? [local] : [local, source],
  });
  assert.equal(context.constraintSketchId({}), "S1");
  assert.equal(context.constraintSketchId({ sketchId: "EXPLICIT" }), "EXPLICIT");
  assert.equal(context.constraintTargetsAreActive({}), true);
  assert.equal(context.constraintReferencesSketch({}, "SOURCE"), true);
});
