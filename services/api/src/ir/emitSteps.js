/**
 * Timeline step emission — JS mirror of the step half of
 * scientific/export/emitter_parts.py (byte-parity is golden-tested).
 */

import { pyLiteral } from './literals.js';

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
    case 'highlight':
      w(`        st.highlight(${target}${highlightTail(step)}${dur})`);
      break;
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
    case 'set': {
      const value = step.properties ? step.properties.value : null;
      w(`        st.set(${target}, ${pyLiteral(value ?? null)})`);
      break;
    }
    case 'interpolate':
      w(`        st.interpolate(${target}${interpolateTail(step)})`);
      break;
    case 'transition':
      w(`        st.transition(${target}${transitionTail(step)}${dur})`);
      break;
    case 'compare':
      w(`        st.compare(${target}${dur})`);
      break;
    case 'custom':
      w(`        st.custom(${pyLiteral(step.code || '')})`);
      break;
    default:
      break;
  }
}

function highlightTail (step) {
  const props = step.properties || {};
  let tail = '';
  if (props.behaviors) tail += `, behaviors=${pyLiteral(props.behaviors)}`;
  if ('color' in props) tail += `, color=${pyLiteral(props.color)}`;
  if (props.label) tail += `, label=${pyLiteral(props.label)}`;
  return tail;
}

function interpolateTail (step) {
  const props = step.properties || {};
  let tail = `, to=${pyLiteral(props.to ?? 0.0)}`;
  tail += `, duration=${pyLiteral(step.duration ?? 2.0)}`;
  if ('from' in props) tail += `, from_=${pyLiteral(props.from)}`;
  if (step.rate) tail += `, rate=${pyLiteral(step.rate)}`;
  return tail;
}

function transitionTail (step) {
  const props = step.properties || {};
  let tail = '';
  if (props.to) tail += `, to=${pyLiteral(props.to)}`;
  if (props.event) tail += `, event=${pyLiteral(props.event)}`;
  return tail;
}


export { emitStep };
