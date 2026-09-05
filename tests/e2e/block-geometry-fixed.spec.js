const { test, expect, openTestDocument, completeBlockEdit } = require("./test-fixture");

async function setup(page) {
  await openTestDocument(page);
  const base = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const sketches = [{ id: "ROOT", name: "Root", parentSketchId: null, kind: "root" }, { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch" }];
  const definition = {
    id: "B1", name: "Link", origin: { x: 0, y: 0 }, revision: 1, sketches, activeSketchId: "S1",
    points: [{ id: "P6", x: -30, y: 0, fixed: false, kind: "explicit", sketchId: "S1" }, { id: "P7", x: 30, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" }],
    lines: [{ id: "L1", p1: "P6", p2: "P7", sketchId: "S1" }],
    circles: [{ id: "C1", center: "P6", radius: 20, sketchId: "S1" }],
    arcs: [{ id: "A1", center: "P6", radius: 35, startAngle: 0, endAngle: Math.PI / 2, sketchId: "S1" }],
    splines: [], annotations: [], hatches: [], referenceImages: [], constraints: [], blockInstances: [], geometryInstances: [], parameters: [], nextHatchIndex: 1, nextDimensionParameterIndex: 1,
  };
  const data = { ...base, sketches, activeSketchId: "S1", points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [], referenceImages: [], constraints: [], geometryInstances: [], parameters: [], blockDefinitions: [definition], blockInstances: [{ id: "BI1", definitionId: "B1", sketchId: "S1", x: 30, y: 0, rotation: 0, fixed: false, rotationLocked: false, enabledSketchIds: ["S1"] }] };
  const loaded = await page.evaluate((fixture) => window.__jot2dTest.loadDocumentFixtureForDragTest(fixture, "pivot.jot2d", { resetLoadedHistory: true }), data);
  expect(loaded.error).toBeUndefined();
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
}

const state = (page) => page.evaluate(() => ({ data: window.__jot2dTest.serializedModelForTest(), analysis: window.__jot2dTest.constraintAnalysisForTest() }));
const client = (page, point) => page.evaluate((p) => window.__jot2dTest.worldClientPositionForTest(p), point);
async function clickTarget(page, point) {
  const p = await client(page, point);
  await page.mouse.click(p.x, p.y);
}

for (const target of [
  { name: "point", point: { x: 0, y: 0 }, type: "geometryFixed", kind: "point", free: 1 },
  { name: "line", point: { x: 25, y: 0 }, type: "lineFixed", free: 0 },
  { name: "circle", point: { x: -20, y: 0 }, type: "geometryFixed", kind: "circle", free: 1 },
  { name: "arc", point: { x: 35 / Math.sqrt(2), y: 35 / Math.sqrt(2) }, type: "geometryFixed", kind: "arc", free: 0 },
  { name: "arc endpoint", point: { x: 0, y: 35 }, type: "arcEndpointFixed", free: 1 },
]) {
  test(`fixing a block ${target.name} preserves the correct freedoms and survives reload`, async ({ page }) => {
    await setup(page);
    const before = await state(page);
    await page.click("#fixPointBtn");
    await clickTarget(page, target.point);
    const fixed = await state(page);
    expect(fixed.data.blockInstances[0]).toMatchObject({ fixed: false, rotationLocked: false });
    expect(fixed.data.blockDefinitions).toEqual(before.data.blockDefinitions);
    expect(fixed.data.constraints).toHaveLength(1);
    expect(fixed.data.constraints[0]).toMatchObject({ type: target.type, ...(target.kind ? { kind: target.kind } : {}) });
    expect(fixed.analysis).toMatchObject({ stable: true, freeVariableCount: target.free });
    await clickTarget(page, target.point);
    expect((await state(page)).data.constraints).toHaveLength(0);
    await page.keyboard.press("Escape");
    await page.click("#undoBtn");
    expect((await state(page)).analysis).toMatchObject({ stable: true, freeVariableCount: target.free });
    await page.click("#redoBtn");
    expect((await state(page)).data.constraints).toHaveLength(0);
    const reload = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data), fixed.data);
    expect(reload.error).toBeUndefined();
    await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
    expect((await state(page)).analysis).toMatchObject({ stable: true, freeVariableCount: target.free });
    await page.click("#fixPointBtn");
    await clickTarget(page, target.point);
    expect((await state(page)).data.constraints).toHaveLength(0);
  });
}

test("a fixed block point stays in place while dragging rotates its link", async ({ page }) => {
  await setup(page);
  await page.click("#fixPointBtn");
  await clickTarget(page, { x: 0, y: 0 });
  await page.keyboard.press("Escape");
  const from = await client(page, { x: 50, y: 0 });
  const to = await client(page, { x: 35, y: 35 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const result = await state(page);
  expect(result.analysis.stable).toBe(true);
  expect(result.analysis.errorNorm).toBeLessThan(1e-4);
  expect(Math.abs(result.data.blockInstances[0].rotation)).toBeGreaterThan(0.1);
  const instance = result.data.blockInstances[0];
  expect(instance.x - 30 * Math.cos(instance.rotation)).toBeCloseTo(0, 4);
  expect(instance.y - 30 * Math.sin(instance.rotation)).toBeCloseTo(0, 4);
  await page.keyboard.press("Escape");
  await page.click("#fixPointBtn");
  await clickTarget(page, { x: 0, y: 0 });
  expect((await state(page)).data.constraints).toHaveLength(0);
});

test("fixing a block circle survives wrapping into a new definition", async ({ page }) => {
  await setup(page);
  await page.click("#fixPointBtn");
  await clickTarget(page, { x: -20, y: 0 });
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));
  await page.click("#toolCreateBlock");
  expect((await state(page)).analysis).toMatchObject({ stable: true, freeVariableCount: 1 });
  await completeBlockEdit(page);
  const wrapped = await state(page);
  const definition = wrapped.data.blockDefinitions.find((item) => item.constraints.some((c) => c.type === "geometryFixed"));
  expect(definition).toBeDefined();
  const constraint = definition.constraints.find((c) => c.type === "geometryFixed");
  expect(constraint.x).toBeCloseTo(definition.blockInstances[0].x - 30, 5);
  const loaded = await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data), wrapped.data);
  expect(loaded.error).toBeUndefined();
  expect((await state(page)).data.blockDefinitions.find((item) => item.id === definition.id).constraints).toEqual(definition.constraints);
});

test("deleting an instance also deletes its individual fixed constraints", async ({ page }) => {
  await setup(page);
  await page.click("#fixPointBtn");
  await clickTarget(page, { x: 0, y: 0 });
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));
  await page.keyboard.press("Delete");
  const result = await state(page);
  expect(result.data.blockInstances).toHaveLength(0);
  expect(result.data.constraints).toHaveLength(0);
});

