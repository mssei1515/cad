/* Coordinate clipboard operations; model construction and session state have separate owners. */
(() => {
  "use strict";
  function create({ session, graph, checkpoint, selection, isGeometryMode, buildCopyPayload,
    canCreate, blockDefinitionScopeError, currentTarget, parameterTarget, clearSelection,
    finishPaste, recoverView, sketchName, setHint, updateToolbar }) {
    function copy(options = {}) {
      if (!isGeometryMode()) return false;
      const payload = buildCopyPayload();
      if (!payload) {
        setHint("コピーする図形を選択してください", "error");
        updateToolbar();
        return false;
      }
      const deleted = session.copy(payload, options.cut);
      if (options.cut) {
        if (deleted) setHint(`図形をカットしました（${session.count(payload)}要素）`);
        return deleted;
      }
      setHint(`図形をコピーしました（${session.count(payload)}要素）`);
      return true;
    }
    function paste() {
      if (!isGeometryMode() || !session.payload) {
        setHint("貼り付ける図形がありません", "error");
        return false;
      }
      if (!canCreate()) return false;
      const payload = session.payload;
      if (payload.blockInstances.length > 0) {
        const invalid = payload.blockInstances.find(instance => blockDefinitionScopeError(instance.definitionId));
        if (invalid) {
          setHint(blockDefinitionScopeError(invalid.definitionId), "error");
          return false;
        }
      }
      const target = currentTarget();
      const pastePlan = session.preparePaste(target.scale);
      const { dx, dy } = pastePlan;
      const saved = checkpoint.capture(target.model);
      try {
        const pasted = graph.append(target.model, payload, { sketchId: target.sketchId, dx, dy, ...parameterTarget() });
        clearSelection();
        selection.applyClipboard(payload.selection, pasted.maps, pasted);
        session.recordPaste(pastePlan);
        finishPaste();
        setHint(`${sketchName(target.sketchId)} に図形を貼り付けました（${session.count(payload)}要素）`);
        return true;
      } catch (error) {
        saved.rollback();
        recoverView();
        setHint(`貼り付けに失敗しました: ${error.message}`, "error");
        return false;
      }
    }
    return Object.freeze({ copy, paste });
  }
  window.ClipboardCommand = Object.freeze({ create });
})();
