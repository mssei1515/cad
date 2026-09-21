const { test, expect } = require('@playwright/test');
const path = require('node:path');

test('parameter dialog controller disposes listeners and preserves failed-apply cancellation', async ({ page }) => {
  await page.setContent(`<button id="parametersBtn">Parameters</button><dialog id="parametersDialog">
    <form id="parametersForm"><select id="parameterScopeSelect"><option value="document">Document</option><option value="block">Block</option></select>
    <input data-parameter-row="0" data-parameter-field="name"><button type="button" id="addParameterBtn">Add</button></form>
    <button id="parametersCloseBtn">Close</button></dialog>`);
  await page.addScriptTag({ path: path.resolve(__dirname, '../../src/ui/parameter_dialog_controller.js') });
  await page.evaluate(() => {
    window.calls = { opened: 0, added: 0, applied: 0, closed: 0, rendered: 0 };
    window.dirty = false;
    window.confirm = () => true;
    const draft = { current: null, open(scope) { this.current = scope; calls.opened++; },
      evaluate: () => ({ values: new Map() }), isDirty: () => window.dirty,
      add() { calls.added++; return true; }, close() { this.current = null; calls.closed++; } };
    window.controller = window.ParameterDialogController.create({ document, window, draft,
      view: { render() { calls.rendered++; }, setError() {} },
      scopes: () => [{ key: 'document' }, { key: 'block' }], scopeLocked: () => false,
      apply() { calls.applied++; return false; }, applicationText: (_ja, en) => en,
      language: () => 'en', refreshExpressionInputHighlights() {}, pickDimension() {} });
    controller.start(); controller.start();
  });
  await page.locator('#parametersBtn').click();
  await page.locator('#addParameterBtn').click();
  expect(await page.evaluate(() => calls)).toMatchObject({ opened: 1, added: 1 });
  await page.evaluate(() => { window.dirty = true; });
  await page.locator('#parameterScopeSelect').selectOption('block');
  await expect(page.locator('#parameterScopeSelect')).toHaveValue('document');
  await page.locator('#parametersCloseBtn').click();
  await expect(page.locator('#parametersDialog')).toBeVisible();
  expect(await page.evaluate(() => {
    const event = new Event('cancel', { cancelable: true });
    document.getElementById('parametersDialog').dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await page.evaluate(() => {
    controller.dispose();
    document.getElementById('addParameterBtn').click();
    controller.start(); controller.start();
    document.getElementById('addParameterBtn').click();
  });
  expect(await page.evaluate(() => calls)).toMatchObject({ added: 2, applied: 3, closed: 0 });
  await page.evaluate(() => { window.dirty = false; });
  await page.locator('#parametersCloseBtn').click();
  await expect(page.locator('#parametersDialog')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => calls.closed)).toBe(1);
});
