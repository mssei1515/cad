/* Synchronous, opt-in interaction timing without DOM or model dependencies. */
(function () {
  "use strict";

  function create(now = () => performance.now()) {
    let interactionProfile = null;
    let interactionProfileFrame = null;

    // Test-enabled synchronous timings. Subtract nested work to avoid counting it twice.
    function work(category, callback) {
      const parent = interactionProfileFrame;
      if (!parent) return callback();
      const frame = { sample: parent.sample, childMs: 0 };
      const startedAt = now();
      interactionProfileFrame = frame;
      try {
        return callback();
      } finally {
        const elapsedMs = now() - startedAt;
        const entry = frame.sample.work[category] ||= { calls: 0, selfMs: 0 };
        entry.calls += 1;
        entry.selfMs += Math.max(0, elapsedMs - frame.childMs);
        parent.childMs += elapsedMs;
        interactionProfileFrame = parent;
      }
    }

    function phase(phase, callback) {
      if (!interactionProfile) return callback();
      const sample = { work: {} };
      const parent = interactionProfileFrame;
      const frame = { sample, childMs: 0 };
      const startedAt = now();
      interactionProfileFrame = frame;
      try {
        return callback();
      } finally {
        const elapsedMs = now() - startedAt;
        const total = interactionProfile[phase] ||= { samples: 0, totalMs: 0, maxMs: 0, otherMs: 0, work: {} };
        total.samples += 1;
        total.totalMs += elapsedMs;
        total.maxMs = Math.max(total.maxMs, elapsedMs);
        total.otherMs += Math.max(0, elapsedMs - frame.childMs);
        for (const [category, entry] of Object.entries(sample.work)) {
          const aggregate = total.work[category] ||= { calls: 0, selfMs: 0 };
          aggregate.calls += entry.calls;
          aggregate.selfMs += entry.selfMs;
        }
        if (parent) parent.childMs += elapsedMs;
        interactionProfileFrame = parent;
      }
    }

    return Object.freeze({
      get active() { return interactionProfileFrame !== null; },
      start() { interactionProfile = {}; },
      stop() {
        const result = interactionProfile;
        interactionProfile = null;
        return result;
      },
      work,
      phase,
    });
  }

  window.InteractionProfiler = Object.freeze({ create });
})();
