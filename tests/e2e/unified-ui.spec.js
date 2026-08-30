const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.JOT2D_E2E_PORT || 8765);
const baseUrl = `http://${host}:${port}`;
let serverProcess = null;

function sketchTreeGroup(page, category, sketchId = "S1") {
  return page.locator(`.sketch-group-row[data-sketch-id="${sketchId}"][data-category="${category}"]`);
}

function sketchTreeSketch(page, sketchId = "S1") {
  return page.locator(`.sketch-item[data-id="${sketchId}"]`);
}

async function expandSketchTreeSketch(page, sketchId = "S1") {
  const sketch = sketchTreeSketch(page, sketchId);
  if ((await sketch.getAttribute("aria-expanded")) !== "true") await sketch.locator(".sketchExpandBtn").click();
  return sketch;
}

async function expandSketchTreeGroup(page, category, sketchId = "S1") {
  await expandSketchTreeSketch(page, sketchId);
  const group = sketchTreeGroup(page, category, sketchId);
  if ((await group.getAttribute("aria-expanded")) !== "true") await group.click();
  return group;
}

async function openBlockDefinitions(page) {
  const blockMenu = page.locator(".app-menu > summary").filter({ hasText: /^(?:ブロック|Block)$/ });
  await blockMenu.click();
  await page.locator("#openBlockDefinitionsBtn").click();
}

async function openApplicationSettings(page) {
  const button = page.locator("#applicationSettingsBtn");
  if (!(await button.isVisible())) await page.locator(".app-menu > summary").first().click();
  await button.click();
}

async function openDocumentSettings(page) {
  const button = page.locator("#documentSettingsBtn");
  if (!(await button.isVisible())) await page.locator(".app-menu > summary").first().click();
  await button.click();
}

async function selectSketch(page, sketchId) {
  await page.locator(`.sketch-item[data-id="${sketchId}"]`).click();
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText(/^(?:Sketch|スケッチ)$/);
}

function annotationSketchFixture(version = 11) {
  const annotations = [
    { id: "AN1", type: "text", sketchId: "S1", visible: true, text: "Room note", x: -30, y: -24, style: { color: "#2563eb", fontSize: 14 } },
    {
      id: "AN2",
      type: "leader",
      sketchId: "S1",
      visible: true,
      text: "Wall",
      x: 10,
      y: -34,
      start: { x: 0, y: 0 },
      elbow: { x: 10, y: -20 },
      end: { x: 10, y: -34 },
      geometryRef: { kind: "line", path: ["L1"] },
      style: { color: "#111827", lineWidth: 1.5 },
    },
  ];
  if (version < 11) for (const annotation of annotations) delete annotation.sketchId;
  return {
    version,
    documentName: "Annotation tree",
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {} },
      { id: "S1", name: "Walls", parentSketchId: "ROOT", kind: "sketch", appearance: {} },
      { id: "S2", name: "Notes", parentSketchId: "ROOT", kind: "sketch", appearance: {} },
    ],
    activeSketchId: "S2",
    annotations,
    parameters: [],
    nextDimensionParameterIndex: 1,
    blockDefinitions: [],
    blockInstances: [],
    points: [
      { id: "P1", x: -60, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
      { id: "P2", x: 60, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
      { id: "P3", x: -40, y: 50, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P4", x: 40, y: 50, fixed: false, kind: "endpoint", sketchId: "S2" },
    ],
    lines: [
      { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" },
      { id: "L2", p1: "P3", p2: "P4", construction: false, sketchId: "S2" },
    ],
    circles: [],
    arcs: [],
    constraints: [],
  };
}

function lineCircleSparseLineDragFixture() {
  return {
    version: 19,
    documentName: "Sparse line-circle drag",
    defaultAppearance: { visible: true, color: "#111827", lineType: "solid", lineWidth: 2 },
    defaultConstructionAppearance: { visible: true, color: "#64748b", lineType: "dashdot", lineWidth: 1, endpointOverhang: true, endpointMarkers: true },
    defaultDimensionAppearance: { visible: true, color: "#64748b", lineWidth: 1.2, precision: null, prefix: "", suffix: "", terminatorType: "arrow", extensionLineOvershoot: 1.5, extensionLineOriginGap: 1.5, terminatorSize: 4, arrowheadAngle: 30, dimensionTextHeight: 5, dimensionTextGap: 0 },
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
    ],
    activeSketchId: "S1",
    annotations: [],
    hatches: [],
    referenceImages: [],
    nextHatchIndex: 1,
    parameters: [],
    nextDimensionParameterIndex: 2,
    blockDefinitions: [],
    blockInstances: [],
    points: [
      { id: "P1", x: 445.5111234529177, y: 71.62929184733785, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P2", x: 507.8082294656379, y: 252.12644132938127, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P3", x: 734.1721849964379, y: 229.77125698251248, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P4", x: 740.7999877929688, y: 371.8000183105469, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P5", x: 558.9779847656711, y: 138.98486973223496, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    ],
    lines: [
      { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1", appearance: {} },
      { id: "L2", p1: "P2", p2: "P3", construction: false, sketchId: "S1", appearance: {} },
      { id: "L3", p1: "P3", p2: "P4", construction: false, sketchId: "S1", appearance: {} },
    ],
    circles: [
      { id: "C1", center: "P5", radius: 28.374645423870362, construction: false, sketchId: "S1", appearance: {} },
    ],
    arcs: [],
    splines: [],
    constraints: [
      {
        type: "lineCircleDistance",
        line: "L1",
        circle: "C1",
        target: 85.28294700183547,
        sign: -1,
        dimension: { x: 556.5684888634365, y: 221.17850435059586, offsetU: 13.547646871331722, offsetN: 76.91000256931403, labelOffsetU: 13.547646871331784, axis: null, display: null },
        enabled: true,
        parameterName: "d1",
        expression: "85.28294700183547",
        sketchId: "S1",
      },
    ],
  };
}

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

async function openParameterDialog(page) {
  await page.locator(".app-menu > summary").first().click();
  await page.locator("#parametersBtn").click();
  await expect(page.locator("#parametersDialog")).toBeVisible();
}

test("document parameters, quoted dimension formulas, rename propagation, and v19 persistence work together", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const initial = await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  expect(initial.success).toBe(true);
  expect(initial.length).toBeCloseTo(50, 5);
  const guardedDelete = await page.evaluate((name) => window.__jot2dTest.deleteDimensionByNameForTest(name), initial.measuredName);
  expect(guardedDelete.deleted).toBe(false);
  expect(guardedDelete.names).toContain(initial.measuredName);
  expect(guardedDelete.hint).toContain("参照されているため削除できません");
  expect(await page.evaluate(() => window.__jot2dTest.blockParameterFreezeForTest())).toEqual({
    parameters: [],
    name: "d1",
    expression: "50",
    sourceExpression: '"width" / 2 + "margin"',
  });

  await openParameterDialog(page);
  expect(await page.locator("#parametersDialog thead th").allTextContents()).toEqual([
    "名前", "値 / 数式", "評価値", "", "名前", "種類／所属", "値 / 数式", "評価値",
  ]);
  await expect(page.locator("#parameterRows tr")).toHaveCount(2);
  await expect(page.locator("#parameterDimensionRows tr")).toHaveCount(2);
  await expect(page.locator('#parameterDimensionRows input[readonly]')).toHaveCount(1);
  await expect(page.locator('[data-parameter-field="expression"]').first()).toHaveValue(`="${initial.measuredName}" * 2`);
  await expect(page.locator('#parameterDimensionRows input[data-dimension-field="expression"]:not([readonly])')).toHaveValue('="width" / 2 + "margin"');
  await expect(page.locator("#parameterRows .expression-reference-token")).toHaveText([`"${initial.measuredName}"`]);
  await expect(page.locator("#parameterDimensionRows .expression-reference-token")).toHaveText(['"width"', '"margin"']);
  await expect(page.locator("#parameterDimensionRows .expression-reference-token").first()).toHaveCSS("color", "rgb(37, 99, 235)");
  const widthName = page.locator('[data-parameter-field="name"]').first();
  await widthName.fill("span");
  await widthName.press("Tab");
  await expect(page.locator('#parameterDimensionRows input[data-dimension-field="expression"]:not([readonly])')).toHaveValue('="span" / 2 + "margin"');
  await page.locator("#applyParametersBtn").click();
  await expect(page.locator("#parameterDialogError")).toBeHidden();

  const state = await page.evaluate(() => window.__jot2dTest.parameterStateForTest());
  expect(state.valid).toBe(true);
  expect(state.parameters.map((item) => item.name)).toEqual(["span", "margin"]);
  expect(state.dimensions.find((item) => !item.readOnly).expression).toContain("span");
  expect(state.serialized.version).toBe(19);
  expect(state.serialized.constraints.every((constraint) => !constraint.dimension || constraint.parameterName)).toBe(true);
});

test("block parameter namespaces are independent and directly update definitions", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  await openParameterDialog(page);
  const scope = page.locator("#parameterScopeSelect");
  await expect(scope.locator("option")).toHaveCount(3);
  const blockScopeValue = await scope.locator("option").filter({ hasText: /^ブロック: Param Block$/ }).getAttribute("value");
  await scope.selectOption(blockScopeValue);
  await page.locator('[data-parameter-field="expression"]').first().fill("30");
  await page.locator('[data-parameter-field="expression"]').first().press("Tab");
  await page.locator("#applyParametersBtn").click();
  await expect(page.locator("#parameterDialogError")).toBeHidden();

  const state = await page.evaluate(() => window.__jot2dTest.parameterStateForTest());
  expect(state.parameters.find((item) => item.name === "width").value).toBe(80);
  expect(state.blockNamespaces).toHaveLength(2);
  expect(state.blockNamespaces[0].parameters).toEqual([{ name: "width", expression: "30" }]);
  expect(state.blockNamespaces[0].dimensions[0].target).toBeCloseTo(30, 5);
  expect(state.blockNamespaces[0].lineLengths[0]).toBeCloseTo(30, 5);
  expect(state.blockNamespaces[1].parameters).toEqual([{ name: "width", expression: "15" }]);
  expect(state.blockNamespaces[1].dimensions[0].target).toBeCloseTo(15, 5);
  expect(state.blockNamespaces[1].lineLengths[0]).toBeCloseTo(15, 5);
  expect(state.instanceProjectionLengths[0]).toBeCloseTo(30, 5);
  expect(state.instanceProjectionLengths[1]).toBeCloseTo(15, 5);
});

test("formula-driven dimensions use the lightning canvas mark without changing numeric labels", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForParameterTest());

  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionExpressionMarksForTest())).toEqual([
    { pointCount: 6, filled: true },
  ]);
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest())).toEqual(["50", "(40)"]);
  const fit = await page.evaluate(() => {
    const plain = window.__jot2dTest.dimensionTerminatorFitForTest(1000, "50");
    const available = plain.textWidth + plain.fitMargin + 1;
    return {
      plain,
      marked: window.__jot2dTest.dimensionTerminatorFitForTest(available, "50", "arrow", true),
    };
  });
  expect(fit.marked.textWidth).toBeGreaterThan(fit.plain.textWidth);
  expect(fit.marked.outside).toBe(true);

  await page.evaluate(() => window.__jot2dTest.resetForParameterFeedbackTest());
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionExpressionMarksForTest())).toEqual([]);
});

test("dimension expressions require equals and canvas dimension clicks insert parameter names", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const initial = await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 30 }, 2));
  const positions = await page.evaluate(() => [
    window.__jot2dTest.dimensionClientPositionForTest(0),
    window.__jot2dTest.dimensionClientPositionForTest(1),
  ]);

  await page.evaluate(() => window.__jot2dTest.startDimensionExpressionEditForTest(0));
  const input = page.locator("#dimensionValueInput");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('="width" / 2 + "margin"');
  await expect(page.locator("#dimensionValueInputShell .expression-reference-token")).toHaveText(['"width"', '"margin"']);

  await input.fill(`${initial.measuredName} * 2`);
  await input.press("Enter");
  await expect(input).toBeVisible();
  await expect(page.locator("#hint")).toContainText("先頭に =");

  await input.fill(`=${initial.measuredName} * 2`);
  await input.press("Enter");
  await expect(input).toBeVisible();
  await expect(page.locator("#hint")).toContainText("ダブルクオーテーション");

  await input.fill("=");
  await page.mouse.click(positions[1].x, positions[1].y);
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(`="${initial.measuredName}"`);
  await input.press("Enter");
  await expect(input).toBeHidden();

  const state = await page.evaluate(() => window.__jot2dTest.parameterStateForTest());
  const driving = state.dimensions.find((dimension) => !dimension.readOnly);
  expect(driving.expression).toBe(`"${initial.measuredName}"`);
  expect(driving.target).toBeCloseTo(40, 5);
});

test("Properties and Parameter dialog expression fields accept canvas dimension references", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const initial = await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 30 }, 2));
  await page.evaluate(() => window.__jot2dTest.selectDimensionForPropertiesForTest(0));
  let measuredPosition = await page.evaluate(() => window.__jot2dTest.dimensionClientPositionForTest(1));

  const propertyExpression = page.locator('#propertiesPanel [data-property="constraint-expression"]');
  await expect(propertyExpression).toHaveValue('="width" / 2 + "margin"');
  await expect(page.locator("#propertiesPanel .expression-reference-token")).toHaveText(['"width"', '"margin"']);
  await propertyExpression.fill("=");
  await page.mouse.click(measuredPosition.x, measuredPosition.y);
  await expect(propertyExpression).toBeFocused();
  await expect(propertyExpression).toHaveValue(`="${initial.measuredName}"`);

  await page.reload();
  await page.waitForFunction(() => window.__jot2dTest);
  const next = await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 200, y: 30 }, 2));
  measuredPosition = await page.evaluate(() => window.__jot2dTest.dimensionClientPositionForTest(1));
  await openParameterDialog(page);
  const dialogBox = await page.locator("#parametersDialog").boundingBox();
  expect(measuredPosition.x).toBeLessThan(dialogBox.x);
  const dialogExpression = page.locator('#parameterDimensionRows input[data-dimension-field="expression"]:not([readonly])');
  await dialogExpression.fill("=");
  await page.mouse.click(measuredPosition.x, measuredPosition.y);
  await expect(dialogExpression).toBeFocused();
  await expect(dialogExpression).toHaveValue(`="${next.measuredName}"`);
});

test("v16 formulas migrate to quoted references and current unquoted references are rejected atomically", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const legacy = structuredClone(before);
  legacy.version = 16;
  const removeReferenceQuotes = (scope) => {
    for (const parameter of scope.parameters || []) parameter.expression = parameter.expression.replaceAll('"', "");
    for (const constraint of scope.constraints || []) if (constraint.expression) constraint.expression = constraint.expression.replaceAll('"', "");
  };
  removeReferenceQuotes(legacy);
  for (const definition of legacy.blockDefinitions || []) removeReferenceQuotes(definition);
  const migrated = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "legacy-v16-formulas.jot2d"), legacy);
  expect(migrated.success).toBe(true);
  const migratedState = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(migratedState.version).toBe(19);
  expect(migratedState.parameters[0].expression).toMatch(/^"d\d+" \* 2$/);
  expect(migratedState.constraints.find((constraint) => constraint.expression?.includes("width"))?.expression).toBe('"width" / 2 + "margin"');

  const invalid = structuredClone(migratedState);
  invalid.parameters[0].expression = invalid.parameters[0].expression.replaceAll('"', "");
  const result = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "invalid-v18-unquoted-formula.jot2d"), invalid);
  expect(result.success).toBe(false);
  expect(result.error).toContain("ダブルクオーテーション");
  const after = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(after.parameters).toEqual(migratedState.parameters);
  expect(after.constraints.map((constraint) => constraint.expression)).toEqual(migratedState.constraints.map((constraint) => constraint.expression));
});

test("unknown quoted parameter expressions reject loading without replacing the document", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const invalid = structuredClone(before);
  invalid.parameters[0].expression = '"missing" + 1';
  const result = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "invalid-v18-unknown-formula.jot2d"), invalid);
  expect(result.success).toBe(false);
  expect(result.error).toContain("未定義");
  const after = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(after.parameters).toEqual(before.parameters);
});

test("non-convergent reference feedback rolls back the complete parameter apply", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const initial = await page.evaluate(() => window.__jot2dTest.resetForParameterFeedbackTest());
  expect(initial.success).toBe(true);
  expect(initial.length).toBeCloseTo(40, 5);
  await openParameterDialog(page);
  const drivingExpression = page.locator('#parameterDimensionRows input[data-dimension-field="expression"]:not([readonly])');
  await drivingExpression.fill(`=120 - "${initial.measuredName}"`);
  await drivingExpression.press("Tab");
  await page.locator("#applyParametersBtn").click();
  await expect(page.locator("#parameterDialogError")).toContainText("収束しません");
  const state = await page.evaluate(() => window.__jot2dTest.parameterStateForTest());
  const driving = state.dimensions.find((dimension) => dimension.name === initial.drivingName);
  expect(driving.expression).toBe("40");
  expect(driving.target).toBeCloseTo(40, 5);
  await expect(page.locator("#undoBtn")).toBeDisabled();
});

test("document annotations can be dragged on the unified canvas", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForAnnotationDrag());

  const beforeText = await page.evaluate(() => window.__jot2dTest.annotationSnapshot());
  await page.mouse.move(beforeText.text.viewport.x, beforeText.text.viewport.y);
  await page.mouse.down();
  await page.mouse.move(beforeText.text.viewport.x, beforeText.text.viewport.y + 70, { steps: 8 });
  await page.mouse.up();

  const afterText = await page.evaluate(() => window.__jot2dTest.annotationSnapshot());
  expect(afterText.text.world.y).toBeGreaterThan(beforeText.text.world.y + 20);

  const beforeLeader = afterText;
  await page.mouse.move(beforeLeader.leader.viewport.x, beforeLeader.leader.viewport.y);
  await page.mouse.down();
  await page.mouse.move(beforeLeader.leader.viewport.x + 70, beforeLeader.leader.viewport.y - 35, { steps: 8 });
  await page.mouse.up();

  const afterLeader = await page.evaluate(() => window.__jot2dTest.annotationSnapshot());
  expect(afterLeader.leader.world.x).toBeGreaterThan(beforeLeader.leader.world.x + 20);
  expect(afterLeader.leader.world.y).toBeLessThan(beforeLeader.leader.world.y - 10);
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("引出線");
  await expect(page.locator("#propertiesPanel .property-section h3").first()).toHaveText("基本情報");
  const annotationRows = await page.locator("#propertiesPanel .property-section").first().locator(".property-row").allTextContents();
  expect(annotationRows[0]).toBe("種類引出線");
  expect(annotationRows[1]).toMatch(/^ID.+/);

  await page.keyboard.press("Control+Z");
  const afterUndo = await page.evaluate(() => window.__jot2dTest.annotationSnapshot());
  expect(afterUndo.leader.world.x).toBeCloseTo(beforeLeader.leader.world.x, 5);
  expect(afterUndo.leader.world.y).toBeCloseTo(beforeLeader.leader.world.y, 5);

  for (let i = 0; i < 12; i += 1) {
    const state = await page.evaluate(() => window.__jot2dTest.historyState());
    if (state.redoDisabled) break;
    await page.keyboard.press("Control+Y");
  }
  const afterRedo = await page.evaluate(() => window.__jot2dTest.annotationSnapshot());
  expect(afterRedo.leader.world.x).toBeCloseTo(afterLeader.leader.world.x, 5);
  expect(afterRedo.leader.world.y).toBeCloseTo(afterLeader.leader.world.y, 5);
});

test("annotation Properties edit complete appearance in approximate millimeters", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = annotationSketchFixture(11);
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "annotation-appearance.jot2d"), fixture)).toEqual(expect.objectContaining({ success: true }));
  await expandSketchTreeGroup(page, "annotation", "S1");

  const textRow = page.locator('.sketch-object-row[data-object-kind="annotation"][data-id="AN1"]');
  const textIconMatchesToolbar = await textRow.evaluate((row) => {
    const normalize = (svg) => svg?.innerHTML.replace(/\s+/g, " ").trim();
    return normalize(row.querySelector("svg")) === normalize(document.querySelector("#annotationTextBtn svg"));
  });
  expect(textIconMatchesToolbar).toBe(true);
  await textRow.click();
  await expect(page.locator("#propertiesPanel .property-section > h3")).toHaveText(["基本情報", "内容", "自由テキストの外観"]);
  await expect(page.locator("#propertiesPanel")).toContainText("文字高さ");
  await expect(page.locator("#propertiesPanel")).toContainText("横位置");

  const migrated = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest("text", 1));
  expect(migrated.style.textHeight).toBeCloseTo(14 / (96 / 25.4), 8);
  expect(migrated.serialized.style).not.toHaveProperty("fontSize");

  await page.locator('[data-property="annotation-text"]').fill("Styled room note");
  await page.locator('[data-property="annotation-text"]').press("Tab");
  await page.locator('[data-annotation-style="textHeight"]').fill("6.5");
  await page.locator('[data-annotation-style="textHeight"]').press("Tab");
  await page.locator('[data-annotation-style="fontFamily"]').selectOption("serif");
  await page.locator('[data-annotation-style="bold"]').check();
  await page.locator('[data-annotation-style="italic"]').check();
  await page.locator('[data-annotation-style="textAlign"]').selectOption("center");
  await page.locator('[data-property="annotation-rotation"]').fill("25");
  await page.locator('[data-property="annotation-rotation"]').press("Tab");
  await page.locator("#propertiesPanel [data-appearance-palette-open]").click();
  await page.locator('#defaultColorPalette [data-palette-color="#dc2626"]').click();
  const textAtHalfZoom = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest("text", 0.5));
  const textAtFourZoom = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest("text", 4));
  expect(textAtFourZoom.style).toEqual(expect.objectContaining({
    color: "#dc2626",
    textHeight: 6.5,
    fontFamily: "serif",
    bold: true,
    italic: true,
    textAlign: "center",
  }));
  expect(textAtFourZoom.rotation).toBeCloseTo(25 * Math.PI / 180, 8);
  expect(textAtFourZoom.screenTextHeight).toBeCloseTo(6.5 * (96 / 25.4), 8);
  expect(textAtFourZoom.screenTextHeight).toBeCloseTo(textAtHalfZoom.screenTextHeight, 8);
  expect(textAtFourZoom.serialized.text).toBe("Styled room note");

  const leaderRow = page.locator('.sketch-object-row[data-object-kind="annotation"][data-id="AN2"]');
  await leaderRow.click();
  await expect(page.locator("#propertiesPanel .property-section > h3")).toHaveText(["基本情報", "内容", "引出線の外観"]);
  await expect(page.locator('[data-annotation-style="lineWidth"]')).toBeVisible();
  await expect(page.locator('[data-annotation-style="terminatorType"]')).toBeVisible();
  await page.locator('[data-property="annotation-text"]').fill("Styled leader");
  await page.locator('[data-property="annotation-text"]').press("Tab");
  await page.locator('[data-annotation-style="lineWidth"]').fill("2.4");
  await page.locator('[data-annotation-style="lineWidth"]').press("Tab");
  await page.locator('[data-annotation-style="lineType"]').selectOption("dashdot");
  await page.locator('[data-annotation-style="terminatorType"]').selectOption("dot");
  await page.locator('[data-annotation-style="terminatorSize"]').fill("4.2");
  await page.locator('[data-annotation-style="terminatorSize"]').press("Tab");

  const leader = await page.evaluate(() => window.__jot2dTest.annotationAppearanceStateForTest("leader", 2));
  expect(leader.style).toEqual(expect.objectContaining({ lineWidth: 2.4, lineType: "dashdot", terminatorType: "dot", terminatorSize: 4.2 }));
  expect(leader.serialized.text).toBe("Styled leader");
  expect(leader.serialized.style).not.toHaveProperty("fontSize");

  await openApplicationSettings(page);
  await page.locator("#applicationLanguageSelect").selectOption("en");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await expect(page.locator("#propertiesPanel .property-section > h3")).toHaveText(["Basic Information", "Content", "Leader Appearance"]);
  await expect(page.locator("#propertiesPanel")).toContainText("Text height");
  await expect(page.locator("#propertiesPanel")).toContainText("Line type");
  await expect(page.locator("#propertiesPanel")).toContainText("Terminator size");
});

