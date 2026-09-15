const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../../src/ui/application_settings.js"), "utf8"), sandbox);

function setup({ values = new Map(), unavailable = false, initialTheme = "light" } = {}) {
  const trace = [];
  const targets = new Map();
  for (const id of ["applicationSettingsBtn", "applicationLanguageSelect", "applicationThemeSelect", "applicationSettingsDialog"]) {
    const listeners = new Map();
    targets.set(id, {
      value: "", listeners,
      addEventListener(event, listener) { listeners.set(event, listener); },
      removeEventListener(event, listener) { if (listeners.get(event) === listener) listeners.delete(event); },
      showModal() { trace.push("open"); },
    });
  }
  const document = {
    defaultView: { Node: { ELEMENT_NODE: 1 }, NodeFilter: { SHOW_TEXT: 4 } },
    documentElement: {
      nodeType: 1, dataset: { theme: initialTheme },
      querySelectorAll: () => [], matches: () => false, closest: () => null, hasAttribute: () => false,
    },
    getElementById: (id) => targets.get(id),
    createTreeWalker: () => ({ nextNode: () => false }),
  };
  const storage = () => {
    if (unavailable) throw new Error("Storage is unavailable");
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  };
  const settings = sandbox.window.ApplicationSettings.create({
    document, storage,
    refreshViews: (options) => { assert.equal(options.refreshAnalysis, false); trace.push("refresh"); },
    refreshVersion: () => trace.push("version"), redrawCanvas: () => trace.push("draw"),
  });
  return { settings, trace, document, targets, values };
}

test("unavailable browser storage preserves session settings and initial theme fallback", () => {
  const { settings, document } = setup({ unavailable: true, initialTheme: "dark" });
  assert.equal(settings.language, "ja");
  assert.equal(settings.theme, "dark");
  settings.setApplicationLanguage("en");
  settings.setApplicationTheme("light");
  assert.equal(settings.language, "en");
  assert.equal(document.documentElement.lang, "en");
  assert.equal(settings.theme, "light");
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(settings.storedTheme(), null);
});

test("localization preserves whitespace and user text while translating dynamic status prefixes", () => {
  const { settings, trace } = setup();
  settings.setApplicationLanguage("en", { persist: false, refresh: false });
  assert.equal(settings.translatedExactText("  スケッチ\n"), "  Sketch\n");
  assert.equal(settings.translatedExactText("My Sketch 1"), "My Sketch 1");
  assert.equal(settings.translatedHintText("拘束追加: L1"), "Constraint added: L1");
  assert.equal(settings.applicationText("値", "Value"), "Value");
  assert.deepEqual(trace, ["version"]);
  settings.setApplicationLanguage("ja", { persist: false });
  assert.equal(settings.translatedHintText("Constraint added: L1"), "拘束追加: L1");
  assert.deepEqual(trace, ["version", "refresh", "version"]);
});

test("settings lifecycle removes listeners and maintains refresh, localization and redraw order", () => {
  const { settings, targets, trace, values } = setup();
  settings.start();
  const language = targets.get("applicationLanguageSelect");
  const firstHandler = language.listeners.get("change");
  settings.start();
  assert.equal(language.listeners.get("change"), firstHandler);
  firstHandler({ target: { value: "en" } });
  assert.deepEqual(trace, ["refresh", "version", "draw"]);
  assert.equal(language.value, "en");
  assert.equal(values.get("jot2d.application.language"), "en");
  targets.get("applicationThemeSelect").listeners.get("change")({ target: { value: "dark" } });
  assert.equal(settings.storedTheme(), "dark");
  assert.equal(values.get("jot2d.application.theme"), "dark");
  settings.dispose();
  assert.equal(language.listeners.size, 0);
  assert.equal(targets.get("applicationThemeSelect").listeners.size, 0);
  settings.start();
  assert.equal(language.listeners.size, 1);
});

test("non-persisted initialization leaves stored values intact and independent instances separate", () => {
  const values = new Map([["jot2d.application.language", "en"], ["jot2d.application.theme", "dark"]]);
  const { settings, trace } = setup({ values });
  const other = setup().settings;
  settings.setApplicationLanguage("ja", { persist: false, refresh: false });
  settings.setApplicationTheme("light", { persist: false, redraw: false });
  assert.equal(values.get("jot2d.application.language"), "en");
  assert.equal(values.get("jot2d.application.theme"), "dark");
  assert.equal(other.language, "ja");
  assert.equal(other.theme, "light");
  assert.deepEqual(trace, ["version"]);
});
