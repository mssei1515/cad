const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.CAD2_E2E_PORT || 8765);
const baseUrl = `http://${host}:${port}`;
let serverProcess = null;

function objectSection(page, label) {
  const localized = {
    Point: ["Point", "点"], Line: ["Line", "線"], Circle: ["Circle", "円"], Arc: ["Arc", "円弧"],
    "Block Instance": ["Block Instance", "ブロックインスタンス"], Annotation: ["Annotation", "注記"], Constraint: ["Constraint", "拘束"],
  }[label] || [label];
  return page.locator(".object-explorer-panel > details", {
    has: page.locator("summary .explorer-section-label", { hasText: new RegExp(`^(?:${localized.join("|")})$`) }),
  });
}

async function expandObjectSection(page, label) {
  const section = objectSection(page, label);
  if ((await section.getAttribute("open")) === null) await section.locator("summary").click();
  return section;
}

async function openApplicationSettings(page) {
  const button = page.locator("#applicationSettingsBtn");
  if (!(await button.isVisible())) await page.locator(".app-menu > summary").first().click();
  await button.click();
}

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

test("document annotations can be dragged on the unified canvas", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForAnnotationDrag());

  const beforeText = await page.evaluate(() => window.__cadTest.annotationSnapshot());
  await page.mouse.move(beforeText.text.viewport.x, beforeText.text.viewport.y);
  await page.mouse.down();
  await page.mouse.move(beforeText.text.viewport.x, beforeText.text.viewport.y + 70, { steps: 8 });
  await page.mouse.up();

  const afterText = await page.evaluate(() => window.__cadTest.annotationSnapshot());
  expect(afterText.text.world.y).toBeGreaterThan(beforeText.text.world.y + 20);

  const beforeLeader = afterText;
  await page.mouse.move(beforeLeader.leader.viewport.x, beforeLeader.leader.viewport.y);
  await page.mouse.down();
  await page.mouse.move(beforeLeader.leader.viewport.x + 70, beforeLeader.leader.viewport.y - 35, { steps: 8 });
  await page.mouse.up();

  const afterLeader = await page.evaluate(() => window.__cadTest.annotationSnapshot());
  expect(afterLeader.leader.world.x).toBeGreaterThan(beforeLeader.leader.world.x + 20);
  expect(afterLeader.leader.world.y).toBeLessThan(beforeLeader.leader.world.y - 10);

  await page.keyboard.press("Control+Z");
  const afterUndo = await page.evaluate(() => window.__cadTest.annotationSnapshot());
  expect(afterUndo.leader.world.x).toBeCloseTo(beforeLeader.leader.world.x, 5);
  expect(afterUndo.leader.world.y).toBeCloseTo(beforeLeader.leader.world.y, 5);

  for (let i = 0; i < 12; i += 1) {
    const state = await page.evaluate(() => window.__cadTest.historyState());
    if (state.redoDisabled) break;
    await page.keyboard.press("Control+Y");
  }
  const afterRedo = await page.evaluate(() => window.__cadTest.annotationSnapshot());
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

test("geometry copy and paste crosses sketches with internal constraints and stepped offsets", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const initial = await page.evaluate(() => window.__cadTest.resetForGeometryClipboardTest());

  expect(initial.geometryBySketch.S1.points).toHaveLength(6);
  expect(initial.geometryBySketch.S1.lines).toHaveLength(1);
  expect(initial.constraints).toHaveLength(7);
  expect(initial.geometryBySketch.S1.points.some((item) => item.fixed)).toBe(true);
  expect(initial.constraints.map((item) => item.type)).toEqual(expect.arrayContaining(["lineFixed", "arcEndpointFixed"]));
  await expect(page.locator("#copySelectionBtn")).toHaveCount(0);
  await expect(page.locator("#cutSelectionBtn")).toHaveCount(0);
  await expect(page.locator("#pasteSelectionBtn")).toHaveCount(0);

  await page.keyboard.press("Control+C");
  let state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.clipboard).toEqual({ pasteCount: 0, points: 5, lines: 1, circles: 1, arcs: 1, constraints: 4, blockInstances: 0 });

  await page.click('.sketchActivateBtn[data-id="S2"]');
  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.activeSketchId).toBe("S2");
  expect(state.geometryBySketch.S2.points).toHaveLength(5);
  expect(state.geometryBySketch.S2.lines).toHaveLength(1);
  expect(state.geometryBySketch.S2.circles).toHaveLength(1);
  expect(state.geometryBySketch.S2.arcs).toHaveLength(1);
  expect(state.constraints.filter((item) => item.sketchId === "S2")).toHaveLength(4);
  expect(state.constraints.filter((item) => item.sketchId === "S2").some((item) => item.type === "lineFixed" || item.type === "arcEndpointFixed")).toBe(false);
  expect(state.geometryBySketch.S2.points.every((item) => !item.fixed)).toBe(true);
  expect(state.constraints.filter((item) => item.sketchId === "S2").every((item) => !item.reference)).toBe(true);
  expect(state.selected.points).toHaveLength(1);
  expect(state.selected.lines).toHaveLength(1);
  expect(state.selected.circles).toHaveLength(1);
  expect(state.selected.arcs).toHaveLength(1);
  expect(state.geometryBySketch.S2.lines[0].id).not.toBe(state.geometryBySketch.S1.lines[0].id);
  const sourceDimension = state.constraints.find((item) => item.sketchId === "S1" && item.type === "distance").dimension;
  const pastedDimension = state.constraints.find((item) => item.sketchId === "S2" && item.type === "distance").dimension;
  expect(pastedDimension.x - sourceDimension.x).toBeCloseTo(24, 6);
  expect(pastedDimension.y - sourceDimension.y).toBeCloseTo(24, 6);

  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.clipboard.pasteCount).toBe(2);
  expect(state.geometryBySketch.S2.lines).toHaveLength(2);
  expect(state.geometryBySketch.S2.lines[1].p1).not.toBe(state.geometryBySketch.S2.lines[0].p1);
  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.geometryBySketch.S2.lines).toHaveLength(1);
});

test("cut uses one undo step and keeps a pasteable cross-sketch payload", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForGeometryClipboardTest());

  await page.keyboard.press("Control+X");
  let state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.clipboard.constraints).toBe(4);
  expect(state.geometryBySketch.S1.points).toHaveLength(1);
  expect(state.geometryBySketch.S1.lines).toHaveLength(0);
  expect(state.geometryBySketch.S1.circles).toHaveLength(0);
  expect(state.geometryBySketch.S1.arcs).toHaveLength(0);
  expect(state.constraints).toHaveLength(0);
  expect(state.history.undoCount).toBe(2);

  await page.click('.sketchActivateBtn[data-id="S2"]');
  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.geometryBySketch.S1.lines).toHaveLength(0);
  expect(state.geometryBySketch.S2.lines).toHaveLength(1);
  expect(state.constraints.filter((item) => item.sketchId === "S2")).toHaveLength(4);

  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.geometryBySketch.S1.lines).toHaveLength(0);
  expect(state.geometryBySketch.S2.lines).toHaveLength(0);
  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.geometryBySketch.S1.lines).toHaveLength(1);
  expect(state.constraints).toHaveLength(7);
  expect(state.clipboard.constraints).toBe(4);
});

