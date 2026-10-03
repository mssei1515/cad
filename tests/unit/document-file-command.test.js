const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['persistence/document_files.js', 'commands/document_file_command.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
function fixture() {
  const session = sandbox.window.DocumentFiles.create();
  const state = { data: { documentName: 'Drawing', points: [] }, block: false, choice: 'discard', imported: [], checkpoints: [], hints: [] };
  session.markCheckpoint('new', state.data);
  const browser = { location: { search: '' }, URLSearchParams };
  const command = sandbox.window.DocumentFileCommand.create({ window: browser, document: { getElementById: () => null }, fileSession: session,
    choiceDialog: { show: async () => state.choice }, applicationText: (ja, en) => en,
    isEditingBlock: () => state.block, getDocumentName: () => state.data.documentName,
    serializeModel: () => state.data, importFileData: async (file, options) => { state.imported.push([file, options]); return state.accept !== false; },
    markDocumentFileCheckpoint: (kind, data) => { state.checkpoints.push([kind, data]); session.markCheckpoint(kind, data); },
    updateDocumentNameUI() {}, setHint: (...args) => state.hints.push(args), log() {},
  });
  return { session, state, browser, command };
}
test('save captures written data and excludes overlapping saves until completion', async () => {
  const f = fixture(); let release; let written;
  f.browser.showSaveFilePicker = async () => ({ name: 'saved.jot2d', createWritable: async () => ({ write: async content => { written = content; await new Promise(resolve => { release = resolve; }); }, close: async () => {} }) });
  const saving = f.command.save();
  while (!release) await Promise.resolve();
  assert.equal(await f.command.save(), false);
  f.state.data = { documentName: 'Changed', points: [] }; release();
  assert.equal(await saving, true); assert.equal(f.session.busy, false);
  assert.equal(f.state.checkpoints[0][1].documentName, JSON.parse(written).documentName);
  assert.equal(f.session.matchesCheckpoint(f.state.data), false);
});
test('block editing begun while the picker is open prevents writing', async () => {
  const f = fixture(); let writes = 0;
  f.browser.showSaveFilePicker = async () => { f.state.block = true; return { createWritable: () => { writes++; } }; };
  assert.equal(await f.command.save(), false); assert.equal(writes, 0);
  assert.equal(f.session.busy, false); assert.equal(f.state.checkpoints.length, 0);
});
test('failed import preserves the save target and releases native open exclusion', async () => {
  const f = fixture(); const original = { name: 'original.jot2d' }; f.session.setHandle(original);
  const file = { name: 'new.jot2d' }; f.state.accept = false;
  f.browser.showOpenFilePicker = async () => [{ getFile: async () => file }];
  assert.equal(await f.command.open(), false);
  assert.equal(f.state.imported[0][0], file); assert.equal(f.session.handle, original); assert.equal(f.session.busy, false);
});
test('canceling replacement from file input clears input but preserves target and model', async () => {
  const f = fixture(); f.state.data = { documentName: 'Edited' }; f.state.choice = null;
  const input = { value: 'path', files: [{ name: 'new.jot2d' }] };
  await f.command.fileInputChanged({ currentTarget: input });
  assert.equal(input.value, ''); assert.equal(f.state.imported.length, 0); assert.equal(f.session.busy, false);
});
