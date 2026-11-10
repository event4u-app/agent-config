---
complexity: structural
status: later
review_by: 2026-12-10
tree_pin: ada1f46a85
entry_condition:
  what: "a free active slot (8 of 25 active on 2026-11-10) and an implementer; 2.8 is dated and does not wait for the slot"
  when: "now — Phase 1 is a day of work and every item has been re-reported for two or more releases"
  who: implementer
estate_growth_exempt: "+1 later_roadmaps on 2026-11-10, round inbox-2026-11-wo: gate residues an external review re-reports release after release. Searched agents/roadmaps/*.md, later/ and stubs/ with grep -rlF for `major_surface`, `removedDefaultAssets`, `consumer_impact`, `approvalsAtBase`, `bypass record`, `WIP_CAP`, `hook-bundle-budget`, `credential`, `review/changes`, `ci_mirror`: the residues of records-that-match-their-code 3.1/3.4 sit behind closed steps; the no-verify parser is later/road-to-a-hard-floor-the-shell-cannot-talk-past 1.3, which this file does not duplicate; no roadmap owns the rest. Parked, not active, per the owner directive of 2026-10-24."
execution:
  mode: phase-checkpoints
relates:
  - slug: later/road-to-a-hard-floor-the-shell-cannot-talk-past
    relation: disjoint
    note: "Owns the shell segmenter that closes the wrapper bypass (1.3). 1.1 here only makes the guard's header and the release notes say what it does not catch until then; it changes no parser."
  - slug: later/road-to-records-that-match-their-code
    relation: extends
    note: "Its 3.1 (grant approval) and 3.4 (impact floor) are closed; 2.1 and 2.2 here are the residues the review found in those checks."
  - slug: later/road-to-typed-grants-that-persist
    relation: disjoint
    note: "Owns the grant object of ADR-260. 2.2 here tightens the existing directive citation and builds no grant object."
---

# Road to gates that check what they claim

> **Source:** `agents/tmp.old/inbox-2026-11-wo/` — an external review package on
> releases 20.0.0 and 20.2.0 and an owner-side bench feedback chat. Drafted
> against `main@ada1f46a85` on 2026-11-10. Every reading marked *(executed)* was
> re-run there.

## Goal

Every gate an external review has re-reported for two or more releases either
checks what its name and its header claim, or its header and the release notes
say exactly what it does not check.

## Context

- **`block-no-verify`** is `fail_closed` and blocking, yet `env …`,
  `HUSKY=0 sh -c`, `bash -c`, `/usr/bin/git -c core.hooksPath`, `command`,
  `nice`, `timeout` and `sudo` all pass it (*executed*: each exits 0, plain
  `--no-verify` exits 1). The header at `block_no_verify.ts:24-31` names only
  runtime-built words. Reported on 20.0.0 and on 20.2.0, graded P1 there.
- **The major detection** fires on any `D` under `src/skills/`, including evals,
  and ignores the old path of an `R` (`_lib/major_surface.ts:203-205`, `:232`).
  Its comment at `:184-191` still says it cannot produce a false negative.
  `check_default_asset_removal.ts:52-60` already has the right predicate.
- **The impact floor** is switched off for the whole span by one unrelated
  recorded trailer (`_lib/consumer_impact.ts:221-223`). It is latent today: 0
  trailers in both 20.x spans. Graded P1.
- **The grant citation** checks only that the cited directive exists at the
  merge-base, not that it names the grant (`standing-payload-delta.yml:349-363`),
  and the check now lives in two copies. Graded P2.
- **Kernel-gated merges without a bypass record:** #2816, #2921, #2925 and #2949
  have no entry under `bypass-records/`. #2816 does carry an owner override in
  its ratification record (`ratifications/web-launch-write-time-20261102.md:211-216`),
  which the review missed, but no check reads that section.
- **Shrink-only ceilings:** `hook-bundle-budget.json` has `max_bytes 1594900`
  with `shrink_only: true`, raised seven times since 2026-11-01. `WIP_CAP = 25`
  (`_lib/estate_wip.ts:8`) is changeable in the same commit as the directive
  that justifies it.
- **`/review:changes`** diffs untracked files including a non-ignored `.env`
  (`review/changes/command.md:78-99`).
- **CLAIMS:** a `backed` row stays backed after its raw data leaves the tree, and
  one cited pre-registration (`d086acc2d6`) is reachable only from an unmerged
  branch.
- **CI mirror:** the mirror cut post-push-only gates from 295 to 23. On
  2026-11-10 it also reported a CI failure that was only stale gitignored
  `.claude/skills/` files, which passed on the re-run. Its agreement with real CI
  outcomes has never been measured.

## Phase 1 — Headers and notes say what is not checked

- [ ] **1.1 Declare the wrapper gap.** `block_no_verify.ts`'s header lists every
      wrapper form above as not caught, and the next release's Known limitations
      names the gap for 20.0.0 through 20.2.0. No parser change: that is the
      hard-floor roadmap's 1.3.
      verify: the header names each of the eight forms, and a test runs each one and asserts the documented result.
- [ ] **1.2 The major detection uses the right predicate.** `major_surface`
      reuses `removedDefaultAssets` (an `R` counts its old path, and evals and
      checklists do not count), and the false comment goes. Widening it to every
      consumer-facing name is the owner's scope call (decision below).
      verify: a test where an eval deletion stays minor and a skill rename is major.