test("block instances and their closed constraints can be copied across sketches", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockClipboardTest());

  await page.keyboard.press("Control+C");
  let state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.clipboard).toEqual({ pasteCount: 0, points: 0, lines: 0, circles: 0, arcs: 0, constraints: 1, blockInstances: 1 });
  await page.click('.sketchActivateBtn[data-id="S2"]');
  await page.keyboard.press("Control+V");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.geometryBySketch.S2.blockInstances).toHaveLength(1);
  expect(state.geometryBySketch.S2.blockInstances[0]).toEqual(expect.objectContaining({ x: 34, y: 44, definitionId: "B1", fixed: false, rotationLocked: true }));
  expect(state.selectedBlockInstanceIds).toEqual([state.geometryBySketch.S2.blockInstances[0].id]);
  const pastedConstraints = state.constraints.filter((item) => item.sketchId === "S2");
  expect(pastedConstraints).toHaveLength(1);
  expect(pastedConstraints[0].line).toContain(`${state.geometryBySketch.S2.blockInstances[0].id}@`);

  await page.keyboard.press("Control+Z");
  state = await page.evaluate(() => window.__cadTest.clipboardStateForTest());
  expect(state.geometryBySketch.S2.blockInstances).toHaveLength(0);
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

test("unified workspace uses fixed Explorer Canvas Properties and Status regions", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector).getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const blockMenu = [...document.querySelectorAll(".app-menu")].find((item) => item.querySelector(":scope > summary")?.textContent.trim() === "ブロック");
    return {
      menu: rect(".menu-bar"),
      toolbar: rect(".command-toolbar"),
      explorer: rect(".explorer"),
      canvas: rect(".canvas-area"),
      properties: rect(".properties"),
      status: rect(".status-bar"),
      modeControls: document.querySelectorAll("#geometryModeBtn, #presentationModeBtn, #presentationSheetSelect").length,
      menus: [...document.querySelectorAll(".app-menu > summary")].map((item) => item.textContent.trim()),
      toolIds: [...document.querySelectorAll(".command-toolbar button")].map((item) => item.id).filter(Boolean),
      iconButtons: [...document.querySelectorAll(".command-toolbar button")].map((item) => ({
        text: item.textContent.trim(),
        hasIcon: Boolean(item.querySelector(":scope > svg")),
        title: item.getAttribute("title"),
        label: item.getAttribute("aria-label"),
      })),
      canvasCursor: getComputedStyle(document.querySelector("#canvas")).cursor,
      gridControls: document.querySelectorAll("#viewGridInput").length,
      logo: {
        count: document.querySelectorAll(".app-logo-svg").length,
        viewBox: document.querySelector(".app-logo-svg")?.getAttribute("viewBox"),
        width: document.querySelector(".app-logo-svg")?.getBoundingClientRect().width,
        backgroundCount: document.querySelectorAll(".app-logo-svg > rect").length,
      },
      constraintStatusIcon: {
        eyeCount: document.querySelectorAll("#constraintStatusViewBtn .constraint-status-eye").length,
        swatches: [...document.querySelectorAll("#constraintStatusViewBtn .constraint-status-swatch")].map((item) => getComputedStyle(item).stroke),
      },
      documentNameControls: document.querySelectorAll("#documentNameInput, .document-name-input").length,
      menuBackground: getComputedStyle(document.querySelector(".menu-bar")).backgroundColor,
      statusBackground: getComputedStyle(document.querySelector(".status-bar")).backgroundColor,
      geometryMenuColumnCount: getComputedStyle(document.querySelector(".menu-command-list")).gridTemplateColumns.split(" ").length,
      fileMenuTools: [...document.querySelectorAll(".app-menu:first-of-type [data-menu-tool]")].map((item) => item.dataset.menuTool),
      blockMenuTools: blockMenu ? [...blockMenu.querySelectorAll("[data-menu-tool]")].map((item) => item.dataset.menuTool) : [],
      blockCreateButtonCount: document.querySelectorAll("#toolCreateBlock").length,
      sketchTreeToggleCount: document.querySelectorAll("#toggleSketchTreeBtn").length,
      explorerTabs: [...document.querySelectorAll("[data-explorer-tab]")].map((item) => ({
        id: item.dataset.explorerTab,
        text: item.textContent.trim(),
      })),
      activeTabStyle: {
        radius: getComputedStyle(document.querySelector(".panel-tab.active")).borderTopLeftRadius,
        background: getComputedStyle(document.querySelector(".panel-tab.active")).backgroundColor,
        borderBottom: getComputedStyle(document.querySelector(".panel-tab.active")).borderBottomColor,
        height: document.querySelector(".panel-tab.active").getBoundingClientRect().height,
        stripHeight: document.querySelector(".panel-tabs").getBoundingClientRect().height,
        inactiveBackground: getComputedStyle(document.querySelector(".panel-tab:not(.active)")).backgroundColor,
      },
    };
  });

  expect(layout.modeControls).toBe(0);
  expect(layout.menus).toEqual(["ファイル", "編集", "表示", "ジオメトリ", "ブロック", "拘束", "注記", "ヘルプ"]);
  expect(layout.toolIds).toEqual(expect.arrayContaining(["exportBtn", "importBtn", "undoBtn", "redoBtn", "deleteSelectionBtn", "toolSelect", "toolPoint", "toolLine", "toolCreateBlock", "annotationLeaderBtn", "annotationTextBtn"]));
  expect(layout.iconButtons.every((button) => button.text === "" && button.hasIcon && button.title && button.label)).toBe(true);
  expect(layout.canvasCursor).toBe("default");
  expect(layout.gridControls).toBe(0);
  expect(layout.logo).toEqual({ count: 1, viewBox: "0 0 256 256", width: 30, backgroundCount: 0 });
  expect(layout.constraintStatusIcon).toEqual({
    eyeCount: 2,
    swatches: ["rgb(17, 24, 39)", "rgb(15, 118, 110)", "rgb(245, 158, 11)", "rgb(220, 38, 38)"],
  });
  expect(layout.documentNameControls).toBe(0);
  expect(layout.menuBackground).toBe("rgb(30, 58, 95)");
  expect(layout.menuBackground).toBe(layout.statusBackground);
  expect(layout.geometryMenuColumnCount).toBe(1);
  expect(layout.fileMenuTools).toEqual(["exportBtn", "importBtn"]);
  expect(layout.blockMenuTools).toEqual(["toolCreateBlock", "openBlockDefinitionsBtn"]);
  expect(layout.blockCreateButtonCount).toBe(1);
  expect(layout.sketchTreeToggleCount).toBe(0);
  expect(layout.explorerTabs).toEqual([
    { id: "geometry", text: "ジオメトリ" },
    { id: "blocks", text: "ブロック" },
    { id: "constraint", text: "拘束" },
  ]);
  expect(layout.activeTabStyle).toEqual({
    radius: "5px",
    background: "rgb(255, 255, 255)",
    borderBottom: "rgb(255, 255, 255)",
    height: 27,
    stripHeight: 32,
    inactiveBackground: "rgba(0, 0, 0, 0)",
  });
  expect(await page.locator("#blockInstanceObjectList").evaluate((element) => element.closest("[data-explorer-panel]")?.dataset.explorerPanel)).toBe("blocks");
  expect(await page.locator("#constraintList").evaluate((element) => element.closest("[data-explorer-panel]")?.dataset.explorerPanel)).toBe("constraint");
  expect(await page.locator("#sketchOverlay").evaluate((element) => element.parentElement?.classList.contains("canvas-area"))).toBe(true);
  expect(layout.explorer.left).toBe(0);
  expect(layout.explorer.right).toBeCloseTo(layout.canvas.left, 0);
  expect(layout.canvas.right).toBeCloseTo(layout.properties.left, 0);
  expect(layout.explorer.top).toBeGreaterThanOrEqual(layout.toolbar.bottom - 1);
  expect(layout.status.top).toBeGreaterThanOrEqual(layout.canvas.bottom - 1);

  await expect(page.locator("#explorerGeometry")).toBeVisible();
  await expect(page.locator("#explorerBlocks")).toBeHidden();
  await expect(page.locator("#explorerConstraint")).toBeHidden();
  await page.click('[data-explorer-tab="blocks"]');
  await expect(page.locator("#explorerBlocks")).toBeVisible();
  await expect(page.locator("#explorerBlocks > details")).toHaveCount(0);
  await expect(page.locator("#blockInstanceObjectList")).toBeVisible();
  await expect(page.locator("#explorerGeometry")).toBeHidden();
  await expect(page.locator("#explorerConstraint")).toBeHidden();
  await page.click("#openBlockDefinitionsBtn");
  await expect(page.locator("#blockDefinitionsDialog")).toBeVisible();
  await expect(page.locator("#blockList")).toBeVisible();
  await page.locator("#blockDefinitionsDialog button[value=cancel]").first().click();
  await page.locator(".app-menu > summary").filter({ hasText: /^ブロック$/ }).click();
  await page.locator('.app-menu[open] [data-menu-tool="openBlockDefinitionsBtn"]').click();
  await expect(page.locator("#blockDefinitionsDialog")).toBeVisible();
  await page.locator("#blockDefinitionsDialog button[value=cancel]").first().click();
  await page.click('[data-explorer-tab="geometry"]');
  await expect(page.locator("#explorerGeometry")).toBeVisible();
  await expect(page.locator("#explorerBlocks")).toBeHidden();
  await expect(page.locator("#explorerConstraint")).toBeHidden();
  expect(await page.locator("#explorerGeometry > details").evaluateAll((details) => details.map((item) => item.open))).toEqual([
    false, false, false, false, false,
  ]);
  await expect(page.locator("#pointList .geometry-list-row")).toHaveCount(4);
  const geometryCounts = await page.evaluate(() => Object.fromEntries([
    ["point", "pointList"], ["line", "lineList"], ["circle", "circleList"], ["arc", "arcList"], ["annotation", "annotationObjectList"],
  ].map(([kind, listId]) => [kind, {
    shown: Number(document.getElementById(`${kind}Count`)?.textContent),
    listed: document.getElementById(listId)?.children.length,
  }])));
  expect(Object.values(geometryCounts).every(({ shown, listed }) => shown === listed)).toBe(true);
  const pointSection = await expandObjectSection(page, "Point");
  await expect(pointSection).toHaveAttribute("open", "");
  await page.click('[data-explorer-tab="blocks"]');
  await page.click('[data-explorer-tab="geometry"]');
  await expect(pointSection).toHaveAttribute("open", "");
  await page.click('[data-explorer-tab="constraint"]');
  await expect(page.locator("#explorerConstraint")).toBeVisible();
  await expect(page.locator("#explorerConstraint > details")).toHaveCount(0);
  await expect(page.locator("#constraintList")).toBeVisible();
  await expect(page.locator("#constraintList > .constraint-summary-row")).toHaveCount(1);
  const explorerHeaderBackgrounds = await page.evaluate(() => ({
    block: getComputedStyle(document.querySelector("#explorerBlocks .section-header")).backgroundColor,
    constraint: getComputedStyle(document.querySelector("#constraintList > .constraint-summary-row")).backgroundColor,
  }));
  expect(explorerHeaderBackgrounds.constraint).toBe(explorerHeaderBackgrounds.block);
  expect(explorerHeaderBackgrounds.constraint).not.toBe("rgba(0, 0, 0, 0)");
  await page.click('[data-explorer-tab="geometry"]');

  expect(await page.evaluate(() => window.__cadTest.documentNameState())).toEqual({
    modelName: "無題",
    displayName: "無題",
    serializedName: "無題",
    title: "無題 - Cad2",
  });

  const sketchTree = await page.evaluate(() => {
    const row = document.querySelector('.sketch-item[data-id="S1"]');
    const gutter = row?.querySelector(".sketch-tree-gutter");
    const elbow = gutter?.querySelector(".tree-segment.elbow");
    return {
      rowHeight: row?.getBoundingClientRect().height,
      rowDisplay: row ? getComputedStyle(row).display : null,
      gutterDisplay: gutter ? getComputedStyle(gutter).display : null,
      segmentCount: gutter?.children.length || 0,
      verticalLine: elbow ? getComputedStyle(elbow, "::before").borderLeftWidth : null,
      horizontalLine: elbow ? getComputedStyle(elbow, "::after").borderTopWidth : null,
    };
  });
  expect(sketchTree).toEqual({ rowHeight: 19, rowDisplay: "grid", gutterDisplay: "grid", segmentCount: 2, verticalLine: "1px", horizontalLine: "1px" });

  expect(await page.evaluate(() => {
    const canvas = document.querySelector("#canvas");
    canvas.classList.add("is-dragging");
    const cursor = getComputedStyle(canvas).cursor;
    canvas.classList.remove("is-dragging");
    return cursor;
  })).toBe("default");

  const fileMenu = page.locator(".app-menu").nth(0);
  const editMenu = page.locator(".app-menu").nth(1);
  const geometryMenu = page.locator(".app-menu").nth(3);
  await editMenu.locator("summary").hover();
  await page.waitForTimeout(180);
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  await fileMenu.locator("summary").click();
  await expect(fileMenu).toHaveAttribute("open", "");
  await page.evaluate(() => {
    const summary = document.querySelectorAll(".app-menu > summary")[1];
    const menu = summary.parentElement;
    window.__menuHoverTiming = {};
    summary.addEventListener("pointerenter", () => {
      window.__menuHoverTiming.startedAt = performance.now();
    }, { once: true });
    menu.addEventListener("toggle", () => {
      if (menu.open) window.__menuHoverTiming.openedAt = performance.now();
    });
  });
  await editMenu.locator("summary").hover();
  await expect(fileMenu).not.toHaveAttribute("open", "");
  await expect(editMenu).toHaveAttribute("open", "");
  const menuHoverElapsed = await page.evaluate(() => window.__menuHoverTiming.openedAt - window.__menuHoverTiming.startedAt);
  expect(menuHoverElapsed).toBeLessThan(50);
  await expect(page.locator(".app-menu[open]")).toHaveCount(1);
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("編集");
  await page.locator(".app-logo-svg").click();
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  await fileMenu.locator("summary").click();
  await geometryMenu.locator("summary").click();
  await expect(fileMenu).not.toHaveAttribute("open", "");
  await expect(geometryMenu).toHaveAttribute("open", "");
  await page.locator(".app-logo-svg").click();
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await fileMenu.locator("summary").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  expect((await page.evaluate(() => window.__cadTest.selectedGeometryIdsForTest())).lines).toEqual(["L1"]);
  await fileMenu.locator("summary").click();
  await openApplicationSettings(page);
  await expect(page.locator(".app-menu[open]")).toHaveCount(0);
  await expect(page.locator("#applicationSettingsDialog")).toBeVisible();
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();

  await page.evaluate(() => window.__cadTest.resetForEmptyBlockCreation());
  const canvas = await page.locator("#canvas").boundingBox();
  await page.click("#toolPoint");
  await page.mouse.click(canvas.x + canvas.width * 0.55, canvas.y + canvas.height * 0.55);
  await page.click('[data-explorer-tab="geometry"]');
  await expect(page.locator("#pointList .geometry-list-row")).toHaveCount(1);
  await page.locator("#pointList .geometry-list-row").click();
  await expect(page.locator("#propertiesPanel")).toContainText("点");
  await page.click("#deleteSelectionBtn");
  await expect(page.locator("#pointList .geometry-list-row")).toHaveCount(0);
});

