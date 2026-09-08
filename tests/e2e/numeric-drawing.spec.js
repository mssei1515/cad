const { test, expect, openTestDocument } = require("./test-fixture");

const state = (page) => page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState() }));
async function values(page, fields) {
  for (const [key, value] of Object.entries(fields)) await page.locator(`#draw-${key}`).fill(String(value));
}

for (const tool of ["Rectangle", "Circle"]) {
  test(`${tool}: provisional anchor leaves no geometry or history, complete shape is atomic`, async ({ page }) => {
    await openTestDocument(page);
    const before = await state(page);
    await page.click(`#tool${tool}`);
    await page.mouse.click(430, 330);
    expect((await state(page)).model.points).toEqual(before.model.points);
    expect((await state(page)).history).toEqual(before.history);
    await page.keyboard.press("Escape");
    expect((await state(page)).history).toEqual(before.history);
    await page.click(`#tool${tool}`);
    await page.mouse.click(430, 330);
    await page.mouse.click(680, 530);
    const after = await state(page);
    expect(after.history.undoCount).toBe(before.history.undoCount + 1);
    await page.click("#undoBtn");
    expect((await state(page)).model.points).toEqual(before.model.points);
    const undone = await state(page);
    await page.click(`#tool${tool}`);
    await page.mouse.click(430, 330);
    await page.keyboard.press("Escape");
    await page.click("#toolSelect");
    expect((await state(page)).history).toEqual(undone.history);
    await page.click("#redoBtn");
    expect((await state(page)).model.points).toEqual(after.model.points);
  });
}

test("mounting plate has exact dimensions and independent holes; invalid input is nonmutating", async ({ page }) => {
  await openTestDocument(page);
  await page.click("#toolRectangle");
  const before = await state(page);
  await values(page, { width: -120, height: 80 });
  await page.click("#createNumericShapeBtn");
  await expect(page.locator("#drawingInputError")).toBeVisible();
  expect((await state(page)).history).toEqual(before.history);
  await values(page, { x: 0, y: 0, width: 120 });
  await page.check("#draw-fixed");
  await page.locator("#draw-height").press("Enter");
  const rectangle = await state(page);
  expect(rectangle.model.points.map(({ x, y }) => [x, y])).toEqual([[0, 0], [120, 0], [120, 80], [0, 80]]);
  expect(rectangle.model.lines).toHaveLength(4);
  expect(rectangle.model.constraints).toHaveLength(6);
  await page.click("#toolCircle");
  await page.check("#draw-fixed");
  await values(page, { x: 60, y: 40, diameter: 32 });
  await page.click("#createNumericShapeBtn");
  await values(page, { diameter: 8 });
  for (const [x, y] of [[10, 10], [110, 10], [110, 70], [10, 70]]) {
    await values(page, { x, y });
    await page.click("#createNumericShapeBtn");
  }
  const plate = await state(page);
  expect(plate.model.circles).toHaveLength(5);
  expect(plate.model.points.slice(4).map(({ x, y }) => [x, y])).toEqual([[60, 40], [10, 10], [110, 10], [110, 70], [10, 70]]);
  expect(plate.model.constraints.filter((c) => c.type === "diameterDimension").map((c) => c.target)).toEqual([32, 8, 8, 8, 8]);
  expect(plate.model.constraints.filter((c) => c.type === "diameterDimension").every((c) => c.dimension.display.prefix === "Ø")).toBe(true);
  expect(plate.history.undoCount).toBe(before.history.undoCount + 6);
  await page.click("#finishNumericDrawingBtn");
  await expect(page.locator("#numericDrawingForm")).toHaveCount(0);
  if (process.env.JOT2D_WRITE_EXAMPLE === "1") {
    const fs = require("node:fs");
    fs.mkdirSync("examples", { recursive: true });
    fs.writeFileSync("examples/mounting-plate.jot2d", JSON.stringify({ ...plate.model, documentName: "機械用取付プレート" }, null, 2) + "\n");
    await page.locator("#canvas").dblclick({ button: "middle", position: { x: 650, y: 400 } });
    await page.screenshot({ path: "examples/mounting-plate.png" });
  }
});

