import { describe, it, expect } from "vitest"
import { exportFilename } from "./usePngExport"

describe("exportFilename", () => {
  it("slugifies the plan title into a .png name", () => {
    expect(exportFilename("Q3 — Checkout revamp")).toBe("macroplan-q3-checkout-revamp.png")
  })

  it("collapses runs of punctuation/space and trims edge dashes", () => {
    expect(exportFilename("  Hello, World!!  ")).toBe("macroplan-hello-world.png")
  })

  it("falls back to a generic name when the title has no usable characters", () => {
    expect(exportFilename("")).toBe("macroplan-plan.png")
    expect(exportFilename("—— ··")).toBe("macroplan-plan.png")
  })
})
