/**
 * IR type metadata — JS mirror of scientific/registry/builtin_*.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/gen_parity_fixtures.py && python scripts/sync_schema_types.py
 *
 * Golden-tested against services/api/tests/fixtures/ir/type-metadata.json.
 * Drives validation and the generic frontend inspector (GET /api/ir/schema).
 */

'use strict';

import { CORE } from './types/core.js';import { MATH } from './types/math.js';import { MATHEXT } from './types/mathext.js';import { GRAPHS } from './types/graphs.js';import { BIOLOGY } from './types/biology.js';import { KINEMATICS } from './types/kinematics.js';import { ATTENTION } from './types/attention.js';import { PRESENTATION } from './types/presentation.js';
const TYPES = [
  ...CORE,
  ...MATH,
  ...MATHEXT,
  ...GRAPHS,
  ...BIOLOGY,
  ...KINEMATICS,
  ...ATTENTION,
  ...PRESENTATION
];

const byKey = Object.fromEntries(TYPES.map((t) => [t.key, t]));

function typeEntry (key) {
  const entry = byKey[key];
  if (!entry) {
    const err = new Error(
      `Unknown object type '${key}'. Register it via ` +
      'scientific.registry.register_type() before use.');
    err.code = 'UNKNOWN_TYPE';
    throw err;
  }
  return entry;
}

function describeTypes () {
  return TYPES.map(({ key, label, category, dimensionality, description,
    properties }) => (
    { key, label, category, dimensionality, description, properties }
  ));
}

export { TYPES, byKey, typeEntry, describeTypes };
export default TYPES;
