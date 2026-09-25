/* Fillet input and transactional application; geometry construction is injected. */
(() => {
  "use strict";
  function create({ getPending, setPending, guardSketchProjectionShapeEdit, filletGeometryBasis, filletGeometryFromPointer,
    hideDimensionValueInput, snapshotGeometryMutationState, restoreGeometryMutationState, createFillet,
    clearSelection, selection, stabilize, acceptError, invalidateAnalysis, refreshConstraintAnalysis,
    applicationText, setHint, updateUI, updateGeometrySelectionUI, draw, recordHistory }) {
    let firstLine = null;
    function reset() { firstLine = null; }
    function startFilletRadiusPlacement(line1, line2, pointer = null) {
      if (!guardSketchProjectionShapeEdit([line1, line2], { action: applicationText("R面取り", "Fillet") })) {
        draw();
        return false;
      }
      const basis = filletGeometryBasis(line1, line2);
      if (!basis.ok) {
        setHint(basis.reason, "error");
        draw();
        return false;
      }
      setPending({
        type: "fillet-radius-place",
        line1,
        line2,
        pointer: pointer ? { x: pointer.x, y: pointer.y } : null,
        preview: filletGeometryFromPointer(line1, line2, pointer),
      });
      hideDimensionValueInput();
      setHint("マウスを動かしてR寸法を決め、クリックで確定してください。Escでキャンセルします");
      draw();
      return true;
    }

    function updateFilletRadiusPlacement(pointer) {
      const pendingCommand = getPending();
      if (pendingCommand?.type !== "fillet-radius-place") return false;
      pendingCommand.pointer = { x: pointer.x, y: pointer.y };
      pendingCommand.preview = filletGeometryFromPointer(pendingCommand.line1, pendingCommand.line2, pointer);
      return true;
    }

    function submitFilletRadiusPlacement(pointer) {
      const pendingCommand = getPending();
      if (pendingCommand?.type !== "fillet-radius-place") return false;
      updateFilletRadiusPlacement(pointer);
      const preview = pendingCommand.preview;
      if (!preview.ok) {
        setHint(preview.reason, "error");
        draw();
        return true;
      }
      const { line1, line2 } = pendingCommand;
      setPending(null);
      hideDimensionValueInput();
      const snapshot = snapshotGeometryMutationState();
      const result = createFillet(line1, line2, preview.radius);
      if (!result.ok) {
        restoreGeometryMutationState(snapshot);
        setHint(result.reason, "error");
        updateUI();
        draw();
        return true;
      }
      clearSelection();
      firstLine = null;
      const stabilized = stabilize();
      if (!stabilized.success || stabilized.dependent?.success === false || stabilized.result.errorNorm > acceptError) {
        restoreGeometryMutationState(snapshot);
        setHint(applicationText("拘束を維持できないためR面取りを戻しました。拘束状態を確認してください", "The fillet was restored because its constraints could not be maintained. Check the constraint status."), "error");
        updateUI();
        draw();
        return true;
      }
      invalidateAnalysis();
      refreshConstraintAnalysis();
      setHint(applicationText("R面取りを追加しました", "Fillet added"));
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("R面取り追加");
      return true;
    }

    function handleFilletClick(line, pointer) {
      if (!line) {
        setHint("R面取りする線をクリックしてください", "error");
        return;
      }
      if (!firstLine) {
        firstLine = line;
        selection.set("lines", [line]);
        selection.set("points", []);
        selection.set("circles", []);
        selection.set("arcs", []);
        setHint("接続する2本目の線をクリックしてください");
        updateGeometrySelectionUI();
        draw();
        return;
      }
      if (firstLine === line) {
        setHint("別の接続線をクリックしてください", "error");
        return;
      }
      if (startFilletRadiusPlacement(firstLine, line, pointer)) firstLine = null;
    }
    return Object.freeze({ start: startFilletRadiusPlacement, update: updateFilletRadiusPlacement,
      submit: submitFilletRadiusPlacement, click: handleFilletClick, reset, get firstLine() { return firstLine; } });
  }
  window.FilletCommand = Object.freeze({ create });
})();
