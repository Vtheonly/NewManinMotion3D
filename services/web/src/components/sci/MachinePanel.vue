<template>
  <!-- Machines + comparisons + annotations — split from StatePanel.vue -->
  <div class="p-2 space-y-3">
    <!-- Machines (#11) -->
    <section>
      <div class="flex items-center justify-between mb-1">
        <h4 class="sci-section-title mb-0">State Machines</h4>
        <button class="sci-btn" @click="addMachine">+ machine</button>
      </div>
      <div v-for="m in machines" :key="m.id" class="sci-box">
        <div class="flex items-center gap-1">
          <input class="sci-input w-24" :value="m.id" disabled />
          <button class="sci-btn danger ml-auto"
            @click="actions.removeMachine(m.id)">×</button>
        </div>
        <div class="flex flex-wrap gap-1 mt-1">
          <span v-for="s in m.states" :key="s.id"
            class="text-[9px] px-1.5 py-0.5 rounded-full"
            :class="s.id === m.initial
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-studio-bg text-studio-text-muted'">
            {{ s.label || s.id }}
            <button @click="actions.updateMachine(m.id, { initial: s.id })"
              title="set initial">●</button>
          </span>
          <button class="sci-btn" @click="addState(m)">+ state</button>
        </div>
        <div v-for="(t, i) in m.transitions" :key="t.id"
          class="text-[9px] text-studio-text-muted font-mono mt-1">
          {{ t.source }} —[{{ t.trigger }}]→ {{ t.target }}
          <button class="sci-btn danger"
            @click="removeTransition(m, i)">×</button>
        </div>
        <button class="sci-btn mt-1" @click="addTransition(m)"
          :disabled="m.states.length < 2">+ transition</button>
      </div>
    </section>

    <!-- Comparisons (#11) -->
    <section>
      <div class="flex items-center justify-between mb-1">
        <h4 class="sci-section-title mb-0">Comparisons</h4>
        <button class="sci-btn" @click="actions.addComparison({})">+ comparison</button>
      </div>
      <div v-for="c in comparisons" :key="c.id" class="sci-box">
        <div class="flex items-center gap-1">
          <input class="sci-input w-20" :value="c.id" disabled />
          <select class="sci-input flex-1" :value="c.kind"
            @change="actions.updateComparison(c.id, { kind: $event.target.value })">
            <option v-for="k in comparisonKinds" :key="k" :value="k">{{ k }}</option>
          </select>
          <button class="sci-btn danger"
            @click="actions.removeComparison(c.id)">×</button>
        </div>
        <div v-for="(metric, i) in c.metrics" :key="i"
          class="flex items-center gap-1 mt-1">
          <input class="sci-input w-20" :value="metric.label"
            @change="updateMetric(c, i, { label: $event.target.value })" />
          <input class="sci-input w-14" type="number" step="any" :value="metric.a"
            @change="updateMetric(c, i, { a: parseFloat($event.target.value) || 0 })" />
          <span class="text-[9px] text-studio-text-muted">→</span>
          <input class="sci-input w-14" type="number" step="any" :value="metric.b"
            @change="updateMetric(c, i, { b: parseFloat($event.target.value) || 0 })" />
        </div>
      </div>
    </section>

    <!-- Live annotations (#5) -->
    <section>
      <div class="flex items-center justify-between mb-1">
        <h4 class="sci-section-title mb-0">Live Annotations</h4>
        <button class="sci-btn" :disabled="!store.selectedId"
          @click="actions.addAnnotation({ target: store.selectedId,
            provider: symbols[0] && symbols[0].id })">+ annotate selected</button>
      </div>
      <div v-for="a in annotations" :key="a.id" class="sci-row">
        <span class="text-[9px] text-studio-text-muted w-16 truncate" :title="a.target">
          {{ a.target }}
        </span>
        <select class="sci-input flex-1" :value="a.provider"
          @change="actions.updateAnnotation(a.id, { provider: $event.target.value })">
          <option :value="null">— static —</option>
          <option v-for="s in symbols" :key="s.id" :value="s.id">∑ {{ s.id }}</option>
        </select>
        <input class="sci-input flex-1" :value="a.format || ''"
          placeholder="format e.g. v = {value:.2f}"
          @change="actions.updateAnnotation(a.id, { format: $event.target.value })" />
        <button class="sci-btn danger"
          @click="actions.removeAnnotation(a.id)">×</button>
      </div>
    </section>
  </div>
</template>

<script>
import { store, actions } from '../../sci/storeActions.js'
import { COMPARISON_KINDS } from '../../sci/document.js'

export default {
  name: 'MachinePanel',
  data () { return { comparisonKinds: COMPARISON_KINDS } },
  computed: {
    store () { return store },
    symbols () { return store.document.state.symbols },
    machines () { return store.document.state.machines },
    comparisons () { return store.document.comparisons },
    annotations () { return store.document.annotations }
  },
  methods: {
    actions,
    addMachine () {
      actions.addMachine({
        states: [{ id: 'initial', label: 'Initial' },
                 { id: 'updated', label: 'Updated' }],
        transitions: [{ id: 't1', source: 'initial', target: 'updated',
                       trigger: 'step', sets: {} }],
        initial: 'initial' })
    },
    addState (m) {
      const index = m.states.length + 1
      actions.updateMachine(m.id, {
        states: [...m.states, { id: `state_${index}`, label: `State ${index}` }] })
    },
    addTransition (m) {
      const index = m.transitions.length + 1
      actions.updateMachine(m.id, { transitions: [...m.transitions,
        { id: `t${index}`, source: m.states[0].id,
          target: m.states[m.states.length - 1].id, trigger: '', sets: {} }] })
    },
    removeTransition (m, index) {
      const transitions = [...m.transitions]
      transitions.splice(index, 1)
      actions.updateMachine(m.id, { transitions })
    },
    updateMetric (c, index, updates) {
      const metrics = c.metrics.map(
        (m, i) => i === index ? { ...m, ...updates } : m)
      actions.updateComparison(c.id, { metrics })
    }
  }
}
</script>


