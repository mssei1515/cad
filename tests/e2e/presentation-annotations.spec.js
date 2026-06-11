const { test, expect } = require("@playwright/test");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.CAD2_E2E_PORT || 8765);
const baseUrl = `http://${host}:${port}`;
let serverProcess = null;

function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 100);
      });
    };
    check();
  });
}

test.beforeAll(async () => {
  try {
    await waitForServer(`${baseUrl}/index.html`, 300);
    return;
  } catch (_) {
    // Start our local static server below.
  }
  serverProcess = spawn(process.execPath, ["tools/serve.js", "--host", host, "--port", String(port)], {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "ignore",
  });
  await waitForServer(`${baseUrl}/index.html`);
});

test.afterAll(() => {
  if (serverProcess) serverProcess.kill();
});

test("presentation annotations can be dragged on canvas", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForPresentationDrag());

  const beforeDimension = await page.evaluate(() => window.__cadTest.presentationSnapshot());
  await page.mouse.move(beforeDimension.dimension.viewport.x, beforeDimension.dimension.viewport.y);
  await page.mouse.down();
  await page.mouse.move(beforeDimension.dimension.viewport.x, beforeDimension.dimension.viewport.y + 70, { steps: 8 });
  await page.mouse.up();

  const afterDimension = await page.evaluate(() => window.__cadTest.presentationSnapshot());
  expect(afterDimension.dimension.world.y).toBeGreaterThan(beforeDimension.dimension.world.y + 20);

  const beforeLeader = afterDimension;
  await page.mouse.move(beforeLeader.leader.viewport.x, beforeLeader.leader.viewport.y);
  await page.mouse.down();
  await page.mouse.move(beforeLeader.leader.viewport.x + 70, beforeLeader.leader.viewport.y - 35, { steps: 8 });
  await page.mouse.up();

  const afterLeader = await page.evaluate(() => window.__cadTest.presentationSnapshot());
  expect(afterLeader.leader.world.x).toBeGreaterThan(beforeLeader.leader.world.x + 20);
  expect(afterLeader.leader.world.y).toBeLessThan(beforeLeader.leader.world.y - 10);

  await page.keyboard.press("Control+Z");
  const afterUndo = await page.evaluate(() => window.__cadTest.presentationSnapshot());
  expect(afterUndo.leader.world.x).toBeCloseTo(beforeLeader.leader.world.x, 5);
  expect(afterUndo.leader.world.y).toBeCloseTo(beforeLeader.leader.world.y, 5);

  for (let i = 0; i < 12; i += 1) {
    const state = await page.evaluate(() => window.__cadTest.historyState());
    if (state.redoDisabled) break;
    await page.keyboard.press("Control+Y");
  }
  const afterRedo = await page.evaluate(() => window.__cadTest.presentationSnapshot());
  expect(afterRedo.leader.world.x).toBeCloseTo(afterLeader.leader.world.x, 5);
  expect(afterRedo.leader.world.y).toBeCloseTo(afterLeader.leader.world.y, 5);
});

test("history buttons enable after normal canvas edits", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const initial = await page.evaluate(() => window.__cadTest.historyState());
  expect(initial.undoDisabled).toBe(true);
  expect(initial.redoDisabled).toBe(true);

  await page.click("#toolRectangle");
  await page.mouse.click(480, 420);
  await page.mouse.click(540, 470);
  const afterEdit = await page.evaluate(() => window.__cadTest.historyState());
  expect(afterEdit.undoDisabled).toBe(false);
  expect(afterEdit.redoDisabled).toBe(true);

  for (let i = 0; i < 12; i += 1) {
    const state = await page.evaluate(() => window.__cadTest.historyState());
    if (state.undoDisabled) break;
    await page.click("#undoBtn");
  }
  const afterUndo = await page.evaluate(() => window.__cadTest.historyState());
  expect(afterUndo.undoDisabled).toBe(true);
  expect(afterUndo.redoDisabled).toBe(false);

  await page.keyboard.press("Control+Y");
  const afterRedo = await page.evaluate(() => window.__cadTest.historyState());
  expect(afterRedo.undoDisabled).toBe(false);
});

test("undo preserves construction drawing mode", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.click("#toolConstructionLine");
  await page.mouse.click(460, 410);
  await page.mouse.click(540, 450);
  await page.click("#undoBtn");

  const state = await page.evaluate(() => window.__cadTest.historyState());
  expect(state.constructionLineMode).toBe(true);
  expect(state.constructionButtonActive).toBe(true);
});

