const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});

async function canvasImageDataUrl(page, mimeType, width, height) {
  return page.evaluate(({ type, pixelWidth, pixelHeight }) => {
    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ef4444";
    context.fillRect(0, 0, pixelWidth, pixelHeight);
    context.fillStyle = "#2563eb";
    context.fillRect(0, 0, Math.max(1, Math.floor(pixelWidth / 2)), pixelHeight);
    return canvas.toDataURL(type, 0.9);
  }, { type: mimeType, pixelWidth: width, pixelHeight: height });
}

async function importGeneratedImage(page, mimeType, width, height, name) {
  const dataUrl = await canvasImageDataUrl(page, mimeType, width, height);
  return page.evaluate(
    ({ url, fileName, type }) => window.__jot2dTest.importReferenceImageDataForTest(url, fileName, type),
    { url: dataUrl, fileName: name, type: mimeType },
  );
}

test("imports, fits, edits, calibrates, persists, and restores a reference image", async ({ page }) => {
  await expect(page.locator("#importReferenceImageBtn")).toHaveAttribute("title", "画像を読み込み");
  expect(await importGeneratedImage(page, "image/png", 400, 200, "trace.png")).toBe(true);

  let state = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  expect(state.images).toHaveLength(1);
  expect(state.selectedIds).toEqual(["IMG1"]);
  expect(state.images[0]).toEqual(expect.objectContaining({
    name: "trace",
    mimeType: "image/png",
    pixelWidth: 400,
    pixelHeight: 200,
    opacity: 0.5,
    visible: true,
    locked: false,
  }));
  const screenWidth = state.images[0].pixelWidth * state.images[0].scale * state.viewport.scale;
  expect(screenWidth).toBeGreaterThan(500);
  expect(screenWidth).toBeLessThan(900);

  await page.keyboard.press("Control+z");
  expect((await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest())).images).toHaveLength(0);
  await page.keyboard.press("Control+y");
  expect((await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest())).images).toHaveLength(1);

  await page.locator('.sketch-group-row[data-category="image"]').click();
  await page.locator('#sketchList [data-object-kind="image"]').click();
  await expect(page.locator('#propertiesPanel [data-reference-image-property="name"]')).toHaveValue("trace");

  const beforeMove = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  const centerClient = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x: beforeMove.images[0].x, y: beforeMove.images[0].y });
  await page.mouse.move(centerClient.x, centerClient.y);
  await page.mouse.down();
  await page.mouse.move(centerClient.x + 32, centerClient.y + 18);
  await page.mouse.up();
  const afterMove = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  expect(afterMove.dragging).toBe(false);
  expect(afterMove.images[0].x - beforeMove.images[0].x).toBeCloseTo(32 / beforeMove.viewport.scale, 4);
  expect(afterMove.images[0].y - beforeMove.images[0].y).toBeCloseTo(18 / beforeMove.viewport.scale, 4);

  await page.locator('#propertiesPanel [data-reference-image-property="width"]').fill("100");
  await page.locator('#propertiesPanel [data-reference-image-property="width"]').press("Tab");
  await page.locator('#propertiesPanel [data-reference-image-property="rotation"]').fill("30");
  await page.locator('#propertiesPanel [data-reference-image-property="rotation"]').press("Tab");
  await page.locator('#propertiesPanel [data-reference-image-property="opacity"]').fill("35");
  await page.locator('#propertiesPanel [data-reference-image-property="opacity"]').press("Tab");
  state = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  expect(state.images[0].pixelWidth * state.images[0].scale).toBeCloseTo(100, 8);
  expect(state.images[0].pixelHeight * state.images[0].scale).toBeCloseTo(50, 8);
  expect(state.images[0].rotation).toBeCloseTo(Math.PI / 6, 8);
  expect(state.images[0].opacity).toBeCloseTo(0.35, 8);

  await page.locator('#propertiesPanel [data-reference-image-property="rotation"]').fill("0");
  await page.locator('#propertiesPanel [data-reference-image-property="rotation"]').press("Tab");
  const image = (await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest())).images[0];
  const first = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x: image.x - 25, y: image.y });
  const second = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x: image.x + 25, y: image.y });
  expect(second.x - first.x).toBeCloseTo(50 * state.viewport.scale, 4);
  await page.locator('[data-property-action="reference-image-calibrate"]').click();
  await page.mouse.click(first.x, first.y);
  expect((await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest())).calibrationPointCount).toBe(1);
  page.once("dialog", (dialog) => dialog.accept("25"));
  await page.mouse.click(second.x, second.y);
  state = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  expect(state.calibrationPointCount).toBe(0);
  expect(state.images[0].pixelWidth * state.images[0].scale).toBeCloseTo(50, 6);

  await page.locator('#propertiesPanel [data-reference-image-property="locked"]').check();
  await expect(page.locator('#propertiesPanel [data-reference-image-property="width"]')).toBeDisabled();
  await expect(page.locator('[data-property-action="reference-image-calibrate"]')).toBeDisabled();
  const lockedBefore = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  const lockedCenter = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x: lockedBefore.images[0].x, y: lockedBefore.images[0].y });
  await page.mouse.move(lockedCenter.x, lockedCenter.y);
  await page.mouse.down();
  await page.mouse.move(lockedCenter.x + 40, lockedCenter.y + 20);
  await page.mouse.up();
  const lockedAfter = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  expect({ x: lockedAfter.images[0].x, y: lockedAfter.images[0].y }).toEqual({ x: lockedBefore.images[0].x, y: lockedBefore.images[0].y });
  await page.locator('#propertiesPanel [data-reference-image-property="visible"]').uncheck();
  state = await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest());
  expect(state.images[0]).toEqual(expect.objectContaining({ locked: true, visible: false }));

  const serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.version).toBe(18);
  expect(serialized.referenceImages[0].dataUrl).toMatch(/^data:image\/png;base64,/);
  const loaded = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "reference-image.jot2d"), serialized);
  expect(loaded.success).toBe(true);
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).referenceImages).toEqual(serialized.referenceImages);
});

