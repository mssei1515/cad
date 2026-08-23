const { test, expect } = require("./test-fixture");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const host = "127.0.0.1";
const port = Number(process.env.CAD2_E2E_PORT || 8765) + 7;
const baseUrl = `http://${host}:${port}`;
const fixturePath = path.resolve(__dirname, "../../test-data/意地悪ドラッグ完全拘束.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const sandboxCenter = { x: 4000, y: 0 };
let serverProcess = null;
let sandboxSequence = 1;

const drawingToolIds = [
  "toolSelect",
  "toolPoint",
  "toolLine",
  "toolCircle",
  "toolArc",
  "toolConstructionLine",
  "toolRectangle",
  "toolTrim",
  "toolFillet",
  "toolOffset",
];

const constraintToolTypes = [
  "distance",
  "coincident",
  "horizontal",
  "vertical",
  "parallel",
  "perpendicular",
  "symmetry",
  "concentric",
  "equal",
  "tangent",
];

function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(check, 100);
      });
    };
    check();
  });
}

function referencedGeometryIds(value, allIds) {
  return Object.values(value).filter((entry) => typeof entry === "string" && allIds.has(entry));
}

function fixtureMilestone(fraction) {
  const data = structuredClone(fixture);
  if (fraction <= 0) {
    data.points = [];
    data.lines = [];
    data.circles = [];
    data.arcs = [];
    data.constraints = [];
    return data;
  }
  if (fraction >= 1) return data;

  data.lines = data.lines.slice(0, Math.ceil(data.lines.length * fraction));
  data.circles = data.circles.slice(0, Math.ceil(data.circles.length * fraction));
  data.arcs = data.arcs.slice(0, Math.ceil(data.arcs.length * fraction));
  const includedPointIds = new Set(data.points.slice(0, Math.ceil(data.points.length * fraction)).map((point) => point.id));
  for (const line of data.lines) {
    includedPointIds.add(line.p1);
    includedPointIds.add(line.p2);
  }
  for (const primitive of [...data.circles, ...data.arcs]) includedPointIds.add(primitive.center);
  data.points = data.points.filter((point) => includedPointIds.has(point.id));

  const allIds = new Set([
    ...fixture.points.map((item) => item.id),
    ...fixture.lines.map((item) => item.id),
    ...fixture.circles.map((item) => item.id),
    ...fixture.arcs.map((item) => item.id),
  ]);
  const includedIds = new Set([
    ...data.points.map((item) => item.id),
    ...data.lines.map((item) => item.id),
    ...data.circles.map((item) => item.id),
    ...data.arcs.map((item) => item.id),
  ]);
  data.constraints = data.constraints.filter((constraint) =>
    referencedGeometryIds(constraint, allIds).every((id) => includedIds.has(id)),
  );
  return data;
}

function sandboxFixture(build) {
  const data = structuredClone(fixture);
  const prefix = `AUD${sandboxSequence++}`;
  const point = (name, x, y, kind = "endpoint") => {
    const value = { id: `${prefix}_${name}`, x, y, fixed: false, kind };
    data.points.push(value);
    return value;
  };
  const line = (name, p1, p2) => {
    const value = { id: `${prefix}_${name}`, p1: p1.id, p2: p2.id };
    data.lines.push(value);
    return value;
  };
  const circle = (name, center, radius) => {
    const value = { id: `${prefix}_${name}`, center: center.id, radius };
    data.circles.push(value);
    return value;
  };
  const arc = (name, center, radius, startAngle, endAngle) => {
    const value = { id: `${prefix}_${name}`, center: center.id, radius, startAngle, endAngle };
    data.arcs.push(value);
    return value;
  };
  return { data, targets: build({ point, line, circle, arc, prefix }) };
}

function fixtureGeometryWorld(data, kind, id, detail = null) {
  const points = new Map(data.points.map((point) => [point.id, point]));
  if (kind === "point") return points.get(id);
  if (kind === "line") {
    const line = data.lines.find((item) => item.id === id);
    const p1 = points.get(line.p1);
    const p2 = points.get(line.p2);
    const t = 0.43;
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  }
  const primitive = [...data.circles, ...data.arcs].find((item) => item.id === id);
  const center = points.get(primitive.center);
  const angle = kind === "arc"
    ? detail === "start" ? primitive.startAngle : detail === "end" ? primitive.endAngle : primitive.startAngle + (primitive.endAngle - primitive.startAngle) * 0.27
    : 0;
  return { x: center.x + primitive.radius * Math.cos(angle), y: center.y + primitive.radius * Math.sin(angle) };
}

function fixtureWithoutConstraintAt(index) {
  const data = structuredClone(fixture);
  data.constraints.splice(index, 1);
  return data;
}

async function settleAfterPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function measureInteraction(page, results, label, action, limitMs) {
  const startedAt = Date.now();
  await action();
  await settleAfterPaint(page);
  const elapsedMs = Date.now() - startedAt;
  results.push({ label, elapsedMs, limitMs });
  expect(elapsedMs, `${label}: ${elapsedMs}ms`).toBeLessThan(limitMs);
  return elapsedMs;
}

