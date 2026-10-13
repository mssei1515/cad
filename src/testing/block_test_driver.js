/* Browser-test Block creation fixtures and observations delegate model, command and solver state to product owners. */
(() => {
  "use strict";
  function createCreationFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, VerticalConstraint, canvasSelection, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-60, -30, false, "endpoint");
      const p2 = addPoint(60, -30, false, "endpoint");
      const p3 = addPoint(60, 30, false, "endpoint");
      const p4 = addPoint(-60, 30, false, "endpoint");
      const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)];
      pushModelConstraint(new HorizontalConstraint(lines[0]));
      pushModelConstraint(new VerticalConstraint(lines[1]));
      pushModelConstraint(new HorizontalConstraint(lines[2]));
      pushModelConstraint(new VerticalConstraint(lines[3]));
      canvasSelection.set("lines", lines.slice());
      fitAllGeometryToViewport(220);
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const origin = worldToCanvasScreen({ x: 0, y: 0 });
      return { origin: { x: rect.left + origin.x, y: rect.top + origin.y } };
    }
    return Object.freeze({ reset });
  }

  function createEmptyFixture({ resetModelState, updateUI, draw, readDefinitionCount, currentScope }) {
    function reset() {
      resetModelState();
      updateUI();
      draw();
      return { definitions: readDefinitionCount(), lines: currentScope().lines.length };
    }
    return Object.freeze({ reset });
  }

  function createRotationObservation({ blockInstanceById, currentScope, blockInstanceDisplayCenter, readSolverVariables, buildDragSession }) {
    function state(instanceId = null) {
      const instance = instanceId ? blockInstanceById(instanceId) : currentScope().blockInstances[0];
      if (!instance) return null;
      const center = blockInstanceDisplayCenter(instance);
      const variables = readSolverVariables().filter((variable) => variable.object === instance).map((variable) => variable.prop).sort();
      return {
        id: instance.id,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: Boolean(instance.fixed),
        rotationLocked: Boolean(instance.rotationLocked),
        displayCenter: { x: center.x, y: center.y },
        solverVariables: variables,
        translationSessionAvailable: Boolean(buildDragSession("block", instance, center)),
        rotationSessionAvailable: Boolean(buildDragSession("block-rotation", instance, center)),
      };
    }
    return Object.freeze({ state });
  }

  function createEndpointObservation({ currentScope, blockProjectionBundle, worldToCanvasScreen, canvas }) {
    function position() {
      const instance = currentScope().blockInstances[0];
      const point = instance ? blockProjectionBundle(instance).lines[0]?.p1 : null;
      if (!point) return null;
      const screen = worldToCanvasScreen(point);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + screen.x, y: rect.top + screen.y, id: point.id };
    }
    return Object.freeze({ position });
  }

  function createHoverObservation({ constraintTargetSession, canvasHover }) {
    function state() {
      return {
        command: constraintTargetSession.command?.type || null,
        blockInstanceId: canvasHover.current.block?.id || null,
        pointId: canvasHover.current.point?.id || null,
        pointIsBlockProjection: Boolean(canvasHover.current.point?.blockProjection),
        lineId: canvasHover.current.line?.id || null,
        arcEndpointId: canvasHover.current.arcEndpoint ? `${canvasHover.current.arcEndpoint.arc.id}.${canvasHover.current.arcEndpoint.endpoint}` : null,
      };
    }
    return Object.freeze({ state });
  }

  function createEditorObservation({ blockEditor, blockEditorSessionChain, currentScope }) {
    function state() {
      return {
        editing: Boolean(blockEditor.current),
        depth: blockEditorSessionChain().length,
        isNew: Boolean(blockEditor.current?.isNew),
        name: blockEditor.current?.draft?.name || null,
        sketches: currentScope().sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
        activeSketchId: currentScope().activeSketchId,
        hostLineCount: blockEditor.current?.original?.values.lines?.length || 0,
        hostBlockInstanceCount: blockEditor.current?.original?.values.blockInstances?.length || 0,
        editorLineCount: currentScope().lines.length,
        editorBlockInstances: currentScope().blockInstances.map((instance) => ({ id: instance.id, definitionId: instance.definitionId, x: instance.x, y: instance.y, rotation: instance.rotation, rotationLocked: Boolean(instance.rotationLocked) })),
      };
    }
    return Object.freeze({ state });
  }

  function createPlacementAction({ readMode, blockPlacementCommand, commitBlockPlacement }) {
    function commit(anchor, rotation = 0) {
      if (readMode() !== "block-place" || !blockPlacementCommand.definitionId) return null;
      blockPlacementCommand.setAnchor({ x: Number(anchor?.x) || 0, y: Number(anchor?.y) || 0 });
      const instance = commitBlockPlacement(Number(rotation) || 0);
      return instance ? { id: instance.id, definitionId: instance.definitionId, x: instance.x, y: instance.y, rotation: instance.rotation, rotationLocked: Boolean(instance.rotationLocked) } : null;
    }
    return Object.freeze({ commit });
  }

  function createNestedConstraintAction({ currentScope, blockProjectionBundle, HorizontalConstraint, VerticalConstraint, pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, recordHistory, updateUI, draw, serializeConstraint }) {
    function constrain(type = "vertical") {
      const instance = currentScope().blockInstances[0];
      const line = instance ? blockProjectionBundle(instance).lines[0] : null;
      if (!line) return null;
      const constraint = type === "horizontal" ? new HorizontalConstraint(line) : new VerticalConstraint(line);
      pushModelConstraint(constraint, instance.sketchId);
      const result = solveSketchById(instance.sketchId);
      invalidateBlockProjectionCache(instance.id);
      recordHistory("入れ子ブロック拘束");
      updateUI();
      draw();
      return { success: result.success, errorNorm: result.errorNorm, line: serializeConstraint(constraint).line };
    }
    return Object.freeze({ constrain });
  }

  function createChildGeometryAction({ blockEditor, createSketch, activeSketchId, addLine, addPoint, recordHistory, updateUI, draw, currentScope }) {
    function add() {
      if (!blockEditor.current) return null;
      createSketch("child");
      const sketchId = activeSketchId();
      addLine(addPoint(-20, 50, false, "endpoint"), addPoint(20, 50, false, "endpoint"));
      recordHistory("ブロック内図形追加");
      updateUI();
      draw();
      return { sketchId, sketches: currentScope().sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId })), lineCount: currentScope().lines.length };
    }
    return Object.freeze({ add });
  }

  function createCancelAction({ cancelBlockDefinitionEdit, blockEditor, readDefinitionCount, currentScope }) {
    function cancel() {
      cancelBlockDefinitionEdit();
      return { editing: Boolean(blockEditor.current), definitions: readDefinitionCount(), instances: currentScope().blockInstances.length, lines: currentScope().lines.length };
    }
    return Object.freeze({ cancel });
  }

  function createCompleteAction({ completeBlockDefinitionEdit, blockEditor, readDefinitionCount, currentScope }) {
    function complete() {
      completeBlockDefinitionEdit({ rotationLocked: true });
      return { editing: Boolean(blockEditor.current), definitions: readDefinitionCount(), instances: currentScope().blockInstances.length };
    }
    return Object.freeze({ complete });
  }

  function createEnabledSketchAction({ currentScope, setBlockInstanceEnabledSketchIds }) {
    function set(ids) {
      const instance = currentScope().blockInstances[0];
      if (!instance) return false;
      return setBlockInstanceEnabledSketchIds(instance, ids);
    }
    return Object.freeze({ set });
  }

  function createRejectionFixture({ resetModelState, addPoint, addLine, canvasSelection, blockSelectionGeometry, readDefinitionCount, currentScope, activeSketchId, geometryRefForItem }) {
    function cases() {
      resetModelState();
      const p1 = addPoint(0, 0, false, "endpoint");
      const p2 = addPoint(60, 0, false, "endpoint");
      const p3 = addPoint(100, 30, false, "endpoint");
      const selectedLine = addLine(p1, p2);
      addLine(p2, p3);
      canvasSelection.set("lines", [selectedLine]);
      const sharedPointError = blockSelectionGeometry().error || null;
      const sharedCounts = { definitions: readDefinitionCount(), instances: currentScope().blockInstances.length, lines: currentScope().lines.length };

      resetModelState();
      const line = addLine(addPoint(0, 0, false, "endpoint"), addPoint(60, 0, false, "endpoint"));
      currentScope().annotations.push({
        id: "AN-block-ref",
        type: "leader",
        visible: true,
        sketchId: activeSketchId(),
        geometryRef: geometryRefForItem(line),
        start: { x: 0, y: 0 },
        end: { x: 30, y: 20 },
        style: {},
      });
      canvasSelection.set("lines", [line]);
      const annotationError = blockSelectionGeometry().error || null;
      return {
        sharedPointError,
        sharedCounts,
        annotationError,
        annotationCounts: { definitions: readDefinitionCount(), instances: currentScope().blockInstances.length, lines: currentScope().lines.length },
      };
    }
    return Object.freeze({ cases });
  }

  window.BlockTestDriver = Object.freeze({ createCreationFixture, createEmptyFixture, createRotationObservation, createEndpointObservation, createHoverObservation, createEditorObservation, createPlacementAction, createNestedConstraintAction, createChildGeometryAction, createCancelAction, createCompleteAction, createEnabledSketchAction, createRejectionFixture });
})();
