/**
 * Scientific IR tests (issue #32):
 *  - JS/Python emitter byte parity on golden fixtures
 *  - validation verdict parity on the shared corpus
 *  - type-metadata parity with the Python registry golden
 *  - /api/ir endpoints (supertest-style via the exported router)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { emitDocument } from '../src/ir/emitPython.js';
import { validateDocument } from '../src/ir/validate.js';
import { describeTypes } from '../src/ir/schemaTypes.js';
import { pyLiteral, formatFloat } from '../src/ir/literals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures', 'ir');

const readJson = (name) =>
  JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8'));
const readText = (name) =>
  readFileSync(path.join(FIXTURES, name), 'utf8');

// ─── emitter parity: byte-identical with the Python exporter ───────────
test('emitter produces byte-identical Python on golden fixtures', () => {
  const goldens = readdirSync(FIXTURES).filter((f) => f.endsWith('.py'));
  assert.ok(goldens.length >= 3, 'expected at least three golden fixtures');
  for (const golden of goldens) {
    const name = golden.replace(/\.py$/, '');
    const emitted = emitDocument(readJson(`${name}.json`));
    assert.equal(emitted, readText(golden),
      `emitter diverged from Python golden for ${name}`);
  }
});

// ─── validation parity on the shared corpus ────────────────────────────
test('validation verdicts match the shared corpus expectations', () => {
  const corpus = readJson('corpus.json');
  assert.ok(corpus.length >= 10, 'expected at least ten corpus cases');
  for (const entry of corpus) {
    const result = validateDocument(entry.document);
    assert.equal(result.valid, entry.expectValid,
      `corpus case '${entry.name}': expected valid=${entry.expectValid}, ` +
      `got ${result.valid} (${JSON.stringify(result.errors)})`);
  }
});

// ─── type metadata parity with the Python registry ─────────────────────
test('type metadata matches the Python registry golden', () => {
  const golden = readJson('type-metadata.json');
  const ours = describeTypes();
  // Array order is not semantic (registration order differs from the JS
  // category grouping) — compare as key-sorted maps.
  const byKey = (list) => Object.fromEntries(
    list.map((t) => [t.key, t]));
  assert.deepEqual(byKey(ours), byKey(golden));
  assert.equal(ours.length, golden.length);
});

// ─── literal formatting rules ───────────────────────────────────────────
test('pyLiteral follows the canonical formatting rules', () => {
  assert.equal(pyLiteral(null), 'None');
  assert.equal(pyLiteral(true), 'True');
  assert.equal(pyLiteral(false), 'False');
  assert.equal(pyLiteral(6.0), '6');           // integral floats -> int
  assert.equal(pyLiteral(6), '6');
  assert.equal(pyLiteral(0.1), '0.1');
  assert.equal(pyLiteral('hi'), '"hi"');
  assert.equal(pyLiteral([1, 2.5]), '[1, 2.5]');
  assert.equal(pyLiteral({ b: 1, a: 2 }), '{"a": 2, "b": 1}');  // sorted
  assert.equal(pyLiteral({}), '{}');
  assert.throws(() => formatFloat(NaN));
  assert.throws(() => formatFloat(Infinity));
});

test('python keywords use dict splatting', () => {
  const doc = readJson('sample_2d.json');
  const out = emitDocument(doc);
  assert.ok(out.includes('def build() -> ScientificScene:'));
  assert.ok(out.includes('if __name__ == "__main__":'));
});

// ─── validation unit behaviour ──────────────────────────────────────────
test('validation rejects malformed documents with clear errors', () => {
  const bad = validateDocument({ schema: 'sci-ir/2' });
  assert.equal(bad.valid, false);
  assert.match(bad.errors[0].message, /Unsupported scene schema/);

  const notDoc = validateDocument('nope');
  assert.equal(notDoc.valid, false);

  const unknown = validateDocument({
    schema: 'sci-ir/1', id: 'x', sceneType: 'scene_2d',
    objects: [{ id: 'a', type: 'ghost.thing', properties: {} }]
  });
  assert.equal(unknown.valid, false);
  assert.match(unknown.errors[0].message, /Unknown object type/);
});

test('validation accepts the canonical pairing of expressions', () => {
  const doc = readJson('sample_2d.json');
  const result = validateDocument(doc);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

// ─── endpoint behaviour (router as express app) ─────────────────────────
test('ir router endpoints respond correctly', async () => {
  const { default: express } = await import('express');
  const { default: irRouter } = await import('../src/routes/ir.js');
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/ir', irRouter);

  const okDoc = readJson('sample_2d.json');
  const badDoc = { ...okDoc, schema: 'sci-ir/9' };

  let res = await fetchEndpoint(app, 'GET', '/api/ir/schema');
  assert.equal(res.status, 200);
  assert.equal(res.body.schema, 'sci-ir/1');
  assert.ok(res.body.types.length >= 20);

  res = await fetchEndpoint(app, 'POST', '/api/ir/validate', okDoc);
  assert.equal(res.status, 200);
  assert.equal(res.body.valid, true);

  res = await fetchEndpoint(app, 'POST', '/api/ir/validate', badDoc);
  assert.equal(res.status, 200);
  assert.equal(res.body.valid, false);

  res = await fetchEndpoint(app, 'POST', '/api/ir/export', okDoc);
  assert.equal(res.status, 200);
  assert.equal(res.body.python, readText('sample_2d.py'));

  res = await fetchEndpoint(app, 'POST', '/api/ir/export', badDoc);
  assert.equal(res.status, 422);
  assert.match(res.body.error, /validation/);
});

async function fetchEndpoint (app, method, url, body) {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body)
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}
