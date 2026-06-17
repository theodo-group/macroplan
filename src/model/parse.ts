import * as v from 'valibot'
import { parse as parseToml } from 'smol-toml'
import { toYmd } from './week'
import type { RawPlan, StatusLevel } from './types'

/** Thrown for any malformed source — message is safe to show the author. */
export class PlanParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanParseError'
  }
}

const STATUSES = ['green', 'orange', 'red'] as const satisfies readonly StatusLevel[]

// ── Field schemas ──────────────────────────────────────────────────────────
// A TOML date (smol-toml returns a Date subclass) or a yyyy-mm-dd string,
// normalized to yyyy-mm-dd via `toYmd`.
const Ymd = v.pipe(
  v.union([v.date(), v.string()], 'must be a date (e.g. 2026-06-01)'),
  v.transform((value: string | Date) => toYmd(value)),
)

const Status = v.picklist(STATUSES, `must be one of ${STATUSES.join(', ')}`)

const Name = v.pipe(v.string('is required'), v.nonEmpty('is required'))

const FeatureSchema = v.object({
  name: Name,
  start: Ymd,
  original: Ymd,
  reestimates: v.optional(v.array(Ymd, 'must be a list of dates'), []),
  delivered: v.optional(Ymd),
  learning: v.optional(v.string()),
  status: v.optional(Status),
  note: v.optional(v.string()),
})

const MilestoneSchema = v.object({
  name: Name,
  week: Ymd,
  requires: v.optional(v.array(v.string('must be a feature name'), 'must be a list of feature names'), []),
})

/** Parse + validate a Macroplan TOML source into the raw model. */
export function parseMacroplan(source: string): RawPlan {
  let data: Record<string, unknown>
  try {
    data = parseToml(source) as Record<string, unknown>
  } catch (e) {
    throw new PlanParseError(e instanceof Error ? e.message : String(e))
  }

  return {
    title: data.title != null ? String(data.title) : 'Untitled Macroplan',
    start: data.start != null ? check(Ymd, data.start, 'plan', 'start') : undefined,
    end: data.end != null ? check(Ymd, data.end, 'plan', 'end') : undefined,
    features: asBlocks(data.feature, 'feature').map((f, i) =>
      check(FeatureSchema, f, blockWhere('feature', f, i)),
    ),
    milestones: asBlocks(data.milestone, 'milestone').map((m, i) =>
      check(MilestoneSchema, m, blockWhere('milestone', m, i)),
    ),
  }
}

function asBlocks(value: unknown, key: string): unknown[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new PlanParseError(`\`${key}\` must be written as [[${key}]] blocks`)
  }
  return value
}

/** "feature \"Payments\"" when the block carries a name, else "feature #2". */
function blockWhere(kind: string, block: unknown, i: number): string {
  const name =
    block != null && typeof block === 'object' && 'name' in block
      ? (block as { name: unknown }).name
      : undefined
  return name != null && name !== '' ? `${kind} "${String(name)}"` : `${kind} #${i + 1}`
}

/** Validate `value` against `schema`, raising a contextual PlanParseError. */
function check<S extends v.GenericSchema>(
  schema: S,
  value: unknown,
  where: string,
  field?: string,
): v.InferOutput<S> {
  const result = v.safeParse(schema, value)
  if (!result.success) {
    throw new PlanParseError(`${where}: ${friendly(result.issues[0], field)}`)
  }
  return result.output
}

type Issue = {
  readonly message: string
  readonly received: string
  readonly path?: ReadonlyArray<{ readonly key: unknown }>
}

/** Render an issue against the offending field, e.g. "`start` must be a date"
 *  — or "missing `original`" when the key is absent (valibot reports its own
 *  "Invalid key" wording for that, which isn't fit to show the author). */
function friendly(issue: Issue, fallbackField?: string): string {
  const key = issue.path?.[0]?.key
  const field = typeof key === 'string' ? key : fallbackField
  if (issue.received === 'undefined') return field ? `missing \`${field}\`` : 'missing value'
  return field ? `\`${field}\` ${issue.message}` : issue.message
}
