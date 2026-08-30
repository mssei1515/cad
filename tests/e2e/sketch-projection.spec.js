const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});

test("accepts only visible ancestor geometry as a projection source", async ({ page }) => {
  const eligibility = await page.evaluate(() => window.__jot2dTest.sketchProjectionEligibilityForTest());
  expect(eligibility).toEqual({ ancestor: true, hiddenAncestor: false, self: false, sibling: false, child: false, root: false });
});

async function createAllProjectionKinds(page) {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionTest());
  await page.locator("#toolSketchProjection").click();
  for (const key of ["point", "line1", "line2", "circle", "arc", "spline"]) {
    const client = fixture.clients[key];
    await page.mouse.click(client.x, client.y);
  }
  await expect.poll(() => page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest().stagedCount)).toBe(6);
  await page.keyboard.press("Enter");
  return fixture;
}

function projectedTargetPointIds(target) {
  if (target.kind === "point") return [target.id];
  if (target.kind === "line") return [target.p1, target.p2];
  if (target.kind === "circle" || target.kind === "arc") return [target.center.id];
  return target.fitPoints.map((point) => point.id);
}

test("projects every supported geometry kind with geometry-owned points, normal/purple status colors, clear icon, tree, properties, and v19 persistence", async ({ page }) => {
  const fixture = await createAllProjectionKinds(page);
  let state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());

  expect(state.mode).toBe("select");
  expect(state.constraints.map((item) => item.kind).sort()).toEqual(["arc", "circle", "line", "line", "point", "spline"]);
  expect(state.constraints.every((item) => item.sketchId === fixture.targetSketchId && item.referenceSketchId === fixture.sourceSketchId)).toBe(true);
  expect(state.constraints.every((item) => item.displayColor === item.appearanceColor)).toBe(true);
  expect(state.constraints.every((item) => item.displayColor !== "#0F766E")).toBe(true);
  await page.locator("#constraintStatusViewBtn").click();
  state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.constraints.every((item) => item.constraintStatus === "full")).toBe(true);
  expect(state.constraints.every((item) => item.displayColor === item.statusColor)).toBe(true);
  expect(state.constraints.every((item) => item.displayColor === "#7c3aed")).toBe(true);
  expect(state.constraints.every((item) => item.displayColor !== item.appearanceColor)).toBe(true);
  await page.locator("#constraintStatusViewBtn").click();
  const projectionIcon = page.locator("#toolSketchProjection svg");
  await expect(projectionIcon.locator("title")).toHaveText("投影拘束");
  await expect(projectionIcon.locator(".projection-source")).toHaveAttribute("d", "M2 3H8V7H16V3H22");
  await expect(projectionIcon.locator(".projection-source")).toHaveAttribute("stroke-dasharray", "2.5 2.5");
  await expect(projectionIcon.locator(".projection-ray")).toHaveAttribute("d", "M5 9.5V14M3 12L5 14L7 12M12 9.5V14M10 12L12 14L14 12M19 9.5V14M17 12L19 14L21 12");
  await expect(projectionIcon.locator(".projection-target")).toHaveAttribute("d", "M2 17H8V21H16V17H22");
  const targetLines = state.constraints.filter((item) => item.kind === "line").map((item) => item.target);
  expect(new Set(targetLines.flatMap((line) => [line.p1, line.p2])).size).toBe(4);
  const targetPointIds = state.constraints.flatMap((item) => projectedTargetPointIds(item.target));
  expect(new Set(targetPointIds).size).toBe(targetPointIds.length);
  expect(state.constraints.filter((item) => item.kind === "line").every((item) => item.redundant === false)).toBe(true);

  const serializedLinks = state.serialized.constraints.filter((item) => item.type === "sketchProjection");
  expect(state.serialized.version).toBe(19);
  expect(serializedLinks).toHaveLength(6);
  expect(serializedLinks.every((item) => item.enabled === true && item.reference === true && item.source && item.target)).toBe(true);

  const selected = await page.evaluate(() => window.__jot2dTest.selectSketchProjectionTargetForTest("line"));
  expect(selected.propertiesText).toContain("参照元スケッチ");
  expect(selected.propertiesText).toContain(fixture.sourceSketchId);
  expect(selected.propertiesText).toContain("参照元Geometry ID");

  await page.locator('.sketch-group-row[data-sketch-id="S3"][data-category="line"]').click();
  await expect(page.locator('#sketchList [data-object-kind="line"] .badge', { hasText: "投影" })).toHaveCount(2);
  await page.locator('.sketch-group-row[data-sketch-id="S3"][data-category="constraint"]').click();
  await expect(page.locator('#sketchList [data-object-kind="constraint"]', { hasText: "スケッチ投影" })).toHaveCount(6);

  state = await page.evaluate(() => window.__jot2dTest.reloadSketchProjectionForTest(19));
  expect(state.constraints).toHaveLength(6);
  expect(state.serialized.constraints.filter((item) => item.type === "sketchProjection")).toHaveLength(6);
});

