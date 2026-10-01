/**
 * Scientific (Suprepto) render route — issue #29.
 *
 * POST /api/projects/:id/render-sci
 *   body: { document: <sci-ir/1 JSON>, quality? }
 *
 * Pipeline: validate the document (JS mirror) -> emit runnable Python
 * (byte-parity with the Python runtime) -> write scene.py -> detect the
 * scene class -> enqueue the SAME Redis render job the code mode uses.
 * The renderer image ships the `scientific` package, so the emitted file
 * imports it natively — one execution path for everything.
 */

import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { validateDocument } from '../ir/validate.js';
import { emitDocument, sceneClassName } from '../ir/emitPython.js';
import { enqueueRenderJob } from '../queue.js';

const router = Router();

function projectDir(dataDir, id) {
  return path.join(dataDir, 'projects', id);
}

router.post('/:id/render-sci', async (req, res, next) => {
  try {
    const { quality = 'medium' } = req.body;
    const document = req.body && req.body.document ? req.body.document : req.body;
    const projectId = req.params.id;

    if (!document || typeof document !== 'object' || !document.id) {
      return res.status(400).json({
        error: 'document is required and must be a sci-ir/1 scene object'
      });
    }

    const check = validateDocument(document);
    if (!check.valid) {
      return res.status(422).json({
        error: 'document failed validation',
        ...check
      });
    }

    let python;
    try {
      python = emitDocument(document);
    } catch (err) {
      return res.status(400).json({ error: `export failed: ${err.message}` });
    }

    const dir = projectDir(req.dataDir, projectId);
    await fs.mkdir(dir, { recursive: true, mode: 0o777 });
    const scenePath = path.join(dir, 'scene.py');
    await fs.writeFile(scenePath, python);

    const sceneName = sceneClassName(document.id);
    const jobId = `job_${uuidv4().split('-')[0]}`;
    await enqueueRenderJob({
      jobId, projectId,
      sceneFile: `projects/${projectId}/scene.py`,
      sceneName, quality
    });

    res.status(202).json({ jobId, status: 'queued', sceneName,
      message: 'Scientific render job enqueued' });
  } catch (err) {
    next(err);
  }
});

export default router;
