const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});

for (const type of ['pattern', 'free', 'sketchProjection']) {
  test(`hatch alone is a ${type} source with region and save/reload support`, async ({ page }) => {
    const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
    await page.click('#toolHatch'); await page.mouse.click(fixture.client.x, fixture.client.y);
    await page.locator('#commandPanel [data-action="finish"]').click(); await page.keyboard.press('Escape');
    if (type === 'sketchProjection') {
      await page.evaluate(() => {
        const saved = window.__jot2dTest.hatchStateForTest().serialized;
        saved.sketches.push({ ...saved.sketches.find(sketch => sketch.id === 'S1'), id: 'S2', name: 'Child', parentSketchId: 'S1' });
        saved.activeSketchId = 'S2'; window.__jot2dTest.loadModelForDerivedInstanceTest(saved);
      });
      await page.click('#toolSketchProjection');
      const source = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 60, y: 40 }));
      await page.mouse.click(source.x, source.y);
    } else {
      await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ hatches: ['H1'] }));
      await page.click(type === 'pattern' ? '#toolPattern' : '#toolFreeInstance');
      if (type === 'pattern') await page.mouse.click(fixture.boundaryClient.x, fixture.boundaryClient.y);
      else {
        await page.mouse.click(fixture.client.x, fixture.client.y);
        await page.locator('#commandPanel [role="listbox"][data-input="destination"]').click();
        const destination = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 80, y: 40 }));
        await page.mouse.click(destination.x, destination.y);
      }
    }
    await page.locator('#commandPanel [data-action="finish"]').click();
    let state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
    expect(state.serialized.geometryInstances[0].sources).toEqual([{ kind: 'hatch', path: ['H1'] }]);
    expect(state.projected).toHaveLength(type === 'pattern' ? 2 : 1);
    expect(state.projected.every(hatch => hatch.valid && Math.abs(hatch.area - 9600) < 0.001)).toBe(true);
    await page.evaluate(data => window.__jot2dTest.loadModelForDerivedInstanceTest(data), state.serialized);
    state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
    expect(state.projected.every(hatch => hatch.valid)).toBe(true);
  });
}

test('construction boundary toggle enables regions and survives finish, undo and reload', async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest({ constructionBoundary: true }));
  await page.click('#toolHatch');
  const setting = page.locator('#commandPanel [data-setting="includeConstruction"]');
  await expect(setting).not.toBeChecked();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await expect(page.locator('#commandPanel [data-action="finish"]')).toBeDisabled();
  await setting.check();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.locator('#commandPanel [data-action="finish"]').click();
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0].valid).toBe(true);
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+z');
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct).toHaveLength(0);
  await page.keyboard.press('Control+y');
  const saved = await page.evaluate(() => window.__jot2dTest.hatchStateForTest().serialized);
  await page.evaluate(data => window.__jot2dTest.loadModelForDerivedInstanceTest(data), saved);
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0].valid).toBe(true);
});

test('hatch alone is a mirror source with persisted references and protected source deletion', async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.click('#toolHatch'); await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.locator('#commandPanel [data-action="finish"]').click(); await page.keyboard.press('Escape');
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ hatches: ['H1'] }));
  await page.click('#toolMirror');
  await expect(page.locator('#commandPanel')).toContainText('複写元: 1');
  await page.mouse.click(fixture.boundaryClient.x, fixture.boundaryClient.y);
  await page.locator('#commandPanel [data-action="finish"]').click();
  let state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.serialized.geometryInstances[0].sources).toEqual([{ kind: 'hatch', path: ['H1'] }]);
  expect(state.projected).toHaveLength(1); expect(state.projected[0]).toMatchObject({ valid: true, seed: { x: 60, y: -40 } });
  expect(state.projected[0].area).toBeCloseTo(9600, 3);
  await page.evaluate(data => window.__jot2dTest.loadModelForDerivedInstanceTest(data), state.serialized);
  state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.projected[0].valid).toBe(true);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ hatches: ['H1'] }));
  await page.keyboard.press('Delete');
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct).toHaveLength(1);
  await expect(page.locator('#hint')).toContainText('派生インスタンス');
});

