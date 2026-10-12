const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});

test("mirror inherits each source appearance, follows edits and preserves sparse overrides on reload", async ({ page }) => {
  const data = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest().serialized);
  data.sketches.find((sketch) => sketch.id === "S2").appearance = { color: "#112233", lineType: "solid", lineWidth: 2 };
  data.lines.find((line) => line.id === "L1").appearance = { color: "#cc3344", lineType: "dashed", lineWidth: 4 };
  data.arcs[0].appearance = { color: "#3355cc", lineType: "dotted", lineWidth: 3, visible: false };
  const mirror = data.geometryInstances.find((item) => item.id === "MI1");
  mirror.sources.push({ kind: "line", path: ["L3"] });
  data.lines.find((line) => line.id === "L3").appearance = { endpointMarkers: false, endpointOverhang: false };
  data.geometryInstances.find((item) => item.id === "SPI1").appearanceOverride = { color: "#559933", lineType: "dashdotdot" };
  data.geometryInstances.push({ ...mirror, id: "MI2", sources: [{ kind: "line", path: ["MI1", "L1"] }], appearanceOverride: { lineWidth: 6 } });
  expect(await page.evaluate((value) => window.__jot2dTest.loadDocumentFixtureForDragTest(value, "mirror-appearance.jot2d", { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
  const appearance = (kind, id) => page.evaluate(([k, i]) => window.__jot2dTest.appearanceStateForTest(k, i).effective, [kind, id]);
  expect(await appearance("line", "MI1@L1")).toMatchObject({ color: "#cc3344", lineType: "dashed", lineWidth: 4 });
  expect(await appearance("arc", `MI1@${data.arcs[0].id}`)).toMatchObject({ color: "#3355cc", lineType: "dotted", lineWidth: 3, visible: false });
  expect(await appearance("line", "MI1@L3")).toMatchObject({ lineType: "dashdot", endpointMarkers: false, endpointOverhang: false });
  expect(await appearance("circle", "MI1@SPI1@C1")).toMatchObject({ color: "#559933", lineType: "dashdotdot" });
  expect(await appearance("line", "MI2@MI1@L1")).toMatchObject({ color: "#cc3344", lineType: "dashed", lineWidth: 6 });
  expect(await appearance("line", "PI1@1@L1")).toMatchObject({ color: "#cc3344", lineType: "dashed", lineWidth: 4 });

  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await page.locator('#propertiesPanel [data-appearance-key="lineType"]').selectOption("dotted");
  expect(await appearance("line", "MI1@L1")).toMatchObject({ lineType: "dotted", lineWidth: 4 });
  expect(await appearance("line", "MI2@MI1@L1")).toMatchObject({ lineType: "dotted", lineWidth: 6 });
  await page.click("#undoBtn");
  expect(await appearance("line", "MI1@L1")).toMatchObject({ lineType: "dashed" });
  await page.click("#redoBtn");
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(saved.geometryInstances.find((item) => item.id === "MI1").appearanceOverride).toEqual({});
  expect(saved.geometryInstances.find((item) => item.id === "MI2").appearanceOverride).toEqual({ lineWidth: 6 });
  await page.evaluate((value) => window.__jot2dTest.loadModelForDerivedInstanceTest(value), saved);
  expect(await appearance("line", "MI2@MI1@L1")).toMatchObject({ color: "#cc3344", lineType: "dotted", lineWidth: 6 });
});

for (const type of ["sketchProjection", "pattern", "free"]) {
  test(`${type} inherits individual source appearances through edits, overrides and reload`, async ({ page }) => {
    const data = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest().serialized);
    data.sketches.find((sketch) => sketch.id === "S2").appearance = { color: "#112233", lineWidth: 2 };
    data.sketches.push({ id: "S3", name: "Child", kind: "sketch", parentSketchId: "S2", visible: true, appearance: { color: "#ffffff", lineType: "solid", lineWidth: 1 } });
    data.lines.find((line) => line.id === "L1").appearance = { color: "#cc3344", lineType: "dashed", lineWidth: 4 };
    data.arcs[0].appearance = { color: "#3355cc", lineType: "dotted", visible: false };
    data.lines.find((line) => line.id === "L3").appearance = { endpointMarkers: false, endpointOverhang: false };
    const id = type === "sketchProjection" ? "SPI2" : type === "pattern" ? "PI2" : "FI1";
    data.geometryInstances.push({ id, type, sketchId: type === "sketchProjection" ? "S3" : "S2",
      sources: [{ kind: "line", path: ["MI1", "L1"] }, { kind: "arc", path: [data.arcs[0].id] }, { kind: "line", path: ["L3"] }],
      appearanceOverride: { lineWidth: 5 },
      ...(type === "pattern" ? { direction: { kind: "line", path: ["L3"] }, spacing: 30, copies: 2, reversed: false } : {}),
      ...(type === "free" ? { origin: { x: 0, y: 0 }, x: 100, y: 0, rotation: 0, mirrorX: false, mirrorY: false } : {}),
    });
    expect(await page.evaluate((value) => window.__jot2dTest.loadDocumentFixtureForDragTest(value, "derived-appearance.jot2d", { resetLoadedHistory: true }), data)).toMatchObject({ success: true });
    const prefixes = type === "pattern" ? [`${id}@1`, `${id}@2`] : [id];
    const appearance = (kind, path) => page.evaluate(([k, i]) => window.__jot2dTest.appearanceStateForTest(k, i).effective, [kind, path]);
    for (const prefix of prefixes) {
      expect(await appearance("line", `${prefix}@MI1@L1`)).toMatchObject({ color: "#cc3344", lineType: "dashed", lineWidth: 5 });
      expect(await appearance("arc", `${prefix}@${data.arcs[0].id}`)).toMatchObject({ color: "#3355cc", lineType: "dotted", lineWidth: 5, visible: false });
      expect(await appearance("line", `${prefix}@L3`)).toMatchObject({ lineType: "dashdot", endpointMarkers: false, endpointOverhang: false });
    }
    await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
    await page.locator('#propertiesPanel [data-appearance-key="lineType"]').selectOption("dashdotdot");
    for (const prefix of prefixes) expect(await appearance("line", `${prefix}@MI1@L1`)).toMatchObject({ lineType: "dashdotdot", lineWidth: 5 });
    expect(await appearance("line", "L1")).toMatchObject({ lineWidth: 4 });
    await page.click("#undoBtn");
    expect(await appearance("line", `${prefixes[0]}@MI1@L1`)).toMatchObject({ lineType: "dashed" });
    await page.click("#redoBtn");
    const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(saved.geometryInstances.find((item) => item.id === id).appearanceOverride).toEqual({ lineWidth: 5 });
    await page.evaluate((value) => window.__jot2dTest.loadModelForDerivedInstanceTest(value), saved);
    for (const prefix of prefixes) expect(await appearance("line", `${prefix}@MI1@L1`)).toMatchObject({ color: "#cc3344", lineType: "dashdotdot", lineWidth: 5 });
  });
}

test("projection, mirror, and linear pattern are persisted as derived instances", async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.locator('.sketch-item[data-id="S2"] .sketchExpandBtn').click();
  await expect(page.locator('.sketch-group-row[data-sketch-id="S2"][data-category="instance"]')).toContainText("派生インスタンス");
  await page.locator('.sketch-group-row[data-sketch-id="S2"][data-category="instance"]').click();
  const state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());

  expect(state.serialized.version).toBe(25);
  expect(state.serialized.geometryInstances.map((item) => item.type)).toEqual(["sketchProjection", "mirror", "pattern"]);
  expect(state.serialized.constraints.some((item) => item.type === "sketchProjection")).toBe(false);
  expect(state.serialized.geometryInstances[2]).toMatchObject({ spacing: 15, copies: 3, reversed: false });
  expect(state.instances.every((item) => item.valid)).toBe(true);
  expect(state.instances.find((item) => item.type === "pattern").lines).toHaveLength(3);
  expect(state.instances.find((item) => item.type === "mirror").lines[0].p1.x).toBe(40);
  const projectionInstance = state.instances.find((item) => item.type === "sketchProjection");
  const editableInstances = state.instances.filter((item) => item.type !== "sketchProjection");
  expect([...projectionInstance.lines, ...projectionInstance.circles, ...projectionInstance.arcs].every((item) => item.color === "#111827")).toBe(true);
  expect(editableInstances.flatMap((item) => [...item.lines, ...item.circles, ...item.arcs]).every((item) => item.color === "#f59e0b")).toBe(true);
  expect(state.instances.find((item) => item.type === "mirror").arcs[0].sweep).toBeCloseTo(-0.5, 8);
  expect(state.hatchValidity).toEqual([true]);
  expect(state.treeCount).toBe(3);

  const fixedSource = structuredClone(state.serialized);
  const sourceLine = fixedSource.lines.find((item) => item.id === "L1");
  for (const point of fixedSource.points.filter((item) => item.id === sourceLine.p1 || item.id === sourceLine.p2)) point.fixed = true;
  const fixedState = await page.evaluate((data) => window.__jot2dTest.loadModelForDerivedInstanceTest(data), fixedSource);
  expect(fixedState.instances.flatMap((item) => item.lines).every((item) => item.color === "#111827")).toBe(true);
});

