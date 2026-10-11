'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('src/editing/pending_command_session.js','utf8'),sandbox);
function fixture() {
 const events=[],hooks={};let session;
 session=sandbox.window.PendingCommandSession.create({
  clearPlacement:()=>{events.push('placement');hooks.placement?.();},cancelAnnotation:()=>{events.push('annotation');hooks.annotation?.();},
  cancelPngExport:()=>{events.push('png');hooks.png?.();},resetOffset:()=>events.push('offset'),clearPreviewPointer:()=>events.push('pointer'),
  hideInput:()=>{assert.equal(session.current,null);events.push('hide');},setHint:value=>events.push(['hint',value]),
  updateToolbar:()=>events.push('toolbar'),updateConstraintButtons:()=>events.push('buttons'),draw:()=>events.push('draw'),
 });return {session,events,hooks};
}
test('pending session retains command identity and live fields; detached ports and direct clear do not notify or cancel',()=>{
 const f=fixture(),command={type:'distance-value',buffer:'12'},read=f.session.read,replace=f.session.replace,clear=f.session.clear;
 assert.equal(read(),null);assert.equal(replace(command),undefined);assert.equal(read(),command);assert.equal(f.session.current,command);
 read().buffer='24';assert.equal(command.buffer,'24');assert.throws(()=>{f.session.current={};},TypeError);
 clear();assert.equal(read(),null);assert.deepEqual(f.events,[]);assert.equal(command.buffer,'24');
 replace(null);assert.equal(f.session.current,null);assert.deepEqual(f.events,[]);
});
test('empty cancellation still clears placement and then stops; it reads current state after that callback',()=>{
 const f=fixture();f.session.cancel();assert.deepEqual(f.events,['placement']);
 f.events.length=0;f.session.replace({type:'distance-value'});f.hooks.placement=()=>f.session.clear();f.session.cancel();
 assert.deepEqual(f.events,['placement']);assert.equal(f.session.current,null);
});
test('ordinary cancellation clears pending before hide, records no history, and preserves hint and refresh order',()=>{
 for(const type of ['distance-place','distance-value','fillet-radius-place']){
  const f=fixture();f.session.replace({type});f.session.cancel();
  assert.equal(f.session.current,null);assert.deepEqual(f.events,['placement','hide',['hint','コマンドをキャンセルしました'],'toolbar','buttons','draw']);
 }
 const f=fixture();f.session.replace({type:'distance-value'});f.session.cancel('');assert.deepEqual(f.events,['placement','hide','toolbar','buttons','draw']);
});
test('offset cancellation resets offset selection and pointer before clearing input and updating controls',()=>{
 const f=fixture();f.session.replace({type:'offset-value'});f.session.cancel('offset canceled');
 assert.equal(f.session.current,null);assert.deepEqual(f.events,['placement','offset','pointer','hide',['hint','offset canceled'],'toolbar','buttons','draw']);
});
test('annotation draft cancellation takes priority over type and lets its owner clear pending without generic refresh',()=>{
 const f=fixture(),draft={annotationDraft:true,type:'png-export'};f.session.replace(draft);
 f.hooks.annotation=()=>{assert.equal(f.session.current,draft);f.session.clear();};f.session.cancel('ignored');
 assert.equal(f.session.current,null);assert.deepEqual(f.events,['placement','annotation']);
});
test('PNG cancellation delegates even when its busy owner retains pending; no generic cleanup follows',()=>{
 const f=fixture(),pending={type:'png-export'};f.session.replace(pending);f.session.cancel();
 assert.equal(f.session.current,pending);assert.deepEqual(f.events,['placement','png']);
 f.events.length=0;f.hooks.png=()=>f.session.clear();f.session.cancel();assert.equal(f.session.current,null);assert.deepEqual(f.events,['placement','png']);
});
