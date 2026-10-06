const { test, expect, openTestDocument } = require("./test-fixture");
const PX = 96 / 25.4;

async function loadFixture(page) {
  await openTestDocument(page);
  const data = await page.evaluate(() => {
    window.__jot2dTest.resetForReadOnlyDuplicateDimension();
    return window.__jot2dTest.serializedModelForTest();
  });
  data.annotations = [
    { id: "AN1", type: "text", sketchId: "S1", x: -30, y: 30, text: "Free text", style: { textHeight: 5 } },
    { id: "AN2", type: "leader", sketchId: "S1", x: 30, y: 40, text: "Leader", start: { x: 0, y: 0 }, elbow: { x: 20, y: 40 }, end: { x: 30, y: 40 }, geometryRef: { kind: "line", path: ["L1"] }, style: { textHeight: 5, terminatorSize: 3, lineWidth: 2 } },
  ];
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "display-size.jot2d"), data)).toEqual(expect.objectContaining({ success: true }));
  await page.evaluate(scale => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, scale), PX * 1.5);
}

async function select(page, type) {
  if (type === "dimension") return page.evaluate(() => window.__jot2dTest.selectDimensionForPropertiesForTest(0));
  const sketch = page.locator('.sketch-item[data-id="S1"]');
  if (await sketch.getAttribute("aria-expanded") !== "true") await sketch.locator(".sketchExpandBtn").click();
  const group = page.locator('.sketch-group-row[data-sketch-id="S1"][data-category="annotation"]');
  if (await group.getAttribute("aria-expanded") !== "true") await group.click();
  await page.locator(`.sketch-object-row[data-object-kind="annotation"][data-id="${type === "text" ? "AN1" : "AN2"}"]`).click();
}

async function state(page, type) {
  return page.evaluate(type => {
    const api = window.__jot2dTest;
    const data = api.serializedModelForTest();
    if (type === "dimension") {
      const metrics = api.dimensionAppearanceRenderMetricsForTest(0);
      return { settings: data.constraints.find(c => c.dimension).dimension.display || {}, height: metrics.text.height, arrow: metrics.terminator.size, width: metrics.lineWidth, data };
    }
    const metrics = api.annotationAppearanceStateForTest(type);
    return { settings: metrics.style, height: metrics.screenTextHeight, arrow: metrics.screenTerminatorSize, data };
  }, type);
}