async function expandSketchTreeGroup(page, category, sketchId = "S1") {
  const sketch = page.locator(`.sketch-item[data-id="${sketchId}"]`);
  if ((await sketch.getAttribute("aria-expanded")) !== "true") await sketch.locator(".sketchExpandBtn").click();
  const group = page.locator(`.sketch-group-row[data-sketch-id="${sketchId}"][data-category="${category}"]`);
  if ((await group.getAttribute("aria-expanded")) !== "true") await group.click();
  return group;
}

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

test("creates associative hatching, exposes Tree and Properties, and persists the current version", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await expect(page.locator("#statusCommand")).toHaveText("塗りつぶし");
  await page.mouse.move(fixture.client.x, fixture.client.y);
  await expect.poll(() => page.evaluate(() => window.__jot2dTest.hatchStateForTest().preview)).toEqual({ ok: true, code: null });
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Enter");

  let state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.mode).toBe("hatch");
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));
  expect(state.direct[0].appearance).toEqual({ visible: true, patternType: "solid", angle: 45, spacing: 3, color: "#64748b", lineWidth: 1, opacity: 0.5 });
  await expect(page.locator('#propertiesPanel [data-hatch-property="patternType"]')).toHaveValue("solid");
  await expect(page.locator('#propertiesPanel [data-hatch-property="opacity"]')).toHaveValue("50");
  expect(state.serialized.version).toBe(25);
  expect(state.serialized.hatches).toHaveLength(1);
  expect(state.propertiesText).toContain("塗りつぶし");
  expect(state.propertiesText).toContain("境界状態");

  await page.keyboard.press("Escape");
  await page.mouse.click(fixture.boundaryClient.x, fixture.boundaryClient.y);
  expect(await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).toEqual(expect.objectContaining({ lines: ["L1"] }));
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).selectedIds).toEqual([]);
  await page.keyboard.press("Control+z");
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct).toHaveLength(0);
  await page.keyboard.press("Control+y");
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));
  await expandSketchTreeGroup(page, "hatch");
  const row = page.locator('#sketchList [data-object-kind="hatch"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("H1");
  expect(await row.locator("svg path").count()).toBeGreaterThan(0);
  await row.click();
  await expect(page.locator("#propertiesPanel .property-section > h3")).toHaveText(["基本情報", "塗りつぶし外観"]);
  await page.mouse.click(fixture.client.x, fixture.client.y, { button: "right" });
  await expect(page.locator('#canvasContextMenu [data-context-action="hatch-repair"]')).toBeVisible();
  await page.keyboard.press("Escape");

  const color = page.locator('#propertiesPanel [data-hatch-property="color"]');
  await color.fill("#0f766e");
  await color.press("Tab");
  state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct[0].appearance.color).toBe("#0f766e");

  const spacingAtOne = await page.evaluate(() => window.__jot2dTest.setViewportScaleForHatchTest(1));
  const spacingAtTwo = await page.evaluate(() => window.__jot2dTest.setViewportScaleForHatchTest(2));
  expect(spacingAtOne / spacingAtTwo).toBeCloseTo(2, 8);

  const serialized = state.serialized;
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "hatch-v13.json"), serialized)).toEqual(expect.objectContaining({ success: true }));
  state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));

  const invalid = structuredClone(state.serialized);
  invalid.hatches[0].sketchId = "S0";
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "invalid-hatch-v13.json"), invalid)).toEqual(expect.objectContaining({ success: false }));
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0].id).toBe("H1");

  const legacy = structuredClone(state.serialized);
  legacy.version = 12;
  delete legacy.hatches;
  delete legacy.nextHatchIndex;
  for (const definition of legacy.blockDefinitions) {
    delete definition.hatches;
    delete definition.nextHatchIndex;
  }
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "legacy-v12.json"), legacy)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct).toHaveLength(0);
});

