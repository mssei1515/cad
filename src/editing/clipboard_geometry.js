/* Materialize copied primitive geometry and Block instances; the caller owns paste rollback and commit. */
(() => {
  "use strict";
  function create({ geometryIds, ensureLineMinimumLength, normalizeArcSweep, blockDefinitionById, allocateBlockInstanceId, allocateGeometryInstanceId, normalizeGeometryInstance, copiedGeometryInstance, applicationText }) {
    const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;
    const { normalizeAppearance } = window.Appearance;
    function append(model, payload, targetSketchId, dx, dy) {
      const idMap = new Map();
      const pointById = new Map();
      const lineById = new Map();
      const primitiveById = new Map();
      for (const source of payload.points) {
        const point = new Point(geometryIds.allocate("point"), source.x + dx, source.y + dy, source.fixed, source.kind === "endpoint" ? "endpoint" : "explicit");
        point.sketchId = targetSketchId;
        point.appearance = normalizeAppearance(source.appearance);
        model.points.push(point);
        idMap.set(source.id, point.id);
        pointById.set(point.id, point);
      }
      for (const source of payload.lines) {
        const line = new Line(geometryIds.allocate("line"), pointById.get(idMap.get(source.p1)), pointById.get(idMap.get(source.p2)), source.construction);
        line.sketchId = targetSketchId;
        line.appearance = normalizeAppearance(source.appearance);
        ensureLineMinimumLength(line);
        model.lines.push(line);
        idMap.set(source.id, line.id);
        lineById.set(line.id, line);
      }
      for (const source of payload.circles) {
        const circle = new Circle(geometryIds.allocate("circle"), pointById.get(idMap.get(source.center)), source.radius, source.construction);
        circle.sketchId = targetSketchId;
        circle.appearance = normalizeAppearance(source.appearance);
        model.circles.push(circle);
        idMap.set(source.id, circle.id);
        primitiveById.set(circle.id, circle);
      }
      for (const source of payload.arcs) {
        const arc = new Arc(geometryIds.allocate("arc"), pointById.get(idMap.get(source.center)), source.radius, source.startAngle, source.endAngle, source.construction);
        arc.sketchId = targetSketchId;
        arc.appearance = normalizeAppearance(source.appearance);
        normalizeArcSweep(arc);
        model.arcs.push(arc);
        idMap.set(source.id, arc.id);
        primitiveById.set(arc.id, arc);
      }
      for (const source of payload.splines || []) {
        const fitPoints = source.fitPoints.map((id) => pointById.get(idMap.get(id)));
        if (fitPoints.some((point) => !point)) throw new Error(`スプライン ${source.id} の通過点を複製できません`);
        const spline = new Spline(geometryIds.allocate("spline"), fitPoints, source.closed, source.construction);
        spline.sketchId = targetSketchId;
        spline.appearance = normalizeAppearance(source.appearance);
        model.splines.push(spline);
        idMap.set(source.id, spline.id);
        primitiveById.set(spline.id, spline);
      }
      return { idMap, pointById, lineById, primitiveById };
    }
    function appendBlocks(model, payload, targetSketchId, dx, dy, idMap) {
      const pastedBlockInstances = [];
      for (const source of payload.blockInstances) {
        const definition = blockDefinitionById(source.definitionId);
        if (!definition) throw new Error(`ブロック定義 ${source.definitionId} が見つかりません`);
        const instance = {
          id: allocateBlockInstanceId(),
          definitionId: source.definitionId,
          sketchId: targetSketchId,
          x: source.x + dx,
          y: source.y + dy,
          rotation: source.rotation,
          fixed: source.fixed,
          rotationLocked: Boolean(source.rotationLocked),
          enabledSketchIds: source.enabledSketchIds.slice(),
          appearanceOverride: normalizeAppearance(source.appearanceOverride),
        };
        model.blockInstances.push(instance);
        pastedBlockInstances.push(instance);
        idMap.set(source.id, instance.id);
      }
      return pastedBlockInstances;
    }
    function appendDerived(model, payload, targetSketchId, dx, dy, idMap, destinationNamespace) {
      const copiedInstances = payload.geometryInstances || [];
      for (const source of copiedInstances) {
        const id = allocateGeometryInstanceId(source.type);
        idMap.set(source.id, id);
      }
      const projectionRecords = copiedInstances.flatMap(source => Object.values(source.projection || {}).flat());
      // Resolve legacy output IDs and multi-level instance paths before rewriting references.
      for (let pass = 0; pass <= copiedInstances.length; pass++) {
        for (const record of projectionRecords) idMap.set(record.id, record.path.flatMap(id => (idMap.get(id) || id).split('@')).join('@'));
      }
      if (payload.parameterNamespaceKey !== destinationNamespace && copiedInstances.some(source =>
        [...source.sources, source.axis, source.direction].filter(Boolean).some(ref => !idMap.has(ref.path.join('@')) && !idMap.has(ref.path[0])))) {
        throw new Error(applicationText('別の名前空間へ派生インスタンスを貼り付けるには参照先も選択してください', 'Also select referenced geometry to paste derived instances into another namespace'));
      }
      const pastedGeometryInstances = copiedInstances.map(source => normalizeGeometryInstance(copiedGeometryInstance(source, idMap, targetSketchId, dx, dy)));
      model.geometryInstances.push(...pastedGeometryInstances);
      return pastedGeometryInstances;
    }
    return Object.freeze({ append, appendBlocks, appendDerived });
  }
  window.ClipboardGeometry = Object.freeze({ create });
})();
