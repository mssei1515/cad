const { defineConfig } = require("@playwright/test");

const port = Number(process.env.JOT2D_E2E_PORT || 8765);
const baseURL = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  workers: 1,
  webServer: {
    command: `"${process.execPath}" tools/serve.js --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/index.html`,
    reuseExistingServer: true,
    timeout: 10000,
  },
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
  },
});