for (const type of ["text", "leader", "dimension"]) {
  test(`${type}: unchecked defaults, checked capture, editable baseline, history and persistence`, async ({ page }) => {
    await loadFixture(page);
    await select(page, type);
    const fixed = page.locator(type === "leader" ? '[data-leader-style="fixedDisplaySize"]' : '[data-annotation-display="modelRelativeSize"]');
    const scale = page.locator(type === "leader" ? '[data-leader-style="displayScale"]' : '[data-annotation-display="displayScale"]');
    if (type !== "leader") await expect(page.locator('label[for="annotationModelRelativeSize"]')).toHaveText(type === "dimension" ? "サイズロック" : "図形に対する注記の大きさを固定");
    if (type === "dimension") await expect(fixed.locator('..')).toHaveAttribute('title', '図形に対する注記の大きさを固定');
    if (type === "leader") await expect(fixed).toHaveValue("true"); else await expect(fixed).not.toBeChecked();
    await expect(scale).toHaveCount(0);
    const before = await state(page, type);
    if (type === "leader") await fixed.selectOption("false"); else await fixed.check();
    await expect(page.locator('label[for="annotationDisplayScale"]')).toHaveText("基準倍率");
    await expect(scale).toHaveValue(type === "leader" ? "150" : "150.0");
    const captured = await state(page, type);
    expect(captured.settings.displayScale).toBeCloseTo(1.5);
    expect(captured.height).toBeCloseTo(before.height);
    expect(captured.arrow).toBeCloseTo(before.arrow);
    await page.evaluate(scale => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, scale), PX * 3);
    const zoomed = await state(page, type);
    expect(zoomed.height).toBeCloseTo(before.height * 2);
    expect(zoomed.arrow).toBeCloseTo(before.arrow * 2);
    expect(zoomed.settings.displayScale).toBeCloseTo(1.5);
    if (type === "dimension") expect(zoomed.width).toBeCloseTo(before.width * 2);
    await scale.fill("300");
    await scale.press("Tab");
    expect((await state(page, type)).height).toBeCloseTo(before.height);
    await page.click("#undoBtn");
    expect((await state(page, type)).settings.displayScale).toBeCloseTo(1.5);
    await page.click("#redoBtn");
    expect((await state(page, type)).settings.displayScale).toBeCloseTo(3);
    const saved = (await state(page, type)).data;
    expect(saved.points).toEqual(before.data.points);
    expect(saved.lines).toEqual(before.data.lines);
    for (let i = 0; i < saved.constraints.length; i++) {
      const { display: ignoredBefore, ...dimensionBefore } = before.data.constraints[i].dimension || {};
      const { display: ignoredAfter, ...dimensionAfter } = saved.constraints[i].dimension || {};
      expect(dimensionAfter).toEqual(dimensionBefore);
      expect(saved.constraints[i].target).toEqual(before.data.constraints[i].target);
    }
    for (let i = 0; i < saved.annotations.length; i++) {
      const { style: ignoredBefore, appearanceInheritance: ignoredMarkerBefore, ...coordinatesBefore } = before.data.annotations[i];
      const { style: ignoredAfter, appearanceInheritance: ignoredMarkerAfter, ...coordinatesAfter } = saved.annotations[i];
      expect(coordinatesAfter).toEqual(coordinatesBefore);
    }
    expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "roundtrip.jot2d"), saved)).toEqual(expect.objectContaining({ success: true }));
    await select(page, type);
    if (type === "leader") await expect(fixed).toHaveValue("false"); else await expect(fixed).toBeChecked();
    await expect(scale).toHaveValue(type === "leader" ? "300" : "300.0");
    if (type === "leader") await fixed.selectOption("true"); else await fixed.uncheck();
    await expect(scale).toHaveCount(0);
    expect((await state(page, type)).settings).not.toHaveProperty("displayScale");
    await page.evaluate(scale => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, scale), PX * 0.5);
    expect((await state(page, type)).height).toBeCloseTo(before.height);
  });
}

test("status zoom follows wheel, fit, reload and canvas redraw in the same footer row", async ({ page }) => {
  await loadFixture(page);
  const status = page.locator("#statusZoom");
  await expect(status).toHaveText("150%");
  const canvas = page.locator("#canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => status.textContent()).not.toBe("150%");
  async function synced() {
    const zoom = await page.evaluate(() => window.__jot2dTest.displayZoomStateForTest());
    await expect(status).toHaveText(zoom.formatted);
  }
  await synced();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "middle", clickCount: 2 });
  await synced();
  await page.evaluate(() => window.__jot2dTest.fitAllGeometryForTest());
  await synced();
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "zoom-reload.jot2d"), saved);
  await synced();
  const zoomBox = await status.boundingBox();
  const coordinates = await page.locator("#statusCoordinates").boundingBox();
  expect(zoomBox.y).toBeCloseTo(coordinates.y);
});

test("enlarged model-relative dimension text remains selectable beyond its old hit radius", async ({ page }) => {
  await loadFixture(page);
  await select(page, "dimension");
  await page.locator('[data-annotation-display="modelRelativeSize"]').check();
  const scale = page.locator('[data-annotation-display="displayScale"]');
  await scale.fill("50");
  await scale.press("Tab");
  const label = await page.evaluate(() => window.__jot2dTest.dimensionClientPositionForTest(0));
  const box = await page.locator("#canvas").boundingBox();
  await page.mouse.click(box.x + 10, box.y + 10);
  await expect(page.locator('[data-annotation-display="displayScale"]')).toHaveCount(0);
  await page.mouse.click(label.x + 30, label.y - 30);
  await expect(page.locator('[data-annotation-display="displayScale"]')).toHaveValue("50.0");
});

test("reference zoom shows one decimal without rounding its captured baseline", async ({ page }) => {
  await loadFixture(page);
  await select(page, "text");
  await page.evaluate(scale => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, scale), PX * 1.234567);
  const before = await state(page, "text");
  await page.locator('[data-annotation-display="modelRelativeSize"]').check();
  await expect(page.locator('[data-annotation-display="displayScale"]')).toHaveValue("123.5");
  const after = await state(page, "text");
  expect(after.settings.displayScale).toBeCloseTo(1.234567, 10);
  expect(after.height).toBeCloseTo(before.height, 10);
});
