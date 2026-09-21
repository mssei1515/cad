const { test, expect } = require('@playwright/test');
const path = require('node:path');

test('menu lifecycle cancels pending hover and avoids duplicate tool dispatch after restart', async ({ page }) => {
  await page.setContent(`<nav class="menu-bar"><div class="app-menus">
    <details class="app-menu" id="first"><summary>First</summary><button data-menu-tool="draw">Draw</button></details>
    <details class="app-menu" id="second"><summary>Second</summary><button data-menu-tool="edit">Edit</button></details>
  </div></nav>`);
  await page.addScriptTag({ path: path.resolve(__dirname, '../../src/ui/application_menus.js') });
  await page.evaluate(() => {
    window.calls = [];
    window.menus = window.ApplicationMenus.create({ document, window, activateTool: id => window.calls.push(id) });
    window.menus.start(); window.menus.start();
    document.querySelector('#first button').click();
  });
  expect(await page.evaluate(() => window.calls)).toEqual(['draw']);
  await page.locator('#first summary').click();
  await expect(page.locator('.menu-bar')).toHaveClass(/menu-open/);
  await page.evaluate(() => {
    document.querySelector('#second summary').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    window.menus.dispose();
  });
  await page.waitForTimeout(40);
  await expect(page.locator('.app-menu[open]')).toHaveCount(0);
  await expect(page.locator('.menu-bar')).not.toHaveClass(/menu-open/);
  await page.evaluate(() => document.querySelector('#first button').click());
  expect(await page.evaluate(() => window.calls)).toEqual(['draw']);
  await page.evaluate(() => { window.menus.start(); window.menus.start(); document.querySelector('#second button').click(); });
  expect(await page.evaluate(() => window.calls)).toEqual(['draw', 'edit']);
  await page.locator('#first summary').click();
  await page.evaluate(() => document.querySelector('#second summary').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' })));
  await page.waitForTimeout(40);
  await expect(page.locator('#first')).toHaveAttribute('open', '');
  await expect(page.locator('#second')).not.toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-menu[open]')).toHaveCount(0);
  await expect(page.locator('#first summary')).toBeFocused();
});
