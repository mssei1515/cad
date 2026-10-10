/* Geometry object kinds, canonical references and bundle lookup maps. */
(function () {
  "use strict";
  const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;
  const { parseId: parseGeometryRefId } = window.GeometryRef;

  function geometryKindForItem(item) {
    if (item instanceof Line) return "line";
    if (item instanceof Circle) return "circle";
    if (item instanceof Arc) return "arc";
    if (item instanceof Spline) return "spline";
    if (item instanceof Point) return "point";
    if (item?.boundaryLoops && item?.seed) return "hatch";
    return null;
  }

  function geometryRefForItem(item) {
    const kind = geometryKindForItem(item);
    return kind ? parseGeometryRefId(kind, kind === "hatch" && item.blockProjection ? item.id.replaceAll("/", "@") : item?.id) : null;
  }

  function addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById) {
    for (const point of bundle.points) pointById.set(point.id, point);
    for (const line of bundle.lines) lineById.set(line.id, line);
    for (const primitive of [...bundle.circles, ...bundle.arcs]) primitiveById.set(primitive.id, primitive);
    for (const spline of bundle.splines || []) primitiveById.set(spline.id, spline);
    for (const hatch of bundle.hatches || []) primitiveById.set(window.GeometryRef.id(geometryRefForItem(hatch)), hatch);
  }

  window.GeometryObjects = Object.freeze({ geometryKindForItem, geometryRefForItem, addGeometryBundleToMaps });
})();
