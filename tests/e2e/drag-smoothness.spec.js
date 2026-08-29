const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.JOT2D_E2E_PORT || 8765) + 2;
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
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 100);
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

function straightPath(distance, steps, ux, uy) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    return [distance * progress * ux, distance * progress * uy];
  });
}

function interpolatePath(keyframes, stepsPerLeg) {
  const result = [];
  let from = [0, 0];
  for (const to of keyframes) {
    for (let step = 1; step <= stepsPerLeg; step++) {
      const t = step / stepsPerLeg;
      result.push([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ]);
    }
    from = to;
  }
  return result;
}

function circularPath(radius, steps) {
  return Array.from({ length: steps }, (_, index) => {
    const angle = ((index + 1) / steps) * Math.PI * 2;
    return [radius * (Math.cos(angle) - 1), radius * Math.sin(angle)];
  });
}

function pathStepLengths(deltas) {
  const points = [[0, 0], ...deltas];
  return deltas.map((_, index) => Math.hypot(
    points[index + 1][0] - points[index][0],
    points[index + 1][1] - points[index][1],
  ));
}

const directions = Array.from({ length: 8 }, (_, index) => {
  const angle = index * Math.PI / 4;
  return { name: `${index * 45}deg`, ux: Math.cos(angle), uy: Math.sin(angle) };
});

const profiles = [
  { name: "small-slow", distance: 2, steps: 16 },
  { name: "small-fast", distance: 2, steps: 2 },
  { name: "large-slow", distance: 80, steps: 24 },
  { name: "large-fast", distance: 80, steps: 2 },
];

const motionProfiles = [
  {
    name: "reverse-slow",
    deltas: interpolatePath([[30, 0], [-30, 0], [0, 0]], 8),
  },
  {
    name: "zigzag-slow",
    deltas: Array.from({ length: 24 }, (_, index) => {
      const progress = (index + 1) / 24;
      return [40 * progress, 10 * Math.sin(progress * Math.PI * 6)];
    }),
  },
  {
    name: "circle-slow",
    deltas: circularPath(20, 32),
  },
  {
    name: "jump-reverse-fast",
    deltas: [[40, 0], [-40, 0], [0, 40], [0, -40], [0, 0]],
  },
];

const variants = [
  { name: "baseline-p26", pointId: "P26", removed: [], mobility: "none" },
  { name: "baseline-p44", pointId: "P44", removed: [] },
  {
    name: "one-horizontal-p26",
    pointId: "P26",
    mobility: "y",
    removed: [{ type: "horizontal", line: "L11" }],
  },
  {
    name: "one-distance-p26",
    pointId: "P26",
    mobility: "x",
    removed: [{ type: "distance", p1: "P27", p2: "P26" }],
  },
  {
    name: "two-local-p26",
    pointId: "P26",
    mobility: "xy",
    removed: [
      { type: "horizontal", line: "L11" },
      { type: "distance", p1: "P27", p2: "P26" },
    ],
  },
  {
    name: "one-tangent-p44",
    pointId: "P44",
    mobility: "none",
    removed: [{ type: "circleCircleTangent", a: "C2", b: "A8" }],
  },
  {
    name: "three-local-p44",
    pointId: "P44",
    mobility: "xy",
    removed: [
      { type: "circleCircleTangent", a: "C2", b: "A8" },
      { type: "radiusDimension", primitive: "A8" },
      { type: "arcEndpointOnCircle", arc: "A8", endpoint: "start", primitive: "C2" },
    ],
  },
];

test.beforeAll(async () => {
  try {
    await waitForServer(`${baseUrl}/index.html`, 300);
    return;
  } catch (_) {
    // Start our local static server below.
  }
  serverProcess = spawn(process.execPath, ["tools/serve.js", "--host", host, "--port", String(port)], {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "ignore",
  });
  await waitForServer(`${baseUrl}/index.html`);
});

test.afterAll(() => {
  if (serverProcess) serverProcess.kill();
});

