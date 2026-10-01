<template>
  <!-- Fixed label column for the timeline (#33: one row per object identity). -->
  <div class="w-[90px] flex-shrink-0 border-r border-studio-border/50 overflow-hidden">
    <div class="h-6 px-2 flex items-center text-[8px] uppercase tracking-wider text-studio-text-muted/60 border-b border-studio-border/50 bg-studio-bg/30">
      Objects
    </div>
    <div class="label-rows" :style="{ transform: `translateY(${-scrollTop}px)` }">
      <div v-for="obj in objects" :key="'lbl-' + obj.id"
           class="row-label" :class="{ selected: isObjSelected(obj.id) }"
           :style="{ borderLeftColor: objColor(obj) }"
           @click="selectObj(obj.id, $event)">
        <span class="truncate" :title="obj.name">{{ obj.name }}</span>
        <span class="text-[8px] text-studio-text-muted/50 ml-auto flex-shrink-0">{{ obj.type }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { store, actions, SHAPE_COLORS } from '../../store/project.js';

export default {
  name: 'TimelineLabels',
  props: {
    objects: { type: Array, required: true },
    scrollTop: { type: Number, default: 0 }
  },
  methods: {
    objColor(obj) { return SHAPE_COLORS[obj.type] || '#94a3b8'; },
    isObjSelected(id) { return store.selectedObjectIds.includes(id); },
    selectObj(id, e) { actions.selectObject(id, e.shiftKey || e.ctrlKey); }
  }
};
</script>

<style scoped>
.row-label {
  @apply flex items-center gap-1.5 px-2 h-7 text-[10px] text-studio-text cursor-pointer;
  @apply border-b border-studio-border/30 border-l-2 hover:bg-studio-bg/60 flex-shrink-0;
}
.row-label.selected { @apply bg-studio-accent/10 text-studio-accent; }
.label-rows { will-change: transform; }
</style>
