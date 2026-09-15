const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../../src/editing/workspace.js"), "utf8"), sandbox);
const create = sandbox.window.EditingWorkspace.create;

test("Document and nested editing scopes keep their own arrays and replacements", () => {
  const root = { points: [{ id: "P1" }], geometryInstances: [{ id: "FI1" }], blockDefinitions: [] };
  const workspace = create(root);
  const host = workspace.capture();
  const parent = { id: "B1", points: [{ id: "P1" }], hatches: [{ id: "H8" }] };
  workspace.activate(parent);
  parent.points = [{ id: "P2" }];
  assert.equal(root.points[0].id, "P1");
  assert.equal(parent.nextHatchIndex, 9);
  const nestedHost = workspace.capture();
  workspace.activate({ id: "B2", points: [{ id: "P1" }] });
  assert.equal(workspace.restore(nestedHost), parent);
  assert.equal(workspace.current().points[0].id, "P2");
  assert.equal(workspace.restore(host), root);
  assert.equal(root.geometryInstances[0].id, "FI1");
});

test("snapshot sources combine explicit document metadata with local content without rebinding the Document", () => {
  const root = { documentName: "Drawing", points: [], defaultAppearance: { color: "#123456" }, blockDefinitions: [] };
  const workspace = create(root);
  assert.equal(workspace.snapshotSource(), root);
  const local = { id: "B1", points: [{ id: "P1" }] };
  workspace.activate(local);
  const data = workspace.snapshotSource();
  assert.equal(data.documentName, "Drawing");
  assert.equal(data.points, local.points);
  assert.equal(data.blockDefinitions, root.blockDefinitions);
  assert.equal(root.points.length, 0);
  assert.equal("documentName" in local, false);
  assert.equal("id" in data, false);
  assert.throws(() => workspace.activate(null), /scope/);
  assert.equal(workspace.current(), local);
});
