
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/editing/instance_command_input.js'),'utf8'),sandbox);
function fixture(){
  const f={mode:'select',calls:[],reference:null,derived:null,block:null};const record=name=>(...args)=>f.calls.push({name,args});
  f.source={instance:{type:'mirror'},toggle:record('toggle')};f.geometry={placeFree:record('place'),selectReference:record('commit')};
  f.p={x:1,y:2};f.snapped={x:3,y:4};f.e={pointerId:7,preventDefault:record('prevent')};
  f.controller=sandbox.window.InstanceCommandInput.create({getMode:()=>f.mode,instanceSourceCommand:f.source,geometryInstanceCommand:f.geometry,
    hitReferenceTarget:()=>{record('referenceHit')();return f.reference;},hitDerivedProjectionOperand:()=>{record('derivedHit')();return f.derived;},
    hitBlockProjectionOperand:()=>{record('blockHit')();return f.block;},operandElement:operand=>operand.element,toggleSketchProjectionSource:record('projection'),
    clearSnap:record('clearSnap'),selectionRectangle:{begin:record('rectangle')},capturePointer:record('capture'),snapForDrawing:p=>{assert.equal(p,f.p);record('snap')();return f.snapped;},
    makeConstraintOperand:(kind,{line})=>({kind,line}),setHint:record('hint'),applicationText:a=>a,releasePanelFocus() {}});
  f.click=hits=>f.controller.click(f.e,f.p,hits||{});f.names=()=>f.calls.map(c=>c.name);return f;
}
test('source editing uses projection reference queries or derived-before-block operands',()=>{
  const f=fixture();f.mode='instance-sources';f.source.instance.type='sketchProjection';const element={id:'P'};f.reference={element};
  assert.equal(f.click(),true);assert.deepEqual(f.names(),['prevent','referenceHit','toggle']);assert.equal(f.calls.at(-1).args[0],element);
  f.calls=[];f.source.instance.type='mirror';f.derived={element};f.block={element:{id:'B'}};f.click();assert.deepEqual(f.names(),['prevent','derivedHit','toggle']);
  f.calls=[];f.derived=null;f.click();assert.equal(f.calls.at(-1).args[0],f.block.element);
});
test('source editing falls back to direct hits in point line circle arc spline order',()=>{
  const f=fixture();f.mode='instance-sources';const hits={hitP:{},hitL:{},hitC:{},hitA:{},hitS:{}};
  for(const key of Object.keys(hits)){f.calls=[];f.click(hits);assert.equal(f.calls.at(-1).args[0],hits[key]);delete hits[key];}
});
test('projection empty-space input clears snap and begins a captured projection rectangle',()=>{
  const f=fixture();f.mode='sketch-projection';assert.equal(f.click(),true);assert.deepEqual(f.names(),['prevent','referenceHit','clearSnap','rectangle','capture']);
  assert.equal(f.calls[3].args[0],f.p);assert.equal(f.calls[3].args[1].kind,'sketch-projection');assert.equal(f.calls[4].args[0],7);
  f.reference={id:'R'};f.calls=[];f.click();assert.deepEqual(f.names(),['prevent','referenceHit','projection']);assert.equal(f.calls[2].args[0],f.reference);
});
test('free placement forwards snapped coordinates without suppressing browser input',()=>{
  const f=fixture();for(const mode of ['free-instance-origin','free-instance-place']){f.mode=mode;f.calls=[];assert.equal(f.click(),true);assert.deepEqual(f.names(),['snap','place']);assert.equal(f.calls[1].args[0],f.snapped);}
});
test('reference input honors operand priority and rejects a non-line without using an underlying line',()=>{
  const f=fixture();f.mode='mirror-axis';const line={id:'L'};f.derived={kind:'point'};f.click({hitL:line});assert.deepEqual(f.names(),['prevent','derivedHit','hint']);
  f.derived=null;f.calls=[];f.mode='pattern-direction';f.click({hitL:line});assert.deepEqual(f.names(),['prevent','derivedHit','blockHit','commit']);assert.equal(f.calls[3].args[0],line);
  f.mode='select';f.calls=[];assert.equal(f.click({hitL:line}),false);assert.deepEqual(f.calls,[]);
});
