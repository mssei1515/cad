const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/export_region.js", "src/rendering/canvas_export.js", "src/persistence/document_files.js", "src/persistence/png_file.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const region = sandbox.window.ExportRegion;
test("drag normalizes all directions; pixel limits reject huge allocations", () => {
  assert.equal(JSON.stringify(region.fromPoints({ x: 30, y: 40 }, { x: 10, y: 20 })), '{"x":10,"y":20,"width":20,"height":20}');
  assert.equal(region.fromPoints({ x: 0, y: 0 }, { x: 0, y: 10 }), null);
  assert.equal(region.fromPoints({ x: NaN, y: 0 }, { x: 10, y: 10 }), null);
  const crop = { x: -20, y: -10, width: 300, height: 200 };
  for (const multiplier of [1, 2, 4]) {
    assert.equal(region.pixelSize(crop, multiplier).width, 300 * multiplier);
    assert.equal(region.pixelSize(crop, multiplier).height, 200 * multiplier);
  }
  assert.equal(region.pixelSize(crop, 0), null);
  assert.equal(region.pixelSize({ ...crop, width: 20000 }, 1).supported, false);
  assert.equal(region.pixelSize({ ...crop, width: 4000, height: 4000 }, 2).supported, false);
});
test("failed export drawing always restores bitmap and application paint state", () => {
  const canvas = { width: 800, height: 600 };
  let restored = 0;
  const exporter = sandbox.window.CanvasExport.create({ canvas,
    createCanvas: () => ({ getContext: () => ({}) }), background: () => "white", text: ja => ja,
    render: () => { assert.equal(canvas.width, 400); throw new Error("render failure"); },
    restore: () => { restored++; assert.equal(canvas.width, 800); assert.equal(canvas.height, 600); },
  });
  assert.throws(() => exporter.capture({ x: 10, y: 20, width: 200, height: 100 }, 2), /render failure/);
  assert.equal(restored, 1);
});
test("PNG uses its own picker, handles cancel/null blobs and aborts failed writes", async () => {
  let picked, aborted = 0, captured = 0;
  const win = { ...sandbox.window, showSaveFilePicker: async options => {
    picked = options;
    return { createWritable: async () => ({ write: async () => { throw new Error("disk full"); }, abort: async () => { aborted++; } }) };
  } };
  const png = sandbox.window.PngFile.create({ window: win, document: {}, capture: () => { captured++; return { toBlob: callback => callback({ type: "image/png" }) }; }, documentName: () => "drawing", text: ja => ja });
  await assert.rejects(png.save({}, 2), /disk full/);
  assert.equal(aborted, 1); assert.equal(picked.suggestedName, "drawing.png");
  assert.equal(picked.types[0].accept["image/png"][0], ".png");
  win.showSaveFilePicker = async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); };
  await assert.rejects(png.save({}, 2), { name: "AbortError" }); assert.equal(captured, 1);
  win.showSaveFilePicker = async () => ({});
  const empty = sandbox.window.PngFile.create({ window: win, document: {}, capture: () => ({ toBlob: cb => cb(null) }), documentName: () => "drawing", text: (ja, en) => en });
  await assert.rejects(empty.save({}, 2), /Could not create/);
});
