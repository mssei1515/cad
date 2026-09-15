const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../src/document/drawing_order.js"), "utf8"), sandbox);
const order = sandbox.window.DrawingOrder;
const item = (id, drawingOrder, sketchId = "S1") => ({ id, drawingOrder, sketchId });
const ids = (scope) => Array.from(order.drawingOrderItemsForScope(scope, "S1")).sort((a, b) => a.drawingOrder - b.drawingOrder).map((entry) => entry.id);

test("legacy drawing order preserves type order and normalizes each sketch independently", () => {
  const other = item("other", 0, "S2");
  const scope = { hatches: [item("h")], lines: [item("l"), other], circles: [item("c")], arcs: [item("a")], splines: [item("s")], blockInstances: [item("b")], geometryInstances: [item("g")], points: [item("p")], annotations: [item("text")] };
  assert.equal(order.ensureDrawingOrderState(scope), scope);
  assert.deepEqual(ids(scope), ["h", "l", "c", "a", "s", "b", "g"]);
  assert.equal(other.drawingOrder, 0);
  assert.equal(scope.points[0].drawingOrder, undefined);
  const snapshot = JSON.stringify(scope);
  order.ensureDrawingOrderState(scope);
  assert.equal(JSON.stringify(scope), snapshot);
});

test("partial and duplicate orders keep stable relative order with missing hatches behind", () => {
  const scope = { hatches: [item("missing-hatch"), item("ordered-hatch", 8)], lines: [item("line", 3), item("tie", 3), item("missing-line", -1)], circles: [item("invalid", "0")] };
  order.ensureDrawingOrderState(scope);
  assert.deepEqual(ids(scope), ["missing-hatch", "line", "tie", "ordered-hatch", "missing-line", "invalid"]);
});

test("projection owners deduplicate and ignore other scopes and unsupported objects", () => {
  const block = item("b", 0), derived = item("g", 1), other = item("other", 0, "S2");
  const scope = { blockInstances: [block], geometryInstances: [derived], lines: [other] };
  const candidates = [{ blockInstance: block }, block, { derivedInstance: derived }, other, item("foreign", 10), null];
  assert.deepEqual(Array.from(order.ownersForScope(scope, "S1", candidates)), [block, derived]);
  assert.equal(order.topmostOwner(scope, "S1", candidates), derived);
});

for (const [action, expected] of [
  ["drawing-front", ["a", "d", "b", "c"]],
  ["drawing-back", ["b", "c", "a", "d"]],
  ["drawing-forward", ["a", "d", "b", "c"]],
  ["drawing-backward", ["b", "c", "a", "d"]],
]) {
  test(`${action} moves a group without changing identities or another sketch`, () => {
    const lines = ["a", "b", "c", "d"].map((id, index) => item(id, index));
    const other = item("other", 0, "S2");
    const scope = { lines: [...lines, other] };
    assert.equal(order.reorder(scope, "S1", [lines[1], lines[2]], action), true);
    assert.deepEqual(ids(scope), expected);
    assert.equal(scope.lines[1], lines[1]);
    assert.deepEqual(other, item("other", 0, "S2"));
  });
}

test("command availability and boundary/no-selection results match reorder behavior", () => {
  const a = item("a", 0), b = item("b", 1), c = item("c", 2), d = item("d", 3);
  const scope = { lines: [a, b, c, d] };
  assert.deepEqual({ ...order.commandState(scope, "S1", [a]) }, { count: 1, canForward: true, canBackward: false });
  assert.deepEqual({ ...order.commandState(scope, "S1", [d]) }, { count: 1, canForward: false, canBackward: true });
  assert.equal(order.reorder(scope, "S1", [], "drawing-front"), false);
  assert.equal(order.reorder(scope, "S1", [a], "unknown"), false);
  assert.equal(order.reorder(scope, "S1", [d], "drawing-forward"), true);
  assert.deepEqual(ids(scope), ["a", "b", "c", "d"]);
  order.reorder(scope, "S1", [a, c], "drawing-forward");
  assert.deepEqual(ids(scope), ["b", "a", "d", "c"]);
});
