/* Bind native canvas events to input controllers and preserve flush boundaries. */
(() => {
  "use strict";
  // Preserve the two existing begin orders and limit cleanup's catch to release.
  function createDragPointer({ canvas }) {
    function markThenCapture(id) { canvas.classList.add("is-dragging"); canvas.setPointerCapture(id); }
    function captureThenMark(id) { canvas.setPointerCapture(id); canvas.classList.add("is-dragging"); }
    function release(id) { canvas.classList.remove("is-dragging"); try { canvas.releasePointerCapture(id); } catch (_) {} }
    return Object.freeze({ markThenCapture, captureThenMark, release });
  }
  function createCommandRouting({ pointer, readCommandPanel, readPngExportCommand, blankCanvasGesture,
    canvasScreenPoint, canvasPoint, isBlankCommandPanelPoint, screenToWorld, navigation }) {
    return Object.freeze({
      ...pointer,
      down: e => {
        if (e.button === 0 && readCommandPanel()?.active) {
          if (readCommandPanel().canvasPress(canvasScreenPoint(e), isBlankCommandPanelPoint(canvasPoint(e)))) {
            blankCanvasGesture.suppressNext();
            e.preventDefault();
            return;
          }
        }
        if (readPngExportCommand()?.active && e.button === 0) readPngExportCommand().pick(screenToWorld({ x: e.offsetX, y: e.offsetY }));
        else pointer.down(e);
      },
      move: (screen, world, shift) => {
        readCommandPanel()?.canvasMove(screen);
        if (readPngExportCommand()?.active) { if (!navigation.movePan(screen)) readPngExportCommand().move(world); }
        else pointer.move(screen, world, shift);
      },
      finish: e => { if (!readPngExportCommand()?.active || e.button !== 0) pointer.finish(e); },
      doubleClick: e => {
        if (blankCanvasGesture.takeSuppression()) { e.preventDefault(); return; }
        if (readCommandPanel()?.active) {
          readCommandPanel().canvasDoubleClick(isBlankCommandPanelPoint(canvasPoint(e)));
          e.preventDefault();
          return;
        }
        if (!readPngExportCommand()?.active) pointer.doubleClick(e);
      },
    });
  }
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
  window.CanvasInputBinding = Object.freeze({ create, createCommandRouting, createDragPointer });
})();
