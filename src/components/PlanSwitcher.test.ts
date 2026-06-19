// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { mount } from "@vue/test-utils"
import PlanSwitcher from "./PlanSwitcher.vue"

const plans = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Bravo" },
]

describe("PlanSwitcher", () => {
  it("lists plan names and marks the active one", () => {
    const w = mount(PlanSwitcher, { props: { plans, activeId: "b" } })
    expect(w.text()).toContain("Alpha")
    expect(w.text()).toContain("Bravo")
    expect(w.find("a.active").text()).toContain("Bravo")
  })

  it("emits select with the clicked plan id", async () => {
    const w = mount(PlanSwitcher, { props: { plans, activeId: "a" } })
    await w.findAll("li a")[1].trigger("click") // Bravo
    expect(w.emitted("select")?.[0]).toEqual(["b"])
  })

  it("emits new and download (with the active id) from the trailing actions", async () => {
    const w = mount(PlanSwitcher, { props: { plans, activeId: "a" } })
    const actions = w.findAll("li a")
    await actions[actions.length - 2].trigger("click") // New plan
    await actions[actions.length - 1].trigger("click") // Download .toml
    expect(w.emitted("new")).toBeTruthy()
    expect(w.emitted("download")?.[0]).toEqual(["a"])
  })
})
