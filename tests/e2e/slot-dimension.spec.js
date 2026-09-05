const fs = require("node:fs");
const path = require("node:path");
const { test, expect, openTestDocument } = require("./test-fixture");

for (const editor of ["canvas", "properties"]) test(`slot center distance d9 can grow from 30 to 100 via ${editor}`, async ({ page }) => {
  await openTestDocument(page);
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/slot-dimension.jot2d"), "utf8"));
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "slot.jot2d", { resetLoadedHistory: true }), fixture)).toMatchObject({ success: true });
  if (editor === "canvas") await page.evaluate(() => window.__jot2dTest.startDimensionExpressionEditForTest(8));
  else await page.evaluate(() => window.__jot2dTest.selectDimensionForPropertiesForTest(8));
  const input = page.locator(editor === "canvas" ? "#dimensionValueInput" : '[data-property="constraint-expression"]');
  await input.fill("100");
  await input.press("Enter");
  if (editor === "canvas") await expect(input).toBeHidden();
  const analysis = await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest());
  expect(analysis.stable).toBe(true);
  expect(analysis.errorNorm).toBeLessThan(1e-4);
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(saved.constraints.find((constraint) => constraint.parameterName === "d9").target).toBe(100);
  expect(saved.constraints).toHaveLength(fixture.constraints.length);
  expect(saved.constraints.every((constraint) => constraint.enabled)).toBe(true);
  const start = saved.points.find((point) => point.id === "P17");
  const end = saved.points.find((point) => point.id === "P18");
  expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(100, 5);
  for (const arc of saved.arcs) {
    expect(arc.radius).toBeCloseTo(2.5, 5);
    expect(arc.endAngle - arc.startAngle).toBeGreaterThan(3.13);
    expect(arc.endAngle - arc.startAngle).toBeLessThan(3.16);
  }
  await page.click("#undoBtn");
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints.find((constraint) => constraint.parameterName === "d9").target).toBe(30);
  await page.click("#redoBtn");
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints.find((constraint) => constraint.parameterName === "d9").target).toBe(100);
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).stable).toBe(true);
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).toMatchObject({ success: true });
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).stable).toBe(true);
});
