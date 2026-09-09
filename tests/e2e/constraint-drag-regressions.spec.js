const { test, expect, openTestDocument } = require('./test-fixture');
const fillets = require('../fixtures/collapsed-fillets.json');
const offsets = require('../fixtures/tangent-offset-chain.json');
const aircraft = require('../fixtures/aircraft-tangent-arcs.json');

const directions = Array.from({ length: 8 }, (_, index) => [Math.cos(index * Math.PI / 4), Math.sin(index * Math.PI / 4)]);
function repeatedPath(direction, fast, distance = 10) {
  const samples = fast ? [1, -1, 0] : [0.25, 0.5, 0.75, 1, 0.5, 0, -0.5, -1, -0.5, 0];
  return Array.from({ length: 3 }, () => samples).flat().map((value) => direction.map((component) => component * value * distance));
}
async function load(page, data) {
  const result = await page.evaluate((fixture) => window.__jot2dTest.loadDocumentFixtureForDragTest(fixture), data);
  expect(result.success, JSON.stringify(result)).toBe(true);
  return page.evaluate(() => window.__jot2dTest.constraintStatusesForTest());
}
async function drag(page, descriptor, path) {
  return page.evaluate(({ descriptor, path }) => window.__jot2dTest.geometryDragPathForTest({ ...descriptor, inspectConstraints: true }, path), { descriptor, path });
}
function verify(result, initial, label, failures) {
  if (!result?.sessionAvailable || !result.final?.success) { failures.push(`${label}: unavailable or final failure`); return; }
  if (result.final.baseErrorNorm > 1e-4) failures.push(`${label}: final residual ${result.final.baseErrorNorm}`);
  for (const [index, preview] of result.previews.entries()) {
    if (!preview.success || preview.blocked || !Number.isFinite(preview.errorNorm) || preview.errorNorm > preview.acceptError + 1e-9 || preview.constraintState.errorNorm > 1e-4) failures.push(`${label}#${index}: preview residual ${preview.errorNorm}`);
    if (!preview.constraintState.stable || preview.constraintState.freeDof !== initial.freeDof) failures.push(`${label}#${index}: unstable rank ${preview.constraintState.freeDof}/${initial.freeDof}`);
    const statuses = new Map(preview.constraintState.items.map((item) => [item.id, item.status]));
    for (const item of initial.items) if (statuses.get(item.id) !== item.status) failures.push(`${label}#${index}: ${item.id} ${item.status}->${statuses.get(item.id)}`);
  }
}

test('collapsed fillets follow every line at three grab positions through repeated slow and fast reversals', async ({ page }) => {
  test.setTimeout(180000);
  await openTestDocument(page);
  const failures = [];
  let maximumMs = 0, previews = 0;
  for (const line of fillets.lines) for (const fraction of [0.2, 0.5, 0.8]) for (const [directionIndex, direction] of directions.entries()) for (const fast of [false, true]) {
    const initial = await load(page, fillets);
    const path = repeatedPath(direction, fast, fast ? 40 : 10);
    const result = await drag(page, { kind: 'line', id: line.id, fraction }, path);
    const label = `${line.id}/${fraction}/${directionIndex}/${fast}`;
    verify(result, initial, label, failures);
    for (const [index, preview] of result.previews.entries()) {
      const expected = { x: result.startState.midpoint.x + path[index][0], y: result.startState.midpoint.y + path[index][1] };
      const error = Math.hypot(preview.state.midpoint.x - expected.x, preview.state.midpoint.y - expected.y);
      if (error > 0.01) failures.push(`${label}#${index}: pointer lag ${error}`);
      maximumMs = Math.max(maximumMs, preview.elapsedMs); previews++;
    }
  }
  expect(previews).toBeGreaterThan(0);
  console.log(JSON.stringify({ fixture: 'fillets', previews, maximumMs, failures: failures.slice(0, 30) }));
  if (failures.length) await test.info().attach("failures", { body: JSON.stringify(failures), contentType: "application/json" });
  expect(failures.length, JSON.stringify(failures.slice(0, 30))).toBe(0);
});

