---
complexity: structural
status: active
source_analysis: 2026-07-25
---

# Road to Wiring Truth

> An external re-analysis of the last two PRs found the D1 defect one level up:
> **a gate whose wiring is weaker than the claim about it.** All three findings
> re-verified directly against `origin/main` @ `54ec73fc6`; one was worse than
> reported, one had a correction, one held exactly.
>
> One sentence: **the coverage number counts "named in a taskfile" as
> "can fail a build", and no workflow runs `task ci`.**

## Goal

Make the enforcement-coverage number mean what its headline says, wire the gates
that should have been in CI, and stop writing a self-referential counter by hand.

## Context — verified, do not relitigate

| # | Finding | Evidence | Correction to the review |
|:--|:---|:---|:---|
| **W1** | No workflow invokes `task ci` / `ci-strict` / `ci-fast`. Only `ci-cloud-bundle` and `ci-linear-digest` appear, and those are different, narrow tasks | `grep -rE 'task +ci(-strict\|-fast)?\b' .github/workflows/` → only comments + those two | — |
| **W1b** | Two workflow comments contradict each other. `skill-lint.yml:141,153` says twice *"which no workflow invokes"*. `release-drift.yml:15` says *"`task ci` gate already enforces the tag invariant on every main build"* — and uses that as the stated reason for having no `push:` trigger | both read | Held exactly. `skill-lint` is right; `release-drift` justifies a missing trigger with a gate that does not run |
| **W2** | `check_enforcement_coverage.ts` treats `taskfiles/` and `.github/workflows/` as equivalent `WIRING_DIRS`, so "named in a taskfile" resolves to `validator` = blocking | `:43-49` | — |
| **W2b** | Of the 13 validator-declaring rules: **4** have a workflow-reachable validator (transitively — `lethal-trifecta-guard` via the `lint_agent_security` umbrella), **9** are taskfile-only | computed with the resolver's own transitive logic, seeded from workflows only | The review said 2. Both are right on different units: **2 distinct scripts** (`check_condensation`, `skill_linter`) across 4 declarations, plus the umbrella case = 4 rules |
| **W3** | The five gates added by the last two PRs — `check_enforcement_coverage`, `lint_override_kernel_guard`, `check_adr_frontmatter`, `generate_subagent_floor`, `lint_output_slop` — appear in **zero** workflows | `grep -rl <each> .github/` → 0 for all five | — |
| **W4** | `check_safety_floor_untouched.ts` — the linter guarding the four safety-floor rules against modification — is referenced by **no** taskfile, workflow, or hook manifest. Only its own test and two prose docs | `grep -rl` across the tree | Held exactly |
| **W5** | `ledger-exec-verifiability` publishes "0 of **26** backed claims"; the live ledger holds **27**. The artefact's `measured_at` already records that the *first* publication ("25") was *"stale within a day of shipping — the drift class this very report describes"*. It drifted again, same class | `check_claims` → "27 backed"; artefact `backed_claims: 26` | The review said 27 and was right; a raw `grep -c '^- status: backed'` gives 28 because the entry-schema template counts — the canonical number is the checker's |

### What the reviewer got wrong about their own prior work, recorded

They read the reference object's hash chain backwards — praising the `prev_sha`
exclusion as a correctness detail when it is exactly what makes the chain
non-binding — and they treated `hardenedSpawnEnv()` as an existing fix when no
such symbol exists in this repo. Both were corrected by our verification pass in
the earlier rounds. Recording it because the parked-chain decision rests on the
first, and Phase 2 of the earlier roadmap was reframed because of the second.

## Phase 1 — Say which build

- [x] **P1.1 — Split the wiring corpus.** `WORKFLOW_DIRS` (`.github/workflows/`)
      and `TASK_DIRS` (`taskfiles/`, `Taskfile.yml`) stop being one bag. The
      transitive umbrella expansion stays — it was right, it was just seeded from
      both at once.
- [x] **P1.2 — Two resolutions, not one.** A validator reachable from a workflow
      resolves `validator`; one reachable only from a taskfile resolves
      `validator-local` and is reported separately. `validator-local` does not
      count toward the blocking headline, because the honest answer to "can it
      fail a build?" is "only a build someone starts by hand".
- [x] **P1.3 — Report both numbers and re-baseline.** The ratchet guards the
      workflow-blocking count; `validator-local` is published beside it, not
      folded into it.
- [x] **P1.4 — Correct the published claim.** The headline number changes and the
      claim text says why it changed, rather than quietly restating a smaller one.

## Phase 2 — Wire what should have been wired

- [x] **P2.1 — One consolidated workflow job** running the gates that belong in
      CI: the five from the last two PRs plus the nine taskfile-only validators.
      One job keeps the diff reviewable and the check list legible.
- [x] **P2.2 — `check_safety_floor_untouched` included.** A linter that guards
      the safety floor against modification, reachable from nothing, is the
      sharpest instance of the class this roadmap is about.
- [x] **P2.3 — A regression guard.** A test asserting that every rule declaring a
      `validator:` is workflow-reachable, so a gate cannot silently fall out of CI
      again. This is the piece the previous two PRs did not add.
- [x] **P2.4 — Fix the false comment.** `release-drift.yml:15` justifies having no
      `push:` trigger with a gate that no workflow runs. Correct the comment and
      state what actually enforces the invariant — or that nothing does.

## Phase 3 — Stop hand-writing a self-referential counter

- [x] **P3.1 — Derive the denominator.** The backed-claim count is mechanical;
      writing it into prose guarantees drift, twice demonstrated. Either the claim
      text omits it and points at the artefact, or the artefact's value is computed
      at generation time from the live ledger.
- [x] **P3.2 — Re-count and correct.** 27 backed today; the feasible set changes
      with it.
- [x] **P3.3 — Make the drift detectable.** A stale denominator currently passes
      because the pointer resolves. Whatever the fix, a divergence between the
      published count and the live ledger must fail rather than sit.

**Honest-null path.** If deriving the count proves to need more machinery than the
drift costs, say so and remove the number from the claim text entirely — a claim
that points at an artefact for its figures cannot go stale in prose.

## Acceptance criteria

- The coverage headline distinguishes "fails a CI build" from "fails a local run",
  and the published number is the former.
- Every rule declaring a `validator:` is reachable from a workflow, held by a test.
- `check_safety_floor_untouched` runs somewhere.
- No workflow comment asserts that a gate runs when it does not.
- The backed-claim denominator is derived or absent, never hand-written.