test("multiple selection edits only changed common properties and supports dash-dot-dot lines", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForMultiplePropertiesTest());

  await expect(page.locator("#propertiesPanel .property-heading")).toContainText("2 個のオブジェクト");
  await expect(page.locator("#propertiesPanel .property-section > h3")).toHaveText(["基本情報", "共通外観"]);
  await expect(page.locator('#propertiesPanel [data-bulk-property="color"]')).toHaveValue("");
  await expect(page.locator('#propertiesPanel [data-bulk-property="color"]')).toHaveAttribute("placeholder", "混在");
  await expect(page.locator('#propertiesPanel [data-bulk-property="lineType"] option:checked')).toHaveText("混在");
  await expect(page.locator('#propertiesPanel [data-bulk-property="lineType"] option')).toHaveText(["混在", "実線", "破線", "一点鎖線", "二点鎖線", "点線"]);

  await page.locator('#propertiesPanel [data-bulk-property="lineType"]').selectOption("dashdotdot");
  await page.locator('#propertiesPanel [data-bulk-property="lineWidth"]').fill("2.5");
  await page.locator('#propertiesPanel [data-bulk-property="lineWidth"]').press("Tab");
  await page.locator('#propertiesPanel [data-bulk-property="construction"]').check();
  await page.locator("#propertiesPanel [data-appearance-palette-open]").click();
  await page.locator('#defaultColorPalette [data-palette-color="#7c3aed"]').click();

  let state = await page.evaluate(() => window.__jot2dTest.multiplePropertiesStateForTest());
  expect(state.targetKind).toBe("multiple");
  expect(state.lines).toHaveLength(2);
  for (const line of state.lines) {
    expect(line.construction).toBe(true);
    expect(line.appearance).toEqual(expect.objectContaining({ color: "#7c3aed", lineType: "dashdotdot", lineWidth: 2.5 }));
    expect(line.appearance).not.toHaveProperty("visible");
  }

  await page.evaluate(() => window.__jot2dTest.resetForMultiplePropertiesTest(true));
  await expect(page.locator("#fixPointBtn")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator('#propertiesPanel [data-bulk-property="construction"]')).toHaveCount(0);
  await expect(page.locator('#propertiesPanel [data-bulk-property="lineType"]')).toBeVisible();
  await page.locator('#propertiesPanel [data-bulk-property="lineType"]').selectOption("dashdotdot");
  state = await page.evaluate(() => window.__jot2dTest.multiplePropertiesStateForTest());
  expect([...state.lines, ...state.circles].every((item) => item.appearance.lineType === "dashdotdot")).toBe(true);
  expect(state.lines[0].appearance.color).toBe("#dc2626");
  expect(state.circles[0].appearance.color).toBe("#16a34a");
});

test("fix toggle applies points and lines as one multiple-selection operation", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForMultipleFixedTest());
  await expect(page.locator("#fixPointBtn")).toHaveAttribute("aria-disabled", "false");

  await page.locator("#fixPointBtn").click();
  let state = await page.evaluate(() => window.__jot2dTest.multipleFixedStateForTest());
  expect(state.fixedPointIds).toEqual([fixture.pointId]);
  expect(state.fixedLineIds).toEqual(fixture.lineIds);
  expect(state.constraintCount).toBe(2);

  await page.locator("#fixPointBtn").click();
  state = await page.evaluate(() => window.__jot2dTest.multipleFixedStateForTest());
  expect(state.fixedPointIds).toEqual([]);
  expect(state.fixedLineIds).toEqual([]);
  expect(state.constraintCount).toBe(0);

  await page.keyboard.press("Control+z");
  state = await page.evaluate(() => window.__jot2dTest.multipleFixedStateForTest());
  expect(state.fixedPointIds).toEqual([fixture.pointId]);
  expect(state.fixedLineIds).toEqual(fixture.lineIds);
  expect(state.constraintCount).toBe(2);
});

test("Sketch Tree owns object groups, activates inactive rows, and copies annotations across sketches", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = annotationSketchFixture();
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "annotation-tree.json"), fixture)).toEqual(expect.objectContaining({ success: true }));

  await expect(sketchTreeSketch(page, "S1")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.sketch-group-row[data-sketch-id="S1"]')).toHaveCount(0);
  await expandSketchTreeSketch(page, "S1");
  expect(await page.locator('.sketch-group-row[data-sketch-id="S1"]').evaluateAll((rows) => rows.map((row) => row.dataset.category))).toEqual(["point", "line", "annotation"]);
  await expect(page.locator('.sketch-group-row[data-sketch-id="S1"]')).toHaveCount(3);
  await expect(page.locator('.sketch-object-row[data-sketch-id="S1"]')).toHaveCount(0);
  await expect(sketchTreeGroup(page, "line", "S1")).toHaveAttribute("aria-expanded", "false");

  await expandSketchTreeGroup(page, "line", "S1");
  const inactiveLine = page.locator('.sketch-object-row[data-object-kind="line"][data-id="L1"]');
  await expect(inactiveLine).toBeVisible();
  await inactiveLine.hover();
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).lines).toEqual([]);
  await inactiveLine.click();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).activeSketchId).toBe("S1");
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).lines).toEqual(["L1"]);
  await expect(page.locator("#propertiesPanel")).toContainText("L1");

  await sketchTreeSketch(page, "S1").locator(".sketchExpandBtn").click();
  await expect(sketchTreeSketch(page, "S1")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.sketch-group-row[data-sketch-id="S1"]')).toHaveCount(0);
  await expandSketchTreeSketch(page, "S1");
  await expect(sketchTreeGroup(page, "line", "S1")).toHaveAttribute("aria-expanded", "true");

  await sketchTreeGroup(page, "line", "S1").click();
  await expect(sketchTreeGroup(page, "line", "S1")).toHaveClass(/has-active-descendant/);
  await expect(sketchTreeGroup(page, "line", "S1")).toHaveAttribute("aria-expanded", "false");
  await expandSketchTreeGroup(page, "line", "S1");
  await expandSketchTreeGroup(page, "annotation", "S1");
  await page.locator('.sketch-object-row[data-object-kind="annotation"][data-id="AN1"]').click({ modifiers: ["Control"] });
  expect((await page.evaluate(() => window.__jot2dTest.annotationOwnershipStateForTest())).selectedIds).toEqual(["AN1"]);

  await page.keyboard.press("Control+C");
  await page.locator('.sketchActivateBtn[data-id="S2"]').click();
  await page.keyboard.press("Control+V");
  const pasted = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const copiedAnnotation = pasted.annotations.find((annotation) => annotation.id !== "AN1" && annotation.id !== "AN2");
  expect(copiedAnnotation).toEqual(expect.objectContaining({ type: "text", sketchId: "S2", text: "Room note" }));
  expect(pasted.lines.filter((line) => line.sketchId === "S2")).toHaveLength(2);

  await expect(sketchTreeGroup(page, "line", "S1")).toHaveAttribute("aria-expanded", "true");
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "annotation-tree-reload.json"), pasted)).toEqual(expect.objectContaining({ success: true }));
  await expect(sketchTreeSketch(page, "S1")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.sketch-group-row[data-sketch-id="S1"]')).toHaveCount(0);
  await expandSketchTreeSketch(page, "S1");
  await expect(sketchTreeGroup(page, "line", "S1")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.sketch-object-row[data-sketch-id="S1"]')).toHaveCount(0);
});

test("v10 annotations migrate by target or active sketch and invalid v11 ownership is atomic", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const legacy = annotationSketchFixture(10);
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "annotation-v10.json"), legacy)).toEqual(expect.objectContaining({ success: true }));
  const migrated = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(migrated.version).toBe(19);
  expect(migrated.annotations.find((annotation) => annotation.id === "AN1").sketchId).toBe("S2");
  expect(migrated.annotations.find((annotation) => annotation.id === "AN2").sketchId).toBe("S1");

  const invalid = structuredClone(migrated);
  invalid.annotations[0].sketchId = "ROOT";
  const result = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "invalid-annotation-v11.json"), invalid);
  expect(result.success).toBe(false);
  expect(result.error).toMatch(/所属Sketch|owning sketch/);
  const retained = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(retained.annotations).toEqual(migrated.annotations);
  expect(retained.lines).toEqual(migrated.lines);
});

test("annotation-only blocks project nested text with transforms, overrides, bounds, and block hit selection", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = annotationSketchFixture();
  fixture.activeSketchId = "S1";
  fixture.annotations = [fixture.annotations[0]];
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "annotation-only.json"), fixture)).toEqual(expect.objectContaining({ success: true }));
  await expandSketchTreeGroup(page, "annotation", "S1");
  await page.locator('.sketch-object-row[data-object-kind="annotation"][data-id="AN1"]').click();
  await page.locator("#toolCreateBlock").click();
  await expect(page.locator("body")).toHaveClass(/block-editing/);
  await page.locator("#completeBlockEditBtn").click();
  const created = await page.evaluate(() => window.__jot2dTest.blockState());
  expect(created.serialized.annotations).toHaveLength(0);
  expect(created.serialized.blockDefinitions).toHaveLength(1);
  expect(created.serialized.blockDefinitions[0].lines).toHaveLength(0);
  expect(created.serialized.blockDefinitions[0].annotations).toHaveLength(1);
  expect(created.serialized.blockInstances).toHaveLength(1);
  expect((await page.evaluate(() => window.__jot2dTest.annotationOwnershipStateForTest())).projected).toHaveLength(1);

  const nested = annotationSketchFixture();
  nested.points = [];
  nested.lines = [];
  nested.annotations = [];
  nested.activeSketchId = "S1";
  const internalSketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {} },
    { id: "S1", name: "Content", parentSketchId: "ROOT", kind: "sketch", appearance: {} },
  ];
  const emptyDefinition = (id, name, parentDefinitionId) => ({
    id,
    name,
    parentDefinitionId,
    revision: 1,
    origin: { x: 0, y: 0 },
    sketches: internalSketches,
    activeSketchId: "S1",
    parameters: [],
    nextDimensionParameterIndex: 1,
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    annotations: [],
    blockInstances: [],
    constraints: [],
  });
  const leaf = emptyDefinition("B1", "Leaf note", "B2");
  leaf.annotations = [{ id: "AN1", type: "text", sketchId: "S1", visible: false, text: "Nested note", x: 10, y: 0, style: { color: "#0000ff", fontSize: 16 } }];
  const parent = emptyDefinition("B2", "Parent note", null);
  parent.blockInstances = [{
    id: "BI-child",
    definitionId: "B1",
    sketchId: "S1",
    x: 20,
    y: 0,
    rotation: Math.PI / 2,
    fixed: false,
    rotationLocked: true,
    enabledSketchIds: ["S1"],
    appearanceOverride: { color: "#00ff00", lineWidth: 2 },
  }];
  nested.blockDefinitions = [leaf, parent];
  nested.blockInstances = [{
    id: "BI-root",
    definitionId: "B2",
    sketchId: "S1",
    x: 300,
    y: 50,
    rotation: Math.PI / 2,
    fixed: false,
    rotationLocked: true,
    enabledSketchIds: ["S1"],
    appearanceOverride: { visible: true, color: "#ef4444", lineWidth: 3 },
  }];
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "nested-annotation.json"), nested)).toEqual(expect.objectContaining({ success: true }));
  await page.evaluate(() => window.__jot2dTest.fitAllGeometryForTest());
  const projectedState = await page.evaluate(() => window.__jot2dTest.annotationOwnershipStateForTest());
  expect(projectedState.projected).toHaveLength(1);
  const projected = projectedState.projected[0];
  expect(projected.id).toBe("BI-root/BI-child/AN1");
  expect(projected.rotation).toBeCloseTo(Math.PI, 8);
  expect(projected.visible).toBe(true);
  expect(projected.style).toEqual(expect.objectContaining({ color: "#ef4444", lineWidth: 3 }));
  expect(projectedState.bounds).not.toBeNull();
  expect(await page.evaluate((point) => window.__jot2dTest.annotationHitAt(point), projected.client)).toEqual({ type: "text", part: "label" });
  expect(await page.evaluate((point) => {
    const target = document.elementFromPoint(point.x, point.y);
    return { id: target?.id || "", tag: target?.tagName || "", className: target?.className || "" };
  }, projected.client)).toEqual({ id: "canvas", tag: "CANVAS", className: "has-native-cursor" });
  await page.mouse.click(projected.client.x, projected.client.y);
  expect((await page.evaluate(() => window.__jot2dTest.blockState())).selectedInstanceIds).toEqual(["BI-root"]);
});

test("history buttons enable after normal canvas edits", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const initial = await page.evaluate(() => window.__jot2dTest.historyState());
  expect(initial.undoDisabled).toBe(true);
  expect(initial.redoDisabled).toBe(true);

  await page.click("#toolRectangle");
  await page.mouse.click(480, 420);
  await page.mouse.click(540, 470);
  const afterEdit = await page.evaluate(() => window.__jot2dTest.historyState());
  expect(afterEdit.undoDisabled).toBe(false);
  expect(afterEdit.redoDisabled).toBe(true);

  for (let i = 0; i < 12; i += 1) {
    const state = await page.evaluate(() => window.__jot2dTest.historyState());
    if (state.undoDisabled) break;
    await page.click("#undoBtn");
  }
  const afterUndo = await page.evaluate(() => window.__jot2dTest.historyState());
  expect(afterUndo.undoDisabled).toBe(true);
  expect(afterUndo.redoDisabled).toBe(false);

  await page.keyboard.press("Control+Y");
  const afterRedo = await page.evaluate(() => window.__jot2dTest.historyState());
  expect(afterRedo.undoDisabled).toBe(false);
});

test("startup opens an empty drawable document", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const state = await page.evaluate(() => ({
    document: window.__jot2dTest.serializedModelForTest(),
    history: window.__jot2dTest.historyState(),
    groupCount: document.querySelectorAll('.sketch-group-row[data-sketch-id="S1"]').length,
    hint: document.getElementById("hint")?.textContent || "",
  }));
  expect(state.document.sketches).toEqual([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", kind: "sketch", parentSketchId: "ROOT" }),
  ]);
  expect(state.document.activeSketchId).toBe("S1");
  for (const key of ["points", "lines", "circles", "arcs", "splines", "constraints", "parameters", "blockDefinitions", "blockInstances", "annotations", "hatches"]) {
    expect(state.document[key], key).toEqual([]);
  }
  expect(state.history).toEqual(expect.objectContaining({ undoDisabled: true, redoDisabled: true }));
  expect(state.groupCount).toBe(0);
  expect(state.hint).toContain("Geometryを選択または作成します");
  expect(state.hint).not.toContain("サンプル復元");
});

test("geometry copy and paste crosses sketches with internal constraints and stepped offsets", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const initial = await page.evaluate(() => window.__jot2dTest.resetForGeometryClipboardTest());

  expect(initial.geometryBySketch.S1.points).toHaveLength(6);
  expect(initial.geometryBySketch.S1.lines).toHaveLength(1);
  expect(initial.constraints).toHaveLength(7);
  expect(initial.geometryBySketch.S1.points.some((item) => item.fixed)).toBe(true);
  expect(initial.constraints.map((item) => item.type)).toEqual(expect.arrayContaining(["lineFixed", "arcEndpointFixed"]));
  await expect(page.locator("#copySelectionBtn")).toHaveCount(0);
  await expect(page.locator("#cutSelectionBtn")).toHaveCount(0);
  await expect(page.locator("#pasteSelectionBtn")).toHaveCount(0);

  await page.keyboard.press("Control+C");
  let state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.clipboard).toEqual({ pasteCount: 0, points: 5, lines: 1, circles: 1, arcs: 1, splines: 0, constraints: 4, blockInstances: 0 });

  await page.click('.sketchActivateBtn[data-id="S2"]');
  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.activeSketchId).toBe("S2");
  expect(state.geometryBySketch.S2.points).toHaveLength(5);
  expect(state.geometryBySketch.S2.lines).toHaveLength(1);
  expect(state.geometryBySketch.S2.circles).toHaveLength(1);
  expect(state.geometryBySketch.S2.arcs).toHaveLength(1);
  expect(state.constraints.filter((item) => item.sketchId === "S2")).toHaveLength(4);
  expect(state.constraints.filter((item) => item.sketchId === "S2").some((item) => item.type === "lineFixed" || item.type === "arcEndpointFixed")).toBe(false);
  expect(state.geometryBySketch.S2.points.every((item) => !item.fixed)).toBe(true);
  expect(state.constraints.filter((item) => item.sketchId === "S2").every((item) => !item.reference)).toBe(true);
  expect(state.selected.points).toHaveLength(1);
  expect(state.selected.lines).toHaveLength(1);
  expect(state.selected.circles).toHaveLength(1);
  expect(state.selected.arcs).toHaveLength(1);
  expect(state.geometryBySketch.S2.lines[0].id).not.toBe(state.geometryBySketch.S1.lines[0].id);
  const sourceDimension = state.constraints.find((item) => item.sketchId === "S1" && item.type === "distance").dimension;
  const pastedDimension = state.constraints.find((item) => item.sketchId === "S2" && item.type === "distance").dimension;
  expect(pastedDimension.x - sourceDimension.x).toBeCloseTo(24, 6);
  expect(pastedDimension.y - sourceDimension.y).toBeCloseTo(24, 6);

  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.clipboard.pasteCount).toBe(2);
  expect(state.geometryBySketch.S2.lines).toHaveLength(2);
  expect(state.geometryBySketch.S2.lines[1].p1).not.toBe(state.geometryBySketch.S2.lines[0].p1);
  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.geometryBySketch.S2.lines).toHaveLength(1);
});

test("cut uses one undo step and keeps a pasteable cross-sketch payload", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForGeometryClipboardTest());

  await page.keyboard.press("Control+X");
  let state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.clipboard.constraints).toBe(4);
  expect(state.geometryBySketch.S1.points).toHaveLength(1);
  expect(state.geometryBySketch.S1.lines).toHaveLength(0);
  expect(state.geometryBySketch.S1.circles).toHaveLength(0);
  expect(state.geometryBySketch.S1.arcs).toHaveLength(0);
  expect(state.constraints).toHaveLength(0);
  expect(state.history.undoCount).toBe(2);

  await page.click('.sketchActivateBtn[data-id="S2"]');
  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.geometryBySketch.S1.lines).toHaveLength(0);
  expect(state.geometryBySketch.S2.lines).toHaveLength(1);
  expect(state.constraints.filter((item) => item.sketchId === "S2")).toHaveLength(4);

  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.geometryBySketch.S1.lines).toHaveLength(0);
  expect(state.geometryBySketch.S2.lines).toHaveLength(0);
  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.geometryBySketch.S1.lines).toHaveLength(1);
  expect(state.constraints).toHaveLength(7);
  expect(state.clipboard.constraints).toBe(4);
});

test("block instances and their closed constraints can be copied across sketches", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForBlockClipboardTest());

  await page.keyboard.press("Control+C");
  let state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.clipboard).toEqual({ pasteCount: 0, points: 0, lines: 0, circles: 0, arcs: 0, splines: 0, constraints: 1, blockInstances: 1 });
  await page.click('.sketchActivateBtn[data-id="S2"]');
  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.geometryBySketch.S2.blockInstances).toHaveLength(1);
  expect(state.geometryBySketch.S2.blockInstances[0]).toEqual(expect.objectContaining({ x: 34, y: 44, definitionId: "B1", fixed: false, rotationLocked: true }));
  expect(state.selectedBlockInstanceIds).toEqual([state.geometryBySketch.S2.blockInstances[0].id]);
  const pastedConstraints = state.constraints.filter((item) => item.sketchId === "S2");
  expect(pastedConstraints).toHaveLength(1);
  expect(pastedConstraints[0].line).toContain(`${state.geometryBySketch.S2.blockInstances[0].id}@`);

  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__jot2dTest.clipboardStateForTest());
  expect(state.geometryBySketch.S2.blockInstances).toHaveLength(0);
});

test("undo preserves construction drawing mode", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.click("#toolConstructionLine");
  await page.mouse.click(460, 410);
  await page.mouse.click(540, 450);
  await page.click("#undoBtn");

  const state = await page.evaluate(() => window.__jot2dTest.historyState());
  expect(state.constructionLineMode).toBe(true);
  expect(state.constructionButtonActive).toBe(true);
});