test("Canvas selection updates Properties, side panels collapse, and narrow toolbar labels do not overlap", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const linePosition = await page.evaluate(() => window.__cadTest.geometryClientPositionForTest("line", "L1"));
  await page.mouse.click(linePosition.x, linePosition.y);
  await expect(page.locator("#propertiesPanel")).toContainText("線 L1");

  const initial = await page.evaluate(() => ({
    explorer: document.querySelector(".explorer").getBoundingClientRect().width,
    properties: document.querySelector(".properties").getBoundingClientRect().width,
    canvas: document.querySelector(".canvas-area").getBoundingClientRect().width,
  }));
  await page.click("#toggleExplorerPanelBtn");
  await expect(page.locator("#toggleExplorerPanelBtn")).toHaveAttribute("aria-expanded", "false");
  await page.click("#togglePropertiesPanelBtn");
  await expect(page.locator("#togglePropertiesPanelBtn")).toHaveAttribute("aria-expanded", "false");
  const collapsed = await page.evaluate(() => ({
    explorer: document.querySelector(".explorer").getBoundingClientRect().width,
    properties: document.querySelector(".properties").getBoundingClientRect().width,
    canvas: document.querySelector(".canvas-area").getBoundingClientRect().width,
  }));
  expect(collapsed.explorer).toBeCloseTo(36, 0);
  expect(collapsed.properties).toBeCloseTo(36, 0);
  expect(collapsed.canvas).toBeGreaterThan(initial.canvas);

  await page.click("#toggleExplorerPanelBtn");
  await page.click("#togglePropertiesPanelBtn");
  const restored = await page.evaluate(() => ({
    explorer: document.querySelector(".explorer").getBoundingClientRect().width,
    properties: document.querySelector(".properties").getBoundingClientRect().width,
  }));
  expect(restored.explorer).toBeCloseTo(initial.explorer, 0);
  expect(restored.properties).toBeCloseTo(initial.properties, 0);

  await page.setViewportSize({ width: 800, height: 700 });
  const narrowToolbar = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".tool-group-label")];
    const buttons = [...document.querySelectorAll(".command-toolbar button")];
    const overlaps = labels.some((label) => {
      if (getComputedStyle(label).display === "none") return false;
      const a = label.getBoundingClientRect();
      return buttons.some((button) => {
        const b = button.getBoundingClientRect();
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      });
    });
    return { labelsHidden: labels.every((label) => getComputedStyle(label).display === "none"), overlaps };
  });
  expect(narrowToolbar).toEqual({ labelsHidden: true, overlaps: false });
});

