<template>
  <div class="bg-studio-surface border-t border-studio-border flex flex-col flex-shrink-0 overflow-hidden">
    <!-- Header: stages + add -->
    <div class="h-8 flex items-center gap-2 px-3 border-b border-studio-border flex-shrink-0">
      <span class="sci-section-title">
        Timeline — one row per object
      </span>
      <div class="flex-1"></div>
      <select v-model="selectedStageId" class="sci-input">
        <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.id }} · {{ s.title }}</option>
      </select>
      <button class="sci-btn" @click="actions.addStage()">+ stage</button>
      <button class="sci-btn" @click="addStep" :disabled="!selectedStageId">+ step</button>
    </div>

    <!-- Rows: one per object identity (#33); labels are sticky-left so they
         stay visible while the stage grid scrolls horizontally -->
    <div class="flex-1 overflow-auto" ref="stepsCol">
      <div class="flex h-6 sticky top-0 z-20 bg-studio-bg/95 border-b border-studio-border/50">
        <div class="stage-head row-label-sticky">Objects</div>
        <div v-for="s in stages" :key="s.id" class="stage-head"
          :style="{ width: stageWidth + 'px' }" :title="s.title">
          {{ s.title || s.id }}
        </div>
        <div class="stage-head" style="width: 80px;">+</div>
      </div>
      <SciObjectRows :stages="stages" :stage-width="stageWidth" />
      <SciStateRows :stages="stages" :stage-width="stageWidth" />
    </div>

    <StepEditor v-if="selectedStep" :step="selectedStep.step"
      @update="updateStep" @remove="removeStep" />
  </div>
</template>

<script>
import { store, actions } from '../../sci/storeActions.js'
import StepEditor from './StepEditor.vue'
import SciObjectRows from './SciObjectRows.vue'
import SciStateRows from './SciStateRows.vue'

export default {
  name: 'SciTimeline',
  components: { StepEditor, SciObjectRows, SciStateRows },
  data () { return { stageWidth: 170 } },
  computed: {
    store () { return store },
    doc () { return store.document },
    stages () { return this.doc.timeline },
    selectedStageId: {
      get () { return store.selectedStageId },
      set (v) { store.selectedStageId = v }
    },
    selectedStep () {
      if (!store.selectedStepRef) return null
      const { stageId, index } = store.selectedStepRef
      const stage = this.stages.find((s) => s.id === stageId)
      if (!stage || !stage.steps[index]) return null
      return { step: stage.steps[index], stageId, index }
    }
  },
  methods: {
    actions,
    addStep () {
      if (!store.selectedStageId) return
      actions.addStep(store.selectedStageId, {
        op: 'show',
        target: store.selectedId ||
          (this.doc.objects[0] && this.doc.objects[0].id)
      })
    },
    updateStep (updates) {
      if (!this.selectedStep) return
      actions.updateStep(this.selectedStep.stageId, this.selectedStep.index,
                         updates)
    },
    removeStep () {
      if (!this.selectedStep) return
      actions.removeStep(this.selectedStep.stageId, this.selectedStep.index)
      store.selectedStepRef = null
    }
  }
}
</script>

<style scoped>
.stage-head { @apply flex-shrink-0 px-2 flex items-center text-[8px]
  uppercase tracking-wider text-studio-text-muted/70 border-r
  border-studio-border/30 truncate; }
.row-label-sticky { @apply w-44 sticky left-0 z-10 bg-studio-bg/95
  text-studio-text-muted/60 justify-start; }
</style>
