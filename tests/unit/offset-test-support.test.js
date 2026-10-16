const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/offset_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], state = { scope: { constraints: [], lines: [] } };
  class OffsetConstraint {} class OffsetChainConstraint {} class Line {}
  const selection = { source: null, entries: [], committed: false };
  const pending = { current: null };
  const ports = { currentScope: () => { calls.push('scope'); return state.scope; }, OffsetConstraint, OffsetChainConstraint, Line,
    offsetSelection: selection, pendingCommandSession: pending, drawingPreview: { pointer: null },
    document: { getElementById: () => ({ classList: { contains: () => false } }) },
    serializeModel: () => { calls.push('serialize'); return { version: 26, constraints: [] }; },
    loadModelData: data => { calls.push(['load', data]); state.scope = { constraints: [Object.assign(new OffsetChainConstraint(), { target: 12, sources: [{}], offsets: [{}, {}], sourceReversed: [true] })], lines: [] }; return true; },
  };
  const support = sandbox.window.OffsetTestDriver.createSupport(ports);
  assert.deepEqual(calls, []);
  return { support, state, calls, ports, selection, pending, OffsetConstraint, OffsetChainConstraint };
}

test('Offset support publishes the same ordered nine entry points and reads live owners without eager work', () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.support), ['resetForOffsetConstraints', 'resetForOffsetUi', 'offsetUiState', 'resetForOffsetDirection', 'resetForOffsetChainUi', 'offsetChainUiState', 'roundTripOffsetChainForTest', 'updateOffsetChainTargetForTest', 'canReselectOffsetResultChainForTest']);
  assert.equal(Object.isFrozen(f.support), true); for (const fn of Object.values(f.support)) assert.equal(typeof fn, 'function');
  assert.equal(f.support.offsetUiState().lineCount, 0);
  f.state.scope = { lines: [{}, {}], constraints: [Object.assign(new f.OffsetConstraint(), { target: 7 })] };
  f.pending.current = { type: 'offset-value' };
  const ui = f.support.offsetUiState(); assert.equal(ui.lineCount, 2); assert.equal(ui.constraintCount, 1); assert.equal(ui.targets[0], 7); assert.equal(ui.pendingType, 'offset-value');
  f.selection.entries = [{}]; f.selection.committed = true;
  const chain = f.support.offsetChainUiState(); assert.equal(chain.selectedCount, 1); assert.equal(chain.selectionCommitted, true); assert.equal(chain.jsonVersion, 26);
});

test('Offset support routes reload and UI fixture creation to their existing owners', () => {
  const f = fixture(), result = f.support.roundTripOffsetChainForTest();
  assert.equal(result.loaded, true); assert.equal(result.count, 1); assert.equal(result.target, 12); assert.equal(result.offsetCount, 2);
  assert.deepEqual(f.calls.slice(0, 2).map(value => Array.isArray(value) ? value[0] : value), ['serialize', 'load']);
  const calls = [], ports = {
    resetModelState: () => calls.push('reset'), addPoint: (x,y) => ({ x,y }), addLine: (a,b) => calls.push(['line',a.x,b.x]),
    fitAllGeometryToViewport: padding => calls.push(['fit',padding]), draw: () => calls.push('draw'),
    canvas: { getBoundingClientRect: () => ({ left: 10, top: 20 }) }, worldToCanvasScreen: point => point,
  };
  const support = sandbox.window.OffsetTestDriver.createSupport(ports);
  assert.deepEqual(calls, []); const points = support.resetForOffsetUi();
  assert.equal(points.source.x, 10); assert.equal(points.side.y, 55);
  assert.deepEqual(calls, ['reset', ['line', -60, 60], ['fit',220], 'draw']);
});
