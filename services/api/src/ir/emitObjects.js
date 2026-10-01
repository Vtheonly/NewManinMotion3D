/**
 * Node/formula emission — JS mirror of the object half of
 * scientific/export/emitter_parts.py (byte-parity is golden-tested).
 */

import { pyLiteral } from './literals.js';

const KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert',
  'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
  'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import',
  'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield']);

function isIdent (name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !KEYWORDS.has(name);
}

function kwarg (k, v) {
  if (isIdent(k)) return `${k}=${pyLiteral(v)}`;
  return `**{${JSON.stringify(k)}: ${pyLiteral(v)}}`;
}

function emitNode (w, node) {
  const parts = [pyLiteral(node.type), pyLiteral(node.id)];
  for (const k of Object.keys(node.properties || {}).sort()) {
    parts.push(kwarg(k, node.properties[k]));
  }
  parts.push(...placementKwargs(node));
  w(`    scene.node(${parts.join(', ')})`);
}

function emitExpr (w, expr, node) {
  const kwargs = [`source=${pyLiteral(expr.source)}`];
  if (expr.terms && Object.keys(expr.terms).length) {
    kwargs.push(`terms=${pyLiteral(expr.terms)}`);
  }
  if (expr.bindings && Object.keys(expr.bindings).length) {
    kwargs.push(`bindings=${pyLiteral(expr.bindings)}`);
  }
  if (expr.highlights && expr.highlights.length) {
    kwargs.push(`highlights=${pyLiteral(expr.highlights)}`);
  }
  if (expr.format !== undefined && expr.format !== null) {
    kwargs.push(`format=${pyLiteral(expr.format)}`);
  }
  if (node) {
    for (const k of Object.keys(node.properties || {}).sort()) {
      if (k !== 'source') kwargs.push(kwarg(k, node.properties[k]));
    }
    kwargs.push(...placementKwargs(node));
  }
  w(`    scene.formula(${pyLiteral(expr.id)}, ${kwargs.join(', ')})`);
}


export { emitNode, emitExpr };

function placementKwargs (node) {
  const extra = [];
  if (node.parentId) extra.push(`parent=${pyLiteral(node.parentId)}`);
  if (node.space && node.space !== 'scene2d') {
    extra.push(`space=${pyLiteral(node.space)}`);
  }
  if (node.label) extra.push(`label=${pyLiteral(node.label)}`);
  const tr = node.transform || {};
  const pos = tr.position || [0.0, 0.0, 0.0];
  const rotation = tr.rotation || 0.0;
  const scale = tr.scale === undefined ? 1.0 : tr.scale;
  const moved = pos.some((c) => c !== 0) || rotation || scale !== 1.0;
  if (moved) {
    extra.push(`position=${pyLiteral(pos)}`);
    if (rotation) extra.push(`rotation=${pyLiteral(rotation)}`);
    if (scale !== 1.0) extra.push(`scale=${pyLiteral(scale)}`);
  }
  return extra;
}

