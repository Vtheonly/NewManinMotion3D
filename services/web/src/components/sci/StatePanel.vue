<template>
  <!-- Reactive symbols + derived values (#4) — split from StatePanel.vue -->
  <div class="p-2 space-y-3">
    <section>
      <div class="flex items-center justify-between mb-1">
        <h4 class="sci-section-title mb-0">Reactive State</h4>
        <button class="sci-btn" @click="addSymbol">+ symbol</button>
      </div>
      <div v-for="s in symbols" :key="s.id" class="sci-row">
        <input class="sci-input w-20" :value="s.id" disabled />
        <select class="sci-input w-24" :value="s.kind"
          @change="actions.updateStateSymbol(s.id, { kind: $event.target.value })">
          <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
        </select>
        <input class="sci-input w-16" type="number" step="any" :value="s.value"
          title="initial value"
          @change="actions.updateStateSymbol(s.id, { value: parseFloat($event.target.value) || 0 })" />
        <button class="sci-btn" title="keyframe driver (live interpolation)"
          :class="{ active: hasDriver(s) }"
          @click="toggleDriver(s)">∿</button>
        <button class="sci-btn danger" @click="actions.removeStateSymbol(s.id)">×</button>
        <div v-if="hasDriver(s)" class="w-full flex items-center gap-1 mt-1 pl-1">
          <input class="sci-input flex-1 font-mono text-[9px]"
            :value="driverText(s)"
            placeholder="keyframes: 0→0, 2→10 (t:value pairs)"
            @change="setDriver(s, $event.target.value)" />
        </div>
      </div>
      <p v-if="!symbols.length" class="hint">No state — animations stay
        scripted. Add a symbol to make values reactive.</p>
    </section>

    <section>
      <div class="flex items-center justify-between mb-1">
        <h4 class="sci-section-title mb-0">Derived</h4>
        <button class="sci-btn" @click="addDerived">+ derived</button>
      </div>
      <div v-for="d in derived" :key="d.id" class="sci-row">
        <input class="sci-input w-20" :value="d.id" disabled />
        <input class="sci-input flex-1 font-mono text-[9px]" :value="d.expr"
          placeholder="expr e.g. x * 2"
          @input="actions.updateDerived(d.id, { expr: $event.target.value })" />
        <input class="sci-input flex-1 font-mono text-[9px]" :value="inputsText(d)"
          placeholder="inputs e.g. x:x, t:t"
          @change="setInputs(d, $event.target.value)" />
        <button class="sci-btn danger" @click="actions.removeDerived(d.id)">×</button>
      </div>
      <p class="hint">Derived symbols recompute from their true dependencies
        on every sample — expressions use the safe evaluator (no calls).</p>
    </section>

    <MachinePanel />
  </div>
</template>

<script>
import { store, actions } from '../../sci/storeActions.js'
import { STATE_KINDS } from '../../sci/document.js'
import MachinePanel from './MachinePanel.vue'

export default {
  name: 'StatePanel',
  components: { MachinePanel },
  data () { return { kinds: STATE_KINDS } },
  computed: {
    store () { return store },
    symbols () { return store.document.state.symbols },
    derived () { return store.document.state.derived }
  },
  methods: {
    actions,
    addSymbol () {
      actions.addStateSymbol({ id: `x${this.symbols.length + 1}`, value: 0 })
    },
    hasDriver (s) {
      return Boolean(s.driver && s.driver.kind === 'keyframes')
    },
    driverText (s) {
      return (s.driver?.keyframes || []).map((kf) => kf.join('→')).join(', ')
    },
    toggleDriver (s) {
      if (this.hasDriver(s)) {
        actions.updateStateSymbol(s.id, { driver: null })
      } else {
        actions.updateStateSymbol(s.id, {
          driver: { kind: 'keyframes',
                    keyframes: [[0, s.value || 0], [2, 10]],
                    easing: 'smooth' } })
      }
    },
    setDriver (s, text) {
      const frames = text.split(',').map((pair) => pair.split('→')
        .map((x) => parseFloat(x.trim())))
        .filter((f) => f.length === 2 && f.every((x) => !isNaN(x)))
      actions.updateStateSymbol(s.id, {
        driver: { kind: 'keyframes',
                  keyframes: frames.length ? frames : [[0, 0]],
                  easing: s.driver?.easing || 'smooth' } })
    },
    addDerived () {
      actions.addDerived({ expr: 'x * 2', inputs: { x: 'x' } })
    },
    inputsText (d) {
      return Object.entries(d.inputs || {}).map(
        ([alias, src]) => `${alias}:${src}`).join(', ')
    },
    setInputs (d, text) {
      const inputs = {}
      for (const pair of text.split(',')) {
        const [alias, src] = pair.split(':').map((x) => x && x.trim())
        if (alias && src) inputs[alias] = src
      }
      actions.updateDerived(d.id, { inputs })
    }
  }
}
</script>

<style scoped>
.hint { @apply text-[9px] text-studio-text-muted/60 leading-relaxed mt-1; }
</style>
