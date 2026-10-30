const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const test = require('node:test');
function fixture(fromWorkspace = false) {
  class InputElement {}
  const events = [], applyButton = new EventTarget(), openButton = new EventTarget();
  const state = { model: { parameters: [{ name: 'width' }], symbols: [{ parameterName: 'd1' }] }, definitions: [], editing: null, language: 'ja', ready: false, outcome: { success: true } };
  let namesForInput, rendered;
  const draft = { current: null, open(scope) { this.current = { ...scope, parameters: scope.namespace.parameters || [], dimensions: [] }; },
    evaluate: () => ({}), isDirty: () => false, close() { this.current = null; } };
  const document = { getElementById: id => ({ parametersBtn: openButton, applyParametersBtn: applyButton })[id] || null };
  const sandbox = { window: {
    ParameterDialogDraft: { create: () => draft },
    ExpressionInputView: { create: options => { namesForInput = options.referenceNamesForInput; return { sync() {}, install() {}, refresh() {} }; }, createInsertion: () => ({ insert(input, name) { events.push(['insert', input, name]); } }) },
    ParameterDialogView: { create: () => ({ render(value) { rendered = value; events.push('render'); }, setError: error => events.push(['error', error]) }) },
  } }; vm.createContext(sandbox);
  for (const file of ['src/ui/parameter_dialog_controller.js', 'src/ui/expression_input_controller.js', 'src/application/parameter_editor.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
  function read(value) { assert.equal(state.ready, true, 'no eager scope lookup'); return value; }
  const namespace = { symbolElementsInNamespace: model => model.symbols || [], parameterErrorText: error => error.message };
  const options = { document, window: { confirm: () => true }, InputElement, Event,
    namespace, currentScope: () => read(state.model), readDefinitions: () => read(state.definitions), readBlockEditor: () => read(state.editing),
    applicationText: (ja, en) => state.language === 'en' ? en : ja, language: () => state.language,
    formatting: { escapeHtml: String, formatDisplayNumber: String, formatParameterReference: String, parameterErrorText: error => error.message, defaultSketchId: 'S1' },
    localizeApplicationUI() {}, applyDraft(session, committed) { events.push('apply'); assert.equal(session, draft.current); if (state.outcome.success) committed(); return state.outcome; },
    recordHistory: label => events.push(['history', label]), setHint: (...args) => events.push(['hint', ...args]), updateUI: () => events.push('ui'), draw: () => events.push('draw'), pickDimension() {},
  };
  let editor, EditorInputElement = InputElement;
  if (fromWorkspace) {
    class BrowserInputElement extends EventTarget {}
    class BrowserEvent extends Event { constructor(...args) { super(...args); this.fromWorkspace = true; } }
    const model = { get blockDefinitions() { return read(state.definitions); } };
    const documentWorkspace = Object.freeze({ document: model, parameters: namespace,
      workspace: { current() { throw Error('editor must use its explicit editing scope'); } } });
    const settings = Object.freeze({ applicationText: options.applicationText, get language() { return read(state.language); }, localizeApplicationUI: options.localizeApplicationUI });
    sandbox.window.HtmlText = { escapeHtml: String }; sandbox.window.NumberDisplay = { formatDisplayNumber: String };
    sandbox.window.ParameterEngine = { formatReference: name => `"${name}"` }; sandbox.window.SketchHierarchy = { DEFAULT_SKETCH_ID: 'S1' };
    const createView = sandbox.window.ExpressionInputView.create;
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/expression_input_view.js'), 'utf8'), sandbox);
    sandbox.window.ExpressionInputView = { ...sandbox.window.ExpressionInputView, create: createView };
    editor = sandbox.window.ParameterEditor.createForWorkspace({ document, window: { ...options.window, HTMLInputElement: BrowserInputElement, Event: BrowserEvent },
      documentWorkspace, currentScope: options.currentScope, readBlockEditor: options.readBlockEditor, settings,
      applyDraft: options.applyDraft, recordHistory: options.recordHistory, setHint: options.setHint, updateUI: options.updateUI, draw: options.draw, pickDimension: options.pickDimension });
    EditorInputElement = BrowserInputElement;
  } else editor = sandbox.window.ParameterEditor.create(options);
  assert.deepEqual(events, []); state.ready = true;
  return { editor, state, draft, events, document, namespace, InputElement: EditorInputElement, openButton, applyButton, names: input => Array.from(namesForInput(input)), rendered: () => rendered };
}

test('parameter editor binds once, reads live scopes and language, and disposes its dialog listeners', () => {
  const f = fixture(), definition = { id: 'B2', name: 'Part', parameters: [] };
  f.state.definitions = [definition]; f.editor.start(); f.editor.start();
  f.openButton.dispatchEvent(new Event('click'));
  assert.deepEqual(f.events, ['render']); assert.equal(f.rendered().scopes[1].namespace, definition);
  assert.equal(f.rendered().scopes[1].label, 'ブロック: Part');
  f.state.language = 'en'; f.state.editing = { draft: { id: 'B9', name: 'Draft' } }; f.state.model = { parameters: [], symbols: [] };
  f.openButton.dispatchEvent(new Event('click'));
  assert.equal(f.rendered().scopeLocked, true); assert.equal(f.rendered().scopes.length, 1);
  assert.equal(f.rendered().scopes[0].key, 'block:B9'); assert.equal(f.rendered().scopes[0].label, 'Block: Draft');
  assert.equal(f.rendered().scopes[0].namespace, f.state.model);
  f.editor.dispose(); f.events.length = 0; f.openButton.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.editor.start(); f.openButton.dispatchEvent(new Event('click')); assert.deepEqual(f.events, ['render']);
});

test('expression names come from the live Canvas scope or dialog draft without leaking one into the other', () => {
  const f = fixture(), outside = { closest: () => null }, inside = { closest: () => ({}) };
  assert.deepEqual(f.names(outside), ['width', 'd1']);
  f.draft.current = { parameters: [{ name: 'draft' }, { name: 'draft' }], dimensions: [{ name: 'draftD' }] };
  assert.deepEqual(f.names(inside), ['draft', 'draftD']);
  f.state.model = { parameters: [{ name: 'other' }], symbols: [{ parameterName: 'otherD' }] };
  assert.deepEqual(f.names(outside), ['other', 'otherD']);
  f.draft.current = null; assert.deepEqual(f.names(inside), ['other', 'otherD']);
});

test('dialog application retains success and failure feedback order through the composed controller', () => {
  const f = fixture(); assert.equal(f.editor.apply(), false); assert.deepEqual(f.events, []);
  f.editor.start(); f.openButton.dispatchEvent(new Event('click')); f.events.length = 0;
  f.applyButton.dispatchEvent(new Event('click'));
  assert.deepEqual(f.events, ['apply', ['history', 'Parameter変更'], ['hint', 'Parameterを適用しました'], 'render', 'ui', 'draw']);
  f.state.outcome = { success: false, error: new Error('rejected') }; f.events.length = 0;
  assert.equal(f.editor.apply(), false);
  assert.deepEqual(f.events, ['apply', 'render', ['error', 'rejected'], ['hint', 'rejected', 'error'], 'ui', 'draw']);
});

function referenceInputFixture() {
 const f=fixture(),state={namespace:{annotations:[]},reads:0,ready:false,name:'d2',failure:null};
 class TextAreaElement extends f.InputElement {}
 const input=new f.InputElement();input.matches=selector=>selector==='[data-parameter-field="expression"], [data-dimension-field="expression"]';
 input.closest=selector=>selector==='#parametersDialog'?input:null;input.dataset={};f.document.activeElement=input;
 f.namespace.ensureDimensionParameter=(constraint,scope)=>{assert.equal(scope,state.namespace);f.events.push('ensure');if(state.failure)throw state.failure;constraint.parameterName=state.name;};
 const pending={current:null},dimensionValueInput=new f.InputElement();dimensionValueInput.matches=()=>false;dimensionValueInput.closest=()=>null;
 const command=f.editor.createReferenceInput({TextAreaElement,currentNamespace:()=>{assert.equal(state.ready,true,'no eager Canvas scope read');state.reads++;return state.namespace;},
  dimensionValueInput,pendingCommandSession:pending,canvas:{getBoundingClientRect:()=>({left:10,top:20,right:110,bottom:120})},canvasPoint:()=>({x:3,y:4}),
  hitDimension:(x,y,options)=>{assert.deepEqual([x,y],[3,4]);assert.equal(options.activeOnly,false);return state.dimensionHit;},
  hitAnnotationElement:()=>state.annotationHit});
 assert.equal(state.reads,0);assert.deepEqual(f.events,[]);state.ready=true;
 const event={clientX:30,clientY:40,preventDefault(){f.events.push('prevent');},stopPropagation(){f.events.push('stop');}};
 return {...f,referenceState:state,input,command,event,TextAreaElement,pending,dimensionValueInput};
}

test('parameter reference input shares its dialog draft, insertion and feedback while reading the current Canvas namespace lazily',()=>{
 const f=referenceInputFixture();assert.equal(Object.isFrozen(f.command),true);assert.equal(f.command.context(),null);
 f.draft.current={namespace:f.referenceState.namespace};assert.equal(f.command.context().namespace,f.referenceState.namespace);
 const constraint={};f.referenceState.dimensionHit={constraint};f.command.pickCanvas(f.event);
 assert.equal(constraint.parameterName,'d2');assert.deepEqual(f.events,['ensure','prevent','stop',['insert',f.input,'d2'],['error',''],['hint','d2 を挿入しました']]);
 f.events.length=0;f.state.language='en';f.referenceState.namespace={annotations:[]};f.draft.current={namespace:f.referenceState.namespace};
 const note={parameterEnabled:true,parameterName:'note1'};f.referenceState.namespace.annotations.push(note);
 assert.equal(f.command.insertAnnotation(f.event,{element:note}),true);
 assert.deepEqual(f.events,['prevent','stop',['insert',f.input,'note1'],['error',''],['hint','Inserted note1.']]);
 f.document.activeElement=f.dimensionValueInput;assert.equal(f.command.context(),null);
 f.dimensionValueInput.matches=()=>false;f.pending.current={type:'distance-value'};assert.equal(f.command.context().namespace,f.referenceState.namespace);
 f.document.activeElement=new f.TextAreaElement();f.document.activeElement.dataset={expression:'true'};f.document.activeElement.id='annotationValueInput';f.document.activeElement.matches=()=>false;
 assert.equal(f.command.context().namespace,f.referenceState.namespace);
});

test('parameter reference input keeps mismatch feedback order and propagates naming failures without consuming the event',()=>{
 const f=referenceInputFixture();f.draft.current={namespace:{annotations:[]}};
 assert.equal(f.command.insertDimension(f.event,{constraint:{}}),true);
 assert.equal(f.events[0][0],'error');assert.equal(f.events[1][0],'hint');assert.deepEqual(f.events.slice(2),['prevent','stop']);
 f.events.length=0;const note={parameterEnabled:true,parameterName:'n1'};f.referenceState.namespace.annotations.push(note);
 assert.equal(f.command.insertAnnotation(f.event,{element:note}),true);assert.deepEqual(f.events.slice(0,2),['prevent','stop']);assert.equal(f.events[2][0],'error');
 f.events.length=0;f.draft.current.namespace=f.referenceState.namespace;const marker=new Error('name allocation failed');f.referenceState.failure=marker;
 assert.throws(()=>f.command.insertDimension(f.event,{constraint:{}}),error=>error===marker);assert.deepEqual(f.events,['ensure']);
});

test('workspace parameter editor reads live definitions and language while retaining its explicit editing scope',()=>{
 const f=fixture(true),outside={closest:()=>null},definition={id:'BD1',name:'Part',parameters:[]};
 assert.deepEqual(f.names(outside),['width','d1']);f.state.definitions=[definition];f.editor.start();f.openButton.dispatchEvent(new Event('click'));
 assert.equal(f.rendered().scopes[0].namespace,f.state.model);assert.equal(f.rendered().scopes[1].namespace,definition);
 f.state.model={parameters:[{name:'editing'}],symbols:[]};f.state.language='en';f.state.definitions=[{id:'BD2',name:'Other',parameters:[]}];
 f.openButton.dispatchEvent(new Event('click'));assert.equal(f.rendered().scopes[1].label,'Block: Other');assert.deepEqual(f.names(outside),['editing']);
 f.state.editing={draft:{id:'BD3',name:'Draft'}};f.openButton.dispatchEvent(new Event('click'));
 assert.equal(f.rendered().scopes.length,1);assert.equal(f.rendered().scopes[0].namespace,f.state.model);assert.equal(f.rendered().scopes[0].key,'block:BD3');f.editor.dispose();
});

test('workspace parameter editor uses browser input and Event types with the shared reference formatter for input and blur/change',()=>{
 const f=fixture(true),input=new f.InputElement(),observed=[];Object.assign(input,{value:'',selectionStart:0,selectionEnd:0,isConnected:true,
  matches:selector=>selector==='#commandPanel [data-setting="expression"]',focus:()=>observed.push('focus'),setSelectionRange:(start,end)=>{input.selectionStart=start;input.selectionEnd=end;}});
 f.document.activeElement=input;class TextAreaElement extends f.InputElement {}
 const command=f.editor.createReferenceInput({TextAreaElement,currentNamespace:()=>f.state.model,dimensionValueInput:{},pendingCommandSession:{current:null}});
 assert.equal(command.context().input,input);assert.equal(command.context().namespace,f.state.model);
 for(const name of ['input','change'])input.addEventListener(name,event=>{assert.equal(event.fromWorkspace,true);assert.equal(event.bubbles,true);observed.push(name);});
 f.editor.insertIdentifierIntoExpressionInput(input,'width');assert.equal(input.value,'="width"');assert.equal(input.selectionStart,input.value.length);assert.equal(input.selectionEnd,input.value.length);
 input.dispatchEvent(new Event('blur'));assert.deepEqual(observed,['input','focus','change']);
});
