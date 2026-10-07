/* World-space PNG crop draft. Never modifies drawing geometry or history. */
(() => {
  "use strict";
  function create({ text, resolvePoint, save, refresh, begin, end, setHint }) {
    let active = false, busy = false, first = null, pointer = null, region = null, dpi = 300, error = "";
    function clear() { first = pointer = region = null; error = ""; }
    function open() { clear(); dpi = 300; active = true; begin(); refresh(); }
    function cancel() { if (busy) return; active = false; clear(); end(); refresh(); }
    function move(point) { if (!active || busy) return; pointer = resolvePoint(point); refresh(); }
    function pick(point) {
      if (!active || busy) return;
      pointer = resolvePoint(point); error = "";
      if (!first) { first = pointer.point; region = null; }
      else {
        region = window.ExportRegion.fromPoints(first, pointer.point);
        if (region) first = pointer = null;
        else error = text("幅と高さのある範囲を指定してください", "Choose a region with width and height");
      }
      refresh();
    }
    function readState() {
      if (!active) return null;
      const size = window.ExportRegion.pixelSize(region, dpi);
      return { id: "png-export", title: text("PNG出力", "Export PNG"),
        step: first ? text("対角の2点目をクリックしてください", "Click the opposite corner") : region ? text("出力範囲を指定しました", "Region selected") : text("対角の1点目をクリックしてください", "Click the first corner"),
        settings: [{ key: "dpi", label: text("解像度（DPI）", "Resolution (DPI)"), type: "number", min: 1, step: 1, value: dpi }],
        message: error || (busy ? text("PNGを生成しています…", "Preparing PNG…") : size ? `${size.width} × ${size.height} px — ${text("背景透過", "Transparent background")}` + (size.supported ? "" : text(" — 範囲またはDPIを小さくしてください", " — Reduce the region or DPI")) : text("図面寸法とDPIから出力サイズを計算します", "Output size is based on drawing dimensions and DPI")),
        actions: [{ id: "clear", label: text("範囲をクリア", "Clear region"), disabled: busy },
          { id: "cancel", label: text("キャンセル", "Cancel"), disabled: busy },
          { id: "finish", label: text("PNGを保存", "Save PNG"), disabled: busy || !size?.supported }] };
    }
    function onSetting(key, value) { if (busy || key !== "dpi") return; dpi = Number(value); refresh(); }
    async function onAction(action) {
      if (busy) return;
      if (action === "cancel") return cancel();
      if (action === "clear") { clear(); refresh(); return; }
      if (action !== "finish" || !window.ExportRegion.pixelSize(region, dpi)?.supported) return;
      busy = true; error = ""; refresh();
      try {
        const result = await save(region, dpi);
        busy = false; cancel();
        setHint(result === "saved" ? text("PNGを保存しました", "PNG saved") : text("PNGのダウンロードを開始しました", "PNG download started"));
      } catch (failure) {
        if (failure?.name !== "AbortError") error = text("PNG出力に失敗しました: ", "PNG export failed: ") + failure.message;
      } finally { busy = false; refresh(); }
    }
    function drawOverlay(ctx, scale) {
      if (!active) return;
      const box = first && pointer ? window.ExportRegion.fromPoints(first, pointer.point) : region;
      ctx.save(); ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 1.5 / scale;
      if (box) { ctx.setLineDash([7 / scale, 4 / scale]); ctx.strokeRect(box.x, box.y, box.width, box.height); }
      ctx.setLineDash([]);
      if (first) { ctx.beginPath(); ctx.arc(first.x, first.y, 4 / scale, 0, Math.PI * 2); ctx.stroke(); }
      if (pointer?.snapped) {
        const p = pointer.point, r = 6 / scale;
        ctx.strokeStyle = "#f59e0b"; ctx.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
    return Object.freeze({ open, cancel, move, pick, readState, onSetting, onAction, drawOverlay,
      get active() { return active; }, get busy() { return busy; } });
  }
  window.PngExportCommand = Object.freeze({ create });
})();