test("geometry toolbar uses the organized command groups", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const layout = await page.evaluate(() => {
    const visibleLabels = [...document.querySelectorAll(".toolbar .group-label")]
      .filter((element) => getComputedStyle(element.parentElement).display !== "none")
      .map((element) => element.textContent.trim());
    const toggle = document.getElementById("toggleSideBtn");
    const toggleRect = toggle.getBoundingClientRect();
    return {
      visibleLabels,
      toggleParentClass: toggle.parentElement.className,
      toggleRect: { left: toggleRect.left, right: toggleRect.right, top: toggleRect.top, bottom: toggleRect.bottom },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  await page.screenshot({ path: "test-results/toolbar-layout.png", fullPage: true });
  expect(layout.visibleLabels).toEqual(["基本作図", "複合作図", "編集", "拘束", "ファイル"]);
  expect(layout.toggleParentClass).toBe("work-area");
  expect(layout.toggleRect.right).toBeLessThanOrEqual(layout.viewport.width);
  expect(layout.toggleRect.top).toBeGreaterThan(0);
  expect(layout.toggleRect.bottom).toBeLessThan(layout.viewport.height);

  await page.click("#toggleSideBtn");
  expect(await page.locator(".side").isVisible()).toBe(true);
});

test("duplicate dimensions become read-only reference dimensions", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.resetForReadOnlyDuplicateDimension());
  expect(result.first).toBe(true);
  expect(result.second).toBe(true);
  expect(result.count).toBe(2);
  expect(result.enabledCount).toBe(1);
  expect(result.readOnlyCount).toBe(1);
  expect(result.serializedReadOnlyCount).toBe(1);
  expect(result.labels.some((label) => /^\(.+\)$/.test(label))).toBe(true);
  expect(Math.max(...result.extensionAlignmentErrors)).toBeLessThan(1e-6);
});

test("read-only dimensions skip the numeric value input", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.resetForReadOnlyDimensionPlacement());
  expect(result.pendingType).toBe(null);
  expect(result.inputHidden).toBe(true);
  expect(result.readOnlyCount).toBe(1);
  expect(result.dimensionCount).toBe(2);
});

test("geometry mode only exposes dimensions from the active sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const result = await page.evaluate(() => window.__cadTest.resetForActiveSketchDimensionVisibility());
  expect(result.dimensionSketchIds).toEqual(["S1", "S2"]);
  expect(result.drawnDimensionSketchIds).toEqual([result.activeSketchId]);
});

test("all geometry fit includes figures from every sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const result = await page.evaluate(() => window.__cadTest.resetForAllGeometryFit());
  expect(result.screen.left).toBeGreaterThanOrEqual(90);
  expect(result.screen.right).toBeLessThanOrEqual(result.canvas.width - 90);
  expect(result.screen.top).toBeGreaterThanOrEqual(90);
  expect(result.screen.bottom).toBeLessThanOrEqual(result.canvas.height - 90);
});

test("construction extension clearance uses only the dimension-line component", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.constructionDimensionClearanceCases());
  expect(result.sameDirection).toBeCloseTo(12, 6);
  expect(result.diagonal).toBeCloseTo(12 / Math.sqrt(2), 6);
  expect(result.perpendicular).toBeCloseTo(0, 6);
  expect(result.opposite).toBeCloseTo(0, 6);
});

test("dimension labels hide values below the supported display precision", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.dimensionDisplayPrecisionCases());
  expect(result.integerTrailingZero).toBe("140");
  expect(result.integerHundred).toBe("100");
  expect(result.positiveNoise).toBe("15");
  expect(result.negativeNoise).toBe("825");
  expect(result.precisionBoundaryNoise).toBe("1845");
  expect(result.measuredAccumulatedNoise).toBe("1845");
  expect(result.minimumResolution).toBe("0.000001");
  expect(result.measuredMinimumResolution).toBe("0.000001");
  expect(result.roundedFraction).toBe("1.234567");
});

test("middle line trim transfers right-side point constraints to the new segment", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.resetForTrimConstraintTransfer());
  expect(result.lineCount).toBe(2);
  expect(result.leftConstraintOnLeftLine).toBe(true);
  expect(result.rightConstraintOnRightLine).toBe(true);
  expect(result.leftLineEnd).toEqual({ x: 40, y: 0 });
  expect(result.rightLineStart).toEqual({ x: 60, y: 0 });
});
