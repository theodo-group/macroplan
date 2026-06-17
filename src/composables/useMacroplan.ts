import { ref, shallowRef, computed, watch } from 'vue'
import { parseMacroplan } from '../model/parse'
import { buildPlan } from '../model/plan'
import type { Plan } from '../model/types'
import { SAMPLE_PLAN } from '../data/sample'

const STORAGE_KEY = 'macroplan:library'
const LEGACY_KEY = 'macroplan:source'

export interface StoredPlan {
  id: string
  name: string
  source: string
}

interface Library {
  version: 1
  activeId: string
  plans: StoredPlan[]
}

/** The source's title if it fully parses, else null (so the cached name only
 *  ever updates on a valid parse). */
function titleOf(source: string): string | null {
  try {
    return parseMacroplan(source).title
  } catch {
    return null
  }
}

function newStoredPlan(source: string): StoredPlan {
  return { id: crypto.randomUUID(), name: titleOf(source) ?? 'Untitled', source }
}

function save(lib: Library): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib))
  } catch {
    /* localStorage may be full or blocked — autosave is best-effort */
  }
}

/** Resolve the initial library: existing store → legacy migration → fresh seed.
 *  Always persisted before returning so a migrated/seeded library survives a
 *  reload even if the user never edits. */
function loadLibrary(): Library {
  let result: Library | null = null

  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const lib = JSON.parse(raw) as Library
      if (lib && Array.isArray(lib.plans) && lib.plans.length > 0) {
        if (!lib.plans.some((p) => p.id === lib.activeId)) lib.activeId = lib.plans[0].id
        result = { version: 1, activeId: lib.activeId, plans: lib.plans }
      }
    } catch {
      /* corrupt JSON → fall through to migration / seed */
    }
  }

  if (!result) {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy != null) {
      const p = newStoredPlan(legacy)
      localStorage.removeItem(LEGACY_KEY)
      result = { version: 1, activeId: p.id, plans: [p] }
    } else {
      const seed = newStoredPlan(SAMPLE_PLAN)
      result = { version: 1, activeId: seed.id, plans: [seed] }
    }
  }

  save(result)
  return result
}

/**
 * Owns the Library — the collection of named Macroplans in localStorage
 * (ADR-0002). Exposes the active plan's authoring state (source / parsed plan /
 * error, with the last good render kept through transient typos, F3) plus the
 * switch / create / delete operations over the library.
 */
export function useMacroplan() {
  const lib = ref<Library>(loadLibrary())
  const lastGood = shallowRef<Plan | null>(null)

  const active = computed<StoredPlan>(
    () => lib.value.plans.find((p) => p.id === lib.value.activeId) ?? lib.value.plans[0],
  )

  const source = computed<string>({
    get: () => active.value.source,
    set: (v) => {
      const p = active.value
      p.source = v
      const t = titleOf(v)
      if (t) p.name = t // refresh the cached label only on a valid parse
    },
  })

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

  // Persist the whole library on any change (best-effort, like the old autosave).
  watch(lib, (l) => save(l), { deep: true })

  // Switching plans drops the prior render so a broken target shows its own
  // error/empty state, not the previous plan's grid.
  function switchTo(id: string): void {
    lib.value.activeId = id
    lastGood.value = parsed.value.plan
  }

  return {
    source,
    plan: computed(() => parsed.value.plan ?? lastGood.value),
    error: computed(() => parsed.value.error),
    plans: computed(() => lib.value.plans.map((p) => ({ id: p.id, name: p.name }))),
    activeId: computed(() => lib.value.activeId),
    selectPlan: (id: string) => {
      if (lib.value.plans.some((p) => p.id === id)) switchTo(id)
    },
    newPlan: () => {
      const p = newStoredPlan(SAMPLE_PLAN)
      lib.value.plans.push(p)
      switchTo(p.id)
    },
    deletePlan: (id: string) => {
      const idx = lib.value.plans.findIndex((p) => p.id === id)
      if (idx === -1) return
      const wasActive = lib.value.activeId === id
      lib.value.plans.splice(idx, 1)
      if (lib.value.plans.length === 0) {
        const seed = newStoredPlan(SAMPLE_PLAN)
        lib.value.plans.push(seed)
        switchTo(seed.id)
      } else if (wasActive) {
        switchTo(lib.value.plans[Math.max(0, idx - 1)].id)
      }
    },
  }
}
