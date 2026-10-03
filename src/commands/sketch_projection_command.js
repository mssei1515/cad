/* Own staged projection sources and their command lifecycle; query geometry through ports. */
(() => {
  "use strict";
  function create({ selectedGeometryItems, sketchProjectionEntryFromItem, sketchProjectionEntryFromOperand, sketchProjectionSourceIsCovered, sketchProjectionEntriesByRect, cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation, clearSelection, getMode, setMode, clearSnap, updateToolbar, setHint, applicationText, updateUI, draw, activeSketchId, normalizeGeometryInstance, nextId, geometryRefForItem, currentScope, canvasSelection, refreshConstraintAnalysis, recordHistory, clearHover }) {
    let sources = [];
    function startSketchProjectionCommand() {
      const selectedSources = selectedGeometryItems().map(sketchProjectionEntryFromItem)
        .filter(entry => entry && !sketchProjectionSourceIsCovered(entry.item));
      cancelConstraintTargetCommand("");
      cancelPendingCommand("");
      if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
      clearSelection();
      setMode("sketch-projection");
      sources = [...new Map(selectedSources.map(entry => [entry.key, entry])).values()];
      clearSnap();
      updateToolbar();
      setHint(applicationText("投影する先祖SketchのGeometryを複数選択し、Enterまたは右クリックメニューの「実行」で確定してください。Escでキャンセルします", "Select geometry from ancestor sketches, then confirm with Enter or Execute in the context menu. Press Esc to cancel."));
      updateUI({ refreshAnalysis: false });
      draw();
    }

    function toggleSketchProjectionSource(operand) {
      const entry = sketchProjectionEntryFromOperand(operand);
      if (!entry) {
        setHint(applicationText("表示中の先祖SketchにあるGeometryを選択してください", "Select visible geometry from an ancestor sketch."), "error");
        return false;
      }
      const selectedIndex = sources.findIndex((item) => item.kind === entry.kind && item.key === entry.key);
      if (selectedIndex >= 0) {
        sources.splice(selectedIndex, 1);
      } else {
        if (sketchProjectionSourceIsCovered(entry.item)) {
          setHint(applicationText(`${entry.item.id} は既に投影されています`, `${entry.item.id} is already projected.`), "error");
          return false;
        }
        sources.push(entry);
      }
      setHint(applicationText(`投影対象: ${sources.length}件。Enterまたは右クリックメニューの「実行」で確定、Escでキャンセル`, `Projection targets: ${sources.length}. Confirm with Enter or Execute in the context menu; press Esc to cancel.`));
      draw();
      return true;
    }

    function addSketchProjectionSourcesByRect(rect, crossing) {
      const stagedKeys = new Set(sources.map((entry) => `${entry.kind}:${entry.key}`));
      let added = 0;
      for (const entry of sketchProjectionEntriesByRect(rect, crossing)) {
        const key = `${entry.kind}:${entry.key}`;
        if (stagedKeys.has(key) || sketchProjectionSourceIsCovered(entry.item)) continue;
        sources.push(entry);
        stagedKeys.add(key);
        added += 1;
      }
      setHint(applicationText(
        `範囲選択で${added}件追加しました。投影対象: ${sources.length}件。Enterまたは右クリックメニューの「実行」で確定、Escでキャンセル`,
        `Added ${added} by area selection. Projection targets: ${sources.length}. Confirm with Enter or Execute in the context menu; press Esc to cancel.`,
      ));
      draw();
      return added;
    }

    function commitSketchProjectionCommand() {
      if (getMode() !== "sketch-projection") return false;
      const entries = sources.filter((entry) => !sketchProjectionSourceIsCovered(entry.item));
      if (entries.length === 0) {
        setHint(applicationText("投影するGeometryを1つ以上選択してください", "Select at least one geometry to project."), "error");
        return false;
      }
      const targetSketchId = activeSketchId();
      const instance = normalizeGeometryInstance({
        id: nextId(),
        type: "sketchProjection",
        sketchId: targetSketchId,
        sources: entries.map((entry) => geometryRefForItem(entry.item)),
        appearanceOverride: {},
      });
      currentScope().geometryInstances.push(instance);
      setMode("select");
      sources = [];
      clearSelection();
      canvasSelection.set("geometryInstances", [instance]);
      refreshConstraintAnalysis();
      updateToolbar();
      updateUI({ refreshAnalysis: false });
      draw();
      setHint(applicationText(`${entries.length}件のGeometryを投影インスタンスにしました`, `Created a projection instance from ${entries.length} geometry item(s).`));
      recordHistory("スケッチ投影");
      return true;
    }

    function reset() { sources = []; }
    function remove(index) {
      if (getMode() !== "sketch-projection" || index < 0 || index >= sources.length) return;
      sources.splice(index, 1);
      draw();
    }
    function cancel() {
      reset();
      setMode("select");
      clearHover();
      updateToolbar();
      setHint(applicationText("スケッチ投影をキャンセルしました", "Sketch projection was canceled."));
      updateUI({ refreshAnalysis: false });
      draw();
    }
    return Object.freeze({ start: startSketchProjectionCommand, toggle: toggleSketchProjectionSource,
      addByRect: addSketchProjectionSourcesByRect, commit: commitSketchProjectionCommand, reset, remove, cancel,
      includes: item => sources.some(entry => entry.item === item),
      get sources() { return sources.slice(); }, get count() { return sources.length; } });
  }
  window.SketchProjectionCommand = Object.freeze({ create });
})();
