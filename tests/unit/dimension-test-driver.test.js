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
