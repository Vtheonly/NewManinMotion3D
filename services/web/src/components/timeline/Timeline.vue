<template>
  <div class="timeline-panel bg-studio-surface border-t border-studio-border flex flex-col flex-shrink-0" style="height: 230px;">
    <!-- Header bar -->
    <div class="h-10 flex items-center px-3 border-b border-studio-border flex-shrink-0 gap-2">
      <div class="flex items-center gap-1.5 font-mono text-studio-text-muted">
        <span class="text-xs tabular-nums">{{ fmt(playbackTime) }}</span>
        <span class="text-[10px]">/ {{ fmt(totalDuration) }}</span>
      </div>
      <div class="flex-1"></div>
      <span class="text-[9px] uppercase tracking-wider text-studio-text-muted/70 hidden md:block">
        one row per object
      </span>
      <!-- Transform badge -->
      <button v-if="canTransform" class="transform-badge" @click="createTransform">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
        Transform A→B
      </button>
      <!-- Zoom -->
      <div class="flex items-center gap-1">
        <button class="text-studio-text-muted hover:text-studio-text text-xs px-1" @click="zoomOut">-</button>
        <span class="text-[10px] text-studio-text-muted w-10 text-center tabular-nums">{{ Math.round(pps) }}px/s</span>
        <button class="text-studio-text-muted hover:text-studio-text text-xs px-1" @click="zoomIn">+</button>
      </div>
    </div>

    <!-- ═════════ TIMELINE (issue #33: one independent row per object) ═════════ -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      <!-- Fixed label column -->
      <TimelineLabels :objects="objects" :scroll-top="scrollTop" />

      <!-- Scrollable body: ruler + lanes -->
      <div class="flex-1 overflow-auto relative" ref="scrollBody" @scroll="onScroll">
        <!-- Time ruler (click to seek) -->
        <div class="h-6 border-b border-studio-border/50 relative sticky top-0 z-20 bg-studio-surface cursor-pointer"
             ref="ruler" @mousedown="seekFromEvent">
          <div :style="{ width: totalW + 'px' }" class="h-full relative">
            <div v-for="tk in ticks" :key="tk.t" class="absolute top-0 h-full flex flex-col justify-end" :style="{ left: tk.x + 'px' }">
              <div class="w-px" :class="tk.major ? 'h-3 bg-studio-text-muted/30' : 'h-1.5 bg-studio-border'"></div>
              <span v-if="tk.major" class="text-[8px] text-studio-text-muted/60 ml-0.5 leading-none">{{ tk.label }}</span>
            </div>
          </div>
          <div class="playhead-marker" :style="{ left: playheadX + 'px' }"></div>
        </div>

        <!-- Object rows -->
        <TimelineObjectRow v-for="obj in objects" :key="obj.id" :obj="obj" :pps="pps" :totalW="totalW" />
        <div v-if="objects.length === 0" class="px-4 py-6 text-[10px] text-studio-text-muted/60 text-center">
          Add objects to the stage — each one gets its own timeline row
        </div>
        <div v-else-if="totalClipCount === 0" class="px-4 py-2 text-[10px] text-studio-text-muted/60 text-center">
          Select two objects and click "Transform" to create your first animation
        </div>
        <div class="playhead-line" :style="{ left: playheadX + 'px' }"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { store, actions, getters } from '../../store/project.js';
import { getPlaybackEngine } from '../../engine/playback.js';
import TimelineLabels from './TimelineLabels.vue';
import TimelineObjectRow from './TimelineObjectRow.vue';

export default {
  name: 'Timeline',
  components: { TimelineLabels, TimelineObjectRow },
  data() {
    return { pps: 80, scrollTop: 0 };
  },

  computed: {
    totalDuration() { return getters.computedDuration(); },
    objects() { return store.project.objects; },
    canTransform() { return store.selectedObjectIds.length === 2; },
    playbackTime() { return store.playbackTime || 0; },
    playheadX() { return this.playbackTime * this.pps; },
    totalW() { return this.totalDuration * this.pps + 50; },
    totalClipCount() {
      let c = 0;
      for (const t of store.project.tracks) c += t.clips.length;
      return c;
    },
    ticks() {
      const t = [];
      const iv = this.pps >= 100 ? 0.5 : 1;
      const miv = this.pps >= 100 ? 1 : 5;
      for (let s = 0; s <= this.totalDuration; s += iv) {
        t.push({ t: s, x: s * this.pps, major: Math.abs(s % miv) < 0.01 || Math.abs(s % miv - miv) < 0.01, label: this.fmt(s) });
      }
      return t;
    }
  },

  methods: {
    fmt(s) { const m = Math.floor(s / 60); const sec = s % 60; return m > 0 ? `${m}:${sec.toFixed(1).padStart(4, '0')}` : `${sec.toFixed(1)}s`; },

    zoomIn() { this.pps = Math.min(300, this.pps * 1.4); },
    zoomOut() { this.pps = Math.max(20, this.pps / 1.4); },

    onScroll() {
      if (this.$refs.scrollBody) this.scrollTop = this.$refs.scrollBody.scrollTop;
    },

    seekFromEvent(e) {
      const rect = this.$refs.ruler.getBoundingClientRect();
      const t = Math.max(0, Math.min((e.clientX - rect.left) / this.pps, this.totalDuration));
      getPlaybackEngine().seekTo(t, store.project.tracks, store.project.objects);
      actions.setPlaybackTime(t);
    },

    createTransform() {
      const clip = actions.createTransform();
      if (clip) actions.selectClip(clip.id);
    }
  }
};
</script>

<style scoped>
.transform-badge {
  @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold;
  @apply bg-purple-600 text-white hover:bg-purple-500 transition-colors;
  @apply shadow-lg shadow-purple-600/20;
}
.playhead-line {
  @apply absolute top-6 bottom-0 w-px bg-red-400/80 pointer-events-none z-10;
  box-shadow: 0 0 4px rgba(248, 113, 113, 0.6);
}
.playhead-marker {
  @apply absolute top-0 h-full w-px bg-red-400 pointer-events-none;
}
</style>
