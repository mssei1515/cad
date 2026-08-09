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
    purpose: "Large fully constrained mixed-scale fixture for constrained drag stress testing.",
    baselineExpectation: { stable: true, freeVariableCount: 0 },
    recommendedCases: [],
  },
};

const points = new Map();
const lines = new Map();
const circles = new Map();
const arcs = new Map();
const constraintKeys = new Set();
const anchorConstraints = [];

function point(id, x, y, kind = "endpoint") {
  if (points.has(id)) return points.get(id);
  const value = { id, x, y, fixed: false, kind };
  points.set(id, value);
  data.points.push(value);
  return value;
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

function addAnchorConstraint(value) {
  anchorConstraints.push(value);
  return value;
}

function line(id, x1, y1, x2, y2, options = {}) {
  const p1 = options.p1 || point(`${id}_P1`, x1, y1, options.kind);
  const p2 = options.p2 || point(`${id}_P2`, x2, y2, options.kind);
  const value = { id, p1: p1.id, p2: p2.id };
  if (options.construction) value.construction = true;
  lines.set(id, { ...value, p1Object: p1, p2Object: p2 });
  data.lines.push(value);
  if (options.fixed !== false) {
    addAnchorConstraint({ type: "lineFixed", line: id, p1x: p1.x, p1y: p1.y, p2x: p2.x, p2y: p2.y });
  }
  return lines.get(id);
}

function carrier(id, x, y, angle = 0.37, length = 17) {
  return line(id, x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length, { construction: true });
}

function circle(id, center, radius, radiusConstraint = "radiusDimension") {
  const value = { id, center: center.id, radius };
  circles.set(id, { ...value, centerObject: center });
  data.circles.push(value);
  if (radiusConstraint) {
    addConstraint({
      type: radiusConstraint,
      primitive: id,
      target: radiusConstraint === "diameterDimension" ? radius * 2 : radius,
    });
  }
  return circles.get(id);
}

function endpoint(center, radius, angle) {
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

function arc(id, center, radius, startAngle, endAngle, mode = "fixed", options = {}) {
  const value = { id, center: center.id, radius, startAngle, endAngle };
  arcs.set(id, { ...value, centerObject: center });
  data.arcs.push(value);
  if (mode === "fixed") {
    addConstraint({ type: "radiusDimension", primitive: id, target: radius });
    const start = endpoint(center, radius, startAngle);
    const end = endpoint(center, radius, endAngle);
    if (!options.freeStart) addAnchorConstraint({ type: "arcEndpointFixed", arc: id, endpoint: "start", x: start.x, y: start.y });
    if (!options.freeEnd) addAnchorConstraint({ type: "arcEndpointFixed", arc: id, endpoint: "end", x: end.x, y: end.y });
  }
  return arcs.get(id);
}

function radialLine(id, center, radius, angle, extra = 35) {
  const start = endpoint(center, Math.max(1, radius * 0.2), angle);
  const end = endpoint(center, radius + extra, angle);
  return line(id, start.x, start.y, end.x, end.y, { construction: true });
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

function selector(type, fields) {
  return { type, ...fields };
}

function casePlan(name, removed, drags, expected = "movable") {
  data.testPlan.recommendedCases.push({ name, removed, drags, expected });
}

// Mixed-scale line field: 2.5 mm details through 3,200 mm spans.
const axisX = line("L_AXIS_X", -1600, 0, 1600, 0, { construction: true });
const axisY = line("L_AXIS_Y", 0, -1100, 0, 1100, { construction: true });
const top = line("L_TOP", -1500, -820, 1500, -820);
const bottom = line("L_BOTTOM", -1500, 860, 1500, 860);
const tiny = line("L_TINY", -1450, -760, -1444, -760);
const micro = line("L_MICRO", -1410, -760, -1410, -757.5);
const diag45A = line("L_DIAG_45_A", -1200, -500, -900, -200);
const diag45B = line("L_DIAG_45_B", -850, -500, -550, -200);
const diagNeg = line("L_DIAG_NEG", -450, -180, -150, -480);
const equalA = line("L_EQUAL_A", -1300, 700, -1180, 760);
const equalB = line("L_EQUAL_B", -1050, 700, -930, 760);
const colA = line("L_COL_A", 150, 0, 430, 0);
const colB = line("L_COL_B", 520, 0, 920, 0);
const midSupport = line("L_MID_SUPPORT", 800, -700, 1200, -500);
const midpointProbe = line("L_MID_PROBE", 1000, -600, 1020, -580, { construction: true });
const offsetSource = line("L_OFFSET_SOURCE", 200, -650, 500, -450);
const offsetNormalLength = 37;
const sourceDx = offsetSource.p2Object.x - offsetSource.p1Object.x;
const sourceDy = offsetSource.p2Object.y - offsetSource.p1Object.y;
const sourceLength = Math.hypot(sourceDx, sourceDy);
const offsetX = -sourceDy / sourceLength * offsetNormalLength;
const offsetY = sourceDx / sourceLength * offsetNormalLength;
const offsetCopy = line(
  "L_OFFSET_COPY",
  offsetSource.p1Object.x + offsetX,
  offsetSource.p1Object.y + offsetY,
  offsetSource.p2Object.x + offsetX,
  offsetSource.p2Object.y + offsetY,
  { fixed: false },
);
const angle30 = Math.PI / 6;
const angled = line("L_ANGLE_30", 1150, -300, 1150 + 500 * Math.cos(angle30), -300 + 500 * Math.sin(angle30));
const coincidentA = line("L_COIN_A", -300, 650, -200, 700);
const coincidentB = line("L_COIN_B", -300, 650, -250, 780);
const pointOnLineProbe = line("L_POINT_ON_LINE_PROBE", 300, 0, 318, 19, { construction: true });

addConstraint({ type: "horizontal", line: axisX.id });
addConstraint({ type: "vertical", line: axisY.id });
addConstraint({ type: "horizontal", line: bottom.id });
addConstraint({ type: "parallel", line1: axisX.id, line2: top.id });
addConstraint({ type: "parallel", line1: diag45A.id, line2: diag45B.id });
addConstraint({ type: "perpendicular", line1: diag45A.id, line2: diagNeg.id });
addConstraint({ type: "equalLength", line1: diag45A.id, line2: diag45B.id });
addConstraint({ type: "equalLength", line1: equalA.id, line2: equalB.id });
addConstraint({ type: "collinear", line1: axisX.id, line2: colA.id });
addConstraint({ type: "collinear", line1: colA.id, line2: colB.id });
addConstraint({ type: "lineAngle", line1: axisX.id, line2: angled.id, target: angle30 });
addConstraint({ type: "pointHorizontal", p1: tiny.p1, p2: tiny.p2 });
addConstraint({ type: "pointVertical", p1: micro.p1, p2: micro.p2 });
addConstraint({ type: "coincident", p1: coincidentA.p1, p2: coincidentB.p1 });
addConstraint({ type: "pointOnLine", point: pointOnLineProbe.p1, line: axisX.id });
addConstraint({ type: "pointOnLineMidpoint", point: midpointProbe.p1, line: midSupport.id });
addConstraint({ type: "distance", p1: equalA.p1, p2: equalA.p2, target: lineLength(equalA) });
addConstraint({ type: "pointAxisDistance", p1: equalA.p1, p2: equalA.p2, axis: "x", sign: 1, target: 120 });
const topDistance = signedPointLineDistance(bottom.p1Object, top);
addConstraint({ type: "lineLineDistance", line1: top.id, line2: bottom.id, sign: Math.sign(topDistance), target: Math.abs(topDistance) });
const pointLine = signedPointLineDistance(axisY.p2Object, top);
addConstraint({ type: "pointLineDistance", point: axisY.p2, line: top.id, sign: Math.sign(pointLine), target: Math.abs(pointLine) });
addConstraint({ type: "offsetDimension", source: offsetSource.id, offset: offsetCopy.id, sign: 1, target: offsetNormalLength, directionBasis: "endpoint" });

// Circle field: tiny bearings, paired rollers, concentric rings, and huge near-tangent discs.
const circleSpecs = [
  ["C_TINY", -1420, -620, 4, "diameterDimension"],
  ["C_SMALL", -1220, -620, 12, "radiusDimension"],
  ["C_BASE", -920, -560, 35, "radiusDimension"],
  ["C_EQUAL", -760, -560, 35, null],
  ["C_OFFSET", -920, -560, 70, null],
  ["C_TANGENT", -520, -320, 55, null],
  ["C_EXT_A", 100, -520, 80, "diameterDimension"],
  ["C_EXT_B", 230, -520, 50, null],
  ["C_INT_A", 520, -470, 140, "radiusDimension"],
  ["C_INT_B", 610, -470, 50, null],
  ["C_HUGE", 900, 160, 420, "diameterDimension"],
  ["C_CONCENTRIC", 900, 160, 210, "radiusDimension"],
  ["C_NEAR", 1425, 160, 105, null],
];

for (const [id, x, y, radius, mode] of circleSpecs) {
  const centerCarrier = carrier(`L_CENTER_${id}`, x, y, 0.41, Math.max(9, Math.min(31, radius * 0.3)));
  circle(id, centerCarrier.p1Object, radius, mode);
}

addConstraint({ type: "equalRadius", a: "C_BASE", b: "C_EQUAL" });
addConstraint({ type: "concentric", a: "C_BASE", b: "C_OFFSET" });
addConstraint({ type: "offsetDimension", source: "C_BASE", offset: "C_OFFSET", sign: 1, target: 35, directionBasis: "radial" });
addConstraint({ type: "concentric", a: "C_HUGE", b: "C_CONCENTRIC" });
addConstraint({ type: "circleCircleTangent", a: "C_EXT_A", b: "C_EXT_B", mode: "external" });
addConstraint({ type: "circleCircleTangent", a: "C_INT_A", b: "C_INT_B", mode: "internal" });
addConstraint({ type: "circleCircleTangent", a: "C_HUGE", b: "C_NEAR", mode: "external" });
const tangentLine = line("L_TANGENT_CIRCLE", -700, -265, -340, -265);
addConstraint({ type: "horizontal", line: tangentLine.id });
addConstraint({ type: "lineCircleTangent", line: tangentLine.id, primitive: "C_TANGENT", sign: -1 });
const hugeProbe = line("L_HUGE_PROBE", 1320, 160, 1350, 185, { construction: true });
addConstraint({ type: "pointOnCircle", point: hugeProbe.p1, primitive: "C_HUGE" });

// Arc field: very small sweeps, nearly full turns, large radii, shared endpoints,
// radius-by-equality, radius-by-tangency, and radial endpoint guidance.
function arcCenter(id, x, y, angle = 0.29) {
  return carrier(`L_CENTER_${id}`, x, y, angle, 19).p1Object;
}

const baseCenter = arcCenter("A_BASE", -1000, 350);
arc("A_BASE", baseCenter, 160, -Math.PI / 4, 3 * Math.PI / 4, "fixed");

const equalCenter = arcCenter("A_EQUAL", -600, 350);
arc("A_EQUAL", equalCenter, 160, Math.PI / 8, 1.35 * Math.PI, "custom");
const equalStartLine = radialLine("L_RADIAL_A_EQUAL_START", equalCenter, 160, Math.PI / 8);
const equalEndLine = radialLine("L_RADIAL_A_EQUAL_END", equalCenter, 160, 1.35 * Math.PI);
addConstraint({ type: "equalRadius", a: "A_BASE", b: "A_EQUAL" });
addConstraint({ type: "arcEndpointOnLine", arc: "A_EQUAL", endpoint: "start", line: equalStartLine.id });
addConstraint({ type: "arcEndpointOnLine", arc: "A_EQUAL", endpoint: "end", line: equalEndLine.id });

const radialCenter = arcCenter("A_RADIAL", -180, 380);
arc("A_RADIAL", radialCenter, 95, Math.PI / 18, 11 * Math.PI / 9, "custom");
const radialStart = radialLine("L_RADIAL_A_RADIAL_START", radialCenter, 95, Math.PI / 18);
const radialEnd = radialLine("L_RADIAL_A_RADIAL_END", radialCenter, 95, 11 * Math.PI / 9);
addConstraint({ type: "radiusDimension", primitive: "A_RADIAL", target: 95 });
addConstraint({ type: "arcEndpointOnLine", arc: "A_RADIAL", endpoint: "start", line: radialStart.id });
addConstraint({ type: "arcEndpointOnLine", arc: "A_RADIAL", endpoint: "end", line: radialEnd.id });

const endpointCenter = arcCenter("A_ENDPOINT", 180, 430);
arc("A_ENDPOINT", endpointCenter, 47, 0, 35 * Math.PI / 18, "custom");
const endpointStart = endpoint(endpointCenter, 47, 0);
const endpointEndLine = radialLine("L_RADIAL_A_ENDPOINT_END", endpointCenter, 47, 35 * Math.PI / 18);
addConstraint({ type: "radiusDimension", primitive: "A_ENDPOINT", target: 47 });
addConstraint({ type: "arcEndpointFixed", arc: "A_ENDPOINT", endpoint: "start", x: endpointStart.x, y: endpointStart.y });
addConstraint({ type: "arcEndpointOnLine", arc: "A_ENDPOINT", endpoint: "end", line: endpointEndLine.id });

const tangentArcCenter = arcCenter("A_TANGENT", 440, 430);
arc("A_TANGENT", tangentArcCenter, 75, -Math.PI / 3, 5 * Math.PI / 6, "custom");
const tangentArcLine = line("L_TANGENT_ARC", 280, 505, 610, 505);
const tangentArcStart = radialLine("L_RADIAL_A_TANGENT_START", tangentArcCenter, 75, -Math.PI / 3);
const tangentArcEnd = radialLine("L_RADIAL_A_TANGENT_END", tangentArcCenter, 75, 5 * Math.PI / 6);
addConstraint({ type: "lineCircleTangent", line: tangentArcLine.id, primitive: "A_TANGENT", sign: -1 });
addConstraint({ type: "arcEndpointOnLine", arc: "A_TANGENT", endpoint: "start", line: tangentArcStart.id });
addConstraint({ type: "arcEndpointOnLine", arc: "A_TANGENT", endpoint: "end", line: tangentArcEnd.id });

const offsetBaseCenter = arcCenter("A_OFFSET_BASE", 760, 430);
arc("A_OFFSET_BASE", offsetBaseCenter, 120, Math.PI / 9, 8 * Math.PI / 9, "fixed");
const offsetArcCenter = arcCenter("A_OFFSET", 760, 430, -0.31);
arc("A_OFFSET", offsetArcCenter, 180, Math.PI / 9, 8 * Math.PI / 9, "custom");
addConstraint({ type: "offsetDimension", source: "A_OFFSET_BASE", offset: "A_OFFSET", sign: 1, target: 60, directionBasis: "radial" });

const fixedArcSpecs = [
  ["A_TINY", 1130, 500, 5, 0.2, 0.3221730476],
  ["A_HUGE", -520, -40, 520, -Math.PI / 2, Math.PI],
  ["A_NEAR_FULL", 500, -40, 190, Math.PI / 180, 359 * Math.PI / 180],
  ["A_SHARED_1", 1000, -520, 100, 0, Math.PI / 2, { freeEnd: true }],
  ["A_SHARED_2", 1100, -420, 100, Math.PI, 3 * Math.PI / 2, { freeStart: true }],
  ["A_OBTUSE", -1050, -220, 230, -2.7, 0.35],
  ["A_ACUTE", -620, -350, 11, 1.1, 1.17],
  ["A_REVERSED", 1100, 700, 280, 5.5, 1.2],
];

for (const [id, x, y, radius, startAngle, endAngle, options] of fixedArcSpecs) {
  arc(id, arcCenter(id, x, y), radius, startAngle, endAngle, "fixed", options);
}

addConstraint({ type: "arcEndpointArcEndpointCoincident", a: "A_SHARED_1", endpointA: "end", b: "A_SHARED_2", endpointB: "start" });
const sharedPoint = line("L_SHARED_ENDPOINT_PROBE", 1000, -420, 1030, -390, { construction: true });
addConstraint({ type: "arcEndpointCoincident", arc: "A_SHARED_1", endpoint: "end", point: sharedPoint.p1 });

// Test removals intentionally target different manifolds and geometry kinds.
casePlan(
  "tiny-line-single-fixed",
  [selector("lineFixed", { line: "L_TINY" })],
  [{ kind: "line", id: "L_TINY" }],
);
casePlan(
  "large-diagonal-two-relations",
  [selector("lineFixed", { line: "L_DIAG_45_A" }), selector("parallel", { line1: "L_DIAG_45_A", line2: "L_DIAG_45_B" })],
  [{ kind: "point", id: diag45A.p1 }, { kind: "line", id: "L_DIAG_45_A" }],
);
casePlan(
  "equal-circle-radius-single",
  [selector("equalRadius", { a: "C_BASE", b: "C_EQUAL" })],
  [{ kind: "circle", id: "C_EQUAL" }],
);
casePlan(
  "tangent-circle-radius-single",
  [selector("lineCircleTangent", { line: "L_TANGENT_CIRCLE", primitive: "C_TANGENT" })],
  [{ kind: "circle", id: "C_TANGENT" }],
);
casePlan(
  "huge-circle-center-multiple",
  [selector("lineFixed", { line: "L_CENTER_C_HUGE" }), selector("concentric", { a: "C_HUGE", b: "C_CONCENTRIC" }), selector("circleCircleTangent", { a: "C_HUGE", b: "C_NEAR" })],
  [{ kind: "point", id: "L_CENTER_C_HUGE_P1" }, { kind: "circle", id: "C_HUGE" }],
);
casePlan(
  "radial-arc-radius-single",
  [selector("radiusDimension", { primitive: "A_RADIAL" })],
  [{ kind: "arc", id: "A_RADIAL" }],
);
casePlan(
  "equal-arc-radius-single",
  [selector("equalRadius", { a: "A_BASE", b: "A_EQUAL" })],
  [{ kind: "arc", id: "A_EQUAL" }],
);
casePlan(
  "tangent-arc-radius-single",
  [selector("lineCircleTangent", { line: "L_TANGENT_ARC", primitive: "A_TANGENT" })],
  [{ kind: "arc", id: "A_TANGENT" }],
);
casePlan(
  "arc-endpoint-single",
  [selector("arcEndpointOnLine", { arc: "A_ENDPOINT", endpoint: "end", line: "L_RADIAL_A_ENDPOINT_END" })],
  [{ kind: "arc-endpoint", id: "A_ENDPOINT", endpoint: "end" }],
);
casePlan(
  "offset-arc-all-parameters",
  [selector("offsetDimension", { source: "A_OFFSET_BASE", offset: "A_OFFSET" })],
  [{ kind: "arc", id: "A_OFFSET" }, { kind: "arc-endpoint", id: "A_OFFSET", endpoint: "start" }],
);
casePlan(
  "shared-arc-endpoint-multiple",
  [
    selector("arcEndpointCoincident", { arc: "A_SHARED_1", endpoint: "end", point: sharedPoint.p1 }),
    selector("arcEndpointArcEndpointCoincident", { a: "A_SHARED_1", endpointA: "end", b: "A_SHARED_2", endpointB: "start" }),
  ],
  [{ kind: "arc-endpoint", id: "A_SHARED_1", endpoint: "end" }, { kind: "arc-endpoint", id: "A_SHARED_2", endpoint: "start" }],
);

// Design relationships are intentionally serialized before absolute anchors.
// This keeps relation constraints meaningful instead of making them redundant
// behind an earlier line/endpoint fix.
for (const constraint of anchorConstraints) addConstraint(constraint);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(JSON.stringify({
  points: data.points.length,
  lines: data.lines.length,
  circles: data.circles.length,
  arcs: data.arcs.length,
  constraints: data.constraints.length,
  recommendedCases: data.testPlan.recommendedCases.length,
}));
