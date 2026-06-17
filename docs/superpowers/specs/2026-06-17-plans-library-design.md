# Plans Library — Design

**Date:** 2026-06-17
**Status:** Approved (brainstorming) → ready for implementation plan
**Realizes:** [ADR-0002](../../adr/0002-local-first-no-backend.md) — *"The live store is localStorage (an in-app library of named Macroplans); the `.toml` file is the portable source of truth, moved in and out via Import/Export."*

## Problem

The app stores exactly one Macroplan, autosaved to a single localStorage key (`macroplan:source`). ADR-0002 always described localStorage as **a library of named Macroplans**, but only the single-plan slice was built. The README advertised a "library of plans" the app never had.

This adds the library: keep several named Macroplans, switch between them, create and delete them, and download any plan as a portable `.toml` file. The `.toml` download is in scope because ADR-0002 makes export the durability mechanism ("durability rests on Export"); a library of N plans in localStorage with no file export would multiply un-backupable state.

## Scope

**In:**
- Multiple named Macroplans persisted in localStorage.
- A header dropdown to switch the active plan.
- Create a new plan (a blank page; the bundled sample only seeds a genuinely empty library).
- Delete the active plan (with a confirm).
- Download the active plan's source as `<title-slug>.toml`.
- Migration from the legacy single-key store.

**Out (YAGNI for v1):**
- Duplicate / clone a plan (fork via *New* + paste).
- File-open `.toml` *import* — pasting a `.toml` file's contents into a new plan's editor already covers loading. Re-evaluate if it proves clumsy.
- Reordering, folders, search, tags.
- Any backend or multi-device sync (explicitly rejected by ADR-0002).

## Vocabulary

A new term enters the [ubiquitous language](../../../CONTEXT.md):

> **Library** — the collection of saved **Macroplans** held in the browser's localStorage. The live store; durability rests on exporting a plan's `.toml` (per ADR-0002). Not a Macroplan itself, and carries no status of its own.

A plan's **display name** is its TOML `title` (the existing concept), not a separate field — see Data Model.

## Data Model

One new localStorage key **replaces** `macroplan:source`:

```
macroplan:library  →  {
  version: 1,
  activeId: string,
  plans: [ { id: string, name: string, source: string } ]
}
```

| Field | Meaning |
|-------|---------|
| `id` | Stable identity from `crypto.randomUUID()`. The switcher and `activeId` key off this, **never** the name — so a plan survives title edits and broken TOML. |
| `name` | The **cached last-good title** for that plan. Lets the switcher label every plan without parsing all of their sources on every render — only the active plan is parsed live. |
| `source` | The TOML string the editor binds to. |

**Why a cached name and not a live-derived one:** only the active plan's source is parsed continuously (for the live render). Inactive plans show their last-good title from `name`. The active plan's `name` is refreshed whenever its source parses to a title; a transient parse error leaves the last-good `name` (and the last-good render) in place — same forgiving behavior as today's F3.

### Invariant

**The library always holds ≥ 1 plan.** Deleting the last plan creates a fresh sample plan rather than leaving an empty store. This keeps `activeId` always valid and the editor always bound to something.

### Migration

On load, `useMacroplan` resolves the initial library:

