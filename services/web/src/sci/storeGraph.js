/**
 * Suprepto editor actions — graph builder (issue #34 §2; split for the
 * file-size rule). Nodes/edges/weights + deterministic relayout.
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
  // ── graph builder (#34 §2) ─────────────────────────────────────────────
  addGraphNode (graphId, nodeId = null, label = null) {
    const graph = store.document.objects.find((o) => o.id === graphId)
    if (!graph) return
    const id = nodeId || uid('n')
    graph.properties.nodes.push({ id, label: label || id })
    commit()
    return id
  },

  removeGraphNode (graphId, nodeId) {
    const graph = store.document.objects.find((o) => o.id === graphId)
    if (!graph) return
    graph.properties.nodes = graph.properties.nodes
      .filter((n) => n.id !== nodeId)
    graph.properties.edges = graph.properties.edges
      .filter((e) => e.from !== nodeId && e.to !== nodeId)
    commit()
  },

  updateGraphNode (graphId, nodeId, updates) {
    const graph = store.document.objects.find((o) => o.id === graphId)
    if (!graph) return
    const node = graph.properties.nodes.find((n) => n.id === nodeId)
    if (node) Object.assign(node, updates)
    commit()
  },

  addGraphEdge (graphId, from, to, weight = 1.0, directed = false) {
    const graph = store.document.objects.find((o) => o.id === graphId)
    if (!graph) return
    graph.properties.edges.push({ from, to, weight, directed })
    commit()
  },

  removeGraphEdge (graphId, from, to) {
    const graph = store.document.objects.find((o) => o.id === graphId)
    if (!graph) return
    graph.properties.edges = graph.properties.edges
      .filter((e) => !(e.from === from && e.to === to))
    commit()
  },

  updateGraphEdge (graphId, from, to, updates) {
    const graph = store.document.objects.find((o) => o.id === graphId)
    if (!graph) return
    const edge = graph.properties.edges
      .find((e) => e.from === from && e.to === to)
    if (edge) Object.assign(edge, updates)
    commit()
  },

  relayoutGraph (graphId, layout) {
    const graph = store.document.objects.find((o) => o.id === graphId)
    if (!graph) return
    Vue.set(graph.properties, 'layout', layout)
    for (const node of graph.properties.nodes) delete node.position
    commit()
  }
}
