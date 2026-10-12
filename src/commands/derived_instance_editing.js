/* Validate unified instance edits and preserve references before any history entry. */
(() => {
  "use strict";
  function create(d) {
    function commit(candidate, existing, inputs = {}) {
      const scope = d.currentScope(), snapshot = d.snapshotModelState(), oldList = scope.geometryInstances.slice();
      const target = existing || candidate, oldBundle = existing ? d.geometryInstanceBundle(existing) : null;
      const oldState = existing ? structuredClone(existing) : null, oldConstraints = scope.constraints.slice();
      try {
        if (existing) { for (const key of Object.keys(existing)) delete existing[key]; Object.assign(existing, structuredClone(candidate)); } else scope.geometryInstances.push(candidate);
        const bundles = d.geometryInstanceBundlesForScope(scope, d.blockProjectionBundles());
        const invalid = bundles.find(bundle => !bundle.valid); if (invalid) throw new Error(invalid.reason);
        const bundle = bundles.find(bundle => bundle.instance === target);
        const items = b => [...b.points, ...b.lines, ...b.circles, ...b.arcs, ...b.splines, ...(b.hatches || []), ...(b.controlPoints || [])];
        if (oldBundle) {
          const kept = new Set(items(bundle).map(item => item.id));
          const removed = new Set(items(oldBundle).filter(item => !kept.has(item.id)).map(item => item.id));
          const referencesRemoved = value => typeof value === "string" ? removed.has(value)
            : Array.isArray(value) ? removed.has(value.join("@")) || value.some(referencesRemoved)
            : value && typeof value === "object" ? Object.values(value).some(referencesRemoved) : false;
          const saved = d.serializeModel();
          if (referencesRemoved([saved.constraints, saved.annotations, saved.hatches, saved.geometryInstances.filter(item => item.id !== target.id)])) throw new Error("削除される図形・配置点に参照が残っています");
        }
        const point = bundle.controlPoints?.find(point => point.instanceControl === "placement");
        const anchor = bundle.controlPoints?.find(point => point.instanceControl === "anchor");
        if (inputs.destinationSnap && point) d.addPointSnapConstraints(point, inputs.destinationSnap);
        for (const [axis, value] of Object.entries(inputs.offsets || {})) {
          const C = window.GeometrySolver.InstanceAxisOffsetConstraint;
          const old = scope.constraints.find(c => c instanceof C && c.p2.id === point.id && c.axis === axis);
          if (old) old.target = value;
          else { const c = new C(point, anchor, value, axis); c.sketchId = target.sketchId; scope.constraints.push(c); }
        }
        d.rebind();
        const sources = d.geometryInstanceSourceObjects(target);
        const anchorChanged = oldState && JSON.stringify(oldState.anchor) !== JSON.stringify(target.anchor);
        const allowed = v => !sources.has(v.object) && v.object !== target.placement
          && (v.object !== target || anchorChanged && ["x", "y"].includes(v.prop));
        const solved = d.stabilize(target.sketchId, { variableAllowed: allowed });
        if (!solved.success || solved.dependent?.success === false || solved.result.errorNorm > d.acceptError) throw new Error("拘束が成立しないため変更を戻しました");
        if (window.PatternInstanceModel.error(target, d.resolveGeometryRef)) throw new Error("配置設定が不正です");
        if (!existing) scope.geometryInstances = oldList;
        Object.assign(candidate, structuredClone(target)); return true;
      } catch (error) {
        scope.geometryInstances = oldList; scope.constraints = oldConstraints; d.restoreModelState(snapshot);
        d.setHint(error.message, "error"); return false;
      }
    }
    function change(instance, key, value) {
      if (key === "reflected" && instance.type === "pattern") return false;
      const candidate = structuredClone(instance);
      if (["rotationLocked", "reflected"].includes(key)) candidate[key] = Boolean(value);
      else if (key === "rotation") candidate.rotation = Number(value) * Math.PI / 180;
      else if (key === "count") { if (!Number.isInteger(Number(value)) || Number(value) < 2 || Number(value) > 1001) return false; window.PatternInstanceModel.resize(candidate, Number(value)); }
      else if (key === "angleMode") candidate.placement.angleMode = value;
      else if (key === "angleStep") { candidate.placement.angleStep = Number(value) * Math.PI / 180; candidate.placement.angleSign = Math.sign(Number(value)); }
      else if (key === "spacing") candidate.placement.spacing = Number(value);
      else if (key === "reversed") candidate.placement.reversed = Boolean(value);
      else return false;
      if (String(value).trim() === "" || window.PatternInstanceModel.error(candidate)) return false;
      if (!commit(candidate, instance)) return false;
      d.recordHistory("派生配置設定変更"); d.updateUI(); d.draw(); return true;
    }
    function interval(pending, value, expression) {
      if (!Number.isFinite(value) || value === 0 || Math.abs(value) >= 360) return false;
      const instance = pending.target.instance, scope = d.currentScope(), snapshot = d.snapshotModelState();
      const oldConstraints = scope.constraints.slice();
      const constraint = pending.constraint || new window.GeometrySolver.InstanceAngleIntervalConstraint(pending.target.intervalCenter, value * Math.PI / 180);
      try {
        instance.placement.angleMode = "constraint"; instance.placement.angleSign = Math.sign(value); instance.placement.angleStep = value * Math.PI / 180;
        constraint.target = value * Math.PI / 180; constraint.expression = expression;
        constraint.dimension = pending.dimension || constraint.dimension; constraint.sketchId = instance.sketchId;
        if (!pending.constraint) scope.constraints.push(constraint);
        const sources = d.geometryInstanceSourceObjects(instance);
        const solved = d.stabilize(instance.sketchId, { variableAllowed: v => !sources.has(v.object) && !(v.object === instance && v.prop === "rotation") });
        if (!solved.success || solved.dependent?.success === false || solved.result.errorNorm > d.acceptError) throw new Error("角度間隔の拘束が成立しません");
        d.recordHistory("角度間隔寸法設定"); return true;
      } catch (error) { scope.constraints = oldConstraints; d.restoreModelState(snapshot); d.setHint(error.message, "error"); return false; }
    }
    return Object.freeze({ commit, change, interval });
  }
  window.DerivedInstanceEditing = Object.freeze({ create });
})();