test("workspace integrates transparent compact Object groups into Sketch Tree and removes Explorer", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
  await expect(sketchTreeSketch(page, "ROOT")).toHaveAttribute("aria-expanded", "true");
  await expect(sketchTreeSketch(page, "S1")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.sketch-group-row[data-sketch-id="S1"]')).toHaveCount(0);
  await expandSketchTreeSketch(page, "S1");

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector).getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const blockMenu = [...document.querySelectorAll(".app-menu")].find((item) => item.querySelector(":scope > summary")?.textContent.trim() === "ブロック");
    return {
      menu: rect(".menu-bar"),
      toolbar: rect(".command-toolbar"),
      canvas: rect(".canvas-area"),
      properties: rect(".properties"),
      status: rect(".status-bar"),
      modeControls: document.querySelectorAll("#geometryModeBtn, #presentationModeBtn, #presentationSheetSelect").length,
      menus: [...document.querySelectorAll(".app-menu > summary")].map((item) => item.textContent.trim()),
      toolIds: [...document.querySelectorAll(".command-toolbar button")].map((item) => item.id).filter(Boolean),
      iconButtons: [...document.querySelectorAll(".command-toolbar button")].map((item) => ({
        text: item.textContent.trim(),
        hasIcon: Boolean(item.querySelector(":scope > svg")),
        title: item.getAttribute("title"),
        label: item.getAttribute("aria-label"),
      })),
      canvasCursor: getComputedStyle(document.querySelector("#canvas")).cursor,
      gridControls: document.querySelectorAll("#viewGridInput").length,
      logo: {
        count: document.querySelectorAll(".app-logo").length,
        source: document.querySelector(".app-logo")?.getAttribute("src"),
        width: document.querySelector(".app-logo")?.getBoundingClientRect().width,
        height: document.querySelector(".app-logo")?.getBoundingClientRect().height,
        naturalWidth: document.querySelector(".app-logo")?.naturalWidth,
        naturalHeight: document.querySelector(".app-logo")?.naturalHeight,
        objectFit: getComputedStyle(document.querySelector(".app-logo")).objectFit,
      },
      constraintStatusIcon: {
        eyeCount: document.querySelectorAll("#constraintStatusViewBtn .constraint-status-eye").length,
        swatches: [...document.querySelectorAll("#constraintStatusViewBtn .constraint-status-swatch")].map((item) => getComputedStyle(item).stroke),
      },
      documentNameControls: document.querySelectorAll("#documentNameInput, .document-name-input").length,
      menuBackground: getComputedStyle(document.querySelector(".menu-bar")).backgroundColor,
      statusBackground: getComputedStyle(document.querySelector(".status-bar")).backgroundColor,
      geometryMenuColumnCount: getComputedStyle(document.querySelector(".menu-command-list")).gridTemplateColumns.split(" ").length,
      fileMenuTools: [...document.querySelectorAll(".app-menu:first-of-type [data-menu-tool]")].map((item) => item.dataset.menuTool),
      blockMenuTools: blockMenu ? [...blockMenu.querySelectorAll("[data-menu-tool]")].map((item) => item.dataset.menuTool) : [],
      blockCreateButtonCount: document.querySelectorAll("#toolCreateBlock").length,
      sketchTreeToggleCount: document.querySelectorAll("#toggleSketchTreeBtn").length,
      sketchTreeResizeHandle: {
        count: document.querySelectorAll("#sketchOverlayResizeHandle").length,
        cursor: getComputedStyle(document.querySelector("#sketchOverlayResizeHandle")).cursor,
        value: document.querySelector("#sketchOverlayResizeHandle")?.getAttribute("aria-valuenow"),
      },
      explorerCount: document.querySelectorAll(".explorer, [data-explorer-tab], [data-explorer-panel]").length,
      sketchOverlay: rect("#sketchOverlay"),
      sketchOverlaySurface: (() => {
        const overlay = getComputedStyle(document.querySelector("#sketchOverlay"));
        const header = getComputedStyle(document.querySelector(".sketch-overlay-header"));
        const group = getComputedStyle(document.querySelector(".sketch-group-row"));
        return {
          background: overlay.backgroundColor,
          border: [overlay.borderTopWidth, overlay.borderRightWidth, overlay.borderBottomWidth, overlay.borderLeftWidth],
          radius: overlay.borderRadius,
          shadow: overlay.boxShadow,
          backdropFilter: overlay.backdropFilter,
          headerBackground: header.backgroundColor,
          headerBorderBottom: header.borderBottomWidth,
          groupBackground: group.backgroundColor,
        };
      })(),
      workspaceColumns: getComputedStyle(document.querySelector(".workspace")).gridTemplateColumns,
    };
  });

  expect(layout.modeControls).toBe(0);
  expect(layout.menus).toEqual(["ファイル", "編集", "表示", "ジオメトリ", "ブロック", "拘束", "注記", "ヘルプ"]);
  expect(layout.toolIds).toEqual(expect.arrayContaining(["exportBtn", "importBtn", "undoBtn", "redoBtn", "deleteSelectionBtn", "toolSelect", "toolPoint", "toolLine", "toolCreateBlock", "annotationLeaderBtn", "annotationTextBtn"]));
  expect(layout.iconButtons.every((button) => button.text === "" && button.hasIcon && button.title && button.label)).toBe(true);
  expect(layout.canvasCursor).toMatch(/^url\(/);
  expect(layout.gridControls).toBe(0);
  expect(layout.logo).toEqual({ count: 1, source: "./assets/jot2d-logo.svg", width: 108, height: 28, naturalWidth: 2048, naturalHeight: 678, objectFit: "cover" });
  expect(layout.constraintStatusIcon).toEqual({
    eyeCount: 2,
    swatches: ["rgb(17, 24, 39)", "rgb(15, 118, 110)", "rgb(245, 158, 11)", "rgb(220, 38, 38)"],
  });
  expect(layout.documentNameControls).toBe(0);
  expect(layout.menuBackground).toBe("rgb(30, 58, 95)");
  expect(layout.menuBackground).toBe(layout.statusBackground);
  expect(layout.geometryMenuColumnCount).toBe(1);
  expect(layout.fileMenuTools).toEqual(["exportBtn", "importBtn"]);
  expect(layout.blockMenuTools).toEqual(["toolCreateBlock"]);
  await expect(page.locator("#openBlockDefinitionsBtn")).toHaveCount(1);
  expect(layout.blockCreateButtonCount).toBe(1);
  expect(layout.sketchTreeToggleCount).toBe(0);
  expect(layout.sketchTreeResizeHandle).toEqual({ count: 1, cursor: "col-resize", value: "320" });
  expect(layout.explorerCount).toBe(0);
  expect(await page.locator("#sketchOverlay").evaluate((element) => element.parentElement?.classList.contains("canvas-area"))).toBe(true);
  expect(layout.canvas.left).toBe(0);
  expect(layout.canvas.right).toBeCloseTo(layout.properties.left, 0);
  expect(layout.status.top).toBeGreaterThanOrEqual(layout.canvas.bottom - 1);

  expect(layout.sketchOverlay.width).toBe(320);
  expect(layout.sketchOverlay.height).toBeLessThanOrEqual(0.7 * 700 + 1);
  expect(layout.sketchOverlaySurface).toEqual({
    background: "rgba(0, 0, 0, 0)",
    border: ["0px", "0px", "0px", "0px"],
    radius: "0px",
    shadow: "none",
    backdropFilter: "none",
    headerBackground: "rgba(0, 0, 0, 0)",
    headerBorderBottom: "0px",
    groupBackground: "rgba(0, 0, 0, 0)",
  });
  const resizeHandle = page.locator("#sketchOverlayResizeHandle");
  const resizeHandleBounds = await resizeHandle.boundingBox();
  await page.mouse.move(resizeHandleBounds.x + resizeHandleBounds.width / 2, resizeHandleBounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(resizeHandleBounds.x + resizeHandleBounds.width / 2 + 80, resizeHandleBounds.y + 20, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator("#sketchOverlay")).toHaveCSS("width", "400px");
  await expect(resizeHandle).toHaveAttribute("aria-valuenow", "400");
  await resizeHandle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#sketchOverlay")).toHaveCSS("width", "384px");
  const groupState = await page.locator('.sketch-group-row[data-sketch-id="S1"]').evaluateAll((rows) => rows.map((row) => ({
    category: row.dataset.category,
    open: row.getAttribute("aria-expanded"),
    height: row.getBoundingClientRect().height,
    count: Number(row.querySelector(".sketch-group-count")?.textContent),
  })));
  expect(groupState).toEqual([
    { category: "point", open: "false", height: 20, count: 4 },
    { category: "line", open: "false", height: 20, count: 4 },
    { category: "constraint", open: "false", height: 20, count: 6 },
  ]);
  await expect(page.locator(".sketch-object-row")).toHaveCount(0);

  await openBlockDefinitions(page);
  await expect(page.locator("#blockDefinitionsDialog")).toBeVisible();
  await expect(page.locator("#blockList")).toBeVisible();
  await page.locator("#blockDefinitionsDialog button[value=cancel]").first().click();
  await page.locator(".app-menu > summary").filter({ hasText: /^ブロック$/ }).click();
  await page.locator("#openBlockDefinitionsBtn").click();
  await expect(page.locator("#blockDefinitionsDialog")).toBeVisible();
  await page.locator("#blockDefinitionsDialog button[value=cancel]").first().click();
  const lineGroup = await expandSketchTreeGroup(page, "line");
  await expect(lineGroup).toHaveAttribute("aria-expanded", "true");
  const lineRows = page.locator('.sketch-object-row[data-object-kind="line"]');
  await expect(lineRows).toHaveCount(4);
  expect(await lineRows.evaluateAll((rows) => rows.map((row) => ({ height: row.getBoundingClientRect().height, icon: Boolean(row.querySelector("svg")), background: getComputedStyle(row).backgroundColor })))).toEqual([
    { height: 22, icon: true, background: "rgba(0, 0, 0, 0)" }, { height: 22, icon: true, background: "rgba(0, 0, 0, 0)" }, { height: 22, icon: true, background: "rgba(0, 0, 0, 0)" }, { height: 22, icon: true, background: "rgba(0, 0, 0, 0)" },
  ]);
  const treeIndentation = await page.evaluate(() => {
    const group = document.querySelector('.sketch-group-row[data-sketch-id="S1"][data-category="line"]');
    const object = document.querySelector('.sketch-object-row[data-object-kind="line"]');
    const measure = (row) => {
      const gutter = row.querySelector(".sketch-tree-gutter");
      const icon = row.querySelector(".sketch-object-icon");
      return {
        segments: gutter.children.length,
        gutterWidth: gutter.getBoundingClientRect().width,
        gutterOffset: gutter.getBoundingClientRect().right - row.getBoundingClientRect().left,
        iconOffset: icon ? icon.getBoundingClientRect().left - row.getBoundingClientRect().left : null,
      };
    };
    return { group: measure(group), object: measure(object) };
  });
  expect(treeIndentation).toEqual({
    group: { segments: 3, gutterWidth: 54, gutterOffset: 54, iconOffset: null },
    object: { segments: 4, gutterWidth: 72, gutterOffset: 72, iconOffset: 72 },
  });
  const lineIconMatchesToolbar = await page.evaluate(() => {
    const normalize = (svg) => svg?.innerHTML.replace(/\s+/g, " ").trim();
    return normalize(document.querySelector('.sketch-object-row[data-object-kind="line"] svg')) === normalize(document.querySelector("#toolLine svg"));
  });
  expect(lineIconMatchesToolbar).toBe(true);
  const constraintGroup = await expandSketchTreeGroup(page, "constraint");
  await expect(constraintGroup).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".sketch-tree-summary")).toHaveCount(1);
  const constraintSummary = await page.locator(".sketch-tree-summary").evaluate((row) => {
    const gutter = row.querySelector(".sketch-tree-gutter");
    return {
      height: row.getBoundingClientRect().height,
      labels: [...row.querySelectorAll(".sketch-tree-summary-item")].map((item) => item.textContent.trim()),
      segmentCount: gutter.children.length,
      gutterWidth: gutter.getBoundingClientRect().width,
      title: row.title,
      background: getComputedStyle(row).backgroundColor,
    };
  });
  expect(constraintSummary).toEqual({
    height: 22,
    labels: ["完全1", "支持0", "未拘束7", "矛盾0"],
    segmentCount: 4,
    gutterWidth: 72,
    title: "完全拘束: 1 / 支持位置拘束: 0 / 未拘束: 7 / 矛盾: 0",
    background: "rgba(0, 0, 0, 0)",
  });

  expect(await page.evaluate(() => window.__jot2dTest.documentNameState())).toEqual({
    modelName: "無題",
    displayName: "無題",
    serializedName: "無題",
    title: "無題 - Jot2D",
  });

  const sketchTree = await page.evaluate(() => {
    const row = document.querySelector('.sketch-item[data-id="S1"]');
    const rootRow = document.querySelector('.sketch-item[data-id="ROOT"]');
    const gutter = row?.querySelector(".sketch-tree-gutter");
    const elbow = gutter?.querySelector(".tree-segment.elbow");
    const icon = row?.querySelector(".sketch-row-icon");
    return {
      rowHeight: row?.getBoundingClientRect().height,
      rowDisplay: row ? getComputedStyle(row).display : null,
      gutterDisplay: gutter ? getComputedStyle(gutter).display : null,
      segmentCount: gutter?.children.length || 0,
      verticalLine: elbow ? getComputedStyle(elbow, "::before").borderLeftWidth : null,
      horizontalLine: elbow ? getComputedStyle(elbow, "::after").borderTopWidth : null,
      iconCount: document.querySelectorAll(".sketch-item .sketch-row-icon").length,
      rootHasIcon: Boolean(rootRow?.querySelector(".sketch-row-icon")),
      iconSize: icon ? [icon.getBoundingClientRect().width, icon.getBoundingClientRect().height] : null,
      iconBeforeName: icon?.nextElementSibling?.classList.contains("sketch-name") || false,
    };
  });
  expect(sketchTree).toEqual({
    rowHeight: 19,
    rowDisplay: "grid",
    gutterDisplay: "grid",
    segmentCount: 2,
    verticalLine: "1px",
    horizontalLine: "1px",
    iconCount: 2,
    rootHasIcon: true,
    iconSize: [13, 13],
    iconBeforeName: true,
  });

  expect(await page.evaluate(() => {
    const canvas = document.querySelector("#canvas");
    canvas.classList.add("is-dragging");
    const cursor = getComputedStyle(canvas).cursor;
    canvas.classList.remove("is-dragging");
    return cursor;
  })).toMatch(/^url\(/);

  const fileMenu = page.locator(".app-menu").nth(0);
  const editMenu = page.locator(".app-menu").nth(1);
  const geometryMenu = page.locator(".app-menu").nth(3);
  await editMenu.locator("summary").hover();
  await page.waitForTimeout(180);
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  await fileMenu.locator("summary").click();
  await expect(fileMenu).toHaveAttribute("open", "");
  await page.evaluate(() => {
    const summary = document.querySelectorAll(".app-menu > summary")[1];
    const menu = summary.parentElement;
    window.__menuHoverTiming = {};
    summary.addEventListener("pointerenter", () => {
      window.__menuHoverTiming.startedAt = performance.now();
    }, { once: true });
    menu.addEventListener("toggle", () => {
      if (menu.open) window.__menuHoverTiming.openedAt = performance.now();
    });
  });
  await editMenu.locator("summary").hover();
  await expect(fileMenu).not.toHaveAttribute("open", "");
  await expect(editMenu).toHaveAttribute("open", "");
  const menuHoverElapsed = await page.evaluate(() => window.__menuHoverTiming.openedAt - window.__menuHoverTiming.startedAt);
  expect(menuHoverElapsed).toBeLessThan(50);
  await expect(page.locator(".app-menu[open]")).toHaveCount(1);
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("編集");
  await page.locator(".app-logo").click();
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  await fileMenu.locator("summary").click();
  await geometryMenu.locator("summary").click();
  await expect(fileMenu).not.toHaveAttribute("open", "");
  await expect(geometryMenu).toHaveAttribute("open", "");
  await page.locator(".app-logo").click();
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await expect(page.locator("#propertiesPanel .property-section > h3")).toHaveText(["基本情報", "線の外観"]);
  await fileMenu.locator("summary").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).lines).toEqual(["L1"]);
  await fileMenu.locator("summary").click();
  await openApplicationSettings(page);
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  await expect(page.locator("#applicationSettingsDialog")).toBeVisible();
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();

  await page.evaluate(() => window.__jot2dTest.resetForEmptyBlockCreation());
  const canvas = await page.locator("#canvas").boundingBox();
  await page.click("#toolPoint");
  await page.mouse.click(canvas.x + canvas.width * 0.55, canvas.y + canvas.height * 0.55);
  await expandSketchTreeGroup(page, "point");
  await expect(page.locator('.sketch-object-row[data-object-kind="point"]')).toHaveCount(1);
  await page.locator('.sketch-object-row[data-object-kind="point"]').click();
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("点");
  await expect(page.locator("#propertiesPanel .property-section h3").first()).toHaveText("基本情報");
  const pointRows = await page.locator("#propertiesPanel .property-section").first().locator(".property-row").allTextContents();
  expect(pointRows[0]).toBe("種類点");
  expect(pointRows[1]).toMatch(/^ID.+/);
  expect(pointRows).toEqual(expect.arrayContaining([expect.stringMatching(/^X座標/), expect.stringMatching(/^Y座標/)]));
  await page.click("#deleteSelectionBtn");
  await expect(page.locator('.sketch-group-row[data-category="point"]')).toHaveCount(0);
});

test("Jot2D files open, overwrite, save as, and cancel without errors", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window.__jot2dFsMock = {
      saveCalls: [],
      openCalls: [],
      records: [],
      saveNames: ["first-save.jot2d", "second-save.jot2d"],
      openRecord: null,
      cancelNextSave: false,
      cancelNextOpen: false,
    };
    const makeHandle = (record) => ({
      name: record.name,
      async getFile() {
        return new File([record.content], record.name, { type: "application/json" });
      },
      async createWritable() {
        return {
          async write(value) {
            record.content = value instanceof Blob ? await value.text() : String(value);
            record.writeCount = (record.writeCount || 0) + 1;
          },
          async close() {
            record.closeCount = (record.closeCount || 0) + 1;
          },
        };
      },
    });
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      value: async (options) => {
        state.saveCalls.push(options);
        if (state.cancelNextSave) {
          state.cancelNextSave = false;
          throw new DOMException("Canceled", "AbortError");
        }
        const record = {
          name: state.saveNames.shift() || options.suggestedName,
          content: "",
          writeCount: 0,
          closeCount: 0,
        };
        state.records.push(record);
        return makeHandle(record);
      },
    });
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async (options) => {
        state.openCalls.push(options);
        if (state.cancelNextOpen) {
          state.cancelNextOpen = false;
          throw new DOMException("Canceled", "AbortError");
        }
        return state.openRecord ? [makeHandle(state.openRecord)] : [];
      },
    });
  });
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  await expect(page.locator('[data-menu-tool="exportBtn"]')).toContainText("上書き保存");
  await expect(page.locator("#exportBtn")).toHaveAttribute("title", "上書き保存");
  await expect(page.locator("#exportBtn")).toHaveAttribute("aria-label", "上書き保存");
  await expect(page.locator("#saveAsBtn")).toContainText("名前を付けて保存");
  await page.click("#exportBtn");
  await expect.poll(() => page.evaluate(() => window.__jot2dFsMock.records[0]?.writeCount)).toBe(1);
  let state = await page.evaluate(() => ({
    saveCallCount: window.__jot2dFsMock.saveCalls.length,
    suggestedName: window.__jot2dFsMock.saveCalls[0].suggestedName,
    excludeAcceptAllOption: window.__jot2dFsMock.saveCalls[0].excludeAcceptAllOption,
    accept: window.__jot2dFsMock.saveCalls[0].types[0].accept,
    saved: JSON.parse(window.__jot2dFsMock.records[0].content),
    fileState: window.__jot2dTest.fileSystemAccessStateForTest(),
  }));
  expect(state.saveCallCount).toBe(1);
  expect(state.suggestedName).toBe("無題.jot2d");
  expect(state.excludeAcceptAllOption).toBe(true);
  expect(state.accept).toEqual({ "application/json": [".jot2d"] });
  expect(state.saved.version).toBe(19);
  expect(state.saved.documentName).toBe("無題");
  expect(state.fileState).toEqual({ hasHandle: true, handleName: "first-save.jot2d" });

  await page.keyboard.press("Control+S");
  await expect.poll(() => page.evaluate(() => window.__jot2dFsMock.records[0].writeCount)).toBe(2);
  expect(await page.evaluate(() => window.__jot2dFsMock.saveCalls.length)).toBe(1);

  await page.keyboard.press("Control+Shift+S");
  await expect.poll(() => page.evaluate(() => window.__jot2dFsMock.records[1]?.writeCount)).toBe(1);
  state = await page.evaluate(() => ({
    saveCallCount: window.__jot2dFsMock.saveCalls.length,
    fileState: window.__jot2dTest.fileSystemAccessStateForTest(),
  }));
  expect(state).toEqual({
    saveCallCount: 2,
    fileState: { hasHandle: true, handleName: "second-save.jot2d" },
  });

  await page.evaluate(() => {
    window.__jot2dFsMock.openRecord = {
      name: "opened-design.jot2d",
      content: window.__jot2dFsMock.records[0].content,
      writeCount: 0,
      closeCount: 0,
    };
  });
  await page.click("#importBtn");
  await expect.poll(() => page.evaluate(() => window.__jot2dTest.fileSystemAccessStateForTest().handleName))
    .toBe("opened-design.jot2d");
  state = await page.evaluate(() => ({
    openCallCount: window.__jot2dFsMock.openCalls.length,
    multiple: window.__jot2dFsMock.openCalls[0].multiple,
    excludeAcceptAllOption: window.__jot2dFsMock.openCalls[0].excludeAcceptAllOption,
    accept: window.__jot2dFsMock.openCalls[0].types[0].accept,
    nameState: window.__jot2dTest.documentNameState(),
  }));
  expect(state.openCallCount).toBe(1);
  expect(state.multiple).toBe(false);
  expect(state.excludeAcceptAllOption).toBe(true);
  expect(state.accept).toEqual({ "application/json": [".jot2d"] });
  expect(state.nameState).toEqual({
    modelName: "opened-design",
    displayName: "opened-design",
    serializedName: "opened-design",
    title: "opened-design - Jot2D",
  });

  await page.keyboard.press("Control+S");
  await expect.poll(() => page.evaluate(() => window.__jot2dFsMock.openRecord.writeCount)).toBe(1);
  expect(await page.evaluate(() => window.__jot2dFsMock.saveCalls.length)).toBe(2);

  await page.evaluate(() => { window.__jot2dFsMock.cancelNextSave = true; });
  await page.keyboard.press("Control+Shift+S");
  await expect.poll(() => page.evaluate(() => window.__jot2dFsMock.saveCalls.length)).toBe(3);
  await expect(page.locator("#hint")).toHaveText("保存をキャンセルしました");
  await expect(page.locator("#hint")).not.toHaveClass(/error/);
  expect(await page.evaluate(() => window.__jot2dTest.fileSystemAccessStateForTest().handleName))
    .toBe("opened-design.jot2d");

  await page.evaluate(() => { window.__jot2dFsMock.cancelNextOpen = true; });
  await page.click("#importBtn");
  await expect.poll(() => page.evaluate(() => window.__jot2dFsMock.openCalls.length)).toBe(2);
  await expect(page.locator("#hint")).toHaveText("ファイルを開く操作をキャンセルしました");
  await expect(page.locator("#hint")).not.toHaveClass(/error/);
  expect(await page.evaluate(() => ({
    fileState: window.__jot2dTest.fileSystemAccessStateForTest(),
    nameState: window.__jot2dTest.documentNameState(),
  }))).toEqual({
    fileState: { hasHandle: true, handleName: "opened-design.jot2d" },
    nameState: {
      modelName: "opened-design",
      displayName: "opened-design",
      serializedName: "opened-design",
      title: "opened-design - Jot2D",
    },
  });
});

test("HTML file picker compatibility route opens a Jot2D document without a native handle", async ({ page }) => {
  await page.addInitScript(() => {
    window.__nativeOpenCalled = false;
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async () => {
        window.__nativeOpenCalled = true;
        throw new Error("The native picker must not be used in compatibility mode");
      },
    });
  });
  await page.goto(`${baseUrl}/index.html?test=1&filePicker=input`);
  await page.waitForFunction(() => window.__jot2dTest);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.click("#importBtn");
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "browser-open.jot2d",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(lineCircleSparseLineDragFixture())),
  });

  await expect.poll(() => page.title()).toBe("browser-open - Jot2D");
  await expect(page.locator("#hint")).toHaveText("ファイルを開きました: browser-open.jot2d");
  expect(await page.evaluate(() => ({
    nativeOpenCalled: window.__nativeOpenCalled,
    fileState: window.__jot2dTest.fileSystemAccessStateForTest(),
    nameState: window.__jot2dTest.documentNameState(),
  }))).toEqual({
    nativeOpenCalled: false,
    fileState: { hasHandle: false, handleName: null },
    nameState: {
      modelName: "browser-open",
      displayName: "browser-open",
      serializedName: "browser-open",
      title: "browser-open - Jot2D",
    },
  });
});

