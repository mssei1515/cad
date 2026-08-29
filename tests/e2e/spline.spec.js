const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});

async function createOpenSpline(page) {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSplineTest());
  await page.locator("#toolSpline").click();
  await expect.poll(() => page.evaluate(() => window.__jot2dTest.splineStateForTest().mode)).toBe("spline");
  for (const point of fixture.clients) await page.mouse.click(point.x, point.y);
  await page.keyboard.press("Enter");
  return fixture;
}

test("creates and edits a cubic fit-point spline and persists version 18", async ({ page }) => {
  await createOpenSpline(page);

  let state = await page.evaluate(() => window.__jot2dTest.splineStateForTest());
  expect(state.mode).toBe("select");
  expect(state.selectedIds).toEqual(["SP1"]);
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0]).toEqual(expect.objectContaining({
    id: "SP1",
    definitionMode: "fit",
    degree: 3,
    closed: false,
    endCondition: "natural",
  }));
  expect(state.direct[0].fitPoints).toHaveLength(4);
  expect(state.serialized.version).toBe(18);
  expect(state.propertiesText).toContain("スプライン");
  expect(state.propertiesText).toContain("通過点ID");
  await expect(page.locator("#propertiesPanel .property-section > h3")).toHaveText(["基本情報", "スプラインの外観"]);

  await page.locator('.sketch-group-row[data-category="spline"]').click();
  const treeRow = page.locator('#sketchList [data-object-kind="spline"]');
  await expect(treeRow).toHaveCount(1);
  await expect(treeRow).toContainText("SP1");
  expect(await treeRow.locator("svg path").count()).toBeGreaterThan(0);

  const closed = page.locator('#propertiesPanel [data-property="spline-closed"]');
  await closed.check();
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct[0].closed).toBe(true);
  await page.keyboard.press("Control+z");
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct[0].closed).toBe(false);
  await page.keyboard.press("Control+y");
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct[0].closed).toBe(true);

  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ splines: ["SP1"] }));
  await page.locator('[data-property-action="spline-edit"]').click();
  state = await page.evaluate(() => window.__jot2dTest.splineStateForTest());
  expect(state.editSplineId).toBe("SP1");
  const fitPointId = state.direct[0].fitPoints[1];
  const beforePoint = state.serialized.points.find((point) => point.id === fitPointId);
  const fitPointClient = await page.evaluate((id) => window.__jot2dTest.geometryClientPositionForTest("point", id), fitPointId);
  await page.mouse.move(fitPointClient.x, fitPointClient.y);
  await page.mouse.down();
  await page.mouse.move(fitPointClient.x + 24, fitPointClient.y - 16, { steps: 3 });
  await page.mouse.up();
  state = await page.evaluate(() => window.__jot2dTest.splineStateForTest());
  const afterPoint = state.serialized.points.find((point) => point.id === fitPointId);
  expect(Math.hypot(afterPoint.x - beforePoint.x, afterPoint.y - beforePoint.y)).toBeGreaterThan(5);
  expect(state.selectedPointIds).toEqual([fitPointId]);
  await page.keyboard.press("Escape");
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).editSplineId).toBeNull();
  await page.keyboard.press("Escape");
  state = await page.evaluate(() => window.__jot2dTest.splineStateForTest());
  expect(state.selectedIds).toEqual([]);
  expect(state.selectedPointIds).toEqual([]);
});

test("finishes spline creation without adding the double-click position and edits fit points from the context menu", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSplineTest());
  await page.locator("#toolSpline").click();
  for (const point of fixture.clients.slice(0, 3)) await page.mouse.click(point.x, point.y);
  await page.mouse.dblclick(fixture.clients[3].x, fixture.clients[3].y);

  let state = await page.evaluate(() => window.__jot2dTest.splineStateForTest());
  expect(state.mode).toBe("select");
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0].fitPoints).toHaveLength(3);
  expect(state.serialized.points).toHaveLength(3);
  const initialFitPointIds = [...state.direct[0].fitPoints];

  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ splines: ["SP1"] }));
  await page.locator('[data-property-action="spline-edit"]').click();
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.dblclick(canvas.x + canvas.width - 24, canvas.y + canvas.height - 24);
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).editSplineId).toBeNull();

  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ splines: ["SP1"] }));
  await page.locator('[data-property-action="spline-edit"]').click();
  const splineClient = await page.evaluate(() => window.__jot2dTest.geometryClientPositionForTest("spline", "SP1"));
  await page.mouse.click(splineClient.x, splineClient.y, { button: "right" });
  await page.locator('[data-context-action="spline-fit-point-add"]').click();

  state = await page.evaluate(() => window.__jot2dTest.splineStateForTest());
  expect(state.editSplineId).toBe("SP1");
  expect(state.direct[0].fitPoints).toHaveLength(4);
  const addedPointId = state.direct[0].fitPoints.find((id) => !initialFitPointIds.includes(id));
  expect(addedPointId).toBeTruthy();

  const addedPointClient = await page.evaluate((id) => window.__jot2dTest.geometryClientPositionForTest("point", id), addedPointId);
  await page.mouse.click(addedPointClient.x, addedPointClient.y, { button: "right" });
  await expect(page.locator('[data-context-action="spline-fit-point-delete"]')).toBeEnabled();
  await page.locator('[data-context-action="spline-fit-point-delete"]').click();

  state = await page.evaluate(() => window.__jot2dTest.splineStateForTest());
  expect(state.editSplineId).toBe("SP1");
  expect(state.direct[0].fitPoints).toHaveLength(3);
  expect(state.serialized.points.some((point) => point.id === addedPointId)).toBe(false);

  const requiredPointClient = await page.evaluate((id) => window.__jot2dTest.geometryClientPositionForTest("point", id), state.direct[0].fitPoints[0]);
  await page.mouse.click(requiredPointClient.x, requiredPointClient.y, { button: "right" });
  await expect(page.locator('[data-context-action="spline-fit-point-delete"]')).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct[0].fitPoints).toHaveLength(4);
  await page.keyboard.press("Control+y");
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct[0].fitPoints).toHaveLength(3);
});

