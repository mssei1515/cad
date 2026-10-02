/* Shared split-button flyouts; existing command buttons own command execution. */
(() => {
  "use strict";
  function create({ document, window, onOpen = () => {} }) {
    const entries = [...document.querySelectorAll("[data-tool-flyout]")].map(root => ({
      root, main: root.querySelector("[data-flyout-main]"), toggle: root.querySelector("[data-flyout-toggle]"),
      menu: root.querySelector("[data-flyout-menu]"), current: root.dataset.flyoutDefault,
      switchMain: root.hasAttribute("data-flyout-switch-main"),
    }));
    let opened = null, started = false, observer = null;
    const removers = [];
    function listen(target, event, handler, capture = false) {
      target.addEventListener(event, handler, capture);
      removers.push(() => target.removeEventListener(event, handler, capture));
    }
    function options(entry) { return [...entry.menu.querySelectorAll("[data-flyout-option]")]; }
    function currentCommand(entry) { return options(entry).find(button => button.id === entry.current); }
    function sync() {
      for (const entry of entries) {
        if (!entry.switchMain) continue;
        const active = options(entry).find(button => button.classList.contains("active"));
        if (active) entry.current = active.id;
        const command = currentCommand(entry);
        if (!command) continue;
        const svg = command.querySelector("svg");
        if (svg && entry.main.innerHTML !== svg.outerHTML) entry.main.innerHTML = svg.outerHTML;
        for (const attribute of ["title", "aria-label", "aria-pressed", "aria-disabled"]) {
          const value = command.getAttribute(attribute);
          if (value === null) entry.main.removeAttribute(attribute);
          else if (entry.main.getAttribute(attribute) !== value) entry.main.setAttribute(attribute, value);
        }
        entry.main.disabled = command.disabled;
        entry.main.classList.toggle("active", command.classList.contains("active"));
        entry.root.classList.toggle("active", command.classList.contains("active"));
        entry.main.dataset.commandId = command.id;
      }
    }
    function close({ focus = false } = {}) {
      if (!opened) return false;
      const entry = opened;
      opened = null;
      entry.menu.hidden = true;
      entry.toggle.setAttribute("aria-expanded", "false");
      if (focus) entry.toggle.focus();
      return true;
    }
    function open(entry) {
      close();
      onOpen();
      opened = entry;
      entry.menu.hidden = false;
      entry.toggle.setAttribute("aria-expanded", "true");
      const anchor = entry.root.getBoundingClientRect();
      const top = anchor.bottom;
      entry.menu.style.maxHeight = `${Math.max(0, window.innerHeight - top - 6)}px`;
      const width = entry.menu.getBoundingClientRect().width;
      entry.menu.style.left = `${Math.max(4, Math.min(anchor.left, window.innerWidth - width - 4))}px`;
      entry.menu.style.top = `${top}px`;
      options(entry).find(button => !button.disabled)?.focus();
    }
    function inside(entry, target) { return entry.root.contains(target) || entry.menu.contains(target); }
    function start() {
      if (started) return;
      started = true;
      for (const entry of entries) {
        document.body.append(entry.menu); // Avoid clipping by the toolbar's horizontal scroll region.
        listen(entry.toggle, "click", () => opened === entry ? close() : open(entry));
        listen(entry.toggle, "keydown", event => {
          if (event.key !== "ArrowDown") return;
          event.preventDefault(); open(entry);
        });
        if (entry.switchMain) listen(entry.main, "click", () => currentCommand(entry)?.click());
        listen(entry.menu, "click", event => {
          const command = event.target.closest("[data-flyout-option]");
          if (!command || command.disabled) return;
          if (entry.switchMain) entry.current = command.id;
          close();
        }, true);
        listen(entry.menu, "click", () => { sync(); entry.main.focus(); });
      }
      listen(document, "pointerdown", event => { if (opened && !inside(opened, event.target)) close(); }, true);
      listen(document, "focusin", event => { if (opened && !inside(opened, event.target)) close(); });
      listen(document, "click", event => {
        if (opened && event.target.closest("button") !== opened.toggle) close();
      });
      listen(window, "keydown", event => {
        if (!opened) return;
        if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation(); close({ focus: true }); return;
        }
        if (!opened.menu.contains(event.target) || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const buttons = options(opened).filter(button => !button.disabled);
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }, true);
      listen(window, "resize", () => close());
      listen(window, "scroll", event => { if (opened && (event.target === window || !opened.menu.contains(event.target))) close(); }, true);
      listen(window, "blur", () => close());
      observer = new window.MutationObserver(sync);
      for (const entry of entries.filter(entry => entry.switchMain)) {
        observer.observe(entry.menu, { subtree: true, attributes: true,
          attributeFilter: ["title", "aria-label", "aria-pressed", "aria-disabled", "class", "disabled"] });
      }
      sync();
    }
    function dispose() {
      close(); observer?.disconnect(); observer = null;
      removers.splice(0).forEach(remove => remove());
      for (const entry of entries) entry.root.append(entry.menu);
      started = false;
    }
    return Object.freeze({ start, close, sync, dispose });
  }
  window.ToolFlyouts = Object.freeze({ create });
})();
