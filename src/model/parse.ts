import { parse as parseToml } from 'smol-toml'
import { toYmd } from './week'
import type { RawPlan, RawFeature, RawMilestone, StatusLevel } from './types'

/** Thrown for any malformed source — message is safe to show the author. */
export class PlanParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanParseError'
  }
}

const STATUSES: StatusLevel[] = ['green', 'orange', 'red']

/** Parse + validate a Macroplan TOML source into the raw model. */
export function parseMacroplan(source: string): RawPlan {
  let data: Record<string, unknown>
  try {
    data = parseToml(source) as Record<string, unknown>
  } catch (e) {
    throw new PlanParseError(e instanceof Error ? e.message : String(e))
  }

  const features = asBlocks(data.feature, 'feature').map(parseFeature)
  const milestones = asBlocks(data.milestone, 'milestone').map(parseMilestone)

  return {
    title: data.title != null ? String(data.title) : 'Untitled Macroplan',
    start: data.start != null ? toYmdOr('plan', 'start', data.start) : undefined,
    end: data.end != null ? toYmdOr('plan', 'end', data.end) : undefined,
    features,
    milestones,
  }
}

function asBlocks(value: unknown, key: string): Record<string, unknown>[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new PlanParseError(`\`${key}\` must be written as [[${key}]] blocks`)
  }
  return value as Record<string, unknown>[]
}

function parseFeature(f: Record<string, unknown>, i: number): RawFeature {
  const where = f.name ? `feature "${String(f.name)}"` : `feature #${i + 1}`
  if (!f.name) throw new PlanParseError(`${where}: missing \`name\``)
  if (f.start == null) throw new PlanParseError(`${where}: missing \`start\` date`)
  if (f.original == null) throw new PlanParseError(`${where}: missing \`original\` estimate date`)
  if (f.status != null && !STATUSES.includes(f.status as StatusLevel)) {
    throw new PlanParseError(`${where}: \`status\` must be one of ${STATUSES.join(', ')}`)
  }
  if (f.reestimates != null && !Array.isArray(f.reestimates)) {
    throw new PlanParseError(`${where}: \`reestimates\` must be a list of dates`)
  }
  return {
    name: String(f.name),
    start: toYmdOr(where, 'start', f.start),
    original: toYmdOr(where, 'original', f.original),
    reestimates: ((f.reestimates as unknown[]) ?? []).map((d) => toYmdOr(where, 'reestimates', d)),
    delivered: f.delivered != null ? toYmdOr(where, 'delivered', f.delivered) : undefined,
    learning: f.learning != null ? String(f.learning) : undefined,
    status: f.status as StatusLevel | undefined,
    note: f.note != null ? String(f.note) : undefined,
  }
}

function parseMilestone(m: Record<string, unknown>, i: number): RawMilestone {
  const where = m.name ? `milestone "${String(m.name)}"` : `milestone #${i + 1}`
  if (!m.name) throw new PlanParseError(`${where}: missing \`name\``)
  if (m.week == null) throw new PlanParseError(`${where}: missing \`week\` date`)
  if (m.requires != null && !Array.isArray(m.requires)) {
    throw new PlanParseError(`${where}: \`requires\` must be a list of feature names`)
  }
  return {
    name: String(m.name),
    week: toYmdOr(where, 'week', m.week),
    requires: ((m.requires as unknown[]) ?? []).map(String),
  }
}

function toYmdOr(where: string, field: string, value: unknown): string {
  try {
    return toYmd(value)
  } catch {
    throw new PlanParseError(`${where}: \`${field}\` must be a date (e.g. 2026-06-01)`)
  }
}
