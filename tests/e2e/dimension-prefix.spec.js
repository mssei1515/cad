const { test, expect, openTestDocument } = require('./test-fixture');

for (const [key, type, prefix, value] of [
  ['circle1', 'diameter', 'Φ', '60'],
  ['arc1', 'radius', 'R', '80'],
]) {
  test(`${type} dimensions initialize their editable prefix and preserve it through history and reload`, async ({ page }) => {
    await openTestDocument(page);
    const points = await page.evaluate(() => window.__jot2dTest.resetForLineCircleAndRadiusDifferenceDimensions());
    await page.locator('[data-constraint="distance"]').click();
    await page.mouse.click(points[key].x, points[key].y);
    const blank = await page.evaluate(() => window.__jot2dTest.worldClientPositionForTest({ x: -160, y: -120 }));
    await page.mouse.click(blank.x, blank.y);
    await page.mouse.click(blank.x + 20, blank.y + 20);
    await expect(page.locator('#dimensionValueInput')).toBeVisible();
    await page.locator('#dimensionValueInput').fill(value);
    await page.locator('#dimensionValueInput').press('Enter');
    const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(saved.constraints).toHaveLength(1);
    expect(saved.constraints[0]).toMatchObject({ type: `${type}Dimension`, dimension: { display: { prefix } } });
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__jot2dTest.selectDimensionForPropertiesForTest(0));
    await expect(page.locator('[data-dimension-display="prefix"]')).toHaveValue(prefix);
    await page.locator('[data-dimension-display="prefix"]').fill('custom ');
    await page.locator('[data-dimension-display="prefix"]').blur();
    const custom = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(custom.constraints[0].dimension.display.prefix).toBe('custom ');
    await page.keyboard.press('Control+z');
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints[0].dimension.display.prefix).toBe(prefix);
    await page.keyboard.press('Control+y');
    expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'prefix.jot2d'), custom)).success).toBe(true);
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints[0].dimension.display.prefix).toBe('custom ');
    delete saved.constraints[0].dimension.display.prefix;
    expect((await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, 'legacy-prefix.jot2d'), saved)).success).toBe(true);
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).constraints[0].dimension.display.prefix).toBeUndefined();
  });
}
