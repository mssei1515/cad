const { test, expect, openTestDocument, completeBlockEdit } = require("./test-fixture");

async function loadFixture(page) {
  await openTestDocument(page);
  const fixture = {
    ...await saved(page),
    version: 22,
    units: { length: "mm" },
    splines: [], annotations: [], hatches: [], referenceImages: [], blockDefinitions: [], blockInstances: [], geometryInstances: [], parameters: [],
    sketches: [{ id: "ROOT", name: "Root", parentSketchId: null, kind: "root" }, { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch" }, { id: "S2", name: "Other", parentSketchId: "ROOT", kind: "sketch" }],
    activeSketchId: "S1",
    points: [
      { id: "P1", x: -90, y: -60, fixed: false, kind: "explicit", sketchId: "S1" },
      { id: "P2", x: -60, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
      { id: "P3", x: 60, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
      { id: "P4", x: 100, y: 60, fixed: false, kind: "center", sketchId: "S1" },
      { id: "P5", x: -100, y: 60, fixed: false, kind: "center", sketchId: "S1" },
      { id: "P6", x: 100, y: -60, fixed: false, kind: "explicit", sketchId: "S2" },
    ],
    lines: [{ id: "L1", p1: "P2", p2: "P3", sketchId: "S1" }],
    circles: [{ id: "C1", center: "P4", radius: 20, sketchId: "S1" }],
    arcs: [{ id: "A1", center: "P5", radius: 20, startAngle: 0, endAngle: Math.PI / 2, sketchId: "S1" }],
    constraints: [],
  };
  const loaded = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "fixed.jot2d", { resetLoadedHistory: true }), fixture);
  expect(loaded.error).toBeUndefined();
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 2));
}

async function clickWorld(page, x, y) {
  const position = await page.evaluate((point) => window.__jot2dTest.worldClientPositionForTest(point), { x, y });
  await page.mouse.click(position.x, position.y);
}

const saved = (page) => page.evaluate(() => {
  const data = window.__jot2dTest.serializedModelForTest();
  delete data.savedAt;
  return data;
});

test("fixed command accepts points, lines and arc endpoints after activation and supports undo", async ({ page }) => {
  await loadFixture(page);
  const button = page.locator("#fixPointBtn");
  await expect(button).toHaveAttribute("aria-disabled", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await clickWorld(page, -90, -60);
  expect((await saved(page)).points.find((point) => point.id === "P1").fixed).toBe(true);
  await clickWorld(page, -90, -60);
  expect((await saved(page)).points.find((point) => point.id === "P1").fixed).toBe(false);
  await clickWorld(page, 0, 0);
  expect((await saved(page)).constraints.filter((constraint) => constraint.type === "lineFixed")).toHaveLength(1);
  await clickWorld(page, -80, 60);
  expect((await saved(page)).constraints.filter((constraint) => constraint.type === "arcEndpointFixed")).toHaveLength(1);
  await clickWorld(page, -80, 60);
  expect((await saved(page)).constraints.filter((constraint) => constraint.type === "arcEndpointFixed")).toHaveLength(0);
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await clickWorld(page, 0, 0);
  expect((await saved(page)).constraints.filter((constraint) => constraint.type === "lineFixed")).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await page.click("#undoBtn");
  expect((await saved(page)).constraints.filter((constraint) => constraint.type === "lineFixed")).toHaveLength(1);
  await page.click("#redoBtn");
  expect((await saved(page)).constraints.filter((constraint) => constraint.type === "lineFixed")).toHaveLength(0);
});

test("unsupported targets and cancellation do not change geometry or history", async ({ page }) => {
  await loadFixture(page);
  const before = await saved(page);
  const history = await page.evaluate(() => window.__jot2dTest.historyState());
  const button = page.locator("#fixPointBtn");
  await button.click();
  for (const [x, y] of [[100, 80], [100, -60], [0, -90]]) await clickWorld(page, x, y);
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await saved(page)).toEqual(before);
  expect(await page.evaluate(() => window.__jot2dTest.historyState())).toEqual(history);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await page.click("#toolLine");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await saved(page)).toEqual(before);
});

test("fixed command fixes the owning block when a projected line is clicked", async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await completeBlockEdit(page);
  await page.keyboard.press("Escape");
  const data = await saved(page);
  const instance = data.blockInstances[0];
  const definition = data.blockDefinitions.find((item) => item.id === instance.definitionId);
  const line = definition.lines[0];
  const a = definition.points.find((point) => point.id === line.p1);
  const b = definition.points.find((point) => point.id === line.p2);
  const x = instance.x + (a.x + b.x) / 2;
  const y = instance.y + (a.y + b.y) / 2;
  await page.locator("#fixPointBtn").click();
  await clickWorld(page, x, y);
  expect((await saved(page)).blockInstances[0].fixed).toBe(true);
  await clickWorld(page, x, y);
  expect((await saved(page)).blockInstances[0].fixed).toBe(false);
  await clickWorld(page, instance.x + a.x, instance.y + a.y);
  expect((await saved(page)).blockInstances[0].fixed).toBe(true);
  expect((await saved(page)).blockDefinitions[0].points).toEqual(definition.points);
});
