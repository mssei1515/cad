const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('src/ui/constraint_feedback.js', 'utf8'), sandbox);
const feedback = language => sandbox.window.ConstraintFeedback.create({ applicationText: (ja, en) => language === 'en' ? en : ja });
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
