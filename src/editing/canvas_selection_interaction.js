/* Apply ordinary canvas hits to selection and start the appropriate interaction. */
(() => {
  "use strict";
  function create({ canvasSelection, clearSelection, sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner,
    beginDerivedGeometryDrag, beginBlockDrag, beginDimensionDrag, beginDrag, beginReferenceImageDrag,
    selectedElementCount, selectedDragPoints, buildDragSession, geometryDrag, selectionRectangle,
    capturePointer, setHint, applicationText, updateGeometrySelectionUI, draw }) {
    function begin(e, p, { hitP, hitL, hitC, hitA, hitS, hitArcEnd, hitD, hitDerivedGeometry, hitDerivedInstance, hitBlock, hitBlockHandle, hatchHit, referenceImageHit, directGeometryHit }) {
      const multiSelect = e.shiftKey || e.ctrlKey;
      const topDrawingOwner = topmostDrawingOrderOwner([
        hitDerivedGeometry?.instance,
        hitDerivedInstance,
        hitBlock,
        hitL,
        hitC,
        hitA,
        hitS,
        hatchHit,
      ]);
      const drawingHitIsTop = (item) => Boolean(item && drawingOrderOwner(item) === topDrawingOwner);

      if (hitDerivedGeometry && drawingHitIsTop(hitDerivedGeometry.instance)) {
        if (multiSelect) {
          canvasSelection.set("instanceGeometry", null);
          if (!canvasSelection.geometryInstances.includes(hitDerivedGeometry.instance)) canvasSelection.append("geometryInstances", hitDerivedGeometry.instance);
          else canvasSelection.set("geometryInstances", canvasSelection.geometryInstances.filter((instance) => instance !== hitDerivedGeometry.instance));
          canvasSelection.set("dimensionConstraint", null);
          canvasSelection.set("constraint", null);
          updateGeometrySelectionUI();
          draw();
        } else {
          beginDerivedGeometryDrag(e, hitDerivedGeometry, p);
        }
      } else if (hitDerivedInstance && drawingHitIsTop(hitDerivedInstance)) {
        if (!multiSelect) clearSelection();
        const index = canvasSelection.geometryInstances.indexOf(hitDerivedInstance);
        if (multiSelect && index >= 0) canvasSelection.removeAt("geometryInstances", index, 1);
        else if (!canvasSelection.geometryInstances.includes(hitDerivedInstance)) canvasSelection.append("geometryInstances", hitDerivedInstance);
        canvasSelection.set("dimensionConstraint", null);
        canvasSelection.set("constraint", null);
        setHint(applicationText(`派生インスタンス ${hitDerivedInstance.id} を選択`, `Selected derived instance ${hitDerivedInstance.id}`));
        updateGeometrySelectionUI();
        draw();
      } else if (hitBlock && !hitP && !hitArcEnd && drawingHitIsTop(hitBlock)) {
        if (multiSelect) {
          canvasSelection.set("dimensionConstraint", null);
          canvasSelection.set("constraint", null);
          canvasSelection.toggleBlockInstanceSelection(hitBlock);
          setHint(`ブロックインスタンスを${canvasSelection.blockInstances.length}個選択`);
          updateGeometrySelectionUI();
          draw();
        } else beginBlockDrag(e, hitBlock, p, Boolean(hitBlockHandle));
      } else if (hitD && !directGeometryHit && !multiSelect) {
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        canvasSelection.set("splines", []);
        canvasSelection.set("arcEndpoint", null);
        beginDimensionDrag(e, hitD, p);
      } else if (hitP) {
        canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.togglePointSelection(hitP);
        else beginDrag(e, hitP, null, null, null, null, p);
      } else if (hitArcEnd) {
        canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) {
          const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
          if (canvasSelection.arcEndpoint && !sameArcEndpoint(canvasSelection.arcEndpoint, next)) canvasSelection.set("arcEndpointPair", [canvasSelection.arcEndpoint, next]);
          canvasSelection.set("arcEndpoint", next);
          if (!canvasSelection.arcs.includes(hitArcEnd.arc)) canvasSelection.append("arcs", hitArcEnd.arc);
        } else {
          beginDrag(e, null, null, null, null, hitArcEnd, p);
        }
      } else if (hitL && drawingHitIsTop(hitL)) {
        canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleLineSelection(hitL);
        else beginDrag(e, null, hitL, null, null, null, p);
      } else if (hitC && drawingHitIsTop(hitC)) {
        canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleCircleSelection(hitC);
        else beginDrag(e, null, null, hitC, null, null, p);
      } else if (hitA && drawingHitIsTop(hitA)) {
        canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleArcSelection(hitA);
        else beginDrag(e, null, null, null, hitA, null, p);
      } else if (hitS && drawingHitIsTop(hitS)) {
        canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleSplineSelection(hitS);
        else {
          let plan = null;
          const preserveMixedSelection = selectedElementCount() > 1 && canvasSelection.splines.includes(hitS);
          if (preserveMixedSelection) plan = buildDragSession("selection", selectedDragPoints(), p);
          else {
            clearSelection();
            canvasSelection.set("splines", [hitS]);
            plan = buildDragSession("spline", hitS, p);
          }
          if (geometryDrag.begin(e, plan)) {
            setHint(`${geometryDrag.label}中: 拘束を保ちながら自動solveしています`);
          }
        }
      } else if (hatchHit && drawingHitIsTop(hatchHit)) {
        if (hatchHit.blockProjection) {
          if (!multiSelect) clearSelection();
          if (multiSelect) canvasSelection.toggleBlockInstanceSelection(hatchHit.blockInstance);
          else canvasSelection.set("blockInstances", [hatchHit.blockInstance]);
        } else {
          if (!multiSelect) clearSelection();
          if (multiSelect) canvasSelection.toggleById("hatches", hatchHit);
          else canvasSelection.set("hatches", [hatchHit]);
        }
      } else if (referenceImageHit) {
        if (multiSelect) {
          canvasSelection.toggleById("referenceImages", referenceImageHit);
        } else {
          beginReferenceImageDrag(e, referenceImageHit, p);
          return;
        }
      } else {
        selectionRectangle.begin(p, { additive: multiSelect });
        capturePointer(e.pointerId);
      }

      // Selection does not change the model, so keep the most recent constraint
      // analysis instead of repeating the expensive redundancy scan.
      updateGeometrySelectionUI();
      draw();
    }
    return Object.freeze({ begin });
  }
  window.CanvasSelectionInteraction = Object.freeze({ create });
})();
