const { test, expect, openTestDocument, completeBlockEdit } = require("./test-fixture");

async function state(page) { return page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest()); }
async function client(page, point) { return page.evaluate((p) => window.__jot2dTest.worldClientPositionForTest(p), point); }
async function clickWorld(page, point) { const p = await client(page, point); await page.mouse.click(p.x, p.y); }
async function drag(page, a, b, whole = false) {
  if (!whole && !(await state(page)).selectedIds.length) await clickWorld(page, a);
  if (!whole && !(await state(page)).selectedGeometry) await clickWorld(page, a);
  const start = await client(page, a), end = await client(page, b);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up();
}
async function fixture(page, copies = 2) {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  const data = (await state(page)).serialized;
  const sketchId = data.activeSketchId;
  data.points = [[-70, -20], [-30, -20], [-30, 20], [-70, 20]].map(([x, y], i) => ({ id: `P${i + 1}`, x, y, fixed: false, kind: "endpoint", sketchId }));
  data.lines = [0, 1, 2, 3].map((i) => ({ id: `L${i + 1}`, p1: `P${i + 1}`, p2: `P${(i + 1) % 4 + 1}`, construction: false, sketchId }));
  data.constraints = data.lines.map((line, i) => ({ type: i % 2 ? "vertical" : "horizontal", line: line.id, enabled: true, sketchId }));
  data.geometryInstances = Array.from({ length: copies }, (_, i) => ({ id: `FI${i + 1}`, type: "free", sketchId, sources: data.lines.map((line) => ({ kind: "line", path: [line.id] })), origin: { x: -70, y: -20 }, x: i * 65, y: -20, rotation: 0, mirrorX: false, mirrorY: false, appearanceOverride: {}, drawingOrder: i + 10 }));
  expect(await page.evaluate((d) => window.__jot2dTest.loadDocumentFixtureForDragTest(d, "free.jot2d", { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 10, y: 0 }, 2.3));
  return data;
}
async function selectTree(page, id, sketchId) {
  const group = page.locator(`.sketch-group-row[data-sketch-id="${sketchId}"][data-category="instance"]`);
  if (!await group.isVisible()) await page.locator(`.sketch-item[data-id="${sketchId}"] .sketchExpandBtn`).click();
  const row = page.locator(`.sketch-object-row[data-object-kind="instance"][data-id="${id}"]`);
  if (!await row.isVisible()) await group.click();
  await row.click();
}

for (const type of ["mirror", "pattern"]) {
  for (const fixed of [false, true]) {
    test(`${type} first drag preserves source and relation with ${fixed ? "fixed" : "free"} control line`, async ({ page }) => {
      const data = await fixture(page, 0);
      const sketchId = data.activeSketchId;
      data.points.push(...[{ id: "P5", x: 0, y: -40 }, { id: "P6", x: 0, y: 40 }].map((p) => ({ ...p, fixed, kind: "endpoint", sketchId })));
      data.lines.push({ id: "L5", p1: "P5", p2: "P6", construction: true, sketchId });
      data.constraints.push(type === "mirror"
        ? { type: "vertical", line: "L5", enabled: true, sketchId }
        : { type: "distance", p1: "P5", p2: "P6", target: 80, parameterName: "D1", expression: "80", enabled: true, sketchId });
      const instance = { id: type === "mirror" ? "MI1" : "PI1", type, sketchId,
        sources: data.lines.slice(0, 4).map((line) => ({ kind: "line", path: [line.id] })),
        ...(type === "mirror" ? { axis: { kind: "line", path: ["L5"] } } : { direction: { kind: "line", path: ["L5"] }, spacing: 60, copies: 2, reversed: false }) };
      data.geometryInstances = [instance];
      const loaded = await page.evaluate((d) => window.__jot2dTest.loadDocumentFixtureForDragTest(d, "relation.jot2d", { resetLoadedHistory: true }), data);
      expect(loaded.success, loaded.error).toBe(true);
      const before = await state(page);
      const edge = before.instances[0].lines[1];
      const start = { x: (edge.p1.x + edge.p2.x) / 2, y: (edge.p1.y + edge.p2.y) / 2 };
      await clickWorld(page, start);
      await drag(page, start, { x: start.x + 8, y: start.y }, true);
      const after = await state(page);
      expect(after.selectedIds).toEqual([instance.id]);
      expect(after.selectedGeometry).toBeNull();
      expect(after.serialized.points.slice(0, 4)).toEqual(before.serialized.points.slice(0, 4));
      expect(after.serialized.geometryInstances).toEqual(before.serialized.geometryInstances);
      if (fixed) expect(after.serialized.points).toEqual(before.serialized.points);
      else {
        expect(after.instances[0].lines[1].p1.x).toBeGreaterThan(edge.p1.x + 4);
        expect(after.serialized.points.slice(4)).not.toEqual(before.serialized.points.slice(4));
        expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).errorNorm).toBeLessThan(1e-4);
        await page.click("#undoBtn");
        expect((await state(page)).serialized.points).toEqual(before.serialized.points);
        await page.click("#redoBtn");
        expect((await state(page)).serialized.points).toEqual(after.serialized.points);
      }
    });
  }
}

