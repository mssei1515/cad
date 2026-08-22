const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.CAD2_E2E_PORT || 8765) + 1;
const baseUrl = `http://${host}:${port}`;
let serverProcess = null;

async function openBlocksExplorer(page) {
  const tab = page.locator('[data-explorer-tab="blocks"]');
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
}

async function openBlockDefinitions(page) {
  await openBlocksExplorer(page);
  const dialog = page.locator("#blockDefinitionsDialog");
  if (!(await dialog.isVisible())) await page.click("#openBlockDefinitionsBtn");
}

function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 100);
      });
    };
    check();
  });
}

function constrainedBlockGridFixture({ fixed = false } = {}) {
  const sketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
  ];
  const instances = [
    ["BI10", 0, 0],
    ["BI11", 0, 500],
    ["BI12", -500, 0],
    ["BI13", -500, 500],
    ["BI14", -500, 1000],
    ["BI15", 0, 1000],
  ].map(([id, x, y]) => ({
    id,
    definitionId: "B1",
    sketchId: "S1",
    x,
    y,
    rotation: 0,
    fixed,
    enabledSketchIds: ["S1"],
  }));
  const constraints = [
    ...["BI11", "BI10", "BI13", "BI14", "BI15"].map((id) => ({ type: "horizontal", line: `${id}@L1`, enabled: true, sketchId: "S1" })),
    { type: "collinear", line1: "BI12@L3", line2: "BI13@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI12@L4", line2: "BI13@L4", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI13@L4", line2: "BI14@L4", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI13@L3", line2: "BI14@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI15@L4", line2: "BI14@L2", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI15@L1", line2: "BI14@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI11@L4", line2: "BI13@L2", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI11@L3", line2: "BI15@L1", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI10@L4", line2: "BI12@L2", enabled: true, sketchId: "S1" },
    { type: "collinear", line1: "BI10@L3", line2: "BI11@L1", enabled: true, sketchId: "S1" },
  ];
  return {
    version: 8,
    documentName: "Constrained Block Grid",
    sketches,
    activeSketchId: "S1",
    blockDefinitions: [{
      id: "B1",
      name: "Tile",
      revision: 1,
      origin: { x: 0, y: 0 },
      sketches,
      activeSketchId: "S1",
      points: [
        { id: "P1", x: -250, y: -250, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P2", x: 250, y: -250, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P3", x: 250, y: 250, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P4", x: -250, y: 250, fixed: false, kind: "endpoint", sketchId: "S1" },
      ],
      lines: [
        { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" },
        { id: "L2", p1: "P2", p2: "P3", construction: false, sketchId: "S1" },
        { id: "L3", p1: "P3", p2: "P4", construction: false, sketchId: "S1" },
        { id: "L4", p1: "P4", p2: "P1", construction: false, sketchId: "S1" },
      ],
      circles: [],
      arcs: [],
      constraints: [],
    }],
    blockInstances: instances,
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints,
  };
}

function blockPointOnLineFixture({ subjectY = -50, includeConstraint = false, subjectFixed = false } = {}) {
  const sketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
  ];
  const definition = (id, name, points, lines) => ({
    id,
    name,
    revision: 1,
    origin: { x: 0, y: 0 },
    sketches,
    activeSketchId: "S1",
    points,
    lines,
    circles: [],
    arcs: [],
    constraints: [],
  });
  return {
    version: 8,
    documentName: "Block Point On Line",
    sketches,
    activeSketchId: "S1",
    blockDefinitions: [
      definition(
        "B1",
        "Rail",
        [
          { id: "P1", x: -100, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
          { id: "P2", x: 100, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
        ],
        [{ id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" }],
      ),
      definition(
        "B2",
        "Panel",
        [
          { id: "P3", x: -50, y: 50, fixed: true, kind: "endpoint", sketchId: "S1" },
          { id: "P4", x: 50, y: 50, fixed: false, kind: "endpoint", sketchId: "S1" },
        ],
        [{ id: "L2", p1: "P3", p2: "P4", construction: false, sketchId: "S1" }],
      ),
    ],
    blockInstances: [
      { id: "BI1", definitionId: "B1", sketchId: "S1", x: 0, y: 0, rotation: 0, fixed: true, enabledSketchIds: ["S1"] },
      { id: "BI2", definitionId: "B2", sketchId: "S1", x: 0, y: subjectY, rotation: 0, fixed: subjectFixed, enabledSketchIds: ["S1"] },
    ],
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints: includeConstraint
      ? [{ type: "pointOnLine", point: "BI2@P3", line: "BI1@L1", enabled: true, sketchId: "S1" }]
      : [],
  };
}

function blockSketchDisableConstraintFixture() {
  const hostSketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S2", name: "Host Sketch", parentSketchId: "ROOT", kind: "sketch", visible: true },
  ];
  const definitionSketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
    { id: "S10", name: "Sketch-1-1", parentSketchId: "S1", kind: "sketch", visible: true },
  ];
  return {
    version: 8,
    documentName: "Block Sketch Constraint Removal",
    sketches: hostSketches,
    activeSketchId: "S2",
    blockDefinitions: [{
      id: "B1",
      name: "Shelf",
      revision: 1,
      origin: { x: 0, y: 0 },
      sketches: definitionSketches,
      activeSketchId: "S1",
      points: [
        { id: "P1", x: -40, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P2", x: 40, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P10", x: -20, y: 30, fixed: false, kind: "endpoint", sketchId: "S10" },
        { id: "P11", x: 20, y: 30, fixed: false, kind: "endpoint", sketchId: "S10" },
      ],
      lines: [
        { id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" },
        { id: "L10", p1: "P10", p2: "P11", construction: false, sketchId: "S10" },
      ],
      circles: [],
      arcs: [],
      blockInstances: [],
      constraints: [],
    }],
    blockInstances: [{
      id: "BI1",
      definitionId: "B1",
      sketchId: "S2",
      x: 0,
      y: 0,
      rotation: 0,
      fixed: false,
      rotationLocked: false,
      enabledSketchIds: ["S1", "S10"],
    }],
    points: [{ id: "P100", x: 40, y: 0, fixed: true, kind: "explicit", sketchId: "S2" }],
    lines: [],
    circles: [],
    arcs: [],
    constraints: [
      { type: "horizontal", line: "BI1@L1", enabled: true, sketchId: "S2" },
      { type: "coincident", p1: "BI1@P2", p2: "P100", enabled: true, sketchId: "S2", reference: true, referenceSketchId: "S1" },
    ],
  };
}

function sparseBlockEditorLineDragFixture() {
  const sketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
  ];
  return {
    version: 8,
    documentName: "Sparse Block Editor Line Drag",
    sketches,
    activeSketchId: "S1",
    blockDefinitions: [{
      id: "B1",
      name: "Room",
      revision: 1,
      origin: { x: 0, y: 0 },
      sketches,
      activeSketchId: "S1",
      points: [
        { id: "P67", x: 100, y: 865, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P68", x: 100, y: -865, fixed: false, kind: "endpoint", sketchId: "S1" },
      ],
      lines: [{ id: "L60", p1: "P67", p2: "P68", construction: false, sketchId: "S1" }],
      circles: [],
      arcs: [],
      constraints: [{ type: "vertical", line: "L60", enabled: true, sketchId: "S1" }],
    }],
    blockInstances: [],
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints: [],
  };
}

function nestedBlockEditingFixture() {
  const sketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
  ];
  const definition = (id, name, points, lines, parentDefinitionId = null) => ({
    id,
    name,
    parentDefinitionId,
    revision: 1,
    origin: { x: 0, y: 0 },
    sketches,
    activeSketchId: "S1",
    points,
    lines,
    circles: [],
    arcs: [],
    blockInstances: [],
    constraints: [],
  });
  return {
    version: 8,
    documentName: "Nested Block Editing",
    sketches,
    activeSketchId: "S1",
    blockDefinitions: [
      definition(
        "B1",
        "Leaf",
        [
          { id: "P1", x: -10, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
          { id: "P2", x: 10, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
        ],
        [{ id: "L1", p1: "P1", p2: "P2", construction: false, sketchId: "S1" }],
        "B2",
      ),
      definition(
        "B2",
        "Room",
        [
          { id: "P10", x: -40, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
          { id: "P11", x: 40, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
        ],
        [{ id: "L10", p1: "P10", p2: "P11", construction: false, sketchId: "S1" }],
      ),
    ],
    blockInstances: [{ id: "BI100", definitionId: "B2", sketchId: "S1", x: 100, y: 50, rotation: 0, fixed: false, enabledSketchIds: ["S1"] }],
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints: [],
  };
}

function nestedRootConstraintFixture() {
  const fixture = nestedBlockEditingFixture();
  const room = fixture.blockDefinitions.find((definition) => definition.id === "B2");
  room.blockInstances = [{
    id: "BI19",
    definitionId: "B1",
    sketchId: "S1",
    x: 20,
    y: 10,
    rotation: 0,
    fixed: false,
    rotationLocked: true,
    enabledSketchIds: ["S1"],
  }];
  fixture.constraints = [{
    type: "horizontal",
    line: "BI100@BI19@L1",
    enabled: true,
    sketchId: "S1",
  }];
  return fixture;
}

function nestedConstraintCleanupFixture({ stale = false } = {}) {
  const fixture = nestedBlockEditingFixture();
  const leaf = fixture.blockDefinitions.find((definition) => definition.id === "B1");
  leaf.points.push(
    { id: "P3", x: -10, y: 20, fixed: false, kind: "endpoint", sketchId: "S1" },
    { id: "P4", x: 10, y: 20, fixed: false, kind: "endpoint", sketchId: "S1" },
  );
  leaf.lines.push({ id: "L2", p1: "P3", p2: "P4", construction: false, sketchId: "S1" });
  const room = fixture.blockDefinitions.find((definition) => definition.id === "B2");
  room.blockInstances = [{
    id: "BI19",
    definitionId: "B1",
    sketchId: "S1",
    x: 20,
    y: 10,
    rotation: 0,
    fixed: false,
    rotationLocked: true,
    enabledSketchIds: ["S1"],
  }];
  room.constraints = [{
    type: "horizontal",
    line: stale ? "BI19@L404" : "BI19@L1",
    enabled: true,
    sketchId: "S1",
  }];
  return fixture;
}

function nestedComposableBlocksFixture() {
  const fixture = nestedBlockEditingFixture();
  const room = fixture.blockDefinitions.find((definition) => definition.id === "B2");
  fixture.blockDefinitions.push({
    ...JSON.parse(JSON.stringify(fixture.blockDefinitions.find((definition) => definition.id === "B1"))),
    id: "B3",
    name: "Leaf 2",
    points: [
      { id: "P3", x: -15, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
      { id: "P4", x: 15, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
    ],
    lines: [{ id: "L3", p1: "P3", p2: "P4", construction: false, sketchId: "S1" }],
  });
  room.blockInstances = [
    { id: "BI1", definitionId: "B1", sketchId: "S1", x: -30, y: 0, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds: ["S1"] },
    { id: "BI2", definitionId: "B3", sketchId: "S1", x: 30, y: 0, rotation: Math.PI / 2, fixed: false, rotationLocked: false, enabledSketchIds: ["S1"] },
  ];
  return fixture;
}

function manyNestedBlockDefinitionsFixture(count = 24) {
  const fixture = nestedBlockEditingFixture();
  const sketches = fixture.sketches.map((sketch) => ({ ...sketch }));
  for (let index = 3; index <= count; index += 1) {
    fixture.blockDefinitions.push({
      id: `B${index}`,
      name: `Child-${index}`,
      parentDefinitionId: "B2",
      revision: 1,
      origin: { x: 0, y: 0 },
      sketches: sketches.map((sketch) => ({ ...sketch })),
      activeSketchId: "S1",
      points: [
        { id: `P${index}a`, x: -index, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: `P${index}b`, x: index, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
      ],
      lines: [{ id: `L${index}`, p1: `P${index}a`, p2: `P${index}b`, construction: false, sketchId: "S1" }],
      circles: [],
      arcs: [],
      blockInstances: [],
      constraints: [],
    });
  }
  return fixture;
}

function rotationLockFixture({ constrained = false, fixed = false } = {}) {
  const rotation = Math.PI / 6;
  const x = 120;
  const y = 80;
  const localPoints = [
    { id: "BP1", x: -50, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
    { id: "BP2", x: 50, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
  ];
  const worldPoint = (point) => ({
    x: x + point.x * Math.cos(rotation) - point.y * Math.sin(rotation),
    y: y + point.x * Math.sin(rotation) + point.y * Math.cos(rotation),
  });
  const anchors = constrained ? localPoints.map((point, index) => ({
    id: `P${100 + index}`,
    ...worldPoint(point),
    fixed: true,
    kind: "explicit",
    sketchId: "S1",
  })) : [];
  return {
    version: 8,
    documentName: "Rotation Lock",
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
    ],
    activeSketchId: "S1",
    blockDefinitions: [{
      id: "B1",
      name: "Rotating Block",
      parentDefinitionId: null,
      revision: 1,
      origin: { x: 0, y: 0 },
      sketches: [
        { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
        { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
      ],
      activeSketchId: "S1",
      points: localPoints,
      lines: [{ id: "BL1", p1: "BP1", p2: "BP2", construction: false, sketchId: "S1" }],
      circles: [],
      arcs: [],
      blockInstances: [],
      constraints: [],
    }],
    blockInstances: [{ id: "BI1", definitionId: "B1", sketchId: "S1", x, y, rotation, fixed, rotationLocked: false, enabledSketchIds: ["S1"] }],
    points: anchors,
    lines: [],
    circles: [],
    arcs: [],
    constraints: constrained ? [
      { type: "coincident", p1: "BI1@BP1", p2: "P100", enabled: true, sketchId: "S1" },
      { type: "coincident", p1: "BI1@BP2", p2: "P101", enabled: true, sketchId: "S1" },
    ] : [],
  };
}

function guidedPointDragFixture({ x = 0, y = 100 } = {}) {
  return {
    version: 8,
    documentName: "Guided Point Drag",
    sketches: [
      { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
      { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
    ],
    activeSketchId: "S1",
    blockDefinitions: [],
    blockInstances: [],
    points: [
      { id: "P0", x: 0, y: 0, fixed: true, kind: "endpoint", sketchId: "S1" },
      { id: "P26", x, y, fixed: false, kind: "endpoint", sketchId: "S1" },
    ],
    lines: [],
    circles: [
      { id: "C0", center: "P0", radius: 50, construction: false, sketchId: "S1" },
      { id: "C1", center: "P26", radius: 50, construction: false, sketchId: "S1" },
    ],
    arcs: [],
    constraints: [
      { type: "radiusDimension", primitive: "C0", target: 50, enabled: true, sketchId: "S1" },
      { type: "radiusDimension", primitive: "C1", target: 50, enabled: true, sketchId: "S1" },
      { type: "circleCircleTangent", a: "C0", b: "C1", mode: "external", enabled: true, sketchId: "S1" },
    ],
  };
}

function externallyConstrainedBlockFixture() {
  const sketches = [
    { id: "ROOT", name: "Root Sketch", parentSketchId: null, kind: "root", visible: true },
    { id: "S1", name: "Sketch-1", parentSketchId: "ROOT", kind: "sketch", visible: true },
    { id: "S2", name: "Sketch-1-1", parentSketchId: "S1", kind: "sketch", visible: true },
  ];
  return {
    version: 8,
    documentName: "External Constraint Block",
    sketches,
    activeSketchId: "S2",
    blockDefinitions: [{
      id: "B1",
      name: "Existing Block",
      revision: 1,
      origin: { x: 0, y: 0 },
      sketches: sketches.slice(0, 2),
      activeSketchId: "S1",
      points: [
        { id: "P18A", x: 0, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
        { id: "P18B", x: 90, y: 0, fixed: false, kind: "endpoint", sketchId: "S1" },
      ],
      lines: [{ id: "L18", p1: "P18A", p2: "P18B", construction: false, sketchId: "S1" }],
      circles: [],
      arcs: [],
      constraints: [],
    }],
    blockInstances: [{ id: "BI1", definitionId: "B1", sketchId: "S2", x: 0, y: 200, rotation: 0, fixed: false, enabledSketchIds: ["S1"] }],
    points: [
      { id: "P1", x: 0, y: -100, fixed: false, kind: "endpoint", sketchId: "S1" },
      { id: "P2", x: 0, y: 300, fixed: false, kind: "endpoint", sketchId: "S1" },
      { id: "P35", x: 0, y: 0, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P36", x: 90, y: 0, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P37", x: 90, y: 200, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P38", x: 0, y: 200, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P39", x: 180, y: 0, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P40", x: 270, y: 0, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P51", x: 45, y: 0, fixed: false, kind: "endpoint", sketchId: "S2" },
      { id: "P52", x: 45, y: 200, fixed: false, kind: "endpoint", sketchId: "S2" },
    ],
    lines: [
      { id: "L10", p1: "P1", p2: "P2", construction: false, sketchId: "S1" },
      { id: "L32", p1: "P35", p2: "P36", construction: false, sketchId: "S2" },
      { id: "L33", p1: "P36", p2: "P37", construction: false, sketchId: "S2" },
      { id: "L34", p1: "P37", p2: "P38", construction: false, sketchId: "S2" },
      { id: "L35", p1: "P38", p2: "P35", construction: false, sketchId: "S2" },
      { id: "L36", p1: "P39", p2: "P40", construction: false, sketchId: "S2" },
      { id: "L46", p1: "P51", p2: "P52", construction: true, sketchId: "S2" },
    ],
    circles: [],
    arcs: [],
    constraints: [
      { type: "pointOnLine", point: "P35", line: "L10", enabled: true, sketchId: "S2", reference: true, referenceSketchId: "S1" },
      { type: "horizontal", line: "L32", enabled: true, sketchId: "S2" },
      { type: "vertical", line: "L33", enabled: true, sketchId: "S2" },
      { type: "horizontal", line: "L34", enabled: true, sketchId: "S2" },
      { type: "vertical", line: "L35", enabled: true, sketchId: "S2" },
      { type: "equalLength", line1: "L32", line2: "L36", enabled: true, sketchId: "S2" },
      { type: "collinear", line1: "L34", line2: "BI1@L18", enabled: true, sketchId: "S2" },
      { type: "pointOnLineMidpoint", point: "P51", line: "L32", enabled: true, sketchId: "S2" },
      { type: "pointOnLineMidpoint", point: "P52", line: "L34", enabled: true, sketchId: "S2" },
    ],
  };
}

async function canvasPatch(page, point, radius = 9) {
  return page.evaluate(({ point: samplePoint, radius: sampleRadius }) => {
    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((samplePoint.x - rect.left) * scaleX);
    const y = Math.round((samplePoint.y - rect.top) * scaleY);
    const width = sampleRadius * 2 + 1;
    return Array.from(canvas.getContext("2d").getImageData(x - sampleRadius, y - sampleRadius, width, width).data);
  }, { point, radius });
}

test.beforeAll(async () => {
  try {
    await waitForServer(`${baseUrl}/index.html`, 300);
    return;
  } catch (_) {
    // Start our local static server below.
  }
  serverProcess = spawn(process.execPath, ["tools/serve.js", "--host", host, "--port", String(port)], {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "ignore",
  });
  await waitForServer(`${baseUrl}/index.html`);
});

test.afterAll(() => {
  if (serverProcess) serverProcess.kill();
});

test("creates, places, drags, edits, and reloads local-coordinate blocks", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const setup = await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await expect(page.locator("body")).toHaveClass(/block-editing/);
  await expect(page.locator("#blockEditorNameInput")).toBeVisible();
  await page.fill("#blockEditorNameInput", "Frame Block");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ editing: true, isNew: true, hostLineCount: 4, editorLineCount: 4 }));
  await page.click("#completeBlockEditBtn");

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toEqual([
    expect.objectContaining({ name: "Frame Block", points: 4, lines: 4, constraints: 4, activeSketchId: "S1", origin: { x: 0, y: 0 } }),
  ]);
  expect(state.definitions[0].sketches).toHaveLength(2);
  expect(state.instances).toHaveLength(1);
  expect(state.instances[0].enabledSketchIds).toEqual(["S1"]);
  expect(state.projectionLineIds).toHaveLength(4);
  expect(state.projectionLineIds.every((id) => /^BI\d+@L\d+$/.test(id))).toBe(true);
  expect(state.serialized.points).toHaveLength(0);
  expect(state.serialized.lines).toHaveLength(0);

  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  expect(interaction.handle).toBeNull();
  const before = state.instances[0];
  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + 70, interaction.center.y + 35, { steps: 4 });
  await page.mouse.up();
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].x).toBeCloseTo(before.x + 70 / interaction.scale, 3);
  expect(state.instances[0].y).toBeCloseTo(before.y + 35 / interaction.scale, 3);
  expect(state.instances[0].rotation).toBeCloseTo(before.rotation, 8);
  expect((await page.evaluate(() => window.__cadTest.blockInteractionPoints())).handle).toBeNull();

  const canvas = await page.locator("#canvas").boundingBox();
  await openBlockDefinitions(page);
  await page.click(".blockPlaceBtn");
  await page.mouse.click(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.58);
  await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.58);
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances[1].rotation).toBeCloseTo(0, 6);

  const external = await page.evaluate(() => window.__cadTest.blockExternalConstraintCase());
  expect(external.success).toBe(true);
  expect(external.errorNorm).toBeLessThan(1e-5);
  expect(external.projectedError).toBeLessThan(1e-5);
  expect(external.localAfter).toEqual(external.localBefore);

  const readOnly = await page.evaluate(() => window.__cadTest.blockReadOnlyDimensionCase());
  expect(readOnly).toEqual(expect.objectContaining({ created: true, readOnly: true, enabled: false }));

  const edited = await page.evaluate(() => window.__cadTest.blockDefinitionUpdateCase());
  expect(edited.editing).toBe(false);
  expect(edited.revision).toBeGreaterThan(1);
  expect(edited.lengths).toHaveLength(2);
  expect(edited.lengths[0]).toBeGreaterThan(edited.before);
  expect(edited.lengths[1]).toBeCloseTo(edited.lengths[0], 6);

  const reloaded = await page.evaluate(() => window.__cadTest.reloadBlockState());
  expect(reloaded).toEqual({ definitions: 1, instances: 2, projectionLines: 8, serializedVersion: 9 });

  await openBlockDefinitions(page);
  await page.click(".blockDeleteBtn");
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions).toHaveLength(1);
  await page.screenshot({ path: "test-results/block-instances.png", fullPage: true });
});

test("block placement defaults to persistent orthogonal rotation lock and can use free rotation", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].rotationLocked).toBe(true);
  const canvas = await page.locator("#canvas").boundingBox();

  const orthogonalCases = [
    { dx: 92, dy: 12, expected: 0 },
    { dx: 12, dy: 92, expected: Math.PI / 2 },
    { dx: -92, dy: 12, expected: Math.PI },
    { dx: 12, dy: -92, expected: Math.PI * 1.5 },
  ];
  for (let index = 0; index < orthogonalCases.length; index += 1) {
    const item = orthogonalCases[index];
    await openBlockDefinitions(page);
    await page.click(".blockPlaceBtn");
    await expect(page.locator('input[data-rotation-mode="locked"]')).toBeChecked();
    const center = { x: canvas.x + canvas.width * (0.56 + index * 0.04), y: canvas.y + canvas.height * 0.48 };
    await page.mouse.click(center.x, center.y);
    await page.mouse.click(center.x + item.dx, center.y + item.dy);
    state = await page.evaluate(() => window.__cadTest.blockState());
    expect(state.instances[index + 1].rotationLocked).toBe(true);
    expect(state.instances[index + 1].rotation).toBeCloseTo(item.expected, 8);
  }
  const locked = state.instances[2];
  expect(locked.rotationLocked).toBe(true);
  expect(locked.rotation).toBeCloseTo(Math.PI / 2, 8);
  let lockState = await page.evaluate((id) => window.__cadTest.blockRotationLockStateForTest(id), locked.id);
  expect(lockState.solverVariables).toEqual(["x", "y"]);
  expect(lockState.translationSessionAvailable).toBe(true);
  expect(lockState.rotationSessionAvailable).toBe(false);

  const interaction = await page.evaluate((id) => window.__cadTest.blockInteractionPoints(id), locked.id);
  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + 52, interaction.center.y + 24, { steps: 2 });
  await page.mouse.up();
  lockState = await page.evaluate((id) => window.__cadTest.blockRotationLockStateForTest(id), locked.id);
  expect(lockState.x).not.toBeCloseTo(locked.x, 6);
  expect(lockState.rotation).toBeCloseTo(locked.rotation, 8);

  await openBlockDefinitions(page);
  await page.click(".blockPlaceBtn");
  await page.click('input[data-rotation-mode="free"]');
  await expect(page.locator('input[data-rotation-mode="free"]')).toBeChecked();
  const freeCenter = { x: canvas.x + canvas.width * 0.7, y: canvas.y + canvas.height * 0.64 };
  await page.mouse.click(freeCenter.x, freeCenter.y);
  await page.mouse.click(freeCenter.x + 90, freeCenter.y + 42);
  state = await page.evaluate(() => window.__cadTest.blockState());
  const free = state.instances[5];
  expect(free.rotationLocked).toBe(false);
  expect(Math.abs(free.rotation / (Math.PI / 2) - Math.round(free.rotation / (Math.PI / 2)))).toBeGreaterThan(0.1);

  await page.click("#undoBtn");
  expect((await page.evaluate(() => window.__cadTest.blockState())).instances).toHaveLength(5);
  await page.click("#redoBtn");
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[5]).toEqual(expect.objectContaining({ rotationLocked: false }));
  await page.evaluate(() => window.__cadTest.reloadBlockState());
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances.slice(1, 5).every((instance) => instance.rotationLocked)).toBe(true);
  expect(state.instances[5].rotationLocked).toBe(false);
});

