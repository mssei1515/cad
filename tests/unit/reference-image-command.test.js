const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: { ReferenceImageData: { REFERENCE_IMAGE_MAX_SIDE_PX: 3000 } } }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/reference_image_command.js'), 'utf8'), sandbox);
function fixture() {
  const state = { scope: { referenceImages: [] }, sketch: 'S1', allowed: true, seq: 0, calls: [], prepared: { dataUrl: 'data', mimeType: 'image/png', pixelWidth: 400, pixelHeight: 200, resized: false } };
  const record = name => (...args) => state.calls.push([name, ...args]);
  const command = sandbox.window.ReferenceImageCommand.create({
    referenceImageImport: { prepare: async () => { if (state.error) throw new Error('decode'); if (state.hold) await new Promise(resolve => { state.release = resolve; }); return state.prepared; } },
    canvas: { getBoundingClientRect: () => ({ width: 1000, height: 600 }) }, viewport: { scale: 2 },
    screenToWorld: point => ({ x: point.x / 2, y: point.y / 2 }), currentScope: () => state.scope, activeSketchId: () => state.sketch,
    nextId: () => 'IMG' + (++state.seq), canCreateInActiveSketch: () => state.allowed,
    clearSelection: record('clear'), canvasSelection: { set: record('select') }, updateUI: record('ui'), draw: record('draw'),
    recordHistory: record('history'), setHint: record('hint'), applicationText: (ja, en) => en,
  }); return { state, command };
}
test('image placement uses current viewport and scope after preparation, then selects and records it', async () => {
  const f = fixture(); const original = f.state.scope; f.state.hold = true;
  const importing = f.command.importFile({ name: 'drawing.png' });
  f.state.scope = { referenceImages: [] }; f.state.sketch = 'S2'; f.state.release();
  assert.equal(await importing, true); assert.equal(original.referenceImages.length, 0);
  const item = f.state.scope.referenceImages[0];
  assert.equal(item.sketchId, 'S2'); assert.equal(item.id, 'IMG1'); assert.equal(item.name, 'drawing');
  assert.equal(item.x, 250); assert.equal(item.y, 150); assert.equal(item.scale, 0.85);
  assert.equal(item.opacity, 0.5); assert.equal(item.visible, true); assert.equal(item.locked, false);
  assert.equal(f.state.calls[1][2][0], item);
  assert.deepEqual(f.state.calls.map(call => call[0]), ['clear', 'select', 'ui', 'draw', 'history', 'hint']);
});
test('missing file, root scope and preparation failure leave geometry and IDs untouched', async () => {
  const f = fixture(); assert.equal(await f.command.importFile(null), false);
  f.state.allowed = false; assert.equal(await f.command.importFile({ name: 'image.png' }), false);
  f.state.allowed = true; f.state.error = true; assert.equal(await f.command.importFile({ name: 'image.png' }), false);
  assert.equal(f.state.scope.referenceImages.length, 0); assert.equal(f.state.seq, 0);
  assert.equal(f.state.calls.some(call => call[0] === 'history'), false);
});
