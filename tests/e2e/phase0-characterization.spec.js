const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { phase0DocumentFixture } = require("../fixtures/phase0-document");

const host = "127.0.0.1";
const port = Number(process.env.JOT2D_E2E_PORT || 8765) + 6;
const baseUrl = `http://${host}:${port}`;
let serverProcess = null;

const persistentConstraintTypes = [
  "arcEndpointArcEndpointCoincident",
  "arcEndpointCoincident",
  "arcEndpointFixed",
  "arcEndpointOnCircle",
  "arcEndpointOnLine",
  "arcSymmetry",
  "circleCircleTangent",
  "coincident",
  "collinear",
  "concentric",
  "diameterDimension",
  "distance",
  "equalLength",
  "equalRadius",
  "horizontal",
  "lineAngle",
  "lineCircleTangent",
  "lineFixed",
  "lineLineDistance",
  "lineSymmetry",
  "offsetDimension",
  "parallel",
  "perpendicular",
  "pointAxisDistance",
  "pointHorizontal",
  "pointLineDistance",
  "pointOnCircle",
  "pointOnLine",
  "pointVertical",
  "radiusDimension",
  "symmetry",
  "vertical",
];

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

function semanticDocument(data) {
  const clone = structuredClone(data);
  delete clone.savedAt;
  const normalizeAngleDimensions = (constraints = []) => {
    for (const constraint of constraints) {
      if (constraint.type !== "lineAngle" || !constraint.dimension) continue;
      delete constraint.dimension.offsetU;
      delete constraint.dimension.offsetN;
    }
  };
  normalizeAngleDimensions(clone.constraints);
  for (const definition of clone.blockDefinitions || []) normalizeAngleDimensions(definition.constraints);
  return clone;
}

function exactPersistedDocument(data) {
  const clone = structuredClone(data);
  delete clone.savedAt;
  return clone;
}

function geometryContract(data) {
  return {
    sketches: data.sketches,
    activeSketchId: data.activeSketchId,
    blockDefinitions: data.blockDefinitions,
    blockInstances: data.blockInstances,
    points: data.points,
    lines: data.lines,
    circles: data.circles,
    arcs: data.arcs,
    constraints: data.constraints,
  };
}

function references(value, expected) {
  if (typeof value === "string") return value === expected || value === `line:${expected}` || value === `point:${expected}` || value === `circle:${expected}` || value === `arc:${expected}`;
  if (Array.isArray(value)) return value.some((item) => references(item, expected));
  if (value && typeof value === "object") return Object.values(value).some((item) => references(item, expected));
  return false;
}

async function openTestApp(page) {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
}

async function openBlockDefinitions(page) {
  const dialog = page.locator("#blockDefinitionsDialog");
  if (!(await dialog.isVisible())) {
    await page.locator(".app-menu > summary").filter({ hasText: /^(?:ブロック|Block)$/ }).click();
    await page.locator("#openBlockDefinitionsBtn").click();
  }
}

async function openBlocksExplorer(page) {
  await expect(page.locator(".explorer, [data-explorer-tab]")).toHaveCount(0);
}

async function importFixture(page, fixture = phase0DocumentFixture(), name = "phase0-golden.json") {
  const result = await page.evaluate(
    ({ data, fileName }) => window.__jot2dTest.importDocumentNameFixture(data, fileName),
    { data: fixture, fileName: name },
  );
  expect(result.success).toBe(true);
  return page.evaluate(() => window.__jot2dTest.serializedModelForTest());
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

test("complete documents normalize to stable v17 unified-canvas data", async ({ page }) => {
  await openTestApp(page);
  const first = await importFixture(page);
  const reload = await page.evaluate(
    ({ data, fileName }) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, fileName),
    { data: first, fileName: "phase0-golden.json" },
  );
  expect(reload.success).toBe(true);
  const second = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());

  expect(semanticDocument(second)).toEqual(semanticDocument(first));
  expect([...new Set(first.constraints.map((constraint) => constraint.type))].sort()).toEqual(persistentConstraintTypes);
  expect(first.blockDefinitions.map((definition) => definition.id)).toEqual(["B1", "B2"]);
  expect(first.blockDefinitions.find((definition) => definition.id === "B1").parentDefinitionId).toBe("B2");
  expect(first.blockInstances[0].enabledSketchIds).toEqual(["S1", "S2"]);
  expect(first.version).toBe(17);
  expect(first).not.toHaveProperty("presentationSheets");
  expect(first).not.toHaveProperty("activePresentationSheetId");
  expect(first.annotations).toEqual([]);
});

