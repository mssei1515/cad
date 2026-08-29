const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.JOT2D_E2E_PORT || 8765) + 4;
const baseUrl = `http://${host}:${port}`;
const sourceFixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../test-data/テスト図形.json"), "utf8"));
let serverProcess = null;

function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(check, 100);
      });
    };
    check();
  });
}

function matchesConstraint(constraint, selector) {
  return Object.entries(selector).every(([key, value]) => constraint[key] === value);
}

function fixtureWithoutConstraints(selectors) {
  const fixture = structuredClone(sourceFixture);
  fixture.constraints = fixture.constraints.filter((constraint) =>
    !selectors.some((selector) => matchesConstraint(constraint, selector)),
  );
  expect(sourceFixture.constraints.length - fixture.constraints.length).toBe(selectors.length);
  return fixture;
}

function pointDistance(a, b) {
  return Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
}

function geometryStateDistance(descriptor, before, after) {
  if (!before || !after) return 0;
  if (descriptor.kind === "point") return pointDistance(before, after);
  if (descriptor.kind === "line") {
    return Math.max(
      pointDistance(before.p1, after.p1),
      pointDistance(before.p2, after.p2),
      pointDistance(before.midpoint, after.midpoint),
      Math.abs(after.length - before.length),
    );
  }
  if (descriptor.kind === "circle") {
    return Math.max(pointDistance(before.center, after.center), Math.abs(after.radius - before.radius));
  }
  if (descriptor.kind === "arc-endpoint") return pointDistance(before.draggedEndpoint, after.draggedEndpoint);
  return Math.max(
    pointDistance(before.center, after.center),
    Math.abs(after.radius - before.radius),
    pointDistance(before.start, after.start),
    pointDistance(before.end, after.end),
  );
}

function linearPath(name, angle, distance, steps) {
  return {
    name,
    deltas: Array.from({ length: steps }, (_, index) => {
      const traveled = distance * (index + 1) / steps;
      return [Math.cos(angle) * traveled, Math.sin(angle) * traveled];
    }),
  };
}

const directions = [
  ["east", 0],
  ["south-east", Math.PI / 4],
  ["south", Math.PI / 2],
  ["south-west", 3 * Math.PI / 4],
  ["west", Math.PI],
  ["north-west", 5 * Math.PI / 4],
  ["north", 3 * Math.PI / 2],
  ["north-east", 7 * Math.PI / 4],
];

