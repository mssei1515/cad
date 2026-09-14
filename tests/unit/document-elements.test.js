const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["spline_geometry.js", "hatch_region.js", "src/document/appearance.js", "src/document/drawing_order.js", "src/document/annotations.js", "src/document/hatches.js", "src/document/reference_images.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { AnnotationData, HatchData, ReferenceImageData } = sandbox.window;

test("Annotation normalization keeps editor identity and strips obsolete leader fields from text", () => {
  const text = { type: "text", x: "12", y: NaN, text: 42, start: { x: 1, y: 2 }, geometryRef: { kind: "line" } };
  const leader = { type: "leader", text: "note", start: { x: "3", y: 4 }, geometryRef: { kind: "line", id: "L1" } };
  const result = AnnotationData.normalizeAnnotations([null, text, leader, { type: "dimension" }], "S2");
  assert.equal(result.length, 2);
  assert.equal(result[0], text);
  assert.equal(text.sketchId, "S2");
  assert.equal(text.x, 12);
  assert.equal(text.y, 0);
  assert.equal(text.text, "42");
  assert.equal("start" in text, false);
  assert.equal("geometryRef" in text, false);
  const saved = AnnotationData.serializeAnnotation(leader);
  assert.equal(saved.start.x, 3);
  assert.equal(saved.elbow, null);
  assert.notEqual(saved.geometryRef, leader.geometryRef);
  assert.equal(saved.geometryRef.id, "L1");
  assert.equal("selected" in saved, false);
});

test("reference images preserve valid objects while serialization excludes display caches", () => {
  const image = { mimeType: "IMAGE/PNG", dataUrl: "data:image/png;base64,YQ==", pixelWidth: 3000, pixelHeight: 1, scale: 0.5, opacity: 2, cache: {} };
  const normalized = ReferenceImageData.normalizeReferenceImages([image], "S2");
  assert.equal(normalized[0], image);
  assert.equal(image.opacity, 1);
  assert.equal(image.mimeType, "image/png");
  const saved = ReferenceImageData.serializeReferenceImage(image);
  assert.equal(ReferenceImageData.validSerializedReferenceImageList([saved]), true);
  assert.equal("cache" in saved, false);
  for (const invalid of [{ pixelWidth: 3001 }, { scale: 0 }, { dataUrl: "data:image/jpeg;base64,YQ==" }, { mimeType: "image/svg+xml" }]) {
    assert.equal(ReferenceImageData.normalizeReferenceImages([{ ...saved, ...invalid }]).length, 0);
    assert.equal(ReferenceImageData.validSerializedReferenceImageList([{ ...saved, ...invalid }]), false);
  }
});

test("Hatch saved data validates boundaries, appearance and duplicate IDs without editor state", () => {
  const hatch = { id: "H3", boundaryLoops: [{ role: "outer", spans: [{ source: { kind: "circle", path: ["C1"] }, fullCircle: true }] }], seed: { x: "1", y: 2 } };
  const normalized = HatchData.normalizeHatches([hatch, { boundaryLoops: [] }], "S1");
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0], hatch);
  const saved = HatchData.serializeHatch(hatch);
  assert.equal(HatchData.validSerializedHatchList([saved]), true);
  assert.equal(HatchData.validSerializedHatchList([saved, saved]), false);
  assert.equal(HatchData.validSerializedHatch({ ...saved, appearance: { ...saved.appearance, spacing: 0 } }), false);
  assert.notEqual(saved.boundaryLoops, hatch.boundaryLoops);
  assert.equal(saved.seed.x, 1);
});
