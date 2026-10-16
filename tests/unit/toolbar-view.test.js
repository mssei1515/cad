const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/ui/toolbar_view.js','utf8'),sandbox);
const modeButtons = { select:'toolSelect',point:'toolPoint',line:'toolLine',centerline:'toolCenterline','circle-center-cross':'toolCircleCenterCross',rectangle:'toolRectangle',slot:'toolSlot',fillet:'toolFillet',trim:'toolTrim',offset:'toolOffset',circle:'toolCircle',arc:'toolArc','three-point-arc':'toolThreePointArc',spline:'toolSpline','sketch-projection':'toolSketchProjection','pattern-placement-origin':'toolPattern','pattern-placement-place':'toolPattern',hatch:'toolHatch','hatch-repair':'toolHatch' };

function iconFixture() {
 const calls = [], nodes = new Map(), types = Object.fromEntries(['LineFixedConstraint', 'ArcEndpointFixedConstraint', 'GeometryFixedConstraint',
  'SketchProjectionConstraint', 'ParallelLinesCenterlineConstraint', 'PointPairCenterlineConstraint'].map(name => [name, class {}]));
 const document = { querySelector(selector) { assert.equal(this, document); calls.push(['dom', selector]); return nodes.get(selector) || null; } };
 const api = sandbox.window.ToolbarView.createIcons({ document, types,
  isDimensionConstraint: constraint => { calls.push(['dimension', constraint]); return Boolean(constraint?.dimension); } });
 function add(selector, markup = '<svg viewBox="0 0 10 10"><path /></svg>') {
  const svg = { outerHTML: markup }, button = { querySelector(name) { assert.equal(this, button); assert.equal(name, 'svg'); return svg; } };
  nodes.set(selector, button); return svg;
 }
 return { api, calls, nodes, types, add };
}

test('toolbar SVG reads current DOM, preserves markup and returns empty text for missing buttons or SVG', () => {
 const f = iconFixture(); assert.deepEqual(f.calls, []);
 assert.equal(f.api.toolbarSvgMarkup('#toolLine'), '');
 f.nodes.set('#toolLine', { querySelector: () => null }); assert.equal(f.api.toolbarSvgMarkup('#toolLine'), '');
 const svg = f.add('#toolLine'), original = svg.outerHTML;
 assert.equal(f.api.toolbarSvgMarkup('#toolLine'), '<svg class="sketch-object-icon" viewBox="0 0 10 10"><path /></svg>');
 assert.equal(svg.outerHTML, original);
 f.add('#toolLine', '<svg data-current="yes"></svg>');
 assert.equal(f.api.toolbarSvgMarkup('#toolLine'), '<svg class="sketch-object-icon" data-current="yes"></svg>');
});

test('constraint icons retain fixed, projection, centerline and dimension priority before name matching', () => {
 const f = iconFixture();
 for (const selector of ['#fixPointBtn', '#toolSketchProjection', '#toolCenterline', '[data-constraint="distance"]']) f.add(selector);
 const cases = [ ['LineFixedConstraint', '#fixPointBtn'], ['ArcEndpointFixedConstraint', '#fixPointBtn'], ['GeometryFixedConstraint', '#fixPointBtn'],
  ['SketchProjectionConstraint', '#toolSketchProjection'], ['ParallelLinesCenterlineConstraint', '#toolCenterline'], ['PointPairCenterlineConstraint', '#toolCenterline'] ];
 for (const [kind, selector] of cases) {
  f.calls.length = 0; const constraint = Object.assign(new f.types[kind](), { name: '水平', dimension: true });
  assert.notEqual(f.api.constraintToolbarIcon(constraint), ''); assert.deepEqual(f.calls, [['dom', selector]]);
 }
 f.calls.length = 0; f.api.constraintToolbarIcon(new f.types.SketchProjectionConstraint(), true);
 assert.deepEqual(f.calls, [['dom', '#fixPointBtn']]);
 f.calls.length = 0; const dimension = { name: '水平', dimension: true }; f.api.constraintToolbarIcon(dimension);
 assert.deepEqual(f.calls, [['dimension', dimension], ['dom', '[data-constraint="distance"]']]);
});