function latencySummary(results, traces = []) {
  const slowest = [...results]
    .sort((left, right) => right.elapsedMs - left.elapsedMs)
    .slice(0, 5);
  const solveTimes = traces
    .map((trace) => trace?.solveMs)
    .filter((value) => Number.isFinite(value));
  return {
    count: results.length,
    maxElapsedMs: slowest[0]?.elapsedMs || 0,
    slowest,
    ...(solveTimes.length ? { maxSolveMs: Math.max(...solveTimes) } : {}),
  };
}

async function loadFixture(page, data, center = sandboxCenter, scale = 1) {
  const loaded = await page.evaluate(
    ({ fixtureData, fixtureName, focus, focusScale }) => {
      const result = window.__cadTest.loadDocumentFixtureForDragTest(fixtureData, fixtureName);
      const viewport = window.__cadTest.focusWorldForTest(focus, focusScale);
      return { result, viewport, state: window.__cadTest.authoringStateForTest() };
    },
    { fixtureData: data, fixtureName: "authoring-performance.json", focus: center, focusScale: scale },
  );
  expect(loaded.result.success).toBe(true);
  return loaded;
}

async function clientPosition(page, world) {
  return page.evaluate((point) => window.__cadTest.worldClientPositionForTest(point), world);
}

async function clickWorld(page, world) {
  const position = await clientPosition(page, world);
  await page.mouse.click(position.x, position.y);
}

async function moveWorld(page, world) {
  const position = await clientPosition(page, world);
  await page.mouse.move(position.x, position.y);
}

async function pressEscape(page) {
  await page.keyboard.press("Escape");
  await settleAfterPaint(page);
}

test.beforeAll(async () => {
  serverProcess = spawn(process.execPath, ["tools/serve.js", "--host", host, "--port", String(port)], {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "ignore",
  });
  await waitForServer(`${baseUrl}/index.html`);
});

test.afterAll(() => {
  if (serverProcess) serverProcess.kill();
});

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/index.html?test=1`);
  await page.waitForFunction(() => window.__cadTest);
});

test("all drawing and constraint commands stay responsive as the sketch grows", async ({ page }) => {
  test.setTimeout(180000);
  const results = [];
  const milestones = [0, 0.25, 0.5, 0.75, 1];

  for (const fraction of milestones) {
    const loaded = await loadFixture(page, fixtureMilestone(fraction), { x: 0, y: 0 }, 0.25);
    const counts = loaded.state;
    const stage = `${Math.round(fraction * 100)}%-p${counts.pointCount}-g${counts.lineCount + counts.circleCount + counts.arcCount}-c${counts.constraintCount}`;
    for (const id of drawingToolIds) {
      await measureInteraction(page, results, `${stage}/command/${id}`, () => page.locator(`#${id}`).click(), 250);
      await pressEscape(page);
    }
    for (const type of constraintToolTypes) {
      const selector = `[data-constraint="${type}"]`;
      await measureInteraction(page, results, `${stage}/constraint-command/${type}`, () => page.locator(selector).click(), 250);
      await pressEscape(page);
    }
  }

  console.log(JSON.stringify({ kind: "authoring-command-latency", ...latencySummary(results) }));
});

test("every geometry creation click stays responsive at full fixture complexity", async ({ page }) => {
  test.setTimeout(180000);
  const results = [];
  const x = sandboxCenter.x;
  const cases = [
    {
      name: "point",
      tool: "toolPoint",
      clicks: [{ x: x - 120, y: -120 }],
      delta: { pointCount: 1, lineCount: 0, circleCount: 0, arcCount: 0 },
    },
    {
      name: "line",
      tool: "toolLine",
      clicks: [{ x: x - 120, y: -80 }, { x: x + 60, y: -20 }],
      delta: { pointCount: 2, lineCount: 1, circleCount: 0, arcCount: 0 },
    },
    {
      name: "circle",
      tool: "toolCircle",
      clicks: [{ x, y: 0 }, { x: x + 70, y: 0 }],
      delta: { pointCount: 1, lineCount: 0, circleCount: 1, arcCount: 0 },
    },
    {
      name: "arc",
      tool: "toolArc",
      clicks: [{ x, y: 0 }, { x: x + 70, y: 0 }, { x, y: 70 }],
      delta: { pointCount: 1, lineCount: 0, circleCount: 0, arcCount: 1 },
    },
    {
      name: "rectangle",
      tool: "toolRectangle",
      clicks: [{ x: x - 100, y: -70 }, { x: x + 100, y: 70 }],
      delta: { pointCount: 4, lineCount: 4, circleCount: 0, arcCount: 0 },
    },
  ];

  for (const creation of cases) {
    const loaded = await loadFixture(page, fixture);
    const before = loaded.state;
    await measureInteraction(page, results, `${creation.name}/command`, () => page.locator(`#${creation.tool}`).click(), 250);
    for (let index = 0; index < creation.clicks.length; index += 1) {
      await measureInteraction(
        page,
        results,
        `${creation.name}/click-${index + 1}`,
        () => clickWorld(page, creation.clicks[index]),
        350,
      );
    }
    const after = await page.evaluate(() => window.__cadTest.authoringStateForTest());
    for (const [key, delta] of Object.entries(creation.delta)) {
      expect(after[key], `${creation.name}/${key}`).toBe(before[key] + delta);
    }
    await pressEscape(page);
  }

  console.log(JSON.stringify({ kind: "geometry-creation-latency", ...latencySummary(results) }));
});

