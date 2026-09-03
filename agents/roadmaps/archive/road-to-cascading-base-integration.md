---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-merge-hotspot-drawdown
    relation: extends
    note: >
      That roadmap built the GENERATED / REMEASURED / AUTHORED split at
      sync_pr_branch.ts:238 and proved each class against a write site. Phase 3
      here extends exactly that classification into auto-resolution for the one
      class whose only correct resolution is "run the generator", and leaves the
      other two refusing. No execution dependency -- it is archived and complete.
  - slug: road-to-merge-surface-zero
    relation: extends
    note: >
      Shares src/scripts/sync_pr_branch.ts and its test file, and its own 1.1
      (already closed) extended the same GENERATED list this roadmap now acts
      on. Declared rather than called disjoint because that file overlap is
      real. Its merge-queue and observability half is deliberately NOT extended
      here -- AC-5 forbids both. Parked in later/, so no execution dependency.
  - slug: road-to-merge-confirmation-doctrine
    relation: disjoint
    note: >
      Shares the word "merge" and nothing else. That stub is about whether a
      direct "merge PR #123" is itself this turn's Hard-Floor confirmation -- a
      kernel-rule authority question. This roadmap never touches merge
      authorization, only which refs a branch integrates before a push. Verified
      by grep: it names none of sync_pr_branch, check_branch_freshness,
      install-hooks or resolveBase.
estate_offset_exempt: Added by the 2026-09-b inbox round on the maintainer's instruction to carry its survivors into ready roadmaps. No archive move was available as a named one-in-one-out counterpart, so this is a self-issued claim and not an offset -- the distinction the owner-reserved question in agents/roadmaps/stubs/road-to-owner-authority-decisions.md records as undecided. Stated rather than smoothed over.
---
# Road to cascading base integration

> **Source:** `agents/tmp.old/inbox-2026-09-b/s10/`. Of that round's fourteen
> units it was the one whose author read the existing tree before proposing:
> all four of its inventory claims verified as already-shipped, and the gap it
> found sits exactly where the request went past what exists. Re-verified
> against `c6b4f6407` by the run that wrote this file.

## Goal

A branch targeting something other than the default branch integrates both its
target and the default before it is pushed, and the sequence that makes a push
safe is executed by something rather than described in prose. When this is
finished, `resolveBase` returns an integration *set*, and the documented
freshness sequence has a caller.

## Context

The tree already carries almost all of this, which is why the roadmap is short:

| Capability | Carrier | Verified |
|---|---|---|
| Resolve the real base, forge-aware, and separate verified from unverified | `check_branch_freshness.ts:274` `resolveBase`, `:160` `askForgeForBase` | present |
| Classify conflicts GENERATED / REMEASURED / AUTHORED | `sync_pr_branch.ts:238` `classifyConflicts` | present |
| A substantial pre-push gate | `install-hooks.sh:24-155` | present |
| The mandatory freshness prose | `src/domains/git/pr/create/command.md:136` | present |

Three gaps remain, and only the first is structural.

**Gap A — one base, never two.** `sync_pr_branch.ts:292-318` returns
`{ base: string | null, how: string }`. The resolution order is `--base`
override, then the open PR's `baseRefName`, then `origin/HEAD` — an
**exclusive** chain. When a PR targets a release line or a stacked parent, the
default branch is never brought in, so the branch is current against its target
and arbitrarily stale against `main`. That is the single sentence the source
request contained and the tree does not answer.

**CLOSED.** `resolveBase` returns a `ResolveBaseResult` — an ordered set of
`{ref, reason}` entries plus a `policyStatus` — and whether the default branch
joins the set is a per-target policy read from the *target's own commit*. See
the resolved blocker below for the decision and `src/scripts/_lib/branch_convergence.ts`
for the trust boundary.

**Gap B — the correct sequence is model-carried.** `command.md:136` states the
obligation ("**MANDATORY on EVERY later push**") and nothing enforces it. An
ordinary `git push` bypasses `sync_pr_branch` entirely.

**Gap C — the base moves during the run.** Not hypothetical: `sync_pr_branch.ts:10`
records the measured failure — *"PR #1391: the base moved three times during one
run, the push was rejected."*

### What this roadmap deliberately does not build

The source proposed twelve phases and twenty-four PRs. Merge trains, a
server-side complement, an agentic semantic conflict resolver with a confidence
policy, `rerere`, and a dedicated observability layer are all answers to problems
this repository does not measure — `git grep rerere -- src/ scripts/` is empty,
and there is no recorded repeated-conflict corpus. The source's own framing is
the right one and is adopted: *consolidate and promote existing behaviour, not
create a parallel Git subsystem.*

The pre-push hook stays a **refusal** boundary, never a mutation boundary. The
source argues this itself and it is correct: a merge inside `pre-push` mutates
the tree at the moment the contributor believes their work is finished.

