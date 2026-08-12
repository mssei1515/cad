const playwright = require("@playwright/test");

const EXPECTED_CONSOLE_ERRORS = new Set([]);
const EXPECTED_CONSTRAINT_SELECTION_PAGE_ERRORS = new Set([
  "Cannot read properties of undefined (reading 'id')",
  "Cannot read properties of undefined (reading 'center')",
]);

function isExpectedPageError(error) {
  if (!EXPECTED_CONSTRAINT_SELECTION_PAGE_ERRORS.has(error.message)) return false;
  const stack = error.stack || "";
  return stack.includes("constraintFromSelection")
    && stack.includes("normalConstraintFromOperands")
    && stack.includes("handleConstraintOperandClick");
}

const test = playwright.test.extend({
  page: async ({ page }, use) => {
    const runtimeErrors = [];

    page.on("pageerror", (error) => {
      if (isExpectedPageError(error)) return;
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

module.exports = { test, expect: playwright.expect };
