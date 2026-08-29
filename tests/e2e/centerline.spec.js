const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.JOT2D_E2E_PORT || 8765) + 9;
const baseUrl = `http://${host}:${port}`;
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

function centerlineFixture() {
  return {
    version: 8,
    documentName: "Centerline fixture",
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root" },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch" },
    ],
    activeSketchId: "S1",
    blockDefinitions: [],
    blockInstances: [],
    points: [
      { id: "P1", x: -100, y: -50, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P2", x: 100, y: -50, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P3", x: -100, y: 50, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P4", x: 100, y: 50, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P5", x: 0, y: -50, fixed: false, kind: "explicit", sketchId: "S1" },
      { id: "P6", x: -60, y: 120, fixed: true, kind: "explicit", sketchId: "S1" },
      { id: "P7", x: 60, y: 120, fixed: true, kind: "explicit", sketchId: "S1" },
      { id: "P8", x: -75, y: -30, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P9", x: -75, y: 30, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P10", x: 65, y: -30, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P11", x: 65, y: 30, fixed: true, kind: "endpoint", sketchId: "S1" },
    ],
    lines: [
      { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" },
      { id: "L2", p1: "P3", p2: "P4", construction: false, sketchId: "S1" },
      { id: "L3", p1: "P8", p2: "P9", construction: false, sketchId: "S1" },
      { id: "L4", p1: "P10", p2: "P11", construction: false, sketchId: "S1" },
    ],
    circles: [],
    arcs: [],
    constraints: [
      { type: "pointOnLineMidpoint", point: "P5", line: "L1", enabled: true, sketchId: "S1" },
    ],
  };
}

async function openFixture(page) {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const loaded = await page.evaluate((fixture) => {
    const result = window.__jot2dTest.loadDocumentFixtureForDragTest(fixture, "centerline-v8.json");
    const viewport = window.__jot2dTest.focusWorldForTest({ x: 0, y: 35 }, 2);
    return { result, viewport };
  }, centerlineFixture());
  expect(loaded.result.success).toBe(true);
  return loaded.viewport;
}

async function clickWorld(page, point) {
  const client = await page.evaluate((value) => window.__jot2dTest.worldClientPositionForTest(value), point);
  await page.mouse.click(client.x, client.y);
}

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

