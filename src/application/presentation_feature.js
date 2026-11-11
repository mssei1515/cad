/* Connect application feedback and view refreshes without taking over views or models. */
(() => {
  "use strict";
  function create({ document, storage, refreshVersion, readDuplicateCount }) {
    let ui, canvas;
    let toolFlyouts = null;
    let commandPanels = null;
    let toolbar = null;
    function requireToolbar(binding) {
      if (!toolbar) throw new ReferenceError(`Cannot access '${binding}' before initialization`);
      return toolbar;
    }
    function updateToolbar() { requireToolbar("toolbarView").update(); }
    function updateStatusUI() { return requireToolbar("commandStatusView").updateStatus(); }
    function updateHistoryButtons() { return requireToolbar("toolbarPresentation").updateHistory(); }
    function updateUI(options) { return ui.refresh(options); }
    function updateGeometrySelectionUI() { return ui.selection(); }
    function updatePropertiesUI() { return ui.properties(); }
    function updateSketchUI() { return ui.sketch(); }
    function draw() { return canvas.draw(); }
    const settings = window.ApplicationSettings.create({ document, storage,
      refreshViews: options => updateUI(options), redrawCanvas: () => draw(), refreshVersion });
    const profiler = window.InteractionProfiler.create();
    const feedback = window.ApplicationFeedback.create({ document, settings, interactionProfiler: profiler, readDuplicateCount });
    function createAuthoringFeedback() {
      return window.AuthoringFeedback.create({ applicationText: settings.applicationText });
    }
    function log(message) { return feedback.log(message); }
    function setHint(message, kind = "normal") { return feedback.hint(message, kind); }
    function setSolveResultHint(label, solved, analysis, dependent) { return feedback.solveResult(label, solved, analysis, dependent); }
    function syncToolFlyouts() { return toolFlyouts?.sync(); }
    function createStartup({ canvasSurface, resizeCanvas, readVersion }) {
      const versionView = window.RuntimeVersionView.create({ document, applicationText: settings.applicationText });
      const { setApplicationLanguage, setApplicationTheme } = settings;
      function initialize(message) {
        updateUI();
        draw();
        log(message);
        setApplicationLanguage(settings.language, { persist: false, refresh: false });
        setApplicationTheme(settings.theme, { persist: false, redraw: false });
        versionView.load(readVersion());
        resizeCanvas();
        canvasSurface.start();
      }
      return Object.freeze({ versionView, initialize });
    }
    function createToolNavigation({ window: browserWindow }) {
      const menus = window.ApplicationMenus.create({ document, window: browserWindow,
        activateTool: id => document.getElementById(id)?.click() });
      function start() {
        menus.start();
        toolFlyouts = window.ToolFlyouts.create({ document, window: browserWindow, onOpen: menus.close });
        toolFlyouts.start();
      }
      return Object.freeze({ close: menus.close, start });
    }
    function prepareWorkspaceControls({ window: browserWindow, editingTools, canvasViewControls, layout, parameters, appearance, blocks }) {
      editingTools.bind();
      canvasViewControls.bindControls();
      const navigation = createToolNavigation({ window: browserWindow });
      function start() {
        navigation.start();
        layout.bindControls();
        parameters.start();
        appearance.start();
        settings.start();
        blocks.bind();
      }
      return Object.freeze({ close: navigation.close, start });
    }
    function createToolbar({ lifecycle, pending, constraints, constructionCommand, readSplineEditing, readHistory, updateDocumentStatus, isGeometryMode }) {
      const history = window.ToolbarView.createHistory({ document, readHistory, updateDocumentStatus });
      let controls = null;
      function requireControls(binding) {
        if (!controls) throw new ReferenceError(`Cannot access '${binding}' before initialization`);
        return controls;
      }
      function update() { requireControls("toolbarView").view.update(); }
      function updateStatus() { return requireControls("commandStatusView").status.update(); }
      function createIcons() {
        return window.ToolbarView.createIcons({ document, isDimensionConstraint: window.DimensionQueries.isDimensionConstraint, types: window.GeometrySolver });
      }
      function createControls({ selectedVisibilityTargets, selectionVisibilityIsHidden, canEditTarget, syncFlyouts = syncToolFlyouts, updateCursor }) {
        const view = window.ToolbarView.create({ document, isGeometryMode,
          constructionToggleState: (geometryMode = isGeometryMode()) => constructionCommand.state(geometryMode),
          readInteraction: () => ({ mode: lifecycle.mode, hasPending: Boolean(pending.current), hasConstraint: Boolean(constraints.command),
            annotationDraft: Boolean(pending.current?.annotationDraft), pendingType: pending.current?.type,
            constraintType: constraints.command?.type, splineEditing: readSplineEditing() }),
          updateHistoryButtons: history.update, selectedVisibilityTargets, selectionVisibilityIsHidden, canEditTarget, syncFlyouts, updateCursor });
        const status = window.ToolbarView.createCommandStatus({ document, applicationText: settings.applicationText,
          readMode: lifecycle.readMode, readPendingType: () => pending.current?.type, readConstraintCommand: () => constraints.command });
        controls = Object.freeze({ view, status });
        return controls;
      }
      function prepareControls({ canvas }) {
        const constraintButtons = Array.from(document.querySelectorAll("[data-constraint]"));
        const constraintMenuButtons = Array.from(document.querySelectorAll("[data-menu-constraint]"));
        const fixPointBtn = document.getElementById("fixPointBtn");
        const cursor = window.CommandCursor.create({ document, canvas, fixPointBtn, constraintButtons });
        function createPreparedControls(options) { return createControls({ ...options, updateCursor: cursor.update }); }
        function createForSelection({ selection, sketches, syncFlyouts }) {
          const { canEditSketch, constraintSketchId, elementSketchId } = sketches;
          return createPreparedControls({ selectedVisibilityTargets: selection.visibilityTargets,
            selectionVisibilityIsHidden: selection.visibilityIsHidden, syncFlyouts,
            canEditTarget: target => canEditSketch(target.kind === "constraint" ? constraintSketchId(target.item) : elementSketchId(target.item)),
          });
        }
        return Object.freeze({ constraintButtons, constraintMenuButtons, fixPointBtn, cursor, createControls: createPreparedControls, createForSelection });
      }
      function createEditingBinding({ undo, redo, toggleVisibility, deleteSelection, annotation }) {
        return window.ToolbarView.createEditingBinding({ document, undo, redo, toggleVisibility,
          isGeometryMode, deleteSelection, updateUI, draw, annotation });
      }
      function createDrawingBinding({ startCenterlineCommand, startCircleCenterCrossCommand, startSketchProjectionCommand,
        startGeometryInstanceCommand, filletCommand, startBlockCreation, offsetCommand, beginSplineCreation, startHatchCreation }) {
        return window.ToolbarView.createBinding({ document, drawOperationLifecycle: lifecycle, constructionCommand,
          startCenterlineCommand, startCircleCenterCrossCommand, startSketchProjectionCommand, startGeometryInstanceCommand,
          filletCommand, startBlockCreation, offsetCommand, beginSplineCreation, startHatchCreation });
      }
      function prepareWorkspace({ window: browserWindow, editing, drawing, canvasViewControls, layout, parameters, appearance, blocks }) {
        const editingTools = createEditingBinding(editing);
        const controls = prepareWorkspaceControls({ window: browserWindow, editingTools, canvasViewControls, layout, parameters, appearance, blocks });
        function createWorkspaceDrawingBinding() {
          const { centerline, circleCenterCross, projection, instances, fillet, blockCreation, offset, spline, hatch } = drawing;
          return createDrawingBinding({ startCenterlineCommand: centerline.start, startCircleCenterCrossCommand: circleCenterCross.start,
            startSketchProjectionCommand: projection.start, startGeometryInstanceCommand: instances.start, filletCommand: fillet,
            startBlockCreation: blockCreation.startCreation, offsetCommand: offset, beginSplineCreation: spline.start, startHatchCreation: hatch.startHatchCreation });
        }
        function startWithDrawingTools() {
          workspace.start();
          const drawingToolBinding = workspace.createDrawingBinding();
          drawingToolBinding.bind();
        }
        const workspace = Object.freeze({ ...controls, createDrawingBinding: createWorkspaceDrawingBinding, startWithDrawingTools });
        return workspace;
      }
      toolbar = Object.freeze({ updateHistory: history.update, createIcons, createControls, prepareControls, createEditingBinding, createDrawingBinding, prepareWorkspace, update, updateStatus });
      return toolbar;
    }
    function bindUI({ syncAnnotationResize, prepareParameterNamespace, refreshConstraintAnalysis, updateDocumentName,
      updateToolbar, renderSketch, updateBlockUI, renderProperties, readSketchMoving, updateStatusUI, updateConstraintButtons,
      syncDimensionInput, refreshSketchSelection }) {
      ui = window.ApplicationRefresh.create({ document, interactionProfiler: profiler, profileInteractionWork: profiler.work,
        syncAnnotationResize, prepareParameterNamespace, refreshConstraintAnalysis, updateDocumentName, updateToolbar, renderSketch,
        updateBlockUI, renderProperties, readSketchMoving, updateStatusUI, updateConstraintButtons,
        localizeApplicationUI: settings.localizeApplicationUI, syncDimensionInput, refreshSketchSelection });
      return ui;
    }
    function readCommandPanel() { return commandPanels ? commandPanels.commandPanel : null; }
    function readDerivedPanel() { return commandPanels ? commandPanels.derivedPanel : null; }
    function createCommandPanels({ host, readMode, sketchContext, projectionCommand, geometryCommand, sourceCommand,
      resolveGeometryRef, geometryRefForItem, applicationText, formatDisplayNumber, finishProjection, finishSourceEdit,
      exitDrawMode, changeFreeProperty, hatchCommand, annotationCommand, effectiveAnnotationStyle, pngExportCommand,
      updateUI, updatePropertiesUI, setHint, draw }) {
      commandPanels = window.CommandPanel.createFeature({ document, host, readMode, sketchContext, projectionCommand, geometryCommand, sourceCommand,
        resolveGeometryRef, geometryRefForItem, applicationText, formatDisplayNumber, finishProjection, finishSourceEdit,
        exitDrawMode, changeFreeProperty, hatchCommand, annotationCommand, effectiveAnnotationStyle, pngExportCommand,
        updateUI, updatePropertiesUI, setHint, draw });
      return commandPanels;
    }
    function createCommandPanelsForEditing({ host, documentWorkspace, readServices, lifecycle,
      projectionCommand, geometryCommand, sourceCommand, changeFreeProperty, hatchCommand, annotationCommand, pngExportCommand }) {
      return createCommandPanels({ host, readMode: lifecycle.readMode, sketchContext: documentWorkspace.sketches,
        projectionCommand, geometryCommand, sourceCommand, resolveGeometryRef: readServices.reads.resolveGeometryRef,
        geometryRefForItem: window.GeometryObjects.geometryRefForItem, applicationText: settings.applicationText,
        formatDisplayNumber: window.NumberDisplay.formatDisplayNumber, finishProjection: projectionCommand.commit,
        finishSourceEdit: sourceCommand.finish, exitDrawMode: lifecycle.exit, changeFreeProperty, hatchCommand, annotationCommand,
        effectiveAnnotationStyle: readServices.annotationAppearance.effectiveAnnotationStyle, pngExportCommand,
        updateUI, updatePropertiesUI, setHint, draw });
    }
    function bindCanvas({ readPngCommand, readPending, readMode, readCommandPanel: readPanel = readCommandPanel, syncAnnotationInput, readDerivedPanel: readDerived = readDerivedPanel,
      withGeometryReadCache, drawCanvas }) {
      canvas = window.CanvasRefresh.create({ readPngCommand, readPending, readMode, readCommandPanel: readPanel, syncAnnotationInput, readDerivedPanel: readDerived,
        interactionProfiler: profiler, profileInteractionWork: profiler.work, withGeometryReadCache, drawCanvas });
      return canvas;
    }
    return Object.freeze({ settings, profiler, constraintFeedback: feedback.constraints, createAuthoringFeedback, createStartup, createToolbar, createToolNavigation, prepareWorkspaceControls, createCommandPanels, createCommandPanelsForEditing, readCommandPanel, bindUI, bindCanvas,
      log, setHint, setSolveResultHint, updateUI, updateGeometrySelectionUI, updatePropertiesUI, updateSketchUI, draw, updateToolbar, updateStatusUI, updateHistoryButtons,
      get selectedItem() { return canvas.selectedItem; } });
  }
  window.PresentationFeature = Object.freeze({ create });
})();
