const { test, expect, openTestDocument } = require("./test-fixture");

for (const locked of [true, false]) {
  test(`block creation confirms rotation lock ${locked} and preserves it through undo and reload`, async ({ page }) => {
    await openTestDocument(page);
    await page.evaluate(() => window.__jot2dTest.resetForBlockCreationUi());
    await page.click("#toolCreateBlock");
    await page.click("#completeBlockEditBtn");
    const dialog = page.getByRole("dialog", { name: "ブロックの回転設定" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-choice-value="true"]')).toBeFocused();
    await expect(page.locator("body")).toHaveClass(/block-editing/);
    await dialog.locator(`[data-choice-value="${locked}"]`).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/block-editing/);
    const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(saved.blockInstances).toHaveLength(1);
    expect(saved.blockInstances[0].rotationLocked).toBe(locked);
    await page.click("#undoBtn");
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).blockInstances).toHaveLength(0);
    await page.click("#redoBtn");
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).blockInstances[0].rotationLocked).toBe(locked);
    expect(await page.evaluate((data) => window.__jot2dTest.loadDocumentFixtureForDragTest(data), saved)).toMatchObject({ success: true });
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).blockInstances[0].rotationLocked).toBe(locked);
  });
}

test("cancel, close, and Escape retain the block draft; Enter accepts the default", async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await page.fill("#blockEditorNameInput", "My draft");
  const before = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const dialog = page.locator("#choiceDialog");
  for (const action of ["cancel", "close", "escape"]) {
    await page.click("#completeBlockEditBtn");
    await expect(dialog).toBeVisible();
    // Global shortcuts must not mutate the draft behind the modal.
    await page.keyboard.press("Control+z");
    if (action === "escape") await page.keyboard.press("Escape");
    else await dialog.locator(action === "close" ? "[data-choice-close]" : '[data-choice-value="cancel"]').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("#blockEditorNameInput")).toHaveValue("My draft");
    const after = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(after.points).toEqual(before.points);
    expect(after.lines).toEqual(before.lines);
    await expect(page.locator("#completeBlockEditBtn")).toBeFocused();
  }
  await page.click("#completeBlockEditBtn");
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/block-editing/);
});

test("shared dialog supports other text and choices without carrying over a previous result", async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => {
    const element = document.getElementById("choiceDialog").cloneNode(true);
    element.id = "otherChoiceDialog";
    document.body.append(element);
    window.otherChoice = window.ChoiceDialog.create(element);
    window.otherResult = "pending";
    window.otherChoice.show({ title: "Other operation", message: "<b>Plain text</b>", choices: [{ value: "keep", label: "Keep" }, { value: "replace", label: "Replace" }], defaultValue: "replace", cancelLabel: "Cancel" }).then((value) => { window.otherResult = value; });
  });
  const dialog = page.locator("#otherChoiceDialog");
  await expect(dialog.locator("[data-choice-message]")).toHaveText("<b>Plain text</b>");
  await expect(dialog.locator('[data-choice-value="replace"]')).toBeFocused();
  expect(await page.evaluate(() => window.otherChoice.show({ title: "Duplicate" }).then(() => "accepted", () => "rejected"))).toBe("rejected");
  await expect(dialog.locator("[data-choice-title]")).toHaveText("Other operation");
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.otherResult)).toBe("replace");
  await page.evaluate(() => {
    window.otherChoice.show({ title: "Again", message: "Choose again", choices: [{ value: "yes", label: "Yes" }], defaultValue: "yes", cancelLabel: "Cancel" }).then((value) => { window.otherResult = value; });
  });
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.otherResult)).toBe(null);
});

test("confirmation fits light and dark themes and a narrow English layout", async ({ page }, testInfo) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      const select = document.getElementById("applicationThemeSelect");
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, theme);
    await page.click("#completeBlockEditBtn");
    await page.locator("#choiceDialog").screenshot({ path: testInfo.outputPath(`${theme}.png`) });
    await page.keyboard.press("Escape");
  }
  await page.evaluate(() => {
    const select = document.getElementById("applicationLanguageSelect");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.click("#completeBlockEditBtn");
  await page.setViewportSize({ width: 375, height: 720 });
  const dialog = page.getByRole("dialog", { name: "Block Rotation" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create with Free Rotation" })).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
  await dialog.screenshot({ path: testInfo.outputPath("narrow-en.png") });
});
