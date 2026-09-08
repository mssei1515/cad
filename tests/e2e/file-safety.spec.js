const { test, expect, openTestDocument } = require("./test-fixture");
const fs = require("node:fs/promises");

async function installFileMocks(page) {
  await page.addInitScript(() => {
    const state = window.fileMock = { writes: [], pickers: 0, aborts: 0 };
    const handle = {
      name: "drawing.jot2d",
      async getFile() {
        if (state.holdRead) await new Promise((resolve) => { state.releaseRead = resolve; });
        return new File([state.openSavedFile ? state.writes.at(-1) : state.openContent], "other.jot2d", { type: "application/json" });
      },
      async createWritable() {
        return {
          async write(content) {
            state.writes.push(content);
            if (state.holdWrite) await new Promise((resolve) => { state.release = resolve; });
            if (state.failWrite) throw new Error("Disk full");
          },
          async close() { if (state.failClose) throw new Error("Close failed"); },
          async abort() { state.aborts++; },
        };
      },
    };
    window.showSaveFilePicker = async () => {
      state.pickers++;
      if (state.cancelSave) throw new DOMException("Canceled", "AbortError");
      return handle;
    };
    window.showOpenFilePicker = async () => {
      if (state.cancelOpen) throw new DOMException("Canceled", "AbortError");
      return [handle];
    };
  });
  await openTestDocument(page);
  await page.evaluate(() => { window.fileMock.openContent = JSON.stringify(window.__jot2dTest.serializedModelForTest()); });
}

async function drawPoint(page, x = 500) {
  await page.click("#toolPoint");
  await page.locator("#canvas").click({ position: { x, y: 300 } });
  await page.keyboard.press("Escape");
}

async function expectDirty(page, dirty) {
  await expect(page.locator("#documentSaveStatus")).toHaveAttribute("data-dirty", String(dirty));
}