test("Canvas always uses a compact native cursor and commands add the matching framed toolbar icon", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const canvasArea = await page.locator(".canvas-area").boundingBox();
  const pointer = { x: canvasArea.x + canvasArea.width * 0.62, y: canvasArea.y + canvasArea.height * 0.54 };
  const cursorState = (sourceSelector = null) => page.evaluate((selector) => {
    const canvas = document.getElementById("canvas");
    const source = selector ? document.querySelector(selector) : null;
    const value = canvas.style.getPropertyValue("--canvas-native-cursor");
    const uri = value.match(/data:image\/svg\+xml,([^"']+)/)?.[1] || "";
    const svg = uri ? decodeURIComponent(uri) : "";
    const sourcePath = source?.querySelector("path")?.getAttribute("d") || "";
    return {
      nativeActive: canvas.classList.contains("has-native-cursor"),
      commandActive: Boolean(canvas.dataset.commandCursorSource),
      source: canvas.dataset.commandCursorSource || null,
      nativeCursor: getComputedStyle(canvas).cursor.startsWith("url("),
      hotspot: value.endsWith(") 2 2, default"),
      hasPointerArrow: svg.includes('fill="#fff" stroke="#0f172a"'),
      hasCompactPointer: svg.includes('M1.5 1.5V17l3.8-3.9 2.9 6.8'),
      hasThinPointerOutline: svg.includes('stroke-width=".8"'),
      hasToolbarSurface: svg.includes('fill="#f8fafc" stroke="#c5cedb"'),
      hasRoundedBadge: svg.includes('width="22" height="22" rx="4"'),
      hasToolbarIconStyle: svg.includes('stroke="#1f2937" stroke-width="1.7"'),
      matchesSource: Boolean(sourcePath && svg.includes(sourcePath)),
      legacyIndicatorExists: Boolean(document.getElementById("canvasCommandCursorIndicator")),
    };
  }, sourceSelector);

  await page.mouse.move(pointer.x, pointer.y);
  expect(await cursorState()).toEqual(expect.objectContaining({
    nativeActive: true,
    commandActive: false,
    source: null,
    nativeCursor: true,
    hotspot: true,
    hasPointerArrow: true,
    hasCompactPointer: true,
    hasThinPointerOutline: true,
    hasToolbarSurface: false,
  }));

  await page.locator("#toolLine").click();
  expect(await cursorState("#toolLine")).toEqual({
    nativeActive: true,
    commandActive: true,
    source: "toolLine",
    nativeCursor: true,
    hotspot: true,
    hasPointerArrow: true,
    hasCompactPointer: true,
    hasThinPointerOutline: true,
    hasToolbarSurface: true,
    hasRoundedBadge: true,
    hasToolbarIconStyle: true,
    matchesSource: true,
    legacyIndicatorExists: false,
  });
  expect(await page.evaluate(() => {
    const canvas = document.getElementById("canvas");
    canvas.classList.add("is-panning");
    const cursor = getComputedStyle(canvas).cursor;
    canvas.classList.remove("is-panning");
    return cursor;
  })).toMatch(/^url\(/);

  await page.locator("#toolSelect").click();
  expect(await cursorState()).toEqual(expect.objectContaining({
    nativeActive: true,
    commandActive: false,
    source: null,
    nativeCursor: true,
    hasCompactPointer: true,
  }));

  await page.locator('[data-constraint="parallel"]').click();
  expect(await cursorState('[data-constraint="parallel"]')).toEqual(expect.objectContaining({
    nativeActive: true,
    commandActive: true,
    source: "constraint:parallel",
    nativeCursor: true,
    matchesSource: true,
  }));
  await page.keyboard.press("Escape");

  await page.locator("#annotationTextBtn").click();
  expect(await cursorState("#annotationTextBtn")).toEqual(expect.objectContaining({
    nativeActive: true,
    commandActive: true,
    source: "annotationTextBtn",
    nativeCursor: true,
    matchesSource: true,
  }));
});

test("Canvas context menu exposes common and object-specific operations", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
  const menu = page.locator("#canvasContextMenu");
  const canvasArea = await page.locator(".canvas-area").boundingBox();
  const blank = { x: canvasArea.x + canvasArea.width - 18, y: canvasArea.y + canvasArea.height - 18 };

  await page.mouse.click(blank.x, blank.y, { button: "right" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-label", "キャンバスコンテキストメニュー");
  const blankItems = await menu.locator("button").evaluateAll((buttons) => buttons.map((button) => ({
    action: button.dataset.contextAction,
    label: button.querySelector("span")?.textContent,
    disabled: button.disabled,
  })));
  expect(blankItems).toEqual([
    { action: "paste", label: "貼り付け", disabled: true },
    { action: "undo", label: "元に戻す", disabled: true },
    { action: "redo", label: "やり直す", disabled: true },
    { action: "fit-visible", label: "表示中図形へフィット", disabled: false },
  ]);
  const menuBounds = await menu.boundingBox();
  expect(menuBounds.x).toBeGreaterThanOrEqual(canvasArea.x);
  expect(menuBounds.y).toBeGreaterThanOrEqual(canvasArea.y);
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(canvasArea.x + canvasArea.width);
  expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(canvasArea.y + canvasArea.height);
  expect(await page.evaluate(() => document.activeElement?.dataset.contextAction)).toBe("fit-visible");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  const linePosition = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("line", "L1"));
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1", "L2"] }));
  await page.mouse.click(linePosition.x, linePosition.y, { button: "right" });
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).lines).toEqual(["L1", "L2"]);
  await expect(menu.locator('[data-context-action="fillet"]')).toBeEnabled();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await page.mouse.click(linePosition.x, linePosition.y, { button: "right" });
  await expect(menu).toBeVisible();
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).lines).toEqual(["L1"]);
  const lineItems = await menu.locator("button").evaluateAll((buttons) => buttons.map((button) => ({ action: button.dataset.contextAction, label: button.querySelector("span")?.textContent, disabled: button.disabled })));
  expect(lineItems).toEqual(expect.arrayContaining([
    { action: "fix-toggle", label: "固定", disabled: false },
    { action: "construction-toggle", label: "補助線に変更", disabled: false },
    { action: "offset", label: "ここからオフセット", disabled: false },
    { action: "fillet", label: "R面取り", disabled: true },
    { action: "add-leader", label: "引出線を追加", disabled: false },
    { action: "create-block", label: "選択からブロック作成", disabled: false },
    { action: "cut", label: "切り取り", disabled: false },
    { action: "copy", label: "コピー", disabled: false },
    { action: "delete", label: "削除", disabled: false },
    { action: "show-properties", label: "プロパティを表示", disabled: false },
  ]));
  await menu.locator('[data-context-action="construction-toggle"]').click();
  await expect(menu).toBeHidden();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).lines.find((line) => line.id === "L1").construction).toBe(true);

  await page.click("#togglePropertiesPanelBtn");
  await expect(page.locator("#togglePropertiesPanelBtn")).toHaveAttribute("aria-expanded", "false");
  const collapsedLinePosition = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("line", "L1"));
  await page.mouse.click(collapsedLinePosition.x, collapsedLinePosition.y, { button: "right" });
  await expect(menu.locator('[data-context-action="construction-toggle"] span')).toHaveText("実線に変更");
  await menu.locator('[data-context-action="show-properties"]').click();
  await expect(page.locator("#togglePropertiesPanelBtn")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("線");

  const isolatedPoint = await page.evaluate((client) => window.__jot2dTest.addIsolatedFixedPointForContextTest(client), { x: blank.x - 70, y: blank.y });
  await page.mouse.click(isolatedPoint.client.x, isolatedPoint.client.y, { button: "right" });
  await expect(menu.locator('[data-context-action="fix-toggle"] span')).toHaveText("固定解除");
  await menu.locator('[data-context-action="fix-toggle"]').click();
  expect((await page.evaluate((id) => window.__jot2dTest.serializedModelForTest().points.find((point) => point.id === id).fixed, isolatedPoint.id))).toBe(false);
  await page.keyboard.press("Control+z");
  expect((await page.evaluate((id) => window.__jot2dTest.serializedModelForTest().points.find((point) => point.id === id).fixed, isolatedPoint.id))).toBe(true);

  const dimensionPosition = await page.evaluate(() => window.__jot2dTest.dimensionClientPositionForTest(0));
  await page.mouse.click(dimensionPosition.x, dimensionPosition.y, { button: "right" });
  await expect(menu.locator('[data-context-action="dimension-edit"] span')).toHaveText("値 / 数式を編集");
  await menu.locator('[data-context-action="dimension-edit"]').click();
  await expect(page.locator("#dimensionValueInput")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.click("#toolLine");
  await page.mouse.click(blank.x, blank.y, { button: "right" });
  await expect(menu.locator('[data-context-action="cancel-command"] span')).toHaveText("コマンドをキャンセル");
  await menu.locator('[data-context-action="cancel-command"]').click();
  await expect(page.locator("#toolSelect")).toHaveClass(/active/);

  const blockState = await page.evaluate(() => window.__jot2dTest.resetForBlockClipboardTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 50, y: 20 }, 2));
  const blockPosition = await page.evaluate(() => window.__jot2dTest.blockInteractionPoints());
  await page.mouse.click(blockPosition.center.x, blockPosition.center.y, { button: "right" });
  await expect(menu.locator('[data-context-action="block-edit"] span')).toHaveText("ブロック定義を編集");
  await expect(menu.locator('[data-context-action="block-rotation-toggle"] span')).toHaveText("自由回転");
  await expect(menu.locator('[data-context-action="block-rotation-toggle"]')).toBeDisabled();
  await expect(menu.locator('[data-context-action="fix-toggle"] span')).toHaveText("固定解除");
  await menu.locator('[data-context-action="fix-toggle"]').click();
  expect((await page.evaluate((id) => window.__jot2dTest.blockRotationLockStateForTest(id), blockState.selectedBlockInstanceIds[0])).fixed).toBe(false);
  await page.mouse.click(blockPosition.center.x, blockPosition.center.y, { button: "right" });
  await expect(menu.locator('[data-context-action="block-rotation-toggle"]')).toBeEnabled();
  await menu.locator('[data-context-action="block-rotation-toggle"]').click();
  expect((await page.evaluate((id) => window.__jot2dTest.blockRotationLockStateForTest(id), blockState.selectedBlockInstanceIds[0])).rotationLocked).toBe(false);

  await page.mouse.click(blockPosition.center.x, blockPosition.center.y, { button: "right" });
  await page.locator(".properties").click({ position: { x: 8, y: 8 } });
  await expect(menu).toBeHidden();
  await page.mouse.click(blockPosition.center.x, blockPosition.center.y, { button: "right" });
  await menu.locator('[data-context-action="block-edit"]').click();
  await expect(page.locator("body")).toHaveClass(/block-editing/);
  expect(await page.evaluate(() => {
    const canvasStyle = getComputedStyle(document.querySelector(".canvas-area"));
    const overlayStyle = getComputedStyle(document.querySelector(".block-editor-overlay"));
    return {
      canvasBackground: canvasStyle.backgroundColor,
      overlayBackground: overlayStyle.backgroundColor,
      overlayBorder: overlayStyle.borderTopColor,
      overlayShadow: overlayStyle.boxShadow,
    };
  })).toEqual({
    canvasBackground: "rgb(243, 247, 255)",
    overlayBackground: "rgba(239, 246, 255, 0.95)",
    overlayBorder: "rgb(147, 197, 253)",
    overlayShadow: "rgba(30, 64, 175, 0.14) 0px 8px 24px 0px",
  });
  await page.locator("#cancelBlockEditBtn").click();
  await expect(page.locator("body")).not.toHaveClass(/block-editing/);

  await openApplicationSettings(page);
  await page.locator("#applicationLanguageSelect").selectOption("en");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await page.mouse.click(blank.x, blank.y, { button: "right" });
  await expect(menu).toHaveAttribute("aria-label", "Canvas context menu");
  await expect(menu.locator('[data-context-action="fit-visible"] span')).toHaveText("Fit Visible Geometry");
});

test("Overlapping Canvas objects can be previewed and selected from context candidates", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForOverlappingContextSelectionTest());
  const menu = page.locator("#canvasContextMenu");

  await page.mouse.click(fixture.client.x, fixture.client.y, { button: "right" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveClass(/candidate-menu/);
  await expect(menu.locator(".canvas-context-candidate-heading")).toContainText("選択候補");
  const rows = menu.locator("[data-context-candidate-index]");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText(`線${fixture.lineIds[1]}`);
  await expect(rows.nth(2)).toContainText(`ブロック${fixture.blockId}`);
  await expect(rows.nth(0).locator("svg")).toHaveAttribute("viewBox", await page.locator("#toolLine svg").getAttribute("viewBox"));
  const openedState = await page.evaluate(() => window.__jot2dTest.canvasContextSelectionStateForTest());
  expect(openedState.selected.lines).toEqual(fixture.lineIds);
  expect(openedState.candidates.map(({ kind, id }) => ({ kind, id }))).toEqual([
    { kind: "line", id: fixture.lineIds[1] },
    { kind: "line", id: fixture.lineIds[0] },
    { kind: "block", id: fixture.blockId },
  ]);
  expect(openedState.candidates.some(({ id }) => fixture.excludedIds.includes(id))).toBe(false);

  await rows.nth(1).hover();
  let state = await page.evaluate(() => window.__jot2dTest.canvasContextSelectionStateForTest());
  expect(state.hovered).toBe(fixture.lineIds[0]);
  expect(state.selected.lines).toEqual(fixture.lineIds);

  await rows.nth(1).click();
  await expect(menu).toBeHidden();
  state = await page.evaluate(() => window.__jot2dTest.canvasContextSelectionStateForTest());
  expect(state.selected.lines).toEqual([fixture.lineIds[0]]);
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("線");
  await expect(page.locator("#propertiesPanel .property-section").first()).toContainText(`ID${fixture.lineIds[0]}`);
  await expandSketchTreeSketch(page, "S1");
  await expect(page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="line"]')).toHaveClass(/has-active-descendant/);

  await page.mouse.click(fixture.client.x, fixture.client.y, { button: "right" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  state = await page.evaluate(() => window.__jot2dTest.canvasContextSelectionStateForTest());
  expect(state.selected.lines).toEqual([fixture.lineIds[0]]);

  await page.mouse.click(fixture.client.x, fixture.client.y, { button: "right" });
  await page.keyboard.press("Space");
  await expect(menu).toBeHidden();
  state = await page.evaluate(() => window.__jot2dTest.canvasContextSelectionStateForTest());
  expect(state.selected.lines).toEqual([fixture.lineIds[1]]);

  await openApplicationSettings(page);
  await page.locator("#applicationLanguageSelect").selectOption("en");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await page.mouse.click(fixture.client.x, fixture.client.y, { button: "right" });
  await expect(menu.locator(".canvas-context-candidate-heading")).toContainText("Selection Candidates");
  await expect(menu.locator("[data-context-candidate-index]").first()).toContainText(`Line${fixture.lineIds[1]}`);
  await page.keyboard.press("Escape");
});

test("Canvas selection updates Properties, Properties collapses, and narrow toolbar labels do not overlap", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());

  const linePosition = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("line", "L1"));
  await page.mouse.click(linePosition.x, linePosition.y);
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("線");
  await expect(page.locator("#propertiesPanel .property-section h3").first()).toHaveText("基本情報");
  expect(await page.locator("#propertiesPanel .property-section").first().locator(".property-row").allTextContents()).toEqual([
    "種類線", "IDL1", "始点IDP1", "終点IDP2", "長さ140", "拘束状態未拘束", "補助線",
  ]);

  const initial = await page.evaluate(() => ({
    properties: document.querySelector(".properties").getBoundingClientRect().width,
    canvas: document.querySelector(".canvas-area").getBoundingClientRect().width,
  }));
  await expect(page.locator("#toggleExplorerPanelBtn, .explorer")).toHaveCount(0);
  await page.click("#togglePropertiesPanelBtn");
  await expect(page.locator("#togglePropertiesPanelBtn")).toHaveAttribute("aria-expanded", "false");
  const collapsed = await page.evaluate(() => ({
    properties: document.querySelector(".properties").getBoundingClientRect().width,
    canvas: document.querySelector(".canvas-area").getBoundingClientRect().width,
  }));
  expect(collapsed.properties).toBeCloseTo(36, 0);
  expect(collapsed.canvas).toBeGreaterThan(initial.canvas);

  await page.click("#togglePropertiesPanelBtn");
  const restored = await page.evaluate(() => ({
    properties: document.querySelector(".properties").getBoundingClientRect().width,
  }));
  expect(restored.properties).toBeCloseTo(initial.properties, 0);
  await expect(page.locator(".tool-group-label").first()).toBeVisible();

  for (const width of [1260, 1200, 800]) {
    await page.setViewportSize({ width, height: 700 });
    const narrowToolbar = await page.evaluate(() => {
      const labels = [...document.querySelectorAll(".tool-group-label")];
      const buttons = [...document.querySelectorAll(".command-toolbar button")];
      const menuItems = [...document.querySelectorAll(".app-menu > summary")];
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const labelOverlaps = labels.some((label) => {
        if (getComputedStyle(label).display === "none") return false;
        const rect = label.getBoundingClientRect();
        return buttons.some((button) => intersects(rect, button.getBoundingClientRect()));
      });
      const menuOverlaps = menuItems.some((item) => {
        const rect = item.getBoundingClientRect();
        return buttons.some((button) => intersects(rect, button.getBoundingClientRect()));
      });
      return {
        labelsHidden: labels.every((label) => getComputedStyle(label).display === "none"),
        labelOverlaps,
        menuOverlaps,
      };
    });
    expect(narrowToolbar).toEqual({ labelsHidden: true, labelOverlaps: false, menuOverlaps: false });
  }
});

test("Properties visually separates basic information and previews valid text and numeric input before one history commit", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));

  const sectionColors = await page.locator("#propertiesPanel > .property-section").evaluateAll((sections) => sections.map((section) => ({
    background: getComputedStyle(section).backgroundColor,
    border: getComputedStyle(section).borderColor,
  })));
  expect(sectionColors).toEqual([
    { background: "rgb(248, 250, 252)", border: "rgb(216, 222, 232)" },
    { background: "rgb(242, 248, 255)", border: "rgb(203, 223, 245)" },
  ]);
  await expect(page.locator(".properties-scroll")).toHaveCSS("background-color", "rgb(244, 247, 251)");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--muted").trim())).toBe("#5f6f86");

  const historyBeforeInput = await page.evaluate(() => window.__jot2dTest.historyState().undoCount);
  const colorInput = page.locator('#propertiesPanel [data-appearance-key="color"]');
  await colorInput.evaluate((input) => {
    input.focus();
    input.value = "#dc2626";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective.color).toBe("#dc2626");
  expect(await page.evaluate(() => window.__jot2dTest.historyState().undoCount)).toBe(historyBeforeInput);

  await colorInput.evaluate((input) => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(await page.evaluate(() => window.__jot2dTest.historyState().undoCount)).toBe(historyBeforeInput + 1);

  const invalidColorInput = page.locator('#propertiesPanel [data-appearance-key="color"]');
  await invalidColorInput.evaluate((input) => {
    input.focus();
    input.value = "#00";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective.color).toBe("#dc2626");

  const lineWidthInput = page.locator('#propertiesPanel [data-appearance-key="lineWidth"]');
  await lineWidthInput.evaluate((input) => {
    input.focus();
    input.value = "3.4";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective.lineWidth).toBe(3.4);
  expect(await page.evaluate(() => window.__jot2dTest.historyState().undoCount)).toBe(historyBeforeInput + 1);
  await lineWidthInput.evaluate((input) => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(await page.evaluate(() => window.__jot2dTest.historyState().undoCount)).toBe(historyBeforeInput + 2);

  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({}));
  const generalAppearance = page.locator('#propertiesPanel [data-property-section="general"]');
  await expect(generalAppearance).toBeVisible();
  expect(await generalAppearance.evaluate((section) => ({
    background: getComputedStyle(section).backgroundColor,
    border: getComputedStyle(section).borderColor,
  }))).toEqual({ background: "rgb(242, 248, 255)", border: "rgb(203, 223, 245)" });
});

test("application language defaults to Japanese and persists the full UI selection", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator(".app-menu > summary").first()).toHaveText("ファイル");
  await expect(page.locator("#activeSketchLabel")).toHaveText("スケッチツリー");
  await expect(page.locator(".properties .panel-title-label")).toHaveText("プロパティ");
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("スケッチ");
  await expect(page.locator("#propertiesPanel .property-section h3").first()).toHaveText("基本情報");
  expect(await page.locator("#propertiesPanel .property-section").first().locator(".property-row").allTextContents()).toEqual(expect.arrayContaining([
    "種類スケッチ", "IDS1", "名前Sketch-1", "親スケッチRoot Sketch (ROOT)", "アクティブはい",
  ]));

  await openApplicationSettings(page);
  await expect(page.locator("#applicationLanguageSelect")).toHaveValue("ja");
  await page.locator("#applicationLanguageSelect").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".app-menu > summary").first()).toHaveText("File");
  await expect(page.locator('[data-menu-tool="exportBtn"]')).toContainText("Overwrite Save");
  await expect(page.locator("#exportBtn")).toHaveAttribute("title", "Overwrite Save");
  await expect(page.locator("#exportBtn")).toHaveAttribute("aria-label", "Overwrite Save");
  await expect(page.locator("#activeSketchLabel")).toHaveText("Sketch Tree");
  await expect(page.locator(".properties .panel-title-label")).toHaveText("Properties");
  await expect(page.locator("#hint")).toContainText("Select or create geometry");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await openDocumentSettings(page);
  await expect(page.locator("#documentSettingsDialog")).toContainText("Document Settings");
  await expect(page.locator("#documentSettingsDialog h3")).toHaveText(["General Appearance", "Construction Appearance", "Dimension Appearance"]);
  await expect(page.locator('#documentAppearanceFields select[data-appearance-key="visible"] option')).toHaveText(["Visible", "Hidden"]);
  await expect(page.locator('#documentConstructionAppearanceFields select[data-appearance-key="lineType"] option')).toHaveText(["Solid", "Dashed", "Dash-dot", "Dash-dot-dot", "Dotted"]);
  await expect(page.locator('#documentDimensionAppearanceFields select[data-dimension-display="visible"] option')).toHaveText(["Visible", "Hidden"]);
  await expect(page.locator("#documentDimensionAppearanceFields .dimension-appearance-group-title")).toHaveText(["Extension lines", "Terminators", "Dimension text"]);
  expect(await page.locator("#documentDimensionAppearanceFields .dimension-appearance-group").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderTopStyle: style.borderTopStyle,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      borderRadius: style.borderRadius,
    };
  })).toEqual({
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopStyle: "solid",
    borderRightWidth: "0px",
    borderBottomWidth: "0px",
    borderLeftWidth: "0px",
    borderRadius: "0px",
  });
  await expect(page.locator('#documentDimensionAppearanceFields [data-dimension-display="extensionLines"]')).toHaveCount(0);
  await expect(page.locator("#documentDimensionAppearanceFields .property-input-unit")).toHaveText(["mm", "mm", "mm", "°", "mm", "mm"]);
  await expect(page.locator('label[for="documentDimensionExtensionLineOvershoot"]')).toHaveText("Overshoot");
  await expect(page.locator('label[for="documentDimensionExtensionLineOriginGap"]')).toHaveText("Origin gap");
  await expect(page.locator('label[for="documentDimensionTerminatorType"]')).toHaveText("Type");
  await expect(page.locator('label[for="documentDimensionTerminatorSize"]')).toHaveText("Size");
  await expect(page.locator('label[for="documentDimensionArrowheadAngle"]')).toHaveText("Opening angle");
  await expect(page.locator('label[for="documentDimensionDimensionTextHeight"]')).toHaveText("Height");
  await expect(page.locator('label[for="documentDimensionDimensionTextGap"]')).toHaveText("Gap from dimension line");
  await page.locator("#documentSettingsDialog button[value=cancel]").first().click();
  await selectSketch(page, "ROOT");
  await expect(page.locator("#propertiesPanel .property-section h3")).toHaveText(["Basic Information"]);
  await expect(page.locator("#propertiesPanel .property-section-collapsible")).toHaveCount(0);
  await selectSketch(page, "S1");
  await expect(page.locator("#propertiesPanel .property-section h3")).toContainText(["Basic Information", "General Appearance", "Construction Appearance", "Dimension Appearance"]);
  await expect(page.locator('#sketchConstructionPropertyVisible option')).toHaveText(["Default (Visible)", "Visible", "Hidden"]);
  await expect(page.locator('#sketchConstructionPropertyLineType option')).toHaveText(["Default (Dash-dot)", "Solid", "Dashed", "Dash-dot", "Dash-dot-dot", "Dotted"]);
  await expect(page.locator('#sketchDimensionVisible option')).toHaveText(["Default (Visible)", "Visible", "Hidden"]);
  await expect(page.locator("#sketchDimensionColor")).toHaveAttribute("placeholder", "Default (#64748b)");
  await expect(page.locator("#sketchDimensionPrefix")).toHaveAttribute("placeholder", "Default (Empty)");
  await openParameterDialog(page);
  expect(await page.locator("#parametersDialog thead th").allTextContents()).toEqual([
    "Name", "Value / Expression", "Evaluated value", "", "Name", "Type / owner", "Value / Expression", "Evaluated value",
  ]);
  await page.locator("#parametersCloseBtn").click();
  await page.evaluate(() => window.__jot2dTest.resetForReadOnlyDuplicateDimension());
  await expandSketchTreeGroup(page, "constraint");
  await page.locator('.sketch-object-row[data-object-kind="constraint"]').first().click();
  await expect(page.locator("#propertiesPanel")).toContainText("Value / Expression");
  await openBlockDefinitions(page);
  await expect(page.locator("#blockDefinitionsDialog")).toContainText("No blocks");
  await page.locator("#blockDefinitionsDialog button[value=cancel]").first().click();

  await page.reload();
  await page.waitForFunction(() => window.__jot2dTest);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await openApplicationSettings(page);
  await expect(page.locator("#applicationLanguageSelect")).toHaveValue("en");
  await page.locator("#applicationLanguageSelect").selectOption("ja");
  await expect(page.locator(".app-menu > summary").first()).toHaveText("ファイル");
  await expect(page.locator("#hint")).toContainText("Geometryを選択または作成します");
  await expect(page.locator("#hint")).not.toContainText("Select or create geometry");
});

