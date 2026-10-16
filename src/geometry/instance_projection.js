/* Derived Geometry read views and dependency resolution within an explicit scope. */
(function () {
  "use strict";
  const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;
  const { MIN_ORIENTATION_LENGTH, arcSweep } = window.GeometryKernel;
  const { parseId: parseGeometryRefId, resolve: resolveGeometryRefValue } = window.GeometryRef;
  const { geometryKindForItem, geometryRefForItem, addGeometryBundleToMaps } = window.GeometryObjects;

  function create({ elementSketchId, applicationText, resolveHatch = hatch => hatch.resolvedBoundary }) {
    function emptyGeometryInstanceBundle(instance, reason = "") {
      return { instance, valid: false, reason, points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [] };
    }

    function geometryInstanceSourcePoints(item) {
      if (item instanceof Point) return [item];
      if (item instanceof Line) return [item.p1, item.p2];
      if (item instanceof Circle || item instanceof Arc) return [item.center];
      if (item instanceof Spline) return item.fitPoints;
      return [];
    }

    function createGeometryInstanceBundle(instance, resolvedSources, axis, direction, resolveSourceHatch = resolveHatch) {
      const sourceByRef = new Map(resolvedSources.map(({ ref, item }) => [ref.kind + ":" + ref.path.join("@"), item]));
      const sourcePoints = new Map(resolvedSources.flatMap(({ item }) => geometryInstanceSourcePoints(item)).map(point => [point.id, point]));
      const resolve = ref => {
        if (!ref) return null;
        if (ref === instance.placement?.axis) return axis;
        if (ref === instance.placement?.direction) return direction;
        const id = ref.path.join("@");
        return sourceByRef.get(ref.kind + ":" + id) || (ref.kind === "point" ? sourcePoints.get(id) : null);
      };
      const occurrences = Boolean(instance.placement) ? instance.occurrences.map((key, i) => ({ key, index: i + 1 })) : [{ key: "", index: 0 }];
      const transform = (point, occurrence) => Boolean(instance.placement) ? window.PatternInstanceModel.transform(instance, point, occurrence.index, resolve) : { x: point.x, y: point.y };
      const inverseTransform = (point, occurrence) => Boolean(instance.placement) ? window.PatternInstanceModel.transform(instance, point, occurrence.index, resolve, true) : { x: point.x, y: point.y };
      const sourceRefByItem = new Map(resolvedSources.map(({ ref, item }) => [item, ref]));
      const pointRef = (point) => geometryRefForItem(point) || parseGeometryRefId("point", point.id);
      const outputs = { instance, valid: true, reason: "", points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [] };
      outputs.controlPoints = [];
      if (window.PatternInstanceModel.placed(instance)) {
        for (const role of ["anchor", ...(instance.placement.kind === "linear" ? ["placement"] : [])]) {
          const point = new Point(`${instance.id}@${role}`, 0, 0, role === "anchor", "instance-control");
          point.sketchId = instance.sketchId; point.derivedInstance = instance; point.instanceControl = role; point.derivedProjection = true;
          Object.defineProperties(point, {
            x: { get: () => role === "anchor" ? window.PatternInstanceModel.anchorPoint(instance, resolve).x : instance.x, set: value => { if (role === "placement") instance.x = value; } },
            y: { get: () => role === "anchor" ? window.PatternInstanceModel.anchorPoint(instance, resolve).y : instance.y, set: value => { if (role === "placement") instance.y = value; } },
          });
          outputs.controlPoints.push(point);
        }
      }
      const legacy = instance.legacyOutput && occurrences.length === 1 ? instance.legacyOutput : null;
      for (const occurrence of occurrences) {
        const mappedPoints = new Map();
        const allSourcePoints = [];
        for (const { item } of resolvedSources) for (const point of geometryInstanceSourcePoints(item)) if (!allSourcePoints.includes(point)) allSourcePoints.push(point);
        for (let pointIndex = 0; pointIndex < allSourcePoints.length; pointIndex += 1) {
          const sourcePoint = allSourcePoints[pointIndex];
          const ref = pointRef(sourcePoint);
          const id = legacy?.pointIds?.[pointIndex] || [instance.id, ...(occurrence.key ? [occurrence.key] : []), ...(ref?.path || [sourcePoint.id])].join("@");
          const point = new Point(id, 0, 0, true, "endpoint");
          Object.defineProperties(point, {
            x: { configurable: true, enumerable: true, get: () => transform(sourcePoint, occurrence).x },
            y: { configurable: true, enumerable: true, get: () => transform(sourcePoint, occurrence).y },
          });
          point.sketchId = instance.sketchId;
          point.derivedProjection = true;
          point.derivedInstance = instance;
          point.sourceElement = sourcePoint;
          point.occurrenceIndex = occurrence.index;
          point.occurrenceKey = occurrence.key;
          point.derivedInversePoint = (value) => inverseTransform(value, occurrence);
          mappedPoints.set(sourcePoint, point);
          outputs.points.push(point);
        }
        for (const { ref, item } of resolvedSources) {
          const outputId = (item === resolvedSources[0]?.item && legacy?.id) || [instance.id, ...(occurrence.key ? [occurrence.key] : []), ...ref.path].join("@");
          let output = null;
          if (item instanceof Point) output = mappedPoints.get(item);
          else if (item instanceof Line) output = new Line(outputId, mappedPoints.get(item.p1), mappedPoints.get(item.p2), item.construction);
          else if (item instanceof Circle) {
            output = new Circle(outputId, mappedPoints.get(item.center), item.radius(), item.construction);
            Object.defineProperty(output, "radiusValue", { configurable: true, enumerable: true, get: () => item.radius() });
          } else if (item instanceof Arc) {
            output = new Arc(outputId, mappedPoints.get(item.center), item.radius(), item.startAngle, item.endAngle, item.construction);
            Object.defineProperty(output, "radiusValue", { configurable: true, enumerable: true, get: () => item.radius() });
            const transformedStartAngle = () => {
              const mapped = transform(item.startPoint(), occurrence);
              return Math.atan2(mapped.y - output.center.y, mapped.x - output.center.x);
            };
            Object.defineProperties(output, {
              startAngle: { configurable: true, enumerable: true, get: transformedStartAngle },
              endAngle: { configurable: true, enumerable: true, get: () => transformedStartAngle() + (instance.placement?.kind === "axisReflection" || instance.reflected ? -1 : 1) * arcSweep(item) },
            });
          } else if (item instanceof Spline) output = new Spline(outputId, item.fitPoints.map((point) => mappedPoints.get(point)), item.closed, item.construction);
          else if (ref.kind === "hatch") {
            output = { boundaryLoops: item.boundaryLoops };
            Object.defineProperties(output, {
              seed: { enumerable: true, get: () => transform(item.seed, occurrence) },
              patternOrigin: { enumerable: true, get: () => transform(item.patternOrigin || { x: 0, y: 0 }, occurrence) },
              appearance: { enumerable: true, get: () => {
                const appearance = { ...item.appearance, ...instance.appearanceOverride };
                const angle = (Number(item.appearance?.angle) || 0) * Math.PI / 180;
                const start = transform({ x: 0, y: 0 }, occurrence);
                const end = transform({ x: Math.cos(angle), y: Math.sin(angle) }, occurrence);
                appearance.angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
                return appearance;
              } },
              resolvedBoundary: { enumerable: true, get: () => {
                const resolved = resolveSourceHatch(item);
                return resolved?.ok ? { ...resolved, loops: resolved.loops.map(loop => ({ ...loop,
                  points: loop.points.map(point => transform(point, occurrence)) })) }
                  : resolved || { ok: false, code: "invalid-boundary" };
              } },
            });
          }
          if (!output) continue;
          output.id = outputId;
          output.sketchId = instance.sketchId;
          output.derivedProjection = true;
          output.derivedInstance = instance;
          output.sourceElement = item;
          output.sourceRef = sourceRefByItem.get(item);
          output.occurrenceIndex = occurrence.index;
          output.occurrenceKey = occurrence.key;
          output.derivedInversePoint = (value) => inverseTransform(value, occurrence);
          const kind = geometryKindForItem(output);
          if (kind && kind !== "point") outputs[kind === "hatch" ? "hatches" : `${kind}s`].push(output);
        }
      }
      return outputs;
    }

    function geometryInstanceBundlesForScope(scope, blockBundles = []) {
      const instances = scope?.geometryInstances || [];
      const sketchParentById = new Map((scope?.sketches || []).map((sketch) => [String(sketch.id), sketch.parentSketchId == null ? null : String(sketch.parentSketchId)]));
      const isAncestorInScope = (ancestorId, descendantId) => {
        if (sketchParentById.size === 0 || !ancestorId || !descendantId || String(ancestorId) === String(descendantId)) return false;
        let current = sketchParentById.get(String(descendantId));
        const visited = new Set();
        while (current && !visited.has(current)) {
          if (current === String(ancestorId)) return true;
          visited.add(current);
          current = sketchParentById.get(current);
        }
        return false;
      };
      const pointById = new Map((scope?.points || []).map((item) => [item.id, item]));
      const lineById = new Map((scope?.lines || []).map((item) => [item.id, item]));
      const primitiveById = new Map([...(scope?.circles || []), ...(scope?.arcs || []), ...(scope?.splines || []), ...(scope?.hatches || [])].map((item) => [item.id, item]));
      for (const bundle of blockBundles) addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);
      const resolve = (ref) => resolveGeometryRefValue(ref, (kind, id) => kind === "point" ? pointById.get(id) : kind === "line" ? lineById.get(id) : primitiveById.get(id));
      const results = [];
      const pending = [...instances];
      while (pending.length > 0) {
        let progressed = false;
        for (let index = pending.length - 1; index >= 0; index -= 1) {
          const instance = pending[index];
          if (instance.sources.length === 0) {
            results.push(emptyGeometryInstanceBundle(instance, applicationText("複写元がありません", "No source geometry")));
            pending.splice(index, 1);
            progressed = true;
            continue;
          }
          const resolvedSources = instance.sources.map((ref) => ({ ref, item: resolve(ref) }));
          const axis = instance.placement?.kind === "axisReflection" ? resolve(instance.placement.axis) : null;
          const direction = instance.placement?.kind === "directionLinear" ? resolve(instance.placement.direction) : null;
          if (resolvedSources.some(({ item }) => !item) || (instance.placement?.kind === "axisReflection" && !(axis instanceof Line)) || (instance.placement?.kind === "directionLinear" && !(direction instanceof Line))) continue;
          const localReferences = Boolean(instance.placement) ? window.PatternInstanceModel.dependencies(instance).map(resolve).filter(Boolean) : [];
          const placementError = window.PatternInstanceModel.error(instance, resolve);
          if (placementError) { results.push(emptyGeometryInstanceBundle(instance, placementError)); pending.splice(index, 1); progressed = true; continue; }
          if (localReferences.some((item) => elementSketchId(item) !== instance.sketchId)) {
            results.push(emptyGeometryInstanceBundle(instance, applicationText("参照先Sketchが一致しません", "Referenced geometry belongs to another sketch")));
            pending.splice(index, 1);
            progressed = true;
            continue;
          }
          if (instance.type === "sketchProjection" && sketchParentById.size > 0 && resolvedSources.some(({ item }) => !isAncestorInScope(elementSketchId(item), instance.sketchId))) {
            results.push(emptyGeometryInstanceBundle(instance, applicationText("投影元が先祖Sketchにありません", "Projection source is not in an ancestor sketch")));
            pending.splice(index, 1);
            progressed = true;
            continue;
          }
          if (instance.placement?.kind === "axisReflection" && axis.length() < MIN_ORIENTATION_LENGTH) {
            results.push(emptyGeometryInstanceBundle(instance, applicationText("ミラー軸が短すぎます", "Mirror axis is too short")));
          } else if (instance.placement?.kind === "directionLinear" && direction.length() < MIN_ORIENTATION_LENGTH) {
            results.push(emptyGeometryInstanceBundle(instance, applicationText("方向線が短すぎます", "Direction line is too short")));
          } else {
            const bundle = createGeometryInstanceBundle(instance, resolvedSources, axis, direction,
              hatch => hatch.derivedProjection || hatch.blockProjection ? hatch.resolvedBoundary
                : resolveHatch(hatch, [...lineById.values(), ...primitiveById.values()]));
            results.push(bundle);
            addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);
          }
          pending.splice(index, 1);
          progressed = true;
        }
        if (!progressed) break;
      }
      for (const instance of pending) results.push(emptyGeometryInstanceBundle(instance, applicationText("参照切れまたは循環参照", "Missing or cyclic reference")));
      return instances.map((instance) => results.find((bundle) => bundle.instance === instance) || emptyGeometryInstanceBundle(instance));
    }

    return Object.freeze({ emptyGeometryInstanceBundle, geometryInstanceSourcePoints, createGeometryInstanceBundle, geometryInstanceBundlesForScope });
  }
  function createSourceSelection({ currentScope, selectedGeometryItems, canvasSelection, blockProjectionBundle,
    geometryInstanceBundle, elementSketchId, activeSketchId, geometryRefForItem }) {
    function read() {
      const items = [...selectedGeometryItems(), ...canvasSelection.hatches.filter(hatch => currentScope().hatches.includes(hatch))];
      for (const instance of canvasSelection.blockInstances) {
        const bundle = blockProjectionBundle(instance);
        items.push(...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines, ...(bundle.hatches || []), ...bundle.points.filter((point) => point.localElement?.kind === "explicit"));
      }
      for (const instance of canvasSelection.geometryInstances) {
        const bundle = geometryInstanceBundle(instance);
        items.push(...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines, ...(bundle.hatches || []));
        for (const point of bundle.points) if (point.sourceElement instanceof Point && point.sourceElement.kind === "explicit") items.push(point);
      }
      return [...new Set(items)].filter((item) => elementSketchId(item) === activeSketchId() && geometryRefForItem(item));
    }
    return Object.freeze({ read });
  }
  // Resolve source references and inverse pointer chains without changing interaction state.
  function createDragSourceQuery({ geometryInstanceSourcePoints, geometryInstanceDependencyRefs, resolveGeometryRef }) {
    function resolveDerivedDragSource(hit, pointer) {
      let item = hit?.item || null;
      const inverseTransforms = [];
      const visited = new Set();
      let crossesSketchProjection = false;
      while (item?.derivedProjection) {
        if (visited.has(item) || !item.sourceElement || typeof item.derivedInversePoint !== "function") return null;
        visited.add(item);
        if (item.derivedInstance?.type === "sketchProjection") crossesSketchProjection = true;
        inverseTransforms.push(item.derivedInversePoint);
        item = item.sourceElement;
      }
      if (!item || inverseTransforms.length === 0) return null;
      const mapPointer = (value) => inverseTransforms.reduce((current, inverse) => inverse(current), { x: value.x, y: value.y });
      return { item, mapPointer, pointer: mapPointer(pointer), crossesSketchProjection };
    }

    function geometryInstanceSourceObjects(instance) {
      const seen = new Set();
      const visit = (item) => {
        if (!item || seen.has(item)) return;
        seen.add(item);
        for (const point of geometryInstanceSourcePoints(item)) if (point !== item) visit(point);
        if (item.blockInstance) seen.add(item.blockInstance);
        if (item.derivedInstance) {
          seen.add(item.derivedInstance);
          for (const ref of geometryInstanceDependencyRefs(item.derivedInstance)) visit(resolveGeometryRef(ref));
        }
      };
      for (const ref of instance.sources) visit(resolveGeometryRef(ref));
      return seen;
    }
    return Object.freeze({ resolve: resolveDerivedDragSource, sourceObjects: geometryInstanceSourceObjects });
  }
  window.InstanceProjection = Object.freeze({ create, createSourceSelection, createDragSourceQuery });
})();
