/* Import into a captured editing scope; async reads never retarget a different drawing. */
(() => {
  "use strict";
  function create({ parser, geometry, ids, currentScope, activeSketchId, canImport, signature,
    fileSession, requestChoice, applicationText: text, minimumLength, onImported, setHint }) {
    async function importFile(file) {
      if (!file) return false;
      if (!canImport() || fileSession.busy) {
        setHint(text("作図可能なスケッチを選び、進行中の操作を終了してください", "Select an editable sketch and finish the current operation"), "error");
        return false;
      }
      const scope = currentScope(), sketchId = activeSketchId(), before = signature();
      if (!fileSession.beginOpen()) return false;
      const unchanged = () => currentScope() === scope && activeSketchId() === sketchId && canImport() && signature() === before;
      const choices = options => requestChoice({ ...options, cancelLabel: text("キャンセル", "Cancel"), closeLabel: text("閉じる", "Close") });
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error(text("DXFは20MB以下にしてください", "DXF must be at most 20 MB"));
        const parsed = parser.parse(await file.text());
        let scale = parsed.scale;
        if (!scale) scale = await choices({
          title: text("DXFの単位", "DXF units"),
          message: text("単位情報が不明です。DXFの1単位を選んでください。", "The file units are unknown. Choose the length of one DXF unit."),
          choices: [{ value: 1, label: "mm" }, { value: 10, label: "cm" }, { value: 1000, label: "m" }, { value: 25.4, label: text("インチ", "Inches") }],
          defaultValue: 1,
        });
        if (!scale) return false;
        const prepared = parser.prepare(parsed, scale, minimumLength);
        const skipped = Object.entries(prepared.skipped).map(([type, count]) => `${type}: ${count}`).join(", ");
        if (!prepared.geometries.length) {
          setHint(text(`取り込める図形がありません${skipped ? `（スキップ: ${skipped}）` : ""}`, `No supported geometry${skipped ? ` (skipped: ${skipped})` : ""}`), "error");
          return false;
        }
        if (skipped) {
          const accepted = await choices({
            title: text("DXFの部分読込", "Partial DXF import"),
            message: text(`未対応・不正・モデルの最小長さ未満の要素をスキップします: ${skipped}。対応図形${prepared.geometries.length}個を取り込みますか？`, `Unsupported, invalid or undersized entities will be skipped: ${skipped}. Import ${prepared.geometries.length} supported shapes?`),
            choices: [{ value: true, label: text("対応図形を取り込む", "Import supported shapes") }], defaultValue: true,
          });
          if (!accepted) return false;
        }
        if (!unchanged()) {
          setHint(text("読込待機中に図面または作図先が変更されたため、DXF読込を中止しました", "DXF import canceled because the drawing or editing scope changed while reading"), "error");
          return false;
        }
        const fields = ["points", "lines", "circles", "arcs"];
        const lengths = fields.map(field => scope[field].length), checkpoint = ids.snapshot();
        try {
          const point = p => geometry.addPoint(p.x, p.y, false, "endpoint");
          for (const item of prepared.geometries) {
            let created;
            if (item.type === "point") created = geometry.addPoint(item.x, item.y, false, "explicit");
            if (item.type === "line") created = geometry.addLine(point(item.a), point(item.b), false);
            if (item.type === "circle") created = geometry.addCircle(point(item.center), item.radius, false);
            if (item.type === "arc") created = geometry.addArc(point(item.center), item.radius, item.start, item.end, false);
            if (!created) throw new Error("DXF geometry could not be created");
          }
        } catch (error) {
          fields.forEach((field, i) => { scope[field].length = lengths[i]; });
          ids.restore(checkpoint);
          throw error;
        }
        onImported();
        setHint(text(`DXF: ${prepared.geometries.length}図形を読み込みました${skipped ? `（スキップ: ${skipped}）` : ""}`, `DXF: imported ${prepared.geometries.length} shapes${skipped ? ` (skipped: ${skipped})` : ""}`));
        return true;
      } catch (error) {
        setHint(text(`DXF読込に失敗しました: ${error.message}`, `DXF import failed: ${error.message}`), "error");
        return false;
      } finally { fileSession.finishOpen(); }
    }
    return Object.freeze({ importFile });
  }
  window.DxfImportCommand = Object.freeze({ create });
})();
