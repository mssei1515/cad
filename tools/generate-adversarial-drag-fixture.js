const fs = require("fs");
const path = require("path");

const outputPath = path.resolve(__dirname, "../test-data/意地悪ドラッグ完全拘束.json");
const data = {
  version: 1,
  savedAt: "2026-08-09T00:00:00.000Z",
  documentName: "意地悪ドラッグ完全拘束",
  points: [],
  lines: [],
  circles: [],
  arcs: [],
  constraints: [],
  testPlan: {
    purpose: "Moderately sized fully constrained mixed-scale fixture with one absolute anchor point and no fixed geometry constraints.",
    baselineExpectation: {
      stable: true,
      freeVariableCount: 0,
      fixedPointCount: 1,
      fixedGeometryConstraintCount: 0,
      redundantConstraintCount: 0,
    },
    recommendedCases: [],
  },
};

const points = new Map();
const lines = new Map();
const circles = new Map();
const arcs = new Map();
const constraintKeys = new Set();

function point(id, x, y, options = {}) {
  if (points.has(id)) return points.get(id);
  const value = {
    id,
    x,
    y,
    fixed: options.fixed === true,
    kind: options.kind || "endpoint",
  };
  points.set(id, value);
  data.points.push(value);
  return value;
}

function line(id, x1, y1, x2, y2, options = {}) {
  const p1 = options.p1 || point(`${id}_P1`, x1, y1, { kind: options.kind });
  const p2 = options.p2 || point(`${id}_P2`, x2, y2, { kind: options.kind });
  const value = { id, p1: p1.id, p2: p2.id };
  if (options.construction) value.construction = true;
  data.lines.push(value);
  const result = { ...value, p1Object: p1, p2Object: p2 };
  lines.set(id, result);
  return result;
}

function circle(id, center, radius) {
  const value = { id, center: center.id, radius };
  data.circles.push(value);
  const result = { ...value, centerObject: center };
  circles.set(id, result);
  return result;
}

function arc(id, center, radius, startAngle, endAngle) {
  const value = { id, center: center.id, radius, startAngle, endAngle };
  data.arcs.push(value);
  const result = { ...value, centerObject: center };
  arcs.set(id, result);
  return result;
}

function constraintKey(value) {
  const normalized = { ...value };
  const symmetricFields = {
    coincident: ["p1", "p2"],
    parallel: ["line1", "line2"],
    perpendicular: ["line1", "line2"],
    collinear: ["line1", "line2"],
    equalLength: ["line1", "line2"],
    concentric: ["a", "b"],
    equalRadius: ["a", "b"],
    circleCircleTangent: ["a", "b"],
  }[normalized.type];
  if (symmetricFields) {
    const [first, second] = symmetricFields;
    [normalized[first], normalized[second]] = [normalized[first], normalized[second]].sort();
  }
  return JSON.stringify(Object.fromEntries(Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b))));
}

function addConstraint(value) {
  const key = constraintKey(value);
  if (constraintKeys.has(key)) throw new Error(`Duplicate constraint: ${key}`);
  constraintKeys.add(key);
  data.constraints.push({ ...value, enabled: true });
  return value;
}

function lineLength(value) {
  return Math.hypot(value.p2Object.x - value.p1Object.x, value.p2Object.y - value.p1Object.y);
}

function signedPointLineDistance(target, source) {
  const dx = source.p2Object.x - source.p1Object.x;
  const dy = source.p2Object.y - source.p1Object.y;
  const length = Math.hypot(dx, dy);
  return ((target.x - source.p1Object.x) * -dy + (target.y - source.p1Object.y) * dx) / length;
}

function endpoint(center, radius, angle) {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
}

function axisAngle(angle) {
  return Math.acos(Math.max(-1, Math.min(1, Math.cos(angle))));
}

const origin = point("P_ORIGIN", 0, 0, { fixed: true, kind: "explicit" });

function constrainAxis(target, axis, reference = origin) {
  if (target === reference) return;
  const delta = target[axis] - reference[axis];
  addConstraint({
    type: "pointAxisDistance",
    p1: reference.id,
    p2: target.id,
    axis,
    sign: delta < 0 ? -1 : 1,
    target: Math.abs(delta),
  });
}

function constrainXY(target, reference = origin) {
  constrainAxis(target, "x", reference);
  constrainAxis(target, "y", reference);
}

