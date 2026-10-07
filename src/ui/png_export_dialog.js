/* Transient crop and boundary selection live entirely inside the export dialog. */
(() => {
  "use strict";
  function create({ dialog, text, prepare, capture, save, setHint, resolvePoint }) {
    const preview = dialog.querySelector("canvas");
    const ctx = preview.getContext("2d");
    const mode = dialog.querySelector("[data-png-mode]");
    const scale = dialog.querySelector("[data-png-scale]");
    const status = dialog.querySelector("[data-png-status]");
    const error = dialog.querySelector("[data-png-error]");
    const exportButton = dialog.querySelector("[data-png-save]");
    const clearButton = dialog.querySelector("[data-png-clear]");
    let scene = null, bitmap = null, region = null, selected = [], start = null, pointer = null, snapped = false, busy = false, generation = 0;
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
      const shownRegion = start && pointer ? window.ExportRegion.fromPoints(start, pointer) : region;
      if (shownRegion) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.3)";
        ctx.beginPath(); ctx.rect(0, 0, preview.width, preview.height); ctx.rect(shownRegion.x, shownRegion.y, shownRegion.width, shownRegion.height); ctx.fill("evenodd");
        ctx.setLineDash([7, 4]);
        ctx.strokeRect(shownRegion.x, shownRegion.y, shownRegion.width, shownRegion.height);
      }
      const displayScale = scene.width / preview.getBoundingClientRect().width;
      ctx.setLineDash([]);
      if (start) {
        ctx.beginPath(); ctx.arc(start.x, start.y, 4 * displayScale, 0, Math.PI * 2); ctx.stroke();
      }
      if (pointer && snapped) {
        const radius = 6 * displayScale;
        ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5 * displayScale;
        ctx.beginPath();
        ctx.moveTo(pointer.x - radius, pointer.y); ctx.lineTo(pointer.x + radius, pointer.y);
        ctx.moveTo(pointer.x, pointer.y - radius); ctx.lineTo(pointer.x, pointer.y + radius);
        ctx.moveTo(pointer.x + 3 * displayScale, pointer.y);
        ctx.arc(pointer.x, pointer.y, 3 * displayScale, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      const size = window.ExportRegion.pixelSize(region, Number(scale.value));
      exportButton.disabled = busy || !size?.supported;
      if (size) status.textContent = `${size.width} × ${size.height} px` + (size.supported ? "" : text(" — 範囲または倍率を小さくしてください", " — Reduce the region or resolution"));
      else status.textContent = mode.value === "existing" ? text(`矩形の4辺をクリックしてください（${selected.length}/4）`, `Click the four rectangle edges (${selected.length}/4)`)
        : start ? text("対角の2点目をクリックしてください", "Click the opposite corner")
          : text("対角の1点目をクリックしてください", "Click the first corner");
      if (mode.value !== "existing" && snapped) status.textContent += text(" — スナップ", " — Snap");
    }
    function point(event) {
      const box = preview.getBoundingClientRect();
      return { x: Math.max(0, Math.min(scene.width, (event.clientX - box.left) * scene.width / box.width)),
        y: Math.max(0, Math.min(scene.height, (event.clientY - box.top) * scene.height / box.height)) };
    }
    function clear() { region = null; selected = []; start = null; pointer = null; snapped = false; error.textContent = ""; repaint(); }
    function updatePointer(event) {
      const result = resolvePoint(point(event), 10 * scene.width / preview.getBoundingClientRect().width);
      pointer = result.point; snapped = result.snapped;
    }
    preview.addEventListener("pointerdown", event => {
      if (!scene || !bitmap || busy || event.button !== 0) return;
      event.preventDefault();
      const p = point(event);
      // Read pointer coordinates before clearing a message can change dialog layout.
      if (mode.value !== "existing") updatePointer(event);
      error.textContent = "";
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
      if (!start) { start = pointer; region = null; }
      else {
        region = window.ExportRegion.fromPoints(start, pointer);
        if (region) { start = null; pointer = null; snapped = false; }
        else error.textContent = text("幅と高さのある範囲になるよう、対角の2点目を選んでください", "Choose an opposite corner that gives the region both width and height");
      }
      repaint();
    });
    preview.addEventListener("pointermove", event => {
      if (!scene || !bitmap || busy || mode.value === "existing") return;
      updatePointer(event); repaint();
    });
    preview.addEventListener("pointerleave", () => { pointer = null; snapped = false; repaint(); });
    preview.addEventListener("pointercancel", () => { if (!busy && mode.value === "draw") clear(); });
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
    dialog.addEventListener("close", () => { generation++; start = null; pointer = null; snapped = false; scene = null; bitmap = null; });
    dialog.addEventListener("keydown", event => event.stopPropagation());
    dialog.addEventListener("keyup", event => event.stopPropagation());
    async function open() {
      if (dialog.open) return;
      const request = ++generation;
      scene = null; bitmap = null; region = null; selected = []; start = null; pointer = null; snapped = false;
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
