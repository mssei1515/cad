/* Validate and present runtime build information independently of document state. */
(() => {
  "use strict";
  function create({ document, applicationText }) {
    let runtimeVersionState = { status: "unavailable" };
    function renderRuntimeVersion() {
      const target = document.getElementById("runtimeCommit");
      if (!target) return;
      if (runtimeVersionState.status === "loading") {
        target.textContent = applicationText("取得中…", "Loading…");
        target.dataset.state = "loading";
        target.removeAttribute("title");
        return;
      }
      if (runtimeVersionState.status !== "available") {
        target.textContent = applicationText("取得できません", "Unavailable");
        target.dataset.state = "unavailable";
        target.removeAttribute("title");
        return;
      }
      const { branch, commit, shortCommit, dirty } = runtimeVersionState;
      target.textContent = `${branch}@${shortCommit}${dirty ? applicationText("（変更あり）", " (dirty)") : ""}`;
      target.dataset.state = "available";
      target.title = `${branch}@${commit}`;
    }

    function loadRuntimeVersion(value) {
      if (value?.available && /^[0-9a-f]{40}$/i.test(value.commit) && /^[0-9a-f]{7,40}$/i.test(value.shortCommit)) {
        runtimeVersionState = {
          status: "available",
          branch: String(value.branch || "HEAD"),
          commit: value.commit,
          shortCommit: value.shortCommit,
          dirty: Boolean(value.dirty),
        };
      } else {
        runtimeVersionState = { status: "unavailable" };
      }
      renderRuntimeVersion();
    }

    return Object.freeze({ load: loadRuntimeVersion, render: renderRuntimeVersion });
  }
  window.RuntimeVersionView = Object.freeze({ create });
})();