function constrainLength(value) {
  addConstraint({ type: "distance", p1: value.p1, p2: value.p2, target: lineLength(value) });
}

function constrainDirection(value, angle, reference = null) {
  if (Math.abs(Math.sin(angle)) < 1e-10) {
    addConstraint({ type: "horizontal", line: value.id });
  } else if (Math.abs(Math.cos(angle)) < 1e-10) {
    addConstraint({ type: "vertical", line: value.id });
  } else {
    addConstraint({ type: "lineAngle", line1: (reference || axisX).id, line2: value.id, target: axisAngle(angle) });
  }
}

function constrainPlacedLine(value, angle) {
  constrainXY(value.p1Object);
  constrainDirection(value, angle);
  constrainLength(value);
}

function selector(type, fields) {
  return { type, ...fields };
}

function casePlan(name, removed, drags, expected = "movable") {
  data.testPlan.recommendedCases.push({ name, removed, drags, expected });
}

// One absolute point anchors the whole sketch. The two axes establish global
// orientation and scale without using lineFixed or arcEndpointFixed.
const axisX = line("L_AXIS_X", 0, 0, 1600, 0, { p1: origin, construction: true });
addConstraint({ type: "horizontal", line: axisX.id });
constrainLength(axisX);
const axisY = line("L_AXIS_Y", 0, 0, 0, 1100, { p1: origin, construction: true });
addConstraint({ type: "vertical", line: axisY.id });
constrainLength(axisY);

// Mixed-scale line field: dimensions range from 2.5 mm through 3,200 mm.
const top = line("L_TOP", -1500, -820, 1500, -820);
constrainXY(top.p1Object);
addConstraint({ type: "parallel", line1: axisX.id, line2: top.id });
constrainLength(top);

const bottom = line("L_BOTTOM", -1500, 860, 1500, 860);
constrainAxis(bottom.p1Object, "x");
const topDistance = signedPointLineDistance(bottom.p1Object, top);
addConstraint({ type: "lineLineDistance", line1: top.id, line2: bottom.id, sign: Math.sign(topDistance), target: Math.abs(topDistance) });
constrainLength(bottom);

const tiny = line("L_TINY", -1450, -760, -1444, -760);
constrainXY(tiny.p1Object);
addConstraint({ type: "pointHorizontal", p1: tiny.p1, p2: tiny.p2 });
constrainLength(tiny);

const diag45A = line("L_DIAG_45_A", -1200, -500, -900, -200);
constrainPlacedLine(diag45A, Math.PI / 4);
const diag45B = line("L_DIAG_45_B", -850, -500, -550, -200);
constrainXY(diag45B.p1Object);
addConstraint({ type: "parallel", line1: diag45A.id, line2: diag45B.id });
addConstraint({ type: "equalLength", line1: diag45A.id, line2: diag45B.id });
const diagNeg = line("L_DIAG_NEG", -450, -180, -150, -480);
constrainXY(diagNeg.p1Object);
addConstraint({ type: "perpendicular", line1: diag45A.id, line2: diagNeg.id });
constrainLength(diagNeg);

const equalA = line("L_EQUAL_A", -1300, 700, -1180, 760);
constrainPlacedLine(equalA, Math.atan2(60, 120));
const equalB = line("L_EQUAL_B", -1050, 700, -930, 760);
constrainXY(equalB.p1Object);
addConstraint({ type: "parallel", line1: equalA.id, line2: equalB.id });
addConstraint({ type: "equalLength", line1: equalA.id, line2: equalB.id });

const colA = line("L_COL_A", 150, 0, 430, 0);
constrainAxis(colA.p1Object, "x");
addConstraint({ type: "collinear", line1: axisX.id, line2: colA.id });
constrainLength(colA);
const colB = line("L_COL_B", 520, 0, 920, 0);
constrainAxis(colB.p1Object, "x");
addConstraint({ type: "collinear", line1: colA.id, line2: colB.id });
constrainLength(colB);

const midSupport = line("L_MID_SUPPORT", 800, -700, 1200, -500);
constrainPlacedLine(midSupport, Math.atan2(200, 400));
const midpointProbe = point("P_MIDPOINT_PROBE", 1000, -600, { kind: "explicit" });
addConstraint({ type: "pointOnLineMidpoint", point: midpointProbe.id, line: midSupport.id });

