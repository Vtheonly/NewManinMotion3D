<template>
  <!-- State-system rows of the Suprepto timeline (#33): one row per state
       symbol / machine / comparison, with their steps in the stage grid. -->
  <div>
    <div class="h-6 px-2 flex items-center text-[8px] uppercase tracking-wider
      text-studio-text-muted/60 border-y border-studio-border/50 bg-studio-bg/30">
      State system
    </div>
    <div v-for="row in stateRows" :key="row.id" class="steps-row">
      <div class="row-label">
        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400"></span>
        <span class="truncate">{{ row.label }}</span>
      </div>
      <div v-for="s in stages" :key="s.id" class="stage-cell"
        :style="{ width: stageWidth + 'px' }">
        <button v-for="entry in stepsOf(s, row.id)" :key="entry.index"
          class="step-block state" :title="entry.step.op + ' → ' + entry.step.target"
          @click.stop="selectStep(s.id, entry.index)">
          {{ entry.step.op }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { store } from '../../sci/storeActions.js'

export default {
  name: 'SciStateRows',
  props: {
    stages: { type: Array, required: true },
    stageWidth: { type: Number, required: true }
  },
  computed: {
    doc () { return store.document },
    stateRows () {
      const symbols = this.doc.state.symbols.map(
        (s) => ({ id: s.id, label: `∑ ${s.id} (${s.kind})` }))
      const machines = this.doc.state.machines.map(
        (m) => ({ id: m.id, label: `⚙ ${m.id}` }))
      const comparisons = this.doc.comparisons.map(
        (c) => ({ id: c.id, label: `⇋ ${c.id}` }))
      return [...symbols, ...machines, ...comparisons]
    }
  },
  methods: {
    stepsOf (stage, targetId) {
      const entries = []
      ;(stage.steps || []).forEach((step, index) => {
        if (step.target === targetId) entries.push({ step, index })
      })
      return entries
    },
    selectStep (stageId, index) {
      store.selectedStepRef = { stageId, index }
      store.selectedStageId = stageId
    }
  }
}
</script>

<style scoped>
.row-label { @apply flex items-center gap-1.5 px-2 h-6 text-[10px]
  text-studio-text border-b border-studio-border/30 flex-shrink-0 w-44
  sticky left-0 z-10 bg-studio-surface; }
.steps-row { @apply flex h-6 border-b border-studio-border/30; }
.stage-cell { @apply flex-shrink-0 flex items-center gap-1 px-1 border-r
  border-studio-border/30 overflow-hidden; }
.step-block { @apply text-[8px] px-1.5 py-0.5 rounded font-mono cursor-pointer
  hover:brightness-125 border border-transparent whitespace-nowrap; }
</style>