test("selected blocks can change rotation mode and reject an unsatisfied orthogonal snap", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "rotation-lock.json"), rotationLockFixture());
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));
  await openBlocksExplorer(page);
  await expect(page.locator('input[data-rotation-mode="free"]')).toBeChecked();
  const before = await page.evaluate(() => window.__cadTest.blockRotationLockStateForTest("BI1"));
  await page.click('input[data-rotation-mode="locked"]');
  let after = await page.evaluate(() => window.__cadTest.blockRotationLockStateForTest("BI1"));
  expect(after.rotationLocked).toBe(true);
  expect(after.rotation).toBeCloseTo(0, 8);
  expect(after.displayCenter.x).toBeCloseTo(before.displayCenter.x, 8);
  expect(after.displayCenter.y).toBeCloseTo(before.displayCenter.y, 8);
  expect(after.solverVariables).toEqual(["x", "y"]);
  expect(after.rotationSessionAvailable).toBe(false);

  await page.click("#undoBtn");
  let restored = await page.evaluate(() => window.__cadTest.blockRotationLockStateForTest("BI1"));
  expect(restored.rotationLocked).toBe(false);
  expect(restored.rotation).toBeCloseTo(Math.PI / 6, 8);
  await page.click("#redoBtn");
  restored = await page.evaluate(() => window.__cadTest.blockRotationLockStateForTest("BI1"));
  expect(restored.rotationLocked).toBe(true);
  expect(restored.rotation).toBeCloseTo(0, 8);
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));

  await page.click('input[data-rotation-mode="free"]');
  after = await page.evaluate(() => window.__cadTest.blockRotationLockStateForTest("BI1"));
  expect(after.rotationLocked).toBe(false);
  expect(after.rotation).toBeCloseTo(0, 8);
  expect(after.solverVariables).toEqual(["rotation", "x", "y"]);

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "fixed-rotation-lock.json"), rotationLockFixture({ fixed: true }));
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));
  await expect(page.locator('input[data-rotation-mode="locked"]')).toBeDisabled();
  await expect(page.locator('input[data-rotation-mode="free"]')).toBeDisabled();

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "constrained-rotation-lock.json"), rotationLockFixture({ constrained: true }));
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));
  const constrainedBefore = await page.evaluate(() => window.__cadTest.blockRotationLockStateForTest("BI1"));
  await page.click('input[data-rotation-mode="locked"]');
  const rejected = await page.evaluate(() => window.__cadTest.blockRotationLockStateForTest("BI1"));
  expect(rejected.rotationLocked).toBe(false);
  expect(rejected.rotation).toBeCloseTo(constrainedBefore.rotation, 8);
  expect(rejected.x).toBeCloseTo(constrainedBefore.x, 8);
  expect(rejected.y).toBeCloseTo(constrainedBefore.y, 8);
  await expect(page.locator("#hint")).toContainText("直交回転ロックを適用できません");
  await expect(page.locator('input[data-rotation-mode="free"]')).toBeChecked();
});

