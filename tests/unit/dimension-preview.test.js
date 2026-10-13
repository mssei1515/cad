const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/dimension_preview.js'), 'utf8'), sandbox);
function fixture() {
  const calls = []; let pending = null, value = 5, error = null;
  const dimension = { axis: 'x' };
  const api = sandbox.window.DimensionPreview.create({ readPending: () => pending,
    drawDimension: (...args) => calls.push(['draw', ...args]), drawFilletPreviewArc: geometry => calls.push(['fillet', geometry]),
    dimensionFromAnchor: (target, anchor) => { calls.push(['anchor', target, anchor]); return dimension; },
    applyDefaultCircleDimensionLabelOffset: (target, d) => { calls.push(['offset', target, d]); return d; },
    defaultDimensionForTarget: target => { calls.push(['default', target]); return dimension; },
    evaluateDimensionExpressionDraft: (...args) => { calls.push(['evaluate', ...args]); if (error) throw error; return value; },
    formatDisplayNumber: n => String(n), angleDegrees: n => n * 180 / Math.PI,
    angleDimensionAngles: (...args) => { calls.push(['angle', ...args]); return { signed: Math.PI / 2 }; },
    dimensionAnchor: (target, d) => { calls.push(['fallback', target, d]); return { x: 7, y: 9 }; },
    formatDimensionLabel: (n, suffix = '') => String(n) + suffix,
    dimensionWithLabelAt: (target, d, pointer) => { calls.push(['label', target, d, pointer]); return d; },
  });
  return { api, calls, dimension, set: p => { pending = p; }, value: n => { value = n; }, error: e => { error = e; } };
}
test('dimension preview observes current pending input, skips unrelated/failed fillets and renders radius without committing', () => {
  const h = fixture(); h.api.draw(); h.set({ type: 'line' }); h.api.draw();
  h.set({ type: 'fillet-radius-place', preview: { ok: false } }); h.api.draw(); assert.equal(h.calls.length, 0);
  const geometry = { ok: true, center: { x: 1, y: 2 }, radius: 10, startAngle: 0, endAngle: Math.PI };
  h.set({ type: 'fillet-radius-place', preview: geometry }); h.api.draw();
  assert.equal(h.calls[0][0], 'fillet'); assert.equal(h.calls[0][1], geometry);
  const anchor = h.calls[1][2]; assert.ok(Math.abs(anchor.x - 1) < 1e-10); assert.equal(anchor.y, 12);
  const draw = h.calls.at(-1); assert.equal(draw[1].primitive.center, geometry.center); assert.equal(draw[1].primitive.radius(), 10);
  assert.equal(draw[3], 'R10'); assert.equal(JSON.stringify(draw[6]), '{"selecting":true,"invalid":false,"hidden":true}');
});
test('dimension input keeps signed interval validity, error display and evaluation arguments separate from placement', () => {
  const h = fixture(), constraint = {}, target = { kind: 'angle', interval: true }, pending = { type: 'distance-value', target, dimension: h.dimension, constraint, buffer: '-30', editing: true };
  h.set(pending); h.value(-30); h.api.draw();
  const evaluation = h.calls[0]; assert.equal(evaluation[1], constraint); assert.equal(evaluation[2], '-30'); assert.equal(evaluation[3], undefined); assert.equal(evaluation[4].signedAngle, true);
  let draw = h.calls.at(-1); assert.equal(draw[1], target); assert.equal(draw[2], h.dimension); assert.equal(draw[3], '-30°|'); assert.equal(draw[6].invalid, false); assert.equal(draw[6].selecting, false);
  for (const n of [0, 360, -360]) { h.calls.length = 0; h.value(n); h.api.draw(); assert.equal(h.calls.at(-1)[6].invalid, true); }
  target.interval = false; h.value(180); h.api.draw(); assert.equal(h.calls.at(-1)[6].invalid, true);
  h.error(new Error('invalid expression')); pending.editing = false; h.api.draw(); draw = h.calls.at(-1);
  assert.equal(draw[3], '_°|'); assert.equal(draw[6].invalid, true); assert.equal(draw[6].selecting, true);
  assert.equal(h.calls.some(call => ['anchor', 'default', 'label'].includes(call[0])), false);
});
test('placement preview retains axis target copy, existing dimension identity and default/fallback query order', () => {
  const h = fixture(), target = { kind: 'point-point', p1: { x: 3, y: 5 }, p2: { x: 11, y: 17 }, value: 99 }, pointer = { x: 1, y: 2 };
  h.set({ type: 'distance-place', target, dimension: h.dimension, pointer }); h.api.draw();
  const draw = h.calls.at(-1); assert.notEqual(draw[1], target); assert.equal(draw[1].dimensionAxis, 'x'); assert.equal(target.dimensionAxis, undefined); assert.equal(draw[1].p1, target.p1); assert.equal(draw[2], h.dimension); assert.equal(draw[3], '8'); assert.equal(draw[4], true); assert.equal(h.calls[0][0], 'label');
  h.calls.length = 0; const angle = { kind: 'angle' }; h.set({ type: 'distance-place', target: angle }); h.api.draw();
  assert.deepEqual(h.calls.map(call => call[0]), ['default', 'offset', 'fallback', 'angle', 'label', 'draw']); assert.equal(h.calls.at(-1)[3], '90°');
  h.calls.length = 0; h.set({ type: 'distance-place', target, pointer }); h.api.draw(); assert.deepEqual(h.calls.map(call => call[0]), ['anchor', 'offset', 'label', 'draw']);
});
