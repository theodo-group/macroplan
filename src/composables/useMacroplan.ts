import { ref, computed, watch } from 'vue'
import { parseMacroplan } from '../model/parse'
import { buildPlan } from '../model/plan'
import type { Plan } from '../model/types'
import { SAMPLE_PLAN } from '../data/sample'

const STORAGE_KEY = 'macroplan:source'

/**
 * Authoring state for a single Macroplan: the TOML source (autosaved to
 * localStorage), the parsed Plan, and the current parse error. The last
 * successfully-parsed Plan keeps rendering through transient typos (F3).
 */
export function useMacroplan() {
  const source = ref(localStorage.getItem(STORAGE_KEY) ?? SAMPLE_PLAN)
  const lastGood = ref<Plan | null>(null)

  const parsed = computed<{ plan: Plan | null; error: string | null }>(() => {
    try {
      return { plan: buildPlan(parseMacroplan(source.value)), error: null }
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : String(e) }
    }
  })

  watch(
    parsed,
    (p) => {
      if (p.plan) lastGood.value = p.plan
    },
    { immediate: true },
  )

  watch(source, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {
      /* localStorage may be full or blocked — autosave is best-effort */
    }
  })

  return {
    source,
    plan: computed(() => parsed.value.plan ?? lastGood.value),
    error: computed(() => parsed.value.error),
    resetToSample: () => {
      source.value = SAMPLE_PLAN
    },
  }
}
