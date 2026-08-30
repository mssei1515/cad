const { execFileSync } = require("child_process");

function gitOutput(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  }).trim();
}

function readRuntimeVersion(root) {
  try {
    const commit = gitOutput(root, ["rev-parse", "HEAD"]);
    if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error("Invalid Git commit");
    return {
      available: true,
      branch: gitOutput(root, ["branch", "--show-current"]) || "HEAD",
      commit,
      shortCommit: commit.slice(0, 12),
      dirty: gitOutput(root, ["status", "--porcelain"]).length > 0,
    };
  } catch (_error) {
    return { available: false };
  }
}

function runtimeVersionSource(version) {
  return `window.__JOT2D_RUNTIME_VERSION__ = Object.freeze(${JSON.stringify(version)});\n`;
}

module.exports = { readRuntimeVersion, runtimeVersionSource };
