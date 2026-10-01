<template>
  <section>
    <h4 class="sci-section-title">Properties ({{ object.type }})</h4>
    <p v-if="!fields.length" class="text-[9px] text-studio-text-muted/60">
      No registered properties.
    </p>
    <label v-for="spec in fields" :key="spec.name" class="field">
      <span>{{ spec.name }}<em v-if="spec.required">*</em></span>
      <input v-if="spec.type === 'float' || spec.type === 'int'" class="sci-input"
        type="number" :step="spec.type === 'int' ? 1 : 'any'"
        :value="object.properties[spec.name] ?? spec.default"
        @input="set(spec, coerce(spec, $event.target.value))" />
      <select v-else-if="spec.enum" class="sci-input"
        :value="object.properties[spec.name] ?? spec.default"
        @change="set(spec, $event.target.value)">
        <option v-for="opt in spec.enum" :key="opt" :value="opt">{{ opt }}</option>
      </select>
      <input v-else-if="spec.type === 'bool'" class="sci-input" type="checkbox"
        style="width: auto"
        :checked="boolValue(object.properties[spec.name], spec.default)"
        @change="set(spec, $event.target.checked)" />
      <textarea v-else-if="spec.type === 'list'" rows="3"
        class="sci-input font-mono text-[10px]"
        :value="jsonValue(object.properties[spec.name])"
        @change="set(spec, parseList($event.target.value))"></textarea>
      <input v-else class="sci-input"
        :value="object.properties[spec.name] ?? spec.default"
        @input="set(spec, $event.target.value)" />
    </label>
  </section>
</template>

<script>
export default {
  name: 'PropertyFields',
  props: {
    object: { type: Object, required: true },
    fields: { type: Array, default: () => [] }
  },
  methods: {
    coerce (spec, raw) {
      if (spec.type === 'float') return parseFloat(raw) || 0
      if (spec.type === 'int') return parseInt(raw, 10) || 0
      return raw
    },
    boolValue (value, fallback) {
      return value !== undefined ? Boolean(value) : Boolean(fallback)
    },
    jsonValue (value) { return JSON.stringify(value ?? [], null, 0) },
    parseList (text) {
      try { return JSON.parse(text) } catch (e) { return null }
    },
    set (spec, value) { this.$emit('set', spec.name, value) }
  }
}
</script>

<style scoped>
.field { @apply flex items-center justify-between gap-2 mb-1.5 text-[10px]
  text-studio-text-muted; }
.field span { @apply truncate max-w-[38%]; }
.field em { @apply text-red-400 not-italic ml-0.5; }
</style>
