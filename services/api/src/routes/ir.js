/**
 * Scientific scene IR routes (issue #32).
 *
 * - GET  /api/ir/schema    — type metadata for the generic frontend inspector
 * - POST /api/ir/validate  — validate a sci-ir/1 document (JS mirror)
 * - POST /api/ir/export    — deterministic IR -> runnable Python (JS mirror,
 *                            byte-parity with the Python runtime, tested)
 *
 * The JS mirrors share fixtures with the Python runtime
 * (services/api/tests/fixtures/ir/*) — change one side, regenerate, update
 * the other.
 */

import { Router } from 'express';
import { describeTypes } from '../ir/schemaTypes.js';
import { validateDocument } from '../ir/validate.js';
import { emitDocument } from '../ir/emitPython.js';

const router = Router();

router.get('/schema', (req, res) => {
  res.json({ schema: 'sci-ir/1', types: describeTypes() });
});

router.post('/validate', (req, res) => {
  const document = req.body && req.body.document
    ? req.body.document : req.body;
  const result = validateDocument(document);
  res.json(result);
});

router.post('/export', (req, res) => {
  const document = req.body && req.body.document
    ? req.body.document : req.body;
  const check = validateDocument(document);
  if (!check.valid) {
    return res.status(422).json({
      error: 'document failed validation',
      ...check
    });
  }
  try {
    const python = emitDocument(document);
    res.json({ schema: 'sci-ir/1', python });
  } catch (err) {
    res.status(400).json({ error: `export failed: ${err.message}` });
  }
});

export default router;
