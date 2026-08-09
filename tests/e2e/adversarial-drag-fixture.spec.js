const { test, expect } = require("@playwright/test");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.CAD2_E2E_PORT || 8765) + 6;
const baseUrl = `http://${host}:${port}`;
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../test-data/意地悪ドラッグ完全拘束.json"), "utf8"));
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
  const copy = structuredClone(fixture);
  copy.constraints = copy.constraints.filter((constraint) =>
    !selectors.some((selector) => matchesConstraint(constraint, selector)),
  );
  expect(fixture.constraints.length - copy.constraints.length).toBe(selectors.length);
  return copy;
}

function pathStepLengths(deltas) {
  let previous = [0, 0];
  return deltas.map((delta) => {
    const length = Math.hypot(delta[0] - previous[0], delta[1] - previous[1]);
    previous = delta;
    return length;
  });
}

function pointDistance(a, b) {
  return Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0));
}

function geometryStateDistance(descriptor, before, after) {
  if (descriptor.kind === "point") return pointDistance(before, after);
  if (descriptor.kind === "line") {
    return Math.max(pointDistance(before.p1, after.p1), pointDistance(before.p2, after.p2), pointDistance(before.midpoint, after.midpoint));
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

function linearPath(dx, dy, steps) {
  return Array.from({ length: steps }, (_, index) => [dx * (index + 1) / steps, dy * (index + 1) / steps]);
}

const dragPaths = [
  { name: "small-slow-east", deltas: linearPath(2, 0, 8) },
  { name: "small-fast-south-west", deltas: linearPath(-2, 2, 2) },
  { name: "large-slow-north", deltas: linearPath(0, -80, 12) },
  { name: "large-fast-south-east", deltas: linearPath(80, 80, 2) },
  { name: "reverse", deltas: [[15, 0], [30, 0], [15, 0], [0, 0], [-15, 0], [0, 0]] },
  { name: "zigzag", deltas: [[10, 8], [20, -8], [30, 8], [40, -8], [50, 8]] },
  {
    name: "circle",
    deltas: Array.from({ length: 12 }, (_, index) => {
      const angle = Math.PI * 2 * (index + 1) / 12;
      return [20 * Math.cos(angle), 20 * Math.sin(angle)];
    }),
  },
  { name: "jump-reverse", deltas: [[80, 0], [-80, 0], [0, 80], [0, -80], [0, 0]] },
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

test("adversarial mixed-scale fixture is completely constrained", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((data) => window.__cadTest.importDocumentNameFixture(data, "意地悪ドラッグ完全拘束.json"), fixture);
  const analysis = await page.evaluate(() => window.__cadTest.constraintAnalysisForTest());

  expect(analysis.stable).toBe(true);
  expect(analysis.errorNorm).toBeLessThan(1e-4);
  expect(analysis.freeVariableCount).toBe(0);
  expect(analysis).toEqual(expect.objectContaining({
    pointCount: 118,
    lineCount: 59,
    circleCount: 13,
    arcCount: 15,
    constraintCount: 149,
  }));
});

test("recommended removals expose smooth draggable degrees of freedom", async ({ page }) => {
  test.setTimeout(600000);
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const summaries = [];
  const selectedCases = process.env.CAD_ADVERSARIAL_CASE
    ? fixture.testPlan.recommendedCases.filter((testCase) => testCase.name === process.env.CAD_ADVERSARIAL_CASE)
    : fixture.testPlan.recommendedCases;
  const selectedPaths = process.env.CAD_ADVERSARIAL_PATH
    ? dragPaths.filter((dragPath) => dragPath.name === process.env.CAD_ADVERSARIAL_PATH)
    : dragPaths;

  for (const testCase of selectedCases) {
    const reducedFixture = fixtureWithoutConstraints(testCase.removed);
    await page.evaluate(
      ({ data, fileName }) => window.__cadTest.importDocumentNameFixture(data, fileName),
      { data: reducedFixture, fileName: `${testCase.name}.json` },
    );
    const analysis = await page.evaluate(() => window.__cadTest.constraintAnalysisForTest());
    expect(analysis.stable, testCase.name).toBe(true);
    expect(analysis.errorNorm, testCase.name).toBeLessThan(1e-4);
    expect(analysis.freeVariableCount, testCase.name).toBeGreaterThan(0);

    let movingPaths = 0;
    let maxIterations = 0;
    let maxElapsedMs = 0;
    for (const descriptor of testCase.drags) {
      for (const dragPath of selectedPaths) {
        await page.evaluate(
          ({ data, fileName }) => window.__cadTest.importDocumentNameFixture(data, fileName),
          { data: reducedFixture, fileName: `${testCase.name}-${dragPath.name}.json` },
        );
        const result = await page.evaluate(
          ({ target, deltas }) => window.__cadTest.geometryDragPathForTest(target, deltas),
          { target: descriptor, deltas: dragPath.deltas },
        );
        const label = `${testCase.name}/${descriptor.kind}:${descriptor.id}/${dragPath.name}`;
        expect(result?.sessionAvailable, label).toBe(true);
        const states = [result.startState, ...result.previews.map((preview) => preview.state)];
        const cursorSteps = pathStepLengths(dragPath.deltas);
        let totalMovement = 0;
        for (let index = 0; index < result.previews.length; index += 1) {
          const preview = result.previews[index];
          const movement = geometryStateDistance(descriptor, states[index], states[index + 1]);
          totalMovement += movement;
          maxIterations = Math.max(maxIterations, preview.iterations || 0);
          maxElapsedMs = Math.max(maxElapsedMs, preview.elapsedMs || 0);
          expect(preview.success, `${label}#${index + 1}`).toBe(true);
          expect(preview.blocked, `${label}#${index + 1}`).not.toBe(true);
          expect(preview.errorNorm, `${label}#${index + 1}`).toBeLessThanOrEqual(preview.acceptError + 1e-9);
          expect(preview.iterations, `${label}#${index + 1}`).toBeLessThan(40);
          expect(preview.elapsedMs, `${label}#${index + 1}`).toBeLessThan(500);
          expect(movement, `${label}#${index + 1}`).toBeLessThanOrEqual(cursorSteps[index] * 3 + 1);
        }
        if (totalMovement > 1e-5) movingPaths += 1;
        expect(result.final.success, `${label}/release`).toBe(true);
        expect(result.final.baseErrorNorm, `${label}/release`).toBeLessThan(1e-4);
      }
    }
    expect(movingPaths, `${testCase.name} should move`).toBeGreaterThan(0);
    summaries.push({
      name: testCase.name,
      removed: testCase.removed.length,
      targets: testCase.drags.length,
      paths: testCase.drags.length * selectedPaths.length,
      freeVariableCount: analysis.freeVariableCount,
      movingPaths,
      maxIterations,
      maxElapsedMs,
    });
  }

  console.log(JSON.stringify(summaries));
  expect(summaries).toHaveLength(selectedCases.length);
});