test("constraint target clicks and commits stay responsive at full fixture complexity", async ({ page }) => {
  test.setTimeout(240000);
  const results = [];
  const traces = [];
  const x = sandboxCenter.x;
  const cases = [
    {
      name: "horizontal-line",
      type: "horizontal",
      build: ({ point, line }) => {
        const p1 = point("P1", x - 80, -15);
        const p2 = point("P2", x + 80, 15);
        line("L1", p1, p2);
        return [{ x, y: 0 }];
      },
    },
    {
      name: "vertical-line",
      type: "vertical",
      build: ({ point, line }) => {
        const p1 = point("P1", x - 15, -80);
        const p2 = point("P2", x + 15, 80);
        line("L1", p1, p2);
        return [{ x, y: 0 }];
      },
    },
    {
      name: "horizontal-points",
      type: "horizontal",
      build: ({ point }) => {
        point("P1", x - 60, -30, "explicit");
        point("P2", x + 60, 30, "explicit");
        return [{ x: x - 60, y: -30 }, { x: x + 60, y: 30 }];
      },
    },
    {
      name: "vertical-points",
      type: "vertical",
      build: ({ point }) => {
        point("P1", x - 30, -60, "explicit");
        point("P2", x + 30, 60, "explicit");
        return [{ x: x - 30, y: -60 }, { x: x + 30, y: 60 }];
      },
    },
    {
      name: "coincident-points",
      type: "coincident",
      build: ({ point }) => {
        point("P1", x - 35, 0, "explicit");
        point("P2", x + 35, 0, "explicit");
        return [{ x: x - 35, y: 0 }, { x: x + 35, y: 0 }];
      },
    },
    {
      name: "parallel-lines",
      type: "parallel",
      build: ({ point, line }) => {
        line("L1", point("P1", x - 100, -60), point("P2", x + 20, -45));
        line("L2", point("P3", x - 20, 45), point("P4", x + 100, 70));
        return [{ x: x - 40, y: -52.5 }, { x: x + 40, y: 57.5 }];
      },
    },
    {
      name: "perpendicular-lines",
      type: "perpendicular",
      build: ({ point, line }) => {
        line("L1", point("P1", x - 100, -60), point("P2", x + 100, -45));
        line("L2", point("P3", x + 15, -20), point("P4", x + 30, 120));
        return [{ x: x - 50, y: -56.25 }, { x: x + 22.5, y: 50 }];
      },
    },
    {
      name: "symmetric-points",
      type: "symmetry",
      build: ({ point, line }) => {
        point("P1", x - 70, -35, "explicit");
        point("P2", x + 45, 75, "explicit");
        line("AXIS", point("A1", x - 130, 0), point("A2", x + 130, 0));
        return [{ x, y: 0 }, { x: x - 70, y: -35 }, { x: x + 45, y: 75 }];
      },
    },
    {
      name: "symmetric-lines",
      type: "symmetry",
      build: ({ point, line }) => {
        line("AXIS", point("A1", x, -130), point("A2", x, 130));
        line("L1", point("P1", x - 100, -70), point("P2", x - 55, 60));
        line("L2", point("P3", x + 90, -55), point("P4", x + 45, 75));
        return [{ x, y: 0 }, { x: x - 77.5, y: -5 }, { x: x + 67.5, y: 10 }];
      },
    },
    {
      name: "equal-lines",
      type: "equal",
      build: ({ point, line }) => {
        line("L1", point("P1", x - 120, -60), point("P2", x - 40, -60));
        line("L2", point("P3", x + 20, 60), point("P4", x + 150, 60));
        return [{ x: x - 80, y: -60 }, { x: x + 85, y: 60 }];
      },
    },
    {
      name: "concentric-circles",
      type: "concentric",
      build: ({ point, circle }) => {
        circle("C1", point("P1", x - 30, 0, "center"), 35);
        circle("C2", point("P2", x + 35, 0, "center"), 70);
        return [{ x: x + 5, y: 0 }, { x: x + 105, y: 0 }];
      },
    },
    {
      name: "tangent-line-circle",
      type: "tangent",
      build: ({ point, line, circle }) => {
        line("L1", point("P1", x - 110, -65), point("P2", x + 110, -65));
        circle("C1", point("PC", x, 0, "center"), 45);
        return [{ x: x - 70, y: -65 }, { x: x + 45, y: 0 }];
      },
    },
    {
      name: "tangent-circle-circle",
      type: "tangent",
      build: ({ point, circle }) => {
        circle("C1", point("P1", x - 60, 0, "center"), 45);
        circle("C2", point("P2", x + 70, 0, "center"), 35);
        return [{ x: x - 15, y: 0 }, { x: x + 105, y: 0 }];
      },
    },
    {
      name: "tangent-line-arc",
      type: "tangent",
      build: ({ point, line, arc }) => {
        line("L1", point("P1", x - 110, -70), point("P2", x + 110, -70));
        arc("A1", point("PC", x, 0, "center"), 45, -Math.PI, 0);
        return [{ x: x - 70, y: -70 }, { x, y: -45 }];
      },
    },
    {
      name: "tangent-arc-arc",
      type: "tangent",
      build: ({ point, arc }) => {
        arc("A1", point("P1", x - 60, 0, "center"), 45, 0.2, 2.9);
        arc("A2", point("P2", x + 70, 0, "center"), 35, 0.2, 2.9);
        return [{ x: x - 60, y: 45 }, { x: x + 70, y: 35 }];
      },
    },
    {
      name: "equal-arc-radii",
      type: "equal",
      build: ({ point, arc }) => {
        arc("A1", point("P1", x - 80, 0, "center"), 35, 0.2, 2.9);
        arc("A2", point("P2", x + 80, 0, "center"), 60, 0.2, 2.9);
        return [{ x: x - 80, y: 35 }, { x: x + 80, y: 60 }];
      },
    },
  ];

  for (const constraintCase of cases) {
    const sandbox = sandboxFixture(constraintCase.build);
    const loaded = await loadFixture(page, sandbox.data);
    const beforeCount = loaded.state.constraintCount;
    await measureInteraction(
      page,
      results,
      `${constraintCase.name}/command`,
      () => page.locator(`[data-constraint="${constraintCase.type}"]`).click(),
      250,
    );
    for (let index = 0; index < sandbox.targets.length; index += 1) {
      await measureInteraction(
        page,
        results,
        `${constraintCase.name}/operand-${index + 1}`,
        () => clickWorld(page, sandbox.targets[index]),
        index === sandbox.targets.length - 1 ? 350 : 300,
      );
    }
    const after = await page.evaluate(() => window.__cadTest.authoringStateForTest());
    expect(after.constraintCount, constraintCase.name).toBe(beforeCount + 1);
    traces.push({ name: constraintCase.name, ...after.lastPerformance });
  }

  console.log(JSON.stringify({ kind: "constraint-authoring-latency", ...latencySummary(results, traces) }));
});