test("block lower settings only appear during placement or single-block selection", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  const instanceId = (await page.evaluate(() => window.__cadTest.blockState())).instances[0].id;
  await expect(page.locator("#blockSketchConfig")).toBeVisible();
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({}));
  await expect(page.locator("#blockSketchConfig")).toBeHidden();

  await openBlockDefinitions(page);
  await page.click(".blockPlaceBtn");
  await expect(page.locator("#blockSketchConfig")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#blockSketchConfig")).toBeHidden();

  await page.evaluate((id) => window.__cadTest.selectGeometryIdsForTest({ blockInstances: [id] }), instanceId);
  await expect(page.locator("#blockSketchConfig")).toBeVisible();
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({}));
  await expect(page.locator("#blockSketchConfig")).toBeHidden();
});

test("selecting a block highlights only constraints that directly reference its projections", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "block-related-constraint.json"), blockPointOnLineFixture({ subjectY: -50, includeConstraint: true }));
  await page.click('[data-explorer-tab="constraint"]');
  await expect(page.locator("#explorerConstraint")).toBeVisible();

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI2"] }));
  await expect(page.locator("#constraintList .constraint-list-row")).toHaveClass(/sidebar-related/);
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({}));
  await expect(page.locator("#constraintList .constraint-list-row")).not.toHaveClass(/sidebar-related/);
});

