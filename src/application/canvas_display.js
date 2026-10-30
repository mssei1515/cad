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
        sameArcEndpoint, arcEndpointPoint, findArcEndpointFixedConstraint, pointLockedByLineFixed, editingQueries, annotationBounds }) {
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
        return Object.freeze({ ...scene, commandTargets, sketchStyle });
      }
      function createWorkspaceRendering(options) {
        return createRendering({ ...options, canvas, ctx, viewport, surface, zoomControl,
          readExportFrame: () => exportRenderer.frame });
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
        fileSession, constraintTargetSession, findSnap, flushPointerMove }) {
        return window.PngExport.create({ document, window: browserWindow, canvas, rendering: exportRenderer,
          text: applicationText, documentName, prepareImages, readViewScale: () => viewport.scale,
          readMode: drawOperationLifecycle.readMode, setMode: drawOperationLifecycle.setMode,
          pendingCommandSession, fileSession, drawOperationLifecycle, constraintTargetSession,
          withGeometryReadCache, findSnap, flushPointerMove, setHint, draw });
      }
      const dragPointer = window.CanvasInputBinding.createDragPointer({ canvas });
      return Object.freeze({ surface, exportRenderer, layout, createScene, createSceneForEditing, createRendering: createWorkspaceRendering, createInputBinding, createPngExport, dragPointer });
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
  window.CanvasDisplay = Object.freeze({ create, createRendering });
})();
