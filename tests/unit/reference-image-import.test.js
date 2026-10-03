const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['document/reference_images.js', 'persistence/reference_image_import.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
function fixture() {
  const state = { width: 600, height: 300, reads: 0, canvases: 0 };
  const browser = { FileReader: class {
    constructor() { this.listeners = {}; }
    addEventListener(key, fn) { this.listeners[key] = fn; }
    readAsDataURL() { state.reads++; this.result = state.dataUrl ?? 'data:application/octet-stream;base64,AAAA'; this.listeners[state.readError ? 'error' : 'load'](); }
  }, Image: class {
    constructor() { this.listeners = {}; this.naturalWidth = state.width; this.naturalHeight = state.height; }
    addEventListener(key, fn) { this.listeners[key] = fn; }
    set src(value) { state.decoded = value; this.listeners[state.decodeError ? 'error' : 'load'](); }
  } };
  const document = { createElement() { state.canvases++; return { getContext: () => ({ drawImage: (...args) => { state.draw = args.slice(1); } }), toDataURL: (mime, quality) => { state.output = [mime, quality]; return 'resized-data'; } }; } };
  return { state, prepare: sandbox.window.ReferenceImageImport.create({ window: browser, document, applicationText: (ja, en) => en }).prepare };
}
test('supported mime or extension fallback preserves small original image data', async () => {
  const f = fixture(); const result = await f.prepare({ name: 'photo.JPG', type: '' });
  assert.equal(result.mimeType, 'image/jpeg'); assert.equal(result.dataUrl, 'data:image/jpeg;base64,AAAA');
  assert.equal(result.resized, false); assert.equal(result.pixelWidth, 600); assert.equal(f.state.canvases, 0);
  assert.equal((await f.prepare({ name: 'photo.jpg', type: 'image/webp' })).mimeType, 'image/webp');
});
test('large image is reduced proportionally with the existing encoding quality', async () => {
  const f = fixture(); f.state.width = 8000; f.state.height = 4000;
  const result = await f.prepare({ name: 'large.png' });
  assert.equal(result.pixelWidth, 3000); assert.equal(result.pixelHeight, 1500); assert.equal(result.resized, true);
  assert.deepEqual(f.state.draw, [0, 0, 3000, 1500]); assert.deepEqual(f.state.output, ['image/png', 0.92]);
});
test('unsupported format, read failure, malformed data and decode failure reject preparation', async () => {
  const f = fixture(); await assert.rejects(f.prepare({ name: 'bad.svg' }), /Select a PNG/); assert.equal(f.state.reads, 0);
  f.state.readError = true; await assert.rejects(f.prepare({ name: 'image.png' }), /could not be read/);
  f.state.readError = false; f.state.dataUrl = 'bad'; await assert.rejects(f.prepare({ name: 'image.png' }), /Invalid image data/);
  delete f.state.dataUrl; f.state.decodeError = true; await assert.rejects(f.prepare({ name: 'image.png' }), /could not be decoded/);
});
