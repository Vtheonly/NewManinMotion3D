<template>
  <section>
    <h4 class="sci-section-title">Expression (structured)</h4>
    <label class="field"><span>source</span>
      <input class="sci-input" :value="expression.source"
        @input="actions.updateExpression(expression.id, { source: $event.target.value })" /></label>

    <!-- Terms: named subexpressions, individually highlightable (#29 §3) -->
    <div class="mt-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[9px] text-studio-text-muted">terms</span>
        <button class="sci-btn" @click="addTerm">+ term</button>
      </div>
      <div v-for="(value, name) in expression.terms || {}" :key="name"
        class="flex items-center gap-1 mb-1">
        <input class="sci-input w-14" :value="name" disabled />
        <input class="sci-input flex-1" :value="value"
          @input="actions.setExpressionTerm(expression.id, name, $event.target.value)" />
        <button class="sci-btn danger"
          @click="actions.setExpressionTerm(expression.id, name, null)">×</button>
        <button class="sci-btn star" title="Toggle highlight"
          :class="{ active: isHighlighted(value) }"
          @click="toggleHighlight(value)">★</button>
      </div>
      <div v-if="!Object.keys(expression.terms || {}).length"
        class="text-[9px] text-studio-text-muted/60">No terms yet.</div>
    </div>

    <!-- Highlights: term fragments that render colored -->
    <div class="mt-2">
      <span class="text-[9px] text-studio-text-muted">highlights</span>
      <div class="flex flex-wrap gap-1 mt-1">
        <span v-for="(h, i) in expression.highlights || []" :key="i"
          class="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
          style="background: rgb(var(--c-warning) / 0.15); color: var(--studio-warning);">
          {{ h }}
          <button @click="removeHighlight(i)">×</button>
        </span>
        <span v-if="!(expression.highlights || []).length"
          class="text-[9px] text-studio-text-muted/60">none</span>
      </div>
    </div>
  </section>
</template>

<script>
import { actions } from '../../sci/storeActions.js'

export default {
  name: 'FormulaEditor',
  props: { expression: { type: Object, required: true } },
  methods: {
    actions,
    addTerm () {
      const index = Object.keys(this.expression.terms || {}).length + 1
      actions.setExpressionTerm(this.expression.id, `term_${index}`, 'x')
    },
    isHighlighted (fragment) {
      return (this.expression.highlights || []).includes(fragment)
    },
    toggleHighlight (fragment) {
      const current = [...(this.expression.highlights || [])]
      const index = current.indexOf(fragment)
      if (index >= 0) current.splice(index, 1)
      else current.push(fragment)
      actions.updateExpression(this.expression.id, { highlights: current })
    },
    removeHighlight (index) {
      const current = [...(this.expression.highlights || [])]
      current.splice(index, 1)
      actions.updateExpression(this.expression.id, { highlights: current })
    }
  }
}
</script>

<style scoped>
.field { @apply flex items-center justify-between gap-2 mb-1.5 text-[10px]
  text-studio-text-muted; }
.field span { @apply truncate max-w-[30%]; }
.mini-btn.star.active { @apply text-yellow-400 border-yellow-400/40; }
</style>
