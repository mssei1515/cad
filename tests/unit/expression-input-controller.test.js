const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/expression_input_controller.js'), 'utf8'), sandbox);
const commandSelector = '#commandPanel [data-setting="expression"]';
const propertySelector = '#propertiesPanel [data-property="constraint-expression"], #propertiesPanel [data-property="annotation-expression"]';
const parameterSelector = '[data-parameter-field="expression"], [data-dimension-field="expression"]';
class Element {
  constructor(selectors = []) { this.selectors = new Set(selectors); this.dataset = {}; }
  matches(selector) { return this.selectors.has(selector); }
  closest(selector) { assert.equal(selector, '#parametersDialog'); return this.inDialog ? this : null; }
}
class Input extends Element {}
class TextArea extends Element {}
function fixture(pickerPorts = {}) {
  const input = new Input([commandSelector]), document = { activeElement: input }, dimensionInput = new Input();
  const pending = { current: null }, draft = { current: null }, events = [];
  const state = { namespace: { id: 'same', annotations: [] }, language: 'en', allocate: 'd1', reads: 0 };
  const event = { preventDefault() { assert.equal(this, event); events.push(['prevent']); }, stopPropagation() { assert.equal(this, event); events.push(['stop']); } };
  const controller = sandbox.window.ExpressionInputController.create({ document, types: { InputElement: Input, TextAreaElement: TextArea },
    currentNamespace: () => { state.reads++; return state.namespace; }, dimensionValueInput: dimensionInput,
    pendingCommandSession: pending, parameterDraft: draft,
    ensureDimensionParameter: (constraint, namespace) => { assert.equal(namespace, state.namespace); events.push(['ensure']); if (!constraint.parameterName && state.allocate) constraint.parameterName = state.allocate; },
    setParameterDialogError: message => events.push(['error', message]), setHint: (...args) => events.push(['hint', ...args]),
    applicationText: (_ja, en) => en, language: () => state.language,
    insertIdentifierIntoExpressionInput: (input, id) => events.push(['insert', input, id]),
    ...pickerPorts,
  });
  return { controller, state, input, document, dimensionInput, pending, draft, events, event };
}

test('focused expression query preserves eligible fields, disabled/read-only rejection and live namespace identity', () => {
  const f = fixture(); assert.equal(f.state.reads, 0);
  assert.equal(f.controller.context().input, f.input); assert.equal(f.controller.context().namespace, f.state.namespace);
  const block = { id: 'same', annotations: [] }; f.state.namespace = block;
  assert.equal(f.controller.context().namespace, block);
  for (const property of ['disabled', 'readOnly']) { f.input[property] = true; assert.equal(f.controller.context(), null); f.input[property] = false; }
  f.document.activeElement = {}; assert.equal(f.controller.context(), null);
  const note = new TextArea(); note.id = 'annotationValueInput'; note.dataset.expression = 'true'; f.document.activeElement = note;
  assert.equal(f.controller.context().namespace, block);
  f.document.activeElement = new Input([propertySelector]); assert.equal(f.controller.context().namespace, block);
  f.document.activeElement = f.dimensionInput; assert.equal(f.controller.context(), null);
  f.pending.current = { type: 'distance-value' }; assert.equal(f.controller.context().namespace, block);
  const parameter = new Input([parameterSelector]); parameter.inDialog = true; f.document.activeElement = parameter;
  assert.equal(f.controller.context(), null);
  const other = { id: 'same' }; f.draft.current = { namespace: other };
  assert.equal(f.controller.context().namespace, other);
});

test('dimension reference insertion delegates naming before event suppression and leaves invalid targets unconsumed', () => {
  const f = fixture(), constraint = {};
  assert.equal(f.controller.insertDimension(f.event, { constraint }), true);
  assert.equal(constraint.parameterName, 'd1');
  assert.deepEqual(f.events, [['ensure'], ['prevent'], ['stop'], ['insert', f.input, 'd1'], ['error', ''], ['hint', 'Inserted d1.']]);
  f.events.length = 0;
  assert.equal(f.controller.insertDimension(f.event, { constraint: { annotationOwner: {} } }), false); assert.deepEqual(f.events, []);
  f.state.allocate = null;
  assert.equal(f.controller.insertDimension(f.event, { constraint: {} }), false); assert.deepEqual(f.events, [['ensure']]);
});

