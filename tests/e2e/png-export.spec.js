const { test, expect, openTestDocument } = require("./test-fixture");
const fs = require("node:fs/promises");

async function rectangle(page) {
  await page.click("#toolRectangle");
  await page.locator("#canvas").click({ position: { x: 180, y: 130 } });
  await page.locator("#canvas").click({ position: { x: 480, y: 330 } });
  await page.keyboard.press("Escape");
}
async function openExport(page) {
  await page.locator(".app-menu > summary").first().click();
  await page.click("#pngExportBtn");
  await expect(page.locator("#pngExportDialog")).toBeVisible();
  await expect(page.locator("[data-png-mode]")).toBeEnabled();
}
async function previewPoint(page, x, y) {
  return page.locator("#pngExportDialog canvas").evaluate((canvas, p) => {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + p.x * r.width / canvas.width, y: r.top + p.y * r.height / canvas.height };
  }, { x, y });
}
async function crop(page, a, b) {
  const p = await previewPoint(page, ...a), q = await previewPoint(page, ...b);
  await page.mouse.click(p.x, p.y);
  await page.mouse.move(q.x, q.y, { steps: 3 }); await page.mouse.click(q.x, q.y);
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
  const promise = page.waitForEvent("download"); await page.click("[data-png-save]");
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
});

test("two-corner crop exports a sharp opaque PNG and preserves document, selected objects, viewport and save status", async ({ page }) => {
  await rectangle(page);
  await page.evaluate(() => window.__jot2dTest.selectDrawingOrderObjectForTest("line", "L1"));
  const before = await state(page);
  await openExport(page);
  await expect(page.locator("[data-png-save]")).toBeDisabled();
  await crop(page, [150, 100], [510, 360]);
  await expect(page.locator("[data-png-status]")).toHaveText("720 × 520 px");
  const image = await download(page);
  expect(image).toMatchObject({ name: "無題.png", width: 720, height: 520 });
  const [background, edge, outside] = await pixels(page, image, [[10, 10], [200, 60], [200, 53]]);
  expect(background).toEqual([252, 253, 255, 255]);
  expect(edge[0]).toBeLessThan(100); expect(edge[1]).toBeLessThan(100); expect(edge[2]).toBeLessThan(100);
  expect(outside).toEqual(background);
  await expect(page.locator("#pngExportDialog")).not.toBeVisible();
  expect(await state(page)).toEqual(before);
});

test("two clicks work without geometry and only the second click commits the preview", async ({ page }) => {
  const before = await state(page);
  expect(before.doc.lines).toHaveLength(0);
  expect(before.doc.points).toHaveLength(0);
  await openExport(page);
  await expect(page.locator("[data-png-status]")).toContainText("1点目");
  const first = await previewPoint(page, 414, 368), second = await previewPoint(page, 123, 145);
  await page.mouse.click(first.x, first.y);
  await expect(page.locator("[data-png-status]")).toContainText("2点目");
  await expect(page.locator("[data-png-save]")).toBeDisabled();
  const initial = await page.locator("#pngExportDialog canvas").evaluate(canvas => canvas.toDataURL());
  await page.mouse.move(second.x, second.y);
  await expect(page.locator("[data-png-save]")).toBeDisabled();
  expect(await page.locator("#pngExportDialog canvas").evaluate(canvas => canvas.toDataURL())).not.toBe(initial);
  await page.click("[data-png-clear]");
  await expect(page.locator("[data-png-status]")).toContainText("1点目");
  await expect(page.locator("[data-png-save]")).toBeDisabled();
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  expect(await download(page)).toMatchObject({ width: 582, height: 446 });
  expect(await state(page)).toEqual(before);
});

test("separate points snap in the resized preview without needing a rectangle or adding geometry", async ({ page }) => {
  await page.click("#toolPoint");
  await page.locator("#canvas").click({ position: { x: 180, y: 130 } });
  await page.locator("#canvas").click({ position: { x: 480, y: 330 } });
  await page.keyboard.press("Escape");
  const before = await state(page);
  expect(before.doc.lines).toHaveLength(0);
  expect(before.doc.points).toHaveLength(2);
  await openExport(page);
  const first = await previewPoint(page, 180, 130), second = await previewPoint(page, 480, 330);
  await page.mouse.move(first.x + 7, first.y + 3);
  await expect(page.locator("[data-png-status]")).toContainText("スナップ");
  await page.mouse.click(first.x + 7, first.y + 3);
  await page.mouse.move(second.x - 7, second.y - 3);
  await expect(page.locator("[data-png-status]")).toContainText("スナップ");
  await page.mouse.click(second.x - 7, second.y - 3);
  expect(await download(page)).toMatchObject({ width: 600, height: 400 });
  expect(await state(page)).toEqual(before);
});

