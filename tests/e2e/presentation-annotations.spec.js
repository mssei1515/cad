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
    const isVisible = (element) => Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    const visibleTopButtons = [...document.querySelectorAll(".toolbar button")]
      .filter(isVisible)
      .map((element) => element.id);
    const visibleLeftCommandIds = [...document.querySelectorAll(".left-tool-rail button")]
      .filter(isVisible)
      .map((element) => element.id || element.dataset.constraint);
    const toggle = document.getElementById("toggleSideBtn");
    const sidebarTabs = document.querySelector(".sidebar-tabs");
    const toolbar = document.querySelector(".toolbar");
    const fileGroup = document.querySelector(".file-toolbar-group");
    const leftRail = document.querySelector(".left-tool-rail");
    const modeOverlay = document.querySelector(".mode-overlay");
    const sketchOverlay = document.querySelector(".sketch-overlay");
    const blockOverlay = document.querySelector(".block-overlay");
    const toggleRect = toggle.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const fileGroupRect = fileGroup.getBoundingClientRect();
    const leftRailRect = leftRail.getBoundingClientRect();
    const modeRect = modeOverlay.getBoundingClientRect();
    const sketchRect = sketchOverlay.getBoundingClientRect();
    const blockRect = blockOverlay.getBoundingClientRect();
    const fileButtonRect = document.getElementById("exportBtn").getBoundingClientRect();
    const firstToolGroup = document.querySelector(".left-tool-rail .geometry-toolbar-group");
    const undoButtonRect = document.getElementById("undoBtn").getBoundingClientRect();
    const geometrySheetDisplay = getComputedStyle(document.querySelector(".mode-overlay-sheet")).display;
    const firstToolGroupStyle = getComputedStyle(firstToolGroup);
    const firstToolGroupButtons = [...firstToolGroup.querySelectorAll("button")]
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return Math.round((rect.left + rect.right) / 2);
      });
    return {
      visibleTopButtons,
      visibleLeftCommandIds,
      pointToolVisible: getComputedStyle(document.getElementById("toolPoint")).display !== "none",
      blockCreateParentId: document.getElementById("toolCreateBlock").closest("section").id,
      blockPlaceParentId: document.getElementById("toolPlaceBlock").closest("section").id,
      presentationGroupVisible: getComputedStyle(document.getElementById("presentationStyleGroup")).display !== "none",
      geometrySheetDisplay,
      firstToolGroupBorderTopWidth: firstToolGroupStyle.borderTopWidth,
      firstToolGroupBorderLeftWidth: firstToolGroupStyle.borderLeftWidth,
      firstToolGroupBackground: firstToolGroupStyle.backgroundColor,
      modeParentClass: modeOverlay.parentElement.className,
      fileGroupParentClass: fileGroup.parentElement.className,
      fileGroupText: fileGroup.textContent.trim(),
      fileButtonWidth: fileButtonRect.width,
      fileButtonHeight: fileButtonRect.height,
      presentationSheetLabelExists: Boolean(document.getElementById("presentationSheetLabel")),
      undoButtonLeft: undoButtonRect.left,
      toggleParentClass: toggle.parentElement.className,
      tabsParentClass: sidebarTabs.parentElement.className,
      tabsInsideSidebar: Boolean(sidebarTabs.closest(".side")),
      tabsDirection: getComputedStyle(sidebarTabs).flexDirection,
      toolbarRect: { left: toolbarRect.left, right: toolbarRect.right, top: toolbarRect.top, bottom: toolbarRect.bottom },
      fileGroupRect: { left: fileGroupRect.left, right: fileGroupRect.right, top: fileGroupRect.top, bottom: fileGroupRect.bottom },
      leftRailRect: { left: leftRailRect.left, right: leftRailRect.right, top: leftRailRect.top, bottom: leftRailRect.bottom },
      modeRect: { left: modeRect.left, right: modeRect.right, top: modeRect.top, bottom: modeRect.bottom },
      leftRailScrollableX: leftRail.scrollWidth > leftRail.clientWidth + 1,
      leftRailScrollableY: leftRail.scrollHeight > leftRail.clientHeight + 1,
      firstToolGroupColumnCount: new Set(firstToolGroupButtons).size,
      sketchLeft: sketchRect.left,
      blockLeft: blockRect.left,
      toggleRect: { left: toggleRect.left, right: toggleRect.right, top: toggleRect.top, bottom: toggleRect.bottom },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  await page.screenshot({ path: "test-results/toolbar-layout.png", fullPage: true });
  expect(layout.visibleTopButtons).toEqual([
    "undoBtn",
    "redoBtn",
    "exportBtn",
    "importBtn",
    "geometryModeBtn",
    "presentationModeBtn",
  ]);
  expect(layout.visibleLeftCommandIds).toEqual(
    expect.arrayContaining([
      "toolSelect",
      "toolPoint",
      "toolLine",
      "toolCircle",
      "toolArc",
      "toolConstructionLine",
      "toolRectangle",
      "toolTrim",
      "toolFillet",
      "toolOffset",
      "distance",
      "coincident",
      "horizontal",
      "vertical",
      "parallel",
      "perpendicular",
      "concentric",
      "equal",
      "tangent",
      "fixPointBtn",
    ]),
  );
  expect(layout.pointToolVisible).toBe(true);
  expect(layout.blockCreateParentId).toBe("blockOverlay");
  expect(layout.blockPlaceParentId).toBe("blockOverlay");
  expect(layout.presentationGroupVisible).toBe(false);
  expect(layout.geometrySheetDisplay).toBe("none");
  expect(layout.firstToolGroupBorderTopWidth).toBe("1px");
  expect(layout.firstToolGroupBorderLeftWidth).toBe("0px");
  expect(layout.firstToolGroupBackground).toBe("rgba(0, 0, 0, 0)");
  expect(layout.modeParentClass).toBe("toolbar-row mode-toolbar-row");
  expect(layout.fileGroupParentClass).toBe("toolbar-row file-toolbar-row");
  expect(layout.fileGroupText).toBe("");
  expect(layout.fileButtonWidth).toBe(26);
  expect(layout.fileButtonHeight).toBe(26);
  expect(layout.presentationSheetLabelExists).toBe(false);
  expect(layout.fileGroupRect.left).toBeLessThan(20);
  expect(layout.modeRect.left).toBeLessThan(20);
  expect(layout.fileGroupRect.bottom).toBeLessThanOrEqual(layout.modeRect.top + 1);
  expect(layout.fileGroupRect.top).toBeLessThan(layout.modeRect.top);
  expect(layout.modeRect.bottom).toBeLessThanOrEqual(layout.leftRailRect.top + 1);
  expect(layout.undoButtonLeft).toBeGreaterThanOrEqual(layout.fileGroupRect.left);
  expect(layout.firstToolGroupColumnCount).toBe(2);
  expect(layout.leftRailScrollableX).toBe(false);
  expect(layout.leftRailScrollableY).toBe(false);
  expect(layout.sketchLeft).toBeGreaterThan(layout.leftRailRect.right);
  expect(layout.blockLeft).toBeGreaterThan(layout.leftRailRect.right);
  expect(layout.toggleParentClass).toBe("work-area");
  expect(layout.tabsParentClass).toBe("work-area");
  expect(layout.tabsInsideSidebar).toBe(false);
  expect(layout.tabsDirection).toBe("column");
  expect(layout.toggleRect.right).toBeLessThanOrEqual(layout.viewport.width);
  expect(layout.toggleRect.top).toBeGreaterThan(0);
  expect(layout.toggleRect.bottom).toBeLessThan(layout.viewport.height);

  await page.click("#toggleSideBtn");
  expect(await page.locator(".side").isVisible()).toBe(true);
  const openSidebarLayout = await page.evaluate(() => {
    const sideRect = document.querySelector(".side").getBoundingClientRect();
    const toolbarRect = document.querySelector(".toolbar").getBoundingClientRect();
    const modeRect = document.querySelector(".mode-overlay").getBoundingClientRect();
    const fileGroupRect = document.querySelector(".file-toolbar-group").getBoundingClientRect();
    return {
      sideTop: sideRect.top,
      toolbarBottom: toolbarRect.bottom,
      fileLeft: fileGroupRect.left,
      modeLeft: modeRect.left,
      modeParentClass: document.querySelector(".mode-overlay").parentElement.className,
      modeTop: modeRect.top,
      fileBottom: fileGroupRect.bottom,
      appCollapsed: document.querySelector(".app").classList.contains("side-collapsed"),
    };
  });
  expect(openSidebarLayout.appCollapsed).toBe(false);
  expect(openSidebarLayout.modeParentClass).toBe("toolbar-row mode-toolbar-row");
  expect(openSidebarLayout.sideTop).toBeGreaterThanOrEqual(openSidebarLayout.toolbarBottom - 1);
  expect(openSidebarLayout.fileLeft).toBeLessThan(20);
  expect(openSidebarLayout.modeLeft).toBeLessThan(20);
  expect(openSidebarLayout.fileBottom).toBeLessThanOrEqual(openSidebarLayout.modeTop + 1);

  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width * 0.48, canvas.y + canvas.height * 0.82);
  expect(await page.locator(".side").isVisible()).toBe(false);
  const collapsedModeLayout = await page.evaluate(() => {
    const fileGroupRect = document.querySelector(".file-toolbar-group").getBoundingClientRect();
    const modeRect = document.querySelector(".mode-overlay").getBoundingClientRect();
    return {
      fileLeft: fileGroupRect.left,
      modeLeft: modeRect.left,
      fileBottom: fileGroupRect.bottom,
      modeTop: modeRect.top,
    };
  });
  expect(collapsedModeLayout.fileLeft).toBeLessThan(20);
  expect(collapsedModeLayout.modeLeft).toBeLessThan(20);
  expect(collapsedModeLayout.fileBottom).toBeLessThanOrEqual(collapsedModeLayout.modeTop + 1);

  await page.click("#presentationModeBtn");
  await page.waitForFunction(() => document.body.classList.contains("presentation-mode"));
  const collapsedPresentationLayout = await page.evaluate(() => {
    const modeRect = document.querySelector(".mode-overlay").getBoundingClientRect();
    const fileGroupRect = document.querySelector(".file-toolbar-group").getBoundingClientRect();
    const sheetRect = document.querySelector(".mode-overlay-sheet").getBoundingClientRect();
    return {
      fileLeft: fileGroupRect.left,
      modeLeft: modeRect.left,
      fileBottom: fileGroupRect.bottom,
      modeTop: modeRect.top,
      sheetVisible: Boolean(sheetRect.width && sheetRect.height),
      modeParentClass: document.querySelector(".mode-overlay").parentElement.className,
      appCollapsed: document.querySelector(".app").classList.contains("side-collapsed"),
    };
  });
  expect(collapsedPresentationLayout.appCollapsed).toBe(true);
  expect(collapsedPresentationLayout.modeParentClass).toBe("toolbar-row mode-toolbar-row");
  expect(collapsedPresentationLayout.sheetVisible).toBe(true);
  expect(collapsedPresentationLayout.fileLeft).toBeLessThan(20);
  expect(collapsedPresentationLayout.modeLeft).toBeLessThan(20);
  expect(collapsedPresentationLayout.fileBottom).toBeLessThanOrEqual(collapsedPresentationLayout.modeTop + 1);
  const presentationToolLayout = await page.evaluate(() => ({
    presentationGroupVisible: getComputedStyle(document.getElementById("presentationStyleGroup")).display !== "none",
    geometryGroupsVisible: [...document.querySelectorAll(".left-tool-rail .geometry-toolbar-group")]
      .some((element) => getComputedStyle(element).display !== "none"),
    selectVisible: getComputedStyle(document.getElementById("presentationSelectBtn")).display !== "none",
    dimensionVisible: getComputedStyle(document.getElementById("presentationDimensionBtn")).display !== "none",
    leaderVisible: getComputedStyle(document.getElementById("presentationLeaderBtn")).display !== "none",
  }));
  expect(presentationToolLayout.presentationGroupVisible).toBe(true);
  expect(presentationToolLayout.geometryGroupsVisible).toBe(false);
  expect(presentationToolLayout.selectVisible).toBe(true);
  expect(presentationToolLayout.dimensionVisible).toBe(true);
  expect(presentationToolLayout.leaderVisible).toBe(true);
  await page.screenshot({ path: "test-results/presentation-layout.png", fullPage: true });
  await page.click("#toggleSideBtn");
  expect(await page.locator(".side").isVisible()).toBe(true);
  const openPresentationLayout = await page.evaluate(() => {
    const toolbarRect = document.querySelector(".toolbar").getBoundingClientRect();
    const sideRect = document.querySelector(".side").getBoundingClientRect();
    const fileGroupRect = document.querySelector(".file-toolbar-group").getBoundingClientRect();
    const modeRect = document.querySelector(".mode-overlay").getBoundingClientRect();
    return {
      sideTop: sideRect.top,
      toolbarBottom: toolbarRect.bottom,
      fileLeft: fileGroupRect.left,
      modeLeft: modeRect.left,
      fileBottom: fileGroupRect.bottom,
      modeTop: modeRect.top,
    };
  });
  expect(openPresentationLayout.sideTop).toBeGreaterThanOrEqual(openPresentationLayout.toolbarBottom - 1);
  expect(openPresentationLayout.fileLeft).toBeLessThan(20);
  expect(openPresentationLayout.modeLeft).toBeLessThan(20);
  expect(openPresentationLayout.fileBottom).toBeLessThanOrEqual(openPresentationLayout.modeTop + 1);
  await page.screenshot({ path: "test-results/presentation-sidebar-layout.png", fullPage: true });
  await page.mouse.click(canvas.x + canvas.width * 0.48, canvas.y + canvas.height * 0.82);
  expect(await page.locator(".side").isVisible()).toBe(false);
  await page.click("#geometryModeBtn");
  await page.waitForFunction(() => document.body.classList.contains("geometry-mode"));

  await page.evaluate(() => window.__cadTest.resetForEmptyBlockCreation());
  await page.click("#toolPoint");
  await page.mouse.click(canvas.x + canvas.width * 0.55, canvas.y + canvas.height * 0.55);
  await page.click('[data-sidebar-tab="points"]');
  expect(await page.locator("#pointList .geometry-list-row").count()).toBe(1);
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

