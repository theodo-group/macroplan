import { ref } from "vue"

type Toast = { kind: "ok" | "err"; text: string } | null

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

/**
 * Client-side PNG export of a rendered Macroplan (C6 / F7). Captures the full
 * grid — not just the scrolled viewport — by expanding the target to its
 * content width for the duration of the render, then copies to the clipboard
 * or downloads. html-to-image is dynamically imported so it stays out of the
 * initial bundle (like Shiki in the editor).
 */
export function usePngExport() {
  const busy = ref(false)
  const toast = ref<Toast>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function flash(kind: "ok" | "err", text: string) {
    toast.value = { kind, text }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (toast.value = null), 3000)
  }

  async function render(el: HTMLElement): Promise<Blob> {
    const { toBlob } = await import("html-to-image")
    // `exporting` expands the wrapper to max-content and un-clips the grid so the
    // whole timeline is captured even when it scrolls horizontally on screen.
    el.classList.add("exporting")
    // reading layout flushes the class's style changes before we measure
    const width = el.scrollWidth
    const height = el.scrollHeight
    try {
      const blob = await toBlob(el, { width, height, pixelRatio: 2, cacheBust: true })
      if (!blob) throw new Error("renderer returned no image")
      return blob
    } finally {
      el.classList.remove("exporting")
    }
  }

  async function copyPng(el?: HTMLElement | null) {
    if (!el || busy.value) return
    busy.value = true
    try {
      // ClipboardItem accepts a Promise<Blob>, so the async render stays inside
      // the user-gesture window — Safari rejects a write started after an await.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": render(el) })])
      flash("ok", "PNG copied to clipboard")
    } catch {
      flash("err", "Couldn’t copy — use Download instead")
    } finally {
      busy.value = false
    }
  }

  async function downloadPng(el?: HTMLElement | null, filename = "macroplan.png") {
    if (!el || busy.value) return
    busy.value = true
    try {
      const blob = await render(el)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      flash("ok", "PNG downloaded")
    } catch {
      flash("err", "Export failed — please retry")
    } finally {
      busy.value = false
    }
  }

  return { busy, toast, copyPng, downloadPng }
}
