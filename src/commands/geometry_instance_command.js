/* Unified creation and edit draft. Finish commits atomically. */
(() => {
  "use strict";
  function create(d) {
    const M = window.PatternInstanceModel;
    let pending = null, editing = null, input = "sources", destination = null, destinationSnap = null, offsets = {}, previewing = false, requireAnchor = true;
    const invalidInputs = new Set();
    const active = () => pending && d.getMode().startsWith("pattern-placement-");
    const refresh = () => { if (active()) d.setMode(pending.type === "mirror" ? "pattern-placement-mirror" : pending.type === "circularPattern" ? "pattern-placement-circular" : "pattern-placement-place"); d.updateToolbar(); d.updateUI({ refreshAnalysis: false }); d.draw(); };
    function reset() { pending = editing = destination = destinationSnap = null; offsets = {}; previewing = false; requireAnchor = true; input = "sources"; invalidInputs.clear(); }
    function start(type = "pattern") {
      const selected = d.selectedItemsForGeometryInstance(); d.cancelConstraintTargetCommand(""); d.cancelPendingCommand("");
      if (!d.canCreateInActiveSketch()) return d.rejectRootSketchCreation();
      reset(); pending = M.createDraft({ id: d.previewFreeId(type), type, sketchId: d.activeSketchId(), sources: selected.map(d.geometryRefForItem).filter(Boolean), appearanceOverride: {} });
      d.clearSelection(); input = pending.sources.length ? (type === "mirror" ? "reference" : "origin") : "sources"; d.setMode("pattern-placement-origin"); refresh();
    }
    function startEdit(instance, key = "origin") {
      d.cancelConstraintTargetCommand(""); d.cancelPendingCommand(""); reset(); editing = instance; pending = structuredClone(instance);
      if (!M.placed(pending) && key !== "sources") key = "reference";
      requireAnchor = key === "origin"; destination = pending.placementPointDefined ? { x: pending.x, y: pending.y } : null; input = key;
      d.setMode("pattern-placement-place"); d.clearSelection(); refresh();
    }
    function selectInput(key) { if (!active()) return false; input = key; previewing = key === "destination"; refresh(); return true; }
    function toggleSource(item, { deferRefresh = false } = {}) {
      if (editing && item?.derivedInstance === editing) item = item.sourceElement;
      if (!active() || !item || item.instanceControl || d.elementSketchId(item) !== pending.sketchId || !d.isVisibleSketchElement(item)) return false;
      const ref = d.geometryRefForItem(item); if (!ref) return false;
      const index = pending.sources.findIndex(source => d.geometryRefsEqual(source, ref));
      if (index < 0) pending.sources.push(ref); else pending.sources.splice(index, 1);
      if (!deferRefresh) refresh(); return true;
    }
    function addSources(items) { let changed = false; for (const item of items) if (!pending.sources.some(ref => d.geometryRefsEqual(ref, d.geometryRefForItem(item)))) changed = toggleSource(item, { deferRefresh: true }) || changed; if (changed) refresh(); }
    function removeInput(key, index = 0) {
      if (!active()) return false;
      if (key === "sources") pending.sources.splice(index, 1);
      else if (key === "origin") { const point = M.anchorPoint(pending, d.resolveGeometryRef); if (point) pending.anchor.fallbackPosition = { x: point.x, y: point.y }; pending.anchor.relation = null; requireAnchor = true; }
      else if (key === "destination") { destination = destinationSnap = null; offsets = {}; }
      else if (key === "reference") { delete pending.placement.axis; delete pending.placement.direction; }
      else return false;
      input = key; refresh(); return true;
    }
    function placeFree(point, snap) {
      if (!active()) return false;
      if (input === "origin") {
        const relation = M.relationFromSnap(pending, snap, d.geometryRefForItem, d.resolveGeometryRef);
        if (!relation) { d.setHint(d.applicationText("コピー対象の点・端点・線の中点を指定してください", "Pick a source point, endpoint or line midpoint."), "error"); return false; }
        pending.anchor = { relation, fallbackPosition: { x: point.x, y: point.y } }; requireAnchor = false;
      } else if (input === "destination") { destination = { x: point.x, y: point.y }; pending.placementPointDefined = true; destinationSnap = snap; offsets = {}; Object.assign(pending, destination); previewing = false; }
      else return false;
      refresh(); return true;
    }
    function selectReference(line) { if (!active() || !line?.p1 || d.elementSketchId(line) !== pending.sketchId) return false; pending.placement[pending.placement.kind === "axisReflection" ? "axis" : "direction"] = d.geometryRefForItem(line); refresh(); return true; }
    function applySetting(key, value) {
      if (!active()) return false;
      if (key === "reflected" || key === "angleMode" || key === "rotationLocked" && pending.placement.kind === "circular") return false;
      if (key === "count") { const count = Number(value); if (!Number.isInteger(count) || count < 2 || count > 1001) return false; M.resize(pending, count); }
      else if (key === "rotationLocked") pending[key] = Boolean(value);
      else if (key === "rotation") { if (!String(value).trim() || !Number.isFinite(Number(value))) return false; pending.rotation = Number(value) * Math.PI / 180; }
      else if (key === "angleStep") { const angle = Number(value) * Math.PI / 180; if (!String(value).trim() || !Number.isFinite(angle) || !angle || Math.abs(angle) >= Math.PI * 2) return false; pending.placement.angleStep = angle; pending.placement.angleSign = Math.sign(angle); }
      else if (["offsetX", "offsetY"].includes(key)) {
        const a = M.anchorPoint(pending, d.resolveGeometryRef); if (!a || !String(value).trim() || !Number.isFinite(Number(value))) return false;
        const axis = key === "offsetX" ? "x" : "y"; offsets[axis] = Number(value); pending[axis] = a[axis] + Number(value); pending.placementPointDefined = true; destination = { x: pending.x, y: pending.y }; destinationSnap = null;
      } else if (key === "spacing") pending.placement.spacing = Number(value);
      else if (key === "reversed") pending.placement.reversed = Boolean(value);
      else return false;
      refresh(); return true;
    }
    function canFinish() {
      if (!active() || invalidInputs.size || !pending.sources.length || M.error(pending, d.resolveGeometryRef)) return false;
      if (pending.sources.some(ref => { const item = d.resolveGeometryRef(ref); return !item || !d.isVisibleSketchElement(item); })) return false;
      if (M.placed(pending) && requireAnchor) return false;
      return pending.placement.kind !== "linear" || Boolean(destination);
    }
    function finish() {
      if (!canFinish()) return false;
      if (editing) {
        pending.sources = [...editing.sources.filter(ref => pending.sources.some(source => M.sameRef(source, ref))), ...pending.sources.filter(ref => !editing.sources.some(source => M.sameRef(source, ref)))];
        if (!M.sameRef(pending.sources[0], editing.sources[0])) delete pending.legacyOutput;
        if (JSON.stringify(pending) === JSON.stringify(editing) && !destinationSnap && !Object.keys(offsets).length) {
          const selected = editing; reset(); d.setMode("select"); d.clearSelection(); d.canvasSelection.set("geometryInstances", [selected]); refresh(); return true;
        }
      }
      const instance = pending, oldId = instance.id;
      if (!editing) instance.id = d.previewFreeId(instance.type);
      if (d.commitDraft && !d.commitDraft(instance, editing, { destinationSnap, offsets })) { instance.id = oldId; return false; }
      if (!editing) { instance.id = d.nextInstanceId(instance.type); d.currentScope().geometryInstances.push(instance); }
      else { for (const key of Object.keys(editing)) delete editing[key]; Object.assign(editing, structuredClone(instance)); }
      const selected = editing || instance; reset(); d.setMode("select"); d.clearSelection(); d.canvasSelection.set("geometryInstances", [selected]); d.recordHistory("派生配置設定"); refresh(); return true;
    }
    function preview(pointer) {
      if (!active() || !pending.sources.length || !M.anchorPoint(pending, d.resolveGeometryRef)) return null;
      const draft = structuredClone(pending);
      if (previewing && pointer && draft.placement.kind === "linear") Object.assign(draft, pointer);
      const resolved = draft.sources.map(ref => ({ ref, item: d.resolveGeometryRef(ref) }));
      if (resolved.some(entry => !entry.item) || M.error(draft, d.resolveGeometryRef)) return null;
      return d.createGeometryInstanceBundle(draft, resolved, d.resolveGeometryRef(draft.placement.axis), d.resolveGeometryRef(draft.placement.direction));
    }
    function cancel() { if (!active()) return false; const previous = editing; reset(); d.setMode("select"); if (previous) { d.clearSelection(); d.canvasSelection.set("geometryInstances", [previous]); } refresh(); return true; }
    function changeSetting(key, value) {
      const valid = applySetting(key, value);
      if (valid) invalidInputs.delete(key); else invalidInputs.add(key);
      refresh(); return valid;
    }
    return Object.freeze({ start, startEdit, selectInput, toggleSource, addSources, removeInput, placeFree, selectReference, changeSetting, canFinish, finish, preview, reset, cancel,
      clearSources: reset, clearPlacement: reset, validSettings: canFinish, isPlacing: instance => instance === pending,
      get pending() { return pending; }, get editing() { return editing; }, get activeInput() { return input; }, get sources() { return pending?.sources || []; },
      get origin() { return pending && (!requireAnchor || pending.anchor.relation) ? M.anchorPoint(pending, d.resolveGeometryRef) : null; }, get destination() { return destination; },
      get reference() { return pending && d.resolveGeometryRef(pending.placement.axis || pending.placement.direction); }, get settings() { return pending?.placement || {}; } });
  }
  window.GeometryInstanceCommand = Object.freeze({ create });
})();