test("supports JPEG and WebP, downsizes large images, migrates version 17, and stores Block Editor images", async ({ page }) => {
  expect(await importGeneratedImage(page, "image/jpeg", 60, 30, "photo.jpg")).toBe(true);
  expect(await importGeneratedImage(page, "image/webp", 80, 40, "photo.webp")).toBe(true);
  expect(await importGeneratedImage(page, "image/png", 3201, 10, "large.png")).toBe(true);

  let serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.referenceImages.map((item) => item.mimeType)).toEqual(["image/jpeg", "image/webp", "image/png"]);
  expect(serialized.referenceImages[2].pixelWidth).toBe(3000);
  expect(serialized.referenceImages[2].pixelHeight).toBe(9);

  await page.evaluate(() => window.__jot2dTest.openReferenceImageBlockEditorForTest({ preserveDocument: true }));
  expect(await importGeneratedImage(page, "image/png", 120, 60, "block-trace.png")).toBe(true);
  expect((await page.evaluate(() => window.__jot2dTest.referenceImageStateForTest())).liveBlockImages).toHaveLength(1);
  const completed = await page.evaluate(() => window.__jot2dTest.completeReferenceImageBlockEditorForTest());
  expect(completed.referenceImages).toHaveLength(3);
  expect(completed.blockDefinitions).toHaveLength(1);
  expect(completed.blockDefinitions[0].referenceImages).toHaveLength(1);
  expect(completed.blockDefinitions[0].referenceImages[0]).toEqual(expect.objectContaining({ name: "block-trace", pixelWidth: 120, pixelHeight: 60 }));

  const legacy = structuredClone(serialized);
  legacy.version = 17;
  delete legacy.referenceImages;
  for (const definition of legacy.blockDefinitions) delete definition.referenceImages;
  const migrated = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "legacy-v17.jot2d"), legacy);
  expect(migrated.success).toBe(true);
  serialized = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(serialized.version).toBe(18);
  expect(serialized.referenceImages).toEqual([]);
});
