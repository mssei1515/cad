/* Resolve geometry paint policy without drawing or changing interaction state. */
(() => {
  "use strict";
  function create({ Point, canvasSelection, canvasHover, viewState,
    effectiveAppearanceForElement, isEditableSketchElement, isConstraintOperandSelected, isPendingReferenceTarget,
    isSidebarHighlightedElement, isSidebarHoveredElement, isReferenceHoverElement, isSelectedConstraintRelatedElement,
    sketchAlpha, sketchStrokeWidth, constraintStatusColor, canvasThemeColor, constructionAlpha, pointQueries = {}, handleQueries = {} }) {
    const { sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, isDraggingArcEndpoint, editedSpline, currentScope } = handleQueries;
    const { isSplineOnlyFitPoint, isEditableSplineFitPoint, isExplicitPoint, isPointUsedByPrimitive, isReferencePoint,
      isAnyLineEndpoint, isEndpointPoint, isDraggingPoint, isDraggingCenter, sidebarHoveredItem, pointLockedByLineFixed } = pointQueries;
    function geometryDisplayColor(item, appearance, selected = false, hovered = false) {
      if (selected) return canvasThemeColor("#1d4ed8");
      if (hovered) return canvasThemeColor("#3b82f6");
      return canvasThemeColor(viewState.constraintStatus ? constraintStatusColor(item) : appearance.color);
    }

    function geometryStrokeWidth(item, { auxiliaryHighlighted = false, selected = false, hovered = false, appearance = null, construction = false } = {}) {
      if (auxiliaryHighlighted || selected) return 3;
      if (hovered) return 2.2;
      if (appearance) return appearance.lineWidth;
      if (construction) return Math.max(0.9, sketchStrokeWidth(item) * 0.55);
      return sketchStrokeWidth(item);
    }

    function ownerInstanceSelected(item) {
      if (item?.derivedInstance && canvasSelection.geometryInstances.includes(item.derivedInstance)) {
        return canvasSelection.instanceGeometry?.instanceId === item.derivedInstance.id
          ? canvasSelection.instanceGeometry.id === item.id
          : !(item instanceof Point) || Boolean(item.sourceRef);
      }
      if (item instanceof Point) return false;
      return Boolean((item?.blockInstance && canvasSelection.blockInstances.includes(item.blockInstance)) || (item?.derivedInstance && canvasSelection.geometryInstances.includes(item.derivedInstance)));
    }

    function ownerInstanceHovered(item) {
      if (item?.derivedInstance && canvasSelection.instanceGeometry?.instanceId === item.derivedInstance.id) return false;
      if (item instanceof Point) return false;
      return Boolean((item?.blockInstance && canvasHover.current.block === item.blockInstance) || (item?.derivedInstance && canvasHover.current.geometryInstance === item.derivedInstance));
    }

    function geometryPaintState(item, kind) {
      const appearance = effectiveAppearanceForElement(item);
      const active = isEditableSketchElement(item);
      const ownSelected = active && canvasSelection[kind].includes(item);
      const geometrySelected = ownSelected || isConstraintOperandSelected(item) || (kind !== "splines" && isPendingReferenceTarget(item));
      const selected = ownerInstanceSelected(item) || geometrySelected;
      const treeHovered = isSidebarHighlightedElement(item);
      const sidebarHovered = isSidebarHoveredElement(item);
      const hoverItem = { lines: canvasHover.current.line, circles: canvasHover.current.circle, arcs: canvasHover.current.arc, splines: canvasHover.current.spline }[kind];
      const canvasHovered = (active || isReferenceHoverElement(item)) && hoverItem === item;
      const hovered = treeHovered || sidebarHovered || canvasHovered || ownerInstanceHovered(item);
      const relatedHighlighted = isSelectedConstraintRelatedElement(item);
      const construction = kind === "splines" ? item.construction : kind === "lines" ? Boolean(item.construction) : Boolean(item.construction) && !selected && !hovered;
      const dimmed = kind === "splines" ? construction && !selected && !hovered : construction && !selected && !hovered && !relatedHighlighted;
      return {
        appearance, construction, sel: selected, selected, hovered, auxiliaryHighlighted: relatedHighlighted, relatedHighlighted,
        alpha: sketchAlpha(item) * (dimmed ? constructionAlpha : 1),
        color: relatedHighlighted ? "#0ea5e9" : geometryDisplayColor(item, appearance, selected, hovered),
        strokeWidth: geometryStrokeWidth(item, { auxiliaryHighlighted: relatedHighlighted, selected, hovered, appearance, construction }),
        showId: viewState.geometryIds || (kind === "splines" ? ownSelected || hovered : geometrySelected || sidebarHovered || canvasHovered || relatedHighlighted),
      };
    }
    function shouldShowPrimitiveCenter(point) {
      if (canvasSelection.circles.some((circle) => circle.center === point) || canvasSelection.arcs.some((arc) => arc.center === point)) return true;
      if (canvasHover.current.circle?.center === point || canvasHover.current.arc?.center === point || canvasHover.current.arcEndpoint?.arc?.center === point) return true;
      if (sidebarHoveredItem()?.center === point) return true;
      if (isDraggingCenter(point)) return true;
      return false;
    }

    function pointPaintState(p) {
      if (isSplineOnlyFitPoint(p) && !isEditableSplineFitPoint(p)) return null;
      const appearance = effectiveAppearanceForElement(p);
      if (!viewState.constraintStatus && !p.blockProjection && !p.derivedProjection && !isExplicitPoint(p) && !isPointUsedByPrimitive(p) && !isReferencePoint(p)) return null;
      const active = isEditableSketchElement(p);
      const alpha = sketchAlpha(p);
      const refSelected = isPendingReferenceTarget(p) || isConstraintOperandSelected(p);
      const treeHovered = isSidebarHighlightedElement(p) && !p.blockProjection && !isAnyLineEndpoint(p);
      const sidebarHovered = isSidebarHoveredElement(p);
      const relatedHighlighted = isSelectedConstraintRelatedElement(p);
      const auxiliaryHighlighted = relatedHighlighted;
      const sel = (active && canvasSelection.points.includes(p)) || refSelected || ownerInstanceSelected(p);
      const endpoint = isEndpointPoint(p);
      const canvasHovered = (active || isReferenceHoverElement(p)) && (canvasHover.current.point === p || canvasHover.current.endpointPoint === p);
      if (viewState.constraintStatus && p.kind === "endpoint" && !canvasHovered && !sel) return null;
      const hovered = treeHovered || sidebarHovered || canvasHovered || ownerInstanceHovered(p);
      const dragging = isDraggingPoint(p);
      const primitiveCenter = shouldShowPrimitiveCenter(p);
      const fixedByLine = pointLockedByLineFixed(p);
      const fixedHighlighted = (!p.derivedProjection && p.fixed || fixedByLine) && (sel || hovered);
      const reference = isReferencePoint(p);
      if (!viewState.constraintStatus && (p.blockProjection || p.derivedProjection) && !sel && !hovered && !dragging && !primitiveCenter && !auxiliaryHighlighted) return null;
      if (!viewState.constraintStatus && reference && !sel && !hovered && !dragging && !auxiliaryHighlighted) return null;
      if (!viewState.constraintStatus && endpoint && !reference && !sel && !hovered && !dragging && !primitiveCenter && !auxiliaryHighlighted) return null;
      return {
        alpha, radius: sel || auxiliaryHighlighted ? 7 : 5,
        fillColor: fixedHighlighted ? "#fee2e2" : sel ? "#1d4ed8" : auxiliaryHighlighted ? "#e0f2fe" : hovered || primitiveCenter || reference ? "#eff6ff" : "#fff",
        color: auxiliaryHighlighted ? "#0ea5e9" : fixedHighlighted ? "#dc2626" : geometryDisplayColor(p, appearance, sel, hovered || primitiveCenter || reference),
        strokeWidth: sel || auxiliaryHighlighted ? 3 : Math.max(1.2, sketchStrokeWidth(p)),
        emphasized: sel || auxiliaryHighlighted,
        showId: viewState.geometryIds || sel || sidebarHovered || canvasHovered || dragging || relatedHighlighted,
        idColor: canvasThemeColor(hovered || endpoint ? "#2563eb" : "#111827"),
        showFixed: p.fixed && !p.derivedProjection && (sel || hovered),
      };
    }
    function shouldShowArcEndpointHandle(arc, endpoint) {
      if (sameArcEndpoint(canvasHover.current.arcEndpoint, { arc, endpoint }) || sameArcEndpoint(canvasSelection.arcEndpoint, { arc, endpoint })) return true;
      if (canvasSelection.arcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint }))) return true;
      if (isDraggingArcEndpoint(arc, endpoint)) return true;
      return false;
    }
    function arcEndpointPaintState(arc, endpoint) {
      if (!isEditableSketchElement(arc) || !shouldShowArcEndpointHandle(arc, endpoint)) return null;
      const point = arcEndpointPoint(arc, endpoint);
      const selected = sameArcEndpoint(canvasSelection.arcEndpoint, { arc, endpoint }) || canvasSelection.arcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint })) || isConstraintOperandSelected(arc, { arcEndpoint: { arc, endpoint } }) || isDraggingArcEndpoint(arc, endpoint);
      const hovered = sameArcEndpoint(canvasHover.current.arcEndpoint, { arc, endpoint });
      const fixed = Boolean(findArcEndpointFixedConstraint(arc, endpoint));
      return { point, radius: selected ? 7 : 5,
        fillColor: fixed ? "#fee2e2" : selected ? "#2563eb" : hovered ? "#eff6ff" : "#fff",
        color: canvasThemeColor(fixed ? "#dc2626" : selected || hovered ? "#2563eb" : "#111827") };
    }
    function splineHandleState() {
      const spline = editedSpline();
      if (!spline || !currentScope().splines.includes(spline)) return null;
      return { closed: spline.closed, points: spline.fitPoints.map(point => ({ point, selected: canvasSelection.points.includes(point) })) };
    }
    return Object.freeze({ arcEndpointPaintState, splineHandleState, pointPaintState, geometryDisplayColor, geometryStrokeWidth, ownerInstanceSelected, ownerInstanceHovered, geometryPaintState });
  }
  window.GeometryPresentation = Object.freeze({ create });
})();
