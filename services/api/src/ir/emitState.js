/**
 * Suprepto state-section emission — JS mirror of
 * scientific/export/emitter_state.py (byte-parity is golden-tested).
 */

import { pyLiteral } from './literals.js';

function emitStateSections (w, doc) {
  const state = doc.state || {};
  for (const symbol of state.symbols || []) emitStateSymbol(w, symbol);
  for (const spec of state.derived || []) {
    const parts = [pyLiteral(spec.id), `expr=${pyLiteral(spec.expr)}`];
    if (spec.inputs && Object.keys(spec.inputs).length) {
      parts.push(`inputs=${pyLiteral(spec.inputs)}`);
    }
    if (spec.kind && spec.kind !== 'derived') {
      parts.push(`kind=${pyLiteral(spec.kind)}`);
    }
    if (spec.format !== undefined && spec.format !== null) {
      parts.push(`format=${pyLiteral(spec.format)}`);
    }
    w(`    scene.derive(${parts.join(', ')})`);
  }
  for (const machine of state.machines || []) emitMachine(w, machine);
  for (const comparison of doc.comparisons || []) emitComparison(w, comparison);
  for (const ann of doc.annotations || []) {
    const parts = [pyLiteral(ann.target)];
    if (ann.provider !== undefined && ann.provider !== null) {
      parts.push(`provider=${pyLiteral(ann.provider)}`);
    }
    if (ann.value) parts.push(`value=${pyLiteral(ann.value)}`);
    if (ann.format !== undefined && ann.format !== null) {
      parts.push(`format=${pyLiteral(ann.format)}`);
    }
    if (ann.side && ann.side !== 'RIGHT') {
      parts.push(`side=${pyLiteral(ann.side)}`);
    }
    if (ann.live === false) parts.push('live=False');
    parts.push(`id=${pyLiteral(ann.id)}`);
    w(`    scene.annotate(${parts.join(', ')})`);
  }
}

function emitStateSymbol (w, symbol) {
  const parts = [pyLiteral(symbol.id)];
  const driver = symbol.driver;
  if (driver && driver.kind === 'keyframes') {
    parts.push(`keyframes=${pyLiteral(driver.keyframes)}`);
    const easing = driver.easing || 'smooth';
    if (easing !== 'smooth') parts.push(`easing=${pyLiteral(easing)}`);
    if (symbol.value !== undefined && symbol.value !== null) {
      parts.push(`value=${pyLiteral(symbol.value)}`);
    }
  } else if (symbol.value !== undefined && symbol.value !== null) {
    parts.push(`value=${pyLiteral(symbol.value)}`);
  }
  if (symbol.kind && symbol.kind !== 'scalar') {
    parts.push(`kind=${pyLiteral(symbol.kind)}`);
  }
  if (symbol.format !== undefined && symbol.format !== null) {
    parts.push(`format=${pyLiteral(symbol.format)}`);
  }
  w(`    scene.state(${parts.join(', ')})`);
}

function emitMachine (w, machine) {
  const states = (machine.states || []).map((s) => {
    const out = { id: s.id };
    if (s.label) out.label = s.label;
    return out;
  });
  const transitions = (machine.transitions || []).map((tr) => {
    const out = { id: tr.id, source: tr.source, target: tr.target };
    if (tr.trigger) out.trigger = tr.trigger;
    if (tr.sets && Object.keys(tr.sets).length) out.sets = tr.sets;
    if (tr.animate !== undefined && tr.animate !== null) {
      out.animate = tr.animate;
    }
    return out;
  });
  w(`    scene.machine(${pyLiteral(machine.id)}, ` +
    `states=${pyLiteral(states)}, ` +
    `transitions=${pyLiteral(transitions)}, ` +
    `initial=${pyLiteral(machine.initial)})`);
}

function emitComparison (w, comparison) {
  const metrics = (comparison.metrics || []).map((m) => ({
    label: m.label, a: m.a, b: m.b, format: m.format,
    deltaFormat: m.deltaFormat
  }));
  const parts = [pyLiteral(comparison.id),
                 `kind=${pyLiteral(comparison.kind)}`];
  if (comparison.a !== undefined && comparison.a !== null) {
    parts.push(`a=${pyLiteral(comparison.a)}`);
  }
  if (comparison.b !== undefined && comparison.b !== null) {
    parts.push(`b=${pyLiteral(comparison.b)}`);
  }
  parts.push(`metrics=${pyLiteral(metrics)}`);
  if (comparison.title) parts.push(`title=${pyLiteral(comparison.title)}`);
  w(`    scene.compare(${parts.join(', ')})`);
}

export { emitStateSections };