test("application language defaults to Japanese and persists the full UI selection", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator(".app-menu > summary").first()).toHaveText("ファイル");
  await expect(page.locator('[data-explorer-tab="blocks"]')).toHaveText("ブロック");
  await expect(page.locator(".properties .panel-title-label")).toHaveText("プロパティ");

  await openApplicationSettings(page);
  await expect(page.locator("#applicationLanguageSelect")).toHaveValue("ja");
  await page.locator("#applicationLanguageSelect").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".app-menu > summary").first()).toHaveText("File");
  await expect(page.locator('[data-explorer-tab="blocks"]')).toHaveText("Block");
  await expect(page.locator(".properties .panel-title-label")).toHaveText("Properties");
  await expect(page.locator("#hint")).toContainText("Fully constrained");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await page.click('[data-explorer-tab="blocks"]');
  await page.click("#openBlockDefinitionsBtn");
  await expect(page.locator("#blockDefinitionsDialog")).toContainText("No blocks");
  await page.locator("#blockDefinitionsDialog button[value=cancel]").first().click();

  await page.reload();
  await page.waitForFunction(() => window.__cadTest);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await openApplicationSettings(page);
  await expect(page.locator("#applicationLanguageSelect")).toHaveValue("en");
  await page.locator("#applicationLanguageSelect").selectOption("ja");
  await expect(page.locator(".app-menu > summary").first()).toHaveText("ファイル");
  await expect(page.locator("#hint")).toContainText("完全拘束");
  await expect(page.locator("#hint")).not.toContainText("Fully constrained");
});

