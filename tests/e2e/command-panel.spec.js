const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});
const panel = page => page.locator("#commandPanel");
const finish = page => panel(page).locator('[data-action="finish"]');
const instances = page => page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest().serialized.geometryInstances);

test('blank double click cancels projection draft while source clicks keep the panel open', async ({ page }) => {
  const f = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionTest());
  await page.click('#toolSketchProjection');
  await page.mouse.dblclick(f.clients.line1.x, f.clients.line1.y);
  await expect(panel(page)).toBeVisible();
  await page.mouse.click(f.clients.line1.x, f.clients.line1.y);
  await expect(finish(page)).toBeEnabled();
  const box = await page.locator('#canvas').boundingBox();
  const blank = { x: box.x + 25, y: box.y + box.height - 25 };
  await page.mouse.click(blank.x, blank.y);
  await expect(panel(page)).toBeVisible();
  await page.mouse.dblclick(blank.x, blank.y);
  await expect(panel(page)).toBeHidden();
  expect(await instances(page)).toHaveLength(0);
});

test("projection panel follows selections, completion, cancel and command switching", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionTest());
  await expect(panel(page)).toBeHidden();
  await page.click("#toolSketchProjection");
  await expect(panel(page)).toBeVisible();
  await expect(finish(page)).toBeDisabled();
  await expect(panel(page)).toContainText("投影対象: 0");
  await page.mouse.click(fixture.clients.line1.x, fixture.clients.line1.y);
  await expect(panel(page)).toContainText("投影対象: 1");
  await expect(finish(page)).toBeEnabled();
  await page.mouse.click(fixture.clients.line1.x, fixture.clients.line1.y);
  await expect(finish(page)).toBeDisabled();
  await page.mouse.click(fixture.clients.line1.x, fixture.clients.line1.y);
  await finish(page).click();
  await expect(panel(page)).toBeHidden();
  expect(await instances(page)).toHaveLength(1);
  await page.click("#toolSketchProjection");
  await panel(page).locator('[data-action="cancel"]').click();
  await expect(panel(page)).toBeHidden();
  expect(await instances(page)).toHaveLength(1);
  await page.click("#toolSketchProjection");
  await page.click("#toolLine");
  await expect(panel(page)).toBeHidden();
});

test('projection and source editing rows remove only draft selections', async ({ page }) => {
  const f = await page.evaluate(() => window.__jot2dTest.resetForSketchProjectionTest());
  await page.click('#toolSketchProjection'); await page.mouse.click(f.clients.line1.x,f.clients.line1.y);
  const row = panel(page).locator('[data-input="sources"][data-input-item="0"]');
  await row.click(); await row.press('Delete'); await expect(finish(page)).toBeDisabled();
  await page.mouse.click(f.clients.line1.x,f.clients.line1.y); await finish(page).click();
  await page.click('[data-property-action="instance-sources"]');
  await row.click(); await row.press('Delete'); await expect(finish(page)).toBeDisabled();
  expect((await instances(page))[0].sources).toHaveLength(1);
  await panel(page).locator('[data-action="cancel"]').click();
  expect((await instances(page))[0].sources).toHaveLength(1);
});
