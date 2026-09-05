const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../interaction_profiler.js"), "utf8"), sandbox);
const { create } = sandbox.window.InteractionProfiler;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("disabled profiling passes through results and exceptions without reading the clock", () => {
  const profiler = create(() => { throw Error("clock must not be read"); });
  const result = {};
  assert.equal(profiler.phase("preview", () => profiler.work("draw", () => result)), result);
  const error = Error("callback failed");
  assert.throws(() => profiler.phase("commit", () => { throw error; }), (caught) => caught === error);
  assert.equal(profiler.active, false);
  assert.equal(profiler.stop(), null);
});

test("nested work counts exclusive time and aggregates repeated phases", () => {
  let time = 0;
  const profiler = create(() => time);
  profiler.start();
  assert.equal(profiler.work("outside", () => 42), 42);
  profiler.phase("preview", () => {
    assert.equal(profiler.active, true);
    time += 2;
    profiler.work("ui", () => {
      time += 3;
      profiler.work("ui", () => { time += 4; });
      profiler.work("draw", () => { time += 5; });
      time += 1;
    });
    time += 2;
  });
  profiler.phase("preview", () => { time += 6; });
  assert.equal(profiler.active, false);
  assert.deepEqual(plain(profiler.stop()), {
    preview: { samples: 2, totalMs: 23, maxMs: 17, otherMs: 10,
      work: { ui: { calls: 2, selfMs: 8 }, draw: { calls: 1, selfMs: 5 } } },
  });
});

test("profiling restores the parent after an exception and keeps later samples usable", () => {
  let time = 0;
  const profiler = create(() => time);
  const error = Error("work failed");
  profiler.start();
  assert.throws(() => profiler.phase("commit", () => profiler.work("solve", () => {
    time += 5;
    throw error;
  })), (caught) => caught === error);
  assert.equal(profiler.active, false);
  profiler.phase("commit", () => { time += 3; });
  assert.deepEqual(plain(profiler.stop()), {
    commit: { samples: 2, totalMs: 8, maxMs: 5, otherMs: 3, work: { solve: { calls: 1, selfMs: 5 } } },
  });
  profiler.start();
  assert.deepEqual(plain(profiler.stop()), {});
});

test("separate profiler instances do not share activation or accumulated samples", () => {
  let time = 0;
  const first = create(() => time);
  const second = create(() => { throw Error("inactive clock"); });
  first.start();
  first.phase("preview", () => {
    assert.equal(second.active, false);
    second.phase("preview", () => { time += 2; });
  });
  assert.equal(first.stop().preview.totalMs, 2);
  assert.equal(second.stop(), null);
});
