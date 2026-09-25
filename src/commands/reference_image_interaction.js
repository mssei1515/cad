/* Own reference-image drag and two-point scale-calibration sessions. */
(() => {
  "use strict";
  function create({ clearSelection, canvasSelection, applicationText, setHint, updateUI, draw,
    beginPointer, endPointer, viewScale, hypot2, clearSnap, hitReferenceImageAt,
    referenceImageWorldToLocal, referenceImageLocalToWorld, promptDistance, formatDisplayNumber, recordHistory }) {
    let referenceImageDragSession = null;
    let referenceImageCalibrationSession = null;
    function beginReferenceImageDrag(event, item, pointer) {
      clearSelection();
      canvasSelection.set("referenceImages", [item]);
      if (item.locked) {
        setHint(applicationText("位置がロックされた画像です", "This image position is locked"));
        updateUI({ refreshAnalysis: false });
        draw();
        return;
      }
      referenceImageDragSession = { item, pointerId: event.pointerId, startPointer: pointer, startX: item.x, startY: item.y, moved: false };
      beginPointer(event.pointerId);
      setHint(applicationText("画像を移動中", "Moving image"));
      updateUI({ refreshAnalysis: false });
      draw();
    }

    function updateReferenceImageDrag(pointer) {
      const session = referenceImageDragSession;
      if (!session) return;
      const dx = pointer.x - session.startPointer.x;
      const dy = pointer.y - session.startPointer.y;
      if (!session.moved && hypot2(dx, dy) <= 3 / viewScale()) return;
      session.moved = true;
      session.item.x = session.startX + dx;
      session.item.y = session.startY + dy;
      draw();
    }

    function startReferenceImageCalibration(item) {
      if (!item || item.locked || item.visible === false) return false;
      referenceImageCalibrationSession = { item, localPoints: [], worldPoints: [] };
      clearSnap();
      setHint(applicationText("画像上の1点目をクリックしてください", "Click the first point on the image"));
      draw();
      return true;
    }

    function cancelReferenceImageCalibration(message = applicationText("縮尺設定をキャンセルしました", "Scale calibration canceled")) {
      if (!referenceImageCalibrationSession) return false;
      referenceImageCalibrationSession = null;
      setHint(message);
      draw();
      return true;
    }

    function handleReferenceImageCalibrationClick(pointer) {
      const session = referenceImageCalibrationSession;
      if (!session) return false;
      const hit = hitReferenceImageAt(pointer.x, pointer.y);
      if (hit !== session.item) {
        setHint(applicationText("選択中の画像内をクリックしてください", "Click inside the selected image"), "error");
        return true;
      }
      session.localPoints.push(referenceImageWorldToLocal(session.item, pointer));
      session.worldPoints.push({ x: pointer.x, y: pointer.y });
      if (session.localPoints.length === 1) {
        setHint(applicationText("画像上の2点目をクリックしてください", "Click the second point on the image"));
        draw();
        return true;
      }
      const pixelDistance = hypot2(session.localPoints[1].x - session.localPoints[0].x, session.localPoints[1].y - session.localPoints[0].y);
      const currentDistance = pixelDistance * session.item.scale;
      const raw = promptDistance(applicationText("2点間の実寸を入力してください (mm)", "Enter the real distance between the points (mm)"), formatDisplayNumber(currentDistance, 6));
      if (raw == null) return cancelReferenceImageCalibration();
      const realDistance = Number(raw);
      if (!Number.isFinite(realDistance) || realDistance <= 0 || pixelDistance <= 0) {
        setHint(applicationText("0より大きい実寸を入力してください", "Enter a real distance greater than zero"), "error");
        session.localPoints = [];
        session.worldPoints = [];
        return true;
      }
      const firstWorld = session.worldPoints[0];
      const firstLocal = session.localPoints[0];
      session.item.scale = realDistance / pixelDistance;
      const projectedFirst = referenceImageLocalToWorld({ ...session.item, x: 0, y: 0 }, firstLocal);
      session.item.x = firstWorld.x - projectedFirst.x;
      session.item.y = firstWorld.y - projectedFirst.y;
      referenceImageCalibrationSession = null;
      recordHistory("画像縮尺設定");
      setHint(applicationText("画像の縮尺を設定しました", "Image scale calibrated"));
      updateUI({ refreshAnalysis: false });
      draw();
      return true;
    }

    function finishDrag(event) {
      if (!referenceImageDragSession) return false;
      const session = referenceImageDragSession;
      referenceImageDragSession = null;
      endPointer(event.pointerId);
      setHint(session.moved ? applicationText("画像の位置を更新しました", "Image position updated") : applicationText("画像を選択しました", "Image selected"));
      updateUI({ refreshAnalysis: false });
      draw();
      if (session.moved) recordHistory("画像移動");
      return true;
    }
    function reset() { referenceImageDragSession = null; referenceImageCalibrationSession = null; }
    function forget(images) {
      if (referenceImageCalibrationSession && images.includes(referenceImageCalibrationSession.item)) referenceImageCalibrationSession = null;
    }
    return Object.freeze({ beginDrag: beginReferenceImageDrag, updateDrag: updateReferenceImageDrag, finishDrag,
      startCalibration: startReferenceImageCalibration, cancelCalibration: cancelReferenceImageCalibration,
      calibrationClick: handleReferenceImageCalibrationClick, reset, forget,
      get dragging() { return Boolean(referenceImageDragSession); },
      get calibrating() { return Boolean(referenceImageCalibrationSession); },
      get calibrationPoints() { return referenceImageCalibrationSession ? referenceImageCalibrationSession.worldPoints || [] : null; },
      get calibrationPointCount() { return referenceImageCalibrationSession?.localPoints?.length || 0; } });
  }
  window.ReferenceImageInteraction = Object.freeze({ create });
})();