test("selected block instances highlight their definitions in the block window", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "block-list-selection.json"), blockPointOnLineFixture({ subjectY: -200 }));
  await openBlockDefinitions(page);

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI2"] }));
  await expect(page.locator('.block-item[data-id="B2"]')).toHaveClass(/block-selected/);
  await expect(page.locator('.block-item[data-id="B2"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.block-item[data-id="B1"]')).not.toHaveClass(/block-selected/);

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1", "BI2"] }));
  await expect(page.locator(".block-item.block-selected")).toHaveCount(2);
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({}));
  await expect(page.locator(".block-item.block-selected")).toHaveCount(0);
});

test("shift and ctrl clicks toggle block multiselection without moving instances", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "block-multiselect.json"), blockPointOnLineFixture({ subjectY: -200 }));
  const before = (await page.evaluate(() => window.__cadTest.blockState())).instances;
  const first = await page.evaluate(() => window.__cadTest.blockInteractionPoints("BI1"));
  const second = await page.evaluate(() => window.__cadTest.blockInteractionPoints("BI2"));

  await page.keyboard.down("Shift");
  await page.mouse.click(first.center.x, first.center.y);
  await page.mouse.click(second.center.x, second.center.y);
  await page.keyboard.up("Shift");
  expect((await page.evaluate(() => window.__cadTest.blockState())).selectedInstanceIds.sort()).toEqual(["BI1", "BI2"]);
  await expect(page.locator("#blockSketchConfig")).toBeHidden();

  await page.keyboard.down("Control");
  await page.mouse.click(first.center.x, first.center.y);
  await page.keyboard.up("Control");
  const toggled = await page.evaluate(() => window.__cadTest.blockState());
  expect(toggled.selectedInstanceIds).toEqual(["BI2"]);
  expect(toggled.instances).toEqual(before);

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({}));
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.move(canvas.x + canvas.width - 8, canvas.y + canvas.height - 8);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 8, canvas.y + 8, { steps: 4 });
  await page.mouse.up();
  expect((await page.evaluate(() => window.__cadTest.blockState())).selectedInstanceIds.sort()).toEqual(["BI1", "BI2"]);
});

test("selected block definitions move under a new parent without changing ids or placement", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const fixture = blockPointOnLineFixture({ subjectY: -50, includeConstraint: true });
  fixture.points = [
    { id: "P100", x: -20, y: 100, fixed: false, kind: "endpoint", sketchId: "S1" },
    { id: "P101", x: 20, y: 100, fixed: false, kind: "endpoint", sketchId: "S1" },
  ];
  fixture.lines = [{ id: "L100", p1: "P100", p2: "P101", construction: false, sketchId: "S1" }];
  await page.evaluate((data) => window.__cadTest.importDocumentNameFixture(data, "block-parent-compose.json"), fixture);
  const before = (await page.evaluate(() => window.__cadTest.blockState())).instances;
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ lines: ["L100"], blockInstances: ["BI1", "BI2"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  const editor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(editor).toEqual(expect.objectContaining({ depth: 1 }));
  expect(editor.editorBlockInstances).toHaveLength(2);
  await page.click("#completeBlockEditBtn");

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toHaveLength(3);
  expect(state.instances).toHaveLength(1);
  const parent = state.definitions.find((definition) => definition.id === state.instances[0].definitionId);
  expect(parent.lines).toBe(1);
  expect(parent.blockInstances.map((instance) => instance.id).sort()).toEqual(["BI1", "BI2"]);
  expect(parent.constraints).toBe(1);
  expect(state.definitions.find((definition) => definition.id === "B1").parentDefinitionId).toBe(parent.id);
  expect(state.definitions.find((definition) => definition.id === "B2").parentDefinitionId).toBe(parent.id);
  expect(state.serialized.constraints).toHaveLength(0);
  expect(state.serialized.lines).toHaveLength(0);
  for (const original of before) {
    const child = parent.blockInstances.find((instance) => instance.id === original.id);
    expect(state.instances[0].x + child.x).toBeCloseTo(original.x, 8);
    expect(state.instances[0].y + child.y).toBeCloseTo(original.y, 8);
    expect(child.rotation).toBeCloseTo(original.rotation, 8);
    expect(child.fixed).toBe(original.fixed);
    expect(child.rotationLocked).toBe(original.rotationLocked);
    expect(child.enabledSketchIds).toEqual(original.enabledSketchIds);
  }

  await page.click("#undoBtn");
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toHaveLength(2);
  expect(state.definitions.every((definition) => definition.parentDefinitionId === null)).toBe(true);
  expect(state.instances.map((instance) => instance.id).sort()).toEqual(["BI1", "BI2"]);
  await page.click("#redoBtn");
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions.find((definition) => definition.id === "B1").parentDefinitionId).toBe(state.instances[0].definitionId);
  await page.evaluate(() => window.__cadTest.reloadBlockState());
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions.find((definition) => definition.id === "B2").parentDefinitionId).toBe(state.instances[0].definitionId);
  expect(state.projectionLineIds.some((id) => id.split("@").length === 2)).toBe(true);
  expect(state.projectionLineIds.filter((id) => id.split("@").length === 3)).toHaveLength(2);
  const composedInstanceId = state.instances[0].id;
  const composedDefinitionId = state.instances[0].definitionId;
  await page.evaluate((id) => window.__cadTest.selectGeometryIdsForTest({ blockInstances: [id] }), composedInstanceId);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances.every((instance) => instance.definitionId === composedDefinitionId)).toBe(true);
});

test("parent creation rejects a block definition that still has unselected instances", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const fixture = constrainedBlockGridFixture();
  await page.evaluate((data) => window.__cadTest.importDocumentNameFixture(data, "shared-block-parent.json"), fixture);
  const before = await page.evaluate(() => window.__cadTest.blockState());
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI10"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await expect(page.locator("#hint")).toContainText("対象インスタンスをすべて選択してください");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ editing: false }));
  const rejected = await page.evaluate(() => window.__cadTest.blockState());
  expect(rejected.definitions).toEqual(before.definitions);
  expect(rejected.instances).toEqual(before.instances);

  const allInstanceIds = before.instances.map((instance) => instance.id);
  await page.evaluate((blockInstances) => window.__cadTest.selectGeometryIdsForTest({ blockInstances }), allInstanceIds);
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");
  const completed = await page.evaluate(() => window.__cadTest.blockState());
  expect(completed.definitions).toHaveLength(2);
  expect(completed.instances).toHaveLength(1);
  const parent = completed.definitions.find((definition) => definition.id === completed.instances[0].definitionId);
  expect(completed.definitions.find((definition) => definition.id === "B1").parentDefinitionId).toBe(parent.id);
  expect(parent.blockInstances).toHaveLength(allInstanceIds.length);
  expect(new Set(parent.blockInstances.map((instance) => instance.definitionId))).toEqual(new Set(["B1"]));
  expect(parent.constraints).toBe(fixture.constraints.length);
});

