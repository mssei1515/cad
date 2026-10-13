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