test("keeps four projected rectangle lines independent and separates shared v19 endpoints on load", async ({ page }) => {
  let state = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionRectangleTest());
  let targetLines = state.constraints.map((item) => item.target);
  expect(targetLines).toHaveLength(4);
  expect(new Set(targetLines.flatMap((line) => [line.p1, line.p2])).size).toBe(8);
  expect(state.serialized.points.filter((point) => point.sketchId === "S3")).toHaveLength(8);
  expect(state.constraints.every((item) => item.redundant === false)).toBe(true);

  state = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionRectangleTest({ reloadSharedVersion19: true }));
  targetLines = state.constraints.map((item) => item.target);
  expect(new Set(targetLines.flatMap((line) => [line.p1, line.p2])).size).toBe(8);
  expect(state.serialized.points.filter((point) => point.sketchId === "S3")).toHaveLength(8);
  expect(state.constraints.every((item) => item.redundant === false)).toBe(true);
});

test("keeps points independent across projection kinds and separates cross-kind sharing on load", async ({ page }) => {
  for (const reloadSharedVersion19 of [false, true]) {
    const state = await page.evaluate((reload) => window.__jot2dTest.resetForSketchProjectionSharedKindsTest({ reloadSharedVersion19: reload }), reloadSharedVersion19);
    const targetPointIds = state.constraints.flatMap((item) => projectedTargetPointIds(item.target));
    expect(state.constraints.map((item) => item.kind).sort()).toEqual(["arc", "circle", "line", "point", "spline"]);
    expect(targetPointIds).toHaveLength(8);
    expect(new Set(targetPointIds).size).toBe(8);
    expect(state.serialized.points.filter((point) => point.sketchId === "S3")).toHaveLength(8);
    expect(state.constraints.every((item) => item.redundant === false)).toBe(true);
  }
});

test("tracks source shape and spline topology, then treats v18 projection links as absent", async ({ page }) => {
  await createAllProjectionKinds(page);
  const moved = await page.evaluate(() => window.__jot2dTest.moveSketchProjectionSourcesForTest(13, -6, { changeShape: true, changeSplineStructure: true }));
  expect(moved.success).toBe(true);
  for (const link of moved.state.constraints) {
    if (link.kind === "point") {
      expect(link.target.x).toBeCloseTo(link.source.x, 8);
      expect(link.target.y).toBeCloseTo(link.source.y, 8);
    } else if (link.kind === "line") {
      link.target.points.forEach((point, index) => {
        expect(point.x).toBeCloseTo(link.source.points[index].x, 8);
        expect(point.y).toBeCloseTo(link.source.points[index].y, 8);
      });
      expect(link.target.construction).toBe(link.source.construction);
    } else if (link.kind === "circle") {
      expect(link.target.center.x).toBeCloseTo(link.source.center.x, 8);
      expect(link.target.center.y).toBeCloseTo(link.source.center.y, 8);
      expect(link.target.radius).toBeCloseTo(link.source.radius, 8);
    } else if (link.kind === "arc") {
      expect(link.target.radius).toBeCloseTo(link.source.radius, 8);
      expect(link.target.startAngle).toBeCloseTo(link.source.startAngle, 8);
      expect(link.target.endAngle).toBeCloseTo(link.source.endAngle, 8);
    } else if (link.kind === "spline") {
      expect(link.target.closed).toBe(true);
      expect(link.target.fitPoints).toHaveLength(5);
      link.target.fitPoints.forEach((point, index) => {
        expect(point.x).toBeCloseTo(link.source.fitPoints[index].x, 8);
        expect(point.y).toBeCloseTo(link.source.fitPoints[index].y, 8);
      });
    }
  }

  const legacy = await page.evaluate(() => window.__jot2dTest.reloadSketchProjectionForTest(18));
  expect(legacy.constraints).toHaveLength(0);
  expect(legacy.serialized.version).toBe(19);
  expect(legacy.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);
});

