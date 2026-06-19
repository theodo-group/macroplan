// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { mount } from "@vue/test-utils"
import MacroplanGrid from "./MacroplanGrid.vue"
import { parseMacroplan } from "../model/parse"
import { buildPlan } from "../model/plan"
import { SAMPLE_PLAN } from "../data/sample"

const plan = buildPlan(parseMacroplan(SAMPLE_PLAN), "2026-06-17")

function mountGrid() {
  return mount(MacroplanGrid, { props: { plan } })
}

describe("MacroplanGrid renders the sample plan", () => {
  it("renders one row per feature, in order", () => {
    const names = mountGrid()
      .findAll(".namecell")
      .map((n) => n.text())
    expect(names).toEqual(["Auth", "Payments", "Dashboard", "Search", "Notifications"])
  })

  it("renders the right markers per feature", () => {
    const rows = mountGrid().findAll(".namecell")
    // each feature row is namecell + week cells + learncell; grab the row text via the grid
    const grid = mountGrid()
    const text = grid.text()
    expect(rows).toHaveLength(5)
    // on-time, late, and slip glyphs all present somewhere in the grid
    expect(text).toContain("◉") // Auth delivered on time
    expect(text).toContain("▲") // Payments delivered late
    expect(text).toContain("△") // re-estimates
    expect(text).toContain("◯") // open original estimates
  })

  it("draws a now column and the milestone header", () => {
    const w = mountGrid()
    expect(w.find(".col-now").exists()).toBe(true)
    expect(w.text()).toContain("now")
    expect(w.text()).toContain("MVP go-live")
  })

  it("shows a learning for a delivered feature and a status note for an in-flight one", () => {
    const text = mountGrid().text()
    expect(text).toContain("Vendor lead time") // Payments learning
    expect(text).toContain("No recovery plan yet") // Dashboard status note
  })

  it("labels week columns", () => {
    expect(mountGrid().text()).toContain("Jun 15")
  })
})
