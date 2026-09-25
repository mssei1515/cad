const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/editing/edit_history.js"), "utf8"), sandbox);
const historyOps = sandbox.window.EditHistory;

function scope(initial, signature = (value) => value) {
  return {
    undo: [initial], redo: [], value: initial, signature,
    capture() { return this.value; },
    clearRedo() { this.redo = []; },
    restore(value, label) { this.value = value; this.label = label; return true; },
    undoLabel: "undo", redoLabel: "redo",
  };
}

test("history preserves redo for equal snapshots and clears it only on a new branch", () => {
  const history = scope({ signature: "a" }, (value) => value?.signature);
  history.value = { signature: "b" };
  assert.equal(historyOps.record(history, 3), true);
  assert.equal(historyOps.undo(history), true);
  assert.equal(history.label, "undo");
  const redo = history.redo;
  history.value = { signature: "a" };
  assert.equal(historyOps.record(history, 3), false);
  assert.equal(history.redo, redo);
  assert.equal(historyOps.redo(history), true);
  assert.equal(history.value.signature, "b");
  assert.equal(history.label, "redo");
  historyOps.undo(history);
  history.value = { signature: "c" };
  historyOps.record(history, 3);
  assert.deepEqual(history.redo, []);
  assert.equal(historyOps.redo(history), false);
});

test("history enforces its limit and never restores past an available boundary", () => {
  const history = scope("a");
  for (const value of ["b", "c", "d"]) {
    history.value = value;
    historyOps.record(history, 3);
  }
  assert.deepEqual(history.undo, ["b", "c", "d"]);
  historyOps.undo(history);
  historyOps.undo(history);
  history.restore = () => { throw Error("unexpected restore"); };
  assert.equal(historyOps.undo(history), false);
  assert.deepEqual(history.undo, ["b"]);
});

test("history operations keep independent caller scopes isolated", () => {
  const document = scope("document");
  const block = scope("block");
  block.value = "edited block";
  historyOps.record(block, 3);
  historyOps.undo(block);
  historyOps.redo(block);
  assert.deepEqual(document.undo, ["document"]);
  assert.deepEqual(document.redo, []);
  assert.equal(document.value, "document");
});

test("restore callbacks observe the already moved stacks and retain their return or error", () => {
  const history = scope("a");
  history.value = "b";
  historyOps.record(history, 3);
  history.restore = (value, label) => {
    assert.equal(value, "a");
    assert.equal(label, "undo");
    assert.deepEqual(history.undo, ["a"]);
    assert.deepEqual(history.redo, ["b"]);
    return false;
  };
  assert.equal(historyOps.undo(history), false);
  const error = Error("restore failed");
  history.restore = () => { throw error; };
  assert.throws(() => historyOps.redo(history), (caught) => caught === error);
  assert.deepEqual(history.undo, ["a", "b"]);
  assert.deepEqual(history.redo, []);
});

test("owned history instances isolate Document and Block stacks without exposing mutable arrays", () => {
  let documentValue = "document", blockValue = { signature: "block" };
  const document = historyOps.create({ capture: () => documentValue, signature: value => value, restore: value => { documentValue = value; return true; }, limit: 3 });
  const block = historyOps.create({ capture: () => blockValue, signature: value => value?.signature, restore: value => { blockValue = value; return true; }, limit: 3 });
  document.reset();
  block.reset();
  blockValue = { signature: "edited" };
  block.record();
  block.undo();
  assert.equal(block.redoCount, 1);
  assert.equal(block.record(), false);
  assert.equal(block.redoCount, 1);
  block.redo();
  assert.equal(blockValue.signature, "edited");
  assert.equal(document.undoCount, 1);
  assert.equal(document.redoCount, 0);
  assert.equal(document.currentSnapshot, "document");
  assert.equal("undoSnapshots" in block, false);
});

test("owned histories enforce limits and discard only the matching transient snapshot", () => {
  let value = "a";
  const history = historyOps.create({ capture: () => value, signature: item => item, restore: item => { value = item; return true; }, limit: 3 });
  history.reset();
  assert.equal(history.discardLatest("a"), false);
  for (value of ["b", "c", "d"]) history.record();
  assert.equal(history.undoCount, 3);
  history.undo();
  assert.equal(history.redoCount, 1);
  assert.equal(history.discardLatest("not-current"), false);
  assert.equal(history.redoCount, 1);
  assert.equal(history.discardLatest("c"), true);
  assert.equal(history.currentSnapshot, "b");
  assert.equal(history.redoCount, 0);
  assert.equal(history.undo(), false);
});

test("owned history restoration preserves the existing stack transition and error contract", () => {
  let value = "a";
  const failure = Error("restore failed");
  const history = historyOps.create({
    capture: () => value, signature: item => item, limit: 3, undoLabel: "undo", redoLabel: "redo",
    restore: (snapshot, label) => {
      assert.equal(history.currentSnapshot, snapshot);
      if (label === "redo") throw failure;
      assert.equal(history.undoCount, 1);
      assert.equal(history.redoCount, 1);
      return false;
    },
  });
  history.reset();
  value = "b";
  history.record();
  assert.equal(history.undo(), false);
  assert.throws(() => history.redo(), error => error === failure);
  assert.equal(history.undoCount, 2);
  assert.equal(history.redoCount, 0);
});


vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/editing/history_controller.js"), "utf8"), sandbox);
function controllerFixture() {
  const events = [], make = name => ({ recordLabel: name,
    reset: () => events.push(`${name}:reset`), record: () => { events.push(`${name}:record`); return true; },
    undo: () => `${name}:undo`, redo: () => `${name}:redo` });
  const documentHistory = make('document'), block = make('block'), state = { block: null };
  const controller = sandbox.window.HistoryController.create({ documentHistory, currentBlockHistory: () => state.block,
    changed: () => events.push('changed'), log: value => events.push(value) });
  return { controller, events, documentHistory, block, state };
}

test('history controller routes each operation to the current scope while document reset stays explicit', () => {
  const f = controllerFixture();
  assert.equal(f.controller.active(), f.documentHistory); assert.equal(f.controller.undo(), 'document:undo');
  f.controller.resetBlock(); assert.deepEqual(f.events, []);
  f.state.block = f.block; assert.equal(f.controller.redo(), 'block:redo');
  f.controller.record('edit'); assert.deepEqual(f.events, ['block:record', 'changed', 'block: edit']);
  f.events.length = 0; f.controller.resetDocument('load'); f.controller.resetBlock();
  assert.deepEqual(f.events, ['document:reset', 'changed', '履歴を初期化しました: load', 'block:reset', 'changed']);
  f.state.block = null; assert.equal(f.controller.active(), f.documentHistory);
});

test('history restoration suppresses recording and always clears its guard before notifying', () => {
  const f = controllerFixture();
  assert.equal(f.controller.restore(() => { assert.equal(f.controller.restoring, true); f.controller.record(); return 42; }), 42);
  assert.equal(f.controller.restoring, false); assert.deepEqual(f.events, ['changed']);
  f.events.length = 0;
  assert.throws(() => f.controller.restore(() => { f.controller.record(); throw new Error('restore failed'); }), /restore failed/);
  assert.equal(f.controller.restoring, false); assert.deepEqual(f.events, ['changed']);
  f.controller.record(); assert.equal(f.events[1], 'document:record');
});

test('unchanged history records still notify but do not log a new snapshot', () => {
  const f = controllerFixture(); f.documentHistory.record = () => false;
  f.controller.record(); assert.deepEqual(f.events, ['changed']);
});
