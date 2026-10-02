const { test, expect, openTestDocument } = require('./test-fixture');
const path = require('node:path');

test('save flyout executes Save As once and keeps Overwrite Save as the main action', async ({ page }) => {
  await page.addInitScript(() => {
    window.saveMock = { pickers: 0, writes: 0 };
    window.showSaveFilePicker = async () => {
      window.saveMock.pickers++;
      return { name: 'flyout.jot2d', createWritable: async () => ({
        write: async () => { window.saveMock.writes++; }, close: async () => {},
      }) };
    };
  });
  await openTestDocument(page);
  await page.locator('#exportBtn').click();
  await expect.poll(() => page.evaluate(() => window.saveMock)).toEqual({ pickers: 1, writes: 1 });
  await page.locator('#saveFlyoutToggle').click();
  await expect(page.locator('#saveAsBtn')).toBeVisible();
  await page.locator('#saveAsBtn').click();
  await expect.poll(() => page.evaluate(() => window.saveMock)).toEqual({ pickers: 2, writes: 2 });
  await expect(page.locator('#saveFlyoutToggleMenu')).toBeHidden();
  await expect(page.locator('#exportBtn')).toHaveAttribute('title', '上書き保存');
  await expect(page.locator('#exportBtn')).toHaveAttribute('aria-label', '上書き保存');
  await page.locator('#exportBtn').click();
  await expect.poll(() => page.evaluate(() => window.saveMock)).toEqual({ pickers: 2, writes: 3 });
});

test('arc choice updates icon and accessible name and the main button reuses the selected command', async ({ page }) => {
  await openTestDocument(page);
  const main = page.locator('#toolArcMain'), toggle = page.locator('#arcFlyoutToggle');
  const initialIcon = await main.locator('svg').evaluate(svg => svg.outerHTML);
  await main.click();
  await expect(page.locator('#toolArc')).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await page.locator('#toolThreePointArc').click();
  await expect(main).toHaveAttribute('title', '3点円弧');
  await expect(main).toHaveAttribute('aria-label', '3点円弧');
  expect(await main.locator('svg').evaluate(svg => svg.outerHTML)).not.toBe(initialIcon);
  expect(await main.locator('svg').evaluate(svg => svg.outerHTML)).toBe(await page.locator('#toolThreePointArc svg').evaluate(svg => svg.outerHTML));
  await expect(main).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#toolLine').click();
  await expect(main).toHaveAttribute('aria-pressed', 'false');
  await expect(main).toHaveAttribute('title', '3点円弧');
  await main.click();
  await expect(page.locator('#toolThreePointArc')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
  const positions = await page.evaluate(() => [{ x: -40, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }].map(point => window.__jot2dTest.worldClientPositionForTest(point)));
  for (const position of positions) await page.mouse.click(position.x, position.y);
  expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).arcs).toHaveLength(1);
  await toggle.click(); await page.locator('#toolArc').click();
  await expect(main).toHaveAttribute('title', '円弧');
  expect(await main.locator('svg').evaluate(svg => svg.outerHTML)).toBe(initialIcon);
});

test('flyouts open directly beneath their buttons and close on outside click, Escape, other tools and scroll', async ({ page }) => {
  await openTestDocument(page);
  const toggle = page.locator('#arcFlyoutToggle'), menu = page.locator('#arcFlyoutToggleMenu');
  await page.locator('#toolArcMain').click();
  await toggle.click();
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const buttonBox = await toggle.boundingBox(), menuBox = await menu.boundingBox();
  expect(menuBox.y).toBe(buttonBox.y + buttonBox.height);
  expect(buttonBox.width).toBe(11); expect(buttonBox.height).toBe(26);
  expect((await page.locator('[data-tool-flyout="arc"]').boundingBox()).width).toBe(38);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(1280);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden(); await expect(toggle).toBeFocused();
  await expect(page.locator('#toolArc')).toHaveAttribute('aria-pressed', 'true');
  await toggle.click(); await page.locator('#toolLine').click(); await expect(menu).toBeHidden();
  await toggle.click(); await page.locator('#canvas').click({ position: { x: 700, y: 550 } }); await expect(menu).toBeHidden();
  await toggle.click(); await page.locator('#saveFlyoutToggle').click();
  await expect(menu).toBeHidden(); await expect(page.locator('#saveFlyoutToggleMenu')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 500, height: 700 });
  await toggle.scrollIntoViewIfNeeded(); await toggle.click(); await expect(menu).toBeVisible();
  const narrow = await menu.boundingBox(); expect(narrow.x).toBeGreaterThanOrEqual(0); expect(narrow.x + narrow.width).toBeLessThanOrEqual(500);
  await page.locator('.command-toolbar').evaluate(toolbar => { toolbar.scrollLeft = 0; toolbar.dispatchEvent(new Event('scroll')); });
  await expect(menu).toBeHidden();
  await toggle.click(); await expect(menu).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('scroll'))); await expect(menu).toBeHidden();
  await expect(page.locator('.toolbar-row')).toHaveCount(2);
});

