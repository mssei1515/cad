const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('src/ui/constraint_feedback.js', 'utf8'), sandbox);
const feedback = language => sandbox.window.ConstraintFeedback.create({ applicationText: (ja, en) => language === 'en' ? en : ja, readLanguage: () => language });
const stable = { analysis: { stable: true } };

test('solve feedback distinguishes success, unstable results, dependent failure and duplicate constraints', () => {
  const f = feedback('en');
  assert.equal(f.resultHint('線追加', { success: true }, stable, null, 0).message, 'Polyline creation completed');
  for (const [analysis, dependent, count] of [[{}, null, 0], [stable, { success: false }, 0], [stable, null, 1]]) {
    const result = f.resultHint('線追加', { success: true }, analysis, dependent, count);
    assert.equal(result.kind, 'error'); assert.equal(result.message, 'Polyline creation completed. Check the constraint status');
  }
  const failed = f.resultHint('線追加', { success: false }, stable, null, 0);
  assert.equal(failed.kind, 'error'); assert.equal(failed.message, 'Polyline creation could not be completed. Check the constraints and geometry');
  assert.equal(f.resultHint('custom', { success: true }, stable, null, 0).message, 'custom completed');
  assert.equal(f.resultHint('線追加', { success: true }, stable, null, 0).kind, 'normal');
});

test('Japanese operation labels and fallback preserve user-facing wording', () => {
  const f = feedback('ja');
  assert.equal(f.resultHint('点追加', { success: true }, stable, null, 0).message, '点の追加が完了しました');
  assert.equal(f.resultHint('custom', null, null, null, 0).message, 'customを完了できませんでした。拘束や形状を確認してください');
  assert.equal(f.constraintStatusBadge('support'), '支持位置拘束');
  assert.equal(feedback('en').constraintStatusBadge('under'), 'Under-constrained');
  assert.equal(f.constraintStatusBadge('unknown'), '完全拘束');
});

test('constraint summary includes only positive diagnostic counts and never changes supplied counts', () => {
  const f = feedback('en'), counts = Object.freeze({ full: 2, support: 3, under: 4, conflict: 1 });
  assert.equal(f.summaryText(counts, 2, 5, 'en'), 'Fully constrained: 2 / Supported position: 3 / Under-constrained: 4 / Conflict: 1 / Duplicate constraints: 2 / Reference errors: 5');
  assert.equal(f.summaryText(counts, 0, 0, 'ja'), '完全拘束: 2 / 支持位置拘束: 3 / 未拘束: 4 / 矛盾: 1');
  assert.equal(f.summaryText(counts, 1, 2, 'ja'), '完全拘束: 2 / 支持位置拘束: 3 / 未拘束: 4 / 矛盾: 1 / 重複拘束: 1 / 参照エラー: 2');
});


test('dimension target feedback uses the supplied operand kind without touching the operand list', () => {
 const f = feedback('en'); const operands = [{ kind: 'line' }]; const first = operands[0];
 assert.match(f.targetHint('distance', operands, 'en'), /second line/);
 assert.match(f.targetHint('distance', [{ kind: 'primitive' }], 'en'), /radius-difference/);
 assert.equal(f.targetHint('distance', [], 'en'), 'Select dimension targets.');
 assert.equal(operands[0], first); assert.equal(operands.length, 1);
});
test('symmetry feedback follows axis and matching subject stages in each language', () => {
 for (const language of ['ja', 'en']) {
  const f = feedback(language);
  assert.match(f.targetHint('symmetry', [], language), language === 'en' ? /axis/ : /対称軸/);
  for (const [kind, en, ja] of [['line', 'line', '線'], ['primitive', 'arc', '円弧'], ['point', 'point', '点']]) {
   const operands = [{ kind: 'line' }, { kind }];
   assert.match(f.targetHint('symmetry', operands, language), new RegExp(language === 'en' ? en : ja));
   assert.match(f.invalidTargetHint('symmetry', operands, language), new RegExp(language === 'en' ? en : ja));
  }
 }
});
test('fallback label is read only for generic guidance and rejection needs no DOM or label', () => {
 const f = feedback('en'); let reads = 0; const label = () => { reads++; return 'Custom'; };
 f.targetHint('fixed', [], 'en', label); assert.equal(reads, 0);
 assert.equal(f.targetHint('custom', [], 'en', label), 'Select targets for Custom.'); assert.equal(reads, 1);
 assert.equal(f.invalidTargetHint('custom', [], 'en'), 'The current selection cannot be used for this constraint.');
 assert.equal(feedback('ja').invalidTargetHint('custom', [], 'ja'), 'この拘束では選択できません');
});

test('localized constraint names preserve specific-prefix priority, suffixes, type-only names and unknown fallbacks', () => {
  const en = feedback('en'), ja = feedback('ja');
  assert.equal(en.localizedConstraintName('円弧端点-円周一致 A1'), 'Arc endpoint on circumference A1');
  assert.equal(en.localizedConstraintName('水平寸法 P1/P2'), 'Horizontal dimension P1/P2');
  assert.equal(en.localizedConstraintName('水平寸法 P1/P2', { typeOnly: true }), 'Horizontal dimension');
  assert.equal(ja.localizedConstraintName('点水平 P1/P2'), '点水平 P1/P2');
  assert.equal(ja.localizedConstraintName('点水平 P1/P2', { typeOnly: true }), '点水平');
  for (const name of ['Custom constraint α/β', 'Arc endpoint fixedness']) {
    for (const f of [en, ja]) for (const typeOnly of [true, false]) assert.equal(f.localizedConstraintName(name, { typeOnly }), name);
  }
  assert.equal(en.localizedConstraintName(''), 'Constraint'); assert.equal(ja.localizedConstraintName(null), '拘束');
});

test('constraint name presentation reads current language and preserves the English fixed-endpoint special case', () => {
  let language = 'ja', reads = 0;
  const f = sandbox.window.ConstraintFeedback.create({ applicationText: (ja, en) => language === 'en' ? en : ja,
    readLanguage: () => { reads++; return language; } });
  assert.equal(reads, 0);
  assert.equal(f.localizedConstraintName('水平寸法 P1/P2', { typeOnly: true }), '水平寸法');
  language = 'en';
  assert.equal(f.localizedConstraintName('水平寸法 P1/P2', { typeOnly: true }), 'Horizontal dimension');
  assert.equal(f.localizedConstraintName('Arc endpoint fixed A1', { typeOnly: true }), 'Arc endpoint fixed');
  language = 'ja';
  assert.equal(f.localizedConstraintName('Arc endpoint fixed A1', { typeOnly: true }), '円弧端点固定');
  assert.equal(f.localizedConstraintName('Arc endpoint fixed A1'), 'Arc endpoint fixed A1');
});