test("hatches an annular sector whose circular boundaries are split into adjacent arcs", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  const center = { x: 60, y: 40 };
  const innerRadius = 20;
  const outerRadius = 30;
  const startAngle = 0.25;
  const joinAngle = 0.8;
  const endAngle = 1.35;
  const radialPoint = (radius, angle) => ({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  const innerStart = radialPoint(innerRadius, startAngle);
  const outerStart = radialPoint(outerRadius, startAngle);
  const innerEnd = radialPoint(innerRadius, endAngle);
  const outerEnd = radialPoint(outerRadius, endAngle);
  fixture.serialized.points = [
    { id: "P1", ...center, fixed: false, kind: "center", sketchId: "S1", appearance: {} },
    { id: "P2", ...innerStart, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    { id: "P3", ...outerStart, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    { id: "P4", ...innerEnd, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    { id: "P5", ...outerEnd, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
  ];
  fixture.serialized.lines = [
    { id: "L1", p1: "P2", p2: "P3", construction: false, sketchId: "S1", appearance: {} },
    { id: "L2", p1: "P4", p2: "P5", construction: false, sketchId: "S1", appearance: {} },
  ];
  fixture.serialized.circles = [];
  fixture.serialized.arcs = [
    { id: "A1", center: "P1", radius: innerRadius, startAngle, endAngle: joinAngle, construction: false, sketchId: "S1", appearance: {} },
    { id: "A2", center: "P1", radius: innerRadius, startAngle: joinAngle, endAngle, construction: false, sketchId: "S1", appearance: {} },
    { id: "A3", center: "P1", radius: outerRadius, startAngle, endAngle: joinAngle, construction: false, sketchId: "S1", appearance: {} },
    { id: "A4", center: "P1", radius: outerRadius, startAngle: joinAngle, endAngle, construction: false, sketchId: "S1", appearance: {} },
  ];
  fixture.serialized.splines = [];
  fixture.serialized.constraints = [];
  fixture.serialized.hatches = [];
  fixture.serialized.nextHatchIndex = 1;

  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "split-arc-sector.jot2d"), fixture.serialized)).toEqual(expect.objectContaining({ success: true }));
  const seed = radialPoint((innerRadius + outerRadius) / 2, joinAngle);
  const client = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), seed);
  await page.locator("#toolHatch").click();
  await page.mouse.move(client.x, client.y);
  await expect.poll(() => page.evaluate(() => window.__jot2dTest.hatchStateForTest().preview)).toEqual({ ok: true, code: null });
  await page.mouse.click(client.x, client.y);
  await page.keyboard.press("Enter");

  const state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));
  expect(new Set(state.direct[0].boundaryLoops[0].spans.map((span) => span.source.path[0]))).toEqual(new Set(["L1", "L2", "A1", "A2", "A3", "A4"]));
});

test("valid fill regions can be reselected from Properties and the context menu", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  const data = fixture.serialized;
  data.points.push(
    { ...data.points[0], id: "P5", x: 60, y: 0 },
    { ...data.points[0], id: "P6", x: 60, y: 80 },
  );
  data.lines.push({ ...data.lines[0], id: "L5", p1: "P5", p2: "P6" });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "fill-regions.jot2d"), data)).success).toBe(true);
  const left = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 30, y: 40 }));
  const right = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 90, y: 40 }));
  await expect(page.locator('#toolHatch')).toHaveAttribute("title", "塗りつぶし");
  await expect(page.locator('[data-menu-tool="toolHatch"]')).toHaveText("塗りつぶし");
  await page.locator("#toolHatch").click();
  await page.mouse.click(left.x, left.y);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  const before = (await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).serialized.hatches[0];
  const reselect = page.locator('[data-property-action="hatch-repair"]');
  await expect(reselect).toBeVisible();
  await reselect.click();
  await page.mouse.move(right.x, right.y);
  await page.keyboard.press("Escape");
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).serialized.hatches[0]).toEqual(before);

  await page.mouse.click(left.x, left.y);
  await reselect.click();
  await page.mouse.click(right.x, right.y);
  await page.keyboard.press("Enter");
  let state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.mode).toBe("select");
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0].valid).toBe(true);
  const after = state.serialized.hatches[0];
  expect(after).toEqual({ ...before, seed: after.seed, boundaryLoops: after.boundaryLoops });
  expect(after.seed.x).toBeCloseTo(90, 6);
  expect(after.boundaryLoops).not.toEqual(before.boundaryLoops);
  await page.keyboard.press("Control+z");
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).serialized.hatches[0]).toEqual(before);
  await page.keyboard.press("Control+y");
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).serialized.hatches[0]).toEqual(after);

  await page.mouse.click(right.x, right.y, { button: "right" });
  await page.locator('#canvasContextMenu [data-context-action="hatch-repair"]').click();
  await page.mouse.click(left.x, left.y);
  await page.keyboard.press("Enter");
  state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.serialized.hatches[0]).toEqual(before);
});