test('constraint icons keep ordered name matching and coincident fallback for unknown or absent constraints', () => {
 const f = iconFixture(), cases = [['水平', 'horizontal'], ['垂直', 'vertical'], ['平行', 'parallel'], ['直角', 'perpendicular'],
  ['対称', 'symmetry'], ['同心', 'concentric'], ['等寸', 'equal'], ['接線', 'tangent'], ['一致', 'coincident'], ['円周', 'coincident'],
  ['平行 水平', 'horizontal'], ['unknown', 'coincident'], [45, 'coincident']];
 for (const [name, type] of cases) {
  f.calls.length = 0; f.api.constraintToolbarIcon({ name }); assert.equal(f.calls.at(-1)[1], `[data-constraint="${type}"]`);
 }
 for (const constraint of [null, undefined, {}]) { f.calls.length = 0; assert.equal(f.api.constraintToolbarIcon(constraint), '');
  assert.equal(f.calls.at(-1)[1], '[data-constraint="coincident"]'); }
});

function statusFixture() {
 const state = { node: { textContent: '' }, mode: 'line', pending: null, constraint: null, english: false }, reads = [], translations = [];
 const view = sandbox.window.ToolbarView.createCommandStatus({ document: { getElementById(id) { assert.equal(id, 'statusCommand'); reads.push('dom'); return state.node; } },
  applicationText: (ja, en) => { translations.push([ja, en]); return state.english ? en : ja; },
  readMode: () => { reads.push('mode'); return state.mode; }, readPendingType: () => { reads.push('pending'); return state.pending; },
  readConstraintCommand: () => { reads.push('constraint'); return state.constraint; } });
 return { view, state, reads, translations };
}

test('command status preserves annotation then constraint then mode priority and short circuits lower-priority reads', () => {
 const f = statusFixture(); assert.deepEqual(f.reads, []); assert.deepEqual(f.translations, []);
 f.state.pending = 'annotation-text-place'; f.state.constraint = {};
 f.view.update(); assert.equal(f.state.node.textContent, '注記'); assert.deepEqual(f.reads, ['dom', 'pending']);
 f.reads.length = 0; f.state.pending = 'distance-value'; f.view.update();
 assert.equal(f.state.node.textContent, '拘束'); assert.deepEqual(f.reads, ['dom', 'pending', 'constraint']);
 f.reads.length = 0; f.state.constraint = null; f.view.update();
 assert.equal(f.state.node.textContent, '線'); assert.deepEqual(f.reads, ['dom', 'pending', 'constraint', 'mode']);
 f.state.english = true; f.state.pending = 'annotation-leader-point'; f.view.update(); assert.equal(f.state.node.textContent, 'Annotation');
});

test('command status keeps every existing localized mode label and raw fallback using the current language', () => {
 const f = statusFixture(), labels = [
  ['pattern-placement-origin', '配置基準点', 'Placement anchor'], ['pattern-placement-place', '直線パターン', 'Linear Pattern'],
  ['pattern-placement-mirror', 'ミラー', 'Mirror'], ['pattern-placement-circular', '円形パターン', 'Circular Pattern'],
  ['select', '選択', 'Select'], ['point', '点', 'Point'], ['line', '線', 'Line'], ['centerline', '中心線', 'Centerline'],
  ['circle-center-cross', '円中心十字線', 'Circle Center Cross'], ['rectangle', '矩形', 'Rectangle'], ['slot', '長穴', 'Slot'],
  ['circle', '円', 'Circle'], ['arc', '円弧', 'Arc'], ['three-point-arc', '3点円弧', 'Three-point Arc'], ['spline', 'スプライン', 'Spline'],
  ['fillet', 'R面取り', 'Fillet'], ['trim', 'トリム', 'Trim'], ['offset', 'オフセット', 'Offset'], ['hatch', '塗りつぶし', 'Fill'],
  ['hatch-repair', '境界を再指定', 'Reselect boundary'], ['block-place', 'ブロック配置', 'Block placement'],
 ];
 for (const [mode, ja, en] of labels) { f.state.mode = mode; f.state.english = false; f.view.update(); assert.equal(f.state.node.textContent, ja);
  f.state.english = true; f.view.update(); assert.equal(f.state.node.textContent, en); }
 for (const mode of ['sketch-projection', 'future-mode', '']) { f.state.mode = mode; f.view.update(); assert.equal(f.state.node.textContent, mode); }
 f.state.constraint = {}; f.view.update(); assert.equal(f.state.node.textContent, 'Constraint');
});