test("endpoint snaps take precedence over nearby edges and zero-area corners remain pending", async ({ page }) => {
  await rectangle(page);
  await openExport(page);
  const first = await previewPoint(page, 185, 132);
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(first.x, first.y);
  await expect(page.locator("[data-png-save]")).toBeDisabled();
  await expect(page.locator("[data-png-error]")).toContainText("幅と高さ");
  const second = await previewPoint(page, 475, 328);
  await page.mouse.click(second.x, second.y);
  expect(await download(page)).toMatchObject({ width: 600, height: 400 });
});

test("existing rectangle uses four edges and all three resolutions; Escape restores the selection", async ({ page }) => {
  await rectangle(page);
  const before = await state(page);
  await openExport(page);
  await page.selectOption("[data-png-mode]", "existing");
  for (const [x, y] of [[330, 130], [480, 230], [330, 330], [180, 230]]) {
    const p = await previewPoint(page, x, y); await page.mouse.click(p.x, p.y);
  }
  await expect(page.locator("[data-png-status]")).toHaveText("600 × 400 px");
  await page.selectOption("[data-png-scale]", "1");
  await expect(page.locator("[data-png-status]")).toHaveText("300 × 200 px");
  await page.selectOption("[data-png-scale]", "4");
  expect(await download(page)).toMatchObject({ width: 1200, height: 800 });
  expect(await state(page)).toEqual(before);
  await openExport(page);
  await crop(page, [400, 350], [200, 150]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pngExportDialog")).not.toBeVisible();
  expect(await state(page)).toEqual(before);
});

test("PNG picker cancellation and failed writes keep the dialog usable and never change document save status", async ({ page }) => {
  await rectangle(page);
  await page.evaluate(() => {
    window.pngWrites = { mode: "cancel", aborts: 0, types: [] };
    window.showSaveFilePicker = async options => {
      window.pngWrites.types.push(options.types[0].accept);
      if (window.pngWrites.mode === "cancel") throw new DOMException("Canceled", "AbortError");
      return { createWritable: async () => ({ write: async () => { throw new Error("Disk full"); }, abort: async () => { window.pngWrites.aborts++; } }) };
    };
  });
  const before = await state(page);
  await openExport(page); await crop(page, [150, 100], [510, 360]);
  await page.click("[data-png-save]");
  await expect.poll(() => page.evaluate(() => window.pngWrites.types.length)).toBe(1);
  await expect(page.locator("[data-png-save]")).toBeEnabled();
  await expect(page.locator("[data-png-error]")).toBeEmpty();
  await page.evaluate(() => { window.pngWrites.mode = "fail"; });
  await page.click("[data-png-save]");
  await expect.poll(() => page.evaluate(() => window.pngWrites.types.length)).toBe(2);
  await expect(page.locator("[data-png-error]")).toContainText("Disk full", { timeout: 15000 });
  expect(await page.evaluate(() => window.pngWrites.aborts)).toBe(1);
  await page.keyboard.press("Escape");
  expect(await state(page)).toEqual(before);
});

test("dark background and English labels are exported without selection coloring", async ({ page }) => {
  await page.evaluate(() => { localStorage.setItem("jot2d.application.theme", "dark"); localStorage.setItem("jot2d.application.language", "en"); });
  await page.reload(); await page.waitForFunction(() => window.__jot2dTest);
  await rectangle(page); await openExport(page);
  await expect(page.locator("#pngExportTitle")).toHaveText("Export PNG");
  await expect(page.locator("[data-png-mode] option:checked")).toHaveText("Pick two opposite corners");
  await crop(page, [100, 80], [140, 110]);
  await page.selectOption("[data-png-scale]", "1");
  const image = await download(page);
  expect(image).toMatchObject({ width: 40, height: 30 });
  expect((await pixels(page, image, [[10, 10]]))[0]).toEqual([15, 23, 42, 255]);
});

test("native PNG saves do not replace the jot2d destination or clear dirty state", async ({ page }) => {
  await page.evaluate(() => {
    window.writtenFiles = []; window.pickerCount = 0;
    window.showSaveFilePicker = async options => {
      window.pickerCount++;
      return { createWritable: async () => ({
        write: async value => window.writtenFiles.push({ name: options.suggestedName, type: value.type || "json" }), close: async () => {},
      }) };
    };
  });
  await page.keyboard.press("Control+s");
  await expect(page.locator("#documentSaveStatus")).toHaveAttribute("data-dirty", "false");
  await rectangle(page);
  await expect(page.locator("#documentSaveStatus")).toHaveAttribute("data-dirty", "true");
  await openExport(page); await crop(page, [150, 100], [510, 360]);
  await page.click("[data-png-save]");
  await expect(page.locator("#pngExportDialog")).not.toBeVisible();
  await expect(page.locator("#documentSaveStatus")).toHaveAttribute("data-dirty", "true");
  await page.keyboard.press("Control+s");
  await expect(page.locator("#documentSaveStatus")).toHaveAttribute("data-dirty", "false");
  expect(await page.evaluate(() => window.writtenFiles)).toEqual([
    { name: "無題.jot2d", type: "json" }, { name: "無題.png", type: "image/png" }, { name: "無題.jot2d", type: "json" },
  ]);
  expect(await page.evaluate(() => window.pickerCount)).toBe(2);
});

test("fills, block projections, dimensions, text, leaders and decoded reference images match normal drawing pixels", async ({ page }, testInfo) => {
  for (const fixture of ["resetForDrawingOrderTest", "resetForAnnotationDrag", "resetForReadOnlyDimensionPlacement", "image"]) {
    await page.evaluate(async name => {
      if (name !== "image") window.__jot2dTest[name]();
      else {
        const image = document.createElement("canvas"); image.width = 100; image.height = 80;
        const ctx = image.getContext("2d"); ctx.fillStyle = "#ef4444"; ctx.fillRect(0, 0, 100, 80);
        await window.__jot2dTest.importReferenceImageDataForTest(image.toDataURL(), "red.png", "image/png");
      }
    }, fixture);
    await page.keyboard.press("Escape"); await page.mouse.move(20, 20);
    await page.evaluate(() => document.fonts.ready);
    const bounds = await page.locator("#canvas").boundingBox();
    const width = Math.floor(bounds.width) - 2, height = Math.floor(bounds.height) - 2;
    const expected = await page.evaluate(({ width, height }) => {
      const source = document.querySelector("#canvas"), output = document.createElement("canvas");
      output.width = width; output.height = height;
      const ctx = output.getContext("2d"); ctx.fillStyle = getComputedStyle(source.closest(".canvas-area")).backgroundColor;
      ctx.fillRect(0, 0, width, height); ctx.drawImage(source, -1, -1); return output.toDataURL();
    }, { width, height });
    await openExport(page);
    await crop(page, [1, 1], [width + 1, height + 1]);
    await page.selectOption("[data-png-scale]", "1");
    if (fixture === "resetForAnnotationDrag") await page.screenshot({ path: testInfo.outputPath("png-export-dialog.png") });
    const exported = await download(page);
    const comparison = await page.evaluate(async ({ expected, actual }) => {
      const read = async url => {
        const image = await createImageBitmap(await (await fetch(url)).blob());
        const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, image.width, image.height).data;
      };
      const a = await read(expected), b = await read(`data:image/png;base64,${actual}`);
      let different = 0, content = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== 252 || a[i + 1] !== 253 || a[i + 2] !== 255) content++;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) different++;
      }
      return { different, content };
    }, { expected, actual: exported.data });
    expect(comparison.content, fixture).toBeGreaterThan(100);
    expect(comparison.different, fixture).toBeLessThan(30);
  }
});

