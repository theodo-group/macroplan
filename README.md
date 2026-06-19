# Macroplan

A week-by-week plan that keeps the receipts on what a team promised to deliver — a simpler cousin of a Gantt chart whose point is not just scheduling but learning from _how our estimates held up over time_.

Each feature reads left-to-right as a story: where it started, what we first promised, every time it slipped, and when it actually shipped — judged honestly against the **first** estimate, never a moved goalpost.

```
        Jun02  Jun09  Jun16  Jun23  Jun30  Jul07  Jul14
Auth     ┣━━━━━━◉                                          🟢
Payments ┣━━━━━━◯━━━━━△━━━━━△━━━━━▲                        🟠  vendor slipped
Dashboard              ┣━━━━━◯                             🔴  no recovery plan
                                    │ MVP go-live
                                    now
```

**Symbols:** `┣` start · `━` continuation · `◯` original estimate (unmet) · `◉` delivered on time · `△` re-estimate (slip) · `▲` delivered late.

## Status

**Feature-complete** against the [design](DESIGN.md) and covered by tests — TOML authoring with live reload, a **library** of named plans, the full week × feature grid render, derived on-time/late classification, milestones, and PNG + `.toml` export all work client-side.

## How it works

- Author a plan as **TOML** in an in-app split editor (re-rendered on every keystroke).
- The view is a **CSS-Grid** week × feature layout with the symbol vocabulary, real status colors (🟢/🟠/🔴 with hover notes), a "now" line, sticky feature-name and week-axis panes, and a trailing **Learning** column.
- On-time vs. late is **derived** by the app against the Original Estimate — you never type "late".
- **Milestones** are vertical lines tied to an explicit list of required features.
- Keep a **library** of named plans in localStorage and switch between them; **export** any plan as a `.toml` file, or the rendered view as a **PNG** to share into Slack or a deck.
- Stack: Vite + Vue 3 + DaisyUI · `smol-toml` (parse) · `html-to-image` (export). Static SPA, no backend.

## Documentation

| Document                                                                                         | What it covers                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [CONTEXT.md](CONTEXT.md)                                                                         | **Ubiquitous language** — the glossary: Macroplan, Feature, Original Estimate, Re-estimate, Delivery, Milestone, Week, Now line, Learning, Status, and the symbol legend                                     |
| [DESIGN.md](DESIGN.md)                                                                           | **Goal-driven design (QFD)** — goals, functions, the Goal→Function→How→Component cascade, the House/Roof matrices + rendered House of Quality, critical performance budget, trade-offs, and watched tensions |
| [docs/adr/0001-original-estimate-as-baseline.md](docs/adr/0001-original-estimate-as-baseline.md) | Why on-time/late is judged against the **Original Estimate**, never a re-estimate                                                                                                                            |
| [docs/adr/0002-local-first-no-backend.md](docs/adr/0002-local-first-no-backend.md)               | Why the app is **local-first with no backend**, and TOML is the portable source of truth                                                                                                                     |