test("Appearance cascades, used file colors are selectable, and constraint status supports mouse and Space", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const fixture = {
    version: 9,
    documentName: "appearance-cascade",
    defaultAppearance: { visible: true, color: "#ef4444", lineType: "solid", lineWidth: 1 },
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", appearance: {} },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", appearance: { color: "#16a34a" } },
    ],
    activeSketchId: "S1",
    points: [
      { id: "P1", x: 0, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: { color: "#f97316" } },
      { id: "P2", x: 100, y: 0, fixed: false, kind: "endpoint", sketchId: "S1", appearance: {} },
    ],
    lines: [{ id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1", appearance: { lineWidth: 4 } }],
    circles: [], arcs: [], constraints: [], blockDefinitions: [], blockInstances: [],
    annotations: [{ id: "AN1", type: "text", visible: true, text: "note", x: 0, y: 30, style: { color: "#0ea5e9" } }],
  };
  await page.evaluate((data) => window.__cadTest.importDocumentNameFixture(data, "appearance-cascade.json"), fixture);
  expect(await page.evaluate(() => window.__cadTest.appearanceStateForTest("line", "L1"))).toEqual({
    direct: { lineWidth: 4 },
    effective: { visible: true, color: "#16a34a", lineType: "solid", lineWidth: 4 },
    visible: true,
  });

  await page.click('[data-explorer-tab="geometry"]');
  await expandObjectSection(page, "Line");
  await page.locator('#lineList .geometry-list-row[data-id="L1"]').click();
  await expect(page.locator('#propertyVisible option[value=""]')).toHaveText("既定");
  await expect(page.locator('#propertyLineType option[value=""]')).toHaveText("既定");
  await expect(page.locator("#propertyColor")).toHaveAttribute("placeholder", "既定");
  await expect(page.locator("#propertyLineWidth")).toHaveAttribute("placeholder", "既定");
  await expect(page.locator(".property-color-picker")).toHaveAttribute("data-current-color", "#16a34a");
  await expect(page.locator(".property-color-default")).toHaveCount(0);
  await page.locator(".property-color-picker").click();
  await expect(page.locator("#colorPaletteDialog")).toBeVisible();
  expect(await page.locator("#defaultColorPalette .property-color-swatch").evaluateAll((items) => items.map((item) => item.dataset.paletteColor))).toEqual([
    "#111827", "#64748b", "#dc2626", "#f97316", "#f59e0b", "#16a34a", "#0ea5e9", "#2563eb", "#7c3aed", "#db2777", "#ffffff",
  ]);
  expect(await page.locator("#usedColorPalette .property-color-swatch").evaluateAll((items) => items.map((item) => item.dataset.paletteColor))).toEqual([
    "#ef4444", "#16a34a", "#f97316", "#0ea5e9",
  ]);
  await page.locator("#colorPaletteDialog button[value=cancel]").first().click();
  await expect(page.locator("#propertiesPanel")).not.toContainText("継承");
  await openApplicationSettings(page);
  await page.locator("#applicationLanguageSelect").selectOption("en");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await expect(page.locator('#propertyVisible option[value=""]')).toHaveText("Default");
  await expect(page.locator('#propertyLineType option[value=""]')).toHaveText("Default");
  await expect(page.locator("#propertyColor")).toHaveAttribute("placeholder", "Default");
  await expect(page.locator("#propertyLineWidth")).toHaveAttribute("placeholder", "Default");
  await expect(page.locator(".property-color-default")).toHaveCount(0);
  await openApplicationSettings(page);
  await page.locator("#applicationLanguageSelect").selectOption("ja");
  await page.locator("#applicationSettingsDialog button[value=cancel]").first().click();
  await page.locator(".property-color-picker").click();
  await page.locator('#usedColorPalette .property-color-swatch[data-palette-color="#0ea5e9"]').click();
  expect((await page.evaluate(() => window.__cadTest.serializedModelForTest())).lines[0].appearance.color).toBe("#0ea5e9");
  await page.locator("#propertyColor").fill("");
  await page.locator("#propertyColor").blur();
  const inheritedColorState = await page.evaluate(() => window.__cadTest.serializedModelForTest());
  expect(inheritedColorState.lines).toHaveLength(1);
  expect(inheritedColorState.lines[0].appearance.color).toBeUndefined();
  await expect(page.locator(".property-color-picker")).toHaveAttribute("data-current-color", "#16a34a");
  await page.locator("#propertyColor").fill("#2563eb");
  await page.locator("#propertyColor").blur();
  expect((await page.evaluate(() => window.__cadTest.serializedModelForTest())).lines[0].appearance.color).toBe("#2563eb");
  await page.locator(".property-color-picker").click();
  await page.locator("#customColorPicker").fill("#7c3aed");
  await page.locator("#applyCustomColorBtn").click();
  expect((await page.evaluate(() => window.__cadTest.serializedModelForTest())).lines[0].appearance.color).toBe("#7c3aed");

  await page.locator("#propertyVisible").selectOption("false");
  expect((await page.evaluate(() => window.__cadTest.appearanceStateForTest("line", "L1"))).visible).toBe(false);
  await expect(page.locator("#constraintStatusViewBtn")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#constraintStatusViewBtn").click();
  expect(await page.evaluate(() => window.__cadTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: true, mouseLatched: true, spaceHeld: false }));
  expect(await page.evaluate(() => window.__cadTest.constraintStatusEndpointMarkerCountForTest())).toBe(0);
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  expect(await page.evaluate(() => window.__cadTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: true, mouseLatched: true, spaceHeld: false }));
  await page.locator("#constraintStatusViewBtn").click();
  expect(await page.evaluate(() => window.__cadTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: false, mouseLatched: false, spaceHeld: false }));
  await page.keyboard.down("Space");
  expect(await page.evaluate(() => window.__cadTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: true, mouseLatched: false, spaceHeld: true }));
  expect((await page.evaluate(() => window.__cadTest.appearanceStateForTest("line", "L1"))).visible).toBe(true);
  await page.keyboard.up("Space");
  expect(await page.evaluate(() => window.__cadTest.viewStateForTest())).toEqual(expect.objectContaining({ constraintStatus: false, mouseLatched: false, spaceHeld: false }));
});

test("startup sample L2 and L3 reuse the responsive P3 drag path while P1 stays fixed", async ({ page }) => {
  const deltas = Array.from({ length: 10 }, (_, index) => [-(index + 1) * 4, (index + 1) * 3]);
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  expect((await page.evaluate(() => window.__cadTest.authoringStateForTest())).fixedPointIds).toEqual(["P1"]);
  const pointResult = await page.evaluate(
    (dragDeltas) => window.__cadTest.geometryDragPathForTest({ kind: "point", id: "P3" }, dragDeltas),
    deltas,
  );
  const pointFinal = pointResult.previews.at(-1).state;
  expect(pointResult.previews.every((preview) => preview.success && !preview.blocked)).toBe(true);
  const pointMovement = Math.hypot(
    pointFinal.x - pointResult.startState.x,
    pointFinal.y - pointResult.startState.y,
  );
  expect(pointMovement).toBeGreaterThan(10);

  for (const id of ["L2", "L3"]) {
    await page.goto(`${baseUrl}/index.html?test=1`);
    await page.waitForFunction(() => window.__cadTest);
    const result = await page.evaluate(
      ({ lineId, dragDeltas }) => window.__cadTest.geometryDragPathForTest({ kind: "line", id: lineId }, dragDeltas),
      { lineId: id, dragDeltas: deltas },
    );
    const lineFinal = result.previews.at(-1).state;
    const draggedP3 = id === "L2" ? lineFinal.p2 : lineFinal.p1;
    expect(result.sessionAvailable, id).toBe(true);
    expect(result.previews.every((preview) => preview.success && !preview.blocked), id).toBe(true);
    expect(draggedP3.x, id).toBeCloseTo(pointFinal.x, 5);
    expect(draggedP3.y, id).toBeCloseTo(pointFinal.y, 5);
    expect(Math.max(...result.previews.map((preview) => preview.elapsedMs)), id).toBeLessThan(100);
  }

  const pointerResults = [];
  for (const id of ["L2", "L3"]) {
    await page.goto(`${baseUrl}/index.html?test=1`);
    await page.waitForFunction(() => window.__cadTest);
    const before = await page.evaluate((lineId) => ({
      line: window.__cadTest.geometryClientPositionForTest("line", lineId),
      p1: window.__cadTest.geometryClientPositionForTest("point", "P1"),
      p3: window.__cadTest.geometryClientPositionForTest("point", "P3"),
    }), id);
    await page.mouse.move(before.line.x, before.line.y);
    await page.mouse.down();
    await page.mouse.move(before.line.x - 40, before.line.y + 30, { steps: 10 });
    await page.mouse.up();
    const after = await page.evaluate(() => ({
      p1: window.__cadTest.geometryClientPositionForTest("point", "P1"),
      p3: window.__cadTest.geometryClientPositionForTest("point", "P3"),
    }));
    expect(after.p1.x, `${id}/P1.x`).toBeCloseTo(before.p1.x, 5);
    expect(after.p1.y, `${id}/P1.y`).toBeCloseTo(before.p1.y, 5);
    pointerResults.push({ x: after.p3.x - before.p3.x, y: after.p3.y - before.p3.y });
  }
  expect(pointerResults[0].x).toBeCloseTo(pointerResults[1].x, 4);
  expect(pointerResults[0].y).toBeCloseTo(pointerResults[1].y, 4);
});

