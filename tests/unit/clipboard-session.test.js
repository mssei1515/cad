const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/editing/clipboard_session.js', 'utf8'), sandbox);
const payload = () => ({ pasteCount: 0, cut: false, points: [{}], lines: [{}], circles: [], arcs: [], blockInstances: [] });
function fixture(accepted = true) {
  const calls = []; let session;
  session = sandbox.window.ClipboardSession.create({ pasteOffsetScreenPx: 24,
    onCopyStored: () => calls.push(['stored', session.payload]),
    deleteSelection: () => { calls.push(['delete', session.payload]); return accepted; } });
  return { session, calls };
}

test('copy and cut publish the new payload before notification and deletion and rejected cuts remain pasteable', () => {
  const { session, calls } = fixture(false), first = payload(), cut = payload();
  assert.equal(session.copy(first), true); assert.equal(session.payload, first); assert.equal(first.cut, false);
  assert.equal(session.copy(cut, true), false); assert.equal(session.payload, cut); assert.equal(cut.cut, true);
  assert.deepEqual(calls, [['stored', first], ['stored', cut], ['delete', cut]]);
  assert.equal(session.preparePaste(2).payload, cut);
  assert.equal(session.copy(null), false); assert.equal(session.payload, cut); assert.equal(calls.length, 3);
});

test('paste plans do not advance the count until recording and preserve stepped screen offsets at current scale', () => {
  const { session } = fixture(), copy = payload();
  assert.equal(session.preparePaste(1), null); session.copy(copy);
  const first = session.preparePaste(2); assert.equal(first.dx, 12); assert.equal(first.dy, 12); assert.equal(first.pasteNumber, 1);
  assert.equal(copy.pasteCount, 0); assert.equal(session.preparePaste(4).dx, 6);
  session.recordPaste(first); assert.equal(copy.pasteCount, 1);
  const second = session.preparePaste(4); assert.equal(second.pasteNumber, 2); assert.equal(second.dx, 12);
  session.recordPaste(second); assert.equal(copy.pasteCount, 2);
});

test('paste recording remains bound to its captured payload and is independent of model failure recovery', () => {
  const { session } = fixture(), old = payload(), next = payload(); session.copy(old);
  const plan = session.preparePaste(1); session.copy(next); session.recordPaste(plan);
  assert.equal(old.pasteCount, 1); assert.equal(next.pasteCount, 0); assert.equal(session.payload, next);
  assert.throws(() => { session.recordPaste(session.preparePaste(1)); throw new Error('solve failed'); }, /solve failed/);
  assert.equal(next.pasteCount, 1);
});

test('count includes optional drawable kinds and diagnostics replacement preserves supplied count and flags', () => {
  const { session, calls } = fixture(), copy = payload();
  Object.assign(copy, { pasteCount: 7, cut: true, splines: [{}], annotations: [{}], hatches: [{}], referenceImages: [{}], geometryInstances: [{}] });
  session.replaceForDiagnostics(copy); assert.equal(session.payload, copy); assert.equal(calls.length, 0);
  assert.equal(session.count(), 7); assert.equal(session.preparePaste(2).pasteNumber, 8); assert.equal(copy.cut, true);
  session.clear(); assert.equal(session.payload, null); assert.equal(session.count(), 0); assert.equal(copy.pasteCount, 7);
  assert.equal(session.count(copy), 7); assert.equal(fixture().session.payload, null);
});
