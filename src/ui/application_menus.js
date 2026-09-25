/* Menu presentation and input lifecycle; tool execution is supplied by the application. */
(function () {
  "use strict";
  function create({ document, window, activateTool }) {
    const appMenus = Array.from(document.querySelectorAll(".app-menu"));
    const appMenuBar = document.querySelector(".menu-bar");
    let appMenuHoverTimer = null;
    function cancelAppMenuHoverSwitch() {
      if (appMenuHoverTimer == null) return;
      window.clearTimeout(appMenuHoverTimer);
      appMenuHoverTimer = null;
    }
    function closeAppMenus(except = null) {
      cancelAppMenuHoverSwitch();
      for (const menu of appMenus) {
        if (menu !== except) menu.removeAttribute("open");
      }
      appMenuBar?.classList.toggle("menu-open", appMenus.some((menu) => menu.open));
    }
    let started = false;
    const listeners = [];
    function listen(target, type, handler) {
      if (!target) return;
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    }
    function start() {
      if (started) return;
      started = true;
      for (const menu of appMenus) {
        const summary = menu.querySelector(":scope > summary");
        listen(summary, "click", () => closeAppMenus(menu));
        listen(summary, "pointerenter", (event) => {
          if (event.pointerType === "touch") return;
          if (!appMenus.some((item) => item !== menu && item.open)) return;
          cancelAppMenuHoverSwitch();
          appMenuHoverTimer = window.setTimeout(() => {
            appMenuHoverTimer = null;
            if (!appMenus.some((item) => item !== menu && item.open)) return;
            closeAppMenus(menu);
            menu.setAttribute("open", "");
            summary.focus({ preventScroll: true });
          }, 16);
        });
        listen(summary, "pointerleave", cancelAppMenuHoverSwitch);
        listen(summary, "pointerdown", cancelAppMenuHoverSwitch);
        listen(menu, "toggle", () => {
          if (menu.open) closeAppMenus(menu);
          else appMenuBar?.classList.toggle("menu-open", appMenus.some((item) => item.open));
        });
      }
      listen(document, "pointerdown", (event) => {
        if (!event.target.closest(".app-menus")) closeAppMenus();
      });
      listen(document, "keydown", (event) => {
        if (event.key !== "Escape") return;
        const openMenu = appMenus.find((menu) => menu.open);
        if (!openMenu) return;
        event.preventDefault();
        event.stopPropagation();
        closeAppMenus();
        openMenu.querySelector(":scope > summary")?.focus();
      });
      listen(window, "blur", () => closeAppMenus());
      for (const button of document.querySelectorAll("[data-menu-tool]")) {
        listen(button, "click", () => {
          activateTool(button.dataset.menuTool);
          button.closest("details")?.removeAttribute("open");
        });
      }
      listen(document.querySelector(".app-menus"), "click", (event) => {
        const button = event.target.closest("button");
        button?.closest("details")?.removeAttribute("open");
      });
    }
    function dispose() {
      for (const remove of listeners.splice(0)) remove();
      closeAppMenus();
      started = false;
    }
    return Object.freeze({ start, dispose, close: closeAppMenus });
  }
  window.ApplicationMenus = Object.freeze({ create });
})();
