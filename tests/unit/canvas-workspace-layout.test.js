const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/canvas_workspace_layout.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], attributes = {}, classes = new Set();
  const state = { rect: { width: 200, height: 100 }, pending: false, language: 'ja', workspace: true, button: true, center: { x: 10, y: 15 }, onDraw: () => {} };
  const browser = new EventTarget(), button = new EventTarget();
  button.setAttribute = (name, value) => { attributes[name] = value; };
  state.panel = { scrollTop: 55 };
  const workspace = { classList: { contains: name => classes.has(name), toggle: (name, enabled) => { calls.push(['toggle', name, enabled]); enabled ? classes.add(name) : classes.delete(name); } } };
  const viewport = { x: 0, y: 0, scale: 2, update: values => { calls.push(['viewport', { ...values }]); Object.assign(viewport, values); } };
  const layout = sandbox.window.CanvasWorkspaceLayout.create({
    window: browser, updatePropertiesUI: () => { calls.push(["properties"]); state.onProperties?.(); }, setHint: message => calls.push(["hint", message]),
    closeContextMenu: () => { calls.push(["closeMenu"]); state.onClose?.(); },
    canvas: { getBoundingClientRect: () => state.rect }, document: { querySelector: () => state.workspace ? workspace : null, getElementById: id => id === "propertiesPanel" ? state.panel : state.button ? button : null }, viewport,
    syncCanvasBitmapSize: (width, height) => calls.push(['bitmap', width, height]), applySketchTreeWidth: () => calls.push(['tree']),
    draw: () => { calls.push(['draw']); state.onDraw(); }, isValueInputPending: () => { calls.push(['pending']); return state.pending; }, syncDimensionValueInput: () => calls.push(['input']),
    currentCanvasCenterWorld: () => { calls.push(['center']); return state.center; }, applicationText: (ja, en) => state.language === 'en' ? en : ja, readLanguage: () => state.language,
  });
  return { layout, state, calls, viewport, attributes, classes, button, browser };
}
test('resize preserves the requested world center and reads pending state after drawing', () => {
  const f = fixture(); f.state.onDraw = () => { f.state.pending = true; };
  f.layout.resizeCanvas({ centerWorld: f.state.center });
  assert.deepEqual(f.calls.map(call => call[0]), ['bitmap', 'viewport', 'viewport', 'tree', 'draw', 'pending', 'input']);
  assert.equal(f.viewport.x, 80); assert.equal(f.viewport.y, 20);
  assert.deepEqual(f.calls[0], ['bitmap', 200, 100]);
});
test('empty bounds or no requested center preserve viewport while synchronizing the display', () => {
  const f = fixture(); f.viewport.x = 12; f.viewport.y = 13; f.state.rect.width = 0;
  f.layout.resizeCanvas({ centerWorld: f.state.center }); assert.equal(f.viewport.x, 12); assert.equal(f.viewport.y, 13);
  assert.deepEqual(f.calls.map(call => call[0]), ['bitmap', 'tree', 'draw', 'pending']);
  f.calls.length = 0; f.state.rect.width = 200; f.layout.resizeCanvas(); assert.equal(f.viewport.x, 12); assert.equal(f.viewport.y, 13);
});
test('panel collapse captures the center before changing DOM and updates current-language labels', () => {
  const f = fixture(); f.layout.setPropertiesPanelCollapsed(true);
  assert.deepEqual(f.calls.slice(0, 2).map(call => call[0]), ['center', 'toggle']); assert.ok(f.classes.has('properties-collapsed'));
  assert.equal(f.attributes['aria-expanded'], 'false'); assert.equal(f.attributes['aria-label'], 'プロパティを展開'); assert.equal(f.button.title, f.attributes['aria-label']);
  f.state.language = 'en'; f.calls.length = 0; f.layout.setPropertiesPanelCollapsed(false);
  assert.equal(f.attributes['aria-expanded'], 'true'); assert.equal(f.attributes['aria-label'], 'Collapse Properties'); assert.ok(!f.classes.has('properties-collapsed'));
  assert.equal(f.viewport.x, 80); assert.equal(f.viewport.y, 20);
});
test('missing panel or toggle button leaves DOM and Canvas unchanged', () => {
  const f = fixture(); f.state.workspace = false; f.layout.setPropertiesPanelCollapsed(true); assert.equal(f.calls.length, 0);
  f.state.workspace = true; f.state.button = false; f.layout.setPropertiesPanelCollapsed(false); assert.equal(f.calls.length, 0); assert.deepEqual(f.attributes, {});
});


test('showing selected Properties expands first and reads the panel again after refreshing its contents',()=>{
 const f=fixture(),prior=f.state.panel;f.classes.add('properties-collapsed');f.state.language='en';
 f.state.onProperties=()=>{f.state.panel={set scrollTop(value){f.calls.push(['scroll',value]);}};};
 f.layout.showSelectedObjectProperties();assert.equal(f.classes.has('properties-collapsed'),false);
 assert.deepEqual(f.calls.slice(-3),[['properties'],['scroll',0],['hint','Select an object to display its properties.']]);
 assert.ok(f.calls.findIndex(call=>call[0]==='draw')<f.calls.findIndex(call=>call[0]==='properties'));
 assert.equal(prior.scrollTop,55);assert.equal(f.viewport.x,80);assert.equal(f.viewport.y,20);
});

test('layout bindings use live collapse state and retain world center after closing context menu on resize',()=>{
 const f=fixture();assert.deepEqual(f.calls,[]);f.layout.bindControls();f.layout.bindControls();f.layout.bindWindow();f.layout.bindWindow();
 f.button.dispatchEvent(new Event('click'));assert.equal(f.classes.has('properties-collapsed'),true);assert.equal(f.calls.filter(call=>call[0]==='center').length,1);
 f.button.dispatchEvent(new Event('click'));assert.equal(f.classes.has('properties-collapsed'),false);
 f.calls.length=0;f.state.onClose=()=>{f.state.center={x:20,y:25};};f.browser.dispatchEvent(new Event('resize'));
 assert.deepEqual(f.calls.slice(0,2),[['closeMenu'],['center']]);assert.equal(f.viewport.x,60);assert.equal(f.viewport.y,0);f.layout.dispose();
});

test('layout disposal preserves external listeners and missing DOM retains existing Properties feedback',()=>{
 const f=fixture();let external=0;f.browser.addEventListener('resize',()=>external++);f.layout.bindControls();f.layout.bindWindow();f.layout.dispose();
 f.button.dispatchEvent(new Event('click'));f.browser.dispatchEvent(new Event('resize'));assert.deepEqual(f.calls,[]);assert.equal(external,1);
 f.layout.bindControls();f.layout.bindWindow();f.button.dispatchEvent(new Event('click'));assert.equal(f.calls.filter(call=>call[0]==='center').length,1);f.layout.dispose();f.layout.dispose();
 f.calls.length=0;f.state.workspace=false;f.state.button=false;f.state.panel=null;f.layout.bindControls();f.layout.showSelectedObjectProperties();
 assert.deepEqual(f.calls,[['properties'],['hint','選択したオブジェクトのプロパティを表示します。']]);f.layout.dispose();
});
