/**
 * Manim Studio API Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import projectsRouter from './routes/projects.js';
import assetsRouter from './routes/assets.js';
import rendersRouter from './routes/renders.js';
import jobsRouter from './routes/jobs.js';
import fontsRouter from './routes/fonts.js';
import irRouter from './routes/ir.js';
import sciRenderRouter from './routes/sciRender.js';
import { describeCapabilities, detectScenes } from './compiler/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';

// Security middleware
app.use(helmet());

// CORS and body parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Inject DATA_DIR into request
app.use((req, res, next) => {
  req.dataDir = DATA_DIR;
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Capability discovery (Issue #1): the frontend can query which object
// types / animations / scene types the compiler registries provide, so new
// registrations appear in the editor without frontend hardcoding.
app.get('/api/capabilities', (req, res) => {
  res.json(describeCapabilities());
});

// Scene detection endpoint (Issue #1): detect renderable scene classes in
// arbitrary Manim Python source — used by the code editor before rendering.
app.post('/api/detect-scenes', (req, res) => {
  const { codeSource } = req.body || {};
  if (!codeSource || typeof codeSource !== 'string' || codeSource.trim().length === 0) {
    return res.status(400).json({ error: 'codeSource is required and must be non-empty' });
  }
  res.json(detectScenes(codeSource));
});

// API routes
app.use('/api/projects', projectsRouter);
app.use('/api/projects', sciRenderRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/renders', rendersRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/fonts', fontsRouter);
app.use('/api/ir', irRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
  console.log(`[API] Data directory: ${DATA_DIR}`);
});