test("wrapping selected blocks removes constraints that reference blocks left outside", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "block-parent-external-constraint.json"), blockPointOnLineFixture({ subjectY: -50, includeConstraint: true }));
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI2"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances.map((instance) => instance.id)).toContain("BI1");
  expect(state.instances).toHaveLength(2);
  expect(state.serialized.constraints).toHaveLength(0);
  const parentInstance = state.instances.find((instance) => instance.id !== "BI1");
  const parent = state.definitions.find((definition) => definition.id === parentInstance.definitionId);
  expect(parent.constraints).toBe(0);
  expect(parent.blockInstances).toEqual([expect.objectContaining({ id: "BI2", definitionId: "B2" })]);
  expect(state.definitions.find((definition) => definition.id === "B1").parentDefinitionId).toBeNull();
  expect(state.definitions.find((definition) => definition.id === "B2").parentDefinitionId).toBe(parent.id);
});

test("canceling parent creation restores moved definitions after nested child edits", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "block-parent-cancel.json"), blockPointOnLineFixture({ subjectY: -200 }));
  const before = await page.evaluate(() => window.__cadTest.blockState());
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1", "BI2"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 1, hostBlockInstanceCount: 2 }));
  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B1"] .blockEditBtn');
  await page.locator("#blockEditorNameInput").fill("Edited staged child");
  await page.click("#completeBlockEditBtn");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 1, hostBlockInstanceCount: 2 }));
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions.find((definition) => definition.id === "B1").name).toBe("Edited staged child");
  await page.click("#cancelBlockEditBtn");

  const restored = await page.evaluate(() => window.__cadTest.blockState());
  expect(restored.definitions).toEqual(before.definitions);
  expect(restored.instances).toEqual(before.instances);
  expect(restored.definitions.every((definition) => definition.parentDefinitionId === null)).toBe(true);
});

test("block editor can wrap existing child blocks and rolls ownership back with its parent edit", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "nested-child-parent.json"), nestedComposableBlocksFixture());
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions.find((definition) => definition.id === "B2").blockInstances.map((instance) => instance.id).sort()).toEqual(["BI1", "BI2"]);

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1", "BI2"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");
  const parentEditor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(parentEditor).toEqual(expect.objectContaining({ depth: 1 }));
  await page.click("#cancelBlockEditBtn");
  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toHaveLength(3);
  expect(state.definitions.find((definition) => definition.id === "B1").parentDefinitionId).toBe("B2");
  expect(state.definitions.find((definition) => definition.id === "B3").parentDefinitionId).toBe("B2");
  expect(state.definitions.find((definition) => definition.id === "B2").blockInstances.map((instance) => instance.id).sort()).toEqual(["BI1", "BI2"]);

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1", "BI2"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");
  await page.click("#completeBlockEditBtn");
  state = await page.evaluate(() => window.__cadTest.blockState());
  const room = state.definitions.find((definition) => definition.id === "B2");
  const parent = state.definitions.find((definition) => definition.parentDefinitionId === "B2");
  expect(state.definitions).toHaveLength(4);
  expect(room.blockInstances).toHaveLength(1);
  expect(room.blockInstances[0].definitionId).toBe(parent.id);
  expect(parent.blockInstances.map((instance) => instance.id).sort()).toEqual(["BI1", "BI2"]);
  expect(state.definitions.find((definition) => definition.id === "B1").parentDefinitionId).toBe(parent.id);
  expect(state.definitions.find((definition) => definition.id === "B3").parentDefinitionId).toBe(parent.id);
});

test("constrained block grids track a single pointer move without diluting drag distance", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "constrained-block-grid.json"), constrainedBlockGridFixture());

  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  const before = await page.evaluate(() => window.__cadTest.blockState().instances);
  const screenDx = 80;
  const screenDy = 40;
  const expectedDx = screenDx / interaction.scale;
  const expectedDy = screenDy / interaction.scale;

  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + screenDx, interaction.center.y + screenDy, { steps: 1 });
  await page.mouse.up();

  const after = await page.evaluate(() => window.__cadTest.blockState().instances);
  expect(after).toHaveLength(6);
  for (let i = 0; i < after.length; i++) {
    expect(after[i].x - before[i].x).toBeCloseTo(expectedDx, 3);
    expect(after[i].y - before[i].y).toBeCloseTo(expectedDy, 3);
    expect(after[i].rotation).toBeCloseTo(before[i].rotation, 8);
  }

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "fixed-block-grid.json"), constrainedBlockGridFixture({ fixed: true }));
  const fixedInteraction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  const fixedBefore = await page.evaluate(() => window.__cadTest.blockState().instances);
  await page.mouse.move(fixedInteraction.center.x, fixedInteraction.center.y);
  await page.mouse.down();
  await page.mouse.move(fixedInteraction.center.x + screenDx, fixedInteraction.center.y + screenDy, { steps: 1 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__cadTest.blockState().instances)).toEqual(fixedBefore);
});

test("a block point-on-line constraint keeps the subject block under-constrained", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "block-point-on-line.json"), blockPointOnLineFixture({ subjectY: -40 }));

  const added = await page.evaluate(() => window.__cadTest.addBlockPointOnLineConstraintForTest("BI2", "P3", "BI1", "L1"));
  expect(added.committed).toBe(true);
  expect(added.analysis).toEqual(expect.objectContaining({ stable: true, rank: 1, variableCount: 3, freeVariableCount: 2 }));
  expect(added.status.projections).not.toHaveLength(0);
  expect(added.status.projections.every((projection) => projection.status === "under")).toBe(true);

  await page.evaluate((fixture) => window.__cadTest.loadDocumentFixtureForDragTest(fixture, "block-point-on-line-reload.json"), added.serialized);
  expect(await page.evaluate(() => window.__cadTest.constraintAnalysisForTest())).toEqual(expect.objectContaining({ stable: true, freeVariableCount: 2 }));

  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints("BI2"));
  await page.mouse.move(interaction.center.x, interaction.center.y);
  await page.mouse.down();
  await page.mouse.move(interaction.center.x + 80, interaction.center.y + 40, { steps: 3 });
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => ({
    analysis: window.__cadTest.constraintAnalysisForTest(),
    status: window.__cadTest.blockConstraintStatusForTest("BI2"),
  }));
  expect(afterDrag.analysis).toEqual(expect.objectContaining({ stable: true, freeVariableCount: 2 }));
  expect(afterDrag.status.projections.every((projection) => projection.status === "under")).toBe(true);

  await page.click('[data-explorer-tab="constraint"]');
  await page.locator("#explorerConstraint > details", {
    has: page.locator("summary", { hasText: /^(?:Constraint|拘束)$/ }),
  }).locator("summary").click();
  await page.hover('.constraint-list-row[data-idx="0"]');
  expect(await page.evaluate(() => window.__cadTest.currentSidebarHoveredGeometryKeys())).toEqual([
    "line:BI1@L1",
    "point:BI1@P1",
    "point:BI1@P2",
    "point:BI2@P3",
  ]);
  await page.mouse.move(5, 5);
  expect(await page.evaluate(() => window.__cadTest.currentSidebarHoveredGeometryKeys())).toEqual([]);
});

test("unstable block constraints are conflicts, and failed additions roll back cleanly", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.loadDocumentFixtureForDragTest(fixture, "unstable-block-point-on-line.json"), blockPointOnLineFixture({ subjectY: 60, includeConstraint: true }));

  const unstable = await page.evaluate(() => window.__cadTest.blockConstraintStatusForTest("BI2"));
  expect(unstable.stable).toBe(false);
  expect(unstable.projections).not.toHaveLength(0);
  expect(unstable.projections.every((projection) => projection.status === "conflict")).toBe(true);

  await page.evaluate((fixture) => window.__cadTest.loadDocumentFixtureForDragTest(fixture, "fixed-block-point-on-line.json"), blockPointOnLineFixture({ subjectY: 60, subjectFixed: true }));
  const rejected = await page.evaluate(() => window.__cadTest.addBlockPointOnLineConstraintForTest("BI2", "P3", "BI1", "L1"));
  expect(rejected.committed).toBe(false);
  expect(rejected.serialized.constraints).toHaveLength(0);
  expect(rejected.analysis.stable).toBe(true);
});

