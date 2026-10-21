/* Synchronize the legacy command scope and Solver after Workspace activation. */
(() => {
  "use strict";
  function create({ workspace, Solver, closeSketchContext, resetSketchMove, clearGeometryReads, invalidateProjection }) {
    // Workspace restoration can precede command teardown; keep the last bound scope until activation succeeds.
    let current = workspace.current();
    const solver = new Solver(current);
    function activate(scope) {
      closeSketchContext();
      resetSketchMove();
      current = workspace.activate(scope);
      solver.model = current;
      clearGeometryReads();
      invalidateProjection();
      return current;
    }
    return Object.freeze({ solver, get current() { return current; }, activate });
  }
  window.EditingScopeBinding = Object.freeze({ create });
})();
