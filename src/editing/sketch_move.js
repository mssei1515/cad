/* Plan and apply ownership transfers without copying geometry or solving coordinates. */
(() => {
  "use strict";
  const FIELDS = ["points", "lines", "circles", "arcs", "splines", "blockInstances", "hatches", "annotations", "referenceImages"];
  function create({ currentScope, activeSketchId, constraintGraphNodes, constraintSketchId,
    resolveGeometryRef, geometryInstanceDependencyRefs, isReferenceSourceSketchId, applicationText }) {
    const { boundaryGeometryRefs } = window.HatchRegionEngine;
    const { drawingOrderItemsForScope, orderedItems } = window.DrawingOrder;
    const owner = item => item?.blockInstance || item?.derivedInstance || item;
    const pointsOf = item => item.p1 && item.p2 ? [item.p1, item.p2] : item.center ? [item.center] : item.fitPoints || [];
    const label = item => item?.id || item?.name || item?.type || "?";
    const fail = (ja, en) => ({ ok: false, reason: applicationText(ja, en) });

    function collect(selection) {
      const scope = currentScope(), sourceId = activeSketchId();
      if (selection.geometryInstances?.length || selection.instanceGeometry || selection.inspection
        || selection.constraint || selection.dimensionConstraint || selection.dimensionConstraints?.length || selection.arcEndpoint || selection.arcEndpointPair) {
        return fail("派生図形・拘束・閲覧対象は移動できません", "Derived geometry, constraints, and inspected objects cannot be moved");
      }
      const groups = Object.fromEntries(FIELDS.map(field => [field, [...new Set(selection[field] || [])]]));
      const explicit = FIELDS.flatMap(field => groups[field]);
      if (!explicit.length) return fail("移動する図形を選択してください", "Select objects to move");
      for (const field of FIELDS) for (const item of groups[field]) {
        if (!(scope[field] || []).includes(item) || item.blockProjection || item.derivedProjection || item.sketchId !== sourceId) {
          return fail(`${label(item)} は移動できません。アクティブスケッチの通常図形を選択してください`, `${label(item)} cannot be moved; select objects in the active sketch`);
        }
      }
      groups.points = [...new Set([...groups.points, ...[...groups.lines, ...groups.circles, ...groups.arcs, ...groups.splines].flatMap(pointsOf)])];
      const items = FIELDS.flatMap(field => groups[field]), moved = new Set(items);
      for (const point of groups.points) {
        if (!scope.points.includes(point) || point.sketchId !== sourceId) return fail(`${label(point)} の所属が一致しません`, `${label(point)} belongs to another sketch`);
        const shared = [...scope.lines, ...scope.circles, ...scope.arcs, ...scope.splines].filter(item => !moved.has(item) && pointsOf(item).includes(point));
        if (shared.length) return fail(`${point.id} を共有する図形も選択してください: ${shared.map(label).join("、")}`, `Also select objects sharing ${point.id}: ${shared.map(label).join(", ")}`);
      }
      const isMoved = item => moved.has(owner(item));
      for (const hatch of scope.hatches || []) {
        const boundaries = boundaryGeometryRefs(hatch.boundaryLoops).map(resolveGeometryRef);
        if (!moved.has(hatch) && !boundaries.some(isMoved)) continue;
        const missing = boundaries.filter(item => !item || !isMoved(item));
        if (!moved.has(hatch) || missing.length) {
          const ids = !moved.has(hatch) ? [hatch.id] : boundaryGeometryRefs(hatch.boundaryLoops).filter(ref => !isMoved(resolveGeometryRef(ref))).map(ref => window.GeometryRef.id(ref));
          return fail(`塗りつぶしと全境界を一緒に選択してください: ${ids.join("、")}`, `Select the fill and all its boundaries: ${ids.join(", ")}`);
        }
      }
      for (const annotation of scope.annotations || []) {
        if (annotation.type !== "leader") continue;
        const target = resolveGeometryRef(annotation.geometryRef);
        if (!moved.has(annotation) && !isMoved(target)) continue;
        if (!target || moved.has(annotation) !== isMoved(target)) {
          return fail(`引出線と参照先を一緒に選択してください: ${moved.has(annotation) ? label(target) : annotation.id}`, `Select the leader and its target together: ${moved.has(annotation) ? label(target) : annotation.id}`);
        }
      }
      const constraints = [];
      for (const constraint of scope.constraints) {
        const nodes = constraintGraphNodes(constraint, { includeIntrinsicDependencies: false });
        if (!nodes.some(isMoved)) continue;
        const local = nodes.filter(node => owner(node).sketchId === constraintSketchId(constraint));
        if (local.some(isMoved) && local.some(node => !isMoved(node))) {
          const missing = [...new Set(local.filter(node => !isMoved(node)).map(label))];
          return fail(`拘束でつながる図形も選択してください: ${missing.join("、")}`, `Also select objects connected by constraints: ${missing.join(", ")}`);
        }
        constraints.push({ constraint, nodes, moveOwner: local.length > 0 && local.every(isMoved) });
      }
      return { ok: true, scope, sourceId, groups, items, moved, isMoved, constraints, count: explicit.length };
    }

    function destination(plan, targetId) {
      const scope = currentScope();
      if (!plan?.ok || plan.scope !== scope || plan.sourceId !== activeSketchId()) return fail("移動対象が変更されました", "The move source has changed");
      const sketch = scope.sketches.find(item => item.id === targetId);
      if (!sketch || sketch.kind === "root" || sketch.id === window.SketchHierarchy.ROOT_SKETCH_ID || targetId === plan.sourceId) {
        return fail("移動元とRoot以外のスケッチを選択してください", "Choose a sketch other than the source or Root");
      }
      const afterSketch = item => plan.isMoved(item) ? targetId : owner(item)?.sketchId;
      const updates = [];
      for (const { constraint, nodes, moveOwner } of plan.constraints) {
        const beforeOwner = constraintSketchId(constraint), newOwner = moveOwner ? targetId : beforeOwner;
        let referenceSketchId = constraint.referenceSketchId;
        if (constraint.readOnlyDimension) {
          if (!nodes.every(node => isReferenceSourceSketchId(afterSketch(node), newOwner))) {
            return fail(`測定寸法の先祖参照が成立しません: ${label(constraint)} (${beforeOwner})`, `Ancestor measurement is invalid: ${label(constraint)} (${beforeOwner})`);
          }
          const refs = nodes.filter(node => owner(node).sketchId === referenceSketchId);
          if (refs.length) referenceSketchId = afterSketch(refs[0]);
        } else if (constraint.reference) {
          const local = nodes.filter(node => owner(node).sketchId === beforeOwner);
          const refs = nodes.filter(node => owner(node).sketchId !== beforeOwner);
          const referenceIds = [...new Set(refs.map(afterSketch))];
          if (!local.length || referenceIds.length !== 1 || !local.every(node => afterSketch(node) === newOwner)
            || !isReferenceSourceSketchId(referenceIds[0], newOwner)) {
            return fail(`参照拘束の先祖関係が成立しません: ${label(constraint)} (${beforeOwner})`, `Reference constraint ancestry is invalid: ${label(constraint)} (${beforeOwner})`);
          }
          referenceSketchId = referenceIds[0];
        } else if (!nodes.every(node => afterSketch(node) === newOwner)) {
          return fail(`拘束でつながる図形を同じスケッチへ移動してください: ${label(constraint)}`, `Move constraint-connected objects to the same sketch: ${label(constraint)}`);
        }
        updates.push({ constraint, sketchId: newOwner, referenceSketchId });
      }
      for (const instance of scope.geometryInstances || []) {
        const dependencies = geometryInstanceDependencyRefs(instance).map(resolveGeometryRef);
        if (!dependencies.some(plan.isMoved)) continue;
        const valid = dependencies.every(item => item && (instance.type === "sketchProjection"
          ? isReferenceSourceSketchId(afterSketch(item), instance.sketchId)
          : afterSketch(item) === instance.sketchId));
        if (!valid) return fail(`派生インスタンス ${instance.id} の参照先Sketchが成立しません`, `Derived instance ${instance.id} would reference an invalid sketch`);
      }
      return { ok: true, targetId, updates };
    }

    function apply(selection, targetId, refresh) {
      const plan = collect(selection);
      if (!plan.ok) return plan;
      const result = destination(plan, targetId);
      if (!result.ok) return result;
      const ordered = orderedItems(plan.scope, plan.sourceId), target = orderedItems(plan.scope, targetId);
      const front = ordered.filter(item => plan.moved.has(item)), retained = ordered.filter(item => !plan.moved.has(item));
      const changed = new Set([...plan.items, ...result.updates.map(entry => entry.constraint), ...drawingOrderItemsForScope(plan.scope, plan.sourceId), ...target]);
      const snapshots = [...changed].map(item => ({ item, values: Object.fromEntries(["sketchId", "referenceSketchId", "drawingOrder"].map(key => [key, { present: Object.hasOwn(item, key), value: item[key] }])) }));
      const originalConstraints = plan.scope.constraints;
      try {
        for (const item of plan.items) item.sketchId = targetId;
        for (const entry of result.updates) {
          entry.constraint.sketchId = entry.sketchId;
          if (entry.constraint.reference || Object.hasOwn(entry.constraint, "referenceSketchId")) entry.constraint.referenceSketchId = entry.referenceSketchId;
        }
        retained.forEach((item, index) => { item.drawingOrder = index; });
        [...target, ...front].forEach((item, index) => { item.drawingOrder = index; });
        refresh();
      } catch (error) {
        plan.scope.constraints = originalConstraints;
        for (const { item, values } of snapshots) for (const [key, value] of Object.entries(values)) {
          if (value.present) item[key] = value.value; else delete item[key];
        }
        return fail(`移動できませんでした: ${error.message}`, `Move failed: ${error.message}`);
      }
      return { ok: true, count: plan.count };
    }
    return Object.freeze({ collect, destination, apply });
  }
  window.SketchMove = Object.freeze({ create, fields: Object.freeze(FIELDS) });
})();