test("invalid boundaries remain as repairable hatch objects", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await page.keyboard.press("Delete");
  await expandSketchTreeGroup(page, "hatch");
  await page.locator('#sketchList [data-object-kind="hatch"]').click();

  let state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct[0].valid).toBe(false);
  expect(state.propertiesText).toContain("無効");
  await expect(page.locator('[data-property-action="hatch-repair"]')).toBeVisible();

  await test.step("LOAD-04: a missing boundary survives save and reload", async () => {
    const savedHatches = state.serialized.hatches;
    const result = await page.evaluate((data) =>
      window.__jot2dTest.loadDocumentFixtureForDragTest(data, "missing-hatch-boundary.jot2d"), state.serialized);
    expect(result.success).toBe(true);
    state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
    expect(state.serialized.hatches).toEqual(savedHatches);
    expect(state.direct).toHaveLength(1);
    expect(state.direct[0].valid).toBe(false);
    await expandSketchTreeGroup(page, "hatch");
    await page.locator('#sketchList [data-object-kind="hatch"]').click();
    await expect(page.locator('[data-property-action="hatch-repair"]')).toBeVisible();
  });

  const replacement = await page.evaluate(() => window.__jot2dTest.restoreClosedBoundaryForHatchTest());
  await page.locator('[data-property-action="hatch-repair"]').click();
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).mode).toBe("hatch-repair");
  await page.mouse.click(replacement.client.x, replacement.client.y);
  await page.keyboard.press("Enter");
  state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct).toHaveLength(1);
  expect(state.direct[0]).toEqual(expect.objectContaining({ id: "H1", valid: true }));
  expect(state.mode).toBe("select");
});

test("supports parallel, cross, and solid fill appearances", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");

  const type = page.locator('#propertiesPanel [data-hatch-property="patternType"]');
  await expect(type).toHaveValue("solid");
  await type.selectOption("parallel");
  await page.locator('#propertiesPanel [data-hatch-property="angle"]').fill("0");
  await page.locator('#propertiesPanel [data-hatch-property="angle"]').press("Tab");
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width - 8, canvas.y + canvas.height - 8);
  const parallel = await canvasInkAround(page, fixture.client);

  await page.mouse.click(fixture.client.x, fixture.client.y);
  await type.selectOption("cross");
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0].appearance.patternType).toBe("cross");
  await expect(page.locator('#propertiesPanel [data-hatch-property="angle"]')).toBeVisible();
  await expect(page.locator('#propertiesPanel [data-hatch-property="spacing"]')).toBeVisible();
  await expandSketchTreeGroup(page, "hatch");
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
  await expect(page.locator('#propertiesPanel [data-hatch-property="opacity"]')).toBeVisible();
  await page.locator('#propertiesPanel [data-hatch-property="opacity"]').fill("40");
  await page.locator('#propertiesPanel [data-hatch-property="opacity"]').press("Tab");
  await expect(page.locator('#sketchList [data-object-kind="hatch"]')).toContainText("塗りつぶし");
  await page.mouse.click(canvas.x + canvas.width - 8, canvas.y + canvas.height - 8);
  const solid = await canvasInkAround(page, fixture.client);
  expect(solid.ink).toBeGreaterThan(cross.ink * 3);
  expect(solid.center[0]).toBeGreaterThanOrEqual(14);
  expect(solid.center[0]).toBeLessThanOrEqual(16);
  expect(solid.center[1]).toBeGreaterThanOrEqual(117);
  expect(solid.center[1]).toBeLessThanOrEqual(119);
  expect(solid.center[2]).toBeGreaterThanOrEqual(109);
  expect(solid.center[2]).toBeLessThanOrEqual(111);
  expect(solid.center[3]).toBe(102);

  const state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct[0].appearance).toEqual(expect.objectContaining({ patternType: "solid", color: "#0f766e", opacity: 0.4 }));
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "solid-hatch-v13.json"), state.serialized)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0].appearance.patternType).toBe("solid");

  const invalid = structuredClone(state.serialized);
  invalid.hatches[0].appearance.patternType = "diagonal";
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "invalid-pattern-v13.json"), invalid)).toEqual(expect.objectContaining({ success: false }));
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0].appearance.patternType).toBe("solid");

  const legacyOpacity = structuredClone(state.serialized);
  delete legacyOpacity.hatches[0].appearance.opacity;
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "legacy-opacity-v17.jot2d"), legacyOpacity)).toEqual(expect.objectContaining({ success: true }));
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct[0].appearance.opacity).toBe(1);

  const invalidOpacity = structuredClone(state.serialized);
  invalidOpacity.hatches[0].appearance.opacity = 1.2;
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "invalid-opacity-v17.jot2d"), invalidOpacity)).toEqual(expect.objectContaining({ success: false }));
});

