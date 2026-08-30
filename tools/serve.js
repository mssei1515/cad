const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
function optionValue(name, fallback) {
  const equalsArg = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (equalsArg) return equalsArg.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const host = optionValue("--host", process.env.HOST || "127.0.0.1");
const port = Number(optionValue("--port", process.env.PORT || 8765));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function gitOutput(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  }).trim();
}

function runtimeVersion() {
  try {
    const commit = gitOutput(["rev-parse", "HEAD"]);
    if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error("Invalid Git commit");
    return {
      available: true,
      branch: gitOutput(["branch", "--show-current"]) || "HEAD",
      commit,
      shortCommit: commit.slice(0, 12),
      dirty: gitOutput(["status", "--porcelain"]).length > 0,
    };
  } catch (_error) {
    return { available: false };
  }
}

function sendRuntimeVersion(res) {
  const body = JSON.stringify(runtimeVersion());
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://${host}:${port}`);
  const pathname = decodeURIComponent(parsed.pathname === "/" ? "/index.html" : parsed.pathname);
  const filePath = path.resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return null;
  return filePath;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${host}:${port}`);
  if (requestUrl.pathname === "/__jot2d_version") {
    sendRuntimeVersion(res);
    return;
  }
  const filePath = resolveRequestPath(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Jot2D test server: http://${host}:${port}/`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
