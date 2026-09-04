const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});

test("projection, mirror, and linear pattern are persisted as read-only derived instances", async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.locator('.sketch-item[data-id="S2"] .sketchExpandBtn').click();
  await page.locator('.sketch-group-row[data-sketch-id="S2"][data-category="instance"]').click();
  const state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());

  expect(state.serialized.version).toBe(21);
  expect(state.serialized.geometryInstances.map((item) => item.type)).toEqual(["sketchProjection", "mirror", "pattern"]);
  expect(state.serialized.constraints.some((item) => item.type === "sketchProjection")).toBe(false);
  expect(state.serialized.geometryInstances[2]).toMatchObject({ spacing: 15, copies: 3, reversed: false });
  expect(state.instances.every((item) => item.valid)).toBe(true);
  expect(state.instances.find((item) => item.type === "pattern").lines).toHaveLength(3);
  expect(state.instances.find((item) => item.type === "mirror").lines[0].p1.x).toBe(40);
  expect(state.instances.flatMap((item) => [...item.lines, ...item.circles, ...item.arcs]).every((item) => item.color === "#7c3aed")).toBe(true);
  expect(state.instances.find((item) => item.type === "mirror").arcs[0].sweep).toBeCloseTo(-0.5, 8);
  expect(state.hatchValidity).toEqual([true]);
  expect(state.treeCount).toBe(3);
});

test("projection, mirror, and pattern toolbar commands create grouped instances", async ({ page }) => {
  const projectionFixture = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionTest());
  await page.click("#toolSketchProjection");
  await page.mouse.click(projectionFixture.clients.line1.x, projectionFixture.clients.line1.y);
  await page.keyboard.press("Enter");
  let state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  expect(state.serialized.geometryInstances).toHaveLength(1);
  expect(state.serialized.geometryInstances[0]).toMatchObject({ type: "sketchProjection", sketchId: projectionFixture.targetSketchId });
  expect(state.instances[0].lines).toHaveLength(1);

  const copyFixture = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  await page.evaluate((sourceId) => window.__jot2dTest.selectGeometryIdsForTest({ lines: [sourceId] }), copyFixture.sourceId);
  await page.click("#toolMirror");
  await page.mouse.click(copyFixture.axis.x, copyFixture.axis.y);

  await page.evaluate((sourceId) => window.__jot2dTest.selectGeometryIdsForTest({ lines: [sourceId] }), copyFixture.sourceId);
  await page.click("#toolPattern");
  const answers = ["12.5", "4"];
  page.on("dialog", async (dialog) => dialog.accept(answers.shift()));
  await page.mouse.click(copyFixture.direction.x, copyFixture.direction.y);

  state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  expect(state.serialized.geometryInstances.map((item) => item.type)).toEqual(["mirror", "pattern"]);
  expect(state.serialized.geometryInstances[1]).toMatchObject({ spacing: 12.5, copies: 4, reversed: false });
  expect(state.instances[1].lines).toHaveLength(4);
});

test("derived instance chains reload with stable references and topology", async ({ page }) => {
  const before = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  const after = await page.evaluate((data) => window.__jot2dTest.loadModelForDerivedInstanceTest(data), before.serialized);

  expect(after.instances.map((item) => ({ id: item.id, valid: item.valid }))).toEqual([
    { id: "SPI1", valid: true },
    { id: "MI1", valid: true },
    { id: "PI1", valid: true },
  ]);
  expect(after.instances.find((item) => item.id === "MI1").circles).toHaveLength(1);
  expect(after.hatchValidity).toEqual([true]);
  expect(after.serialized.geometryInstances[1].sources[1]).toEqual({ kind: "circle", path: ["SPI1", "C1"] });
});

