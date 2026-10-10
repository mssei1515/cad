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
    let regions = [];
    let sequence = 0;
    let selectedRegion = null;
    const regionKey = loops => JSON.stringify(loops.map(loop => ({ role: loop.role, spans: loop.spans
      .map(span => JSON.stringify(span)).sort() })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    function refresh() { updateStatusUI(); draw(); }
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
      regions = []; selectedRegion = null; sequence = 0;
      setPointerPreview(lastPointer());
      hatchPreview = null;
      if (getPointerPreview()) updateHatchPreview(getPointerPreview());
      clearSnap();
      updateToolbar();
      updateStatusUI();
      setHint(applicationText("閉領域をクリックして追加・解除します。Enterまたは完了で確定、Escで取消", "Click closed regions to add/remove them. Enter or Finish confirms; Esc cancels."));
      draw();
    }

    function startHatchBoundaryRepair(hatch) {
      if (!hatch || hatch.blockProjection || !currentScope().hatches.includes(hatch)) return false;
      if (hatch.sketchId !== activeSketchId()) {
        setHint(applicationText("境界を変更するには所属スケッチを作図先に指定してください", "Set the owning sketch as the drawing sketch to change boundaries"), "error");
        return false;
      }
      if (!canCreateInActiveSketch()) { rejectRootSketchCreation(); return false; }
      setMode("hatch-repair");
      hatchRepairTarget = hatch;
      regions = []; selectedRegion = null; sequence = 0;
      hatchPreview = null;
      setPointerPreview(lastPointer());
      if (getPointerPreview()) updateHatchPreview(getPointerPreview());
      updateToolbar();
      updateStatusUI();
      setHint(applicationText(`${hatch.id} の新しい閉領域を選択し、Enterまたは完了で確定してください`, `Select new closed regions for ${hatch.id}, then press Enter or Finish.`));
      draw();
      return true;
    }

    function commitHatchAt(pointer) {
      if (!["hatch", "hatch-repair"].includes(getMode())) return false;
      const result = hatchFaceAt(pointer);
      hatchPreview = { pointer: { x: pointer.x, y: pointer.y }, result };
      if (!result.ok) {
        setHint(hatchRegionErrorText(result), "error");
        draw();
        return false;
      }
      const key = regionKey(result.boundaryLoops);
      const index = regions.findIndex(region => region.key === key);
      if (index >= 0) regions.splice(index, 1);
      else regions.push({ id: ++sequence, key, seed: { x: pointer.x, y: pointer.y }, result });
      selectedRegion = index >= 0 ? null : regions.at(-1).id;
      setHint(applicationText(`${regions.length} 個の領域を選択中。Enterまたは完了で確定します`, `${regions.length} regions selected. Press Enter or Finish to confirm.`));
      refresh();
      return true;
    }

    function finish() {
      if (!regions.length || !["hatch", "hatch-repair"].includes(getMode())) return false;
      // Revalidate against current geometry before applying one atomic edit.
      const checked = regions.map(region => hatchFaceAt(region.seed));
      if (checked.some((result, index) => !result.ok || regionKey(result.boundaryLoops) !== regions[index].key)) {
        setHint(applicationText("選択した領域の境界が変わりました。領域を選び直してください", "Selected boundaries changed. Select the regions again."), "error");
        refresh(); return false;
      }
      const pointer = regions[0].seed;
      const boundaryLoops = checked.flatMap(result => result.boundaryLoops);
      if (getMode() === "hatch-repair" && hatchRepairTarget) {
        const hatch = hatchRepairTarget;
        hatch.seed = { x: pointer.x, y: pointer.y };
        hatch.boundaryLoops = boundaryLoops;
        hatchGeometryQuery.forget(hatch);
        clearSelection();
        canvasSelection.set("hatches", [hatch]);
        hatchRepairTarget = null;
        hatchPreview = null;
        regions = []; selectedRegion = null;
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
        boundaryLoops,
        appearance: { ...DEFAULT_HATCH_APPEARANCE },
      };
      currentScope().hatches.push(hatch);
      currentScope().nextHatchIndex = hatchSequence();
      clearSelection();
      canvasSelection.set("hatches", [hatch]);
      regions = []; selectedRegion = null; hatchPreview = null;
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("塗りつぶし追加");
      setHint(applicationText(`${hatch.id} を作成しました。続けて領域を選択できます`, `Created ${hatch.id}. Select regions to continue.`));
      return true;
    }


    function reset() { hatchPreview = null; hatchRepairTarget = null; regions = []; selectedRegion = null; }
    function select(index) { selectedRegion = regions[index]?.id ?? null; refresh(); }
    function remove(index) { if (!regions[index]) return; regions.splice(index, 1); selectedRegion = null; refresh(); }
    return Object.freeze({ updateHatchPreview, startHatchCreation, startHatchBoundaryRepair, commitHatchAt, finish, reset, select, remove,
      get regions() { return regions.map(region => ({ id: region.id, selected: selectedRegion === region.id, area: region.result.resolved?.area, resolved: region.result.resolved })); },
      get preview() { return hatchPreview ? { pointer: { ...hatchPreview.pointer }, result: hatchPreview.result } : null; },
    });
  }
  window.HatchCommand = Object.freeze({ create });
})();