test("legacy midpoint constraints are removed and midpoint snapping is no longer offered", async ({ page }) => {
  await openFixture(page);
  let serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.version).toBe(16);
  expect(serialized.constraints.some((constraint) => constraint.type === "pointOnLineMidpoint")).toBe(false);

  await page.click("#toolPoint");
  const snapLabels = await page.evaluate(() => window.__jot2dTest.snapLabelsAtWorldForTest({ x: 0, y: -50 }));
  expect(snapLabels).not.toContain("中点");
  await clickWorld(page, { x: 0, y: -50 });
  serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.constraints.some((constraint) => constraint.type === "pointOnLineMidpoint")).toBe(false);

  const compatibility = await page.evaluate(() => {
    const current = window.__jot2dTest.serializedModelForTest();
    const oldConstraint = { type: "pointOnLineMidpoint", point: "P5", line: "L1", enabled: true, sketchId: "S1" };
    const legacy = structuredClone(current);
    legacy.version = 15;
    legacy.constraints.push(oldConstraint);
    const legacyResult = window.__jot2dTest.loadDocumentFixtureForDragTest(legacy, "legacy-centerline-v15.jot2d");
    const migrated = window.__jot2dTest.serializedModelForTest();
    const invalidCurrent = structuredClone(migrated);
    invalidCurrent.documentName = "Rejected current midpoint";
    invalidCurrent.constraints.push(oldConstraint);
    const invalidResult = window.__jot2dTest.loadDocumentFixtureForDragTest(invalidCurrent, "invalid-centerline-v16.jot2d");
    const afterRejected = window.__jot2dTest.serializedModelForTest();
    const invalidBlock = structuredClone(migrated);
    invalidBlock.documentName = "Rejected block midpoint";
    invalidBlock.blockDefinitions = [{
      id: "B1",
      name: "Invalid midpoint block",
      parentDefinitionId: null,
      revision: 0,
      origin: { x: 0, y: 0 },
      sketches: [
        { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
        { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
      ],
      activeSketchId: "S1",
      parameters: [],
      nextDimensionParameterIndex: 1,
      points: [
        { id: "BP1", x: -10, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
        { id: "BP2", x: 10, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
        { id: "BP3", x: 0, y: 0, fixed: false, kind: "explicit", sketchId: "S1", appearance: {} },
      ],
      lines: [{ id: "BL1", p1: "BP1", p2: "BP2", construction: false, sketchId: "S1", appearance: {} }],
      circles: [], arcs: [], splines: [], annotations: [], hatches: [], nextHatchIndex: 1, blockInstances: [],
      constraints: [{ type: "pointOnLineMidpoint", point: "BP3", line: "BL1", enabled: true, sketchId: "S1" }],
    }];
    const invalidBlockResult = window.__jot2dTest.loadDocumentFixtureForDragTest(invalidBlock, "invalid-block-centerline-v16.jot2d");
    return { legacyResult, migrated, invalidResult, afterRejected, invalidBlockResult, afterBlockRejected: window.__jot2dTest.serializedModelForTest() };
  });
  expect(compatibility.legacyResult).toEqual(expect.objectContaining({ success: true }));
  expect(compatibility.migrated.constraints.some((constraint) => constraint.type === "pointOnLineMidpoint")).toBe(false);
  expect(compatibility.invalidResult).toEqual(expect.objectContaining({ success: false }));
  expect(compatibility.afterRejected.documentName).toBe(compatibility.migrated.documentName);
  expect(compatibility.invalidBlockResult).toEqual(expect.objectContaining({ success: false }));
  expect(compatibility.afterBlockRejected.documentName).toBe(compatibility.migrated.documentName);
});

test("centerline command creates an associative line between two parallel support lines", async ({ page }) => {
  await openFixture(page);
  await expect(page.locator("#toolCenterline")).toBeVisible();
  await expect(page.locator("#toolCenterline svg path").first()).toHaveAttribute("d", "M6 5v14M18 5v14");
  await page.click("#toolCenterline");
  await clickWorld(page, { x: -25, y: -50 });
  await clickWorld(page, { x: -75, y: 0 });
  expect((await page.evaluate(() => window.__jot2dTest.authoringStateForTest())).centerlineTargetIds).toEqual(["L1"]);
  await clickWorld(page, { x: 25, y: 50 });
  expect((await page.evaluate(() => window.__jot2dTest.authoringStateForTest())).centerlineTargetIds).toEqual(["L1", "L2"]);
  await clickWorld(page, { x: -75, y: 0 });
  await clickWorld(page, { x: 65, y: 0 });

  const state = await page.evaluate(() => ({
    authoring: window.__jot2dTest.authoringStateForTest(),
    model: window.__jot2dTest.serializedModelForTest(),
  }));
  expect(state.authoring.mode).toBe("select");
  expect(state.authoring.lastLine).toEqual(expect.objectContaining({ construction: true }));
  expect(state.authoring.lastConstraint).toMatchObject({ type: "parallelLinesCenterline", line1: "L1", line2: "L2" });
  const centerline = state.model.lines.find((line) => line.id === state.authoring.lastLine.id);
  const points = new Map(state.model.points.map((point) => [point.id, point]));
  expect(points.get(centerline.p1).y).toBeCloseTo(0, 6);
  expect(points.get(centerline.p2).y).toBeCloseTo(0, 6);
  expect(state.model.constraints).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "pointOnLine", point: centerline.p1, line: "L3" }),
    expect.objectContaining({ type: "pointOnLine", point: centerline.p2, line: "L4" }),
  ]));
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "centerline-roundtrip.jot2d"), state.model)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "parallelLinesCenterline", line1: "L1", line2: "L2", centerline: centerline.id }),
  ]));
});

test("centerline command creates a mouse-sized perpendicular bisector from two points", async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ points: ["P6", "P7"] }));
  await page.click("#toolCenterline");
  await clickWorld(page, { x: 18, y: 70 });
  await clickWorld(page, { x: -20, y: 180 });

  const state = await page.evaluate(() => ({
    authoring: window.__jot2dTest.authoringStateForTest(),
    model: window.__jot2dTest.serializedModelForTest(),
  }));
  expect(state.authoring.lastConstraint).toMatchObject({ type: "pointPairCenterline", p1: "P6", p2: "P7" });
  const centerline = state.model.lines.find((line) => line.id === state.authoring.lastLine.id);
  const points = new Map(state.model.points.map((point) => [point.id, point]));
  expect(points.get(centerline.p1).x).toBeCloseTo(0, 6);
  expect(points.get(centerline.p2).x).toBeCloseTo(0, 6);
  expect(Math.abs(points.get(centerline.p2).y - points.get(centerline.p1).y)).toBeGreaterThan(100);
});
