// Schema-aware completion for the Macroplan TOML editor.
//
// The key / value lists below mirror the schema in `src/model/parse.ts`.
// Keep them in sync when fields are added, removed, or renamed.

export interface Completion {
  /** Text shown in the popup. */
  label: string
  /** Text inserted in place of source[from..to]. */
  insert: string
  /** Greyed hint shown after the label. */
  detail?: string
  /** Used for prefix matching when it differs from `label` (e.g. headers). */
  filter?: string
}

export interface CompletionContext {
  /** Replace source[from..to] with the chosen completion's `insert`. */
  from: number
  to: number
  items: Completion[]
}

type Block = 'plan' | 'feature' | 'milestone'

const PLAN_KEYS: Completion[] = [
  { label: 'title', insert: 'title = ', detail: 'plan title' },
  { label: 'start', insert: 'start = ', detail: 'left edge — date, optional' },
  { label: 'end', insert: 'end = ', detail: 'right edge — date, optional' },
]

const FEATURE_KEYS: Completion[] = [
  { label: 'name', insert: 'name = ', detail: 'required' },
  { label: 'start', insert: 'start = ', detail: 'date, required' },
  { label: 'original', insert: 'original = ', detail: 'Original Estimate — date, required' },
  { label: 'reestimates', insert: 'reestimates = ', detail: 'list of dates' },
  { label: 'delivered', insert: 'delivered = ', detail: 'date' },
  { label: 'status', insert: 'status = ', detail: 'on-track | at-risk | off-track' },
  { label: 'learning', insert: 'learning = ', detail: 'string' },
  { label: 'note', insert: 'note = ', detail: 'string' },
]

const MILESTONE_KEYS: Completion[] = [
  { label: 'name', insert: 'name = ', detail: 'required' },
  { label: 'week', insert: 'week = ', detail: 'date, required' },
  { label: 'requires', insert: 'requires = ', detail: 'list of feature names' },
]

const HEADERS: Completion[] = [
  { label: '[[feature]]', insert: '[[feature]]', detail: 'new feature', filter: 'feature' },
  { label: '[[milestone]]', insert: '[[milestone]]', detail: 'new milestone', filter: 'milestone' },
]

const STATUSES = ['on-track', 'at-risk', 'off-track'] // keep in sync with parse.ts

/** What to suggest at `caret` in `source`, or null when nothing applies. */
export function getCompletions(source: string, caret: number): CompletionContext | null {
  const lineStart = source.lastIndexOf('\n', caret - 1) + 1
  const linePrefix = source.slice(lineStart, caret)

  // ── value: status = "<here>" ──────────────────────────────────────────────
  const status = /^(\s*status\s*=\s*)"?([A-Za-z-]*)"?$/.exec(linePrefix)
  if (status) {
    const items = filter(
      STATUSES.map((s) => ({ label: s, insert: `"${s}"` })),
      status[2],
    )
    return result(lineStart + status[1].length, caret, items)
  }

  const block = currentBlock(source, lineStart)

  // ── value: requires = [ "<here>" … ]  (milestones only) ───────────────────
  if (block === 'milestone' && /requires\s*=\s*\[[^\]]*$/.test(linePrefix)) {
    const token = /("?)([^",[\]]*)$/.exec(linePrefix)!
    const items = filter(
      featureNames(source).map((n) => ({ label: n, insert: `"${n}"` })),
      token[2],
    )
    return result(caret - token[1].length - token[2].length, caret, items)
  }

  // ── key / header position: only indentation then an optional word ─────────
  const key = /^(\s*)(\[*)([A-Za-z]*)$/.exec(linePrefix)
  if (key) {
    const [, indent, brackets, word] = key
    if (brackets) {
      return result(lineStart + indent.length, caret, filter(HEADERS, word))
    }
    const keys =
      block === 'feature' ? FEATURE_KEYS : block === 'milestone' ? MILESTONE_KEYS : PLAN_KEYS
    const taken = presentKeys(source, lineStart, block)
    const items = filter([...keys.filter((k) => !taken.has(k.label)), ...HEADERS], word)
    return result(caret - word.length, caret, items)
  }

  return null
}

function result(from: number, to: number, items: Completion[]): CompletionContext | null {
  return items.length ? { from, to, items } : null
}

function filter(items: Completion[], word: string): Completion[] {
  if (!word) return items
  const w = word.toLowerCase()
  return items.filter((i) => (i.filter ?? i.label).toLowerCase().startsWith(w))
}

const HEADER_RE = /^[ \t]*\[\[(feature|milestone)\]\]/gm

/** The block owning the line at `lineStart` — 'plan' before the first header. */
function currentBlock(source: string, lineStart: number): Block {
  let block: Block = 'plan'
  HEADER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HEADER_RE.exec(source)) !== null && m.index < lineStart) {
    block = m[1] as Block
  }
  return block
}

/** Keys already written in the current block, so we don't offer duplicates. */
function presentKeys(source: string, lineStart: number, block: Block): Set<string> {
  const headers: number[] = []
  HEADER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HEADER_RE.exec(source)) !== null) headers.push(m.index)

  let start = 0
  let end = source.length
  if (block === 'plan') {
    end = headers[0] ?? source.length
  } else {
    for (let i = 0; i < headers.length; i++) {
      if (headers[i] < lineStart) {
        start = headers[i]
        end = headers[i + 1] ?? source.length
      } else break
    }
  }

  const taken = new Set<string>()
  const region = source.slice(start, end)
  const keyLine = /^[ \t]*([A-Za-z][\w-]*)\s*=/gm
  while ((m = keyLine.exec(region)) !== null) taken.add(m[1])
  return taken
}

/** Names declared in `[[feature]]` blocks — the valid targets for `requires`. */
function featureNames(source: string): string[] {
  const re = /^[ \t]*\[\[(feature|milestone)\]\]|^[ \t]*name\s*=\s*"([^"]*)"/gm
  const names = new Set<string>()
  let block: Block = 'plan'
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    if (m[1]) block = m[1] as Block
    else if (m[2] && block === 'feature') names.add(m[2])
  }
  return [...names]
}