test("constraint commit accepts a stalled solver result within the application tolerance", async ({ page }) => {
  await openTestApp(page);

  const accepted = await page.evaluate(() => window.__jot2dTest.commitConstraintWithForcedSolveResultForTest({
    success: false,
    errorNorm: 2.317e-7,
    iterations: 14,
    reason: "lambda上限",
  }));
  expect(accepted).toEqual(expect.objectContaining({
    committed: true,
    constraintCount: 1,
    hintIsError: false,
  }));
  expect(accepted.hint).toContain("success=true");

  const rejected = await page.evaluate(() => window.__jot2dTest.commitConstraintWithForcedSolveResultForTest({
    success: false,
    errorNorm: 2.317e-3,
    iterations: 14,
    reason: "lambda上限",
  }));
  expect(rejected).toEqual(expect.objectContaining({
    committed: false,
    constraintCount: 0,
    hintIsError: true,
  }));
});

test("complete v17 documents are byte-shape stable apart from savedAt", async ({ page }) => {
  test.fail(true, "Known Phase 0 gap: angle dimensions serialize unused linear offsets as null, then reload them as zero");
  await openTestApp(page);
  const first = await importFixture(page);
  const reload = await page.evaluate(
    ({ data, fileName }) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, fileName),
    { data: first, fileName: "phase0-golden.json" },
  );
  expect(reload.success).toBe(true);
  const second = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(exactPersistedDocument(second)).toEqual(exactPersistedDocument(first));
});

test("legacy v1 documents normalize to stable v17 data and reserve new ids", async ({ page }) => {
  await openTestApp(page);
  const legacy = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../test-data/テスト図形.json"), "utf8"));
  const first = await importFixture(page, legacy, "legacy-v1.json");
  expect(first.version).toBe(17);
  expect(first.sketches).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", parentSketchId: "ROOT" }),
  ]));

  const reload = await page.evaluate(
    ({ data, fileName }) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, fileName),
    { data: first, fileName: "legacy-v1.json" },
  );
  expect(reload.success).toBe(true);
  const second = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(semanticDocument(second)).toEqual(semanticDocument(first));

  const previousIds = new Set(second.points.map((point) => point.id));
  const viewport = await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 10000, y: 10000 }, 1));
  await page.click("#toolPoint");
  await page.mouse.click(viewport.canvas.left + viewport.canvas.width / 2, viewport.canvas.top + viewport.canvas.height / 2);
  const afterCreation = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const newIds = afterCreation.points.map((point) => point.id).filter((id) => !previousIds.has(id));
  expect(newIds).toHaveLength(1);
  expect(new Set(afterCreation.points.map((point) => point.id)).size).toBe(afterCreation.points.length);
});

