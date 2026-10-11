/* Geometry, dimension and projected-instance Canvas hit rules; no pointer events or selection mutation. */
(() => {
  "use strict";
  const { hypot2 } = window.GeometrySolver;
  const { distancePointToSegment, distancePointToSegmentPoints, arcEndpointPoint, angleOnSignedSweep } = window.GeometryKernel;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  function create({ currentScope, viewportScale, isEditableSketchElement, isSelectableEndpointPoint, isExplicitPoint,
    hitDimension, constraintSketchId, elementSketchId, isVisibleSketchElement, hitBlockInstance, blockDefinitionById,
    hitGeometryInstance = () => null, hitAnnotationElement = () => null, hitHatchAt = () => null, hitReferenceImageAt = () => null, preferredSketchId = () => null }) {
    function preferredOrder(items) {
      const id = preferredSketchId();
      return id ? items.sort((a, b) => Number((b.sketchId || elementSketchId(b)) === id) - Number((a.sketchId || elementSketchId(a)) === id)) : items;
    }
    function hitPointByPredicate(x, y, predicate) {
      const model = currentScope();
      const radius = 10 / viewportScale();
      for (const p of preferredOrder(model.points.slice().reverse())) {
        if (!isEditableSketchElement(p)) continue;
        if (!predicate(p)) continue;
        if (hypot2(p.x - x, p.y - y) <= radius) return p;
      }
      return null;
    }

    function hitEndpointPoint(x, y) {
      return hitPointByPredicate(x, y, isSelectableEndpointPoint);
    }

    function hitExplicitPoint(x, y) {
      return hitPointByPredicate(x, y, isExplicitPoint);
    }

    function hitAnyPoint(x, y) {
      return hitEndpointPoint(x, y) || hitExplicitPoint(x, y);
    }

    function hitPoint(x, y) {
      return hitAnyPoint(x, y);
    }

    function hitLine(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const lines = model.lines.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const l of preferredOrder(lines)) {
        if (!isEditableSketchElement(l)) continue;
        if (distancePointToSegment(x, y, l) <= threshold) return l;
      }
      return null;
    }

    function hitCircle(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const circles = model.circles.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const c of preferredOrder(circles)) {
        if (!isEditableSketchElement(c)) continue;
        const d = hypot2(x - c.center.x, y - c.center.y);
        if (Math.abs(d - c.radius()) <= threshold) return c;
      }
      return null;
    }

    function hitArc(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const arcs = model.arcs.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const a of preferredOrder(arcs)) {
        if (!isEditableSketchElement(a)) continue;
        const radius = a.radius();
        const d = hypot2(x - a.center.x, y - a.center.y);
        if (Math.abs(d - radius) > threshold) continue;
        const angle = Math.atan2(y - a.center.y, x - a.center.x);
        if (angleOnSignedSweep(angle, a.startAngle, a.endAngle)) return a;
      }
      return null;
    }

    function hitArcEndpoint(x, y) {
      const model = currentScope();
      const threshold = 10 / viewportScale();
      for (const arc of preferredOrder(model.arcs.slice().reverse())) {
        if (!isEditableSketchElement(arc)) continue;
        for (const endpoint of ["end", "start"]) {
          const point = arcEndpointPoint(arc, endpoint);
          if (hypot2(point.x - x, point.y - y) <= threshold) return { arc, endpoint, point };
        }
      }
      return null;
    }

    function hitSpline(x, y) {
      const model = currentScope();
      const threshold = 7 / viewportScale();
      const splines = model.splines.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const spline of preferredOrder(splines)) {
        if (!isEditableSketchElement(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest && closest.distance <= threshold) return spline;
      }
      return null;
    }


    function hitSketchIdentityElement(x, y, options = {}) {
      const model = currentScope();
      const allowInactiveGeometry = Boolean(options.allowInactiveGeometry);
      const threshold = 7 / viewportScale();
      const pointThreshold = 10 / viewportScale();
      const accepts = (item) => isVisibleSketchElement(item) && (allowInactiveGeometry || isEditableSketchElement(item));
      const dimensionHit = hitDimension(x, y, { activeOnly: false });
      if (dimensionHit) {
        const sketchId = constraintSketchId(dimensionHit.constraint);
        return {
          id: dimensionHit.constraint.name || "寸法",
          label: dimensionHit.constraint.name || "寸法",
          sketchId,
          item: dimensionHit.constraint,
          kind: "dimension",
        };
      }

      for (const p of preferredOrder(model.points.slice().reverse())) {
        if (!accepts(p)) continue;
        if (!isExplicitPoint(p) && !isSelectableEndpointPoint(p)) continue;
        if (hypot2(p.x - x, p.y - y) <= pointThreshold) return { id: p.id, sketchId: elementSketchId(p), item: p, kind: "point" };
      }
      for (let i = model.lines.length - 1; i >= 0; i--) {
        const line = model.lines[i];
        if (!accepts(line)) continue;
        if (distancePointToSegment(x, y, line) <= threshold) return { id: line.id, sketchId: elementSketchId(line), item: line, kind: "line" };
      }
      for (let i = model.circles.length - 1; i >= 0; i--) {
        const circle = model.circles[i];
        if (!accepts(circle)) continue;
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { id: circle.id, sketchId: elementSketchId(circle), item: circle, kind: "circle" };
      }
      for (const arc of preferredOrder(model.arcs.slice().reverse())) {
        if (!accepts(arc)) continue;
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { id: arc.id, sketchId: elementSketchId(arc), item: arc, kind: "arc" };
      }
      for (let i = model.splines.length - 1; i >= 0; i--) {
        const spline = model.splines[i];
        if (!accepts(spline)) continue;
        const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
        if (closest?.distance <= threshold) return { id: spline.id, sketchId: elementSketchId(spline), item: spline, kind: "spline" };
      }
      const block = hitBlockInstance(x, y, !allowInactiveGeometry);
      if (block) {
        const definition = blockDefinitionById(block.definitionId);
        return {
          id: block.id,
          label: `Block ${block.id}${definition?.name ? `: ${definition.name}` : ""}`,
          sketchId: block.sketchId,
          item: block,
          kind: "block",
        };
      }
      for (const [kind, item] of [
        ["instance", hitGeometryInstance(x, y, !allowInactiveGeometry)],
        ["annotation", hitAnnotationElement(x, y, { activeOnly: !allowInactiveGeometry })?.element],
        ["hatch", hitHatchAt(x, y, { activeOnly: !allowInactiveGeometry })],
        ["image", hitReferenceImageAt(x, y, { activeOnly: !allowInactiveGeometry })],
      ]) {
        if (item) return { item, id: item.id, sketchId: elementSketchId(item), kind };
      }
      return null;
    }

    return Object.freeze({ hitSketchIdentityElement, hitEndpointPoint, hitExplicitPoint, hitAnyPoint, hitPoint, hitLine, hitCircle, hitArc, hitArcEndpoint, hitSpline });
  }
  function createInstances({ currentScope, viewportScale, hitSketchAllowed, isVisibleSketchId, blockProjectionBundle,
    annotationBounds, resolvedHatchBoundary, isVisibleValue, hatchAppearanceForDisplay, hatchContainsSelectablePoint, geometryInstanceBundles }) {
    function hitBlockInstance(x, y, editableOnly = true) {
      const threshold = 8 / viewportScale();
      const instances = currentScope().blockInstances.slice().sort((a, b) => (normalizedDrawingOrder(b.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.drawingOrder) ?? 0));
      for (const instance of instances) {
        if (editableOnly && !hitSketchAllowed(instance.sketchId)) continue;
        if (!isVisibleSketchId(instance.sketchId)) continue;
        const bundle = blockProjectionBundle(instance);
        if (bundle.points.some((point) => hypot2(point.x - x, point.y - y) <= threshold)) return instance;
        if (bundle.lines.some((line) => distancePointToSegment(x, y, line) <= threshold)) return instance;
        if (bundle.circles.some((circle) => Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold)) return instance;
        if (bundle.arcs.some((arc) => Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(Math.atan2(y - arc.center.y, x - arc.center.x), arc.startAngle, arc.endAngle))) return instance;
        if ((bundle.splines || []).some((spline) => window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 })?.distance <= threshold)) return instance;
        if ((bundle.annotations || []).some((annotation) => {
          const bounds = annotationBounds(annotation);
          return bounds && x >= bounds.x1 - threshold && x <= bounds.x2 + threshold && y >= bounds.y1 - threshold && y <= bounds.y2 + threshold;
        })) return instance;
        if ((bundle.hatches || []).some((hatch) => {
          const resolved = resolvedHatchBoundary(hatch);
          return resolved.ok && isVisibleValue(hatchAppearanceForDisplay(hatch).visible) && hatchContainsSelectablePoint(hatch, resolved, { x, y });
        })) return instance;
      }
      return null;
    }

    function geometryBundleHit(bundle, x, y, threshold = 8 / viewportScale()) {
      if ((bundle.hatches || []).some(hatch => isVisibleValue(hatchAppearanceForDisplay(hatch).visible)
        && hatchContainsSelectablePoint(hatch, resolvedHatchBoundary(hatch), { x, y }))) return true;
      if (bundle.points.some((point) => hypot2(point.x - x, point.y - y) <= threshold)) return true;
      if (bundle.lines.some((line) => distancePointToSegment(x, y, line) <= threshold)) return true;
      if (bundle.circles.some((circle) => Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold)) return true;
      if (bundle.arcs.some((arc) => Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(Math.atan2(y - arc.center.y, x - arc.center.x), arc.startAngle, arc.endAngle))) return true;
      return bundle.splines.some((spline) => window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 })?.distance <= threshold);
    }

    function hitGeometryInstance(x, y, editableOnly = true) {
      const bundles = geometryInstanceBundles().slice().sort((a, b) => (normalizedDrawingOrder(b.instance.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.instance.drawingOrder) ?? 0));
      for (const bundle of bundles) {
        if (editableOnly && !hitSketchAllowed(bundle.instance.sketchId)) continue;
        if (isVisibleSketchId(bundle.instance.sketchId) && geometryBundleHit(bundle, x, y)) return bundle.instance;
      }
      return null;
    }

    function hitDerivedGeometryForDrag(x, y) {
      const threshold = 7 / viewportScale();
      const pointThreshold = 10 / viewportScale();
      const bundles = geometryInstanceBundles().slice().sort((a, b) => (normalizedDrawingOrder(b.instance.drawingOrder) ?? 0) - (normalizedDrawingOrder(a.instance.drawingOrder) ?? 0));
      for (const bundle of bundles) {
        if (!hitSketchAllowed(bundle.instance.sketchId)) continue;
        for (const point of bundle.points.slice().reverse()) {
          if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", item: point, instance: bundle.instance };
        }
        for (const arc of bundle.arcs.slice().reverse()) {
          for (const endpoint of ["end", "start"]) {
            const point = arcEndpointPoint(arc, endpoint);
            if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "arc-endpoint", item: arc, endpoint, instance: bundle.instance };
          }
        }
        for (const line of bundle.lines.slice().reverse()) {
          if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", item: line, instance: bundle.instance };
        }
        for (const circle of bundle.circles.slice().reverse()) {
          if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "circle", item: circle, instance: bundle.instance };
        }
        for (const arc of bundle.arcs.slice().reverse()) {
          const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
          if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "arc", item: arc, instance: bundle.instance };
        }
        for (const spline of bundle.splines.slice().reverse()) {
          const closest = window.SplineGeometry.closestPoint(spline.curve(), { x, y }, { samplesPerSpan: 28 });
          if (closest?.distance <= threshold) return { kind: "spline", item: spline, instance: bundle.instance };
        }
      }
      return null;
    }
    return Object.freeze({ hitBlockInstance, hitGeometryInstance, hitDerivedGeometryForDrag });
  }
  function createDimensions({ currentScope, viewportScale, ordinarySelectionMode, isActiveSketchConstraint, isVisibleSketchId,
    constraintSketchId, targetFromConstraint, defaultDimensionForTarget, isVisibleValue, effectiveDimensionAppearance,
    dimensionLayout, dimensionLabelForConstraint, dimensionTextDrawingMetrics, dimensionTextWidth, dimensionUsesExpression, pointInExpandedBox }) {
    function hitDimension(x, y, { activeOnly = !ordinarySelectionMode() } = {}) {
      const threshold = 12 / viewportScale();
      for (let i = currentScope().constraints.length - 1; i >= 0; i--) {
        const constraint = currentScope().constraints[i];
        if (activeOnly && !isActiveSketchConstraint(constraint)) continue;
        if (!isVisibleSketchId(constraintSketchId(constraint))) continue;
        const target = targetFromConstraint(constraint);
        if (!target) continue;
        const dimension = constraint.dimension || defaultDimensionForTarget(target);
        if (!isVisibleValue(effectiveDimensionAppearance(dimension, constraintSketchId(constraint)).visible)) continue;
        const layout = dimensionLayout(target, dimension);
        if (!layout) continue;
        const appearance = effectiveDimensionAppearance(dimension, constraintSketchId(constraint));
        let scaledLabelHit = false;
        if (appearance.fixedDisplaySize === false || /[\r\n]/.test(dimensionLabelForConstraint(constraint, target, dimension))) {
          const label = dimensionLabelForConstraint(constraint, target, dimension);
          const metrics = dimensionTextDrawingMetrics(appearance);
          const width = dimensionTextWidth(label, appearance, dimensionUsesExpression(constraint));
          const angle = -(Number(layout.textAngle) || 0);
          const dx = x - layout.text.x, dy = y - layout.text.y;
          scaledLabelHit = pointInExpandedBox(dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle),
            { left: -width / 2, right: width / 2, top: -metrics.gap - metrics.height * (1 + (String(label).split(/\r\n|\r|\n/).length - 1) * 1.2), bottom: -metrics.gap }, threshold);
        }
        if (scaledLabelHit || hypot2(x - layout.text.x, y - layout.text.y) <= threshold * 2.2) {
          return { constraint, target, dimension, part: "label" };
        }
        if (distancePointToSegmentPoints(x, y, layout.hitA, layout.hitB) <= threshold * 1.4) {
          return { constraint, target, dimension, part: "line" };
        }
      }
      return null;
    }
    return Object.freeze({ hitDimension });
  }
  function createRegions({ currentScope, ordinarySelectionMode, allHatches, isVisibleSketchId, isVisibleValue, hatchAppearanceForDisplay,
    activeSketchId, drawingOrderOwner, resolvedHatchBoundary, hatchContainsSelectablePoint, referenceImageWorldToLocal }) {
    function hitHatchAt(x, y, { activeOnly = !ordinarySelectionMode() } = {}) {
      const point = { x, y };
      const candidates = allHatches().filter((hatch) => {
        if (!isVisibleSketchId(hatch.sketchId) || !isVisibleValue(hatchAppearanceForDisplay(hatch).visible)) return false;
        if (!activeOnly) return true;
        return hatch.sketchId === activeSketchId();
      });
      candidates.sort((a, b) => (normalizedDrawingOrder(drawingOrderOwner(b).drawingOrder) ?? 0) - (normalizedDrawingOrder(drawingOrderOwner(a).drawingOrder) ?? 0));
      for (const hatch of candidates) {
        const resolved = resolvedHatchBoundary(hatch);
        if (hatchContainsSelectablePoint(hatch, resolved, point)) return hatch;
      }
      return null;
    }

    function hitReferenceImageAt(x, y, { activeOnly = !ordinarySelectionMode() } = {}) {
      const point = { x, y };
      for (let index = currentScope().referenceImages.length - 1; index >= 0; index -= 1) {
        const item = currentScope().referenceImages[index];
        if (!isVisibleValue(item.visible) || !isVisibleSketchId(item.sketchId)) continue;
        if (activeOnly && item.sketchId !== activeSketchId()) continue;
        const local = referenceImageWorldToLocal(item, point);
        if (Math.abs(local.x) <= item.pixelWidth / 2 && Math.abs(local.y) <= item.pixelHeight / 2) return item;
      }
      return null;
    }
    return Object.freeze({ hitHatchAt, hitReferenceImageAt });
  }
  window.GeometryHitQuery = Object.freeze({ create, createInstances, createDimensions, createRegions });
})();
