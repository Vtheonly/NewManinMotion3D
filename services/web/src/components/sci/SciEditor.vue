<template>
  <div class="flex-1 flex overflow-hidden min-h-0">
    <!-- Object library (#34) -->
    <LibraryPanel class="w-64" />

    <!-- Schematic canvas + timeline -->
    <div class="flex-1 min-w-0 flex flex-col">
      <SciToolbar />
      <SciCanvas class="flex-1" />
      <SciTimeline style="height: 220px;" />
    </div>

    <!-- Generic inspector (#29 §5) -->
    <InspectorPanel class="w-80" />
  </div>
</template>

<script>
import LibraryPanel from './LibraryPanel.vue'
import SciToolbar from './SciToolbar.vue'
import SciCanvas from './SciCanvas.vue'
import SciTimeline from './SciTimeline.vue'
import InspectorPanel from './InspectorPanel.vue'
import { store as sciStore } from '../../sci/storeActions.js'
import '../../sci/sci.css'

export default {
  name: 'SciEditor',
  components: { LibraryPanel, SciToolbar, SciCanvas, SciTimeline,
                InspectorPanel },
  mounted () {
    // Registry metadata drives library + inspector (#34 §6): custom server
    // registrations appear automatically (offline: local mirror).
    import('../../sci/client.js')
      .then(({ ir }) => ir.schema())
      .then((res) => { sciStore.schemaTypes = res.types || [] })
      .catch(() => { /* offline: the local library mirror is used */ })
  }
}
</script>