## Phase 1 — Make the base an integration set

- [x] **1.1 Return a set from `resolveBase`.** Target equals default → one entry,
      exactly today's behaviour. Target differs → default **and** target,
      de-duplicated by ancestry so an already-contained ref is not merged twice.
      verify: a fixture PR against a non-default base yields two refs, one
      against the default yields one, and a target that already contains the
      default yields one.
- [x] **1.2 Keep the `how` string per entry.** The existing single string
      explains a decision to a human; a set that loses its provenance is worse
      than the scalar it replaces.
      verify: each entry carries its own resolution reason, and the output names
      both.
- [x] **1.3 Integrate in a stated order.** Default first, then target, so a
      conflict surfaces against the broader base before the narrower one.
      verify: a two-ref fixture records the order in its output.

## Phase 2 — Give the documented sequence a caller

- [x] **2.1 Wrap the sequence in one invocable target.** Fetch → integrate the
      set → regenerate → verify → re-check freshness → push. `command.md:136`
      already specifies it correctly; the missing thing is something that runs it.
      verify: the target exists, and a dry run on a stale branch prints each step
      with its outcome.
- [x] **2.2 Do not merge inside `pre-push`.** The hook keeps refusing and
      pointing at 2.1's target. State this in the hook's own text so a later
      contributor does not "improve" it into a mutation.
      verify: `install-hooks.sh` carries the sentence; no merge command is added
      to the hook.

## Phase 3 — Auto-resolve exactly one conflict class

- [x] **3.1 Auto-resolve GENERATED conflicts by regenerating.** The
      classification already exists at `sync_pr_branch.ts:238`. For a path whose
      only correct resolution is "run the generator", refusing is ceremony.
      verify: a fixture conflict in a generated tree resolves by regeneration and
      the result is byte-identical to a clean regeneration from the merged
      source.
- [x] **3.2 Never touch REMEASURED or AUTHORED.** A measured baseline and a
      hand-written file have no single correct resolution; refusal is right there
      and stays.
      verify: fixtures in both classes still refuse, and the test fails if either
      is auto-resolved.

## Phase 4 — Bound the race that is already recorded

- [x] **4.1 Pin the base OID and re-check before pushing.** Three attempts; on
      the third, stop with the observed evidence rather than looping.
      verify: a fixture that moves the base between integration and push is
      retried and then reported, with the OIDs of each attempt in the output.
- [x] **4.2 No merge-train semantics.** The bound is a retry with a stated
      ceiling, not a queue.
      verify: the implementation adds no persistent state outside the run.

## Blockers

### blocker: cascade-default-inclusion-policy
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** 1.1
- **What to do:** pick exactly one — (a) always include the default branch in
  the set when the target differs, which is what the request asked for and which
  can pull unrelated `main` movement into a release-line PR; or (b) include it
  only when the target is behind the default by more than a stated threshold,
  which keeps release lines quiet at the cost of a number nobody has measured.
- **Resolved when:** the choice is recorded here and 1.1's fixtures match it.
- **Recommendation:** (a). It is the stated request, it needs no threshold, and
  a release-line PR that is stale against `main` is a real hazard rather than a
  cosmetic one — (b) trades a measurable property for an unmeasured constant.
- **If you do nothing:** Phase 1 cannot be specified, and Phases 2–4 all consume
  its output.
