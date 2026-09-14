/* Local geometry restoration. Does not access or replace the current Document. */
(function () {
  "use strict";
  const { Point, Line, Circle, Arc, Spline, hypot2, MIN_ORIENTATION_LENGTH } = window.GeometrySolver;
  const { normalizeAppearance } = window.Appearance;
  const { normalizedDrawingOrder } = window.DrawingOrder;

  // Root data retains older point/radius representations than Block data.
  function decodeDocument(data, { sourceVersion, normalizeSketchId }) {
    const pointById = new Map();
    const points = [];
    const hasPointKind = data.points.some((p) => p.kind === "explicit" || p.kind === "endpoint");
    for (const p of data.points) {
      const point = new Point(String(p.id), Number(p.x), Number(p.y), Boolean(p.fixed), p.kind === "endpoint" ? "endpoint" : "explicit");
      point.sketchId = normalizeSketchId(p.sketchId);
      const appearance = normalizeAppearance(p.appearance);
      if (Object.keys(appearance).length > 0) point.appearance = appearance;
      points.push(point);
      pointById.set(point.id, point);
    }

    const lineById = new Map();
    const lines = [];
    for (const l of data.lines) {
      const p1 = pointById.get(String(l.p1));
      const p2 = pointById.get(String(l.p2));
      if (!p1 || !p2) throw new Error(`線 ${l.id} の端点が見つかりません`);
      const line = new Line(String(l.id), p1, p2, Boolean(l.construction));
      line.sketchId = normalizeSketchId(l.sketchId || p1.sketchId || p2.sketchId);
      line.drawingOrder = normalizedDrawingOrder(l.drawingOrder);
      const appearance = normalizeAppearance(l.appearance);
      if (Object.keys(appearance).length > 0) line.appearance = appearance;
      if (!hasPointKind) {
        p1.kind = "endpoint";
        p2.kind = "endpoint";
      }
      lines.push(line);
      lineById.set(line.id, line);
    }

    const circles = [];
    for (const c of data.circles || []) {
      const center = pointById.get(String(c.center));
      if (!center) throw new Error(`円 ${c.id} の中心点が見つかりません`);
      center.kind = "endpoint";
      let radius = Number(c.radius);
      if (!Number.isFinite(radius) && c.radiusPoint !== undefined) {
        const radiusPoint = pointById.get(String(c.radiusPoint));
        if (!radiusPoint) throw new Error(`円 ${c.id} の参照点が見つかりません`);
        radius = hypot2(radiusPoint.x - center.x, radiusPoint.y - center.y);
        if (!hasPointKind) radiusPoint.kind = "endpoint";
      }
      if (!Number.isFinite(radius) || radius < MIN_ORIENTATION_LENGTH) throw new Error(`円 ${c.id} の半径が正しくありません`);
      const circle = new Circle(String(c.id), center, radius, Boolean(c.construction));
      circle.sketchId = normalizeSketchId(c.sketchId || center.sketchId);
      circle.drawingOrder = normalizedDrawingOrder(c.drawingOrder);
      const appearance = normalizeAppearance(c.appearance);
      if (Object.keys(appearance).length > 0) circle.appearance = appearance;
      circles.push(circle);
    }

    const arcs = [];
    for (const a of data.arcs || []) {
      const center = pointById.get(String(a.center));
      if (!center) throw new Error(`円弧 ${a.id} の中心点が見つかりません`);
      center.kind = "endpoint";
      let radius = Number(a.radius);
      let startAngle = Number(a.startAngle);
      let endAngle = Number(a.endAngle);
      if ((!Number.isFinite(radius) || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) && a.startPoint !== undefined && a.endPoint !== undefined) {
        const startPoint = pointById.get(String(a.startPoint));
        const endPoint = pointById.get(String(a.endPoint));
        if (!startPoint || !endPoint) throw new Error(`円弧 ${a.id} の参照点が見つかりません`);
        radius = hypot2(startPoint.x - center.x, startPoint.y - center.y);
        startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
        if (!hasPointKind) {
          startPoint.kind = "endpoint";
          endPoint.kind = "endpoint";
        }
      }
      if (!Number.isFinite(radius) || radius < MIN_ORIENTATION_LENGTH || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) throw new Error(`円弧 ${a.id} の形状が正しくありません`);
      const arc = new Arc(String(a.id), center, radius, startAngle, endAngle, Boolean(a.construction));
      arc.sketchId = normalizeSketchId(a.sketchId || center.sketchId);
      arc.drawingOrder = normalizedDrawingOrder(a.drawingOrder);
      const appearance = normalizeAppearance(a.appearance);
      if (Object.keys(appearance).length > 0) arc.appearance = appearance;
      arcs.push(arc);
    }

    const splines = [];
    for (const rawSpline of sourceVersion >= 15 ? data.splines || [] : []) {
      if (sourceVersion >= 15 && (rawSpline.definitionMode !== "fit" || Number(rawSpline.degree) !== 3 || rawSpline.endCondition !== "natural" || typeof rawSpline.closed !== "boolean" || typeof rawSpline.construction !== "boolean" || !Array.isArray(rawSpline.fitPoints))) {
        throw new Error(`スプライン ${rawSpline.id} の形式が正しくありません`);
      }
      const fitPoints = (rawSpline.fitPoints || []).map((id) => pointById.get(String(id)));
      if (fitPoints.some((point) => !point) || new Set(fitPoints).size < 3) throw new Error(`スプライン ${rawSpline.id} の通過点が正しくありません`);
      const spline = new Spline(String(rawSpline.id), fitPoints, Boolean(rawSpline.closed), Boolean(rawSpline.construction));
      if (!spline.curve().valid) throw new Error(`スプライン ${rawSpline.id} を構築できません`);
      spline.sketchId = normalizeSketchId(rawSpline.sketchId || fitPoints[0]?.sketchId);
      spline.drawingOrder = normalizedDrawingOrder(rawSpline.drawingOrder);
      if (sourceVersion >= 15 && fitPoints.some((point) => String(point.sketchId) !== String(spline.sketchId))) throw new Error(`スプライン ${rawSpline.id} の通過点が別のスケッチに所属しています`);
      const appearance = normalizeAppearance(rawSpline.appearance);
      if (Object.keys(appearance).length > 0) spline.appearance = appearance;
      splines.push(spline);
    }

    const primitiveById = new Map();
    for (const c of circles) primitiveById.set(c.id, c);
    for (const a of arcs) primitiveById.set(a.id, a);
    for (const spline of splines) primitiveById.set(spline.id, spline);
    return { points, lines, circles, arcs, splines, pointById, lineById, primitiveById };
  }

  function decodeBlock(rawDefinition, { sourceVersion, normalizeSketchId: normalizeDefinitionSketchId }) {
    const pointById = new Map();
    const points = (rawDefinition.points || []).map((rawPoint) => {
      const point = new Point(String(rawPoint.id), Number(rawPoint.x), Number(rawPoint.y), Boolean(rawPoint.fixed), rawPoint.kind === "explicit" ? "explicit" : "endpoint");
      point.sketchId = normalizeDefinitionSketchId(rawPoint.sketchId);
      point.appearance = normalizeAppearance(rawPoint.appearance);
      pointById.set(point.id, point);
      return point;
    });
    const lineById = new Map();
    const lines = (rawDefinition.lines || []).map((rawLine) => {
      const p1 = pointById.get(String(rawLine.p1));
      const p2 = pointById.get(String(rawLine.p2));
      if (!p1 || !p2) throw new Error(`ブロック ${rawDefinition.id} の線端点が見つかりません`);
      const line = new Line(String(rawLine.id), p1, p2, Boolean(rawLine.construction));
      line.sketchId = normalizeDefinitionSketchId(rawLine.sketchId || p1.sketchId || p2.sketchId);
      line.drawingOrder = normalizedDrawingOrder(rawLine.drawingOrder);
      line.appearance = normalizeAppearance(rawLine.appearance);
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const circles = (rawDefinition.circles || []).map((rawCircle) => {
      const center = pointById.get(String(rawCircle.center));
      if (!center) throw new Error(`ブロック ${rawDefinition.id} の円中心が見つかりません`);
      const circle = new Circle(String(rawCircle.id), center, Number(rawCircle.radius), Boolean(rawCircle.construction));
      circle.sketchId = normalizeDefinitionSketchId(rawCircle.sketchId || center.sketchId);
      circle.drawingOrder = normalizedDrawingOrder(rawCircle.drawingOrder);
      circle.appearance = normalizeAppearance(rawCircle.appearance);
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const arcs = (rawDefinition.arcs || []).map((rawArc) => {
      const center = pointById.get(String(rawArc.center));
      if (!center) throw new Error(`ブロック ${rawDefinition.id} の円弧中心が見つかりません`);
      const arc = new Arc(String(rawArc.id), center, Number(rawArc.radius), Number(rawArc.startAngle), Number(rawArc.endAngle), Boolean(rawArc.construction));
      arc.sketchId = normalizeDefinitionSketchId(rawArc.sketchId || center.sketchId);
      arc.drawingOrder = normalizedDrawingOrder(rawArc.drawingOrder);
      arc.appearance = normalizeAppearance(rawArc.appearance);
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const splines = (sourceVersion >= 15 ? rawDefinition.splines || [] : []).map((rawSpline) => {
      if (sourceVersion >= 15 && (rawSpline.definitionMode !== "fit" || Number(rawSpline.degree) !== 3 || rawSpline.endCondition !== "natural" || typeof rawSpline.closed !== "boolean" || typeof rawSpline.construction !== "boolean" || !Array.isArray(rawSpline.fitPoints))) {
        throw new Error(`ブロック ${rawDefinition.id} のスプライン ${rawSpline.id} の形式が正しくありません`);
      }
      const fitPoints = (rawSpline.fitPoints || []).map((id) => pointById.get(String(id)));
      if (fitPoints.some((point) => !point) || new Set(fitPoints).size < 3) throw new Error(`ブロック ${rawDefinition.id} のスプライン ${rawSpline.id} の通過点が正しくありません`);
      const spline = new Spline(String(rawSpline.id), fitPoints, Boolean(rawSpline.closed), Boolean(rawSpline.construction));
      if (!spline.curve().valid) throw new Error(`ブロック ${rawDefinition.id} のスプライン ${rawSpline.id} を構築できません`);
      spline.sketchId = normalizeDefinitionSketchId(rawSpline.sketchId || fitPoints[0]?.sketchId);
      spline.drawingOrder = normalizedDrawingOrder(rawSpline.drawingOrder);
      if (sourceVersion >= 15 && fitPoints.some((point) => String(point.sketchId) !== String(spline.sketchId))) throw new Error(`ブロック ${rawDefinition.id} のスプライン ${rawSpline.id} の通過点が別のスケッチに所属しています`);
      spline.appearance = normalizeAppearance(rawSpline.appearance);
      primitiveById.set(spline.id, spline);
      return spline;
    });
    return { points, lines, circles, arcs, splines, pointById, lineById, primitiveById };
  }

  window.GeometryPersistence = Object.freeze({ decodeDocument, decodeBlock });
})();