## Phase 2 — Checks that read what they name

- [ ] **2.1 Impact floor per commit.** A commit without a trailer is floored on
      its own paths, whatever another commit in the span records.
      verify: the review's probe (a hook commit without a trailer plus a docs commit with `Consumer-Impact: none`) reads `action`.
- [ ] **2.2 A cited directive names the grant.** Both copies of the check require
      the directive at the merge-base to name the grant id, and an amendment is
      read at the merge-base too.
      verify: a test where a directive that exists but names another grant is refused in both copies.
- [ ] **2.3 A red kernel merge is reported red.** A merge whose kernel-gated
      check was red and which has neither a bypass record nor a recorded owner
      override is reported after the fact. Backfill records for #2816, #2921,
      #2925 and #2949.
      verify: replayed over the last 30 merges, the check names exactly the merges without either record.
- [ ] **2.4 Ceilings move only on a named value.** A raise of a shrink-only
      ceiling or of `WIP_CAP` needs a directive at the merge-base that names the
      new value.
      verify: a test where a raise in the same commit as its directive is refused.
- [ ] **2.5 The review skips credential files.** `/review:changes` lists `.env`
      and other credential-shaped untracked files as "not diffed (credential
      file)".
      verify: a fixture tree with an untracked `.env` produces that line and no diff of it.
- [ ] **2.6 A backed claim has reachable evidence.** A CLAIMS row reads `backed`
      only while its raw data and cited commits are reachable from `main`.
      The staleness check reads the evidence clauses too, not only the
      `claim:` line (`_lib/claims_stale_verified.ts:24-31`; the shadow-bar
      claim at `docs/CLAIMS.md:1391` was never flagged).
      verify: a test where a row citing an unreachable commit reads `unbacked`, and one whose evidence clause is stale is flagged.
- [ ] **2.7 The mirror measured against CI.** For 30 consecutive pushes, record
      the mirror's verdict per job beside CI's. Then name the false-greens and
      false-reds, including the stale-bridge read of 2026-11-10.
      verify: an artefact under `agents/evidence/analysis/` listing 30 head SHAs, the mirror's and CI's verdict per job for each, and the false-green and false-red counts.
- [ ] **2.8 The #2768 bypass review.** The council review of the #2768 bypass is
      due 2026-11-14 under the standing bypass directive.
      verify: `agents/evidence/council/bypass-2768-review-*.md` exists, dated on or before 2026-11-14.
- [ ] **2.9 An owner decision is closed by the owner.** An owner-class decision
      that a run wrote into a PR body blocks that PR's merge until it is
      answered, and a delegation quoted only in an agent-written file does not
      count as the owner's (owner-reserved D5 of the archived
      run-the-invocation-already-answered roadmap was closed that way).
      verify: a test where a PR body carrying an unanswered owner decision is refused at merge, and one where the answer is recorded passes.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| C1 | destructive-owned | agent (closure, round inbox-2026-11-wo) | False positive: "merge-base" names the revision a check reads. No step merges, pushes, deletes or force-writes anything. | typed-op:53 | a step gains an action on a remote |
| C2 | destructive-owned | agent | Same: 2.2 changes what an existing check reads at the merge-base. | typed-op:91 | as C1 |
| C3 | destructive-owned | agent | Same: 2.3 reports merges after the fact and writes records; it never merges. Each backfilled record says it was written after the fact (Risk 2). | typed-op:95 | as C1 |
| C4 | destructive-owned | agent | Same: 2.4 adds a refusal to a ceiling change; it lowers or raises nothing itself. | typed-op:100 | as C1 |
| C5 | deterministic | agent | 2.7's verify names its contents: 30 head SHAs, both verdicts per job, both counts. | unfalsifiable-verify:111 | — |
| C6 | contested-technical | agent | AC-1's "or" applies to 1.1 alone; every Phase 2 item becomes a check with a test. | unpicked-alternative:139 | — |
| D1 | owner | owner | Widen the major detection to every consumer-facing name, beyond `removedDefaultAssets`? | 1.2 | open, asked in round inbox-2026-11-wo |
| D2 | owner | owner | OQ-56: does the standing bypass directive allow `--admin`, and is a deny hook built? (`agents/owner-questions.md:88`) | 2.8 context | open since 2026-11-01 |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A header fix read as a guard fix | product | 1.1 could be cited as closing the bypass | The step says in its own text that it changes no parser; the gap stays open on the hard-floor roadmap | Phase 1 — Headers and notes say what is not checked |
| 2 | A backfill that rewrites history | implementation | 2.3's records could be written as if they had existed at merge time | Each backfilled record carries its creation date and says it is written after the fact | Phase 2 — Checks that read what they name |
| 3 | A ceiling check that blocks the owner | product | 2.4 could refuse a raise the owner made by hand | An owner-written directive at the merge-base is the one input it accepts | Phase 2 — Checks that read what they name |

## Acceptance Criteria

- [ ] AC-1: Each gate named under Context either checks what it claims, with a
      test, or its header and the release notes say what it does not check.
- [ ] AC-2: None of these items arrives in the next external review as unchanged.
