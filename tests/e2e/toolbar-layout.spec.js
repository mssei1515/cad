const { test, expect, openTestDocument } = require("./test-fixture");

test("Toolbar groups follow the requested order in two compact rows without clipping at desktop widths", async ({ page }) => {
  await openTestDocument(page);
  const rows = page.locator(".toolbar-row");
  await expect(rows).toHaveCount(2);
  expect(await rows.evaluateAll(items => items.map(row => [...row.children].map(group => group.getAttribute("aria-label"))))).toEqual([
    ["アプリ操作", "履歴関連操作", "選択", "作図", "実線／補助線 切り替え", "図形の表示／非表示 切り替え", "拘束状態表示との切り替え", "修正"],
    ["拘束・寸法", "ブロック", "参照・再利用", "注記・表現"],
  ]);
  expect(await page.locator('[aria-label="作図"] button').evaluateAll(buttons => buttons.map(button => button.id))).toEqual([
    "toolPoint", "toolLine", "toolRectangle", "toolSlot", "toolCircle", "toolArc", "toolThreePointArc", "toolSpline", "toolCenterline", "toolCircleCenterCross",
  ]);
  for (const width of [1280, 1024, 800]) {
    await page.setViewportSize({ width, height: 700 });
    const layout = await page.locator(".command-toolbar").evaluate(toolbar => {
      const bounds = toolbar.getBoundingClientRect();
      const buttons = [...toolbar.querySelectorAll("button")].map(button => button.getBoundingClientRect());
      return {
        height: bounds.height,
        fits: toolbar.scrollWidth === toolbar.clientWidth,
        inside: buttons.every(button => button.left >= bounds.left && button.right <= bounds.right && button.top >= bounds.top && button.bottom <= bounds.bottom),
        sizes: [...new Set(buttons.map(button => `${button.width}x${button.height}`))],
        levels: [...new Set(buttons.map(button => button.top))].length,
      };
    });
    expect(layout).toEqual({ height: 66, fits: true, inside: true, sizes: ["28x26"], levels: 2 });
  }
  await page.setViewportSize({ width: 500, height: 700 });
  const overflow = await page.locator(".command-toolbar").evaluate(toolbar => {
    toolbar.scrollLeft = toolbar.scrollWidth;
    const bounds = toolbar.getBoundingClientRect();
    const last = toolbar.querySelector(".toolbar-row:first-child .tool-group:last-child button:last-child").getBoundingClientRect();
    const lower = toolbar.querySelector(".toolbar-row:last-child button").getBoundingClientRect();
    return { scrollable: toolbar.scrollWidth > toolbar.clientWidth, endVisible: last.right <= bounds.right,
      lowerVisible: lower.bottom <= bounds.top + toolbar.clientHeight };
  });
  expect(overflow).toEqual({ scrollable: true, endVisible: true, lowerVisible: true });
});

test("Compact toolbar names stay localized in the English dark theme", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("jot2d.application.language", "en");
    localStorage.setItem("jot2d.application.theme", "dark");
  });
  await openTestDocument(page);
  await expect(page.locator("#saveAsBtn")).toHaveAttribute("aria-label", "Save As");
  await expect(page.locator("#selectionVisibilityBtn")).toHaveAttribute("title", "Show/hide selected objects");
  await expect(page.locator(".toolbar-row").first().locator(".tool-group").first()).toHaveAttribute("aria-label", "Application");
  await expect(page.locator(".command-toolbar")).toHaveCSS("height", "66px");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Selected geometry visibility toggles preserve selection, geometry, constraints and one-step history", async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForResponsiveLineDragTest());
  const button = page.locator("#selectionVisibilityBtn");
  await expect(button).toBeDisabled();
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1", "L2"] }));
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const hidden = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(hidden.lines.filter(line => ["L1", "L2"].includes(line.id)).every(line => line.appearance.visible === false)).toBe(true);
  expect(hidden.points).toEqual(before.points);
  expect(hidden.constraints).toEqual(before.constraints);
  expect(hidden.lines.filter(line => !["L1", "L2"].includes(line.id))).toEqual(before.lines.filter(line => !["L1", "L2"].includes(line.id)));
  expect((await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest())).lines).toEqual(["L1", "L2"]);
  await page.locator("#undoBtn").click();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).lines).toEqual(before.lines);
  await page.locator("#redoBtn").click();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).lines).toEqual(hidden.lines);
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "hidden.jot2d"), hidden);
  await expect(button).toBeDisabled();
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  const restored = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(restored.lines.find(line => line.id === "L1").appearance.visible).toBe(true);
  expect(restored.lines.find(line => line.id === "L2").appearance.visible).toBe(false);
  await page.evaluate(() => window.__jot2dTest.selectGeometryIdsForTest({ lines: ["L1", "L2"] }));
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).lines.filter(line => ["L1", "L2"].includes(line.id)).every(line => line.appearance.visible === true)).toBe(true);
});

test("Derived instance visibility changes its override and can be restored through the Sketch Tree", async ({ page }) => {
  await openTestDocument(page);
  const before = await page.evaluate(() => window.__jot2dTest.resetForDerivedInstanceTest());
  await page.locator('.sketch-item[data-id="S2"] .sketchExpandBtn').click();
  await page.locator('.sketch-group-row[data-sketch-id="S2"][data-category="instance"]').click();
  const row = page.locator('.sketch-object-row[data-object-kind="instance"][data-id="PI1"]');
  await row.click();
  const button = page.locator("#selectionVisibilityBtn");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const hidden = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(hidden.geometryInstances.find(instance => instance.id === "PI1").appearanceOverride.visible).toBe(false);
  expect(hidden.lines).toEqual(before.serialized.lines);
  expect(hidden.geometryInstances.find(instance => instance.id === "PI1").sources).toEqual(before.serialized.geometryInstances.find(instance => instance.id === "PI1").sources);
  await page.locator("#toolSelect").click();
  await row.click();
  await button.click();
  const restored = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  expect(restored.geometryInstances.find(instance => instance.id === "PI1").appearanceOverride.visible).toBe(true);
  restored.defaultAppearance.visible = false;
  restored.defaultConstructionAppearance.visible = false;
  delete restored.geometryInstances.find(instance => instance.id === "PI1").appearanceOverride.visible;
  await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data, "inherited-hidden.jot2d"), restored);
  const sketch = page.locator('.sketch-item[data-id="S2"]');
  if (await sketch.getAttribute("aria-expanded") !== "true") await sketch.locator(".sketchExpandBtn").click();
  const group = page.locator('.sketch-group-row[data-sketch-id="S2"][data-category="instance"]');
  if (await group.getAttribute("aria-expanded") !== "true") await group.click();
  await row.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).geometryInstances.find(instance => instance.id === "PI1").appearanceOverride.visible).toBe(true);
});