test("propagates source changes through a projection chain", async ({ page }) => {
  await createAllProjectionKinds(page);
  const chained = await page.evaluate(() => window.__jot2dTest.createSketchProjectionChainForTest());
  expect(chained.success).toBe(true);
  expect(chained.state.constraints.some((link) => link.referenceSketchId === "S3" && link.sketchId === "S4")).toBe(true);

  const moved = await page.evaluate(() => window.__jot2dTest.moveSketchProjectionSourcesForTest(19, -8, { changeShape: false }));
  expect(moved.success).toBe(true);
  const downstream = moved.state.constraints.find((link) => link.referenceSketchId === "S3" && link.sketchId === "S4");
  expect(downstream).toBeTruthy();
  downstream.target.points.forEach((point, index) => {
    expect(point.x).toBeCloseTo(downstream.source.points[index].x, 8);
    expect(point.y).toBeCloseTo(downstream.source.points[index].y, 8);
  });
});

test("blocks direct drag without changing shape or history, while manual removal leaves geometry", async ({ page }) => {
  await createAllProjectionKinds(page);
  const selected = await page.evaluate(() => window.__jot2dTest.selectSketchProjectionTargetForTest("line"));
  const before = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  const beforeLine = before.constraints.find((item) => item.targetId === selected.targetId);
  await page.mouse.move(selected.client.x, selected.client.y);
  await page.mouse.down();
  await page.mouse.move(selected.client.x + 34, selected.client.y + 18, { steps: 4 });
  await page.mouse.up();

  let after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints).toHaveLength(6);
  expect(after.constraints.find((item) => item.targetId === selected.targetId).target).toEqual(beforeLine.target);
  expect(after.history).toEqual(before.history);
  expect(after.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);
  await expect(page.locator("#hint")).toContainText("投影拘束を削除してから形状を編集してください");

  await page.evaluate(() => window.__jot2dTest.removeFirstSketchProjectionConstraintForTest());
  const manual = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(manual.constraints).toHaveLength(5);
  expect(manual.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);
});

test("keeps projection links and source tracking when appearance is edited locally", async ({ page }) => {
  await createAllProjectionKinds(page);
  const result = await page.evaluate(() => window.__jot2dTest.setSketchProjectionAppearanceForTest("line"));
  expect(result.changed).toBe(true);
  expect(result.before).toBe(6);
  expect(result.state.constraints).toHaveLength(6);
  expect(result.state.constraints.filter((link) => link.kind === "line")).toHaveLength(2);
  expect(result.state.constraints.find((link) => link.targetId === result.targetId).appearanceColor).toBe("#8b5cf6");
  expect(result.state.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);

  const moved = await page.evaluate(() => window.__jot2dTest.moveSketchProjectionSourcesForTest(17, -9, { changeShape: false }));
  const linked = moved.state.constraints.find((item) => item.targetId === result.targetId);
  expect(linked.appearanceColor).toBe("#8b5cf6");
  linked.target.points.forEach((point, index) => {
    expect(point.x).toBeCloseTo(linked.source.points[index].x, 8);
    expect(point.y).toBeCloseTo(linked.source.points[index].y, 8);
  });
});

test("blocks normal/construction changes while keeping the projection link", async ({ page }) => {
  await createAllProjectionKinds(page);
  const selected = await page.evaluate(() => window.__jot2dTest.selectSketchProjectionTargetForTest("line"));
  const before = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  const beforeLine = before.constraints.find((item) => item.targetId === selected.targetId);
  await page.locator("#toolConstructionLine").click();
  const after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints).toHaveLength(6);
  expect(after.constraints.find((item) => item.targetId === selected.targetId).target.construction).toBe(beforeLine.target.construction);
  expect(after.history).toEqual(before.history);
  await expect(page.locator("#hint")).toContainText("投影拘束を削除してから形状を編集してください");
});

