/* Read Block extents and placement centers across nested definitions. */
(() => {
  "use strict";
  const { angleOnSignedSweep } = window.GeometryKernel;
  const { splineBBox } = window.GeometryBounds;
  const { resolveBoundary: resolveHatchBoundaryLoops } = window.HatchRegionEngine;
  function create({ catalog, projections, instanceProjections, annotationBounds, hatchPrimitivesForScope }) {
    const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockInstanceEnabledSketchSet } = catalog;
    const { blockWorldPoint, createBlockProjectionBundle } = projections;
    const { geometryInstanceBundlesForScope, emptyGeometryInstanceBundle } = instanceProjections;
    function blockLocalGeometryBounds(definition, enabledSketchIds = blockDefinitionDrawableSketchIds(definition), visiting = new Set()) {
      if (!definition) return null;
      if (visiting.has(definition.id)) return null;
      const nextVisiting = new Set(visiting).add(definition.id);
      const enabled = new Set(enabledSketchIds);
      const points = [];
      for (const line of definition.lines || []) {
        if (!enabled.has(String(line.sketchId))) continue;
        points.push(line.p1, line.p2);
      }
      for (const circle of definition.circles || []) {
        if (!enabled.has(String(circle.sketchId))) continue;
        points.push({ x: circle.center.x - circle.radius(), y: circle.center.y - circle.radius() }, { x: circle.center.x + circle.radius(), y: circle.center.y + circle.radius() });
      }
      for (const arc of definition.arcs || []) {
        if (!enabled.has(String(arc.sketchId))) continue;
        const samples = [arc.startAngle, arc.endAngle, 0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        for (const angle of samples) {
          if (angle === arc.startAngle || angle === arc.endAngle || angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) {
            points.push({ x: arc.center.x + Math.cos(angle) * arc.radius(), y: arc.center.y + Math.sin(angle) * arc.radius() });
          }
        }
      }
      for (const spline of definition.splines || []) {
        if (!enabled.has(String(spline.sketchId))) continue;
        const bounds = splineBBox(spline);
        if (bounds) points.push({ x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y2 });
      }
      for (const annotation of definition.annotations || []) {
        if (!enabled.has(String(annotation.sketchId)) || annotation.visible === false) continue;
        const bounds = annotationBounds(annotation);
        if (bounds) points.push({ x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y2 });
      }
      for (const hatch of definition.hatches || []) {
        if (!enabled.has(String(hatch.sketchId)) || hatch.appearance?.visible === false) continue;
        const resolved = resolveHatchBoundaryLoops(hatch.boundaryLoops, hatchPrimitivesForScope(definition, hatch.sketchId));
        if (resolved.ok) for (const loop of resolved.loops) points.push(...loop.points);
        else if (hatch.seed) points.push(hatch.seed);
      }
      for (const instance of definition.blockInstances || []) {
        if (!enabled.has(String(instance.sketchId))) continue;
        const nestedDefinition = blockDefinitionById(instance.definitionId);
        const nestedBounds = blockLocalGeometryBounds(nestedDefinition, [...blockInstanceEnabledSketchSet(instance, nestedDefinition)], nextVisiting);
        if (!nestedBounds) continue;
        for (const localPoint of [
          { x: nestedBounds.minX, y: nestedBounds.minY },
          { x: nestedBounds.minX, y: nestedBounds.maxY },
          { x: nestedBounds.maxX, y: nestedBounds.minY },
          { x: nestedBounds.maxX, y: nestedBounds.maxY },
        ]) points.push(blockWorldPoint(instance, localPoint));
      }
      if ((definition.geometryInstances || []).length > 0) {
        const nestedBundles = (definition.blockInstances || []).map((instance) => {
          const nestedDefinition = blockDefinitionById(instance.definitionId);
          return nestedDefinition ? createBlockProjectionBundle(instance, nestedDefinition) : emptyGeometryInstanceBundle(instance);
        });
        for (const bundle of geometryInstanceBundlesForScope(definition, nestedBundles)) {
          if (!bundle.valid || !enabled.has(String(bundle.instance.sketchId))) continue;
          points.push(...bundle.points);
          for (const circle of bundle.circles) {
            points.push({ x: circle.center.x - circle.radius(), y: circle.center.y - circle.radius() }, { x: circle.center.x + circle.radius(), y: circle.center.y + circle.radius() });
          }
          for (const arc of bundle.arcs) {
            const samples = [arc.startAngle, arc.endAngle, 0, Math.PI / 2, Math.PI, Math.PI * 1.5];
            for (const angle of samples) {
              if (angle === arc.startAngle || angle === arc.endAngle || angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) {
                points.push({ x: arc.center.x + Math.cos(angle) * arc.radius(), y: arc.center.y + Math.sin(angle) * arc.radius() });
              }
            }
          }
          for (const spline of bundle.splines || []) {
            const bounds = splineBBox(spline);
            if (bounds) points.push({ x: bounds.x1, y: bounds.y1 }, { x: bounds.x2, y: bounds.y2 });
          }
        }
      }
      if (points.length === 0) return null;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { minX, minY, maxX, maxY, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
    }

    function blockInstanceDisplayCenter(instance) {
      const definition = blockDefinitionById(instance?.definitionId);
      const bounds = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(instance, definition)]);
      const center = bounds?.center || definition?.origin || { x: 0, y: 0 };
      return blockWorldPoint(instance, center);
    }

    function blockInstanceTranslationForAnchor(definition, enabledSketchIds, anchor, rotation) {
      const localCenter = blockLocalGeometryBounds(definition, enabledSketchIds)?.center || definition?.origin || { x: 0, y: 0 };
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      return {
        x: anchor.x - localCenter.x * cos + localCenter.y * sin,
        y: anchor.y - localCenter.x * sin - localCenter.y * cos,
        localCenter,
      };
    }


    return Object.freeze({ blockLocalGeometryBounds, blockInstanceDisplayCenter, blockInstanceTranslationForAnchor });
  }
  window.BlockLayout = Object.freeze({ create });
})();