test("malformed current instances are rejected without replacing the document", async ({ page }) => {
  const before = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  const malformed = structuredClone(before.serialized);
  malformed.geometryInstances[0].type = "unsupported";
  const result = await page.evaluate((data) => {
    try {
      window.__jot2dTest.loadModelForDerivedInstanceTest(data);
      return { rejected: false, current: window.__jot2dTest.serializedModelForTest() };
    } catch (error) {
      return { rejected: true, message: error.message, current: window.__jot2dTest.serializedModelForTest() };
    }
  }, malformed);
  expect(result.rejected).toBe(true);
  expect(result.message).toContain("未対応");
  expect(result.current.geometryInstances).toEqual(before.serialized.geometryInstances);
});

test("source and dependency deletion is rejected; leaf instance deletion is allowed", async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  const sourceDelete = await page.evaluate(() => window.__jot2dTest.deleteDerivedSourceForTest());
  expect(sourceDelete.deleted).toBe(false);
  expect(sourceDelete.hint).toContain("先に依存インスタンスを削除");

  const parentDelete = await page.evaluate(() => window.__jot2dTest.deleteDerivedInstanceForTest("SPI1"));
  expect(parentDelete.deleted).toBe(false);
  expect(parentDelete.state.instances).toHaveLength(3);

  const leafDelete = await page.evaluate(() => window.__jot2dTest.deleteDerivedInstanceForTest("PI1"));
  expect(leafDelete.deleted).toBe(true);
  expect(leafDelete.state.instances.map((item) => item.id)).toEqual(["SPI1", "MI1"]);
});

test("v20 sketch projection constraints migrate one-to-one to v21 instances", async ({ page }) => {
  const legacy = {
    version: 20,
    documentName: "legacy",
    units: { length: "mm" },
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root" },
      { id: "S1", name: "Source", parentSketchId: "ROOT", kind: "sketch" },
      { id: "S2", name: "Target", parentSketchId: "S1", kind: "sketch" },
    ],
    activeSketchId: "S2",
    annotations: [], hatches: [], referenceImages: [], nextHatchIndex: 1,
    parameters: [], nextDimensionParameterIndex: 1,
    blockDefinitions: [], blockInstances: [], splines: [], circles: [], arcs: [],
    points: [
      { id: "P1", x: 0, y: 0, kind: "endpoint", sketchId: "S1" },
      { id: "P2", x: 20, y: 0, kind: "endpoint", sketchId: "S1" },
      { id: "P3", x: 0, y: 0, kind: "endpoint", sketchId: "S2" },
      { id: "P4", x: 20, y: 0, kind: "endpoint", sketchId: "S2" },
    ],
    lines: [
      { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" },
      { id: "L2", p1: "P3", p2: "P4", construction: false, sketchId: "S2" },
    ],
    constraints: [{ type: "sketchProjection", kind: "line", source: "L1", target: "L2", enabled: true, reference: true, referenceSketchId: "S1", sketchId: "S2" }],
  };
  const state = await page.evaluate((data) => window.__jot2dTest.loadModelForDerivedInstanceTest(data), legacy);
  expect(state.serialized.version).toBe(21);
  expect(state.serialized.constraints).toHaveLength(0);
  expect(state.serialized.lines.map((line) => line.id)).toEqual(["L1"]);
  expect(state.serialized.geometryInstances).toHaveLength(1);
  expect(state.serialized.geometryInstances[0]).toMatchObject({ type: "sketchProjection", legacyOutput: { kind: "line", id: "L2", pointIds: ["P3", "P4"] } });
  expect(state.instances[0].lines[0].id).toBe("L2");
});

test("pattern properties are editable and no independentize action is exposed", async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.evaluate(() => window.__jot2dTest.deleteDerivedInstanceForTest("PI1"));
  await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.locator('.sketch-item[data-id="S2"] .sketchExpandBtn').click();
  await page.locator('.sketch-group-row[data-sketch-id="S2"][data-category="instance"]').click();
  await page.locator('.sketch-object-row[data-object-kind="instance"][data-id="PI1"]').click();
  await expect(page.locator('#propertiesPanel [data-geometry-instance-property="spacing"]')).toHaveValue("15");
  await expect(page.locator('#propertiesPanel')).not.toContainText("独立化");
  await expect(page.locator('#propertiesPanel')).not.toContainText("Make independent");
});
