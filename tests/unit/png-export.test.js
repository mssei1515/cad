const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ["src/geometry/export_region.js", "src/rendering/canvas_export.js", "src/commands/png_export_command.js", "src/persistence/document_files.js", "src/persistence/png_file.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const region = sandbox.window.ExportRegion;

test('export renderer owns crop state and capture clears it before bitmap/display restoration on success or failure', () => {
  for (const failure of [null, 'render', 'copy', 'sync']) {
    const calls = [], canvas = { width: 80, height: 60 }, viewport = { x: 10, y: 20, scale: 2 };
    let renderer;
    const drawCanvas = () => {
      calls.push('render');
      assert.equal(JSON.stringify(renderer.frame), JSON.stringify({ region: { x: 20, y: 32 }, ratio: { x: 1.5, y: 1.5 }, worldBounds: { x1: 5, y1: 6, x2: 9, y2: 9 } }));
      if (failure === 'render') throw new Error('render');
    };
    renderer = sandbox.window.CanvasExport.createRenderer({ viewport, drawCanvas,
      withGeometryReadCache: callback => { assert.equal(callback, drawCanvas); calls.push('cache'); callback(); },
      syncCanvasBitmapSize: () => { assert.equal(renderer.frame, null); assert.equal(canvas.width, 80); assert.equal(canvas.height, 60); calls.push('sync'); if (failure === 'sync') throw new Error('sync'); },
      draw: () => { assert.equal(renderer.frame, null); calls.push('display'); },
    });
    assert.equal(renderer.frame, null);
    const capture = sandbox.window.CanvasExport.create({ canvas, text: (ja, en) => en,
      render: renderer.render, restore: renderer.restore,
      createCanvas: () => ({ getContext: () => ({ drawImage(value) { assert.equal(value, canvas); assert.ok(renderer.frame); calls.push('copy'); if (failure === 'copy') throw new Error('copy'); } }) }),
    });
    if (failure) assert.throws(() => capture.capture({ x: 5, y: 6, width: 4, height: 3 }, 3), new RegExp(failure));
    else capture.capture({ x: 5, y: 6, width: 4, height: 3 }, 3);
    assert.equal(renderer.frame, null); assert.equal(canvas.width, 80); assert.equal(canvas.height, 60);
    assert.equal(calls.includes('display'), failure !== 'sync');
    assert.equal(calls.at(-1), failure === 'sync' ? 'sync' : 'display');
  }
});

test('PNG mode session restores its prior mode after clearing its pending operation and preserves foreign state', () => {
  let mode = 'line'; const calls = [];
  const pending = {
    current: null,
    replace(value) { assert.equal(this, pending); calls.push('replace'); pending.current = value; },
    clear() { assert.equal(this, pending); calls.push('clear'); pending.current = null; },
  };
  const session = sandbox.window.PngExportCommand.createModeSession({ readMode: () => mode,
    setMode: value => { calls.push(['mode', value]); mode = value; }, pendingCommandSession: pending });
  session.begin(); assert.equal(mode, 'png-export'); assert.equal(pending.current.type, 'png-export');
  assert.deepEqual(calls, [['mode', 'png-export'], 'replace']);
  calls.length = 0; session.end(); assert.deepEqual(calls, ['clear', ['mode', 'line']]); assert.equal(pending.current, null);
  session.begin(); const foreign = { type: 'distance' }; pending.current = foreign; mode = 'select'; calls.length = 0;
  session.end(); assert.equal(mode, 'select'); assert.equal(pending.current, foreign); assert.equal(calls.length, 0);
  mode = 'png-export'; session.end(); assert.equal(mode, null);
});
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
