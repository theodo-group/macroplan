import { slugify } from "./usePngExport"

/** Slugified, stable download name for a plan's TOML source. */
export function sourceFilename(title: string): string {
  return `macroplan-${slugify(title) || "plan"}.toml`
}

/** Download a plan's TOML source as a .toml file (client-side, no backend). */
export function downloadSource(source: string, filename: string): void {
  const blob = new Blob([source], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
