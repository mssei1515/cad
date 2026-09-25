/* Own candidate sources and commit validated changes to a derived instance. */
(() => {
  "use strict";
  function create({ currentScope, activeSketchId, exitDrawMode, cancelConstraintTargetCommand, cancelPendingCommand,
    clearSelection, canvasSelection, getMode, setMode, updateToolbar, updateUI, updatePropertiesUI,
    applicationText, setHint, draw, geometryRefForItem, isVisibleSketchElement, geometryRefsEqual,
    sketchProjectionEntryFromItem, sketchProjectionSourceIsCovered, elementSketchId,
    geometryInstanceBundlesForScope, blockProjectionBundles, geometryElementKey, geometryInstanceBundle,
    constraintGraphNodes, guardDimensionSymbolDeletion, annotationReferencesRemovedGeometry,
    clearSketchSolveState, recordHistory }) {
    let instanceSourceEdit = null;
    function startInstanceSourceEdit(instance) {
      const model = currentScope();
      if (!model.geometryInstances.includes(instance) || instance.sketchId !== activeSketchId()) return false;
      exitDrawMode();
      cancelConstraintTargetCommand("");
      cancelPendingCommand("");
      clearSelection();
      instanceSourceEdit = { instance, sources: [...instance.sources] };
      setMode("instance-sources");
      updateToolbar();
      updateUI({ refreshAnalysis: false });
      setHint(applicationText("対象図形をクリックして追加・解除。Enterで確定、Escで取消", "Click source geometry to add or remove it. Enter confirms; Esc cancels."));
      draw();
    }

    function toggleInstanceSource(item) {
      const model = currentScope();
      const edit = instanceSourceEdit;
      if (!edit || !item) return;
      // Clicking an output of this instance edits its corresponding source.
      if (item.derivedInstance === edit.instance) item = item.sourceElement;
      const ref = geometryRefForItem(item);
      if (!ref || !isVisibleSketchElement(item)) return;
      const index = edit.sources.findIndex((source) => geometryRefsEqual(source, ref));
      if (index >= 0) edit.sources.splice(index, 1);
      else {
        const eligible = edit.instance.type === "sketchProjection"
          ? sketchProjectionEntryFromItem(item) && (edit.instance.sources.some((source) => geometryRefsEqual(source, ref)) || !sketchProjectionSourceIsCovered(item, edit.instance.sketchId))
          : elementSketchId(item) === edit.instance.sketchId;
        if (!eligible) return;
        const candidate = { ...edit.instance, sources: [...edit.sources, ref] };
        const scope = { ...model, geometryInstances: model.geometryInstances.map((entry) => entry === edit.instance ? candidate : entry) };
        const bundle = geometryInstanceBundlesForScope(scope, blockProjectionBundles()).find((entry) => entry.instance === candidate);
        if (!bundle?.valid) return void setHint(bundle?.reason || applicationText("参照が無効です", "Invalid reference"), "error");
        edit.sources.push(ref);
      }
      updatePropertiesUI();
      draw();
    }

    function finishInstanceSourceEdit(commit) {
      const model = currentScope();
      const edit = instanceSourceEdit;
      if (!edit || getMode() !== "instance-sources") return false;
      const instance = edit.instance;
      if (commit) {
        if (!edit.sources.length) return void setHint(applicationText("対象図形を1件以上選択してください", "Select at least one source."), "error");
        // Keep retained sources in their original order, including the source
        // associated with a migrated projection's legacy output IDs.
        const sources = [...instance.sources.filter((ref) => edit.sources.some((entry) => geometryRefsEqual(ref, entry))),
          ...edit.sources.filter((ref) => !instance.sources.some((entry) => geometryRefsEqual(ref, entry)))];
        const candidate = { ...instance, sources };
        if (!geometryRefsEqual(sources[0], instance.sources[0])) delete candidate.legacyOutput;
        const scope = { ...model, geometryInstances: model.geometryInstances.map((entry) => entry === instance ? candidate : entry) };
        const bundles = geometryInstanceBundlesForScope(scope, blockProjectionBundles());
        const invalid = bundles.find((bundle) => !bundle.valid);
        if (invalid) return void setHint(`${invalid.instance.id}: ${invalid.reason}`, "error");
        const items = (bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines];
        const nextKeys = new Set(items(bundles.find((bundle) => bundle.instance === candidate)).map(geometryElementKey));
        const removed = items(geometryInstanceBundle(instance)).filter((item) => !nextKeys.has(geometryElementKey(item)));
        const removedKeys = new Set(removed.map(geometryElementKey));
        const removedIds = new Set(removed.map((item) => item.id));
        const constraints = new Set(model.constraints.filter((constraint) => constraintGraphNodes(constraint).some((node) => removedKeys.has(geometryElementKey(node)))));
        if (!guardDimensionSymbolDeletion(constraints)) return false;
        const changed = instance.sources.length !== edit.sources.length || instance.sources.some((ref) => !edit.sources.some((entry) => geometryRefsEqual(ref, entry)));
        if (changed) {
          instance.sources = sources;
          if (!candidate.legacyOutput) delete instance.legacyOutput;
          model.constraints = model.constraints.filter((constraint) => !constraints.has(constraint));
          model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
          clearSketchSolveState(instance.sketchId);
          recordHistory("派生インスタンス対象図形変更");
        }
      }
      instanceSourceEdit = null;
      setMode("select");
      clearSelection();
      canvasSelection.set("geometryInstances", [instance]);
      updateToolbar();
      updateUI();
      setHint(commit ? applicationText("対象図形を更新しました", "Source geometry updated.") : applicationText("対象図形の編集を取り消しました", "Source editing canceled."));
      draw();
      return true;
    }
    function reset() { instanceSourceEdit = null; }
    function includesRef(ref) { return Boolean(instanceSourceEdit?.sources.some(source => geometryRefsEqual(source, ref))); }
    return Object.freeze({ start: startInstanceSourceEdit, toggle: toggleInstanceSource, finish: finishInstanceSourceEdit, reset, includesRef,
      get instance() { return instanceSourceEdit?.instance || null; },
      get current() { return instanceSourceEdit ? { instance: instanceSourceEdit.instance, sources: [...instanceSourceEdit.sources] } : null; },
    });
  }
  window.InstanceSourceCommand = Object.freeze({ create });
})();
