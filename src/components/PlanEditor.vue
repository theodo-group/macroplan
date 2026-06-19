<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue"
import type { HighlighterCore } from "shiki/core"
import { getCompletions, type CompletionContext } from "./completion"

const props = defineProps<{ modelValue: string; error: string | null }>()
const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const textarea = ref<HTMLTextAreaElement>()
const backdrop = ref<HTMLElement>()
const highlighter = ref<HighlighterCore>()

// ── Completion popup state ───────────────────────────────────────────────────
const completion = ref<CompletionContext | null>(null)
const selected = ref(0)
const popup = ref({ left: 0, top: 0 })
// Suppress the popup for one keystroke after Escape, so it doesn't pop straight
// back open while the author is still typing the word they just dismissed.
let justEscaped = false
// Pixel metrics of the (monospace, non-wrapping) textarea, measured once.
let metrics = { charWidth: 8, lineHeight: 20, padLeft: 16, padTop: 14 }

onMounted(async () => {
  measure()
  // Lazy-load Shiki as its own chunk so it stays out of the initial bundle.
  // Fine-grained: only the TOML grammar + one light theme, JS engine (no WASM).
  const [core, engine, toml, theme] = await Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/langs/toml.mjs"),
    import("shiki/themes/github-light.mjs"),
  ])
  highlighter.value = await core.createHighlighterCore({
    themes: [theme.default],
    langs: [toml.default],
    engine: engine.createJavaScriptRegexEngine(),
  })
})

function measure() {
  const el = textarea.value
  if (!el) return
  const cs = getComputedStyle(el)
  const ctx = document.createElement("canvas").getContext("2d")!
  ctx.font = `${cs.fontSize} ${cs.fontFamily}`
  const lh = parseFloat(cs.lineHeight) // px value in every modern browser
  metrics = {
    charWidth: ctx.measureText("0000000000").width / 10,
    lineHeight: Number.isNaN(lh) || lh < 4 ? parseFloat(cs.fontSize) * 1.6 : lh,
    padLeft: parseFloat(cs.paddingLeft),
    padTop: parseFloat(cs.paddingTop),
  }
}

/** Recompute suggestions from the live textarea value + caret. */
function refresh() {
  const el = textarea.value
  if (!el) return
  completion.value = justEscaped ? null : getCompletions(el.value, el.selectionStart)
  selected.value = 0
  if (completion.value) position()
}

/** Place the popup just below the caret (monospace ⇒ column × charWidth). */
function position() {
  const el = textarea.value
  if (!el) return
  const before = el.value.slice(0, el.selectionStart)
  const lineIndex = before.split("\n").length - 1
  const line = before.slice(before.lastIndexOf("\n") + 1)
  let col = 0
  for (const ch of line) col = ch === "\t" ? col + (2 - (col % 2)) : col + 1
  popup.value = {
    left: metrics.padLeft + col * metrics.charWidth - el.scrollLeft,
    top: metrics.padTop + (lineIndex + 1) * metrics.lineHeight - el.scrollTop,
  }
}

