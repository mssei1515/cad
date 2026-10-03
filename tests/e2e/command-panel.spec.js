const { test, expect } = require("./test-fixture");

test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.__jot2dTest));
});
const panel = page => page.locator("#commandPanel");
const finish = page => panel(page).locator('[data-action="finish"]');
const instances = page => page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest().serialized.geometryInstances);

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

test("mirror requires explicit completion and Escape from a panel control cancels", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  await page.evaluate(id => window.__jot2dTest.selectGeometryIdsForTest({ lines: [id] }), fixture.sourceId);
  await page.click("#toolMirror");
  await expect(panel(page)).toContainText("複写元: 1");
  await expect(panel(page)).toContainText(fixture.sourceId);
  await expect(finish(page)).toBeDisabled();
  await page.mouse.click(fixture.axis.x, fixture.axis.y);
  expect(await instances(page)).toHaveLength(0);
  await expect(panel(page)).toContainText("対称軸: 1");
  await finish(page).click();
  await expect(panel(page)).toBeHidden();
  expect(await instances(page)).toHaveLength(1);
  await page.evaluate(id => window.__jot2dTest.selectGeometryIdsForTest({ lines: [id] }), fixture.sourceId);
  await page.click("#toolMirror");
  await page.mouse.click(fixture.axis.x, fixture.axis.y);
  await finish(page).focus();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  expect(await instances(page)).toHaveLength(1);
});

test("pattern settings validate without prompts and Enter in a setting commits the final value", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  await page.evaluate(id => window.__jot2dTest.selectGeometryIdsForTest({ lines: [id] }), fixture.sourceId);
  await page.click("#toolPattern");
  await page.mouse.click(fixture.direction.x, fixture.direction.y);
  const spacing = panel(page).locator('[data-setting="spacing"]');
  const copies = panel(page).locator('[data-setting="copies"]');
  await spacing.fill("-2"); await spacing.blur();
  await expect(finish(page)).toBeDisabled();
  await expect(panel(page)).toContainText("間隔は正数");
  await spacing.fill("12.5"); await spacing.blur();
  await copies.fill("2.5"); await copies.blur();
  await expect(finish(page)).toBeDisabled();
  await panel(page).locator('[data-setting="reversed"]').check();
  await copies.fill("4"); await copies.press("Enter");
  await expect(panel(page)).toBeHidden();
  expect((await instances(page))[0]).toMatchObject({ spacing: 12.5, copies: 4, reversed: true });
});

test("editing a setting then clicking Finish preserves the last typed value", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  await page.evaluate(id => window.__jot2dTest.selectGeometryIdsForTest({ lines: [id] }), fixture.sourceId);
  await page.click("#toolPattern");
  await page.mouse.click(fixture.direction.x, fixture.direction.y);
  await panel(page).locator('[data-setting="copies"]').fill("7");
  await finish(page).click();
  expect((await instances(page))[0].copies).toBe(7);
  await expect(panel(page)).toBeHidden();
});

test("source editing panel cancels its draft and completes a changed source set", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  await page.evaluate(id => window.__jot2dTest.selectGeometryIdsForTest({ lines: [id] }), fixture.sourceId);
  await page.click("#toolMirror"); await page.mouse.click(fixture.axis.x, fixture.axis.y); await finish(page).click();
  await page.click('[data-property-action="instance-sources"]');
  await expect(panel(page)).toContainText("対象図形: 1");
  await page.mouse.click(fixture.direction.x, fixture.direction.y);
  await expect(panel(page)).toContainText("対象図形: 2");
  await panel(page).locator('[data-action="cancel"]').click();
  await expect(panel(page)).toBeHidden();
  expect((await instances(page))[0].sources).toHaveLength(1);
  await page.click('[data-property-action="instance-sources"]');
  await page.mouse.click(fixture.direction.x, fixture.direction.y); await finish(page).click();
  expect((await instances(page))[0].sources).toHaveLength(2);
  await expect(panel(page)).toBeHidden();
});

