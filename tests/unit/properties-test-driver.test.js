const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const test=require('node:test');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('src/testing/properties_test_driver.js','utf8'),sandbox);
function fixture(){
 const events=[],state={target:null,normalized:null,fail:false};
 const action=sandbox.window.PropertiesTestDriver.createAppearanceAction({
  appearanceSelectionTarget:()=>{events.push('target');return state.target;},
  normalizeAppearance:value=>{events.push('normalize');state.input=value;if(state.fail)throw Error('normalization');return state.normalized={...value,normalized:true};},
  invalidateBlockProjectionCache:id=>events.push(['invalidate',id]),
  updatePropertiesUI:()=>{assert.equal(state.target.item[state.target.key],state.normalized);events.push('properties');},
  draw:()=>events.push('draw'),recordHistory:label=>events.push(['history',label]),
 });return{action,state,events};
}
test('test appearance action reads the current target and does nothing when selection has no single target',()=>{
 const f=fixture();assert.deepEqual(f.events,[]);assert.equal(f.action.set({color:'red'}),false);assert.deepEqual(f.events,['target']);
 const prior={color:'blue',lineWidth:2},patch={color:'red'},item={appearance:prior};f.state.target={kind:'geometry',item,key:'appearance'};f.events.length=0;
 assert.equal(f.action.set(patch),true);assert.equal(item.appearance,f.state.normalized);assert.equal(f.state.input.lineWidth,2);assert.equal(f.state.input.color,'red');
 assert.notEqual(item.appearance,prior);assert.deepEqual(prior,{color:'blue',lineWidth:2});assert.deepEqual(patch,{color:'red'});
 assert.deepEqual(f.events,['target','normalize','properties','draw',['history','Appearance変更']]);
});
test('Block overrides invalidate the same instance before display and history while non-Block overrides do not',()=>{
 const f=fixture();for(const kind of ['blockInstance','geometryInstance']){
  const item={id:kind,appearanceOverride:{lineType:'dashed'}};f.state.target={kind,item,key:'appearanceOverride'};f.events.length=0;
  assert.equal(f.action.set({color:'red'}),true);assert.equal(item.appearanceOverride,f.state.normalized);
  assert.deepEqual(f.events,kind==='blockInstance'?['target','normalize',['invalidate',kind],'properties','draw',['history','Appearance変更']]:['target','normalize','properties','draw',['history','Appearance変更']]);
 }
});
test('normalization failure leaves the target and display untouched',()=>{
 const f=fixture(),appearance={color:'blue'};f.state.target={kind:'blockInstance',item:{id:'B1',appearance},key:'appearance'};f.state.fail=true;
 assert.throws(()=>f.action.set({color:'red'}),/normalization/);assert.equal(f.state.target.item.appearance,appearance);assert.deepEqual(f.events,['target','normalize']);
});

