import { describe, it, expect } from 'vitest'
import { getCompletions } from './completion'

/** Split a `|`-marked string into (source, caret offset). */
function atCaret(marked: string): [string, number] {
  const caret = marked.indexOf('|')
  return [marked.slice(0, caret) + marked.slice(caret + 1), caret]
}

/** The labels offered at the `|` marker. */
function labelsAt(marked: string): string[] {
  const [source, caret] = atCaret(marked)
  return getCompletions(source, caret)?.items.map((i) => i.label) ?? []
}

describe('completion context', () => {
  it('offers plan keys and block headers on an empty top-level line', () => {
    expect(labelsAt('|')).toEqual(['title', 'start', 'end', '[[feature]]', '[[milestone]]'])
  })

  it('offers feature keys inside a [[feature]] block', () => {
    expect(labelsAt('[[feature]]\n|')).toEqual([
      'name',
      'start',
      'original',
      'reestimates',
      'delivered',
      'status',
      'learning',
      'note',
      '[[feature]]',
      '[[milestone]]',
    ])
  })

  it('offers milestone keys inside a [[milestone]] block', () => {
    expect(labelsAt('[[milestone]]\n|')).toEqual([
      'name',
      'week',
      'requires',
      '[[feature]]',
      '[[milestone]]',
    ])
  })

  it('excludes keys already written in the current block', () => {
    const labels = labelsAt('[[feature]]\nname = "X"\noriginal = 2026-06-01\n|')
    expect(labels).not.toContain('name')
    expect(labels).not.toContain('original')
    expect(labels).toContain('start')
  })

  it('filters keys by the typed prefix', () => {
    expect(labelsAt('[[feature]]\nst|')).toEqual(['start', 'status'])
  })

  it('completes a header from a leading bracket', () => {
    expect(labelsAt('[[f|')).toEqual(['[[feature]]'])
  })

  it('suggests status values after status =', () => {
    expect(labelsAt('[[feature]]\nstatus = |')).toEqual(['on-track', 'at-risk', 'off-track'])
  })

  it('filters status values by the typed prefix, inside an open quote', () => {
    expect(labelsAt('[[feature]]\nstatus = "o|')).toEqual(['on-track', 'off-track'])
  })

  it('suggests feature names inside a milestone requires array', () => {
    const source = '[[feature]]\nname = "Payments"\n\n[[milestone]]\nrequires = ["|'
    expect(labelsAt(source)).toEqual(['Payments'])
  })

  it('does not offer feature names outside a milestone block', () => {
    // `requires` is meaningless at the plan level, so there is nothing to add.
    expect(labelsAt('name = "Payments"\n\n[[feature]]\nrequires = ["|')).toEqual([])
  })

  it('returns nothing in a value position it cannot complete (a date)', () => {
    expect(getCompletions(...atCaret('[[feature]]\nstart = 2026-|'))).toBeNull()
  })
})

describe('completion replace range', () => {
  it('replaces the typed prefix, not the whole line', () => {
    const source = '[[feature]]\nst'
    const ctx = getCompletions(source, source.length)!
    expect(source.slice(ctx.from, ctx.to)).toBe('st')
  })

  it('replaces a partial bracketed header from the bracket', () => {
    const source = '[[f'
    const ctx = getCompletions(source, source.length)!
    expect(source.slice(ctx.from, ctx.to)).toBe('[[f')
    expect(ctx.items[0].insert).toBe('[[feature]]')
  })
})
