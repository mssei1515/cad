/* Apply ordinary canvas hits to selection and start the appropriate interaction. */
(() => {
  "use strict";
  function create({ canvasSelection, clearSelection, sameArcEndpoint, topmostDrawingOrderOwner, drawingOrderOwner,
    beginDerivedGeometryDrag, beginBlockDrag, beginDimensionDrag, beginReferenceImageDrag,
    buildDragSession, geometryDrag, selectionRectangle,
    capturePointer, setHint, applicationText, updateGeometrySelectionUI, draw }) {
    function hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd) {
      if (hitP && canvasSelection.points.includes(hitP)) return true;
      if (hitL && canvasSelection.lines.includes(hitL)) return true;
      if (hitC && canvasSelection.circles.includes(hitC)) return true;
      if (hitA && canvasSelection.arcs.includes(hitA)) return true;
      if (hitArcEnd && sameArcEndpoint(canvasSelection.arcEndpoint, { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint })) return true;
      return false;
    }

    function beginDrag(e, hitP, hitL, hitC, hitA, hitArcEnd, pointer) {
      let plan = null;
      canvasSelection.set("constraint", null);
      const preserveMixedSelection = canvasSelection.selectedElementCount() > 1 && hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd);
      if (preserveMixedSelection) {
        plan = buildDragSession("selection", canvasSelection.selectedDragPoints(), pointer);
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
      } else {
        canvasSelection.set("blockInstances", []);
        canvasSelection.set("annotations", []);
        canvasSelection.set("hatches", []);
        canvasSelection.set("referenceImages", []);
        canvasSelection.set("splines", []);
      }
      if (!preserveMixedSelection && hitP) {
        canvasSelection.set("points", [hitP]);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        canvasSelection.set("arcEndpoint", null);
        plan = buildDragSession("point", hitP, pointer);
      } else if (!preserveMixedSelection && hitArcEnd) {
        canvasSelection.set("arcs", [hitArcEnd.arc]);
        canvasSelection.set("arcEndpoint", { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint });
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        plan = buildDragSession("arc-endpoint", hitArcEnd, pointer);
      } else if (!preserveMixedSelection && hitL) {
        canvasSelection.set("lines", [hitL]);
        canvasSelection.set("points", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcs", []);
        canvasSelection.set("arcEndpoint", null);
        plan = buildDragSession("line", hitL, pointer);
      } else if (!preserveMixedSelection && hitC) {
        canvasSelection.set("circles", [hitC]);
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("arcs", []);
        canvasSelection.set("arcEndpoint", null);
        plan = buildDragSession("circle", hitC, pointer);
      } else if (!preserveMixedSelection && hitA) {
        canvasSelection.set("arcs", [hitA]);
        canvasSelection.set("points", []);
        canvasSelection.set("lines", []);
        canvasSelection.set("circles", []);
        canvasSelection.set("arcEndpoint", null);
        plan = buildDragSession("arc", hitA, pointer);
      }

      if (geometryDrag.begin(e, plan)) {
        setHint(`${geometryDrag.label}中: 拘束を保ちながら自動solveしています`);
      }
    }

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
          if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
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
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
        canvasSelection.set("constraint", null);
        setHint(applicationText(`派生インスタンス ${hitDerivedInstance.id} を選択`, `Selected derived instance ${hitDerivedInstance.id}`));
        updateGeometrySelectionUI();
        draw();
      } else if (hitBlock && !hitP && !hitArcEnd && drawingHitIsTop(hitBlock)) {
        if (multiSelect) {
          if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
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
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.togglePointSelection(hitP);
        else beginDrag(e, hitP, null, null, null, null, p);
      } else if (hitArcEnd) {
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) {
          const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
          if (canvasSelection.arcEndpoint && !sameArcEndpoint(canvasSelection.arcEndpoint, next)) canvasSelection.set("arcEndpointPair", [canvasSelection.arcEndpoint, next]);
          canvasSelection.set("arcEndpoint", next);
          if (!canvasSelection.arcs.includes(hitArcEnd.arc)) canvasSelection.append("arcs", hitArcEnd.arc);
        } else {
          beginDrag(e, null, null, null, null, hitArcEnd, p);
        }
      } else if (hitL && drawingHitIsTop(hitL)) {
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleLineSelection(hitL);
        else beginDrag(e, null, hitL, null, null, null, p);
      } else if (hitC && drawingHitIsTop(hitC)) {
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleCircleSelection(hitC);
        else beginDrag(e, null, null, hitC, null, null, p);
      } else if (hitA && drawingHitIsTop(hitA)) {
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleArcSelection(hitA);
        else beginDrag(e, null, null, null, hitA, null, p);
      } else if (hitS && drawingHitIsTop(hitS)) {
        if (!e.shiftKey && !e.ctrlKey) canvasSelection.set("dimensionConstraint", null);
        if (multiSelect) canvasSelection.toggleSplineSelection(hitS);
        else {
          let plan = null;
          const preserveMixedSelection = canvasSelection.selectedElementCount() > 1 && canvasSelection.splines.includes(hitS);
          if (preserveMixedSelection) plan = buildDragSession("selection", canvasSelection.selectedDragPoints(), p);
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
        if (hatchHit.derivedProjection) {
          if (!multiSelect) clearSelection();
          if (multiSelect) canvasSelection.toggleById("geometryInstances", hatchHit.derivedInstance);
          else canvasSelection.set("geometryInstances", [hatchHit.derivedInstance]);
        } else if (hatchHit.blockProjection) {
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
