<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twelfth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger
     and the reconciler. -->

# Step 7.1: with a source-derived mode reconciliation and executions, is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so. The agent asking you wrote the
ledger and the reconciler, so treat both with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four classes are invariant,
snapshot, tolerance and observation.

The previous round said no. It named one missing thing, not owner-reserved:

> a source-derived assertion-by-invocation-mode inventory reconciled against
> the ledger

It also named three specific gaps:

- `check_composite_arming --self-test` had no row;
- the *store malformed* row might misstate the code;
- representative executions should confirm the stated behaviour.

The response is below, verbatim. Outside this question: a per-row CI schema for
divergence detection, operational definitions of the four classes, and the
preconditions for step 7.2.

## Phase 7 start inventory, verbatim

| # | Check | Class |
|---|---|---|
| 1 | `check_gate_completeness` | **snapshot**, governed |
| 2 | `lint_ticked_unmet_criteria` | invariant |
| 3 | `check_rule_invariants` | invariant |
| 4 | `check_augment_description_cap` | invariant |
| 5 | `check_trigger_evals` | invariant |
| 6 | `lint_subagent_determinism` | invariant |
| 7 | `lint_rule_enforcement_declaration` | invariant |
| 8 | `check_token_quality_golden` | invariant |
| 9 | `check_council_layout` | **unclassified** |
| 10 | `check_knowledge_cards` | **unclassified** |
| 11 | `check_public_links` | invariant |
| 12 | `lint_agents_layout` | invariant |
| 13 | `lint_eval_freshness` | invariant |
| 14 | `lint_readme_jargon` | invariant |
| 15 | `lint_readme_serial_comma` | invariant |
| 16 | `check_composite_arming` | **unclassified** |

## The governing definition — revision 4

Both seats of the closure round on revision 3 (D33) asked for this before the
verdict is relied on. anthropic made it the condition of acceptance. It binds
every row below:

> **A classification attaches to one currently implemented assertion under one
> explicitly named invocation mode. It is semantic: it states what the
> assertion means, independent of the exit status the script happens to return
> today. Current enforcement is recorded separately, in the next section.
> Proposed behaviour is non-binding migration metadata and is excluded from the
> closure totals.**

The definition has three consequences:

- the two *target* rows of checks 9 and 12 are migration notes, not
  classifications;
- row 16's *store absent* is an observation by its own contract, while its
  current exit 1 is a recorded divergence, not part of the class;
- the mode-qualified rows of checks 8, 10 and 11 classify the assertion in that
  mode only.

**Which checks.** The population is the 16 checks the 2026-10-10 round measured
red or classified on a clean `origin/main` worktree. Its record is
`agents/evidence/council/live-tree-check-classification-20261010.md`, and the
same 16 are re-listed in
`agents/evidence/analysis/live-tree-check-remeasure-20261017.md`. That record is
the Phase 7 start inventory openai asked to have cited.

## Aggregation rule and mechanical reconciliation — revisions 5 and 6

The tenth round (D34) accepted the governing definition. It withheld closure
because the prompt showed neither the rows nor a check-to-row mapping. anthropic
also rejected *"at least one classified aspect per check"* as an invented
aggregation rule. Revision 5 replaces it:

> **A check is classified when every one of its binding aspects (every row
> that is not a migration note) carries one of the four classes. One
> classified aspect never covers a sibling.**

`agents/evidence/analysis/gate-ledger-reconcile.mjs` checks the rule
mechanically. It parses three things:

- the Phase 7 start inventory table in
  `agents/evidence/council/live-tree-check-classification-20261010.md`;
- this ledger's table;
- the invocation inventory.

It exits 1 unless all of these hold:

- the three name the same 16 checks;
- every binding aspect carries a class;
- every target row sits beside its current-scope row.

It was shown to fail: with one class removed from a row it printed
`unclassified binding aspect: check_knowledge_cards / C4 trust tag`.


**Revision 6** answers the eleventh round (D35). Both seats found the
row population was the ledger's own, so the parser could not see an omitted
mode. They named `check_composite_arming --self-test` as the missing row and
challenged the *store malformed* row. The reconciler now also extracts every
`--flag` literal from each check's **source**. Each one must be either:

- declared as changing no assertion (presentation, input, write mode, or a
  string that is not a flag), or
- named by a binding row of that check.

An unknown flag fails the run. The population is mechanical, and the category
list is visible in the script. It was seen to fail: with the `--global` row
removed it printed
`unclassified invocation mode: check_knowledge_cards --global`.

The source scan surfaced eight rows revision 5 lacked:

- the self-test modes of checks 2, 3, 7 and 16;
- `--global` on check 10;
- the legacy-entry warning in check 12, in default mode and in `--strict`;
- row 16's partial malformation.

The *store malformed* row was wrong and is corrected. The code exits 1 only
when malformed lines leave no usable record.

**Representative executions** of the contested check, against `--store` files
in a temporary directory:

| Store | Exit | Ledger row |
|---|---|---|
| absent | 1 | *store absent*: observation, with the exit-1 divergence recorded |
| every line malformed | 1 | *store yields a usable record*: invariant |
| one malformed line, one usable | 0, and the dropped line is named as `precondition_unmet` | *partial malformation*: observation |
| one usable line | 0 | arming verdict: observation (not armable) |

Output on revision 6 (`node agents/evidence/analysis/gate-ledger-reconcile.mjs`, exit 0):

```text
check | binding aspects | all classified | classes | migration notes
check_gate_completeness | 3 | yes | invariant 3 | 0
lint_ticked_unmet_criteria | 2 | yes | invariant 2 | 0
check_rule_invariants | 2 | yes | invariant 2 | 0
check_augment_description_cap | 1 | yes | invariant 1 | 0
check_trigger_evals | 2 | yes | invariant 2 | 0
lint_subagent_determinism | 1 | yes | invariant 1 | 0
lint_rule_enforcement_declaration | 2 | yes | invariant 2 | 0
check_token_quality_golden | 3 | yes | invariant 2, observation 1 | 0
check_council_layout | 1 | yes | invariant 1 | 1
check_knowledge_cards | 9 | yes | invariant 7, observation 2 | 0
check_public_links | 6 | yes | invariant 5, observation 1 | 0
lint_agents_layout | 3 | yes | invariant 2, observation 1 | 1
lint_eval_freshness | 1 | yes | invariant 1 | 0
lint_readme_jargon | 1 | yes | invariant 1 | 0
lint_readme_serial_comma | 1 | yes | invariant 1 | 0
check_composite_arming | 5 | yes | invariant 2, observation 3 | 0

check | flags in source | assertion-changing flags | each named by a binding row
check_gate_completeness | --quiet | — | yes
lint_ticked_unmet_criteria | --root --self-test | --self-test | yes
check_rule_invariants | --help --mutation-selftest --root | --mutation-selftest | yes
check_augment_description_cap | --root | — | yes
check_trigger_evals | --help --quiet --today | — | yes
lint_subagent_determinism | --quiet | — | yes
lint_rule_enforcement_declaration | --quiet --root --self-test --write-baseline | --self-test | yes
check_token_quality_golden | --help --json --require-complete --scope | --require-complete | yes
check_council_layout | --quiet | — | yes
check_knowledge_cards | --check-urls --dir --freshness-days --global --help --is-ancestor --strict | --check-urls --freshness-days --global --strict | yes
check_public_links | --help --json --list --strict | --strict | yes
lint_agents_layout | --quiet --strict | --strict | yes
lint_eval_freshness | --help --quiet | — | yes
lint_readme_jargon | --quiet | — | yes
lint_readme_serial_comma | --quiet | — | yes
check_composite_arming | --publish --record-composite --self-test --store | --self-test | yes

rows 45 · binding 43 · migration 2 · {"invariant":35,"snapshot":0,"tolerance":0,"observation":8}

OK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row; every assertion-changing flag in each check's source is named by a binding row.
```

What it does not establish: that row 16 is the only divergence between class
and current exit behaviour. That finding comes from reading the inventory, not
from running each check per mode. anthropic asks for a per-row schema with
`expected_exit`, `current_exit`, `divergence` and `last_verified`, maintained
by CI. That is a 7.2 item and is carried there.

## The ledger rows, verbatim

