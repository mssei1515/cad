const assert = require("node:assert/strict");
const test = require("node:test");
const spline = require("../../spline_geometry.js");

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("open cubic fit splines interpolate every fit point with natural end conditions", () => {
  const points = [{ x: 0, y: 0 }, { x: 30, y: 20 }, { x: 70, y: -10 }, { x: 100, y: 0 }];
  const curve = spline.build(points, { closed: false });
  assert.equal(curve.valid, true);
  assert.equal(curve.spans.length, 3);
  for (let index = 0; index < curve.spans.length; index++) {
    const atStart = spline.evaluate(curve, curve.spans[index].t0);
    near(atStart.x, points[index].x);
    near(atStart.y, points[index].y);
  }
  const atEnd = spline.evaluate(curve, 1);
  near(atEnd.x, points.at(-1).x);
  near(atEnd.y, points.at(-1).y);
  const startSecond = spline.secondDerivative(curve, 0);
  const endSecond = spline.secondDerivative(curve, 1);
  near(Math.hypot(startSecond.x, startSecond.y), 0, 1e-5);
  near(Math.hypot(endSecond.x, endSecond.y), 0, 1e-5);
});

test("closed cubic fit splines preserve periodic C2 continuity", () => {
  const curve = spline.build([{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 60 }, { x: 0, y: 60 }], { closed: true });
  assert.equal(curve.valid, true);
  assert.equal(curve.spans.length, 4);
  const start = spline.evaluate(curve, 0);
  const end = spline.evaluate(curve, 1);
  near(start.x, end.x);
  near(start.y, end.y);
  const startTangent = spline.derivative(curve, 0);
  const endTangent = spline.derivative(curve, 1 - 1e-10);
  near(startTangent.x, endTangent.x, 1e-4);
  near(startTangent.y, endTangent.y, 1e-4);
  const startSecond = spline.secondDerivative(curve, 0);
  const endSecond = spline.secondDerivative(curve, 1 - 1e-10);
  near(startSecond.x, endSecond.x, 1e-3);
  near(startSecond.y, endSecond.y, 1e-3);
});

test("adaptive flattening, bounds, closest point, length, and intersections are stable", () => {
  const curve = spline.build([{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 70, y: -20 }, { x: 100, y: 0 }]);
  const flattened = spline.flatten(curve, { tolerance: 0.05 });
  assert.ok(flattened.length > 6);
  const bounds = spline.bounds(curve);
  assert.ok(bounds.minX <= 0 && bounds.maxX >= 100);
  assert.ok(bounds.maxY > 20 && bounds.minY < 0);
  const closest = spline.closestPoint(curve, { x: 50, y: 5 });
  assert.ok(closest && closest.t > 0 && closest.t < 1 && closest.distance < 20);
  assert.ok(spline.approximateLength(curve) > 100);
  const hit = spline.intersections(
    { kind: "spline", curve },
    { kind: "line", p1: { x: 50, y: -100 }, p2: { x: 50, y: 100 } },
    { tolerance: 1e-4 },
  );
  assert.equal(hit.overlap, false);
  assert.equal(hit.points.length, 1);
  near(hit.points[0].x, 50, 1e-3);
});

test("invalid fit-point sets are rejected", () => {
  assert.equal(spline.build([{ x: 0, y: 0 }, { x: 10, y: 0 }]).valid, false);
  assert.equal(spline.build([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }]).valid, false);
});