test("copies splines and projects them through blocks", async ({ page }) => {
  await createOpenSpline(page);
  const transfer = await page.evaluate(() => window.__jot2dTest.exerciseSplineTransferForTest());
  expect(transfer).toEqual(expect.objectContaining({ copied: true, blockError: null }));
  expect(transfer.pasted).toEqual(expect.objectContaining({ id: "SP2" }));
  expect(transfer.pasted.fitPoints).toHaveLength(4);
  expect(transfer.leader).toEqual(expect.objectContaining({ kind: "spline", pastedId: "AN2" }));
  expect(transfer.definition).toEqual(expect.objectContaining({ splineCount: 1, pointCount: 4, annotationCount: 1 }));
  expect(transfer.projection).toEqual(expect.objectContaining({ ownerId: "BI1", fitPointCount: 4, annotationCount: 1 }));

  const serialized = await page.evaluate(() => window.__jot2dTest.splineStateForTest().serialized);
  expect(serialized.splines).toHaveLength(2);
  expect(serialized.annotations).toHaveLength(2);
  expect(serialized.blockDefinitions[0].splines).toHaveLength(1);
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "splines.jot2d"), serialized)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct).toHaveLength(2);
});

test("persists point-on-spline and endpoint tangent constraints", async ({ page }) => {
  await createOpenSpline(page);
  const state = await page.evaluate(() => window.__jot2dTest.exerciseSplineConstraintsForTest());
  expect(state.types).toEqual(["pointOnSpline", "splineLineTangent"]);
  expect(state.pointOnSpline).toEqual(expect.objectContaining({ type: "pointOnSpline", spline: "SP1", parameter: 0.4 }));
  expect(state.splineLineTangent).toEqual(expect.objectContaining({ type: "splineLineTangent", spline: "SP1", endpoint: "start" }));
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "spline-constraints.jot2d"), state.serialized)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__jot2dTest.exerciseSplineConstraintsForTest())).types).toEqual(expect.arrayContaining(["pointOnSpline", "splineLineTangent"]));
});

test("rebuilds the hatch preview cache after spline fit points move", async ({ page }) => {
  const state = await page.evaluate(() => window.__jot2dTest.splineHatchPreviewCacheForTest());
  expect(state).toEqual(expect.objectContaining({ splineId: "SP1", beforeOk: true, afterOk: true }));
  expect(state.afterMaxX).toBeGreaterThan(state.beforeMaxX + 50);
});

test("migrates version 14 without splines and rejects malformed current spline data", async ({ page }) => {
  await createOpenSpline(page);
  const current = await page.evaluate(() => window.__jot2dTest.splineStateForTest().serialized);

  const malformed = structuredClone(current);
  malformed.splines[0].degree = 4;
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "malformed-spline.jot2d"), malformed)).toEqual(expect.objectContaining({ success: false }));
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct).toHaveLength(1);

  const crossSketch = structuredClone(current);
  const sourceSketch = crossSketch.sketches.find((sketch) => sketch.kind !== "root");
  crossSketch.sketches.push({ ...sourceSketch, id: "S2", name: "Sketch-2" });
  crossSketch.points.find((point) => point.id === crossSketch.splines[0].fitPoints[0]).sketchId = "S2";
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "cross-sketch-spline.jot2d"), crossSketch)).toEqual(expect.objectContaining({ success: false }));
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct).toHaveLength(1);

  const legacy = structuredClone(current);
  legacy.version = 14;
  delete legacy.splines;
  for (const definition of legacy.blockDefinitions) delete definition.splines;
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "legacy-v14.jot2d"), legacy)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__jot2dTest.splineStateForTest())).direct).toHaveLength(0);
});