test("solid fill keeps inner boundary loops transparent", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSolidHatchHoleTest());
  const fill = await canvasInkAround(page, fixture.fillClient, 2);
  const hole = await canvasInkAround(page, fixture.holeClient, 2);
  expect(fill.center).toEqual([16, 118, 110, 128]);
  expect(hole.center).toEqual([0, 0, 0, 0]);
});

test("projects nested block hatching with transform, override, hit testing, and persistence", async ({ page }) => {
  const state = await page.evaluate(() => window.__jot2dTest.resetForProjectedHatchTest());
  expect(state.projected).toEqual(expect.objectContaining({ id: "BI1/BI_INNER/H1", patternType: "cross", color: "#db2777", lineWidth: 3, valid: true }));
  expect(state.projected.angle).toBeCloseTo(165, 8);
  expect(state.ownerAtSeed).toBe("BI1");
  expect(state.serialized.blockDefinitions.flatMap((definition) => definition.hatches)).toHaveLength(1);

  await page.mouse.click(state.client.x, state.client.y);
  await expect.poll(() => page.evaluate(() => window.__jot2dTest.hatchStateForTest().selectedIds)).toEqual([]);
  await expect(page.locator("#propertiesPanel")).toContainText("ブロック");

  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "nested-block-hatch-v13.json"), state.serialized)).toEqual(expect.objectContaining({ success: true }));
  const roundTrip = await page.evaluate(() => window.__jot2dTest.projectedHatchStateForTest());
  expect(roundTrip).toEqual(expect.objectContaining({ id: "BI1/BI_INNER/H1", patternType: "cross", color: "#db2777", valid: true }));
});

test("requires complete boundaries for copy and block creation and rewrites references", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.locator("#toolHatch").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  const state = await page.evaluate(() => window.__jot2dTest.exerciseHatchTransferForTest());
  expect(state.missingCopyAccepted).toBe(false);
  expect(state.pasteAccepted).toBe(true);
  expect(state.pasted).toEqual(expect.objectContaining({ id: "H2", valid: true }));
  expect(state.pasted.refs).toEqual(["L5", "L6", "L7", "L8"]);
  expect(state.missingBlockError).toContain("境界");
  expect(state.block).toEqual(expect.objectContaining({ id: "H1", valid: true }));
});