const offsetSource = line("L_OFFSET_SOURCE", 200, -650, 500, -450);
constrainPlacedLine(offsetSource, Math.atan2(200, 300));
const offsetNormalLength = 37;
const sourceLength = lineLength(offsetSource);
const offsetX = -(offsetSource.p2Object.y - offsetSource.p1Object.y) / sourceLength * offsetNormalLength;
const offsetY = (offsetSource.p2Object.x - offsetSource.p1Object.x) / sourceLength * offsetNormalLength;
const offsetCopy = line(
  "L_OFFSET_COPY",
  offsetSource.p1Object.x + offsetX,
  offsetSource.p1Object.y + offsetY,
  offsetSource.p2Object.x + offsetX,
  offsetSource.p2Object.y + offsetY,
);
addConstraint({ type: "offsetDimension", source: offsetSource.id, offset: offsetCopy.id, sign: 1, target: offsetNormalLength, directionBasis: "endpoint" });

const coincidentA = line("L_COIN_A", -300, 650, -200, 700);
constrainPlacedLine(coincidentA, Math.atan2(50, 100));
const coincidentB = line("L_COIN_B", -300, 650, -250, 780);
addConstraint({ type: "coincident", p1: coincidentA.p1, p2: coincidentB.p1 });
constrainDirection(coincidentB, Math.atan2(130, 50));
constrainLength(coincidentB);

const pointOnAxis = point("P_ON_AXIS", 760, 0, { kind: "explicit" });
constrainAxis(pointOnAxis, "x");
addConstraint({ type: "pointOnLine", point: pointOnAxis.id, line: axisX.id });
const pointAboveTop = point("P_ABOVE_TOP", 420, -700, { kind: "explicit" });
constrainAxis(pointAboveTop, "x");
const pointTopDistance = signedPointLineDistance(pointAboveTop, top);
addConstraint({ type: "pointLineDistance", point: pointAboveTop.id, line: top.id, sign: Math.sign(pointTopDistance), target: Math.abs(pointTopDistance) });

// A four-way branching stage forms a moderately deep directed constraint graph. Each
// pair of branches converges at a point determined by two distance constraints;
// the pairwise merges then converge again before the next stage begins. This
// makes every merge solve new freedom instead of closing an already-fixed loop.
let graphDirectionReference = null;

function constrainedSegment(id, start, length, angle) {
  const end = point(
    `${id}_P2`,
    start.x + Math.cos(angle) * length,
    start.y + Math.sin(angle) * length,
  );
  const value = line(id, start.x, start.y, end.x, end.y, { p1: start, p2: end });
  if (!graphDirectionReference) throw new Error("Graph direction reference is not initialized");
  addConstraint({ type: "lineAngle", line1: graphDirectionReference.id, line2: value.id, target: axisAngle(angle) });
  constrainLength(value);
  return end;
}

function branchPath(stageId, branchIndex, root, scale, baseAngle) {
  const lengthFactors = [1];
  const angleOffsets = [0.08];
  let current = root;
  for (let index = 0; index < lengthFactors.length; index += 1) {
    const parity = (branchIndex + index) % 2 === 0 ? 1 : -1;
    current = constrainedSegment(
      `L_GRAPH_${stageId}_B${branchIndex + 1}_${index + 1}`,
      current,
      scale * lengthFactors[index],
      baseAngle + angleOffsets[index] * parity,
    );
  }
  return current;
}

function mergeByDistances(id, first, second, advance) {
  const merge = point(
    `P_GRAPH_${id}`,
    Math.max(first.x, second.x) + advance,
    (first.y + second.y) / 2 + advance * 0.17,
  );
  const firstBridge = line(`L_GRAPH_${id}_A`, first.x, first.y, merge.x, merge.y, { p1: first, p2: merge });
  const secondBridge = line(`L_GRAPH_${id}_B`, second.x, second.y, merge.x, merge.y, { p1: second, p2: merge });
  constrainLength(firstBridge);
  constrainLength(secondBridge);
  return merge;
}

function branchingStage(stageId, root, scale) {
  const baseAngles = [-0.82, -0.28, 0.28, 0.82];
  const ends = baseAngles.map((angle, index) => branchPath(stageId, index, root, scale, angle));
  const lowerMerge = mergeByDistances(`${stageId}_MERGE_LOWER`, ends[0], ends[1], scale * 0.9);
  const upperMerge = mergeByDistances(`${stageId}_MERGE_UPPER`, ends[2], ends[3], scale * 0.9);
  return mergeByDistances(`${stageId}_MERGE_FINAL`, lowerMerge, upperMerge, scale * 1.1);
}

