const { test, expect, openTestDocument } = require("./test-fixture");

test("zoom is visibly editable and the footer omits the constraint summary", async ({ page }) => {
  await openTestDocument(page);
  const button = page.locator("#statusZoom");
  const appearance = await button.evaluate(element => ({
    border: getComputedStyle(element).borderTopWidth,
  }));
  expect(parseFloat(appearance.border)).toBeGreaterThan(0);
  await expect(page.locator("#statusZoomLabel")).toHaveText("表示倍率:");
  await expect(page.locator("#statusConstraint")).toHaveCount(0);
  await page.locator("#constraintStatusViewBtn").click();
  await expect(page.locator("#statusConstraint")).toHaveCount(0);
  await expect(button).toBeVisible();
  await page.screenshot({ path: "test-results/zoom-status-bar.png", clip: await page.locator("#bottomBar").boundingBox() });
  await button.click();
  await expect(page.locator("#statusZoomInput")).toBeVisible();
});

test("custom zoom preserves the canvas center and document, including fractional and boundary values", async ({ page }) => {
  await openTestDocument(page);
  const center = { x: 37, y: -24 };
  await page.evaluate(center => window.__jot2dTest.focusWorldForTest(center, 96 / 25.4), center);
  const documentState = () => page.evaluate(() => {
    const { savedAt, ...model } = window.__jot2dTest.serializedModelForTest();
    return model;
  });
  const original = await documentState();
  const before = await page.evaluate(center => window.__jot2dTest.worldClientPositionForTest(center), center);
  for (const percent of [125.5, 0.1, 1000000000]) {
    await page.locator("#statusZoom").click();
    const input = page.locator("#statusZoomInput");
    await input.fill(String(percent));
    await input.press("Enter");
    await expect(input).toBeHidden();
    const zoom = await page.evaluate(() => window.__jot2dTest.displayZoomStateForTest());
    expect(zoom.zoomRatio).toBeCloseTo(percent / 100);
    const after = await page.evaluate(center => window.__jot2dTest.worldClientPositionForTest(center), center);
    // At the maximum zoom, floating point cancellation remains below 0.001 CSS px.
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  }
  expect(await documentState()).toEqual(original);
  await page.locator("#statusZoom").click();
  await expect(page.locator("#statusZoomInput")).toHaveValue("1000000000");
});

test("zoom editing rejects invalid values, keeps drafts during redraw, and cancels without changing zoom", async ({ page }) => {
  await openTestDocument(page);
  const zoom = () => page.evaluate(() => window.__jot2dTest.displayZoomStateForTest().zoomRatio);
  const original = await zoom();
  const button = page.locator("#statusZoom");
  const input = page.locator("#statusZoomInput");
  await button.click();
  for (const value of ["", "0", "-1", "1000000001"]) {
    await input.fill(value);
    await input.press("Enter");
    await expect(input).toBeVisible();
    expect(await zoom()).toBe(original);
  }
  await input.fill("125.5");
  await page.evaluate(() => window.__jot2dTest.fitAllGeometryForTest());
  await expect(input).toHaveValue("125.5");
  const afterRedraw = await zoom();
  await input.press("Escape");
  await expect(input).toBeHidden();
  expect(await zoom()).toBe(afterRedraw);
  await button.click();
  await input.fill("250");
  await page.locator("#canvas").click();
  await expect(input).toBeHidden();
  expect(await zoom()).toBe(afterRedraw);
});
