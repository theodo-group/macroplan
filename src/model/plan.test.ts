import { describe, it, expect } from 'vitest'
import { parseMacroplan, PlanParseError } from './parse'
import { buildPlan } from './plan'
import { mondayOf, weekRange } from './week'
import type { FeatureRow } from './types'
import { SAMPLE_PLAN } from '../data/sample'

const TODAY = '2026-06-17' // a Wednesday → week of Mon 2026-06-15

function rowOf(source: string, name: string): FeatureRow {
  const plan = buildPlan(parseMacroplan(source), TODAY)
  const row = plan.rows.find((r) => r.name === name)
  if (!row) throw new Error(`no row ${name}`)
  return row
}

describe('week math', () => {
  it('snaps any day to its Monday', () => {
    expect(mondayOf('2026-06-17')).toBe('2026-06-15') // Wed → Mon
    expect(mondayOf('2026-06-15')).toBe('2026-06-15') // Mon → Mon
    expect(mondayOf('2026-06-21')).toBe('2026-06-15') // Sun → that week's Mon
    expect(mondayOf('2026-06-01')).toBe('2026-06-01') // Mon
  })

  it('builds an inclusive contiguous Monday range', () => {
    expect(weekRange('2026-06-01', '2026-06-22')).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
      '2026-06-22',
    ])
  })
})

describe('F2 — on-time / late classification (ADR-0001)', () => {
  const base = (extra: string) =>
    `[[feature]]\nname = "X"\nstart = 2026-06-01\noriginal = 2026-06-15\n${extra}\n`

  it('delivered on the Original Estimate week → ◉, no ◯, onTime true', () => {
    const r = rowOf(base('delivered = 2026-06-15'), 'X')
    expect(r.onTime).toBe(true)
    expect(r.markers.map((m) => m.kind)).toEqual(['delivered-on-time'])
    expect(r.markers[0].week).toBe('2026-06-15')
  })

  it('delivered earlier than the Original Estimate → still on-time ◉, bar ends at delivery', () => {
    const r = rowOf(base('delivered = 2026-06-08'), 'X')
    expect(r.onTime).toBe(true)
    expect(r.markers.map((m) => m.kind)).toEqual(['delivered-on-time'])
    expect(r.markers[0].week).toBe('2026-06-08')
    expect(r.barEndWeek).toBe('2026-06-08') // no ◯ dangling in the future
  })

  it('delivered after the Original Estimate → ▲ late, ◯ baseline preserved', () => {
    const r = rowOf(base('delivered = 2026-06-29'), 'X')
    expect(r.onTime).toBe(false)
    const kinds = r.markers.map((m) => `${m.kind}@${m.week}`).sort()
    expect(kinds).toEqual(['delivered-late@2026-06-29', 'original@2026-06-15'])
    expect(r.barEndWeek).toBe('2026-06-29')
  })

  it('late delivery with multiple slips keeps ◯ + every △ + ▲ (judged vs original, not re-estimate)', () => {
    const r = rowOf(
      base('reestimates = [2026-06-29, 2026-07-13]\ndelivered = 2026-07-20'),
      'X',
    )
    expect(r.onTime).toBe(false) // 07-20 > original 06-15, regardless of the 07-13 re-estimate
    expect(r.slipCount).toBe(2)
    const byKind = r.markers.reduce<Record<string, string[]>>((acc, m) => {
      ;(acc[m.kind] ??= []).push(m.week)
      return acc
    }, {})
    expect(byKind.original).toEqual(['2026-06-15'])
    expect(byKind.reestimate?.sort()).toEqual(['2026-06-29', '2026-07-13'])
    expect(byKind['delivered-late']).toEqual(['2026-07-20'])
  })

  it('in-flight (undelivered) → ◯ only, onTime null, bar ends at the furthest estimate', () => {
    const r = rowOf(base('reestimates = [2026-06-29]\nstatus = "red"'), 'X')
    expect(r.onTime).toBeNull()
    expect(r.delivered).toBe(false)
    expect(r.status).toBe('red')
    expect(r.barEndWeek).toBe('2026-06-29') // furthest open estimate
    expect(r.markers.some((m) => m.kind === 'original')).toBe(true)
  })
})

describe('plan derivation', () => {
  it('derives a contiguous week range and places the now line', () => {
    const plan = buildPlan(parseMacroplan(SAMPLE_PLAN), TODAY)
    expect(plan.weeks[0]).toBe('2026-06-01') // earliest start
    expect(plan.weeks.at(-1)).toBe('2026-07-20') // latest marker (Payments delivery)
    // contiguous, weekly
    expect(plan.weeks).toContain('2026-06-29')
    expect(plan.nowWeek).toBe('2026-06-15')
    expect(plan.nowInRange).toBe(true)
  })

  it('flags a Milestone’s unmet required Features (undelivered or delivered after the milestone)', () => {
    const plan = buildPlan(parseMacroplan(SAMPLE_PLAN), TODAY)
    const mvp = plan.milestones.find((m) => m.name === 'MVP go-live')!
    expect(mvp.week).toBe('2026-07-06')
    // Auth delivered 06-15 (met); Payments delivered 07-20 > 07-06 (unmet); Dashboard undelivered (unmet)
    expect(mvp.unmet.sort()).toEqual(['Dashboard', 'Payments'])
  })
})

describe('parse validation', () => {
  it('rejects a feature missing its Original Estimate', () => {
    expect(() => parseMacroplan('[[feature]]\nname = "A"\nstart = 2026-06-01\n')).toThrow(
      PlanParseError,
    )
  })

  it('rejects an invalid status', () => {
    expect(() =>
      parseMacroplan('[[feature]]\nname="A"\nstart=2026-06-01\noriginal=2026-06-08\nstatus="blue"\n'),
    ).toThrow(/status/)
  })

  it('parses the bundled sample without error', () => {
    const raw = parseMacroplan(SAMPLE_PLAN)
    expect(raw.features).toHaveLength(5)
    expect(raw.milestones).toHaveLength(1)
  })
})
