// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { nextTick } from "vue"

// downloadSource performs a real DOM/Blob download; mock it so we can assert
// the wiring without touching the filesystem. sourceFilename stays real.
vi.mock("./composables/useSourceExport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./composables/useSourceExport")>()
  return { ...actual, downloadSource: vi.fn() }
})

import App from "./App.vue"
import { downloadSource } from "./composables/useSourceExport"
import { SAMPLE_PLAN } from "./data/sample"

// The editor lazy-loads Shiki and the grid is heavy; neither is under test here.
const stubs = { PlanEditor: true, MacroplanGrid: true }

function mountApp() {
  return mount(App, { global: { stubs } })
}

// dropdown links = one <a> per plan, then "New plan" and "Download .toml".
function dropdownLinks(w: ReturnType<typeof mountApp>) {
  return w.findAll(".dropdown-content li a")
}

beforeEach(() => localStorage.clear())

describe("App — plan library wiring", () => {
  it("shows the active plan name in the header switcher", () => {
    expect(mountApp().text()).toContain("Q3 — Checkout revamp")
  })

  it("creates a new plan from the dropdown", async () => {
    const w = mountApp()
    expect(dropdownLinks(w)).toHaveLength(3) // 1 plan + New + Download
    await dropdownLinks(w)[1].trigger("click") // New plan
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(4) // 2 plans + New + Download
  })

  it("opens the confirm modal and deletes the active plan on confirm", async () => {
    const w = mountApp()
    await dropdownLinks(w)[1].trigger("click") // New → 2 plans
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(4)

    await w.find('button[title="Delete this plan"]').trigger("click")
    expect(w.find(".modal-open").exists()).toBe(true)

    await w.find(".modal-action .btn-error").trigger("click") // Delete
    await nextTick()
    expect(w.find(".modal-open").exists()).toBe(false)
    expect(dropdownLinks(w)).toHaveLength(3) // back to 1 plan
  })

  it("cancel dismisses the modal without deleting", async () => {
    const w = mountApp()
    await w.find('button[title="Delete this plan"]').trigger("click")
    expect(w.find(".modal-open").exists()).toBe(true)

    const cancel = w.findAll(".modal-action .btn").find((b) => !b.classes().includes("btn-error"))!
    await cancel.trigger("click")
    expect(w.find(".modal-open").exists()).toBe(false)
    expect(dropdownLinks(w)).toHaveLength(3) // plan untouched
  })

  it("re-seeds a fresh sample when the last plan is deleted (never empty)", async () => {
    const w = mountApp()
    expect(dropdownLinks(w)).toHaveLength(3) // 1 plan

    await w.find('button[title="Delete this plan"]').trigger("click")
    await w.find(".modal-action .btn-error").trigger("click") // Delete the only plan
    await nextTick()
    expect(dropdownLinks(w)).toHaveLength(3) // still 1 plan — re-seeded
    expect(w.text()).toContain("Q3 — Checkout revamp")
  })

  it("wires the dropdown .toml download to downloadSource with the active source and a .toml name", async () => {
    const w = mountApp()
    await dropdownLinks(w)[2].trigger("click") // Download .toml (1 plan → index 2)
    expect(downloadSource).toHaveBeenCalledOnce()
    const [src, filename] = (downloadSource as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(src).toBe(SAMPLE_PLAN)
    expect(filename).toBe("macroplan-q3-checkout-revamp.toml")
  })
})
