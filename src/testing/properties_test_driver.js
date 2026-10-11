/* Browser property fixtures and observations; existing owners retain appearance and edit rules. */
(() => {
  "use strict";
  function createAppearanceObservation({ allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, blockInstanceById, blockProjectionBundle, normalizeAppearance, effectiveAppearanceForElement, isVisibleSketchElement }) {
    function appearance(kind, id) {
      let item = null;
      if (kind === "point") item = allGeometryPoints().find((value) => value.id === id);
      if (kind === "line") item = allGeometryLines().find((value) => value.id === id);
      if (kind === "circle") item = allGeometryCircles().find((value) => value.id === id);
      if (kind === "arc") item = allGeometryArcs().find((value) => value.id === id);
      if (kind === "spline") item = allGeometrySplines().find((value) => value.id === id);
      if (kind === "block") {
        const instance = blockInstanceById(id);
        item = instance ? [...blockProjectionBundle(instance).lines, ...blockProjectionBundle(instance).circles, ...blockProjectionBundle(instance).arcs, ...(blockProjectionBundle(instance).splines || [])][0] : null;
      }
      return item ? { direct: normalizeAppearance(item.appearance), effective: effectiveAppearanceForElement(item), visible: isVisibleSketchElement(item) } : null;
    }
    return Object.freeze({ appearance });
  }

  function createFixture({ resetModelState, clearSelection, addPoint, addLine, addCircle, canvasSelection, currentScope, ROOT_SKETCH_ID, resetHistory, updateUI, draw }) {
    function resetProperties(mixedTypes = false) {
      resetModelState();
      clearSelection();
      const lines = [
        addLine(addPoint(-80, -20, false, "endpoint"), addPoint(-20, -20, false, "endpoint")),
        addLine(addPoint(20, 20, false, "endpoint"), addPoint(80, 20, false, "endpoint")),
      ];
      lines[0].appearance = { color: "#dc2626", lineType: "solid", lineWidth: 1 };
      lines[1].appearance = { color: "#2563eb", lineType: "dotted", lineWidth: 3 };
      canvasSelection.set("lines", mixedTypes ? [lines[0]] : lines);
      if (mixedTypes) {
        const circle = addCircle(addPoint(0, 65, false, "endpoint"), 20);
        circle.appearance = { color: "#16a34a", lineType: "dashed", lineWidth: 4 };
        canvasSelection.set("circles", [circle]);
      }
      resetHistory("multiple properties test");
      updateUI();
      draw();
      return { ids: lines.map((line) => line.id) };
    }

    function resetFixed() {
      resetModelState();
      currentScope().sketches.push({ id: "S2", name: "Batch Fix", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} });
      currentScope().activeSketchId = "S2";
      const p1 = addPoint(-60, -20, false, "endpoint");
      const p2 = addPoint(-10, -20, false, "endpoint");
      const p3 = addPoint(10, 20, false, "endpoint");
      const p4 = addPoint(60, 20, false, "endpoint");
      const point = addPoint(0, 70, false, "explicit");
      const lines = [addLine(p1, p2), addLine(p3, p4)];
      clearSelection();
      canvasSelection.set("points", [point]);
      canvasSelection.set("lines", lines);
      resetHistory("multiple fixed test");
      updateUI();
      draw();
      return { pointId: point.id, lineIds: lines.map((line) => line.id) };
    }
    return Object.freeze({ resetProperties, resetFixed });
  }

  function createPropertiesObservation({ selectedPropertiesTarget, canvasSelection, normalizeAppearance, effectiveAppearanceForElement, document, readHistory }) {
    function state() {
      return {
        targetKind: selectedPropertiesTarget().kind,
        lines: canvasSelection.lines.map((line) => ({ id: line.id, construction: line.construction, appearance: normalizeAppearance(line.appearance), effective: effectiveAppearanceForElement(line) })),
        circles: canvasSelection.circles.map((circle) => ({ id: circle.id, construction: circle.construction, appearance: normalizeAppearance(circle.appearance), effective: effectiveAppearanceForElement(circle) })),
        propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
        history: readHistory(),
      };
    }
    return Object.freeze({ state });
  }

  function createFixedObservation({ currentScope, elementSketchId, findLineFixedConstraint, LineFixedConstraint, fixPointBtn, readHistory }) {
    function state() {
      const sketchPoints = currentScope().points.filter((point) => elementSketchId(point) === "S2");
      const sketchLines = currentScope().lines.filter((line) => elementSketchId(line) === "S2");
      return {
        fixedPointIds: sketchPoints.filter((point) => point.fixed).map((point) => point.id),
        fixedLineIds: sketchLines.filter((line) => findLineFixedConstraint(line)).map((line) => line.id),
        constraintCount: currentScope().constraints.filter((constraint) => constraint instanceof LineFixedConstraint).length,
        buttonDisabled: fixPointBtn.getAttribute("aria-disabled"),
        history: readHistory(),
      };
    }
    return Object.freeze({ state });
  }
  function createHoverObservation({ allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, blockInstanceById, blockProjectionBundle, effectiveAppearanceForElement, isSidebarHighlightedElement, Point, isAnyLineEndpoint, isSidebarHoveredElement, canvasHover, geometryDisplayColor, geometryStrokeWidth }) {
    function state(kind, id) {
      let item = null;
      if (kind === "point") item = allGeometryPoints().find((value) => value.id === id);
      if (kind === "line") item = allGeometryLines().find((value) => value.id === id);
      if (kind === "circle") item = allGeometryCircles().find((value) => value.id === id);
      if (kind === "arc") item = allGeometryArcs().find((value) => value.id === id);
      if (kind === "spline") item = allGeometrySplines().find((value) => value.id === id);
      if (kind === "block") {
        const instance = blockInstanceById(id);
        item = instance ? blockProjectionBundle(instance).lines[0] || blockProjectionBundle(instance).circles[0] || blockProjectionBundle(instance).arcs[0] || blockProjectionBundle(instance).splines?.[0] : null;
      }
      if (!item) return null;
      const appearance = effectiveAppearanceForElement(item);
      const treeHovered = isSidebarHighlightedElement(item) && (!(item instanceof Point) || (!item.blockProjection && !isAnyLineEndpoint(item)));
      const sidebarHovered = isSidebarHoveredElement(item);
      const canvasHovered = canvasHover.current.line === item || canvasHover.current.circle === item || canvasHover.current.arc === item || canvasHover.current.spline === item || canvasHover.current.point === item || canvasHover.current.endpointPoint === item;
      const blockHovered = Boolean(item.blockInstance && canvasHover.current.block === item.blockInstance);
      const hovered = treeHovered || sidebarHovered || canvasHovered || blockHovered;
      return {
        treeHovered,
        sidebarHovered,
        canvasHovered,
        blockHovered,
        color: geometryDisplayColor(item, appearance, false, hovered),
        width: geometryStrokeWidth(item, { hovered, appearance, construction: Boolean(item.construction) }),
      };
    }
    return Object.freeze({ state });
  }

  window.PropertiesTestDriver = Object.freeze({ createAppearanceObservation, createFixture, createPropertiesObservation, createFixedObservation, createHoverObservation });
})();
