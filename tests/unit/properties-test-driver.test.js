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
