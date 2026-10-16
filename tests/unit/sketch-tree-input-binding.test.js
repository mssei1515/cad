const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const test=require('node:test');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('src/ui/sketch_tree_controller.js','utf8'),sandbox);
const names=['pointerdown','click','dblclick','contextmenu','input','change'];
function fixture(){
 const listeners=[],registrations=[],calls=[],state={moving:false,allowed:null,reads:0};
 const document={addEventListener(type,handler,capture){registrations.push(type);listeners.push({type,handler,capture});},
  removeEventListener(type,handler,capture){const index=listeners.findIndex(row=>row.type===type&&row.handler===handler&&row.capture===capture);assert.ok(index>=0);listeners.splice(index,1);}};
 const binding=sandbox.window.SketchTreeController.createMoveInputBinding({document,isMoving:()=>{state.reads++;return state.moving;}});
 function event(){const value={target:{closest(selector){calls.push('closest');assert.equal(selector,'#sketchList, #sketchOverlayResizeHandle');return state.allowed;}},
  preventDefault(){assert.equal(this,value);calls.push('prevent');},stopImmediatePropagation(){assert.equal(this,value);calls.push('stop');}};return value;}
 return{binding,state,listeners,registrations,calls,event,document};
}

test('Sketch move binding registers six capture listeners in order without reading command state and is idempotent',()=>{
 const f=fixture();assert.equal(f.state.reads,0);f.binding.bind();f.binding.bind();assert.equal(f.state.reads,0);
 assert.deepEqual(f.registrations,names);assert.ok(f.listeners.every(row=>row.capture===true));
 for(const row of f.listeners)row.handler(f.event());assert.equal(f.state.reads,6);assert.deepEqual(f.calls,[]);
});

test('moving suppresses outside input in order but permits Tree and resize-handle targets using live command state',()=>{
 const f=fixture();f.binding.bind();f.state.moving=true;
 for(const row of f.listeners){f.calls.length=0;row.handler(f.event());assert.deepEqual(f.calls,['closest','prevent','stop']);}
 for(const region of [{id:'sketchList'},{id:'sketchOverlayResizeHandle'}]){
  f.state.allowed=region;f.calls.length=0;f.listeners[0].handler(f.event());assert.deepEqual(f.calls,['closest']);
 }
 f.state.moving=false;f.state.allowed=null;f.calls.length=0;f.listeners[0].handler(f.event());assert.deepEqual(f.calls,[]);
});

test('dispose removes only owned handlers with the same capture flag and permits a clean rebind',()=>{
 const f=fixture(),external=()=>{};f.document.addEventListener('click',external,true);f.binding.bind();assert.equal(f.listeners.length,7);
 f.binding.dispose();f.binding.dispose();assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].handler,external);
 f.binding.bind();f.binding.bind();assert.equal(f.listeners.length,7);assert.deepEqual(f.listeners.slice(1).map(row=>row.type),names);
 f.state.moving=true;f.listeners[1].handler(f.event());assert.deepEqual(f.calls,['closest','prevent','stop']);f.binding.dispose();assert.equal(f.listeners.length,1);
});
