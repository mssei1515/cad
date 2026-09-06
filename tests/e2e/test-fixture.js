const playwright = require("@playwright/test");

const EXPECTED_CONSOLE_ERRORS = new Set([]);
const test = playwright.test.extend({
  page: async ({ page }, use) => {
    const runtimeErrors = [];

    page.on("pageerror", (error) => {
      runtimeErrors.push(`pageerror: ${error.stack || error.message}`);
    });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (!EXPECTED_CONSOLE_ERRORS.has(text)) runtimeErrors.push(`console.error: ${text}`);
    });
    await page.addInitScript(() => {
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        const detail = reason instanceof Error ? reason.stack || reason.message : String(reason);
        console.error(`[unhandledrejection] ${detail}`);
      });
    });

    await use(page);
    playwright.expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
  },
});

async function openTestDocument(page) {
  await page.goto("/index.html?test=1");
  await page.waitForFunction(() => window.__jot2dTest);
}

async function completeBlockEdit(page) {
  await page.click("#completeBlockEditBtn");
  const dialog = page.locator("#choiceDialog");
  if (await dialog.isVisible()) await dialog.locator('[data-choice-value="true"]').click();
}

module.exports = { test, expect: playwright.expect, openTestDocument, completeBlockEdit };
