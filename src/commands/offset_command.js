/* Coordinate offset distance input and commit through selection, geometry and input services. */
(() => {
  "use strict";
  function create({ getPending, setPending, plans, construction, placement, offsetSelection,
    viewport, Line, minOrientationLength: MIN_ORIENTATION_LENGTH, offsetPairSign,
    offsetChainErrorText, formatDisplayNumber, formatDimensionLabel, setHint, updateToolbar,
    syncDimensionValueInput, focusDimensionValueInput, hideDimensionValueInput, draw,
    clearPointerPreview, clearSelection }) {
    const { offsetDistanceFromPointer, offsetDraftGeometry, offsetDimensionTarget,
      offsetChainDistanceFromPointer, offsetChainDraft } = plans;
    const { dimensionWithLabelAt, dimensionFromAnchor } = placement;
    const { createOffsetGeometry, createOffsetChainGeometry } = construction;
    const { isClosed: offsetChainIsClosed } = offsetSelection;
    function startOffsetDistanceInput(source, pointer) {
      if (!source || !pointer) return false;
      let { distance, sign } = offsetDistanceFromPointer(source, pointer);
      if (distance < MIN_ORIENTATION_LENGTH) distance = Math.max(20 / viewport.scale, MIN_ORIENTATION_LENGTH * 10);
      const offset = offsetDraftGeometry(source, distance, sign);
      if (!offset) {
        setHint("指定した側にはオフセットを作成できません", "error");
        return false;
      }
      const target = offsetDimensionTarget(source, offset, distance, sign);
      setPending({
        type: "offset-value",
        source,
        sign,
        pointer: { ...pointer },
        target,
        dimension: dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer),
        buffer: formatDisplayNumber(distance),
        editing: false,
      });
      setHint("オフセット距離を入力してください。Enterまたはダブルクリックで決定します");
      updateToolbar();
      syncDimensionValueInput();
      draw();
      focusDimensionValueInput();
      return true;
    }

    function startOffsetChainDistanceInput(entries, pointer) {
      if (!Array.isArray(entries) || entries.length < 2 || !pointer) return false;
      let measured = offsetChainDistanceFromPointer(entries, pointer);
      if (measured.distance < MIN_ORIENTATION_LENGTH) measured = { ...measured, distance: Math.max(20 / viewport.scale, MIN_ORIENTATION_LENGTH * 10) };
      const closed = offsetChainIsClosed(entries);
      const draft = offsetChainDraft(entries, measured.distance, measured.side, closed);
      if (!draft.ok) {
        setHint(offsetChainErrorText(draft), "error");
        return false;
      }
      const source = entries[measured.index].geometry;
      const offset = draft.geometries[measured.index];
      const target = offsetDimensionTarget(source, offset, measured.distance, offsetPairSign(source, offset));
      setPending({
        type: "offset-value",
        source,
        sign: target.sign,
        pointer: { ...pointer },
        target,
        dimension: dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer),
        buffer: formatDisplayNumber(measured.distance),
        editing: false,
        chainEntries: entries.map((entry) => ({ ...entry })),
        chainClosed: closed,
        chainSide: measured.side,
        dimensionSegmentIndex: measured.index,
      });
      setHint("オフセット距離を入力してください。Enterまたはダブルクリックで決定します");
      updateToolbar();
      syncDimensionValueInput();
      draw();
      focusDimensionValueInput();
      return true;
    }

    function submitOffsetValue() {
      const pendingCommand = getPending();
      if (pendingCommand?.type !== "offset-value") return false;
      const value = Number(pendingCommand.buffer);
      const { source, sign, pointer, chainEntries, chainClosed, chainSide, dimensionSegmentIndex } = pendingCommand;
      const chainPlan = chainEntries?.length > 1 ? offsetChainDraft(chainEntries, value, chainSide, chainClosed) : null;
      if (!Number.isFinite(value) || value <= 0 || chainPlan && !chainPlan.ok || (!chainPlan && !(source instanceof Line) && source.radius() + sign * value < MIN_ORIENTATION_LENGTH)) {
        setHint(chainPlan && !chainPlan.ok ? offsetChainErrorText(chainPlan) : "作成可能な0より大きいオフセット距離を入力してください", "error");
        draw();
        return false;
      }
      setPending(null);
      hideDimensionValueInput();
      const ok = chainEntries?.length > 1
        ? createOffsetChainGeometry(chainEntries, value, chainSide, pointer, chainClosed, dimensionSegmentIndex)
        : createOffsetGeometry(source, value, sign, pointer);
      offsetSelection.reset();
      clearPointerPreview();
      clearSelection();
      updateToolbar();
      if (ok) setHint(`オフセット ${formatDimensionLabel(value)} を作成しました。次の図形を選択してください`);
      draw();
      return ok;
    }

    return Object.freeze({ start: startOffsetDistanceInput, startChain: startOffsetChainDistanceInput, submit: submitOffsetValue });
  }
  window.OffsetCommand = Object.freeze({ create });
})();