test("save status follows edits, save, undo and redo without treating navigation as edits", async ({ page }) => {
  await installFileMocks(page);
  await expectDirty(page, false);
  await drawPoint(page);
  await expectDirty(page, true);
  await expect(page).toHaveTitle("● 無題 - Jot2D");
  await page.keyboard.press("Control+Z");
  await expectDirty(page, false);
  await page.keyboard.press("Control+Y");
  await expectDirty(page, true);
  await page.keyboard.press("Control+S");
  await expect(page.locator("#documentSaveStatus")).toContainText("保存済み");
  await expectDirty(page, false);
  await page.keyboard.press("Control+Z");
  await expectDirty(page, true);
  await page.keyboard.press("Control+Y");
  await expectDirty(page, false);
  await page.locator('.sketch-item[data-id="ROOT"] .sketchActivateBtn').click();
  await expectDirty(page, false);
  const prevented = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test("opening protects edits, supports cancel and discard, and starts a new undo history", async ({ page }) => {
  await installFileMocks(page);
  await drawPoint(page);
  await page.click("#importBtn");
  await expect(page.locator('[data-choice-value="save"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expectDirty(page, true);
  expect(await page.evaluate(() => window.__jot2dTest.serializedModelForTest().points.length)).toBe(1);
  await page.click("#importBtn");
  await page.click('[data-choice-value="discard"]');
  await expect(page).toHaveTitle("other - Jot2D");
  await expectDirty(page, false);
  await expect(page.locator("#undoBtn")).toBeDisabled();
  expect(await page.evaluate(() => window.__jot2dTest.serializedModelForTest().points.length)).toBe(0);
});

test("save and open waits for a successful save; cancellation keeps the drawing", async ({ page }) => {
  await installFileMocks(page);
  await drawPoint(page);
  await page.evaluate(() => { window.fileMock.cancelSave = true; });
  await page.click("#importBtn");
  await page.click('[data-choice-value="save"]');
  await expect(page.locator("#hint")).toContainText("保存をキャンセル");
  await expectDirty(page, true);
  await page.evaluate(() => { window.fileMock.cancelSave = false; });
  await page.click("#importBtn");
  await page.click('[data-choice-value="save"]');
  await expect(page).toHaveTitle("other - Jot2D");
  expect(await page.evaluate(() => JSON.parse(window.fileMock.writes[0]).points.length)).toBe(1);
  await expectDirty(page, false);
});

test("slow saves cannot overlap and edits made during writing remain unsaved", async ({ page }) => {
  await installFileMocks(page);
  await drawPoint(page);
  await page.evaluate(() => { window.fileMock.holdWrite = true; });
  await page.keyboard.press("Control+S");
  await expect.poll(() => page.evaluate(() => window.fileMock.writes.length)).toBe(1);
  await expect(page.locator("#documentSaveStatus")).toContainText("保存中");
  await page.keyboard.press("Control+S");
  await page.keyboard.press("Control+Shift+S");
  await drawPoint(page, 600);
  await page.evaluate(() => window.fileMock.release());
  await expect(page.locator("#hint")).toContainText("保存しました");
  await expectDirty(page, true);
  expect(await page.evaluate(() => ({ calls: window.fileMock.pickers, points: JSON.parse(window.fileMock.writes[0]).points.length })))
    .toEqual({ calls: 1, points: 1 });
  await page.keyboard.press("Control+Z");
  await expectDirty(page, false);
});

test("save and reopen the same file reads the newly saved content", async ({ page }) => {
  await installFileMocks(page);
  await page.keyboard.press("Control+S");
  await expect(page.locator("#documentSaveStatus")).toContainText("保存済み");
  await page.evaluate(() => { window.fileMock.openSavedFile = true; });
  await drawPoint(page);
  await page.click("#importBtn");
  await page.click('[data-choice-value="save"]');
  await expect(page).toHaveTitle("other - Jot2D");
  expect(await page.evaluate(() => window.__jot2dTest.serializedModelForTest().points.length)).toBe(1);
});

test("editing during a slow file read cancels replacement and keeps the new work", async ({ page }) => {
  await installFileMocks(page);
  await page.evaluate(() => { window.fileMock.holdRead = true; });
  await page.click("#importBtn");
  await expect.poll(() => page.evaluate(() => typeof window.fileMock.releaseRead)).toBe("function");
  await drawPoint(page);
  await page.evaluate(() => window.fileMock.releaseRead());
  await expect(page.locator("#hint")).toContainText("読込待機中に図面が変更");
  await expectDirty(page, true);
  expect(await page.evaluate(() => window.__jot2dTest.serializedModelForTest().points.length)).toBe(1);
});

for (const failure of ["failWrite", "failClose"]) {
  test(`${failure} preserves dirty state and aborts the writable stream`, async ({ page }) => {
    await installFileMocks(page);
    await drawPoint(page);
    await page.evaluate((key) => { window.fileMock[key] = true; }, failure);
    await page.keyboard.press("Control+S");
    await expect(page.locator("#hint")).toContainText("ファイル保存に失敗");
    await expectDirty(page, true);
    expect(await page.evaluate(() => window.fileMock.aborts)).toBe(1);
    expect(await page.evaluate(() => window.__jot2dTest.fileSystemAccessStateForTest().hasHandle)).toBe(false);
    await page.evaluate((key) => { window.fileMock[key] = false; }, failure);
    await page.keyboard.press("Control+S");
    await expectDirty(page, false);
  });
}

test("unsupported file APIs automatically use download and file input, preserving valid JSON", async ({ page }) => {
  await page.addInitScript(() => {
    window.showSaveFilePicker = undefined;
    window.showOpenFilePicker = undefined;
  });
  await openTestDocument(page);
  await drawPoint(page);
  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Control+S");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("無題.jot2d");
  const content = await fs.readFile(await download.path(), "utf8");
  expect(JSON.parse(content).points.length).toBe(1);
  await expectDirty(page, false);
  await expect(page.locator("#documentSaveStatus")).toContainText("ダウンロード開始済み");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.click("#importBtn");
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "roundtrip.jot2d", mimeType: "application/json", buffer: Buffer.from(content) });
  await expect(page).toHaveTitle("roundtrip - Jot2D");
  expect(await page.evaluate(() => window.__jot2dTest.fileSystemAccessStateForTest().hasHandle)).toBe(false);
});

test("invalid files preserve drawing, save target, history and dirty status", async ({ page }) => {
  await installFileMocks(page);
  await page.keyboard.press("Control+S");
  await expect(page.locator("#documentSaveStatus")).toContainText("保存済み");
  await drawPoint(page);
  await page.evaluate(() => { window.fileMock.openContent = "{broken"; });
  await page.click("#importBtn");
  await page.click('[data-choice-value="discard"]');
  await expect(page.locator("#hint")).toContainText("ファイル読み込みに失敗");
  await expectDirty(page, true);
  await expect(page.locator("#undoBtn")).toBeEnabled();
  expect(await page.evaluate(() => window.__jot2dTest.fileSystemAccessStateForTest().handleName)).toBe("drawing.jot2d");
  expect(await page.evaluate(() => window.__jot2dTest.serializedModelForTest().points.length)).toBe(1);
});

test("leaving an edited drawing triggers the browser guard and cancel keeps it open", async ({ page }) => {
  await installFileMocks(page);
  await drawPoint(page);
  const dialogPromise = page.waitForEvent("dialog");
  const navigation = page.goto("about:blank").catch(() => {});
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await navigation;
  await expectDirty(page, true);
});
