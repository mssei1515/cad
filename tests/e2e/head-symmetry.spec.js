const fs = require("node:fs");
const path = require("node:path");
const { test, expect, openTestDocument } = require("./test-fixture");

test("a symmetry that changes the head is retained even when its solved Jacobian is dependent", async ({ page }) => {
  await openTestDocument(page);
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/head-symmetry.jot2d"), "utf8"));
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "head.jot2d", { resetLoadedHistory: true }), fixture)).toMatchObject({ success: true });
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 187, y: 110 }, 15));
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  async function addSymmetry() {
    await page.click('[data-constraint="symmetry"]');
    for (const id of ["L9", "L20", "L21"]) {
      const p = await page.evaluate(id => window.__jot2dTest.geometryClientPositionForTest("line", id), id);
      await page.mouse.click(p.x, p.y);
    }
  }
  const offset = data => {
    const p = id => data.points.find(p => p.id === data.lines.find(l => l.id === id).p1);
    return (p("L20").x + p("L21").x) / 2 - p("L9").x;
  };
  expect(Math.abs(offset(before))).toBeGreaterThan(0.3);
  await addSymmetry();
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(saved.constraints).toHaveLength(before.constraints.length + 1);
  expect(saved.constraints.at(-1)).toMatchObject({ type: "lineSymmetry", line1: "L20", line2: "L21", axis: "L9", enabled: true });
  expect(Math.abs(offset(saved))).toBeLessThan(1e-6);
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).stable).toBe(true);
  await page.click("#undoBtn");
  const undone = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  for (const key of ["points", "lines", "arcs", "circles", "constraints"]) expect(undone[key]).toEqual(before[key]);
  await page.click("#redoBtn");
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints).toEqual(saved.constraints);
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).toMatchObject({ success: true });
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).stable).toBe(true);
  await addSymmetry();
  await expect(page.locator("#hint")).toContainText("重複");
  const duplicate = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  for (const key of ["points", "lines", "arcs", "circles", "constraints"]) expect(duplicate[key]).toEqual(saved[key]);
});
