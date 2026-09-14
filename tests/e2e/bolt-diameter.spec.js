const fs = require("node:fs");
const path = require("node:path");
const { test, expect, openTestDocument } = require("./test-fixture");

function signedAngle(data, constraint) {
  const direction = (id) => {
    const line = data.lines.find(item => item.id === id);
    const a = data.points.find(item => item.id === line.p1);
    const b = data.points.find(item => item.id === line.p2);
    return { x: b.x - a.x, y: b.y - a.y };
  };
  const a = direction(constraint.line1), b = direction(constraint.line2);
  return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
}

for (const editor of ["canvas", "properties"]) for (const diameter of [9, 8, 6, 4, 3, 2, 1, 0.5, 0.1, 0.01, 0.001, 0.0001]) test(`bolt diameter can shrink from 10 to ${diameter} via ${editor}`, async ({ page }) => {
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
  for (const constraint of fixture.constraints.filter(item => item.type === "lineAngle")) {
    expect(signedAngle(saved, constraint), constraint.parameterName).toBeCloseTo(signedAngle(fixture, constraint), 5);
  }
  for (const id of ["L31", "L32"]) {
    const shoulder = { line1: "L1", line2: id };
    expect(signedAngle(saved, shoulder), id).toBeCloseTo(signedAngle(fixture, shoulder), 5);
  }
  for (const arc of saved.arcs) {
    expect(arc.radius).toBeGreaterThan(1e-6);
    expect(Math.abs(arc.endAngle - arc.startAngle)).toBeLessThan(2 * Math.PI);
    const original = fixture.arcs.find(item => item.id === arc.id);
    expect(Math.sign(arc.endAngle - arc.startAngle)).toBe(Math.sign(original.endAngle - original.startAngle));
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
  await page.evaluate((index) => window.__jot2dTest.selectDimensionForPropertiesForTest(index), index);
  const growInput = page.locator('[data-property="constraint-expression"]');
  await growInput.fill("10");
  await growInput.press("Enter");
  const grown = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(grown.constraints.find(c => c.parameterName === "d3").target).toBe(10);
  for (const id of ["L31", "L32"]) {
    const shoulder = { line1: "L1", line2: id };
    expect(signedAngle(grown, shoulder), id).toBeCloseTo(signedAngle(fixture, shoulder), 5);
  }
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).stable).toBe(true);
});

for (const editor of ["canvas", "properties"]) test(`impossible bolt shrink rolls back targets, geometry and history via ${editor}`, async ({ page }) => {
  await openTestDocument(page);
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/bolt-diameter.jot2d"), "utf8"));
  fixture.points.forEach(point => { point.fixed = true; });
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "fixed-bolt.jot2d", { resetLoadedHistory: true }), fixture)).toMatchObject({ success: true });
  const before = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState() }));
  const index = fixture.constraints.filter(c => c.dimension).findIndex(c => c.parameterName === "d3");
  if (editor === "canvas") await page.evaluate(index => window.__jot2dTest.startDimensionExpressionEditForTest(index), index);
  else await page.evaluate(index => window.__jot2dTest.selectDimensionForPropertiesForTest(index), index);
  const input = page.locator(editor === "canvas" ? "#dimensionValueInput" : '[data-property="constraint-expression"]');
  await input.fill("2");
  await input.press("Enter");
  const after = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState() }));
  for (const key of ["points", "lines", "circles", "arcs", "constraints", "parameters"]) expect(after.model[key], key).toEqual(before.model[key]);
  expect(after.history).toEqual(before.history);
});

test("parameter dialog shrinks the bolt without reversing either shoulder", async ({ page }) => {
  await openTestDocument(page);
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/bolt-diameter.jot2d"), "utf8"));
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "bolt.jot2d", { resetLoadedHistory: true }), fixture)).toMatchObject({ success: true });
  await page.locator(".app-menu > summary").first().click();
  await page.click("#parametersBtn");
  const input = page.locator('#parameterDimensionRows input[data-dimension-field="expression"]').first();
  await input.fill("0.001");
  await input.press("Tab");
  await page.click("#applyParametersBtn");
  await expect(page.locator("#parameterDialogError")).toBeHidden();
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(saved.constraints.find(c => c.parameterName === "d3").target).toBe(0.001);
  for (const id of ["L31", "L32"]) {
    const shoulder = { line1: "L1", line2: id };
    expect(signedAngle(saved, shoulder), id).toBeCloseTo(signedAngle(fixture, shoulder), 5);
  }
  expect((await page.evaluate(() => window.__jot2dTest.constraintAnalysisForTest())).stable).toBe(true);
});

test("a transition that reaches an impossible length restores every accepted intermediate step", async ({ page }) => {
  await openTestDocument(page);
  const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../fixtures/bolt-diameter.jot2d"), "utf8"));
  fixture.points = [
    { id: "P1", x: 0, y: 0, fixed: true, sketchId: "S1" },
    { id: "P2", x: Math.sqrt(91), y: 3, fixed: false, sketchId: "S1" },
    { id: "P3", x: 0, y: 3, fixed: true, sketchId: "S1" },
  ];
  fixture.lines = [{ id: "L1", p1: "P1", p2: "P2", sketchId: "S1" }];
  fixture.arcs = [];
  fixture.circles = [];
  fixture.constraints = [
    { type: "distance", p1: "P1", p2: "P2", target: 10, parameterName: "d3", expression: "10", dimension: { x: 5, y: 6 }, enabled: true, sketchId: "S1" },
    { type: "pointHorizontal", p1: "P2", p2: "P3", enabled: true, sketchId: "S1" },
  ];
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "length-limit.jot2d", { resetLoadedHistory: true }), fixture)).toMatchObject({ success: true });
  const before = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState() }));
  await page.evaluate(() => window.__jot2dTest.selectDimensionForPropertiesForTest(0));
  const input = page.locator('[data-property="constraint-expression"]');
  await input.fill("2");
  await input.press("Enter");
  const after = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState() }));
  expect(after.model.points).toEqual(before.model.points);
  expect(after.model.constraints).toEqual(before.model.constraints);
  expect(after.history).toEqual(before.history);
});
