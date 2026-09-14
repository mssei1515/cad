const fs = require("node:fs");
const path = require("node:path");
const { test, expect, openTestDocument } = require("./test-fixture");

for (const editor of ["canvas", "properties"]) for (const diameter of [9, 8, 6, 4, 3]) test(`bolt diameter can shrink from 10 to ${diameter} via ${editor}`, async ({ page }) => {
  await openTestDocument(page);
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/bolt-diameter.jot2d"), "utf8"));
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "bolt.jot2d", { resetLoadedHistory: true }), fixture)).toMatchObject({ success: true });
  const index = fixture.constraints.filter(c => c.dimension).findIndex((constraint) => constraint.parameterName === "d3");
  if (editor === "canvas") await page.evaluate((index) => window.__jot2dTest.startDimensionExpressionEditForTest(index), index);
  else await page.evaluate((index) => window.__jot2dTest.selectDimensionForPropertiesForTest(index), index);
  const input = page.locator(editor === "canvas" ? "#dimensionValueInput" : '[data-property="constraint-expression"]');
  await input.fill(String(diameter));
  await input.press("Enter");
  if (editor === "canvas") await expect(input).toBeHidden();
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  for (const [name, target] of Object.entries({ d3: diameter, d4: 0.6 * diameter, d7: 0.1 * diameter, d12: 1.5 * diameter, d13: 2 * diameter })) {
    expect(saved.constraints.find((constraint) => constraint.parameterName === name).target).toBeCloseTo(target, 8);
  }
  expect(saved.constraints).toHaveLength(fixture.constraints.length);
  expect(saved.constraints.every((constraint) => constraint.enabled)).toBe(true);
  for (const arc of saved.arcs) {
    expect(arc.radius).toBeGreaterThan(1e-6);
    expect(Math.abs(arc.endAngle - arc.startAngle)).toBeLessThan(2 * Math.PI);
  }
  const analysis = await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest());
  expect(analysis.stable).toBe(true);
  expect(analysis.errorNorm).toBeLessThan(1e-4);
  await page.click("#undoBtn");
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints.find(c => c.parameterName === "d3").target).toBe(10);
  await page.click("#redoBtn");
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints.find(c => c.parameterName === "d3").target).toBe(diameter);
  expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).toMatchObject({ success: true });
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).stable).toBe(true);
});