test("Document owns appearance defaults while only non-root Sketches expose compact overrides", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
  const initialDefaults = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(initialDefaults.defaultAppearance).toEqual({ visible: true, color: "#111827", lineType: "solid", lineWidth: 2 });
  expect(initialDefaults.defaultConstructionAppearance).toEqual({
    visible: true, color: "#64748b", lineType: "dashdot", lineWidth: 1, endpointOverhang: true, endpointMarkers: true,
  });
  expect(initialDefaults.defaultDimensionAppearance).toEqual({
    visible: true,
    color: "#64748b",
    lineWidth: 1.2,
    precision: null,
    prefix: "",
    suffix: "",
    terminatorType: "arrow",
    extensionLineOvershoot: 1.5,
    extensionLineOriginGap: 1.5,
    terminatorSize: 4,
    arrowheadAngle: 30,
    dimensionTextHeight: 5,
    dimensionTextGap: 0,
  });
  await selectSketch(page, "ROOT");
  await expect(page.locator("#propertiesPanel .property-section h3")).toHaveText(["基本情報"]);
  await expect(page.locator("#propertiesPanel [data-appearance-key], #propertiesPanel [data-dimension-display]")).toHaveCount(0);

  await openDocumentSettings(page);
  await expect(page.locator("#documentSettingsDialog h3")).toHaveText(["一般外観", "補助線外観", "寸法外観"]);
  await page.locator("#documentPropertyColor").fill("#2563eb");
  await page.locator("#documentPropertyColor").blur();
  await page.locator("#documentConstructionPropertyColor").fill("#dc2626");
  await page.locator("#documentConstructionPropertyColor").blur();
  await page.locator("#documentDimensionColor").fill("#0e7490");
  await page.locator("#documentDimensionColor").blur();
  await page.locator("#documentSettingsDialog button[value=cancel]").first().click();

  const documentSettings = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(documentSettings.defaultAppearance.color).toBe("#2563eb");
  expect(documentSettings.defaultConstructionAppearance.color).toBe("#dc2626");
  expect(documentSettings.defaultDimensionAppearance.color).toBe("#0e7490");
  expect(documentSettings.sketches.find((sketch) => sketch.id === "ROOT")).toEqual(expect.objectContaining({
    appearance: {}, constructionAppearance: {}, dimensionAppearance: {},
  }));
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective.color).toBe("#2563eb");
  await page.click("#undoBtn");
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).defaultDimensionAppearance.color).toBe("#64748b");
  await page.click("#redoBtn");
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).defaultDimensionAppearance.color).toBe("#0e7490");

  await selectSketch(page, "S1");
  await expect(page.locator("#propertiesPanel .property-section h3")).toContainText(["基本情報", "一般外観", "補助線外観", "寸法外観"]);
  const appearanceSections = page.locator("#propertiesPanel .property-section-collapsible");
  await expect(appearanceSections).toHaveCount(3);
  for (const key of ["general", "construction", "dimension"]) {
    const section = page.locator(`[data-property-section="${key}"]`);
    await expect(section).not.toHaveAttribute("open", "");
    await expect(section.locator(".property-section-content")).toBeHidden();
    await section.locator("summary").click();
    await expect(section).toHaveAttribute("open", "");
  }
  await selectSketch(page, "ROOT");
  await selectSketch(page, "S1");
  for (const key of ["general", "construction", "dimension"]) await expect(page.locator(`[data-property-section="${key}"]`)).toHaveAttribute("open", "");
  const compactMetrics = await page.evaluate(() => ({
    panelPadding: getComputedStyle(document.querySelector("#propertiesPanel")).paddingTop,
    sectionPadding: getComputedStyle(document.querySelector("#propertiesPanel .property-section")).paddingTop,
    rowMinHeight: getComputedStyle(document.querySelector("#propertiesPanel .property-row")).minHeight,
    inputHeight: document.querySelector("#propertyColor").getBoundingClientRect().height,
  }));
  expect(compactMetrics).toEqual(expect.objectContaining({ panelPadding: "7px", sectionPadding: "6px", rowMinHeight: "26px" }));
  expect(compactMetrics.inputHeight).toBeLessThanOrEqual(25);

  await expect(page.locator("#sketchConstructionPropertyColor")).toHaveValue("");
  await expect(page.locator("#sketchDimensionColor")).toHaveValue("");
  await expect(page.locator("#propertyColor")).toHaveAttribute("placeholder", "既定 (#2563eb)");
  await expect(page.locator("#sketchConstructionPropertyColor")).toHaveAttribute("placeholder", "既定 (#dc2626)");
  await expect(page.locator("#sketchDimensionColor")).toHaveAttribute("placeholder", "既定 (#0e7490)");
  await expect(page.locator("#sketchConstructionPropertyLineType option").first()).toHaveText("既定 (一点鎖線)");
  await expect(page.locator("#sketchDimensionTerminatorType option").first()).toHaveText("既定 (標準矢印)");
  await expect(page.locator("#sketchDimensionTerminatorSize")).toHaveAttribute("placeholder", "既定 (4 mm)");
  await expect(page.locator('[data-sketch-default-appearance="construction"] .property-color-picker')).toHaveAttribute("data-current-color", "#dc2626");
  await expect(page.locator('[data-sketch-default-appearance="dimension"] .property-color-picker')).toHaveAttribute("data-current-color", "#0e7490");

  await page.locator("#propertyColor").fill("#f97316");
  await page.locator("#propertyColor").blur();
  await page.locator("#sketchConstructionPropertyColor").fill("#16a34a");
  await page.locator("#sketchConstructionPropertyColor").blur();
  await page.locator("#sketchDimensionColor").fill("#7c3aed");
  await page.locator("#sketchDimensionColor").blur();
  const childSettings = await page.evaluate(() => window.__jot2dTest.serializedModelForTest().sketches.find((sketch) => sketch.id === "S1"));
  expect(childSettings).toEqual(expect.objectContaining({
    appearance: expect.objectContaining({ color: "#f97316" }),
    constructionAppearance: expect.objectContaining({ color: "#16a34a" }),
    dimensionAppearance: expect.objectContaining({ color: "#7c3aed" }),
  }));
});

test("nested Sketches inherit independent Document appearance defaults instead of general or parent Sketch appearance", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = {
    version: 10,
    documentName: "document-appearance-inheritance",
    defaultAppearance: { visible: true, color: "#2563eb", lineType: "solid", lineWidth: 2 },
    defaultConstructionAppearance: { visible: true, color: "#16a34a", lineType: "dashdot", lineWidth: 1.1, endpointOverhang: true, endpointMarkers: true },
    defaultDimensionAppearance: { visible: true, color: "#7c3aed", precision: null, prefix: "", suffix: "", arrows: true, extensionLines: true },
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {} },
      { id: "S1", name: "Parent", parentSketchId: "ROOT", kind: "sketch", appearance: { color: "#dc2626" }, constructionAppearance: { color: "#f97316" }, dimensionAppearance: { color: "#0e7490" } },
      { id: "S2", name: "Child", parentSketchId: "S1", kind: "sketch", appearance: { visible: false, color: "#a855f7", lineType: "dotted", lineWidth: 7 }, constructionAppearance: { lineType: "dashed" }, dimensionAppearance: {} },
    ],
    activeSketchId: "S2",
    points: [
      { id: "P1", x: 0, y: 0, fixed: false, kind: "endpoint", sketchId: "S2", appearance: {} },
      { id: "P2", x: 100, y: 0, fixed: false, kind: "endpoint", sketchId: "S2", appearance: {} },
    ],
    lines: [{ id: "L1", p1: "P1", p2: "P2", construction: true, sketchId: "S2", appearance: {} }],
    circles: [], arcs: [], constraints: [], parameters: [], nextDimensionParameterIndex: 1,
    blockDefinitions: [{
      id: "B1", name: "Legacy Root Appearance", revision: 1, origin: { x: 0, y: 0 },
      sketches: [
        { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: { color: "#db2777" }, constructionAppearance: { color: "#f97316" }, dimensionAppearance: { color: "#0ea5e9" } },
        { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
      ],
      activeSketchId: "S1",
      points: [], lines: [], circles: [], arcs: [], constraints: [], blockInstances: [], annotations: [],
      parameters: [], nextDimensionParameterIndex: 1,
    }],
    blockInstances: [], annotations: [],
  };
  await page.evaluate((data) => window.__jot2dTest.importDocumentNameFixture(data, "document-appearance-inheritance.json"), fixture);
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective).toEqual(expect.objectContaining({
    visible: true, color: "#16a34a", lineType: "dashed", lineWidth: 1.1,
  }));
  await selectSketch(page, "S2");
  await expect(page.locator('[data-property-section="general"] .property-color-picker')).toHaveAttribute("data-current-color", "#a855f7");
  await expect(page.locator('[data-property-section="construction"] .property-color-picker')).toHaveAttribute("data-current-color", "#16a34a");
  await expect(page.locator('[data-property-section="dimension"] .property-color-picker')).toHaveAttribute("data-current-color", "#7c3aed");
  const serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const definitionRoot = serialized.blockDefinitions[0].sketches.find((sketch) => sketch.id === "ROOT");
  const definitionSketch = serialized.blockDefinitions[0].sketches.find((sketch) => sketch.id === "S1");
  expect(definitionRoot).toEqual(expect.objectContaining({ appearance: {}, constructionAppearance: {}, dimensionAppearance: {} }));
  expect(definitionSketch).toEqual(expect.objectContaining({
    appearance: expect.objectContaining({ color: "#db2777" }),
    constructionAppearance: expect.objectContaining({ color: "#f97316" }),
    dimensionAppearance: expect.objectContaining({ color: "#0ea5e9" }),
  }));
});

test("legacy Root Sketch appearance moves to Document defaults on load", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = {
    version: 10,
    documentName: "root-appearance-migration",
    defaultAppearance: { visible: true, color: "#111827", lineType: "solid", lineWidth: 2 },
    defaultConstructionAppearance: { visible: true, color: "#64748b", lineType: "dashdot", lineWidth: 1.1, endpointOverhang: true, endpointMarkers: true },
    defaultDimensionAppearance: { visible: true, color: "#6b7280", precision: null, prefix: "", suffix: "", arrows: true, extensionLines: true },
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: { color: "#2563eb" }, constructionAppearance: { color: "#16a34a" }, dimensionAppearance: { color: "#7c3aed" } },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} },
    ],
    activeSketchId: "S1",
    points: [
      { id: "P1", x: 0, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P2", x: 100, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    ],
    lines: [{ id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1", appearance: {} }],
    circles: [], arcs: [], constraints: [], parameters: [], nextDimensionParameterIndex: 1,
    blockDefinitions: [], blockInstances: [], annotations: [],
  };
  await page.evaluate((data) => window.__jot2dTest.importDocumentNameFixture(data, "root-appearance-migration.json"), fixture);
  const serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.defaultAppearance.color).toBe("#2563eb");
  expect(serialized.defaultConstructionAppearance.color).toBe("#16a34a");
  expect(serialized.defaultDimensionAppearance.color).toBe("#7c3aed");
  expect(serialized.sketches.find((sketch) => sketch.id === "ROOT")).toEqual(expect.objectContaining({
    appearance: {}, constructionAppearance: {}, dimensionAppearance: {},
  }));
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective.color).toBe("#2563eb");
});

test("Appearance cascades, used file colors are selectable, and constraint status supports mouse and Space", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = {
    version: 9,
    documentName: "appearance-cascade",
    defaultAppearance: { visible: true, color: "#ef4444", lineType: "solid", lineWidth: 1 },
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {} },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: { color: "#16a34a" } },
    ],
    activeSketchId: "S1",
    points: [
      { id: "P1", x: 0, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: { color: "#f97316" } },
      { id: "P2", x: 100, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P3", x: 0, y: 30, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P4", x: 100, y: 30, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    ],
    lines: [
      { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1", appearance: { lineWidth: 4 } },
      { id: "L2", p1: "P3", p2: "P4", construction: true, sketchId: "S1", appearance: {} },
    ],
    circles: [], arcs: [], constraints: [], blockDefinitions: [], blockInstances: [],
    annotations: [{ id: "AN1", type: "text", visible: true, text: "note", x: 0, y: 30, style: { color: "#0ea5e9" } }],
  };
  await page.evaluate((data) => window.__jot2dTest.importDocumentNameFixture(data, "appearance-cascade.json"), fixture);
  expect(await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).toEqual({
    direct: { lineWidth: 4 },
    effective: { visible: true, color: "#16a34a", lineType: "solid", lineWidth: 4 },
    visible: true,
  });

  await expandSketchTreeGroup(page, "line");
  await page.locator('.sketch-object-row[data-object-kind="line"][data-id="L1"]').click();
  await expect(page.locator("#propertiesPanel")).toContainText("基本情報");
  await expect(page.locator("#propertiesPanel")).toContainText("長さ");
  await expect(page.locator("#propertiesPanel")).toContainText("外観");
  await expect(page.locator("#propertiesPanel")).not.toContainText(/Geometry|Length|Appearance|Visible|Color|Line type|Line width/);
  await expect(page.locator('#propertyVisible option[value=""]')).toHaveText("既定 (表示)");
  await expect(page.locator('#propertyLineType option[value=""]')).toHaveText("既定 (実線)");
  await expect(page.locator("#propertyColor")).toHaveAttribute("placeholder", "既定 (#16a34a)");
  await expect(page.locator("#propertyLineWidth")).toHaveAttribute("placeholder", "既定 (4)");
  await expect(page.locator(".property-color-picker")).toHaveAttribute("data-current-color", "#16a34a");
  await expect(page.locator(".property-color-default")).toHaveCount(0);
  await page.locator(".property-color-picker").click();
  await expect(page.locator("#colorPaletteDialog")).toBeVisible();
  expect(await page.locator("#defaultColorPalette .property-color-swatch").evaluateAll((items) => items.map((item) => item.dataset.paletteColor))).toEqual([
    "#000000", "#111827", "#374151", "#64748b", "#94a3b8", "#cbd5e1", "#ffffff",
    "#fca5a5", "#dc2626", "#991b1b",
    "#fdba74", "#f97316", "#c2410c",
    "#fde68a", "#f59e0b", "#b45309",
    "#86efac", "#16a34a", "#166534",
    "#5eead4", "#14b8a6", "#0f766e",
    "#67e8f9", "#0ea5e9", "#0e7490",
    "#93c5fd", "#2563eb", "#1e40af",
    "#c4b5fd", "#7c3aed", "#5b21b6",
    "#f9a8d4", "#db2777", "#9d174d",
  ]);
  const redSwatch = page.locator('#defaultColorPalette .property-color-swatch[data-palette-color="#dc2626"]');
  await redSwatch.hover();
  expect(await redSwatch.evaluate((item) => getComputedStyle(item).backgroundColor)).toBe("rgb(220, 38, 38)");
  expect(await page.locator("#usedColorPalette .property-color-swatch").evaluateAll((items) => items.map((item) => item.dataset.paletteColor))).toEqual([
    "#ef4444", "#64748b", "#16a34a", "#f97316", "#0ea5e9",
  ]);
  await page.locator("#colorPaletteDialog button[value=cancel]").first().click();
  await expect(page.locator("#propertiesPanel")).not.toContainText("継承");
  await openApplicationSettings(page);
  await page.locator("#applicationLanguageSelect").selectOption("en");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await expect(page.locator('#propertyVisible option[value=""]')).toHaveText("Default (Visible)");
  await expect(page.locator('#propertyLineType option[value=""]')).toHaveText("Default (Solid)");
  await expect(page.locator("#propertyColor")).toHaveAttribute("placeholder", "Default (#16a34a)");
  await expect(page.locator("#propertyLineWidth")).toHaveAttribute("placeholder", "Default (4)");
  await expect(page.locator(".property-color-default")).toHaveCount(0);
  await openApplicationSettings(page);
  await page.locator("#applicationLanguageSelect").selectOption("ja");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await page.locator(".property-color-picker").click();
  await page.locator('#usedColorPalette .property-color-swatch[data-palette-color="#0ea5e9"]').click();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).lines[0].appearance.color).toBe("#0ea5e9");
  await page.locator("#propertyColor").fill("");
  await page.locator("#propertyColor").blur();
  const inheritedColorState = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(inheritedColorState.lines).toHaveLength(2);
  expect(inheritedColorState.lines[0].appearance.color).toBeUndefined();
  await expect(page.locator(".property-color-picker")).toHaveAttribute("data-current-color", "#16a34a");
  await page.locator("#propertyColor").fill("#2563eb");
  await page.locator("#propertyColor").blur();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).lines[0].appearance.color).toBe("#2563eb");
  await page.locator(".property-color-picker").click();
  await page.locator("#customColorPicker").fill("#7c3aed");
  await page.locator("#applyCustomColorBtn").click();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).lines[0].appearance.color).toBe("#7c3aed");

  await page.locator("#propertyVisible").selectOption("false");
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).visible).toBe(false);
  const viewMenuSummary = page.locator(".app-menu > summary").nth(2);
  const statusMenuInput = page.locator("#viewConstraintStatusInput");
  await viewMenuSummary.click();
  await expect(statusMenuInput).not.toBeChecked();
  await statusMenuInput.check();
  await expect(page.locator("#constraintStatusViewBtn")).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.__jot2dTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: true, mouseLatched: true, spaceHeld: false }));
  await statusMenuInput.uncheck();
  await expect(page.locator("#constraintStatusViewBtn")).toHaveAttribute("aria-pressed", "false");
  await viewMenuSummary.click();
  await expect(page.locator("#constraintStatusViewBtn")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#constraintStatusViewBtn").click();
  await expect(statusMenuInput).toBeChecked();
  expect(await page.evaluate(() => window.__jot2dTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: true, mouseLatched: true, spaceHeld: false }));
  expect(await page.evaluate(() => window.__jot2dTest.constraintStatusEndpointMarkerCountForTest())).toBe(2);
  const endpointPosition = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("point", "P2"));
  await page.mouse.move(endpointPosition.x, endpointPosition.y);
  expect(await page.evaluate(() => window.__jot2dTest.constraintStatusEndpointMarkerCountForTest())).toBe(3);
  expect(await page.evaluate(() => window.__jot2dTest.pointDisplayStateForTest("P2"))).toEqual(expect.objectContaining({
    fill: "#eff6ff",
    stroke: "#3b82f6",
    labels: expect.arrayContaining(["P2"]),
  }));
  const canvasBox = await page.locator("#canvas").boundingBox();
  await page.mouse.move(canvasBox.x + 20, canvasBox.y + canvasBox.height - 20);
  expect(await page.evaluate(() => window.__jot2dTest.constraintStatusEndpointMarkerCountForTest())).toBe(2);
  await page.mouse.click(endpointPosition.x, endpointPosition.y);
  await page.mouse.move(canvasBox.x + 20, canvasBox.y + canvasBox.height - 20);
  expect(await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).toEqual(expect.objectContaining({ points: ["P2"] }));
  expect(await page.evaluate(() => window.__jot2dTest.constraintStatusEndpointMarkerCountForTest())).toBe(3);
  expect(await page.evaluate(() => window.__jot2dTest.pointDisplayStateForTest("P2"))).toEqual(expect.objectContaining({
    fill: "#1d4ed8",
    stroke: "#1d4ed8",
  }));
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  expect(await page.evaluate(() => window.__jot2dTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: true, mouseLatched: true, spaceHeld: false }));
  await page.locator("#constraintStatusViewBtn").click();
  await expect(statusMenuInput).not.toBeChecked();
  expect(await page.evaluate(() => window.__jot2dTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: false, mouseLatched: false, spaceHeld: false }));
  await page.keyboard.down("Space");
  await expect(statusMenuInput).toBeChecked();
  expect(await page.evaluate(() => window.__jot2dTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: true, mouseLatched: false, spaceHeld: true }));
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).visible).toBe(true);
  await page.keyboard.up("Space");
  await expect(statusMenuInput).not.toBeChecked();
  expect(await page.evaluate(() => window.__jot2dTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: false, mouseLatched: false, spaceHeld: false }));
});

