<template>
  <div class="relative overflow-hidden" style="background: var(--studio-bg);"
       ref="container" @mousedown.self="select(null)">
    <!-- Scene outline (schematic preview — documented as non-WYSIWYG) -->
    <svg class="w-full h-full" :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="xMidYMid meet">
      <rect x="4" y="4" :width="w - 8" :height="h - 8" rx="8"
            fill="none" stroke="var(--studio-border)" stroke-dasharray="6 4" opacity="0.5"/>
      <text :x="w / 2" y="22" text-anchor="middle" class="scene-label">
        scene plane (schematic · {{ doc.sceneType }})
      </text>

      <!-- One block per object: identity = semantic id (#33 §6) -->
      <g v-for="(obj, i) in layout" :key="obj.id"
         :transform="`translate(${obj.x}, ${obj.y})`"
         @mousedown.stop="startDrag(obj, $event)"
         @click.stop="select(obj.id)"
         class="obj-block" :class="{ selected: store.selectedId === obj.id }">
        <rect x="0" y="0" :width="obj.bw" :height="obj.bh" rx="6"
              :fill="fillFor(obj)" :stroke="strokeFor(obj)" stroke-width="1.2"/>
        <text x="8" y="15" class="obj-type">{{ obj.type }}</text>
        <text x="8" y="28" class="obj-name">{{ obj.name }}</text>
        <text v-if="obj.children" x="8" :y="obj.bh - 6" class="obj-children">
          {{ obj.children }} children
        </text>
        <text v-if="obj.index !== null" :x="obj.bw - 8" y="15"
              text-anchor="end" class="obj-children">#{{ obj.index }}</text>
      </g>
    </svg>
  </div>
</template>

<script>
import { store, actions } from '../../sci/storeActions.js'

// manim frame is 14.22 x 8 world units; schematic uses a 1200x680 box
const W = 1200
const H = 680
const SCALE = W / 14.22

export default {
  name: 'SciCanvas',
  data () { return { w: W, h: H, drag: null } },
  computed: {
    store () { return store },
    doc () { return store.document },
    layout () {
      return this.doc.objects.map((obj, i) => {
        const tr = obj.transform || {}
        const pos = tr.position || [0, 0, 0]
        const x = W / 2 + pos[0] * SCALE - 60
        const y = H / 2 - pos[1] * (SCALE * 0.85) - 20
        return {
          id: obj.id, type: obj.type,
          name: obj.label || obj.id,
          index: i,
          children: this.doc.objects.filter((o) => o.parentId === obj.id).length,
          x: Math.max(8, Math.min(W - 140, x)),
          y: Math.max(40, Math.min(H - 60, y)),
          bw: 120, bh: 38,
          dim: obj.space === 'world3d'
        }
      })
    }
  },
  methods: {
    select (id) { actions.select(id) },
    fillFor (obj) {
      return store.selectedId === obj.id ? 'rgba(99, 102, 241, 0.18)'
        : obj.dim ? 'rgba(168, 85, 247, 0.10)' : 'rgba(148, 163, 184, 0.08)'
    },
    strokeFor (obj) {
      return store.selectedId === obj.id ? '#6366f1'
        : obj.dim ? '#a855f7' : 'var(--studio-border)'
    },
    startDrag (obj, event) {
      this.select(obj.id)
      const startX = event.clientX
      const startY = event.clientY
      const node = this.doc.objects.find((o) => o.id === obj.id)
      const origin = [...(node.transform?.position || [0, 0, 0])]
      const container = this.$refs.container.getBoundingClientRect()
      const pxPerUnitX = container.width / W * SCALE
      const pxPerUnitY = container.height / H * SCALE * 0.85

      const move = (e) => {
        const dx = (e.clientX - startX) / pxPerUnitX
        const dy = -(e.clientY - startY) / pxPerUnitY
        actions.setTransform(obj.id, {
          position: [
            Math.round((origin[0] + dx) * 100) / 100,
            Math.round((origin[1] + dy) * 100) / 100,
            origin[2] || 0],
          rotation: node.transform?.rotation || 0,
          scale: node.transform?.scale ?? 1
        })
      }
      const up = () => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    }
  }
}
</script>

<style scoped>
.obj-block { cursor: grab; }
.obj-block:hover rect { filter: brightness(1.4); }
.obj-block.selected rect { stroke-width: 2; }
.obj-type { font-size: 9px; fill: var(--studio-text-muted); }
.obj-name { font-size: 11px; fill: var(--studio-text); font-weight: 600; }
.obj-children { font-size: 8px; fill: var(--studio-text-muted); }
.scene-label { font-size: 10px; fill: var(--studio-text-muted); opacity: 0.7; }
</style>
