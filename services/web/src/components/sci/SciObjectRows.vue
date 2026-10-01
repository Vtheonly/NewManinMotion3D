<template>
  <!-- Object rows of the Suprepto timeline (#33): one row per object
       identity, steps placed in the stage grid on the object's own row. -->
  <div>
    <div v-for="row in rows" :key="'r-' + row.id" class="steps-row">
      <div class="row-label" :style="{ paddingLeft: (8 + row.depth * 10) + 'px' }"
           :class="{ selected: store.selectedId === row.id }"
           @click="actions.select(row.id)">
        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0"
              :style="{ background: typeColor(row.type) }"></span>
        <span class="truncate">{{ row.label }}</span>
        <span class="text-[8px] text-studio-text-muted/50 ml-auto">{{ row.type }}</span>
      </div>
      <div v-for="s in stages" :key="s.id" class="stage-cell"
        :style="{ width: stageWidth + 'px' }">
        <button v-for="entry in stepsOf(s, row.id)" :key="entry.index"
          class="step-block" :class="[opClass(entry.step.op),
            { selected: isStepSelected(s.id, entry.index) }]"
          :title="`${entry.step.op} → ${entry.step.target}`"
          @click.stop="selectStep(s.id, entry.index)">
          {{ entry.step.op }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { store, actions } from '../../sci/storeActions.js'

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

const TYPE_COLORS = {
  core: '#94a3b8', ui: '#64748b', math: '#818cf8', graph: '#34d399',
  nn: '#f472b6', attention: '#22d3ee', biology: '#4ade80',
  kinematics: '#fbbf24', presentation: '#c084fc', comparison: '#f9a8d4'
}

export default {
  name: 'SciObjectRows',
  props: {
    stages: { type: Array, required: true },
    stageWidth: { type: Number, required: true }
  },
  computed: {
    store () { return store },
    rows () {
      return store.document.objects.map((obj) => {
        let depth = 0
        let cursor = obj.parentId
        const seen = new Set([obj.id])
        while (cursor && !seen.has(cursor)) {
          seen.add(cursor); depth += 1
          const parent = store.document.objects.find((o) => o.id === cursor)
          cursor = parent ? parent.parentId : null
        }
        return { id: obj.id, type: obj.type, depth,
                 label: obj.label || obj.id }
      })
    }
  },
  methods: {
    actions,
    typeColor (type) { return TYPE_COLORS[type.split('.')[0]] || '#94a3b8' },
    opClass (op) { return OP_TONES[op] || 'bg-studio-border/40 text-studio-text-muted' },
    stepsOf (stage, targetId) {
      const entries = []
      ;(stage.steps || []).forEach((step, index) => {
        if (step.target === targetId) entries.push({ step, index })
      })
      return entries
    },
    isStepSelected (stageId, index) {
      return store.selectedStepRef &&
        store.selectedStepRef.stageId === stageId &&
        store.selectedStepRef.index === index
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
  text-studio-text cursor-pointer border-b border-studio-border/30
  hover:bg-studio-bg/60 w-44 flex-shrink-0 sticky left-0 z-10
  bg-studio-surface; }
.row-label.selected { @apply bg-studio-accent/10 text-studio-accent; }
.steps-row { @apply flex h-6 border-b border-studio-border/30; }
.stage-cell { @apply flex-shrink-0 flex items-center gap-1 px-1 border-r
  border-studio-border/30 overflow-hidden; }
.step-block { @apply text-[8px] px-1.5 py-0.5 rounded font-mono cursor-pointer
  hover:brightness-125 border border-transparent whitespace-nowrap; }
.step-block.selected { @apply ring-1 ring-white/60; }
</style>
