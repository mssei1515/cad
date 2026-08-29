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

test("projects every supported geometry kind with shared points, teal appearance, tree, properties, and v19 persistence", async ({ page }) => {
  const fixture = await createAllProjectionKinds(page);
  let state = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());

  expect(state.mode).toBe("select");
  expect(state.constraints.map((item) => item.kind).sort()).toEqual(["arc", "circle", "line", "line", "point", "spline"]);
  expect(state.constraints.every((item) => item.sketchId === fixture.targetSketchId && item.referenceSketchId === fixture.sourceSketchId)).toBe(true);
  expect(state.constraints.every((item) => item.color === "#0F766E")).toBe(true);
  const targetLines = state.constraints.filter((item) => item.kind === "line").map((item) => item.target);
  expect(targetLines[0].p2).toBe(targetLines[1].p1);

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

test("direct drag unlinks affected targets in one undo unit and manual removal leaves geometry", async ({ page }) => {
  await createAllProjectionKinds(page);
  const selected = await page.evaluate(() => window.__jot2dTest.selectSketchProjectionTargetForTest("line"));
  const before = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  await page.mouse.move(selected.client.x, selected.client.y);
  await page.mouse.down();
  await page.mouse.move(selected.client.x + 34, selected.client.y + 18, { steps: 4 });
  await page.mouse.up();

  let after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints.length).toBeLessThan(before.constraints.length);
  expect(after.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);

  await page.keyboard.press("Control+z");
  after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints).toHaveLength(6);
  await page.keyboard.press("Control+y");
  after = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(after.constraints.length).toBeLessThan(6);

  await page.evaluate(() => window.__jot2dTest.removeFirstSketchProjectionConstraintForTest());
  const manual = await page.evaluate(() => window.__jot2dTest.sketchProjectionStateForTest());
  expect(manual.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);
});

test("individual appearance editing unlinks only the edited projected geometry", async ({ page }) => {
  await createAllProjectionKinds(page);
  const result = await page.evaluate(() => window.__jot2dTest.setSketchProjectionAppearanceForTest("line"));
  expect(result.changed).toBe(true);
  expect(result.before).toBe(6);
  expect(result.state.constraints).toHaveLength(5);
  expect(result.state.constraints.filter((link) => link.kind === "line")).toHaveLength(1);
  expect(result.state.serialized.lines.filter((line) => line.sketchId === "S3")).toHaveLength(2);
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
