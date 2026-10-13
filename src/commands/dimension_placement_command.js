/* Coordinate dimension placement and value-entry transitions through explicit owners. */
(() => {
  "use strict";
  function create({ session: constraintTargetSession, selection, getPending, setPending, canStart, prepareStart, selectMode,
    constraintOperandsFromSelection, constraintResolutionFromCurrentSelection, selectedPrimitives,
    placement, angleDegrees, angleDimensionAngles, readOnlyDimensionConstraintForPlacement,
    addReadOnlyDimensionConstraint, activeSketchId, syncSelectionFromConstraintOperands,
    makeConstraintOperand, hitConstraintOperand, sameConstraintOperand, resolveConstraintIntent,
    hideDimensionValueInput, syncDimensionValueInput, focusDimensionValueInput,
    applicationText, setHint, log, updateConstraintButtons, updateToolbar, draw }) {
    const { defaultDimensionForTarget, dimensionFromAnchor, dimensionWithLabelAt,
      applyDefaultCircleDimensionLabelOffset, dimensionAnchor } = placement;
    function startDistanceCommand() {
      if (!canStart()) return;
      if (constraintTargetSession.operands.length === 0) constraintTargetSession.replaceOperands(constraintOperandsFromSelection());
      const resolution = constraintResolutionFromCurrentSelection("distance");
      if (!resolution) return;
      if (resolution.error) {
        setHint(resolution.error, "error");
        log(resolution.error);
        return;
      }
      prepareStart();
      constraintTargetSession.replaceCommand({ type: "distance" });
      setPending({
        type: "distance-place",
        target: resolution.target,
        resolution,
        pointer: defaultDimensionForTarget(resolution.target),
        operands: resolution.operands || constraintTargetSession.operands.slice(),
        referenceSketchId: resolution.referenceSketchId,
        sketchId: resolution.sketchId,
        readOnlyDimension: resolution.readOnlyDimension === true,
      });
      updateConstraintButtons();
      updateToolbar();
      setHint("寸法線の位置をクリックしてください");
      draw();
    }

    function startPrimitiveDimensionCommand(kind) {
      if (!canStart()) return;
      const primitive = selectedPrimitives()[0];
      if (!primitive) return;
      const value = kind === "diameter" ? primitive.radius() * 2 : primitive.radius();
      prepareStart();
      constraintTargetSession.replaceCommand({ type: "distance" });
      setPending({ type: "distance-place", target: { kind, primitive, value }, pointer: defaultDimensionForTarget({ kind, primitive, value }) });
      updateConstraintButtons();
      updateToolbar();
      setHint("寸法線の位置をクリックしてください");
      draw();
    }

    function startDistanceValueInput(pointer) {
      const pendingCommand = getPending();
      if (!pendingCommand || pendingCommand.type !== "distance-place") return;
      const referenceSketchId = pendingCommand.referenceSketchId;
      const sketchId = pendingCommand.sketchId;
      const readOnlyDimension = pendingCommand.readOnlyDimension === true;
      const dimension = dimensionWithLabelAt(
        pendingCommand.target,
        applyDefaultCircleDimensionLabelOffset(pendingCommand.target, dimensionFromAnchor(pendingCommand.target, pointer)),
        pointer,
      );
      const target = { ...pendingCommand.target, dimensionAxis: dimension.axis };
      const value =
        pendingCommand.target.kind === "point-point" && dimension.axis === "x"
          ? Math.abs(pendingCommand.target.p2.x - pendingCommand.target.p1.x)
          : pendingCommand.target.kind === "point-point" && dimension.axis === "y"
            ? Math.abs(pendingCommand.target.p2.y - pendingCommand.target.p1.y)
            : pendingCommand.target.interval
              ? pendingCommand.target.instance.placement.angleStep * 180 / Math.PI
            : pendingCommand.target.kind === "angle"
              ? angleDegrees(angleDimensionAngles(pendingCommand.target, pointer, dimension).signed)
            : pendingCommand.target.value;
      const readOnlyConstraint = target.annotationAnchor || target.interval ? null : readOnlyDimensionConstraintForPlacement(target, value, dimension, { referenceSketchId, sketchId, readOnlyDimension });
      if (readOnlyConstraint) {
        setPending(null);
        hideDimensionValueInput();
        addReadOnlyDimensionConstraint(readOnlyConstraint, sketchId || activeSketchId(), readOnlyDimension ? "参照元の測定寸法" : referenceSketchId ? "重複参照寸法" : "重複寸法");
        return;
      }
      setPending({
        type: "distance-value",
        target,
        dimension,
        buffer: String(value),
        editing: false,
        referenceSketchId,
        sketchId,
      });
      setHint(applicationText("寸法値を入力中: 数式は = から開始し、Parameter参照はダブルクオーテーションで括ります。Canvas寸法のクリックで参照を挿入できます", "Editing dimension: begin expressions with = and enclose parameter references in double quotes. Click a canvas dimension to insert a reference."));
      updateConstraintButtons();
      syncDimensionValueInput();
      draw();
      focusDimensionValueInput();
    }

    function retargetDistancePlaceWithOperand(pointer, hits = {}) {
      const pendingCommand = getPending();
      if (pendingCommand?.type !== "distance-place" || !["line-length", "radius", "diameter"].includes(pendingCommand.target.kind)) return false;
      let baseOperands = pendingCommand.operands?.length ? pendingCommand.operands : [];
      if (baseOperands.length === 0 && pendingCommand.target.kind === "line-length") {
        baseOperands = [makeConstraintOperand("line", { line: pendingCommand.target.line })];
      } else if (baseOperands.length === 0 && (pendingCommand.target.kind === "radius" || pendingCommand.target.kind === "diameter")) {
        baseOperands = [makeConstraintOperand("primitive", { primitive: pendingCommand.target.primitive })];
      }
      baseOperands = baseOperands.filter(Boolean);
      if (baseOperands.length !== 1) return false;
      const operand = hitConstraintOperand(pointer, "distance", hits);
      if (!operand || sameConstraintOperand(baseOperands[0], operand)) return false;
      const resolution = resolveConstraintIntent("distance", [baseOperands[0], operand]);
      if (resolution?.error) {
        setHint(resolution.error, "error");
        return true;
      }
      if (!resolution?.target) return false;
      startDistanceResolution(resolution, null);
      getPending().pointer = pointer;
      getPending().dimension = null;
      return true;
    }

    function startDistanceResolution(resolution, pointer) {
      if (!resolution || resolution.error || !resolution.target) {
        if (resolution?.error) setHint(resolution.error, "error");
        return false;
      }
      selectMode();
      const initialDimension = pointer ? null : defaultDimensionForTarget(resolution.target);
      const initialPointer = pointer || dimensionAnchor(resolution.target, initialDimension);
      if (resolution.operands) {
        constraintTargetSession.replaceOperands(resolution.operands.slice());
        syncSelectionFromConstraintOperands();
      }
      constraintTargetSession.replaceCommand({ type: "distance", ...(resolution.target.annotationAnchor ? { annotationAnchor: true } : {}) });
      setPending({
        type: "distance-place",
        target: resolution.target,
        resolution,
        pointer: initialPointer,
        dimension: initialDimension,
        operands: resolution.operands || constraintTargetSession.operands.slice(),
        referenceSketchId: resolution.referenceSketchId,
        sketchId: resolution.sketchId,
        readOnlyDimension: resolution.readOnlyDimension === true,
      });
      updateConstraintButtons();
      updateToolbar();
      const awaitingSecondOperand = (resolution.operands || []).length === 1;
      setHint(
        resolution.referenceSketchId
          ? "参照寸法線の位置をクリックしてください"
          : awaitingSecondOperand && resolution.target.kind === "line-length"
            ? "仮寸法の位置をマウスで調整し、空白をクリックして線長寸法を確定してください。2本目の線で線間・角度寸法、円で円中心距離寸法になります。"
            : awaitingSecondOperand && (resolution.target.kind === "radius" || resolution.target.kind === "diameter")
              ? "仮寸法の位置をマウスで調整し、空白をクリックして単独寸法を確定してください。線で円中心距離寸法、同心の円または円弧で半径差寸法になります。"
            : "寸法線の位置をクリックしてください",
      );
      draw();
      return true;
    }
    function targetDoubleClick(hitP, hitL, pointer) {
      if (constraintTargetSession.command?.type !== "distance") return false;
      if (selection.points.length !== 0 || selection.lines.length !== 1) return false;
      if (hitL && selection.lines[0] !== hitL) return false;
      updateConstraintButtons();
      startDistanceCommand();
      if (getPending()?.type === "distance-place") startDistanceValueInput(defaultDimensionForTarget(getPending().target));
      return true;
    }

    return Object.freeze({ targetDoubleClick, startDistanceCommand, startPrimitiveDimensionCommand,
      startDistanceValueInput, retargetDistancePlaceWithOperand, startDistanceResolution });
  }
  window.DimensionPlacementCommand = Object.freeze({ create });
})();
