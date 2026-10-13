const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/canvas_render_test_driver.js'), 'utf8'), sandbox);

test('construction observation restores Canvas methods on draw and appearance errors and forwards arc context', () => {
  for (const failureAt of [null, 'draw', 'appearance']) {
    const failure = new Error('failed'), arcCalls = [];
    const originalMove = () => {}, originalLine = () => {};
    function originalArc(...args) { arcCalls.push([this, args]); return 7; }
    const ctx = { moveTo: originalMove, lineTo: originalLine, arc: originalArc };
    const line = { id: 'L1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } };
    const observation = sandbox.window.CanvasRenderTestDriver.createConstructionLineObservation({
      allGeometryLines: () => [line], ctx, viewport: { scale: 2 },
      drawLines: () => {
        ctx.moveTo(-2, 0); ctx.lineTo(12, 0);
        assert.equal(ctx.arc(0, 0, 1, 0, Math.PI), 7);
        if (failureAt === 'draw') throw failure;
      },
      effectiveAppearanceForElement: value => {
        assert.equal(value, line); assert.equal(ctx.moveTo, originalMove); assert.equal(ctx.lineTo, originalLine); assert.equal(ctx.arc, originalArc);
        if (failureAt === 'appearance') throw failure;
        return { endpointOverhang: false, endpointMarkers: true };
      },
    });
    assert.equal(observation.state('missing'), null);
    if (failureAt) assert.throws(() => observation.state('L1'), error => error === failure);
    else assert.deepEqual({ ...observation.state('L1') }, { endpointOverhang: false, endpointMarkers: true, overhangPx: 4, endpointMarkerCount: 1 });
    assert.equal(ctx.moveTo, originalMove); assert.equal(ctx.lineTo, originalLine); assert.equal(ctx.arc, originalArc);
    assert.equal(arcCalls.length, 1); assert.equal(arcCalls[0][0], ctx);
    assert.deepEqual(arcCalls[0][1], [0, 0, 1, 0, Math.PI]);
  }
});
