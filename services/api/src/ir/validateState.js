/**
 * Suprepto section validation — JS mirror of scientific/ir/validate_ext.py.
 *
 * State symbols, derived specs, machines, comparisons, annotations and the
 * state-targeting timeline ops.  Verdict parity is enforced by the shared
 * corpus on both sides.
 */

const DRIVER_KINDS = ['static', 'keyframes', 'series'];
const COMPARISON_KINDS = ['before_after', 'input_output', 'prediction_truth',
  'model_a_b', 'iteration', 'parameter'];
const BEHAVIORS = ['outline', 'glow', 'pulse', 'emphasis', 'dim_others',
  'focus', 'arrow', 'label', 'region', 'temporary'];
const BEHAVIOR_ALIASES = {
  focus: ['focus', 'dim_others'],
  glow: ['glow', 'outline'],
  spotlight: ['focus', 'dim_others', 'outline']
};

function normalizeBehaviors (behaviors) {
  const out = [];
  for (const item of behaviors || []) {
    const name = String(item);
    for (const base of (BEHAVIOR_ALIASES[name] || [name])) {
      if (!out.includes(base)) out.push(base);
    }
  }
  for (const b of out) if (!BEHAVIORS.includes(b)) return null;
  return out;
}

function validateStateSections (doc) {
  const errors = [];
  const state = (doc && doc.state) || {};
  const symbols = new Set([...(state.symbols || []).map((s) => s.id),
                           ...(state.derived || []).map((s) => s.id)]);
  const objectIds = new Set((doc.objects || []).map((o) => o.id));
  const valueIds = new Set((doc.values || []).map((v) => v.id));
  const relIds = new Set((doc.relationships || []).map((r) => r.id));

  for (const symbol of state.symbols || []) {
    if (symbol.driver && !DRIVER_KINDS.includes(symbol.driver.kind)) {
      errors.push({ path: `state/${symbol.id}/driver`,
        message: `unknown driver kind '${symbol.driver.kind}'` });
    }
  }
  for (const spec of state.derived || []) {
    for (const [alias, src] of Object.entries(spec.inputs || {})) {
      if (!symbols.has(src)) {
        errors.push({
          path: `state/derived/${spec.id}/inputs/${alias}`,
          message: `input '${src}' is not a declared state symbol` });
      }
    }
    if (!String(spec.expr || '').trim()) {
      errors.push({ path: `state/derived/${spec.id}`,
        message: 'derived symbol needs an expression' });
    }
  }

  for (const machine of state.machines || []) {
    const stateIds = (machine.states || []).map((s) => s.id);
    if (!machine.initial || !stateIds.includes(machine.initial)) {
      errors.push({ path: `machines/${machine.id}/initial`,
        message: "machine needs an 'initial' state that matches one of " +
          'its states' });
    }
    for (const tr of machine.transitions || []) {
      if (!stateIds.includes(tr.source)) {
        errors.push({ path: `machines/${machine.id}/${tr.id}/source`,
          message: `unknown source state '${tr.source}'` });
      }
      if (!stateIds.includes(tr.target)) {
        errors.push({ path: `machines/${machine.id}/${tr.id}/target`,
          message: `unknown target state '${tr.target}'` });
      }
      for (const sym of Object.keys(tr.sets || {})) {
        if (!symbols.has(sym)) {
          errors.push({
            path: `machines/${machine.id}/${tr.id}/sets/${sym}`,
            message: `transition sets unknown symbol '${sym}'` });
        }
      }
    }
  }

  for (const comp of doc.comparisons || []) {
    if (!COMPARISON_KINDS.includes(comp.kind)) {
      errors.push({ path: `comparisons/${comp.id}`,
        message: `unknown comparison kind '${comp.kind}'` });
    }
    for (const side of ['a', 'b']) {
      if (comp[side] != null && !objectIds.has(comp[side])) {
        errors.push({ path: `comparisons/${comp.id}/${side}`,
          message: `comparison side is not an artifact: '${comp[side]}'` });
      }
    }
    if (!comp.metrics || !comp.metrics.length) {
      errors.push({ path: `comparisons/${comp.id}/metrics`,
        message: 'comparison needs at least one metric' });
    }
  }

  for (const ann of doc.annotations || []) {
    const targetable = new Set([...objectIds,
      ...(doc.expressions || []).map((e) => e.id)]);
    if (ann.target != null && !targetable.has(ann.target)) {
      errors.push({ path: `annotations/${ann.id}/target`,
        message: `annotation targets unknown id '${ann.target}'` });
    }
    const providers = new Set([...symbols, ...valueIds, ...relIds]);
    if (ann.provider != null && !providers.has(ann.provider)) {
      errors.push({ path: `annotations/${ann.id}/provider`,
        message: 'annotation provider is not a state symbol, value or ' +
          `relationship: '${ann.provider}'` });
    }
  }

  for (const stage of doc.timeline || []) {
    for (const step of stage.steps || []) {
      if (step.op === 'highlight') {
        const behaviors = step.properties && step.properties.behaviors;
        if (behaviors && normalizeBehaviors(behaviors) === null) {
          errors.push({ path: `timeline/${stage.id}`,
            message: `unknown highlight behaviors in ` +
              `${JSON.stringify(behaviors)}` });
        }
      } else if (['set', 'interpolate'].includes(step.op)) {
        if (!(state.symbols || []).some((s) => s.id === step.target)) {
          errors.push({ path: `timeline/${stage.id}/${step.target}`,
            message: `${step.op} targets unknown state symbol ` +
              `'${step.target}'` });
        }
      } else if (step.op === 'transition') {
        if (!(state.machines || []).some((m) => m.id === step.target)) {
          errors.push({ path: `timeline/${stage.id}/${step.target}`,
            message: `transition targets unknown machine ` +
              `'${step.target}'` });
        }
      } else if (step.op === 'compare') {
        if (!(doc.comparisons || []).some((c) => c.id === step.target)) {
          errors.push({ path: `timeline/${stage.id}/${step.target}`,
            message: `compare targets unknown comparison ` +
              `'${step.target}'` });
        }
      }
    }
  }
  return errors;
}

export { validateStateSections, normalizeBehaviors };
export default validateStateSections;
