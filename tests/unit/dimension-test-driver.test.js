const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/dimension_test_driver.js'), 'utf8'), sandbox);

test('arrow observation restores the current viewport scale and propagates appearance or rendering failure', () => {
  for (const failureAt of ['appearance', 'stroke', 'points', 'projection']) {
    const failure = new Error(failureAt), updates = [];
    const viewport = { scale: 2, update: values => { updates.push(values.scale); viewport.scale = values.scale; } };
    const step = (name, value) => { assert.equal(viewport.scale, 0.05); if (failureAt === name) throw failure; return value; };
    const fixture = sandbox.window.DimensionTestDriver.createTerminatorFixture({
      viewport,
      readDefaultAppearance: () => step('appearance', { terminatorSize: 3 }),
      metrics: {
        dimensionStrokeWidth: () => step('stroke', 1),
        dimensionOpenArrowheadRenderPoints: () => step('points', [{ x: 1, y: 0 }, { x: 3, y: 2 }]),
        dimensionOpenArrowJoinProjection: () => step('projection', 1),
      },
      screenPxPerMm: 4, outsideShaftLengthFactor: 2,
    });
    // The viewport changes after factory creation; restoration must use the call-time value.
    viewport.scale = 7;
    assert.throws(() => fixture.arrowAlignment({ viewportScale: -1 }), error => error === failure);
    assert.equal(viewport.scale, 7);
    assert.deepEqual(updates, [0.05, 7]);
  }
});

test('dimension color observation forwards stroke calls and restores live selection, hover and Canvas method after success or failure', () => {
  for (const shouldFail of [false, true]) {
    const dimension = {}, constraint = {}, hovered = {}, point = {}, calls = [], failure = new Error('draw failed');
    const canvasSelection = { dimensionConstraint: null, constraint: null, set(key, value) { this[key] = value; } };
    const canvasHover = { current: { dimension: null, point }, update(values) { Object.assign(this.current, values); } };
    const originalStroke = function (...args) { assert.equal(this, ctx); calls.push(args); return 'forwarded'; };
    const ctx = { stroke: originalStroke, strokeStyle: '#ABCDEF' };
    const fixture = sandbox.window.DimensionTestDriver.createColorObservation({ canvasSelection, canvasHover, ctx,
      drawDimensions() {
        assert.equal(canvasSelection.dimensionConstraint, null);
        assert.equal(canvasSelection.constraint, null);
        assert.equal(canvasHover.current.dimension, null);
        assert.equal(ctx.stroke('path', 3), 'forwarded');
        ctx.strokeStyle = '#abcdef'; ctx.stroke('same color');
        ctx.strokeStyle = '#123456'; ctx.stroke('other color');
        if (shouldFail) throw failure;
      },
    });
    // Capture these live references at observation time, rather than at factory creation.
    canvasSelection.dimensionConstraint = dimension;
    canvasSelection.constraint = constraint;
    canvasHover.current.dimension = hovered;
    if (shouldFail) assert.throws(() => fixture.colors(), error => error === failure);
    else assert.deepEqual(Array.from(fixture.colors()), ['#abcdef', '#123456']);
    assert.equal(ctx.stroke, originalStroke);
    assert.equal(canvasSelection.dimensionConstraint, dimension);
    assert.equal(canvasSelection.constraint, constraint);
    assert.equal(canvasHover.current.dimension, hovered);
    assert.equal(canvasHover.current.point, point);
    assert.deepEqual(calls, [['path', 3], ['same color'], ['other color']]);
  }
});
