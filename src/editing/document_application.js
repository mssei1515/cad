/* Apply a decoded document to the editing scope; codecs retain format ownership. */
(() => {
  "use strict";
  function create({ documentLoading, document, model, sketchTreeView, resetEditingState,
    refreshReferenceConstraintValidity, enforceMinimumLineLengths, ensureDimensionDefaults,
    restoreSequences, ensureAppearanceState, ensureBlockState, log }) {
    const { ensureDrawingOrderState } = window.DrawingOrder;
    let lastLoadBlockConstraintRepairMessage = "";
    function load(data, options = {}) {
      if (!data || !Array.isArray(data.points) || !Array.isArray(data.lines) || !Array.isArray(data.constraints)) {
        throw new Error("保存データの形式が正しくありません");
      }
      lastLoadBlockConstraintRepairMessage = "";
      const preservedSketchTree = options.preserveSketchTreeState ? sketchTreeView.capture() : null;
      const candidate = documentLoading.decode(data, options);
      const { repairedBlockConstraintCount } = candidate;

      resetEditingState();
      if (preservedSketchTree) sketchTreeView.restore(preservedSketchTree);
      documentLoading.install(candidate, document, model);
      refreshReferenceConstraintValidity();
      const lineRepair = enforceMinimumLineLengths(model.lines);
      const lastLoadLineRepairMessage =
        lineRepair.changed > 0 || lineRepair.failed > 0
          ? `短すぎる線を補正しました: ${lineRepair.changed}件${lineRepair.failed ? ` / 補正不能 ${lineRepair.failed}件` : ""}`
          : "";
      if (lastLoadLineRepairMessage) log(lastLoadLineRepairMessage);
      lastLoadBlockConstraintRepairMessage = repairedBlockConstraintCount > 0
        ? `参照先が見つからないブロック内部拘束を${repairedBlockConstraintCount}件解除しました`
        : "";
      if (lastLoadBlockConstraintRepairMessage) log(lastLoadBlockConstraintRepairMessage);
      ensureDimensionDefaults();
      const recoveredSequences = window.DocumentSequences.recover(model, document.blockDefinitions);
      restoreSequences(recoveredSequences);
      ensureAppearanceState();
      ensureBlockState();
      ensureDrawingOrderState(model);
      for (const definition of document.blockDefinitions) ensureDrawingOrderState(definition);
    }
    return Object.freeze({ load, get blockConstraintRepairMessage() { return lastLoadBlockConstraintRepairMessage; } });
  }
  function createPreparation({ document, currentScope, readBlockEditor, sketchContext, parameterNamespace, blockCatalog }) {
    const { ensureSketchState, isDrawableSketch, firstDrawableSketchId } = sketchContext;
    const { ensureParameterNamespace } = parameterNamespace;
    const { ensureDrawingOrderState } = window.DrawingOrder;
    const blockState = window.BlockState.create({
      blockDefinitionDrawableSketchIds: blockCatalog.blockDefinitionDrawableSketchIds,
      blockDefinitionGeometrySketchIds: blockCatalog.blockDefinitionGeometrySketchIds, isDrawableSketch, firstDrawableSketchId,
    });
    function appearance() {
      window.DocumentState.normalizeAppearanceState(document, currentScope(), { blockEditing: Boolean(readBlockEditor()) });
    }
    function blocks() { blockState.normalize(document, currentScope(), readBlockEditor()?.draft?.id || null); }
    function prepare() {
      document.units = { ...window.DocumentState.DEFAULT_DOCUMENT_UNITS };
      ensureSketchState();
      appearance();
      blocks();
      ensureDrawingOrderState(currentScope());
      for (const definition of document.blockDefinitions) ensureDrawingOrderState(definition);
      ensureParameterNamespace(currentScope());
    }
    return Object.freeze({ appearance, blocks, prepare });
  }
  window.DocumentApplication = Object.freeze({ create, createPreparation });
})();
