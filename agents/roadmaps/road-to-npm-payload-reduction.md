---
complexity: lightweight
status: ready
estate_growth_exempt: "Owner-instructed draft -> ready flip, 2026-08-24. Growth is +1 active_roadmaps and +0 open_blockers (this roadmap declares none). The flip is not new estate: the work was already sitting in the active tree, it was merely invisible to the metric because `status: draft` is excluded by collect(). That exclusion is a recorded defect, not a feature -- `agents/roadmaps/stubs/road-to-draft-status-ratchet-boundary.md` states it as \"the measured party controls whether its work enters the measurement boundary\" -- so this claim buys a metric that moved TOWARD the truth, not an estate that grew. Measured the same run: archiving the two completed drafts in this change offset +0, because neither was ever counted, which is the same defect seen from the other side and the reason no offset was available."
execution:
  mode: phase-checkpoints
---
# Road to npm payload reduction

> **Source:** the `packed_size_mb` re-baseline of 2026-08-24 (8.4 → 9.2,
> `src/config/pack-size-budget.json`). That is the fourth raise of this cap in
> twenty days — 6.4 → 6.9 → 7.8 → 8.4 → 9.2 — and each note names the same
> structural cause and defers it. The 2026-08-20 note promised in writing that
> its raise "buys the time to write one [a roadmap]"; a grep of
> `agents/roadmaps/` (active, `stubs/`, `later/`, `archive/`) found none. This
> file is that plan, so the next raise cannot be justified by the same
> unwritten promise.

## Goal

The published npm tarball ships only what a consumer install actually resolves
at runtime, and the `packed_size_mb` cap stops being a number that gets raised
every time it is reached. Finished means: the packed payload is measurably
below the cap with the headroom the budget file's own rule requires (~8 %), the
reduction was proven safe by a real global-install smoke test rather than by
reading imports, and the per-subtree verdict — ships / does not ship / needs a
built-output equivalent — is recorded per top-level root so the next reviewer
inherits the answer instead of re-deriving it.

## Context

Measured 2026-08-24 on a clean detached worktree with unbuilt `dist/`
(`npm pack --dry-run --json --ignore-scripts`, the conditions
`pack-size-budget.json` documents): 28.604 MB unpacked, 8.4305 MB packed,
2,753 entries.

| Root | Unpacked | Share | Files |
|---|---|---|---|
| `src/scripts/` | 16.384 MB | 57.3 % | 1,158 |
| `dist/agent-src/` | 8.040 MB | 28.1 % | 1,200 |
| `src/agent-src/` | 1.347 MB | 4.7 % | 116 |
| `dist/install/` | 0.961 MB | 3.4 % | 45 |
| `docs/guidelines/` | 0.672 MB | 2.4 % | 111 |
| `src/config/` | 0.487 MB | 1.7 % | 38 |
| everything else | 0.713 MB | 2.4 % | 85 |

`src/scripts/` is 57.3 % of the payload and is TypeScript source, which is why
it looks like the obvious cut. It is not obviously cuttable, and the evidence
is in the tree rather than in an argument:

- `src/cli/python/workspace_hosts.ts:180-191` records a real incident. Moving
  a table so that a shipped module imported it from `src/cli/python/` — a
  directory NOT in `files[]` — resolved fine in a checkout and crashed a
  global install with `ERR_MODULE_NOT_FOUND`. `prepack-check` caught it. The
  recorded fix was to keep the import pointing into `src/scripts/`, which IS
  in `files[]`.
- `src/server/routes/wizard.ts:136-137` invokes `bash
  src/scripts/install_anthropic_key.sh` and its openai twin **by path** at
  runtime, so at least part of the subtree is path-reachable from an install
  and not merely import-reachable.

So the lever is real and the naive form of it is known-broken. What is missing
is a per-subtree verdict, and nothing in the tree carries one.

The one candidate a previous note named — `src/scripts/ai_council/`, 0.903 MB,
worth 270 KB compressed (8.4305 → 8.1607, i.e. under the pre-raise cap with
239 KB to spare) — is still **undecided**, and this roadmap deliberately does
not decide it. `src/server/routes/wizard.ts:48` imports `apiOnQuotaView` from
`scripts/ai_council/transport_resolver.js`; whether that resolves to the TS
source under `src/scripts/` or to built output under `dist/` in a published
install is exactly the question Phase 1 answers empirically. Asserting either
answer from reading the import specifier is how a wrong verdict gets recorded
as evidence.

## Phase 1 — Establish the per-subtree verdict empirically

