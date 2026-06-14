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
  page.once("dialog", (dialog) => dialog.accept("Frame Block"));
  await page.click("#toolCreateBlock");
  await page.mouse.click(setup.origin.x, setup.origin.y);

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toEqual([
    expect.objectContaining({ name: "Frame Block", points: 4, lines: 4, constraints: 4 }),
  ]);
  expect(state.instances).toHaveLength(1);
  expect(state.projectionLineIds).toHaveLength(4);
  expect(state.projectionLineIds.every((id) => /^BI\d+@L\d+$/.test(id))).toBe(true);
  expect(state.serialized.points).toHaveLength(0);
  expect(state.serialized.lines).toHaveLength(0);

  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  const before = state.instances[0];
  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + 70, interaction.center.y + 35, { steps: 4 });
  await page.mouse.up();
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].x).toBeCloseTo(before.x + 70 / interaction.scale, 3);
  expect(state.instances[0].y).toBeCloseTo(before.y + 35 / interaction.scale, 3);

  const rotationPoints = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  await page.mouse.move(rotationPoints.handle.x, rotationPoints.handle.y);
  await page.mouse.down();
  await page.mouse.move(rotationPoints.origin.x, rotationPoints.origin.y + 90, { steps: 4 });
  await page.mouse.up();
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].rotation).toBeCloseTo(Math.PI / 2, 3);

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
  expect(reloaded).toEqual({ definitions: 1, instances: 2, projectionLines: 8, serializedVersion: 7 });

  await page.click(".blockDeleteBtn");
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions).toHaveLength(1);
  await page.screenshot({ path: "test-results/block-instances.png", fullPage: true });
});

test("block placement escape commits zero rotation after choosing the origin", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const setup = await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  page.once("dialog", (dialog) => dialog.accept("Esc Block"));
  await page.click("#toolCreateBlock");
  await page.mouse.click(setup.origin.x, setup.origin.y);

  const canvas = await page.locator("#canvas").boundingBox();
  await page.click(".blockPlaceBtn");
  await page.mouse.click(canvas.x + canvas.width * 0.75, canvas.y + canvas.height * 0.7);
  await page.keyboard.press("Escape");

  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances[1].rotation).toBeCloseTo(0, 8);
  expect(state.mode).toBe("select");
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
