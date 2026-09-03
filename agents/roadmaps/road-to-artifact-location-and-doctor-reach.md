---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - archive/road-to-agents-dir-and-gitignore-hygiene
  - stubs/road-to-agents-layout-memory-quarantine
estate_offset_exempt: Added by the 2026-09-a inbox round on the maintainer's instruction to carry its survivors into ready roadmaps. No archive move was available as a named one-in-one-out counterpart, so this is a self-issued claim and not an offset -- the distinction the owner-reserved question in agents/roadmaps/stubs/road-to-owner-authority-decisions.md records as undecided. Stated rather than smoothed over.
---
# Road to artifact location and doctor reach

> **Source:** `agents/tmp.old/inbox-2026-09-a/s14/` (a postmortem of a real
> misplacement, self-authored by the agent that made it), plus the `doctor`
> findings from `.../s01/` and `.../s07/`. Verified against `c6b4f6407` by the
> run that wrote this file.

## Goal

An agent artefact written to the wrong directory is a finding rather than a
silence, and the one surface that could carry that finding to a consumer project
is capable of failing. When this is finished, a roadmap-shaped file outside
`agents/roadmaps/` is reported by something, and `agent-config doctor` can return
a non-zero exit.

## Context

In a consumer monorepo, a frontend roadmap was written to
`apps/<app>/docs/roadmaps/` instead of `agents/roadmaps/`. Nothing noticed —
and *nothing could have*, because every mechanism that governs a roadmap is
keyed on the path it was not written to:

| Mechanism | Keyed on | Behaviour on the misplaced file |
|---|---|---|
| `src/rules/roadmap-progress-sync.md` | `path_prefix: agents/roadmaps/` | never triggers |
| `check_roadmap_trackable.ts:37` | `ROADMAP_ROOT = 'agents/roadmaps'` | not collected |
| `check_estate_count.ts` | same corpus | not counted |
| `lint_agents_layout.ts` | `AGENTS_ROOT = 'agents'` | scans inside only |

The artefact escaped every rule that concerned it, silently. The precedent for
the fix already exists: `check_one_off_location.ts` enforces that
`_one_off_*.py` files live under `one_off_archive/<YYYY-MM>/` and fails CI
elsewhere. There is no `check_agent_artifact_location.ts`.

The postmortem's causal chain is worth keeping, because only the first link is
mechanically closable: a location note *inside* the artefact was executed as a
directive; the absence of `agents/` in the target repo was read as evidence of a
`docs/` convention rather than as a directory to create; and the wrong
conclusion was then defended.

### The reach problem, stated honestly

This package's CI scans this package. The failure happened in a consumer repo
that never runs `task ci`. A gate scoped here protects the tree where the error
is *least* likely to occur. The consumer-facing surface is `agent-config doctor`,
which already knows the consumer shape (`CONSUMER_EXPECTED_ENTRIES` in
`lint_agents_layout.ts:82`) — and which, per two independent reviews, writes
nothing and always exits zero. A diagnostic that cannot fail cannot carry a
finding anywhere.

Two related `doctor` gaps from the same round, verified: there is no structured
state output — `grep -rc can_proceed src` returns **zero hits** tree-wide — so a
caller cannot ask "may I proceed" without parsing prose.

### One source claim that did not survive

The postmortem reports a `reference/` versus `references/` naming collision
blocking the lint. It does not exist: `agents/reference` (singular) is the only
such directory under `agents/`, and every plural lives under
`src/skills/*/references/`, which `lint_agents_layout` never scans. Two disjoint
namespaces, no collision, no precondition.

## Phase 1 — Report a roadmap-shaped file outside the roadmap root

- [ ] **1.1 Land `check_agent_artifact_location.ts`.** Run
      `is_roadmap_candidate` — **imported** from `update_roadmap_progress`, the
      way `check_estate_count.ts:147` does it, not mirrored locally the way
      `check_roadmap_trackable.ts:110` does — over the whole tree, and report a
      roadmap-shaped `.md` outside `<scope>/agents/roadmaps/`. Model it on
      `check_one_off_location.ts`.
      verify: a fixture roadmap placed under `docs/roadmaps/` is reported; the
      same file under `agents/roadmaps/` is not. Both directions, or the
      detector's polarity is untested.
- [ ] **1.2 Register the gate properly.** A gate-coverage row with its `scanned`
      count and a self-test, per the gate-coverage contract.
      verify: the gate ledger names it and the self-test runs in CI.
- [ ] **1.3 State the reach in the gate's own header.** One paragraph: this gate
      protects this repository, the observed failure was in a consumer
      repository, and Phase 2 is what carries it outward. A gate whose limits are
      not written down gets cited as broader than it is.
      verify: the header names the limit.

