/**
 * Suprepto editor store — reactive document + selection (issue #29).
 *
 * Every mutation goes through these actions so undo/history stays
 * consistent and the document remains canonical (editable, serializable,
 * exportable).  One object = one timeline identity (#33).
 *
 * History invariant: `past` holds "state after each change", starting with
 * the initial document — so undo restores the previous entry, redo replays.
 */

import Vue from 'vue'
import { createDocument, fromDict, toDict, uid } from './document.js'
import { objectActions } from './storeObjects.js'

function initialHistory () {
  return { past: [JSON.stringify(toDict(store.document))], future: [] }
}

export const store = Vue.observable({
  document: createDocument(),
  selectedId: null,
  selectedStageId: null,
  selectedStepRef: null,   // {stageId, index}
  schemaTypes: [],         // registry metadata (GET /api/ir/schema)
  validation: [],          // [{path, message}] after validate
  dirty: false,
  history: { past: [JSON.stringify(toDict(createDocument()))], future: [] }
})

const MAX_HISTORY = 50

function commit () {
  store.history.past.push(JSON.stringify(toDict(store.document)))
  if (store.history.past.length > MAX_HISTORY) store.history.shift()
  store.history.future = []
  store.dirty = true
}

export const actions = {
  newDocument (id = 'my_scene', title = 'My Scene') {
    store.document = createDocument(id, title)
    store.selectedId = null
    store.validation = []
    store.dirty = false
    store.history = initialHistory()
  },

  loadDict (raw) {
    store.document = fromDict(raw)
    store.selectedId = null
    store.dirty = false
    store.history = initialHistory()
  },

  dump () { return toDict(store.document) },

  undo () {
    if (store.history.past.length < 2) return
    store.history.future.push(store.history.past.pop())
    store.document = fromDict(JSON.parse(
      store.history.past[store.history.past.length - 1]))
    store.dirty = true
  },

  redo () {
    if (!store.history.future.length) return
    store.history.past.push(store.history.future.pop())
    store.document = fromDict(JSON.parse(
      store.history.past[store.history.past.length - 1]))
    store.dirty = true
  },

  // ── selection ────────────────────────────────────────────────────────
  select (id) { store.selectedId = id; store.selectedStepRef = null },
  ...objectActions
}
