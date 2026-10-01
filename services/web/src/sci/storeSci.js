/**
 * Suprepto editor actions — reactive state, machines, comparisons and
 * annotations (issues #4 / #5 / #11; split from store.js — file-size rule).
 */

import Vue from 'vue'
import { store } from './store.js'
import { toDict } from './document.js'
import { uid } from './document.js'

function commit () {
  store.history.past.push(JSON.stringify(toDict(store.document)))
  if (store.history.past.length > 50) store.history.shift()
  store.history.future = []
  store.dirty = true
}

export const actions = {
  // ── reactive state (#4) ────────────────────────────────────────────────
  addStateSymbol (symbol) {
    store.document.state.symbols.push({
      id: symbol.id || uid('sym'), kind: symbol.kind || 'scalar',
      value: symbol.value !== undefined ? symbol.value : 0,
      driver: symbol.driver || null, format: symbol.format || null
    })
    commit()
  },

  updateStateSymbol (id, updates) {
    const s = store.document.state.symbols.find((x) => x.id === id)
    if (!s) return
    Object.assign(s, updates)
    commit()
  },

  removeStateSymbol (id) {
    store.document.state.symbols = store.document.state.symbols
      .filter((s) => s.id !== id)
    store.document.state.derived = store.document.state.derived
      .filter((d) => !Object.values(d.inputs || {}).includes(id))
    commit()
  },

  addDerived (spec) {
    store.document.state.derived.push({
      id: spec.id || uid('d'), expr: spec.expr || '',
      inputs: spec.inputs || {}, kind: 'derived'
    })
    commit()
  },

  updateDerived (id, updates) {
    const d = store.document.state.derived.find((x) => x.id === id)
    if (!d) return
    Object.assign(d, updates)
    commit()
  },

  removeDerived (id) {
    store.document.state.derived = store.document.state.derived
      .filter((d) => d.id !== id)
    commit()
  },

  // ── machines + comparisons (#11) ──────────────────────────────────────
  addMachine (machine) {
    const full = {
      id: machine.id || uid('machine'),
      states: machine.states || [{ id: 'initial', label: 'Initial' }],
      transitions: machine.transitions || [],
      initial: machine.initial || 'initial'
    }
    store.document.state.machines.push(full)
    commit()
    return full
  },

  updateMachine (id, updates) {
    const m = store.document.state.machines.find((x) => x.id === id)
    if (!m) return
    Object.assign(m, updates)
    commit()
  },

  removeMachine (id) {
    store.document.state.machines = store.document.state.machines
      .filter((m) => m.id !== id)
    commit()
  },

  addComparison (comparison) {
    const full = {
      id: comparison.id || uid('cmp'),
      kind: comparison.kind || 'before_after',
      a: comparison.a ?? null, b: comparison.b ?? null,
      metrics: comparison.metrics ||
        [{ label: 'metric', a: 1.0, b: 2.0, format: '{value}',
           deltaFormat: '{delta:+.2f}' }],
      title: comparison.title || ''
    }
    store.document.comparisons.push(full)
    commit()
    return full
  },

  updateComparison (id, updates) {
    const c = store.document.comparisons.find((x) => x.id === id)
    if (!c) return
    Object.assign(c, updates)
    commit()
  },

  removeComparison (id) {
    store.document.comparisons = store.document.comparisons
      .filter((c) => c.id !== id)
    commit()
  },

  // ── annotations (#5) ─────────────────────────────────────────────────
  addAnnotation (annotation) {
    store.document.annotations.push({
      id: annotation.id || uid('ann'),
      target: annotation.target || store.selectedId,
      provider: annotation.provider ?? null,
      value: annotation.value || '',
      format: annotation.format ?? null,
      side: annotation.side || 'RIGHT', live: annotation.live !== false
    })
    commit()
  },

  updateAnnotation (id, updates) {
    const a = store.document.annotations.find((x) => x.id === id)
    if (!a) return
    Object.assign(a, updates)
    commit()
  },

  removeAnnotation (id) {
    store.document.annotations = store.document.annotations
      .filter((a) => a.id !== id)
    commit()
  }
}