test("fixed rectangle fixture L2 and L3 reuse the responsive P3 drag path while P1 stays fixed", async ({ page }) => {
  const deltas = Array.from({ length: 10 }, (_, index) => [-(index + 1) * 4, (index + 1) * 3]);
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
  expect((await page.evaluate(() => window.__jot2dTest.authoringStateForTest())).fixedPointIds).toEqual(["P1"]);
  const pointResult = await page.evaluate(
    (dragDeltas) => window.__jot2dTest.geometryDragPathForTest({ kind: "point", id: "P3" }, dragDeltas),
    deltas,
  );
  const pointFinal = pointResult.previews.at(-1).state;
  expect(pointResult.previews.every((preview) => preview.success && !preview.blocked)).toBe(true);
  const pointMovement = Math.hypot(
    pointFinal.x - pointResult.startState.x,
    pointFinal.y - pointResult.startState.y,
  );
  expect(pointMovement).toBeGreaterThan(10);

  for (const id of ["L2", "L3"]) {
    await page.goto(`${baseUrl}/index.html?test=1`);
    await page.waitForFunction(() => window.__jot2dTest);
    await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
    const result = await page.evaluate(
      ({ lineId, dragDeltas }) => window.__jot2dTest.geometryDragPathForTest({ kind: "line", id: lineId }, dragDeltas),
      { lineId: id, dragDeltas: deltas },
    );
    const lineFinal = result.previews.at(-1).state;
    const draggedP3 = id === "L2" ? lineFinal.p2 : lineFinal.p1;
    expect(result.sessionAvailable, id).toBe(true);
    expect(result.previews.every((preview) => preview.success && !preview.blocked), id).toBe(true);
    expect(draggedP3.x, id).toBeCloseTo(pointFinal.x, 5);
    expect(draggedP3.y, id).toBeCloseTo(pointFinal.y, 5);
    expect(Math.max(...result.previews.map((preview) => preview.elapsedMs)), id).toBeLessThan(100);
  }

  const pointerResults = [];
  for (const id of ["L2", "L3"]) {
    await page.goto(`${baseUrl}/index.html?test=1`);
    await page.waitForFunction(() => window.__jot2dTest);
    await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
    const before = await page.evaluate((lineId) => ({
      line: window.__jot2dTest.geometryClientPositionForTest("line", lineId),
      p1: window.__jot2dTest.geometryClientPositionForTest("point", "P1"),
      p3: window.__jot2dTest.geometryClientPositionForTest("point", "P3"),
    }), id);
    await page.mouse.move(before.line.x, before.line.y);
    await page.mouse.down();
    await page.mouse.move(before.line.x - 40, before.line.y + 30, { steps: 10 });
    await page.mouse.up();
    const after = await page.evaluate(() => ({
      p1: window.__jot2dTest.geometryClientPositionForTest("point", "P1"),
      p3: window.__jot2dTest.geometryClientPositionForTest("point", "P3"),
    }));
    expect(after.p1.x, `${id}/P1.x`).toBeCloseTo(before.p1.x, 5);
    expect(after.p1.y, `${id}/P1.y`).toBeCloseTo(before.p1.y, 5);
    pointerResults.push({ x: after.p3.x - before.p3.x, y: after.p3.y - before.p3.y });
  }
  expect(pointerResults[0].x).toBeCloseTo(pointerResults[1].x, 4);
  expect(pointerResults[0].y).toBeCloseTo(pointerResults[1].y, 4);
});

test("a line connected to a line-circle dimension follows sparse pointer jumps without lag", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(
    (fixture) => window.__jot2dTest.importDocumentNameFixture(fixture, "sparse-line-circle-drag.jot2d"),
    lineCircleSparseLineDragFixture(),
  );
  const deltas = [
    [150, 0],
    [-150, 0],
    [0, 150],
    [0, -150],
    [200, 120],
    [400, 240],
  ];
  const result = await page.evaluate(
    (dragDeltas) => window.__jot2dTest.geometryDragPathForTest({ kind: "line", id: "L2" }, dragDeltas),
    deltas,
  );

  expect(result.sessionAvailable).toBe(true);
  expect(result.previews).toHaveLength(deltas.length);
  for (const [index, preview] of result.previews.entries()) {
    expect(preview.success, `step ${index + 1}`).toBe(true);
    expect(preview.blocked, `step ${index + 1}`).not.toBe(true);
    expect(preview.fallback, `step ${index + 1}`).not.toBe(true);
    expect(preview.exactSparseLine, `step ${index + 1}`).toBe(true);
    expect(preview.guidedSubstepCount, `step ${index + 1}`).toBe(0);
    expect(preview.state.midpoint.x - result.startState.midpoint.x, `step ${index + 1}/x`).toBeCloseTo(deltas[index][0], 4);
    expect(preview.state.midpoint.y - result.startState.midpoint.y, `step ${index + 1}/y`).toBeCloseTo(deltas[index][1], 4);
  }
  expect(Math.max(...result.previews.map((preview) => preview.elapsedMs))).toBeLessThan(25);
  expect(result.final.success).toBe(true);
  expect(result.final.baseErrorNorm).toBeLessThan(1e-5);
});

test("arc body selection and hover do not highlight endpoints", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = {
    version: 9,
    documentName: "arc-endpoint-display",
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {} },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: {} },
    ],
    activeSketchId: "S1",
    points: [{ id: "PC", x: 0, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} }],
    lines: [], circles: [],
    arcs: [{ id: "A1", center: "PC", radius: 50, startAngle: 0, endAngle: Math.PI / 2, construction: false, sketchId: "S1", appearance: {} }],
    constraints: [], blockDefinitions: [], blockInstances: [], annotations: [],
  };
  await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "arc-endpoint-display.json"), fixture);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 2));
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ arcs: ["A1"] }));
  expect(await page.evaluate(() => window.__jot2dTest.arcEndpointHandleCountForTest())).toBe(0);

  const body = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("arc", "A1"));
  await page.mouse.move(body.x, body.y);
  expect(await page.evaluate(() => window.__jot2dTest.arcEndpointHandleCountForTest())).toBe(0);

  const endpoint = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("arc", "A1", "start"));
  await page.mouse.move(endpoint.x, endpoint.y);
  expect(await page.evaluate(() => window.__jot2dTest.arcEndpointHandleCountForTest())).toBe(1);
});

test("Block Instance Appearance Override applies to the whole instance", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const initial = await page.evaluate(() => window.__jot2dTest.resetForBlockClipboardTest());
  const instanceId = initial.geometryBySketch.S1.blockInstances[0].id;
  await expect(page.locator("#propertiesPanel")).toContainText("ブロック外観の上書き");
  await page.locator("#propertyColor").fill("#7c3aed");
  await page.locator("#propertyColor").blur();
  const serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.blockInstances[0].appearanceOverride.color).toBe("#7c3aed");
  expect((await page.evaluate((id) => window.__jot2dTest.appearanceStateForTest("block", id), instanceId)).effective.color).toBe("#7c3aed");
});

test("arc radius dimensions omit the center terminator and extend for external labels and reversed arrows", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  for (const terminatorType of ["arrow", "filledArrow", "dot"]) {
    const plan = await page.evaluate((type) => window.__jot2dTest.arcRadiusDimensionRenderPlanForTest(type), terminatorType);
    expect(plan.centerTerminatorVisible).toBe(false);
    expect(plan.arcTerminatorVisible).toBe(true);
    expect(plan.lineStartDistanceFromCenter).toBeCloseTo(0, 8);
    expect(plan.lineEndDistanceFromCenter).toBeCloseTo(plan.arcRadius, 8);
    expect(plan.rawExtendedLineEndDistanceFromCenter).toBeGreaterThan(plan.arcRadius);
    expect(plan.visibleExtensionCount).toBe(0);
  }

  const externalLabel = await page.evaluate(() => window.__jot2dTest.arcRadiusDimensionRenderPlanForTest("arrow", {
    labelOffsetU: 30,
  }));
  expect(externalLabel.labelDistanceFromCenter).toBeGreaterThan(externalLabel.arcRadius);
  expect(externalLabel.lineEndDistanceFromCenter).toBeGreaterThan(externalLabel.labelDistanceFromCenter);

  const reversedArrow = await page.evaluate(() => window.__jot2dTest.arcRadiusDimensionRenderPlanForTest("arrow", {
    label: "R123456789",
    labelOffsetU: 0,
  }));
  expect(reversedArrow.terminatorsOutside).toBe(true);
  expect(reversedArrow.shaftLengths).toHaveLength(1);
  expect(reversedArrow.shaftLengths[0]).toBeCloseTo(reversedArrow.expectedShaftLength, 6);
  expect(reversedArrow.shaftEndDistancesFromCenter[0]).toBeGreaterThan(reversedArrow.arcRadius);
});

test("open dimension arrow tips align without pushing reversed wings into their rear shafts", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  for (const viewportScale of [0.5, 1, 4]) {
    for (const highlighted of [false, true]) {
      for (const outside of [false, true]) {
        const alignment = await page.evaluate(
          ({ scale, selected, reversed }) => window.__jot2dTest.dimensionArrowTipAlignmentForTest({
            lineWidth: 3.2,
            arrowheadAngle: 40,
            highlighted: selected,
            viewportScale: scale,
            outside: reversed,
          }),
          { scale: viewportScale, selected: highlighted, reversed: outside },
        );
        expect(alignment.pathTipInset).toBeGreaterThan(0);
        expect(alignment.visualTipOffset).toBeCloseTo(0, 5);
        expect(alignment.wingDistance).toBeCloseTo(alignment.nominalArrowSize, 8);
        expect(alignment.rearShaftLength).toBeCloseTo(alignment.nominalArrowSize * 0.5, 8);
        expect(alignment.strokeWidth).toBeCloseTo(highlighted ? 4 : 3.2, 8);
      }
    }
  }
});

test("Constraint dimensions expose defining geometry and inheritable appearance without creating annotation dimensions", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.resetForReadOnlyDuplicateDimension());
  await expandSketchTreeGroup(page, "constraint");
  await page.locator('.sketch-object-row[data-object-kind="constraint"]').first().click();
  await expect(page.locator("#propertiesPanel .property-section h3")).toContainText(["基本情報", "寸法外観"]);
  await expect(page.locator("#propertiesPanel")).toContainText("値 / 数式");
  await expect(page.locator("#propertiesPanel")).toContainText("始点ID");
  await expect(page.locator("#propertiesPanel")).toContainText("終点ID");
  await expect(page.locator("#propertiesPanel")).toContainText("P1");
  await expect(page.locator("#propertiesPanel")).toContainText("P2");
  await expect(page.locator("#propertiesPanel")).not.toContainText("寸法表示");
  await expect(page.locator("#propertiesPanel .dimension-appearance-group-title")).toHaveText(["寸法補助線", "端末記号", "寸法文字"]);
  expect(await page.locator("#propertiesPanel .dimension-appearance-group").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderTopStyle: style.borderTopStyle,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      borderRadius: style.borderRadius,
    };
  })).toEqual({
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopStyle: "solid",
    borderRightWidth: "0px",
    borderBottomWidth: "0px",
    borderLeftWidth: "0px",
    borderRadius: "0px",
  });

  await openDocumentSettings(page);
  await expect(page.locator("#documentSettingsDialog")).toContainText("寸法外観");
  await expect(page.locator("#documentDimensionAppearanceFields .dimension-appearance-group-title")).toHaveText(["寸法補助線", "端末記号", "寸法文字"]);
  await expect(page.locator('#documentDimensionAppearanceFields [data-dimension-display="extensionLines"], #documentDimensionAppearanceFields [data-dimension-display="arrows"]')).toHaveCount(0);
  await expect(page.locator("#documentDimensionExtensionLineOvershoot")).toHaveValue("1.5");
  await expect(page.locator("#documentDimensionLineWidth")).toHaveValue("1.2");
  await expect(page.locator("#documentDimensionExtensionLineOriginGap")).toHaveValue("1.5");
  await expect(page.locator("#documentDimensionTerminatorType")).toHaveValue("arrow");
  await expect(page.locator("#documentDimensionTerminatorSize")).toHaveValue("4");
  await expect(page.locator("#documentDimensionArrowheadAngle")).toHaveValue("30");
  await page.locator("#documentDimensionTerminatorType").selectOption("dot");
  await expect(page.locator("#documentDimensionAppearanceFields [data-terminator-angle-row]")).toBeHidden();
  await page.locator("#documentDimensionTerminatorType").selectOption("arrow");
  await expect(page.locator("#documentDimensionAppearanceFields [data-terminator-angle-row]")).toBeVisible();
  await expect(page.locator("#documentDimensionDimensionTextHeight")).toHaveValue("5");
  await expect(page.locator("#documentDimensionDimensionTextGap")).toHaveValue("0");
  await page.locator("#documentDimensionColor").fill("#0e7490");
  await page.locator("#documentDimensionColor").blur();
  for (const [selector, value] of [
    ["#documentDimensionLineWidth", "2.4"],
    ["#documentDimensionExtensionLineOvershoot", "2"],
    ["#documentDimensionExtensionLineOriginGap", "1.8"],
    ["#documentDimensionTerminatorSize", "3"],
    ["#documentDimensionArrowheadAngle", "30"],
    ["#documentDimensionDimensionTextHeight", "3.5"],
    ["#documentDimensionDimensionTextGap", "1.2"],
  ]) {
    await page.locator(selector).fill(value);
    await page.locator(selector).blur();
  }
  await page.locator("#documentSettingsDialog button[value=cancel]").first().click();
  expect(await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest())).toEqual(expect.objectContaining({
    documentDefault: expect.objectContaining({
      color: "#0e7490",
      lineWidth: 2.4,
      extensionLineOvershoot: 2,
      extensionLineOriginGap: 1.8,
      terminatorType: "arrow",
      terminatorSize: 3,
      arrowheadAngle: 30,
      dimensionTextHeight: 3.5,
      dimensionTextGap: 1.2,
    }),
    sketchDirect: {},
    sketchEffective: expect.objectContaining({ color: "#0e7490" }),
    direct: expect.not.objectContaining({ color: expect.anything() }),
    effective: expect.objectContaining({ color: "#0e7490" }),
  }));
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionColorsForTest())).toContain("#0e7490");

  await selectSketch(page, "ROOT");
  await selectSketch(page, "S1");
  await expect(page.locator("#sketchDimensionColor")).toHaveValue("");
  await page.locator('[data-property-section="dimension"] summary').click();
  await page.locator("#sketchDimensionColor").fill("#f97316");
  await page.locator("#sketchDimensionColor").blur();
  expect(await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest())).toEqual(expect.objectContaining({
    sketchDirect: expect.objectContaining({ color: "#f97316" }),
    effective: expect.objectContaining({ color: "#f97316" }),
  }));
  await page.locator("#sketchDimensionColor").fill("");
  await page.locator("#sketchDimensionColor").blur();
  await expandSketchTreeGroup(page, "constraint");
  await page.locator('.sketch-object-row[data-object-kind="constraint"]').first().click();
  const properties = page.locator("#propertiesPanel");
  await properties.locator('[data-dimension-display="precision"]').selectOption("3");
  await expect(page.locator('[data-dimension-display="toleranceUpper"], [data-dimension-display="toleranceLower"]')).toHaveCount(0);
  const prefix = properties.locator('[data-dimension-display="prefix"]');
  await prefix.fill("REF ");
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest())).toEqual(expect.arrayContaining([expect.stringContaining("REF ")]));
  const suffix = properties.locator('[data-dimension-display="suffix"]');
  await suffix.fill(" mm");
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest())).toEqual(expect.arrayContaining([expect.stringMatching(/REF .* mm/)]));
  await suffix.blur();
  await properties.locator('[data-dimension-display="terminatorType"]').selectOption("dot");
  await expect(properties.locator("[data-terminator-angle-row]")).toBeHidden();
  expect((await page.evaluate(() => window.__jot2dTest.dimensionAppearanceRenderMetricsForTest())).terminator).toEqual(expect.objectContaining({ type: "dot", openingAngle: null }));
  await properties.locator('[data-dimension-display="terminatorType"]').selectOption("filledArrow");
  await expect(properties.locator("[data-terminator-angle-row]")).toBeVisible();
  const inheritedLineWidth = properties.locator('[data-dimension-display="lineWidth"]');
  await expect(inheritedLineWidth).toHaveValue("");
  await expect(inheritedLineWidth).toHaveAttribute("placeholder", /2\.4/);
  const originGapInput = properties.locator('[data-dimension-display="extensionLineOriginGap"]');
  await originGapInput.fill("0");
  await originGapInput.blur();
  const zeroGapRenderMetrics = await page.evaluate(() => window.__jot2dTest.dimensionAppearanceRenderMetricsForTest());
  expect(zeroGapRenderMetrics.linearExtension.originGap).toBeCloseTo(0, 6);
  expect(zeroGapRenderMetrics.angleExtension.originGap).toBeCloseTo(0, 6);
  for (const [key, value] of [
    ["lineWidth", "3.2"],
    ["extensionLineOvershoot", "3"],
    ["extensionLineOriginGap", "2.5"],
    ["terminatorSize", "4"],
    ["arrowheadAngle", "40"],
    ["dimensionTextHeight", "4"],
    ["dimensionTextGap", "1.5"],
  ]) {
    const input = properties.locator(`[data-dimension-display="${key}"]`);
    await input.fill(value);
    await input.blur();
  }
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 1));
  const renderMetrics = await page.evaluate(() => window.__jot2dTest.dimensionAppearanceRenderMetricsForTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 4));
  const zoomedRenderMetrics = await page.evaluate(() => window.__jot2dTest.dimensionAppearanceRenderMetricsForTest());
  expect(zoomedRenderMetrics.linearExtension.originGap).toBeCloseTo(renderMetrics.linearExtension.originGap, 6);
  expect(zoomedRenderMetrics.linearExtension.overshoot).toBeCloseTo(renderMetrics.linearExtension.overshoot, 6);
  expect(zoomedRenderMetrics.angleExtension.originGap).toBeCloseTo(renderMetrics.angleExtension.originGap, 6);
  expect(zoomedRenderMetrics.terminator.size).toBeCloseTo(renderMetrics.terminator.size, 6);
  expect(zoomedRenderMetrics.text.height).toBeCloseTo(renderMetrics.text.height, 6);
  expect(zoomedRenderMetrics.lineWidth).toBeCloseTo(renderMetrics.lineWidth, 6);
  expect(renderMetrics.lineWidth).toBeCloseTo(3.2, 6);
  expect(renderMetrics.linearExtension.originGap).toBeCloseTo(2.5 * 96 / 25.4, 6);
  expect(renderMetrics.linearExtension.overshoot).toBeCloseTo(3 * 96 / 25.4, 6);
  expect(renderMetrics.angleExtension.originGap).toBeCloseTo(2.5 * 96 / 25.4, 6);
  expect(renderMetrics.angleExtension.overshoot).toBeCloseTo(3 * 96 / 25.4, 6);
  expect(renderMetrics.terminator).toEqual(expect.objectContaining({ type: "filledArrow" }));
  expect(renderMetrics.terminator.size).toBeCloseTo(4 * 96 / 25.4, 6);
  expect(renderMetrics.terminator.openingAngle).toBeCloseTo(40, 6);
  expect(renderMetrics.text.height).toBeCloseTo(4 * 96 / 25.4, 6);
  expect(renderMetrics.text.gap).toBeCloseTo(1.5 * 96 / 25.4, 6);
  const terminatorFit = await page.evaluate(() => {
    const measured = window.__jot2dTest.dimensionTerminatorFitForTest(1000, "100");
    return {
      inside: measured,
      earlyOutside: window.__jot2dTest.dimensionTerminatorFitForTest(measured.textWidth + measured.fitMargin - 1, "100"),
      justFits: window.__jot2dTest.dimensionTerminatorFitForTest(measured.textWidth + measured.fitMargin + 1, "100"),
      outside: window.__jot2dTest.dimensionTerminatorFitForTest(Math.max(0, measured.textWidth - 1), "100"),
      dot: window.__jot2dTest.dimensionTerminatorFitForTest(Math.max(0, measured.textWidth - 1), "100", "dot"),
    };
  });
  expect(terminatorFit.inside).toEqual(expect.objectContaining({ outside: false, firstDirection: { x: 1, y: 0 }, secondDirection: { x: -1, y: 0 } }));
  expect(terminatorFit.earlyOutside.outside).toBe(true);
  expect(terminatorFit.earlyOutside.textWidth + terminatorFit.earlyOutside.fitMargin - 1).toBeGreaterThan(terminatorFit.earlyOutside.textWidth);
  expect(terminatorFit.earlyOutside.shaftLengths).toHaveLength(2);
  expect(terminatorFit.earlyOutside.shaftLengths[0]).toBeCloseTo(terminatorFit.earlyOutside.fitMargin * 1.5, 6);
  expect(terminatorFit.justFits).toEqual(expect.objectContaining({ outside: false, shaftLengths: [] }));
  expect(terminatorFit.outside).toEqual(expect.objectContaining({ outside: true, firstDirection: { x: -1, y: 0 }, secondDirection: { x: 1, y: 0 } }));
  expect(terminatorFit.dot.outside).toBe(false);
  await properties.locator('[data-dimension-display="color"] + [data-appearance-palette-open]').click();
  await page.locator('[data-palette-color="#7c3aed"]').first().click();
  expect(await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest())).toEqual(expect.objectContaining({
    direct: expect.objectContaining({ color: "#7c3aed" }),
    effective: expect.objectContaining({ color: "#7c3aed" }),
  }));
  await properties.locator('[data-dimension-display="color"]').fill("");
  await properties.locator('[data-dimension-display="color"]').blur();
  expect(await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest())).toEqual(expect.objectContaining({
    direct: expect.not.objectContaining({ color: expect.anything() }),
    effective: expect.objectContaining({ color: "#0e7490" }),
  }));
  await properties.locator('[data-dimension-display="color"]').fill("#7c3aed");
  await properties.locator('[data-dimension-display="color"]').blur();
  const label = await page.evaluate(() => window.__jot2dTest.dimensionClientPositionForTest(0));
  await page.mouse.move(label.x, label.y);
  await page.mouse.down();
  await page.mouse.move(label.x + 36, label.y + 18, { steps: 4 });
  await page.mouse.up();
  await properties.locator('[data-dimension-display="visible"]').selectOption("false");
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest())).not.toEqual(expect.arrayContaining([expect.stringMatching(/REF .* mm/)]));
  await page.locator("#constraintStatusViewBtn").click();
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionLabelsForTest())).toEqual(expect.arrayContaining([expect.stringMatching(/REF .* mm/)]));
  await page.locator("#constraintStatusViewBtn").click();
  const serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.defaultDimensionAppearance).toEqual(expect.objectContaining({ color: "#0e7490" }));
  expect(serialized.sketches.find((sketch) => sketch.id === "ROOT").dimensionAppearance).toEqual({});
  expect(serialized.constraints[0].dimension.display).toEqual(expect.objectContaining({
    visible: false,
    color: "#7c3aed",
    lineWidth: 3.2,
    precision: 3,
    prefix: "REF ",
    suffix: " mm",
    terminatorType: "filledArrow",
    extensionLineOvershoot: 3,
    extensionLineOriginGap: 2.5,
    terminatorSize: 4,
    arrowheadAngle: 40,
    dimensionTextHeight: 4,
    dimensionTextGap: 1.5,
  }));
  expect(serialized.annotations).toEqual([]);
  await page.evaluate((documentData) => window.__jot2dTest.loadDocumentFixtureForDragTest(documentData, "dimension-appearance.json"), serialized);
  const roundTrip = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(roundTrip.version).toBe(19);
  expect(roundTrip.defaultDimensionAppearance).toEqual(serialized.defaultDimensionAppearance);
  expect(roundTrip.constraints[0].dimension.display).toEqual(serialized.constraints[0].dimension.display);

  const legacyPixels = structuredClone(serialized);
  legacyPixels.version = 11;
  legacyPixels.defaultDimensionAppearance = {
    ...legacyPixels.defaultDimensionAppearance,
    extensionLineOvershoot: 6,
    extensionLineOriginGap: 6,
    arrowheadLength: 10,
    dimensionTextHeight: 12,
    dimensionTextGap: 4,
    arrows: true,
    extensionLines: false,
  };
  delete legacyPixels.defaultDimensionAppearance.terminatorType;
  delete legacyPixels.defaultDimensionAppearance.terminatorSize;
  legacyPixels.constraints[0].dimension.display = {
    ...legacyPixels.constraints[0].dimension.display,
    arrowheadLength: 18,
    arrows: false,
    extensionLines: false,
  };
  delete legacyPixels.constraints[0].dimension.display.terminatorType;
  delete legacyPixels.constraints[0].dimension.display.terminatorSize;
  await page.evaluate((documentData) => window.__jot2dTest.loadDocumentFixtureForDragTest(documentData, "legacy-dimension-pixels.json"), legacyPixels);
  const migratedPixels = await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest());
  expect(migratedPixels.documentDefault.extensionLineOvershoot).toBeCloseTo(6 * 25.4 / 96, 8);
  expect(migratedPixels.documentDefault.dimensionTextHeight).toBeCloseTo(12 * 25.4 / 96, 8);
  expect(migratedPixels.direct.terminatorSize).toBeCloseTo(18 * 25.4 / 96, 8);
  expect(migratedPixels.direct.terminatorType).toBeUndefined();
  const migratedSerialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(migratedSerialized.version).toBe(19);
  expect(migratedSerialized.defaultDimensionAppearance).not.toHaveProperty("arrows");
  expect(migratedSerialized.defaultDimensionAppearance).not.toHaveProperty("extensionLines");
  expect(migratedSerialized.constraints[0].dimension.display).not.toHaveProperty("arrowheadLength");

  await page.evaluate(() => window.__jot2dTest.resetForParameterTest());
  await openDocumentSettings(page);
  await page.locator("#documentDimensionColor").fill("#db2777");
  await page.locator("#documentDimensionColor").blur();
  await page.locator("#documentSettingsDialog button[value=cancel]").first().click();
  const blockAppearance = await page.evaluate(() => window.__jot2dTest.dimensionAppearanceStateForTest().blockDefinitions);
  expect(blockAppearance.flatMap((definition) => definition.dimensions).map((dimension) => dimension.effective.color)).toEqual(["#db2777", "#db2777"]);
});

