// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useMacroplan } from './useMacroplan'
import { SAMPLE_PLAN } from '../data/sample'

const LIB_KEY = 'macroplan:library'
const LEGACY_KEY = 'macroplan:source'

beforeEach(() => localStorage.clear())

describe('useMacroplan — load & migration', () => {
  it('seeds one sample plan when storage is empty, and persists it immediately', () => {
    const m = useMacroplan()
    expect(m.plans.value).toHaveLength(1)
    expect(m.activeId.value).toBe(m.plans.value[0].id)
    expect(m.source.value).toBe(SAMPLE_PLAN)
    expect(localStorage.getItem(LIB_KEY)).toBeTruthy() // survives a reload
  })

  it('migrates a legacy single-source store into a one-plan library and drops the legacy key', () => {
    localStorage.setItem(LEGACY_KEY, SAMPLE_PLAN)
    const m = useMacroplan()
    expect(m.plans.value).toHaveLength(1)
    expect(m.source.value).toBe(SAMPLE_PLAN)
    expect(m.plans.value[0].name).toBe('Q3 — Checkout revamp')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('falls back to a fresh sample when the library JSON is corrupt', () => {
    localStorage.setItem(LIB_KEY, '{ not valid json')
    const m = useMacroplan()
    expect(m.plans.value).toHaveLength(1)
    expect(m.source.value).toBe(SAMPLE_PLAN)
  })

  it('repairs a stale activeId instead of discarding the stored plans', () => {
    localStorage.setItem(
      LIB_KEY,
      JSON.stringify({
        version: 1,
        activeId: 'gone',
        plans: [{ id: 'x', name: 'Kept', source: SAMPLE_PLAN }],
      }),
    )
    const m = useMacroplan()
    expect(m.activeId.value).toBe('x')
    expect(m.plans.value[0].name).toBe('Kept')
  })
})

describe('useMacroplan — active plan binding', () => {
  it('refreshes the cached name when the active source parses to a title, and autosaves', async () => {
    const m = useMacroplan()
    m.source.value = 'title = "Renamed"\n'
    await nextTick()
    expect(m.plans.value[0].name).toBe('Renamed')
    expect(localStorage.getItem(LIB_KEY)).toContain('Renamed')
  })

  it('keeps the last-good name and render when the source is mid-edit/broken', async () => {
    const m = useMacroplan()
    const goodPlan = m.plan.value
    m.source.value = 'title = "Renamed"\n[[feature]]\n' // feature missing name → parse error
    await nextTick()
    expect(m.error.value).toBeTruthy()
    expect(m.plan.value).toBe(goodPlan) // last-good render retained
    expect(m.plans.value[0].name).toBe('Q3 — Checkout revamp') // name unchanged
  })
})

describe('useMacroplan — CRUD', () => {
  it('newPlan appends a sample plan and activates it', () => {
    const m = useMacroplan()
    const firstId = m.activeId.value
    m.newPlan()
    expect(m.plans.value).toHaveLength(2)
    expect(m.activeId.value).not.toBe(firstId)
    expect(m.source.value).toBe(SAMPLE_PLAN)
  })

  it('deletePlan removes the active plan and re-points to the preceding one', () => {
    const m = useMacroplan()
    m.newPlan() // 2 plans; second is active
    const [first, second] = m.plans.value
    m.deletePlan(second.id)
    expect(m.plans.value).toHaveLength(1)
    expect(m.activeId.value).toBe(first.id)
  })

  it('deleting the last plan re-seeds a fresh sample (never empty)', () => {
    const m = useMacroplan()
    m.deletePlan(m.activeId.value)
    expect(m.plans.value).toHaveLength(1)
    expect(m.source.value).toBe(SAMPLE_PLAN)
  })

  it('switching to a broken plan shows its own empty state, not the previous render', async () => {
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