let graphPoint = point("P_GRAPH_ROOT", -1350, 260, { kind: "endpoint" });
constrainXY(graphPoint);
graphDirectionReference = line("L_BRANCH_ANGLE_REFERENCE", graphPoint.x, graphPoint.y, graphPoint.x + 160, graphPoint.y, {
  p1: graphPoint,
  construction: true,
});
addConstraint({ type: "horizontal", line: graphDirectionReference.id });
constrainLength(graphDirectionReference);
graphPoint = branchingStage("S1", graphPoint, 85);
const tailSpecs = [
  [210, 0.18], [75, 1.17], [380, 0.62], [42, 2.38], [610, 0.09], [18, 1.92],
];
for (let index = 0; index < tailSpecs.length; index += 1) {
  graphPoint = constrainedSegment(`L_GRAPH_TAIL_${index + 1}`, graphPoint, tailSpecs[index][0], tailSpecs[index][1]);
}

function analyzeGeneratedConstraintGraph() {
  const graphLines = data.lines.filter((value) => value.id.startsWith("L_GRAPH_"));
  const adjacency = new Map();
  const indegree = new Map();
  for (const value of graphLines) {
    const outgoing = adjacency.get(value.p1) || [];
    outgoing.push(value.p2);
    adjacency.set(value.p1, outgoing);
    indegree.set(value.p2, (indegree.get(value.p2) || 0) + 1);
  }
  const memo = new Map();
  function longestFrom(pointId, visiting = new Set()) {
    if (memo.has(pointId)) return memo.get(pointId);
    if (visiting.has(pointId)) throw new Error(`Constraint graph cycle at ${pointId}`);
    const nextVisiting = new Set(visiting).add(pointId);
    const result = Math.max(0, ...(adjacency.get(pointId) || []).map((nextId) => 1 + longestFrom(nextId, nextVisiting)));
    memo.set(pointId, result);
    return result;
  }
  return {
    longestGeometryPath: longestFrom("P_GRAPH_ROOT"),
    branchStages: new Set(graphLines.map((value) => /^L_GRAPH_(S\d+)_B/.exec(value.id)?.[1]).filter(Boolean)).size,
    branchPaths: graphLines.filter((value) => /^L_GRAPH_S\d+_B\d+_1$/.test(value.id)).length,
    mergePoints: [...indegree.values()].filter((value) => value > 1).length,
    maxFanOut: Math.max(...[...adjacency.values()].map((value) => value.length)),
  };
}

const graphAnalysis = analyzeGeneratedConstraintGraph();
const expectedGraphAnalysis = {
  longestGeometryPath: 9,
  branchStages: 1,
  branchPaths: 4,
  mergePoints: 3,
  maxFanOut: 4,
};
if (JSON.stringify(graphAnalysis) !== JSON.stringify(expectedGraphAnalysis)) {
  throw new Error(`Unexpected constraint graph: ${JSON.stringify(graphAnalysis)}`);
}
data.testPlan.constraintGraph = graphAnalysis;

// Circle field: dimensions, equality, concentricity, offsets, tangency, and a
// point-on-circle relation all contribute necessary rank.
function placedCircle(id, x, y, radius, dimensionType = "radiusDimension") {
  const center = point(`P_CENTER_${id}`, x, y, { kind: "center" });
  constrainXY(center);
  const value = circle(id, center, radius);
  if (dimensionType) {
    addConstraint({
      type: dimensionType,
      primitive: id,
      target: dimensionType === "diameterDimension" ? radius * 2 : radius,
    });
  }
  return value;
}

const cBase = placedCircle("C_BASE", -920, -560, 35);
const cEqual = placedCircle("C_EQUAL", -760, -560, 35, null);
addConstraint({ type: "equalRadius", a: cBase.id, b: cEqual.id });

const cConcentricCenter = point("P_CENTER_C_CONCENTRIC_BASE", -920, -560, { kind: "center" });
const cConcentricBase = circle("C_CONCENTRIC_BASE", cConcentricCenter, 70);
addConstraint({ type: "concentric", a: cBase.id, b: cConcentricBase.id });
addConstraint({ type: "radiusDimension", primitive: cConcentricBase.id, target: 70 });
const cOffsetCenter = point("P_CENTER_C_OFFSET", -920, -560, { kind: "center" });
const cOffset = circle("C_OFFSET", cOffsetCenter, 105);
addConstraint({ type: "offsetDimension", source: cConcentricBase.id, offset: cOffset.id, sign: 1, target: 35, directionBasis: "radial" });

