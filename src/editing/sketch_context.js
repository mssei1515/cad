/* Active editing scope: Sketch normalization, membership and hierarchy queries. */
(function () {
  "use strict";
  const { ROOT_SKETCH_ID, DEFAULT_SKETCH_ID, DEFAULT_SKETCH_NAME } = window.SketchHierarchy;
  const { Line, Circle, Arc, Spline } = window.GeometrySolver;

  function create({ currentScope, constraintGraphNodes }) {
    function ensureSketchState() {
      window.SketchHierarchy.ensure(currentScope());
    }

    function isRootSketch(sketchOrId) {
      const sketch = typeof sketchOrId === "string" ? sketchById(sketchOrId) : sketchOrId;
      return sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID;
    }

    function isDrawableSketch(sketchOrId) {
      const sketch = typeof sketchOrId === "string" ? sketchById(sketchOrId) : sketchOrId;
      return Boolean(sketch && !isRootSketch(sketch));
    }

    function firstDrawableSketchId() {
      ensureSketchState();
      return currentScope().sketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
    }

    function sketchName(sketchId) {
      ensureSketchState();
      return currentScope().sketches.find((sketch) => sketch.id === sketchId)?.name || sketchId || DEFAULT_SKETCH_NAME;
    }

    function sketchById(sketchId) {
      ensureSketchState();
      return window.SketchHierarchy.sketchById(currentScope().sketches, sketchId);
    }

    function orderedSketches() {
      ensureSketchState();
      return window.SketchHierarchy.orderedSketches(currentScope().sketches);
    }

    function childSketchesOf(sketchId) {
      ensureSketchState();
      return window.SketchHierarchy.childSketchesOf(currentScope().sketches, sketchId);
    }

    function descendantSketchIds(sketchId) {
      ensureSketchState();
      return window.SketchHierarchy.descendantSketchIds(currentScope().sketches, sketchId);
    }

    function ancestorSketchIds(sketchId) {
      ensureSketchState();
      return window.SketchHierarchy.ancestorSketchIds(currentScope().sketches, sketchId);
    }

    function isReferenceSourceSketchId(referenceSketchId, subjectSketchId = activeSketchId()) {
      ensureSketchState();
      return window.SketchHierarchy.isReferenceSourceSketchId(currentScope().sketches, referenceSketchId, subjectSketchId);
    }

    function referenceSourceSketchIds(subjectSketchId = activeSketchId()) {
      ensureSketchState();
      return window.SketchHierarchy.referenceSourceSketchIds(currentScope().sketches, subjectSketchId);
    }

    function activeSketch() {
      ensureSketchState();
      return currentScope().sketches.find((sketch) => sketch.id === currentScope().activeSketchId) || currentScope().sketches.find((sketch) => isRootSketch(sketch)) || currentScope().sketches[0];
    }

    function activeSketchId() {
      return activeSketch().id;
    }

    function assignSketchId(item, sketchId = activeSketchId()) {
      const targetSketchId = isDrawableSketch(sketchId) ? sketchId : firstDrawableSketchId();
      if (item) item.sketchId = targetSketchId || activeSketchId();
      return item;
    }

    function elementSketchId(item) {
      ensureSketchState();
      if (!item) return activeSketchId();
      if (item.sketchId) return item.sketchId;
      if (item instanceof Line) return item.p1?.sketchId || item.p2?.sketchId || activeSketchId();
      if (item instanceof Circle || item instanceof Arc) return item.center?.sketchId || activeSketchId();
      if (item instanceof Spline) return item.fitPoints.find((point) => point?.sketchId)?.sketchId || activeSketchId();
      return activeSketchId();
    }

    function sameSketchElements(items, sketchId = activeSketchId()) {
      return items.filter(Boolean).every((item) => elementSketchId(item) === sketchId);
    }

    function isEditableSketchId(sketchId) {
      const id = sketchId || activeSketchId();
      return id === activeSketchId();
    }

    function sketchRelationToActive(sketchId) {
      const id = sketchId || activeSketchId();
      if (id === activeSketchId()) return "active";
      if (descendantSketchIds(activeSketchId()).includes(id)) return "descendant";
      if (isReferenceSourceSketchId(id)) return "reference";
      return "inactive";
    }

    function constraintSketchId(constraint) {
      ensureSketchState();
      if (!constraint) return activeSketchId();
      if (constraint.sketchId) return constraint.sketchId;
      const ids = [...new Set(constraintGraphNodes(constraint).map(elementSketchId).filter(Boolean))];
      return ids.length === 1 ? ids[0] : activeSketchId();
    }

    function isActiveSketchConstraint(constraint) {
      return constraintSketchId(constraint) === activeSketchId();
    }

    function constraintTargetsAreActive(constraint) {
      return sameSketchElements(constraintGraphNodes(constraint, { includeIntrinsicDependencies: false }), activeSketchId());
    }

    function constraintReferencesSketch(constraint, sketchId) {
      return constraintGraphNodes(constraint).some((node) => elementSketchId(node) === sketchId);
    }

    function wouldCreateSketchCycle(sketchId, parentSketchId) {
      ensureSketchState();
      return window.SketchHierarchy.wouldCreateSketchCycle(currentScope().sketches, sketchId, parentSketchId);
    }

    function sketchTreeRows() {
      ensureSketchState();
      return window.SketchHierarchy.sketchTreeRows(currentScope().sketches);
    }

    function isActiveSketchElement(item) {
      return elementSketchId(item) === activeSketchId();
    }

    function isEditableSketchElement(item) {
      return isEditableSketchId(elementSketchId(item));
    }

    function sketchRelationOfElement(item) {
      return sketchRelationToActive(elementSketchId(item));
    }

    return Object.freeze({
      ensureSketchState, isRootSketch, isDrawableSketch,
      firstDrawableSketchId, sketchName, sketchById,
      orderedSketches, childSketchesOf, descendantSketchIds,
      ancestorSketchIds, isReferenceSourceSketchId, referenceSourceSketchIds,
      activeSketch, activeSketchId, assignSketchId,
      elementSketchId, sameSketchElements, isEditableSketchId,
      sketchRelationToActive, constraintSketchId, isActiveSketchConstraint,
      constraintTargetsAreActive, constraintReferencesSketch, wouldCreateSketchCycle,
      sketchTreeRows, isActiveSketchElement, isEditableSketchElement,
      sketchRelationOfElement,
    });
  }
  window.SketchContext = Object.freeze({ create });
})();
