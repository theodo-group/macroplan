// Default Macroplan shown on first load — exercises every state:
// on-time delivery, late delivery with slips, in-flight (green/orange/red),
// an overdue Feature, and a Milestone with unmet required Features.
export const SAMPLE_PLAN = `title = "Q3 — Checkout revamp"

# A Feature: start week, Original Estimate (the immovable baseline), then any
# Re-estimates, an optional Delivery, and an optional Learning / Status.
# Dates are TOML date literals; any day is snapped to that week's Monday.

[[feature]]
name = "Auth"
start = 2026-06-01
original = 2026-06-15
delivered = 2026-06-15          # on time → ◉
learning = "Spiking the OAuth flow first paid off — do discovery spikes earlier."

[[feature]]
name = "Payments"
start = 2026-06-01
original = 2026-06-15           # ◯ baseline
reestimates = [2026-06-29, 2026-07-13]   # two re-estimates → △ △
delivered = 2026-07-20          # after the baseline → ▲ late
learning = "Vendor lead time was the real constraint — derisk vendors up front."

[[feature]]
name = "Dashboard"
start = 2026-06-01
original = 2026-06-08           # already past 'now' and undelivered → overdue
status = "red"
note = "No recovery plan yet — needs an owner."

[[feature]]
name = "Search"
start = 2026-06-08
original = 2026-06-22
reestimates = [2026-07-06]      # re-estimated once, still in flight → △
status = "orange"
note = "Third-party search API is flaky; spike a fallback."

[[feature]]
name = "Notifications"
start = 2026-06-22
original = 2026-07-06
status = "green"

[[milestone]]
name = "MVP go-live"
week = 2026-07-06
requires = ["Auth", "Payments", "Dashboard"]
`