test('keyboard navigation and English dark theme preserve names and command dispatch', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('jot2d.application.language', 'en'); localStorage.setItem('jot2d.application.theme', 'dark');
  });
  await openTestDocument(page);
  await page.locator('#arcFlyoutToggle').focus(); await page.keyboard.press('ArrowDown');
  await expect(page.locator('#toolArc')).toBeFocused();
  await page.keyboard.press('End'); await expect(page.locator('#toolThreePointArc')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#toolArcMain')).toHaveAttribute('title', 'Three-point Arc');
  await expect(page.locator('#toolArcMain')).toHaveAttribute('aria-label', 'Three-point Arc');
  await expect(page.locator('#arcFlyoutToggleMenu')).toBeHidden();
  await page.locator('#arcFlyoutToggle').click();
  await page.keyboard.press('ArrowUp'); await expect(page.locator('#toolThreePointArc')).toBeFocused();
  await page.keyboard.press('Home'); await expect(page.locator('#toolArc')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#toolArcMain')).toHaveAttribute('title', 'Arc');
});

test('shared flyout lifecycle supports disposal and restart without duplicate dispatch', async ({ page }) => {
  await page.setContent('<nav class="command-toolbar"><div data-tool-flyout data-flyout-default="arc" data-flyout-switch-main><button id="main" data-flyout-main></button><button id="toggle" data-flyout-toggle aria-controls="menu">▼</button><div id="menu" data-flyout-menu hidden><button id="arc" data-flyout-option title="Arc" aria-label="Arc"><svg viewBox="0 0 24 24"><path d="M0 0L1 1"/></svg></button><button id="three" data-flyout-option title="Three-point Arc" aria-label="Three-point Arc"><svg viewBox="0 0 24 24"><path d="M1 1L2 2"/></svg></button></div></div></nav>');
  await page.addScriptTag({ path: path.resolve(__dirname, '../../src/ui/tool_flyouts.js') });
  await page.evaluate(() => {
    window.calls = [];
    for (const command of document.querySelectorAll('[data-flyout-option]')) command.addEventListener('click', () => {
      window.calls.push(command.id);
      for (const other of document.querySelectorAll('[data-flyout-option]')) other.classList.toggle('active', other === command);
    });
    window.flyouts = window.ToolFlyouts.create({ document, window }); window.flyouts.start(); window.flyouts.start();
  });
  await page.locator('#toggle').click(); await page.locator('#three').click();
  await expect(page.locator('#main')).toHaveAttribute('title', 'Three-point Arc');
  await page.locator('#main').click(); expect(await page.evaluate(() => window.calls)).toEqual(['three', 'three']);
  await page.evaluate(() => window.flyouts.dispose()); await page.locator('#main').click();
  expect(await page.evaluate(() => window.calls)).toEqual(['three', 'three']);
  await page.evaluate(() => window.flyouts.start()); await page.locator('#main').click();
  expect(await page.evaluate(() => window.calls)).toEqual(['three', 'three', 'three']);
  await page.evaluate(() => {
    const command = document.querySelector('#three'); command.title = '3点円弧'; command.setAttribute('aria-label', '3点円弧');
  });
  await expect(page.locator('#main')).toHaveAttribute('title', '3点円弧');
  await expect(page.locator('#main')).toHaveAttribute('aria-label', '3点円弧');
});