async function runPathCase(page, fixture, variant, caseName, deltas) {
  await page.evaluate(
    ({ fixture: data, fileName }) => window.__jot2dTest.importDocumentNameFixture(data, fileName),
    { fixture, fileName: `${variant.name}.json` },
  );
  const result = await page.evaluate(
    ({ pointId, pathDeltas }) => window.__jot2dTest.guidedPointDragPathForTest(pointId, pathDeltas),
    { pointId: variant.pointId, pathDeltas: deltas },
  );
  expect(result, caseName).not.toBeNull();
  expect(result.previews, caseName).toHaveLength(deltas.length);

  const points = [result.startPoint, ...result.previews.map((preview) => preview.point)];
  const pointSteps = result.previews.map((_, index) => Math.hypot(
    points[index + 1].x - points[index].x,
    points[index + 1].y - points[index].y,
  ));
  const cursorSteps = pathStepLengths(deltas);
  for (let index = 0; index < result.previews.length; index++) {
    const preview = result.previews[index];
    const stepLabel = `${caseName} event ${index + 1}`;
    expect(preview.success, stepLabel).toBe(true);
    expect(preview.blocked, stepLabel).not.toBe(true);
    expect(Number.isFinite(preview.errorNorm), stepLabel).toBe(true);
    expect(preview.errorNorm, stepLabel).toBeLessThanOrEqual((preview.acceptError ?? 1e-4) + 1e-9);
    expect(preview.iterations, stepLabel).toBeLessThan(40);
    // A constrained point may move less than the pointer, but it must never make
    // a remote branch jump that is disproportionate to this pointer event.
    expect(pointSteps[index], stepLabel).toBeLessThanOrEqual(cursorSteps[index] * 3 + 0.25);
  }
  expect(result.final.success, `${caseName} release`).toBe(true);
  expect(result.final.baseErrorNorm, `${caseName} release`).toBeLessThan(1e-4);

  const totalMovement = pointSteps.reduce((sum, value) => sum + value, 0);
  const totalCursorMovement = cursorSteps.reduce((sum, value) => sum + value, 0);
  const movingSteps = pointSteps.filter((value) => value > 1e-5).length;
  return {
    caseName,
    totalMovement,
    totalCursorMovement,
    movingSteps,
    stepCount: deltas.length,
    endpoint: result.final.point,
    maxIterations: Math.max(...result.previews.map((preview) => preview.iterations)),
    maxElapsedMs: Math.max(...result.previews.map((preview) => preview.elapsedMs)),
    maxJumpRatio: Math.max(...pointSteps.map((value, index) => value / Math.max(cursorSteps[index], 1e-9))),
  };
}

function expectStraightMovement(variant, profile, direction, summary) {
  const label = `${variant.name} ${profile.name} ${direction.name}`;
  if (variant.mobility === "none") {
    expect(summary.totalMovement, label).toBeLessThanOrEqual(1e-3);
    return;
  }
  if (variant.mobility === "xy") {
    expect(summary.movingSteps, label).toBe(summary.stepCount);
    expect(summary.totalMovement, label).toBeGreaterThan(profile.distance * 0.2);
    return;
  }
  if (variant.mobility === "x" || variant.mobility === "y") {
    const component = Math.abs(variant.mobility === "x" ? direction.ux : direction.uy);
    if (component < 1e-8) {
      expect(summary.totalMovement, label).toBeLessThanOrEqual(1e-3);
    } else {
      expect(summary.movingSteps, label).toBe(summary.stepCount);
      expect(summary.totalMovement, label).toBeGreaterThan(profile.distance * component * 0.8);
    }
  }
}

for (const variant of variants) {
  test(`keeps ${variant.name} smooth across constraint, motion, speed, size, and direction patterns`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(`${baseUrl}/index.html?test=1`);
    await page.waitForFunction(() => window.__jot2dTest);

    const summaries = [];
    const fixture = fixtureWithoutConstraints(variant.removed);
    const straightSummaries = new Map();
    for (const profile of profiles) {
      for (const direction of directions) {
        const deltas = straightPath(profile.distance, profile.steps, direction.ux, direction.uy);
        const caseName = `${variant.name} ${profile.name} ${direction.name}`;
        const summary = await runPathCase(page, fixture, variant, caseName, deltas);
        expectStraightMovement(variant, profile, direction, summary);
        straightSummaries.set(`${profile.name}:${direction.name}`, summary);
        summaries.push(summary);
      }
    }

    for (const direction of directions) {
      for (const [size, tolerance] of [["small", 0.5], ["large", 15]]) {
        const slow = straightSummaries.get(`${size}-slow:${direction.name}`);
        const fast = straightSummaries.get(`${size}-fast:${direction.name}`);
        expect(Math.hypot(slow.endpoint.x - fast.endpoint.x, slow.endpoint.y - fast.endpoint.y),
          `${variant.name} ${size} ${direction.name} speed consistency`).toBeLessThanOrEqual(tolerance);
      }
    }

    for (const motion of motionProfiles) {
      const summary = await runPathCase(page, fixture, variant, `${variant.name} ${motion.name}`, motion.deltas);
      if (variant.mobility === "none") expect(summary.totalMovement, summary.caseName).toBeLessThanOrEqual(1e-3);
      if (variant.mobility === "xy") {
        expect(summary.movingSteps, summary.caseName).toBeGreaterThanOrEqual(Math.floor(summary.stepCount * 0.7));
        expect(summary.totalMovement, summary.caseName).toBeGreaterThan(summary.totalCursorMovement * 0.1);
      }
      summaries.push(summary);
    }

    console.log(JSON.stringify({
      variant: variant.name,
      removedConstraints: variant.removed.length,
      cases: summaries.length,
      maxIterations: Math.max(...summaries.map((summary) => summary.maxIterations)),
      maxElapsedMs: Math.max(...summaries.map((summary) => summary.maxElapsedMs)),
      maxJumpRatio: Math.max(...summaries.map((summary) => summary.maxJumpRatio)),
      slowestCase: [...summaries].sort((a, b) => b.maxElapsedMs - a.maxElapsedMs)[0].caseName,
    }));
    expect(summaries).toHaveLength(profiles.length * directions.length + motionProfiles.length);
  });
}