test("guided point drags keep the free target axis responsive and solve exactly on release", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "guided-point-drag.json"), guidedPointDragFixture());

  const result = await page.evaluate(() => window.__cadTest.guidedPointDragForTest("P26", 25, 12));
  expect(result.targetConstraintCount).toBe(1);
  expect(result.preview.success).toBe(true);
  expect(result.preview.iterations).toBeLessThan(8);
  expect(result.preview.errorNorm).toBeLessThanOrEqual(result.preview.acceptError);
  expect(Math.abs(result.preview.point.x - result.target.x)).toBeLessThanOrEqual(result.preview.acceptError);
  expect(result.preview.point.y).toBeLessThan(result.target.y);
  expect(result.final.success).toBe(true);
  expect(result.final.errorNorm).toBeLessThan(1e-5);
  expect(result.final.baseErrorNorm).toBeLessThan(1e-5);
  expect(result.final.point.x).toBeCloseTo(result.target.x, 4);
  expect(Math.hypot(result.final.point.x, result.final.point.y)).toBeCloseTo(100, 4);

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "guided-curved-point-drag.json"), guidedPointDragFixture({ x: 60, y: 80 }));
  const curved = await page.evaluate(() => window.__cadTest.guidedPointDragForTest("P26", 40, 0));
  expect(curved.targetConstraintCount).toBe(1);
  expect(curved.preview.success).toBe(true);
  expect(curved.preview.iterations).toBeLessThan(8);
  expect(curved.final.success).toBe(true);
  expect(curved.final.errorNorm).toBeLessThan(1e-5);
  expect(curved.final.baseErrorNorm).toBeLessThan(1e-5);
  expect(curved.final.point.x).toBeGreaterThan(60);
  expect(curved.final.point.x).toBeLessThan(curved.target.x);
  expect(curved.final.point.y).toBeLessThan(80);
  expect(Math.hypot(curved.final.point.x, curved.final.point.y)).toBeCloseTo(100, 4);

  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "guided-continuous-point-drag.json"), guidedPointDragFixture({ x: 60, y: 80 }));
  const continuous = await page.evaluate(() => window.__cadTest.guidedPointDragPathForTest(
    "P26",
    Array.from({ length: 10 }, (_, index) => [(index + 1) * 4, 0]),
  ));
  expect(continuous.previews).toHaveLength(10);
  for (let index = 0; index < continuous.previews.length; index++) {
    const preview = continuous.previews[index];
    expect(preview.success).toBe(true);
    expect(preview.blocked).not.toBe(true);
    expect(preview.errorNorm).toBeLessThanOrEqual(1e-3);
    if (index > 0) expect(preview.point.x).toBeGreaterThan(continuous.previews[index - 1].point.x);
  }
  expect(continuous.final.success).toBe(true);
  expect(continuous.final.errorNorm).toBeLessThan(1e-5);
  expect(Math.hypot(continuous.final.point.x, continuous.final.point.y)).toBeCloseTo(100, 4);
});

test("block placement escape commits zero rotation after choosing the display center", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const setup = await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.fill("#blockEditorNameInput", "Esc Block");
  await page.click("#completeBlockEditBtn");

  const canvas = await page.locator("#canvas").boundingBox();
  await openBlockDefinitions(page);
  await page.click(".blockPlaceBtn");
  await page.mouse.click(canvas.x + canvas.width * 0.75, canvas.y + canvas.height * 0.7);
  await page.keyboard.press("Escape");

  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances).toHaveLength(2);
  expect(state.instances[1].rotation).toBeCloseTo(0, 8);
  expect(state.instances[1].rotationLocked).toBe(true);
  expect(state.mode).toBe("select");
});

test("legacy block data migrates into an internal Sketch-1 without changing projection ids", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  const before = await page.evaluate(() => window.__cadTest.blockState());
  const migrated = await page.evaluate(() => window.__cadTest.reloadLegacyBlockState());
  expect(migrated.version).toBe(9);
  expect(migrated.origin).toEqual({ x: 0, y: 0 });
  expect(migrated.sketches).toEqual([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", parentSketchId: "ROOT" }),
  ]);
  expect(new Set(migrated.elementSketchIds)).toEqual(new Set(["S1"]));
  expect(migrated.enabledSketchIds).toEqual(["S1"]);
  expect(migrated.rotationLocked).toBe(false);
  expect(migrated.projectionLineIds).toEqual(before.projectionLineIds);
});

test("new block editor supports cancel and independent internal sketch hierarchy", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await expect(page.locator("#sketchOverlay")).toBeVisible();
  await page.click('[data-explorer-tab="geometry"]');
  await expect(page.locator("#sketchOverlay")).toBeVisible();
  await page.click('[data-explorer-tab="blocks"]');
  await expect(page.locator("#sketchOverlay")).toBeVisible();
  await expect(page.locator("#completeBlockEditBtn")).toBeVisible();
  expect(await page.locator(".canvas-area").evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, boxShadow: style.boxShadow };
  })).toEqual({ background: "rgb(245, 243, 255)", boxShadow: "none" });
  const cancelled = await page.evaluate(() => window.__cadTest.cancelBlockEditor());
  expect(cancelled).toEqual({ editing: false, definitions: 0, instances: 0, lines: 4 });
  await expect(page.locator(".canvas-area")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  await page.evaluate(() => window.__cadTest.resetForEmptyBlockCreation());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  const initialEditor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(initialEditor.sketches).toEqual([
    expect.objectContaining({ id: "ROOT", kind: "root" }),
    expect.objectContaining({ id: "S1", parentSketchId: "ROOT" }),
  ]);
  const child = await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  expect(child.sketches).toContainEqual(expect.objectContaining({ id: child.sketchId, parentSketchId: "S1" }));
  await page.fill("#blockEditorNameInput", "Internal Sketch Block");
  const completed = await page.evaluate(() => window.__cadTest.completeBlockEditor());
  expect(completed).toEqual({ editing: false, definitions: 1, instances: 0 });
  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions[0].sketches).toHaveLength(3);
});

test("block editor undo and redo use an independent local history", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForEmptyBlockCreation());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  expect(await page.evaluate(() => window.__cadTest.historyState())).toEqual(expect.objectContaining({
    blockEditing: true,
    undoCount: 1,
    redoCount: 0,
    undoDisabled: true,
  }));

  await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  expect(await page.evaluate(() => window.__cadTest.historyState())).toEqual(expect.objectContaining({
    undoCount: 3,
    redoCount: 0,
    undoDisabled: false,
  }));

  await page.click("#undoBtn");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ editorLineCount: 0 }));
  expect((await page.evaluate(() => window.__cadTest.blockEditorState())).sketches).toHaveLength(3);

  await page.click("#undoBtn");
  const initial = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(initial.sketches).toHaveLength(2);
  expect(initial.activeSketchId).toBe("S1");
  expect(await page.evaluate(() => window.__cadTest.historyState())).toEqual(expect.objectContaining({
    undoCount: 1,
    redoCount: 2,
    undoDisabled: true,
    redoDisabled: false,
  }));

  await page.click("#redoBtn");
  await page.click("#redoBtn");
  const restored = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(restored.sketches).toHaveLength(3);
  expect(restored.editorLineCount).toBe(1);
});

