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

  window.BlockTestDriver = Object.freeze({ createCreationFixture, createEmptyFixture, createRotationObservation, createEndpointObservation, createHoverObservation });
})();
