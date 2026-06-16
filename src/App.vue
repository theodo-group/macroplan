<script setup lang="ts">
import { useMacroplan } from './composables/useMacroplan'
import PlanEditor from './components/PlanEditor.vue'
import MacroplanGrid from './components/MacroplanGrid.vue'

const { source, plan, error, resetToSample } = useMacroplan()
</script>

<template>
  <div class="flex h-screen flex-col bg-base-200 font-sans text-base-content">
    <header class="navbar min-h-0 gap-2 border-b border-base-300 bg-base-100 px-4 py-2">
      <img src="/favicon.svg" alt="" class="size-6" />
      <div class="flex-1">
        <h1 class="text-lg font-semibold leading-tight">Macroplan</h1>
        <p class="text-xs text-base-content/60 leading-tight">
          A week-granular, learning-oriented record of what we committed to deliver.
        </p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="resetToSample">Reset to sample</button>
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
        <h2 v-if="plan" class="mb-3 text-sm font-semibold text-base-content/70">{{ plan.title }}</h2>
        <MacroplanGrid v-if="plan" :plan="plan" />
        <p v-else class="text-sm text-base-content/60">Nothing to render yet — fix the source on the left.</p>
      </section>
    </main>
  </div>
</template>
