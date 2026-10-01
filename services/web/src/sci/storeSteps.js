/**
 * Suprepto editor actions — timeline stages/steps, expressions and the
 * graph builder (split from store.js — file-size rule).
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
  // ── timeline (stages + steps) ─────────────────────────────────────────
  addStage (title = 'New stage') {
    const stage = { id: uid('stage'), title, steps: [] }
    store.document.timeline.push(stage)
    commit()
    store.selectedStageId = stage.id
    return stage
  },

  removeStage (stageId) {
    store.document.timeline = store.document.timeline
      .filter((s) => s.id !== stageId)
    commit()
  },

  renameStage (stageId, title) {
    const stage = store.document.timeline.find((s) => s.id === stageId)
    if (stage) { stage.title = title; commit() }
  },

  addStep (stageId, step) {
    const stage = store.document.timeline.find((s) => s.id === stageId)
    if (!stage) return null
    const full = { op: 'show', target: null, ...step }
    stage.steps.push(full)
    commit()
    return full
  },

  updateStep (stageId, index, updates) {
    const stage = store.document.timeline.find((s) => s.id === stageId)
    if (!stage || !stage.steps[index]) return
    Object.assign(stage.steps[index], updates)
    commit()
  },

  removeStep (stageId, index) {
    const stage = store.document.timeline.find((s) => s.id === stageId)
    if (!stage) return
    stage.steps.splice(index, 1)
    commit()
  },

  moveStep (fromStageId, fromIndex, toStageId, toIndex) {
    const from = store.document.timeline.find((s) => s.id === fromStageId)
    const to = store.document.timeline.find((s) => s.id === toStageId)
    if (!from || !to) return
    const [step] = from.steps.splice(fromIndex, 1)
    to.steps.splice(Math.min(toIndex, to.steps.length), 0, step)
    commit()
  },

  // ── expressions (formula editing, #29 §3) ──────────────────────────────
  updateExpression (id, updates) {
    const expr = store.document.expressions.find((e) => e.id === id)
    if (!expr) return
    Object.assign(expr, updates)
    const node = store.document.objects.find((o) => o.id === id)
    if (node && updates.source) {
      Vue.set(node.properties, 'source', updates.source)
    }
    commit()
  },

  setExpressionTerm (id, name, value) {
    const expr = store.document.expressions.find((e) => e.id === id)
    if (!expr) return
    if (!expr.terms) Vue.set(expr, 'terms', {})
    if (value === null || value === undefined) Vue.delete(expr.terms, name)
    else Vue.set(expr.terms, name, value)
    commit()
  }
}
