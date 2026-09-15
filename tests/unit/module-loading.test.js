const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

test("production modules initialize in the actual HTML script order before app bootstrap", () => {
  const root = path.resolve(__dirname, "../..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const match = html.match(/const sources = (\[[\s\S]*?\]);/);
  assert.ok(match, "The normal-script loader must declare its sources");
  const sources = vm.runInNewContext(match[1]);
  assert.equal(new Set(sources).size, sources.length, "Modules must not load twice");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  // Generated Git metadata and DOM bootstrap are covered by the real-browser tests.
  const modules = sources.filter(source => source.startsWith("src/"));
  assert.ok(modules.length > 0);
  for (const file of modules) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox, { filename: file });
  }
});