test("Block Instance Appearance Override applies to the whole instance", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const initial = await page.evaluate(() => window.__cadTest.resetForBlockClipboardTest());
  const instanceId = initial.geometryBySketch.S1.blockInstances[0].id;
  await expect(page.locator("#propertiesPanel")).toContainText("外観の上書き");
  await page.locator("#propertyColor").fill("#7c3aed");
  await page.locator("#propertyColor").blur();
  const serialized = await page.evaluate(() => window.__cadTest.serializedModelForTest());
  expect(serialized.blockInstances[0].appearanceOverride.color).toBe("#7c3aed");
  expect((await page.evaluate((id) => window.__cadTest.appearanceStateForTest("block", id), instanceId)).effective.color).toBe("#7c3aed");
});

test("Constraint dimensions persist display properties without creating annotation dimensions", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForReadOnlyDuplicateDimension());
  await page.click('[data-explorer-tab="constraint"]');
  await page.locator("#constraintList .constraint-list-row").first().click();
  await page.locator('[data-dimension-display="precision"]').fill("3");
  await page.locator('[data-dimension-display="precision"]').blur();
  await expect(page.locator('[data-dimension-display="toleranceUpper"], [data-dimension-display="toleranceLower"]')).toHaveCount(0);
  const prefix = page.locator('[data-dimension-display="prefix"]');
  await prefix.fill("REF ");
  expect(await page.evaluate(() => window.__cadTest.drawnDimensionLabelsForTest())).toEqual(expect.arrayContaining([expect.stringContaining("REF ")]));
  const suffix = page.locator('[data-dimension-display="suffix"]');
  await suffix.fill(" mm");
  expect(await page.evaluate(() => window.__cadTest.drawnDimensionLabelsForTest())).toEqual(expect.arrayContaining([expect.stringMatching(/REF .* mm/)]));
  await suffix.blur();
  await page.locator('[data-dimension-display="arrows"]').uncheck();
  const label = await page.evaluate(() => window.__cadTest.dimensionClientPositionForTest(0));
  await page.mouse.move(label.x, label.y);
  await page.mouse.down();
  await page.mouse.move(label.x + 36, label.y + 18, { steps: 4 });
  await page.mouse.up();
  await page.locator('[data-dimension-display="visible"]').uncheck();
  expect(await page.evaluate(() => window.__cadTest.drawnDimensionLabelsForTest())).not.toEqual(expect.arrayContaining([expect.stringMatching(/REF .* mm/)]));
  await page.locator("#constraintStatusViewBtn").click();
  expect(await page.evaluate(() => window.__cadTest.drawnDimensionLabelsForTest())).toEqual(expect.arrayContaining([expect.stringMatching(/REF .* mm/)]));
  await page.locator("#constraintStatusViewBtn").click();
  const serialized = await page.evaluate(() => window.__cadTest.serializedModelForTest());
  expect(serialized.constraints[0].dimension.display).toEqual(expect.objectContaining({ visible: false, precision: 3, prefix: "REF ", suffix: " mm", arrows: false }));
  expect(serialized.annotations).toEqual([]);
});

test("Sketch tree and Geometry Explorer hover use the same emphasis as canvas hover without tree Geometry IDs", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const ids = await page.evaluate(() => window.__cadTest.resetForSidebarInspection());
  await page.mouse.move(ids.lineMid.x, ids.lineMid.y);
  const canvasHover = await page.evaluate((lineId) => window.__cadTest.hoverDisplayStateForTest("line", lineId), ids.line);
  expect(canvasHover).toEqual(expect.objectContaining({ canvasHovered: true, color: "#3b82f6", width: 2.2 }));
  await page.locator('.sketch-item[data-id="S1"]').hover();
  const treeHover = await page.evaluate((lineId) => window.__cadTest.hoverDisplayStateForTest("line", lineId), ids.line);
  expect(treeHover).toEqual(expect.objectContaining({ treeHovered: true, color: canvasHover.color, width: canvasHover.width }));
  for (const pointId of ids.lineEndpoints) {
    expect(await page.evaluate((id) => window.__cadTest.hoverDisplayStateForTest("point", id), pointId)).toEqual(expect.objectContaining({ treeHovered: false }));
  }
  expect(await page.evaluate(() => window.__cadTest.drawnGeometryIdLabelsForTest())).toEqual([]);
  await page.click('[data-explorer-tab="geometry"]');
  await expandObjectSection(page, "Line");
  await page.locator(`#lineList .geometry-list-row[data-id="${ids.line}"]`).hover();
  const objectHover = await page.evaluate((lineId) => window.__cadTest.hoverDisplayStateForTest("line", lineId), ids.line);
  expect(objectHover).toEqual(expect.objectContaining({ sidebarHovered: true, color: canvasHover.color, width: canvasHover.width }));
});

test("Sketch tree block hover matches canvas block hover without Block Projection point markers", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const ids = await page.evaluate(() => window.__cadTest.resetForSketchTreeBlockHoverTest());
  expect(ids.projectedExplicitPointIds).toHaveLength(4);

  await page.mouse.move(ids.blockLineMid.x, ids.blockLineMid.y);
  const canvasHover = await page.evaluate((instanceId) => window.__cadTest.hoverDisplayStateForTest("block", instanceId), ids.instanceId);
  expect(canvasHover).toEqual(expect.objectContaining({ blockHovered: true, color: "#3b82f6", width: 2.2 }));
  expect(await page.evaluate(() => window.__cadTest.drawnPointMarkerCountForTest())).toBe(0);

  await page.locator(`.sketch-item[data-id="${ids.sketchId}"]`).hover();
  const treeHover = await page.evaluate((instanceId) => window.__cadTest.hoverDisplayStateForTest("block", instanceId), ids.instanceId);
  expect(treeHover).toEqual(expect.objectContaining({ treeHovered: true, color: canvasHover.color, width: canvasHover.width }));
  for (const pointId of ids.projectedExplicitPointIds) {
    expect(await page.evaluate((id) => window.__cadTest.hoverDisplayStateForTest("point", id), pointId)).toEqual(expect.objectContaining({ treeHovered: false }));
  }
  expect(await page.evaluate(() => window.__cadTest.drawnPointMarkerCountForTest())).toBe(0);
});