test("sidebar lists circles and arcs and highlights related geometry", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const ids = await page.evaluate(() => window.__cadTest.resetForSidebarInspection());
  await page.click("#toggleSideBtn");
  await page.click('[data-sidebar-tab="circles"]');
  await expect(page.locator("#sidebarCircles")).toBeVisible();
  expect(await page.locator("#circleList .geometry-list-row").count()).toBe(1);
  await page.click('[data-sidebar-tab="arcs"]');
  await expect(page.locator("#sidebarArcs")).toBeVisible();
  expect(await page.locator("#arcList .geometry-list-row").count()).toBe(1);

  await page.click('[data-sidebar-tab="circles"]');
  await page.locator("#circleList .geometry-list-row").hover();
  expect(await page.evaluate(() => window.__cadTest.sidebarHighlightIds())).toEqual([]);
  await page.locator("#circleList .geometry-list-row").click();
  await page.mouse.move(700, 700);
  expect(await page.locator("#circleList .geometry-list-row").getAttribute("class")).toContain("sidebar-selected");
  expect(await page.evaluate(() => window.__cadTest.sidebarHighlightIds())).toEqual([ids.circle, ids.circleCenter].sort());

  await page.click('[data-sidebar-tab="constraints"]');
  await expect(page.locator("#sidebarConstraints")).toBeVisible();
  await page.locator("#constraintList .constraint-list-row").hover();
  expect(await page.evaluate(() => window.__cadTest.sidebarHighlightIds())).toEqual([ids.circle, ids.circleCenter].sort());
  await page.locator("#constraintList .constraint-list-row").click();
  const constraintHighlights = await page.evaluate(() => window.__cadTest.sidebarHighlightIds());
  expect(constraintHighlights).toContain(ids.line);
  expect(await page.locator("#constraintList .constraint-readonly-badge").count()).toBe(0);
  expect(await page.locator("#constraintList .relation-badge").count()).toBe(0);
  expect(await page.locator("#constraintList .fixed-point-list-row").count()).toBe(1);
  expect(await page.locator("#constraintList .fixed-point-list-row").textContent()).toContain(`固定 ${ids.fixedPoint}`);
  await page.screenshot({ path: "test-results/sidebar-inspection.png", fullPage: true });
});

