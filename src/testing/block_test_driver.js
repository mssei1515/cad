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

  function createStateObservation({ blockProjectionBundles, readDefinitions, currentScope, canvasSelection, readMode, serializeModel }) {
    function state() {
      const bundles = blockProjectionBundles();
      return {
        definitions: readDefinitions().map((definition) => ({
          id: definition.id,
          name: definition.name,
          parentDefinitionId: definition.parentDefinitionId || null,
          points: definition.points.length,
          lines: definition.lines.length,
          constraints: definition.constraints.length,
          blockInstances: (definition.blockInstances || []).map((instance) => ({
            id: instance.id,
            definitionId: instance.definitionId,
            sketchId: instance.sketchId,
            x: instance.x,
            y: instance.y,
            rotation: instance.rotation,
            fixed: Boolean(instance.fixed),
            rotationLocked: Boolean(instance.rotationLocked),
            enabledSketchIds: instance.enabledSketchIds.slice(),
          })),
          sketches: definition.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
          activeSketchId: definition.activeSketchId,
          origin: { ...definition.origin },
        })),
        instances: currentScope().blockInstances.map((instance) => ({
          id: instance.id,
          definitionId: instance.definitionId,
          sketchId: instance.sketchId,
          x: instance.x,
          y: instance.y,
          rotation: instance.rotation,
          fixed: instance.fixed,
          rotationLocked: Boolean(instance.rotationLocked),
          enabledSketchIds: instance.enabledSketchIds.slice(),
        })),
        projectionLineIds: bundles.flatMap((bundle) => bundle.lines.map((line) => line.id)),
        selectedInstanceIds: canvasSelection.blockInstances.map((instance) => instance.id),
        mode: readMode(),
        serialized: serializeModel(),
      };
    }
    return Object.freeze({ state });
  }

  function createReload({ serializeModel, loadModelData, updateUI, draw, readDefinitions, currentScope, allGeometryLines }) {
    function reload() {
      const data = serializeModel();
      loadModelData(data);
      updateUI();
      draw();
      return {
        definitions: readDefinitions().length,
        instances: currentScope().blockInstances.length,
        projectionLines: allGeometryLines().filter((line) => line.blockProjection).length,
        serializedVersion: serializeModel().version,
      };
    }
    return Object.freeze({ reload });
  }

  function createLegacyReload({ serializeModel, loadModelData, updateUI, draw, readDefinitions, currentScope, blockProjectionBundle }) {
    function reload() {
      const data = JSON.parse(JSON.stringify(serializeModel()));
      data.version = 7;
      for (const definition of data.blockDefinitions || []) {
        delete definition.origin;
        delete definition.sketches;
        delete definition.activeSketchId;
        for (const item of [...(definition.points || []), ...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || []), ...(definition.splines || []), ...(definition.constraints || [])]) {
          delete item.sketchId;
        }
        for (const instance of definition.blockInstances || []) delete instance.rotationLocked;
      }
      for (const instance of data.blockInstances || []) {
        delete instance.enabledSketchIds;
        delete instance.rotationLocked;
      }
      loadModelData(data);
      updateUI();
      draw();
      const definition = readDefinitions()[0];
      const instance = currentScope().blockInstances[0];
      return {
        version: serializeModel().version,
        sketches: definition?.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId, kind: sketch.kind })) || [],
        origin: definition ? { ...definition.origin } : null,
        elementSketchIds: definition ? [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...(definition.splines || [])].map((item) => item.sketchId) : [],
        enabledSketchIds: instance?.enabledSketchIds.slice() || [],
        rotationLocked: Boolean(instance?.rotationLocked),
        projectionLineIds: instance ? blockProjectionBundle(instance).lines.map((line) => line.id) : [],
      };
    }
    return Object.freeze({ reload });
  }

  function createDefinitionUpdateFixture({ readDefinitions, currentScope, blockProjectionBundle, enterBlockDefinitionEdit, blockEditor, completeBlockDefinitionEdit }) {
    function run() {
      const definition = readDefinitions()[0];
      if (!definition || currentScope().blockInstances.length === 0) return null;
      const before = blockProjectionBundle(currentScope().blockInstances[0]).lines[0].length();
      enterBlockDefinitionEdit(definition.id);
      const editableLine = blockEditor.current.draft.lines[0];
      editableLine.p2.x += 40;
      completeBlockDefinitionEdit({ rotationLocked: true });
      const lengths = currentScope().blockInstances.map((instance) => blockProjectionBundle(instance).lines[0].length());
      return { before, lengths, revision: definition.revision, editing: Boolean(blockEditor.current) };
    }
    return Object.freeze({ run });
  }

  function createReadOnlyDimensionFixture({ currentScope, blockProjectionBundle, defaultDimensionForTarget, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint }) {
    function run() {
      const instance = currentScope().blockInstances[0];
      if (!instance) return null;
      const line = blockProjectionBundle(instance).lines[0];
      const target = { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
      const dimension = defaultDimensionForTarget(target);
      const constraint = readOnlyDimensionConstraintForPlacement(target, target.value, dimension, { sketchId: instance.sketchId });
      if (!constraint) return { created: false };
      addReadOnlyDimensionConstraint(constraint, instance.sketchId, "ブロック固有寸法");
      return {
        created: true,
        readOnly: constraint.readOnlyDimension,
        enabled: constraint.enabled,
        target: constraint.target,
      };
    }
    return Object.freeze({ run });
  }

  function createExternalConstraintFixture({ currentScope, blockDefinitionById, blockProjectionBundle, addPoint, CoincidentConstraint, pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, hypot2 }) {
    function run() {
      const instance = currentScope().blockInstances[1] || currentScope().blockInstances[0];
      if (!instance) return null;
      const definition = blockDefinitionById(instance.definitionId);
      const localPoint = definition?.points[0];
      const projectedPoint = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
      if (!localPoint || !projectedPoint) return null;
      const localBefore = { x: localPoint.x, y: localPoint.y };
      const anchor = addPoint(projectedPoint.x + 75, projectedPoint.y + 40, true, "explicit");
      const constraint = new CoincidentConstraint(projectedPoint, anchor);
      pushModelConstraint(constraint, instance.sketchId);
      const result = solveSketchById(instance.sketchId);
      invalidateBlockProjectionCache(instance.id);
      const nextProjection = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
      return {
        success: result.success,
        errorNorm: result.errorNorm,
        projectedError: hypot2(nextProjection.x - anchor.x, nextProjection.y - anchor.y),
        localBefore,
        localAfter: { x: localPoint.x, y: localPoint.y },
        instance: { x: instance.x, y: instance.y, rotation: instance.rotation },
      };
    }
    return Object.freeze({ run });
  }

  function createInteractionObservation({ blockInstanceById, currentScope, canvas, blockProjectionBundle, worldToCanvasScreen, blockInstanceDisplayCenter, viewport }) {
    function points(instanceId = null) {
      const instance = instanceId ? blockInstanceById(instanceId) : currentScope().blockInstances[0];
      if (!instance) return null;
      const rect = canvas.getBoundingClientRect();
      const firstLine = blockProjectionBundle(instance).lines[0];
      const hitPoint = firstLine
        ? { x: (firstLine.p1.x + firstLine.p2.x) / 2, y: (firstLine.p1.y + firstLine.p2.y) / 2 }
        : { x: instance.x, y: instance.y };
      const center = worldToCanvasScreen(hitPoint);
      const pivot = worldToCanvasScreen(blockInstanceDisplayCenter(instance));
      return {
        center: { x: rect.left + center.x, y: rect.top + center.y },
        pivot: { x: rect.left + pivot.x, y: rect.top + pivot.y },
        handle: null,
        scale: viewport.scale,
      };
    }
    return Object.freeze({ points });
  }

  // Assemble Block editor lifecycle test actions without owning product state.
  function createEditorSupport({
    resetModelState, updateUI, draw, readDefinitions, currentScope, blockEditor, blockEditorSessionChain,
    readMode, blockPlacementCommand, commitBlockPlacement, blockProjectionBundle, HorizontalConstraint, VerticalConstraint,
    pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, recordHistory, serializeConstraint,
    createSketch, activeSketchId, addLine, addPoint, cancelBlockDefinitionEdit, completeBlockDefinitionEdit,
    setBlockInstanceEnabledSketchIds, serializeModel, loadModelData, allGeometryLines, enterBlockDefinitionEdit
  }) {
    const readDefinitionCount = () => readDefinitions().length;
    const emptyBlockFixture = createEmptyFixture({ resetModelState, updateUI, draw, readDefinitionCount, currentScope });
    const blockEditorObservation = createEditorObservation({ blockEditor, blockEditorSessionChain, currentScope });
    const blockPlacementAction = createPlacementAction({ readMode, blockPlacementCommand, commitBlockPlacement });
    const nestedConstraintAction = createNestedConstraintAction({ currentScope, blockProjectionBundle, HorizontalConstraint, VerticalConstraint, pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, recordHistory, updateUI, draw, serializeConstraint });
    const blockChildGeometryAction = createChildGeometryAction({ blockEditor, createSketch, activeSketchId, addLine, addPoint, recordHistory, updateUI, draw, currentScope });
    const blockCancelAction = createCancelAction({ cancelBlockDefinitionEdit, blockEditor, readDefinitionCount, currentScope });
    const blockCompleteAction = createCompleteAction({ completeBlockDefinitionEdit, blockEditor, readDefinitionCount, currentScope });
    const blockEnabledSketchAction = createEnabledSketchAction({ currentScope, setBlockInstanceEnabledSketchIds });
    const blockReload = createReload({ serializeModel, loadModelData, updateUI, draw, readDefinitions, currentScope, allGeometryLines });
    const legacyBlockReload = createLegacyReload({ serializeModel, loadModelData, updateUI, draw, readDefinitions, currentScope, blockProjectionBundle });
    const definitionUpdateFixture = createDefinitionUpdateFixture({ readDefinitions, currentScope, blockProjectionBundle, enterBlockDefinitionEdit, blockEditor, completeBlockDefinitionEdit });
    return Object.freeze({
      resetForEmptyBlockCreation: emptyBlockFixture.reset,
      blockDefinitionUpdateCase: definitionUpdateFixture.run,
      lifecycle: Object.freeze({
        reloadBlockState: blockReload.reload,
        reloadLegacyBlockState: legacyBlockReload.reload,
        blockEditorState: blockEditorObservation.state,
        commitBlockPlacementForTest: blockPlacementAction.commit,
        constrainFirstNestedBlockLineForTest: nestedConstraintAction.constrain,
        addBlockEditorChildGeometry: blockChildGeometryAction.add,
        cancelBlockEditor: blockCancelAction.cancel,
        completeBlockEditor: blockCompleteAction.complete,
        setFirstBlockInstanceSketches: blockEnabledSketchAction.set,
      }),
    });
  }

  // Compose live Block test observations without caching product state.
  function createObservationSupport({
    blockInstanceById, currentScope, blockInstanceDisplayCenter, readSolverVariables, buildDragSession,
    blockProjectionBundle, worldToCanvasScreen, canvas, constraintTargetSession, canvasHover,
    blockProjectionBundles, readDefinitions, canvasSelection, readMode, serializeModel, viewport
  }) {
    const blockRotationObservation = createRotationObservation({ blockInstanceById, currentScope, blockInstanceDisplayCenter, readSolverVariables, buildDragSession });
    const blockEndpointObservation = createEndpointObservation({ currentScope, blockProjectionBundle, worldToCanvasScreen, canvas });
    const blockHoverObservation = createHoverObservation({ constraintTargetSession, canvasHover });
    const blockStateObservation = createStateObservation({ blockProjectionBundles, readDefinitions, currentScope, canvasSelection, readMode, serializeModel });
    const blockInteractionObservation = createInteractionObservation({ blockInstanceById, currentScope, canvas, blockProjectionBundle, worldToCanvasScreen, blockInstanceDisplayCenter, viewport });
    return Object.freeze({
      blockState: blockStateObservation.state,
      blockInteractionPoints: blockInteractionObservation.points,
      blockRotationLockStateForTest: blockRotationObservation.state,
      blockProjectionEndpointForTest: blockEndpointObservation.position,
      blockProjectionHoverState: blockHoverObservation.state,
    });
  }

  // Compose Block browser fixtures from their existing live product owners.
  function createBrowserSupport({ geometry, modelTypes, documentModel, currentScope, sketches, projections, reads, queries,
    selection, editor, editorChain, placement, readMode, solver, canvas, viewport, worldToCanvasScreen,
    resetModelState, pushModelConstraint, fitAllGeometryToViewport, updateUI, draw, commitBlockPlacement, solveSketchById,
    recordHistory, serializeConstraint, createSketch, cancelBlockDefinitionEdit, completeBlockDefinitionEdit,
    setBlockInstanceEnabledSketchIds, serializeModel, loadModelData, enterBlockDefinitionEdit, blockInstanceDisplayCenter,
    buildDragSession, constraintTargetSession, canvasHover, blockSelectionGeometry, geometryRefForItem }) {
    const { addPoint, addLine } = geometry;
    const { HorizontalConstraint, VerticalConstraint, CoincidentConstraint, hypot2 } = modelTypes;
    const { activeSketchId } = sketches;
    const { blockProjectionBundle, invalidateBlockProjectionCache } = projections;
    const { blockProjectionBundles, allGeometryLines } = reads;
    const { blockInstanceById } = queries;
    const readDefinitions = () => documentModel.blockDefinitions;
    const creation = createCreationFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, VerticalConstraint,
      canvasSelection: selection, fitAllGeometryToViewport, updateUI, draw, canvas, worldToCanvasScreen });
    const editing = createEditorSupport({ resetModelState, updateUI, draw, readDefinitions, currentScope, blockEditor: editor, blockEditorSessionChain: editorChain,
      readMode, blockPlacementCommand: placement, commitBlockPlacement, blockProjectionBundle, HorizontalConstraint, VerticalConstraint,
      pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, recordHistory, serializeConstraint, createSketch, activeSketchId, addLine, addPoint,
      cancelBlockDefinitionEdit, completeBlockDefinitionEdit, setBlockInstanceEnabledSketchIds, serializeModel, loadModelData, allGeometryLines, enterBlockDefinitionEdit });
    const observations = createObservationSupport({ blockInstanceById, currentScope, blockInstanceDisplayCenter,
      readSolverVariables: () => solver.getVariables(), buildDragSession, blockProjectionBundle, worldToCanvasScreen, canvas,
      constraintTargetSession, canvasHover, blockProjectionBundles, readDefinitions, canvasSelection: selection, readMode, serializeModel, viewport });
    const rejection = createRejectionFixture({ resetModelState, addPoint, addLine, canvasSelection: selection, blockSelectionGeometry,
      readDefinitionCount: () => documentModel.blockDefinitions.length, currentScope, activeSketchId, geometryRefForItem });
    function createDimensionCases({ defaultDimensionForTarget, readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint, blockDefinitionById }) {
      const dimension = createReadOnlyDimensionFixture({ currentScope, blockProjectionBundle, defaultDimensionForTarget,
        readOnlyDimensionConstraintForPlacement, addReadOnlyDimensionConstraint });
      const external = createExternalConstraintFixture({ currentScope, blockDefinitionById, blockProjectionBundle, addPoint, CoincidentConstraint,
        pushModelConstraint, solveSketchById, invalidateBlockProjectionCache, hypot2 });
      return Object.freeze({ blockDefinitionUpdateCase: editing.blockDefinitionUpdateCase, blockReadOnlyDimensionCase: dimension.run,
        blockExternalConstraintCase: external.run, ...editing.lifecycle, blockCreationRejectionCases: rejection.cases });
    }
    return Object.freeze({ resets: Object.freeze({ resetForBlockCreationUi: creation.reset, resetForEmptyBlockCreation: editing.resetForEmptyBlockCreation }),
      observations, createDimensionCases });
  }

  window.BlockTestDriver = Object.freeze({ createBrowserSupport, createObservationSupport, createEditorSupport, createCreationFixture, createEmptyFixture, createRotationObservation, createEndpointObservation, createHoverObservation, createEditorObservation, createPlacementAction, createNestedConstraintAction, createChildGeometryAction, createCancelAction, createCompleteAction, createEnabledSketchAction, createRejectionFixture, createStateObservation, createReload, createLegacyReload, createDefinitionUpdateFixture, createReadOnlyDimensionFixture, createExternalConstraintFixture, createInteractionObservation });
})();
