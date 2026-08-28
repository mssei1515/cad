const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__cadTest));
});

async function canvasInkAround(page, client, radius = 50) {
  return page.evaluate(({ clientPoint, cropRadius }) => {
    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = Math.max(0, Math.floor((clientPoint.x - rect.left - cropRadius) * dpr));
    const y = Math.max(0, Math.floor((clientPoint.y - rect.top - cropRadius) * dpr));
    const width = Math.min(canvas.width - x, Math.ceil(cropRadius * 2 * dpr));
    const height = Math.min(canvas.height - y, Math.ceil(cropRadius * 2 * dpr));
    const pixels = canvas.getContext("2d").getImageData(x, y, width, height).data;
    let ink = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) ink++;
    const centerX = Math.floor((clientPoint.x - rect.left) * dpr);
    const centerY = Math.floor((clientPoint.y - rect.top) * dpr);
    const center = [...canvas.getContext("2d").getImageData(centerX, centerY, 1, 1).data];
    return { ink, center };
  }, { clientPoint: client, cropRadius: radius });
}

test("creates associative hatching, exposes Tree and Properties, and persists version 15", async ({ page }) => {
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
  expect(state.serialized.version).toBe(15);
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

test("supports parallel, cross, and solid fill appearances", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__cadTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Escape");

  const type = page.locator('#propertiesPanel [data-hatch-property="patternType"]');
  await expect(type).toHaveValue("parallel");
  await page.locator('#propertiesPanel [data-hatch-property="angle"]').fill("0");
  await page.locator('#propertiesPanel [data-hatch-property="angle"]').press("Tab");
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width - 8, canvas.y + canvas.height - 8);
  const parallel = await canvasInkAround(page, fixture.client);

  await page.mouse.click(fixture.client.x, fixture.client.y);
  await type.selectOption("cross");
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).direct[0].appearance.patternType).toBe("cross");
  await expect(page.locator('#propertiesPanel [data-hatch-property="angle"]')).toBeVisible();
  await expect(page.locator('#propertiesPanel [data-hatch-property="spacing"]')).toBeVisible();
  await page.locator('.sketch-group-row[data-category="hatch"]').click();
  await expect(page.locator('#sketchList [data-object-kind="hatch"]')).toContainText("クロス");
  await page.mouse.click(canvas.x + canvas.width - 8, canvas.y + canvas.height - 8);
  const cross = await canvasInkAround(page, fixture.client);
  expect(cross.ink).toBeGreaterThan(parallel.ink * 1.5);

  await page.mouse.click(fixture.client.x, fixture.client.y);
  await type.selectOption("solid");
  const color = page.locator('#propertiesPanel [data-hatch-property="color"]');
  await color.fill("#0f766e");
  await color.press("Tab");
  await expect(page.locator('#propertiesPanel [data-hatch-property="angle"]')).toHaveCount(0);
  await expect(page.locator('#propertiesPanel [data-hatch-property="spacing"]')).toHaveCount(0);
  await expect(page.locator('#propertiesPanel [data-hatch-property="lineWidth"]')).toHaveCount(0);
  await expect(page.locator('#sketchList [data-object-kind="hatch"]')).toContainText("塗りつぶし");
  await page.mouse.click(canvas.x + canvas.width - 8, canvas.y + canvas.height - 8);
  const solid = await canvasInkAround(page, fixture.client);
  expect(solid.ink).toBeGreaterThan(cross.ink * 3);
  expect(solid.center).toEqual([15, 118, 110, 255]);

  const state = await page.evaluate(() => window.__cadTest.hatchStateForTest());
  expect(state.direct[0].appearance).toEqual(expect.objectContaining({ patternType: "solid", color: "#0f766e" }));
  expect(await page.evaluate((data) => window.__cadTest.loadDocumentFixtureForDragTest(data, "solid-hatch-v13.json"), state.serialized)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).direct[0].appearance.patternType).toBe("solid");

  const invalid = structuredClone(state.serialized);
  invalid.hatches[0].appearance.patternType = "diagonal";
  expect(await page.evaluate((data) => window.__cadTest.loadDocumentFixtureForDragTest(data, "invalid-pattern-v13.json"), invalid)).toEqual(expect.objectContaining({ success: false }));
  expect((await page.evaluate(() => window.__cadTest.hatchStateForTest())).direct[0].appearance.patternType).toBe("solid");
});

test("solid fill keeps inner boundary loops transparent", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__cadTest.resetForSolidHatchHoleTest());
  const fill = await canvasInkAround(page, fixture.fillClient, 2);
  const hole = await canvasInkAround(page, fixture.holeClient, 2);
  expect(fill.center).toEqual([15, 118, 110, 255]);
  expect(hole.center).toEqual([0, 0, 0, 0]);
});

test("projects nested block hatching with transform, override, hit testing, and persistence", async ({ page }) => {
  const state = await page.evaluate(() => window.__cadTest.resetForProjectedHatchTest());
  expect(state.projected).toEqual(expect.objectContaining({ id: "BI1/BI_INNER/H1", patternType: "cross", color: "#db2777", lineWidth: 3, valid: true }));
  expect(state.projected.angle).toBeCloseTo(165, 8);
  expect(state.ownerAtSeed).toBe("BI1");
  expect(state.serialized.blockDefinitions.flatMap((definition) => definition.hatches)).toHaveLength(1);

  await page.mouse.click(state.client.x, state.client.y);
  await expect.poll(() => page.evaluate(() => window.__cadTest.hatchStateForTest().selectedIds)).toEqual([]);
  await expect(page.locator("#propertiesPanel")).toContainText("ブロック");

  expect(await page.evaluate((data) => window.__cadTest.loadDocumentFixtureForDragTest(data, "nested-block-hatch-v13.json"), state.serialized)).toEqual(expect.objectContaining({ success: true }));
  const roundTrip = await page.evaluate(() => window.__cadTest.projectedHatchStateForTest());
  expect(roundTrip).toEqual(expect.objectContaining({ id: "BI1/BI_INNER/H1", patternType: "cross", color: "#db2777", valid: true }));
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
