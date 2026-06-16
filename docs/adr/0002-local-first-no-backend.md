# Local-first, no backend; TOML file is the portable source of truth

The Macroplan app is a static SPA (Vite + Vue + DaisyUI) with **no backend**. A Macroplan is authored as **TOML** in an in-app split editor, parsed on every keystroke. The live store is **localStorage** (an in-app library of named Macroplans); the **`.toml` file is the portable, durable, git-trackable source of truth**, moved in and out via Import/Export. Sharing is done by exporting the rendered plan as a **PNG image** (clipboard + download), not by hosting a URL.

We chose this over a server-backed app because the tool is a personal/team planning artifact that benefits from zero infrastructure, instant editing, and git-trackable plan files. A hosted URL was rejected for sharing because a client-only app has no data to serve unless the source is also shipped — image export sidesteps that entirely.

## Consequences

- **Durability rests on Export.** localStorage can be cleared; the `.toml` file is the real backup. This is a deliberate, watched tension (see DESIGN.md §8).
- **No multi-device sync.** Editing happens per-browser; moving a plan between machines means moving the `.toml`.
- **Shared snapshots lose hover content.** An exported image shows the status color but not the hover note; "what you see is what exports."
- Adding a backend later would be a significant shift, not a tweak — hence this is recorded.
