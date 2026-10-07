const { test, expect, openTestDocument } = require("./test-fixture");
const fs = require("node:fs/promises");

async function openExport(page) {
  await page.locator(".app-menu > summary").first().click();
  await page.click("#pngExportBtn");
  await expect(page.locator('#commandPanel[data-command="png-export"]')).toBeVisible();
  await expect(page.locator('[data-setting="dpi"]')).toHaveValue("300");
}
async function clickWorld(page, x, y) {
  const point = await page.evaluate(p => window.__jot2dTest.worldClientPositionForTest(p), { x, y });
  await page.mouse.click(point.x, point.y);
}
async function crop(page, a = [-40, -20], b = [40, 20]) {
  await clickWorld(page, ...a); await clickWorld(page, ...b);
}
async function dpi(page, value) {
  await page.locator('[data-setting="dpi"]').fill(String(value));
  await page.locator('[data-setting="dpi"]').press('Tab');
}
async function state(page) {
  return page.evaluate(() => {
    const doc = window.__jot2dTest.serializedModelForTest(); delete doc.savedAt;
    const canvas = document.querySelector("#canvas");
    return { doc, selected: window.__jot2dTest.selectedGeometryIdsForTest(), bitmap: canvas.toDataURL(),
      width: canvas.width, height: canvas.height, status: document.querySelector("#documentSaveStatus").textContent,
      zoom: document.querySelector("#statusZoom").textContent };
  });
}
async function download(page) {
  const promise = page.waitForEvent("download"); await page.click('#commandPanel [data-action="finish"]');
  const file = await promise, bytes = await fs.readFile(await file.path());
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { name: file.suggestedFilename(), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), data: bytes.toString("base64") };
}
async function pixels(page, image, points) {
  return page.evaluate(async ({ data, points }) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0);
    return points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
  }, { data: image.data, points });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; });
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
});

test('world region uses editable DPI, transparent background and preserves document', async ({ page }) => {
  const before = await state(page);
  await openExport(page);
  await expect(page.locator('[data-action="finish"]')).toBeDisabled();
  await crop(page);
  await dpi(page, 254);
  const image = await download(page);
  expect(image).toMatchObject({ width: 800, height: 400 });
  expect((await pixels(page, image, [[1, 1]]))[0][3]).toBe(0);
  expect(await state(page)).toEqual(before);
});

test('same world region produces identical PNG across zoom and window sizes', async ({ page }) => {
  await page.evaluate(() => window.__jot2dTest.resetForAnnotationDrag());
  const outputs = [];
  for (const [width, height, scale] of [[1200, 900, 2], [1500, 1000, 3]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, scale), scale);
    await openExport(page); await crop(page, [-110, -45], [120, 100]); await dpi(page, 127);
    outputs.push(await download(page));
  }
  expect(outputs[0].width).toBe(1150);
  expect(outputs[0].height).toBe(725);
  expect(outputs[0].data).toBe(outputs[1].data);
  expect((await pixels(page, outputs[0], [[250, 100]]))[0][3]).toBeGreaterThan(0);
});

test('two corners, invalid DPI, clear and Escape do not edit the document', async ({ page }) => {
  const before = (await state(page)).doc;
  await openExport(page);
  await clickWorld(page, -40, -20);
  await expect(page.locator('[data-action="finish"]')).toBeDisabled();
  await clickWorld(page, 40, -20);
  await expect(page.locator('[data-action="finish"]')).toBeDisabled();
  await page.click('[data-action="clear"]'); await crop(page);
  await dpi(page, 0); await expect(page.locator('[data-action="finish"]')).toBeDisabled();
  await dpi(page, 100000); await expect(page.locator('[data-action="finish"]')).toBeDisabled();
  await dpi(page, 150); await expect(page.locator('[data-action="finish"]')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#commandPanel')).toBeHidden();
  expect((await state(page)).doc).toEqual(before);
});

test('dark theme English export stays transparent', async ({ page }) => {
  await page.evaluate(() => { localStorage.setItem('jot2d.application.theme', 'dark'); localStorage.setItem('jot2d.application.language', 'en'); });
  await page.reload(); await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
  await openExport(page); await expect(page.locator('#commandPanel h2')).toHaveText('Export PNG');
  await crop(page); const image = await download(page);
  expect((await pixels(page, image, [[1, 1]]))[0][3]).toBe(0);
});

test('picker cancellation and write failure retain crop for retry', async ({ page }) => {
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => { throw new DOMException('Canceled', 'AbortError'); };
  });
  await openExport(page); await crop(page);
  await page.click('[data-action="finish"]');
  await expect(page.locator('[data-action="finish"]')).toBeEnabled();
  await page.evaluate(() => {
    window.showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async () => { throw Error('Disk full'); }, abort: async () => {} }) });
  });
  await page.click('[data-action="finish"]');
  await expect(page.locator('.command-panel-message')).toContainText('Disk full');
  await expect(page.locator('[data-action="finish"]')).toBeEnabled();
});

test('corner snapping remains in world coordinates while panning and zooming', async ({ page }) => {
  await page.evaluate(() => { window.__jot2dTest.resetForAnnotationDrag(); window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3); });
  await openExport(page);
  await clickWorld(page, -59, -24);
  const c = await page.locator('#canvas').boundingBox();
  await page.mouse.move(c.x + 300, c.y + 250); await page.mouse.down({ button: 'middle' });
  await page.mouse.move(c.x + 330, c.y + 270, { steps: 4 }); await page.mouse.up({ button: 'middle' });
  await page.mouse.wheel(0, -120);
  await clickWorld(page, 59, 34); await dpi(page, 254);
  await expect(page.locator('.command-panel-message')).toContainText('1200 × 600 px');
  const image = await download(page);
  expect(image).toMatchObject({ width: 1200, height: 600 });
});

test('file URL exports transparent PNG without opening an export dialog', async ({ page }) => {
  const { pathToFileURL } = require('node:url'); const path = require('node:path');
  await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href + '?test=1');
  await page.waitForFunction(() => window.__jot2dTest);
  await page.evaluate(() => window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3));
  await openExport(page); await crop(page); await dpi(page, 127);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const image = await download(page); expect(image.width).toBe(400);
  expect((await pixels(page, image, [[1, 1]]))[0][3]).toBe(0);
});

test('changing tool ends export input and starts the requested tool', async ({ page }) => {
  await openExport(page); await clickWorld(page, -40, -20);
  await page.click('#toolRectangle');
  await expect(page.locator('#commandPanel')).toBeHidden();
  await clickWorld(page, -40, -20); await clickWorld(page, 40, 20);
  expect((await state(page)).doc.lines).toHaveLength(4);
});

test('reference image colors survive transparent PNG export', async ({ page }) => {
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 20;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 20, 20);
    await window.__jot2dTest.importReferenceImageDataForTest(c.toDataURL(), 'red.png', 'image/png');
    window.__jot2dTest.focusWorldForTest({ x: 0, y: 0 }, 3);
  });
  await openExport(page); await crop(page); await dpi(page, 127);
  const image = await download(page);
  const counts = await page.evaluate(async data => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
    const values = ctx.getImageData(0, 0, c.width, c.height).data;
    let red = 0;
    for (let i = 0; i < values.length; i += 4) if (values[i] > 240 && values[i + 1] < 10 && values[i + 3] > 0) red++;
    return red;
  }, image.data);
  expect(counts).toBeGreaterThan(0);
});
