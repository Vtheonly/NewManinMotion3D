/**
 * IR -> Python emitter — JS mirror of scientific/export/emitter{,_parts}.py.
 *
 * Byte-identical output with the Python emitter is enforced by golden
 * fixtures (services/api/tests/fixtures/ir/*.py).  Deterministic: identical
 * documents produce identical source on both sides.
 */

import { pyLiteral } from './literals.js';

const BASE_CLASSES = {
  scene_2d: 'BaseScientificScene',
  moving_camera: 'MovingCameraScientificScene',
  three_d: 'ThreeDScientificScene',
  custom: 'BaseScientificScene'
};

const KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert',
  'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
  'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import',
  'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield']);

/** Python repr() for simple strings (ids): single-quoted. */
function pyRepr (value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function isIdent (name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !KEYWORDS.has(name);
}

function kwarg (k, v) {
  if (isIdent(k)) return `${k}=${pyLiteral(v)}`;
  return `**{${JSON.stringify(k)}: ${pyLiteral(v)}}`;
}

function sceneClassName (documentId) {
  return String(documentId).split('_')
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

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

function emitStep (w, step) {
  const target = step.target !== undefined && step.target !== null
    ? pyLiteral(step.target) : null;
  const dur = step.duration !== undefined && step.duration !== null
    ? `, duration=${pyLiteral(step.duration)}` : '';
  switch (step.op) {
    case 'show':
      w(`        st.show(${target})`);
      break;
    case 'play': {
      const anim = [pyLiteral(step.animation)];
      if (step.duration !== undefined && step.duration !== null) {
        anim.push(`duration=${pyLiteral(step.duration)}`);
      }
      if (step.rate) anim.push(`rate=${pyLiteral(step.rate)}`);
      w(`        st.play(${target}, ${anim.join(', ')})`);
      break;
    }
    case 'highlight': {
      const color = step.properties && 'color' in step.properties
        ? `, color=${pyLiteral(step.properties.color)}` : '';
      w(`        st.highlight(${target}${color}${dur})`);
      break;
    }
    case 'annotate': {
      const value = step.properties ? step.properties.value : null;
      w(`        st.annotate(${target}, ${pyLiteral(value ?? null)}${dur})`);
      break;
    }
    case 'wait':
      w(`        st.wait(${pyLiteral(step.duration || 0.5)})`);
      break;
    case 'camera':
      w(`        st.camera(${pyLiteral(step.properties || {})}${dur})`);
      break;
    case 'transform':
      w(`        st.transform(${target}, ` +
        `${pyLiteral(step.properties || {})}${dur})`);
      break;
    case 'custom':
      w(`        st.custom(${pyLiteral(step.code || '')})`);
      break;
    default:
      break;
  }
}

function emitDocument (doc) {
  const lines = [];
  const w = (line) => lines.push(line);
  const base = BASE_CLASSES[doc.sceneType] || 'BaseScientificScene';
  w(`"""Scene ${pyRepr(doc.id)} — generated by Manim Studio (sci-ir/1).`);
  w('');
  w('Deterministic export: identical IR produces identical source.');
  w('Round-trips through scientific.export.import_document().');
  w('"""');
  w('');
  w('from scientific import DataRef, Derived, Literal, ScientificScene, ' +
    'Symbol');
  w(`from scientific.manim_adapter import ${base}`);
  w('');
  w('');
  w('def build() -> ScientificScene:');
  w('    scene = ScientificScene(');
  w(`        ${pyLiteral(doc.id)},`);
  w(`        title=${pyLiteral(doc.title)},`);
  w(`        scene_type=${pyLiteral(doc.sceneType)},`);
  w(`        camera=${doc.camera && Object.keys(doc.camera).length
    ? pyLiteral(doc.camera) : 'None'},`);
  w('    )');
  const expressions = doc.expressions || [];
  const expressionIds = new Set(expressions.map((e) => e.id));
  const emitted = new Set();
  for (const node of doc.objects || []) {
    if (expressionIds.has(node.id) && node.type === 'math.formula') {
      emitExpr(w, expressions.find((e) => e.id === node.id), node);
      emitted.add(node.id);
    } else {
      emitNode(w, node);
    }
  }
  for (const expr of expressions) {
    if (!emitted.has(expr.id)) emitExpr(w, expr, null);
  }
  for (const value of doc.values || []) {
    w(`    scene.live_value(${pyLiteral(value.id)}, ` +
      `${pyLiteral(value.source)}, format=${pyLiteral(value.format)})`);
  }
  for (const symbol of Object.keys(doc.bindings || {}).sort()) {
    w(`    scene.bind(${pyLiteral(symbol)}, ` +
      `${pyLiteral(doc.bindings[symbol])})`);
  }
  for (const rel of doc.relationships || []) {
    const srcs = (rel.sources || []).map((s) => pyLiteral(s)).join(', ');
    const props = Object.keys(rel.properties || {}).sort()
      .map((k) => `${k}=${pyLiteral(rel.properties[k])}`).join(', ');
    const tail = props ? `, ${props}` : '';
    w(`    scene.relationship(${srcs}${tail}, id=${pyLiteral(rel.id)}, ` +
      `kind=${pyLiteral(rel.kind)}, live=${pyLiteral(!!rel.live)})`);
  }
  for (const stage of doc.timeline || []) {
    w(`    with scene.stage(stage_id=${pyLiteral(stage.id)}, ` +
      `title=${pyLiteral(stage.title)}) as st:`);
    if (!stage.steps || stage.steps.length === 0) w('        pass');
    for (const step of stage.steps || []) emitStep(w, step);
  }
  w('    return scene');
  const name = sceneClassName(doc.id);
  w('');
  w('');
  w(`class ${name}(${base}):`);
  w(`    """Rendered from sci-ir/1 scene ${pyRepr(doc.id)}."""`);
  w('');
  w('    def get_scene(self) -> ScientificScene:');
  w('        return build()');
  w('');
  w('if __name__ == "__main__":');
  w('    from scientific.run import main');
  w('    main([__file__])');
  w('');
  return lines.join('\n');
}

export { emitDocument, sceneClassName, BASE_CLASSES };
export default emitDocument;