test('command status resolves replacement DOM on each update and skips interaction reads when the status node is absent', () => {
 const f = statusFixture(), previous = f.state.node;
 f.state.node = null; f.view.update(); assert.deepEqual(f.reads, ['dom']); assert.equal(f.translations.length, 21);
 f.state.node = { textContent: '' }; f.state.mode = 'arc'; f.view.update();
 assert.equal(f.state.node.textContent, '円弧'); assert.equal(previous.textContent, '');
});

function bindingSurface(ids) {
 const nodes=new Map(ids.map(id=>{const listeners=new Set();const node={listeners,
  addEventListener(type,handler){assert.equal(type,'click');listeners.add(handler);},
  removeEventListener(type,handler){assert.equal(type,'click');listeners.delete(handler);},
  click(){for(const handler of listeners)handler.call(node);}};return [id,node];}));
 return {nodes,document:{getElementById:id=>nodes.get(id)||null}};
}
test('drawing tool binding preserves live lifecycle receiver, raw handlers and registration lifetime',()=>{
 const f=bindingSurface(['toolSelect','toolPoint','toolLine','toolCircle','toolArc','toolMirror','toolConstructionLine','toolFillet','toolHatch']);
 const calls=[];
 const lifecycle={start(mode){assert.equal(this,lifecycle);calls.push(['mode',mode]);}};
 const construction={toggle(){assert.equal(this,f.nodes.get('toolConstructionLine'));calls.push(['construction']);}};
 const fillet={begin(){assert.equal(this,f.nodes.get('toolFillet'));calls.push(['fillet']);}};
 const hatch=()=>calls.push(['hatch']);
 const binding=sandbox.window.ToolbarView.createBinding({document:f.document,drawOperationLifecycle:lifecycle,constructionCommand:construction,filletCommand:fillet,
  startGeometryInstanceCommand:type=>calls.push(['instance',type]),startHatchCreation:hatch});
 binding.bind();binding.bind();assert.equal(f.nodes.get('toolLine').listeners.size,1);
 assert.equal([...f.nodes.get('toolFillet').listeners][0],fillet.begin);
 assert.equal([...f.nodes.get('toolHatch').listeners][0],hatch);
 f.nodes.get('toolLine').click();f.nodes.get('toolMirror').click();f.nodes.get('toolConstructionLine').click();f.nodes.get('toolFillet').click();f.nodes.get('toolHatch').click();
 assert.deepEqual(calls,[['mode','line'],['instance','mirror'],['construction'],['fillet'],['hatch']]);
 lifecycle.start=function(mode){assert.equal(this,lifecycle);calls.push(['updated',mode]);};f.nodes.get('toolPoint').click();
 assert.deepEqual(calls.at(-1),['updated','point']);
 binding.dispose();for(const node of f.nodes.values())assert.equal(node.listeners.size,0);
 binding.bind();f.nodes.get('toolLine').click();assert.deepEqual(calls.at(-1),['updated','line']);binding.dispose();
});
test('absent optional tools skip handler lookup while mandatory drawing controls remain required',()=>{
 const f=bindingSurface(['toolSelect','toolPoint','toolLine','toolCircle','toolArc']);
 const unavailable=new Proxy({}, {get(){throw new Error('absent optional tool must not read a command handler');}});
 const binding=sandbox.window.ToolbarView.createBinding({document:f.document,drawOperationLifecycle:{start(){}},
  constructionCommand:unavailable,filletCommand:unavailable,offsetCommand:unavailable});
 binding.bind();assert.equal(f.nodes.get('toolLine').listeners.size,1);binding.dispose();
 assert.throws(()=>sandbox.window.ToolbarView.createBinding({document:{getElementById:()=>null}}).bind(),/addEventListener/);
});
function fixture() {
 const events=[],buttons=new Map();
 for(const id of [...new Set(Object.values(modeButtons)),'toolConstructionLine','toolCreateBlock','annotationTextBtn','selectionVisibilityBtn']) buttons.set(id,{active:false,disabled:false,attributes:{},classList:{toggle(name,value){buttons.get(id)[name]=value;}},setAttribute(name,value){this.attributes[name]=value;}});
 const state={geometry:true,construction:false,interaction:{mode:'select',hasPending:false,hasConstraint:false,annotationDraft:false,splineEditing:false},targets:[],hidden:false,editable:true};
 const view=sandbox.window.ToolbarView.create({document:{getElementById:id=>buttons.get(id)||null},
  isGeometryMode:()=>{events.push('geometry');return state.geometry;},constructionToggleState:g=>{assert.equal(g,state.geometry);events.push('construction');return {active:state.construction};},
  readInteraction:()=>{events.push('interaction');return state.interaction;},updateHistoryButtons:()=>events.push('history'),
  selectedVisibilityTargets:()=>{events.push('targets');return state.targets;},selectionVisibilityIsHidden:t=>{assert.equal(t,state.targets);events.push('hidden');return state.hidden;},
  canEditTarget:t=>{events.push(['editable',t]);return state.editable;},syncFlyouts:()=>{events.push('flyouts');if(state.afterFlyouts)state.interaction=state.afterFlyouts;},
  updateCursor:value=>{events.push('cursor');state.cursor=value;},
 });return {view,events,buttons,state};
}
test('drawing modes and pending selection states preserve active and accessibility button presentation',()=>{
 for(const [mode,id] of Object.entries(modeButtons)){
  const f=fixture();f.state.interaction.mode=mode;f.view.update();assert.equal(f.buttons.get(id).active,true,mode);assert.equal(f.buttons.get(id).attributes['aria-pressed'],'true');assert.equal(f.buttons.get(id).attributes['aria-disabled'],'false');assert.equal(f.buttons.get('toolCreateBlock').active,false);
 }
 const f=fixture();f.state.interaction.hasPending=true;f.view.update();assert.equal(f.buttons.get('toolSelect').active,false);
 f.state.interaction.hasPending=false;f.state.interaction.hasConstraint=true;f.view.update();assert.equal(f.buttons.get('toolSelect').active,false);
});
test('non-geometry mode disables drawing presentation while retaining explicit annotation and construction states',()=>{
 const f=fixture();f.state.geometry=false;f.state.interaction.mode='line';f.state.interaction.annotationDraft=true;f.state.construction=true;f.view.update();
 assert.equal(f.buttons.get('toolLine').active,false);assert.equal(f.buttons.get('toolLine').attributes['aria-disabled'],'true');assert.equal(f.buttons.get('toolCreateBlock').disabled,true);
 assert.equal(f.buttons.get('annotationTextBtn').active,true);assert.equal(f.buttons.get('toolConstructionLine').active,true);
});
test('visibility presentation uses hidden status and permits sketch targets without object permission queries',()=>{
 const f=fixture(),sketch=Object.freeze({kind:'sketch',item:Object.freeze({visible:false})});f.state.targets=[sketch];f.state.hidden=true;f.state.editable=false;f.view.update();
 assert.equal(f.buttons.get('selectionVisibilityBtn').disabled,false);assert.equal(f.buttons.get('selectionVisibilityBtn').active,true);assert.equal(f.events.some(e=>Array.isArray(e)),false);
 const target=Object.freeze({kind:'constraint',item:Object.freeze({})});f.events.length=0;f.state.targets=[sketch,target];f.view.update();assert.equal(f.buttons.get('selectionVisibilityBtn').disabled,true);
 assert.equal(f.events.find(e=>Array.isArray(e))[1],target);
});
test('visibility disabling short-circuits permissions for empty targets and non-geometry mode',()=>{
 const f=fixture();f.view.update();assert.equal(f.buttons.get('selectionVisibilityBtn').disabled,true);assert.equal(f.events.some(e=>Array.isArray(e)),false);
 f.events.length=0;f.state.geometry=false;f.state.targets=[{kind:'geometry'}];f.view.update();assert.equal(f.events.some(e=>Array.isArray(e)),false);assert.ok(f.events.includes('hidden'));
});
test('history, selection visibility, flyouts and cursor update order preserves latest interaction for cursor',()=>{
 const f=fixture();f.state.afterFlyouts={mode:'spline',pendingType:'distance-value',constraintType:'distance',splineEditing:true};f.view.update();
 assert.deepEqual(f.events,['geometry','construction','interaction','history','targets','hidden','flyouts','interaction','cursor']);
 assert.equal(f.buttons.get('toolSelect').active,true);assert.equal(f.state.cursor.mode,'spline');assert.equal(f.state.cursor.pendingType,'distance-value');assert.equal(f.state.cursor.splineEditing,true);
});
test('missing toolbar elements are skipped while history and cursor remain synchronized',()=>{
 const f=fixture();f.buttons.clear();f.state.targets=[{kind:'geometry'}];assert.doesNotThrow(()=>f.view.update());
 assert.deepEqual(f.events,['geometry','construction','interaction','history','targets','flyouts','interaction','cursor']);
});


