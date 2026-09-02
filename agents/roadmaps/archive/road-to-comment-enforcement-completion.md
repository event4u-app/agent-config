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

> **Status at archival (2026-09-02): agent-executable scope complete; kernel
> defect unresolved.** Phase 1 shipped and is verified. Phase 2 and AC-3 are
> `[~]` and carried to
> `agents/roadmaps/later/road-to-language-and-tone-enforcer-claim.md` by AI
> council verdict 2A — see § Blockers. The false `enforced_by` claim in
> `language-and-tone` still stands; nothing here should be read as having cured
> it.

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

- [~] **2.1 Decide what `language-and-tone`'s `enforced_by` should say.** It
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
      <!-- deferred-resolution: carried-to=road-to-language-and-tone-enforcer-claim -->

## Blockers

### blocker: b-kernel-rule-edit

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap. Phase 1 landed independently, as the
  blocker's own `Blocks` field predicted.
- **What to do:** nothing here. The obligation moved, unclosed, to
  `agents/roadmaps/later/road-to-language-and-tone-enforcer-claim.md`, which
  carries the same blocker at `Status: open` with both curing steps specified to
  the character. `open_blockers` spans the active tree AND `later/`
  (`check_estate_count.ts:470`), so the count is preserved by the move and
  nothing is laundered.
- **Resolved when:** resolved here on 2026-09-02 as *carried, not cured* — the
  defect stands and is recorded on the receiver. Resolution mechanism: AI
  council verdict 2A, inlined below.

### DISPOSITION 2026-09-02 (drain run 16): 2A — carried to `later/`, not cured

*AI council 2026-09-02, members `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
quorum **2/2 present** (needed 1) — concluded. Subscription transport,
`billable=0`, `$0.0000`. Council artefacts are gitignored and auto-pruned, so
every line relied on is inlined here per `no-roadmap-references`.*

**The question put.** This blocker's `Resolved when` offers exactly two paths,
(a) an `enforced_by` addition and (b) a rule-body sentence, and **both are writes
to `src/rules/language-and-tone.md`** — a kernel rule.
`src/scripts/hooks/block_kernel_rule_writes.ts` denies every agent write to a
kernel rule at the Write/Edit surface (`:105-124`) and at the Bash surface
(`:126-205`: redirection, in-place `sed`, `tee`, `truncate`, `rm`, `mv`/`cp`
destination). Its header names the sole legitimate bypass as a human-owned
exception registry, and circumventing the guard by an unrecognised write verb
was explicitly not contemplated. So the blocker as written is discharge-proof
for any agent, in any session.

**Verdict 2A — convergent 2/2.** Move Phase 2, this blocker and AC-3 to a
parked receiver with the rationale recorded, and archive the roadmap once
Phase 1 is complete. *"An active execution roadmap should represent executable
work. Keeping an impossible agent-owned completion condition open indefinitely
makes the estate misleading rather than safer."* The archival wording both seats
asked for is used verbatim in the Goal-status line: **agent-executable scope
complete; kernel defect unresolved.**

**2C was refused, and the test that refuses it is worth keeping.** One seat
proposed restating AC-3 so it could be met without a kernel write. Both then
held that a non-kernel note is honest only if a deterministic, mandatory reader
path (i) surfaces the qualification whenever the rule is consumed, (ii) prevents
tooling and agents from reading `check_md_language.ts` as source-comment
enforcement, and (iii) is protected by a gate. One seat sharpened the bar
further: it is honest *"only if it changes the reader's action. A coverage-gap
note that nobody is required to consult before claiming enforcement is
documentation, not a control."* No such path exists, so 2C would have been
bookkeeping. **2B was refused** for converting a real defect into undead work.

**2D exists, is better, and is unavailable to this run.** Both seats named a
missing option: *"an authorized maintainer performs the kernel edit through the
documented human-owned exception mechanism."* That is the substantively correct
outcome. It requires a human act outside any agent session, so this run cannot
take it — and the receiver's Phase 1 is written so that taking it later costs
minutes.

**The mechanism deviates from the council's word and matches its intent, and the
deviation is recorded rather than smoothed.** Both seats said *stub*. A stub is
**not a valid `[~]` receiver**: `deferralProblems`
(`src/agent-src/scripts/archive_completed_roadmaps.ts:414`) resolves a
`carried-to=` destination only against `agents/roadmaps/<slug>.md` or
`agents/roadmaps/later/<slug>.md`, and fail-closes on `stubs/`. It also requires
a literal `parent_roadmap:` back-link, verified from both ends. `later/` is the
tree's own mechanism for real, specified, not-now work, it is excluded from the
dashboard and from `/roadmap:process-*`, and it keeps the blocker inside
`open_blockers`. Every property the seats asked a stub to have — precise edit,
named human owner, legitimate authorization path, objective resumption trigger —
the receiver has; a `stubs/` file would additionally have failed the gate.

**One correction to a claim this roadmap made about itself.** AC-2 asked that
the gate leave `gate-coverage.yml`'s registered-non-adopter set. The count is
**24 either side of the change**, because that population is rows that are
`enforced` **and** `min_scanned >= 1`, and `lint_code_comments` carries
`min_scanned: 0` by design — its corpus is a diff. So the criterion was already
satisfied by population exclusion before any work happened. It now holds for the
reason it names: the gate carries the `--self-test` marker the ratchet reads
(18 cases, 9 rejecting, sensitivity probed). Recorded here and on the AC line so
an unchanged number is not later read as a missed drain.

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
- [~] AC-3 — `language-and-tone` either names an enforcer that can read a source
      file, or states that its code clause is model-carried. The current
      middle state — an entry naming a validator that rejects every source
      path — does not survive this roadmap.
      <!-- deferred-resolution: carried-to=road-to-language-and-tone-enforcer-claim -->

## Explicitly NOT in this roadmap

- **Widening the three comment classes.** They are keyed on structure
  deliberately; a class that judges whether a comment is useful is one nobody
  can predict.
- **Cleaning existing comments anywhere.** Both carriers are forward-only by
  construction: the gate reads the diff, the concern reads the text as it is
  written. There is no baseline to work down.
