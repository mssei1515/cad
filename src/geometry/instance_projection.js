/* Derived Geometry read views and dependency resolution within an explicit scope. */
(function () {
  "use strict";
  const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;
  const { MIN_ORIENTATION_LENGTH, arcSweep } = window.GeometryKernel;
  const { parseId: parseGeometryRefId, resolve: resolveGeometryRefValue } = window.GeometryRef;
  const { geometryKindForItem, geometryRefForItem, addGeometryBundleToMaps } = window.GeometryObjects;

  function create({ elementSketchId, applicationText }) {
    function emptyGeometryInstanceBundle(instance, reason = "") {
      return { instance, valid: false, reason, points: [], lines: [], circles: [], arcs: [], splines: [] };
    }

    function geometryInstanceSourcePoints(item) {
      if (item instanceof Point) return [item];
      if (item instanceof Line) return [item.p1, item.p2];
      if (item instanceof Circle || item instanceof Arc) return [item.center];
      if (item instanceof Spline) return item.fitPoints;
      return [];
    }

    function createGeometryInstanceBundle(instance, resolvedSources, axis, direction) {
      const occurrences = instance.type === "pattern"
        ? Array.from({ length: Math.max(0, instance.copies) }, (_, index) => index + 1)
        : [0];
      const transform = (point, occurrence) => {
        if (instance.type === "free") {
          const x = (point.x - instance.origin.x) * (instance.mirrorX ? -1 : 1);
          const y = (point.y - instance.origin.y) * (instance.mirrorY ? -1 : 1);
          const c = Math.cos(instance.rotation), s = Math.sin(instance.rotation);
          return { x: instance.x + c * x - s * y, y: instance.y + s * x + c * y };
        }
        if (instance.type === "mirror") {
          const dx = axis.p2.x - axis.p1.x;
          const dy = axis.p2.y - axis.p1.y;
          const length2 = dx * dx + dy * dy;
          if (length2 < MIN_ORIENTATION_LENGTH * MIN_ORIENTATION_LENGTH) return { x: point.x, y: point.y };
          const t = ((point.x - axis.p1.x) * dx + (point.y - axis.p1.y) * dy) / length2;
          return { x: 2 * (axis.p1.x + t * dx) - point.x, y: 2 * (axis.p1.y + t * dy) - point.y };
        }
        if (instance.type === "pattern") {
          const directionLength = direction?.length?.() || 0;
          if (directionLength < MIN_ORIENTATION_LENGTH) return { x: point.x, y: point.y };
          const sign = instance.reversed ? -1 : 1;
          const scale = sign * instance.spacing * occurrence / directionLength;
          return { x: point.x + direction.dx() * scale, y: point.y + direction.dy() * scale };
        }
        return { x: point.x, y: point.y };
      };
      const inverseTransform = (point, occurrence) => {
        if (instance.type === "free") {
          const x = point.x - instance.x, y = point.y - instance.y;
          const c = Math.cos(instance.rotation), s = Math.sin(instance.rotation);
          return { x: instance.origin.x + (c * x + s * y) * (instance.mirrorX ? -1 : 1),
            y: instance.origin.y + (-s * x + c * y) * (instance.mirrorY ? -1 : 1) };
        }
        if (instance.type === "mirror") return transform(point, occurrence);
        if (instance.type === "pattern") {
          const directionLength = direction?.length?.() || 0;
          if (directionLength < MIN_ORIENTATION_LENGTH) return { x: point.x, y: point.y };
          const sign = instance.reversed ? -1 : 1;
          const scale = sign * instance.spacing * occurrence / directionLength;
          return { x: point.x - direction.dx() * scale, y: point.y - direction.dy() * scale };
        }
        return { x: point.x, y: point.y };
      };
      const sourceRefByItem = new Map(resolvedSources.map(({ ref, item }) => [item, ref]));
      const pointRef = (point) => geometryRefForItem(point) || parseGeometryRefId("point", point.id);
      const outputs = { instance, valid: true, reason: "", points: [], lines: [], circles: [], arcs: [], splines: [] };
      const legacy = instance.legacyOutput && occurrences.length === 1 ? instance.legacyOutput : null;
      for (const occurrence of occurrences) {
        const mappedPoints = new Map();
        const allSourcePoints = [];
        for (const { item } of resolvedSources) for (const point of geometryInstanceSourcePoints(item)) if (!allSourcePoints.includes(point)) allSourcePoints.push(point);
        for (let pointIndex = 0; pointIndex < allSourcePoints.length; pointIndex += 1) {
          const sourcePoint = allSourcePoints[pointIndex];
          const ref = pointRef(sourcePoint);
          const id = legacy?.pointIds?.[pointIndex] || [instance.id, ...(instance.type === "pattern" ? [String(occurrence)] : []), ...(ref?.path || [sourcePoint.id])].join("@");
          const point = new Point(id, 0, 0, true, "endpoint");
          Object.defineProperties(point, {
            x: { configurable: true, enumerable: true, get: () => transform(sourcePoint, occurrence).x },
            y: { configurable: true, enumerable: true, get: () => transform(sourcePoint, occurrence).y },
          });
          point.sketchId = instance.sketchId;
          point.derivedProjection = true;
          point.derivedInstance = instance;
          point.sourceElement = sourcePoint;
          point.occurrenceIndex = occurrence;
          point.derivedInversePoint = (value) => inverseTransform(value, occurrence);
          mappedPoints.set(sourcePoint, point);
          outputs.points.push(point);
        }
        for (const { ref, item } of resolvedSources) {
          const outputId = (item === resolvedSources[0]?.item && legacy?.id) || [instance.id, ...(instance.type === "pattern" ? [String(occurrence)] : []), ...ref.path].join("@");
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
              endAngle: { configurable: true, enumerable: true, get: () => transformedStartAngle() + (instance.type === "mirror" || (instance.type === "free" && instance.mirrorX !== instance.mirrorY) ? -1 : 1) * arcSweep(item) },
            });
          } else if (item instanceof Spline) output = new Spline(outputId, item.fitPoints.map((point) => mappedPoints.get(point)), item.closed, item.construction);
          if (!output) continue;
          output.id = outputId;
          output.sketchId = instance.sketchId;
          output.derivedProjection = true;
          output.derivedInstance = instance;
          output.sourceElement = item;
          output.sourceRef = sourceRefByItem.get(item);
          output.occurrenceIndex = occurrence;
          output.derivedInversePoint = (value) => inverseTransform(value, occurrence);
          const kind = geometryKindForItem(output);
          if (kind && kind !== "point") outputs[`${kind}s`].push(output);
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
      const primitiveById = new Map([...(scope?.circles || []), ...(scope?.arcs || []), ...(scope?.splines || [])].map((item) => [item.id, item]));
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
          const axis = instance.type === "mirror" ? resolve(instance.axis) : null;
          const direction = instance.type === "pattern" ? resolve(instance.direction) : null;
          if (resolvedSources.some(({ item }) => !item) || (instance.type === "mirror" && !(axis instanceof Line)) || (instance.type === "pattern" && !(direction instanceof Line))) continue;
          const localReferences = instance.type === "mirror"
            ? [...resolvedSources.map(({ item }) => item), axis]
            : instance.type === "pattern"
            ? [...resolvedSources.map(({ item }) => item), direction]
            : instance.type === "free" ? resolvedSources.map(({ item }) => item)
            : [];
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
          if (instance.type === "mirror" && axis.length() < MIN_ORIENTATION_LENGTH) {
            results.push(emptyGeometryInstanceBundle(instance, applicationText("ミラー軸が短すぎます", "Mirror axis is too short")));
          } else if (instance.type === "pattern" && (!(instance.spacing > 0) || !(instance.copies > 0) || instance.copies > 1000 || direction.length() < MIN_ORIENTATION_LENGTH)) {
            results.push(emptyGeometryInstanceBundle(instance, applicationText("パターン設定が正しくありません", "Invalid pattern settings")));
          } else {
            const bundle = createGeometryInstanceBundle(instance, resolvedSources, axis, direction);
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
  window.InstanceProjection = Object.freeze({ create });
})();