test("block editor can place existing blocks and create nested blocks that survive reload", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "nested-block-editing.json"), nestedBlockEditingFixture());

  await openBlockDefinitions(page);
  await expect(page.locator('.block-item[data-id="B2"]')).toHaveCount(1);
  await expect(page.locator('.block-item[data-id="B1"]')).toHaveCount(0);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  await openBlockDefinitions(page);
  await expect(page.locator("#blockList")).toBeVisible();
  await expect(page.locator('.block-item[data-id="B1"] .blockPlaceBtn')).toBeEnabled();
  await expect(page.locator('.block-item[data-id="B2"]')).toHaveCount(0);

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B1"] .blockPlaceBtn');
  const placed = await page.evaluate(() => window.__cadTest.commitBlockPlacementForTest({ x: 20, y: 10 }, Math.PI / 2));
  expect(placed).toEqual(expect.objectContaining({ definitionId: "B1", rotation: Math.PI / 2, rotationLocked: true }));
  const nestedConstraint = await page.evaluate(() => window.__cadTest.constrainFirstNestedBlockLineForTest("vertical"));
  expect(nestedConstraint.success).toBe(true);
  expect(nestedConstraint.errorNorm).toBeLessThan(1e-5);
  expect(nestedConstraint.line).toBe(`${placed.id}@L1`);
  let editor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(editor.depth).toBe(1);
  expect(editor.editorBlockInstances).toHaveLength(1);

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ lines: ["L10"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  editor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(editor).toEqual(expect.objectContaining({ editing: true, isNew: true, depth: 2, editorLineCount: 1 }));
  await expect(page.locator("#blockList .block-item[data-id]")).toHaveCount(0);

  await page.click("#completeBlockEditBtn");
  editor = await page.evaluate(() => window.__cadTest.blockEditorState());
  expect(editor.depth).toBe(1);
  expect(editor.editorLineCount).toBe(0);
  expect(editor.editorBlockInstances).toHaveLength(2);

  await page.click("#completeBlockEditBtn");
  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toHaveLength(3);
  const room = state.definitions.find((definition) => definition.id === "B2");
  expect(room.lines).toBe(0);
  expect(room.constraints).toBe(1);
  expect(room.blockInstances).toHaveLength(2);
  expect(room.blockInstances.map((instance) => instance.definitionId).sort()).toEqual(["B1", "B3"]);
  expect(state.definitions.find((definition) => definition.id === "B1").parentDefinitionId).toBe("B2");
  expect(state.definitions.find((definition) => definition.id === "B2").parentDefinitionId).toBeNull();
  expect(state.definitions.find((definition) => definition.id === "B3").parentDefinitionId).toBe("B2");
  expect(state.projectionLineIds.sort()).toEqual([
    `BI100@${room.blockInstances.find((instance) => instance.definitionId === "B1").id}@L1`,
    `BI100@${room.blockInstances.find((instance) => instance.definitionId === "B3").id}@L10`,
  ].sort());

  await page.evaluate(() => window.__cadTest.reloadBlockState());
  state = await page.evaluate(() => window.__cadTest.blockState());
  const reloadedRoom = state.definitions.find((definition) => definition.id === "B2");
  expect(reloadedRoom.blockInstances).toHaveLength(2);
  expect(reloadedRoom.constraints).toBe(1);
  expect(state.serialized.blockDefinitions.find((definition) => definition.id === "B2").constraints[0].line).toBe(`${placed.id}@L1`);
  expect(state.projectionLineIds).toHaveLength(2);
  expect(state.projectionLineIds.every((id) => id.startsWith("BI100@BI") && id.split("@").length === 3)).toBe(true);

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI100"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 1, editorLineCount: 0 }));
  await page.click("#completeBlockEditBtn");
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toHaveLength(4);
  expect(state.instances).toHaveLength(1);
  const wrapper = state.definitions.find((definition) => definition.id === state.instances[0].definitionId);
  expect(wrapper.parentDefinitionId).toBeNull();
  const movedRoom = state.definitions.find((definition) => definition.id === "B2");
  expect(movedRoom.parentDefinitionId).toBe(wrapper.id);
  expect(wrapper.blockInstances).toEqual([expect.objectContaining({ definitionId: movedRoom.id })]);
  const movedChildren = state.definitions.filter((definition) => definition.parentDefinitionId === movedRoom.id);
  expect(movedChildren.map((definition) => definition.id).sort()).toEqual(["B1", "B3"]);
  expect(movedRoom.blockInstances.map((instance) => instance.definitionId).sort()).toEqual(movedChildren.map((definition) => definition.id).sort());
  expect(state.projectionLineIds).toHaveLength(2);
  expect(state.projectionLineIds.every((id) => id.split("@").length === 4)).toBe(true);

  await page.evaluate(() => window.__cadTest.reloadBlockState());
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.projectionLineIds).toHaveLength(2);
  expect(state.projectionLineIds.every((id) => id.split("@").length === 4)).toBe(true);
});

test("root constraints can reload nested block projection ids", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const imported = await page.evaluate(
    (fixture) => window.__cadTest.importDocumentNameFixture(fixture, "nested-root-constraint.json"),
    nestedRootConstraintFixture(),
  );
  expect(imported.success).toBe(true);

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.projectionLineIds).toContain("BI100@BI19@L1");
  expect(state.serialized.constraints).toEqual([
    expect.objectContaining({ type: "horizontal", line: "BI100@BI19@L1" }),
  ]);

  expect(await page.evaluate(() => window.__cadTest.reloadBlockState())).toEqual(expect.objectContaining({ projectionLines: 2 }));
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.projectionLineIds).toContain("BI100@BI19@L1");
  expect(state.serialized.constraints).toHaveLength(1);
});

test("loading removes stale nested block constraints and keeps the parent editable", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const imported = await page.evaluate(
    (fixture) => window.__cadTest.importDocumentNameFixture(fixture, "stale-nested-constraint.json"),
    nestedConstraintCleanupFixture({ stale: true }),
  );
  expect(imported.success).toBe(true);
  await expect(page.locator("#hint")).toContainText("ブロック内部拘束を1件解除しました");
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions.find((definition) => definition.id === "B2").constraints).toBe(0);

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 1 }));
});

test("deleting child geometry removes parent constraints without interrupting nested editing", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(
    (fixture) => window.__cadTest.importDocumentNameFixture(fixture, "nested-constraint-cleanup.json"),
    nestedConstraintCleanupFixture(),
  );

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B1"] .blockEditBtn');
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ lines: ["L1"] }));
  await page.click("#deleteSelectionBtn");
  await page.click("#completeBlockEditBtn");

  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 1 }));
  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions.find((definition) => definition.id === "B1").lines).toBe(1);
  expect(state.definitions.find((definition) => definition.id === "B2").constraints).toBe(0);
});

test("block definition window uses scoped actions and keeps sketch choices visible with many children", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "many-nested-blocks.json"), manyNestedBlockDefinitionsFixture());

  await openBlockDefinitions(page);
  await expect(page.locator('.block-item[data-id="B2"]')).toHaveCount(1);
  await expect(page.locator('.block-item[data-id="B1"]')).toHaveCount(0);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  await openBlockDefinitions(page);
  await expect(page.locator('.block-item[data-id="B1"]')).toHaveCount(1);
  await expect(page.locator('.block-item[data-id="B2"]')).toHaveCount(0);

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B1"] .blockPlaceBtn');
  await expect(page.locator("#blockSketchConfig")).toBeVisible();
  const layout = await page.evaluate(() => {
    const explorer = document.querySelector(".explorer-scroll");
    const config = document.querySelector("#blockSketchConfig").getBoundingClientRect();
    return {
      explorerScrollHeight: explorer.scrollHeight,
      explorerClientHeight: explorer.clientHeight,
      configHeight: config.height,
      configBottom: config.bottom,
      explorerBottom: explorer.getBoundingClientRect().bottom,
    };
  });
  expect(layout.explorerScrollHeight).toBeGreaterThanOrEqual(layout.explorerClientHeight);
  expect(layout.configHeight).toBeGreaterThanOrEqual(70);
  expect(layout.configBottom).toBeLessThanOrEqual(layout.explorerBottom + 1);
  await page.keyboard.press("Escape");

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B1"] .blockEditBtn');
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 2 }));
  await page.locator("#blockEditorNameInput").fill("Leaf edited");
  await page.click("#completeBlockEditBtn");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 1 }));
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions.find((definition) => definition.id === "B1").name).toBe("Leaf edited");

  page.once("dialog", (dialog) => dialog.accept("Leaf renamed"));
  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B1"] .blockRenameBtn');
  await expect(page.locator('.block-item[data-id="B1"] .block-item-name')).toHaveText("Leaf renamed");

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B24"] .blockDeleteBtn');
  await expect(page.locator('.block-item[data-id="B24"]')).toHaveCount(0);
  await page.locator("#blockDefinitionsDialog button[value=cancel]").first().click();
  await page.click("#cancelBlockEditBtn");
  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions.find((definition) => definition.id === "B1").name).toBe("Leaf renamed");
  expect(state.definitions.some((definition) => definition.id === "B24")).toBe(false);
});

test("canceling nested block creation restores the containing block and removes abandoned definitions", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "nested-block-cancel.json"), nestedBlockEditingFixture());

  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');
  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ lines: ["L10"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 2, editorLineCount: 1 }));
  await page.click("#cancelBlockEditBtn");
  expect(await page.evaluate(() => window.__cadTest.blockEditorState())).toEqual(expect.objectContaining({ depth: 1, editorLineCount: 1 }));
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions).toHaveLength(2);

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ lines: ["L10"] }));
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");
  expect((await page.evaluate(() => window.__cadTest.blockState())).definitions).toHaveLength(3);
  await page.click("#cancelBlockEditBtn");
  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toHaveLength(2);
  expect(state.definitions.find((definition) => definition.id === "B2").lines).toBe(1);
  expect(state.instances).toEqual([expect.objectContaining({ id: "BI100", definitionId: "B2" })]);
});

test("long constrained lines in the block editor follow sparse pointer moves without lag", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "sparse-block-line.json"), sparseBlockEditorLineDragFixture());
  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B1"] .blockEditBtn');

  const result = await page.evaluate(() => window.__cadTest.geometryDragPathForTest(
    { kind: "line", id: "L60" },
    [[160, 0], [-80, 0]],
  ));
  expect(result.sessionAvailable).toBe(true);
  expect(result.previews).toHaveLength(2);
  expect(result.previews.every((preview) => preview.success && !preview.blocked)).toBe(true);
  expect(result.previews[0].state.midpoint.x - result.startState.midpoint.x).toBeCloseTo(160, 4);
  expect(result.previews[1].state.midpoint.x - result.startState.midpoint.x).toBeCloseTo(-80, 4);
  expect(result.final.success).toBe(true);
  expect(result.final.baseErrorNorm).toBeLessThan(1e-5);
});

test("existing dimension lines remain draggable while the dimension command is active", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  const setup = await page.evaluate(() => window.__cadTest.resetForDimensionCommandLineDrag());
  await page.mouse.move(setup.point.x, setup.point.y);
  await page.mouse.down();
  expect(await page.evaluate(() => window.__cadTest.dimensionCommandLineDragState())).toEqual(expect.objectContaining({ dragging: true }));
  await page.mouse.move(setup.point.x, setup.point.y + 36, { steps: 3 });
  await page.mouse.up();

  const state = await page.evaluate(() => window.__cadTest.dimensionCommandLineDragState());
  expect(state.dragging).toBe(false);
  expect(state.pendingConstraintType).toBe("distance");
  expect(state.pendingCommandType).toBe("distance-place");
  expect(state.selectedLineIds).toEqual(["L2"]);
  expect(state.anchor.y - setup.anchor.y).toBeCloseTo(36 / setup.scale, 3);
});