test('tangent offset chains keep their degrees of freedom and colors across multiple geometry drags', async ({ page }) => {
  test.setTimeout(600000);
  await openTestDocument(page);
  const failures = [];
  const descriptors = [
    ...offsets.lines.map((item) => ({ kind: 'line', id: item.id })),
    ...offsets.arcs.flatMap((item) => [{ kind: 'arc', id: item.id }, { kind: 'arc-endpoint', id: item.id, endpoint: 'start' }, { kind: 'arc-endpoint', id: item.id, endpoint: 'end' }]),
    ...['P1', 'P6', 'P12', 'P18'].map((id) => ({ kind: 'point', id })),
  ];
  let maximumMs = 0, previews = 0;
  for (const descriptor of descriptors.filter((item) => !process.env.CAD_REGRESSION_TARGET || `${item.kind}:${item.id}:${item.endpoint || ""}` === process.env.CAD_REGRESSION_TARGET)) for (const [directionIndex, direction] of directions.entries()) for (const fast of [false, true]) {
    const initial = await load(page, offsets);
    const result = await drag(page, descriptor, repeatedPath(direction, fast, fast ? 10 : 2));
    verify(result, initial, `${descriptor.kind}/${descriptor.id}/${descriptor.endpoint}/${directionIndex}/${fast}`, failures);
    for (const preview of result.previews) { maximumMs = Math.max(maximumMs, preview.elapsedMs); previews++; }
  }
  expect(previews).toBeGreaterThan(0);
  console.log(JSON.stringify({ fixture: 'offsets', previews, maximumMs, failures: failures.slice(0, 30) }));
  if (failures.length) await test.info().attach("failures", { body: JSON.stringify(failures), contentType: "application/json" });
  expect(failures.length, JSON.stringify(failures.slice(0, 30))).toBe(0);
});

test('aircraft A2 and A3 respond at multiple locations without freezing or losing constraint status', async ({ page }) => {
  test.setTimeout(600000);
  await openTestDocument(page);
  const failures = [];
  let maximumMs = 0, previews = 0;
  for (const id of ['A2', 'A3']) for (const fraction of [0.2, 0.5, 0.8]) for (const [directionIndex, direction] of directions.entries()) for (const fast of [false, true]) {
    const initial = await load(page, aircraft);
    const path = repeatedPath(direction, fast, fraction === 0.2 ? (fast ? 2 : 0.5) : (fast ? 10 : 2));
    const result = await drag(page, { kind: 'arc', id, fraction }, path);
    const label = `${id}/${fraction}/${directionIndex}/${fast}`;
    verify(result, initial, label, failures);
    for (const [index, preview] of result.previews.entries()) {
      const error = id === 'A3'
        ? Math.abs(Math.hypot(preview.target.x - preview.state.center.x, preview.target.y - preview.state.center.y) - preview.state.radius)
        : Math.abs(preview.state.center.y - result.startState.center.y - path[index][1]);
      if (error > 0.03) failures.push(`${label}#${index}: pointer lag ${error}`);
      maximumMs = Math.max(maximumMs, preview.elapsedMs); previews++;
    }
  }
  expect(previews).toBeGreaterThan(0);
  console.log(JSON.stringify({ fixture: 'aircraft', previews, maximumMs, failures: failures.slice(0, 30) }));
  if (failures.length) await test.info().attach("failures", { body: JSON.stringify(failures), contentType: "application/json" });
  expect(failures.length, JSON.stringify(failures.slice(0, 30))).toBe(0);
});

test('coupled lines retain their freedoms through repeated reversals and L2 follows movable coordinates', async ({ page }) => {
  test.setTimeout(240000);
  await openTestDocument(page);
  const data = require('../fixtures/coupled-line-drag.json');
  const failures = [];
  let maximumMs = 0, previews = 0;
  for (const line of data.lines.filter((item) => !process.env.CAD_REGRESSION_TARGET || item.id === process.env.CAD_REGRESSION_TARGET)) for (const fraction of (line.id === 'L2' ? [0.1, 0.5, 0.8] : [0.5])) for (const [directionIndex, direction] of directions.entries()) for (const fast of [false, true]) {
    const initial = await load(page, data);
    const path = repeatedPath(direction, fast, fast ? 5 : 1);
    const result = await drag(page, { kind: 'line', id: line.id, fraction }, path);
    const label = [line.id, fraction, directionIndex, fast].join('/');
    verify(result, initial, label, failures);
    for (const [index, preview] of result.previews.entries()) {
      if (line.id === 'L2') {
        const error = Math.hypot(preview.state.p2.x - result.startState.p2.x - path[index][0], preview.state.p2.y - result.startState.p2.y - path[index][1]);
        if (error > 0.01) failures.push(label + '#' + index + ': movable endpoint lag ' + error);
      }
      maximumMs = Math.max(maximumMs, preview.elapsedMs); previews++;
    }
  }
  expect(previews).toBeGreaterThan(0);
  console.log(JSON.stringify({ fixture: 'coupled-lines', previews, maximumMs, failures: failures.slice(0, 30) }));
  if (failures.length) await test.info().attach('failures', { body: JSON.stringify(failures), contentType: 'application/json' });
  expect(failures.length, JSON.stringify(failures.slice(0, 30))).toBe(0);
});