test("symmetry constraint mirrors two points and survives serialization", async ({ page }) => {
  const data = fixtureMilestone(0);
  data.points.push(
    { id: "SYM_A1", x: -100, y: 0, fixed: true, kind: "endpoint" },
    { id: "SYM_A2", x: 100, y: 0, fixed: true, kind: "endpoint" },
    { id: "SYM_P1", x: -50, y: -30, fixed: false, kind: "explicit" },
    { id: "SYM_P2", x: 60, y: 80, fixed: false, kind: "explicit" },
  );
  data.lines.push({ id: "SYM_AXIS", p1: "SYM_A1", p2: "SYM_A2", construction: true });
  await loadFixture(page, data, { x: 0, y: 0 }, 1);

  await page.locator('[data-constraint="symmetry"]').click();
  await clickWorld(page, { x: 0, y: 0 });
  const axisSelection = await page.evaluate(() => window.__cadTest.selectedGeometryIdsForTest());
  expect(axisSelection).toMatchObject({ points: [], lines: ["SYM_AXIS"] });
  await clickWorld(page, { x: -50, y: -30 });
  await clickWorld(page, { x: 60, y: 80 });

  const committed = await page.evaluate(() => ({
    authoring: window.__cadTest.authoringStateForTest(),
    model: window.__cadTest.serializedModelForTest(),
    analysis: window.__cadTest.constraintAnalysisForTest(),
  }));
  expect(committed.authoring.lastConstraint).toMatchObject({
    type: "symmetry",
    p1: "SYM_P1",
    p2: "SYM_P2",
    axis: "SYM_AXIS",
  });
  const p1 = committed.model.points.find((point) => point.id === "SYM_P1");
  const p2 = committed.model.points.find((point) => point.id === "SYM_P2");
  expect(Math.abs(p1.x - p2.x)).toBeLessThan(1e-5);
  expect(Math.abs(p1.y + p2.y)).toBeLessThan(1e-5);
  expect(committed.analysis.errorNorm).toBeLessThan(1e-5);

  const restored = await page.evaluate((model) => {
    const result = window.__cadTest.loadDocumentFixtureForDragTest(model, "symmetry-round-trip.json");
    return {
      result,
      authoring: window.__cadTest.authoringStateForTest(),
      analysis: window.__cadTest.constraintAnalysisForTest(),
    };
  }, committed.model);
  expect(restored.result.success).toBe(true);
  expect(restored.authoring.lastConstraint).toMatchObject({ type: "symmetry", axis: "SYM_AXIS" });
  expect(restored.analysis.errorNorm).toBeLessThan(1e-5);
});

