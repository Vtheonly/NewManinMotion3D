<template>
  <aside class="bg-studio-surface border-r border-studio-border flex flex-col overflow-hidden">
    <!-- Search (#34 §7) -->
    <div class="p-2.5 border-b border-studio-border flex-shrink-0">
      <input
        v-model="query"
        type="text"
        placeholder="Search objects… (attention, graph, protein)"
        class="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-studio-bg border border-studio-border text-studio-text placeholder-studio-text-muted/50 focus:outline-none focus:border-studio-accent/50"
      />
      <div class="flex items-center gap-1 mt-2">
        <button v-for="cat in allCategories" :key="cat.key"
          class="cat-chip" :class="{ active: category === cat.key }"
          :title="cat.label"
          @click="category = category === cat.key ? '' : cat.key">
          <span class="text-[10px]">{{ cat.icon }}</span>
          <span class="text-[9px]">{{ cat.label }}</span>
        </button>
      </div>
    </div>

    <!-- Results by category -->
    <div class="flex-1 overflow-y-auto p-2 space-y-3">
      <div v-for="cat in visibleCategories" :key="cat.key">
        <h4 class="sci-section-title">{{ cat.label }}</h4>
        <button v-for="t in typesIn(cat.key)" :key="t.key"
          class="lib-item group" :title="t.description"
          @click="insert(t)">
          <span class="lib-icon">{{ iconFor(t) }}</span>
          <span class="flex-1 text-left">
            <span class="block text-[11px] font-medium text-studio-text">{{ t.label }}</span>
            <span class="block text-[9px] text-studio-text-muted truncate">{{ t.key }}</span>
          </span>
          <span v-if="t.dimensionality === '3d'"
            class="text-[8px] font-bold px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">3D</span>
        </button>
      </div>
      <p v-if="!filtered.length" class="text-[10px] text-studio-text-muted/60 text-center py-4">
        No objects match “{{ query }}”
      </p>
    </div>

    <!-- Context-aware suggestions (#34 §8) -->
    <div v-if="suggestions.length" class="p-2 border-t border-studio-border flex-shrink-0">
      <h4 class="sci-section-title">Suggested for {{ selectedType }}</h4>
      <button v-for="t in suggestions" :key="'s-' + t.key" class="lib-item"
        @click="insert(t)">
        <span class="lib-icon">{{ iconFor(t) }}</span>
        <span class="text-[10px] text-studio-text">{{ t.label }}</span>
      </button>
    </div>
  </aside>
</template>

<script>
import { libraryTypes, categories, searchTypes, suggestedTypes,
  makeObject } from '../../sci/library.js'
import { store, actions } from '../../sci/storeActions.js'

export default {
  name: 'LibraryPanel',
  data () { return { query: '', category: '' } },
  computed: {
    allTypes () { return libraryTypes(store.schemaTypes) },
    allCategories () { return categories(this.allTypes) },
    selectedType () {
      const obj = store.document.objects.find((o) => o.id === store.selectedId)
      return obj ? obj.type : ''
    },
    filtered () {
      let types = searchTypes(this.allTypes, this.query)
      if (this.category) {
        types = types.filter((t) => t.category === this.category)
      }
      return types
    },
    visibleCategories () {
      return this.allCategories.filter(
        (c) => this.typesIn(c.key).length > 0)
    },
    suggestions () {
      return suggestedTypes(this.allTypes, this.selectedType).slice(0, 4)
    }
  },
  methods: {
    typesIn (categoryKey) {
      return this.filtered.filter((t) => t.category === categoryKey)
    },
    iconFor (t) {
      const map = categories(this.allTypes).find((c) => c.key === t.category)
      return map ? map.icon : '·'
    },
    insert (typeEntry) {
      actions.addObject(typeEntry, makeObject(typeEntry))
    }
  }
}
</script>

<style scoped>
.cat-chip { @apply flex items-center gap-1 px-1.5 py-0.5 rounded-md text-studio-text-muted
  hover:text-studio-text hover:bg-studio-bg border border-transparent transition-all; }
.cat-chip.active { @apply bg-studio-accent/15 text-studio-accent border-studio-accent/30; }
.lib-item { @apply w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1
  hover:bg-studio-bg border border-transparent hover:border-studio-accent/20
  transition-all cursor-pointer; }
.lib-icon { @apply w-6 h-6 flex items-center justify-center rounded bg-studio-bg
  text-[12px] text-studio-accent flex-shrink-0; }
</style>
