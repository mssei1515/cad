const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/spline_geometry.js", "src/geometry/hatch_region.js", "src/document/appearance.js", "src/document/drawing_order.js", "src/document/annotations.js", "src/document/hatches.js", "src/document/reference_images.js", "src/persistence/document_snapshot.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const snapshot = sandbox.window.DocumentSnapshot;
const scope = () => ({
  units: { length: "mm" }, sketches: [{ id: "ROOT", kind: "root" }, { id: "S1" }], activeSketchId: "S1",
  points: [{ id: "P1", x: 1, y: 2, fixed: false, sketchId: "S1" }], lines: [], circles: [], arcs: [], splines: [],
  constraints: [], annotations: [], hatches: [], referenceImages: [], blockDefinitions: [], blockInstances: [], geometryInstances: [],
  parameters: [{ name: "width", expression: "25", evaluatedValue: 25 }], nextDimensionParameterIndex: 2,
});

test("snapshot shares field writers while preserving local scope metadata and allocation counters", () => {
  const doc = scope(), definition = { ...scope(), id: "B1", name: "Part", revision: 3, nextHatchIndex: 9 };
  doc.blockDefinitions.push(definition);
  doc.constraints.push({ id: "D1" }, { id: "unsupported" });
  definition.constraints.push({ id: "D1" });
  const seen = [];
  const serializer = snapshot.create({
    geometryMetadata: (item) => ({ sketchId: "resolved", kind: "explicit" }),
    constraintData: (constraint, owner) => {
      seen.push(owner);
      return constraint.id === "unsupported" ? null : { type: "fixedPoint", p: "P1", sketchId: owner.activeSketchId };
    },
  });
  const data = serializer.serialize(doc, { version: 22, savedAt: "fixed-time", documentName: "Drawing", nextHatchIndex: 7 });
  assert.equal(data.version, 22);
  assert.equal(data.savedAt, "fixed-time");
  assert.equal(data.nextHatchIndex, 7);
  assert.equal(data.points[0].kind, "explicit");
  assert.equal(data.points[0].sketchId, "resolved");
  assert.equal(data.blockDefinitions[0].points[0].kind, "endpoint");
  assert.equal(data.blockDefinitions[0].points[0].sketchId, "S1");
  assert.equal(data.blockDefinitions[0].nextHatchIndex, 9);
  assert.equal(data.constraints.length, 1);
  assert.equal(data.blockDefinitions[0].constraints.length, 1);
  assert.deepEqual(seen, [definition, doc, doc]);
  assert.equal("evaluatedValue" in data.parameters[0], false);
  data.points[0].x = 100;
  data.units.length = "changed";
  assert.equal(doc.points[0].x, 1);
  assert.equal(doc.units.length, "mm");
});

test("derived instance serialization copies reference paths and retains type-specific fields", () => {
  const source = { kind: "line", path: ["BI1", "L1"] };
  const base = { id: "GI1", sketchId: "S1", sources: [source], drawingOrder: 4 };
  const mirror = snapshot.serializeGeometryInstance({ ...base, type: "mirror", axis: source });
  mirror.sources[0].path.push("changed");
  mirror.axis.path.push("changed");
  assert.equal(source.path.length, 2);
  assert.equal(mirror.drawingOrder, 4);
  const pattern = snapshot.serializeGeometryInstance({ ...base, type: "pattern", direction: source, spacing: 12, copies: 3, reversed: true });
  assert.equal(pattern.copies, 3);
  assert.equal(pattern.reversed, true);
  assert.equal("axis" in pattern, false);
  const free = snapshot.serializeGeometryInstance({ ...base, type: "free", x: 1, y: 2, rotation: 0.3, origin: { x: 3, y: 4 }, mirrorX: true, mirrorY: false });
  assert.equal(free.origin.x, 3);
  assert.equal(free.mirrorX, true);
});
