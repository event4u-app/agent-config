---
complexity: lightweight
---

# Stub: road to a disposition for `agents/memory-quarantine/`

> **Stub — not active work.** Found by `/analyze:inbox` on 2026-08-23 while
> running the roadmap gates over an unrelated change. The finding is verified
> and live; the disposition needs a maintainer decision this run could not make.

## The finding

`task lint-agents-layout` fails on a clean checkout at `407915361`:

```
agents/memory-quarantine: unknown top-level directory in agents/ — add to
ALLOWED_SOURCE_DIRS in lint_agents_layout.ts (with rationale) AND to
docs/contracts/agents-layout.md.
```

The directory is **tracked** — three files, `historical-patterns.yml`,
`incident-learnings.yml`, `product-rules.yml` — landed by `803a39219`
("feat(memory): stamp the curated store and run the ladder once"). It appears
in neither `ALLOWED_SOURCE_DIRS` nor `docs/contracts/agents-layout.md`.

## Why it is not fixed here

The linter offers one remedy — whitelist it — and that is only correct if the
directory belongs at the `agents/` top level. It might not: `agents/runtime/` is
the typed home for machine-written state, and a quarantine store for curated
memory entries plausibly belongs under it, or under `agents/evidence/`. Choosing
between "whitelist where it is" and "move it where it belongs" is a decision
about the memory subsystem's layout, not a lint fix, and the party that found
the red is not the party that should make it.

## Why it is invisible

`check-roadmap-trackable` and `lint-agents-layout` both run in `task ci`
(`Taskfile.yml:353` and its neighbours) and in **no** GitHub workflow. `task ci`
also stops at an earlier gate, so neither red reaches the trunk — main's six
workflows were all green at `407915361` with both of these failing locally.
That is the same invisibility class the stub lifecycle exists to surface.

## Promotion criteria

- A decision on the directory's home: whitelisted at the top level with a
  written rationale, or relocated under an existing typed subdirectory.
- Whichever is chosen, `docs/contracts/agents-layout.md` and
  `ALLOWED_SOURCE_DIRS` agree with the tree in the same change.
- `task lint-agents-layout` exits 0, observed failing before the change.

## See also

- `src/scripts/lint_agents_layout.ts` — the gate and its allow-list.
- `docs/contracts/agents-layout.md` — the contract the allow-list mirrors.
- [`road-to-unowned-resume-conditions.md`](../road-to-unowned-resume-conditions.md) — sibling from the same run; both are conditions nobody owns.