test("numeric rectangle repeat and root restriction", async ({ page }) => {
  await openTestDocument(page);
  await page.click("#toolRectangle");
  await values(page, { width: 20, height: 10 });
  await page.check("#draw-repeat");
  await page.mouse.click(430, 330);
  await page.mouse.click(680, 530);
  expect((await state(page)).model.lines).toHaveLength(8);
  await page.click("#finishNumericDrawingBtn");
  await page.getByRole("button", { name: "Root Sketch", exact: true }).click();
  await page.click("#toolCircle");
  await values(page, { diameter: 8 });
  const before = await state(page);
  await page.click("#createNumericShapeBtn");
  expect((await state(page)).model.points).toEqual(before.model.points);
  expect((await state(page)).history).toEqual(before.history);
});

test("numeric circle preserves the exact snapped center and input Undo does not undo geometry", async ({ page }) => {
  await openTestDocument(page);
  await page.click("#toolRectangle");
  await values(page, { width: 20, height: 10 });
  await page.click("#createNumericShapeBtn");
  await page.click("#finishNumericDrawingBtn");
  const view = await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
  await page.click("#toolCircle");
  const before = await state(page);
  await page.mouse.click(view.canvas.left + view.canvas.width / 2 + 1, view.canvas.top + view.canvas.height / 2 + 1);
  expect((await state(page)).model.points).toEqual(before.model.points);
  await values(page, { diameter: 8 });
  await page.click("#createNumericShapeBtn");
  const after = await state(page);
  expect(after.model.points.at(-1).x).toBe(0);
  expect(after.model.points.at(-1).y).toBe(0);
  expect(after.model.constraints.some((c) => c.type === "coincident")).toBe(true);
  await page.locator("#draw-diameter").press("Control+z");
  expect((await state(page)).history).toEqual(after.history);
});

test("saved mounting plate round trips with driving dimensions", async ({ page }) => {
  await openTestDocument(page);
  const fs = require("node:fs");
  const plate = JSON.parse(fs.readFileSync("examples/mounting-plate.jot2d", "utf8"));
  await page.evaluate(async (data) => window.__jot2dTest.importDocumentNameFixture(data, "mounting-plate.jot2d"), plate);
  const loaded = (await state(page)).model;
  expect(loaded.points).toEqual(plate.points);
  expect(loaded.circles).toEqual(plate.circles);
  expect(loaded.constraints.map(({ type, target }) => ({ type, target }))).toEqual(plate.constraints.map(({ type, target }) => ({ type, target })));
});

test("failed solve rolls back the shape and newly allocated dimension parameters", async ({ page }) => {
  await openTestDocument(page);
  const fs = require("node:fs");
  const plate = JSON.parse(fs.readFileSync("examples/mounting-plate.jot2d", "utf8"));
  plate.points.forEach((point) => { point.fixed = true; });
  const width = plate.constraints.find((constraint) => constraint.type === "distance");
  width.target = 121;
  width.expression = "121";
  await page.evaluate(async (data) => window.__jot2dTest.importDocumentNameFixture(data, "conflict.jot2d"), plate);
  await page.click("#toolCircle");
  await values(page, { x: 150, y: 150, diameter: 8 });
  const before = await state(page);
  await page.click("#createNumericShapeBtn");
  const after = await state(page);
  for (const key of ["points", "lines", "circles", "constraints", "parameters", "nextDimensionParameterIndex"]) {
    expect(after.model[key]).toEqual(before.model[key]);
  }
  expect(after.history).toEqual(before.history);
});

test("repeat placement creates one sized circle per click and retains the diameter", async ({ page }) => {
  await openTestDocument(page);
  await page.click("#toolCircle");
  await values(page, { diameter: 8 });
  await page.check("#draw-repeat");
  const before = await state(page);
  await page.mouse.click(430, 330);
  await page.mouse.click(680, 530);
  const after = await state(page);
  expect(after.model.circles).toHaveLength(2);
  expect(after.model.constraints.filter((c) => c.type === "diameterDimension").map((c) => c.target)).toEqual([8, 8]);
  expect(after.history.undoCount).toBe(before.history.undoCount + 2);
  await expect(page.locator("#draw-diameter")).toHaveValue("8");
  await page.click("#undoBtn");
  expect((await state(page)).model.circles).toHaveLength(1);
});