test("direct geometry deletion removes constraints and undo restores the document", async ({ page }) => {
  await openTestApp(page);
  const before = await importFixture(page);
  const historyBefore = await page.evaluate(() => window.__jot2dTest.historyState());

  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await page.click("#deleteSelectionBtn");
  const deleted = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const history = await page.evaluate(() => window.__jot2dTest.historyState());

  expect(deleted.lines.some((line) => line.id === "L1")).toBe(false);
  expect(deleted.constraints.some((constraint) => references(constraint, "L1"))).toBe(false);
  expect(history.undoCount).toBe(historyBefore.undoCount + 1);

  await page.click("#undoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));
  await page.click("#redoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(deleted));
});

test("legacy Presentation payload is discarded on import", async ({ page }) => {
  await openTestApp(page);
  const normalized = await importFixture(page);
  expect(normalized).not.toHaveProperty("presentationSheets");
  expect(normalized).not.toHaveProperty("activePresentationSheetId");
  expect(normalized.annotations).toEqual([]);
});

test("sketch subtree deletion cleans geometry, constraints, and annotations and restores on undo", async ({ page }) => {
  await openTestApp(page);
  const before = await importFixture(page);
  const historyBefore = await page.evaluate(() => window.__jot2dTest.historyState());

  expect(await page.evaluate(() => window.__jot2dTest.deleteSketchForTest("S1"))).toBe(true);
  const deleted = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const historyAfter = await page.evaluate(() => window.__jot2dTest.historyState());

  expect(deleted.sketches.map((sketch) => sketch.id)).toEqual(["ROOT"]);
  expect({
    points: deleted.points.length,
    lines: deleted.lines.length,
    circles: deleted.circles.length,
    arcs: deleted.arcs.length,
    blockInstances: deleted.blockInstances.length,
    constraints: deleted.constraints.length,
  }).toEqual({ points: 0, lines: 0, circles: 0, arcs: 0, blockInstances: 0, constraints: 0 });
  expect(deleted.annotations).toEqual([]);
  expect(historyAfter.undoCount).toBe(historyBefore.undoCount + 1);

  await page.click("#undoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));
});

test("block instance and definition deletion clean projection references", async ({ page }) => {
  await openTestApp(page);
  const beforeInstanceDelete = await importFixture(page);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#deleteSelectionBtn");
  const withoutInstance = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());

  expect(withoutInstance.blockInstances).toHaveLength(0);
  expect(withoutInstance.constraints.some((constraint) => references(constraint, "BI1@LB20"))).toBe(false);
  expect(withoutInstance.annotations).toEqual([]);
  await page.click("#undoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(beforeInstanceDelete));

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  const linePoint = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("line", "LB2"));
  expect(linePoint).not.toBeNull();
  await page.mouse.click(linePoint.x, linePoint.y);
  await page.click("#deleteSelectionBtn");
  await page.click("#completeBlockEditBtn");
  const afterDefinitionEdit = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(afterDefinitionEdit.blockDefinitions.find((definition) => definition.id === "B2").lines.map((line) => line.id)).toEqual(["LB20"]);
  expect(afterDefinitionEdit).not.toHaveProperty("presentationSheets");
  await page.click("#undoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(beforeInstanceDelete));
});

test("block sketch disabling removes constraints and ignores discarded legacy Presentation references", async ({ page }) => {
  await openTestApp(page);
  const before = await importFixture(page);
  expect(await page.evaluate(() => window.__jot2dTest.setFirstBlockInstanceSketches(["S1"]))).toBe(true);
  const disabled = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(disabled.blockInstances[0].enabledSketchIds).toEqual(["S1"]);
  expect(disabled.constraints.some((constraint) => references(constraint, "BI1@LB20"))).toBe(false);
  expect(disabled).not.toHaveProperty("presentationSheets");
  await page.click("#undoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));

  const legacyGuarded = await importFixture(page, phase0DocumentFixture({ presentationRefOnSecondaryBlockSketch: true }), "phase0-guarded.json");
  expect(legacyGuarded.annotations).toEqual([]);
  expect(await page.evaluate(() => window.__jot2dTest.setFirstBlockInstanceSketches(["S1"]))).toBe(true);
});

test("selection, hit testing, viewport changes, and canceled commands do not mutate model data", async ({ page }) => {
  await openTestApp(page);
  const before = await importFixture(page);
  const historyBefore = await page.evaluate(() => window.__jot2dTest.historyState());

  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L4"], circles: ["C1"] }));
  expect(await page.evaluate(() => window.__jot2dTest.hitGeometryAtWorldForTest({ x: 70, y: -80 }))).toEqual(expect.objectContaining({ line: "L4" }));
  const viewport = await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 100, y: 20 }, 1.2));
  await page.mouse.move(viewport.canvas.left + viewport.canvas.width * 0.6, viewport.canvas.top + viewport.canvas.height * 0.4);
  await page.mouse.wheel(0, -240);
  await page.setViewportSize({ width: 1360, height: 920 });
  await page.setViewportSize({ width: 1280, height: 900 });
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(canvas.x + canvas.width / 2 + 80, canvas.y + canvas.height / 2 + 45, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  await page.mouse.dblclick(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, { button: "middle" });
  await expect(page.locator(".explorer, [data-explorer-tab]")).toHaveCount(0);

  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(historyBefore);

  const emptyViewport = await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 900, y: 900 }, 1));
  await page.click("#toolLine");
  await page.mouse.click(emptyViewport.canvas.left + emptyViewport.canvas.width / 2, emptyViewport.canvas.top + emptyViewport.canvas.height / 2);
  await page.keyboard.press("Escape");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));
});

test("canceling an in-progress line does not add a history entry", async ({ page }) => {
  test.fail(true, "Known Phase 0 gap: line-start rollback restores the model but leaves an extra history entry");
  await openTestApp(page);
  await importFixture(page);
  const historyBefore = await page.evaluate(() => window.__jot2dTest.historyState());
  const viewport = await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 900, y: 900 }, 1));
  await page.click("#toolLine");
  await page.mouse.click(viewport.canvas.left + viewport.canvas.width / 2, viewport.canvas.top + viewport.canvas.height / 2);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(historyBefore);
});

