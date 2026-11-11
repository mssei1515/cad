/* Assemble parameter editing without mixing Workspace reads with the activated scope. */
(() => {
  "use strict";
  function prepareForWorkspace({ document, window: browserWindow, documentWorkspace, presentation,
    currentNamespace, currentScope, readBlockEditor, recordHistory, pickDimension }) {
    const { parameters: namespace } = documentWorkspace;
    const { settings, setHint, log, updateUI, draw } = presentation;
    const { guard } = window.ParameterApplication.createDeletionGuard({ currentNamespace,
      symbolDeletionDependents: namespace.symbolDeletionDependents,
      readLanguage: () => settings.language, setHint, log });
    const { ensureParameterNamespace } = namespace;
    let application = null;
    function applyDraft(...args) {
      if (application === null) throw new ReferenceError("Cannot access 'parameterApplication' before initialization");
      return application.apply(...args);
    }
    const editor = window.ParameterEditor.createForWorkspace({ document, window: browserWindow, documentWorkspace,
      currentScope, readBlockEditor, settings, applyDraft, recordHistory, setHint, updateUI, draw, pickDimension });
    function prepareNamespace() { return ensureParameterNamespace(currentNamespace()); }
    function createApplication(options) {
      const result = window.ParameterApplication.createForWorkspace({ ...options, documentWorkspace, presentation });
      application = result.application;
      return result;
    }
    return Object.freeze({ guard, editor, prepareNamespace, createApplication });
  }
  window.ParameterEditingFeature = Object.freeze({ prepareForWorkspace });
})();
