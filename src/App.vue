<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMacroplan } from './composables/useMacroplan'
import { usePngExport, exportFilename } from './composables/usePngExport'
import { sourceFilename, downloadSource } from './composables/useSourceExport'
import PlanEditor from './components/PlanEditor.vue'
import MacroplanGrid from './components/MacroplanGrid.vue'
import PlanSwitcher from './components/PlanSwitcher.vue'

const { source, plan, error, plans, activeId, selectPlan, newPlan, deletePlan } = useMacroplan()
const { busy, toast, copyPng, downloadPng } = usePngExport()

const exportRoot = ref<HTMLElement>()
const confirmingDelete = ref(false)

const activeName = computed(
  () => plans.value.find((p) => p.id === activeId.value)?.name ?? 'Untitled',
)

function downloadToml() {
  downloadSource(source.value, sourceFilename(plan.value?.title ?? activeName.value))
}

function confirmDelete() {
  deletePlan(activeId.value)
  confirmingDelete.value = false
}
</script>

<template>
  <div class="flex h-screen flex-col bg-base-200 font-sans text-base-content">
    <header class="navbar min-h-0 gap-2 border-b border-base-300 bg-base-100 px-4 py-2">
      <img src="/favicon.svg" alt="" class="size-6" />
      <div class="flex-1">
        <PlanSwitcher
          :plans="plans"
          :active-id="activeId"
          @select="selectPlan"
          @new="newPlan"
          @download="downloadToml"
        />
      </div>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="!plan || busy"
        title="Copy the rendered plan to the clipboard as a PNG"
        @click="copyPng(exportRoot)"
      >
        <span v-if="busy" class="loading loading-spinner loading-xs"></span>
        Copy PNG
      </button>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="!plan || busy"
        title="Download the rendered plan as a PNG"
        @click="downloadPng(exportRoot, exportFilename(plan?.title ?? ''))"
      >
        Download
      </button>
      <button class="btn btn-ghost btn-sm" title="Delete this plan" @click="confirmingDelete = true">
        🗑
      </button>
    </header>

    <main class="flex min-h-0 flex-1 flex-col md:flex-row">
      <section
        class="flex min-h-0 flex-col border-base-300 max-md:h-2/5 max-md:border-b md:w-1/3 md:max-w-md md:border-r"
      >
        <div class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
          Source (TOML)
        </div>
        <PlanEditor v-model="source" :error="error" class="min-h-0 flex-1" />
      </section>

      <section class="min-h-0 flex-1 overflow-auto p-4">
        <div v-if="plan" ref="exportRoot" class="export-root">
          <h2 class="mb-3 text-sm font-semibold text-base-content/70">{{ plan.title }}</h2>
          <MacroplanGrid :plan="plan" />
        </div>
        <p v-else class="text-sm text-base-content/60">
          Nothing to render yet — fix the source on the left.
        </p>
      </section>
    </main>

    <dialog class="modal" :class="{ 'modal-open': confirmingDelete }">
      <div class="modal-box">
        <h3 class="text-base font-semibold">Delete "{{ activeName }}"?</h3>
        <p class="py-2 text-sm text-base-content/70">
          This removes the plan from your library. Download its .toml first if you want to keep it.
        </p>
        <div class="modal-action">
          <button class="btn btn-sm" @click="confirmingDelete = false">Cancel</button>
          <button class="btn btn-sm btn-error" @click="confirmDelete">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="confirmingDelete = false">
        <button>close</button>
      </form>
    </dialog>

    <div v-if="toast" class="toast toast-end">
      <div class="alert" :class="toast.kind === 'ok' ? 'alert-success' : 'alert-error'">
        <span>{{ toast.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* While exporting, grow to the timeline's full width and un-clip the grid so the
   captured PNG shows every week column (not just the on-screen scroll window).
   The base-200 frame + padding give the snapshot a little breathing room. */
.export-root.exporting {
  width: max-content;
  padding: 1rem 1.25rem;
  background: var(--color-base-200);
}
.export-root.exporting :deep(.macroplan) {
  overflow: visible;
}
</style>
