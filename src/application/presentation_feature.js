/* Connect application feedback and view refreshes without taking over views or models. */
(() => {
  "use strict";
  function create({ document, storage, refreshVersion, readDuplicateCount }) {
    let ui, canvas;
    let toolFlyouts = null;
    let commandPanels = null;
    function updateUI(options) { return ui.refresh(options); }
    function updateGeometrySelectionUI() { return ui.selection(); }
    function updatePropertiesUI() { return ui.properties(); }
    function updateSketchUI() { return ui.sketch(); }
    function draw() { return canvas.draw(); }
    const settings = window.ApplicationSettings.create({ document, storage,
      refreshViews: options => updateUI(options), redrawCanvas: () => draw(), refreshVersion });
    const profiler = window.InteractionProfiler.create();
    const feedback = window.ApplicationFeedback.create({ document, settings, interactionProfiler: profiler, readDuplicateCount });
    function log(message) { return feedback.log(message); }
    function setHint(message, kind = "normal") { return feedback.hint(message, kind); }
    function setSolveResultHint(label, solved, analysis, dependent) { return feedback.solveResult(label, solved, analysis, dependent); }
    function syncToolFlyouts() { return toolFlyouts?.sync(); }
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
    function createToolbar({ lifecycle, pending, constraints, constructionCommand, readSplineEditing, readHistory, updateDocumentStatus, isGeometryMode }) {
      const history = window.ToolbarView.createHistory({ document, readHistory, updateDocumentStatus });
      function createControls({ selectedVisibilityTargets, selectionVisibilityIsHidden, canEditTarget, syncFlyouts = syncToolFlyouts, updateCursor }) {
        const view = window.ToolbarView.create({ document, isGeometryMode,
          constructionToggleState: (geometryMode = isGeometryMode()) => constructionCommand.state(geometryMode),
          readInteraction: () => ({ mode: lifecycle.mode, hasPending: Boolean(pending.current), hasConstraint: Boolean(constraints.command),
            annotationDraft: Boolean(pending.current?.annotationDraft), pendingType: pending.current?.type,
            constraintType: constraints.command?.type, splineEditing: readSplineEditing() }),
          updateHistoryButtons: history.update, selectedVisibilityTargets, selectionVisibilityIsHidden, canEditTarget, syncFlyouts, updateCursor });
        const status = window.ToolbarView.createCommandStatus({ document, applicationText: settings.applicationText,
          readMode: lifecycle.readMode, readPendingType: () => pending.current?.type, readConstraintCommand: () => constraints.command });
        return Object.freeze({ view, status });
      }
      return Object.freeze({ updateHistory: history.update, createControls });
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
    function bindCanvas({ readPngCommand, readPending, readMode, readCommandPanel: readPanel = readCommandPanel, syncAnnotationInput, readDerivedPanel: readDerived = readDerivedPanel,
      withGeometryReadCache, drawCanvas }) {
      canvas = window.CanvasRefresh.create({ readPngCommand, readPending, readMode, readCommandPanel: readPanel, syncAnnotationInput, readDerivedPanel: readDerived,
        interactionProfiler: profiler, profileInteractionWork: profiler.work, withGeometryReadCache, drawCanvas });
      return canvas;
    }
    return Object.freeze({ settings, profiler, constraintFeedback: feedback.constraints, createToolbar, createToolNavigation, createCommandPanels, readCommandPanel, bindUI, bindCanvas,
      log, setHint, setSolveResultHint, updateUI, updateGeometrySelectionUI, updatePropertiesUI, updateSketchUI, draw,
      get selectedItem() { return canvas.selectedItem; } });
  }
  window.PresentationFeature = Object.freeze({ create });
})();