const tangentLine = line("L_TANGENT_CIRCLE", -700, -265, -340, -265);
constrainXY(tangentLine.p1Object);
addConstraint({ type: "horizontal", line: tangentLine.id });
constrainLength(tangentLine);
const cTangent = placedCircle("C_TANGENT", -520, -320, 55, null);
addConstraint({ type: "lineCircleTangent", line: tangentLine.id, primitive: cTangent.id, sign: -1 });

const cExtA = placedCircle("C_EXT_A", 100, -520, 80, "diameterDimension");
const cExtB = placedCircle("C_EXT_B", 230, -520, 50, null);
addConstraint({ type: "circleCircleTangent", a: cExtA.id, b: cExtB.id, mode: "external" });
const cIntA = placedCircle("C_INT_A", 520, -470, 140);
const cIntB = placedCircle("C_INT_B", 610, -470, 50, null);
addConstraint({ type: "circleCircleTangent", a: cIntA.id, b: cIntB.id, mode: "internal" });
const cHuge = placedCircle("C_HUGE", 900, 160, 420, "diameterDimension");
const cNear = placedCircle("C_NEAR", 1425, 160, 105, null);
addConstraint({ type: "circleCircleTangent", a: cHuge.id, b: cNear.id, mode: "external" });

const circleProbe = point("P_CIRCLE_PROBE", 1320, 160, { kind: "explicit" });
constrainAxis(circleProbe, "y");
addConstraint({ type: "pointOnCircle", point: circleProbe.id, primitive: cHuge.id });

const cArcGuide = placedCircle("C_ARC_GUIDE", 227, 410, 20);

// Arc field: radial guides replace all fixed endpoint constraints.
function guideLine(id, center, radius, angle, extra = 35) {
  const length = radius + extra;
  const p2 = point(
    `${id}_P2`,
    center.x + Math.cos(angle) * length,
    center.y + Math.sin(angle) * length,
  );
  const value = line(id, center.x, center.y, p2.x, p2.y, { p1: center, p2, construction: true });
  constrainDirection(value, angle);
  constrainLength(value);
  return value;
}

function guidedArc(id, x, y, radius, startAngle, endAngle, radiusMode = "radiusDimension") {
  const center = point(`P_CENTER_${id}`, x, y, { kind: "center" });
  constrainXY(center);
  const value = arc(id, center, radius, startAngle, endAngle);
  if (radiusMode) {
    addConstraint({
      type: radiusMode,
      primitive: id,
      target: radiusMode === "diameterDimension" ? radius * 2 : radius,
    });
  }
  const startGuide = guideLine(`L_RADIAL_${id}_START`, center, radius, startAngle);
  const endGuide = guideLine(`L_RADIAL_${id}_END`, center, radius, endAngle);
  addConstraint({ type: "arcEndpointOnLine", arc: id, endpoint: "start", line: startGuide.id });
  addConstraint({ type: "arcEndpointOnLine", arc: id, endpoint: "end", line: endGuide.id });
  return value;
}

function tangentSupportLine(id, center, radius, contactAngle, length = Math.max(80, radius * 1.4)) {
  const contact = endpoint(center, radius, contactAngle);
  const tangentAngle = contactAngle + Math.PI / 2;
  const half = length / 2;
  let p1x = contact.x - Math.cos(tangentAngle) * half;
  let p1y = contact.y - Math.sin(tangentAngle) * half;
  let p2x = contact.x + Math.cos(tangentAngle) * half;
  let p2y = contact.y + Math.sin(tangentAngle) * half;
  const horizontal = Math.abs(Math.sin(tangentAngle)) < 1e-10;
  const vertical = Math.abs(Math.cos(tangentAngle)) < 1e-10;
  if ((horizontal && p2x < p1x) || (vertical && p2y < p1y)) {
    [p1x, p2x] = [p2x, p1x];
    [p1y, p2y] = [p2y, p1y];
  }
  const value = line(id, p1x, p1y, p2x, p2y);
  constrainPlacedLine(value, tangentAngle);
  const signedDistance = signedPointLineDistance(center, value);
  return { line: value, sign: signedDistance < 0 ? -1 : 1 };
}