test("a single blank canvas click clears a derived instance selection", async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 2.5));
  await page.locator('.sketch-item[data-id="S2"] .sketchExpandBtn').click();
  await page.locator('.sketch-group-row[data-sketch-id="S2"][data-category="instance"]').click();
  await page.locator('.sketch-object-row[data-object-kind="instance"][data-id="PI1"]').click();
  expect((await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest())).selectedIds).toEqual(["PI1"]);

  const blank = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 100, y: 75 }));
  await page.mouse.click(blank.x, blank.y);
  expect((await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest())).selectedIds).toEqual([]);
});

test("projected geometry can constrain normal geometry in its target sketch", async ({ page }) => {
  let state = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 2.5));
  const projectedCircle = state.instances.find((item) => item.id === "SPI1").circles[0];
  const sourceArc = state.serialized.arcs.find((item) => item.id === "A1");
  const sourceArcCenter = state.serialized.points.find((item) => item.id === sourceArc.center);
  const projectedPick = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), {
    x: projectedCircle.center.x + projectedCircle.radius,
    y: projectedCircle.center.y,
  });
  const arcPick = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), {
    x: sourceArcCenter.x + sourceArc.radius * Math.cos(3.25),
    y: sourceArcCenter.y + sourceArc.radius * Math.sin(3.25),
  });

  await page.click('[data-constraint="concentric"]');
  await page.mouse.click(projectedPick.x, projectedPick.y);
  await page.mouse.click(arcPick.x, arcPick.y);

  state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  expect(state.serialized.constraints).toContainEqual(expect.objectContaining({ type: "concentric", sketchId: "S2" }));
  const constrainedArc = state.serialized.arcs.find((item) => item.id === "A1");
  const constrainedArcCenter = state.serialized.points.find((item) => item.id === constrainedArc.center);
  expect(constrainedArcCenter.x).toBeCloseTo(projectedCircle.center.x, 6);
  expect(constrainedArcCenter.y).toBeCloseTo(projectedCircle.center.y, 6);
  const parentCircle = state.serialized.circles.find((item) => item.id === "C1");
  const parentCenter = state.serialized.points.find((item) => item.id === parentCircle.center);
  expect(parentCenter).toMatchObject({ x: -25, y: -20 });
  await expect(page.locator("#hint")).not.toContainText("別スケッチ同士は通常拘束できません");
});

