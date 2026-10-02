/* Resolve geometry paint policy without drawing or changing interaction state. */
(() => {
  "use strict";
  function create({ Point, canvasSelection, canvasHover, viewState,
    effectiveAppearanceForElement, isEditableSketchElement, isConstraintOperandSelected, isPendingReferenceTarget,
    isSidebarHighlightedElement, isSidebarHoveredElement, isReferenceHoverElement, isSelectedConstraintRelatedElement,
    sketchAlpha, sketchStrokeWidth, constraintStatusColor, canvasThemeColor, constructionAlpha }) {
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
    return Object.freeze({ geometryDisplayColor, geometryStrokeWidth, ownerInstanceSelected, ownerInstanceHovered, geometryPaintState });
  }
  window.GeometryPresentation = Object.freeze({ create });
})();
