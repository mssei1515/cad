/* Offset measurement and preview geometry, without document mutation. */
(() => {
  "use strict";
  function create({ types, kernel, buildOffsetChainGeometry }) {
    const { Point, Line, Circle, Arc, hypot2 } = types;
    const { signedPointDirectedLineDistance, distancePointToSegment, angleOnSignedSweep,
      lineNormal, MIN_ORIENTATION_LENGTH } = kernel;
    function offsetDistanceFromPointer(source, pointer) {
      if (source instanceof Line) {
        const signed = signedPointDirectedLineDistance(pointer, source);
        return { distance: Math.abs(signed), sign: signed < 0 ? -1 : 1 };
      }
      const radial = hypot2(pointer.x - source.center.x, pointer.y - source.center.y);
      const signed = radial - source.radius();
      return { distance: Math.abs(signed), sign: signed < 0 ? -1 : 1 };
    }

    function offsetChainEntryDistanceFromPointer(entry, pointer) {
      const geometry = entry.geometry;
      if (geometry instanceof Line) return distancePointToSegment(pointer.x, pointer.y, geometry);
      const radialDistance = Math.abs(hypot2(pointer.x - geometry.center.x, pointer.y - geometry.center.y) - geometry.radius());
      const angle = Math.atan2(pointer.y - geometry.center.y, pointer.x - geometry.center.x);
      if (angleOnSignedSweep(angle, geometry.startAngle, geometry.endAngle)) return radialDistance;
      return Math.min(
        hypot2(pointer.x - geometry.startPoint().x, pointer.y - geometry.startPoint().y),
        hypot2(pointer.x - geometry.endPoint().x, pointer.y - geometry.endPoint().y),
      );
    }

    function offsetChainDistanceFromPointer(entries, pointer) {
      const indexed = entries.map((entry, index) => ({ entry, index, proximity: offsetChainEntryDistanceFromPointer(entry, pointer) }));
      const nearest = indexed.reduce((best, item) => !best || item.proximity < best.proximity ? item : best, null);
      if (!nearest) return { distance: 0, side: 1, index: 0 };
      const geometry = nearest.entry.geometry;
      if (geometry instanceof Line) {
        const nativeSigned = signedPointDirectedLineDistance(pointer, geometry);
        const signed = nearest.entry.reversed ? -nativeSigned : nativeSigned;
        return { distance: Math.abs(signed), side: signed < 0 ? -1 : 1, index: nearest.index };
      }
      const radialDelta = hypot2(pointer.x - geometry.center.x, pointer.y - geometry.center.y) - geometry.radius();
      const traversalSweep = (geometry.endAngle - geometry.startAngle) * (nearest.entry.reversed ? -1 : 1);
      const sweepSign = traversalSweep < 0 ? -1 : 1;
      const side = -radialDelta * sweepSign < 0 ? -1 : 1;
      return { distance: Math.abs(radialDelta), side, index: nearest.index };
    }

    function offsetChainDraft(entries, distance, side, closed) {
      const result = buildOffsetChainGeometry(entries, { distance, side, closed, epsilon: MIN_ORIENTATION_LENGTH });
      if (!result.ok) return result;
      const geometries = result.geometries.map((geometry, index) => {
        const source = entries[index].geometry;
        if (geometry.kind === "line") {
          return new Line("OFFSET", new Point("OP1", geometry.p1.x, geometry.p1.y, false, "endpoint"), new Point("OP2", geometry.p2.x, geometry.p2.y, false, "endpoint"), source.construction);
        }
        return new Arc("OFFSET", new Point("OC", geometry.center.x, geometry.center.y, false, "center"), geometry.radius, geometry.startAngle, geometry.endAngle, source.construction);
      });
      return { ...result, geometries };
    }

    function offsetDraftGeometry(source, distance, sign) {
      if (!source || !Number.isFinite(distance) || distance <= 0) return null;
      if (source instanceof Line) {
        const normal = lineNormal(source);
        const dx = normal.x * sign * distance;
        const dy = normal.y * sign * distance;
        const p1 = new Point("OP1", source.p1.x + dx, source.p1.y + dy, false, "endpoint");
        const p2 = new Point("OP2", source.p2.x + dx, source.p2.y + dy, false, "endpoint");
        return new Line("OFFSET", p1, p2, source.construction);
      }
      const radius = source.radius() + sign * distance;
      if (radius < MIN_ORIENTATION_LENGTH) return null;
      const center = new Point("OC", source.center.x, source.center.y, false, "center");
      if (source instanceof Circle) return new Circle("OFFSET", center, radius, source.construction);
      if (source instanceof Arc) return new Arc("OFFSET", center, radius, source.startAngle, source.endAngle, source.construction);
      return null;
    }

    function offsetDimensionTarget(source, offset, distance, sign) {
      return { kind: "offset-distance", source, offset, value: distance, sign };
    }

    return Object.freeze({ offsetDistanceFromPointer, offsetChainDistanceFromPointer, offsetChainDraft, offsetDraftGeometry, offsetDimensionTarget });
  }
  window.OffsetGeometry = Object.freeze({ create });
})();
