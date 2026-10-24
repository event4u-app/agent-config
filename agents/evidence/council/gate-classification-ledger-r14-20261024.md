<!-- evidence-type: analysis -->

# Conditional yes and no: the bar keeps moving, so fix it

AI council, 2026-10-24, the nineteenth round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, design mode, 2 rounds with peer review, CLI transport,
`$0.00`, **2/2 present**. The prompt is committed verbatim beside this file as
`gate-classification-ledger-r14-20261024.question.md`.

## Verdict: split; the stricter reading is taken

- **anthropic:** Q2 *conditionally yes*. Confidence: 65 % under *"a pragmatic
  governance standard"*, 35 % under *"a rigorous verification standard"*.
  The condition is independent verification that the 16 scripts are the
  complete pinned set. anthropic adds that this is internal governance and not
  aerospace verification: *"The standard should be 'rigorous enough to bound
  risk and fail closed on discovery' not 'mathematically complete.'"*
- **openai:** Q2 *no* (0.84). The missing item is an end-to-end completeness
  attestation that covers both the selection of the 16 scripts and every
  failure-emission construct. *"'0 undisposed' is meaningful only relative to
  what the scanner can see."*

Both seats accept the atomic rows and the in-package `unsure` rationales.
Neither seat calls anything owner-reserved.

## Items named, and what this change did with each

| Item | Seats | Done here |
|---|---|---|
| `<commit>` placeholder in the command | both | **Fixed.** The command derives the commit from the artefact's own git history and names both rerun commits literally |
| `check_knowledge_cards:589` lacks its suppression site | both | **Fixed.** The disposition names the only caller and the empty catch at line 351 |
| ±2-line proximity is weak | both | **Tightened.** Containment is now exact. That exposed two more sites, both disposed (`c9-dead-scope`, the `--strict` half of `c11-beta-marker`). Result: 159 sites, 132 inside, 27 disposed, 0 undisposed |
| Scanner vocabulary not shown exhaustive | openai blocking; anthropic *"uncertain"* | Open. Next: AST-level enumeration with fail-closed handling of unsupported constructs |
| The 16 scripts not shown to be the complete pinned set | both | Open. The Phase 7 record counts 330 `check_*`/`lint_*` scripts at `bbe5b73be`, but it does not list the excluded ones by name |
| Invalidation not CI-enforced | both | 7.2's entry gate. Both say it is required before 7.2, not for 7.1 |

## The pattern, and the strategy shift

This is the nineteenth round on the same step. Every round has accepted what
the previous round asked for and named a stronger next requirement:

- classes;
- aspects;
- branches;
- a mechanical scan;
- now abstract-syntax-tree control flow and a re-measurement of 330 scripts.

anthropic names the underlying issue: the governance purpose and the
verification standard were never fixed. Under the autonomy rules, a target
attempted this often calls for a strategy change, not another iteration. The
twentieth round therefore asks the seats to **fix a closed, finite acceptance
standard for 7.1**, with one test per item. After that, only a demonstrated
misclassification may reopen the step, not a new kind of requirement.
