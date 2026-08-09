const { test, expect } = require("@playwright/test");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.CAD2_E2E_PORT || 8765) + 1;
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

function constrainedBlockGridFixture({ fixed = false } = {}) {
  const sketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
  ];
  const instances = [
    ["BI10", 0, 0],
    ["BI11", 0, 500],
    ["BI12", -500, 0],
    ["BI13", -500, 500],
    ["BI14", -500, 1000],
    ["BI15", 0, 1000],
  ].map(([id, x, y]) => ({
    id,
    definitionId: "B1",
    sketchId: "S1",
    x,
    y,
    rotation: 0,
    fixed,
    enabledSketchIds: ["S1"],
  }));
  const constraints = [
    ...["BI11", "BI10", "BI13", "BI14", "BI15"].map((id) => ({ type: "horizontal", line: `${id}@L1`, enabled: true, sketchId: "S1" })),
    { type: "collinear", line1: "BI12@L3", line2: "BI13@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI12@L4", line2: "BI13@L4", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI13@L4", line2: "BI14@L4", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI13@L3", line2: "BI14@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI15@L4", line2: "BI14@L2", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI15@L1", line2: "BI14@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI11@L4", line2: "BI13@L2", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI11@L3", line2: "BI15@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI10@L4", line2: "BI12@L2", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI10@L3", line2: "BI11@L1", enabled: true, sketchId: "S1" },
  ];
  return {
    version: 8,
    documentName: "Constrained Block Grid",
    appMode: "geometry",
    sketches,
    activeSketchId: "S1",
    presentationSheets: [{ id: "PS1", name: "Sheet-1", visibleGeometrySketchIds: null, elementStyles: {}, elements: [] }],
    activePresentationSheetId: "PS1",
    blockDefinitions: [{
      id: "B1",
      name: "Tile",
      revision: 1,
      origin: { x: 0, y: 0 },
      sketches,
      activeSketchId: "S1",
      points: [
        { id: "P1", x: -250, y: -250, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P2", x: 250, y: -250, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P3", x: 250, y: 250, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P4", x: -250, y: 250, fixed: false, kind: "endpoint", sketchId: "S1" },
      ],
      lines: [
        { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" },
        { id: "L2", p1: "P2", p2: "P3", construction: false, sketchId: "S1" },
        { id: "L3", p1: "P3", p2: "P4", construction: false, sketchId: "S1" },
        { id: "L4", p1: "P4", p2: "P1", construction: false, sketchId: "S1" },
      ],
      circles: [],
      arcs: [],
      constraints: [],
    }],
    blockInstances: instances,
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints,
  };
}

function guidedPointDragFixture({ x = 0, y = 100 } = {}) {
  return {
    version: 8,
    documentName: "Guided Point Drag",
    appMode: "geometry",
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
    ],
    activeSketchId: "S1",
    presentationSheets: [{ id: "PS1", name: "Sheet-1", visibleGeometrySketchIds: null, elementStyles: {}, elements: [] }],
    activePresentationSheetId: "PS1",
    blockDefinitions: [],
    blockInstances: [],
    points: [
      { id: "P0", x: 0, y: 0, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P26", x, y, fixed: false, kind: "endpoint", sketchId: "S1" },
    ],
    lines: [],
    circles: [
      { id: "C0", center: "P0", radius: 50, construction: false, sketchId: "S1" },
      { id: "C1", center: "P26", radius: 50, construction: false, sketchId: "S1" },
    ],
    arcs: [],
    constraints: [
      { type: "radiusDimension", primitive: "C0", target: 50, enabled: true, sketchId: "S1" },
      { type: "radiusDimension", primitive: "C1", target: 50, enabled: true, sketchId: "S1" },
      { type: "circleCircleTangent", a: "C0", b: "C1", mode: "external", enabled: true, sketchId: "S1" },
    ],
  };
}

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

test("creates, places, drags, edits, and reloads local-coordinate blocks", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const setup = await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await expect(page.locator("body")).toHaveClass(/block-editing/);
  await expect(page.locator("#blockEditorNameInput")).toBeVisible();
  await page.fill("#blockEditorNameInput", "Frame Block");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ editing: true, isNew: true, hostLineCount: 4, editorLineCount: 4 }));
  await page.click("#completeBlockEditBtn");

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toEqual([
    expect.objectContaining({ name: "Frame Block", points: 4, lines: 4, constraints: 4, activeSketchId: "S1", origin: { x: 0, y: 0 } }),
  ]);
  expect(state.definitions[0].sketches).toHaveLength(2);
  expect(state.instances).toHaveLength(1);
  expect(state.instances[0].enabledSketchIds).toEqual(["S1"]);
  expect(state.projectionLineIds).toHaveLength(4);
  expect(state.projectionLineIds.every((id) => /^BI\d+@L\d+$/.test(id))).toBe(true);
  expect(state.serialized.points).toHaveLength(0);
  expect(state.serialized.lines).toHaveLength(0);

  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  expect(interaction.handle).toBeNull();
  const before = state.instances[0];
  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + 70, interaction.center.y + 35, { steps: 4 });
  await page.mouse.up();
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].x).toBeCloseTo(before.x + 70 / interaction.scale, 3);
  expect(state.instances[0].y).toBeCloseTo(before.y + 35 / interaction.scale, 3);
  expect(state.instances[0].rotation).toBeCloseTo(before.rotation, 8);
  expect((await page.evaluate(() => window.__cadTest.blockInteractionPoints())).handle).toBeNull();

  const canvas = await page.locator("#canvas").boundingBox();
  await page.click(".blockPlaceBtn");
  await page.mouse.click(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.58);
  await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.58);
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances[1].rotation).toBeCloseTo(0, 6);

  const external = await page.evaluate(() => window.__cadTest.blockExternalConstraintCase());
  expect(external.success).toBe(true);
  expect(external.errorNorm).toBeLessThan(1e-5);
  expect(external.projectedError).toBeLessThan(1e-5);
  expect(external.localAfter).toEqual(external.localBefore);

  const readOnly = await page.evaluate(() => window.__cadTest.blockReadOnlyDimensionCase());
  expect(readOnly).toEqual(expect.objectContaining({ created: true, readOnly: true, enabled: false }));

  const edited = await page.evaluate(() => window.__cadTest.blockDefinitionUpdateCase());
  expect(edited.editing).toBe(false);
  expect(edited.revision).toBeGreaterThan(1);
  expect(edited.lengths).toHaveLength(2);
  expect(edited.lengths[0]).toBeGreaterThan(edited.before);
  expect(edited.lengths[1]).toBeCloseTo(edited.lengths[0], 6);

  const reloaded = await page.evaluate(() => window.__cadTest.reloadBlockState());
  expect(reloaded).toEqual({ definitions: 1, instances: 2, projectionLines: 8, serializedVersion: 8 });

  await page.click(".blockDeleteBtn");
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions).toHaveLength(1);
  await page.screenshot({ path: "test-results/block-instances.png", fullPage: true });
});

