# Plans Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app hold several named Macroplans in localStorage — switch between them, create and delete them, and download any plan as a portable `.toml` file.

**Architecture:** `useMacroplan` becomes the owner of a `Library` (a `{version, activeId, plans[]}` object in localStorage), exposing the active plan's authoring state plus switch/create/delete operations. A new presentational `PlanSwitcher.vue` renders the header dropdown. A small `useSourceExport` util downloads the active plan's TOML, reusing a `slugify` helper extracted from the existing PNG exporter.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), TypeScript, DaisyUI 5, `smol-toml` (already wired via `parseMacroplan`), Vitest + `@vue/test-utils` + happy-dom.

**Spec:** `docs/superpowers/specs/2026-06-17-plans-library-design.md`

## Global Constraints

- Vue 3 `<script setup lang="ts">` for all components; match the existing component style.
- DaisyUI 5 classes for UI (the app pins a light theme); no new dependencies.
- No backend — everything client-side (ADR-0002). localStorage keys: **`macroplan:library`** (new store) and **`macroplan:source`** (legacy, single-source — migrate away from it).
- Vitest defaults to the `node` environment; any test that touches the DOM or `localStorage` MUST start with the line `// @vitest-environment happy-dom` (see `src/components/MacroplanGrid.test.ts`).
- Plan ids come from `crypto.randomUUID()`. Target is modern browsers; no fallback.
- A plan's display **name** is its parsed TOML `title` (cached as last-good); it is **not** a separately edited field.
- **Invariant:** the library always holds ≥ 1 plan.
- Conventional-commit messages, lowercase, imperative. **Do NOT add `Co-authored-by` lines** (user's standing rule).
- Run a single test file with `pnpm exec vitest run <path>`; full suite with `pnpm test`; typecheck + build with `pnpm build`.

---

### Task 1: TOML filename helpers + `downloadSource`

Extract a reusable `slugify` from the PNG exporter and add a `.toml` filename + download utility. Foundational and dependency-free.

**Files:**

- Modify: `src/composables/usePngExport.ts` (extract `slugify`, keep `exportFilename` output identical)
- Create: `src/composables/useSourceExport.ts`
- Test: `src/composables/useSourceExport.test.ts`
- (Unchanged, must still pass: `src/composables/usePngExport.test.ts`)

**Interfaces:**

- Produces: `slugify(title: string): string` (exported from `usePngExport.ts`) — lowercased, non-alphanumerics collapsed to dashes, edge dashes trimmed, **no** extension and **no** `plan` fallback.
- Produces: `sourceFilename(title: string): string` → `macroplan-<slug-or-plan>.toml`
- Produces: `downloadSource(source: string, filename: string): void`

- [ ] **Step 1: Write the failing test**

Create `src/composables/useSourceExport.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { sourceFilename } from "./useSourceExport"

describe("sourceFilename", () => {
  it("slugifies the plan title into a .toml name", () => {
    expect(sourceFilename("Q3 — Checkout revamp")).toBe("macroplan-q3-checkout-revamp.toml")
  })

  it("falls back to a generic name when the title has no usable characters", () => {
    expect(sourceFilename("")).toBe("macroplan-plan.toml")
    expect(sourceFilename("—— ··")).toBe("macroplan-plan.toml")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/composables/useSourceExport.test.ts`
Expected: FAIL — cannot resolve `./useSourceExport`.

- [ ] **Step 3: Extract `slugify` in `usePngExport.ts`**

Replace the existing `exportFilename` function (lines 5–13) with:

```ts
/** Lowercase, dash-collapsed slug of a plan title — no extension, no fallback. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Slugified, stable download name derived from the plan title. */
export function exportFilename(title: string): string {
  return `macroplan-${slugify(title) || "plan"}.png`
}
```

- [ ] **Step 4: Create `useSourceExport.ts`**

```ts
import { slugify } from "./usePngExport"

/** Slugified, stable download name for a plan's TOML source. */
export function sourceFilename(title: string): string {
  return `macroplan-${slugify(title) || "plan"}.toml`
}

/** Download a plan's TOML source as a .toml file (client-side, no backend). */
export function downloadSource(source: string, filename: string): void {
  const blob = new Blob([source], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 5: Run both filename test files to verify they pass**

Run: `pnpm exec vitest run src/composables/useSourceExport.test.ts src/composables/usePngExport.test.ts`
Expected: PASS (both files; the existing `exportFilename` tests still pass because output is unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/composables/usePngExport.ts src/composables/useSourceExport.ts src/composables/useSourceExport.test.ts
git commit -m "feat(export): add .toml source download and shared slugify helper"
```

---

### Task 2: `PlanSwitcher.vue` (presentational dropdown)

A header dropdown that lists plans, marks the active one, and emits switch / new / download intents. No storage or parsing logic — props in, events out.

**Files:**

- Create: `src/components/PlanSwitcher.vue`
- Test: `src/components/PlanSwitcher.test.ts`

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: component `PlanSwitcher` with
  - Props: `plans: { id: string; name: string }[]`, `activeId: string`
  - Emits: `select: [id: string]`, `new: []`, `download: [id: string]`
  - DOM contract relied on by the test: each plan is an `<a>` inside a `<li>`; the active plan's `<a>` has class `active`; the last two `<a>` items are **New plan** then **Download .toml**.

- [ ] **Step 1: Write the failing test**

Create `src/components/PlanSwitcher.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { mount } from "@vue/test-utils"
import PlanSwitcher from "./PlanSwitcher.vue"

const plans = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Bravo" },
]

describe("PlanSwitcher", () => {
  it("lists plan names and marks the active one", () => {
    const w = mount(PlanSwitcher, { props: { plans, activeId: "b" } })
    expect(w.text()).toContain("Alpha")
    expect(w.text()).toContain("Bravo")
    expect(w.find("a.active").text()).toContain("Bravo")
  })

  it("emits select with the clicked plan id", async () => {
    const w = mount(PlanSwitcher, { props: { plans, activeId: "a" } })
    await w.findAll("li a")[1].trigger("click") // Bravo
    expect(w.emitted("select")?.[0]).toEqual(["b"])
  })

  it("emits new and download (with the active id) from the trailing actions", async () => {
    const w = mount(PlanSwitcher, { props: { plans, activeId: "a" } })
    const actions = w.findAll("li a")
    await actions[actions.length - 2].trigger("click") // New plan
    await actions[actions.length - 1].trigger("click") // Download .toml
    expect(w.emitted("new")).toBeTruthy()
    expect(w.emitted("download")?.[0]).toEqual(["a"])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/PlanSwitcher.test.ts`
Expected: FAIL — cannot resolve `./PlanSwitcher.vue`.

- [ ] **Step 3: Create `PlanSwitcher.vue`**

```vue
<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  plans: { id: string; name: string }[]
  activeId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  new: []
  download: [id: string]
}>()

const activeName = computed(
  () => props.plans.find((p) => p.id === props.activeId)?.name ?? "Untitled",
)
</script>

<template>
  <div class="dropdown">
    <div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-1 normal-case">
      <span class="max-w-[14rem] truncate font-semibold">{{ activeName }}</span>
      <span aria-hidden="true">▾</span>
    </div>
    <ul
      tabindex="0"
      class="menu dropdown-content z-50 mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
    >
      <li v-for="p in plans" :key="p.id">
        <a :class="{ active: p.id === activeId }" @click="emit('select', p.id)">
          <span class="truncate">{{ p.name }}</span>
          <span v-if="p.id === activeId" aria-hidden="true">✓</span>
        </a>
      </li>
      <div class="my-1 border-t border-base-200"></div>
      <li><a @click="emit('new')">＋ New plan</a></li>
      <li><a @click="emit('download', activeId)">⤓ Download .toml</a></li>
    </ul>
  </div>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/PlanSwitcher.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PlanSwitcher.vue src/components/PlanSwitcher.test.ts
git commit -m "feat(ui): add the plan switcher dropdown"
```

---

### Task 3: `useMacroplan` library refactor

Turn the single-source composable into the Library owner: storage + migration + active-plan binding + autosave, plus the switch/create/delete operations. Keep `resetToSample` exported for now so `App.vue` still compiles — Task 4 removes it.

**Files:**

- Modify (rewrite): `src/composables/useMacroplan.ts`
- Test: `src/composables/useMacroplan.test.ts`

**Interfaces:**

- Consumes: `parseMacroplan` (throws `PlanParseError`; defaults `title` to `'Untitled Macroplan'`), `buildPlan`, `SAMPLE_PLAN` (its title is `"Q3 — Checkout revamp"`).
- Produces (the composable's return shape, relied on by Task 4):
  - `source: WritableComputedRef<string>` — reads/writes the active plan's source
  - `plan: ComputedRef<Plan | null>`
  - `error: ComputedRef<string | null>`
  - `plans: ComputedRef<{ id: string; name: string }[]>`
  - `activeId: ComputedRef<string>`
  - `selectPlan(id: string): void`
  - `newPlan(): void`
  - `deletePlan(id: string): void`
  - `resetToSample(): void` _(temporary — removed in Task 4)_

- [ ] **Step 1: Write the failing tests (storage, binding, CRUD)**

Create `src/composables/useMacroplan.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { nextTick } from "vue"
import { useMacroplan } from "./useMacroplan"
import { SAMPLE_PLAN } from "../data/sample"

const LIB_KEY = "macroplan:library"
const LEGACY_KEY = "macroplan:source"

beforeEach(() => localStorage.clear())

describe("useMacroplan — load & migration", () => {
  it("seeds one sample plan when storage is empty, and persists it immediately", () => {
    const m = useMacroplan()
    expect(m.plans.value).toHaveLength(1)
    expect(m.activeId.value).toBe(m.plans.value[0].id)
    expect(m.source.value).toBe(SAMPLE_PLAN)
    expect(localStorage.getItem(LIB_KEY)).toBeTruthy() // survives a reload
  })

  it("migrates a legacy single-source store into a one-plan library and drops the legacy key", () => {
    localStorage.setItem(LEGACY_KEY, SAMPLE_PLAN)
    const m = useMacroplan()
    expect(m.plans.value).toHaveLength(1)
    expect(m.source.value).toBe(SAMPLE_PLAN)
    expect(m.plans.value[0].name).toBe("Q3 — Checkout revamp")
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it("falls back to a fresh sample when the library JSON is corrupt", () => {
    localStorage.setItem(LIB_KEY, "{ not valid json")
    const m = useMacroplan()
    expect(m.plans.value).toHaveLength(1)
    expect(m.source.value).toBe(SAMPLE_PLAN)
  })

  it("repairs a stale activeId instead of discarding the stored plans", () => {
    localStorage.setItem(
      LIB_KEY,
      JSON.stringify({
        version: 1,
        activeId: "gone",
        plans: [{ id: "x", name: "Kept", source: SAMPLE_PLAN }],
      }),
    )
    const m = useMacroplan()
    expect(m.activeId.value).toBe("x")
    expect(m.plans.value[0].name).toBe("Kept")
  })
})

describe("useMacroplan — active plan binding", () => {
  it("refreshes the cached name when the active source parses to a title, and autosaves", async () => {
    const m = useMacroplan()
    m.source.value = 'title = "Renamed"\n'
    await nextTick()
    expect(m.plans.value[0].name).toBe("Renamed")
    expect(localStorage.getItem(LIB_KEY)).toContain("Renamed")
  })

  it("keeps the last-good name and render when the source is mid-edit/broken", async () => {
    const m = useMacroplan()
    const goodPlan = m.plan.value
    m.source.value = 'title = "Renamed"\n[[feature]]\n' // feature missing name → parse error
    await nextTick()
    expect(m.error.value).toBeTruthy()
    expect(m.plan.value).toBe(goodPlan) // last-good render retained
    expect(m.plans.value[0].name).toBe("Q3 — Checkout revamp") // name unchanged
  })
})

describe("useMacroplan — CRUD", () => {
  it("newPlan appends a sample plan and activates it", () => {
    const m = useMacroplan()
    const firstId = m.activeId.value
    m.newPlan()
    expect(m.plans.value).toHaveLength(2)
    expect(m.activeId.value).not.toBe(firstId)
    expect(m.source.value).toBe(SAMPLE_PLAN)
  })

  it("deletePlan removes the active plan and re-points to the preceding one", () => {
    const m = useMacroplan()
    m.newPlan() // 2 plans; second is active
    const [first, second] = m.plans.value
    m.deletePlan(second.id)
    expect(m.plans.value).toHaveLength(1)
    expect(m.activeId.value).toBe(first.id)
  })

  it("deleting the last plan re-seeds a fresh sample (never empty)", () => {
    const m = useMacroplan()
    m.deletePlan(m.activeId.value)
    expect(m.plans.value).toHaveLength(1)
    expect(m.source.value).toBe(SAMPLE_PLAN)
  })

  it("switching to a broken plan shows its own empty state, not the previous render", async () => {
    const m = useMacroplan()
    const aId = m.activeId.value
    m.newPlan()
    const bId = m.activeId.value
    m.source.value = 'title = "B"\n[[feature]]\n' // B broken
    await nextTick()
    m.selectPlan(aId)
    await nextTick()
    expect(m.plan.value).toBeTruthy() // A renders
    m.selectPlan(bId)
    await nextTick()
    expect(m.error.value).toBeTruthy() // B's parse error surfaces
    expect(m.plan.value).toBeNull() // no stale A render leaks through
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/composables/useMacroplan.test.ts`
Expected: FAIL — the new API (`plans`, `activeId`, `newPlan`, etc.) does not exist yet.

- [ ] **Step 3: Rewrite `useMacroplan.ts`**

Replace the entire file with:

```ts
import { ref, computed, watch } from "vue"
import { parseMacroplan } from "../model/parse"
import { buildPlan } from "../model/plan"
import type { Plan } from "../model/types"
import { SAMPLE_PLAN } from "../data/sample"

const STORAGE_KEY = "macroplan:library"
const LEGACY_KEY = "macroplan:source"

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
  return { id: crypto.randomUUID(), name: titleOf(source) ?? "Untitled", source }
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
  const lastGood = ref<Plan | null>(null)

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
    // TODO(task 4): remove once App.vue drops the "Reset to sample" button.
    resetToSample: () => {
      source.value = SAMPLE_PLAN
    },
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/composables/useMacroplan.test.ts`
Expected: PASS (all groups).

- [ ] **Step 5: Confirm the app still typechecks (App.vue unchanged, `resetToSample` retained)**

Run: `pnpm build`
Expected: build succeeds (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/composables/useMacroplan.ts src/composables/useMacroplan.test.ts
git commit -m "feat(model): make useMacroplan own a library of named plans"
```

---

### Task 4: Wire `App.vue` (switcher, delete confirm, .toml download)

Replace the static title block with the switcher, add a trash button + confirm modal that deletes the active plan, wire the `.toml` download, and remove the now-retired `resetToSample`.

**Files:**

- Modify (rewrite): `src/App.vue`
- Modify: `src/composables/useMacroplan.ts` (delete the temporary `resetToSample`)

**Interfaces:**

- Consumes: `useMacroplan` (`source`, `plan`, `error`, `plans`, `activeId`, `selectPlan`, `newPlan`, `deletePlan`), `PlanSwitcher`, `sourceFilename` + `downloadSource`, `exportFilename` + `usePngExport`.

- [ ] **Step 1: Remove the temporary `resetToSample` from `useMacroplan.ts`**

Delete these lines from the returned object:

```ts
    // TODO(task 4): remove once App.vue drops the "Reset to sample" button.
    resetToSample: () => {
      source.value = SAMPLE_PLAN
    },
```

- [ ] **Step 2: Rewrite `App.vue`**

Replace the entire file with:

```vue
<script setup lang="ts">
import { ref, computed } from "vue"
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
      <button
        class="btn btn-ghost btn-sm"
        title="Delete this plan"
        @click="confirmingDelete = true"
      >
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
        <h3 class="text-base font-semibold">Delete “{{ activeName }}”?</h3>
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
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm build`
Expected: build succeeds — no reference to `resetToSample` remains, all props/events typecheck.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all suites (existing + the new filename, switcher, and library suites).

- [ ] **Step 5: Manual smoke check in the dev server**

Run: `pnpm dev` and open the app, then verify each:

1. The header shows the current plan name in a dropdown (no more static title).
2. Open the dropdown → **＋ New plan** adds a plan and switches to it (editor shows the sample again).
3. Edit the `title` in the source → the dropdown label updates to the new title.
4. Switch back to the first plan via the dropdown → its source returns.
5. **⤓ Download .toml** downloads a `macroplan-<slug>.toml` file containing the current source.
6. The 🗑 button opens a confirm modal naming the active plan; **Cancel** dismisses, **Delete** removes it and switches to the preceding plan.
7. Delete every plan in turn → the last delete leaves a fresh sample plan (never an empty app).
8. Reload the page → the library and active plan persist.

Expected: all eight behave as described.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue src/composables/useMacroplan.ts
git commit -m "feat(ui): wire the plan switcher, delete confirm and .toml download into the app"
```

---

### Task 5: Documentation

Record the new `Library` term in the ubiquitous language and flip the README now that the library exists.

**Files:**

- Modify: `CONTEXT.md`
- Modify: `README.md`

- [ ] **Step 1: Add the `Library` term to `CONTEXT.md`**

In the `## Language` section, immediately after the **Now line** entry (the block ending `_Avoid_: today marker, cursor`) and before `## Symbols`, insert:

```markdown
**Library**:
The collection of saved **Macroplans** held in the browser's localStorage — the live store. Always holds at least one Macroplan; durability rests on exporting a Macroplan's `.toml` (per ADR-0002), not on the Library itself. Carries no status of its own.
_Avoid_: workspace, project, file list
```

- [ ] **Step 2: Add a Library relationship line to `CONTEXT.md`**

In `## Relationships`, after the first bullet (the one starting `A **Macroplan** contains a flat, author-ordered list...`), add:

```markdown
- The **Library** holds many **Macroplans**, exactly one of which is active (shown in the editor and grid). Each is identified internally by a stable id and labelled by its **title**.
```

- [ ] **Step 3: Update the README Status paragraph**

Replace:

```markdown
**Feature-complete** against the [design](DESIGN.md) and covered by tests — TOML authoring with live reload, the full week × feature grid render, derived on-time/late classification, milestones, and PNG export all work client-side.

Not yet built: a **library** of multiple named plans. Today a single source autosaves to localStorage.
```

with:

```markdown
**Feature-complete** against the [design](DESIGN.md) and covered by tests — TOML authoring with live reload, a **library** of named plans, the full week × feature grid render, derived on-time/late classification, milestones, and PNG + `.toml` export all work client-side.
```

- [ ] **Step 4: Update the README "How it works" persistence bullet**

Replace:

```markdown
- Your source **autosaves to localStorage**; **export a PNG** to share into Slack or a deck.
```

with:

```markdown
- Keep a **library** of named plans in localStorage and switch between them; **export** any plan as a `.toml` file, or the rendered view as a **PNG** to share into Slack or a deck.
```

- [ ] **Step 5: Verify the docs build is unaffected and commit**

Run: `pnpm test`
Expected: PASS (docs-only change; suites still green).

```bash
git add CONTEXT.md README.md
git commit -m "docs: record the Library term and mark the plans library as built"
```

---

## Self-Review

**1. Spec coverage**

- Multiple named plans in localStorage → Task 3 (`Library` model).
- Header dropdown switcher → Task 2 (`PlanSwitcher`) + Task 4 (wiring).
- New plan from sample → Task 3 (`newPlan`) + Task 4.
- Delete active plan with confirm → Task 3 (`deletePlan`) + Task 4 (modal).
- `.toml` download → Task 1 (`sourceFilename`/`downloadSource`) + Task 4.
- Migration from legacy key + always-≥1 invariant + corrupt fallback + stale-activeId repair → Task 3 (tested).
- Name = cached last-good title → Task 3 (`titleOf` in the `source` setter, tested).
- `slugify` extracted, `exportFilename` output unchanged → Task 1 (existing test still passes).
- Switch resets last-good render → Task 3 (`switchTo`, tested).
- `Library` glossary term + README flip → Task 5.
- All spec requirements map to a task. No gaps.

**2. Placeholder scan:** No TBD/TODO-as-deliverable, no "add error handling" hand-waves; every code step shows complete code. The one `TODO(task 4)` comment is a deliberate, scheduled removal (Task 4, Step 1), not an unfinished placeholder.

**3. Type consistency:** `slugify` (Task 1) is consumed by `sourceFilename` (Task 1) and unchanged `exportFilename`. `useMacroplan`'s return shape (Task 3) — `source`, `plan`, `error`, `plans`, `activeId`, `selectPlan`, `newPlan`, `deletePlan` — matches exactly what `App.vue` destructures (Task 4). `PlanSwitcher` props (`plans: {id,name}[]`, `activeId: string`) and emits (`select`, `new`, `download`) match the App template bindings. `StoredPlan`/`Library` are internal to `useMacroplan`. Consistent throughout.