test("symmetry constraint mirrors two lines after selecting the axis first", async ({ page }) => {
  const data = fixtureMilestone(0);
  data.points.push(
    { id: "LS_A1", x: 0, y: -120, fixed: true, kind: "endpoint" },
    { id: "LS_A2", x: 0, y: 120, fixed: true, kind: "endpoint" },
    { id: "LS_P1", x: -80, y: -70, fixed: false, kind: "endpoint" },
    { id: "LS_P2", x: -45, y: 55, fixed: false, kind: "endpoint" },
    { id: "LS_P3", x: 70, y: -50, fixed: false, kind: "endpoint" },
    { id: "LS_P4", x: 65, y: 75, fixed: false, kind: "endpoint" },
  );
  data.lines.push(
    { id: "LS_AXIS", p1: "LS_A1", p2: "LS_A2", construction: true },
    { id: "LS_L1", p1: "LS_P1", p2: "LS_P2" },
    { id: "LS_L2", p1: "LS_P3", p2: "LS_P4" },
  );
  await loadFixture(page, data, { x: 0, y: 0 }, 1);

  await page.locator('[data-constraint="symmetry"]').click();
  await clickWorld(page, { x: 0, y: 0 });
  await clickWorld(page, { x: -62.5, y: -7.5 });
  await clickWorld(page, { x: 67.5, y: 12.5 });

  const committed = await page.evaluate(() => ({
    authoring: window.__cadTest.authoringStateForTest(),
    model: window.__cadTest.serializedModelForTest(),
    analysis: window.__cadTest.constraintAnalysisForTest(),
  }));
  expect(committed.authoring.lastConstraint).toMatchObject({
    type: "lineSymmetry",
    line1: "LS_L1",
    line2: "LS_L2",
    axis: "LS_AXIS",
  });
  const points = new Map(committed.model.points.map((point) => [point.id, point]));
  const lineConstraint = committed.authoring.lastConstraint;
  const pairs = lineConstraint.reversed
    ? [["LS_P1", "LS_P4"], ["LS_P2", "LS_P3"]]
    : [["LS_P1", "LS_P3"], ["LS_P2", "LS_P4"]];
  for (const [leftId, rightId] of pairs) {
    const left = points.get(leftId);
    const right = points.get(rightId);
    expect(Math.abs(left.x + right.x)).toBeLessThan(1e-5);
    expect(Math.abs(left.y - right.y)).toBeLessThan(1e-5);
  }
  expect(committed.analysis.errorNorm).toBeLessThan(1e-5);

  const restored = await page.evaluate((model) => {
    const result = window.__cadTest.loadDocumentFixtureForDragTest(model, "line-symmetry-round-trip.json");
    return {
      result,
      authoring: window.__cadTest.authoringStateForTest(),
      analysis: window.__cadTest.constraintAnalysisForTest(),
    };
  }, committed.model);
  expect(restored.result.success).toBe(true);
  expect(restored.authoring.lastConstraint).toMatchObject({ type: "lineSymmetry", axis: "LS_AXIS" });
  expect(restored.analysis.errorNorm).toBeLessThan(1e-5);
});

test("distance, diameter, radius and angle input phases stay responsive", async ({ page }) => {
  test.setTimeout(180000);
  const results = [];
  const traces = [];
  const x = sandboxCenter.x;
  const cases = [
    {
      name: "line-length",
      value: "160",
      build: ({ point, line }) => {
        line("L1", point("P1", x - 70, 0), point("P2", x + 70, 0));
        return { operands: [{ x, y: 0 }], confirmWithEnter: true, anchor: { x, y: -55 }, expectedType: "distance" };
      },
    },
    {
      name: "point-axis-distance",
      value: "140",
      build: ({ point }) => {
        point("P1", x - 60, -20, "explicit");
        point("P2", x + 60, 20, "explicit");
        return { operands: [{ x: x - 60, y: -20 }, { x: x + 60, y: 20 }], anchor: { x, y: -80 }, expectedType: "pointAxisDistance" };
      },
    },
    {
      name: "line-angle",
      value: "55",
      build: ({ point, line }) => {
        line("L1", point("P1", x - 120, -50), point("P2", x - 10, -50));
        line("L2", point("P3", x + 10, -30), point("P4", x + 100, 60));
        return { operands: [{ x: x - 65, y: -50 }, { x: x + 55, y: 15 }], anchor: { x, y: 90 }, expectedType: "lineAngle" };
      },
    },
    {
      name: "circle-diameter",
      value: "110",
      build: ({ point, circle }) => {
        circle("C1", point("P1", x, 0, "center"), 45);
        return { operands: [{ x: x + 45, y: 0 }], anchor: { x: x + 90, y: -20 }, expectedType: "diameterDimension" };
      },
    },
    {
      name: "arc-radius",
      value: "65",
      build: ({ point, arc }) => {
        arc("A1", point("P1", x, 0, "center"), 45, 0.1, 2.8);
        return { operands: [{ x, y: 45 }], anchor: { x: x + 75, y: 75 }, expectedType: "radiusDimension" };
      },
    },
  ];

  for (const dimensionCase of cases) {
    const sandbox = sandboxFixture(dimensionCase.build);
    const target = sandbox.targets;
    const loaded = await loadFixture(page, sandbox.data);
    const beforeCount = loaded.state.constraintCount;
    await measureInteraction(page, results, `${dimensionCase.name}/command`, () => page.locator('[data-constraint="distance"]').click(), 250);
    for (let index = 0; index < target.operands.length; index += 1) {
      await measureInteraction(page, results, `${dimensionCase.name}/operand-${index + 1}`, () => clickWorld(page, target.operands[index]), 300);
    }
    if (target.confirmWithEnter) {
      await measureInteraction(page, results, `${dimensionCase.name}/confirm-target`, () => page.keyboard.press("Enter"), 250);
    }
    await measureInteraction(page, results, `${dimensionCase.name}/place`, () => clickWorld(page, target.anchor), 250);
    const input = page.locator("#dimensionValueInput");
    await expect(input).toBeVisible();
    await input.fill(dimensionCase.value);
    await measureInteraction(page, results, `${dimensionCase.name}/submit`, () => input.press("Enter"), 350);
    const after = await page.evaluate(() => window.__cadTest.authoringStateForTest());
    expect(after.constraintCount, dimensionCase.name).toBe(beforeCount + 1);
    expect(after.lastConstraint?.type, dimensionCase.name).toBe(target.expectedType);
    traces.push({ name: dimensionCase.name, ...after.lastPerformance });
  }

  console.log(JSON.stringify({ kind: "dimension-authoring-latency", ...latencySummary(results, traces) }));
});

