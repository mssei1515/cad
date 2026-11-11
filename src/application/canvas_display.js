/* Compose shared viewport services, then Canvas surfaces and workspace presentation. */
(() => {
  "use strict";
  function create({ canvas, document, initialScale, minZoom, maxZoom, minLength,
    draw, setHint, fitVisibleGeometry, flushPointerMoves, syncDimensionValueInput }) {
    const viewport = window.CanvasViewport.create({ canvasRect: () => canvas.getBoundingClientRect(), initialScale, minZoom, maxZoom, minLength });
    const navigation = window.CanvasNavigation.create({ canvas, viewport, draw, setHint, fitVisibleGeometry });
    const zoomControl = window.CanvasZoomControl.create({
      button: document.getElementById("statusZoom"), input: document.getElementById("statusZoomInput"),
      readPercent: () => viewport.scale / initialScale * 100,
      format: () => viewport.formatZoom(viewport.scale),
      applyPercent: percent => {
        flushPointerMoves();
        const applied = navigation.setScale(percent / 100 * initialScale);
        syncDimensionValueInput();
        return applied;
      },
    });
    function createDrawingFit({ bounds, activeSketchId }) {
      const { fitBoundsToViewport } = viewport;
      const { sketchGeometryBounds, allGeometryBounds, visibleGeometryBounds } = bounds;
      function fitSketchToViewport(sketchId = activeSketchId(), paddingPx = 96) {
        return fitBoundsToViewport(sketchGeometryBounds(sketchId), paddingPx);
      }
      function fitAllGeometryToViewport(paddingPx = 96) {
        return fitBoundsToViewport(allGeometryBounds(), paddingPx);
      }
      function fitVisibleGeometryToViewport(paddingPx = 96) {
        return fitBoundsToViewport(visibleGeometryBounds(), paddingPx);
      }
      function resetEmptyViewport() {
        const rect = canvas.getBoundingClientRect();
        viewport.update({ scale: initialScale });
        viewport.update({ x: rect.width / 2 });
        viewport.update({ y: rect.height / 2 });
      }
      return Object.freeze({ fitSketchToViewport, fitAllGeometryToViewport, fitVisibleGeometryToViewport, resetEmptyViewport });
    }
    function createWorkspace({ ctx, readPixelRatio, ResizeObserverClass, withGeometryReadCache, drawCanvas,
      isValueInputPending, window: browserWindow, updatePropertiesUI, closeContextMenu, applySketchTreeWidth, applicationText, readLanguage }) {
      const surface = window.CanvasSurface.create({ canvas, ctx, viewport, readPixelRatio, ResizeObserverClass,
        onResize: () => { draw(); if (isValueInputPending()) syncDimensionValueInput(); },
      });
      const exportRenderer = window.CanvasExport.createRenderer({ viewport, withGeometryReadCache, drawCanvas, syncCanvasBitmapSize: surface.syncCanvasBitmapSize, draw });
      const layout = window.CanvasWorkspaceLayout.create({
        window: browserWindow, updatePropertiesUI, setHint, closeContextMenu, canvas, document, viewport,
        syncCanvasBitmapSize: surface.syncCanvasBitmapSize, applySketchTreeWidth, draw,
        isValueInputPending, syncDimensionValueInput, currentCanvasCenterWorld: viewport.currentCanvasCenterWorld, applicationText, readLanguage,
      });
      function createScene({ Point, currentScope, sketches, readServices, pointUsage, commandTargets, sketchStyle,
        canvasSelection, canvasHover, selectionHighlight, viewState, isSidebarHighlightedElement,
        canvasThemeColor, applicationText, constructionAlpha, constructionExtensionScreenPx,
        sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, pointLockedByLineFixed,
        editingQueries, annotationBounds, resolvedLoopBounds, hatchAppearanceForDisplay }) {
        const { reads: geometryReads, geometryAppearance, hatches } = readServices;
        const { effectiveAppearanceForElement, isVisibleSketchElement, isVisibleSketchId, isVisibleValue } = geometryAppearance;
        const { activeSketchId, elementSketchId, sketchRelationToActive, sketchName, isEditableSketchElement } = sketches;
        const { isSidebarHoveredElement, isSelectedConstraintRelatedElement } = selectionHighlight;
        const { resolvedHatchBoundary } = hatches;
        const { isDraggingArcEndpoint, isDraggingPoint, isDraggingCenter, editedSpline } = editingQueries;
        const geometry = window.GeometryDisplay.create({
          Point, ctx, viewport, surface, pointUsage, commandTargets, sketchStyle, canvasSelection, canvasHover, viewState,
          isExporting: () => Boolean(exportRenderer.frame), effectiveAppearanceForElement, isEditableSketchElement,
          isSidebarHighlightedElement, isSidebarHoveredElement, isSelectedConstraintRelatedElement,
          canvasThemeColor, constructionAlpha, constructionExtensionScreenPx,
          fixedPointLabel: () => applicationText("固定", "Fixed"), geometryReads, isVisibleSketchElement,
          handleQueries: { sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, isDraggingArcEndpoint, editedSpline, currentScope },
          pointQueries: { pointLockedByLineFixed, sidebarHoveredItem: () => selectionHighlight.current?.item, isDraggingPoint, isDraggingCenter },
        });
        const overlay = window.InteractionOverlayRenderer.create({ ctx, viewport, withCanvasState: surface.withCanvasState,
          elementSketchId, sketchRelationToActive, applicationText, isVisibleSketchId, activeSketchId, sketchName });
        const bounds = window.DrawingBounds.create({ currentScope, geometryReads, activeSketchId, elementSketchId, isVisibleSketchElement,
          isVisibleSketchId, annotationBounds, resolvedLoopBounds, resolvedHatchBoundary, hatchAppearanceForDisplay, isVisibleValue });
        const fit = createDrawingFit({ bounds, activeSketchId });
        return Object.freeze({ geometry, overlay, bounds, fit });
      }
      function createSceneForEditing({ currentScope, sketches, readServices, interaction, targets, pending, solveState, analysis,
        readPanelSelection, instanceSources, projection, instances, operandElement, selectionHighlight, viewState,
        isSidebarHighlightedElement, canvasThemeColor, applicationText, constructionAlpha, constructionExtensionScreenPx,
        sameArcEndpoint, arcEndpointPoint, fixedState, findArcEndpointFixedConstraint = fixedState?.findArcEndpointFixedConstraint,
        pointLockedByLineFixed = fixedState?.pointLockedByLineFixed, editingQueries, annotationBounds }) {
        const commandTargets = window.GeometryPresentation.createCommandTargets({
          readPanelSelection, readMode: interaction.lifecycle.readMode, instanceSourceCommand: instanceSources, sketchProjectionCommand: projection,
          geometryInstanceCommand: instances, geometryRefsEqual: window.GeometryRef.equals, geometryRefForItem: window.GeometryObjects.geometryRefForItem,
          readOperands: () => targets.operands, sameArcEndpoint, operandElement, readConstraintCommand: () => targets.command,
          isActiveSketchElement: sketches.isActiveSketchElement, isReferenceSourceSketchId: sketches.isReferenceSourceSketchId,
          elementSketchId: sketches.elementSketchId, readPending: () => pending.current,
        });
        const sketchStyle = window.GeometryPresentation.createSketchStyle({
          sketchHasSolveError: solveState.hasError, elementSketchId: sketches.elementSketchId, sketchRelationOfElement: sketches.sketchRelationOfElement,
          constraintStatusOf: analysis.statusOf, isVisibleSketchElement: readServices.geometryAppearance.isVisibleSketchElement, isActiveSketchElement: sketches.isActiveSketchElement,
        });
        const scene = createScene({ Point: window.GeometrySolver.Point, currentScope, sketches, readServices, pointUsage: interaction.pointUsage,
          commandTargets, sketchStyle, canvasSelection: interaction.selection, canvasHover: interaction.hover, selectionHighlight, viewState,
          isSidebarHighlightedElement, canvasThemeColor, applicationText, constructionAlpha, constructionExtensionScreenPx,
          sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, pointLockedByLineFixed, editingQueries, annotationBounds,
          resolvedLoopBounds: window.HatchRegionEngine.resolvedLoopBounds, hatchAppearanceForDisplay: window.HatchData.hatchAppearanceForDisplay });
        function createFrame({ rectangle, snap, pointer, referenceImageLayer, readPngCommand,
          drawBlockInstanceHandles = scene.geometry.drawBlockInstanceHandles, ...options }) {
          const overlays = window.InteractionOverlayRenderer.createLayer({ renderer: scene.overlay, rectangle, snap,
            hover: interaction.hover, selection: interaction.selection, pointer });
          const frame = createWorkspaceRendering({ ...options, geometry: scene.geometry, drawBlockInstanceHandles,
            drawSnapMarker: overlays.drawSnapMarker, drawSketchIdentityLabel: overlays.drawSketchIdentityLabel, drawSelectionRect: overlays.drawSelectionRect,
            drawReferenceImages: referenceImageLayer.drawImages, drawReferenceImageOverlays: referenceImageLayer.drawOverlays,
            drawExportOverlay: () => readPngCommand()?.drawOverlay(ctx, viewport.scale) });
          return Object.freeze({ frame, overlays });
        }
        function createHatchRendering({ readCommand }) {
          const { Line, Circle, Arc, Spline } = window.GeometrySolver;
          const { hatchAppearanceForDisplay, hatchPatternOrigin } = window.HatchData;
          const { isVisibleSketchId, isVisibleSketchElement, isVisibleValue } = readServices.geometryAppearance;
          const { hatchBoundaryGeometryItems, resolvedHatchBoundary } = readServices.hatches;
          const { visibleWorldBounds } = viewport;
          const { drawLines, drawCircles, drawArcs, drawSplines } = scene.geometry;
          const { drawResolvedHatchContent } = window.HatchRenderer.create({ viewport,
            visibleWorldBounds: () => exportRenderer.frame?.worldBounds || visibleWorldBounds(), canvasThemeColor, isVisibleValue });
          const layer = window.HatchRenderer.createLayer({ ctx, drawResolvedHatchContent, hatchBoundaryGeometryItems,
            boundaryPainters: [{ type: Line, draw: drawLines }, { type: Circle, draw: drawCircles }, { type: Arc, draw: drawArcs }, { type: Spline, draw: drawSplines }],
            allHatches: readServices.reads.allHatches, isVisibleSketchId, hatchAppearanceForDisplay,
            isConstraintOperandSelected: commandTargets.isConstraintOperandSelected, canvasSelection: interaction.selection, activeSketchId: sketches.activeSketchId,
            readHover: () => interaction.hover.current, resolvedHatchBoundary, hatchPatternOrigin, isExporting: () => Boolean(exportRenderer.frame),
            sketchAlpha: sketchStyle.sketchAlpha, readMode: interaction.lifecycle.readMode, readCommand });
          function drawHatches(...args) { return layer.drawHatches(...args); }
          function createStack() {
            return window.DrawingStack.create({ currentScope, activeSketchId: sketches.activeSketchId, geometryReads: readServices.reads,
              isVisibleSketchId, isVisibleSketchElement, hatchAppearanceForDisplay, isVisibleValue,
              painters: { hatch: items => drawHatches(items, { includePreview: false }), line: drawLines, circle: drawCircles, arc: drawArcs, spline: drawSplines } });
          }
          function prepareFrame() {
            const stack = createStack();
            function createFrameWithStack(options) {
              return createFrame({ ...options, drawHatches, drawDrawingStack: stack.drawDrawingStack });
            }
            return Object.freeze({ stack, createFrame: createFrameWithStack });
          }
          return Object.freeze({ layer, drawHatches, createStack, prepareFrame });
        }
        return Object.freeze({ ...scene, commandTargets, sketchStyle, createFrame, createHatchRendering });
      }
      function createWorkspaceRendering(options) {
        return createRendering({ ...options, canvas, ctx, viewport, surface, zoomControl,
          readExportFrame: () => exportRenderer.frame });
      }
      function createPlacementPreview({ geometry, annotations, hatchLayer, readServices, interaction, sessions,
        blockPlacementCommand, geometryInstanceCommand, createBlockProjectionBundle }) {
        const { hatchAppearanceForDisplay, hatchPatternOrigin } = window.HatchData;
        const renderer = window.PlacementPreviewRenderer.create({ ctx, viewport, withCanvasState: surface.withCanvasState,
          traceSplinePath: geometry.traceSplinePath, drawResolvedHatch: (...args) => hatchLayer.drawResolvedHatch(...args),
          resolvedHatchBoundary: readServices.hatches.resolvedHatchBoundary, hatchAppearanceForDisplay, hatchPatternOrigin,
          drawAnnotationLeader: annotations.drawAnnotationLeader, drawAnnotationText: annotations.drawAnnotationText });
        return window.PlacementPreviewRenderer.createLayer({ renderer, readMode: interaction.lifecycle.readMode,
          readPointer: () => sessions.preview.pointer, blockPlacementCommand, geometryInstanceCommand, createBlockProjectionBundle });
      }
      function createInputBinding({ pointer, readCommandPanel, readPngExportCommand, blankCanvasGesture,
        isBlankCommandPanelPoint, scheduler, profileCommit }) {
        const { canvasScreenPoint, canvasPoint, screenToWorld } = viewport;
        const routing = window.CanvasInputBinding.createCommandRouting({ pointer, readCommandPanel, readPngExportCommand,
          blankCanvasGesture, canvasScreenPoint, canvasPoint, isBlankCommandPanelPoint, screenToWorld, navigation });
        return window.CanvasInputBinding.create({ canvas, pointer: routing, scheduler, navigation, profileCommit, closeContextMenu,
          afterZoom: () => { if (isValueInputPending()) syncDimensionValueInput(); },
          screenToWorld, formatCoordinate: window.NumberDisplay.formatDisplayNumber,
          coordinateStatus: () => document.getElementById("statusCoordinates") });
      }
      function createPngExport({ documentName, prepareImages, drawOperationLifecycle, pendingCommandSession,
        fileSession, constraintTargetSession, findSnap, flushPointerMove, pngExport = window.PngExport }) {
        return pngExport.create({ document, window: browserWindow, canvas, rendering: exportRenderer,
          text: applicationText, documentName, prepareImages, readViewScale: () => viewport.scale,
          readMode: drawOperationLifecycle.readMode, setMode: drawOperationLifecycle.setMode,
          pendingCommandSession, fileSession, drawOperationLifecycle, constraintTargetSession,
          withGeometryReadCache, findSnap, flushPointerMove, setHint, draw });
      }
      const dragPointer = window.CanvasInputBinding.createDragPointer({ canvas });
      return Object.freeze({ surface, exportRenderer, layout, createScene, createSceneForEditing, createRendering: createWorkspaceRendering, createPlacementPreview, createInputBinding, createPngExport, dragPointer });
    }
    // Build inline dimensions on the same surface/context before any input binding or observation starts.
    function createEditingWorkspace({ dimensionScene, dimensionInput, ...workspaceOptions }) {
      const workspace = createWorkspace(workspaceOptions);
      const { currentLines, minLineLength, canvasThemeColor, onExpressionMark, appearance, sketches } = dimensionScene;
      const dimensions = window.DimensionDisplay.createForScene({ ctx: workspaceOptions.ctx, viewport, currentLines,
        minLineLength, canvasThemeColor, onExpressionMark, appearance, sketches });
      const input = window.DimensionInput.createForDocument({ ...dimensionInput,
        document, viewport, display: dimensions.display, worldToCanvasScreen: viewport.worldToCanvasScreen,
        effectiveDimensionAppearance: appearance.effectiveDimensionAppearance,
        constraintSketchId: sketches.constraintSketchId, activeSketchId: sketches.activeSketchId,
        applicationText: workspaceOptions.applicationText, setHint, draw });
      return Object.freeze({ ...workspace, dimensions: Object.freeze({ ...dimensions, input: input.feature, element: input.input }) });
    }
    return Object.freeze({ viewport, navigation, zoomControl, createDrawingFit, createWorkspace, createEditingWorkspace });
  }
  function createRendering({ canvas, ctx, viewport, surface, zoomControl, readExportFrame, recordDraw,
    geometry, dimensions, drawDimensionPreview, annotations, authoringPreview, placements, offsetPreview,
    drawBlockInstanceHandles, drawSnapMarker, drawReferenceImages, drawHatches, drawDrawingStack,
    drawReferenceImageOverlays, drawSketchIdentityLabel, drawSelectionRect, drawExportOverlay }) {
    const interactive = window.CanvasSurface.createInteractiveRenderer({
      drawBlockInstanceHandles, dimensions, drawDimensionPreview, annotations, authoringPreview, placements, offsetPreview,
      drawSnapMarker, drawArcEndpointHandles: () => geometry.drawArcEndpointHandles(),
      drawSplineEditHandles: () => geometry.drawSplineEditHandles(), drawPoints: () => geometry.drawPoints(),
      drawReferenceImageOverlays, drawSketchIdentityLabel, drawSelectionRect, drawExportOverlay,
    });
    return window.CanvasSurface.createFrameRenderer({
      canvas, ctx, viewport, surface, syncZoom: () => zoomControl.sync(), readExportFrame, recordDraw,
      drawContent: () => { drawReferenceImages(); drawHatches([], { includePreview: true }); drawDrawingStack(); },
      drawExport: () => { dimensions.draw(); annotations.draw(); geometry.drawPoints(); },
      drawInteractive: interactive.draw,
    });
  }
  function prepareForWorkspace({ canvas, document, window: browserWindow, ctx, documentWorkspace, readServices, interaction, sessions, presentation }) {
    const { settings, draw, setHint, updatePropertiesUI } = presentation;
    const { applicationText } = settings, { workspace, sketches } = documentWorkspace;
    const { pending, targets } = sessions;
    function dimensionInputOptions(input) {
      if (!Object.hasOwn(input, "evaluateDimensionExpressionDraft")) input.evaluateDimensionExpressionDraft = documentWorkspace.parameters?.evaluateEditingExpressionDraft;
      if (!Object.hasOwn(input, "expressionFromUserInput")) input.expressionFromUserInput = documentWorkspace.parameters?.expressionFromUserInput;
      if (!Object.hasOwn(input, "cancelPendingCommand")) input.cancelPendingCommand = message => pending.cancel(message);
      return input;
    }
    const { phase: profilePhase } = presentation.profiler;
    const controls = window.CanvasViewControls.create({ document, window: browserWindow, setHint, draw });
    function canvasThemeColor(value) { return window.CanvasThemeColors.color(value, settings.theme); }
    function createForEditing({ initialScale, minLength, fitVisibleGeometry, flushPointerMoves, syncDimensionValueInput }) {
      let completedScene = null;
      function fitVisibleGeometryToViewport(paddingPx = 96) {
        if (completedScene === null) throw new ReferenceError("Cannot access 'drawingFit' before initialization");
        return completedScene.fit.fitVisibleGeometryToViewport(paddingPx);
      }
      const display = create({ canvas, document, initialScale, minZoom: initialScale * 0.001, maxZoom: initialScale * 10000000,
        minLength, draw, setHint, fitVisibleGeometry: fitVisibleGeometry === undefined ? fitVisibleGeometryToViewport : fitVisibleGeometry,
        flushPointerMoves, syncDimensionValueInput });
      function createEditingWorkspace({ dimensionScene, dimensionInput, ...options }) {
        const displayWorkspace = display.createEditingWorkspace({ ...options,
          dimensionScene: { ...dimensionScene, currentLines: () => workspace.current().lines, minLineLength: minLength,
            canvasThemeColor, appearance: readServices.dimensionAppearance, sketches },
          dimensionInput: dimensionInputOptions({ ...dimensionInput, pending }),
          ctx, readPixelRatio: () => browserWindow.devicePixelRatio || 1, ResizeObserverClass: browserWindow.ResizeObserver,
          withGeometryReadCache: readServices.reads.withGeometryReadCache,
          isValueInputPending: () => pending.current && ["distance-value", "offset-value"].includes(pending.current.type),
          window: browserWindow, updatePropertiesUI, applicationText, readLanguage: () => settings.language,
        });
        function createSceneForEditing(options) {
          const scene = displayWorkspace.createSceneForEditing({ constructionExtensionScreenPx: 12, ...options, currentScope: workspace.current, sketches, readServices, interaction,
            targets, pending, readPanelSelection: () => presentation.selectedItem, viewState: controls.state, canvasThemeColor, applicationText });
          completedScene = scene;
          return scene;
        }
        function createSceneWithAppearance(options) {
          return createSceneForEditing({ constructionAlpha: 0.72, ...options });
        }
        function createPlacementPreview(options) { return displayWorkspace.createPlacementPreview({ ...options, readServices, interaction, sessions }); }
        function createInputBinding(options) {
          return displayWorkspace.createInputBinding({ ...options, pointer: sessions.pointer, readCommandPanel: presentation.readCommandPanel,
            profileCommit: work => profilePhase("commit", work) });
        }
        function createPngExport(options) {
          return displayWorkspace.createPngExport({ ...options, drawOperationLifecycle: interaction.lifecycle, pendingCommandSession: pending, constraintTargetSession: targets });
        }
        function createDimensionTraversal({ currentScope, readDraggedDimension, dimensionUsesExpression }) {
          const { isActiveSketchConstraint, constraintSketchId } = sketches;
          const { isVisibleSketchId, isVisibleValue } = readServices.geometryAppearance;
          return displayWorkspace.dimensions.display.createTraversal({ currentScope, isActiveSketchConstraint, isVisibleSketchId,
            constraintSketchId, isVisibleValue, canvasSelection: interaction.selection,
            readHoverDimension: () => interaction.hover.current.dimension, readDraggedDimension,
            readPending: () => pending.current, readExportFrame: () => displayWorkspace.exportRenderer.frame,
            readConstraintStatus: () => controls.state.constraintStatus, inactiveColor: window.GeometryPresentation.INACTIVE_CONSTRAINT_STATUS_COLOR,
            dimensionLabelForConstraint: displayWorkspace.dimensions.labels.label, dimensionUsesExpression });
        }
        let dimensionPreview = null;
        function drawDimensionPreview() {
          if (dimensionPreview === null) throw new ReferenceError("Cannot access 'dimensionPreview' before initialization");
          return dimensionPreview.draw();
        }
        function createDimensionPreview({ drawFilletPreviewArc }) {
          const preview = displayWorkspace.dimensions.display.createPreview({ readPending: () => pending.current, drawFilletPreviewArc,
            evaluateDimensionExpressionDraft: documentWorkspace.parameters?.evaluateEditingExpressionDraft });
          dimensionPreview = preview;
          return preview;
        }
        return Object.freeze({ ...displayWorkspace, createSceneForEditing, createSceneWithAppearance, createPlacementPreview, createInputBinding, createPngExport, createDimensionTraversal, createDimensionPreview, drawDimensionPreview });
      }
      function createEditingWorkspaceForBrowser({ dimensionInput, ...options }) {
        const scheduleFrame = callback => {
          const { requestAnimationFrame } = browserWindow;
          return requestAnimationFrame(callback);
        };
        return createEditingWorkspace({ ...options, dimensionInput: { scheduleFrame, ...dimensionInput } });
      }
      return Object.freeze({ ...display, createEditingWorkspace, createEditingWorkspaceForBrowser, fitVisibleGeometryToViewport });
    }
    return Object.freeze({ controls, canvasThemeColor, createForEditing });
  }
  function prepareRendering() {
    let completed;
    function drawCanvas() {
      if (completed === undefined) throw new ReferenceError("Cannot access 'canvasFrameRenderer' before initialization");
      return completed.value.draw();
    }
    function createFrame(factory, ...options) {
      const frame = factory(...options);
      const renderer = frame.frame;
      completed = { value: renderer };
      return frame;
    }
    function prepareHatchFrame(scene, options) {
      const { createHatchRendering } = scene;
      const { layer, prepareFrame: prepare } = createHatchRendering(options);
      function prepareFrame() {
        const { stack, createFrame: build } = prepare();
        function createFrameForDisplay(options) { return createFrame(build, options); }
        return Object.freeze({ stack, createFrame: createFrameForDisplay });
      }
      return Object.freeze({ layer, prepareFrame });
    }
    return Object.freeze({ drawCanvas, createFrame, prepareHatchFrame });
  }
  window.CanvasDisplay = Object.freeze({ prepareForWorkspace, create, createRendering, prepareRendering });
})();