test("inactive sketch geometry, blocks, and dimensions show identity without hover emphasis or selection", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const points = await page.evaluate(() => window.__cadTest.resetForInactiveDimensionAndBlockHover());
  expect(points.relation).toBe("参照可");

  await page.mouse.move(points.dimension.x, points.dimension.y);
  expect(await page.evaluate(() => window.__cadTest.hoverIdentityStateForTest())).toEqual(expect.objectContaining({
    kind: "dimension",
    id: points.dimensionId,
    sketchId: points.sourceSketchId,
    relation: "参照可",
    hoveredDimension: null,
  }));

  await page.mouse.move(points.line.x, points.line.y);
  expect(await page.evaluate(() => window.__cadTest.hoverIdentityStateForTest())).toEqual(expect.objectContaining({
    kind: "line",
    id: points.lineId,
    sketchId: points.sourceSketchId,
    relation: "参照可",
    hoveredDimension: null,
    hoveredBlock: null,
  }));
  expect(await page.evaluate((id) => window.__cadTest.hoverDisplayStateForTest("line", id), points.lineId)).toEqual(expect.objectContaining({
    canvasHovered: false,
    blockHovered: false,
  }));
  await page.mouse.click(points.line.x, points.line.y);
  expect(await page.evaluate(() => window.__cadTest.selectedGeometryIdsForTest())).toEqual({ points: [], lines: [], circles: [], arcs: [], blockInstances: [] });

  await page.mouse.move(points.block.x, points.block.y);
  expect(await page.evaluate(() => window.__cadTest.hoverIdentityStateForTest())).toEqual(expect.objectContaining({
    kind: "block",
    id: points.blockId,
    sketchId: points.sourceSketchId,
    relation: "参照可",
    hoveredDimension: null,
    hoveredBlock: null,
  }));
  expect(await page.evaluate((id) => window.__cadTest.hoverDisplayStateForTest("block", id), points.blockId)).toEqual(expect.objectContaining({
    canvasHovered: false,
    blockHovered: false,
  }));
  await page.mouse.click(points.block.x, points.block.y);
  expect((await page.evaluate(() => window.__cadTest.selectedGeometryIdsForTest())).blockInstances).toEqual([]);
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

test("a line length dimension advances by clicking its placement after the line", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const points = await page.evaluate(() => window.__cadTest.resetForLineLengthClickPlacement());
  await page.click('[data-constraint="distance"]');
  await page.mouse.click(points.line.x, points.line.y);
  expect(await page.locator("#hint").textContent()).toContain("仮寸法の位置をマウスで調整");
  await page.mouse.move(points.placement.x, points.placement.y);
  const preview = await page.evaluate(() => window.__cadTest.lineLengthClickPlacementState());
  expect(preview).toEqual(expect.objectContaining({
    dimensionCount: 0,
    pendingCommandType: "distance-place",
    previewTargetKind: "line-length",
  }));
  expect(preview.previewPointer.x).toBeCloseTo(0, 6);
  expect(preview.previewPointer.y).toBeCloseTo(-50, 6);
  await page.mouse.click(points.placement.x, points.placement.y);

  const input = page.locator("#dimensionValueInput");
  await expect(input).toBeVisible();
  await input.fill("180");
  await input.press("Enter");
  const state = await page.evaluate(() => window.__cadTest.lineLengthClickPlacementState());
  expect(state).toEqual(expect.objectContaining({
    dimensionCount: 1,
    target: 180,
    inputHidden: true,
    pendingCommandType: null,
    previewTargetKind: null,
    previewPointer: null,
  }));
});

test("unified canvas exposes dimensions from every visible sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const result = await page.evaluate(() => window.__cadTest.resetForActiveSketchDimensionVisibility());
  expect(result.dimensionSketchIds).toEqual(["S1", "S2"]);
  expect(result.drawnDimensionSketchIds).toEqual(["S1", "S2"]);
  expect(new Set(result.drawnDimensionLabels)).toEqual(new Set(["100", "160"]));
  expect(result.labelsAfterHidingSecondSketch).toEqual(["100"]);
});

test("all geometry fit includes figures from every sketch", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const result = await page.evaluate(() => window.__cadTest.resetForAllGeometryFit());
  expect(result.screen.left).toBeGreaterThanOrEqual(90);
  expect(result.screen.right).toBeLessThanOrEqual(result.canvas.width - 90);
  expect(result.screen.top).toBeGreaterThanOrEqual(90);
  expect(result.screen.bottom).toBeLessThanOrEqual(result.canvas.height - 90);
});

test("middle mouse double click fits visible geometry", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const setup = await page.evaluate(() => window.__cadTest.resetForMiddleButtonFit());
  await page.mouse.click(setup.click.x, setup.click.y, { button: "middle" });
  await page.mouse.click(setup.click.x, setup.click.y, { button: "middle" });
  const result = await page.evaluate(() => window.__cadTest.middleButtonFitState());
  const width = result.visibleScreen.right - result.visibleScreen.left;
  expect(result.hiddenVisible).toBe(false);
  expect(result.visibleScreen.left).toBeGreaterThanOrEqual(90);
  expect(result.visibleScreen.right).toBeLessThanOrEqual(result.canvas.width - 90);
  expect(width).toBeGreaterThan(result.canvas.width * 0.45);
});

test("dashed previews do not leak canvas stroke state", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const result = await page.evaluate(() => window.__cadTest.canvasDashIsolationCases());
  expect(result).toEqual({
    line: [],
    rectangle: [],
    circle: [],
    arc: [],
    offset: [],
    trim: [],
    selection: [],
    blockPlacement: [],
    blockHandles: [],
    annotationLeader: [],
    frame: [],
  });
});

test("unified canvas uses normal and construction appearance widths", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  expect(await page.evaluate(() => window.__cadTest.geometryStrokeStyleCasesForTest())).toEqual({
    activeNormal: 2,
    activeConstruction: 1.1,
    inactiveNormal: 1.2,
    inactiveConstruction: 0.9,
    selected: 3,
    hovered: 2.2,
    constructionAlpha: 0.72,
  });
});

test("construction line endpoint overhang remains while geometry or its block is hovered", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  expect(await page.evaluate(() => window.__cadTest.constructionLineHoverDisplayCasesForTest())).toEqual({
    direct: 12,
    block: 12,
  });
});

test("Geometry and Constraint Explorer tabs list and synchronize their respective objects", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  const ids = await page.evaluate(() => window.__cadTest.resetForSidebarInspection());
  await page.click('[data-explorer-tab="geometry"]');
  await expect(page.locator("#explorerGeometry")).toBeVisible();
  await expect(page.locator("#pointList .geometry-list-row")).toHaveCount(2);
  await expect(page.locator(`#pointList .geometry-list-row[data-id="${ids.fixedPoint}"]`)).toHaveCount(1);
  await expect(page.locator("#circleList .geometry-list-row")).toHaveCount(1);
  await expect(page.locator("#arcList .geometry-list-row")).toHaveCount(1);

  await expandObjectSection(page, "Line");
  await page.locator(`#lineList .geometry-list-row[data-id="${ids.line}"]`).click();
  await expect(page.locator("#propertiesPanel")).toContainText(`線 ${ids.line}`);

  await expandObjectSection(page, "Circle");
  await page.locator("#circleList .geometry-list-row").hover();
  expect(await page.evaluate(() => window.__cadTest.sidebarHighlightIds())).toEqual(
    expect.arrayContaining([ids.line, ids.circle]),
  );
  expect(await page.evaluate(() => window.__cadTest.sidebarHighlightIds())).not.toContain(ids.circleCenter);
  await page.locator("#circleList .geometry-list-row").click();
  await expect(page.locator("#circleList .geometry-list-row")).toHaveClass(/selected/);
  await expect(page.locator("#propertiesPanel")).toContainText(`円 ${ids.circle}`);

  await page.click('[data-explorer-tab="constraint"]');
  await expect(page.locator("#explorerConstraint")).toBeVisible();
  await page.locator("#constraintList .constraint-list-row").click();
  await expect(page.locator("#constraintList .constraint-list-row")).toHaveClass(/selected/);
  await expect(page.locator("#propertiesPanel")).toContainText("拘束");
  expect(await page.locator("#constraintList .fixed-point-list-row").textContent()).toContain(`固定 ${ids.fixedPoint}`);
});

