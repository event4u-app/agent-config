# Capability matrix — what works on which host

> **Generated — still generated, not hand-maintained prose wearing a
> generated header.** Emitted by `src/scripts/generate_capability_matrix.ts`;
> do NOT hand-edit. Derived from the `generate_tools()` projection logic in
> `src/scripts/condense.ts` (each cell traces to a `generate_*` dispatcher
> call). Drift-checked in CI (`--check`).
>
> Until 2026-09-03 this header named two Python-era generator paths that
> have not existed since ADR-200 ended that era, so a reader checking the
> provenance of this table found dead paths and no way to tell whether
> anything still produced it. They are described rather than reproduced
> here, so every path this header names resolves.

Cells: **✅ native** (host consumes the artifact directly — symlink /
native dir) · **🔁 adapter** (projected through a host-specific
transform — `.mdc`, workflow, or an aggregated single file) · **— none**
(no generator emits this artifact for this host).

| Artifact | claude-code | claude-plugin | augment | cursor | windsurf | cline | gemini | copilot | claude-desktop |
|---|---|---|---|---|---|---|---|---|---|
| `rules` | ✅ native | — none | ✅ native | 🔁 adapter | 🔁 adapter | ✅ native | 🔁 adapter | 🔁 adapter † | — none |
| `skills` | ✅ native | ✅ native | ✅ native | — none | — none | — none | — none | — none | — none |
| `commands` | ✅ native | — none | ✅ native | 🔁 adapter | 🔁 adapter | — none | — none | — none | — none |
| `subagents` | ✅ native | — none | — none | 🔁 adapter | 🔁 adapter | 🔁 adapter | — none | — none | — none |
| `personas` | ✅ native | — none | ✅ native | ✅ native | — none | — none | — none | — none | — none |
| `user-types` | ✅ native | — none | ✅ native | ✅ native | — none | — none | — none | — none | — none |
| `hooks` | — none | ✅ native | — none | — none | — none | — none | — none | — none | — none |

## How to read this

- Projection is **intentionally asymmetric** — a `— none` cell is a
  design choice, not a bug. Skills project natively only where a host
  has a native skill surface; everywhere else the rules + commands
  carry the behaviour.
- `🔁 adapter` cells are real coverage through a host-native shape
  (Cursor `.mdc`, Windsurf workflows, the aggregated `GEMINI.md`).
- `†` marks an **install-time** surface the installer writes (e.g.
  `.github/copilot-instructions.md`), not the `generate_tools()` path —
  real coverage, different code path.