test("line circle and arc offsets keep editable dimensional relationships", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.resetForOffsetConstraints());
  expect(result.created).toEqual([true, true, true]);
  expect(result.measurements[0]).toBeCloseTo(25, 5);
  expect(result.measurements[1]).toBeCloseTo(18, 5);
  expect(result.measurements[2]).toBeCloseTo(12, 5);
  expect(result.sourceRadii).toEqual([30, 40]);
  expect(result.restoredCount).toBe(3);
  expect(result.restoredTypes).toBe(3);
  expect(result.restoredTargets).toEqual([25, 18, 12]);
  expect(result.geometry).toEqual({ lines: 2, circles: 2, arcs: 2 });
  await page.screenshot({ path: "test-results/offset-constraints.png", fullPage: true });
});

test("offset tool collects a distance and creates a constrained copy", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const points = await page.evaluate(() => window.__cadTest.resetForOffsetUi());

  await page.click("#toolOffset");
  await page.mouse.click(points.source.x, points.source.y);
  await page.mouse.move(points.side.x, points.side.y);
  const previewState = await page.evaluate(() => window.__cadTest.offsetUiState());
  expect(previewState.pendingType).toBe(null);
  expect(previewState.previewDistance).toBeCloseTo(35, 3);
  await page.screenshot({ path: "test-results/offset-pointer-preview.png", fullPage: true });
  await page.mouse.click(points.side.x, points.side.y);
  const input = page.locator("#dimensionValueInput");
  expect(await input.isVisible()).toBe(true);
  await input.fill("25");
  await input.press("Enter");

  const state = await page.evaluate(() => window.__cadTest.offsetUiState());
  expect(state.pendingType).toBe(null);
  expect(state.lineCount).toBe(2);
  expect(state.constraintCount).toBe(1);
  expect(state.targets).toEqual([25]);
  expect(state.toolActive).toBe(true);
});