test("constraint rows highlight only directly related selected geometry", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const ids = await page.evaluate(() => window.__cadTest.resetForSidebarInspection());
  await page.click('[data-explorer-tab="constraint"]');
  const constraintRow = page.locator("#constraintList .constraint-list-row");
  await expect(constraintRow).toHaveCount(1);

  await page.evaluate((lineId) => window.__cadTest.selectGeometryIdsForTest({ lines: [lineId] }), ids.line);
  await expect(constraintRow).toHaveClass(/sidebar-related/);
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({}));
  await expect(constraintRow).not.toHaveClass(/sidebar-related/);
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
  expect(sibling.relation).toBe("inactive");
  expect(sibling.strokeWidth).toBe(1.2);
  expect(sibling.color).toBe("#cbd5e1");
  expect(sibling.rowHasVisibleClass).toBe(true);

  const deleted = await page.evaluate(() => window.__cadTest.resetForSketchDeletion());
  expect(deleted.deleted).toBe(true);
  expect(deleted.sketchIds).toEqual(["ROOT", "S1", "S4"]);
  expect(deleted.activeSketchId).toBe("ROOT");
  expect(deleted.geometry).toEqual({ points: 0, lines: 0, circles: 0, arcs: 0 });
  expect(deleted.annotationCount).toBe(0);
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

test("non-active sketches are visible unless individually hidden", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const setup = await page.evaluate(() => window.__cadTest.resetForSiblingSubtreeReference());
  expect(setup.relations).toEqual({ S10: "reference", S2: "inactive", S3: "inactive", S4: "inactive", S9: "inactive", S11: "descendant" });
  expect(setup.relationLabels).toEqual({ S9: "参照不可", S11: "参照不可（子孫）" });
  expect(setup.relationColors).toEqual({ S9: "#64748b", S11: "#b91c1c" });
  expect(setup.visible).toEqual({ S10: true, S2: true, S3: true, S4: true, S9: true, S11: true });
  expect(setup.rowClasses).toEqual({ S2: true, S3: true, S4: true, S9: true, S11: true });
  expect(setup.rowBackgrounds.S2).toBe("rgb(255, 255, 255)");
  expect(setup.rowBackgrounds.S9).toBe("rgb(255, 255, 255)");

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

test("sibling geometry is visible but cannot be referenced", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const points = await page.evaluate(() => window.__cadTest.resetForSiblingPointLineReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.siblingLine.x, points.siblingLine.y);
  await page.mouse.click(points.activePoint.x, points.activePoint.y);

  const state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(0);
});

test("sibling descendants and unrelated sketches cannot be referenced", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const points = await page.evaluate(() => window.__cadTest.resetForSiblingSubtreeReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(points.referenceLine.x, points.referenceLine.y);
  await page.mouse.click(points.activePoint.x, points.activePoint.y);

  let state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(0);

  const unrelated = await page.evaluate(() => window.__cadTest.resetForSiblingSubtreeReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(unrelated.unrelatedLine.x, unrelated.unrelatedLine.y);
  await page.mouse.click(unrelated.activePoint.x, unrelated.activePoint.y);
  state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(0);

  const descendant = await page.evaluate(() => window.__cadTest.resetForSiblingSubtreeReference());
  await page.click('[data-constraint="coincident"]');
  await page.mouse.click(descendant.childLine.x, descendant.childLine.y);
  await page.mouse.click(descendant.activePoint.x, descendant.activePoint.y);
  state = await page.evaluate(() => window.__cadTest.referencePointLineState());
  expect(state.count).toBe(0);
});

test("reference dependents solve in topological order and out-of-scope loaded references are disabled", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const order = await page.evaluate(() => window.__cadTest.referenceDependencyOrderCase());
  expect(order.order).toEqual(["S1", "S5"]);
  expect(order.activePointY).toBeCloseTo(25, 5);
  expect(order.childPointY).toBeCloseTo(25, 5);

  const cycle = await page.evaluate(() => window.__cadTest.cyclicReferenceLoadCase());
  expect(cycle.total).toBe(2);
  expect(cycle.operational).toBe(0);
  expect(cycle.invalid).toHaveLength(2);
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

test("point-point rectangle dimensions keep extension lines visible on both pull sides", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.pointPointRectangleDimensionExtensionVisibilityCases());
  expect(result.top).toEqual([true, true]);
  expect(result.left).toEqual([true, true]);
  expect(result.pointPointPreviewLeft).toEqual([true, true]);
  expect(result.lineLengthPreviewLeft).toEqual([true, true]);
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

test("dimension labels follow JIS reading directions in every quadrant", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.dimensionTextAngleCases());
  expect(result.zero.angle).toBeCloseTo(0, 8);
  expect(result.zero.offset).toEqual(expect.objectContaining({ x: 0, y: -1 }));
  expect(result.quadrant1.angle).toBeCloseTo(-30, 8);
  expect(result.quadrant1.offset.x).toBeLessThan(0);
  expect(result.quadrant1.offset.y).toBeLessThan(0);
  expect(result.vertical90.angle).toBeCloseTo(-90, 8);
  expect(result.vertical90.offset.x).toBeCloseTo(-1, 8);
  expect(result.vertical90.offset.y).toBeCloseTo(0, 8);
  expect(result.quadrant2.angle).toBeCloseTo(30, 8);
  expect(result.quadrant2.offset.x).toBeGreaterThan(0);
  expect(result.quadrant2.offset.y).toBeLessThan(0);
  expect(result.straight180.angle).toBeCloseTo(0, 8);
  expect(result.straight180.offset.y).toBeCloseTo(-1, 8);
  expect(result.quadrant3.angle).toBeCloseTo(-30, 8);
  expect(result.quadrant3.offset.x).toBeLessThan(0);
  expect(result.quadrant3.offset.y).toBeLessThan(0);
  expect(result.vertical270.angle).toBeCloseTo(-90, 8);
  expect(result.vertical270.offset.x).toBeCloseTo(-1, 8);
  expect(result.vertical270.offset.y).toBeCloseTo(0, 8);
  expect(result.quadrant4.angle).toBeCloseTo(30, 8);
  expect(result.quadrant4.offset.x).toBeGreaterThan(0);
  expect(result.quadrant4.offset.y).toBeLessThan(0);
  expect(result.quadrant4NearVertical.angle).toBeCloseTo(87, 8);
  expect(result.quadrant4NearVertical.offset.x).toBeGreaterThan(0);
  expect(result.quadrant4NearVertical.offset.y).toBeLessThan(0);
});

test("angle dimension labels follow geometry and dimension-line movement", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const result = await page.evaluate(() => window.__cadTest.angleDimensionLabelFollowCase());
  expect(result.migratedLegacyCoordinates).toBe(true);
  expect(result.recoveredCorruptedOffsets.radial).toBeCloseTo(0, 8);
  expect(result.recoveredCorruptedOffsets.tangent).toBeCloseTo(0, 8);
  expect(result.storedOffsets.radial).toBeCloseTo(11, 8);
  expect(result.storedOffsets.tangent).toBeCloseTo(7, 8);
  expect(result.labelTranslationError).toBeLessThan(1e-8);
  expect(result.arcTranslationError).toBeLessThan(1e-8);
  expect(result.radiusFollowError).toBeLessThan(1e-8);
  expect(result.repeatedDragOffsetError).toBeLessThan(1e-8);
  expect(result.repeatedDragRadialPointerError).toBeLessThan(1e-8);
  expect(result.serializedRelativeOffsets).toBe(true);
  expect(result.serializedPlacementVersion).toBe(2);
  expect(result.serializedLegacyCoordinates).toBe(false);
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
