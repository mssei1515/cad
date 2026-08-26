const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__cadTest));
});

test("creates associative hatching, exposes Tree and Properties, and persists version 13", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__cadTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await expect(page.locator("#statusCommand")).toHaveText("ハッチング");
  await page.mouse.move(fixture.client.x, fixture.client.y);
  await expect.poll(() => page.evaluate(() => window.__cadTest.hatchStateForTest().preview)).toEqual({ ok: true, code: null });
  await page.mouse.click(fixture.client.x, fixture.client.y);

  let state = await page.evaluate(() => window.__cadTest.hatchStateForTest());
  expect(state.mode).toBe("hatch");
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));
  expect(state.direct[0].appearance).toEqual({ visible: true, patternType: "parallel", angle: 45, spacing: 3, color: "#64748b", lineWidth: 1 });
  expect(state.serialized.version).toBe(13);
  expect(state.serialized.hatches).toHaveLength(1);
  expect(state.propertiesText).toContain("ハッチング");
  expect(state.propertiesText).toContain("境界状態");

  await page.keyboard.press("Escape");
  await page.mouse.click(fixture.boundaryClient.x, fixture.boundaryClient.y);
  expect(await page.evaluate(() => window.__cadTest.selectedGeometryIdsForTest())).toEqual(expect.objectContaining({ lines: ["L1"] }));
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).selectedIds).toEqual([]);
  await page.keyboard.press("Control+z");
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).direct).toHaveLength(0);
  await page.keyboard.press("Control+y");
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));
  await page.locator('.sketch-group-row[data-category="hatch"]').click();
  const row = page.locator('#sketchList [data-object-kind="hatch"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("H1");
  expect(await row.locator("svg path").count()).toBeGreaterThan(0);
  await row.click();
  await page.mouse.click(fixture.client.x, fixture.client.y, { button: "right" });
  await expect(page.locator('#canvasContextMenu [data-context-action="hatch-repair"]')).toBeVisible();
  await page.keyboard.press("Escape");

  const color = page.locator('#propertiesPanel [data-hatch-property="color"]');
  await color.fill("#0f766e");
  await color.press("Tab");
  state = await page.evaluate(() => window.__cadTest.hatchStateForTest());
  expect(state.direct[0].appearance.color).toBe("#0f766e");

  const spacingAtOne = await page.evaluate(() => window.__cadTest.setViewportScaleForHatchTest(1));
  const spacingAtTwo = await page.evaluate(() => window.__cadTest.setViewportScaleForHatchTest(2));
  expect(spacingAtOne / spacingAtTwo).toBeCloseTo(2, 8);

  const serialized = state.serialized;
  expect(await page.evaluate((data) => window.__cadTest.loadDocumentFixtureForDragTest(data, "hatch-v13.json"), serialized)).toEqual(expect.objectContaining({ success: true }));
  state = await page.evaluate(() => window.__cadTest.hatchStateForTest());
  expect(state.direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));

  const invalid = structuredClone(state.serialized);
  invalid.hatches[0].sketchId = "S0";
  expect(await page.evaluate((data) => window.__cadTest.loadDocumentFixtureForDragTest(data, "invalid-hatch-v13.json"), invalid)).toEqual(expect.objectContaining({ success: false }));
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).direct[0].id).toBe("H1");

  const legacy = structuredClone(state.serialized);
  legacy.version = 12;
  delete legacy.hatches;
  delete legacy.nextHatchIndex;
  for (const definition of legacy.blockDefinitions) {
    delete definition.hatches;
    delete definition.nextHatchIndex;
  }
  expect(await page.evaluate((data) => window.__cadTest.loadDocumentFixtureForDragTest(data, "legacy-v12.json"), legacy)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).direct).toHaveLength(0);
});

test("invalid boundaries remain as repairable hatch objects", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__cadTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__cadTest.breakFirstHatchBoundaryForTest());

  let state = await page.evaluate(() => window.__cadTest.hatchStateForTest());
  expect(state.direct[0].valid).toBe(false);
  expect(state.propertiesText).toContain("無効");
  await expect(page.locator('[data-property-action="hatch-repair"]')).toBeVisible();

  const replacement = await page.evaluate(() => window.__cadTest.restoreClosedBoundaryForHatchTest());
  await page.locator('[data-property-action="hatch-repair"]').click();
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).mode).toBe("hatch-repair");
  await page.mouse.click(replacement.client.x, replacement.client.y);
  state = await page.evaluate(() => window.__cadTest.hatchStateForTest());
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));
  expect(state.mode).toBe("select");
});

test("projects nested block hatching with transform, override, hit testing, and persistence", async ({ page }) => {
  const state = await page.evaluate(() => window.__cadTest.resetForProjectedHatchTest());
  expect(state.projected).toEqual(expect.objectContaining({ id: "BI1/BI_INNER/H1", color: "#db2777", lineWidth: 3, valid: true }));
  expect(state.projected.angle).toBeCloseTo(165, 8);
  expect(state.ownerAtSeed).toBe("BI1");
  expect(state.serialized.blockDefinitions.flatMap((definition) => definition.hatches)).toHaveLength(1);

  await page.mouse.click(state.client.x, state.client.y);
  await expect.poll(() => page.evaluate(() => window.__cadTest.hatchStateForTest().selectedIds)).toEqual([]);
  await expect(page.locator("#propertiesPanel")).toContainText("ブロック");

  expect(await page.evaluate((data) => window.__cadTest.loadDocumentFixtureForDragTest(data, "nested-block-hatch-v13.json"), state.serialized)).toEqual(expect.objectContaining({ success: true }));
  const roundTrip = await page.evaluate(() => window.__cadTest.projectedHatchStateForTest());
  expect(roundTrip).toEqual(expect.objectContaining({ id: "BI1/BI_INNER/H1", color: "#db2777", valid: true }));
});

test("requires complete boundaries for copy and block creation and rewrites references", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__cadTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Escape");
  const state = await page.evaluate(() => window.__cadTest.exerciseHatchTransferForTest());
  expect(state.missingCopyAccepted).toBe(false);
  expect(state.pasteAccepted).toBe(true);
  expect(state.pasted).toEqual(expect.objectContaining({ id: "H2", valid: true }));
  expect(state.pasted.refs).toEqual(["L5", "L6", "L7", "L8"]);
  expect(state.missingBlockError).toContain("境界");
  expect(state.block).toEqual(expect.objectContaining({ id: "H1", valid: true }));
});
