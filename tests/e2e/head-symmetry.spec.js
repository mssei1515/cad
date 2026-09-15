const fs = require("node:fs");
const path = require("node:path");
const { test, expect, openTestDocument } = require("./test-fixture");

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../fixtures/${name}.jot2d`), "utf8"));
}

async function expectFullyConstrained(page, duplicates) {
  const status = await page.evaluate(() => window.__jot2dTest.constraintStatusesForTest());
  expect(status.stable).toBe(true);
  expect(status.freeDof).toBe(0);
  for (const id of ["L20", "L21"]) expect(status.items.find(item => item.id === id).status).toBe("full");
  await expect(page.locator("#statusConstraint")).toContainText(`重複拘束: ${duplicates}`);
}

test("the fully constrained asymmetric head rejects an additional dependent symmetry without changing shape or history", async ({ page }) => {
  await openTestDocument(page);
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "head.jot2d", { resetLoadedHistory: true }), fixture("head-symmetry"))).toMatchObject({ success: true });
  await expectFullyConstrained(page, 1);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 187, y: 110 }, 15));
  const before = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState() }));
  await page.click('[data-constraint="symmetry"]');
  for (const id of ["L9", "L20", "L21"]) {
    const p = await page.evaluate(id => window.__jot2dTest.geometryClientPositionForTest("line", id), id);
    await page.mouse.click(p.x, p.y);
  }
  await expect(page.locator("#hint")).toContainText("重複しています");
  const after = await page.evaluate(() => ({ model: window.__jot2dTest.serializedModelForTest(), history: window.__jot2dTest.historyState() }));
  for (const key of ["points", "lines", "arcs", "circles", "constraints"]) expect(after.model[key]).toEqual(before.model[key]);
  expect(after.history).toEqual(before.history);
  await expectFullyConstrained(page, 1);
});

test("the symmetric alternate solution is already fully constrained without the extra symmetry", async ({ page }) => {
  await openTestDocument(page);
  const alternate = fixture("head-symmetry-alternate");
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), alternate)).toMatchObject({ success: true });
  await expectFullyConstrained(page, 2);
  alternate.constraints = alternate.constraints.filter(c => !(c.type === "lineSymmetry" && c.line1 === "L20" && c.line2 === "L21" && c.axis === "L9"));
  const conditions = data => data.constraints.map(({ dimension, ...condition }) => condition);
  expect(conditions(alternate)).toEqual(conditions(fixture("head-symmetry")));
  expect(await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), alternate)).toMatchObject({ success: true });
  await expectFullyConstrained(page, 1);
  const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const x = id => saved.points.find(p => p.id === saved.lines.find(l => l.id === id).p1).x;
  expect(Math.abs((x("L20") + x("L21")) / 2 - x("L9"))).toBeLessThan(1e-6);
});