function browserFixture(composed=true) {
 const events=[],state={ready:false,sequence:0,model:null,history:{index:0},target:{kind:'current'},theme:'light',stored:'dark',color:'#123456',fail:null,hoverIds:[],treeIds:[],highlight:[],effective:{color:'#abcdef',lineWidth:2},disabled:'false'},marker=new Error('test support boundary');
 const ready=()=>assert.equal(state.ready,true,'no model, DOM, settings, geometry or history queries while binding or constructing');
 const event=name=>{ready();events.push(name);if(state.fail===name)throw marker;};
 class Point {constructor(id,x,y,fixed=false,kind='explicit'){Object.assign(this,{id,x,y,fixed,kind});}}
 class Line {constructor(id,p1,p2,construction=false){Object.assign(this,{id,p1,p2,construction});}length(){return Math.hypot(this.p2.x-this.p1.x,this.p2.y-this.p1.y);}}
 class Circle {constructor(id,center,radius){Object.assign(this,{id,center,radius});}}
 class Arc extends Circle {} class Spline {} class HorizontalConstraint {constructor(line){this.line=line;}}
 class DistanceConstraint {constructor(p1,p2,value){Object.assign(this,{p1,p2,value});}} class LineFixedConstraint {constructor(line){this.line=line;}}
 const w={GeometrySolver:{Point,Line,Circle,Arc,Spline,HorizontalConstraint,DistanceConstraint,LineFixedConstraint},
  SketchHierarchy:{ROOT_SKETCH_ID:'ROOT',DEFAULT_SKETCH_ID:'S1'},GeometryObjects:{geometryKeyForItem:item=>item.id}};
 const sandbox={window:w};vm.createContext(sandbox);for(const file of ['src/editing/selection.js','src/editing/canvas_hover.js','src/testing/properties_test_driver.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
 const model=()=>({points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[],blockInstances:[],sketches:[{id:'S1'}],activeSketchId:'S1'});
 state.model=model();const original=state.model,selection=w.CanvasSelection.create(),hover=w.CanvasHover.create({isEndpointPoint:()=>false});
 function addPoint(x,y,fixed,kind){'use strict';assert.equal(this,undefined);event('point');const p=new Point('P'+(++state.sequence),x,y,fixed,kind);p.sketchId=state.model.activeSketchId;state.model.points.push(p);return p;}
 function addLine(a,b,construction){'use strict';assert.equal(this,undefined);event('line');const l=new Line('L'+(++state.sequence),a,b,construction);l.sketchId=state.model.activeSketchId;state.model.lines.push(l);return l;}
 function addCircle(center,radius){'use strict';assert.equal(this,undefined);event('circle');const c=new Circle('C'+(++state.sequence),center,radius);state.model.circles.push(c);return c;}
 function addArc(center,radius,a0,a1){'use strict';assert.equal(this,undefined);event('arc');const a=new Arc('A'+(++state.sequence),center,radius);Object.assign(a,{a0,a1});state.model.arcs.push(a);return a;}
 function normalizeAppearance(value){event('normalize');return {color:'#000000',...value};}
 const defaultAppearance={get color(){ready();return state.color;}};w.Appearance={DEFAULT_APPEARANCE:defaultAppearance,normalizeAppearance};
 const canvasThemeColor=value=>{ready();return 'display:'+value;};w.CanvasThemeColors={channels(value){assert.equal(this,w.CanvasThemeColors);ready();return value;},contrast(value,bg){assert.equal(this,w.CanvasThemeColors);ready();return [value,Array.from(bg)];}};
 const settings={get theme(){ready();return state.theme;},storedTheme(){assert.equal(this,settings);ready();return state.stored;}};
 const currentScope=()=>{ready();return state.model;},readHistory=()=>{ready();return state.history;},effectiveAppearanceForElement=()=>{ready();return state.effective;};
 const document={getElementById(id){assert.equal(this,document);event('document:'+id);return{textContent:'properties panel'};}},canvas={getBoundingClientRect(){assert.equal(this,canvas);event('bounds');return{left:10,top:20,width:500,height:400};}},
  fixPointBtn={getAttribute(key){assert.equal(this,fixPointBtn);ready();assert.equal(key,'aria-disabled');return state.disabled;}};
 const queries=Object.fromEntries(['points','lines','circles','arcs','splines'].map(key=>['allGeometry'+key[0].toUpperCase()+key.slice(1),()=>{ready();return state.model[key];}]));
 const p={...queries,canvasSelection:selection,canvasHover:hover,currentScope,readHistory,selectedPropertiesTarget:()=>{ready();return state.target;},normalizeAppearance,effectiveAppearanceForElement,
  isVisibleSketchElement:()=>{ready();return true;},blockInstanceById:id=>{ready();return state.model.blockInstances.find(b=>b.id===id);},blockProjectionBundle:b=>{ready();return b.bundle;},
  appearanceSelectionTarget:selection.appearanceSelectionTarget,effectiveSelectedConstraint:selection.effectiveSelectedConstraint,
  constraintHighlightNodes:c=>{ready();return c.nodes||[];},selectionHighlight:{get current(){ready();return {elements:state.highlight};}},
  isSidebarHoveredElement:item=>{ready();return state.hoverIds.includes(item.id);},isSidebarHighlightedElement:item=>{ready();return state.treeIds.includes(item.id);},isAnyLineEndpoint:item=>{ready();return item.kind==='endpoint';},
  geometryElementKey:w.GeometryObjects.geometryKeyForItem,Point,HorizontalConstraint,DistanceConstraint,modelTypes:w.GeometrySolver,
  applicationSettings:settings,readDefaultGeometryColor:()=>defaultAppearance.color,canvasThemeColor,CanvasThemeColors:w.CanvasThemeColors,
  geometryDisplayColor:(item,appearance,selected,hovered)=>{ready();return hovered?'hover':appearance.color;},geometryStrokeWidth:(item,options={})=>{ready();return 2+(options.hovered?1:0)+(options.selected?2:0)+(options.construction?3:0);},
  resetModelState:()=>{event('reset');state.model=model();state.sequence=0;},clearSelection:()=>{event('clear');selection.clear();},addPoint,addLine,addCircle,addArc,
  ROOT_SKETCH_ID:'ROOT',rootSketchId:'ROOT',defaultSketchId:'S1',constructionAlpha:0.4,
  resetHistory:label=>{event('history:'+label);state.history={label};},updateUI:()=>event('ui'),updatePropertiesUI:()=>event('properties'),draw:()=>event('draw'),recordHistory:label=>event('record:'+label),
  invalidateBlockProjectionCache:id=>event('invalidate:'+id),pushModelConstraint:c=>{event('push');state.model.constraints.push(c);return c;},dimensionFromAnchor:()=>{event('dimension');return{anchor:'value'};},
  assignConstraintSketchId:(c,id)=>{event('assign');c.sketchId=id;},activeSketchId:()=>{ready();return state.model.activeSketchId;},elementSketchId:item=>item.sketchId,
  findLineFixedConstraint:line=>{ready();return state.model.constraints.find(c=>c instanceof LineFixedConstraint&&c.line===line);},fixPointBtn,document,canvas,
  fitAllGeometryToViewport:value=>event('fit:'+value),worldToCanvasScreen:function(point){'use strict';assert.equal(this,undefined);event('screen');return{x:point.x+5,y:point.y+7};}};
 const options={documentWorkspace:{workspace:{current:currentScope},sketches:{activeSketchId:p.activeSketchId,elementSketchId:p.elementSketchId}},geometry:{addPoint,addLine,addCircle,addArc},
  readServices:{reads:queries,projections:{blockProjectionBundle:p.blockProjectionBundle,invalidateBlockProjectionCache:p.invalidateBlockProjectionCache},geometryAppearance:{effectiveAppearanceForElement,isVisibleSketchElement:p.isVisibleSketchElement}},
  interaction:{selection,hover,pointUsage:{isAnyLineEndpoint:p.isAnyLineEndpoint}},blockQueries:{blockInstanceById:p.blockInstanceById},selectionHighlight:p.selectionHighlight,
  presentation:{settings,updateUI:p.updateUI,updatePropertiesUI:p.updatePropertiesUI,draw:p.draw},display:{geometryDisplayColor:p.geometryDisplayColor,geometryStrokeWidth:p.geometryStrokeWidth},placement:{dimensionFromAnchor:p.dimensionFromAnchor},viewport:{worldToCanvasScreen:p.worldToCanvasScreen},
  document,canvas,fixPointBtn,readHistory,resetModelState:p.resetModelState,clearSelection:p.clearSelection,resetHistory:p.resetHistory,fitAllGeometryToViewport:p.fitAllGeometryToViewport,
  pushModelConstraint:p.pushModelConstraint,assignConstraintSketchId:p.assignConstraintSketchId,recordHistory:p.recordHistory,canvasThemeColor,isSidebarHighlightedElement:p.isSidebarHighlightedElement,
  selectedPropertiesTarget:p.selectedPropertiesTarget,findLineFixedConstraint:p.findLineFixedConstraint,constructionAlpha:p.constructionAlpha};
 // Preserve the live highlight owner rather than spreading its current-state getter.
 options.selectionHighlight=p.selectionHighlight;Object.assign(options.selectionHighlight,{constraintHighlightNodes:p.constraintHighlightNodes,isSidebarHoveredElement:p.isSidebarHoveredElement});
 const methods=['createStrokeStyleCases','createHighlightObservation','createHoverKeyObservation','createThemeObservation','createInspectionFixture','createAppearanceAction','createHoverObservation','createAppearanceObservation','createFixture','createPropertiesObservation','createFixedObservation'];
 const factories=composed?w.PropertiesTestDriver.createBrowserFactories(options):Object.fromEntries(methods.map(method=>[method,()=>w.PropertiesTestDriver[method](p)]));
 assert.deepEqual(events,[]);const support=Object.fromEntries(methods.map(method=>[method,factories[method]()]));assert.deepEqual(events,[]);state.ready=true;
 return{w,p,options,state,events,support,factories,selection,hover,marker,original,model,LineFixedConstraint,seedLine(){const a=addPoint(0,0,false,'explicit'),b=addPoint(10,0,false,'endpoint');return addLine(a,b);}};
}

test('Properties browser factories retain separate lazy creation stages and shared owners without querying editing state',()=>{
 const f=browserFixture();assert.equal(Object.isFrozen(f.factories),true);assert.deepEqual(f.events,[]);
 for(const [name,api]of Object.entries(f.support)){assert.equal(Object.isFrozen(api),true,name);assert.notEqual(f.factories[name](),api,name);}
 assert.deepEqual(f.events,[]);assert.equal(f.state.model,f.original);assert.equal(f.selection.points.length,0);
});

test('Properties observations use live Workspace, Selection, hover, style, theme, DOM and history owners',()=>{
 for(const composed of [false,true]){
  const f=browserFixture(composed),s=f.support;f.state.model=f.model();const line=f.seedLine();f.selection.set('lines',[line]);f.hover.update({line});f.state.hoverIds=[line.id];f.state.treeIds=[line.id];f.state.highlight=[line.p1];
  const appearance=s.createAppearanceObservation.appearance('line',line.id);assert.equal(appearance.effective,f.state.effective);
  const hovered=s.createHoverObservation.state('line',line.id);assert.equal(hovered.canvasHovered,true);assert.equal(hovered.sidebarHovered,true);assert.equal(hovered.treeHovered,true);assert.equal(hovered.color,'hover');
  assert.deepEqual(Array.from(s.createHighlightObservation.ids()),[line.id,line.p1.id,line.p2.id].sort());assert.deepEqual(Array.from(s.createHoverKeyObservation.keys()),[line.id]);
  f.state.target={kind:'changed'};let observed=s.createPropertiesObservation.state();assert.equal(observed.targetKind,'changed');assert.equal(observed.history,f.state.history);assert.equal(observed.lines[0].id,line.id);
  f.state.color='#fedcba';f.state.theme='dark';const theme=s.createThemeObservation.state();assert.equal(theme.defaultGeometryColor,'#fedcba');assert.equal(theme.theme,'dark');assert.equal(theme.stored,'dark');assert.ok(theme.displayedDefaultGeometryContrast);
  line.sketchId='S2';line.p1.sketchId='S2';line.p1.fixed=true;f.state.model.constraints=[new f.LineFixedConstraint(line)];f.state.disabled='true';observed=s.createFixedObservation.state();
  assert.deepEqual(Array.from(observed.fixedLineIds),[line.id]);assert.deepEqual(Array.from(observed.fixedPointIds),[line.p1.id]);assert.equal(observed.buttonDisabled,'true');assert.equal(observed.constraintCount,1);assert.equal(observed.history,f.state.history);assert.equal(f.original.points.length,0);
 }
});

test('Properties fixture creation preserves editing and history order, selection identity and live reset scope',()=>{
 const normalized=value=>JSON.parse(JSON.stringify(value));
 for(const scenario of ['mixed','fixed','inspection','stroke']){
  const runs=[];for(const composed of [false,true]){const f=browserFixture(composed),s=f.support;f.events.length=0;let result;
   if(scenario==='mixed')result=s.createFixture.resetProperties(true);if(scenario==='fixed')result=s.createFixture.resetFixed();if(scenario==='inspection')result=s.createInspectionFixture.reset();if(scenario==='stroke')result=s.createStrokeStyleCases.cases();
   assert.notEqual(f.state.model,f.original);assert.equal(f.original.points.length,0);if(scenario==='mixed'){assert.equal(f.selection.lines[0],f.state.model.lines[0]);assert.equal(f.selection.circles[0],f.state.model.circles[0]);}
   runs.push({result:normalized(result),events:f.events.slice(),model:normalized(f.state.model)});
  }assert.deepEqual(runs[1],runs[0],scenario);
 }
});

test('Properties appearance actions retain live selection, Block invalidation, receiver and partial-state error boundaries',()=>{
 for(const composed of [false,true])for(const failure of [null,'normalize','properties','draw']){
  const f=browserFixture(composed),block={id:'B',appearanceOverride:{color:'old'}},prior=block.appearanceOverride;f.selection.set('blockInstances',[block]);f.state.fail=failure;f.events.length=0;
  if(failure)assert.throws(()=>f.support.createAppearanceAction.set({color:'new'}),error=>error===f.marker);else assert.equal(f.support.createAppearanceAction.set({color:'new'}),true);
  assert.equal(block.appearanceOverride===prior,failure==='normalize');assert.equal(prior.color,'old');
  const expected=['normalize','invalidate:B','properties','draw','record:Appearance変更'];assert.deepEqual(f.events,failure?expected.slice(0,expected.indexOf(failure)+1):expected);
  if(failure!=='normalize')assert.equal(block.appearanceOverride.color,'new');
 }
});
