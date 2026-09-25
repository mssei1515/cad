/* Coordinate offset distance input and commit through selection, geometry and input services. */
(() => {
  "use strict";
  function create({ getPending, setPending, plans, construction, placement, offsetSelection,
    viewport, Line, Circle, minOrientationLength: MIN_ORIENTATION_LENGTH, offsetPairSign,
    offsetChainErrorText, formatDisplayNumber, formatDimensionLabel, setHint, updateToolbar,
    syncDimensionValueInput, focusDimensionValueInput, hideDimensionValueInput, draw,
    clearPointerPreview, clearSelection, setPointerPreview, syncOffsetChainSelection,
    applicationText, updateGeometrySelectionUI }) {
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

    function click(p, { hitL, hitA, hitC }) {
      if (offsetSelection.source instanceof Circle) {
        startOffsetDistanceInput(offsetSelection.source, p);
        return;
      }
      if (offsetSelection.committed && offsetSelection.entries.length > 0) {
        if (offsetSelection.entries.length === 1) startOffsetDistanceInput(offsetSelection.entries[0].geometry, p);
        else startOffsetChainDistanceInput(offsetSelection.entries, p);
        return;
      }
      const candidate = hitL || hitA;
      if (candidate) {
        const added = offsetSelection.add(candidate);
        if (!added.ok) {
          const messages = {
            "already-selected": ["その図形は既に選択されています", "That geometry is already selected."],
            "not-connected": ["選択中チェーンの端部に明示的に接続された線または円弧を選択してください", "Select a line or arc explicitly connected to an end of the current chain."],
            "closed-chain": ["閉じたチェーンには図形を追加できません", "No more geometry can be added to a closed chain."],
          };
          const message = messages[added.code] || ["この図形はチェーンへ追加できません", "This geometry cannot be added to the chain."];
          setHint(applicationText(message[0], message[1]), "error");
        } else {
          setPointerPreview(p);
          const closedText = added.closed ? applicationText("（閉チェーン）", " (closed chain)") : "";
          setHint(applicationText(
            `${offsetSelection.entries.length}個選択${closedText}。続けて線・円弧を選択するか、空白クリック／Enterでチェーンを確定してください`,
            `${offsetSelection.entries.length} selected${closedText}. Select another line/arc, or click blank canvas / press Enter to finish the chain.`,
          ));
          updateGeometrySelectionUI();
          draw();
        }
        return;
      }
      if (hitC) {
        if (offsetSelection.entries.length > 0) {
          setHint(applicationText("円は線・円弧のチェーンへ追加できません", "A circle cannot be added to a line/arc chain."), "error");
          return;
        }
        offsetSelection.selectSource(hitC);
        syncOffsetChainSelection();
        setPointerPreview(p);
        setHint("オフセットする側と距離の目安をクリックしてください");
        updateGeometrySelectionUI();
        draw();
        return;
      }
      if (offsetSelection.entries.length > 0) {
        offsetSelection.commitSelection();
        if (offsetSelection.entries.length === 1) startOffsetDistanceInput(offsetSelection.entries[0].geometry, p);
        else startOffsetChainDistanceInput(offsetSelection.entries, p);
        return;
      }
      setHint("オフセットする線、円、円弧をクリックしてください", "error");
      return;
    }

    function canConfirmSelection() {
      return !getPending() && offsetSelection.entries.length > 0 && !offsetSelection.committed;
    }
    function confirmSelection(pointer) {
      offsetSelection.commitSelection();
      if (pointer) setPointerPreview({ ...pointer });
      setHint(applicationText("チェーンを確定しました。オフセットする側と距離の目安をクリックしてください", "Chain confirmed. Click the offset side and an approximate distance."));
      updateToolbar();
      draw();
    }
    function preview(pointerPreview) {
      const pending = getPending();
      const entries = offsetSelection.entries;
      if (!(offsetSelection.source || entries.length)) return null;
      const enteringValue = pending?.type === "offset-value";
      const pointer = enteringValue ? pending.pointer : pointerPreview;
      if (!pointer) return null;
      let source, offset, distance, sign, geometries;
      if (entries.length > 1) {
        const measured = enteringValue
          ? { distance: Number(pending.buffer), side: pending.chainSide, index: pending.dimensionSegmentIndex }
          : offsetChainDistanceFromPointer(entries, pointer);
        distance = Number.isFinite(measured.distance) && measured.distance > 0 ? measured.distance : MIN_ORIENTATION_LENGTH * 10;
        const plan = offsetChainDraft(entries, distance, measured.side, offsetChainIsClosed(entries));
        if (!plan.ok) return null;
        geometries = plan.geometries;
        const index = Math.max(0, Math.min(entries.length - 1, Number(measured.index) || 0));
        source = entries[index].geometry;
        offset = geometries[index];
        sign = offsetPairSign(source, offset);
      } else {
        source = offsetSelection.source || entries[0]?.geometry;
        if (!source) return null;
        const measured = offsetDistanceFromPointer(source, pointer);
        sign = enteringValue ? pending.sign : measured.sign;
        const value = enteringValue ? Number(pending.buffer) : measured.distance;
        distance = Number.isFinite(value) && value > 0 ? value : measured.distance;
        offset = offsetDraftGeometry(source, distance, sign);
        if (!offset) return null;
        geometries = [offset];
      }
      const target = offsetDimensionTarget(source, offset, distance, sign);
      const dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer);
      if (enteringValue) {
        pending.target = target;
        pending.dimension = dimension;
      }
      return { geometries, target, dimension, distance };
    }
    return Object.freeze({ click, canConfirmSelection, confirmSelection, preview, start: startOffsetDistanceInput, startChain: startOffsetChainDistanceInput, submit: submitOffsetValue });
  }
  window.OffsetCommand = Object.freeze({ create });
})();
