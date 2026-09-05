const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});

async function canvasPixel(page, client) {
  return page.evaluate((point) => {
    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = Math.max(0, Math.min(canvas.width - 1, Math.round((point.x - rect.left) * dpr)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.round((point.y - rect.top) * dpr)));
    return [...canvas.getContext("2d").getImageData(x, y, 1, 1).data];
  }, client);
}

test("reorders lines, hatches, blocks, and derived instances only within the active Sketch", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForDrawingOrderTest());
  let state = await page.evaluate(() => window.__jot2dTest.drawingOrderStateForTest());

  expect(state.serialized.version).toBe(22);
  expect(state.bySketch.S1[0]).toEqual(expect.objectContaining({ kind: "hatch", id: "H1", drawingOrder: 0 }));
  expect(state.bySketch.S1.map((item) => item.drawingOrder)).toEqual(state.bySketch.S1.map((_item, index) => index));
  expect(state.bySketch.S1).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "block", id: "BI1" }),
    expect.objectContaining({ kind: "geometry-instance", id: "MI1" }),
  ]));
  expect(state.bySketch.S2).toEqual([{ kind: "line", id: fixture.otherLineId, drawingOrder: 0 }]);
  expect(state.hatchBoundaryHitExclusionScreenPx).toBe(3);
  expect(state.hatchSelectableAtBoundary).toBe(false);

  const centerBefore = await canvasPixel(page, fixture.centerClient);
  expect(centerBefore[0]).toBeGreaterThan(centerBefore[2]);

  await page.mouse.click(fixture.hatchClient.x, fixture.hatchClient.y, { button: "right" });
  await expect(page.locator('#canvasContextMenu [data-context-action="drawing-front"]')).toBeVisible();
  await page.locator('#canvasContextMenu [data-context-action="drawing-front"]').click();

  state = await page.evaluate(() => window.__jot2dTest.drawingOrderStateForTest());
  expect(state.bySketch.S1.at(-1)).toEqual(expect.objectContaining({ kind: "hatch", id: "H1" }));
  expect(state.bySketch.S2).toEqual([{ kind: "line", id: fixture.otherLineId, drawingOrder: 0 }]);
  const centerAfter = await canvasPixel(page, fixture.centerClient);
  expect(centerAfter[2]).toBeGreaterThan(centerAfter[0]);
  const boundaryAfter = await canvasPixel(page, fixture.boundaryClient);
  expect(boundaryAfter[1]).toBeGreaterThan(boundaryAfter[0]);
  expect(boundaryAfter[1]).toBeGreaterThan(boundaryAfter[2]);
  const insideBoundaryAfter = await canvasPixel(page, fixture.insideBoundaryClient);
  expect(insideBoundaryAfter[2]).toBeGreaterThan(insideBoundaryAfter[0]);
  expect(insideBoundaryAfter[3]).toBeGreaterThan(0);
  await page.evaluate((id) => window.__jot2dTest.selectDrawingOrderObjectForTest("line", id), fixture.crossLineId);
  await page.mouse.click(fixture.centerClient.x, fixture.centerClient.y);
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).selectedIds).toEqual(["H1"]);

  await page.keyboard.press("Control+z");
  state = await page.evaluate(() => window.__jot2dTest.drawingOrderStateForTest());
  expect(state.bySketch.S1[0]).toEqual(expect.objectContaining({ kind: "hatch", id: "H1" }));
  await page.keyboard.press("Control+y");
  state = await page.evaluate(() => window.__jot2dTest.drawingOrderStateForTest());
  expect(state.bySketch.S1.at(-1)).toEqual(expect.objectContaining({ kind: "hatch", id: "H1" }));

  state = await page.evaluate(() => window.__jot2dTest.selectDrawingOrderObjectForTest("block", "BI1"));
  state = await page.evaluate(() => window.__jot2dTest.reorderDrawingOrderForTest("drawing-front"));
  expect(state.bySketch.S1.at(-1)).toEqual(expect.objectContaining({ kind: "block", id: "BI1" }));
  const saved = state.serialized;
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "drawing-order-v22.jot2d"), saved)).toEqual(expect.objectContaining({ success: true }));
  state = await page.evaluate(() => window.__jot2dTest.drawingOrderStateForTest());
  expect(state.bySketch.S1.at(-1)).toEqual(expect.objectContaining({ kind: "block", id: "BI1" }));

  await page.evaluate(() => window.__jot2dTest.selectDrawingOrderObjectForTest("geometry-instance", "MI1"));
  state = await page.evaluate(() => window.__jot2dTest.reorderDrawingOrderForTest("drawing-back"));
  expect(state.bySketch.S1[0]).toEqual(expect.objectContaining({ kind: "geometry-instance", id: "MI1" }));
  state = await page.evaluate(() => window.__jot2dTest.reorderDrawingOrderForTest("drawing-forward"));
  expect(state.bySketch.S1[1]).toEqual(expect.objectContaining({ kind: "geometry-instance", id: "MI1" }));
});

test("migrates documents without drawingOrder to the legacy visual order", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForDrawingOrderTest());
  const legacy = structuredClone(fixture.serialized);
  legacy.version = 21;
  const strip = (scope) => {
    for (const key of ["hatches", "lines", "circles", "arcs", "splines", "blockInstances", "geometryInstances"]) {
      for (const item of scope[key] || []) delete item.drawingOrder;
    }
  };
  strip(legacy);
  for (const definition of legacy.blockDefinitions) strip(definition);

  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "drawing-order-v21.jot2d"), legacy)).toEqual(expect.objectContaining({ success: true }));
  const state = await page.evaluate(() => window.__jot2dTest.drawingOrderStateForTest());
  expect(state.serialized.version).toBe(22);
  expect(state.bySketch.S1[0]).toEqual(expect.objectContaining({ kind: "hatch", id: "H1" }));
  expect(state.bySketch.S1.map((item) => item.drawingOrder)).toEqual(state.bySketch.S1.map((_item, index) => index));
  expect(state.bySketch.S2).toEqual([{ kind: "line", id: fixture.otherLineId, drawingOrder: 0 }]);
});
