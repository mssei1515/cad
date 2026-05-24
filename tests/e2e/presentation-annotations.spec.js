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

  await page.keyboard.press("Control+Y");
  const afterRedo = await page.evaluate(() => window.__cadTest.presentationSnapshot());
  expect(afterRedo.leader.world.x).toBeCloseTo(afterLeader.leader.world.x, 5);
  expect(afterRedo.leader.world.y).toBeCloseTo(afterLeader.leader.world.y, 5);
});
