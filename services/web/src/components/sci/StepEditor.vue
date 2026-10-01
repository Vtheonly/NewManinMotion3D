<template>
  <!-- Selected step editor — split from SciTimeline.vue (file-size rule) -->
  <div class="h-12 border-t border-studio-border flex items-center gap-2 px-3 flex-shrink-0">
    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded" :class="opClass(step.op)">
      {{ step.op }}
    </span>
    <label class="field-inline"><span>target</span>
      <select class="sci-input" :value="step.target"
        @change="$emit('update', { target: $event.target.value })">
        <option v-for="o in targetsFor" :key="o.id" :value="o.id">{{ o.label }}</option>
      </select></label>
    <label class="field-inline" v-if="hasDuration"><span>dur</span>
      <input class="sci-input w-16" type="number" step="0.1" min="0"
        :value="step.duration"
        @change="$emit('update', { duration: parseFloat($event.target.value) })" /></label>
    <label class="field-inline" v-if="step.op === 'play'"><span>anim</span>
      <select class="sci-input" :value="step.animation"
        @change="$emit('update', { animation: $event.target.value })">
        <option v-for="a in animations" :key="a" :value="a">{{ a }}</option>
      </select></label>
    <label class="field-inline" v-if="step.op === 'highlight'"><span>behaviors</span>
      <input class="sci-input w-40" :value="(step.properties?.behaviors || []).join(', ')"
        placeholder="focus, glow, pulse…"
        @change="$emit('update', { properties: { ...step.properties,
          behaviors: $event.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })" /></label>
    <label class="field-inline" v-if="step.op === 'set'"><span>value</span>
      <input class="sci-input w-20" type="number" step="any"
        :value="step.properties?.value"
        @change="$emit('update', { properties: { ...step.properties,
          value: parseFloat($event.target.value) || 0 } })" /></label>
    <label class="field-inline" v-if="step.op === 'interpolate'"><span>to</span>
      <input class="sci-input w-16" type="number" step="any"
        :value="step.properties?.to"
        @change="$emit('update', { properties: { ...step.properties,
          to: parseFloat($event.target.value) || 0 } })" /></label>
    <div class="flex-1"></div>
    <button class="sci-btn danger" @click="$emit('remove')">remove step</button>
  </div>
</template>

<script>
import { store } from '../../sci/storeActions.js'

const OP_TONES = {
  show: 'bg-emerald-500/20 text-emerald-300',
  play: 'bg-indigo-500/20 text-indigo-300',
  highlight: 'bg-amber-500/20 text-amber-300',
  annotate: 'bg-cyan-500/20 text-cyan-300',
  transform: 'bg-purple-500/20 text-purple-300',
  camera: 'bg-slate-500/20 text-slate-300',
  set: 'bg-teal-500/20 text-teal-300',
  interpolate: 'bg-teal-500/20 text-teal-300',
  transition: 'bg-orange-500/20 text-orange-300',
  compare: 'bg-pink-500/20 text-pink-300',
  wait: 'bg-studio-border/40 text-studio-text-muted',
  custom: 'bg-red-500/20 text-red-300'
}

export default {
  name: 'StepEditor',
  props: { step: { type: Object, required: true } },
  data () {
    return { animations: ['write', 'create', 'fade_in', 'grow', 'indicate',
      'draw', 'uncreate', 'fade_out'] }
  },
  computed: {
    hasDuration () {
      return this.step.op !== 'show' && this.step.op !== 'set' &&
        this.step.op !== 'custom'
    },
    targetsFor () {
      const doc = store.document
      if (['set', 'interpolate'].includes(this.step.op)) {
        return doc.state.symbols.map((s) => ({ id: s.id, label: s.id }))
      }
      if (this.step.op === 'transition') {
        return doc.state.machines.map((m) => ({ id: m.id, label: m.id }))
      }
      if (this.step.op === 'compare') {
        return doc.comparisons.map((c) => ({ id: c.id, label: c.id }))
      }
      return doc.objects.map((o) => ({ id: o.id, label: o.label || o.id }))
    }
  },
  methods: {
    opClass (op) { return OP_TONES[op] || 'bg-studio-border/40 text-studio-text-muted' }
  }
}
</script>

<style scoped>
.field-inline { @apply flex items-center gap-1 text-[9px] text-studio-text-muted; }
.field-inline span { @apply whitespace-nowrap; }
</style>
