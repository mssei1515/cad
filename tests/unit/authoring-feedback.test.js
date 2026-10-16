const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/authoring_feedback.js'), 'utf8'), sandbox);
function fixture() {
  const state = { language: 'en', reads: 0 };
  const feedback = sandbox.window.AuthoringFeedback.create({ applicationText: (ja, en) => { state.reads++; return state.language === 'en' ? en : ja; } });
  return { state, feedback };
}

test('Hatch diagnostics retain known messages and reason fallback with live language and no result mutation', () => {
  const { state, feedback } = fixture(); assert.equal(state.reads, 0);
  const result = Object.freeze({ code: 'point-on-boundary', reason: 'Ignored detail for a known code' });
  assert.equal(feedback.hatchRegionErrorText(result), 'Click inside the region, away from its boundary');
  assert.equal(feedback.hatchRegionErrorText({ code: 'unknown', reason: 'Detailed region failure' }), 'Detailed region failure');
  assert.equal(feedback.hatchRegionErrorText({ code: 'unknown', reason: '' }), 'Could not detect a closed region');
  assert.equal(feedback.hatchRegionErrorText(null), 'Could not detect a closed region');
  state.language = 'ja';
  assert.equal(feedback.hatchRegionErrorText({ code: 'missing-boundary' }), '境界図形が見つかりません');
  assert.equal(feedback.hatchRegionErrorText({ code: 'unknown', reason: 'English detail' }), '閉領域を判定できません');
  assert.equal(result.code, 'point-on-boundary'); assert.equal(result.reason, 'Ignored detail for a known code');
});

test('Offset diagnostics retain their generic unknown-code fallback and follow later language changes', () => {
  const { state, feedback } = fixture();
  const result = Object.freeze({ code: 'collapsed-radius', reason: 'Unchanged source detail' });
  assert.equal(feedback.offsetChainErrorText(result), 'An arc radius collapses at this offset distance');
  assert.equal(feedback.offsetChainErrorText({ code: 'unknown', reason: 'Must not replace the existing generic message' }), 'The chain cannot be offset');
  assert.equal(feedback.offsetChainErrorText(undefined), 'The chain cannot be offset');
  state.language = 'ja';
  assert.equal(feedback.offsetChainErrorText({ code: 'missing-miter' }), '角部をマイター接続できません');
  assert.equal(feedback.offsetChainErrorText({ code: 'unknown' }), 'チェーンをオフセットできません');
  assert.equal(result.reason, 'Unchanged source detail');
});
