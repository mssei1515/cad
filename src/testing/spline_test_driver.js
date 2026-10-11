/* Spline browser-test setup and observations through explicit application ports. */
(() => {
  "use strict";
  function create({ resetModelState, viewport, resizeCanvas, resetHistory, updateUI, draw, canvas,
    worldToCanvasScreen, serializeModel, readOperation, canvasSelection, document, addPoint, addSpline, hatchGeometryQuery, readSpline, splineGeometry, addLine,
    PointOnSplineConstraint, SplineLineTangentConstraint, pushModelConstraint, solveAndRefresh, serializeConstraint }) {
    function reset() {
      resetModelState();
      viewport.update({ scale: 2 });
      resizeCanvas({ centerWorld: { x: 0, y: 0 } });
      resetHistory("spline test");
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const client = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        clients: [
          client({ x: -90, y: 20 }),
          client({ x: -30, y: -45 }),
          client({ x: 30, y: 45 }),
          client({ x: 90, y: -20 }),
        ],
        serialized: serializeModel(),
      };
    }
    function state() {
      const serialized = serializeModel();
      const { mode, editSplineId } = readOperation();
      return {
        mode,
        editSplineId,
        direct: serialized.splines,
        selectedIds: canvasSelection.splines.map((spline) => spline.id),
        selectedPointIds: canvasSelection.points.map((point) => point.id),
        treeRows: document.querySelectorAll('#sketchList [data-object-kind="spline"]').length,
        propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
        serialized,
      };
    }
    function hatchPreviewCache() {
      resetModelState();
      const points = [
        addPoint(0, 0, false, "endpoint"), addPoint(100, 0, false, "endpoint"),
        addPoint(100, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
      ];
      const spline = addSpline(points, true, false);
      const seed = { x: 50, y: 40 };
      const before = hatchGeometryQuery.hatchFaceAt(seed);
      points[1].x = 180;
      points[2].x = 180;
      const after = hatchGeometryQuery.hatchFaceAt(seed);
      const maxX = (result) => result?.ok
        ? Math.max(...result.resolved.loops.flatMap((loop) => loop.points.map((point) => point.x)))
        : null;
      return { splineId: spline?.id || null, beforeOk: Boolean(before?.ok), afterOk: Boolean(after?.ok), beforeMaxX: maxX(before), afterMaxX: maxX(after) };
    }
    function exerciseConstraints() {
      const spline = readSpline();
      if (!spline || spline.closed) return null;
      const parameter = 0.4;
      const curvePoint = splineGeometry.evaluate(spline.curve(), parameter);
      const point = addPoint(curvePoint.x, curvePoint.y, false, "explicit");
      const pointOnSpline = pushModelConstraint(new PointOnSplineConstraint(point, spline, parameter));
      const endpoint = spline.fitPoints[0];
      const tangent = splineGeometry.derivative(spline.curve(), 0);
      const tangentLength = Math.hypot(tangent.x, tangent.y);
      const line = addLine(endpoint, addPoint(endpoint.x + tangent.x * 60 / tangentLength, endpoint.y + tangent.y * 60 / tangentLength, false, "endpoint"));
      const splineLineTangent = pushModelConstraint(new SplineLineTangentConstraint(spline, "start", line));
      const result = solveAndRefresh("spline constraint test");
      const serialized = serializeModel();
      return {
        success: result?.success !== false,
        types: serialized.constraints.filter((item) => ["pointOnSpline", "splineLineTangent"].includes(item.type)).map((item) => item.type),
        pointOnSpline: serializeConstraint(pointOnSpline),
        splineLineTangent: serializeConstraint(splineLineTangent),
        serialized,
      };
    }
    return Object.freeze({ reset, state, hatchPreviewCache, exerciseConstraints });
  }
  // Transfer fixtures have Clipboard / Block ports independent from setup and constraint fixtures.
  function createTransfer({ currentScope, splineGeometry, annotationLeaderTargetFromItem, nextAnnotationId,
    activeSketchId, defaultAnnotationStyle, clearSelection, canvasSelection, copyableSelectionPayload, clipboardSession,
    pasteGeometryClipboard, blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter,
    appendDefinition, nextInstanceId, blockDefinitionDrawableSketchIds, invalidateBlockProjectionCache, blockProjectionBundle, updateUI, draw }) {
    function exercise() {
      const source = currentScope().splines[0] || null;
      if (!source) return null;
      const leaderTarget = annotationLeaderTargetFromItem(source, splineGeometry.evaluate(source.curve(), 0.5));
      const annotation = leaderTarget ? {
        id: nextAnnotationId(),
        type: "leader",
        visible: true,
        sketchId: activeSketchId(),
        geometryRef: leaderTarget.geometryRef,
        start: { ...leaderTarget.anchor },
        elbow: { x: leaderTarget.anchor.x + 30, y: leaderTarget.anchor.y - 20 },
        end: { x: leaderTarget.anchor.x + 80, y: leaderTarget.anchor.y - 20 },
        x: leaderTarget.anchor.x + 55,
        y: leaderTarget.anchor.y - 28,
        text: "Spline",
        style: { ...defaultAnnotationStyle },
      } : null;
      if (annotation) currentScope().annotations.push(annotation);
      clearSelection();
      canvasSelection.set("splines", [source]);
      canvasSelection.set("annotations", annotation ? [annotation] : []);
      const payload = copyableSelectionPayload();
      clipboardSession.replaceForDiagnostics(payload);
      const pasted = payload && pasteGeometryClipboard() ? currentScope().splines.find((item) => item !== source) : null;
      const sourceAnnotation = annotation ? currentScope().annotations.find((item) => item.id === annotation.id) || null : null;
      const pastedAnnotation = annotation ? currentScope().annotations.find((item) => item.id !== annotation.id) || null : null;

      clearSelection();
      canvasSelection.set("splines", [currentScope().splines.find((item) => item.id === source.id) || source]);
      canvasSelection.set("annotations", sourceAnnotation ? [sourceAnnotation] : []);
      const selection = blockSelectionGeometry();
      const definition = selection.error ? null : createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Spline Transfer");
      if (definition) appendDefinition(definition);
      const instance = definition ? {
        id: nextInstanceId(),
        definitionId: definition.id,
        sketchId: activeSketchId(),
        x: 240,
        y: 80,
        rotation: Math.PI / 4,
        fixed: false,
        rotationLocked: false,
        enabledSketchIds: blockDefinitionDrawableSketchIds(definition),
        appearanceOverride: {},
      } : null;
      if (instance) currentScope().blockInstances.push(instance);
      invalidateBlockProjectionCache();
      const projected = instance ? blockProjectionBundle(instance).splines?.[0] || null : null;
      updateUI();
      draw();
      return {
        copied: Boolean(payload),
        pasted: pasted ? { id: pasted.id, fitPoints: pasted.fitPoints.map((point) => point.id) } : null,
        leader: annotation ? { id: annotation.id, kind: annotation.geometryRef.kind, pastedId: pastedAnnotation?.id || null } : null,
        blockError: selection.error || null,
        definition: definition ? { id: definition.id, splineCount: definition.splines.length, pointCount: definition.points.length, annotationCount: definition.annotations.length } : null,
        projection: projected ? { id: projected.id, ownerId: projected.blockInstance?.id || null, fitPointCount: projected.fitPoints.length, annotationCount: blockProjectionBundle(instance).annotations.length } : null,
      };
    }
    return Object.freeze({ exercise });
  }
  window.SplineTestDriver = Object.freeze({ create, createTransfer });
})();
