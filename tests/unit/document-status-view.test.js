const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['persistence/document_files.js', 'ui/document_status_view.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
function fixture() {
  const data = { documentName: 'Drawing', points: [] }; const state = { snapshot: JSON.stringify(data), block: false };
  const session = sandbox.window.DocumentFiles.create(); session.markCheckpoint('new', data);
  const status = { dataset: {} }; const document = { getElementById: () => status };
  const view = sandbox.window.DocumentStatusView.create({ document, applicationText: (ja, en) => en, fileSession: session,
    getDocumentName: () => data.documentName, currentSnapshot: () => state.snapshot, isEditingBlock: () => state.block });
  return { data, state, session, status, document, view };
}
test('save status follows committed history and preserves save/download distinction', () => {
  const f = fixture(); f.view.render(); assert.equal(f.status.textContent, 'Drawing · New document');
  f.state.snapshot = JSON.stringify({ ...f.data, points: [1] }); f.view.render();
  assert.equal(f.status.dataset.dirty, 'true'); assert.equal(f.document.title, '● Drawing - Jot2D');
  f.session.markCheckpoint('download', JSON.parse(f.state.snapshot)); f.view.render();
  assert.equal(f.status.textContent, 'Drawing · Download started');
  assert.equal(f.document.title, 'Drawing - Jot2D');
  f.session.markCheckpoint('saved', JSON.parse(f.state.snapshot)); f.session.setHandle({ name: 'file.jot2d' }); f.view.render();
  assert.equal(f.status.title, 'Drawing · Saved\nfile.jot2d');
});
test('saving wins over block editing and dirty status without altering checkpoint', () => {
  const f = fixture(); f.state.block = true; f.session.beginSave(); f.view.render();
  assert.equal(f.status.textContent, 'Drawing · Saving…'); assert.equal(f.status.dataset.dirty, 'true');
  f.session.finishSave(); f.view.render(); assert.equal(f.status.textContent, 'Drawing · Editing block');
  f.state.block = false; f.view.render(); assert.equal(f.status.textContent, 'Drawing · New document');
});
