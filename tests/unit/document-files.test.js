const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/persistence/document_files.js"), "utf8"), sandbox);
const files = sandbox.window.DocumentFiles;
const data = (x = 0) => ({ version: 22, documentName: "drawing", savedAt: "now", activeSketchId: "S1", points: [{ id: "P1", x, y: 0 }], blockDefinitions: [{ id: "B1", activeSketchId: "S1", lines: [] }] });
const status = (session, doc, editingBlock = false) => session.hasUnsavedChanges({ snapshot: JSON.stringify(doc), documentName: doc.documentName, editingBlock });

test("file names preserve existing normalization and download fallback", () => {
  assert.equal(files.effectiveDocumentNameFromValue(" \t "), "無題");
  assert.equal(files.fileNameStem(" part.rev2.jot2d "), "part.rev2");
  assert.equal(files.safeDownloadBaseName('a/b:*?. '), "a_b___");
  assert.equal(files.safeDownloadBaseName("..."), "jot2d-model");
});

test("content comparison ignores timestamps and active scopes but retains document content", () => {
  const original = data();
  const navigation = data();
  navigation.savedAt = "later";
  navigation.activeSketchId = "ROOT";
  navigation.blockDefinitions[0].activeSketchId = "ROOT";
  assert.equal(files.documentContentSignature(original), files.documentContentSignature(navigation));
  navigation.documentName = "renamed";
  assert.notEqual(files.documentContentSignature(original), files.documentContentSignature(navigation));
  assert.equal(original.blockDefinitions[0].activeSketchId, "S1");
});

test("checkpoint follows undo/redo and a slow save records the written snapshot only", () => {
  const session = files.create();
  assert.equal(status(session, data(1)), false);
  session.markCheckpoint("new", data());
  assert.equal(status(session, data()), false);
  assert.equal(status(session, data(1)), true);
  assert.equal(status(session, data()), false);
  assert.equal(status(session, data(1)), true);
  assert.equal(session.beginSave(), true);
  session.markCheckpoint("saved", data(1));
  session.finishSave();
  assert.equal(status(session, data(2)), true);
  assert.equal(status(session, data(1)), false);
  assert.equal(status(session, data(1), true), true);
  assert.equal(session.matchesCheckpoint(data(2)), false);
  assert.equal(session.checkpointKind, "saved");
});

test("status reads committed history while replacement and unload compare live data", () => {
  const session = files.create();
  session.markCheckpoint("saved", data());
  assert.equal(status(session, data()), false);
  assert.equal(session.matchesCheckpoint(data(1)), false);
  session.markCheckpoint("download", data(1));
  assert.equal(status(session, data()), true);
  assert.equal(session.checkpointKind, "download");
});

test("file operation exclusion allows only save-and-open within a pending open", () => {
  const session = files.create();
  assert.equal(session.beginOpen(), true);
  assert.equal(session.beginOpen(), false);
  assert.equal(session.beginSave(), false);
  assert.equal(session.beginSave({ replacingDocument: true }), true);
  assert.equal(session.beginSave({ replacingDocument: true }), false);
  session.finishSave();
  assert.equal(session.busy, true);
  session.finishOpen();
  assert.equal(session.busy, false);
  assert.equal(session.beginSave(), true);
  assert.equal(session.beginOpen(), false);
  session.finishSave();
  assert.equal(session.beginOpen(), true);
});

test("session handle, locks and checkpoints are isolated from other sessions", () => {
  const first = files.create(), second = files.create();
  const handle = { name: "first.jot2d" };
  first.setHandle(handle);
  first.markCheckpoint("saved", data());
  first.beginSave();
  assert.equal(first.handle, handle);
  assert.equal(second.handle, null);
  assert.equal(second.busy, false);
  assert.equal(second.checkpointKind, "new");
  assert.equal(second.matchesCheckpoint(data()), false);
  first.setHandle(null);
  assert.equal(first.handle, null);
});

test("file writing waits for close before succeeding", async () => {
  const calls = [];
  await files.writeJot2DFile({ async createWritable() {
    calls.push("create");
    return { async write(value) { calls.push(value); }, async close() { calls.push("close"); } };
  } }, "content");
  assert.deepEqual(calls, ["create", "content", "close"]);
});

for (const stage of ["write", "close"]) {
  test(`a ${stage} failure attempts abort and preserves the original error`, async () => {
    const error = new Error(stage);
    const calls = [];
    const stream = {
      async write() { calls.push("write"); if (stage === "write") throw error; },
      async close() { calls.push("close"); throw error; },
      async abort() { calls.push("abort"); throw new Error("abort failed"); },
    };
    await assert.rejects(files.writeJot2DFile({ async createWritable() { return stream; } }, "content"), (actual) => actual === error);
    assert.deepEqual(calls, stage === "write" ? ["write", "abort"] : ["write", "close", "abort"]);
  });
}