test("a first block projection line stays pending so a second line can be dimensioned", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(
    (fixture) => window.__cadTest.importDocumentNameFixture(fixture, "nested-block-dimension.json"),
    nestedConstraintCleanupFixture(),
  );
  await openBlockDefinitions(page);
  await page.click('.block-item[data-id="B2"] .blockEditBtn');

  const targets = await page.evaluate(() => {
    const first = window.__cadTest.blockInteractionPoints("BI19");
    return {
      first: first.center,
      second: { x: first.center.x, y: first.center.y + 20 * first.scale },
    };
  });
  await page.click('[data-constraint="distance"]');
  await page.mouse.move(targets.first.x, targets.first.y);
  expect(await page.evaluate(() => window.__cadTest.blockProjectionHoverState())).toEqual(expect.objectContaining({
    command: "distance",
    lineId: "BI19@L1",
  }));

  await page.mouse.click(targets.first.x, targets.first.y);
  expect(await page.evaluate(() => window.__cadTest.authoringStateForTest())).toEqual(expect.objectContaining({
    pendingConstraintType: "distance",
    pendingCommandType: "distance-place",
  }));

  await page.mouse.move(targets.second.x, targets.second.y);
  expect(await page.evaluate(() => window.__cadTest.blockProjectionHoverState())).toEqual(expect.objectContaining({
    command: "distance",
    lineId: "BI19@L2",
  }));
  await page.mouse.click(targets.second.x, targets.second.y);
  expect(await page.evaluate(() => window.__cadTest.authoringStateForTest())).toEqual(expect.objectContaining({
    pendingConstraintType: "distance",
    pendingCommandType: "distance-place",
  }));
});

test("hovering a block highlights its projection without showing every geometry id", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");
  await page.keyboard.press("Escape");
  expect((await page.evaluate(() => window.__cadTest.blockState())).selectedInstanceIds).toEqual([]);
  const interaction = await page.evaluate(() => window.__cadTest.blockInteractionPoints());
  const labelPoint = { x: interaction.center.x + 20, y: interaction.center.y - 9 };
  const labelBefore = await canvasPatch(page, labelPoint, 5);

  await page.mouse.move(interaction.center.x, interaction.center.y);
  expect(await page.evaluate(() => window.__cadTest.blockProjectionHoverState())).toEqual(expect.objectContaining({
    blockInstanceId: "BI1",
  }));
  const labelAfter = await canvasPatch(page, labelPoint, 5);
  expect(labelAfter).toEqual(labelBefore);

  await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ blockInstances: ["BI1"] }));
  expect(await page.evaluate(() => window.__cadTest.drawnGeometryIdLabelsForTest())).toEqual([]);
});

test("block projection endpoints visibly highlight during constraint commands", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");
  const endpoint = await page.evaluate(() => window.__cadTest.blockProjectionEndpointForTest());
  const before = await canvasPatch(page, endpoint);

  await page.click('[data-constraint="coincident"]');
  await page.mouse.move(endpoint.x, endpoint.y);
  const hover = await page.evaluate(() => window.__cadTest.blockProjectionHoverState());
  expect(hover).toEqual(expect.objectContaining({
    command: "coincident",
    pointId: endpoint.id,
    pointIsBlockProjection: true,
  }));
  const after = await canvasPatch(page, endpoint);
  const changedChannels = after.reduce((count, value, index) => count + Number(value !== before[index]), 0);
  expect(changedChannels).toBeGreaterThan(12);
});

test("reloaded block editing reserves existing internal geometry and sketch ids", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);

  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");
  const beforeReload = await page.evaluate(() => window.__cadTest.blockState());
  const originalDefinition = beforeReload.serialized.blockDefinitions[0];
  expect(originalDefinition.points).toHaveLength(4);
  expect(originalDefinition.lines).toHaveLength(4);

  await page.evaluate(() => window.__cadTest.reloadBlockState());
  await openBlockDefinitions(page);
  await page.dblclick(".block-item[data-id]");
  const child = await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  await page.click("#completeBlockEditBtn");

  const completed = await page.evaluate(() => window.__cadTest.blockState());
  const definition = completed.serialized.blockDefinitions[0];
  const pointIds = definition.points.map((item) => item.id);
  const lineIds = definition.lines.map((item) => item.id);
  const sketchIds = definition.sketches.map((item) => item.id);
  expect(completed.definitions[0].points).toBe(6);
  expect(completed.definitions[0].lines).toBe(5);
  expect(new Set(pointIds).size).toBe(pointIds.length);
  expect(new Set(lineIds).size).toBe(lineIds.length);
  expect(new Set(sketchIds).size).toBe(sketchIds.length);
  expect(definition.points.filter((item) => item.sketchId === child.sketchId)).toHaveLength(2);
  expect(definition.lines.filter((item) => item.sketchId === child.sketchId)).toHaveLength(1);
});

test("placement and existing instances keep independent enabled internal sketches", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(() => window.__cadTest.resetForBlockCreationUi());
  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await page.click("#completeBlockEditBtn");

  await openBlockDefinitions(page);
  await page.dblclick(".block-item[data-id]");
  const child = await page.evaluate(() => window.__cadTest.addBlockEditorChildGeometry());
  await page.click("#completeBlockEditBtn");
  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].enabledSketchIds).toEqual(["S1"]);

  await openBlockDefinitions(page);
  await page.click(".blockPlaceBtn");
  await expect(page.locator("#blockSketchConfig")).toBeVisible();
  await page.locator(`#blockSketchConfig input[data-sketch-id="S1"]`).uncheck();
  await page.locator(`#blockSketchConfig input[data-sketch-id="${child.sketchId}"]`).check();
  const canvas = await page.locator("#canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.65);
  await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.65);
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[1].enabledSketchIds).toEqual([child.sketchId]);
  expect(state.projectionLineIds).toHaveLength(5);
});

test("disabling a block sketch automatically removes related constraints and reports it", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate(
    (fixture) => window.__cadTest.importDocumentNameFixture(fixture, "block-sketch-constraint-removal.json"),
    blockSketchDisableConstraintFixture(),
  );

  expect(await page.evaluate(() => window.__cadTest.setFirstBlockInstanceSketches(["S10"]))).toBe(true);
  await expect(page.locator("#hint")).toContainText("関連拘束を2件、自動解除しました");

  let state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].enabledSketchIds).toEqual(["S10"]);
  expect(state.projectionLineIds).toEqual(["BI1@L10"]);
  expect(state.serialized.constraints).toHaveLength(0);

  await page.click("#undoBtn");
  state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.instances[0].enabledSketchIds).toEqual(["S1", "S10"]);
  expect(state.projectionLineIds.sort()).toEqual(["BI1@L1", "BI1@L10"].sort());
  expect(state.serialized.constraints).toHaveLength(2);
});

test("block creation rejects shared boundaries and annotation references without mutation", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  const result = await page.evaluate(() => window.__cadTest.blockCreationRejectionCases());
  expect(result.sharedPointError).toContain("非選択図形と共有");
  expect(result.sharedCounts).toEqual({ definitions: 0, instances: 0, lines: 2 });
  expect(result.annotationError).toContain("注記");
  expect(result.annotationCounts).toEqual({ definitions: 0, instances: 0, lines: 1 });
});

test("block creation keeps internal constraints and removes every external constraint", async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
  await page.evaluate((fixture) => window.__cadTest.importDocumentNameFixture(fixture, "external-constraint-block.json"), externallyConstrainedBlockFixture());

  const selection = await page.evaluate(() => window.__cadTest.selectGeometryIdsForTest({ lines: ["L32", "L33", "L34", "L35", "L46"] }));
  expect(selection.blockError).toBeNull();
  expect(selection.internalConstraintCount).toBe(6);
  expect(selection.externalConstraintCount).toBe(3);

  await openBlocksExplorer(page);
  await page.click("#toolCreateBlock");
  await expect(page.locator("#hint")).toContainText("選択外につながる拘束3件は完了時に解除されます");
  await page.click("#completeBlockEditBtn");
  await expect(page.locator("#hint")).toContainText("外部拘束3件を解除しました");

  const state = await page.evaluate(() => window.__cadTest.blockState());
  expect(state.definitions).toHaveLength(2);
  expect(state.instances).toHaveLength(2);
  expect(state.serialized.lines.map((line) => line.id).sort()).toEqual(["L10", "L36"]);
  expect(state.serialized.constraints).toHaveLength(0);
  const createdDefinition = state.serialized.blockDefinitions.find((definition) => definition.id !== "B1");
  expect(createdDefinition.lines.map((line) => line.id).sort()).toEqual(["L32", "L33", "L34", "L35", "L46"]);
  expect(createdDefinition.constraints).toHaveLength(6);
  expect(createdDefinition.constraints.every((constraint) => !constraint.reference)).toBe(true);
});
