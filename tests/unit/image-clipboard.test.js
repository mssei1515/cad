const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/image_clipboard.js'), 'utf8'), sandbox);
function fixture(clipboard = {}) {
  const calls = [];
  const api = sandbox.window.ImageClipboard.create({ window: { navigator: { clipboard }, File: class { constructor(data, name, options) { Object.assign(this, { data, name }, options); } } },
    importFile: async file => { calls.push(['image', file]); return true; },
    pasteGeometry: () => { calls.push(['geometry']); return true; }, copyGeometry: options => { calls.push(['copy', options.cut]); return true; },
    isGeometryMode: () => true, isTextEditingTarget: target => Boolean(target?.text),
    setHint: text => calls.push(['hint', text]), applicationText: (_ja, en) => en,
  });
  return { api, calls, event: (files, target = {}) => ({ target, clipboardData: { files, getData: () => '' }, preventDefault: () => calls.push(['prevent']) }) };
}
test('native paste imports one supported image, skips text fields and rejects unsupported images', () => {
  const f = fixture(), image = { type: 'image/png' };
  f.api.paste(f.event([image], { text: true })); assert.deepEqual(f.calls, []);
  f.api.paste(f.event([image, { type: 'image/jpeg' }])); assert.deepEqual(f.calls, [['prevent'], ['image', image]]);
  f.calls.length = 0; f.api.paste(f.event([{ type: 'image/gif' }]));
  assert.equal(f.calls[1][0], 'hint'); assert.equal(f.calls.some(call => call[0] === 'geometry'), false);
});
test('non-image paste retains internal geometry and copy marks native clipboard content', () => {
  const f = fixture(); f.api.paste(f.event([])); assert.deepEqual(f.calls, [['prevent'], ['geometry']]);
  let marker; f.calls.length = 0;
  f.api.copy({ ...f.event([]), type: 'cut', clipboardData: { setData: (_type, value) => { marker = value; } } });
  assert.deepEqual(f.calls, [['copy', true], ['prevent']]);
  f.calls.length = 0;
  f.api.paste({ ...f.event([{ type: 'image/png' }]), clipboardData: { getData: () => marker } });
  assert.deepEqual(f.calls, [['prevent'], ['geometry']]);
});
test('menu paste reads images and falls back to internal selection when clipboard access is denied', async () => {
  const f = fixture({ read: async () => [{ types: ['text/plain', 'image/png'], getType: async () => 'blob' }] });
  assert.equal(await f.api.pasteFromMenu(), true); assert.equal(f.calls[0][0], 'image'); assert.equal(f.calls[0][1].type, 'image/png');
  const denied = fixture({ read: async () => { throw new Error('denied'); } });
  assert.equal(await denied.api.pasteFromMenu(), true); assert.deepEqual(denied.calls, [['geometry']]);
});