test("offset stays on the cursor side for direction-reversed constrained lines", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  for (const directionCase of ["vertical", "horizontal"]) {
    const points = await page.evaluate((value) => window.__cadTest.resetForOffsetDirection(value), directionCase);
    await page.click("#toolOffset");
    await page.mouse.click(points.source.x, points.source.y);
    await page.mouse.move(points.side.x, points.side.y);
    await page.mouse.click(points.side.x, points.side.y);
    const input = page.locator("#dimensionValueInput");
    await input.fill("20");
    await input.press("Enter");

    const state = await page.evaluate(() => window.__cadTest.offsetUiState());
    expect(state.lineOffsetDeltas).toHaveLength(1);
    expect(state.lineOffsetDeltas[0][points.expectedAxis]).toBeCloseTo(20, 5);
    expect(state.lineOffsetDeltas[0][points.expectedAxis === "x" ? "y" : "x"]).toBeCloseTo(0, 5);
  }
});

test("sketch deletion removes its subtree and active sketch siblings remain visible", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const sibling = await page.evaluate(() => window.__cadTest.resetForSiblingVisibility());
  expect(sibling.visible).toBe(true);
  expect(sibling.relation).toBe("sibling");
  expect(sibling.strokeWidth).toBe(1.8);
  expect(sibling.color).toBe("#cbd5e1");
  expect(sibling.rowHasSiblingClass).toBe(true);

  const deleted = await page.evaluate(() => window.__cadTest.resetForSketchDeletion());
  expect(deleted.deleted).toBe(true);
  expect(deleted.sketchIds).toEqual(["ROOT", "S1", "S4"]);
  expect(deleted.activeSketchId).toBe("ROOT");
  expect(deleted.geometry).toEqual({ points: 0, lines: 0, circles: 0, arcs: 0 });
  expect(deleted.styleKeys).toEqual([]);
  expect(deleted.presentationElementCount).toBe(0);
});