test("bug-prone connected angle and tangency constraints can be restored through the UI", async ({ page }) => {
  test.setTimeout(180000);
  const results = [];
  const cases = [
    {
      name: "connected-horizontal",
      index: fixture.constraints.findIndex((constraint) => constraint.type === "horizontal" && constraint.line === "L_TANGENT_CIRCLE"),
      type: "horizontal",
      operands: (constraint, data) => [fixtureGeometryWorld(data, "line", constraint.line)],
    },
    {
      name: "connected-line-angle",
      index: fixture.constraints.findIndex((constraint) => constraint.type === "lineAngle" && constraint.line1 === "L_BRANCH_ANGLE_REFERENCE"),
      type: "distance",
      operands: (constraint, data) => [fixtureGeometryWorld(data, "line", constraint.line1), fixtureGeometryWorld(data, "line", constraint.line2)],
      dimensionValue: (constraint) => String(constraint.target * 180 / Math.PI),
    },
    {
      name: "connected-line-arc-tangent",
      index: fixture.constraints.findIndex((constraint) => constraint.type === "lineCircleTangent" && String(constraint.primitive).startsWith("A")),
      type: "tangent",
      operands: (constraint, data) => [fixtureGeometryWorld(data, "line", constraint.line), fixtureGeometryWorld(data, "arc", constraint.primitive)],
    },
    {
      name: "connected-arc-arc-tangent",
      index: fixture.constraints.findIndex((constraint) => constraint.type === "circleCircleTangent" && String(constraint.a).startsWith("A") && String(constraint.b).startsWith("A")),
      type: "tangent",
      operands: (constraint, data) => [fixtureGeometryWorld(data, "arc", constraint.a), fixtureGeometryWorld(data, "arc", constraint.b)],
    },
  ];

  for (const connectedCase of cases) {
    expect(connectedCase.index, connectedCase.name).toBeGreaterThanOrEqual(0);
    const constraint = fixture.constraints[connectedCase.index];
    const data = fixtureWithoutConstraintAt(connectedCase.index);
    const operands = connectedCase.operands(constraint, data);
    const center = operands.reduce((sum, point) => ({ x: sum.x + point.x / operands.length, y: sum.y + point.y / operands.length }), { x: 0, y: 0 });
    const loaded = await loadFixture(page, data, center, 1);
    const hits = await page.evaluate((points) => points.map((point) => window.__cadTest.hitGeometryAtWorldForTest(point)), operands);
    expect(hits.every((hit) => hit.point || hit.line || hit.circle || hit.arc || hit.arcEndpoint), `${connectedCase.name}: ${JSON.stringify({ operands, hits })}`).toBe(true);
    const clientPositions = await Promise.all(operands.map((operand) => clientPosition(page, operand)));
    const clientElements = await page.evaluate((positions) => positions.map((position) => {
      const element = document.elementFromPoint(position.x, position.y);
      return { id: element?.id || null, tag: element?.tagName || null };
    }), clientPositions);
    expect(clientElements.every((element) => element.id === "canvas"), `${connectedCase.name}: ${JSON.stringify({ clientPositions, clientElements })}`).toBe(true);
    await measureInteraction(page, results, `${connectedCase.name}/command`, () => page.locator(`[data-constraint="${connectedCase.type}"]`).click(), 250);
    for (let index = 0; index < operands.length; index += 1) {
      await measureInteraction(page, results, `${connectedCase.name}/operand-${index + 1}`, () => clickWorld(page, operands[index]), index === operands.length - 1 && !connectedCase.dimensionValue ? 350 : 300);
    }
    if (connectedCase.dimensionValue) {
      const placementState = await page.evaluate(() => window.__cadTest.authoringStateForTest());
      const anchor = placementState.pendingPlacementPoint || { x: center.x + 70, y: center.y + 70 };
      await measureInteraction(page, results, `${connectedCase.name}/place`, () => clickWorld(page, anchor), 250);
      const input = page.locator("#dimensionValueInput");
      await expect(input).toBeVisible();
      const placedState = await page.evaluate(() => window.__cadTest.authoringStateForTest());
      expect(placedState.pendingCommandType, `${connectedCase.name}: ${JSON.stringify(placedState)}`).toBe("distance-value");
      expect(placedState.constraintCount, `${connectedCase.name}: ${JSON.stringify(placedState)}`).toBe(loaded.state.constraintCount);
      await input.fill(connectedCase.dimensionValue(constraint));
      await measureInteraction(page, results, `${connectedCase.name}/submit`, () => input.press("Enter"), 350);
    }
    const state = await page.evaluate(() => window.__cadTest.authoringStateForTest());
    expect(state.constraintCount, `${connectedCase.name}: ${JSON.stringify(state)}`).toBe(loaded.state.constraintCount + 1);
    const analysis = await page.evaluate(() => window.__cadTest.constraintAnalysisForTest());
    expect(analysis.stable, `${connectedCase.name}: ${JSON.stringify({ state, analysis })}`).toBe(true);
    expect(analysis.errorNorm, `${connectedCase.name}: ${JSON.stringify(analysis)}`).toBeLessThan(1e-4);
    expect(analysis.freeVariableCount, connectedCase.name).toBe(0);
  }

  console.log(JSON.stringify({ kind: "connected-constraint-authoring-latency", ...latencySummary(results) }));
});