test("constrained block grids track a single pointer move without diluting drag distance", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "constrained-block-grid.json"), constrainedBlockGridFixture());

  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  const before = await page.evaluate(() => window.__cadTest.blockState().instances);
  const screenDx = 80;
  const screenDy = 40;
  const expectedDx = screenDx / interaction.scale;
  const expectedDy = screenDy / interaction.scale;

  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + screenDx, interaction.center.y + screenDy, { steps: 1 });
  await page.mouse.up();

  const after = await page.evaluate(() => window.__cadTest.blockState().instances);
  expect(after).toHaveLength(6);
  for (let i = 0; i < after.length; i++) {
    expect(after[i].x - before[i].x).toBeCloseTo(expectedDx, 3);
    expect(after[i].y - before[i].y).toBeCloseTo(expectedDy, 3);
    expect(after[i].rotation).toBeCloseTo(before[i].rotation, 8);
  }

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "fixed-block-grid.json"), constrainedBlockGridFixture({ fixed: true }));
  const fixedInteraction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  const fixedBefore = await page.evaluate(() => window.__cadTest.blockState().instances);
  await page.mouse.move(fixedInteraction.center.x, fixedInteraction.center.y);
  await page.mouse.down();
  await page.mouse.move(fixedInteraction.center.x + screenDx, fixedInteraction.center.y + screenDy, { steps: 1 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__cadTest.blockState().instances)).toEqual(fixedBefore);
});

test("guided point drags keep the free target axis responsive and solve exactly on release", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "guided-point-drag.json"), guidedPointDragFixture());

  const result = await page.evaluate(() => window.__cadTest.guidedPointDragForTest("P26", 25, 12));
  expect(result.targetConstraintCount).toBe(1);
  expect(result.preview.success).toBe(true);
  expect(result.preview.iterations).toBeLessThan(8);
  expect(result.preview.errorNorm).toBeLessThanOrEqual(result.preview.acceptError);
  expect(Math.abs(result.preview.point.x - result.target.x)).toBeLessThanOrEqual(result.preview.acceptError);
  expect(result.preview.point.y).toBeLessThan(result.target.y);
  expect(result.final.success).toBe(true);
  expect(result.final.errorNorm).toBeLessThan(1e-5);
  expect(result.final.baseErrorNorm).toBeLessThan(1e-5);
  expect(result.final.point.x).toBeCloseTo(result.target.x, 4);
  expect(Math.hypot(result.final.point.x, result.final.point.y)).toBeCloseTo(100, 4);

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "guided-curved-point-drag.json"), guidedPointDragFixture({ x: 60, y: 80 }));
  const curved = await page.evaluate(() => window.__cadTest.guidedPointDragForTest("P26", 40, 0));
  expect(curved.targetConstraintCount).toBe(1);
  expect(curved.preview.success).toBe(true);
  expect(curved.preview.iterations).toBeLessThan(8);
  expect(curved.final.success).toBe(true);
  expect(curved.final.errorNorm).toBeLessThan(1e-5);
  expect(curved.final.baseErrorNorm).toBeLessThan(1e-5);
  expect(curved.final.point.x).toBeGreaterThan(60);
  expect(curved.final.point.x).toBeLessThan(curved.target.x);
  expect(curved.final.point.y).toBeLessThan(80);
  expect(Math.hypot(curved.final.point.x, curved.final.point.y)).toBeCloseTo(100, 4);

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "guided-continuous-point-drag.json"), guidedPointDragFixture({ x: 60, y: 80 }));
  const continuous = await page.evaluate(() => window.__cadTest.guidedPointDragPathForTest(
    "P26",
    Array.from({ length: 10 }, (_, index) => [(index + 1) * 4, 0]),
  ));
  expect(continuous.previews).toHaveLength(10);
  for (let index = 0; index < continuous.previews.length; index++) {
    const preview = continuous.previews[index];
    expect(preview.success).toBe(true);
    expect(preview.blocked).not.toBe(true);
    expect(preview.errorNorm).toBeLessThanOrEqual(1e-3);
    if (index > 0) expect(preview.point.x).toBeGreaterThan(continuous.previews[index - 1].point.x);
  }
  expect(continuous.final.success).toBe(true);
  expect(continuous.final.errorNorm).toBeLessThan(1e-5);
  expect(Math.hypot(continuous.final.point.x, continuous.final.point.y)).toBeCloseTo(100, 4);
});

