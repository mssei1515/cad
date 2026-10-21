const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
for (const file of ['src/ui/constraint_feedback.js', 'src/ui/application_feedback.js']) {
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
}
function fixture() {
  'use strict';
  const events = [], state = { language: 'en', active: false, duplicates: 0, queries: 0, source: '', text: 'old', errorClass: true };
  const hint = { dataset: {}, classList: { toggle(name, enabled) { assert.equal(name, 'error'); events.push('class'); state.errorClass = enabled; } } };
  Object.defineProperty(hint.dataset, 'hintSource', { set(value) { events.push('source'); state.source = value; } });
  Object.defineProperty(hint, 'textContent', { set(value) { events.push('text'); state.text = value; } });
  const log = { textContent: 'prior' }, elements = { hint, log };
  const document = { getElementById(id) { assert.equal(this, document); events.push('get:' + id); return elements[id]; } };
  const settings = { get language() { state.queries++; return state.language; },
    applicationText: function(ja, en) { assert.equal(this, undefined); return state.language === 'en' ? en : ja; },
    translatedHintText: function(value) { assert.equal(this, undefined); events.push('translate');
      if (state.translationFailure) throw state.translationFailure; return state.language + ':' + String(value); },
  };
  const interactionProfiler = { get active() { state.queries++; return state.active; }, work: function(phase, action) {
    assert.equal(this, undefined); assert.equal(phase, 'ui'); events.push('profile');
    if (state.profileFailure) throw state.profileFailure; action(); return 'measured';
  } };
  const view = sandbox.window.ApplicationFeedback.create({ document, settings, interactionProfiler,
    readDuplicateCount: () => { state.queries++; return state.duplicates; } });
  return { view, state, events, elements };
}

test('feedback construction has no DOM or state reads and logs prepend text while a missing log short circuits conversion', () => {
  const f = fixture(); assert.deepEqual(f.events, []); assert.equal(f.state.queries, 0);
  assert.equal(f.view.log('<message>'), undefined); assert.equal(f.elements.log.textContent, '<message>\nprior');
  f.elements.log = { textContent: 'replacement' }; f.view.log('next'); assert.equal(f.elements.log.textContent, 'next\nreplacement');
  delete f.elements.log; f.view.log({ toString() { throw new Error('must not convert'); } });
  assert.deepEqual(f.events, ['get:log','get:log','get:log']); assert.equal(f.state.queries, 0);
});

test('hints preserve source, translation and class order with live language and raw profile result', () => {
  const f = fixture(); assert.equal(f.view.hint('first'), undefined);
  assert.deepEqual(f.events, ['get:hint','source','translate','text','class']); assert.equal(f.state.source, 'first');
  assert.equal(f.state.text, 'en:first'); assert.equal(f.state.errorClass, false);
  f.state.language = 'ja'; f.state.active = true; f.events.length = 0;
  assert.equal(f.view.hint('second', 'error'), 'measured'); assert.equal(f.state.text, 'ja:second'); assert.equal(f.state.errorClass, true);
  assert.deepEqual(f.events, ['profile','get:hint','source','translate','text','class']);
});

test('solve output uses the same pure formatter and fresh duplicate count without changing supplied results', () => {
  const f = fixture(), solved = Object.freeze({ success: true }), analysis = Object.freeze({ analysis: Object.freeze({ stable: true }) });
  f.state.duplicates = 1; f.state.active = true;
  assert.equal(f.view.solveResult('custom', solved, analysis, null), undefined);
  assert.equal(f.state.source, f.view.constraints.resultHint('custom', solved, analysis, null, 1).message); assert.equal(f.state.errorClass, true);
  f.state.duplicates = 0; f.state.language = 'ja'; f.view.solveResult('custom', solved, analysis, null);
  assert.equal(f.state.source, 'customが完了しました'); assert.equal(f.state.errorClass, false);
  assert.equal(f.view.constraints.localizedConstraintName('平行', { typeOnly: true }), '平行');
});

test('translation, missing DOM and measurement errors retain their original partial output and stop later work', () => {
  const f = fixture(), marker = new Error('original failure'); f.state.translationFailure = marker;
  assert.throws(() => f.view.hint('new source'), error => error === marker);
  assert.deepEqual(f.events, ['get:hint','source','translate']); assert.equal(f.state.source, 'new source');
  assert.equal(f.state.text, 'old'); assert.equal(f.state.errorClass, true);
  f.state.active = true; f.state.profileFailure = marker; f.events.length = 0;
  assert.throws(() => f.view.hint('not written'), error => error === marker); assert.deepEqual(f.events, ['profile']); assert.equal(f.state.source, 'new source');
  f.state.active = false; delete f.elements.hint; f.events.length = 0;
  assert.throws(() => f.view.hint('missing'), error => error.name === 'TypeError'); assert.deepEqual(f.events, ['get:hint']);
});
