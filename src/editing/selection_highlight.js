/* Shared sidebar hover and geometry relationships for selection presentation. */
(() => {
  "use strict";
  function create({ canvasSelection, blockProjectionBundle, geometryRefsEqual, geometryRefForItem,
    constraintGraphNodes, constraintHighlightNodes, effectiveSelectedConstraint, targetFromConstraint,
    getHoveredDimension, setHoveredDimension, draw }) {
    let hoveredSidebarItem = null;
    function sameConstraintDisplayElement(a, b) {
      if (a === b) return true;
      if (!a?.blockProjection || !b?.blockProjection) return false;
      return geometryRefsEqual(geometryRefForItem(a), geometryRefForItem(b));
    }

    function isSidebarHoveredElement(item) {
      if (!item || !hoveredSidebarItem?.elements) return false;
      if (hoveredSidebarItem.elements.has(item)) return true;
      return [...hoveredSidebarItem.elements].some((element) => sameConstraintDisplayElement(element, item));
    }

    function isSelectedConstraintRelatedElement(item) {
      const constraint = effectiveSelectedConstraint();
      return Boolean(constraint && constraintHighlightNodes(constraint).some((element) => sameConstraintDisplayElement(element, item)));
    }

    function selectedConstraintReferenceElements() {
      const elements = new Set(canvasSelection.points);
      for (const line of canvasSelection.lines) {
        elements.add(line);
        elements.add(line.p1);
        elements.add(line.p2);
      }
      for (const circle of canvasSelection.circles) {
        elements.add(circle);
        elements.add(circle.center);
      }
      for (const arc of canvasSelection.arcs) {
        elements.add(arc);
        elements.add(arc.center);
      }
      for (const spline of canvasSelection.splines) {
        elements.add(spline);
        for (const point of spline.fitPoints) elements.add(point);
      }
      if (canvasSelection.arcEndpoint) {
        elements.add(canvasSelection.arcEndpoint.arc);
        elements.add(canvasSelection.arcEndpoint.arc.center);
      }
      for (const endpoint of canvasSelection.arcEndpointPair || []) {
        elements.add(endpoint.arc);
        elements.add(endpoint.arc.center);
      }
      for (const instance of canvasSelection.blockInstances) {
        elements.add(instance);
        const bundle = blockProjectionBundle(instance);
        for (const item of [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]) elements.add(item);
      }
      return [...elements];
    }

    function constraintDirectlyReferencesCanvasSelection(constraint, selectedElements = selectedConstraintReferenceElements()) {
      if (!constraint || selectedElements.length === 0) return false;
      return constraintGraphNodes(constraint).some((node) => selectedElements.some((selected) => sameConstraintDisplayElement(node, selected)));
    }

    function sidebarHoverElementsForItem(item) {
      const elements = new Set();
      if (!item) return elements;
      elements.add(item);
      return elements;
    }

    function sidebarHoverElementsForConstraint(constraint) {
      if (constraint && targetFromConstraint(constraint)) return new Set();
      return new Set(constraint ? constraintHighlightNodes(constraint).filter(Boolean) : []);
    }

    function setSidebarHover(type, item, elements) {
      hoveredSidebarItem = { type, item, elements };
      if (type === "constraint" && targetFromConstraint(item)) setHoveredDimension(item);
      draw();
    }

    function clearSidebarHover(type = null, item = null) {
      if (!hoveredSidebarItem) return;
      if (type && hoveredSidebarItem.type !== type) return;
      if (item && hoveredSidebarItem.item !== item) return;
      if (getHoveredDimension() === hoveredSidebarItem.item) setHoveredDimension(null);
      hoveredSidebarItem = null;
      draw();
    }

    function reset() { hoveredSidebarItem = null; }
    return Object.freeze({ reset, get current() { return hoveredSidebarItem; },
      sameConstraintDisplayElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement, selectedConstraintReferenceElements, constraintDirectlyReferencesCanvasSelection, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, setSidebarHover, clearSidebarHover });
  }
  window.SelectionHighlight = Object.freeze({ create });
})();
