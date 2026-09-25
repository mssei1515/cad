/* Middle-button navigation owns its gestures, not document editing state. */
(() => {
  "use strict";
  function create({ canvas, viewport, draw, setHint, fitVisibleGeometry, now = () => performance.now() }) {
    let pan = null;
    let lastMiddleClick = null;

    function beginPan(event) {
      event.preventDefault();
      pan = { startPointer: viewport.canvasScreenPoint(event), startX: viewport.x, startY: viewport.y };
      canvas.classList.add("is-panning");
      canvas.setPointerCapture(event.pointerId);
      setHint("画面移動中: マウススクロールボタンを押しながらドラッグ");
    }

    function movePan(screenPoint) {
      if (!pan) return false;
      viewport.update({ x: pan.startX + (screenPoint.x - pan.startPointer.x) });
      viewport.update({ y: pan.startY + (screenPoint.y - pan.startPointer.y) });
      draw();
      return true;
    }

    function endPan(event) {
      if (!pan) return false;
      pan = null;
      canvas.classList.remove("is-panning");
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {
        // The browser may already have released pointer capture.
      }
      setHint("画面移動を終了しました");
      return true;
    }

    function doubleClickFit(event) {
      if (event.button !== 1) return false;
      const time = now();
      const screen = viewport.canvasScreenPoint(event);
      const previous = lastMiddleClick;
      const dx = previous ? screen.x - previous.x : 0;
      const dy = previous ? screen.y - previous.y : 0;
      const repeated = previous && time - previous.time <= 450 && Math.sqrt(dx * dx + dy * dy) <= 12;
      lastMiddleClick = repeated ? null : { time, x: screen.x, y: screen.y };
      if (!repeated) return false;
      if (fitVisibleGeometry()) setHint("表示中の図形全体が見えるように調整しました");
      else setHint("表示中の図形がありません", "error");
      draw();
      return true;
    }

    // Document reset discards gesture state; event routing owns capture lifetime.
    function reset() { pan = null; lastMiddleClick = null; }
    return Object.freeze({ beginPan, movePan, endPan, doubleClickFit, reset, get panning() { return pan !== null; } });
  }
  window.CanvasNavigation = Object.freeze({ create });
})();