1. If `macroplan:library` exists and parses → use it.
2. Else if the legacy `macroplan:source` exists → wrap that source as a single plan (`name` = its parsed title, or `"Untitled"` if it doesn't parse), mark it active, write `macroplan:library`, and **remove** the legacy key.
3. Else → seed one sample plan, active.

A corrupt/unparseable `macroplan:library` value is treated as case 3 (seed fresh) rather than throwing — autosave is best-effort, consistent with the existing try/catch around `localStorage.setItem`.

## Architecture

### `useMacroplan` (refactor) — the library owner

Holds `plans` and `activeId`; persists the whole library to `macroplan:library` on any change (best-effort, in a try/catch as today).

Exposes:

| Member | Type | Notes |
|--------|------|-------|
| `source` | writable `Ref<string>` | Reads/writes the **active** plan's `source`. The editor's `v-model` binds here unchanged. Writing it refreshes the active plan's cached `name` when the new source parses to a title. |
| `plan` | `ComputedRef<Plan \| null>` | Active plan's derived model, falling back to its `lastGood` (unchanged behavior). |
| `error` | `ComputedRef<string \| null>` | Active plan's current parse error. |
| `plans` | `ComputedRef<{ id, name }[]>` | For the switcher. |
| `activeId` | `Ref<string>` | Current selection. |
| `newPlan()` | → `void` | Append a **blank** plan and switch to it. The sample is reserved for a genuinely empty library (first run / delete-the-last), which the ≥1-plan invariant means `newPlan` never sees. |
| `deletePlan(id)` | → `void` | Remove; if it was active, re-point `activeId` to the **preceding** plan in the list (or the new first plan if it was at index 0); if it was the last remaining plan, seed a fresh sample (the invariant). |
| `selectPlan(id)` | → `void` | Switch the active plan and **reset `lastGood`** so a broken target never shows the previous plan's render. |

`resetToSample` is **removed** — `newPlan()` (a blank page) replaces it.

### `PlanSwitcher.vue` (new) — presentational

- **Props:** `plans: { id: string; name: string }[]`, `activeId: string`.
- **Emits:** `select(id)`, `new`, `delete(id)`, `download(id)`.
- Renders a DaisyUI dropdown: the active plan's name as the trigger; a list of plans (active one checked); then `＋ New plan` and `⤓ Download .toml` entries.
- No storage or parsing logic — it only reflects props and emits intent.

### `downloadSource` + `slugify` (new util) — `.toml` export

- Refactor `exportFilename` (in `usePngExport.ts`) to build on an extracted `slugify(title): string` helper, so PNG and `.toml` names stay consistent:
  - `exportFilename(title)` → `macroplan-<slug>.png` (unchanged output; existing test still passes).
  - `sourceFilename(title)` → `macroplan-<slug>.toml`.
- `downloadSource(source: string, filename: string)`: `Blob(['…'], { type: 'text/plain' })` → object URL → anchor click → revoke. Mirrors the existing `downloadPng` mechanics. Lives in a small util (e.g. `src/composables/useSourceExport.ts`) — kept separate from `usePngExport` since it's source export, not render export.

### App shell (`App.vue`)

- The static `<h1>Macroplan</h1>` + subtitle block in the header is **replaced** by `<PlanSwitcher>` (logo kept).
- A **trash** button is added to the top bar; it deletes the **active** plan behind a confirm modal (`Delete "<name>"?` · Cancel / Delete). DaisyUI modal or `<dialog>`.
- `Copy PNG` and `Download` (PNG) buttons are **unchanged** — `.toml` download lives in the switcher dropdown precisely so there is no competing "Download" label in the top bar.
- Wire `PlanSwitcher` events: `select → selectPlan`, `new → newPlan`, `delete → open confirm → deletePlan`, `download → downloadSource(source, sourceFilename(plan.title))`.

## Data Flow

```
edit TOML ─► source (active plan) ─► autosave whole library ─► localStorage
                       │
                       └─► parse ─► plan/error ─► refresh active plan's cached name (on valid title)

switch ─► selectPlan(id) ─► activeId changes ─► source rebinds, lastGood reset ─► re-parse ─► render
new    ─► newPlan() ─► append blank plan ─► selectPlan(newId)
delete ─► confirm ─► deletePlan(activeId) ─► re-point active to preceding plan (or re-seed if last) ─► render
toml   ─► downloadSource(source, sourceFilename(title)) ─► browser download
```

## Error Handling

- **localStorage write fails** (full/blocked): swallowed in try/catch; the in-memory library stays usable for the session — same posture as today's autosave.
- **Corrupt `macroplan:library` on read:** fall back to seeding a fresh sample (don't throw).
- **Active plan source unparseable:** the grid keeps the last-good render and shows the error in the editor — existing behavior, now per active plan.
- **`crypto.randomUUID` unavailable:** target is modern browsers (the app already uses Clipboard API, `color-mix`, dynamic import); no fallback needed. Note in the plan if a wider support floor is required.

## Testing (Vitest, matching the existing suite)

**`useMacroplan` / library model:**
- No storage → library seeds one sample plan, active.
- Legacy `macroplan:source` present → migrates to a one-plan library (name = parsed title), legacy key removed.
- Corrupt `macroplan:library` → seeds fresh sample (no throw).
- `newPlan()` appends a **blank** plan and makes it active (the sample only seeds an empty library).
- `deletePlan(active)` removes it and re-points `activeId` to a remaining plan.
- `deletePlan` of the **last** plan re-seeds a fresh sample (invariant holds).
- Editing `source` updates the active entry and refreshes its cached `name` on a valid title; a broken edit keeps the last-good `name` and render.
- `selectPlan` swaps `source`/`plan`/`error` and resets `lastGood` (broken target shows its own error, not the prior render).

**Filename util:**
- `sourceFilename(title)` slug mirrors the existing `exportFilename` test (e.g. `"Q3 Delivery"` → `macroplan-q3-delivery.toml`); empty/garbage title → `macroplan-plan.toml`.

**Component (`@vue/test-utils`):**
- `PlanSwitcher` renders the plan names, marks the active one, and emits `select` / `new` / `delete` / `download` on the right interactions.

## Docs to update (in the implementation plan)

- **`CONTEXT.md`** — add the **Library** glossary entry above.
- **`README.md`** — flip the *"Not yet built: a library …"* note now that it exists; the *How it works* localStorage bullet can mention named plans + `.toml` export.

## Open questions

None blocking. Possible future follow-ups (out of scope): `.toml` file-open import, duplicate-plan, and reordering.
