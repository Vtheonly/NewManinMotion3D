<template>
  <!-- Lane only (#33): the fixed label column lives in Timeline.vue -->
  <div class="obj-row flex border-b border-studio-border/30 h-7 flex-shrink-0"
       :class="{ selected: isObjSelected }">
    <div class="lane flex-1 relative overflow-hidden" @click.self="deselect">
      <div :style="{ width: totalW + 'px' }" class="h-full relative">
        <!-- Clips on this object's row -->
        <div v-for="clip in objClips" :key="clip.id"
             class="clip-chip" :class="[clip.type, { selected: isClipSelected(clip.id) }]"
             :style="clipStyle(clip)"
             :title="`${clip.type} · ${fmt(clip.startTime)}s → ${fmt(clip.startTime + clip.duration)}s`"
             @click.stop="selectClip(clip.id)"></div>

        <!-- Lifetime bar -->
        <div class="obj-bar" :class="{ dragging: isDragging }" :style="barStyle"
             @mousedown.stop="startBarDrag($event)">
          <div class="resize-handle left" @mousedown.stop="startResize('left', $event)"></div>
          <span class="obj-bar-dot"></span>
          <span class="truncate">{{ fmt(enter) }}–{{ fmt(enter + dur) }}s</span>
          <div class="resize-handle right" @mousedown.stop="startResize('right', $event)"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { store, actions, SHAPE_COLORS } from '../../store/project.js';

export default {
  name: 'TimelineObjectRow',
  props: {
    obj: { type: Object, required: true },
    pps: { type: Number, required: true },
    totalW: { type: Number, required: true }
  },
  data() { return { isDragging: false }; },
  computed: {
    enter() { return this.obj.enterTime || 0; },
    dur() { return this.obj.duration || 3; },
    objColor() { return SHAPE_COLORS[this.obj.type] || '#94a3b8'; },
    isObjSelected() { return store.selectedObjectIds.includes(this.obj.id); },
    /** Issue #33: every clip that belongs to THIS object lives on its row. */
    objClips() {
      const out = [];
      for (const track of store.project.tracks) {
        for (const clip of track.clips) {
          if (clip.sourceId === this.obj.id) out.push(clip);
        }
      }
      return out;
    },
    barStyle() {
      return {
        left: `${this.enter * this.pps}px`,
        width: `${Math.max(24, this.dur * this.pps)}px`,
        background: this.objColor + '26',
        borderColor: this.objColor + '80'
      };
    }
  },
  methods: {
    fmt(s) { return Number(s).toFixed(1).replace(/\.0$/, ''); },
    clipStyle(clip) {
      return {
        left: `${clip.startTime * this.pps}px`,
        width: `${Math.max(10, clip.duration * this.pps - 2)}px`,
        background: this.objColor
      };
    },
    isClipSelected(id) { return store.selectedClipId === id; },
    selectObj(id, e) { actions.selectObject(id, e.shiftKey || e.ctrlKey); },
    selectClip(id) { actions.selectClip(id); },
    deselect() { actions.deselectAll(); },

    startBarDrag(e) {
      this.selectObj(this.obj.id, e);
      this.isDragging = true;
      const startX = e.clientX;
      const startEnter = this.enter;
      const move = (ev) => {
        const dx = (ev.clientX - startX) / this.pps;
        actions.updateObject(this.obj.id, { enterTime: Math.max(0, Math.round((startEnter + dx) * 10) / 10) });
      };
      const up = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },
    startResize(dir, e) {
      e.preventDefault();
      this.selectObj(this.obj.id, e);
      this.isDragging = true;
      const startX = e.clientX;
      const startEnter = this.enter;
      const startDur = this.dur;
      const move = (ev) => {
        const dx = (ev.clientX - startX) / this.pps;
        if (dir === 'left') {
          const newEnter = Math.max(0, Math.round((startEnter + dx) * 10) / 10);
          const newDur = Math.max(0.1, Math.round((startDur - dx) * 10) / 10);
          actions.updateObject(this.obj.id, { enterTime: newEnter, duration: newDur });
        } else {
          const newDur = Math.max(0.1, Math.round((startDur + dx) * 10) / 10);
          actions.updateObject(this.obj.id, { duration: newDur });
        }
      };
      const up = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    }
  }
};
</script>

<style scoped>
.obj-row.selected { @apply bg-studio-accent/5; }
.lane { background-image: repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(255,255,255,0.015) 79px, rgba(255,255,255,0.015) 80px); }
.obj-bar {
  @apply absolute top-1 bottom-1 rounded-md border flex items-center gap-1 px-1.5 text-[9px] font-medium text-studio-text-muted;
  @apply cursor-grab hover:brightness-125 transition-all z-10;
}
.obj-bar.dragging { @apply cursor-grabbing; }
.obj-bar.selected { @apply ring-1 ring-white/50; }
.obj-bar-dot { @apply w-1.5 h-1.5 rounded-full flex-shrink-0; background: currentColor; }
.obj-bar .resize-handle {
  @apply absolute top-0 bottom-0 w-2 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity z-20;
}
.obj-bar .resize-handle.left { @apply left-0; background: linear-gradient(90deg, rgba(255,255,255,0.3), transparent); }
.obj-bar .resize-handle.right { @apply right-0; background: linear-gradient(270deg, rgba(255,255,255,0.3), transparent); }
.obj-bar:hover .resize-handle { @apply opacity-50; }
.clip-chip {
  @apply absolute top-3 bottom-3 rounded-sm opacity-70 cursor-pointer border border-white/10;
}
.clip-chip:hover { @apply opacity-100 brightness-125; }
.clip-chip.selected { @apply ring-1 ring-white/70; }
.clip-chip.transform { @apply border-dashed; }
</style>