const cardinalDirections = directions.filter((_, index) => index % 2 === 0);
const dragPaths = [
  ...directions.map(([name, angle]) => linearPath(`small-slow-${name}`, angle, 2, 8)),
  ...directions.map(([name, angle]) => linearPath(`large-fast-${name}`, angle, 40, 2)),
  ...cardinalDirections.map(([name, angle]) => linearPath(`small-fast-${name}`, angle, 2, 2)),
  ...cardinalDirections.map(([name, angle]) => linearPath(`large-slow-${name}`, angle, 40, 12)),
  {
    name: "slow-reverse",
    deltas: [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((x) => [x * 2, 0]),
  },
  {
    name: "zigzag",
    deltas: [[4, 4], [8, -4], [12, 4], [16, -4], [20, 4], [24, -4]],
  },
  {
    name: "circle",
    deltas: Array.from({ length: 16 }, (_, index) => {
      const angle = Math.PI * 2 * (index + 1) / 16;
      return [12 * Math.cos(angle), 12 * Math.sin(angle)];
    }),
  },
  {
    name: "jump-reverse",
    deltas: [[40, 0], [-40, 0], [0, 0]],
  },
];

const expectedImmobileVariants = new Set([
  "point-p7-line-fixed",
  "point-p27-distance",
  "circle-c3-two-center-relations",
  "arc-a1-tangent",
  "arc-a1-two-tangencies",
  "arc-a2-center-distance",
  "arc-a4-tangent",
  "arc-a7-two-tangencies",
]);

const variants = [
  { name: "point-p7-line-fixed", descriptor: { kind: "point", id: "P7" }, removed: [{ type: "lineFixed", line: "L5" }] },
  {
    name: "point-p7-four-relations",
    descriptor: { kind: "point", id: "P7" },
    removed: [
      { type: "lineFixed", line: "L5" },
      { type: "pointLineDistance", point: "P6", line: "L5" },
      { type: "pointLineDistance", point: "P6", line: "L6" },
      { type: "coincident", p1: "P17", p2: "P7" },
    ],
  },
  { name: "point-p17-coincident", descriptor: { kind: "point", id: "P17" }, removed: [{ type: "coincident", p1: "P17", p2: "P7" }] },
  { name: "point-p27-distance", descriptor: { kind: "point", id: "P27" }, removed: [{ type: "distance", p1: "P27", p2: "P26" }] },
  { name: "point-p35-arc-endpoint", descriptor: { kind: "point", id: "P35" }, removed: [{ type: "arcEndpointCoincident", arc: "A5", endpoint: "start", point: "P35" }] },
  { name: "point-p19-arc-endpoint", descriptor: { kind: "point", id: "P19" }, removed: [{ type: "arcEndpointCoincident", arc: "A2", endpoint: "end", point: "P19" }] },
  { name: "point-p20-arc-endpoint", descriptor: { kind: "point", id: "P20" }, removed: [{ type: "arcEndpointCoincident", arc: "A1", endpoint: "start", point: "P20" }] },
  { name: "point-p22-arc-endpoint", descriptor: { kind: "point", id: "P22" }, removed: [{ type: "arcEndpointCoincident", arc: "A2", endpoint: "start", point: "P22" }] },
  { name: "point-p23-arc-endpoint", descriptor: { kind: "point", id: "P23" }, removed: [{ type: "arcEndpointCoincident", arc: "A1", endpoint: "end", point: "P23" }] },
  {
    name: "point-p42-two-arc-relations",
    descriptor: { kind: "point", id: "P42" },
    removed: [
      { type: "pointOnCircle", point: "P42", primitive: "A4" },
      { type: "arcEndpointCoincident", arc: "A4", endpoint: "end", point: "P42" },
    ],
  },
  { name: "point-p45-line-angle", descriptor: { kind: "point", id: "P45" }, removed: [{ type: "lineAngle", line1: "L19", line2: "L6" }] },
  {
    name: "point-p46-two-position-relations",
    descriptor: { kind: "point", id: "P46" },
    removed: [
      { type: "coincident", p1: "P14", p2: "P46" },
      { type: "distance", p1: "P17", p2: "P46" },
    ],
  },
  { name: "line-l5-fixed", descriptor: { kind: "line", id: "L5" }, removed: [{ type: "lineFixed", line: "L5" }] },
  { name: "line-l8-horizontal", descriptor: { kind: "line", id: "L8" }, removed: [{ type: "horizontal", line: "L8" }] },
  { name: "line-l11-horizontal", descriptor: { kind: "line", id: "L11" }, removed: [{ type: "horizontal", line: "L11" }] },
  {
    name: "line-l13-two-tangencies",
    descriptor: { kind: "line", id: "L13" },
    removed: [
      { type: "lineCircleTangent", line: "L13", primitive: "A7" },
      { type: "lineCircleTangent", line: "L13", primitive: "A6" },
    ],
  },
  {
    name: "line-l15-two-tangencies",
    descriptor: { kind: "line", id: "L15" },
    removed: [
      { type: "lineCircleTangent", line: "L15", primitive: "A4" },
      { type: "lineCircleTangent", line: "L15", primitive: "A5" },
    ],
  },
  { name: "line-l19-angle", descriptor: { kind: "line", id: "L19" }, removed: [{ type: "lineAngle", line1: "L19", line2: "L6" }] },
  { name: "circle-c1-concentric", descriptor: { kind: "circle", id: "C1" }, removed: [{ type: "concentric", a: "C2", b: "C1" }] },
  { name: "circle-c2-diameter", descriptor: { kind: "circle", id: "C2" }, removed: [{ type: "diameterDimension", primitive: "C2" }] },
  { name: "circle-c3-diameter", descriptor: { kind: "circle", id: "C3" }, removed: [{ type: "diameterDimension", primitive: "C3" }] },
  { name: "circle-c4-diameter", descriptor: { kind: "circle", id: "C4" }, removed: [{ type: "diameterDimension", primitive: "C4" }] },
  {
    name: "circle-c3-two-center-relations",
    descriptor: { kind: "circle", id: "C3" },
    removed: [
      { type: "lineFixed", line: "L5" },
      { type: "coincident", p1: "P17", p2: "P7" },
    ],
  },
  {
    name: "circle-c4-two-center-relations",
    descriptor: { kind: "circle", id: "C4" },
    removed: [
      { type: "coincident", p1: "P17", p2: "P7" },
      { type: "distance", p1: "P17", p2: "P46" },
    ],
  },
  { name: "arc-a1-tangent", descriptor: { kind: "arc", id: "A1" }, removed: [{ type: "lineCircleTangent", line: "L8", primitive: "A1" }] },
  {
    name: "arc-a1-two-tangencies",
    descriptor: { kind: "arc", id: "A1" },
    removed: [
      { type: "lineCircleTangent", line: "L8", primitive: "A1" },
      { type: "lineCircleTangent", line: "L9", primitive: "A1" },
    ],
  },
  { name: "arc-a2-center-distance", descriptor: { kind: "arc", id: "A2" }, removed: [{ type: "distance", p1: "P27", p2: "P26" }] },
  {
    name: "arc-a2-radius-and-tangencies",
    descriptor: { kind: "arc", id: "A2" },
    removed: [
      { type: "radiusDimension", primitive: "A2" },
      { type: "lineCircleTangent", line: "L8", primitive: "A2" },
      { type: "lineCircleTangent", line: "L9", primitive: "A2" },
    ],
  },
  { name: "arc-a4-tangent", descriptor: { kind: "arc", id: "A4" }, removed: [{ type: "lineCircleTangent", line: "L15", primitive: "A4" }] },
  {
    name: "arc-a4-radius-and-tangent",
    descriptor: { kind: "arc", id: "A4" },
    removed: [
      { type: "radiusDimension", primitive: "A4" },
      { type: "lineCircleTangent", line: "L15", primitive: "A4" },
    ],
  },
  {
    name: "arc-a7-two-tangencies",
    descriptor: { kind: "arc", id: "A7" },
    removed: [
      { type: "circleCircleTangent", a: "C2", b: "A7" },
      { type: "lineCircleTangent", line: "L13", primitive: "A7" },
    ],
  },
  {
    name: "arc-a7-radius-and-tangencies",
    descriptor: { kind: "arc", id: "A7" },
    removed: [
      { type: "radiusDimension", primitive: "A7" },
      { type: "circleCircleTangent", a: "C2", b: "A7" },
      { type: "lineCircleTangent", line: "L13", primitive: "A7" },
    ],
  },
  {
    name: "arc-a8-three-relations",
    descriptor: { kind: "arc", id: "A8" },
    removed: [
      { type: "circleCircleTangent", a: "C2", b: "A8" },
      { type: "radiusDimension", primitive: "A8" },
      { type: "arcEndpointOnCircle", arc: "A8", endpoint: "start", primitive: "C2" },
    ],
  },
  { name: "arc-a11-radius", descriptor: { kind: "arc", id: "A11" }, removed: [{ type: "radiusDimension", primitive: "A11" }] },
  { name: "arc-a14-radius", descriptor: { kind: "arc", id: "A14" }, removed: [{ type: "radiusDimension", primitive: "A14" }] },
  {
    name: "arc-a5-radius-and-tangencies",
    descriptor: { kind: "arc", id: "A5" },
    removed: [
      { type: "radiusDimension", primitive: "A5" },
      { type: "lineCircleTangent", line: "L14", primitive: "A5" },
      { type: "lineCircleTangent", line: "L13", primitive: "A5" },
    ],
  },
  {
    name: "arc-a6-equality-and-tangencies",
    descriptor: { kind: "arc", id: "A6" },
    removed: [
      { type: "equalRadius", a: "A5", b: "A6" },
      { type: "lineCircleTangent", line: "L14", primitive: "A6" },
      { type: "lineCircleTangent", line: "L13", primitive: "A6" },
    ],
  },
  {
    name: "arc-a18-two-radius-relations",
    descriptor: { kind: "arc", id: "A18" },
    removed: [
      { type: "equalRadius", a: "A8", b: "A18" },
      { type: "circleCircleTangent", a: "A18", b: "A4" },
    ],
  },
  {
    name: "arc-endpoint-a7-line",
    descriptor: { kind: "arc-endpoint", id: "A7", endpoint: "end" },
    removed: [{ type: "arcEndpointOnLine", arc: "A7", endpoint: "end", line: "L13" }],
  },
  {
    name: "arc-endpoint-a8-circle",
    descriptor: { kind: "arc-endpoint", id: "A8", endpoint: "start" },
    removed: [{ type: "arcEndpointOnCircle", arc: "A8", endpoint: "start", primitive: "C2" }],
  },
  {
    name: "arc-endpoint-a14-coincident",
    descriptor: { kind: "arc-endpoint", id: "A14", endpoint: "start" },
    removed: [{ type: "arcEndpointArcEndpointCoincident", a: "A14", endpointA: "start", b: "A13", endpointB: "end" }],
  },
  {
    name: "arc-endpoint-a18-coincident",
    descriptor: { kind: "arc-endpoint", id: "A18", endpoint: "start" },
    removed: [{ type: "arcEndpointArcEndpointCoincident", a: "A4", endpointA: "start", b: "A18", endpointB: "start" }],
  },
];

test.beforeAll(async () => {
  serverProcess = spawn(process.execPath, ["tools/serve.js", "--host", host, "--port", String(port)], {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "ignore",
  });
  await waitForServer(`${baseUrl}/index.html`);
});

test.afterAll(() => {
  if (serverProcess) serverProcess.kill();
});

test("keeps additional point, line, circle, arc, and endpoint drags smooth", async ({ page }) => {
  test.setTimeout(600000);
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const summaries = [];
  const selectedVariants = process.env.CAD_GEOMETRY_VARIANT
    ? variants.filter((variant) => variant.name === process.env.CAD_GEOMETRY_VARIANT)
    : variants;
  const selectedDragPaths = process.env.CAD_GEOMETRY_PATH
    ? dragPaths.filter((dragPath) => dragPath.name === process.env.CAD_GEOMETRY_PATH)
    : dragPaths;
  for (const variant of selectedVariants) {
    const fixture = fixtureWithoutConstraints(variant.removed);
    const failures = [];
    let movingPaths = 0;
    let maxIterations = 0;
    let maxElapsedMs = 0;
    let maxJumpRatio = 0;
    let maxMovement = 0;
    let worstPath = null;
    for (const dragPath of selectedDragPaths) {
      await page.evaluate(
        ({ data, fileName }) => window.__jot2dTest.importDocumentNameFixture(data, fileName),
        { data: fixture, fileName: `${variant.name}.json` },
      );
      const result = await page.evaluate(
        ({ descriptor, deltas }) => window.__jot2dTest.geometryDragPathForTest(descriptor, deltas),
        { descriptor: variant.descriptor, deltas: dragPath.deltas },
      );
      if (!result?.sessionAvailable) {
        failures.push(`${dragPath.name}: session unavailable`);
        continue;
      }
      const states = [result.startState, ...result.previews.map((preview) => preview.state)];
      let pathMovement = 0;
      let previousDelta = [0, 0];
      for (let index = 0; index < result.previews.length; index += 1) {
        const preview = result.previews[index];
        const movement = geometryStateDistance(variant.descriptor, states[index], states[index + 1]);
        const delta = dragPath.deltas[index];
        const cursorStep = Math.hypot(delta[0] - previousDelta[0], delta[1] - previousDelta[1]);
        const jumpRatio = movement / Math.max(cursorStep, 0.25);
        pathMovement += movement;
        maxIterations = Math.max(maxIterations, preview.iterations || 0);
        maxElapsedMs = Math.max(maxElapsedMs, preview.elapsedMs || 0);
        if (jumpRatio > maxJumpRatio) {
          maxJumpRatio = jumpRatio;
          maxMovement = movement;
          worstPath = `${dragPath.name}#${index + 1}`;
        }
        if (!preview.success || preview.blocked) failures.push(`${dragPath.name}#${index + 1}: preview failed`);
        if (!Number.isFinite(preview.errorNorm) || preview.errorNorm > preview.acceptError + 1e-9) {
          failures.push(`${dragPath.name}#${index + 1}: error ${preview.errorNorm}/${preview.acceptError}`);
        }
        if ((preview.iterations || 0) >= 20) failures.push(`${dragPath.name}#${index + 1}: ${preview.iterations} iterations`);
        if (movement > cursorStep * 2.25 + 0.5) {
          failures.push(`${dragPath.name}#${index + 1}: ${movement} movement for ${cursorStep} cursor step`);
        }
        if ((preview.elapsedMs || 0) > 250) failures.push(`${dragPath.name}#${index + 1}: ${preview.elapsedMs}ms preview`);
        previousDelta = delta;
      }
      if (pathMovement > 1e-5) movingPaths += 1;
      if (!result.final?.success) failures.push(`${dragPath.name}: final solve failed`);
      if (!Number.isFinite(result.final?.baseErrorNorm) || result.final.baseErrorNorm >= 1e-4) {
        failures.push(`${dragPath.name}: final base error ${result.final?.baseErrorNorm}`);
      }
    }
    if (expectedImmobileVariants.has(variant.name)) {
      if (movingPaths !== 0) failures.push(`expected stable no-op but moved in ${movingPaths} paths`);
    } else if (movingPaths === 0) {
      failures.push("never moved in any path");
    }
    summaries.push({
      name: variant.name,
      kind: variant.descriptor.kind,
      removed: variant.removed.length,
      paths: selectedDragPaths.length,
      movingPaths,
      maxIterations,
      maxElapsedMs,
      maxJumpRatio,
      maxMovement,
      worstPath,
      failures,
    });
  }
  console.log(JSON.stringify(summaries));
  expect(summaries).toHaveLength(selectedVariants.length);
  expect(summaries.flatMap((summary) => summary.failures.map((failure) => `${summary.name}: ${failure}`))).toEqual([]);
});

test("moves arcs by their centers when an indirectly constrained radius has no drag freedom", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = fixtureWithoutConstraints([
    { type: "pointAxisDistance", p1: "P27", p2: "P46", axis: "x" },
  ]);

  for (const id of ["A1", "A2", "A5", "A6"]) {
    await page.evaluate(
      ({ data, fileName }) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, fileName),
      { data: fixture, fileName: `indirect-radius-${id}.json` },
    );
    const result = await page.evaluate(
      ({ target, deltas }) => window.__jot2dTest.geometryDragPathForTest(target, deltas),
      { target: { kind: "arc", id }, deltas: [[10, 0], [20, 0]] },
    );
    const centerMovement = pointDistance(result.startState.center, result.previews.at(-1).state.center);
    expect(result.sessionAvailable, id).toBe(true);
    expect(centerMovement, `${id}: ${JSON.stringify(result)}`).toBeGreaterThan(5);
    expect(result.final.success, id).toBe(true);
    expect(result.final.baseErrorNorm, id).toBeLessThan(1e-4);
  }
});
