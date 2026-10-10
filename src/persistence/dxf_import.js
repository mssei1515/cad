/* Text DXF decoding and exact 2D primitive conversion. No document mutation. */
(() => {
  "use strict";
  const TAU = Math.PI * 2;
  // $INSUNITS -> millimetres (Autodesk DXF reference).
  const unitScales = [null, 25.4, 304.8, 1609344, 1, 10, 1000, 1e6, 0.0000254,
    0.0254, 914.4, 1e-7, 1e-6, 0.001, 100, 10000, 100000, 1e12,
    149597870700000, 9.4607304725808e18, 3.085677581491367e19,
    1200000 / 3937, 100000 / 3937, 3600000 / 3937, 6336000000 / 3937];
  function parse(text) {
    if (/^AutoCAD Binary DXF/.test(text) || text.includes("\u0000")) throw new Error("Binary DXF is not supported");
    const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    if (lines.length % 2) throw new Error("Incomplete DXF group pair");
    const pairs = [];
    for (let i = 0; i < lines.length; i += 2) {
      if (!/^\s*\d+\s*$/.test(lines[i])) throw new Error("Invalid DXF group code");
      const code = Number(lines[i]);
      if (code !== 999) pairs.push([code, lines[i + 1].trim()]);
    }
    let section = null, record = null, units = 0, headerVariable = null, ended = false, hasEntities = false;
    const entities = [];
    for (let i = 0; i < pairs.length; i++) {
      const [code, value] = pairs[i];
      if (ended) throw new Error("Data after DXF EOF");
      if (code === 0 && value === "SECTION") {
        if (section || pairs[i + 1]?.[0] !== 2) throw new Error("Invalid DXF section");
        section = pairs[++i][1];
        if (section === "ENTITIES") hasEntities = true;
        record = null;
      } else if (code === 0 && value === "ENDSEC") {
        if (!section) throw new Error("Unexpected DXF ENDSEC");
        section = null; record = null;
      } else if (code === 0 && value === "EOF") {
        if (section) throw new Error("Unclosed DXF section");
        ended = true;
      } else if (section === "HEADER") {
        if (code === 9) headerVariable = value;
        else if (headerVariable === "$INSUNITS" && code === 70) units = Number(value);
      } else if (section === "ENTITIES") {
        if (code === 0) { record = { type: value, pairs: [] }; entities.push(record); }
        else if (record) record.pairs.push([code, value]);
        else throw new Error("DXF entity type is missing");
      } else if (!section) throw new Error("Data outside DXF section");
    }
    if (!ended || !hasEntities) throw new Error("DXF ENTITIES section or EOF is missing");
    return { entities, scale: unitScales[units] || null };
  }
  function value(entity, code, fallback) {
    const pair = entity.pairs.find(item => item[0] === code);
    if (!pair) { if (fallback !== undefined) return fallback; throw new Error("missing coordinate"); }
    if (!pair[1] || !Number.isFinite(Number(pair[1]))) throw new Error("invalid number");
    return Number(pair[1]);
  }
  function prepare(parsed, scale, minimumLength) {
    if (!(scale > 0) || !Number.isFinite(scale)) throw new Error("Invalid DXF unit scale");
    const geometries = [], skipped = Object.create(null);
    const skip = type => { skipped[type] = (skipped[type] || 0) + 1; };
    function planar(e) {
      if ([30, 31, 38, 39, 210, 220].some(code => value(e, code, 0) !== 0)) throw new Error("3D entity");
      if (![1, -1].includes(value(e, 230, 1))) throw new Error("unsupported normal");
    }
    function point(e, xCode = 10, ocs = false) {
      return { x: value(e, xCode) * scale * (ocs ? value(e, 230, 1) : 1), y: -value(e, xCode + 10) * scale };
    }
    function polyline(e, vertices) {
      if (vertices.length < 2) throw new Error("too few vertices");
      const normal = value(e, 230, 1), items = [];
      const count = vertices.length - ((value(e, 70, 0) & 1) ? 0 : 1);
      for (let i = 0; i < count; i++) {
        const vertex = vertices[i], next = vertices[(i + 1) % vertices.length];
        planar(vertex); planar(next);
        const a = point(vertex), b = point(next), bulge = value(vertex, 42, 0);
        // Work in DXF XY to recover the circle, then reflect to canvas XY.
        a.y = -a.y; b.y = -b.y;
        if (!bulge) items.push({ type: "line", a: { x: a.x * normal, y: -a.y }, b: { x: b.x * normal, y: -b.y } });
        else {
          const dx = b.x - a.x, dy = b.y - a.y;
          const factor = (1 / bulge - bulge) / 4;
          const cx = (a.x + b.x) / 2 - dy * factor, cy = (a.y + b.y) / 2 + dx * factor;
          const start = Math.atan2(-(a.y - cy), (a.x - cx) * normal);
          items.push({ type: "arc", center: { x: cx * normal, y: -cy }, radius: Math.hypot(a.x - cx, a.y - cy), start, end: start - normal * 4 * Math.atan(bulge) });
        }
      }
      return items;
    }
    for (let i = 0; i < parsed.entities.length; i++) {
      const e = parsed.entities[i];
      let vertices = [];
      if (e.type === "POLYLINE") {
        while (parsed.entities[i + 1]?.type === "VERTEX") vertices.push(parsed.entities[++i]);
        if (parsed.entities[i + 1]?.type !== "SEQEND") throw new Error("DXF POLYLINE is missing SEQEND");
        i++;
      }
      try {
        planar(e);
        if (value(e, 67, 0) !== 0) throw new Error("paper space");
        let items;
        if (e.type === "LINE") items = [{ type: "line", a: point(e), b: point(e, 11) }];
        else if (e.type === "POINT") items = [{ type: "point", ...point(e) }];
        else if (e.type === "CIRCLE" || e.type === "ARC") {
          const item = { type: e.type.toLowerCase(), center: point(e, 10, true), radius: value(e, 40) * scale };
          if (e.type === "ARC") {
            const start = value(e, 50) * Math.PI / 180, end = value(e, 51) * Math.PI / 180;
            const normal = value(e, 230, 1);
            item.start = Math.atan2(-Math.sin(start), Math.cos(start) * normal);
            const sweep = ((end - start) % TAU + TAU) % TAU;
            item.end = item.start - normal * sweep;
          }
          items = [item];
        } else if (e.type === "LWPOLYLINE") {
          let vertex;
          for (const pair of e.pairs) {
            if (pair[0] === 10) { vertex = { pairs: [] }; vertices.push(vertex); }
            if ([10, 20, 40, 41, 42].includes(pair[0])) {
              if (!vertex) throw new Error("invalid vertex");
              vertex.pairs.push(pair);
            }
          }
          if (value(e, 90) !== vertices.length) throw new Error("vertex count mismatch");
          items = polyline(e, vertices);
        } else if (e.type === "POLYLINE") {
          if (value(e, 70, 0) & (2 | 4 | 8 | 16 | 64)) throw new Error("unsupported polyline");
          items = polyline(e, vertices);
        } else { skip(e.type); continue; }
        for (const item of items) {
          const numbers = Object.values(item).flatMap(v => typeof v === "object" ? Object.values(v) : typeof v === "number" ? [v] : []);
          if (!numbers.every(Number.isFinite)) throw new Error("invalid geometry");
          if (item.type === "line" && Math.hypot(item.a.x - item.b.x, item.a.y - item.b.y) < minimumLength) throw new Error("short line");
          if (item.radius !== undefined && item.radius < minimumLength) throw new Error("small radius");
          if (item.type === "arc" && (Math.abs(item.end - item.start) * item.radius < minimumLength || Math.abs(item.end - item.start) >= TAU - 1e-9)) throw new Error("degenerate arc");
        }
        for (const item of items) geometries.push(item);
      } catch (_error) { skip(e.type); }
    }
    return { geometries, skipped };
  }
  window.DxfImport = Object.freeze({ parse, prepare });
})();
