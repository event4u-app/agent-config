---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to condensed-link repair

> **Source:** `check_condensed_paths` fails locally on `main` with two
> `body-link-missing` findings. Discovered 2026-08-21 while running `task ci`
> on an unrelated branch; the two files are byte-identical to `main`, so the
> failure is pre-existing and not introduced by that branch. It is recorded
> here rather than fixed there because neither file is in that branch's
> subject and one of the two fixes needs a convention decision.

## Goal

`check_condensed_paths` passes on a clean checkout, and the two rules that
carry a broken cross-reference point at a target that resolves in **both** the
source tree and the projection. Finished means the gate is green and the two
links are followable from `dist/agent-src/rules/`, where a consumer actually
reads them.

## Why this was invisible

The gate runs in `task ci` but appears in **no** GitHub workflow, so remote CI
is green while the tree carries the defect. That is the more interesting half
of this finding: a link a consumer cannot follow ships, and the only thing
that would have caught it runs on a developer machine. Whether the gate should
be wired into CI is the second question this roadmap answers, and it is a
question, not a foregone conclusion — a local-only gate that fails on `main`
would block every PR the moment it is wired.

## Phase 1 — Repair the two links, then decide about the gate

- [ ] **1.1 Fix the ADR link depth.** `src/rules/source-confidentiality.md:94`
      links `../docs/decisions/ADR-236-one-artefact-one-layer.md`. From
      `src/rules/` that resolves to `src/docs/`, which does not exist, and in
      the projection to `dist/agent-src/docs/`, which does not either. It is
      off by one level in both trees.
      verify: the link target resolves from the file's own directory in `src/`
      and in `dist/agent-src/` after `task sync`.
- [ ] **1.2 Fix the command cross-reference.** `src/rules/recurring-criticism.md:110`
      links `../domains/analysis-workbench/analyze/inbox/command.md`. That
      resolves in the source tree — `src/domains/` exists — and not in the
      projection, because `dist/agent-src/domains/` is not a projected path.
      Establish where a projected rule is supposed to reach a command and use
      that form; both rules are the only two files in the corpus carrying
      their respective shapes, so there is no convention to copy and one has
      to be read off the projector.
      verify: `./scripts-run src/scripts/check_condensed_paths` exits 0.
- [ ] **1.3 Decide whether the gate is wired into remote CI.** It currently is
      not, which is why a red on `main` went unnoticed. Wire it, or record
      why it stays local-only — silence is the one answer that reproduces the
      defect.
      verify: either the gate appears in a workflow and that workflow is
      green, or this roadmap carries the one-line reason it does not.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The command link is fixed by guessing a path that happens to resolve | implementation | Both broken links are the only instances of their shape, so there is no convention to copy, and a path that satisfies the gate is not necessarily the path a consumer can follow | 1.2 requires reading the projector rather than trying paths until the gate goes quiet, and the verify checks resolution from the projected directory, not gate silence | Phase 1 — Repair the two links |
| 2 | Wiring the gate into CI blocks every PR | implementation | The gate fails on `main` today, so wiring it before the repair turns one silent defect into a hard stop on unrelated work | 1.3 is ordered after 1.1 and 1.2 by construction, and its verify requires the workflow to be observed green rather than merely present | Phase 1 — Repair the two links |
| 3 | The repair is treated as cosmetic and dropped | product | A broken markdown link reads as a nit, so the likely failure is that nobody picks this up and the gate stays red on `main` indefinitely, training the next developer to ignore it | The finding is recorded with its evidence and the gate-wiring question is part of the same phase, so closing this roadmap requires deciding rather than deferring | Phase 1 — Repair the two links |

## Acceptance Criteria

- [ ] AC-1 — `./scripts-run src/scripts/check_condensed_paths` exits 0 on a
      clean checkout of `main`.
- [ ] AC-2 — Both links resolve from their own directory in `src/` and in
      `dist/agent-src/` after a sync.
- [ ] AC-3 — The gate is either wired into a green remote workflow, or this
      roadmap records the reason it stays local-only.
