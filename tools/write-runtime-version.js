const fs = require("fs");
const path = require("path");
const { readRuntimeVersion, runtimeVersionSource } = require("./runtime-version");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "runtime-version.js");
const version = readRuntimeVersion(root);

fs.writeFileSync(outputPath, runtimeVersionSource(version), "utf8");

if (version.available) {
  console.log(`Wrote runtime-version.js: ${version.branch}@${version.shortCommit}${version.dirty ? " (dirty)" : ""}`);
} else {
  console.log("Wrote runtime-version.js: unavailable");
}