test("file URL supports PNG download and rejects an invalid existing boundary", async ({ page }) => {
  const { pathToFileURL } = require("node:url");
  const path = require("node:path");
  await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href + "?test=1");
  await page.waitForFunction(() => window.__jot2dTest);
  await rectangle(page); await openExport(page);
  await page.selectOption("[data-png-mode]", "existing");
  for (const [x, y] of [[330, 130], [480, 230], [330, 330]]) {
    const p = await previewPoint(page, x, y); await page.mouse.click(p.x, p.y);
  }
  await expect(page.locator("[data-png-save]")).toBeDisabled();
  const p = await previewPoint(page, 180, 230); await page.mouse.click(p.x, p.y);
  expect(await download(page)).toMatchObject({ width: 600, height: 400 });
});

test("failed image preparation disables export while keeping cancellation available", async ({ page }) => {
  await page.evaluate(async () => {
    const image = document.createElement("canvas"); image.width = 10; image.height = 10;
    await window.__jot2dTest.importReferenceImageDataForTest(image.toDataURL(), "empty.png", "image/png");
    HTMLImageElement.prototype.decode = async () => { throw new Error("Image decode failed"); };
  });
  await openExport(page);
  await expect(page.locator("[data-png-error]")).toContainText("Image decode failed");
  await expect(page.locator("[data-png-save]")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pngExportDialog")).not.toBeVisible();
});

test.describe("high density display", () => {
  test.use({ deviceScaleFactor: 2 });
  test("output resolution is independent of display pixel density", async ({ page }) => {
    await rectangle(page);
    const before = await state(page);
    await openExport(page); await crop(page, [150, 100], [510, 360]);
    await page.selectOption("[data-png-scale]", "1");
    expect(await download(page)).toMatchObject({ width: 360, height: 260 });
    expect(await state(page)).toEqual(before);
  });
});