for (const scenario of [
  { name: 'horizontal-line', file: 'coupled-horizontal-line-drag', id: 'L27', axis: 1 },
  { name: 'vertical-line', file: 'coupled-vertical-line-drag', id: 'L6', axis: 0 },
]) test(scenario.name + ' follows repeated pointer reversals without losing its constraint freedom', async ({ page }) => {
  test.setTimeout(240000);
  await openTestDocument(page);
  const data = require('../fixtures/' + scenario.file + '.json');
  const failures = [];
  let maximumMs = 0, previews = 0;
  for (const fraction of [0.1, 0.5, 0.8]) for (const [directionIndex, direction] of directions.entries()) for (const fast of [false, true]) {
    const initial = await load(page, data);
    const alongReportedAxis = Math.abs(direction[scenario.axis]) > 0.99;
    const path = repeatedPath(direction, fast, alongReportedAxis ? (fast ? 1 : 0.5) : (fast ? 0.25 : 0.05));
    const result = await drag(page, { kind: 'line', id: scenario.id, fraction }, path);
    const label = [scenario.id, fraction, directionIndex, fast].join('/');
    verify(result, initial, label, failures);
    for (const preview of result.previews) {
      if (alongReportedAxis) {
        const axis = scenario.axis ? 'y' : 'x';
        const lag = Math.abs(preview.state.midpoint[axis] - preview.target[axis]);
        if (lag > 0.01) failures.push(label + ': pointer lag ' + lag);
      }
      maximumMs = Math.max(maximumMs, preview.elapsedMs); previews++;
    }
  }
  expect(previews).toBeGreaterThan(0);
  console.log(JSON.stringify({ fixture: scenario.name, previews, maximumMs, failures: failures.slice(0, 30) }));
  if (failures.length) await test.info().attach('failures', { body: JSON.stringify(failures), contentType: 'application/json' });
  expect(failures.length, JSON.stringify(failures.slice(0, 30))).toBe(0);
});

test('fine pointer streams stay reversible across the three coupled-line documents', async ({ page }) => {
  test.setTimeout(240000);
  await openTestDocument(page);
  const failures = [];
  for (const [file, id, axis, distance] of [
    ['coupled-line-drag', 'L2', 0, 10],
    ['coupled-horizontal-line-drag', 'L27', 1, 1],
    ['coupled-vertical-line-drag', 'L6', 0, 1],
  ]) {
    const data = require('../fixtures/' + file + '.json');
    const initial = await load(page, data);
    const path = Array.from({ length: 3 }, () => Array.from({ length: 161 }, (_, i) => {
      const value = distance * Math.sin(i * Math.PI / 80);
      return axis ? [0, value] : [value, 0];
    })).flat();
    const result = await drag(page, { kind: 'line', id }, path);
    verify(result, initial, id + '/continuous', failures);
    const coordinate = axis ? 'y' : 'x';
    for (const [index, preview] of result.previews.entries()) {
      const lag = Math.abs(preview.state.midpoint[coordinate] - preview.target[coordinate]);
      if (lag > 0.01) failures.push(id + '/continuous#' + index + ': pointer lag ' + lag);
    }
  }
  if (failures.length) await test.info().attach('failures', { body: JSON.stringify(failures), contentType: 'application/json' });
  expect(failures.length, JSON.stringify(failures.slice(0, 30))).toBe(0);
});