test("free placement settings share the existing draft and cancellation closes the panel", async ({ page }) => {
  const fixture = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  await page.evaluate(id => window.__jot2dTest.selectGeometryIdsForTest({ lines: [id] }), fixture.sourceId);
  await page.click("#toolFreeInstance");
  await expect(panel(page)).toContainText("配置基準点");
  const anchor = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: -55, y: 15 }));
  await page.mouse.click(anchor.x, anchor.y);
  await panel(page).locator('[data-setting="rotation"]').fill("30");
  await panel(page).locator('[data-setting="mirrorX"]').check();
  const destination = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: 40, y: 20 }));
  await page.locator('#commandPanel [role="listbox"][data-input="destination"]').click();
  await page.mouse.click(destination.x, destination.y);
  await finish(page).click();
  await expect(panel(page)).toBeHidden();
  expect((await instances(page))[0]).toMatchObject({ type: "free", rotation: Math.PI / 6, mirrorX: true });
  await page.evaluate(id => window.__jot2dTest.selectGeometryIdsForTest({ lines: [id] }), fixture.sourceId);
  await page.click("#toolFreeInstance");
  await panel(page).locator('[data-action="cancel"]').click();
  await expect(panel(page)).toBeHidden();
  expect(await instances(page)).toHaveLength(1);
});

test('empty starts allow reference first, row selection and removal without deleting geometry', async ({ page }) => {
  for (const tool of ['Mirror', 'Pattern']) {
    const f = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
    const source = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({x:-40,y:25}));
    await page.click('#tool' + tool);
    await expect(panel(page)).toContainText('複写元: 0');
    await page.locator('#commandPanel [role="listbox"][data-input="reference"]').click();
    await page.mouse.click(f.axis.x, f.axis.y);
    await page.locator('#commandPanel [role="listbox"][data-input="sources"]').click();
    await page.mouse.click(source.x, source.y);
    const row = panel(page).locator('[data-input="sources"][data-input-item="0"]');
    await row.click(); await expect(row).toHaveAttribute('aria-selected','true');
    await row.press('Enter'); expect(await instances(page)).toHaveLength(0);
    await row.press('Delete'); await expect(finish(page)).toBeDisabled();
    await expect(panel(page).locator('[data-input="reference"][data-input-item="0"]')).toBeVisible();
    await page.mouse.click(source.x,source.y);
    await expect(finish(page)).toBeEnabled();
    await page.keyboard.press('Enter'); expect(await instances(page)).toHaveLength(1);
    await page.click('#undoBtn'); expect(await instances(page)).toHaveLength(0);
    expect(await page.evaluate(() => window.__jot2dTest.derivedInstanceStateForTest().serialized.lines.length)).toBe(3);
  }
});

test('free inputs allow destination and settings before sources and anchor', async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  const points = await page.evaluate(() => [{x:40,y:20},{x:-40,y:25},{x:-55,y:15}].map(p=>window.__jot2dTest.worldClientPositionForTest(p)));
  await page.click('#toolFreeInstance');
  await panel(page).locator('[data-setting="rotation"]').fill('30');
  await page.locator('#commandPanel [role="listbox"][data-input="destination"]').click();
  await page.mouse.click(points[0].x,points[0].y);
  await page.locator('#commandPanel [role="listbox"][data-input="sources"]').click();
  await page.mouse.click(points[1].x,points[1].y);
  await page.locator('#commandPanel [role="listbox"][data-input="origin"]').click();
  await page.mouse.click(points[2].x,points[2].y);
  await expect(finish(page)).toBeEnabled(); expect(await instances(page)).toHaveLength(0);
  await panel(page).locator('[data-input="origin"][data-input-item="0"]').press('Backspace');
  await expect(finish(page)).toBeDisabled();
  await page.mouse.click(points[2].x,points[2].y);
  await finish(page).click();
  expect((await instances(page))[0]).toMatchObject({x:40,y:20,origin:{x:-55,y:15},rotation:Math.PI/6});
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

test('listboxes accept empty input selection and arrow-key target selection', async ({ page }) => {
  const f = await page.evaluate(() => window.__jot2dTest.resetForGeometryInstanceCommandTest());
  const source = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({x:-40,y:25}));
  await page.click('#toolMirror');
  const boxes = panel(page).getByRole('listbox');
  await boxes.nth(1).click();
  await expect(boxes.nth(1).locator('..')).toHaveClass(/active/);
  await expect(page.locator('#commandPanelInput-reference')).not.toHaveAttribute('aria-pressed');
  await expect(page.locator('#commandPanelInput-reference')).not.toHaveAttribute('role');
  await expect(page.locator('#commandPanelInput-reference')).not.toHaveAttribute('tabindex');
  await page.mouse.click(f.axis.x,f.axis.y);
  await boxes.nth(0).click();
  await page.mouse.click(source.x,source.y); await page.mouse.click(f.direction.x,f.direction.y);
  await boxes.nth(0).focus(); await page.keyboard.press('ArrowDown');
  await expect(boxes.nth(0).getByRole('option').nth(0)).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('End');
  await expect(boxes.nth(0).getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Delete');
  await expect(boxes.nth(0).getByRole('option')).toHaveCount(1);
  await expect(finish(page)).toBeEnabled();
});