function tangentGuidedArc(id, x, y, radius, startAngle, endAngle) {
  const value = guidedArc(id, x, y, radius, startAngle, endAngle, null);
  const support = tangentSupportLine(
    `L_TANGENT_${id}`,
    value.centerObject,
    radius,
    startAngle + (endAngle - startAngle) / 2,
  );
  addConstraint({ type: "lineCircleTangent", line: support.line.id, primitive: value.id, sign: support.sign });
  return value;
}

const aBase = tangentGuidedArc("A_BASE", -1000, 350, 160, -Math.PI / 4, 3 * Math.PI / 4);
const aEqual = guidedArc("A_EQUAL", -600, 350, 160, Math.PI / 8, 1.35 * Math.PI, null);
addConstraint({ type: "equalRadius", a: aBase.id, b: aEqual.id });
const aRadial = tangentGuidedArc("A_RADIAL", -180, 380, 95, Math.PI / 18, 11 * Math.PI / 9);

const endpointCenter = point("P_CENTER_A_ENDPOINT", 180, 430, { kind: "center" });
constrainXY(endpointCenter);
const aEndpoint = arc("A_ENDPOINT", endpointCenter, 47, 0, 35 * Math.PI / 18);
addConstraint({ type: "radiusDimension", primitive: aEndpoint.id, target: 47 });
const endpointEndGuide = guideLine("L_RADIAL_A_ENDPOINT_END", endpointCenter, 47, 35 * Math.PI / 18);
addConstraint({ type: "arcEndpointOnCircle", arc: aEndpoint.id, endpoint: "start", primitive: cArcGuide.id });
addConstraint({ type: "arcEndpointOnLine", arc: aEndpoint.id, endpoint: "end", line: endpointEndGuide.id });

const tangentArcLine = line("L_TANGENT_ARC", 280, 505, 610, 505);
constrainXY(tangentArcLine.p1Object);
addConstraint({ type: "horizontal", line: tangentArcLine.id });
constrainLength(tangentArcLine);
const tangentArcCenter = point("P_CENTER_A_TANGENT", 440, 430, { kind: "center" });
constrainXY(tangentArcCenter);
const aTangent = arc("A_TANGENT", tangentArcCenter, 75, -Math.PI / 3, 5 * Math.PI / 6);
const tangentStartGuide = guideLine("L_RADIAL_A_TANGENT_START", tangentArcCenter, 75, -Math.PI / 3);
const tangentEndGuide = guideLine("L_RADIAL_A_TANGENT_END", tangentArcCenter, 75, 5 * Math.PI / 6);
addConstraint({ type: "lineCircleTangent", line: tangentArcLine.id, primitive: aTangent.id, sign: -1 });
addConstraint({ type: "arcEndpointOnLine", arc: aTangent.id, endpoint: "start", line: tangentStartGuide.id });
addConstraint({ type: "arcEndpointOnLine", arc: aTangent.id, endpoint: "end", line: tangentEndGuide.id });

const aOffsetBase = tangentGuidedArc("A_OFFSET_BASE", 760, 430, 120, Math.PI / 9, 8 * Math.PI / 9);
const offsetArcCenter = point("P_CENTER_A_OFFSET", 760, 430, { kind: "center" });
const aOffset = arc("A_OFFSET", offsetArcCenter, 180, Math.PI / 9, 8 * Math.PI / 9);
addConstraint({ type: "offsetDimension", source: aOffsetBase.id, offset: aOffset.id, sign: 1, target: 60, directionBasis: "radial" });

const guidedArcSpecs = [
  ["A_HUGE", -520, -40, 520, -Math.PI / 2, Math.PI],
  ["A_NEAR_FULL", 500, -40, 190, Math.PI / 180, 359 * Math.PI / 180],
];
for (const spec of guidedArcSpecs) {
  if (spec[0] === "A_NEAR_FULL") tangentGuidedArc(...spec);
  else guidedArc(...spec);
}

