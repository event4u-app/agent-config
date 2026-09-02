---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-publication-integrity-hard-fail
    relation: extends
    note: >
      Same shape as its sibling: a rule that claimed an enforcer it did not
      have. That one was the release head, this one is source comments.
estate_offset_exempt: "Adds one active roadmap with no offsetting disposal, and none is available: the active roadmaps all carry open steps, and the 2026-08-24 estate council refused to pick among them because no mechanical evidence identifies the least valuable one. The authorization is the maintainer instruction that produced this work — harden the package so the comment defect cannot recur, in a worktree, with a PR at the end. The file exists because that instruction's remainder is real and must not be carried in prose: a self-test for the new gate, and the kernel-rule frontmatter that still names an enforcer which cannot see a source file."
estate_growth_exempt: "Covers the growth the offset half does not, and it is TWO metrics rather than one. concern_count 55 -> 56: `comment-discipline` is the write-time half of the same obligation, and its admission row in agents/decisions/concern-admissions.jsonl answers all five questions including why extending `edit-shape` was refused — that concern fires once per session by design, and the measured failure was 41 files each carrying the defect. active_roadmaps +1: this file. Both are the cost of closing a defect measured at 509 German comment lines and 21 report- or provenance-shaped comments across 41 of 45 changed source files, on two rules that between them named a `.md`-only validator and no validator at all."
---
# Road to comment-enforcement completion

> **Source:** the maintainer instruction of 2026-09-02 and the change it
> produced (`lint_code_comments`, the `comment-discipline` concern). Every
> number here is re-derived against the tree, not carried from that session.

## Goal

The comment-discipline enforcement is complete rather than shipped: the new
gate proves it DISCRIMINATES by its own self-test rather than only by external
fixtures, and the kernel rule that names a `.md`-only validator for a
source-file clause either names a real one or says plainly that it does not.

## Phase 1 — the gate proves its own discrimination

- [x] **1.1 Give `lint_code_comments` a `--self-test`.** `gate-coverage.yml`'s
      own ratchet says a newly registered gate must adopt or exempt, and the
      distinction it draws is real: an enforced `scanned:` floor proves a gate
      read something, only a self-test proves the reading changes the verdict.
      The cases exist already as vitest fixtures — the work is exposing them
      through `_lib/gate_self_test.ts` so the gate answers for itself in a
      consumer checkout where the test suite is not installed.
      verify: `./scripts-run src/scripts/lint_code_comments --self-test` exits
      0 and reports at least 8 cases with at least 4 rejecting, and
      `check_gate_coverage`'s `gate-self-test:registered-non-adopters` count
      does not include it.

## Phase 2 — the kernel rule's enforcer claim

- [ ] **2.1 Decide what `language-and-tone`'s `enforced_by` should say.** It
      names `validator:src/scripts/check_md_language.ts` for a rule whose "Code
      comments English" clause governs source files, and that validator rejects
      every path that is not `.md` (`check_md_language.ts:175`). Two honest
      outcomes: add `validator:src/scripts/lint_code_comments.ts` beside it, or
      state in the rule that the code clause is model-carried. Either is
      correct; the current state — an `enforced_by` entry that structurally
      cannot see the surface — is the one that is not.
      verify: the frontmatter names an enforcer that can read a source file, or
      the rule body carries the honest-coverage sentence. `grep -n
      "enforced_by" -A3 src/rules/language-and-tone.md` shows which.

## Blockers

### blocker: b-kernel-rule-edit

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 only. Phase 1 is an ordinary gate change and lands
  independently.
- **What to do:** pick one of two.
  (a) Add `- "validator:src/scripts/lint_code_comments.ts"` to the
  `enforced_by` list in `src/rules/language-and-tone.md` — the accurate entry,
  since that gate reads source files and refuses on the diff.
  (b) Leave the list and add one sentence to the rule body saying the code
  clause is model-carried on hosts where the gate does not run, which is the
  honest-coverage shape `security-sensitive-stop` and `active-remediation`
  already use for their own obligations.
- **Recommendation:** (a). The gate exists, it is CI-wired and locally
  reachable, and the entry would then describe something true. (b) is a
  fallback if the maintainer wants no kernel edit at all in this window.
- **If you do nothing:** the gate keeps working and the kernel rule keeps
  claiming coverage it does not have. That is the state that made this defect
  invisible for as long as it was: a frontmatter entry a reader trusts, naming
  a validator that cannot see the surface.
- **Resolved when:** `src/rules/language-and-tone.md` either names an enforcer
  that reads source files, or says in its body that the clause is
  model-carried. `language-and-tone` is a kernel rule, so the edit takes the
  slow-rollout path in `scope-control` § Kernel-rule edits — own PR, 24 h
  between merges — which is why this is a blocker rather than a step.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-02 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The self-test duplicates the vitest fixtures and drifts from them | implementation | Two corpora over one classifier drift, and the one nobody runs locally drifts first — the memory-twin failure this repository already recorded. | Both read the same exported classifier: the self-test enumerates the same fixture table; the self-test enumerates the fixture table rather than restating it, so a case added in one place appears in both. | Phase 1 — the gate proves its own discrimination |
| 2 | The kernel edit is deferred indefinitely and the false claim stands | product | A blocker with an owner and no date is how a known-wrong frontmatter entry survives a year. | The blocker names both outcomes and recommends one, and option (b) needs no kernel edit at all — so there is a path that closes it without the slow-rollout window. | Phase 2 — the kernel rule's enforcer claim |

## Acceptance Criteria

- [x] AC-1 — `lint_code_comments --self-test` exists, exits 0, and its rejecting
      cases go red when the German predicate is neutralised.
- [x] AC-2 — the gate is no longer counted among `gate-coverage.yml`'s
      registered non-adopters. Measured 2026-09-02:
      `list_self_test_non_adopters()` returns 24 names and `lint_code_comments`
      is not among them. Honest reading of that number — it was not among them
      before this change either, because the population is rows that are
      `enforced` AND carry `min_scanned >= 1`, and this row's floor is 0 by
      design. The gate now adopts on the marker the ratchet reads rather than
      passing on a population exclusion, so the criterion holds for the reason
      it names.
- [ ] AC-3 — `language-and-tone` either names an enforcer that can read a source
      file, or states that its code clause is model-carried. The current
      middle state — an entry naming a validator that rejects every source
      path — does not survive this roadmap.

## Explicitly NOT in this roadmap

- **Widening the three comment classes.** They are keyed on structure
  deliberately; a class that judges whether a comment is useful is one nobody
  can predict.
- **Cleaning existing comments anywhere.** Both carriers are forward-only by
  construction: the gate reads the diff, the concern reads the text as it is
  written. There is no baseline to work down.
