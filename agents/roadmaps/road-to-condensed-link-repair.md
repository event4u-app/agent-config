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

- [x] **1.1 Fix the ADR link depth.** **Landed; its `verify:` line is
      unsatisfiable as written and is superseded by the AC-2 ruling below (AI
      council, 2 of 2 convergent, 2026-08-22).** The broken link is gone and the
      citation now uses the established unlinked inline-code form. No link form
      can satisfy "resolves in `src/` and in `dist/agent-src/`", because `docs/`
      is in neither tree — see AC-2. `src/rules/source-confidentiality.md:94`
      links `../docs/decisions/ADR-236-one-artefact-one-layer.md`. From
      `src/rules/` that resolves to `src/docs/`, which does not exist, and in
      the projection to `dist/agent-src/docs/`, which does not either. It is
      off by one level in both trees.
      verify: the link target resolves from the file's own directory in `src/`
      and in `dist/agent-src/` after `task sync`.
      <!-- landed, verify NOT satisfiable as stated — owner ruling needed.
      The broken link is gone: line 94 now cites the ADR as
      `ADR-236 (`docs/decisions/ADR-236-one-artefact-one-layer.md`)`, the
      inline-code form the other 3 ADR references in `src/rules/` use
      (token-budget-discipline.md:143, architecture.md:58,
      decision-revisit-gate.md:191) and the form the sibling ADR-227 citation
      two lines below already uses. NO link form can satisfy the verify:
      `src/` and `dist/agent-src/` share only packs/profiles/rules/scripts/
      skills/templates as siblings, and `docs/` is in neither — measured, and
      `decision-revisit-gate.md:191` records the same fact ("`docs/decisions/`
      is projected into no agent-visible tree at all"). The alternative shape
      is `../../docs/decisions/...` plus a `validator_ignore` substring entry
      for `../../docs/`, the precedent security-sensitive-stop.md:129 and
      persona-governance.md use for non-projecting docs links: that resolves
      in `src/` but still not in the projection, and widens an allowlist. -->
- [x] **1.2 Fix the command cross-reference.** `src/rules/recurring-criticism.md:110`
      links `../domains/analysis-workbench/analyze/inbox/command.md`. That
      resolves in the source tree — `src/domains/` exists — and not in the
      projection, because `dist/agent-src/domains/` is not a projected path.
      Establish where a projected rule is supposed to reach a command and use
      that form; both rules are the only two files in the corpus carrying
      their respective shapes, so there is no convention to copy and one has
      to be read off the projector.
      verify: `./scripts-run src/scripts/check_condensed_paths` exits 0.
      <!-- done: read off the projector — `../commands/analyze/inbox.md`, the
      form all 11 other rule-to-command links in `src/rules/` use
      (role-mode-adherence.md:58, no-pr-progress-comments.md:48 …). Target
      `dist/agent-src/commands/analyze/inbox.md` exists; the gate exits 0
      (118 rules, 14 ignores audited). The source tree keeps commands under
      `src/domains/<pack>/…/command.md` and the projection flattens them to
      `commands/`, so the delivered path is the only followable one. -->
- [x] **1.3 Decide whether the gate is wired into remote CI.** **Decided: WIRE
      IT.** `task check-condensed-paths` now runs in
      `.github/workflows/consistency.yml`, beside `check-condensation` and before
      the regen steps, so both read the committed projection. Settled from the
      tree rather than by preference: five recorded instances lift a gate out of
      `task ci` for exactly this reason, and zero record the opposite. It currently is
      not, which is why a red on `main` went unnoticed. Wire it, or record
      why it stays local-only — silence is the one answer that reproduces the
      defect.
      verify: either the gate appears in a workflow and that workflow is
      green, or this roadmap carries the one-line reason it does not.
      <!-- decided: WIRE IT. `.github/workflows/consistency.yml` now runs
      `task check-condensed-paths` next to `check-condensation`, before the
      regeneration steps, so both read the committed projection. Settled by
      the tree, not by preference: five recorded instances lift a gate out of
      `task ci` for exactly this reason (consistency.yml:157-158 "Registered
      here and not only in `task ci`, because no workflow invokes `task ci`",
      :234, :487; rule-backstops.yml:249-251; skill-lint.yml:90,105;
      release-drift.yml:16-18), and there is no recorded instance of the
      opposite call. Consistency already triggers on `src/**` and
      `dist/agent-src/**`, so no path-filter change was needed; the gate is
      not in `gate-coverage.yml` and does not need to be (it emits no
      `scanned:` line, and CI-wired siblings check-index / check-archive-index
      are not registered there either). Open ONLY on the remote observation:
      the step is green locally and `lint_workflow_paths` /
      `lint_workflow_security` stay green, but "that workflow is green"
      requires the CI run on the PR that lands this. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

**Re-reviewed 2026-08-22**, because the plan changed materially: AC-2 closed as an
honest null, AC-2R added, AC-3 moved to pending-remote. Risk 2's own mitigation
("its verify requires the workflow to be observed green rather than merely
present") is the AC-3 question the council ruled on, so it could not be left
unexamined. Verdict on each existing row, and one row added:

- **Risk 1 held and its mitigation worked.** The command link was read off the
  projector — `dist/agent-src/commands/analyze/inbox.md` — and cross-checked
  against 11 of 11 sibling links, not tried until the gate went quiet.
- **Risk 2 held, and its mitigation is what forced AC-3 pending.** The gate was
  wired only after 1.1 and 1.2 landed, so it does not stop unrelated work; and
  "observed green" is honoured rather than asserted — locally green, remotely
  pending this PR's run.
- **Risk 3 held.** The register's own bet was that "closing this roadmap requires
  deciding rather than deferring". Both open decisions were decided, one of them
  against the criterion that asked for them.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The command link is fixed by guessing a path that happens to resolve | implementation | Both broken links are the only instances of their shape, so there is no convention to copy, and a path that satisfies the gate is not necessarily the path a consumer can follow | 1.2 requires reading the projector rather than trying paths until the gate goes quiet, and the verify checks resolution from the projected directory, not gate silence | Phase 1 — Repair the two links |
| 2 | Wiring the gate into CI blocks every PR | implementation | The gate fails on `main` today, so wiring it before the repair turns one silent defect into a hard stop on unrelated work | 1.3 is ordered after 1.1 and 1.2 by construction, and its verify requires the workflow to be observed green rather than merely present | Phase 1 — Repair the two links |
| 3 | The repair is treated as cosmetic and dropped | product | A broken markdown link reads as a nit, so the likely failure is that nobody picks this up and the gate stays red on `main` indefinitely, training the next developer to ignore it | The finding is recorded with its evidence and the gate-wiring question is part of the same phase, so closing this roadmap requires deciding rather than deferring | Phase 1 — Repair the two links |
| 4 | Closing AC-2 as a null hides a real agent-context gap | product | The unlinked-ADR convention is now recorded as correct, which makes it easy to stop asking whether agents NEED ADR contents. If a rule's behaviour depends on ADR reasoning, excluding ADRs from every projection is a delivery defect, and a criterion closed as impossible is the last place anyone would look for it | The closure text states explicitly that it does not settle the question, names it owner-decided and architectural, and records that option (c) — projecting `docs/decisions/` — was routed OUT of this roadmap rather than refused on merit | Acceptance Criteria |

## Acceptance Criteria

- [x] AC-1 — `./scripts-run src/scripts/check_condensed_paths` exits 0 on a
      clean checkout of `main`.
- [-] AC-2 — **CLOSED AS AN HONEST NULL: unsatisfiable under the projection
      contract.** No implementation can make the ADR target resolve from both the
      source and the projected location. Ruled by AI council, 2 of 2 seats
      convergent, 2026-08-22, option (d); option (b) — link plus a
      `validator_ignore` widening — was **rejected outright**, and option (c) —
      projecting `docs/decisions/` — was routed out of this roadmap as a separate
      distribution decision with a far larger blast radius. "A link-repair
      roadmap is the wrong venue for re-architecting the projection contract."
      **Why it is unsatisfiable, precisely.** `src/` and `dist/agent-src/` share
      only `packs`, `profiles`, `rules`, `scripts`, `skills`, `templates` as
      siblings. A `../../docs/…` link from `src/rules/` does resolve — to the
      repository-root `docs/` — so the impossibility is not that `docs/` is
      absent beneath `src/`; it is that the corresponding location is
      **unavailable from the projection**.
      **What AC-2 got wrong, which is the finding worth keeping.** It forced two
      different semantic classes into one uniform link requirement:
      · the command reference is an **agent-consumable navigational link** and
        must resolve in the projected tree;
      · the ADR reference is a **maintainer citation to material deliberately
        excluded** from the agent-visible tree.
      The 4-of-4 unlinked-ADR precedent corroborates that split; the filesystem
      and the distribution contract prove it.
      **Replacement criterion, approved by the same ruling:**
- [x] AC-2R — The command reference resolves from the agent-visible projection.
      ADR references whose targets are outside all agent-visible projections use
      the established unlinked inline-code citation form.
      `check_condensed_paths` reports no unapproved broken navigational links or
      ignores. **Met:** `dist/agent-src/commands/analyze/inbox.md` exists and is
      reached by `../commands/analyze/inbox.md`; the ADR citation is unlinked;
      the gate exits 0 (118 rules, 14 ignores audited).
      **Left open on purpose, and not by this roadmap:** whether ADRs are merely
      maintainer provenance or are *required agent context*. If rules depend on
      ADR reasoning for correct agent behaviour, excluding them from the
      distribution may be wrong — that is an owner-decided architectural
      question, and closing AC-2 here does not settle it.
      **The original criterion, kept verbatim so the null is auditable:** "Both
      links resolve from their own directory in `src/` and in `dist/agent-src/`
      after a sync."
      <!-- NOT satisfiable as written — owner ruling needed, criterion not
      weakened here. Measured: `src/rules/` and `dist/agent-src/rules/` share
      only packs/profiles/rules/scripts/skills/templates as siblings.
      `docs/` exists in neither, `commands/` is projection-only and
      `domains/` is source-only, so no single relative literal resolves in
      both trees for either target. The corpus resolves this by authoring the
      DELIVERED path (11/11 rule-to-command links) and by not linking ADRs at
      all (4/4 references). Both links are now followable from
      `dist/agent-src/rules/`, which the Goal names as the one that matters. -->
- [~] AC-3 — **PENDING REMOTE VERIFICATION.** The wiring is complete and green
      locally; "that workflow is green" is only observable from this PR's CI run,
      so the council (2 of 2, 2026-08-22) ruled it pending rather than met, and
      explicitly ruled that roadmap closure must not block on the merge. Closed
      by the successful run; if the workflow cannot run, the reason is recorded
      under this criterion's own explicit alternative.
      Original text: The gate is either wired into a green remote workflow, or this
      roadmap records the reason it stays local-only.
      <!-- Wired (see 1.3). Closes on the first green Consistency run of the
      PR that lands this change — the only half no local evidence can supply. -->
