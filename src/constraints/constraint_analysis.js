/* Own cached constraint classification for normal and projected geometry. */
(() => {
  "use strict";
  const { Point, Line, Circle, Arc, vectorNorm, variableDeltaInBasis } = window.GeometrySolver;
  const { lineSupportNormal } = window.GeometryKernel;
  function create({ currentScope, solver, scopeQuery, activeSketchId, descendantSketchIds, elementSketchId,
    geometryInstanceBundles, blockProjectionBundles, geometryInstanceSourcePoints,
    refreshReferenceConstraintValidity, refreshConstraintRedundancy, sketchHasSolveError,
    isEditableSketchElement, isExplicitPoint, minimumLength, acceptError, profileAnalysis }) {
    let constraintAnalysisState = null;
    const { sketchSolveVariables, sketchSolveConstraints, sketchSolveLines } = scopeQuery;
    function pointHasConstraintFreedom(point, analysis) {
      if (point.fixed) return false;
      const freedom = analysis.variableFreedom.get(point);
      return Boolean(freedom?.x || freedom?.y);
    }

    function objectHasConstraintFreedom(object, prop, analysis) {
      return Boolean(analysis.variableFreedom.get(object)?.[prop]);
    }

    function lineSupportHasConstraintFreedom(line, analysis) {
      const normal = analysis.lineNormals?.get(line) || lineSupportNormal(line);
      for (const basis of analysis.nullspaceBasis || []) {
        const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
        const p1Normal = normal.x * variableDeltaInBasis(line.p1, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p1, "y", basis, analysis);
        const p2Normal = normal.x * variableDeltaInBasis(line.p2, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p2, "y", basis, analysis);
        if (Math.abs(p1Normal) > 1e-7 * norm || Math.abs(p2Normal) > 1e-7 * norm) return true;
      }
      return false;
    }

    function classifyConstraintStatus(item, kind, analysis) {
      if (!analysis.stable) return "conflict";
      if (kind === "point") return pointHasConstraintFreedom(item, analysis) ? "under" : "full";
      if (kind === "line") {
        const hasEndpointFreedom = pointHasConstraintFreedom(item.p1, analysis) || pointHasConstraintFreedom(item.p2, analysis);
        if (!hasEndpointFreedom) return "full";
        return lineSupportHasConstraintFreedom(item, analysis) ? "under" : "support";
      }
      if (kind === "circle") return pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis) ? "under" : "full";
      if (kind === "arc") {
        const supportFreedom = pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis);
        const endpointFreedom = objectHasConstraintFreedom(item, "startAngle", analysis) || objectHasConstraintFreedom(item, "endAngle", analysis);
        if (!supportFreedom && !endpointFreedom) return "full";
        return !supportFreedom && endpointFreedom ? "support" : "under";
      }
      if (kind === "spline") return item.fitPoints.some((point) => pointHasConstraintFreedom(point, analysis)) ? "under" : "full";
      return "full";
    }

    function classifyBlockProjectionStatus(item, analysis) {
      if (!analysis.stable) return "conflict";
      const instance = item?.blockInstance;
      if (!instance || instance.fixed) return "full";
      const freedom = analysis.variableFreedom.get(instance) || {};
      const translationFree = Boolean(freedom.x || freedom.y);
      const rotationFree = Boolean(freedom.rotation);
      if (item instanceof Arc) {
        if (translationFree) return "under";
        return rotationFree ? "support" : "full";
      }
      if (item instanceof Circle || item instanceof Point) return translationFree ? "under" : "full";
      if (item instanceof Line) {
        if (!translationFree && !rotationFree) return "full";
        const length = Math.max(item.length(), minimumLength);
        const direction = { x: item.dx() / length, y: item.dy() / length };
        for (const basis of analysis.nullspaceBasis || []) {
          const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
          const dx = variableDeltaInBasis(instance, "x", basis, analysis);
          const dy = variableDeltaInBasis(instance, "y", basis, analysis);
          const dr = variableDeltaInBasis(instance, "rotation", basis, analysis);
          const normalMotion = -direction.y * dx + direction.x * dy;
          if (Math.abs(normalMotion) > 1e-7 * norm || Math.abs(dr) > 1e-7 * norm) return "under";
        }
        return "support";
      }
      return translationFree || rotationFree ? "under" : "full";
    }

    function refreshConstraintAnalysis(options = {}) {
      return profileAnalysis(() => refreshConstraintAnalysisUnprofiled(options));
    }

    function refreshConstraintAnalysisUnprofiled(options = {}) {
      refreshReferenceConstraintValidity();
      const rootSketchId = activeSketchId();
      const sketchIdSet = new Set([rootSketchId, ...descendantSketchIds(rootSketchId)]);
      const derivedBundles = geometryInstanceBundles().filter((bundle) => bundle.valid);
      let sourceSketchAdded = true;
      while (sourceSketchAdded) {
        sourceSketchAdded = false;
        for (const bundle of derivedBundles) {
          if (!sketchIdSet.has(bundle.instance.sketchId)) continue;
          const outputs = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines];
          for (const source of outputs.map((item) => item.sourceElement).filter(Boolean)) {
            const sourceSketchId = elementSketchId(source);
            if (!sourceSketchId || sketchIdSet.has(sourceSketchId)) continue;
            sketchIdSet.add(sourceSketchId);
            sourceSketchAdded = true;
          }
        }
      }
      const sketchIds = [...sketchIdSet];
      const analyses = new Map();
      const statuses = new Map();
      const items = [];
      for (const sketchId of sketchIds) {
        const analysis = solver.analyzeConstraintState({
          variables: sketchSolveVariables(sketchId),
          constraints: sketchSolveConstraints(sketchId),
          lines: sketchSolveLines(sketchId),
          errorTolerance: acceptError,
        });
        const forceConflict = sketchHasSolveError(sketchId);
        analyses.set(sketchId, analysis);
        for (const p of currentScope().points) {
          if (elementSketchId(p) !== sketchId) continue;
          const status = forceConflict ? "conflict" : classifyConstraintStatus(p, "point", analysis);
          statuses.set(p, status);
          if (isEditableSketchElement(p) && isExplicitPoint(p)) items.push(status);
        }
        for (const l of currentScope().lines) {
          if (elementSketchId(l) !== sketchId) continue;
          const status = forceConflict ? "conflict" : classifyConstraintStatus(l, "line", analysis);
          statuses.set(l, status);
          if (isEditableSketchElement(l)) items.push(status);
        }
        for (const c of currentScope().circles) {
          if (elementSketchId(c) !== sketchId) continue;
          const status = forceConflict ? "conflict" : classifyConstraintStatus(c, "circle", analysis);
          statuses.set(c, status);
          if (isEditableSketchElement(c)) items.push(status);
        }
        for (const a of currentScope().arcs) {
          if (elementSketchId(a) !== sketchId) continue;
          const status = forceConflict ? "conflict" : classifyConstraintStatus(a, "arc", analysis);
          statuses.set(a, status);
          if (isEditableSketchElement(a)) items.push(status);
        }
        for (const spline of currentScope().splines) {
          if (elementSketchId(spline) !== sketchId) continue;
          const status = forceConflict ? "conflict" : classifyConstraintStatus(spline, "spline", analysis);
          statuses.set(spline, status);
          if (isEditableSketchElement(spline)) items.push(status);
        }
        for (const bundle of blockProjectionBundles()) {
          if (bundle.instance.sketchId !== sketchId) continue;
          for (const item of [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]) {
            const status = forceConflict ? "conflict" : classifyBlockProjectionStatus(item, analysis);
            statuses.set(item, status);
            if (isEditableSketchElement(item) && !(item instanceof Point)) items.push(status);
          }
        }
      }
      const summary = {
        full: items.filter((status) => status === "full").length,
        support: items.filter((status) => status === "support").length,
        under: items.filter((status) => status === "under").length,
        conflict: items.filter((status) => status === "conflict").length,
        total: items.length,
      };
      constraintAnalysisState = { analysis: analyses.get(rootSketchId), analyses, statuses, summary };
      refreshConstraintRedundancy(options.redundancyBySketch || null);
      return snapshot();
    }

    function constraintStatusOf(item) {
      if (item?.derivedInstance?.type === "sketchProjection") return "full";
      if (!constraintAnalysisState) refreshConstraintAnalysis();
      let current = item;
      const visited = new Set();
      let hasFreePlacement = false;
      while (current?.derivedProjection && current.sourceElement && !visited.has(current)) {
        visited.add(current);
        if (current.derivedInstance?.type === "free") hasFreePlacement = true;
        current = current.sourceElement;
      }
      if (hasFreePlacement) {
        if (!constraintAnalysisState.statuses.has(item)) {
          constraintAnalysisState.statuses.set(item, classifyFreeInstanceGeometry(item, constraintAnalysisState.analyses.get(elementSketchId(item))));
        }
        return constraintAnalysisState.statuses.get(item);
      }
      return constraintAnalysisState?.statuses.get(current) || "full";
    }

    function classifyFreeInstanceGeometry(item, analysis) {
      if (!analysis?.stable) return "conflict";
      const sample = () => {
        const values = geometryInstanceSourcePoints(item).flatMap((p) => [p.x, p.y]);
        if (item instanceof Circle || item instanceof Arc) values.push(item.radius());
        if (item instanceof Arc) values.push(item.startPoint().x, item.startPoint().y, item.endPoint().x, item.endPoint().y);
        return values;
      };
      const baseline = sample();
      const derivatives = analysis.variables.map((v) => {
        const old = v.object[v.prop];
        const step = 1e-6 * Math.max(1, Math.abs(old));
        try {
          v.object[v.prop] = old + step;
          return sample().map((value, index) => (value - baseline[index]) / step);
        } finally { v.object[v.prop] = old; }
      });
      let hasMotion = false;
      for (const basis of analysis.nullspaceBasis) {
        const motion = baseline.map((_, i) => derivatives.reduce((sum, column, j) => sum + column[i] * basis[j], 0));
        const tolerance = 1e-5 * Math.max(1, vectorNorm(basis));
        if (vectorNorm(motion) <= tolerance) continue;
        hasMotion = true;
        if (!(item instanceof Line)) return "under";
        const length = Math.max(item.length(), minimumLength);
        const nx = -item.dy() / length, ny = item.dx() / length;
        if (Math.abs(nx * motion[0] + ny * motion[1]) > tolerance || Math.abs(nx * motion[2] + ny * motion[3]) > tolerance) return "under";
      }
      return hasMotion ? "support" : "full";
    }


    function snapshot() {
      if (!constraintAnalysisState) return null;
      const { analysis, analyses, statuses, summary } = constraintAnalysisState;
      return { analysis, analyses: new Map(analyses), statuses: new Map(statuses), summary: { ...summary } };
    }
    function ensure() {
      if (!constraintAnalysisState) refreshConstraintAnalysis();
    }
    return Object.freeze({
      refresh: refreshConstraintAnalysis, statusOf: constraintStatusOf, ensure,
      invalidate: () => { constraintAnalysisState = null; },
      summary: () => { ensure(); return { ...constraintAnalysisState.summary }; },
      get stable() { return constraintAnalysisState?.analysis?.stable; },
    });
  }
  window.ConstraintAnalysis = Object.freeze({ create });
})();
