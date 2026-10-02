
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const sandbox={window:{}};vm.createContext(sandbox);for(const name of ['annotation','constraint'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/editing/'+name+'_command_input.js'),'utf8'),sandbox);
function fixture(){
  const f={mode:'select',pending:null,constraint:null,dimensionCommand:false,retarget:false,calls:[],state:{}};
  const record=name=>(...args)=>f.calls.push({name,args});
  const selection={clear:record('clear'),toggleDimensionConstraint:record('toggleDimension'),set:(k,v)=>{f.state[k]=v;record('set:'+k)(v);},effectiveSelectedConstraint:()=>f.state.constraint,toggleBlockInstanceSelection:record('toggleBlock'),toggleById:record('toggle'),get dimensionConstraint(){return f.state.dimensionConstraint;}};
  const common={getMode:()=>f.mode,getPending:()=>f.pending,getPendingConstraint:()=>f.constraint,canvasSelection:selection,draw:record('draw')};
  f.annotation=sandbox.window.AnnotationCommandInput.create({...common,annotationCommand:{commitTextAnnotationAt:record('text'),handleLeaderAnnotationTargetClick:record('target'),commitLeaderAnnotationAt:record('leader')},clearSelection:record('clear'),annotationDrag:{begin:record('annotationDrag')},updateUI:record('ui')});
  f.input=sandbox.window.ConstraintCommandInput.create({...common,canvasHover:{update:record('hover')},isDimensionConstraintCommandActive:()=>f.dimensionCommand,
    beginDimensionDrag:record('dimensionDrag'),retargetDistancePlaceWithOperand:(...args)=>{record('retarget')(...args);return f.retarget;},startDistanceValueInput:record('value'),
    constraintTargetHint:type=>'hint:'+type,handleConstraintOperandClick:record('operand'),setHint:record('hint'),updateGeometrySelectionUI:record('ui')});
  f.e={preventDefault:record('prevent')};f.p={x:1,y:2};f.names=()=>f.calls.map(c=>c.name);f.click=hits=>f.input.click(f.e,f.p,hits||{});return f;
}
test('annotation placement routes each pending state and falls through for unrelated commands',()=>{
  const f=fixture(),target={};for(const [type,name] of [['annotation-text-place','text'],['annotation-leader-select','target'],['annotation-leader-place','leader']]){f.pending={type};f.calls=[];assert.equal(f.annotation.place(f.e,f.p,target),true);assert.deepEqual(f.names(),['prevent',name]);assert.equal(f.calls[1].args.at(-1),f.p);}
  assert.equal(f.calls[1].args[0],f.p);f.pending=null;f.calls=[];assert.equal(f.annotation.place(f.e,f.p,target),false);assert.deepEqual(f.calls,[]);
});
test('annotation selection is blocked by direct geometry, dimensions or active commands',()=>{
  const f=fixture(),hit={element:{id:'N'}};for(const extra of [{directGeometryHit:true},{hitD:{}}])assert.equal(f.annotation.select(f.e,f.p,{blankAnnotationHit:hit,...extra}),false);
  f.constraint={};assert.equal(f.annotation.select(f.e,f.p,{blankAnnotationHit:hit}),false);assert.deepEqual(f.calls,[]);
});
test('ordinary annotation starts drag while additive annotation and block projections update selection',()=>{
  const f=fixture(),hit={element:{id:'N'}};f.annotation.select(f.e,f.p,{blankAnnotationHit:hit});assert.deepEqual(f.names(),['prevent','clear','annotationDrag','ui','draw']);assert.equal(f.calls[2].args[1],hit);
  f.calls=[];f.e.ctrlKey=true;f.annotation.select(f.e,f.p,{blankAnnotationHit:hit});assert.deepEqual(f.names(),['prevent','toggle','ui','draw']);
  hit.element.blockProjection=true;hit.element.blockInstance={id:'B'};f.calls=[];f.annotation.select(f.e,f.p,{blankAnnotationHit:hit});assert.deepEqual(f.names(),['prevent','toggleBlock','ui','draw']);
});
test('dimension drag clears basic geometry only outside dimension commands',()=>{
  const f=fixture(),dimension={id:'D'},point={id:'P'};f.click({hitD:dimension,hitP:point});assert.equal(f.names().at(-1),'dimensionDrag');assert.ok(f.names().includes('clear')); assert.equal(f.calls.at(-1).args[3].hitP,point);
  f.pending={type:'distance-place'};f.dimensionCommand=true;f.calls=[];f.click({hitD:dimension});assert.deepEqual(f.names(),['prevent','dimensionDrag']);
});
test('distance placement retargets before accepting location and value entry consumes clicks',()=>{
  const f=fixture();f.pending={type:'distance-place'};f.retarget=true;f.click({});assert.deepEqual(f.names(),['prevent','retarget']);
  f.retarget=false;f.calls=[];f.click({});assert.deepEqual(f.names(),['prevent','retarget','value']);
  for(const type of ['distance-value','offset-value']){f.pending={type};f.calls=[];f.click({hitP:{}});assert.deepEqual(f.names(),['prevent']);}
});
test('blank constraint click clears existing constraint selection before accepting another target',()=>{
  const f=fixture();f.constraint={type:'distance'};f.state.constraint={};f.click({});assert.deepEqual(f.names(),['prevent','set:dimensionConstraint','set:constraint','hover','hint','ui','draw']);assert.equal(f.state.constraint,null);
  f.calls=[];const point={id:'P'};f.click({hitP:point});assert.deepEqual(f.names(),['prevent','operand']);assert.equal(f.calls[1].args[2].hitP,point);
  f.constraint=null;f.calls=[];assert.equal(f.click({}),false);assert.deepEqual(f.calls,[]);
});