- [ ] **1.1 Build a repeatable global-install smoke harness.** `npm pack` a
      real tarball, install it globally into a throwaway prefix, and exercise
      the consumer surface: `agent-config --version`, `agent-config install`,
      `agent-config council:status`, `agent-config hooks:status`, the wizard
      boot, and one hook dispatch. Today the only automatic guard is
      `prepack-check.mjs` in the `prepack` script, which checks resolvability
      and not behaviour, so a trim that resolves but misbehaves is invisible.
      verify: the harness exits non-zero when `src/scripts/_lib/` is removed
      from `files[]` — sabotage the subtree first and watch it fail, because a
      harness never seen red has unknown sensitivity.
- [ ] **1.2 Bisect `files[]` per top-level subtree against that harness.** One
      exclusion at a time, harness after each: `src/scripts/ai_council/`,
      `src/scripts/hooks/`, `src/scripts/_cli/`, `src/scripts/mcp_server/`,
      `src/scripts/ai-video/`, `src/agent-src/`. Record ships / does not ship /
      needs-a-built-equivalent per subtree with the compressed delta.
      verify: a table in `agents/evidence/analysis/` naming every subtree, its
      verdict, its measured saving, and the harness run that produced it.
- [ ] **1.3 Answer whether `src/agent-src/` duplicates `dist/agent-src/`.**
      Two budget notes assert a partial duplication and neither measures it.
      Diff the two trees by content hash and report the overlapping bytes.
      verify: the overlap figure, with the file list, in the same evidence
      artifact.

## Phase 2 — Land the reductions Phase 1 proved safe

- [ ] **2.1 Apply the `files[]` exclusions with a verdict of "does not
      ship".** One commit per subtree so a regression bisects to one line.
      verify: harness green after each, and `check_pack_size` reports the
      measured drop.
- [ ] **2.2 For every "needs-a-built-equivalent" subtree, point the shipped
      importer at built output.** The import specifiers already end in `.js`;
      the work is making the emitted layout the resolution target and proving
      it in an install, not in a checkout.
      verify: harness green with the source subtree excluded.
- [ ] **2.3 Lower `packed_size_mb.max` to the measured figure plus ~8 %.** A
      ratchet that only ever moves up is not a ratchet. This step is what
      turns the reduction into a floor the next accretion has to respect.
      verify: `check_pack_size` green, and the new `max` is below 9.2.

## Phase 3 — Make the next merge-induced trip visible before it lands

- [ ] **3.1 Report the branch-vs-base packed delta on every pull request.**
      The 2026-08-24 trip was a MERGE artifact: `origin/main` measured 8.3911
      and the branch 8.4305, so neither side was over alone and no per-branch
      check could see it. A delta line makes the accretion legible while it is
      still small.
      verify: the number appears on a pull request that adds packed payload,
      and is absent on one that does not.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A trim resolves in CI and breaks a real global install | implementation | `prepack-check` verifies resolvability, not behaviour, and the recorded `ERR_MODULE_NOT_FOUND` incident was found by that guard rather than by a behavioural gate. A trim can pass every gate here and still break an install. | Phase 1.1 builds the behavioural harness FIRST and proves its sensitivity by sabotage before any trim is attempted. No exclusion lands before 1.1 is green-and-proven-red. | Phase 1 — Establish the per-subtree verdict empirically |
| 2 | The verdict is derived from import specifiers instead of measured | implementation | Reading `from '…/transport_resolver.js'` invites the conclusion that the TS source is unused. Whether it resolves to `src/` or to `dist/` in a published install is not decidable from the specifier. A wrong verdict recorded as evidence is worse than an open question. | Every verdict in 1.2 cites a harness run, never an import. The `ai_council` case is left explicitly open in Context for this reason. | Phase 1 — Establish the per-subtree verdict empirically |
| 3 | Phase 1 completes and Phase 2 never runs | product | This is the fourth time the reduction has been deferred. An evidence table with no exclusions applied is the same deferral with better documentation. | 2.3 lowers the cap, so the phase has an artifact a later reviewer can check. A Phase 1 that lands without Phase 2 leaves `max: 9.2` standing, which is the visible signal that it did not finish. | Phase 2 — Land the reductions Phase 1 proved safe |

## Acceptance Criteria

- [ ] AC-1 — Every top-level packed subtree over 0.5 MB carries a recorded
      ships / does-not-ship / needs-built-equivalent verdict, each citing a
      global-install harness run rather than a reading of an import.
- [ ] AC-2 — A global-install smoke harness exists, runs the consumer surface,
      and has been observed FAILING against a deliberately broken `files[]`.
- [ ] AC-3 — `packed_size_mb.max` is below 9.2 and carries ~8 % headroom over
      a fresh measurement, so the cap has moved down for the first time.
- [ ] AC-4 — The branch-vs-base packed delta is reported on pull requests, so
      the merge-artifact shape that caused the 2026-08-24 trip is visible
      before it reds a gate.
