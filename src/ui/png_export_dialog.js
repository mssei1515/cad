/* Transient crop and boundary selection live entirely inside the export dialog. */
(() => {
  "use strict";
  function create({ dialog, text, prepare, capture, save, setHint }) {
    const preview = dialog.querySelector("canvas");
    const ctx = preview.getContext("2d");
    const mode = dialog.querySelector("[data-png-mode]");
    const scale = dialog.querySelector("[data-png-scale]");
    const status = dialog.querySelector("[data-png-status]");
    const error = dialog.querySelector("[data-png-error]");
    const exportButton = dialog.querySelector("[data-png-save]");
    const clearButton = dialog.querySelector("[data-png-clear]");
    let scene = null, bitmap = null, region = null, selected = [], start = null, pointerId = null, busy = false, generation = 0;
    function repaint() {
      if (!scene || !bitmap) return;
      ctx.clearRect(0, 0, preview.width, preview.height);
      ctx.drawImage(bitmap, 0, 0, preview.width, preview.height);
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
      for (const line of selected) {
        ctx.beginPath(); ctx.moveTo(line.p1.x, line.p1.y); ctx.lineTo(line.p2.x, line.p2.y); ctx.stroke();
      }
      if (region) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.3)";
        ctx.beginPath(); ctx.rect(0, 0, preview.width, preview.height); ctx.rect(region.x, region.y, region.width, region.height); ctx.fill("evenodd");
        ctx.setLineDash([7, 4]);
        ctx.strokeRect(region.x, region.y, region.width, region.height);
      }
      ctx.restore();
      const size = window.ExportRegion.pixelSize(region, Number(scale.value));
      exportButton.disabled = busy || !size?.supported;
      if (size) status.textContent = `${size.width} × ${size.height} px` + (size.supported ? "" : text(" — 範囲または倍率を小さくしてください", " — Reduce the region or resolution"));
      else status.textContent = mode.value === "existing" ? text(`矩形の4辺をクリックしてください（${selected.length}/4）`, `Click the four rectangle edges (${selected.length}/4)`)
        : text("ドラッグして出力範囲を指定してください", "Drag to select the export region");
    }
    function point(event) {
      const box = preview.getBoundingClientRect();
      return { x: Math.max(0, Math.min(scene.width, (event.clientX - box.left) * scene.width / box.width)),
        y: Math.max(0, Math.min(scene.height, (event.clientY - box.top) * scene.height / box.height)) };
    }
    function clear() { region = null; selected = []; start = null; error.textContent = ""; repaint(); }
    function releasePointer() {
      if (pointerId != null && preview.hasPointerCapture(pointerId)) preview.releasePointerCapture(pointerId);
      pointerId = null; start = null;
    }
    preview.addEventListener("pointerdown", event => {
      if (!scene || busy || event.button !== 0) return;
      event.preventDefault(); error.textContent = "";
      const p = point(event);
      if (mode.value === "existing") {
        const threshold = 10 * scene.width / preview.getBoundingClientRect().width;
        const candidates = scene.lines.map(line => ({ line, distance: window.GeometryKernel.distancePointToSegmentPoints(p.x, p.y, line.p1, line.p2) }))
          .filter(item => item.distance <= threshold).sort((a, b) => a.distance - b.distance);
        const line = candidates[0]?.line;
        if (!line) return;
        if (selected.includes(line)) selected = selected.filter(item => item !== line);
        else if (selected.length < 4) selected.push(line);
        region = window.ExportRegion.fromLines(selected);
        if (selected.length === 4 && !region) error.textContent = text("水平・垂直の閉じた矩形になる4辺を選んでください。選択した辺を再クリックすると解除できます", "Select four edges forming a closed axis-aligned rectangle. Click a selected edge again to remove it");
        repaint(); return;
      }
      start = p; region = null; pointerId = event.pointerId;
      preview.setPointerCapture(pointerId); repaint();
    });
    preview.addEventListener("pointermove", event => {
      if (!start || busy || event.pointerId !== pointerId) return;
      region = window.ExportRegion.fromPoints(start, point(event)); repaint();
    });
    preview.addEventListener("pointerup", event => {
      if (!start || event.pointerId !== pointerId) return;
      region = window.ExportRegion.fromPoints(start, point(event)); releasePointer(); repaint();
    });
    preview.addEventListener("pointercancel", () => { releasePointer(); if (mode.value === "draw") clear(); });
    preview.addEventListener("lostpointercapture", () => { start = null; pointerId = null; });
    mode.addEventListener("change", () => {
      clear();
      if (mode.value === "existing" && scene) {
        selected = scene.lines.filter(line => line.selected);
        if (selected.length > 4) selected = [];
        region = window.ExportRegion.fromLines(selected); repaint();
      }
    });
    clearButton.addEventListener("click", clear);
    scale.addEventListener("change", repaint);
    function setBusy(value) {
      busy = value;
      for (const control of dialog.querySelectorAll("button, select")) control.disabled = value;
      exportButton.disabled = value || !bitmap || !region;
      repaint();
    }
    exportButton.addEventListener("click", async () => {
      if (busy || !region) return;
      setBusy(true); error.textContent = "";
      try {
        const result = await save(region, Number(scale.value));
        setHint(result === "saved" ? text("PNGを保存しました", "PNG saved") : text("PNGのダウンロードを開始しました", "PNG download started"));
        dialog.close();
      } catch (failure) {
        if (failure?.name !== "AbortError") error.textContent = text("PNG出力に失敗しました: ", "PNG export failed: ") + failure.message;
      } finally { setBusy(false); }
    });
    for (const button of dialog.querySelectorAll("[data-png-close]")) button.addEventListener("click", () => { if (!busy) dialog.close(); });
    dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    dialog.addEventListener("close", () => { generation++; releasePointer(); scene = null; bitmap = null; });
    dialog.addEventListener("keydown", event => event.stopPropagation());
    dialog.addEventListener("keyup", event => event.stopPropagation());
    async function open() {
      if (dialog.open) return;
      const request = ++generation;
      scene = null; bitmap = null; region = null; selected = []; start = null;
      mode.value = "draw"; scale.value = "2"; error.textContent = "";
      for (const element of dialog.querySelectorAll("[data-png-ja]")) element.textContent = text(element.dataset.pngJa, element.dataset.pngEn);
      preview.setAttribute("aria-label", text("PNG出力範囲", "PNG export region"));
      dialog.querySelector("header [data-png-close]").setAttribute("aria-label", text("閉じる", "Close"));
      status.textContent = text("画像を準備しています…", "Preparing image…");
      ctx.clearRect(0, 0, preview.width, preview.height);
      dialog.showModal(); setBusy(true);
      try {
        const prepared = await prepare();
        if (request !== generation) return;
        scene = prepared;
        bitmap = capture({ x: 0, y: 0, width: scene.width, height: scene.height }, 1);
        preview.width = bitmap.width; preview.height = bitmap.height;
      } catch (failure) {
        error.textContent = text("PNG出力を準備できませんでした: ", "Could not prepare PNG export: ") + failure.message;
      } finally {
        if (request === generation) { setBusy(false); mode.focus(); }
      }
    }
    return Object.freeze({ open });
  }
  window.PngExportDialog = Object.freeze({ create });
})();
