<template>
  <!-- Lane only (#33): the fixed label column lives in Timeline.vue -->
  <div class="obj-row flex border-b border-studio-border/30 h-9 flex-shrink-0"
       :class="{ selected: isObjSelected }">
    <div class="lane flex-1 relative overflow-hidden" @click.self="deselect">
      <div :style="{ width: totalW + 'px' }" class="h-full relative">
        <!-- Incoming-morph ghost on the TARGET's row (issue #43): the
             transform's result appears here — dashed outline, no pointer -->
        <div v-for="g in incomingGhosts" :key="'g' + g.clip.id"
             class="clip-chip transform-ghost"
             :style="ghostStyle(g.clip)"
             :title="`Becomes ${g.sourceName} → ${obj.name} at ${fmt(g.clip.startTime + g.clip.duration)}s`"></div>

        <!-- Clips on this object's row -->
        <div v-for="clip in objClips" :key="clip.id"
             class="clip-chip" :class="[clip.type, { selected: isClipSelected(clip.id), dragging: drag && drag.clipId === clip.id }]"
             :style="clipStyle(clip)"
             :title="clipTitle(clip)"
             @mousedown.stop="startClipDrag(clip, $event)">
          <span v-if="clip.duration * pps > 46" class="clip-label">{{ clip.type === 'transform' ? 'A→B' : clip.type }}</span>
          <!-- Edge resize handles (move = retime, resize = reduration) -->
          <div class="clip-handle left" @mousedown.stop="startClipResize(clip, 'left', $event)"></div>
          <div class="clip-handle right" @mousedown.stop="startClipResize(clip, 'right', $event)"></div>
        </div>

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
  data() { return { isDragging: false, drag: null }; },
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
    /** Transforms whose TARGET is this object: their result appears here. */
    incomingGhosts() {
      const out = [];
      for (const track of store.project.tracks) {
        for (const clip of track.clips) {
          if (clip.type === 'transform' && clip.targetId === this.obj.id) {
            const src = store.project.objects.find(o => o.id === clip.sourceId);
            out.push({ clip, sourceName: src ? src.name : '?' });
          }
        }
      }
      return out;
    },
    barStyle() {
      // Two-lane row (issue #43): the lifetime bar owns the upper lane,
      // clip chips get a full lower lane (they used to be ~3px slivers
      // hidden behind the bar — unclickable and easy to miss).
      return {
        top: '2px',
        bottom: '17px',
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
    ghostStyle(clip) {
      return {
        left: `${clip.startTime * this.pps}px`,
        width: `${Math.max(10, clip.duration * this.pps - 2)}px`
      };
    },
    clipTitle(clip) {
      const base = `${clip.type} · ${this.fmt(clip.startTime)}s → ${this.fmt(clip.startTime + clip.duration)}s`;
      if (clip.type !== 'transform') return base;
      const tgt = store.project.objects.find(o => o.id === clip.targetId);
      return base + ` · morphs ${this.obj.name} → ${tgt ? tgt.name : '?'}`;
    },
    isClipSelected(id) { return store.selectedClipId === id; },
    selectObj(id, e) { actions.selectObject(id, e.shiftKey || e.ctrlKey); },
    selectClip(id) { actions.selectClip(id); },
    deselect() { actions.deselectAll(); },

    // ── Clip chip dragging (issue #43): retime a clip by dragging it in
    // the track; live preview updates while dragging, ONE history commit
    // on release (same contract as the object lifetime bar).
    startClipDrag(clip, e) {
      if (e.button !== 0) return;
      this.selectClip(clip.id);
      this.drag = { clipId: clip.id, mode: 'move', startX: e.clientX, startT: clip.startTime };
      const move = (ev) => {
        if (!this.drag) return;
        const dt = (ev.clientX - this.drag.startX) / this.pps;
        const newStart = Math.max(0, Math.round((this.drag.startT + dt) * 10) / 10);
        if (newStart !== clip.startTime) actions.updateClip(clip.id, { startTime: newStart });
      };
      const up = () => {
        if (this.drag) actions.commitState();
        this.drag = null;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },

    startClipResize(clip, dir, e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.selectClip(clip.id);
      this.drag = { clipId: clip.id, mode: 'resize', startX: e.clientX, startT: clip.startTime, startD: clip.duration };
      const move = (ev) => {
        if (!this.drag) return;
        const dx = (ev.clientX - this.drag.startX) / this.pps;
        if (dir === 'left') {
          // Leading edge: move the start, keep the end anchored
          const end = this.drag.startT + this.drag.startD;
          let newStart = Math.max(0, Math.round((this.drag.startT + dx) * 10) / 10);
          let newDur = Math.round((end - newStart) * 10) / 10;
          if (newDur < 0.1) { newStart = Math.max(0, Math.round((end - 0.1) * 10) / 10); newDur = 0.1; }
          if (newStart !== clip.startTime || newDur !== clip.duration) {
            actions.updateClip(clip.id, { startTime: newStart, duration: newDur });
          }
        } else {
          const newDur = Math.max(0.1, Math.round((this.drag.startD + dx) * 10) / 10);
          if (newDur !== clip.duration) actions.updateClip(clip.id, { duration: newDur });
        }
      };
      const up = () => {
        if (this.drag) actions.commitState();
        this.drag = null;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    },

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
        actions.commitState();
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
        actions.commitState();
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
  @apply absolute rounded-md border flex items-center gap-1 px-1.5 text-[9px] font-medium text-studio-text-muted;
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
  /* Lower lane of the two-lane row: 12px tall, genuinely clickable and
     draggable (was top-3/bottom-3 = a ~3px sliver behind the obj-bar). */
  @apply absolute rounded-sm opacity-80 cursor-grab border border-white/10;
  top: 23px;
  bottom: 1px;
}
.clip-chip:hover { @apply opacity-100 brightness-125; }
.clip-chip.selected { @apply ring-1 ring-white/70; }
.clip-chip.dragging { @apply cursor-grabbing opacity-100 z-20; }
.clip-chip .clip-label {
  @apply text-[8px] font-mono text-white/90 truncate px-1 pointer-events-none select-none;
}
.clip-chip.transform { @apply border-dashed; }
/* Incoming morph ghost (target row): result appears here when the morph ends */
.clip-chip.transform-ghost {
  @apply border-dashed border-white/25 bg-white/5 pointer-events-none;
  background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 8px);
}
/* Clip edge handles: resize duration without leaving the track */
.clip-chip .clip-handle {
  @apply absolute top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 z-10;
}
.clip-chip .clip-handle.left { @apply left-0; background: linear-gradient(90deg, rgba(255,255,255,0.55), transparent); }
.clip-chip .clip-handle.right { @apply right-0; background: linear-gradient(270deg, rgba(255,255,255,0.55), transparent); }
.clip-chip:hover .clip-handle, .clip-chip.selected .clip-handle { @apply opacity-100; }
</style>
