/* Sequence recovery from decoded document scopes; no mutation or UI state. */
(() => {
  "use strict";
  const { nextSeq } = window.GeometryIds;

  function recover(model, definitions) {
    const scopes = [model, ...definitions];
    const collect = key => scopes.flatMap(scope => scope[key] || []);
    const geometry = Object.fromEntries(
      ["points", "lines", "circles", "arcs", "splines", "hatches", "referenceImages"]
        .map(key => [key, collect(key)]),
    );
    const instances = collect("geometryInstances");
    const blockElements = definitions.flatMap(definition =>
      ["points", "lines", "circles", "arcs", "splines"].flatMap(key => definition[key] || []));
    return {
      geometry,
      sketchSeq: nextSeq(collect("sketches"), "S"),
      annotationSeq: nextSeq(collect("annotations"), "AN"),
      hatchSeq: Math.max(nextSeq(geometry.hatches, "H"), ...scopes.map(scope => Number(scope.nextHatchIndex) || 1)),
      referenceImageSeq: nextSeq(geometry.referenceImages, "IMG"),
      blockDefinitionSeq: nextSeq(definitions, "B"),
      blockInstanceSeq: nextSeq(collect("blockInstances"), "BI"),
      sketchProjectionInstanceSeq: nextSeq(instances, "SPI"),
      freeInstanceSeq: nextSeq(instances, "FI"),
      mirrorInstanceSeq: nextSeq(instances, "MI"),
      patternInstanceSeq: nextSeq(instances, "PI"),
      blockElementSeq: Math.max(1, ...blockElements.map(element =>
        Number(/^(?:P|L|C|A|SP)(\d+)$/.exec(element.id || "")?.[1]) + 1 || 1)),
    };
  }

  window.DocumentSequences = Object.freeze({ recover });
})();