for (const scenario of [
  { file: 'collapsed-fillets', kind: 'line', id: 'L1', axis: 'x', fraction: 0.3, scale: 30 },
  { file: 'tangent-offset-chain', kind: 'line', id: 'L3', axis: 'y', fraction: 0.35, scale: 12 },
  { file: 'coupled-line-drag', kind: 'line', id: 'L2', axis: 'x', fraction: 0.1, scale: 4 },
  { file: 'coupled-horizontal-line-drag', kind: 'line', id: 'L27', axis: 'y', fraction: 0.5, scale: 30 },
  { file: 'coupled-vertical-line-drag', kind: 'line', id: 'L6', axis: 'x', fraction: 0.5, scale: 30 },
  { file: 'aircraft-tangent-arcs', kind: 'arc', id: 'A2', axis: 'y', fraction: 0.5, scale: 4 },
  { file: 'aircraft-tangent-arcs', kind: 'arc', id: 'A3', axis: 'y', fraction: 0.5, scale: 4 },
]) test('native pointer reversals and undo: ' + scenario.file + '/' + scenario.id, async ({ page }) => {
  test.setTimeout(120000);
  await openTestDocument(page);
  const data = require('../fixtures/' + scenario.file + '.json');
  const start = await page.evaluate(async ({data, s}) => {
    const api = window.__jot2dTest;
    await api.importDocumentNameFixture(data, 'native-drag.jot2d');
    const model = api.serializedModelForTest();
    const points = new Map(model.points.map(p => [p.id, p]));
    const geometry = model[s.kind === 'line' ? 'lines' : 'arcs'].find(g => g.id === s.id);
    let pick;
    if (s.kind === 'line') {
      const a = points.get(geometry.p1), b = points.get(geometry.p2);
      pick = {x: a.x + (b.x - a.x) * s.fraction, y: a.y + (b.y - a.y) * s.fraction};
    } else {
      const center = points.get(geometry.center), angle = geometry.startAngle + (geometry.endAngle - geometry.startAngle) * s.fraction;
      pick = {x: center.x + geometry.radius * Math.cos(angle), y: center.y + geometry.radius * Math.sin(angle)};
    }
    api.focusWorldForTest(pick, s.scale);
    return {client: api.worldClientPositionForTest(pick), model, status: api.constraintStatusesForTest()};
  }, {data, s: scenario});
  if (!await page.evaluate(() => window.__jot2dTest.viewStateForTest().constraintStatus)) await page.click('#constraintStatusViewBtn');
  await page.mouse.move(start.client.x, start.client.y);
  await page.mouse.down();
  await page.mouse.move(start.client.x + (scenario.axis === 'x' ? 4 : 0), start.client.y + (scenario.axis === 'y' ? 4 : 0));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const selected = await page.evaluate(() => window.__jot2dTest.selectedGeometryIdsForTest());
  expect(selected[scenario.kind === 'line' ? 'lines' : 'arcs']).toEqual([scenario.id]);
  for (const amount of [8, 16, 8, 0, -8, -16, 0, 16, -16, 16, -16, 8]) {
    await page.mouse.move(start.client.x + (scenario.axis === 'x' ? amount : 0), start.client.y + (scenario.axis === 'y' ? amount : 0));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const status = await page.evaluate(() => window.__jot2dTest.constraintStatusesForTest());
    expect(status.stable).toBe(true);
    expect(status.errorNorm).toBeLessThanOrEqual(1e-4);
    expect(status.freeDof).toBe(start.status.freeDof);
    expect(status.items).toEqual(start.status.items);
  }
  await page.mouse.up();
  const after = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const geometry = model => ({points: model.points, lines: model.lines, circles: model.circles, arcs: model.arcs});
  expect(geometry(after)).not.toEqual(geometry(start.model));
  await page.screenshot({path: test.info().outputPath('native-drag.png')});
  await page.click('#undoBtn');
  expect(geometry(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(geometry(start.model));
  await page.click('#redoBtn');
  expect(geometry(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(geometry(after));
  await load(page, after);
  expect(geometry(await page.evaluate(() => window.__jot2dTest.serializedModelForTest()))).toEqual(geometry(after));
});

test('reload preserves short arc endpoints owned by fixed and offset constraints', async ({ page }) => {
  await openTestDocument(page);
  const base = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
  const sketchId = base.activeSketchId;
  for (const fixed of [false, true]) {
    const arcs = [{id: 'A1', center: 'P1', radius: 10, startAngle: 0, endAngle: 1e-8, sketchId}];
    const points = [{id: 'P1', x: 0, y: 0, fixed: false, kind: 'center', sketchId}];
    let constraints;
    if (fixed) constraints = [{type: 'geometryFixed', kind: 'arc', geometry: 'A1', x: 0, y: 0, radius: 10, startAngle: 0, endAngle: 1e-8, enabled: true, sketchId}];
    else {
      points.push({id: 'P2', x: 0, y: 0, fixed: false, kind: 'center', sketchId});
      arcs.push({...arcs[0], id: 'A2', center: 'P2', radius: 12});
      arcs.push({...arcs[0], id: 'A3', startAngle: 1e-8, endAngle: 1}, {...arcs[1], id: 'A4', startAngle: 1e-8, endAngle: 1});
      constraints = [{type: 'offsetChainDimension', sources: [{geometry: 'A1', reversed: false}, {geometry: 'A3', reversed: false}], offsets: ['A2', 'A4'], target: 2, side: -1, closed: false, joinType: 'miter', dimensionSegmentIndex: 0, parameterName: 'd1', expression: '2', enabled: true, sketchId}];
    }
    const fixture = {...base, points, arcs, lines: [], circles: [], constraints};
    await load(page, fixture);
    const saved = await page.evaluate(() => window.__jot2dTest.serializedModelForTest());
    expect(saved.arcs.map(a => a.endAngle)).toEqual(arcs.map(a => a.endAngle));
    expect((await page.evaluate(() => window.__jot2dTest.constraintStatusesForTest())).errorNorm).toBeLessThan(1e-8);
    await load(page, saved);
    expect((await page.evaluate(() => window.__jot2dTest.serializedModelForTest())).arcs).toEqual(saved.arcs);
  }
});