- **Decision:** **neither (a) nor (b) — a third option: an explicit per-target
  branch-convergence policy, read from the resolved PR target commit SHA.**
  Decided 2026-09-03 by AI council, members `anthropic/claude-sonnet-4-5` and
  `openai/codex-default`, standing in for maintainer sign-off under the
  maintainer's standing drain mandate.

  *Round 1 split on the offered fallbacks, and it was not a split on substance.*
  Both seats independently named the SAME third option as correct and picked
  opposite fallbacks only because the framing demanded one. Seat 1: *"Reviewer
  B's policy-based third option is strongest."* Seat 2: *"The correct third
  option is an explicit per-target branch-convergence policy based on repository
  intent, not commit distance."* Both rejected (b)'s commit-distance threshold as
  an unmeasured constant, which is the same objection the Recommendation above
  already carried.

  *Round 2 specified it, and the two seats converged on a near-identical design.*
  That specification is the decision, and 1.1 is built to it:

  1. **Where the policy lives.** Section `branchConvergence`, loaded
     **exclusively** from the resolved PR target commit SHA. The caller resolves
     and supplies `targetSha`; the loader never infers it from the working tree
     or a branch name. This is the load-bearing architectural call and both seats
     called it non-negotiable — reading policy from the PR head, the checkout, or
     an unpinned branch ref lets a reviewed change edit its own acceptance
     criteria. One seat: *"I would block any implementation reading policy from
     PR head, checkout state, or unpinned branch name."*
  2. **Shape.** `enabled: true | false`; `targets` keyed by **exact** branch
     name; `defaultBranch: include | exclude`. Unknown fields, invalid values and
     duplicate keys are rejected. Globs, pattern precedence, inheritance,
     configurable reason strings and any repository-wide fallback were cut
     explicitly for v1 by both seats.
  3. **Missing entry.** A non-default target with no exact entry **fails** with
     `MissingBranchConvergencePolicy(target="…")`. No partial set: neither
     inclusion nor exclusion is universally safe, and an absent entry must not
     manufacture repository intent. A default-branch target needs no entry.
  4. **One stable result type.** `{ entries: Array<{ref, reason}>, policyStatus }`
     with `reason` a fixed **closed** set and never user-written prose — both
     seats rejected free-form reasons as fixture churn plus a log-injection
     surface. Returning a bare array normally and an object when disabled was
     refused as coupling every consumer to ad-hoc type discrimination.
  5. **Kill switch.** `enabled: false` yields `policyStatus: "disabled"` and the
     target only, surfaced by the gate as **BYPASSED, never as passed** — a
     stderr warning alone is insufficient because callers discard stderr.
     *Activation criteria:* policy evaluation causes materially incorrect
     blocking; target-SHA configuration cannot be loaded reliably; an incident
     requires restoring pre-policy behaviour. *Removal criterion:* re-enable once
     the defect is fixed and the failing fixture passes.
  6. **Twelve fixtures**, the union of both seats' lists, in
     `tests/scripts/branch_convergence.test.ts`. Fixtures 7 (trust boundary), 8
     and 9 (the two negative directions) were called non-negotiable; each was
     observed red under a sensitivity probe before being accepted green.
- **Deviation from the specification, recorded rather than smoothed over:** the
  council named `.agent-settings.yml` as the policy file "the existing committed"
  one. It is not committed — `.gitignore:317` ignores it here and
  `src/config/gitignore-block.txt:56` writes that same ignore into every
  consumer's managed block, so `git show <sha>:.agent-settings.yml` returns
  nothing at every SHA in every repository this ships to. A SHA-pinned read needs
  a **tracked** file, so the path moved to `.branch-convergence.yml` and nothing
  else did: same section name, same shape, same exclusive read from the target
  SHA. The architecture the council called non-negotiable is unchanged; only a
  premise about where it could live turned out to be false.
- **Second recorded deviation — entry order.** Council § 4 and fixture 4 pin the
  **result** as target-first; step 1.3 pins the **integration** as default-first.
  Both are honoured because they are different orders of different things:
  `entries` is target-first (the target is the ref the PR merges into and the
  stable head of the contract) and `integrationOrder()` merges the default first
  so the broad conflict surfaces where it is cheapest to abandon. Neither is
  inferred from the other; both are asserted.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Cascading pulls unrelated default-branch movement into a release PR | product | A release line exists to be narrow; merging `main` into it can import exactly the changes the line was cut to exclude | The blocker forces the policy to be decided rather than assumed, and 1.3's ordering surfaces the broad conflict first where it is cheapest to abandon | Phase 1 — Make the base an integration set |
| 2 | Auto-resolving generated files hides a real conflict | implementation | A path classified GENERATED that is partly hand-edited would be silently overwritten by regeneration | 3.1 asserts byte-identity against a clean regeneration, so a path that does not reproduce exactly fails instead of resolving | Phase 3 — Auto-resolve exactly one conflict class |
| 3 | The new target becomes a second push path nobody uses | implementation | The prose path has existed and been unenforced; adding an executable one does not make anyone call it | 2.2 points the refusing hook at the target, so the moment the gate refuses, the contributor is handed the thing that fixes it | Phase 2 — Give the documented sequence a caller |
| 4 | The retry loop hides a persistent problem as a transient one | implementation | Three attempts against a base that moves constantly reports a race where the real finding is that the branch is too slow to land | 4.1 requires the per-attempt OIDs in the output, which makes a genuinely moving base distinguishable from a slow run | Phase 4 — Bound the race that is already recorded |

## Acceptance Criteria

- [x] AC-1 — `resolveBase` returns an ordered set with a per-entry reason, and a
      non-default-target fixture yields both refs.
- [x] AC-2 — one invocable target performs the full documented sequence, and the
      pre-push hook points at it without performing a merge itself.
- [x] AC-3 — GENERATED conflicts resolve by regeneration with byte-identity
      asserted; REMEASURED and AUTHORED still refuse, proven by a test that fails
      if they do not.
- [x] AC-4 — a moving-base fixture is retried at most three times and reports the
      OIDs of each attempt.
- [x] AC-5 — no `rerere` configuration, no queue state, and no new observability
      layer exists as a result of this roadmap.
