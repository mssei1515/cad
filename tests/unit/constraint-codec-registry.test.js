const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadConstraintCodecRegistry() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../constraint_codec_registry.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "constraint_codec_registry.js" });
  return sandbox.window.ConstraintCodecRegistry;
}

class AlphaConstraint {
  constructor(value) {
    this.value = value;
  }
}

class BetaConstraint {}
class UnknownConstraint {}

function definitions() {
  return [
    {
      type: "alpha",
      constraintClass: AlphaConstraint,
      serialize(constraint, context) {
        return { type: "ignored", value: constraint.value, context: context.name };
      },
      deserialize(data, context) {
        return new AlphaConstraint(`${data.value}:${context.name}`);
      },
    },
    {
      type: "beta",
      constraintClass: BetaConstraint,
      serialize() {
        return {};
      },
      deserialize() {
        return new BetaConstraint();
      },
    },
  ];
}

test("registry dispatches serialization by class and preserves canonical type first", () => {
  const registry = loadConstraintCodecRegistry().create(definitions());
  const constraint = new AlphaConstraint("value");
  const context = { name: "serialize-context" };

  assert.equal(registry.codecForConstraint(constraint).type, "alpha");
  assert.deepEqual(Array.from(registry.types), ["alpha", "beta"]);
  const serialized = registry.serialize(constraint, context);
  assert.deepEqual(Object.keys(serialized), ["type", "value", "context"]);
  assert.deepEqual({ ...serialized }, { type: "alpha", value: "value", context: "serialize-context" });
});

test("registry dispatches deserialization by stored type and forwards context", () => {
  const registry = loadConstraintCodecRegistry().create(definitions());
  const context = { name: "deserialize-context" };

  assert.equal(registry.codecForType("alpha").constraintClass, AlphaConstraint);
  const restored = registry.deserialize({ type: "alpha", value: "saved" }, context);
  assert.equal(restored instanceof AlphaConstraint, true);
  assert.equal(restored.value, "saved:deserialize-context");
});

test("registry returns null for unknown runtime classes and stored types", () => {
  const registry = loadConstraintCodecRegistry().create(definitions());

  assert.equal(registry.codecForConstraint(new UnknownConstraint()), null);
  assert.equal(registry.codecForType("unknown"), null);
  assert.equal(registry.serialize(new UnknownConstraint(), {}), null);
  assert.equal(registry.deserialize({ type: "unknown" }, {}), null);
  assert.equal(registry.deserialize(null, {}), null);
});

test("registry rejects invalid definitions and exposes immutable metadata", () => {
  const factory = loadConstraintCodecRegistry();
  assert.throws(() => factory.create(null), /array/i);
  assert.throws(() => factory.create([{ ...definitions()[0], type: "" }]), /type/i);
  assert.throws(() => factory.create([{ ...definitions()[0], serialize: null }]), /serialize/i);
  assert.throws(() => factory.create([{ ...definitions()[0], deserialize: null }]), /deserialize/i);
  assert.throws(() => factory.create([definitions()[0], { ...definitions()[1], type: "alpha" }]), /duplicate type/i);
  assert.throws(() => factory.create([definitions()[0], { ...definitions()[1], constraintClass: AlphaConstraint }]), /duplicate class/i);

  const registry = factory.create(definitions());
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(registry.types), true);
  assert.equal(Object.isFrozen(registry.codecs), true);
  assert.equal(registry.codecs.every(Object.isFrozen), true);
});
