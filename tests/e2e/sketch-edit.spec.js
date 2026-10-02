const { test, expect, openTestDocument } = require('./test-fixture');
test('selected row exposes Edit while the editing marker remains independent; all editing routes agree', async ({ page }) => {
  await openTestDocument(page);
  await page.evaluate(() => window.__jot2dTest.resetForHatchTest());
  await page.locator('#addSketchBtn').click();
  const source = page.locator('.sketch-item[data-id="S1"]');
  const other = page.locator('.sketch-item[data-id="S2"]');
  await source.locator('.sketchActivateBtn').click();
  await expect(source).toHaveClass(/selected/); await expect(source).not.toHaveClass(/active/);
  await expect(source.locator('.sketchEditBtn')).toBeVisible();
  await expect(other.locator('.sketchEditBtn')).toBeHidden();
  await expect(other.locator('.sketch-active-label')).toHaveText('編集中');
  await expect(other.locator('.sketch-active-label svg')).toBeVisible();
  await source.locator('.sketchEditBtn').click();
  await expect(source).toHaveClass(/active/); await expect(source).toHaveClass(/selected/);
  await expect(source.locator('.sketchEditBtn')).toBeDisabled();
  await expect(other.locator('.sketch-active-label')).toHaveCount(0);
  await other.locator('.sketchActivateBtn').dblclick();
  await expect(other).toHaveClass(/active/);
  await source.locator('.sketchActivateBtn').click({ button: 'right' });
  await expect(page.locator('#sketchContextMenu')).toBeVisible();
  await expect(source).toHaveClass(/selected/); await expect(other).toHaveClass(/active/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#sketchContextMenu')).toBeHidden();
  await expect(source).toHaveClass(/selected/);
  await source.locator('.sketchActivateBtn').click({ button: 'right' });
  await page.locator('#sketchContextMenu [data-context-action="sketch-edit"]').click();
  await expect(source).toHaveClass(/active/);
  await expect(page.locator('#sketchContextMenu')).toBeHidden();
  await other.locator('.sketchActivateBtn').focus(); await page.keyboard.press('Alt+Enter');
  await expect(other).toHaveClass(/active/);
});

test('inactive Sketch hover exposes Edit without selecting or activating the row',async({page})=>{
 await openTestDocument(page);await page.evaluate(()=>window.__jot2dTest.resetForHatchTest());await page.locator('#addSketchBtn').click();
 const source=page.locator('.sketch-item[data-id="S1"]'),active=page.locator('.sketch-item[data-id="S2"]');
 await page.mouse.move(900,800);await expect(source.locator('.sketchEditBtn')).toBeHidden();
 await source.locator('.sketchActivateBtn').hover();await expect(source.locator('.sketchEditBtn')).toBeVisible();
 await expect(source).not.toHaveClass(/selected/);await expect(active).toHaveClass(/active/);
 await page.mouse.move(900,800);await expect(source.locator('.sketchEditBtn')).toBeHidden();
 await source.locator('.sketchActivateBtn').focus();await expect(source.locator('.sketchEditBtn')).toBeVisible();
 await source.locator('.sketchActivateBtn').hover();await source.locator('.sketchEditBtn').click();
 await expect(source).toHaveClass(/active/);await expect(source).toHaveClass(/selected/);
 await active.locator('.sketchActivateBtn').hover();await expect(active.locator('.sketchEditBtn')).toBeVisible();
 await source.locator('.sketchActivateBtn').hover();await expect(source.locator('.sketchEditBtn')).toBeDisabled();
});

test('active Sketch row and name keep their backgrounds on hover regardless of selection',async({page})=>{
 await openTestDocument(page);await page.evaluate(()=>window.__jot2dTest.resetForHatchTest());await page.locator('#addSketchBtn').click();
 const source=page.locator('.sketch-item[data-id="S1"]'),active=page.locator('.sketch-item[data-id="S2"]');
 const backgrounds=()=>active.evaluate(row=>({row:getComputedStyle(row).backgroundColor,name:getComputedStyle(row.querySelector('.sketchActivateBtn')).backgroundColor}));
 for(const selected of [true,false]){
  if(selected)await active.locator('.sketchActivateBtn').click();else await source.locator('.sketchActivateBtn').click();
  await page.mouse.move(900,800);const before=await backgrounds();
  await active.locator('.sketchActivateBtn').hover();expect(await backgrounds()).toEqual(before);
  await expect(active).toHaveClass(/active/);
 }
 await source.locator('.sketchActivateBtn').hover();await expect(source.locator('.sketchEditBtn')).toBeVisible();
});