// A compact arc-to-arc tangency chain mixes radii, sweep sizes, and
// contact directions. The target arc radius is left free until its tangency is
// applied, so every tangency contributes rank.
let previousTangentArc = aBase;
const externalTangentArcs = [];
const externalArcTangencySpecs = [
  [40, -0.35, 0.2, 1.8],
  [85, 0.62, -1.1, 0.7],
];
for (let index = 0; index < externalArcTangencySpecs.length; index += 1) {
  const [radius, direction, startAngle, endAngle] = externalArcTangencySpecs[index];
  const previousRadius = previousTangentArc.radius;
  const centerDistance = previousRadius + radius;
  const x = previousTangentArc.centerObject.x + Math.cos(direction) * centerDistance;
  const y = previousTangentArc.centerObject.y + Math.sin(direction) * centerDistance;
  const value = guidedArc(`A_ARC_TANGENT_EXT_${index + 1}`, x, y, radius, startAngle, endAngle, null);
  addConstraint({ type: "circleCircleTangent", a: previousTangentArc.id, b: value.id, mode: "external" });
  externalTangentArcs.push(value);
  previousTangentArc = value;
}

const hugeTangentBase = arcs.get("A_HUGE");
const internalTangentArcs = [];
const internalArcTangencySpecs = [
  [200, 0.42, -0.4, 1.6],
];
for (let index = 0; index < internalArcTangencySpecs.length; index += 1) {
  const [radius, direction, startAngle, endAngle] = internalArcTangencySpecs[index];
  const centerDistance = Math.abs(hugeTangentBase.radius - radius);
  const x = hugeTangentBase.centerObject.x + Math.cos(direction) * centerDistance;
  const y = hugeTangentBase.centerObject.y + Math.sin(direction) * centerDistance;
  const value = guidedArc(`A_ARC_TANGENT_INT_${index + 1}`, x, y, radius, startAngle, endAngle, null);
  addConstraint({ type: "circleCircleTangent", a: hugeTangentBase.id, b: value.id, mode: "internal" });
  internalTangentArcs.push(value);
}

// Removing these constraints exposes deliberately different local manifolds.
casePlan(
  "tiny-line-length-single",
  [selector("distance", { p1: tiny.p1, p2: tiny.p2 })],
  [{ kind: "point", id: tiny.p2 }, { kind: "line", id: tiny.id }],
);
casePlan(
  "large-diagonal-two-relations",
  [selector("lineAngle", { line1: axisX.id, line2: diag45A.id }), selector("distance", { p1: diag45A.p1, p2: diag45A.p2 })],
  [{ kind: "point", id: diag45A.p2 }, { kind: "line", id: diag45A.id }],
);
casePlan(
  "equal-circle-radius-single",
  [selector("equalRadius", { a: cBase.id, b: cEqual.id })],
  [{ kind: "circle", id: cEqual.id }],
);
casePlan(
  "tangent-circle-radius-single",
  [selector("lineCircleTangent", { line: tangentLine.id, primitive: cTangent.id })],
  [{ kind: "circle", id: cTangent.id }],
);
casePlan(
  "huge-circle-center-multiple",
  [
    selector("pointAxisDistance", { p2: cHuge.centerObject.id, axis: "x" }),
    selector("pointAxisDistance", { p2: cHuge.centerObject.id, axis: "y" }),
    selector("circleCircleTangent", { a: cHuge.id, b: cNear.id }),
  ],
  [{ kind: "point", id: cHuge.centerObject.id }, { kind: "circle", id: cHuge.id }],
);
casePlan(
  "radial-arc-tangency-single",
  [selector("lineCircleTangent", { primitive: aRadial.id })],
  [{ kind: "arc", id: aRadial.id }],
);
casePlan(
  "equal-arc-radius-single",
  [selector("equalRadius", { a: aBase.id, b: aEqual.id })],
  [{ kind: "arc", id: aEqual.id }],
);
casePlan(
  "tangent-arc-radius-single",
  [selector("lineCircleTangent", { line: tangentArcLine.id, primitive: aTangent.id })],
  [{ kind: "arc", id: aTangent.id }],
);
casePlan(
  "arc-endpoint-single",
  [selector("arcEndpointOnLine", { arc: aEndpoint.id, endpoint: "end", line: endpointEndGuide.id })],
  [{ kind: "arc-endpoint", id: aEndpoint.id, endpoint: "end" }],
);
casePlan(
  "offset-arc-all-parameters",
  [selector("offsetDimension", { source: aOffsetBase.id, offset: aOffset.id })],
  [{ kind: "arc", id: aOffset.id }, { kind: "arc-endpoint", id: aOffset.id, endpoint: "start" }],
);
const graphBranchLine = lines.get("L_GRAPH_S1_B1_1");
casePlan(
  "constraint-graph-deep-branch-single",
  [selector("lineAngle", { line1: graphDirectionReference.id, line2: graphBranchLine.id })],
  [{ kind: "point", id: graphBranchLine.p2 }, { kind: "line", id: graphBranchLine.id }],
);
const graphMergeBridge = lines.get("L_GRAPH_S1_MERGE_LOWER_B");
casePlan(
  "constraint-graph-merge-single",
  [selector("distance", { p1: graphMergeBridge.p1, p2: graphMergeBridge.p2 })],
  [{ kind: "point", id: graphMergeBridge.p2 }, { kind: "line", id: graphMergeBridge.id }],
);
const graphStageOneLine = lines.get("L_GRAPH_S1_B4_1");
const graphFinalBridge = lines.get("L_GRAPH_S1_MERGE_FINAL_A");
const graphTailLine = lines.get("L_GRAPH_TAIL_6");
casePlan(
  "constraint-graph-branch-merge-tail-multiple",
  [
    selector("lineAngle", { line1: graphDirectionReference.id, line2: graphStageOneLine.id }),
    selector("distance", { p1: graphFinalBridge.p1, p2: graphFinalBridge.p2 }),
    selector("lineAngle", { line1: graphDirectionReference.id, line2: graphTailLine.id }),
  ],
  [
    { kind: "point", id: graphStageOneLine.p2 },
    { kind: "point", id: graphFinalBridge.p2 },
    { kind: "point", id: graphTailLine.p2 },
  ],
);
casePlan(
  "arc-arc-external-tangency-single",
  [selector("circleCircleTangent", { a: externalTangentArcs[0].id, b: externalTangentArcs[1].id, mode: "external" })],
  [{ kind: "arc", id: externalTangentArcs[1].id }],
);
casePlan(
  "arc-arc-internal-tangency-single",
  [selector("circleCircleTangent", { a: hugeTangentBase.id, b: internalTangentArcs[0].id, mode: "internal" })],
  [{ kind: "arc", id: internalTangentArcs[0].id }],
);
const baseTangentSupport = lines.get("L_TANGENT_A_BASE");
casePlan(
  "arc-angle-tangency-coupled-multiple",
  [
    selector("lineAngle", { line1: axisX.id, line2: baseTangentSupport.id }),
    selector("arcEndpointOnLine", { arc: "A_BASE", endpoint: "end", line: "L_RADIAL_A_BASE_END" }),
  ],
  [
    { kind: "line", id: baseTangentSupport.id },
    { kind: "arc", id: "A_BASE" },
    { kind: "arc-endpoint", id: "A_BASE", endpoint: "end" },
  ],
);