test("Sketch and Object rows use the same emphasis as canvas hover without tree Geometry IDs", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const ids = await page.evaluate(() => window.__jot2dTest.resetForSidebarInspection());
  await page.mouse.move(ids.lineMid.x, ids.lineMid.y);
  const canvasHover = await page.evaluate((lineId) => window.__jot2dTest.hoverDisplayStateForTest("line", lineId), ids.line);
  expect(canvasHover).toEqual(expect.objectContaining({ canvasHovered: true, color: "#3b82f6", width: 2.2 }));
  await page.locator('.sketch-item[data-id="S1"]').hover();
  const treeHover = await page.evaluate((lineId) => window.__jot2dTest.hoverDisplayStateForTest("line", lineId), ids.line);
  expect(treeHover).toEqual(expect.objectContaining({ treeHovered: true, color: canvasHover.color, width: canvasHover.width }));
  for (const pointId of ids.lineEndpoints) {
    expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("point", id), pointId)).toEqual(expect.objectContaining({ treeHovered: false }));
  }
  expect(await page.evaluate(() => window.__jot2dTest.drawnGeometryIdLabelsForTest())).toEqual([]);
  await expandSketchTreeGroup(page, "line");
  await page.locator(`.sketch-object-row[data-object-kind="line"][data-id="${ids.line}"]`).hover();
  const objectHover = await page.evaluate((lineId) => window.__jot2dTest.hoverDisplayStateForTest("line", lineId), ids.line);
  expect(objectHover).toEqual(expect.objectContaining({ sidebarHovered: true, color: canvasHover.color, width: canvasHover.width }));
});

test("Root Sketch tree hover highlights geometry and blocks in every descendant sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const ids = await page.evaluate(() => window.__jot2dTest.resetForRootSketchTreeHoverTest());

  await page.locator(`.sketch-item[data-id="${ids.rootSketchId}"]`).hover();
  for (const [kind, id] of [["line", ids.lineId], ["circle", ids.circleId], ["arc", ids.arcId], ["block", ids.blockInstanceId]]) {
    expect(await page.evaluate(({ itemKind, itemId }) => window.__jot2dTest.hoverDisplayStateForTest(itemKind, itemId), { itemKind: kind, itemId: id })).toEqual(expect.objectContaining({
      treeHovered: true,
      color: "#3b82f6",
      width: 2.2,
    }));
  }
  expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("point", id), ids.lineEndpointId)).toEqual(expect.objectContaining({ treeHovered: false }));

  await page.locator(`.sketch-item[data-id="${ids.secondSketchId}"]`).hover();
  expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("line", id), ids.lineId)).toEqual(expect.objectContaining({ treeHovered: false }));
  expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("circle", id), ids.circleId)).toEqual(expect.objectContaining({ treeHovered: true }));
  expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("arc", id), ids.arcId)).toEqual(expect.objectContaining({ treeHovered: false }));
  expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("block", id), ids.blockInstanceId)).toEqual(expect.objectContaining({ treeHovered: true }));
});

test("Sketch tree block hover matches canvas block hover without Block Projection point markers", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const ids = await page.evaluate(() => window.__jot2dTest.resetForSketchTreeBlockHoverTest());
  expect(ids.projectedExplicitPointIds).toHaveLength(4);

  await page.mouse.move(ids.blockLineMid.x, ids.blockLineMid.y);
  const canvasHover = await page.evaluate((instanceId) => window.__jot2dTest.hoverDisplayStateForTest("block", instanceId), ids.instanceId);
  expect(canvasHover).toEqual(expect.objectContaining({ blockHovered: true, color: "#3b82f6", width: 2.2 }));
  expect(await page.evaluate(() => window.__jot2dTest.drawnPointMarkerCountForTest())).toBe(0);

  await page.locator(`.sketch-item[data-id="${ids.sketchId}"]`).hover();
  const treeHover = await page.evaluate((instanceId) => window.__jot2dTest.hoverDisplayStateForTest("block", instanceId), ids.instanceId);
  expect(treeHover).toEqual(expect.objectContaining({ treeHovered: true, color: canvasHover.color, width: canvasHover.width }));
  for (const pointId of ids.projectedExplicitPointIds) {
    expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("point", id), pointId)).toEqual(expect.objectContaining({ treeHovered: false }));
  }
  expect(await page.evaluate(() => window.__jot2dTest.drawnPointMarkerCountForTest())).toBe(0);
});

test("fixed explicit points show red emphasis and the fixed label only while hovered or selected", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForFixedPointDisplayTest());

  expect(await page.evaluate((id) => window.__jot2dTest.pointDisplayStateForTest(id), fixture.pointId)).toEqual(expect.objectContaining({
    fill: "#ffffff",
    stroke: "#111827",
    labels: [],
  }));

  await page.mouse.move(fixture.point.x, fixture.point.y);
  expect(await page.evaluate((id) => window.__jot2dTest.pointDisplayStateForTest(id), fixture.pointId)).toEqual(expect.objectContaining({
    fill: "#fee2e2",
    stroke: "#dc2626",
    labels: expect.arrayContaining([fixture.pointId, "固定"]),
  }));

  await page.mouse.move(fixture.blank.x, fixture.blank.y);
  await page.evaluate((id) => window.__jot2dTest.selectGeometryIdsForTest({ points: [id] }), fixture.pointId);
  expect(await page.evaluate((id) => window.__jot2dTest.pointDisplayStateForTest(id), fixture.pointId)).toEqual(expect.objectContaining({
    fill: "#fee2e2",
    stroke: "#dc2626",
    labels: expect.arrayContaining([fixture.pointId, "固定"]),
  }));
});

test("inactive sketch geometry, blocks, and dimensions show identity without hover emphasis or selection", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const points = await page.evaluate(() => window.__jot2dTest.resetForInactiveDimensionAndBlockHover());
  expect(points.relation).toBe("参照可");

  await page.mouse.move(points.dimension.x, points.dimension.y);
  expect(await page.evaluate(() => window.__jot2dTest.hoverIdentityStateForTest())).toEqual(expect.objectContaining({
    kind: "dimension",
    id: points.dimensionId,
    sketchId: points.sourceSketchId,
    relation: "参照可",
    hoveredDimension: null,
  }));

  await page.mouse.move(points.line.x, points.line.y);
  expect(await page.evaluate(() => window.__jot2dTest.hoverIdentityStateForTest())).toEqual(expect.objectContaining({
    kind: "line",
    id: points.lineId,
    sketchId: points.sourceSketchId,
    relation: "参照可",
    hoveredDimension: null,
    hoveredBlock: null,
  }));
  expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("line", id), points.lineId)).toEqual(expect.objectContaining({
    canvasHovered: false,
    blockHovered: false,
  }));
  await page.mouse.click(points.line.x, points.line.y);
  expect(await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).toEqual({ points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [] });

  await page.mouse.move(points.block.x, points.block.y);
  expect(await page.evaluate(() => window.__jot2dTest.hoverIdentityStateForTest())).toEqual(expect.objectContaining({
    kind: "block",
    id: points.blockId,
    sketchId: points.sourceSketchId,
    relation: "参照可",
    hoveredDimension: null,
    hoveredBlock: null,
  }));
  expect(await page.evaluate((id) => window.__jot2dTest.hoverDisplayStateForTest("block", id), points.blockId)).toEqual(expect.objectContaining({
    canvasHovered: false,
    blockHovered: false,
  }));
  await page.mouse.click(points.block.x, points.block.y);
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).blockInstances).toEqual([]);
});

test("duplicate dimensions become read-only reference dimensions", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.resetForReadOnlyDuplicateDimension());
  expect(result.first).toBe(true);
  expect(result.second).toBe(true);
  expect(result.count).toBe(2);
  expect(result.enabledCount).toBe(1);
  expect(result.readOnlyCount).toBe(1);
  expect(result.serializedReadOnlyCount).toBe(1);
  expect(result.labels.some((label) => /^\(.+\)$/.test(label))).toBe(true);
  expect(Math.max(...result.extensionAlignmentErrors)).toBeLessThan(1e-6);
});

test("read-only dimensions skip the numeric value input", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.resetForReadOnlyDimensionPlacement());
  expect(result.pendingType).toBe(null);
  expect(result.inputHidden).toBe(true);
  expect(result.readOnlyCount).toBe(1);
  expect(result.dimensionCount).toBe(2);
});

test("a line length dimension advances by clicking its placement after the line", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const points = await page.evaluate(() => window.__jot2dTest.resetForLineLengthClickPlacement());
  await page.click('[data-constraint="distance"]');
  await page.mouse.click(points.line.x, points.line.y);
  expect(await page.locator("#hint").textContent()).toContain("仮寸法の位置をマウスで調整");
  await page.mouse.move(points.placement.x, points.placement.y);
  const preview = await page.evaluate(() => window.__jot2dTest.lineLengthClickPlacementState());
  expect(preview).toEqual(expect.objectContaining({
    dimensionCount: 0,
    pendingCommandType: "distance-place",
    previewTargetKind: "line-length",
  }));
  expect(preview.previewPointer.x).toBeCloseTo(0, 6);
  expect(preview.previewPointer.y).toBeCloseTo(-50, 6);
  await page.mouse.click(points.placement.x, points.placement.y);

  const input = page.locator("#dimensionValueInput");
  await expect(input).toBeVisible();
  await input.fill("180");
  await input.press("Enter");
  const state = await page.evaluate(() => window.__jot2dTest.lineLengthClickPlacementState());
  expect(state).toEqual(expect.objectContaining({
    dimensionCount: 1,
    target: 180,
    inputHidden: true,
    pendingCommandType: null,
    previewTargetKind: null,
    previewPointer: null,
  }));
});

test("a line and circle create a center-to-line dimension in either click order", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  for (const order of [["line", "circle1"], ["circle1", "line"]]) {
    const points = await page.evaluate(() => window.__jot2dTest.resetForLineCircleAndRadiusDifferenceDimensions());
    await page.click('[data-constraint="distance"]');
    await page.mouse.click(points[order[0]].x, points[order[0]].y);
    await page.mouse.click(points[order[1]].x, points[order[1]].y);

    expect(await page.evaluate(() => window.__jot2dTest.lineCircleAndRadiusDifferenceState())).toEqual(expect.objectContaining({
      pendingCommandType: "distance-place",
      previewTargetKind: "line-circle",
      operandKinds: order[0] === "line" ? ["line", "primitive"] : ["primitive", "line"],
      constraints: [],
    }));

    await page.mouse.click(points.lineCirclePlacement.x, points.lineCirclePlacement.y);
    const input = page.locator("#dimensionValueInput");
    await expect(input).toBeVisible();
    await input.fill("165");
    await input.press("Enter");

    const state = await page.evaluate(() => window.__jot2dTest.lineCircleAndRadiusDifferenceState());
    expect(state.constraints).toEqual([expect.objectContaining({
      type: "lineCircleDistance",
      line: points.ids.line,
      circle: points.ids.circle1,
      target: 165,
    })]);
    expect(state.geometry[0]).toEqual(expect.objectContaining({
      type: "lineCircleDistance",
      target: 165,
    }));
    expect(state.geometry[0].centerDistance).toBeCloseTo(165, 5);
    expect(state.geometry[0].error).toBeLessThan(1e-5);

    const restored = await page.evaluate((serialized) =>
      window.__jot2dTest.loadDocumentFixtureForDragTest(serialized, "line-circle-roundtrip.jot2d"), state.serialized);
    expect(restored.success).toBe(true);
    expect((await page.evaluate(() => window.__jot2dTest.lineCircleAndRadiusDifferenceState())).constraints).toEqual([
      expect.objectContaining({ type: "lineCircleDistance", target: 165 }),
    ]);
  }
});

test("concentric circle and arc pairs create radius-difference dimensions that preserve concentricity", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const cases = [
    { first: "circle1", second: "circle2", firstId: "circle1", secondId: "circle2" },
    { first: "circle1", second: "arc1", firstId: "circle1", secondId: "arc1" },
    { first: "arc1", second: "arc2", firstId: "arc1", secondId: "arc2" },
  ];
  for (const pair of cases) {
    const points = await page.evaluate(() => window.__jot2dTest.resetForLineCircleAndRadiusDifferenceDimensions());
    await page.click('[data-constraint="distance"]');
    await page.mouse.click(points[pair.first].x, points[pair.first].y);
    await page.mouse.click(points[pair.second].x, points[pair.second].y);

    expect(await page.evaluate(() => window.__jot2dTest.lineCircleAndRadiusDifferenceState())).toEqual(expect.objectContaining({
      pendingCommandType: "distance-place",
      previewTargetKind: "radius-difference",
      operandKinds: ["primitive", "primitive"],
      constraints: [],
    }));

    await page.mouse.click(points.radiusDifferencePlacement.x, points.radiusDifferencePlacement.y);
    const input = page.locator("#dimensionValueInput");
    await expect(input).toBeVisible();
    await input.fill("40");
    await input.press("Enter");

    const state = await page.evaluate(() => window.__jot2dTest.lineCircleAndRadiusDifferenceState());
    expect(state.constraints).toEqual([expect.objectContaining({
      type: "concentricRadiusDifferenceDimension",
      a: points.ids[pair.firstId],
      b: points.ids[pair.secondId],
      target: 40,
    })]);
    expect(state.geometry[0].centerDistance).toBeLessThan(1e-5);
    expect(state.geometry[0].radiusDifference).toBeCloseTo(40, 5);
    expect(state.geometry[0].error).toBeLessThan(1e-5);

    const restored = await page.evaluate((serialized) =>
      window.__jot2dTest.loadDocumentFixtureForDragTest(serialized, "radius-difference-roundtrip.jot2d"), state.serialized);
    expect(restored.success).toBe(true);
    expect((await page.evaluate(() => window.__jot2dTest.lineCircleAndRadiusDifferenceState())).constraints).toEqual([
      expect.objectContaining({ type: "concentricRadiusDifferenceDimension", target: 40 }),
    ]);

    const perturbed = await page.evaluate(() => window.__jot2dTest.perturbRadiusDifferenceDimensionForTest());
    expect(perturbed.success).toBe(true);
    expect(perturbed.before.centerDistance).toBeGreaterThan(10);
    expect(perturbed.after.centerDistance).toBeLessThan(1e-5);
    expect(perturbed.after.radiusDifference).toBeCloseTo(40, 5);
    expect(perturbed.after.error).toBeLessThan(1e-5);
  }
});

test("unified canvas exposes dimensions from every visible sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const result = await page.evaluate(() => window.__jot2dTest.resetForActiveSketchDimensionVisibility());
  expect(result.dimensionSketchIds).toEqual(["S1", "S2"]);
  expect(result.drawnDimensionSketchIds).toEqual(["S1", "S2"]);
  expect(new Set(result.drawnDimensionLabels)).toEqual(new Set(["100", "160"]));
  expect(result.labelsAfterHidingSecondSketch).toEqual(["100"]);
  expect(await page.evaluate(() => window.__jot2dTest.drawnDimensionColorsForTest())).toEqual(["#64748b"]);
  await page.locator("#constraintStatusViewBtn").click();
  expect(new Set(await page.evaluate(() => window.__jot2dTest.drawnDimensionColorsForTest()))).toEqual(new Set(["#64748b", "#cbd5e1"]));
  await page.locator("#constraintStatusViewBtn").click();
});

test("all geometry fit includes figures from every sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const result = await page.evaluate(() => window.__jot2dTest.resetForAllGeometryFit());
  expect(result.screen.left).toBeGreaterThanOrEqual(90);
  expect(result.screen.right).toBeLessThanOrEqual(result.canvas.width - 90);
  expect(result.screen.top).toBeGreaterThanOrEqual(90);
  expect(result.screen.bottom).toBeLessThanOrEqual(result.canvas.height - 90);
});

test("middle mouse double click fits visible geometry", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const setup = await page.evaluate(() => window.__jot2dTest.resetForMiddleButtonFit());
  await page.mouse.click(setup.click.x, setup.click.y, { button: "middle" });
  await page.mouse.click(setup.click.x, setup.click.y, { button: "middle" });
  const result = await page.evaluate(() => window.__jot2dTest.middleButtonFitState());
  const width = result.visibleScreen.right - result.visibleScreen.left;
  expect(result.hiddenVisible).toBe(false);
  expect(result.visibleScreen.left).toBeGreaterThanOrEqual(90);
  expect(result.visibleScreen.right).toBeLessThanOrEqual(result.canvas.width - 90);
  expect(width).toBeGreaterThan(result.canvas.width * 0.45);
});

test("dashed previews do not leak canvas stroke state", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const result = await page.evaluate(() => window.__jot2dTest.canvasDashIsolationCases());
  expect(result).toEqual({
    line: [],
    rectangle: [],
    circle: [],
    arc: [],
    offset: [],
    trim: [],
    selection: [],
    blockPlacement: [],
    blockHandles: [],
    annotationLeader: [],
    frame: [],
  });
});

test("unified canvas uses normal and construction appearance widths", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  expect(await page.evaluate(() => window.__jot2dTest.geometryStrokeStyleCasesForTest())).toEqual({
    activeNormal: 2,
    activeConstruction: 1.1,
    inactiveNormal: 1.2,
    inactiveConstruction: 0.9,
    selected: 3,
    hovered: 2.2,
    constructionAlpha: 0.72,
  });
});

test("construction line endpoint overhang remains while geometry or its block is hovered", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  expect(await page.evaluate(() => window.__jot2dTest.constructionLineHoverDisplayCasesForTest())).toEqual({
    direct: 12,
    block: 12,
  });
});

test("construction line endpoint appearance inherits Document defaults and supports Sketch and line overrides", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const fixture = {
    version: 9,
    documentName: "construction-appearance",
    defaultAppearance: { visible: true, color: "#111827", lineType: "solid", lineWidth: 2 },
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {} },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: {} },
    ],
    activeSketchId: "S1",
    points: [
      { id: "P1", x: -60, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
      { id: "P2", x: 60, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    ],
    lines: [{ id: "L1", p1: "P1", p2: "P2", construction: true, sketchId: "S1", appearance: {} }],
    circles: [], arcs: [], constraints: [], blockDefinitions: [], blockInstances: [], annotations: [],
  };
  await page.evaluate((data) => window.__jot2dTest.importDocumentNameFixture(data, "construction-appearance.json"), fixture);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await expect(page.locator("#propertyEndpointOverhang")).toHaveValue("");
  await expect(page.locator("#propertyEndpointMarkers")).toHaveValue("");
  expect(await page.evaluate(() => window.__jot2dTest.constructionLineRenderingForTest("L1"))).toEqual({
    endpointOverhang: true,
    endpointMarkers: true,
    overhangPx: 12,
    endpointMarkerCount: 2,
  });

  await page.locator("#propertyEndpointOverhang").selectOption("false");
  await page.locator("#propertyEndpointMarkers").selectOption("false");
  let serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.lines[0].appearance).toEqual(expect.objectContaining({ endpointOverhang: false, endpointMarkers: false }));
  expect(await page.evaluate(() => window.__jot2dTest.constructionLineRenderingForTest("L1"))).toEqual({
    endpointOverhang: false,
    endpointMarkers: false,
    overhangPx: 0,
    endpointMarkerCount: 0,
  });

  await page.locator("#propertyEndpointOverhang").selectOption("");
  await page.locator("#propertyEndpointMarkers").selectOption("");
  await openDocumentSettings(page);
  await expect(page.locator("#documentSettingsDialog")).toContainText("補助線外観");
  await page.locator("#documentConstructionPropertyColor").fill("#dc2626");
  await page.locator("#documentConstructionPropertyColor").blur();
  await page.locator("#documentConstructionPropertyLineType").selectOption("dotted");
  await page.locator("#documentConstructionPropertyLineWidth").fill("2.5");
  await page.locator("#documentConstructionPropertyLineWidth").blur();
  await page.locator("#documentConstructionPropertyEndpointOverhang").selectOption("false");
  await page.locator("#documentConstructionPropertyEndpointMarkers").selectOption("false");
  await page.locator("#documentSettingsDialog button[value=cancel]").first().click();

  serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.defaultConstructionAppearance).toEqual(expect.objectContaining({
    color: "#dc2626",
    lineType: "dotted",
    lineWidth: 2.5,
    endpointOverhang: false,
    endpointMarkers: false,
  }));
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective).toEqual(expect.objectContaining({
    color: "#dc2626",
    lineType: "dotted",
    lineWidth: 2.5,
    endpointOverhang: false,
    endpointMarkers: false,
  }));
  expect(await page.evaluate(() => window.__jot2dTest.constructionLineRenderingForTest("L1"))).toEqual({
    endpointOverhang: false,
    endpointMarkers: false,
    overhangPx: 0,
    endpointMarkerCount: 0,
  });

  await selectSketch(page, "ROOT");
  await selectSketch(page, "S1");
  await expect(page.locator("#sketchConstructionPropertyColor")).toHaveValue("");
  await page.locator('[data-property-section="construction"] summary').click();
  await page.locator("#sketchConstructionPropertyColor").fill("#16a34a");
  await page.locator("#sketchConstructionPropertyColor").blur();
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective.color).toBe("#16a34a");
  await page.locator("#sketchConstructionPropertyColor").fill("");
  await page.locator("#sketchConstructionPropertyColor").blur();
  expect((await page.evaluate(() => window.__jot2dTest.appearanceStateForTest("line", "L1"))).effective.color).toBe("#dc2626");
  serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());

  await page.evaluate((data) => window.__jot2dTest.importDocumentNameFixture(data, "construction-appearance-reload.json"), serialized);
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).defaultConstructionAppearance).toEqual(serialized.defaultConstructionAppearance);
});

