/* geometry_ref.js: Pure, immutable references to direct and projected geometry. */
(function () {
  "use strict";

  const KINDS = Object.freeze(["point", "line", "circle", "arc"]);
  const KIND_SET = new Set(KINDS);
  const EMPTY_PATH = Object.freeze([]);

  function normalizePath(pathOrId) {
    let source = null;
    if (Array.isArray(pathOrId)) source = pathOrId;
    else if (typeof pathOrId === "string" || typeof pathOrId === "number") source = String(pathOrId).split("@");
    if (!source || source.length === 0) return null;
    const path = source.map((segment) => segment == null ? "" : String(segment));
    if (path.some((segment) => segment.length === 0)) return null;
    return Object.freeze(path);
  }

  function create(kind, pathOrId) {
    if (!KIND_SET.has(kind)) return null;
    const path = normalizePath(pathOrId);
    if (!path) return null;
    return Object.freeze({ kind, path });
  }

  function parseId(kind, id) {
    return create(kind, id);
  }

  function parseKey(value) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const serialized = String(value);
    const separator = serialized.indexOf(":");
    if (separator <= 0 || separator === serialized.length - 1) return null;
    return create(serialized.slice(0, separator), serialized.slice(separator + 1));
  }

  function valid(ref) {
    return Boolean(
      ref &&
      KIND_SET.has(ref.kind) &&
      Array.isArray(ref.path) &&
      ref.path.length > 0 &&
      ref.path.every((segment) => typeof segment === "string" && segment.length > 0),
    );
  }

  function id(ref) {
    return valid(ref) ? ref.path.join("@") : null;
  }

  function key(ref) {
    const serializedId = id(ref);
    return serializedId == null ? null : `${ref.kind}:${serializedId}`;
  }

  function equals(a, b) {
    if (a === b) return valid(a);
    if (!valid(a) || !valid(b) || a.kind !== b.kind || a.path.length !== b.path.length) return false;
    return a.path.every((segment, index) => segment === b.path[index]);
  }

  function resolve(ref, lookup) {
    const canonicalId = id(ref);
    if (canonicalId == null || typeof lookup !== "function") return null;
    return lookup(ref.kind, canonicalId) ?? null;
  }

  function ancestorInstanceIds(ref) {
    if (!valid(ref) || ref.path.length === 1) return EMPTY_PATH;
    return Object.freeze(ref.path.slice(0, -1));
  }

  function ownerInstanceId(ref) {
    return valid(ref) && ref.path.length > 1 ? ref.path[0] : null;
  }

  function localElementId(ref) {
    return valid(ref) ? ref.path[ref.path.length - 1] : null;
  }

  window.GeometryRef = Object.freeze({
    KINDS,
    create,
    parseId,
    parseKey,
    id,
    key,
    equals,
    resolve,
    ancestorInstanceIds,
    ownerInstanceId,
    localElementId,
  });
})();
