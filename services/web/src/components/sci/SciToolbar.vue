<template>
  <div class="h-10 flex items-center gap-2 px-3 border-b border-studio-border bg-studio-surface flex-shrink-0">
    <span class="text-[11px] font-semibold" style="color: var(--studio-accent);">Suprepto</span>
    <span class="text-[10px] text-studio-text-muted truncate max-w-[180px]">{{ doc.title || doc.id }}</span>
    <span class="text-[9px] px-1.5 py-0.5 rounded font-medium bg-studio-accent/10 text-studio-accent">{{ doc.sceneType }}</span>
    <span v-if="store.validation.length" class="text-[9px] px-1.5 py-0.5 rounded font-medium"
      style="background: rgb(var(--c-danger) / 0.15); color: var(--studio-danger);">
      {{ store.validation.length }} issues
    </span>
    <div class="flex-1"></div>
    <button class="tb-btn" @click="validate" title="Validate the document (POST /api/ir/validate)">Validate</button>
    <button class="tb-btn" @click="exportPython" title="Export runnable Python (byte-parity with the runtime)">Export .py</button>
    <button class="tb-btn" @click="render" title="Save + render through the shared job queue">Render</button>
    <button class="tb-btn" @click="undo" :disabled="store.history.past.length < 2" title="Undo (Ctrl+Z)">↶</button>
    <button class="tb-btn" @click="redo" :disabled="!store.history.future.length" title="Redo">↷</button>
  </div>
</template>

<script>
import { store, actions } from '../../sci/storeActions.js'
import { ir } from '../../sci/client.js'
import { syncSciToProject } from '../../sci/bridge.js'
import { store as projectStore, actions as projectActions } from '../../store/project.js'

export default {
  name: 'SciToolbar',
  computed: {
    store () { return store },
    doc () { return store.document }
  },
  mounted () {
    this._keys = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); actions.undo()
      } else if ((e.ctrlKey || e.metaKey) &&
          ((e.key === 'Z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault(); actions.redo()
      }
    }
    window.addEventListener('keydown', this._keys)
  },
  beforeDestroy () { window.removeEventListener('keydown', this._keys) },
  methods: {
    async validate () {
      try {
        const res = await ir.validate(store.document)
        store.validation = res.errors || []
      } catch (err) {
        store.validation = [{ path: '<api>', message: err.message }]
      }
    },
    /** Same export dialog the visual editor uses (shared pipeline). */
    async exportPython () {
      try {
        const document = syncSciToProject()
        const result = await ir.export(document)
        projectStore.exportCode = result.python || result.code || ''
        projectStore.showExportDialog = true
      } catch (err) {
        projectActions.setError(`Scientific export failed: ${err.message}`)
      }
    },
    /** renderOnServer handles: save -> render-sci enqueue -> polling. */
    async render () {
      await projectActions.renderOnServer('low')
    },
    undo () { actions.undo() },
    redo () { actions.redo() }
  }
}
</script>

<style scoped>
.tb-btn { @apply text-[10px] px-2.5 py-1 rounded-lg bg-studio-bg border border-studio-border
  text-studio-text-muted hover:text-studio-text hover:border-studio-accent/40
  transition-all disabled:opacity-40 disabled:cursor-not-allowed; }
</style>