test("non-active sketch visibility can be toggled and is persisted", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForSiblingVisibility());
  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  let state = await page.evaluate(() => window.__cadTest.sketchVisibilityState("S2"));
  expect(state).toEqual({ preferenceVisible: false, effectiveVisible: false, serializedVisible: false, buttonPressed: "false" });

  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  state = await page.evaluate(() => window.__cadTest.sketchVisibilityState("S2"));
  expect(state).toEqual({ preferenceVisible: true, effectiveVisible: true, serializedVisible: true, buttonPressed: "true" });
});

test("sibling subtrees are visible and their visibility follows the branch hierarchy", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const setup = await page.evaluate(() => window.__cadTest.resetForSiblingSubtreeReference());
  expect(setup.relations).toEqual({ S10: "ancestor", S2: "sibling", S3: "sibling-descendant", S4: "sibling-descendant", S9: "hidden" });
  expect(setup.visible).toEqual({ S10: true, S2: true, S3: true, S4: true, S9: false });
  expect(setup.rowClasses).toEqual({ S2: true, S3: true, S4: true });

  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  let state = await page.evaluate(() => window.__cadTest.siblingSubtreeVisibilityState());
  expect(state).toEqual({
    S2: { preferenceVisible: false, effectiveVisible: false },
    S3: { preferenceVisible: true, effectiveVisible: false },
    S4: { preferenceVisible: true, effectiveVisible: false },
  });

  await page.click('.sketchVisibilityBtn[data-id="S2"]');
  state = await page.evaluate(() => window.__cadTest.siblingSubtreeVisibilityState());
  expect(state.S2.effectiveVisible).toBe(true);
  expect(state.S3.effectiveVisible).toBe(true);
  expect(state.S4.effectiveVisible).toBe(true);

  await page.click('.sketchVisibilityBtn[data-id="S3"]');
  state = await page.evaluate(() => window.__cadTest.siblingSubtreeVisibilityState());
  expect(state.S2.effectiveVisible).toBe(true);
  expect(state.S3.effectiveVisible).toBe(false);
  expect(state.S4.effectiveVisible).toBe(false);
});

