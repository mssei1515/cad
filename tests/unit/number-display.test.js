const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/number_display.js'), 'utf8'), sandbox);
const { formatDisplayNumber, formatDimensionLabel, formatMeasuredDimensionLabel } = sandbox.window.NumberDisplay;

test('automatic numeric display removes floating-point noise while retaining supported small values and fractions', () => {
  for (const [value, expected] of [[140, '140'], [100, '100'], [15.0000000058, '15'], [824.9999999982, '825'],
    [1844.999999, '1845'], [0.000001, '0.000001'], [1.2345674, '1.234567'], [-15.0000000058, '-15']]) {
    assert.equal(formatDisplayNumber(value), expected);
  }
});

test('measured dimensions use the wider tolerance and both dimension labels preserve the supplied suffix', () => {
  assert.equal(formatDimensionLabel(1844.9999986000548), '1844.999999');
  assert.equal(formatMeasuredDimensionLabel(1844.9999986000548), '1845');
  assert.equal(formatDimensionLabel(1.000005, '°'), '1.000005°');
  assert.equal(formatMeasuredDimensionLabel(1.000005, '°'), '1°');
  assert.equal(formatMeasuredDimensionLabel(0.000001), '0.000001');
});

test('number formatting handles finite conversion, digit bounds, optional tolerance and negative zero', () => {
  for (const value of [NaN, Infinity, -Infinity, 'invalid']) assert.equal(formatDisplayNumber(value), '');
  assert.equal(formatDisplayNumber('2.50'), '2.5');
  assert.equal(formatDisplayNumber(-0), '0');
  assert.equal(formatDisplayNumber(1.234, 2), '1.23');
  assert.equal(formatDisplayNumber(1.234, -3), '1');
  assert.equal(formatDisplayNumber(1.23456789123, 99, 0), '1.2345678912');
  assert.equal(formatDisplayNumber(1.0000001), '1');
  assert.equal(formatDisplayNumber(1.0000001, 10, 0), '1.0000001');
});
