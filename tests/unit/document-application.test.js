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