test("selection descends within an instance, resets for another instance and tree", async ({ page }) => {
  const data = await fixture(page);
  await clickWorld(page, { x: 40, y: 0 });
  expect((await state(page)).selectedGeometry).toBeNull();
  await clickWorld(page, { x: 40, y: 0 });
  expect((await state(page)).selectedGeometry).toMatchObject({ instanceId: "FI1", id: "FI1@L2" });
  await clickWorld(page, { x: 20, y: -20 });
  expect((await state(page)).selectedGeometry).toMatchObject({ id: "FI1@L1" });
  await clickWorld(page, { x: 105, y: 0 });
  expect((await state(page)).selectedIds).toEqual(["FI2"]);
  expect((await state(page)).selectedGeometry).toBeNull();
  await clickWorld(page, { x: 105, y: 0 });
  expect((await state(page)).selectedGeometry).toMatchObject({ id: "FI2@L2" });
  await selectTree(page, "FI2", data.activeSketchId);
  expect((await state(page)).selectedGeometry).toBeNull();
  await clickWorld(page, { x: -90, y: 70 });
  expect((await state(page)).selectedIds).toEqual([]);
  const p = await client(page, { x: 40, y: 0 });
  await page.mouse.dblclick(p.x, p.y);
  expect((await state(page)).selectedGeometry).toMatchObject({ id: "FI1@L2" });
});

test("whole selection survives subsequent drags until an explicit internal click completes", async ({ page }) => {
  const data = await fixture(page, 1);
  const before = await state(page);
  await clickWorld(page, { x: 40, y: 0 });
  await drag(page, { x: 40, y: 0 }, { x: 48, y: 0 }, true);
  let current = await state(page);
  expect(current.selectedGeometry).toBeNull();
  expect(current.serialized.points).toEqual(before.serialized.points);
  expect(current.serialized.geometryInstances[0].x).toBeCloseTo(8, 3);
  await drag(page, { x: 48, y: 0 }, { x: 54, y: 0 }, true);
  expect((await state(page)).selectedGeometry).toBeNull();
  const p = await client(page, { x: 54, y: 0 });
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  expect((await state(page)).selectedGeometry).toBeNull();
  await page.mouse.up();
  expect((await state(page)).selectedGeometry).toMatchObject({ id: "FI1@L2" });
  await drag(page, { x: 54, y: 0 }, { x: 60, y: 0 }, true);
  current = await state(page);
  expect(current.serialized.geometryInstances[0].x).toBeCloseTo(14, 3);
  expect(current.serialized.points[1].x).toBeCloseTo(-24, 3);
  await selectTree(page, "FI1", data.activeSketchId);
  await drag(page, { x: 60, y: 0 }, { x: 66, y: 0 }, true);
  expect((await state(page)).serialized.points).toEqual(current.serialized.points);
  expect((await state(page)).selectedGeometry).toBeNull();
});

test("synchronized instance command previews rotation and reflection, cancels and round trips", async ({ page }) => {
  await fixture(page, 0);
  await expect(page.locator("#toolFreeInstance")).toHaveAttribute("aria-label", "同期インスタンス");
  await expect(page.locator('[data-menu-tool="toolFreeInstance"]')).toHaveText("同期インスタンス");
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1", "L2", "L3", "L4"] }));
  await page.click("#toolFreeInstance");
  await clickWorld(page, { x: -70, y: -20 });
  const rotation = page.locator('[data-free-instance-property="rotation"]');
  await rotation.fill("-30"); await rotation.press("Tab");
  await expect(rotation).toHaveValue("-30");
  await rotation.fill("90"); await rotation.press("Tab");
  await page.locator('[data-free-instance-property="mirrorX"]').check();
  await clickWorld(page, { x: 20, y: 30 });
  let current = await state(page);
  expect(current.serialized.geometryInstances[0]).toMatchObject({ type: "free", rotation: Math.PI / 2, mirrorX: true, mirrorY: false });
  expect(current.instances[0].valid).toBe(true);
  expect(current.instances[0].lines[0].p2.x).toBeCloseTo(20, 0);
  expect(current.instances[0].lines[0].p2.y).toBeCloseTo(-10, 0);
  await page.click("#undoBtn"); expect((await state(page)).instances).toHaveLength(0);
  await page.click("#redoBtn"); expect((await state(page)).instances).toHaveLength(1);
  current = await state(page);
  const restored = await page.evaluate((d) => window.__jot2dTest.loadModelForDerivedInstanceTest(d), current.serialized);
  expect(restored.instances).toEqual(current.instances);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await page.click("#toolFreeInstance"); await page.keyboard.press("Escape");
  expect((await state(page)).instances).toHaveLength(1);
});

