const { test, expect, openTestDocument } = require("./test-fixture");

for (const scenario of [
  { name: "circle", tool: "#toolCircle", points: [{ x: 0, y: 0 }, { x: 40, y: 0 }], circles: 1, arcs: 0 },
  { name: "center arc", tool: "#toolArc", points: [{ x: -40, y: 0 }, { x: 0, y: 0 }, { x: -40, y: 40 }], circles: 0, arcs: 1 },
  { name: "three-point arc", tool: "#toolThreePointArc", points: [{ x: -40, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }], circles: 0, arcs: 1 },
]) {
  test(`${scenario.name} creation is one undo step and survives redo and file reload`, async ({ page }) => {
    await openTestDocument(page);
    await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
    const clients = await page.evaluate(points => points.map(point => window.__jot2dTest.worldClientPositionForTest(point)), scenario.points);
    await page.locator(scenario.tool).click();
    for (const point of clients) await page.mouse.click(point.x, point.y);
    const completed = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(completed.circles).toHaveLength(scenario.circles); expect(completed.arcs).toHaveLength(scenario.arcs); expect(completed.points).toHaveLength(1);
    // Document restoration has always normalized circular centers to endpoint kind.
    const restored = { ...completed, points: completed.points.map(point => ({ ...point, kind: "endpoint" })) };
    await page.locator("#undoBtn").click();
    const undone = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    for (const key of ["points", "circles", "arcs", "constraints"]) expect(undone[key]).toHaveLength(0);
    await page.locator("#redoBtn").click();
    const redone = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    for (const key of ["points", "circles", "arcs", "constraints"]) expect(redone[key]).toEqual(restored[key]);
    const loaded = await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "circular-roundtrip.jot2d"), completed);
    expect(loaded.success).toBe(true);
    const reloaded = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    for (const key of ["points", "circles", "arcs", "constraints"]) expect(reloaded[key]).toEqual(restored[key]);
  });
}
