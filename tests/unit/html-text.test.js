const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/ui/html_text.js','utf8'),sandbox);
const { escapeHtml } = sandbox.window.HtmlText;
test('HTML text encoding retains nullish and scalar values, five special characters and existing entity text',()=>{
  assert.equal(escapeHtml('<p title="x">A & B</p>'),'&lt;p title=&quot;x&quot;&gt;A &amp; B&lt;/p&gt;');
  assert.equal(escapeHtml("it's"),'it&#39;s');assert.equal(escapeHtml('&amp;'),'&amp;amp;');
  for(const value of [null,undefined])assert.equal(escapeHtml(value),'');
  assert.equal(escapeHtml(0),'0');assert.equal(escapeHtml(false),'false');assert.equal(escapeHtml(Symbol('name')),'Symbol(name)');
  const text = '日本語 📝' + String.fromCharCode(10); assert.equal(escapeHtml(text),text);
});
test('HTML text encoding converts the supplied value once and propagates its original exception',()=>{
  const calls=[],value={ [Symbol.toPrimitive](hint){calls.push(hint);return '<&>';}};
  assert.equal(escapeHtml(value),'&lt;&amp;&gt;');assert.deepEqual(calls,['string']);
  const marker=new Error('text conversion');assert.throws(()=>escapeHtml({toString(){throw marker;}}),error=>error===marker);
});
