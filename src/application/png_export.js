/* Compose PNG capture, file output, command mode and its start control. */
(() => {
  "use strict";
  function create({ document, window: browserWindow, canvas, rendering, text, documentName, prepareImages,
    readViewScale, readMode, setMode, pendingCommandSession, fileSession, drawOperationLifecycle, constraintTargetSession,
    withGeometryReadCache, findSnap, flushPointerMove, setHint, draw }) {
    const canvasExport = window.CanvasExport.create({
      canvas, createCanvas: () => document.createElement("canvas"), text,
      render: rendering.render, restore: rendering.restore,
    });
    const pngFile = window.PngFile.create({ window: browserWindow, document, capture: canvasExport.capture, documentName, text,
      prepare: async () => {
        await document.fonts.ready;
        await prepareImages();
      },
    });
    const modeSession = window.PngExportCommand.createModeSession({ readMode, setMode, pendingCommandSession });
    const command = window.PngExportCommand.create({
      text, save: (region, dpi) => pngFile.save(region, dpi / 96 * readViewScale()),
      viewScale: readViewScale, setHint, refresh: draw,
      begin: modeSession.begin, end: modeSession.end,
      resolvePoint: point => withGeometryReadCache(() => {
        const snap = findSnap(point, 10 / readViewScale());
        return { point: snap ? { x: snap.x, y: snap.y } : point, snapped: Boolean(snap) };
      }),
    });
    function open() {
      flushPointerMove();
      if (fileSession.busy || drawOperationLifecycle.active() || pendingCommandSession.current || constraintTargetSession.command || readMode() === "block-place") {
        setHint(text("進行中の操作を完了またはキャンセルしてからPNG出力を開始してください", "Finish or cancel the current operation before exporting PNG"));
        return;
      }
      command.open();
    }
    let button = null, started = false;
    function start() {
      if (started) return;
      started = true;
      button = document.getElementById("pngExportBtn");
      button.addEventListener("click", open);
    }
    function dispose() {
      button?.removeEventListener("click", open);
      button = null;
      started = false;
    }
    return Object.freeze({ command, open, start, dispose });
  }
  window.PngExport = Object.freeze({ create });
})();