test("block placement escape commits zero rotation after choosing the display center", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const setup = await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await page.fill("#blockEditorNameInput", "Esc Block");
  await page.click("#completeBlockEditBtn");

  const canvas = await page.locator("#canvas").boundingBox();
  await page.click(".blockPlaceBtn");
  await page.mouse.click(canvas.x + canvas.width * 0.75, canvas.y + canvas.height * 0.7);
  await page.keyboard.press("Escape");

  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances[1].rotation).toBeCloseTo(0, 8);
  expect(state.mode).toBe("select");
});

test("legacy block data migrates into an internal Sketch-1 without changing projection ids", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  const before = await page.evaluate(() => window.__cadTest.blockState());
  const migrated = await page.evaluate(() => window.__cadTest.reloadLegacyBlockState());
  expect(migrated.version).toBe(8);
  expect(migrated.origin).toEqual({ x: 0, y: 0 });
  expect(migrated.sketches).toEqual([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", parentSketchId: "ROOT" }),
  ]);
  expect(new Set(migrated.elementSketchIds)).toEqual(new Set(["S1"]));
  expect(migrated.enabledSketchIds).toEqual(["S1"]);
  expect(migrated.projectionLineIds).toEqual(before.projectionLineIds);
});

test("new block editor supports cancel and independent internal sketch hierarchy", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await expect(page.locator("#sketchOverlay")).toBeVisible();
  await expect(page.locator("#completeBlockEditBtn")).toBeVisible();
  const cancelled = await page.evaluate(() => window.__cadTest.cancelBlockEditor());
  expect(cancelled).toEqual({ editing: false, definitions: 0, instances: 0, lines: 4 });

  await page.evaluate(() => window.__cadTest.resetForEmptyBlockCreation());
  await page.click("#toolCreateBlock");
  const initialEditor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(initialEditor.sketches).toEqual([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", parentSketchId: "ROOT" }),
  ]);
  const child = await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  expect(child.sketches).toContainEqual(expect.objectContaining({ id: child.sketchId, parentSketchId: "S1" }));
  await page.fill("#blockEditorNameInput", "Internal Sketch Block");
  const completed = await page.evaluate(() => window.__cadTest.completeBlockEditor());
  expect(completed).toEqual({ editing: false, definitions: 1, instances: 0 });
  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions[0].sketches).toHaveLength(3);
});

test("placement and existing instances keep independent enabled internal sketches", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  await page.dblclick(".block-item[data-id]");
  const child = await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  await page.click("#completeBlockEditBtn");
  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].enabledSketchIds).toEqual(["S1"]);

  await page.click(".blockPlaceBtn");
  await expect(page.locator("#blockSketchConfig")).toBeVisible();
  await page.locator(`#blockSketchConfig input[data-sketch-id="S1"]`).uncheck();
  await page.locator(`#blockSketchConfig input[data-sketch-id="${child.sketchId}"]`).check();
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.65);
  await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.65);
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[1].enabledSketchIds).toEqual([child.sketchId]);
  expect(state.projectionLineIds).toHaveLength(5);
});

test("block creation rejects shared boundaries and presentation references without mutation", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const result = await page.evaluate(() => window.__cadTest.blockCreationRejectionCases());
  expect(result.sharedPointError).toContain("非選択図形と共有");
  expect(result.sharedCounts).toEqual({ definitions: 0, instances: 0, lines: 2 });
  expect(result.presentationError).toContain("Presentation注記");
  expect(result.presentationCounts).toEqual({ definitions: 0, instances: 0, lines: 1 });
});