test("rejects fixed, trim, fillet, and spline topology edits while linked", async ({ page }) => {
  await createAllProjectionKinds(page);
  await page.evaluate(() => window.__jot2dTest.selectSketchProjectionTargetForTest("line"));
  let before = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  await page.locator("#fixPointBtn").click();
  let after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints).toHaveLength(6);
  expect(after.history).toEqual(before.history);

  let fixture = await createAllProjectionKinds(page);
  before = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  await page.locator("#toolTrim").click();
  await page.mouse.click(fixture.clients.line1.x, fixture.clients.line1.y);
  after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints).toHaveLength(6);
  expect(after.history).toEqual(before.history);

  fixture = await createAllProjectionKinds(page);
  before = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  await page.locator("#toolFillet").click();
  await page.mouse.click(fixture.clients.line1.x, fixture.clients.line1.y);
  await page.mouse.click(fixture.clients.line2.x, fixture.clients.line2.y);
  after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints).toHaveLength(6);
  expect(after.history).toEqual(before.history);

  await createAllProjectionKinds(page);
  const spline = await page.evaluate(() => window.__jot2dTest.selectSketchProjectionTargetForTest("spline"));
  before = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(spline).toBeTruthy();
  await page.locator('#propertiesPanel [data-property="spline-closed"]').click();
  after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints).toHaveLength(6);
  expect(after.constraints.find((item) => item.targetId === spline.targetId).target.closed).toBe(false);
  expect(after.history).toEqual(before.history);
  await expect(page.locator("#hint")).toContainText("投影拘束を削除してから形状を編集してください");
});

test("Escape cancels all staged sources without creating geometry", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionTest());
  await page.locator("#toolSketchProjection").click();
  await page.mouse.click(fixture.clients.line1.x, fixture.clients.line1.y);
  await page.mouse.click(fixture.clients.circle.x, fixture.clients.circle.y);
  await page.keyboard.press("Escape");
  const state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.mode).toBe("select");
  expect(state.stagedCount).toBe(0);
  expect(state.constraints).toHaveLength(0);
  expect(state.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(0);
});

test("window- and crossing-selects projection sources and executes them from the context menu", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionTest());
  const drags = await page.evaluate(() => ({
    crossing: {
      start: window.__jot2dTest.worldClientPositionForTest({ x: -65, y: -60 }),
      end: window.__jot2dTest.worldClientPositionForTest({ x: -75, y: -50 }),
    },
    window: {
      start: window.__jot2dTest.worldClientPositionForTest({ x: -105, y: -65 }),
      end: window.__jot2dTest.worldClientPositionForTest({ x: -30, y: -5 }),
    },
  }));
  await page.locator("#toolSketchProjection").click();
  await page.mouse.move(drags.crossing.start.x, drags.crossing.start.y);
  await page.mouse.down();
  await page.mouse.move(drags.crossing.end.x, drags.crossing.end.y, { steps: 5 });
  await page.mouse.up();

  let state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.stagedCount).toBe(1);
  await page.keyboard.press("Escape");

  await page.locator("#toolSketchProjection").click();
  await page.mouse.move(drags.window.start.x, drags.window.start.y);
  await page.mouse.down();
  await page.mouse.move(drags.window.end.x, drags.window.end.y, { steps: 5 });
  await page.mouse.up();

  state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.stagedCount).toBe(2);

  await page.mouse.click(drags.window.end.x, drags.window.end.y, { button: "right" });
  const execute = page.locator('#canvasContextMenu [data-context-action="sketch-projection-commit"]');
  await expect(execute).toBeVisible();
  await expect(execute).toBeEnabled();
  await expect(execute).toContainText("実行");
  await execute.click();

  state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.mode).toBe("select");
  expect(state.stagedCount).toBe(0);
  expect(state.constraints.map((item) => item.kind)).toEqual(["line", "line"]);
  expect(state.constraints.map((item) => item.sourceId).sort()).toEqual([...fixture.ids.lines].sort());
});

test("skips duplicate sources and copies or blockizes projected results as independent geometry", async ({ page }) => {
  const fixture = await createAllProjectionKinds(page);
  await page.locator("#toolSketchProjection").click();
  await page.mouse.click(fixture.clients.point.x, fixture.clients.point.y);
  let state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.stagedCount).toBe(0);
  await page.keyboard.press("Escape");

  const copied = await page.evaluate(() => window.__jot2dTest.copySketchProjectionTargetForTest("circle"));
  expect(copied.copied).toBe(true);
  expect(copied.pasted).toBe(true);
  expect(copied.before).toBe(6);
  expect(copied.after).toBe(6);
  expect(copied.clipboardProjectionCount).toBe(0);
  expect(copied.state.serialized.circles.filter((circle) => circle.sketchId === "S3")).toHaveLength(2);

  const blockized = await page.evaluate(() => window.__jot2dTest.blockizeSketchProjectionTargetForTest("spline"));
  expect(blockized.error).toBeNull();
  expect(blockized.externalProjectionCount).toBe(1);
  expect(blockized.projectionConstraintCount).toBe(0);
  expect(blockized.geometryCount).toBe(1);
});

