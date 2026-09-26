/* Block Geometry read views, nested transforms and projection cache ownership. */
(function () {
  "use strict";
  const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;
  const { id: geometryRefId, create: createGeometryRef } = window.GeometryRef;
  const { serializeAnnotation } = window.AnnotationData;
  const { serializeHatch } = window.HatchData;
  const { normalizeAppearance, normalizeHatchAppearance } = window.Appearance;
  const { resolveBoundary: resolveHatchBoundaryLoops } = window.HatchRegionEngine;
  function create({ blockCatalog, geometryInstanceBundlesForScope, emptyGeometryInstanceBundle, hatchPrimitivesFromElements, hatchPrimitivesForScope }) {
    const { blockDefinitionById, blockDefinitionDrawableSketchIds, blockInstanceEnabledSketchSet } = blockCatalog;
    const blockProjectionCache = new Map();

    function blockProjectionId(kind, instance, localElement) {
      const localRef = createGeometryRef(kind, Array.isArray(localElement) ? localElement : typeof localElement === "string" ? localElement : localElement?.id);
      if (!localRef) return "";
      return geometryRefId(createGeometryRef(kind, [String(instance.id), ...localRef.path])) || "";
    }

    function blockProjectionLocalId(item) {
      return item?.blockLocalId || item?.localElement?.id || null;
    }

    function blockWorldPoint(instance, localPoint) {
      const cos = Math.cos(instance.rotation);
      const sin = Math.sin(instance.rotation);
      return {
        x: instance.x + localPoint.x * cos - localPoint.y * sin,
        y: instance.y + localPoint.x * sin + localPoint.y * cos,
      };
    }

    function createProjectedPoint(transform, ownerInstance, definition, localPoint, localPath) {
      const point = new Point(blockProjectionId("point", ownerInstance, localPath), 0, 0, false, localPoint.kind || "endpoint");
      Object.defineProperties(point, {
        x: { configurable: true, enumerable: true, get: () => blockWorldPoint(transform, localPoint).x },
        y: { configurable: true, enumerable: true, get: () => blockWorldPoint(transform, localPoint).y },
      });
      point.sketchId = ownerInstance.sketchId;
      point.blockProjection = true;
      point.blockInstance = ownerInstance;
      point.blockDefinition = definition;
      point.localElement = localPoint;
      point.blockLocalId = geometryRefId(createGeometryRef("point", localPath));
      return point;
    }

    function blockProjectionAnnotationId(ownerInstance, localPath) {
      return [String(ownerInstance.id), ...localPath.map(String)].join("/");
    }

    function createProjectedAnnotation(transform, ownerInstance, definition, localAnnotation, localPath, appearanceOverrides = []) {
      const transformPoint = (point) => point ? blockWorldPoint(transform, point) : null;
      const projected = {
        ...serializeAnnotation(localAnnotation),
        id: blockProjectionAnnotationId(ownerInstance, localPath),
        sketchId: ownerInstance.sketchId,
        x: blockWorldPoint(transform, { x: localAnnotation.x, y: localAnnotation.y }).x,
        y: blockWorldPoint(transform, { x: localAnnotation.x, y: localAnnotation.y }).y,
        start: transformPoint(localAnnotation.start),
        elbow: transformPoint(localAnnotation.elbow),
        end: transformPoint(localAnnotation.end),
        rotation: (Number(localAnnotation.rotation) || 0) + (Number(transform.rotation) || 0),
        style: { ...(localAnnotation.style || {}) },
        blockProjection: true,
        blockInstance: ownerInstance,
        blockDefinition: definition,
        localElement: localAnnotation,
        blockLocalId: localPath.join("/"),
        blockAppearanceOverrides: appearanceOverrides,
      };
      if (localAnnotation.geometryRef?.kind && Array.isArray(localAnnotation.geometryRef.path)) {
        projected.geometryRef = createGeometryRef(localAnnotation.geometryRef.kind, [...localPath.slice(0, -1), ...localAnnotation.geometryRef.path]);
        if (projected.geometryRef) projected.geometryRef = createGeometryRef(projected.geometryRef.kind, [String(ownerInstance.id), ...projected.geometryRef.path]);
      }
      for (const override of appearanceOverrides) {
        const normalized = normalizeAppearance(override);
        if (normalized.color) projected.style.color = normalized.color;
        if (normalized.lineWidth != null) projected.style.lineWidth = normalized.lineWidth;
        if (Object.prototype.hasOwnProperty.call(normalized, "visible")) projected.visible = normalized.visible !== false;
      }
      return projected;
    }

    function blockProjectionHatchId(ownerInstance, localPath) {
      return [String(ownerInstance.id), ...localPath.map(String)].join("/");
    }

    function createProjectedHatch(transform, ownerInstance, definition, localHatch, localPath, appearanceOverrides = [], localGeometry = null) {
      const primitives = localGeometry
        ? hatchPrimitivesFromElements(localGeometry, localHatch.sketchId)
        : hatchPrimitivesForScope(definition, localHatch.sketchId);
      const localResolved = resolveHatchBoundaryLoops(localHatch.boundaryLoops, primitives);
      const appearance = normalizeHatchAppearance(localHatch.appearance);
      for (const override of appearanceOverrides) {
        const normalized = normalizeAppearance(override);
        if (normalized.color) appearance.color = normalized.color;
        if (normalized.lineWidth != null) appearance.lineWidth = normalized.lineWidth;
        if (Object.prototype.hasOwnProperty.call(normalized, "visible")) appearance.visible = normalized.visible !== false;
      }
      const projectResolvedBoundary = () => localResolved.ok
        ? {
            ok: true,
            epsilon: localResolved.epsilon,
            loops: localResolved.loops.map((loop) => ({
              role: loop.role,
              points: loop.points.map((point) => blockWorldPoint(transform, point)),
            })),
          }
        : localResolved;
      const projected = {
        ...serializeHatch(localHatch),
        id: blockProjectionHatchId(ownerInstance, localPath),
        sketchId: ownerInstance.sketchId,
        blockProjection: true,
        blockInstance: ownerInstance,
        blockDefinition: definition,
        localElement: localHatch,
        blockLocalId: localPath.join("/"),
        blockAppearanceOverrides: appearanceOverrides,
      };
      Object.defineProperties(projected, {
        seed: { configurable: true, enumerable: true, get: () => blockWorldPoint(transform, localHatch.seed) },
        patternOrigin: { configurable: true, enumerable: true, get: () => blockWorldPoint(transform, { x: 0, y: 0 }) },
        appearance: { configurable: true, enumerable: true, get: () => ({ ...appearance, angle: appearance.angle + (Number(transform.rotation) || 0) * 180 / Math.PI }) },
        resolvedBoundary: { configurable: true, enumerable: true, get: projectResolvedBoundary },
      });
      return projected;
    }

    function createBlockProjectionBundle(instance, definition, enabledSketchIdsOverride = null, options = {}) {
      if (!definition) return { points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [], annotations: [], pointByLocalId: new Map() };
      const visiting = options.visiting || new Set();
      if (visiting.has(definition.id)) return { points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [], annotations: [], pointByLocalId: new Map() };
      const nextVisiting = new Set(visiting).add(definition.id);
      const ownerInstance = options.ownerInstance || instance;
      const pathPrefix = Array.isArray(options.pathPrefix) ? options.pathPrefix.map(String) : [];
      const definitionResolver = options.definitionResolver || blockDefinitionById;
      const includeAllSketches = Boolean(options.includeAllSketches);
      const appearanceOverrides = [instance.appearanceOverride, ...(options.appearanceOverrides || [])].filter(Boolean);
      const enabledSketchIds = includeAllSketches
        ? new Set(blockDefinitionDrawableSketchIds(definition))
        : enabledSketchIdsOverride
        ? new Set(enabledSketchIdsOverride.map(String))
        : blockInstanceEnabledSketchSet(instance, definition);
      const localPath = (id) => [...pathPrefix, String(id)];
      const localId = (kind, id) => geometryRefId(createGeometryRef(kind, localPath(id)));
      const pointByLocalId = new Map();
      const allPoints = definition.points.map((localPoint) => {
        const path = localPath(localPoint.id);
        const point = createProjectedPoint(instance, ownerInstance, definition, localPoint, path);
        point.blockAppearanceOverrides = appearanceOverrides;
        pointByLocalId.set(localId("point", localPoint.id), point);
        return point;
      });
      const mark = (item, localElement, kind) => {
        const path = localPath(localElement.id);
        item.id = blockProjectionId(kind, ownerInstance, path);
        item.sketchId = ownerInstance.sketchId;
        item.blockProjection = true;
        item.blockInstance = ownerInstance;
        item.blockDefinition = definition;
        item.localElement = localElement;
        item.blockLocalId = geometryRefId(createGeometryRef(kind, path));
        item.blockAppearanceOverrides = appearanceOverrides;
        return item;
      };
      const lines = definition.lines.filter((localLine) => enabledSketchIds.has(String(localLine.sketchId))).map((localLine) => mark(new Line(localLine.id, pointByLocalId.get(localId("point", localLine.p1.id)), pointByLocalId.get(localId("point", localLine.p2.id)), localLine.construction), localLine, "line"));
      const circles = definition.circles.filter((localCircle) => enabledSketchIds.has(String(localCircle.sketchId))).map((localCircle) => {
        const circle = mark(new Circle(localCircle.id, pointByLocalId.get(localId("point", localCircle.center.id)), localCircle.radius(), localCircle.construction), localCircle, "circle");
        Object.defineProperty(circle, "radiusValue", { configurable: true, enumerable: true, get: () => localCircle.radius() });
        return circle;
      });
      const arcs = definition.arcs.filter((localArc) => enabledSketchIds.has(String(localArc.sketchId))).map((localArc) => {
        const arc = mark(new Arc(localArc.id, pointByLocalId.get(localId("point", localArc.center.id)), localArc.radius(), localArc.startAngle, localArc.endAngle, localArc.construction), localArc, "arc");
        Object.defineProperties(arc, {
          radiusValue: { configurable: true, enumerable: true, get: () => localArc.radius() },
          startAngle: { configurable: true, enumerable: true, get: () => localArc.startAngle + instance.rotation },
          endAngle: { configurable: true, enumerable: true, get: () => localArc.endAngle + instance.rotation },
        });
        return arc;
      });
      const splines = (definition.splines || []).filter((localSpline) => enabledSketchIds.has(String(localSpline.sketchId))).map((localSpline) => {
        const fitPoints = localSpline.fitPoints.map((point) => pointByLocalId.get(localId("point", point.id))).filter(Boolean);
        return mark(new Spline(localSpline.id, fitPoints, localSpline.closed, localSpline.construction), localSpline, "spline");
      });
      const localBlockBundles = (definition.blockInstances || []).map((nestedInstance) => {
        const nestedDefinition = definitionResolver(nestedInstance.definitionId);
        return nestedDefinition ? createBlockProjectionBundle(nestedInstance, nestedDefinition, null, { definitionResolver, includeAllSketches: true, visiting: nextVisiting }) : emptyGeometryInstanceBundle(nestedInstance);
      });
      const localDerivedBundles = (definition.geometryInstances || []).length > 0 ? geometryInstanceBundlesForScope(definition, localBlockBundles) : [];
      const localHatchGeometry = [
        ...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || []), ...(definition.splines || []),
        ...localBlockBundles.flatMap((bundle) => [...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]),
        ...localDerivedBundles.flatMap((bundle) => [...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]),
      ];
      const annotations = (definition.annotations || [])
        .filter((localAnnotation) => enabledSketchIds.has(String(localAnnotation.sketchId)))
        .map((localAnnotation) => createProjectedAnnotation(instance, ownerInstance, definition, localAnnotation, localPath(localAnnotation.id), appearanceOverrides));
      const hatches = (definition.hatches || [])
        .filter((localHatch) => enabledSketchIds.has(String(localHatch.sketchId)))
        .map((localHatch) => createProjectedHatch(instance, ownerInstance, definition, localHatch, localPath(localHatch.id), appearanceOverrides, localHatchGeometry));
      const visiblePointIds = new Set();
      for (const line of lines) visiblePointIds.add(line.p1.id).add(line.p2.id);
      for (const primitive of [...circles, ...arcs]) visiblePointIds.add(primitive.center.id);
      for (const spline of splines) for (const point of spline.fitPoints) visiblePointIds.add(point.id);
      for (const localPoint of definition.points) if (enabledSketchIds.has(String(localPoint.sketchId)) && localPoint.kind === "explicit") visiblePointIds.add(blockProjectionId("point", ownerInstance, localPath(localPoint.id)));
      const points = allPoints.filter((point) => visiblePointIds.has(point.id));
      for (const nestedInstance of definition.blockInstances || []) {
        if (!enabledSketchIds.has(String(nestedInstance.sketchId))) continue;
        const nestedDefinition = definitionResolver(nestedInstance.definitionId);
        if (!nestedDefinition) continue;
        const nestedTransform = { ...nestedInstance, sketchId: ownerInstance.sketchId };
        Object.defineProperties(nestedTransform, {
          x: { configurable: true, enumerable: true, get: () => blockWorldPoint(instance, nestedInstance).x },
          y: { configurable: true, enumerable: true, get: () => blockWorldPoint(instance, nestedInstance).y },
          rotation: { configurable: true, enumerable: true, get: () => instance.rotation + nestedInstance.rotation },
        });
        const nestedPath = localPath(nestedInstance.id);
        const nestedBundle = createBlockProjectionBundle(nestedTransform, nestedDefinition, null, {
          ownerInstance,
          pathPrefix: nestedPath,
          definitionResolver,
          includeAllSketches,
          visiting: nextVisiting,
          appearanceOverrides,
        });
        points.push(...nestedBundle.points);
        lines.push(...nestedBundle.lines);
        circles.push(...nestedBundle.circles);
        arcs.push(...nestedBundle.arcs);
        splines.push(...nestedBundle.splines);
        hatches.push(...nestedBundle.hatches);
        annotations.push(...nestedBundle.annotations);
        for (const [id, point] of nestedBundle.pointByLocalId) pointByLocalId.set(id, point);
      }
      if ((definition.geometryInstances || []).length > 0) {
        for (const localBundle of localDerivedBundles) {
          if (!localBundle.valid || !enabledSketchIds.has(String(localBundle.instance.sketchId))) continue;
          const localPointMap = new Map();
          for (const localPoint of localBundle.points) {
            const path = localPath(localPoint.id);
            const point = createProjectedPoint(instance, ownerInstance, definition, localPoint, path);
            point.blockAppearanceOverrides = [localBundle.instance.appearanceOverride, ...appearanceOverrides];
            localPointMap.set(localPoint, point);
            pointByLocalId.set(geometryRefId(createGeometryRef("point", path)), point);
            points.push(point);
          }
          const markDerived = (item, localItem, kind) => {
            mark(item, localItem, kind);
            item.blockAppearanceOverrides = [localBundle.instance.appearanceOverride, ...appearanceOverrides];
            return item;
          };
          for (const localLine of localBundle.lines) lines.push(markDerived(new Line(localLine.id, localPointMap.get(localLine.p1), localPointMap.get(localLine.p2), localLine.construction), localLine, "line"));
          for (const localCircle of localBundle.circles) {
            const circle = markDerived(new Circle(localCircle.id, localPointMap.get(localCircle.center), localCircle.radius(), localCircle.construction), localCircle, "circle");
            Object.defineProperty(circle, "radiusValue", { configurable: true, enumerable: true, get: () => localCircle.radius() });
            circles.push(circle);
          }
          for (const localArc of localBundle.arcs) {
            const arc = markDerived(new Arc(localArc.id, localPointMap.get(localArc.center), localArc.radius(), localArc.startAngle, localArc.endAngle, localArc.construction), localArc, "arc");
            Object.defineProperties(arc, {
              radiusValue: { configurable: true, enumerable: true, get: () => localArc.radius() },
              startAngle: { configurable: true, enumerable: true, get: () => localArc.startAngle + instance.rotation },
              endAngle: { configurable: true, enumerable: true, get: () => localArc.endAngle + instance.rotation },
            });
            arcs.push(arc);
          }
          for (const localSpline of localBundle.splines) splines.push(markDerived(new Spline(localSpline.id, localSpline.fitPoints.map((point) => localPointMap.get(point)), localSpline.closed, localSpline.construction), localSpline, "spline"));
        }
      }
      return { definition, revision: definition.revision, sketchId: instance.sketchId, enabledSketchKey: [...enabledSketchIds].sort().join("|"), instance, points, lines, circles, arcs, splines, hatches, annotations, pointByLocalId };
    }

    function blockAllProjectionBundle(instance) {
      const definition = blockDefinitionById(instance?.definitionId);
      if (!definition) return { points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [], annotations: [], pointByLocalId: new Map() };
      return createBlockProjectionBundle(instance, definition, blockDefinitionDrawableSketchIds(definition), { includeAllSketches: true });
    }

    function blockProjectionBundle(instance) {
      const definition = blockDefinitionById(instance.definitionId);
      if (!definition) return { points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [], annotations: [], pointByLocalId: new Map() };
      const cached = blockProjectionCache.get(instance.id);
      const enabledSketchKey = [...blockInstanceEnabledSketchSet(instance, definition)].sort().join("|");
      if (cached && cached.definition === definition && cached.revision === definition.revision && cached.sketchId === instance.sketchId && cached.enabledSketchKey === enabledSketchKey) return cached;
      const bundle = createBlockProjectionBundle(instance, definition);
      blockProjectionCache.set(instance.id, bundle);
      return bundle;
    }

    function invalidateBlockProjectionCache(instanceId = null) {
      if (instanceId) blockProjectionCache.delete(instanceId);
      else blockProjectionCache.clear();
    }

    return Object.freeze({ blockProjectionId, blockProjectionLocalId, blockWorldPoint, createBlockProjectionBundle, blockAllProjectionBundle, blockProjectionBundle, invalidateBlockProjectionCache });
  }
  window.BlockProjection = Object.freeze({ create });
})();
