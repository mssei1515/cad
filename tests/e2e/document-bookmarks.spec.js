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
  await expect(page).toHaveURL(/document=[a-f0-9-]{36}/);
  expect(new URL(page.url()).searchParams.get('test')).toBe('1');
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

test('Save As changes the registered URL and compatible import clears it only after successful reading', async ({ page }) => {
  const original = await registerDrawing(page);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('second.jot2d', { create: true });
    window.showSaveFilePicker = async () => handle;
  });
  await page.keyboard.press('Control+Shift+s');
  await expect.poll(() => new URL(page.url()).searchParams.get('document')).not.toBe(new URL(original).searchParams.get('document'));
  const second = new URL(page.url()).searchParams.get('document');
  expect(second).toMatch(/^[a-f0-9-]{36}$/);
  const data = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  await page.locator('#documentFileInput').setInputFiles({ name: 'invalid.jot2d', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('#hint')).toContainText('失敗');
  expect(new URL(page.url()).searchParams.get('document')).toBe(second);
  await page.locator('#documentFileInput').setInputFiles({ name: 'compatible.jot2d', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page).toHaveTitle('compatible - Jot2D');
  await expect.poll(() => new URL(page.url()).searchParams.has('document')).toBe(false);
});

test('unsupported browser capabilities hide link controls and preserve normal file input and download saving', async ({ page }) => {
  await page.addInitScript(() => {
    window.showOpenFilePicker = undefined;
    window.showSaveFilePicker = undefined;
  });
  await page.goto('/index.html?test=1&document=foreign');
  await page.waitForFunction(() => window.__jot2dTest);
  await expect.poll(() => new URL(page.url()).searchParams.has('document')).toBe(false);
  await page.locator('.app-menu > summary').first().click();
  await expect(page.locator('#copyDocumentLinkBtn')).toBeHidden();
  await expect(page.locator('#openDocumentLinkBtn')).toBeHidden();
  const data = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  await page.locator('.app-menu > summary').first().click();
  await page.locator('#documentFileInput').setInputFiles({ name: 'fallback.jot2d', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page).toHaveTitle('fallback - Jot2D');
  const downloaded = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await downloaded).suggestedFilename()).toBe('fallback.jot2d');
});

test('registration storage errors leave loaded drawings usable and remove stale URLs', async ({ page }) => {
  await openTestDocument(page);
  const data = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  await page.evaluate(data => {
    history.replaceState(null, '', '?test=1&document=old');
    indexedDB.open = () => { throw new Error('Storage unavailable'); };
    window.showOpenFilePicker = async () => [{ getFile: async () => new File([JSON.stringify(data)], 'usable.jot2d') }];
  }, data);
  await page.click('#importBtn');
  await expect(page).toHaveTitle('usable - Jot2D');
  await expect.poll(() => new URL(page.url()).searchParams.has('document')).toBe(false);
  await page.click('#toolPoint');
  await page.locator('#canvas').click({ position: { x: 500, y: 300 } });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__jot2dTest.serializedModelForTest().points.length)).toBe(1);
});
