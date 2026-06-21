const { test, expect } = require("@playwright/test");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.CAD2_E2E_PORT || 8765) + 1;
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

test("creates, places, drags, edits, and reloads local-coordinate blocks", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const setup = await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await expect(page.locator("body")).toHaveClass(/block-editing/);
  await expect(page.locator("#blockEditorNameInput")).toBeVisible();
  await page.fill("#blockEditorNameInput", "Frame Block");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ editing: true, isNew: true, hostLineCount: 4, editorLineCount: 4 }));
  await page.click("#completeBlockEditBtn");

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toEqual([
    expect.objectContaining({ name: "Frame Block", points: 4, lines: 4, constraints: 4, activeSketchId: "S1", origin: { x: 0, y: 0 } }),
  ]);
  expect(state.definitions[0].sketches).toHaveLength(2);
  expect(state.instances).toHaveLength(1);
  expect(state.instances[0].enabledSketchIds).toEqual(["S1"]);
  expect(state.projectionLineIds).toHaveLength(4);
  expect(state.projectionLineIds.every((id) => /^BI\d+@L\d+$/.test(id))).toBe(true);
  expect(state.serialized.points).toHaveLength(0);
  expect(state.serialized.lines).toHaveLength(0);

  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  expect(interaction.handle).toBeNull();
  const before = state.instances[0];
  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + 70, interaction.center.y + 35, { steps: 4 });
  await page.mouse.up();
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].x).toBeCloseTo(before.x + 70 / interaction.scale, 3);
  expect(state.instances[0].y).toBeCloseTo(before.y + 35 / interaction.scale, 3);
  expect(state.instances[0].rotation).toBeCloseTo(before.rotation, 8);
  expect((await page.evaluate(() => window.__cadTest.blockInteractionPoints())).handle).toBeNull();

  const canvas = await page.locator("#canvas").boundingBox();
  await page.click(".blockPlaceBtn");
  await page.mouse.click(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.58);
  await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.58);
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances[1].rotation).toBeCloseTo(0, 6);

  const external = await page.evaluate(() => window.__cadTest.blockExternalConstraintCase());
  expect(external.success).toBe(true);
  expect(external.errorNorm).toBeLessThan(1e-5);
  expect(external.projectedError).toBeLessThan(1e-5);
  expect(external.localAfter).toEqual(external.localBefore);

  const readOnly = await page.evaluate(() => window.__cadTest.blockReadOnlyDimensionCase());
  expect(readOnly).toEqual(expect.objectContaining({ created: true, readOnly: true, enabled: false }));

  const edited = await page.evaluate(() => window.__cadTest.blockDefinitionUpdateCase());
  expect(edited.editing).toBe(false);
  expect(edited.revision).toBeGreaterThan(1);
  expect(edited.lengths).toHaveLength(2);
  expect(edited.lengths[0]).toBeGreaterThan(edited.before);
  expect(edited.lengths[1]).toBeCloseTo(edited.lengths[0], 6);

  const reloaded = await page.evaluate(() => window.__cadTest.reloadBlockState());
  expect(reloaded).toEqual({ definitions: 1, instances: 2, projectionLines: 8, serializedVersion: 8 });

  await page.click(".blockDeleteBtn");
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions).toHaveLength(1);
  await page.screenshot({ path: "test-results/block-instances.png", fullPage: true });
});

test("block placement escape commits zero rotation after choosing the display center", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const setup = await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await page.fill("#blockEditorNameInput", "Esc Block");
  await page.click("#completeBlockEditBtn");

  const canvas = await page.locator("#canvas").boundingBox();
  await page.click(".blockPlaceBtn");
  await page.mouse.click(canvas.x + canvas.width * 0.75, canvas.y + canvas.height * 0.7);
  await page.keyboard.press("Escape");

  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances[1].rotation).toBeCloseTo(0, 8);
  expect(state.mode).toBe("select");
});

test("legacy block data migrates into an internal Sketch-1 without changing projection ids", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  const before = await page.evaluate(() => window.__cadTest.blockState());
  const migrated = await page.evaluate(() => window.__cadTest.reloadLegacyBlockState());
  expect(migrated.version).toBe(8);
  expect(migrated.origin).toEqual({ x: 0, y: 0 });
  expect(migrated.sketches).toEqual([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", parentSketchId: "ROOT" }),
  ]);
  expect(new Set(migrated.elementSketchIds)).toEqual(new Set(["S1"]));
  expect(migrated.enabledSketchIds).toEqual(["S1"]);
  expect(migrated.projectionLineIds).toEqual(before.projectionLineIds);
});

test("new block editor supports cancel and independent internal sketch hierarchy", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await expect(page.locator("#sketchOverlay")).toBeVisible();
  await expect(page.locator("#completeBlockEditBtn")).toBeVisible();
  const cancelled = await page.evaluate(() => window.__cadTest.cancelBlockEditor());
  expect(cancelled).toEqual({ editing: false, definitions: 0, instances: 0, lines: 4 });

  await page.evaluate(() => window.__cadTest.resetForEmptyBlockCreation());
  await page.click("#toolCreateBlock");
  const initialEditor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(initialEditor.sketches).toEqual([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", parentSketchId: "ROOT" }),
  ]);
  const child = await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  expect(child.sketches).toContainEqual(expect.objectContaining({ id: child.sketchId, parentSketchId: "S1" }));
  await page.fill("#blockEditorNameInput", "Internal Sketch Block");
  const completed = await page.evaluate(() => window.__cadTest.completeBlockEditor());
  expect(completed).toEqual({ editing: false, definitions: 1, instances: 0 });
  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions[0].sketches).toHaveLength(3);
});

test("placement and existing instances keep independent enabled internal sketches", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  await page.dblclick(".block-item[data-id]");
  const child = await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  await page.click("#completeBlockEditBtn");
  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].enabledSketchIds).toEqual(["S1"]);

  await page.click(".blockPlaceBtn");
  await expect(page.locator("#blockSketchConfig")).toBeVisible();
  await page.locator(`#blockSketchConfig input[data-sketch-id="S1"]`).uncheck();
  await page.locator(`#blockSketchConfig input[data-sketch-id="${child.sketchId}"]`).check();
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.65);
  await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.65);
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[1].enabledSketchIds).toEqual([child.sketchId]);
  expect(state.projectionLineIds).toHaveLength(5);
});

test("block creation rejects shared boundaries and presentation references without mutation", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const result = await page.evaluate(() => window.__cadTest.blockCreationRejectionCases());
  expect(result.sharedPointError).toContain("非選択図形と共有");
  expect(result.sharedCounts).toEqual({ definitions: 0, instances: 0, lines: 2 });
  expect(result.presentationError).toContain("Presentation注記");
  expect(result.presentationCounts).toEqual({ definitions: 0, instances: 0, lines: 1 });
});
