/* Bind native canvas events to input controllers and preserve flush boundaries. */
(() => {
  "use strict";
  function create({ canvas, pointer, scheduler, navigation, profileCommit, closeContextMenu, afterZoom,
    screenToWorld, formatCoordinate, coordinateStatus }) {
    function processMove(e) {
      const screen = { x: e.offsetX, y: e.offsetY };
      const world = screenToWorld(screen);
      const status = coordinateStatus();
      const text = `X ${formatCoordinate(world.x, 3)} / Y ${formatCoordinate(world.y, 3)}`;
      if (status && status.textContent !== text) status.textContent = text;
      pointer.move(screen, world, e.shiftKey);
    }
    function bind() {
      canvas.addEventListener("pointerdown", e => { scheduler.flush(); pointer.down(e); });
      canvas.addEventListener("pointermove", scheduler.schedule);
      const finish = e => { scheduler.flush(); return profileCommit(() => pointer.finish(e)); };
      canvas.addEventListener("pointerup", finish);
      canvas.addEventListener("pointercancel", finish);
      canvas.addEventListener("pointerleave", () => pointer.leave());
      canvas.addEventListener("dblclick", e => { scheduler.flush(); pointer.doubleClick(e); });
      canvas.addEventListener("auxclick", e => {
        if (e.button === 1) { e.preventDefault(); navigation.doubleClickFit(e); }
      });
      canvas.addEventListener("wheel", e => {
        e.preventDefault();
        scheduler.flush();
        closeContextMenu();
        navigation.zoom(e);
        afterZoom();
      }, { passive: false });
    }
    return Object.freeze({ bind, processMove });
  }
  window.CanvasInputBinding = Object.freeze({ create });
})();
