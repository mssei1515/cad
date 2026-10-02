/* Shared sidebar hover and geometry relationships for selection presentation. */
(() => {
  "use strict";
  function create({ canvasSelection, blockProjectionBundle, geometryRefsEqual, geometryRefForItem,
    constraintGraphNodes, types, effectiveSelectedConstraint, targetFromConstraint,
    getHoveredDimension, setHoveredDimension, draw }) {
    const { Point, Line, Circle, Arc, Spline, OffsetChainConstraint } = types;
    let hoveredSidebarItem = null;
    function constraintDefiningGeometryEntries(constraint) {
      if (!constraint) return [];
      if (constraint instanceof OffsetChainConstraint) {
        return [
          ...constraint.sources.map((item, index) => ({ key: `source${index}`, labelJa: `基準図形${index + 1} ID`, labelEn: `Source geometry ${index + 1} ID`, item })),
          ...constraint.offsets.map((item, index) => ({ key: `offset${index}`, labelJa: `オフセット図形${index + 1} ID`, labelEn: `Offset geometry ${index + 1} ID`, item })),
        ];
      }
      const roles = [
        ["p1", "1つ目の点ID", "First point ID"],
        ["p2", "2つ目の点ID", "Second point ID"],
        ["point", "点ID", "Point ID"],
        ["line", "線ID", "Line ID"],
        ["circle", "円ID", "Circle ID"],
        ["line1", "1本目の線ID", "First line ID"],
        ["line2", "2本目の線ID", "Second line ID"],
        ["centerline", "中心線ID", "Centerline ID"],
        ["arc1", "1つ目の円弧ID", "First arc ID"],
        ["arc2", "2つ目の円弧ID", "Second arc ID"],
        ["source", "基準図形ID", "Source geometry ID"],
        ["target", "投影先図形ID", "Target geometry ID"],
        ["offset", "オフセット図形ID", "Offset geometry ID"],
        ["arc", "円弧ID", "Arc ID"],
        ["primitive", "図形ID", "Geometry ID"],
        ["geometry", "図形ID", "Geometry ID"],
        ["spline", "スプラインID", "Spline ID"],
        ["a", "1つ目の図形ID", "First geometry ID"],
        ["b", "2つ目の図形ID", "Second geometry ID"],
        ["axis", "対称軸ID", "Symmetry axis ID"],
      ];
      return roles
        .map(([key, labelJa, labelEn]) => ({ key, labelJa, labelEn, item: constraint[key] }))
        .filter(({ item }) => item instanceof Point || item instanceof Line || item instanceof Circle || item instanceof Arc || item instanceof Spline);
    }

    function constraintHighlightNodes(constraint) {
      const entries = constraintDefiningGeometryEntries(constraint);
      const directPoints = new Set(entries.map(({ item }) => item).filter((item) => item instanceof Point));
      const lineEndpoints = new Set();
      for (const { item } of entries) {
        if (!(item instanceof Line)) continue;
        lineEndpoints.add(item.p1);
        lineEndpoints.add(item.p2);
      }
      return constraintGraphNodes(constraint).filter((item) => !lineEndpoints.has(item) || directPoints.has(item));
    }

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
      constraintDefiningGeometryEntries, constraintHighlightNodes, sameConstraintDisplayElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement, selectedConstraintReferenceElements, constraintDirectlyReferencesCanvasSelection, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, setSidebarHover, clearSidebarHover });
  }
  window.SelectionHighlight = Object.freeze({ create });
})();
