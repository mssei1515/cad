/* Coordinate constraint target start, cancellation and completion using the session owner. */
(() => {
  "use strict";
  function create({ session, startAnnotationAnchorConstraint, canStart, prepareStart, prepareCancel,
    constraintLabel, clearSelection, constraintOperandsFromSelection, trimConstraintSelection,
    resolveConstraintIntent, startDistanceResolution, commitConstraintResolution, syncSelectionFromConstraintOperands,
    updateToolbar, updateConstraintButtons, setHint, constraintTargetHint, draw, blurConstraintControl,
    canCompleteConstraintCommand, distanceTargetFromSelection, startDistanceCommand, addConstraint,
    annotationAnchorConstraints, hitConstraintOperand, invalidConstraintTargetHint,
    toggleGeometryFixedOperand, toggleSelectedFixed, updateGeometrySelectionUI, startDistanceValueInput, types = {} }) {
    const { Circle, Arc } = types;
    function startConstraintTargetCommand(type) {
      if (startAnnotationAnchorConstraint(type)) return;
      if (!canStart()) return;
      prepareStart();
      updateToolbar();
      if (session.command?.type === type) {
        cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
        return;
      }
      if (type === "symmetry") clearSelection();
      session.begin(type, type === "symmetry" ? [] : constraintOperandsFromSelection());
      trimConstraintSelection(type);
      if (session.operands.length > 0) {
        const resolution = resolveConstraintIntent(type, session.operands);
        if (resolution?.action === "place-dimension") {
          startDistanceResolution(resolution, null);
          return;
        }
        if (resolution?.action === "commit" && resolution.constraint) {
          commitConstraintResolution(resolution);
          return;
        }
        syncSelectionFromConstraintOperands();
      }
      updateToolbar();
      updateConstraintButtons();
      setHint(constraintTargetHint(type));
      draw();
    }

    function cancelConstraintTargetCommand(message = "拘束対象の選択をキャンセルしました") {
      prepareCancel();
      if (!session.command) return;
      session.reset();
      if (message) setHint(message);
      updateConstraintButtons();
      updateToolbar();
      blurConstraintControl();
      draw();
    }

    function executeConstraintCommandIfReady() {
      if (!session.command) return false;
      const type = session.command.type;
      if (session.operands.length > 0) {
        const resolution = resolveConstraintIntent(type, session.operands);
        if (resolution?.error) {
          setHint(resolution.error, "error");
          return false;
        }
        if (resolution?.action === "place-dimension") {
          startDistanceResolution(resolution, null);
          return true;
        }
        if (resolution?.action === "commit" && resolution.constraint) {
          commitConstraintResolution(resolution);
          return true;
        }
        setHint(constraintTargetHint(type));
        return false;
      }
      if (!canCompleteConstraintCommand(type)) {
        const target = type === "distance" ? distanceTargetFromSelection() : null;
        if (target?.kind === "invalid") {
          setHint(target.reason, "error");
          return false;
        }
        if (target?.kind === "line-length") {
          updateConstraintButtons();
          startDistanceCommand();
          return true;
        }
        setHint(constraintTargetHint(type));
        return false;
      }
      updateConstraintButtons();
      addConstraint(type);
      return true;
    }

    function completePendingDimensionLineLength() {
      if (session.command?.type !== "distance") return false;
      const target = distanceTargetFromSelection();
      if (!target || target.kind !== "line-length") return false;
      updateConstraintButtons();
      startDistanceCommand();
      return true;
    }

    function appendConstraintOperand(type, operand) {
      const result = session.append(type, operand, () => invalidConstraintTargetHint(type));
      if (result.ok) syncSelectionFromConstraintOperands();
      return result;
    }

    function handleConstraintOperandClick(pointer, type, hits = {}) {
      if (annotationAnchorConstraints.active) {
        const operand = hitConstraintOperand(pointer, type, hits);
        return annotationAnchorConstraints.click(operand);
      }
      const operand = hitConstraintOperand(pointer, type, hits);
      if (type === "fixed") {
        const supported = operand && (["point", "line", "arc-endpoint"].includes(operand.kind) || (operand.kind === "primitive" && (operand.primitive instanceof Circle || operand.primitive instanceof Arc)));
        if (!supported || operand.relation !== "active" || operand.element?.derivedProjection) {
          setHint(constraintTargetHint(type), "error");
          return true;
        }
        clearSelection();
        session.replaceOperands([operand]);
        syncSelectionFromConstraintOperands();
        const command = session.command;
        const individualGeometry = operand.element?.blockProjection || operand.kind === "primitive";
        if (individualGeometry ? toggleGeometryFixedOperand(operand) : toggleSelectedFixed()) clearSelection();
        session.replaceCommand(command);
        updateGeometrySelectionUI();
        updateToolbar();
        updateConstraintButtons();
        draw();
        return true;
      }
      if (!operand && type === "distance") {
        const resolution = resolveConstraintIntent(type, session.operands);
        if (resolution?.action === "place-dimension" && resolution.target?.kind === "line-length") {
          startDistanceResolution(resolution, pointer);
          startDistanceValueInput(pointer);
          return true;
        }
      }
      const added = appendConstraintOperand(type, operand);
      if (!added.ok) {
        setHint(added.error, "error");
        return true;
      }
      const resolution = resolveConstraintIntent(type, session.operands);
      if (resolution?.error) {
        setHint(resolution.error, "error");
        draw();
        return true;
      }
      if (resolution?.action === "place-dimension") {
        if (resolution.target?.kind === "line-length" && session.operands.length === 1) {
          startDistanceResolution(resolution, pointer);
          return true;
        }
        startDistanceResolution(resolution, null);
        return true;
      }
      if (resolution?.action === "commit" && resolution.constraint) {
        commitConstraintResolution(resolution);
        return true;
      }
      updateGeometrySelectionUI();
      setHint(constraintTargetHint(type));
      draw();
      return true;
    }

    return Object.freeze({ operandClick: handleConstraintOperandClick, start: startConstraintTargetCommand, cancel: cancelConstraintTargetCommand,
      complete: executeConstraintCommandIfReady, completeLineLength: completePendingDimensionLineLength });
  }
  window.ConstraintTargetCommand = Object.freeze({ create });
})();
