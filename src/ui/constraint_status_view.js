/* Own persistent-toggle and temporary-key state for constraint visualization. */
(() => {
  "use strict";
  function create({ viewState, button, menuInput, setHint, draw }) {
    let mouseLatched = false;
    let spaceHeld = false;
    function sync({ hint = true } = {}) {
      const next = mouseLatched || spaceHeld;
      const changed = viewState.constraintStatus !== next;
      viewState.constraintStatus = next;
      button?.classList.toggle("active", next);
      button?.setAttribute("aria-pressed", String(next));
      if (menuInput) menuInput.checked = next;
      if (hint && changed) setHint(next ? "拘束状態表示: 表示中のGeometryの拘束状態を表示しています" : "通常表示");
      if (changed) draw();
    }
    function hold(event, textEditingTarget) {
      if (event.code !== "Space" || textEditingTarget || spaceHeld) return false;
      event.preventDefault(); spaceHeld = true; sync(); return true;
    }
    function release(event) {
      if (event.code !== "Space" || !spaceHeld) return;
      event.preventDefault(); spaceHeld = false; sync();
    }
    function blur() {
      if (!spaceHeld) return;
      spaceHeld = false; sync({ hint: false });
    }
    function toggle() { mouseLatched = !mouseLatched; sync(); }
    function setLatched(value) { mouseLatched = value; sync(); }
    return Object.freeze({ hold, release, blur, toggle, setLatched,
      get mouseLatched() { return mouseLatched; }, get spaceHeld() { return spaceHeld; } });
  }
  window.ConstraintStatusView = Object.freeze({ create });
})();