function accept(i: number) {
  const el = textarea.value
  const ctx = completion.value
  if (!el || !ctx) return
  const item = ctx.items[i]
  const caret = ctx.from + item.insert.length
  completion.value = null
  emit("update:modelValue", el.value.slice(0, ctx.from) + item.insert + el.value.slice(ctx.to))
  nextTick(() => {
    el.setSelectionRange(caret, caret)
    el.focus()
    refresh() // chain, e.g. `status = ` immediately offers the enum values
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape") justEscaped = false
  const ctx = completion.value
  if (!ctx) return
  const move = (delta: number) => {
    e.preventDefault()
    selected.value = (selected.value + delta + ctx.items.length) % ctx.items.length
  }
  // Ctrl+N / Ctrl+P mirror ArrowDown / ArrowUp (readline-style navigation).
  if (e.ctrlKey && (e.key === "n" || e.key === "p")) {
    move(e.key === "n" ? 1 : -1)
    return
  }
  switch (e.key) {
    case "ArrowDown":
      move(1)
      break
    case "ArrowUp":
      move(-1)
      break
    case "Enter":
    case "Tab":
      e.preventDefault()
      accept(selected.value)
      break
    case "Escape":
      e.preventDefault()
      completion.value = null
      justEscaped = true
      break
    // Caret jumps would leave the popup stranded at a stale spot — close it.
    case "ArrowLeft":
    case "ArrowRight":
    case "Home":
    case "End":
      completion.value = null
      break
  }
}

const highlighted = computed(() => {
  // a trailing newline needs a trailing char so the last backdrop line keeps height
  const code = props.modelValue.endsWith("\n") ? props.modelValue + " " : props.modelValue
  const hl = highlighter.value
  if (!hl) return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`
  return hl.codeToHtml(code, { lang: "toml", theme: "github-light" })
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
}

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLTextAreaElement).value)
  refresh()
}

function syncScroll() {
  if (!textarea.value || !backdrop.value) return
  backdrop.value.scrollTop = textarea.value.scrollTop
  backdrop.value.scrollLeft = textarea.value.scrollLeft
  if (completion.value) position()
}
</script>

<template>
  <div class="editor">
    <div class="code">
      <div ref="backdrop" class="backdrop" aria-hidden="true" v-html="highlighted" />
      <textarea
        ref="textarea"
        class="input"
        :value="modelValue"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        autocomplete="off"
        aria-label="Macroplan TOML source"
        @input="onInput"
        @scroll="syncScroll"
        @keydown="onKeydown"
        @blur="completion = null"
      ></textarea>
      <ul
        v-if="completion"
        class="completion"
        :style="{ left: popup.left + 'px', top: popup.top + 'px' }"
      >
        <li
          v-for="(item, i) in completion.items"
          :key="item.label"
          :class="{ active: i === selected }"
          @mousedown.prevent="accept(i)"
        >
          <span class="label">{{ item.label }}</span>
          <span v-if="item.detail" class="detail">{{ item.detail }}</span>
        </li>
      </ul>
    </div>
    <div v-if="error" class="editor-error" role="alert">
      <span class="font-semibold">Can’t parse:</span> {{ error }}
    </div>
  </div>
</template>

<style scoped>
.editor {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.code {
  position: relative;
  flex: 1;
  min-height: 0;
}
/* Backdrop (highlighted) and textarea (input) share identical box metrics so the
   transparent input text sits exactly over its colored Shiki copy. */
.backdrop,
.input {
  position: absolute;
  inset: 0;
  margin: 0;
  border: 0;
  padding: 0.9rem 1rem;
  font-family: inherit; /* Fira Code, from the global theme */
  font-size: 0.8rem;
  line-height: 1.6;
  tab-size: 2;
  white-space: pre;
}
.backdrop {
  z-index: 0;
  pointer-events: none;
  overflow: hidden; /* scroll is driven by the textarea via syncScroll */
  background: var(--color-base-100);
  color: var(--color-base-content);
}
/* Neutralise Shiki's own <pre> chrome — the .backdrop provides padding/metrics. */
.backdrop :deep(pre.shiki) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  white-space: pre;
}
.backdrop :deep(pre.shiki),
.backdrop :deep(pre.shiki code) {
  font: inherit;
}
.input {
  z-index: 1;
  /* A textarea has an intrinsic block size (its `rows`), so inset:0 alone won't
     stretch it the way it does the plain-div backdrop — pin both axes to fill. */
  width: 100%;
  height: 100%;
  overflow: auto;
  resize: none;
  outline: none;
  background: transparent;
  color: transparent;
  caret-color: var(--color-base-content);
}
.input::selection {
  background: color-mix(in oklch, var(--color-primary) 28%, transparent);
}
/* Completion popup, anchored just below the caret (see position()). */
.completion {
  position: absolute;
  z-index: 2;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  min-width: 16rem;
  max-width: 30rem;
  max-height: 14rem;
  overflow-y: auto;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 0.4rem;
  box-shadow: 0 8px 24px color-mix(in oklch, black 16%, transparent);
}
.completion li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  white-space: nowrap;
}
.completion li.active {
  background: color-mix(in oklch, var(--color-primary) 18%, transparent);
}
.completion .label {
  font-size: 0.78rem;
}
.completion .detail {
  font-size: 0.68rem;
  color: color-mix(in oklch, var(--color-base-content) 55%, transparent);
}
.editor-error {
  padding: 0.6rem 1rem;
  font-size: 0.74rem;
  background: var(--color-error);
  color: var(--color-error-content);
  border-top: 1px solid color-mix(in oklch, black 12%, var(--color-error));
}
</style>
