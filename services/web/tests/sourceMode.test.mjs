/**
 * Canonical render-source contract tests (issue #36).
 * Run: node tests/sourceMode.test.mjs
 *
 * Covers: sourceMode schema + migration, adoptImportedCode (lossy import
 * keeps the original code as the render source), detachFromSource, and the
 * renderOnServer routing (code-sourced projects must render their exact
 * codeSource, never the compiled scaffold).
 */
import { store, actions } from '../src/store/project.js';

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.error(`  FAIL: ${msg}`); } };

// ── fetch stub: capture render endpoint selection ──────────────────────────
const calls = [];
global.fetch = async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : {};
  calls.push({ url, method: options.method || 'GET', body });
  const respond = (status, payload) => ({
    ok: status < 400,
    status,
    json: async () => payload
  });
  if (url.endsWith('/api/projects') && options.method === 'POST') {
    return respond(201, { id: 'proj_1', name: 'P' });
  }
  if (/\/api\/projects\/[^/]+$/.test(url) && options.method === 'PUT') {
    return respond(200, { id: 'proj_1', saved: true });
  }
  if (/\/api\/projects\/[^/]+\/render$/.test(url)) {
    return respond(202, { jobId: 'job_visual', status: 'queued' });
  }
  if (/\/api\/projects\/[^/]+\/render-code$/.test(url)) {
    return respond(202, { jobId: 'job_code', status: 'queued', renderSource: 'code' });
  }
  return respond(200, {});
};

// ── schema & migration ──────────────────────────────────────────────────────
console.log('=== sourceMode schema ===');
ok(store.project.sourceMode === 'canvas', 'visual default project is canvas-sourced');
ok(store.project.importReport === null, 'importReport defaults to null');
actions.newProject('Code Proj', 'code');
ok(store.project.sourceMode === 'code', 'code-mode project is code-sourced');
actions.newProject('Visual', 'visual');

const migrated = { editorMode: 'visual', codeSource: '', stage: {}, objects: [], tracks: [] };
actions.importJSON(JSON.stringify(migrated));
ok(store.project.sourceMode === 'canvas', 'legacy project migrates to canvas source');

const legacyCode = { editorMode: 'code', codeSource: 'from manim import *\nclass S(Scene):\n    pass\n', stage: { width: 1920, height: 1080 }, objects: [], tracks: [] };
actions.importJSON(JSON.stringify(legacyCode));
ok(store.project.sourceMode === 'code', 'legacy code project migrates to code source');

// ── adoptImportedCode: lossy import ─────────────────────────────────────────
console.log('=== adoptImportedCode (lossy) ===');
actions.newProject('Imported', 'visual');
const code = 'from manim import *\nclass S(Scene):\n    def construct(self):\n        t = Text("hi")\n';
const lossy = {
  objects: [{ id: 'obj_imported_0', type: 'text', content: 'hi', x: 100, y: 100 }],
  tracks: [{ id: 'track_parsed', name: 'Track 1', clips: [] }],
  stage: { backgroundColor: '#070b17', width: 1920, height: 1080 },
  coverage: { dropped: [{ name: 'protein', why: 'not representable' }], approximated: 2, complete: false }
};
const adopted = actions.adoptImportedCode(code, lossy);
ok(adopted.sourceMode === 'code', 'lossy import sets sourceMode=code');
ok(store.project.codeSource === code, 'original code preserved verbatim');
ok(store.project.importReport.dropped.length === 1, 'import report records dropped constructs');
ok(store.project.importReport.approximated === 2, 'import report records approximations');
ok(store.project.importReport.complete === false, 'import report is not complete');
ok(store.project.objects.length === 1, 'scaffold objects adopted for editing');
ok(store.project.stage.backgroundColor === '#070b17', 'stage background adopted');

// ── render routing: code-sourced project renders the SOURCE ────────────────
console.log('=== renderOnServer routing ===');
calls.length = 0;
await actions.renderOnServer('high');
const renderCall = calls.find((c) => /\/render(-code)?$/.test(c.url));
ok(renderCall && renderCall.url.endsWith('/render-code'), 'code-sourced project renders via render-code');
ok(renderCall && renderCall.body.codeSource === code, 'render uses the exact original code');
const visualCall = calls.find((c) => /\/render$/.test(c.url));
ok(!visualCall, 'visual /render endpoint NOT used for code-sourced projects');

// ── detach: canvas becomes the render source ───────────────────────────────
console.log('=== detachFromSource ===');
ok(actions.detachFromSource() === true, 'detach succeeds for code-sourced project');
ok(store.project.sourceMode === 'canvas', 'detach switches sourceMode to canvas');
ok(store.project.codeSource === code, 'detach keeps the source for reference');
ok(actions.detachFromSource() === false, 'detach is a no-op when already detached');

calls.length = 0;
await actions.renderOnServer('high');
const afterDetach = calls.find((c) => /\/render(-code)?$/.test(c.url));
ok(afterDetach && afterDetach.url.endsWith('/render'), 'detached project renders via visual /render');
ok(afterDetach && !afterDetach.body.codeSource, 'visual render does not carry codeSource');

// ── clean import (full coverage) stays canvas-sourced ──────────────────────
console.log('=== adoptImportedCode (complete round-trip) ===');
actions.newProject('RoundTrip', 'visual');
const clean = actions.adoptImportedCode(code, {
  objects: [], tracks: [], stage: { width: 1920, height: 1080 },
  coverage: { dropped: [], approximated: 0, complete: true }
});
ok(clean.sourceMode === 'canvas', 'complete parse keeps canvas as the render source');
ok(store.project.codeSource === code, 'source still preserved for the Code tab');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
