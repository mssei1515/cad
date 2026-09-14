const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/document/appearance.js"), "utf8"), sandbox);
const appearance = sandbox.window.Appearance;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("partial appearance preserves inheritance and full defaults are independent values", () => {
  for (const normalize of [appearance.normalizeAppearance, appearance.normalizeConstructionAppearance, appearance.normalizeDimensionAppearance]) {
    assert.deepEqual(plain(normalize(null)), {});
    assert.deepEqual(plain(normalize([])), {});
    const full = normalize({}, { partial: false });
    full.color = "#abcdef";
    assert.notEqual(normalize({}, { partial: false }).color, full.color);
  }
  assert.deepEqual(plain(appearance.normalizeAppearance({ visible: false, color: "#ABCDEF", lineWidthPx: 99, lineType: "dashdotdot", endpointMarkers: false })), {
    visible: false, color: "#abcdef", lineWidth: 10, lineType: "dashdotdot", endpointMarkers: false,
  });
  assert.deepEqual(plain(appearance.normalizeAppearance({ color: "red", lineType: "unknown", lineWidth: -1 })), { lineWidth: 0.5 });
});

test("dimension appearance keeps precision, tolerance and numeric limits", () => {
  assert.deepEqual(plain(appearance.normalizeDimensionAppearance({
    precision: 12, toleranceUpper: "", toleranceLower: "-0.02", prefix: "R", suffix: " mm",
    terminatorType: "dot", terminatorSize: 0, arrowheadAngle: 200, dimensionTextGap: -4,
    extensionLineOvershoot: "", extensionLineOriginGap: null,
  })), {
    precision: 10, prefix: "R", suffix: " mm", toleranceUpper: null, toleranceLower: -0.02,
    terminatorType: "dot", terminatorSize: 0.1, arrowheadAngle: 179, dimensionTextGap: 0,
  });
  assert.equal(appearance.normalizeDimensionAppearance({ precision: "" }).precision, null);
});

test("legacy dimension lengths migrate once without modifying their source", () => {
  const old = Object.freeze({ arrowheadLength: 12, dimensionTextHeight: 18, extensionLineOriginGap: 6, arrows: false, extensionLines: false });
  const migrated = appearance.loadedDimensionAppearance(old, 11);
  assert.equal(migrated.terminatorSize, 12 / (96 / 25.4));
  assert.equal(migrated.dimensionTextHeight, 18 / (96 / 25.4));
  assert.equal(migrated.extensionLineOriginGap, 6 / (96 / 25.4));
  assert.equal("arrows" in migrated, false);
  assert.equal("arrowheadLength" in migrated, false);
  assert.deepEqual(plain(appearance.loadedDimensionAppearance(migrated, 22)), plain(migrated));
  assert.equal(appearance.loadedDimensionAppearance({ terminatorSize: 9, arrowheadLength: 12 }, 12).terminatorSize, 9);
});

test("annotation legacy font style and hatch defaults preserve their separate policies", () => {
  const style = appearance.normalizeAnnotationStyle(Object.freeze({ fontSize: 19.2, fontWeight: "600", fontStyle: "italic", textAlign: "right", terminatorType: "none" }));
  assert.equal(style.textHeight, 19.2 / (96 / 25.4));
  assert.equal(style.bold, true);
  assert.equal(style.italic, true);
  assert.equal(style.terminatorType, "none");
  assert.deepEqual(plain(appearance.normalizeHatchAppearance({})), plain(appearance.DEFAULT_HATCH_APPEARANCE));
  const hatch = appearance.normalizeHatchAppearance({ opacity: -1, spacing: 0, angle: 5000, patternType: "bad" });
  assert.equal(hatch.opacity, 0);
  assert.equal(hatch.spacing, 0.25);
  assert.equal(hatch.angle, 3600);
  assert.equal(hatch.patternType, "parallel");
});

test("block appearance resolves explicit layers and inner-to-outer overrides without mutation", () => {
  const defaults = Object.freeze({ color: "#111111", lineWidth: 2 });
  const sketch = Object.freeze({ color: "#222222", lineType: "dotted" });
  const definition = Object.freeze({ lineWidth: 3 });
  const local = Object.freeze({ color: "#333333" });
  const result = appearance.resolveGeometryAppearance({
    defaults, sketchAppearance: sketch, definitionSketchAppearance: definition, elementAppearance: local,
    overrides: [Object.freeze({ color: "#444444", lineWidth: 4 }), Object.freeze({ color: "#555555" })],
  });
  assert.deepEqual(plain(result), { visible: true, color: "#555555", lineWidth: 4, lineType: "dotted" });
  assert.equal(defaults.lineWidth, 2);
  assert.equal(local.color, "#333333");
});

test("construction, derived and dimension layers do not inherit unrelated appearance", () => {
  const construction = appearance.resolveGeometryAppearance({ construction: true, sketchAppearance: { endpointMarkers: false } });
  assert.equal(construction.lineType, "dashdot");
  assert.equal(construction.lineWidth, 1);
  assert.equal(construction.endpointMarkers, false);
  assert.equal(construction.endpointOverhang, true);
  const derived = appearance.resolveGeometryAppearance({ sketchAppearance: { color: "#123456" }, overrides: [{ lineWidth: 4 }] });
  assert.equal(derived.color, "#123456");
  assert.equal(derived.lineWidth, 4);
  const dimension = appearance.resolveDimensionAppearance({ precision: 3, color: "#123456" }, { prefix: "R" }, { precision: 0 });
  assert.equal(dimension.precision, 0);
  assert.equal(dimension.prefix, "R");
  assert.equal(dimension.color, "#123456");
});
