const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/document_file_controls.js'), 'utf8'), sandbox);
const { DocumentFileControls } = sandbox.window;
function surface(ids) {
  const nodes = Object.fromEntries(ids.map(id => {
    const listeners = new Map();
    const node = { value: 'selected', files: [], listeners,
      addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
      removeEventListener(type, handler) { listeners.get(type).delete(handler); },
      fire(type, event = { currentTarget: node }) { for (const handler of listeners.get(type) || []) handler.call(node, event); },
      click() { node.fire('click'); },
    };
    return [id, node];
  }));
  return { nodes, document: { getElementById: id => nodes[id] } };
}

test('Document controls delegate async actions, preserve raw input handler and receiver, and own listener lifetime', () => {
  const f = surface(['exportBtn', 'saveAsBtn', 'importBtn', 'documentFileInput', 'copyDocumentLinkBtn', 'openDocumentLinkBtn']);
  const calls = [], input = f.nodes.documentFileInput, event = { currentTarget: input };
  const command = {
    fileInputChanged(value) { assert.equal(this, input); assert.equal(value, event); calls.push('input'); },
    copyDocumentLink() { assert.equal(this, command); calls.push('copy'); return Promise.resolve(); },
    openLinkedDocument() { assert.equal(this, command); calls.push('link'); return Promise.resolve(); },
  };
  const action = name => () => { calls.push(name); return Promise.resolve(); };
  const controls = DocumentFileControls.createDocument({ document: f.document, saveJot2DFile: action('save'),
    saveJot2DFileAs: action('saveAs'), openJot2DFile: action('open'), documentFileCommand: command });
  controls.bind(); controls.bind();
  assert.equal(input.listeners.get('change').size, 1);
  assert.equal([...input.listeners.get('change')][0], command.fileInputChanged);
  for (const id of ['exportBtn', 'saveAsBtn', 'importBtn', 'copyDocumentLinkBtn', 'openDocumentLinkBtn']) f.nodes[id].click();
  input.fire('change', event);
  assert.deepEqual(calls, ['save', 'saveAs', 'open', 'copy', 'link', 'input']);
  controls.dispose();
  for (const node of Object.values(f.nodes)) for (const listeners of node.listeners.values()) assert.equal(listeners.size, 0);
  controls.bind(); f.nodes.exportBtn.click(); assert.equal(calls.at(-1), 'save'); controls.dispose();
});

test('optional Document controls remain optional while primary save/open controls remain required', () => {
  const f = surface(['exportBtn', 'importBtn']);
  const controls = DocumentFileControls.createDocument({ document: f.document, saveJot2DFile() {}, openJot2DFile() {}, documentFileCommand: { get fileInputChanged() { throw new Error("absent input must short-circuit handler lookup"); } } });
  controls.bind(); assert.equal(f.nodes.exportBtn.listeners.get('click').size, 1); controls.dispose();
  const missing = DocumentFileControls.createDocument({ document: { getElementById: () => null }, documentFileCommand: {} });
  assert.throws(() => missing.bind(), /addEventListener/);
});

test('DXF controls flush before live busy/edit checks and clear the same input before passing its File', () => {
  const f = surface(['dxfImportBtn', 'dxfFileInput']), calls = [], session = { busy: true };
  let editable = false;
  f.nodes.dxfFileInput.click = () => calls.push('picker');
  const importer = { importFile(file) { assert.equal(this, importer); assert.equal(f.nodes.dxfFileInput.value, ''); calls.push(['import', file]); return Promise.resolve(); } };
  const controls = DocumentFileControls.createDxf({ document: f.document, fileSession: session,
    flushScheduledCanvasPointerMove: () => calls.push('flush'), canImportDxf: () => { calls.push('editable'); return editable; },
    setHint: (message, severity) => { assert.equal(severity, 'error'); calls.push('hint'); }, applicationText: (ja, en) => en,
    dxfImportCommand: importer });
  controls.bind();
  f.nodes.dxfImportBtn.click(); assert.deepEqual(calls, ['flush', 'hint']);
  calls.length = 0; session.busy = false; f.nodes.dxfImportBtn.click(); assert.deepEqual(calls, ['flush', 'editable', 'hint']);
  calls.length = 0; editable = true; f.nodes.dxfImportBtn.click(); assert.deepEqual(calls, ['flush', 'editable', 'picker']);
  calls.length = 0; const file = {}; f.nodes.dxfFileInput.files = [file]; f.nodes.dxfFileInput.fire('change');
  assert.equal(calls[0][1], file);
  calls.length = 0; f.nodes.dxfFileInput.value = 'another'; f.nodes.dxfFileInput.files = []; f.nodes.dxfFileInput.fire('change');
  assert.equal(calls[0][1], undefined);
  controls.dispose(); assert.equal(f.nodes.dxfFileInput.listeners.get('change').size, 0);
});
