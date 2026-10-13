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

  function createInspectionFixture({ resetModelState, addPoint, addLine, addCircle, addArc, pushModelConstraint, HorizontalConstraint, DistanceConstraint, dimensionFromAnchor, assignConstraintSketchId, activeSketchId, currentScope, updateUI, fitAllGeometryToViewport, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-80, 0, true, "endpoint");
      const p2 = addPoint(20, 0, false, "endpoint");
      const line = addLine(p1, p2);
      const circleCenter = addPoint(80, 0, false, "endpoint");
      const circle = addCircle(circleCenter, 28);
      const arcCenter = addPoint(0, 80, false, "endpoint");
      const arc = addArc(arcCenter, 32, Math.PI, Math.PI * 1.75);
      const horizontal = pushModelConstraint(new HorizontalConstraint(line));
      horizontal.reference = true;
      const readOnly = new DistanceConstraint(p1, p2, line.length());
      readOnly.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: line.length() }, { x: -30, y: -28 });
      readOnly.readOnlyDimension = true;
      readOnly.enabled = false;
      assignConstraintSketchId(readOnly, activeSketchId());
      currentScope().constraints.push(readOnly);
      updateUI();
      fitAllGeometryToViewport(140);
      draw();
      const rect = canvas.getBoundingClientRect();
      const lineMid = worldToCanvasScreen({ x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 });
      return {
        line: line.id,
        lineEndpoints: [p1.id, p2.id],
        fixedPoint: p1.id,
        circle: circle.id,
        circleCenter: circleCenter.id,
        arc: arc.id,
        arcCenter: arcCenter.id,
        lineMid: { x: rect.left + lineMid.x, y: rect.top + lineMid.y },
        blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 },
      };
    }
    return Object.freeze({ reset });
  }

  function createStrokeStyleCases({ resetModelState, addLine, addPoint, currentScope, rootSketchId, defaultSketchId, geometryStrokeWidth, constructionAlpha }) {
    function cases() {
      resetModelState();
      const activeNormal = addLine(addPoint(-80, -25, false, "endpoint"), addPoint(80, -25, false, "endpoint"));
      const activeConstruction = addLine(addPoint(-80, 25, false, "endpoint"), addPoint(80, 25, false, "endpoint"), true);
      currentScope().sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: rootSketchId, kind: "sketch", visible: true });
      currentScope().activeSketchId = "S2";
      const inactiveNormal = addLine(addPoint(-80, 75, false, "endpoint"), addPoint(80, 75, false, "endpoint"));
      const inactiveConstruction = addLine(addPoint(-80, 125, false, "endpoint"), addPoint(80, 125, false, "endpoint"), true);
      currentScope().activeSketchId = defaultSketchId;
      return {
        activeNormal: geometryStrokeWidth(activeNormal),
        activeConstruction: geometryStrokeWidth(activeConstruction, { construction: true }),
        inactiveNormal: geometryStrokeWidth(inactiveNormal),
        inactiveConstruction: geometryStrokeWidth(inactiveConstruction, { construction: true }),
        selected: geometryStrokeWidth(activeNormal, { selected: true }),
        hovered: geometryStrokeWidth(activeNormal, { hovered: true }),
        constructionAlpha: constructionAlpha,
      };
    }
    return Object.freeze({ cases });
  }

  function createHighlightObservation({ canvasSelection, effectiveSelectedConstraint, constraintHighlightNodes, selectionHighlight, canvasHover }) {
    function ids() {
      const ids = new Set();
      for (const point of canvasSelection.points) ids.add(point.id);
      for (const line of canvasSelection.lines) {
        ids.add(line.id);
        ids.add(line.p1.id);
        ids.add(line.p2.id);
      }
      for (const circle of canvasSelection.circles) {
        ids.add(circle.id);
        ids.add(circle.center.id);
      }
      for (const arc of canvasSelection.arcs) {
        ids.add(arc.id);
        ids.add(arc.center.id);
      }
      for (const spline of canvasSelection.splines) ids.add(spline.id);
      const constraint = effectiveSelectedConstraint() || canvasSelection.dimensionConstraint;
      if (constraint) {
        for (const item of constraintHighlightNodes(constraint)) {
          if (item?.id) ids.add(item.id);
        }
      }
      for (const item of selectionHighlight.current?.elements || []) {
        if (item?.id) ids.add(item.id);
      }
      if (canvasHover.current.dimension) {
        for (const item of constraintHighlightNodes(canvasHover.current.dimension)) {
          if (item?.id) ids.add(item.id);
        }
      }
      return [...ids].sort();
    }
    return Object.freeze({ ids });
  }

  function createHoverKeyObservation({ allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, isSidebarHoveredElement, geometryElementKey }) {
    function keys() {
      return [...allGeometryPoints(), ...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs(), ...allGeometrySplines()]
        .filter(isSidebarHoveredElement)
        .map(geometryElementKey)
        .sort();
    }
    return Object.freeze({ keys });
  }

  function createThemeObservation({ applicationSettings, readDefaultGeometryColor, canvasThemeColor, CanvasThemeColors }) {
    function state() {
      return {
        theme: applicationSettings.theme,
        stored: applicationSettings.storedTheme(),
        defaultGeometryColor: readDefaultGeometryColor(),
        displayedDefaultGeometryColor: canvasThemeColor(readDefaultGeometryColor()),
        displayedDefaultGeometryContrast: applicationSettings.theme === "dark"
          ? CanvasThemeColors.contrast(CanvasThemeColors.channels(canvasThemeColor(readDefaultGeometryColor())), [15, 23, 42])
          : null,
      };
    }
    return Object.freeze({ state });
  }

  window.PropertiesTestDriver = Object.freeze({ createAppearanceObservation, createFixture, createPropertiesObservation, createFixedObservation, createHoverObservation, createInspectionFixture, createStrokeStyleCases, createHighlightObservation, createHoverKeyObservation, createThemeObservation });
})();