test("blank canvas click clears a selected dimension without leaving the constraint command", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const points = await page.evaluate(() => window.__cadTest.resetForConstraintDimensionSelection());
  expect(await page.evaluate(() => window.__cadTest.constraintDimensionSelectionState())).toEqual({ selected: true, command: "parallel" });
  await page.mouse.click(points.blank.x, points.blank.y);
  expect(await page.evaluate(() => window.__cadTest.constraintDimensionSelectionState())).toEqual({ selected: false, command: "parallel" });
});

test("lines and arcs with fixed support geometry use the support constraint color", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const state = await page.evaluate(() => window.__cadTest.resetForSupportConstraintStatus());

  expect(state.supportLine).toEqual({ status: "support", color: "#0f766e" });
  expect(state.supportArc).toEqual({ status: "support", color: "#0f766e" });
  expect(state.underLine.status).toBe("under");
  expect(state.fullLine.status).toBe("full");
  expect(state.summary.support).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: "test-results/support-constraint-status.png", fullPage: true });
});

test("ancestor point and active line can receive a coincidence constraint in either role", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  let points = await page.evaluate(() => window.__cadTest.resetForReferencePointLineCoincidence());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.parentPoint.x, points.parentPoint.y);
  await page.mouse.click(points.childLine.x, points.childLine.y);
  let state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(1);
  expect(state.errors[0]).toBeLessThan(1e-5);
  expect(state.referenceSketchIds).toEqual(["S1"]);
  expect(state.sketchIds).toEqual(["S2"]);

  points = await page.evaluate(() => window.__cadTest.resetForReferencePointLineCoincidence());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.childPoint.x, points.childPoint.y);
  await page.mouse.click(points.parentLine.x, points.parentLine.y);
  state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(1);
  expect(state.errors[0]).toBeLessThan(1e-5);
  expect(state.referenceSketchIds).toEqual(["S1"]);
  expect(state.sketchIds).toEqual(["S2"]);
});