test("second click edits shared shape; first drag moves placement; tree selects whole", async ({ page }) => {
  const data = await fixture(page);
  await drag(page, { x: 40, y: 0 }, { x: 50, y: 0 });
  let current = await state(page);
  expect(current.serialized.points.find((p) => p.id === "P2").x).toBeCloseTo(-20, 3);
  expect(current.instances[1].lines[0].p2.x - current.instances[1].lines[0].p1.x).toBeCloseTo(50, 3);
  expect(current.serialized.geometryInstances[0].x).toBe(0);
  const source = current.serialized.points;
  const other = current.serialized.geometryInstances[1];
  await selectTree(page, "FI1", data.activeSketchId);
  expect((await state(page)).selectedGeometry).toBeNull();
  await clickWorld(page, { x: -90, y: 70 });
  await drag(page, { x: 25, y: -20 }, { x: 33, y: -30 }, true);
  current = await state(page);
  expect(current.serialized.points).toEqual(source);
  expect(current.serialized.geometryInstances[0].x).toBeCloseTo(8, 3);
  expect(current.serialized.geometryInstances[0].y).toBeCloseTo(-30, 3);
  expect(current.serialized.geometryInstances[1]).toEqual(other);
  await page.click("#undoBtn");
  expect((await state(page)).serialized.geometryInstances[0].x).toBe(0);
  await page.click("#redoBtn");
  expect((await state(page)).serialized.geometryInstances[0].x).toBeCloseTo(8, 3);
  await clickWorld(page, { x: -90, y: 70 });
  await drag(page, { x: 58, y: -10 }, { x: 64, y: -10 });
  expect((await state(page)).serialized.points.find((p) => p.id === "P2").x).toBeCloseTo(-14, 3);
});

test("dimension added on a derived edge constrains shared height and permits width editing", async ({ page }) => {
  await fixture(page);
  await page.click('[data-constraint="distance"]');
  await clickWorld(page, { x: 40, y: 0 });
  await clickWorld(page, { x: 53, y: 0 });
  const input = page.locator("#dimensionValueInput");
  await expect(input).toBeVisible();
  await input.fill("50"); await input.press("Enter");
  await page.keyboard.press("Escape");
  let current = await state(page);
  expect(current.serialized.constraints).toHaveLength(5);
  expect(current.serialized.constraints.at(-1).target).toBe(50);
  for (const instance of current.instances) expect(Math.hypot(instance.lines[1].p2.x - instance.lines[1].p1.x, instance.lines[1].p2.y - instance.lines[1].p1.y)).toBeCloseTo(50, 3);
  const edge = current.instances[0].lines[1];
  const width = current.serialized.points[1].x - current.serialized.points[0].x;
  const middle = { x: (edge.p1.x + edge.p2.x) / 2, y: (edge.p1.y + edge.p2.y) / 2 };
  await drag(page, middle, { x: middle.x + 10, y: middle.y });
  current = await state(page);
  expect(current.serialized.points[1].x - current.serialized.points[0].x).toBeGreaterThan(width + 5);
  expect(current.serialized.points[2].y - current.serialized.points[1].y).toBeCloseTo(50, 3);
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).errorNorm).toBeLessThan(1e-4);
  // The existing dimension workflow converts the redundant copy dimension
  // into a read-only measurement instead of imposing a different shared height.
  const otherEdge = current.instances[1].lines[1];
  const otherMiddle = { x: (otherEdge.p1.x + otherEdge.p2.x) / 2, y: (otherEdge.p1.y + otherEdge.p2.y) / 2 };
  await page.click('[data-constraint="distance"]');
  await clickWorld(page, otherMiddle);
  await clickWorld(page, { x: otherMiddle.x + 12, y: otherMiddle.y });
  if (await input.isVisible()) { await input.fill("60"); await input.press("Enter"); }
  await page.keyboard.press("Escape");
  const afterConflict = await state(page);
  expect(afterConflict.serialized.constraints.filter((c) => c.enabled)).toHaveLength(5);
  expect(afterConflict.serialized.constraints.at(-1)).toMatchObject({ readOnlyDimension: true, enabled: false, target: 50 });
  expect(afterConflict.serialized.points[2].y - afterConflict.serialized.points[1].y).toBeCloseTo(50, 3);
});

