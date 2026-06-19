# Macroplan

A **Macroplan** is a week-by-week plan that keeps the receipts: what we promised to deliver, when it actually landed, and what the gap taught us — a simpler cousin of a Gantt chart whose purpose is not just scheduling but _learning_.

## Language

**Macroplan**:
A week-by-week plan that keeps the receipts on the **Features** we promised: when each actually landed, and what the gap taught us.
_Avoid_: Gantt, roadmap, timeline

**Feature**:
A unit of delivery with a start week, an **Original Estimate**, optional **Re-estimates**, and (eventually) a **Delivery**.
_Avoid_: task, ticket, story, epic

**Original Estimate**:
The first committed delivery week for a Feature. The immovable baseline against which on-time vs. late is judged. Rendered `◯` while unmet.
_Avoid_: target, deadline, due date

**Re-estimate**:
A revised, later delivery week recorded when a Feature will miss a prior estimate. A visible slip; it never moves the Original Estimate baseline. Rendered `△`.
_Avoid_: reschedule, new deadline

**Delivery**:
The week a Feature was actually completed. On-time (delivered on/before the Original Estimate) renders `◉`; late renders `▲`.
_Avoid_: completion, done date, release

**Milestone**:
An external event or date that explicitly names a set of Features that must be delivered by it. Rendered as a labelled vertical line across the plan. Carries no rolled-up status of its own — whether it will be hit is read off its Features.
_Avoid_: deadline, release, gate

**Learning**:
A free-text takeaway captured against a Feature once it is delivered — what this delivery taught us to do better next time. Shown in a persistent trailing column per row; empty for in-flight Features.
_Avoid_: retro note, lesson, postmortem

**Status**:
A Feature's _current_ delivery confidence (a snapshot, overwritten each review): **on-track** (all good), **at-risk** (in trouble but we have a plan), **off-track** (in trouble and we have no plan). May carry a comment. Applies only while in-flight; once delivered, the **Learning** takes over and the Status is dropped. An overdue Feature (past its latest estimate, not delivered) is expressed through an at-risk/off-track Status, not a dedicated symbol.
_Avoid_: health, RAG, risk

**Week**:
A column of the plan: one real calendar week, identified and labelled by the date of its first workday (Monday). Columns run contiguously from the earliest Feature start to the last marker or Milestone — empty weeks in between are still drawn. An optional authored **start**/**end** widens this span with lead-in or trailing empty Weeks; it only ever extends the range, never narrowing it or hiding a Feature.
_Avoid_: column, period, sprint

**Now line**:
A vertical line marking the current week across the whole plan — the at-a-glance "where are we right now".
_Avoid_: today marker, cursor

**Library**:
The collection of saved **Macroplans** held in the browser's localStorage — the live store. Always holds at least one Macroplan; durability rests on exporting a Macroplan's `.toml` (per ADR-0002), not on the Library itself. Carries no status of its own.
_Avoid_: workspace, project, file list

## Symbols

- `┣` start of a Feature's bar
- `━` continuation of the bar
- `◯` Original Estimate, not yet delivered
- `◉` delivered on time (on/before Original Estimate)
- `△` Re-estimate (a slip to a later week)
- `▲` delivered late (after Original Estimate)

## Relationships

- A **Macroplan** contains a flat, author-ordered list of **Features** (typically ordered by start **Week**) and many **Milestones**. There is no grouping/workstream concept.
- The **Library** holds many **Macroplans**, exactly one of which is active (shown in the editor and grid). Each is identified internally by a stable id and labelled by its **title**.
- A **Feature** has exactly one **Original Estimate**, zero or more **Re-estimates**, at most one **Delivery**, and at most one **Learning**.
- A **Milestone** explicitly names the **Features** required by it; a Feature may be required by zero, one, or several Milestones, and a Feature may be in the plan without belonging to any Milestone.
- On-time vs. late is judged against the **Original Estimate**, never a **Re-estimate**.

## Example dialogue

> **PM:** "Feature C had a `◯` in W3 but we slipped — put a `△` in W5."
> **Dev:** "And when it actually shipped in W6, it's `▲` late, because we judge against the original W3 `◯`, not the W5 re-estimate."
> **PM:** "Right. The slip and the late delivery are both visible — that's the **Learning**."
