---
complexity: lightweight
status: ready
tree_pin: 3445cf41d6
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Owner request of 2026-11-09 to park the session with every open item findable on main. The third look (ask-scope variant) reads NON-INFERIOR under the owner's exclusion reading, so the adapted form is a release candidate; its payload lives only on the pushed measurement branch `bench/variant-ask-scope-20261109`, and no other roadmap names the steps that would bring it to main. The two parked parents hold the measurements, not this landing work."
estate_offset_exempt: "No active roadmap is done or parkable in this change: the session is being parked by the owner, and archiving unrelated work to make room would hide it. The parents that hold the measurements are already in later/, so there is nothing to merge this into."
relates:
  - slug: road-to-a-start-as-light-as-the-field
    relation: extends
    note: "Its blocker start-cut-waits-on-full-vs-reduced stays open on the two gate decisions this file resolves."
  - slug: road-to-a-setup-that-decides-itself-carried
    relation: extends
    note: "Its 5.2 note records the third look; this file lands the candidate it names."
  - slug: road-to-a-session-start-under-the-host-limit
    relation: extends
    note: "Owns `check_session_start_budget` (≤80k); step 1.2 here must stay inside it or decide on it."
---
# Road to the adapted layer on main

> **Source:** owner decision of 2026-11-09 recorded in
> `agents/evidence/metrics/ask-scope-vs-full-layer-result-20261109.md`
> § Owner decision, 2026-11-09 (merged in PR #2946).

## Goal

The adapted start layer that measured NON-INFERIOR is on main, with
`check_startup_contracts` and `check_session_start_budget` both green, or the
owner has decided in writing why it does not ship.

## Where things stand

- **Payload:** two commits on the pushed branch `bench/variant-ask-scope-20261109`
  (`ced3e99b3b` contract stubs, `51add0fc53` scoped ask-first line). They
  touch four files only: `src/agent-src/startup-contracts/rules/downstream-changes.md`,
  `src/agent-src/startup-contracts/rules/think-before-action.md` and their
  `dist/agent-src/` projections (+26 lines). The branch base is older than
  main, so it is cherry-picked, never merged.
- **Gate 1:** `check_startup_contracts` fails on the adapted form.
- **Gate 2:** `check_session_start_budget` reads 81,544 of 80,000 chars
  (+1,544 over).
- The measured text is what was benchmarked. Any change to it in step 1.x
  is a new variant; see the decision rule under Phase 1.

## Phase 1 — clear the two gates

Decision rule for every step here: a fix that leaves the benchmarked
wording of the two contracts byte-identical needs no new measurement. A fix
that changes that wording is a new variant and needs a re-measure under a
fresh pre-registration before it can ship.

- [ ] **1.1 Diagnose `check_startup_contracts`.** Cherry-pick the two commits
      onto a branch from main, run
      `./scripts-run src/scripts/check_startup_contracts`, and record which
      assertion fails and why.
      verify: the failing assertion and its cause are written under this step.
- [ ] **1.2 Find the 1,544 chars.** Run `check_session_start_budget` on the
      cherry-picked branch and list candidates that cut ≥1,544 chars outside
      the two benchmarked contracts (other start-layer text), or the cost of
      raising the budget.
      verify: a table of candidates with char deltas under this step.
- [ ] **1.3 Owner decision on both gates.** <!-- blocked-by: adapted-layer-gate-decisions -->
      Present 1.1 and 1.2 as options (fix the check, fix the text, trim
      elsewhere, raise the budget, or do not ship), each marked whether it
      keeps the benchmarked wording.
      verify: the decision is recorded in the result file's owner section.

## Phase 2 — land it

- [ ] **2.1 Land the candidate.** Cherry-pick plus the fixes chosen in 1.3,
      regenerate projections (`task sync`, `task generate-tools`), both gates
      green, PR merged.
      verify: `check_startup_contracts` and `check_session_start_budget` exit 0
      on the merged head.
- [ ] **2.2 Close the parent blocker.** Update
      `road-to-a-start-as-light-as-the-field` (blocker
      `start-cut-waits-on-full-vs-reduced`) and the 5.2 note in
      `road-to-a-setup-that-decides-itself-carried` with the landing commit.
      verify: both notes cite the merge commit.

## Blockers

### blocker: adapted-layer-gate-decisions

<!-- asked: 2026-11-09 | record: agents/evidence/metrics/ask-scope-vs-full-layer-result-20261109.md -->

- **Status:** open, raised 2026-11-09 with the owner's exclusion reading.
- **Class:** 3 — human-only. A ship decision on a benchmarked default is the owner's; steps 1.1 and 1.2 prepare the options and are agent work.
- **Owner:** the repository owner.
- **Blocks:** 1.3, and through it Phase 2.
- **What to do:** run 1.1 and 1.2, then put their options to the owner in one numbered block.
- **Resolved when:** the owner section of the result file names the chosen
  path for both gates.
- **Recommendation:** run 1.1 and 1.2 first; a decision without the diagnosis
  is a guess.
- **If you do nothing:** the shipped start layer stays the reduced form that
  read INFERIOR in the first look.

## Acceptance Criteria

- [ ] AC-1: Main carries the adapted contracts with both gates green, or the
      owner's written decision not to ship them.
- [ ] AC-2: Any wording change to the benchmarked contracts is backed by a new
      pre-registered measurement before it lands.