test("sketch projection geometry cannot drag ancestor sources directly or through derived chains", async ({ page }) => {
  let state = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 2.5));
  const projectedCircle = state.instances.find((item) => item.id === "SPI1").circles[0];
  let start = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), projectedCircle.center);
  let end = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x: projectedCircle.center.x + 6, y: projectedCircle.center.y + 4 });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  let sourceCircle = state.serialized.circles.find((item) => item.id === "C1");
  let sourceCenter = state.serialized.points.find((item) => item.id === sourceCircle.center);
  expect(sourceCenter).toMatchObject({ x: -25, y: -20 });
  expect(state.instances.find((item) => item.id === "SPI1").circles[0].center).toMatchObject({ x: -25, y: -20 });
  expect(state.selectedIds).toEqual(["SPI1"]);
  await expect(page.locator("#hint")).toContainText("先祖スケッチの参照元を変更するためドラッグできません");

  const mirrorCircle = state.instances.find((item) => item.id === "MI1").circles[0];
  start = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), mirrorCircle.center);
  end = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x: mirrorCircle.center.x + 5, y: mirrorCircle.center.y - 3 });
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(start.x, start.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  sourceCircle = state.serialized.circles.find((item) => item.id === "C1");
  sourceCenter = state.serialized.points.find((item) => item.id === sourceCircle.center);
  expect(sourceCenter).toMatchObject({ x: -25, y: -20 });
  expect(state.instances.find((item) => item.id === "MI1").circles[0].center).toMatchObject({ x: 25, y: -20 });
  expect(state.selectedIds).toEqual(["MI1"]);
  await expect(page.locator("#hint")).toContainText("先祖スケッチの参照元を変更するためドラッグできません");
});