test("region palette toggles and removes faces, commits once and repairs multiple regions atomically", async ({ page }) => {
  const { serialized } = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  serialized.points.push({ ...serialized.points[0], id: "P5", x: 60, y: 0 }, { ...serialized.points[0], id: "P6", x: 60, y: 80 });
  serialized.lines.push({ ...serialized.lines[0], id: "L5", p1: "P5", p2: "P6" });
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), serialized)).success).toBe(true);
  const left = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 30, y: 60 }));
  const right = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 90, y: 60 }));
  const palette = page.locator('#commandPanel');
  const rows = palette.locator('[role="option"]');
  const finish = palette.locator('[data-action="finish"]');
  await page.locator('#toolHatch').click();
  await expect(palette).toBeVisible(); await expect(finish).toBeDisabled();
  await page.mouse.click(left.x, left.y); await page.mouse.click(right.x, right.y);
  await expect(rows).toHaveCount(2); await expect(palette).toContainText('合計面積: 9600 mm²');
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct).toHaveLength(0);
  await page.mouse.click(left.x, left.y); await expect(rows).toHaveCount(1);
  await page.mouse.click(left.x, left.y); await expect(rows).toHaveCount(2);
  await rows.first().click(); await expect(rows.first()).toHaveAttribute('aria-selected', 'true');
  await rows.first().press('Delete'); await expect(rows).toHaveCount(1);
  await page.mouse.click(right.x, right.y); await expect(rows).toHaveCount(2);
  await finish.click();
  let state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct).toHaveLength(1); expect(state.direct[0].boundaryLoops.map(loop => loop.role)).toEqual(['outer', 'outer']);
  await expect(rows).toHaveCount(0); await expect(finish).toBeDisabled();
  await expect(page.locator('#propertiesPanel')).toContainText('面積9600 mm²');
  await page.keyboard.press('Escape');
  expect((await canvasInkAround(page, left, 1)).center[3]).toBeGreaterThan(0);
  expect((await canvasInkAround(page, right, 1)).center[3]).toBeGreaterThan(0);
  await page.mouse.click(right.x, right.y);
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).selectedIds).toEqual(['H1']);
  await page.keyboard.press('Control+z'); expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct).toHaveLength(0);
  await page.keyboard.press('Control+y'); expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).direct).toHaveLength(1);
  const saved = (await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).serialized;
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).success).toBe(true);
  await page.mouse.click(right.x, right.y); await expect(page.locator('#propertiesPanel')).toContainText('面積9600 mm²');
  const repair = page.locator('[data-property-action="hatch-repair"]');
  await repair.click(); await page.mouse.click(left.x, left.y); await page.keyboard.press('Escape');
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).serialized.hatches).toEqual(saved.hatches);
  await repair.click(); await page.mouse.click(left.x, left.y); await rows.first().press('Enter');
  await expect(palette).toBeHidden(); await expect(page.locator('#propertiesPanel')).toContainText('面積4800 mm²');
  await repair.click(); await page.mouse.click(left.x, left.y); await page.mouse.click(right.x, right.y); await finish.click();
  state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct[0].id).toBe('H1'); expect(state.direct[0].appearance).toEqual(saved.hatches[0].appearance);
  expect(state.direct[0].boundaryLoops).toHaveLength(2);
  await page.keyboard.press('Control+z'); await page.mouse.click(left.x, left.y); await expect(page.locator('#propertiesPanel')).toContainText('面積4800 mm²');
  await page.keyboard.press('Control+y'); await page.mouse.click(left.x, left.y); await expect(page.locator('#propertiesPanel')).toContainText('面積9600 mm²');
});

test("disconnected regions retain holes, area and selection after save/reload", async ({ page }) => {
  const { serialized } = await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  serialized.points.push({ ...serialized.points[0], id: 'P5', x: 60, y: 40 }, { ...serialized.points[0], id: 'P6', x: 180, y: 40 });
  serialized.circles = [
    { id: 'C1', center: 'P5', radius: 10, construction: false, sketchId: 'S1', appearance: {} },
    { id: 'C2', center: 'P6', radius: 10, construction: false, sketchId: 'S1', appearance: {} },
  ];
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), serialized)).success).toBe(true);
  await page.evaluate(() => window.__jot2dTest.fitAllGeometryForTest());
  let clients = await page.evaluate(() => [{ x: 30, y: 60 }, { x: 180, y: 46 }, { x: 60, y: 40 }].map(p => window.__jot2dTest.worldClientPositionForTest(p)));
  await page.locator('#toolHatch').click();
  for (const p of clients.slice(0, 2)) await page.mouse.click(p.x, p.y);
  await expect(page.locator('#commandPanel [role="option"]')).toHaveCount(2);
  await expect(page.locator('#commandPanel')).toContainText('合計面積: 9600 mm²');
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  const state = await page.evaluate(() => window.__jot2dTest.hatchStateForTest());
  expect(state.direct[0].boundaryLoops.map(loop => loop.role)).toEqual(['outer', 'hole', 'outer']);
  for (const p of clients.slice(0, 2)) expect((await canvasInkAround(page, p, 1)).center[3]).toBeGreaterThan(0);
  expect((await canvasInkAround(page, clients[2], 1)).center[3]).toBe(0);
  expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), state.serialized)).success).toBe(true);
  clients = await page.evaluate(() => [{ x: 30, y: 60 }, { x: 180, y: 46 }, { x: 60, y: 40 }].map(p => window.__jot2dTest.worldClientPositionForTest(p)));
  await page.mouse.click(clients[1].x, clients[1].y);
  expect((await page.evaluate(() => window.__jot2dTest.hatchStateForTest())).selectedIds).toEqual(['H1']);
  await expect(page.locator('#propertiesPanel')).toContainText('面積9600 mm²');
  await page.locator('[data-property-action="hatch-repair"]').click();
  await page.mouse.click(clients[0].x, clients[0].y);
  await page.mouse.click(clients[2].x, clients[2].y);
  await page.keyboard.press('Enter');
  expect((await canvasInkAround(page, clients[2], 1)).center[3]).toBeGreaterThan(0);
});
