<template>
  <section>
    <h4 class="sci-section-title">Graph Builder</h4>

    <!-- Layout control (#34 §2: choose or run layouts; manual per node) -->
    <label class="field"><span>layout</span>
      <select class="sci-input" :value="node.properties.layout"
        @change="actions.relayoutGraph(node.id, $event.target.value)">
        <option v-for="opt in layouts" :key="opt" :value="opt">{{ opt }}</option>
      </select></label>

    <!-- Nodes -->
    <div class="mt-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[9px] text-studio-text-muted">nodes ({{ nodes.length }})</span>
        <button class="sci-btn" @click="addNode">+ node</button>
      </div>
      <div v-for="n in nodes" :key="n.id" class="flex items-center gap-1 mb-1">
        <input class="sci-input w-12" :value="n.id" disabled
               title="stable semantic id" />
        <input class="sci-input flex-1" :value="n.label"
          placeholder="label"
          @input="actions.updateGraphNode(node.id, n.id, { label: $event.target.value })" />
        <button class="sci-btn danger" @click="removeNode(n.id)">×</button>
      </div>
    </div>

    <!-- Edges -->
    <div class="mt-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[9px] text-studio-text-muted">edges ({{ edges.length }})</span>
        <button class="sci-btn" @click="addEdge" :disabled="nodes.length < 2">+ edge</button>
      </div>
      <div v-for="(e, i) in edges" :key="i" class="flex items-center gap-1 mb-1">
        <select class="sci-input w-12" :value="e.from"
          @change="actions.updateGraphEdge(node.id, e.from, e.to, { from: $event.target.value })">
          <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.id }}</option>
        </select>
        <span class="text-[9px] text-studio-text-muted">→</span>
        <select class="sci-input w-12" :value="e.to"
          @change="actions.updateGraphEdge(node.id, e.from, e.to, { to: $event.target.value })">
          <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.id }}</option>
        </select>
        <input class="sci-input w-14" type="number" step="0.1" :value="e.weight"
          title="weight"
          @input="actions.updateGraphEdge(node.id, e.from, e.to, { weight: parseFloat($event.target.value) || 0 })" />
        <button class="sci-btn" :class="{ active: e.directed }" title="directed"
          @click="actions.updateGraphEdge(node.id, e.from, e.to, { directed: !e.directed })">⇒</button>
        <button class="sci-btn danger" @click="removeEdge(e)">×</button>
      </div>
    </div>
  </section>
</template>

<script>
import { actions } from '../../sci/storeActions.js'

export default {
  name: 'GraphEditor',
  props: { node: { type: Object, required: true } },
  data () { return { layouts: ['circle', 'layered', 'grid', 'line', 'shell', 'manual'] } },
  computed: {
    nodes () { return this.node.properties.nodes || [] },
    edges () { return this.node.properties.edges || [] }
  },
  methods: {
    actions,
    addNode () { actions.addGraphNode(this.node.id) },
    removeNode (id) { actions.removeGraphNode(this.node.id, id) },
    addEdge () {
      if (this.nodes.length < 2) return
      actions.addGraphEdge(this.node.id, this.nodes[0].id,
                           this.nodes[1].id, 1.0, false)
    },
    removeEdge (edge) {
      actions.removeGraphEdge(this.node.id, edge.from, edge.to)
    }
  }
}
</script>

<style scoped>
.field { @apply flex items-center justify-between gap-2 mb-1.5 text-[10px]
  text-studio-text-muted; }
</style>
