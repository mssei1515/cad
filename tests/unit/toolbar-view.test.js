const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/ui/toolbar_view.js','utf8'),sandbox);
const modeButtons = { select:'toolSelect',point:'toolPoint',line:'toolLine',centerline:'toolCenterline','circle-center-cross':'toolCircleCenterCross',rectangle:'toolRectangle',slot:'toolSlot',fillet:'toolFillet',trim:'toolTrim',offset:'toolOffset',circle:'toolCircle',arc:'toolArc','three-point-arc':'toolThreePointArc',spline:'toolSpline','sketch-projection':'toolSketchProjection','free-instance-origin':'toolFreeInstance','free-instance-place':'toolFreeInstance','mirror-axis':'toolMirror','pattern-direction':'toolPattern',hatch:'toolHatch','hatch-repair':'toolHatch' };
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
