/**
 * Compiler Registry Core
 *
 * Generic, data-driven registries that decouple the compiler from any
 * hardcoded set of object types, animations, or scene types.
 *
 * Extension contract (see docs/development/architecture/ARCHITECTURE.md):
 *   - Adding a new object type  -> registry/objects.js   (registerObjectType)
 *   - Adding a new animation    -> registry/animations.js (registerAnimation)
 *   - Adding a new scene type   -> registry/scenes.js     (registerSceneType)
 *
 * Nothing outside the registry modules needs to change when a new
 * capability is registered. Duplicate registration of the same key is
 * rejected so two plugins can never silently compete for one concept.
 */

/**
 * Create a fresh registry instance.
 * @param {string} kind Human-readable registry kind (for error messages)
 */
export function createRegistry(kind) {
  const entries = new Map();

  return {
    kind,

    /** Register an entry. Throws on duplicate keys (no silent overrides). */
    register(key, entry) {
      if (!key || typeof key !== 'string') {
        throw new Error(`[${kind} registry] invalid key: ${JSON.stringify(key)}`);
      }
      if (entries.has(key)) {
        throw new Error(`[${kind} registry] duplicate key "${key}" — refusing to override an existing registration`);
      }
      entries.set(key, Object.freeze({ ...entry, key }));
      return this;
    },

    /** Get an entry by key, or undefined. */
    get(key) {
      return entries.get(key);
    },

    /** Get an entry or throw a descriptive error (used by codegen paths). */
    require(key) {
      const e = entries.get(key);
      if (!e) {
        throw new Error(`[${kind} registry] unknown key "${key}"`);
      }
      return e;
    },

    /** Check existence. */
    has(key) {
      return entries.has(key);
    },

    /** All registered keys. */
    keys() {
      return [...entries.keys()];
    },

    /** All entries (insertion order). */
    list() {
      return [...entries.values()];
    },

    /** Snapshot for JSON serialization (API capability discovery). */
    describe() {
      return {
        kind,
        count: entries.size,
        keys: [...entries.keys()]
      };
    }
  };
}

/**
 * Central registry hub shared by the compiler.
 * Single source of truth — no duplicate competing systems for one concept.
 */
export const registries = {
  objects: createRegistry('object-type'),
  animations: createRegistry('animation'),
  scenes: createRegistry('scene-type')
};

/**
 * Capability snapshot for API consumers / frontend discovery.
 * Exposed via GET /api/capabilities.
 */
export function describeCapabilities() {
  return {
    objectTypes: registries.objects.describe().keys,
    animations: {
      enter: registries.animations.list().filter(a => a.phase === 'enter').map(a => a.name),
      exit: registries.animations.list().filter(a => a.phase === 'exit').map(a => a.name),
      clips: registries.animations.list().filter(a => a.phase === 'clip').map(a => a.name)
    },
    sceneTypes: registries.scenes.list().map(s => ({
      key: s.key,
      label: s.label,
      baseClass: s.baseClass,
      dimensionality: s.dimensionality,
      supportsCamera: s.supportsCamera || []
    }))
  };
}
