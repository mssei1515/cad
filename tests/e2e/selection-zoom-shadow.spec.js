const { test, expect, openTestDocument } = require('./test-fixture');

// Reduced from the reported document: a long line in a different drawing Sketch.
const center = { x: 19056.594701920745, y: (3062.789471713771 + 32193.696606579364) / 2 };
const fixture = {
  version: 26, units: { length: 'mm' }, activeSketchId: 'S1',
  sketches: [
    { id: 'ROOT', name: 'Root Sketch', kind: 'root', parentSketchId: null },
    { id: 'S1', name: 'STA', kind: 'sketch', parentSketchId: 'ROOT' },
    { id: 'S2', name: 'Outline', kind: 'sketch', parentSketchId: 'S1' },
  ],
  points: [
    { id: 'P44', x: center.x, y: 3062.789471713771, kind: 'endpoint', sketchId: 'S2' },
    { id: 'P45', x: center.x, y: 32193.696606579364, kind: 'endpoint', sketchId: 'S2' },
  ],
  lines: [{ id: 'L22', p1: 'P44', p2: 'P45', sketchId: 'S2' }],
  constraints: [{ type: 'vertical', line: 'L22', sketchId: 'S2', enabled: true }],
  circles: [], arcs: [], splines: [], annotations: [], hatches: [], referenceImages: [],
  blockDefinitions: [], blockInstances: [], geometryInstances: [], parameters: [],
  nextHatchIndex: 1, nextDimensionParameterIndex: 1,
};

for (const dpr of [1, 2]) test.describe(`selection glow at DPR ${dpr}`, () => {
  test.use({ deviceScaleFactor: dpr });
  test('zoom keeps the glow beside L22 and preserves the document', async ({ page }) => {
    await openTestDocument(page);
    const loaded = await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data), fixture);
    expect(loaded.success, loaded.error).toBe(true);
    const model = () => page.evaluate(() => {
      const { savedAt, ...data } = window.__jot2dTest.serializedModelForTest();
      return data;
    });
    const before = await model();
    await page.evaluate(center => window.__jot2dTest.focusWorldForTest(center, 0.02), center);
    const p = await page.evaluate(center => window.__jot2dTest.worldClientPositionForTest(center), center);
    await page.mouse.click(p.x, p.y);
    await page.mouse.move(10, 10);
    await page.evaluate(() => {
      window.selectionShadowBlurs = [];
      const original = CanvasRenderingContext2D.prototype.stroke;
      CanvasRenderingContext2D.prototype.stroke = function (...args) {
        if (this.shadowBlur > 0) window.selectionShadowBlurs.push(this.shadowBlur);
        return original.apply(this, args);
      };
    });
    for (const scale of [0.003779527559, 0.02, 1, 100]) {
      await page.evaluate(({ center, scale }) => {
        window.selectionShadowBlurs.length = 0;
        window.__jot2dTest.focusWorldForTest(center, scale);
      }, { center, scale });
      const blurs = await page.evaluate(() => window.selectionShadowBlurs);
      expect(blurs.length).toBeGreaterThan(0);
      expect(blurs.every(blur => blur === 8 * dpr)).toBe(true);
      const remoteAlpha = await page.evaluate(center => {
        const canvas = document.querySelector('#canvas');
        const position = window.__jot2dTest.worldClientPositionForTest(center);
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio;
        return canvas.getContext('2d').getImageData(
          Math.round((position.x - rect.left + 60) * dpr),
          Math.round((position.y - rect.top + 100) * dpr), 1, 1).data[3];
      }, center);
      expect(remoteAlpha).toBe(0);
    }
    expect(await model()).toEqual(before);
  });
});

test('multiple retained hatch boundaries do not darken a selected line', async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => {
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      window.selectionGlowCount = 0;
      return clear.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      if (this.shadowBlur > 0) window.selectionGlowCount++;
      return stroke.apply(this, args);
    };
  });
  const pixels = [];
  for (const count of [0, 12]) {
    const hatches = Array.from({ length: count }, (_, i) => ({
      id: `H${i + 1}`, sketchId: 'S2', drawingOrder: i, seed: { x: 0, y: 0 },
      boundaryLoops: [{ role: 'outer', spans: ['L22', 'missing'].map(id => ({
        source: { kind: 'line', path: [id] }, start: { type: 'endpoint', name: 'p1' },
        end: { type: 'endpoint', name: 'p2' }, reversed: false, fullCircle: false, fullLoop: false,
      })) }], appearance: { visible: true, patternType: 'solid', angle: 45, spacing: 3, color: '#374151', lineWidth: 1, opacity: 0.5 },
    }));
    const loaded = await page.evaluate(data => window.__jot2dTest.loadDocumentFixtureForDragTest(data),
      { ...fixture, hatches, nextHatchIndex: count + 1 });
    expect(loaded.success, loaded.error).toBe(true);
    await page.evaluate(center => window.__jot2dTest.focusWorldForTest(center, 0.02), center);
    const p = await page.evaluate(center => window.__jot2dTest.worldClientPositionForTest(center), center);
    await page.mouse.click(p.x, p.y);
    await page.mouse.move(10, 10);
    await page.evaluate(center => window.__jot2dTest.focusWorldForTest(center, 0.02), center);
    const rendered = await page.evaluate(center => {
      const canvas = document.querySelector('#canvas'), rect = canvas.getBoundingClientRect();
      const p = window.__jot2dTest.worldClientPositionForTest(center);
      return { count: window.selectionGlowCount, pixels: [...canvas.getContext('2d').getImageData(
        Math.round(p.x - rect.left + 3), Math.round(p.y - rect.top + 80), 12, 1).data] };
    }, center);
    expect(rendered.count).toBe(1);
    pixels.push(rendered.pixels);
  }
  expect(pixels[1]).toEqual(pixels[0]);
});