test("source geometry and source sketch deletion unlink while preserving the final projected shape", async ({ page }) => {
  await createAllProjectionKinds(page);
  await page.evaluate(() => window.__jot2dTest.deleteSketchProjectionSourceGeometryForTest("spline"));
  let state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.constraints).toHaveLength(5);
  expect(state.serialized.splines.filter((spline) => spline.sketchId === "S3")).toHaveLength(1);

  await createAllProjectionKinds(page);
  const targetDeletion = await page.evaluate(() => window.__jot2dTest.deleteSketchProjectionTargetGeometryForTest("circle"));
  expect(targetDeletion.deleted).toBe(true);
  expect(targetDeletion.state.constraints).toHaveLength(5);
  expect(targetDeletion.state.serialized.circles.filter((circle) => circle.sketchId === "S3")).toHaveLength(0);

  await createAllProjectionKinds(page);
  const deletion = await page.evaluate(() => window.__jot2dTest.deleteSketchProjectionSourceSketchForTest());
  expect(deletion.deleted).toBe(true);
  expect(deletion.state.constraints).toHaveLength(0);
  expect(deletion.state.sketches).toEqual(expect.arrayContaining([{ id: "S3", parentSketchId: "ROOT" }]));
  expect(deletion.state.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);
  expect(deletion.state.serialized.circles.filter((circle) => circle.sketchId === "S3")).toHaveLength(1);
  expect(deletion.state.serialized.arcs.filter((arc) => arc.sketchId === "S3")).toHaveLength(1);
  expect(deletion.state.serialized.splines.filter((spline) => spline.sketchId === "S3")).toHaveLength(1);
});

test("uses the same projection command, local history, and persistence in Block Editor", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionBlockEditorTest());
  await page.locator("#toolSketchProjection").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Enter");
  let state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.constraints).toHaveLength(1);
  expect(state.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(1);

  await page.keyboard.press("Control+z");
  state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.constraints).toHaveLength(0);
  await page.keyboard.press("Control+y");
  state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(state.constraints).toHaveLength(1);

  const completed = await page.evaluate(() => window.__jot2dTest.completeSketchProjectionBlockEditorForTest());
  expect(completed.completed).toBe(true);
  expect(completed.serialized.blockDefinitions).toHaveLength(1);
  expect(completed.serialized.blockDefinitions[0].constraints.filter((constraint) => constraint.type === "sketchProjection")).toHaveLength(1);
  expect(completed.serialized.blockDefinitions[0].lines).toHaveLength(2);
});

test("follows Block Projection movement and rotation, then unlinks when the source instance is deleted", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForBlockProjectionSketchProjectionTest());
  await page.locator("#toolSketchProjection").click();
  await page.mouse.click(fixture.client.x, fixture.client.y);
  await page.keyboard.press("Enter");

  const reloaded = await page.evaluate(() => window.__jot2dTest.reloadSketchProjectionForTest(19));
  expect(reloaded.constraints).toHaveLength(1);
  expect(reloaded.serialized.constraints.filter((constraint) => constraint.type === "sketchProjection")).toHaveLength(1);

  const moved = await page.evaluate(() => window.__jot2dTest.moveBlockProjectionSketchProjectionSourceForTest());
  expect(moved.success).toBe(true);
  expect(moved.state.constraints).toHaveLength(1);
  const link = moved.state.constraints[0];
  link.target.points.forEach((point, index) => {
    expect(point.x).toBeCloseTo(link.source.points[index].x, 8);
    expect(point.y).toBeCloseTo(link.source.points[index].y, 8);
  });
  expect(Math.abs(link.target.points[0].x - link.target.points[1].x)).toBeLessThan(1e-7);

  const deleted = await page.evaluate(() => window.__jot2dTest.deleteBlockProjectionSketchProjectionSourceForTest());
  expect(deleted.deleted).toBe(true);
  expect(deleted.state.constraints).toHaveLength(0);
  expect(deleted.state.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(1);
});