| # | Check | Aspect | Property measured (from source) | Inputs / trust dependencies | Applicability / invocation mode | What makes it vary | Class | Evidence for the class |
|---|---|---|---|---|---|---|---|---|
| 1 | `check_gate_completeness` | adoption ratchet | un-adopted gate count ≤ the recorded count | `src/config/gate-violation-baselines.json` (governed input), gate sources | always | new gates, adoption | **invariant** (shrink-only) | header: the count "may only go down". No authorised upward refresh is documented, and an edit's technical ability to raise the number is not authorisation |
| 1 | | exemption marker | every `// ledger-exempt:` carries a reason of minimum length | gate sources | always | gate edits | **invariant** | "an empty or near-empty reason is a hard failure"; form only, the header says truth is a human read |
| 1 | | scan scope | the gate scanned a non-dead scope (the CI-registered gate estate) | `assertScanned` | always | tree layout | **invariant** | dead scope throws, no baseline |
| 2 | `lint_ticked_unmet_criteria` | ticked-vs-NOT-met | no `[x] AC` whose own text says `NOT met` | roadmaps, frozen digest list in source (governed input) | always | roadmap edits | **invariant** | frozen, digest-pinned exemptions; an unmatched entry is an error, so the list only shrinks |
| 2 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | a fixed fixture table, no baseline (fixed-policy) |
| 3 | `check_rule_invariants` | kernel strings present | each string of `tests/golden/invariants.json` is in the kernel rule's source and its `dist/` projection | `tests/golden/invariants.json` (governed input), `src/rules/`, `dist/agent-src/rules/` | needs the projection built | a rule reworded; the expectation file edited | **invariant** | no baseline; the expectation file is the contract and shares edit authority with the rules (weak independence) |
| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker against a silently-green normalisation bug (repository-consistency) |
| 4 | `check_augment_description_cap` | description length | every `type: auto` rule description ≤ `DESC_CAP` | `src/rules/*.md` | always | rule edits | **invariant** | fixed cap |
| 5 | `check_trigger_evals` | freshness | `last_eval` present and not more than 90 days before the run date (a future date computes a negative age and is accepted) | `triggers.json`; clock `asOf()` (pinnable through `AC_AS_OF` or `--today`), local calendar date of the runner | always | the calendar | **invariant, time-qualified** | D24. Window 90 d. Day 90 passes, day 91 fails (`age > 90`). No grace. The runner's local time zone decides the date. The class covers the property as computed. Rejecting future dates is a possible tightening, recorded and not assumed |
| 5 | | structure | non-empty queries, each `q` and boolean `trigger`, both classes present | same | always | edits | **invariant** | fixed rule |
| 6 | `lint_subagent_determinism` | schema consts | five determinism rules on `src/subagents/*.md` | same | always | edits | **invariant** | fixed rules |
| 7 | `lint_rule_enforcement_declaration` | declaration | a rule outside the legacy list declares `enforced_by:`; `none` states its gap in the body | `src/rules/`, `src/config/rule-enforcement-baseline.json` (governed input) | always | rule additions | **invariant** (shrink-only list) | list "may only shrink"; a stale entry must leave in the same change; declaration only, not that the backstop works |
| 7 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--write-baseline` is a write mode that rewrites the baseline file and asserts nothing, so it carries no class |
| 8 | `check_token_quality_golden` | structure | unknown rule ids, bad scenarios, a labelled task without anchors | golden YAML, `dist/router.json` | always, every mode | edits | **invariant** | "Structural errors … always fail" |
| 8 | | coverage and stubs — default mode | uncovered rules and stub tasks | same | invocation without `--require-complete` | labelling work | **observation** | "REPORTED, not a failure, by default" |
| 8 | | coverage and stubs — `--require-complete` | no stub, no uncovered rule, required scenarios present, for the given `--scope` | same | invocation with `--require-complete` (the operator-completion gate) | labelling work | **invariant** in that mode | the header names it the completion gate, which fails on any remaining stub |
| 9 | `check_council_layout` | placement — current | council artefacts only in canonical or allowlisted directories, over **every path on disk** under `agents/` (`fs.readdirSync`), untracked files included | `agents/` on disk | always | untracked local files as well as edits | **invariant** over the disk scope it measures today | fixed rule. This is the row 7.2 may rely on until the scope fix lands |
| 9 | | placement — target | the same property over the **index**: the paths `git ls-files -- agents/` lists, so a staged addition is in, a staged deletion is out, and a rename counts at its new path. Only path names are checked, so partially staged content cannot change the result | git index | after the scope fix | edits | **invariant** | the canonical scope both seats asked for. No enforcement decision may rely on this row before the fix is verified |
| 10 | `check_knowledge_cards` | C1 size | a card ≤ 150 lines | `agents/knowledge/*.md` (external arm) | always | card edits | **invariant** | error |
| 10 | | C2 pointer present | `links.authoritative` in frontmatter | same | always | card edits | **invariant** | error |
| 10 | | C3 local pointer | a local pointer path exists | same + the tree | always | card or tree edits | **invariant** | error |
| 10 | | C3 live URL | the URL answers | same + network | only with `--check-urls` | the remote site | **observation** | network-dependent and opt-in; not reproducible offline |
| 10 | | C4 trust tag | `trust` present; `type: anti-hallucination` | same | always | card edits | **invariant** | error |
| 10 | | C5 evidence consistency | distinct `source_version`s form a git-ancestry chain; `observed_at` span ≤ 7 days | same + git history | always | card edits, history | **invariant** | error. The span compares recorded timestamps, not the clock |
| 10 | | C6 strict sources | `source=<path:line>` references exist and are non-empty | same + the tree | only with `--strict` | tree edits | **invariant** in that mode | error when enabled |
| 10 | | freshness | newest `observed_at` older than `--freshness-days` | same + clock | only with the flag; default 0 = off | the calendar | **observation** | "Honest freshness signal (NOT a failure)" |
| 10 | | global-store cards — `--global` | the extra checks ADR-100 sets for the user-global card store (`_check_global_card`) | the global store | only with `--global`; no caller found | card edits | **invariant** | errors added to the same error list (fixed-policy) |
| 11 | `check_public_links` | link target exists | a link from the public surface into `docs/contracts/` resolves to a file | README, AGENTS.md, architecture doc, contract frontmatter | always | doc edits | **invariant** | error severity, exit 1 |
| 11 | | target declares stability | the linked contract carries `stability:` frontmatter | same | always | contract edits | **invariant** | error severity, exit 1 |
| 11 | | no experimental link | the public surface never links to an `experimental` contract | same | always | doc edits | **invariant** | error severity, exit 1 |
| 11 | | contract file declares stability | a contract file itself carries `stability:` frontmatter, as `STABILITY.md` requires | `docs/contracts/` | always | contract edits | **invariant** | error severity, exit 1 |
| 11 | | beta marker — default mode | a link to a `beta` contract carries a visible `(beta)` or `[beta]` marker | same | invocation without `--strict` | doc edits | **observation** | warning severity, exit 0 |
| 11 | | beta marker — `--strict` | same property | same | invocation with `--strict` | doc edits | **invariant** in that mode | warnings fail with `--strict` |
| 12 | `lint_agents_layout` | top-level allowlist — current | every top-level entry under `agents/` on disk is allowlisted (`fs.readdirSync`), untracked entries included | `agents/` on disk, `ALLOWED_SOURCE_DIRS` in source | always | untracked local entries as well as edits | **invariant** over the disk scope it measures today | fixed allowlist; the row 7.2 may rely on until the fix |
| 12 | | top-level allowlist — target | the same property over the top-level entries of the paths `git ls-files -- agents/` lists (index scope, as row 9) | git index | after the scope fix | edits | **invariant** | no enforcement decision relies on it before the fix is verified |
| 12 | | legacy entries — default mode | entries scheduled for migration are reported as warnings | `agents/` on disk | invocation without `--strict` (`taskfiles/content.yml:342`) | migrations | **observation** | warnings exit 0 without `--strict` |
| 12 | | legacy entries — `--strict` | no entry scheduled for migration remains | same | invocation with `--strict` (`taskfiles/content.yml:347`) | migrations | **invariant** in that mode | `if (strict) return 1` after the warnings |
| 13 | `lint_eval_freshness` | eval attached | `upstream.last_eval` present with `sha_at_eval == upstream.sha` | manifests | in scope when a skill ships triggers and a pinned corpus | corpus SHA bumps | **invariant** | SHA equality, no clock |
| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | no named risk owner, so not a tolerance |
| 15 | `lint_readme_serial_comma` | serial comma | no serial comma in README prose | README.md | always | README edits | **invariant** | fixed rule |
| 16 | `check_composite_arming` | arming verdict | ≥ 10 usable composite readings from ≥ 2 sessions | the composite store | a valid store exists | new readings | **observation** | "'not yet' is a successful measurement, never a build failure" |
| 16 | | store yields a usable record | a store with content parses to at least one usable reading (a line with a string `session` and a `composite_ms` key) | the composite store | the store exists | a corrupt append | **invariant** | exit 1 when malformed lines leave no usable record (`malformed > 0 && readings.length === 0`). Corrected in revision 6: revision 3 said "every line parses", which the code does not require |
| 16 | | partial malformation | malformed lines next to usable ones are counted and named per line | same | the store exists | a corrupt append | **observation** | the gate ledger records each dropped line as `precondition_unmet` and the run continues |
| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtime metadata, not a class: `not-evaluated: evidence-missing`. Current behaviour diverges: the script exits 1, which is owed to 7.2. A future transition to invariant after a bootstrap deadline needs that deadline first (D31) and is not part of this verdict |
| 16 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | `taskfiles/content.yml:386`, `rule-backstops.yml:321` | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--publish` is a write mode that writes a distribution report and asserts nothing, so it carries no class |

## Questions

**Q1.** Does the source-derived mode reconciliation, together with the
executions, close the gap the previous round named? Name any row still missing
or wrong.

**Q2.** With revision 6 recorded as 7.1's verdict, is the exit criterion met?
Answer yes or no. If no, name the single thing still missing and whether only
the owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
