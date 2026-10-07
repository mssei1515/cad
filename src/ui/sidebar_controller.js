/* Own sidebar tab activation, collapse presentation and its input binding. */
(() => {
  "use strict";
  function create({ document, setHint }) {
    function activateSidebarTab(tabId) {
      for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
        const active = button.dataset.sidebarTab === tabId;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      }
      for (const panel of document.querySelectorAll("[data-sidebar-panel]")) {
        const active = panel.dataset.sidebarPanel === tabId;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      }
    }

    function setSidebarCollapsed(collapsed, hintText = "") {
      const app = document.querySelector(".app");
      if (!app) return false;
      const changed = app.classList.contains("side-collapsed") !== collapsed;
      app.classList.toggle("side-collapsed", collapsed);
      const btn = document.getElementById("toggleSideBtn");
      const label = collapsed ? "サイドバーを開く" : "サイドバーをたたむ";
      btn?.setAttribute("aria-label", label);
      btn?.setAttribute("title", label);
      if (btn) btn.dataset.tooltip = label;
      if (hintText) setHint(hintText);
      return changed;
    }

    function bind() {
      document.getElementById("toggleSideBtn")?.addEventListener("click", () => {
        const app = document.querySelector(".app");
        const isCollapsed = app?.classList.contains("side-collapsed");
        setSidebarCollapsed(!isCollapsed, isCollapsed ? "サイドバーを表示しました" : "サイドバーをたたみました");
      });

      for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
        button.addEventListener("click", () => {
          const app = document.querySelector(".app");
          const isCollapsed = app?.classList.contains("side-collapsed");
          const isActive = button.classList.contains("active");
          if (isActive && !isCollapsed) {
            setSidebarCollapsed(true);
            return;
          }
          activateSidebarTab(button.dataset.sidebarTab);
          setSidebarCollapsed(false);
        });
      }
    }
    return Object.freeze({ bind });
  }
  window.SidebarController = Object.freeze({ create });
})();