test("same-sketch mirror and pattern geometry inverse-update their original sources", async ({ page }) => {
  let state = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 2.5));
  const patternedLine = state.instances.find((item) => item.id === "PI1").lines[0];
  const patternedMidpoint = { x: (patternedLine.p1.x + patternedLine.p2.x) / 2, y: (patternedLine.p1.y + patternedLine.p2.y) / 2 };
  let start = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), patternedMidpoint);
  let end = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x: patternedMidpoint.x + 5, y: patternedMidpoint.y - 4 });
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(start.x, start.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  const sourceLine = state.serialized.lines.find((item) => item.id === "L1");
  const sourceP1 = state.serialized.points.find((item) => item.id === sourceLine.p1);
  const sourceP2 = state.serialized.points.find((item) => item.id === sourceLine.p2);
  expect(sourceP1.x).toBeCloseTo(-35, 6);
  expect(sourceP1.y).toBeCloseTo(6, 6);
  expect(sourceP2.x).toBeCloseTo(-5, 6);
  expect(sourceP2.y).toBeCloseTo(26, 6);
  const movedPattern = state.instances.find((item) => item.id === "PI1").lines[0];
  expect(movedPattern.p1.x).toBeCloseTo(-20, 6);
  expect(movedPattern.p1.y).toBeCloseTo(6, 6);

  state = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 2.5));
  const mirroredArc = state.instances.find((item) => item.id === "MI1").arcs[0];
  const arcCenter = { x: 55, y: -25 };
  start = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), {
    x: arcCenter.x + 9 * Math.cos(mirroredArc.startAngle),
    y: arcCenter.y + 9 * Math.sin(mirroredArc.startAngle),
  });
  end = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), {
    x: arcCenter.x + 9 * Math.cos(0.5),
    y: arcCenter.y + 9 * Math.sin(0.5),
  });
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(start.x, start.y);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();

  state = await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest());
  expect(state.serialized.arcs.find((item) => item.id === "A1").startAngle).toBeCloseTo(Math.PI - 0.5, 6);
  expect(state.instances.find((item) => item.id === "MI1").arcs[0].startAngle).toBeCloseTo(0.5, 6);
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
  await page.keyboard.press("Enter");

  await page.evaluate((sourceId) => window.__jot2dTest.selectGeometryIdsForTest({ lines: [sourceId] }), copyFixture.sourceId);
  await page.click("#toolPattern");
  await page.locator('#commandPanel [data-setting="spacing"]').fill("12.5");
  await page.locator('#commandPanel [data-setting="copies"]').fill("4");
  await page.mouse.click(copyFixture.direction.x, copyFixture.direction.y);
  await page.locator('#commandPanel [data-action="finish"]').click();

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

test("v20 sketch projection constraints migrate one-to-one to current instances", async ({ page }) => {
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
  expect(state.serialized.version).toBe(25);
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