test('editing controls retain native handler receivers and current annotation command', () => {
 const f=bindingSurface(['undoBtn','redoBtn','selectionVisibilityBtn','deleteSelectionBtn','annotationTextBtn']),events=[];
 function undo(){assert.equal(this,f.nodes.get('undoBtn'));events.push('undo');}
 function redo(){assert.equal(this,f.nodes.get('redoBtn'));events.push('redo');}
 function toggleVisibility(){assert.equal(this,f.nodes.get('selectionVisibilityBtn'));events.push('visibility');}
 const annotation={start(){assert.equal(this,annotation);events.push('annotation');}};
 const binding=sandbox.window.ToolbarView.createEditingBinding({document:f.document,undo,redo,toggleVisibility,annotation,
  isGeometryMode:()=>true,deleteSelection:()=>false,updateUI:()=>events.push('ui'),draw:()=>events.push('draw')});
 assert.deepEqual(events,[]);binding.bind();binding.bind();
 f.nodes.get('undoBtn').click();f.nodes.get('redoBtn').click();f.nodes.get('selectionVisibilityBtn').click();f.nodes.get('annotationTextBtn').click();
 assert.deepEqual(events,['undo','redo','visibility','annotation']);
 annotation.start=function(){assert.equal(this,annotation);events.push('updated annotation');};f.nodes.get('annotationTextBtn').click();
 assert.equal(events.at(-1),'updated annotation');
 assert.equal([...f.nodes.get('undoBtn').listeners][0],undo);
 binding.dispose();for(const node of f.nodes.values())assert.equal(node.listeners.size,0);
 binding.bind();f.nodes.get('undoBtn').click();assert.equal(events.at(-1),'undo');binding.dispose();
});