test("construction, fixed, trim, fillet and offset operations stay responsive", async ({ page }) => {
  test.setTimeout(180000);
  const results = [];
  const x = sandboxCenter.x;

  await loadFixture(page, fixture);
  await measureInteraction(page, results, "construction/toggle", () => page.locator("#toolConstructionLine").click(), 250);
  await measureInteraction(page, results, "construction/line-command", () => page.locator("#toolLine").click(), 250);
  await measureInteraction(page, results, "construction/line-start", () => clickWorld(page, { x: x - 90, y: -80 }), 300);
  await measureInteraction(page, results, "construction/line-end", () => clickWorld(page, { x: x + 90, y: -20 }), 350);
  let state = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(state.lastLine?.construction).toBe(true);
  await pressEscape(page);

  const fixedSandbox = sandboxFixture(({ point }) => {
    const target = point("P_FIXED", x, 0, "explicit");
    return { id: target.id, click: { x, y: 0 } };
  });
  await loadFixture(page, fixedSandbox.data);
  await measureInteraction(page, results, "fixed/select-point", () => clickWorld(page, fixedSandbox.targets.click), 150);
  await measureInteraction(page, results, "fixed/apply", () => page.locator("#fixPointBtn").click(), 350);
  state = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(state.fixedPointIds).toContain(fixedSandbox.targets.id);

  const trimSandbox = sandboxFixture(({ point, line }) => {
    const target = line("TARGET", point("TP1", x - 130, 0), point("TP2", x + 130, 0));
    line("CUT1", point("C1P1", x - 55, -90), point("C1P2", x - 55, 90));
    line("CUT2", point("C2P1", x + 55, -90), point("C2P2", x + 55, 90));
    return { targetId: target.id, click: { x, y: 0 } };
  });
  const trimLoaded = await loadFixture(page, trimSandbox.data);
  await measureInteraction(page, results, "trim/command", () => page.locator("#toolTrim").click(), 250);
  await measureInteraction(page, results, "trim/execute", () => clickWorld(page, trimSandbox.targets.click), 350);
  state = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(state.lineCount).not.toBe(trimLoaded.state.lineCount);
  await pressEscape(page);

  const filletSandbox = sandboxFixture(({ point, line }) => {
    const corner = point("CORNER", x, 0);
    line("L1", point("P1", x - 24, 0), corner);
    line("L2", corner, point("P2", x, 24));
    return { first: { x: x - 15, y: 0 }, second: { x, y: 15 }, radius: { x: x + 6, y: 6 } };
  });
  const filletLoaded = await loadFixture(page, filletSandbox.data);
  await measureInteraction(page, results, "fillet/command", () => page.locator("#toolFillet").click(), 250);
  await measureInteraction(page, results, "fillet/first-line", () => clickWorld(page, filletSandbox.targets.first), 300);
  const filletFirstState = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(filletFirstState.mode).toBe("fillet");
  expect(filletFirstState.selected.lines).toHaveLength(1);
  await measureInteraction(page, results, "fillet/second-line", () => clickWorld(page, filletSandbox.targets.second), 300);
  const filletSecondState = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(filletSecondState.pendingCommandType).toBe("fillet-radius-place");
  expect(filletSecondState.pendingCommandPreview?.ok, JSON.stringify(filletSecondState.pendingCommandPreview)).toBe(true);
  expect(filletSecondState.pendingCommandPreview.maximumRadius).toBeLessThan(30);
  let input = page.locator("#dimensionValueInput");
  await expect(input).toBeHidden();
  await measureInteraction(page, results, "fillet/radius-preview", () => moveWorld(page, filletSandbox.targets.radius), 300);
  const filletPreviewState = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(filletPreviewState.pendingCommandPreview?.radius).toBeCloseTo(Math.hypot(6, 6), 5);
  await measureInteraction(page, results, "fillet/submit-radius", () => clickWorld(page, filletSandbox.targets.radius), 350);
  state = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(state.arcCount).toBe(filletLoaded.state.arcCount + 1);
  await pressEscape(page);

  const offsetSandbox = sandboxFixture(({ point, line }) => {
    line("SOURCE", point("P1", x - 120, 0), point("P2", x + 120, 0));
    return { source: { x, y: 0 }, side: { x, y: 65 } };
  });
  const offsetLoaded = await loadFixture(page, offsetSandbox.data);
  await measureInteraction(page, results, "offset/command", () => page.locator("#toolOffset").click(), 250);
  await measureInteraction(page, results, "offset/source", () => clickWorld(page, offsetSandbox.targets.source), 300);
  await measureInteraction(page, results, "offset/side", () => clickWorld(page, offsetSandbox.targets.side), 300);
  input = page.locator("#dimensionValueInput");
  await expect(input).toBeVisible();
  await input.fill("40");
  await measureInteraction(page, results, "offset/submit-distance", () => input.press("Enter"), 350);
  state = await page.evaluate(() => window.__cadTest.authoringStateForTest());
  expect(state.lineCount).toBe(offsetLoaded.state.lineCount + 1);

  console.log(JSON.stringify({ kind: "editing-authoring-latency", ...latencySummary(results) }));
});