test('namespace mismatch preserves the different dimension and annotation error/event orders', () => {
  const f = fixture(), parameter = new Input([parameterSelector]); parameter.inDialog = true; f.document.activeElement = parameter;
  f.draft.current = { namespace: { id: 'same' } };
  assert.equal(f.controller.insertDimension(f.event, { constraint: { parameterName: 'd1' } }), true);
  assert.deepEqual(f.events.map(e => e[0]), ['error', 'hint', 'prevent', 'stop']);
  f.events.length = 0;
  const note = { parameterEnabled: true, parameterName: 'n1' }; f.state.namespace.annotations = [note];
  assert.equal(f.controller.insertAnnotation(f.event, { element: note }), true);
  assert.deepEqual(f.events.map(e => e[0]), ['prevent', 'stop', 'error', 'hint']);
});

test('annotation references require current-scope identity and read current language without allocating a dimension name', () => {
  const f = fixture(), note = { id: 'AN1', parameterEnabled: true, parameterName: 'n1' };
  f.state.namespace.annotations = [note]; f.state.language = 'ja';
  assert.equal(f.controller.insertAnnotation(f.event, { element: { ...note } }), false); assert.deepEqual(f.events, []);
  assert.equal(f.controller.insertAnnotation(f.event, { element: note }), true);
  assert.deepEqual(f.events, [['prevent'], ['stop'], ['insert', f.input, 'n1'], ['error', ''], ['hint', 'n1 を挿入しました']]);
  f.events.length = 0; note.parameterEnabled = false;
  assert.equal(f.controller.insertAnnotation(f.event, { element: note }), false); assert.deepEqual(f.events, []);
});


test('Canvas reference picker excludes points outside the current rect before coordinate, hit or input queries',()=>{
 for(const [clientX,clientY] of [[9,30],[111,30],[30,19],[30,121]]){
  const calls=[],f=fixture({canvas:{getBoundingClientRect:()=>({left:10,right:110,top:20,bottom:120})},
   canvasPoint:()=>{throw Error('outside canvas');},hitDimension:()=>calls.push('dimension'),hitAnnotationElement:()=>calls.push('annotation')});
  Object.assign(f.event,{clientX,clientY});assert.equal(f.controller.pickCanvas(f.event),undefined);
  assert.deepEqual(calls,[]);assert.deepEqual(f.events,[]);assert.equal(f.state.reads,0);
 }
});

test('Canvas reference picker accepts exact edges and prioritizes dimension hit even when insertion is declined',()=>{
 const calls=[],state={hit:{constraint:{annotationOwner:{}}}},point={x:3,y:4};
 const f=fixture({canvas:{getBoundingClientRect:()=>({left:10,right:110,top:20,bottom:120})},
  canvasPoint:event=>{assert.equal(event,f.event);calls.push('point');return point;},
  hitDimension:(x,y,options)=>{assert.equal(x,3);assert.equal(y,4);assert.equal(options.activeOnly,false);calls.push('dimension');return state.hit;},
  hitAnnotationElement:()=>{throw Error('a dimension hit must not fall back to annotation');}});
 Object.assign(f.event,{clientX:10,clientY:120});f.controller.pickCanvas(f.event);
 assert.deepEqual(calls,['point','dimension']);assert.deepEqual(f.events,[]);
 state.hit={constraint:{parameterName:'d9'}};f.controller.pickCanvas(f.event);
 assert.equal(f.events.find(e=>e[0]==='insert')[2],'d9');
});

test('Canvas reference picker falls back to annotation only for absent dimensions using the same event and world point',()=>{
 const calls=[],annotation={parameterEnabled:true,parameterName:'note1'};
 const f=fixture({canvas:{getBoundingClientRect:()=>({left:0,right:100,top:0,bottom:100})},
  canvasPoint:event=>{assert.equal(event,f.event);return {x:8,y:9};},
  hitDimension:(x,y,options)=>{assert.deepEqual([x,y,options.activeOnly],[8,9,false]);calls.push('dimension');return null;},
  hitAnnotationElement:(x,y,options)=>{assert.deepEqual([x,y,options.activeOnly],[8,9,false]);calls.push('annotation');return {element:annotation};}});
 f.state.namespace.annotations.push(annotation);Object.assign(f.event,{clientX:50,clientY:50});
 assert.equal(f.controller.pickCanvas(f.event),undefined);assert.deepEqual(calls,['dimension','annotation']);
 assert.deepEqual(f.events.slice(0,2),[['prevent'],['stop']]);assert.equal(f.events.find(e=>e[0]==='insert')[2],'note1');
});
