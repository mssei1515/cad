const { test, expect, openTestDocument } = require('./test-fixture');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

async function registerDrawing(page) {
  await openTestDocument(page);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('bookmarked.jot2d', { create: true });
    const writer = await handle.createWritable();
    await writer.write(JSON.stringify(window.__jot2dTest.serializedModelForTest()));
    await writer.close();
    window.showOpenFilePicker = async () => [handle];
    window.bookmarkTestHandle = handle;
  });
  await page.click('#importBtn');
  await expect(page).toHaveTitle('bookmarked - Jot2D');
  await page.locator('.app-menu > summary').first().click();
  await page.click('#copyDocumentLinkBtn');
  await expect(page.locator('#documentLinkDialog')).toBeVisible();
  const link = await page.locator('#documentLinkInput').inputValue();
  await expect(page.locator('#documentLinkOpen')).toHaveAttribute('href', link);
  await page.locator('#documentLinkDialog button').click();
  return link;
}

test('registered links reuse IDs, open latest disk content after navigation and save to the same handle', async ({ page }) => {
  const link = await registerDrawing(page);
  expect(new URL(link).searchParams.get('document')).toMatch(/^[a-f0-9-]{36}$/);
  expect(new URL(link).searchParams.has('test')).toBe(false);
  await page.evaluate(async () => {
    const saved = window.__jot2dTest.serializedModelForTest();
    saved.points = [{ id: 'P1', x: 12, y: 34, sketchId: 'S1', role: 'endpoint' }];
    const writer = await window.bookmarkTestHandle.createWritable();
    await writer.write(JSON.stringify(saved)); await writer.close();
  });
  await page.locator('.app-menu > summary').first().click();
  await page.click('#copyDocumentLinkBtn');
  await expect(page.locator('#documentLinkInput')).toHaveValue(link);
  await page.locator('#documentLinkDialog button').click();
  // Test query exposes read-only assertions; the generated user link does not contain it.
  await page.goto(`${link}&test=1`);
  await expect(page).toHaveTitle('bookmarked - Jot2D');
  expect(await page.evaluate(() => window.__jot2dTest.serializedModelForTest().points)).toEqual(expect.arrayContaining([expect.objectContaining({ x: 12, y: 34 })]));
  await page.click('#toolPoint');
  await page.locator('#canvas').click({ position: { x: 500, y: 300 } });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+s');
  await expect(page.locator('#documentSaveStatus')).toHaveAttribute('data-dirty', 'false');
  const count = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('bookmarked.jot2d');
    return JSON.parse(await (await handle.getFile()).text()).points.length;
  });
  expect(count).toBe(2);
});

test('startup permission cancellation permits retry with an explicit click', async ({ page }) => {
  const link = await registerDrawing(page);
  await page.addInitScript(() => {
    FileSystemFileHandle.prototype.queryPermission = async () => 'prompt';
    FileSystemFileHandle.prototype.requestPermission = async () => 'granted';
  });
  await page.goto(`${link}&test=1`);
  await expect(page.locator('#choiceDialog')).toBeVisible();
  await page.locator('[data-choice-value="cancel"]').click();
  await expect(page).toHaveTitle('無題 - Jot2D');
  await page.locator('.app-menu > summary').first().click();
  await page.click('#openDocumentLinkBtn');
  await expect(page).toHaveTitle('bookmarked - Jot2D');
});

test('unknown registrations and unbound new drawings show actionable errors without replacement', async ({ page }) => {
  await page.goto('/index.html?test=1&document=unknown');
  await page.waitForFunction(() => window.__jot2dTest);
  await expect(page.locator('#hint')).toContainText('登録情報がありません');
  await expect(page).toHaveTitle('無題 - Jot2D');
  await page.locator('.app-menu > summary').first().click();
  await page.click('#copyDocumentLinkBtn');
  await expect(page.locator('#hint')).toContainText('名前を付けて保存');
  await expect(page.locator('#documentLinkDialog')).not.toBeVisible();
});

test('file URL startup supports registration storage and reports unavailable registrations', async ({ page }) => {
  const url = pathToFileURL(path.resolve(__dirname, '../../index.html'));
  url.search = '?test=1&document=unknown';
  await page.goto(url.href);
  await page.waitForFunction(() => window.__jot2dTest);
  await expect(page.locator('#hint')).toContainText('登録情報がありません');
  expect(await page.evaluate(async () => {
    const registry = window.DocumentBookmarks.create({ indexedDB, crypto });
    return (await registry.get('unknown')) === undefined && typeof showOpenFilePicker === 'function';
  })).toBe(true);
});