test("selection, deletion, undo and redo stay responsive on the complete fixture", async ({ page }) => {
  test.setTimeout(120000);
  const results = [];
  const loaded = await loadFixture(page, fixture, { x: 0, y: 0 }, 0.25);
  const selectable = await page.evaluate(() => window.__cadTest.selectableLineClientPositionForTest());
  expect(selectable).not.toBeNull();

  await measureInteraction(page, results, "selection/line-pointerdown-up", () => page.mouse.click(selectable.x, selectable.y), 150);
  await measureInteraction(page, results, "selection/delete", () => page.locator("#deleteSelectionBtn").click(), 500);
  await measureInteraction(page, results, "history/undo", () => page.locator("#undoBtn").click(), 500);
  await measureInteraction(page, results, "history/redo", () => page.locator("#redoBtn").click(), 500);

  await expect(page.locator("#sketchOverlay")).toBeVisible();
  await measureInteraction(page, results, "explorer/blocks", () => page.locator('[data-explorer-tab="blocks"]').click(), 250);
  await measureInteraction(page, results, "explorer/geometry", () => page.locator('[data-explorer-tab="geometry"]').click(), 250);
  for (let index = 0; index < 5; index += 1) {
    await measureInteraction(page, results, `explorer/geometry-group-${index}`, () => page.locator("#explorerGeometry summary").nth(index).click(), 250);
  }
  await measureInteraction(page, results, "explorer/constraint", () => page.locator('[data-explorer-tab="constraint"]').click(), 250);
  await expect(page.locator("#constraintList")).toBeVisible();

  const canvas = loaded.viewport.canvas;
  await measureInteraction(page, results, "view/wheel-zoom", () => page.mouse.wheel(0, -240), 150);
  await measureInteraction(page, results, "view/middle-button-pan", async () => {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(canvas.left + canvas.width / 2 + 45, canvas.top + canvas.height / 2 + 30, { steps: 3 });
    await page.mouse.up({ button: "middle" });
  }, 150);
  await measureInteraction(page, results, "selection/blank-rectangle", async () => {
    await page.mouse.move(canvas.left + canvas.width - 90, canvas.top + canvas.height - 90);
    await page.mouse.down();
    await page.mouse.move(canvas.left + canvas.width - 30, canvas.top + canvas.height - 30, { steps: 3 });
    await page.mouse.up();
  }, 250);

  console.log(JSON.stringify({ kind: "selection-edit-view-latency", ...latencySummary(results) }));
});

test("point, line, circle, arc, endpoint and additive selection stay responsive", async ({ page }) => {
  test.setTimeout(120000);
  const results = [];
  const x = sandboxCenter.x;
  const sandbox = sandboxFixture(({ point, line, circle, arc }) => {
    const explicitPoint = point("POINT", x - 150, -100, "explicit");
    const selectionLine = line("LINE", point("LP1", x - 120, -35), point("LP2", x - 20, -35));
    const selectionCircle = circle("CIRCLE", point("CP", x + 35, -35, "center"), 32);
    const selectionArc = arc("ARC", point("AP", x + 135, 55, "center"), 38, -2.5, 1.2);
    return {
      point: { id: explicitPoint.id, click: { x: explicitPoint.x, y: explicitPoint.y } },
      line: { id: selectionLine.id, click: { x: x - 70, y: -35 } },
      circle: { id: selectionCircle.id, click: { x: x + 67, y: -35 } },
      arc: { id: selectionArc.id, click: { x: x + 135 + 38 * Math.cos(-0.65), y: 55 + 38 * Math.sin(-0.65) } },
      endpoint: { id: selectionArc.id, click: { x: x + 135 + 38 * Math.cos(-2.5), y: 55 + 38 * Math.sin(-2.5) } },
    };
  });
  await loadFixture(page, sandbox.data);

  for (const kind of ["point", "line", "circle", "arc", "endpoint"]) {
    await measureInteraction(page, results, `selection/${kind}`, () => clickWorld(page, sandbox.targets[kind].click), 150);
    const selected = await page.evaluate(() => window.__cadTest.selectedGeometryIdsForTest());
    if (kind === "point") expect(selected.points).toEqual([sandbox.targets.point.id]);
    if (kind === "line") expect(selected.lines).toEqual([sandbox.targets.line.id]);
    if (kind === "circle") expect(selected.circles).toEqual([sandbox.targets.circle.id]);
    if (kind === "arc" || kind === "endpoint") expect(selected.arcs).toEqual([sandbox.targets.arc.id]);
  }

  await page.keyboard.down("Shift");
  await measureInteraction(page, results, "selection/add-line", () => clickWorld(page, sandbox.targets.line.click), 150);
  await measureInteraction(page, results, "selection/add-circle", () => clickWorld(page, sandbox.targets.circle.click), 150);
  await page.keyboard.up("Shift");
  const additive = await page.evaluate(() => window.__cadTest.selectedGeometryIdsForTest());
  expect(additive.lines).toEqual([sandbox.targets.line.id]);
  expect(additive.circles).toEqual([sandbox.targets.circle.id]);

  console.log(JSON.stringify({ kind: "geometry-selection-latency", ...latencySummary(results) }));
});
