/* Resolve geometry paint policy without drawing or changing interaction state. */
(() => {
  "use strict";
  const CONSTRAINT_STATUS_COLORS = {
    full: "#111827",
    support: "#0f766e",
    under: "#f59e0b",
    conflict: "#dc2626",
  };
  const INACTIVE_CONSTRAINT_STATUS_COLOR = "#cbd5e1";
  const SKETCH_SOLVE_ERROR_COLOR = "#dc2626";
  function create({ Point, canvasSelection, canvasHover, viewState,
    effectiveAppearanceForElement, isEditableSketchElement, isConstraintOperandSelected: legacyOperandSelected, isPendingReferenceTarget: legacyPendingTarget,
    isSidebarHighlightedElement, isSidebarHoveredElement, isReferenceHoverElement: legacyReferenceHover, isSelectedConstraintRelatedElement,
    sketchAlpha: legacySketchAlpha, sketchStrokeWidth: legacySketchWidth, constraintStatusColor: legacyStatusColor,
    canvasThemeColor, constructionAlpha, pointQueries = {}, pointUsage = pointQueries, handleQueries = {}, isExporting = () => false,
    commandTargets = { isConstraintOperandSelected: legacyOperandSelected, isPendingReferenceTarget: legacyPendingTarget, isReferenceHoverElement: legacyReferenceHover },
    sketchStyle = { sketchAlpha: legacySketchAlpha, sketchStrokeWidth: legacySketchWidth, constraintStatusColor: legacyStatusColor } }) {
    const { isConstraintOperandSelected, isPendingReferenceTarget, isReferenceHoverElement } = commandTargets;
    const { sketchAlpha, sketchStrokeWidth, constraintStatusColor } = sketchStyle;
    const { sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, isDraggingArcEndpoint, editedSpline, currentScope } = handleQueries;
    const { isSplineOnlyFitPoint, isEditableSplineFitPoint, isExplicitPoint, isPointUsedByPrimitive, isReferencePoint, isAnyLineEndpoint, isEndpointPoint } = pointUsage;
    const { isDraggingPoint, isDraggingCenter, sidebarHoveredItem, pointLockedByLineFixed } = pointQueries;
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
      if (canvasSelection.inspectionContains?.(item?.blockInstance) || canvasSelection.inspectionContains?.(item?.derivedInstance)) return true;
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
      if (isExporting()) {
        const construction = Boolean(item.construction);
        return { appearance, construction, sel: false, selected: false, hovered: false, auxiliaryHighlighted: false, relatedHighlighted: false,
          alpha: sketchAlpha(item) * (construction ? constructionAlpha : 1), color: canvasThemeColor(appearance.color), strokeWidth: appearance.lineWidth, showId: false };
      }
      const active = isEditableSketchElement(item);
      const ownSelected = canvasSelection[kind].includes(item) || canvasSelection.inspectionContains?.(item);
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
      if (isExporting()) {
        if (!isExplicitPoint(p)) return null;
        const appearance = effectiveAppearanceForElement(p);
        return { alpha: sketchAlpha(p), radius: 5, fillColor: "#fff", color: canvasThemeColor(appearance.color),
          strokeWidth: Math.max(1.2, sketchStrokeWidth(p)), emphasized: false, showId: false, showFixed: false };
      }
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
      const sel = canvasSelection.points.includes(p) || canvasSelection.inspectionContains?.(p) || refSelected || ownerInstanceSelected(p);
      if (p.instanceControl && !sel && !ownerInstanceHovered(p) && canvasHover.current.point !== p) return null;
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
  function createLineDisplay({ viewport, effectiveAppearanceForElement, constructionExtensionScreenPx }) {
    function extendedLineSegment(line, extension) {
      const len = line.length();
      if (len < 1e-12 || !Number.isFinite(extension) || extension <= 0) return { p1: line.p1, p2: line.p2 };
      const ux = line.dx() / len;
      const uy = line.dy() / len;
      return {
        p1: { x: line.p1.x - ux * extension, y: line.p1.y - uy * extension },
        p2: { x: line.p2.x + ux * extension, y: line.p2.y + uy * extension },
      };
    }

    function lineDisplaySegment(line, appearance = effectiveAppearanceForElement(line)) {
      return line.construction && appearance.endpointOverhang !== false
        ? extendedLineSegment(line, constructionExtensionScreenPx / viewport.scale)
        : { p1: line.p1, p2: line.p2 };
    }
    return Object.freeze({ lineDisplaySegment });
  }
  function createCommandTargets({ readPanelSelection, readMode, instanceSourceCommand, sketchProjectionCommand,
    geometryInstanceCommand, geometryRefsEqual, geometryRefForItem, readOperands, sameArcEndpoint, operandElement,
    readConstraintCommand, isActiveSketchElement, isReferenceSourceSketchId, elementSketchId, readPending }) {
    function isConstraintOperandSelected(item, options = {}) {
      if (!item) return false;
      if (readPanelSelection()) return geometryRefsEqual(geometryRefForItem(item), geometryRefForItem(readPanelSelection()));
      if (readMode() === "instance-sources" && instanceSourceCommand.includesRef(geometryRefForItem(item))) return true;
      if (readMode() === "sketch-projection" && sketchProjectionCommand.includes(item)) return true;
      if (readMode().startsWith("pattern-placement-")) {
        if (item === geometryInstanceCommand.reference || geometryInstanceCommand.sources.some(ref => geometryRefsEqual(ref, geometryRefForItem(item)))) return true;
      }
      if (options.arcEndpoint) {
        return readOperands().some((operand) => operand.kind === "arc-endpoint" && sameArcEndpoint(operand, options.arcEndpoint));
      }
      return readOperands().some((operand) => operandElement(operand) === item);
    }

    function isReferenceHoverElement(item) {
      return Boolean(readConstraintCommand() && item && !isActiveSketchElement(item) && isReferenceSourceSketchId(elementSketchId(item)));
    }

    function isPendingReferenceTarget(item) {
      const target = readConstraintCommand()?.referenceTarget || readPending()?.referenceTarget;
      if (!target || !item) return false;
      if (target.kind === "point") return target.point === item;
      if (target.kind === "line") return target.line === item;
      if (target.kind === "primitive") return target.primitive === item;
      return false;
    }
    return Object.freeze({ isConstraintOperandSelected, isReferenceHoverElement, isPendingReferenceTarget });
  }
  function createSketchStyle({ sketchHasSolveError, elementSketchId, sketchRelationOfElement, constraintStatusOf, isVisibleSketchElement, isActiveSketchElement }) {
    function constraintStatusColor(item, selected = false, hovered = false) {
      if (selected) return "#1d4ed8";
      if (hovered) return "#3b82f6";
      if (sketchHasSolveError(elementSketchId(item))) return SKETCH_SOLVE_ERROR_COLOR;
      const relation = sketchRelationOfElement(item);
      if (relation !== "active") return INACTIVE_CONSTRAINT_STATUS_COLOR;
      const status = constraintStatusOf(item);
      if (status === "conflict") return CONSTRAINT_STATUS_COLORS.conflict;
      return CONSTRAINT_STATUS_COLORS[status] || CONSTRAINT_STATUS_COLORS.full;
    }

    function sketchStrokeWidth(item) {
      const relation = sketchRelationOfElement(item);
      if (relation === "active") return 2;
      if (relation === "reference" || relation === "descendant" || relation === "inactive") return 1.2;
      return 0;
    }

    function drawOrderBySketch(items) {
      return items.filter(isVisibleSketchElement).sort((a, b) => Number(isActiveSketchElement(a)) - Number(isActiveSketchElement(b)));
    }

    function sketchAlpha(item) {
      const relation = sketchRelationOfElement(item);
      if (relation === "active") return 1;
      if (relation === "reference" || relation === "descendant" || relation === "inactive") return 1;
      return 0;
    }
    return Object.freeze({ constraintStatusColor, sketchStrokeWidth, drawOrderBySketch, sketchAlpha });
  }
  window.GeometryPresentation = Object.freeze({ create, createLineDisplay, createCommandTargets, createSketchStyle, INACTIVE_CONSTRAINT_STATUS_COLOR });
})();
