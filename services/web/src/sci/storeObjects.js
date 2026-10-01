/**
 * Suprepto editor object actions (issues #29 §1 / #34 §10; split from
 * store.js for the file-size rule). One object = one timeline identity.
 */

import Vue from 'vue'
import { store } from './store.js'
import { uid } from './document.js'

function commit () {
  store.history.past.push(JSON.stringify(store.document))
  if (store.history.past.length > 50) store.history.shift()
  store.history.future = []
  store.dirty = true
}

export const objectActions = {
  // ── objects (#29 §1, #34 §10) ────────────────────────────────────────
  addObject (entry, object) {
    const node = object
    node.parentId = node.parentId || null
    store.document.objects.push(node)
    if (node.__expression) {
      store.document.expressions.push({
        id: node.id, ...node.__expression, highlights: [], format: null })
      delete node.__expression
    }
    commit()
    store.selectedId = node.id
    return node
  },

  duplicateObject (id) {
    const source = store.document.objects.find((o) => o.id === id)
    if (!source) return null
    const copy = JSON.parse(JSON.stringify(source))
    copy.id = uid('obj')
    const base = source.properties && source.properties.source
      ? String(source.properties.source).slice(0, 18) : source.type
    copy.label = `${source.label || source.id} copy`
    store.document.objects.push(copy)
    const expr = store.document.expressions.find((e) => e.id === id)
    if (expr) {
      const ecopy = JSON.parse(JSON.stringify(expr))
      ecopy.id = copy.id
      store.document.expressions.push(ecopy)
    }
    commit()
    store.selectedId = copy.id
    return copy
  },

  updateObject (id, updates) {
    const obj = store.document.objects.find((o) => o.id === id)
    if (!obj) return
    Object.assign(obj, updates)
    commit()
  },

  setProperty (id, name, value) {
    const obj = store.document.objects.find((o) => o.id === id)
    if (!obj) return
    if (value === null || value === undefined) {
      Vue.delete(obj.properties, name)
    } else {
      Vue.set(obj.properties, name, value)
    }
    commit()
  },

  setTransform (id, transform) {
    const obj = store.document.objects.find((o) => o.id === id)
    if (!obj) return
    obj.transform = { position: transform.position || [0, 0, 0],
                      rotation: transform.rotation || 0,
                      scale: transform.scale === undefined
                        ? 1 : transform.scale }
    commit()
  },

  setParent (id, parentId) {
    const obj = store.document.objects.find((o) => o.id === id)
    if (!obj || id === parentId) return
    if (parentId) {
      let cursor = parentId
      while (cursor) {          // cycle guard
        if (cursor === id) return
        const node = store.document.objects.find((o) => o.id === cursor)
        cursor = node && node.parentId
      }
    }
    obj.parentId = parentId || null
    commit()
  },

  deleteObject (id) {
    const objects = store.document.objects
    const index = objects.findIndex((o) => o.id === id)
    if (index === -1) return
    objects.splice(index, 1)
    for (const child of objects.filter((o) => o.parentId === id)) {
      child.parentId = null
    }
    store.document.expressions = store.document.expressions
      .filter((e) => e.id !== id)
    for (const stage of store.document.timeline) {
      stage.steps = (stage.steps || []).filter((s) => s.target !== id)
    }
    store.document.annotations = store.document.annotations
      .filter((a) => a.target !== id)
    if (store.selectedId === id) store.selectedId = null
    commit()
  },

  reorderObject (id, direction) {
    const objects = store.document.objects
    const index = objects.findIndex((o) => o.id === id)
    const target = direction === 'up' ? index + 1 : index - 1
    if (index === -1 || target < 0 || target >= objects.length) return
    const [node] = objects.splice(index, 1)
    objects.splice(target, 0, node)
    commit()
  }
}