test("Sketch Tree groups list and synchronize Geometry and Constraint objects", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const ids = await page.evaluate(() => window.__jot2dTest.resetForSidebarInspection());
  await expandSketchTreeGroup(page, "point");
  await expect(page.locator('.sketch-object-row[data-object-kind="point"]')).toHaveCount(2);
  await expect(page.locator(`.sketch-object-row[data-object-kind="point"][data-id="${ids.fixedPoint}"]`)).toHaveCount(1);
  await expandSketchTreeGroup(page, "circle");
  await expect(page.locator('.sketch-object-row[data-object-kind="circle"]')).toHaveCount(1);
  await expandSketchTreeGroup(page, "arc");
  await expect(page.locator('.sketch-object-row[data-object-kind="arc"]')).toHaveCount(1);

  await expandSketchTreeGroup(page, "line");
  await page.locator(`.sketch-object-row[data-object-kind="line"][data-id="${ids.line}"]`).click();
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("線");
  await expect(page.locator("#propertiesPanel .property-section h3").first()).toHaveText("基本情報");

  await page.locator('.sketch-object-row[data-object-kind="circle"]').hover();
  expect(await page.evaluate(() => window.__jot2dTest.sidebarHighlightIds())).toEqual(
    expect.arrayContaining([ids.line, ids.circle]),
  );
  expect(await page.evaluate(() => window.__jot2dTest.sidebarHighlightIds())).not.toContain(ids.circleCenter);
  await page.locator('.sketch-object-row[data-object-kind="circle"]').click();
  await expect(page.locator('.sketch-object-row[data-object-kind="circle"]')).toHaveClass(/selected/);
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("円");
  expect(await page.locator("#propertiesPanel .property-section").first().locator(".property-row").allTextContents()).toEqual(expect.arrayContaining([
    `ID${ids.circle}`, `中心点ID${ids.circleCenter}`,
  ]));

  await page.locator('.sketch-object-row[data-object-kind="arc"]').click();
  expect(await page.locator("#propertiesPanel .property-section").first().locator(".property-row").allTextContents()).toEqual(expect.arrayContaining([
    `ID${ids.arc}`, `中心点ID${ids.arcCenter}`, "始点角度180°", "終点角度315°",
  ]));

  await expandSketchTreeGroup(page, "constraint");
  const horizontalConstraintRow = page.locator('.sketch-object-row[data-object-kind="constraint"][data-constraint-index]').first();
  await horizontalConstraintRow.hover();
  expect(await page.evaluate(() => window.__jot2dTest.currentSidebarHoveredGeometryKeys())).toEqual([`line:${ids.line}`]);
  await horizontalConstraintRow.click();
  await expect(horizontalConstraintRow).toHaveClass(/selected/);
  await expect(page.locator("#propertiesPanel .property-heading")).toHaveText("水平");
  await expect(page.locator("#propertiesPanel .property-section h3").first()).toHaveText("基本情報");
  expect(await page.locator("#propertiesPanel .property-section").first().locator(".property-row").allTextContents()).toEqual(expect.arrayContaining([
    `線ID${ids.line}`,
  ]));
  expect(await page.evaluate(() => window.__jot2dTest.sidebarHighlightIds())).toEqual([ids.line]);
  expect(await page.locator('.sketch-object-row[data-fixed-point-id]').textContent()).toContain(`${ids.fixedPoint}固定`);
});

test("constraint rows highlight only directly related selected geometry", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const ids = await page.evaluate(() => window.__jot2dTest.resetForSidebarInspection());
  await expandSketchTreeGroup(page, "constraint");
  const constraintRow = page.locator('.sketch-object-row[data-object-kind="constraint"][data-constraint-index]');
  await expect(constraintRow).toHaveCount(2);

  await page.evaluate((lineId) => window.__jot2dTest.selectGeometryIdsForTest({ lines: [lineId] }), ids.line);
  await expect(constraintRow.first()).toHaveClass(/sidebar-related/);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({}));
  await expect(constraintRow.first()).not.toHaveClass(/sidebar-related/);
});

test("line circle and arc offsets keep editable dimensional relationships", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.resetForOffsetConstraints());
  expect(result.created).toEqual([true, true, true]);
  expect(result.measurements[0]).toBeCloseTo(25, 5);
  expect(result.measurements[1]).toBeCloseTo(18, 5);
  expect(result.measurements[2]).toBeCloseTo(12, 5);
  expect(result.sourceRadii).toEqual([30, 40]);
  expect(result.restoredCount).toBe(3);
  expect(result.restoredTypes).toBe(3);
  expect(result.restoredTargets).toEqual([25, 18, 12]);
  expect(result.geometry).toEqual({ lines: 2, circles: 2, arcs: 2 });
  await page.screenshot({ path: "test-results/offset-constraints.png", fullPage: true });
});

test("offset tool collects a distance and creates a constrained copy", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const points = await page.evaluate(() => window.__jot2dTest.resetForOffsetUi());

  await page.click("#toolOffset");
  await page.mouse.click(points.source.x, points.source.y);
  await page.mouse.move(points.side.x, points.side.y);
  const previewState = await page.evaluate(() => window.__jot2dTest.offsetUiState());
  expect(previewState.pendingType).toBe(null);
  expect(previewState.previewDistance).toBeCloseTo(35, 3);
  await page.screenshot({ path: "test-results/offset-pointer-preview.png", fullPage: true });
  await page.mouse.click(points.side.x, points.side.y);
  const input = page.locator("#dimensionValueInput");
  expect(await input.isVisible()).toBe(true);
  await input.fill("25");
  await input.press("Enter");

  const state = await page.evaluate(() => window.__jot2dTest.offsetUiState());
  expect(state.pendingType).toBe(null);
  expect(state.lineCount).toBe(2);
  expect(state.constraintCount).toBe(1);
  expect(state.targets).toEqual([25]);
  expect(state.toolActive).toBe(true);
});

test("offset stays on the cursor side for direction-reversed constrained lines", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  for (const directionCase of ["vertical", "horizontal"]) {
    const points = await page.evaluate((value) => window.__jot2dTest.resetForOffsetDirection(value), directionCase);
    await page.click("#toolOffset");
    await page.mouse.click(points.source.x, points.source.y);
    await page.mouse.move(points.side.x, points.side.y);
    await page.mouse.click(points.side.x, points.side.y);
    const input = page.locator("#dimensionValueInput");
    await input.fill("20");
    await input.press("Enter");

    const state = await page.evaluate(() => window.__jot2dTest.offsetUiState());
    expect(state.lineOffsetDeltas).toHaveLength(1);
    expect(state.lineOffsetDeltas[0][points.expectedAxis]).toBeCloseTo(20, 5);
    expect(state.lineOffsetDeltas[0][points.expectedAxis === "x" ? "y" : "x"]).toBeCloseTo(0, 5);
  }
});

test("offset tool builds an explicitly connected line chain with one editable dimension", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const points = await page.evaluate(() => window.__jot2dTest.resetForOffsetChainUi());

  await page.click("#toolOffset");
  await page.mouse.click(points.first.x, points.first.y);
  expect((await page.evaluate(() => window.__jot2dTest.offsetChainUiState())).selectedCount).toBe(1);

  await page.mouse.click(points.disconnected.x, points.disconnected.y);
  let state = await page.evaluate(() => window.__jot2dTest.offsetChainUiState());
  expect(state.selectedCount).toBe(1);
  await expect(page.locator("#hint")).toContainText("明示的に接続");

  await page.mouse.click(points.second.x, points.second.y);
  state = await page.evaluate(() => window.__jot2dTest.offsetChainUiState());
  expect(state.selectedCount).toBe(2);
  expect(state.selectionCommitted).toBe(false);

  await page.keyboard.press("Enter");
  expect((await page.evaluate(() => window.__jot2dTest.offsetChainUiState())).selectionCommitted).toBe(true);
  await page.mouse.click(points.side.x, points.side.y);
  const input = page.locator("#dimensionValueInput");
  await expect(input).toBeVisible();
  await input.fill("15");
  await input.press("Enter");

  state = await page.evaluate(() => window.__jot2dTest.offsetChainUiState());
  expect(state.lineCount).toBe(5);
  expect(state.constraintCount).toBe(1);
  expect(state.target).toBe(15);
  expect(state.parameterName).toBe("d1");
  expect(state.sourceIds).toEqual(points.sourceIds);
  expect(state.offsetIds).toHaveLength(2);
  expect(state.resultJoins[0].end.x).toBeCloseTo(state.resultJoins[0].start.x, 6);
  expect(state.resultJoins[0].end.y).toBeCloseTo(state.resultJoins[0].start.y, 6);
  expect(state.jsonVersion).toBe(19);
  expect(state.serializedTypes).toBe(1);

  await page.keyboard.press("Control+z");
  let historyState = await page.evaluate(() => window.__jot2dTest.offsetChainUiState());
  expect(historyState.lineCount).toBe(3);
  expect(historyState.constraintCount).toBe(0);
  await page.keyboard.press("Control+y");
  historyState = await page.evaluate(() => window.__jot2dTest.offsetChainUiState());
  expect(historyState.lineCount).toBe(5);
  expect(historyState.constraintCount).toBe(1);

  const restored = await page.evaluate(() => window.__jot2dTest.roundTripOffsetChainForTest());
  expect(restored.count).toBe(1);
  expect(restored.target).toBe(15);
  expect(restored.sourceCount).toBe(2);
  expect(restored.offsetCount).toBe(2);
  expect(restored.reversed).toEqual([false, false]);

  const edited = await page.evaluate(() => window.__jot2dTest.updateOffsetChainTargetForTest(22));
  expect(edited.measured).toBeCloseTo(22, 6);
  expect(edited.join.first.x).toBeCloseTo(edited.join.second.x, 6);
  expect(edited.join.first.y).toBeCloseTo(edited.join.second.y, 6);
  expect(await page.evaluate(() => window.__jot2dTest.canReselectOffsetResultChainForTest())).toEqual({ first: true, second: true, selectedCount: 2 });

  const invalid = structuredClone(state.serialized);
  invalid.constraints.find((item) => item.type === "offsetChainDimension").joinType = "round";
  const rejected = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "invalid-offset-chain.jot2d"), invalid);
  expect(rejected.success).toBe(false);
  const retained = await page.evaluate(() => window.__jot2dTest.offsetChainUiState());
  expect(retained.constraintCount).toBe(1);
  expect(retained.target).toBe(22);

  const completeSelection = await page.evaluate((lineIds) => window.__jot2dTest.selectGeometryIdsForTest({ lines: lineIds }), [...state.sourceIds, ...state.offsetIds]);
  expect(completeSelection.blockError).toBe(null);
  expect(completeSelection.internalConstraintCount).toBe(1);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  const copied = await page.evaluate(() => window.__jot2dTest.offsetChainUiState());
  expect(copied.lineCount).toBe(9);
  expect(copied.constraintCount).toBe(2);
  expect(copied.serializedTypes).toBe(2);
  expect(copied.parameterNames).toEqual(["d1", "d2"]);
});

test("sketch deletion removes its subtree and active sketch siblings remain visible", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const sibling = await page.evaluate(() => window.__jot2dTest.resetForSiblingVisibility());
  expect(sibling.visible).toBe(true);
  expect(sibling.relation).toBe("inactive");
  expect(sibling.strokeWidth).toBe(1.2);
  expect(sibling.color).toBe("#cbd5e1");
  expect(sibling.rowHasVisibleClass).toBe(true);

  const deleted = await page.evaluate(() => window.__jot2dTest.resetForSketchDeletion());
  expect(deleted.deleted).toBe(true);
  expect(deleted.sketchIds).toEqual(["ROOT", "S1", "S4"]);
  expect(deleted.activeSketchId).toBe("ROOT");
  expect(deleted.geometry).toEqual({ points: 0, lines: 0, circles: 0, arcs: 0 });
  expect(deleted.annotationCount).toBe(0);
});

test("non-active sketch visibility can be toggled and is persisted", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  await page.evaluate(() => window.__jot2dTest.resetForSiblingVisibility());
  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  let state = await page.evaluate(() => window.__jot2dTest.sketchVisibilityState("S2"));
  expect(state).toEqual({ preferenceVisible: false, effectiveVisible: false, serializedVisible: false, buttonPressed: "false" });

  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  state = await page.evaluate(() => window.__jot2dTest.sketchVisibilityState("S2"));
  expect(state).toEqual({ preferenceVisible: true, effectiveVisible: true, serializedVisible: true, buttonPressed: "true" });
});

test("non-active sketches are visible unless individually hidden", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const setup = await page.evaluate(() => window.__jot2dTest.resetForSiblingSubtreeReference());
  expect(setup.relations).toEqual({ S10: "reference", S2: "inactive", S3: "inactive", S4: "inactive", S9: "inactive", S11: "descendant" });
  expect(setup.relationLabels).toEqual({ S9: "参照不可", S11: "参照不可（子孫）" });
  expect(setup.relationColors).toEqual({ S9: "#64748b", S11: "#b91c1c" });
  expect(setup.visible).toEqual({ S10: true, S2: true, S3: true, S4: true, S9: true, S11: true });
  expect(setup.rowClasses).toEqual({ S2: true, S3: false, S4: false, S9: true, S11: false });
  expect(setup.rowBackgrounds.S2).toBe("rgba(0, 0, 0, 0)");
  expect(setup.rowBackgrounds.S9).toBe("rgba(0, 0, 0, 0)");
  await expect(sketchTreeSketch(page, "S2")).toHaveAttribute("aria-expanded", "false");
  await expandSketchTreeSketch(page, "S2");
  await expect(sketchTreeSketch(page, "S3")).toBeVisible();
  await expect(sketchTreeSketch(page, "S4")).toHaveCount(0);

  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  let state = await page.evaluate(() => window.__jot2dTest.siblingSubtreeVisibilityState());
  expect(state).toEqual({
    S2: { preferenceVisible: false, effectiveVisible: false },
    S3: { preferenceVisible: true, effectiveVisible: true },
    S4: { preferenceVisible: true, effectiveVisible: true },
  });

  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  state = await page.evaluate(() => window.__jot2dTest.siblingSubtreeVisibilityState());
  expect(state.S2.effectiveVisible).toBe(true);
  expect(state.S3.effectiveVisible).toBe(true);
  expect(state.S4.effectiveVisible).toBe(true);

  await page.click('.sketchVisibilityBtn[data-id="S3"]');
  state = await page.evaluate(() => window.__jot2dTest.siblingSubtreeVisibilityState());
  expect(state.S2.effectiveVisible).toBe(true);
  expect(state.S3.effectiveVisible).toBe(false);
  expect(state.S4.effectiveVisible).toBe(true);
});

test("blank canvas click clears a selected dimension without leaving the constraint command", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const points = await page.evaluate(() => window.__jot2dTest.resetForConstraintDimensionSelection());
  expect(await page.evaluate(() => window.__jot2dTest.constraintDimensionSelectionState())).toEqual({ selected: true, command: "parallel" });
  await page.mouse.click(points.blank.x, points.blank.y);
  expect(await page.evaluate(() => window.__jot2dTest.constraintDimensionSelectionState())).toEqual({ selected: false, command: "parallel" });
});

test("lines and arcs with fixed support geometry use the support constraint color", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);
  const state = await page.evaluate(() => window.__jot2dTest.resetForSupportConstraintStatus());

  expect(state.supportLine).toEqual({ status: "support", color: "#0f766e" });
  expect(state.supportArc).toEqual({ status: "support", color: "#0f766e" });
  expect(state.underLine.status).toBe("under");
  expect(state.fullLine.status).toBe("full");
  expect(state.summary.support).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: "test-results/support-constraint-status.png", fullPage: true });
});

test("ancestor point and active line can receive a coincidence constraint in either role", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  let points = await page.evaluate(() => window.__jot2dTest.resetForReferencePointLineCoincidence());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.parentPoint.x, points.parentPoint.y);
  await page.mouse.click(points.childLine.x, points.childLine.y);
  let state = await page.evaluate(() => window.__jot2dTest.referencePointLineState());
  expect(state.count).toBe(1);
  expect(state.errors[0]).toBeLessThan(1e-5);
  expect(state.referenceSketchIds).toEqual(["S1"]);
  expect(state.sketchIds).toEqual(["S2"]);

  points = await page.evaluate(() => window.__jot2dTest.resetForReferencePointLineCoincidence());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.childPoint.x, points.childPoint.y);
  await page.mouse.click(points.parentLine.x, points.parentLine.y);
  state = await page.evaluate(() => window.__jot2dTest.referencePointLineState());
  expect(state.count).toBe(1);
  expect(state.errors[0]).toBeLessThan(1e-5);
  expect(state.referenceSketchIds).toEqual(["S1"]);
  expect(state.sketchIds).toEqual(["S2"]);
});

test("sibling geometry is visible but cannot be referenced", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const points = await page.evaluate(() => window.__jot2dTest.resetForSiblingPointLineReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.siblingLine.x, points.siblingLine.y);
  await page.mouse.click(points.activePoint.x, points.activePoint.y);

  const state = await page.evaluate(() => window.__jot2dTest.referencePointLineState());
  expect(state.count).toBe(0);
});

test("sibling descendants and unrelated sketches cannot be referenced", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const points = await page.evaluate(() => window.__jot2dTest.resetForSiblingSubtreeReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.referenceLine.x, points.referenceLine.y);
  await page.mouse.click(points.activePoint.x, points.activePoint.y);

  let state = await page.evaluate(() => window.__jot2dTest.referencePointLineState());
  expect(state.count).toBe(0);

  const unrelated = await page.evaluate(() => window.__jot2dTest.resetForSiblingSubtreeReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(unrelated.unrelatedLine.x, unrelated.unrelatedLine.y);
  await page.mouse.click(unrelated.activePoint.x, unrelated.activePoint.y);
  state = await page.evaluate(() => window.__jot2dTest.referencePointLineState());
  expect(state.count).toBe(0);

  const descendant = await page.evaluate(() => window.__jot2dTest.resetForSiblingSubtreeReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(descendant.childLine.x, descendant.childLine.y);
  await page.mouse.click(descendant.activePoint.x, descendant.activePoint.y);
  state = await page.evaluate(() => window.__jot2dTest.referencePointLineState());
  expect(state.count).toBe(0);
});

test("reference dependents solve in topological order and out-of-scope loaded references are disabled", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const order = await page.evaluate(() => window.__jot2dTest.referenceDependencyOrderCase());
  expect(order.order).toEqual(["S1", "S5"]);
  expect(order.activePointY).toBeCloseTo(25, 5);
  expect(order.childPointY).toBeCloseTo(25, 5);

  const cycle = await page.evaluate(() => window.__jot2dTest.cyclicReferenceLoadCase());
  expect(cycle.total).toBe(2);
  expect(cycle.operational).toBe(0);
  expect(cycle.invalid).toHaveLength(2);
  expect(cycle.badges).toBeGreaterThan(0);
});

test("point-point rectangle dimensions keep extension lines visible on both pull sides", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.pointPointRectangleDimensionExtensionVisibilityCases());
  expect(result.top).toEqual([true, true]);
  expect(result.left).toEqual([true, true]);
  expect(result.pointPointPreviewLeft).toEqual([true, true]);
  expect(result.lineLengthPreviewLeft).toEqual([true, true]);
});

test("dimension labels hide values below the supported display precision", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.dimensionDisplayPrecisionCases());
  expect(result.integerTrailingZero).toBe("140");
  expect(result.integerHundred).toBe("100");
  expect(result.positiveNoise).toBe("15");
  expect(result.negativeNoise).toBe("825");
  expect(result.precisionBoundaryNoise).toBe("1845");
  expect(result.measuredAccumulatedNoise).toBe("1845");
  expect(result.minimumResolution).toBe("0.000001");
  expect(result.measuredMinimumResolution).toBe("0.000001");
  expect(result.roundedFraction).toBe("1.234567");
});

test("dimension labels follow JIS reading directions in every quadrant", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.dimensionTextAngleCases());
  expect(result.zero.angle).toBeCloseTo(0, 8);
  expect(result.zero.offset).toEqual(expect.objectContaining({ x: 0, y: -1 }));
  expect(result.quadrant1.angle).toBeCloseTo(-30, 8);
  expect(result.quadrant1.offset.x).toBeLessThan(0);
  expect(result.quadrant1.offset.y).toBeLessThan(0);
  expect(result.vertical90.angle).toBeCloseTo(-90, 8);
  expect(result.vertical90.offset.x).toBeCloseTo(-1, 8);
  expect(result.vertical90.offset.y).toBeCloseTo(0, 8);
  expect(result.quadrant2.angle).toBeCloseTo(30, 8);
  expect(result.quadrant2.offset.x).toBeGreaterThan(0);
  expect(result.quadrant2.offset.y).toBeLessThan(0);
  expect(result.straight180.angle).toBeCloseTo(0, 8);
  expect(result.straight180.offset.y).toBeCloseTo(-1, 8);
  expect(result.quadrant3.angle).toBeCloseTo(-30, 8);
  expect(result.quadrant3.offset.x).toBeLessThan(0);
  expect(result.quadrant3.offset.y).toBeLessThan(0);
  expect(result.vertical270.angle).toBeCloseTo(-90, 8);
  expect(result.vertical270.offset.x).toBeCloseTo(-1, 8);
  expect(result.vertical270.offset.y).toBeCloseTo(0, 8);
  expect(result.quadrant4.angle).toBeCloseTo(30, 8);
  expect(result.quadrant4.offset.x).toBeGreaterThan(0);
  expect(result.quadrant4.offset.y).toBeLessThan(0);
  expect(result.quadrant4NearVertical.angle).toBeCloseTo(87, 8);
  expect(result.quadrant4NearVertical.offset.x).toBeGreaterThan(0);
  expect(result.quadrant4NearVertical.offset.y).toBeLessThan(0);
});

test("angle dimension labels follow geometry and dimension-line movement", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.angleDimensionLabelFollowCase());
  expect(result.migratedLegacyCoordinates).toBe(true);
  expect(result.recoveredCorruptedOffsets.radial).toBeCloseTo(0, 8);
  expect(result.recoveredCorruptedOffsets.tangent).toBeCloseTo(0, 8);
  expect(result.storedOffsets.radial).toBeCloseTo(11, 8);
  expect(result.storedOffsets.tangent).toBeCloseTo(7, 8);
  expect(result.labelTranslationError).toBeLessThan(1e-8);
  expect(result.arcTranslationError).toBeLessThan(1e-8);
  expect(result.radiusFollowError).toBeLessThan(1e-8);
  expect(result.repeatedDragOffsetError).toBeLessThan(1e-8);
  expect(result.repeatedDragRadialPointerError).toBeLessThan(1e-8);
  expect(result.serializedRelativeOffsets).toBe(true);
  expect(result.serializedPlacementVersion).toBe(2);
  expect(result.serializedLegacyCoordinates).toBe(false);
});

test("middle line trim transfers right-side point constraints to the new segment", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__jot2dTest);

  const result = await page.evaluate(() => window.__jot2dTest.resetForTrimConstraintTransfer());
  expect(result.lineCount).toBe(2);
  expect(result.leftConstraintOnLeftLine).toBe(true);
  expect(result.rightConstraintOnRightLine).toBe(true);
  expect(result.leftLineEnd).toEqual({ x: 40, y: 0 });
  expect(result.rightLineStart).toEqual({ x: 60, y: 0 });
});