test("sibling geometry can be referenced without being moved by the active sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const points = await page.evaluate(() => window.__cadTest.resetForSiblingPointLineReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.siblingLine.x, points.siblingLine.y);
  await page.mouse.click(points.activePoint.x, points.activePoint.y);

  let state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(1);
  expect(state.errors[0]).toBeLessThan(1e-5);
  expect(state.referenceSketchIds).toEqual(["S2"]);
  expect(state.sketchIds).toEqual(["S1"]);

  state = await page.evaluate(() => window.__cadTest.moveSiblingReferenceLine(25));
  expect(state.success).toBe(true);
  expect(state.dependentSketchIds).toEqual(["S1"]);
  expect(state.siblingLine.p1.y).toBeCloseTo(25, 6);
  expect(state.siblingLine.p2.y).toBeCloseTo(25, 6);
  expect(state.activePoint.y).toBeCloseTo(25, 5);
  expect(state.reverseWouldCycle).toBe(true);
});

test("sibling descendants are read-only reference sources and protect their branch from deletion", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const points = await page.evaluate(() => window.__cadTest.resetForSiblingSubtreeReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.referenceLine.x, points.referenceLine.y);
  await page.mouse.click(points.activePoint.x, points.activePoint.y);

  let state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(1);
  expect(state.errors[0]).toBeLessThan(1e-5);
  expect(state.referenceSketchIds).toEqual(["S4"]);
  expect(state.sketchIds).toEqual(["S1"]);

  state = await page.evaluate(() => window.__cadTest.moveSiblingSubtreeReferenceLine(25));
  expect(state.success).toBe(true);
  expect(state.dependentSketchIds).toEqual(["S1"]);
  expect(state.line.p1.y).toBeCloseTo(65, 6);
  expect(state.line.p2.y).toBeCloseTo(65, 6);
  expect(state.point.y).toBeCloseTo(65, 5);

  expect(await page.evaluate(() => window.__cadTest.deleteSketchForTest("S2"))).toBe(false);
  expect(await page.evaluate(() => window.__cadTest.sketchVisibilityState("S4").preferenceVisible)).toBe(true);
});

test("reference dependents solve in topological order and cyclic loaded references are disabled", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const order = await page.evaluate(() => window.__cadTest.referenceDependencyOrderCase());
  expect(order.order).toEqual(["S1", "S5"]);
  expect(order.activePointY).toBeCloseTo(25, 5);
  expect(order.childPointY).toBeCloseTo(25, 5);

  const cycle = await page.evaluate(() => window.__cadTest.cyclicReferenceLoadCase());
  expect(cycle.total).toBe(2);
  expect(cycle.operational).toBe(1);
  expect(cycle.invalid).toEqual(["循環参照"]);
  expect(cycle.badges).toBeGreaterThan(0);
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