test('toolbar delete preserves mode short circuit and refreshes only after successful deletion in order', () => {
 const f=bindingSurface(['deleteSelectionBtn']),events=[],state={geometry:false,removed:false};
 const binding=sandbox.window.ToolbarView.createEditingBinding({document:f.document,
  isGeometryMode:()=>{events.push('mode');return state.geometry;},
  deleteSelection:()=>{events.push('remove');return state.removed;},
  updateUI:()=>events.push('ui'),draw:()=>events.push('draw')});binding.bind();
 f.nodes.get('deleteSelectionBtn').click();assert.deepEqual(events,['mode']);
 events.length=0;state.geometry=true;f.nodes.get('deleteSelectionBtn').click();assert.deepEqual(events,['mode','remove']);
 events.length=0;state.removed=true;f.nodes.get('deleteSelectionBtn').click();assert.deepEqual(events,['mode','remove','ui','draw']);
 binding.dispose();
});

test('editing bindings permit absent controls and remove only their own listeners', () => {
 const f=bindingSurface(['undoBtn']),events=[];const external=()=>events.push('external');
 f.nodes.get('undoBtn').addEventListener('click',external);
 const binding=sandbox.window.ToolbarView.createEditingBinding({document:f.document,undo:()=>events.push('undo')});
 binding.bind();binding.bind();f.nodes.get('undoBtn').click();assert.deepEqual(events,['external','undo']);
 binding.dispose();events.length=0;f.nodes.get('undoBtn').click();assert.deepEqual(events,['external']);
 binding.bind();assert.equal(f.nodes.get('undoBtn').listeners.size,2);binding.dispose();
 sandbox.window.ToolbarView.createEditingBinding({document:{getElementById:()=>null}}).bind();
});
