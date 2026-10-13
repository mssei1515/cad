const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('src/ui/constraint_controls_view.js','utf8'),sandbox);

test('constraint control binding reads current datasets, routes menu through button and owns listener lifetime', () => {
 const calls=[];
 function control(dataset) {
  const handlers=new Set();
  return {dataset, handlers,
   addEventListener(type, handler) {assert.equal(type,'click'); handlers.add(handler);},
   removeEventListener(type, handler) {assert.equal(type,'click'); handlers.delete(handler);},
   click() {for(const handler of [...handlers]) handler();},
   closest(selector) {assert.equal(selector,'details');return {removeAttribute(name) {assert.equal(name,'open');calls.push(['close']);}};}};
 }
 const source=control({constraint:'horizontal'}),fixed=control({}),menu=control({menuConstraint:'horizontal'});
 const binding=sandbox.window.ConstraintControlsView.createBinding({constraintButtons:[source],constraintMenuButtons:[menu],fixPointBtn:fixed,
  onConstraint:type=>calls.push(['constraint',type]),onFixed:()=>calls.push(['fixed'])});
 binding.bind();binding.bind();assert.equal(source.handlers.size,1);assert.equal(fixed.handlers.size,1);
 menu.click();assert.deepEqual(calls,[['constraint','horizontal'],['close']]);
 calls.length=0;source.dataset.constraint='vertical';source.click();assert.deepEqual(calls,[['constraint','vertical']]);
 calls.length=0;menu.dataset.menuConstraint='fixed';menu.click();assert.deepEqual(calls,[['fixed'],['close']]);
 calls.length=0;menu.dataset.menuConstraint='missing';menu.click();assert.deepEqual(calls,[['close']]);
 binding.dispose();assert.equal(source.handlers.size+fixed.handlers.size+menu.handlers.size,0);
 calls.length=0;source.click();assert.equal(calls.length,0);
 binding.bind();source.click();assert.deepEqual(calls,[['constraint','vertical']]);binding.dispose();
});
function button(dataset={},title='') {
 const attrs={},classes=new Set();return {dataset,title,attrs,classes,
 setAttribute:(key,value)=>{attrs[key]=value;},getAttribute:key=>attrs[key],
 classList:{remove:key=>classes.delete(key),toggle:(key,active)=>active?classes.add(key):classes.delete(key)}};
}
function fixture({empty=false,missingFix=false}={}) {
 const events=[],state={geometry:true,type:'distance',allowed:true,selected:true},hint={title:'old'};
 const constraints=empty?[]:[button({constraint:'distance',label:'寸法'}),button({constraint:'parallel'},'平行')];
 const fix=missingFix?null:button();fix?.setAttribute('aria-disabled','true');fix?.setAttribute('aria-pressed','false');
 const menus=[button({menuConstraint:'distance'}),button({menuConstraint:'fixed'}),button({menuConstraint:'unknown'})];
 const view=sandbox.window.ConstraintControlsView.create({document:{getElementById:id=>{assert.equal(id,'hint');events.push('hint');return hint;}},
 constraintButtons:constraints,constraintMenuButtons:menus,fixPointBtn:fix,isGeometryMode:()=>state.geometry,
 prepareGeometryControls:()=>{events.push('prepare');if(state.afterPrepare!==undefined)state.type=state.afterPrepare;},
 getCommandType:()=>state.type,fixedToggleAllowed:()=>{events.push('eligibility');return state.allowed;},
 hasSelection:()=>{events.push('selection');return state.selected;},translatedExactText:value=>'T:'+value,applicationText:value=>value,
 });return {view,events,state,hint,constraints,fix,menus};
}
test('outside geometry mode all controls clear active and disable without preparation or capability queries',()=>{
 const f=fixture();for(const b of [...f.constraints,...f.menus,f.fix])b.classes.add('active');f.state.geometry=false;f.view.update();
 for(const b of [...f.constraints,...f.menus,f.fix]){assert.equal(b.attrs['aria-disabled'],'true');assert.equal(b.attrs['aria-pressed'],'false');assert.equal(b.classes.has('active'),false);}
 assert.deepEqual(f.events,[]);assert.equal(f.hint.title,'old');
 const missing=fixture({missingFix:true});missing.state.geometry=false;assert.doesNotThrow(()=>missing.view.update());
});
test('preparation runs before active command reflection, menus mirror existing sources and help uses translated labels',()=>{
 const f=fixture();f.state.afterPrepare='parallel';f.view.update();
 assert.equal(f.constraints[0].attrs['aria-pressed'],'false');assert.equal(f.constraints[1].attrs['aria-pressed'],'true');
 assert.equal(f.menus[0].attrs['aria-pressed'],'false');assert.equal(f.menus[2].attrs['aria-disabled'],'false');
 assert.equal(f.hint.title,'追加可能: T:寸法 / T:平行');assert.deepEqual(f.events,['prepare','eligibility','hint']);
});
test('Fix menu reads prior Fix attributes before the Fix control updates, preserving existing order',()=>{
 const f=fixture();f.state.type='fixed';f.view.update();
 assert.equal(f.menus[1].attrs['aria-disabled'],'true');assert.equal(f.menus[1].attrs['aria-pressed'],'false');
 assert.equal(f.fix.attrs['aria-disabled'],'false');assert.equal(f.fix.attrs['aria-pressed'],'true');
 f.view.update();assert.equal(f.menus[1].attrs['aria-disabled'],'false');assert.equal(f.menus[1].attrs['aria-pressed'],'true');
});
test('Fix disables only an ineligible selection outside its active command, with selection short-circuited when eligible',()=>{
 for(const [allowed,selected,type,disabled,reads] of [[true,true,null,'false',false],[false,false,null,'false',true],[false,true,null,'true',true],[false,true,'fixed','false',true]]){
  const f=fixture();Object.assign(f.state,{allowed,selected,type});f.view.update();assert.equal(f.fix.attrs['aria-disabled'],disabled);assert.equal(f.events.includes('selection'),reads);
 }
});
test('no constraint buttons uses the existing selection guidance as hint title',()=>{
 const f=fixture({empty:true});f.view.update();assert.equal(f.hint.title,'点または線を選択すると、追加できる拘束だけが有効になります。');
});