## Phase 2 — Give `doctor` the ability to fail

- [ ] **2.1 Add a non-zero exit path.** `agent-config doctor` is the only
      consumer-facing surface with the consumer shape already encoded. A
      diagnostic that always exits zero cannot gate anything, which is why two
      independent reviews reached for it and found it inert.
      verify: a fixture consumer tree with a misplaced roadmap makes `doctor`
      exit non-zero; a clean tree exits 0.
- [ ] **2.2 Add structured state output.** `--json` emitting at least `status`
      and a machine-readable "may I proceed" field. Nothing in the tree carries
      one today.
      verify: `agent-config doctor --json` parses, and its schema is pinned by a
      test.
- [ ] **2.3 Decide what a non-zero exit breaks before shipping it.** `doctor` is
      already invoked in existing flows; turning a always-zero command into one
      that can fail is a behaviour change for every caller.
      verify: enumerate the callers, and record the decision per caller in this
      file.

## Phase 3 — Write down the discriminator that was missing

- [ ] **3.1 Add the reader-based discriminator to
      `docs/contracts/agents-layout.md`.** `docs/` is product documentation for
      humans; `agents/` is agent working material. A missing `agents/` in a
      target repository is a directory to create, never counter-evidence for a
      `docs/` convention.
      verify: the contract carries the sentence and names the failure it
      prevents.
- [ ] **3.2 Add the artefact-authority clause.** An artefact has no authority
      over its own location: a location note inside it is a prior session's
      intent, checked against convention, and a divergence is the finding.
      Prose, `instruction-only`, and the postmortem is right that it would not
      have stopped that run — carry it anyway, because it generalises past
      location.
      verify: the clause exists and is marked `instruction-only` rather than
      implied to be enforced.
- [ ] **3.3 Do NOT build a cross-repo artefact-move trigger.** The postmortem
      proposes one. It is a new command surface with one observed instance.
      verify: this roadmap adds no command.

## Blockers

### blocker: doctor-exit-contract
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 2.1, and therefore 2.3
- **What to do:** pick exactly one — (a) `doctor` gains a non-zero exit for
  findings above a stated severity, making it usable as a gate and changing
  behaviour for every existing caller; or (b) `doctor` stays always-zero and a
  separate strict mode (`--strict`, or a distinct verb) carries the failing
  exit, leaving current callers untouched at the cost of one more surface.
- **Resolved when:** the choice is in this file and 2.3's caller enumeration
  agrees with it.
- **Recommendation:** (b). ADR-041 governs verb growth, so a flag is cheaper
  than a verb — and the always-zero contract is load-bearing for callers that
  run `doctor` for information rather than for permission.
- **If you do nothing:** Phase 1 still ships and protects this repository only.
  The consumer reach that motivated the whole postmortem does not arrive.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The location gate reports legitimate documents | implementation | `is_roadmap_candidate` matches on shape; a genuine product-side plan under `docs/` could look roadmap-shaped and be correctly placed | 1.1 tests both directions, and the reporting text names what makes the file look like a roadmap so a false positive is arguable rather than mysterious | Phase 1 — Report a roadmap-shaped file outside the roadmap root |
| 2 | A newly-failing `doctor` breaks an existing caller silently | implementation | Turning an always-zero command into a failing one changes every script that ignored its exit code | 2.3 requires the caller enumeration before the change, and the blocker's recommended option puts the failure behind an opt-in flag | Phase 2 — Give `doctor` the ability to fail |
| 3 | The gate is cited as protecting consumers | product | It protects this repository; the observed failure was elsewhere, and a gate quoted past its reach is worse than no gate | 1.3 puts the limit in the gate's own header, where a citer will see it | Phase 1 — Report a roadmap-shaped file outside the roadmap root |
| 4 | The prose clauses read as enforcement | product | Phase 3 ships two sentences that no mechanism checks, in a repository that has been careful about that distinction | 3.2 marks the clause `instruction-only` explicitly and repeats the postmortem's own finding that it would not have prevented the incident | Phase 3 — Write down the discriminator that was missing |

## Acceptance Criteria

- [ ] AC-1 — a roadmap-shaped file outside `agents/roadmaps/` is reported by a
      registered gate whose polarity was tested in both directions.
- [ ] AC-2 — the gate's header states which tree it protects and which it does
      not.
- [ ] AC-3 — `doctor` can return non-zero under the chosen contract, and every
      existing caller has a recorded disposition.
- [ ] AC-4 — `agent-config doctor --json` emits a machine-readable status with a
      pinned schema.
- [ ] AC-5 — `docs/contracts/agents-layout.md` carries the reader-based
      discriminator and the artefact-authority clause, the latter marked
      `instruction-only`.