test("placement constraints stop whole-instance dragging and reject incompatible property rotations", async ({ page }) => {
  const data = await fixture(page, 1);
  data.points.forEach((p) => { p.fixed = true; });
  let current = await page.evaluate((d) => window.__jot2dTest.loadModelForDerivedInstanceTest(d), data);
  // Fixed source shape does not fix the placement's three independent freedoms.
  expect(current.instances[0].lines.some((line) => line.color !== "#111827")).toBe(true);
  data.points.push({ id: "P5", x: 0, y: -20, fixed: true, kind: "explicit", sketchId: data.activeSketchId });
  data.constraints.push(
    { type: "coincident", p1: "FI1@P1", p2: "P5", enabled: true, sketchId: data.activeSketchId },
    { type: "horizontal", line: "FI1@L1", enabled: true, sketchId: data.activeSketchId },
  );
  expect(await page.evaluate((d) => window.__jot2dTest.loadDocumentFixtureForDragTest(d, "fixed-placement.jot2d", { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
  current = await state(page);
  expect(current.instances[0].lines.every((line) => line.color === "#111827")).toBe(true);
  const before = current.serialized;
  await drag(page, { x: 40, y: 0 }, { x: 50, y: 8 }, true);
  expect((await state(page)).serialized.points).toEqual(before.points);
  expect((await state(page)).serialized.geometryInstances).toEqual(before.geometryInstances);
  const rotation = page.locator('[data-free-instance-property="rotation"]');
  await rotation.fill("30"); await rotation.press("Tab");
  expect((await state(page)).serialized.geometryInstances).toEqual(before.geometryInstances);
  await expect(page.locator("#hint")).toContainText("変更を戻しました");
  await page.locator('[data-free-instance-property="mirrorX"]').check();
  expect((await state(page)).serialized.geometryInstances[0].mirrorX).toBe(true);
  await page.click("#undoBtn");
  expect((await state(page)).serialized.geometryInstances[0].mirrorX).toBe(false);
});

test("rotated mirrored circles and arcs share editable radius and endpoint geometry", async ({ page }) => {
  const data = await fixture(page, 1);
  data.points = [{ id: "P1", x: -50, y: 0, fixed: false, kind: "endpoint", sketchId: data.activeSketchId }];
  data.lines = []; data.constraints = [];
  data.circles = [{ id: "C1", center: "P1", radius: 12, construction: false, sketchId: data.activeSketchId }];
  data.arcs = [{ id: "A1", center: "P1", radius: 20, startAngle: 0, endAngle: 1.2, construction: false, sketchId: data.activeSketchId }];
  Object.assign(data.geometryInstances[0], { sources: [{ kind: "circle", path: ["C1"] }, { kind: "arc", path: ["A1"] }], origin: { x: -50, y: 0 }, x: 30, y: 0, rotation: Math.PI / 2, mirrorX: true });
  await page.evaluate((d) => window.__jot2dTest.loadModelForDerivedInstanceTest(d), data);
  let current = await state(page);
  expect(current.instances[0].arcs[0].sweep).toBeCloseTo(-1.2, 8);
  await drag(page, { x: 42, y: 0 }, { x: 46, y: 0 });
  current = await state(page);
  expect(current.serialized.circles[0].radius).toBeCloseTo(16, 2);
  expect(current.instances[0].circles[0].radius).toBeCloseTo(16, 2);
  await drag(page, { x: 30, y: -20 }, { x: 30 + 20 * Math.cos(-1), y: 20 * Math.sin(-1) });
  current = await state(page);
  expect(current.serialized.arcs[0].startAngle).not.toBeCloseTo(0, 2);
  expect(current.serialized.geometryInstances[0]).toMatchObject({ x: 30, y: 0, rotation: Math.PI / 2, mirrorX: true });
  const restored = await page.evaluate((d) => window.__jot2dTest.loadModelForDerivedInstanceTest(d), current.serialized);
  expect(restored.instances).toEqual(current.instances);
});

test("invalid free transforms and cross-sketch sources are rejected transactionally", async ({ page }) => {
  await fixture(page, 1);
  const baseline = (await state(page)).serialized;
  for (const mutation of ["rotation", "origin", "mirrorX", "scope", "cycle"]) {
    const malformed = structuredClone(baseline);
    if (mutation === "scope") {
      malformed.sketches.push({ ...malformed.sketches.find((s) => s.id === malformed.activeSketchId), id: "S99", name: "Other" });
      malformed.geometryInstances[0].sketchId = "S99";
    }
    else if (mutation === "cycle") malformed.geometryInstances[0].sources[0].path = ["FI1", "L1"];
    else malformed.geometryInstances[0][mutation] = null;
    expect(await page.evaluate((d) => {
      try { window.__jot2dTest.loadModelForDerivedInstanceTest(d); return false; } catch { return true; }
    }, malformed), mutation).toBe(true);
    const after = (await state(page)).serialized;
    expect({ ...after, savedAt: baseline.savedAt }).toEqual(baseline);
  }
});

test("a rotated derived chain edits the original source and preserves both placements", async ({ page }) => {
  const data = await fixture(page, 2);
  data.geometryInstances[1].sources = data.lines.map((line) => ({ kind: "line", path: ["FI1", line.id] }));
  Object.assign(data.geometryInstances[1], { origin: { x: 0, y: -20 }, x: 100, y: -20, rotation: Math.PI / 2 });
  await page.evaluate((d) => window.__jot2dTest.loadModelForDerivedInstanceTest(d), data);
  const before = await state(page);
  const edge = before.instances[1].lines[1];
  const p = { x: (edge.p1.x + edge.p2.x) / 2, y: (edge.p1.y + edge.p2.y) / 2 };
  await drag(page, p, { x: p.x, y: p.y + 8 });
  const after = await state(page);
  expect(after.serialized.points[1].x - after.serialized.points[0].x).toBeGreaterThan(45);
  expect(after.serialized.geometryInstances).toEqual(before.serialized.geometryInstances);
  expect((await page.evaluate((d) => window.__jot2dTest.loadModelForDerivedInstanceTest(d), after.serialized)).instances).toEqual(after.instances);
});

test("free instances in a block definition retain edits and local undo through reload", async ({ page }) => {
  const data = await fixture(page, 1);
  const definition = { id: "B1", name: "Shared rectangle", parentDefinitionId: null, revision: 1, origin: { x: 0, y: 0 } };
  for (const key of ["sketches", "activeSketchId", "points", "lines", "circles", "arcs", "splines", "constraints", "geometryInstances", "parameters", "annotations", "hatches", "referenceImages", "nextHatchIndex", "nextDimensionParameterIndex"]) definition[key] = structuredClone(data[key]);
  definition.blockInstances = [];
  data.blockDefinitions = [definition];
  data.blockInstances = [{ id: "BI1", definitionId: "B1", sketchId: data.activeSketchId, x: 0, y: 0, rotation: 0, fixed: false, rotationLocked: false, enabledSketchIds: [data.activeSketchId] }];
  for (const key of ["points", "lines", "circles", "arcs", "splines", "constraints", "geometryInstances"]) data[key] = [];
  expect(await page.evaluate((d) => window.__jot2dTest.loadDocumentFixtureForDragTest(d, "block-free.jot2d", { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
  await page.locator(".app-menu > summary").filter({ hasText: /^(?:ブロック|Block)$/ }).click();
  await page.click("#openBlockDefinitionsBtn");
  await page.click('.block-item[data-id="B1"] .blockEditBtn');
  await selectTree(page, "FI1", data.activeSketchId);
  const rotation = page.locator('[data-free-instance-property="rotation"]');
  await rotation.fill("-25"); await rotation.press("Tab");
  expect((await state(page)).serialized.geometryInstances[0].rotation).toBeCloseTo(-25 * Math.PI / 180, 8);
  await page.click("#undoBtn");
  expect((await state(page)).serialized.geometryInstances[0].rotation).toBe(0);
  await page.click("#redoBtn");
  await completeBlockEdit(page);
  const saved = (await state(page)).serialized;
  expect(saved.blockDefinitions[0].geometryInstances[0].rotation).toBeCloseTo(-25 * Math.PI / 180, 8);
  expect(await page.evaluate((d) => window.__jot2dTest.loadDocumentFixtureForDragTest(d), saved)).toMatchObject({ success: true });
});