const lineArcTangencyCount = data.constraints.filter((constraint) =>
  constraint.type === "lineCircleTangent" && arcs.has(constraint.primitive),
).length;
const arcArcTangencyCount = data.constraints.filter((constraint) =>
  constraint.type === "circleCircleTangent" && arcs.has(constraint.a) && arcs.has(constraint.b),
).length;
const angleConstraintCount = data.constraints.filter((constraint) => constraint.type === "lineAngle").length;
data.testPlan.stressConstraintCounts = {
  lineArcTangencies: lineArcTangencyCount,
  arcArcTangencies: arcArcTangencyCount,
  lineAngles: angleConstraintCount,
};
if (lineArcTangencyCount < 5 || arcArcTangencyCount < 3 || angleConstraintCount < 30) {
  throw new Error(`Insufficient stress constraints: ${JSON.stringify(data.testPlan.stressConstraintCounts)}`);
}

const fixedPoints = data.points.filter((value) => value.fixed);
const fixedGeometryConstraints = data.constraints.filter((constraint) => constraint.type === "lineFixed" || constraint.type === "arcEndpointFixed");
if (fixedPoints.length !== 1 || fixedPoints[0].id !== origin.id) {
  throw new Error(`Expected exactly one fixed point (${origin.id}), found ${fixedPoints.map((value) => value.id).join(", ")}`);
}
if (fixedGeometryConstraints.length !== 0) {
  throw new Error(`Fixed geometry constraints are forbidden: ${fixedGeometryConstraints.map((value) => value.type).join(", ")}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(JSON.stringify({
  points: data.points.length,
  fixedPoints: fixedPoints.length,
  lines: data.lines.length,
  circles: data.circles.length,
  arcs: data.arcs.length,
  constraints: data.constraints.length,
  fixedGeometryConstraints: fixedGeometryConstraints.length,
  recommendedCases: data.testPlan.recommendedCases.length,
}));
