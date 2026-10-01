<template>
  <aside class="bg-studio-surface border-l border-studio-border flex flex-col overflow-hidden">
    <div class="px-3 py-2 border-b border-studio-border flex-shrink-0">
      <div class="flex items-center gap-1 mb-1">
        <button class="insp-tab" :class="{ active: tab === 'object' }"
          @click="tab = 'object'">Object</button>
        <button class="insp-tab" :class="{ active: tab === 'state' }"
          @click="tab = 'state'">State · Machines</button>
      </div>
      <h3 class="text-[10px] font-semibold uppercase tracking-wider text-studio-text-muted">
        Inspector
      </h3>
      <p v-if="!selected && tab === 'object'" class="text-[10px] text-studio-text-muted/60 mt-1">
        Select an object to edit its semantic properties.
      </p>
      <div v-if="selected && tab === 'object'" class="flex items-center gap-2 mt-1">
        <span class="text-[11px] font-semibold text-studio-text truncate">{{ selected.label || selected.id }}</span>
        <span class="text-[9px] px-1.5 py-0.5 rounded bg-studio-accent/10 text-studio-accent font-mono">{{ selected.type }}</span>
      </div>
    </div>

    <StatePanel v-if="tab === 'state'" class="flex-1 overflow-y-auto" />

    <div class="flex-1 overflow-y-auto p-3 space-y-4" v-if="tab === 'object' && selected">
      <!-- Identity + placement (generic, every object) -->
      <section>
        <h4 class="sci-section-title">Identity & Placement</h4>
        <label class="field"><span>id</span>
          <input class="sci-input" :value="selected.id" disabled /></label>
        <label class="field"><span>label</span>
          <input class="sci-input" :value="selected.label || ''"
            placeholder="display name"
            @input="actions.updateObject(selected.id, { label: $event.target.value })" /></label>
        <label class="field"><span>parent</span>
          <select class="sci-input" :value="selected.parentId || ''"
            @change="actions.setParent(selected.id, $event.target.value || null)">
            <option value="">— none —</option>
            <option v-for="o in otherObjects" :key="o.id" :value="o.id">{{ o.label || o.id }}</option>
          </select></label>
        <div class="grid grid-cols-3 gap-1.5">
          <label class="field"><span>x</span><input class="sci-input" type="number" step="0.1"
            :value="position[0]" @input="setPosition(0, $event.target.value)" /></label>
          <label class="field"><span>y</span><input class="sci-input" type="number" step="0.1"
            :value="position[1]" @input="setPosition(1, $event.target.value)" /></label>
          <label class="field"><span>z</span><input class="sci-input" type="number" step="0.1"
            :value="position[2]" @input="setPosition(2, $event.target.value)" /></label>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          <label class="field"><span>rotation°</span><input class="sci-input" type="number" step="1"
            :value="transform.rotation" @input="setTransformPart('rotation', $event.target.value)" /></label>
          <label class="field"><span>scale</span><input class="sci-input" type="number" step="0.05"
            :value="transform.scale" @input="setTransformPart('scale', $event.target.value)" /></label>
        </div>
      </section>

      <!-- Type properties (schema-driven — registry is the contract #34 §6) -->
      <PropertyFields :object="selected" :fields="propertyFields"
        @set="setProp" />
      <!-- Formula editing (structured — #29 §3, #32 §5) -->
      <FormulaEditor v-if="expression" :expression="expression" />
      <!-- Graph editing (#34 §2) -->
      <GraphEditor v-if="selected.type === 'graph.network'" :node="selected" />
    </div>
  </aside>
</template>

<script>
import { store, actions } from '../../sci/storeActions.js'
import { libraryTypes } from '../../sci/library.js'
import FormulaEditor from './FormulaEditor.vue'
import GraphEditor from './GraphEditor.vue'
import StatePanel from './StatePanel.vue'
import PropertyFields from './PropertyFields.vue'

export default {
  name: 'InspectorPanel',
  components: { FormulaEditor, GraphEditor, StatePanel, PropertyFields },
  data () { return { tab: 'object' } },
  computed: {
    store () { return store },
    selected () {
      return store.document.objects.find((o) => o.id === store.selectedId)
    },
    expression () {
      return store.document.expressions.find(
        (e) => e.id === store.selectedId) || null
    },
    otherObjects () {
      return store.document.objects.filter((o) => o.id !== store.selectedId)
    },
    transform () {
      return this.selected?.transform || { position: [0, 0, 0], rotation: 0, scale: 1 }
    },
    position () { return this.transform.position || [0, 0, 0] },
    propertyFields () {
      const types = libraryTypes(store.schemaTypes)
      const entry = types.find((t) => t.key === this.selected?.type)
      if (!entry || !entry.properties) return []
      return Object.entries(entry.properties)
        .map(([name, spec]) => ({ name, ...spec }))
    }
  },
  methods: {
    actions,
    setProp (name, value) { actions.setProperty(this.selected.id, name, value) },
    setPosition (axis, value) {
      const position = [...this.position]
      position[axis] = parseFloat(value) || 0
      actions.setTransform(this.selected.id, { ...this.transform, position })
    },
    setTransformPart (key, value) {
      actions.setTransform(this.selected.id, {
        ...this.transform, [key]: parseFloat(value) || 0
      })
    }
  }
}
</script>

<style scoped>
.insp-tab { @apply text-[9px] px-2 py-1 rounded-md font-semibold
  text-studio-text-muted hover:text-studio-text transition-all; }
.insp-tab.active { @apply bg-studio-accent/15 text-studio-accent; }
.field { @apply flex items-center justify-between gap-2 mb-1.5 text-[10px]
  text-studio-text-muted; }
.field span { @apply truncate max-w-[38%]; }
.field em { @apply text-red-400 not-italic ml-0.5; }
</style>
