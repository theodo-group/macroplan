import { describe, it, expect } from 'vitest'
import { sourceFilename } from './useSourceExport'

describe('sourceFilename', () => {
  it('slugifies the plan title into a .toml name', () => {
    expect(sourceFilename('Q3 — Checkout revamp')).toBe('macroplan-q3-checkout-revamp.toml')
  })

  it('falls back to a generic name when the title has no usable characters', () => {
    expect(sourceFilename('')).toBe('macroplan-plan.toml')
    expect(sourceFilename('—— ··')).toBe('macroplan-plan.toml')
  })
})
