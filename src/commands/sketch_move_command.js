/* Keep move-destination selection separate from normal Canvas and Sketch selection. */
(() => {
  "use strict";
  function create({ currentScope, activeSketchId, selection, query, prepare, refresh, clearSelection,
    updateUI, draw, setHint, recordHistory, applicationText }) {
    let session = null;
    function reset() { session = null; }
    function current() {
      if (session && (session.scope !== currentScope() || session.sourceId !== activeSketchId())) reset();
      return session;
    }
    function state() {
      const value = current();
      if (!value) return null;
      const plan = query.collect(value.selection);
      const destinations = new Map(currentScope().sketches.map(sketch => [sketch.id, plan.ok ? query.destination(plan, sketch.id) : plan]));
      return { count: value.count, targetId: value.targetId, destinations, reason: value.reason,
        canCommit: Boolean(value.targetId && destinations.get(value.targetId)?.ok) };
    }
    function start() {
      const selected = Object.fromEntries(window.SketchMove.fields.map(field => [field, [...(selection[field] || [])]]));
      const check = query.collect(selection);
      if (!check.ok) { setHint(check.reason, "error"); return false; }
      prepare();
      session = { scope: currentScope(), sourceId: activeSketchId(), selection: selected, count: check.count, targetId: null, reason: "" };
      setHint(applicationText("スケッチツリーで移動先を選び、「移動」で確定してください。Escで取消します", "Choose a destination in the Sketch Tree, then click Move. Press Esc to cancel."));
      updateUI(); draw();
      return true;
    }
    function choose(targetId) {
      const value = current();
      if (!value) return false;
      const plan = query.collect(value.selection);
      const result = plan.ok ? query.destination(plan, targetId) : plan;
      value.targetId = result.ok ? targetId : null;
      value.reason = result.ok ? "" : result.reason;
      if (!result.ok) setHint(result.reason, "error");
      updateUI(); draw();
      return result.ok;
    }
    function cancel() {
      if (!current()) return false;
      reset(); updateUI(); draw();
      setHint(applicationText("スケッチ間の移動を取り消しました", "Cancelled the move between sketches"));
      return true;
    }
    function commit() {
      const value = current();
      if (!value || !value.targetId) return false;
      const result = query.apply(value.selection, value.targetId, refresh);
      if (!result.ok) {
        value.reason = result.reason;
        setHint(result.reason, "error"); updateUI(); draw(); return false;
      }
      const sketch = currentScope().sketches.find(item => item.id === value.targetId);
      reset(); clearSelection(); updateUI(); draw();
      recordHistory("スケッチ間の図形移動");
      setHint(applicationText(`${result.count}個の図形を ${sketch.name} (${sketch.id}) へ移動しました`, `Moved ${result.count} objects to ${sketch.name} (${sketch.id})`));
      return true;
    }
    return Object.freeze({ start, choose, commit, cancel, reset, state, get active() { return Boolean(current()); } });
  }
  window.SketchMoveCommand = Object.freeze({ create });
})();
