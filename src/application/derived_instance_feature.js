/* Compose derived placement, source editing and committed edits over shared owners. */
(() => {
  "use strict";
  function create({ currentScope, resolveGeometryRef, setHint, recordHistory, updateUI, draw, ...placementOptions }) {
    const command = window.GeometryInstanceCommand.create({ ...placementOptions,
      currentScope, resolveGeometryRef, setHint, recordHistory, updateUI, draw });
    function createSourceCommand(options) {
      return window.InstanceSourceCommand.create({ ...options, currentScope, placementCommand: command,
        activeSketchId: placementOptions.activeSketchId, cancelConstraintTargetCommand: placementOptions.cancelConstraintTargetCommand,
        cancelPendingCommand: placementOptions.cancelPendingCommand, clearSelection: placementOptions.clearSelection,
        canvasSelection: placementOptions.canvasSelection, getMode: placementOptions.getMode, setMode: placementOptions.setMode,
        updateToolbar: placementOptions.updateToolbar, applicationText: placementOptions.applicationText,
        geometryRefForItem: placementOptions.geometryRefForItem, isVisibleSketchElement: placementOptions.isVisibleSketchElement,
        geometryRefsEqual: placementOptions.geometryRefsEqual, elementSketchId: placementOptions.elementSketchId,
        setHint, recordHistory, updateUI, draw });
    }
    function createEditing(options) {
      const editing = window.DerivedInstanceEditing.create({ ...options, currentScope, resolveGeometryRef, setHint, recordHistory, updateUI, draw });
      function changeProperty(instance, key, value) {
        return command.isPlacing(instance) ? command.changeSetting(key, value) : editing.change(instance, key, value);
      }
      return Object.freeze({ editing, changeProperty });
    }
    return Object.freeze({ command, createSourceCommand, createEditing });
  }
  window.DerivedInstanceFeature = Object.freeze({ create });
})();
