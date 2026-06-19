<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { useMacroplan } from "./composables/useMacroplan"
import { usePngExport, exportFilename } from "./composables/usePngExport"
import { sourceFilename, downloadSource } from "./composables/useSourceExport"
import PlanEditor from "./components/PlanEditor.vue"
import MacroplanGrid from "./components/MacroplanGrid.vue"
import PlanSwitcher from "./components/PlanSwitcher.vue"

const { source, plan, error, plans, activeId, selectPlan, newPlan, deletePlan } = useMacroplan()
const { busy, toast, copyPng, downloadPng } = usePngExport()

const exportRoot = ref<HTMLElement>()
const confirmingDelete = ref(false)

// Which panes are visible: the Source editor, the rendered Macroplan, or both.
// Kept in the URL (?view=…) so a layout is shareable/bookmarkable, not persisted.
type ViewMode = "source" | "split" | "view"

function readViewMode(): ViewMode {
  const v = new URLSearchParams(location.search).get("view")
  return v === "source" || v === "view" ? v : "split"
}

const mode = ref<ViewMode>(readViewMode())
const showSource = computed(() => mode.value !== "view")
const showView = computed(() => mode.value !== "source")

// Reflect the choice in the URL without stacking a history entry per toggle.
// "split" is the default, so drop the param to keep the URL clean.
watch(mode, (m) => {
  const url = new URL(location.href)
  if (m === "split") url.searchParams.delete("view")
  else url.searchParams.set("view", m)
  history.replaceState(history.state, "", url)
})

const activeName = computed(
  () => plans.value.find((p) => p.id === activeId.value)?.name ?? "Untitled",
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
      <div class="join" role="group" aria-label="Choose which panes to show">
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'source' }"
          :aria-pressed="mode === 'source'"
          title="Show only the TOML source"
          @click="mode = 'source'"
        >
          Source
        </button>
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'split' }"
          :aria-pressed="mode === 'split'"
          title="Show the source and the Macroplan side by side"
          @click="mode = 'split'"
        >
          Split
        </button>
        <button
          class="btn btn-sm join-item"
          :class="{ 'btn-active': mode === 'view' }"
          :aria-pressed="mode === 'view'"
          title="Show only the rendered Macroplan"
          @click="mode = 'view'"
        >
          Macroplan
        </button>
      </div>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="!plan || busy || !showView"
        title="Copy the rendered plan to the clipboard as a PNG"
        @click="copyPng(exportRoot)"
      >
        <span v-if="busy" class="loading loading-spinner loading-xs"></span>
        Copy PNG
      </button>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="!plan || busy || !showView"
        title="Download the rendered plan as a PNG"
        @click="downloadPng(exportRoot, exportFilename(plan?.title ?? ''))"
      >
        Download
      </button>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="busy"
        title="Delete this plan"
        @click="confirmingDelete = true"
      >
        🗑
      </button>
    </header>

    <main class="flex min-h-0 flex-1 flex-col md:flex-row">
      <section
        v-if="showSource"
        class="flex min-h-0 flex-col border-base-300"
        :class="
          showView ? 'max-md:h-2/5 max-md:border-b md:w-1/3 md:max-w-md md:border-r' : 'flex-1'
        "
      >
        <div class="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
          Source (TOML)
        </div>
        <PlanEditor v-model="source" :error="error" class="min-h-0 flex-1" />
      </section>

      <section v-if="showView" class="min-h-0 flex-1 overflow-auto p-4">
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