test("history uses one transaction per edit, restores exact state, and clears redo after a branch", async ({ page }) => {
  await openTestApp(page);
  const before = await importFixture(page);
  const baselineHistory = await page.evaluate(() => window.__jot2dTest.historyState());
  const viewport = await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 900, y: 900 }, 1));
  const first = { x: viewport.canvas.left + viewport.canvas.width * 0.45, y: viewport.canvas.top + viewport.canvas.height * 0.5 };
  const second = { x: viewport.canvas.left + viewport.canvas.width * 0.6, y: viewport.canvas.top + viewport.canvas.height * 0.5 };

  await page.click("#toolPoint");
  await page.mouse.click(first.x, first.y);
  const edited = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(edited.points).toHaveLength(before.points.length + 1);
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(expect.objectContaining({ undoCount: baselineHistory.undoCount + 1, redoCount: 0 }));

  await page.click("#undoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(expect.objectContaining({ undoCount: baselineHistory.undoCount, redoCount: 1 }));
  await page.click("#redoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(edited));
  await page.click("#undoBtn");

  await page.click("#toolPoint");
  await page.mouse.click(second.x, second.y);
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(expect.objectContaining({ undoCount: baselineHistory.undoCount + 1, redoCount: 0, redoDisabled: true }));
});

test("block editor history is isolated and cancel or root undo restores exact document state", async ({ page }) => {
  await openTestApp(page);
  const before = await importFixture(page);
  const baselineHistory = await page.evaluate(() => window.__jot2dTest.historyState());

  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.evaluate(() => window.__jot2dTest.addBlockEditorChildGeometry());
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(expect.objectContaining({ blockEditing: true, undoCount: 3, redoCount: 0 }));
  await page.click("#undoBtn");
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(expect.objectContaining({ blockEditing: true, redoCount: 1 }));
  await page.click("#redoBtn");
  await page.evaluate(() => window.__jot2dTest.cancelBlockEditor());
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(expect.objectContaining({ blockEditing: false, undoCount: baselineHistory.undoCount, redoCount: 0 }));

  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.evaluate(() => window.__jot2dTest.addBlockEditorChildGeometry());
  await page.evaluate(() => window.__jot2dTest.completeBlockEditor());
  const committed = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(committed.blockDefinitions).toHaveLength(before.blockDefinitions.length + 1);
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(expect.objectContaining({ blockEditing: false, undoCount: baselineHistory.undoCount + 1, redoCount: 0 }));
  await page.click("#undoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(before));
  await page.click("#redoBtn");
  expect(semanticDocument(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(semanticDocument(committed));
});

test("document annotation edits never modify geometry or solve state", async ({ page }) => {
  await openTestApp(page);
  await page.evaluate(() => window.__jot2dTest.resetForAnnotationDrag());
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const analysisBefore = await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest());

  const snapshot = await page.evaluate(() => window.__jot2dTest.annotationSnapshot());
  await page.mouse.move(snapshot.leader.viewport.x, snapshot.leader.viewport.y);
  await page.mouse.down();
  await page.mouse.move(snapshot.leader.viewport.x + 55, snapshot.leader.viewport.y + 30, { steps: 6 });
  await page.mouse.up();

  const after = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const analysisAfter = await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest());
  expect(geometryContract(after)).toEqual(geometryContract(before));
  expect({ stable: analysisAfter.stable, errorNorm: analysisAfter.errorNorm, freeVariableCount: analysisAfter.freeVariableCount })
    .toEqual({ stable: analysisBefore.stable, errorNorm: analysisBefore.errorNorm, freeVariableCount: analysisBefore.freeVariableCount });
  expect(after.annotations).not.toEqual(before.annotations);
});

test("visual regression: geometry and constraint states", async ({ page }) => {
  await openTestApp(page);
  await page.evaluate(() => window.__jot2dTest.resetForSupportConstraintStatus());
  await expect(page.locator("#canvas")).toHaveScreenshot("phase0-geometry-constraints.png", { animations: "disabled", maxDiffPixelRatio: 0.002 });
});

test("visual regression: nested block projections", async ({ page }) => {
  await openTestApp(page);
  await importFixture(page);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 170 }, 2.2));
  await expect(page.locator("#canvas")).toHaveScreenshot("phase0-nested-block.png", { animations: "disabled", maxDiffPixelRatio: 0.002 });
});

test("visual regression: unified document annotations", async ({ page }) => {
  await openTestApp(page);
  await page.evaluate(() => window.__jot2dTest.resetForAnnotationDrag());
  await expect(page.locator("#canvas")).toHaveScreenshot("phase0-annotations.png", { animations: "disabled", maxDiffPixelRatio: 0.002 });
});

test("visual regression: block editor", async ({ page }) => {
  await openTestApp(page);
  await page.evaluate(() => window.__jot2dTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await expect(page.locator("#canvas")).toHaveScreenshot("phase0-block-editor.png", { animations: "disabled", maxDiffPixelRatio: 0.002 });
});
