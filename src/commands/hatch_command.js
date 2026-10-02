/* Own Hatch creation and boundary-repair preview state and command transitions. */
(() => {
  "use strict";
  const { DEFAULT_HATCH_APPEARANCE } = window.Appearance;
  function create({ currentScope, hatchGeometryQuery, getMode, setMode, lastPointer, getPointerPreview, setPointerPreview,
    activeSketchId, setActiveSketch, canCreateInActiveSketch, rejectRootSketchCreation, nextHatchId, hatchSequence,
    cancelConstraintTargetCommand, cancelPendingCommand, clearSnap, clearSelection, canvasSelection,
    updateToolbar, updateStatusUI, updateUI, setHint, draw, recordHistory, applicationText, hatchRegionErrorText }) {
    const { hatchFaceAt } = hatchGeometryQuery;
    let hatchPreview = null;
    let hatchRepairTarget = null;
    function updateHatchPreview(pointer) {
      if (!pointer || !["hatch", "hatch-repair"].includes(getMode())) return;
      hatchPreview = { pointer: { x: pointer.x, y: pointer.y }, result: hatchFaceAt(pointer) };
    }

    function startHatchCreation() {
      cancelConstraintTargetCommand("");
      cancelPendingCommand("");
      if (!canCreateInActiveSketch()) {
        rejectRootSketchCreation();
        return;
      }
      setMode("hatch");
      hatchRepairTarget = null;
      setPointerPreview(lastPointer());
      hatchPreview = null;
      if (getPointerPreview()) updateHatchPreview(getPointerPreview());
      clearSnap();
      updateToolbar();
      updateStatusUI();
      setHint(applicationText("塗りつぶす閉領域の内側をクリックしてください。終了はEscです", "Click inside a closed region to fill it. Press Esc to finish."));
      draw();
    }

    function startHatchBoundaryRepair(hatch) {
      if (!hatch || hatch.blockProjection || !currentScope().hatches.includes(hatch)) return false;
      if (hatch.sketchId !== activeSketchId()) setActiveSketch(hatch.sketchId);
      setMode("hatch-repair");
      hatchRepairTarget = hatch;
      hatchPreview = null;
      setPointerPreview(lastPointer());
      if (getPointerPreview()) updateHatchPreview(getPointerPreview());
      updateToolbar();
      updateStatusUI();
      setHint(applicationText(`${hatch.id} の新しい閉領域をクリックしてください`, `Click a new closed region for ${hatch.id}`));
      draw();
      return true;
    }

    function commitHatchAt(pointer) {
      const result = hatchFaceAt(pointer);
      hatchPreview = { pointer: { x: pointer.x, y: pointer.y }, result };
      if (!result.ok) {
        setHint(hatchRegionErrorText(result), "error");
        draw();
        return false;
      }
      if (getMode() === "hatch-repair" && hatchRepairTarget) {
        const hatch = hatchRepairTarget;
        hatch.seed = { x: pointer.x, y: pointer.y };
        hatch.boundaryLoops = result.boundaryLoops;
        hatchGeometryQuery.forget(hatch);
        clearSelection();
        canvasSelection.set("hatches", [hatch]);
        hatchRepairTarget = null;
        hatchPreview = null;
        setPointerPreview(null);
        setMode("select");
        updateUI({ refreshAnalysis: false });
        draw();
        recordHistory("塗りつぶし境界再指定");
        setHint(applicationText(`${hatch.id} の境界を再指定しました`, `Reassigned the boundary of ${hatch.id}`));
        return true;
      }
      const hatch = {
        id: nextHatchId(),
        sketchId: activeSketchId(),
        seed: { x: pointer.x, y: pointer.y },
        boundaryLoops: result.boundaryLoops,
        appearance: { ...DEFAULT_HATCH_APPEARANCE },
      };
      currentScope().hatches.push(hatch);
      currentScope().nextHatchIndex = hatchSequence();
      clearSelection();
      canvasSelection.set("hatches", [hatch]);
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("塗りつぶし追加");
      setHint(applicationText(`${hatch.id} を作成しました。続けて閉領域をクリックできます`, `Created ${hatch.id}. Click another closed region to continue.`));
      return true;
    }


    function reset() { hatchPreview = null; hatchRepairTarget = null; }
    return Object.freeze({ updateHatchPreview, startHatchCreation, startHatchBoundaryRepair, commitHatchAt, reset,
      get preview() { return hatchPreview ? { pointer: { ...hatchPreview.pointer }, result: hatchPreview.result } : null; },
    });
  }
  window.HatchCommand = Object.freeze({ create });
})();
