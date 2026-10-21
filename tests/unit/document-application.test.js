const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture() {
  const calls = [], messages = [];
  const oldPoint = { x: 3 }, newPoint = { x: 8 };
  const model = { points: [oldPoint], lines: [] }, document = { blockDefinitions: [] };
  const tree = { expanded: ['S2'] }, sequences = { geometry: { point: 3 } };
  const state = { repaired: 2, lineRepair: { changed: 1, failed: 2 }, fail: false };
  const sandbox = { window: {
    DrawingOrder: { ensureDrawingOrderState: scope => calls.push(scope === model ? 'order:root' : 'order:block') },
    DocumentSequences: { recover: (scope, definitions) => {
      assert.equal(scope, model); assert.equal(definitions, document.blockDefinitions);
      calls.push('sequences'); return sequences;
    } },
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../src/editing/document_application.js'), 'utf8'), sandbox);
  const application = sandbox.window.DocumentApplication.create({ document, model,
    documentLoading: {
      decode: (data, options) => { calls.push('decode'); state.options = options; if (state.fail) throw new Error('decode failed'); return { repairedBlockConstraintCount: state.repaired }; },
      install: (candidate, target, scope) => { calls.push('install'); assert.equal(target, document); assert.equal(scope, model); model.points.push(newPoint); document.blockDefinitions = [{}]; },
    },
    sketchTreeView: { capture: () => { calls.push('capture'); return tree; }, restore: value => { assert.equal(value, tree); calls.push('tree'); } },
    resetEditingState: () => { calls.push('reset'); model.points.length = 0; },
    refreshReferenceConstraintValidity: () => { calls.push('references'); assert.equal(model.points[0], newPoint); },
    enforceMinimumLineLengths: lines => { assert.equal(lines, model.lines); calls.push('lines'); return state.lineRepair; },
    ensureDimensionDefaults: () => calls.push('dimensions'),
    restoreSequences: value => { assert.equal(value, sequences); calls.push('reserve'); },
    ensureAppearanceState: () => calls.push('appearance'), ensureBlockState: () => calls.push('blocks'),
    log: message => { calls.push('log'); messages.push(message); },
  });
  return { application, calls, messages, state, model, oldPoint, newPoint };
}
const valid = () => ({ points: [], lines: [], constraints: [] });

test('document application decodes before reset, retains tree and completes repairs before normalization', () => {
  const f = fixture(), points = f.model.points;
  const options = { preserveSketchTreeState: true, documentNameOverride: 'Opened' };
  assert.equal(f.application.load(valid(), options), undefined);
  assert.equal(f.state.options, options);
  assert.equal(f.model.points, points); assert.equal(points[0], f.newPoint);
  assert.deepEqual(f.calls, ['capture', 'decode', 'reset', 'tree', 'install', 'references', 'lines', 'log', 'log', 'dimensions', 'sequences', 'reserve', 'appearance', 'blocks', 'order:root', 'order:block']);
  assert.deepEqual(f.messages, ['短すぎる線を補正しました: 1件 / 補正不能 2件', '参照先が見つからないブロック内部拘束を2件解除しました']);
  assert.equal(f.application.blockConstraintRepairMessage, f.messages[1]);
});

test('invalid input or failed decoding never clears the existing editing model', () => {
  const f = fixture();
  for (const data of [null, {}, { points: [], lines: [] }, { points: {}, lines: [], constraints: [] }]) {
    assert.throws(() => f.application.load(data), /保存データ/);
  }
  assert.deepEqual(f.calls, []); assert.equal(f.model.points[0], f.oldPoint);
  f.state.fail = true;
  assert.throws(() => f.application.load(valid(), { preserveSketchTreeState: true }), /decode failed/);
  assert.deepEqual(f.calls, ['capture', 'decode']); assert.equal(f.model.points[0], f.oldPoint);
});

test('repair feedback resets on a subsequent decode attempt and normal loading does not restore tree state', () => {
  const f = fixture(); f.application.load(valid());
  const prior = f.application.blockConstraintRepairMessage;
  assert.notEqual(prior, ''); assert.equal(f.calls.includes('capture'), false); assert.equal(f.calls.includes('tree'), false);
  assert.throws(() => f.application.load(null));
  assert.equal(f.application.blockConstraintRepairMessage, prior);
  f.state.fail = true; assert.throws(() => f.application.load(valid()), /decode failed/);
  assert.equal(f.application.blockConstraintRepairMessage, '');
  f.state.fail = false; f.state.repaired = 0; f.state.lineRepair = { changed: 0, failed: 0 };
  f.messages.length = 0; f.application.load(valid());
  assert.deepEqual(f.messages, []); assert.equal(f.application.blockConstraintRepairMessage, '');
});

function preparationFixture() {
  'use strict';
  const events = [], scopes = Object.fromEntries(['A','B','C','D'].map(id => [id, { id }]));
  const state = { scope: scopes.A, editor: null, reads: 0, fail: null, error: new Error('preparation failed') };
  const document = { blockDefinitions: [{ id: 'DEF1' }, { id: 'DEF2' }] };
  const emit = (name, ...args) => { events.push([name, ...args]); if (state.fail === name) throw state.error; };
  Object.defineProperty(document, 'units', { get() { return state.units; }, set(value) { state.units = value; emit('units'); } });
  const sketchContext = { ensureSketchState() { assert.equal(this, undefined); emit('sketch'); state.scope = scopes.B; }, isDrawableSketch() {}, firstDrawableSketchId() {} };
  const catalog = { blockDefinitionDrawableSketchIds() {}, blockDefinitionGeometrySketchIds() {} };
  const local = { window: {
    DocumentState: { DEFAULT_DOCUMENT_UNITS: { length: 'mm' }, normalizeAppearanceState(doc, scope, options) {
      assert.equal(doc, document); emit('appearance', scope.id, options.blockEditing); state.scope = scopes.C;
    } },
    DrawingOrder: { ensureDrawingOrderState: function(scope) { assert.equal(this, undefined); emit('order', scope.id); } },
    BlockState: { create(options) {
      assert.equal(options.blockDefinitionDrawableSketchIds, catalog.blockDefinitionDrawableSketchIds);
      assert.equal(options.blockDefinitionGeometrySketchIds, catalog.blockDefinitionGeometrySketchIds);
      assert.equal(options.isDrawableSketch, sketchContext.isDrawableSketch); assert.equal(options.firstDrawableSketchId, sketchContext.firstDrawableSketchId);
      const api = { normalize(doc, scope, id) { assert.equal(this, api); assert.equal(doc, document); emit('blocks', scope.id, id); state.scope = scopes.D; } };
      return api;
    } },
  } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/document_application.js'), 'utf8'), local);
  const preparation = local.window.DocumentApplication.createPreparation({ document, currentScope: () => { state.reads++; return state.scope; },
    readBlockEditor: () => { state.reads++; return state.editor; }, sketchContext, blockCatalog: catalog,
    parameterNamespace: { ensureParameterNamespace: function(scope) { assert.equal(this, undefined); emit('parameters', scope.id); } },
  });
  return { preparation, state, events, defaults: local.window.DocumentState.DEFAULT_DOCUMENT_UNITS };
}

test('document preparation stays lazy and re-reads scope and Block session in the existing normalization order', () => {
  const f = preparationFixture(); assert.deepEqual(f.events, []); assert.equal(f.state.reads, 0);
  f.state.editor = { draft: { id: 'B2' } }; assert.equal(f.preparation.prepare(), undefined);
  assert.deepEqual(f.events, [['units'], ['sketch'], ['appearance','B',true], ['blocks','C','B2'], ['order','D'], ['order','DEF1'], ['order','DEF2'], ['parameters','D']]);
  assert.equal(JSON.stringify(f.state.units), '{"length":"mm"}'); assert.notEqual(f.state.units, f.defaults);
  const priorUnits = f.state.units; f.events.length = 0; f.state.editor = null; f.preparation.prepare();
  assert.notEqual(f.state.units, priorUnits); assert.deepEqual(f.events[2], ['appearance','B',false]); assert.deepEqual(f.events[3], ['blocks','C',null]);
  f.events.length = 0; f.preparation.appearance(); assert.deepEqual(f.events, [['appearance','D',false]]);
});

test('preparation preserves completed mutations and stops later normalization on each original failure boundary', () => {
  for (const fail of ['sketch','appearance','blocks','order','parameters']) {
    const f = preparationFixture(); f.state.fail = fail;
    assert.throws(() => f.preparation.prepare(), error => error === f.state.error);
    assert.equal(f.events.at(-1)[0], fail); assert.equal(JSON.stringify(f.state.units), '{"length":"mm"}');
    assert.equal(f.events.filter(event => event[0] === fail).length, 1);
  }
});
