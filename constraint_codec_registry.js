/* constraint_codec_registry.js: Immutable class/type dispatch for persistent constraint codecs. */
(function () {
  "use strict";

  function create(definitions) {
    if (!Array.isArray(definitions)) throw new TypeError("Constraint codec definitions must be an array");

    const seenTypes = new Set();
    const seenClasses = new Set();
    const codecs = definitions.map((definition, index) => {
      if (!definition || typeof definition !== "object") throw new TypeError(`Constraint codec at index ${index} must be an object`);
      const { type, constraintClass, serialize, deserialize } = definition;
      if (typeof type !== "string" || type.trim().length === 0) throw new TypeError(`Constraint codec at index ${index} requires a non-empty type`);
      if (typeof constraintClass !== "function") throw new TypeError(`Constraint codec ${type} requires a constraint class`);
      if (typeof serialize !== "function") throw new TypeError(`Constraint codec ${type} requires serialize`);
      if (typeof deserialize !== "function") throw new TypeError(`Constraint codec ${type} requires deserialize`);
      if (seenTypes.has(type)) throw new Error(`Duplicate type in constraint codec registry: ${type}`);
      if (seenClasses.has(constraintClass)) throw new Error(`Duplicate class in constraint codec registry: ${constraintClass.name || type}`);
      seenTypes.add(type);
      seenClasses.add(constraintClass);
      return Object.freeze({ ...definition, type, constraintClass, serialize, deserialize });
    });

    const frozenCodecs = Object.freeze(codecs);
    const types = Object.freeze(codecs.map((codec) => codec.type));
    const codecsByType = new Map(codecs.map((codec) => [codec.type, codec]));

    function codecForType(type) {
      return codecsByType.get(type) || null;
    }

    function codecForConstraint(constraint) {
      if (!constraint) return null;
      return codecs.find((codec) => constraint instanceof codec.constraintClass) || null;
    }

    function serialize(constraint, context) {
      const codec = codecForConstraint(constraint);
      if (!codec) return null;
      const payload = codec.serialize(constraint, context);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
      const data = { type: codec.type };
      for (const [key, value] of Object.entries(payload)) {
        if (key !== "type") data[key] = value;
      }
      return data;
    }

    function deserialize(data, context) {
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      const codec = codecForType(data.type);
      return codec ? codec.deserialize(data, context) : null;
    }

    return Object.freeze({
      codecs: frozenCodecs,
      types,
      codecForType,
      codecForConstraint,
      serialize,
      deserialize,
    });
  }

  window.ConstraintCodecRegistry = Object.freeze({ create });
})();
