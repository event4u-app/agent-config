<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (eleventh round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger. -->

# Step 7.1: with the rows, the inventories and a mechanical reconciliation in front of you, is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so. The agent asking you wrote the
ledger and the reconciliation script, so treat both with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four permitted classes are
invariant, snapshot, tolerance and observation.

The previous round accepted the governing definition below, then withheld
closure because the prompt included neither the rows nor a mapping. It named
what would settle the question:

- the Phase 7 start inventory;
- the full ledger;
- a check-to-row reconciliation;
- a justified aggregation rule.

All four are below, verbatim. Two things are outside this question: a per-row
CI schema that detects divergence between class and exit, and the
preconditions for any enforcement change in step 7.2.

## Phase 7 start inventory (2026-10-10 council record), verbatim

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

## Aggregation rule and mechanical reconciliation — revision 5

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

Output on this revision (`node agents/evidence/analysis/gate-ledger-reconcile.mjs`, exit 0):

```text
check | binding aspects | all classified | classes | migration notes
check_gate_completeness | 3 | yes | invariant 3 | 0
lint_ticked_unmet_criteria | 1 | yes | invariant 1 | 0
check_rule_invariants | 1 | yes | invariant 1 | 0
check_augment_description_cap | 1 | yes | invariant 1 | 0
check_trigger_evals | 2 | yes | invariant 2 | 0
lint_subagent_determinism | 1 | yes | invariant 1 | 0
lint_rule_enforcement_declaration | 1 | yes | invariant 1 | 0
check_token_quality_golden | 3 | yes | invariant 2, observation 1 | 0
check_council_layout | 1 | yes | invariant 1 | 1
check_knowledge_cards | 8 | yes | invariant 6, observation 2 | 0
check_public_links | 6 | yes | invariant 5, observation 1 | 0
lint_agents_layout | 1 | yes | invariant 1 | 1
lint_eval_freshness | 1 | yes | invariant 1 | 0
lint_readme_jargon | 1 | yes | invariant 1 | 0
lint_readme_serial_comma | 1 | yes | invariant 1 | 0
check_composite_arming | 3 | yes | invariant 1, observation 2 | 0

rows 37 · binding 35 · migration 2 · {"invariant":29,"snapshot":0,"tolerance":0,"observation":6}

OK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row.
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
| 3 | `check_rule_invariants` | kernel strings present | each string of `tests/golden/invariants.json` is in the kernel rule's source and its `dist/` projection | `tests/golden/invariants.json` (governed input), `src/rules/`, `dist/agent-src/rules/` | needs the projection built | a rule reworded; the expectation file edited | **invariant** | no baseline; the expectation file is the contract and shares edit authority with the rules (weak independence) |
| 4 | `check_augment_description_cap` | description length | every `type: auto` rule description ≤ `DESC_CAP` | `src/rules/*.md` | always | rule edits | **invariant** | fixed cap |
| 5 | `check_trigger_evals` | freshness | `last_eval` present and not more than 90 days before the run date (a future date computes a negative age and is accepted) | `triggers.json`; clock `asOf()` (pinnable through `AC_AS_OF` or `--today`), local calendar date of the runner | always | the calendar | **invariant, time-qualified** | D24. Window 90 d. Day 90 passes, day 91 fails (`age > 90`). No grace. The runner's local time zone decides the date. The class covers the property as computed. Rejecting future dates is a possible tightening, recorded and not assumed |
| 5 | | structure | non-empty queries, each `q` and boolean `trigger`, both classes present | same | always | edits | **invariant** | fixed rule |
| 6 | `lint_subagent_determinism` | schema consts | five determinism rules on `src/subagents/*.md` | same | always | edits | **invariant** | fixed rules |
| 7 | `lint_rule_enforcement_declaration` | declaration | a rule outside the legacy list declares `enforced_by:`; `none` states its gap in the body | `src/rules/`, `src/config/rule-enforcement-baseline.json` (governed input) | always | rule additions | **invariant** (shrink-only list) | list "may only shrink"; a stale entry must leave in the same change; declaration only, not that the backstop works |
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
| 11 | `check_public_links` | link target exists | a link from the public surface into `docs/contracts/` resolves to a file | README, AGENTS.md, architecture doc, contract frontmatter | always | doc edits | **invariant** | error severity, exit 1 |
| 11 | | target declares stability | the linked contract carries `stability:` frontmatter | same | always | contract edits | **invariant** | error severity, exit 1 |
| 11 | | no experimental link | the public surface never links to an `experimental` contract | same | always | doc edits | **invariant** | error severity, exit 1 |
| 11 | | contract file declares stability | a contract file itself carries `stability:` frontmatter, as `STABILITY.md` requires | `docs/contracts/` | always | contract edits | **invariant** | error severity, exit 1 |
| 11 | | beta marker — default mode | a link to a `beta` contract carries a visible `(beta)` or `[beta]` marker | same | invocation without `--strict` | doc edits | **observation** | warning severity, exit 0 |
| 11 | | beta marker — `--strict` | same property | same | invocation with `--strict` | doc edits | **invariant** in that mode | warnings fail with `--strict` |
| 12 | `lint_agents_layout` | top-level allowlist — current | every top-level entry under `agents/` on disk is allowlisted (`fs.readdirSync`), untracked entries included | `agents/` on disk, `ALLOWED_SOURCE_DIRS` in source | always | untracked local entries as well as edits | **invariant** over the disk scope it measures today | fixed allowlist; the row 7.2 may rely on until the fix |
| 12 | | top-level allowlist — target | the same property over the top-level entries of the paths `git ls-files -- agents/` lists (index scope, as row 9) | git index | after the scope fix | edits | **invariant** | no enforcement decision relies on it before the fix is verified |
| 13 | `lint_eval_freshness` | eval attached | `upstream.last_eval` present with `sha_at_eval == upstream.sha` | manifests | in scope when a skill ships triggers and a pinned corpus | corpus SHA bumps | **invariant** | SHA equality, no clock |
| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | no named risk owner, so not a tolerance |
| 15 | `lint_readme_serial_comma` | serial comma | no serial comma in README prose | README.md | always | README edits | **invariant** | fixed rule |
| 16 | `check_composite_arming` | arming verdict | ≥ 10 usable composite readings from ≥ 2 sessions | the composite store | a valid store exists | new readings | **observation** | "'not yet' is a successful measurement, never a build failure" |
| 16 | | store malformed | the store exists and every line parses | same | the store exists | a corrupt append | **invariant** | a corrupt store is a broken input contract (both seats); today exit 1 |
| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtime metadata, not a class: `not-evaluated: evidence-missing`. Current behaviour diverges: the script exits 1, which is owed to 7.2. A future transition to invariant after a bootstrap deadline needs that deadline first (D31) and is not part of this verdict |

## Invocation inventory, verbatim

| # | Check | Local task (flags) | Pull-request workflow (flags) | A non-zero exit there |
|---|---|---|---|---|
| 1 | `check_gate_completeness` | `taskfiles/ci-fast.yml:1377` (`--quiet` optional) | none | blocks the local chain only |
| 2 | `lint_ticked_unmet_criteria` | `taskfiles/ci-fast.yml:1648` | `rule-backstops.yml:784` (no flags) | fails the step; `Rule backstops` is not recorded as required |
| 3 | `check_rule_invariants` | `taskfiles/ci-fast.yml:2304` | none | local chain only |
| 4 | `check_augment_description_cap` | `taskfiles/ci-fast.yml:2436` | `standing-payload-delta.yml:527` | **required context** |
| 5 | `check_trigger_evals` | `taskfiles/ci-fast.yml:1080` | none (the workflow runs a different script, `check_trigger_eval_presence`) | local chain only |
| 6 | `lint_subagent_determinism` | `taskfiles/ci-fast.yml:602` | `standing-payload-delta.yml:498` (`rc` collected) | **required context** |
| 7 | `lint_rule_enforcement_declaration` | `taskfiles/ci-fast.yml:1259` | none | local chain only |
| 8 | `check_token_quality_golden` | `taskfiles/engine.yml:164` (default mode) | `standing-payload-delta.yml:537` (default mode, no `--require-complete`) | **required context**, structure aspect only; coverage is reported in this mode |
| 9 | `check_council_layout` | `taskfiles/content.yml:332` | `standing-payload-delta.yml:562` (`--quiet`) | **required context**, on a fresh CI checkout where the disk holds tracked files only |
| 10 | `check_knowledge_cards` | `taskfiles/ci-fast.yml:2244` | `standing-payload-delta.yml:497` (`rc` collected; no `--strict`, no `--check-urls`, freshness off) | **required context** for C1, C2, C3 local, C4 and C5; C3 live URL, C6 and freshness are not invoked anywhere |
| 11 | `check_public_links` | `taskfiles/ci-fast.yml:2072` | `standing-payload-delta.yml:550` (no `--strict`) | **required context** for the four error rules; the beta marker is a warning here |
| 12 | `lint_agents_layout` | `taskfiles/content.yml:342` (default) and `:347` (`--strict`) | none | local chain only |
| 13 | `lint_eval_freshness` | `taskfiles/ci-fast.yml:1788` | none | local chain only |
| 14 | `lint_readme_jargon` | `taskfiles/ci-fast.yml:764` | `standing-payload-delta.yml:517` (`rc` collected) | **required context** |
| 15 | `lint_readme_serial_comma` | `taskfiles/ci-fast.yml:774` | `standing-payload-delta.yml:518` (`rc` collected) | **required context** |
| 16 | `check_composite_arming` | `taskfiles/content.yml:386` (`--self-test`) | `rule-backstops.yml:321` (`--self-test`); `tests.yml:540` (`--store $RUNNER_TEMP/…`, `continue-on-error: true`) | the self-test fails its step (not required). The store run is **already non-blocking** |

## Questions

**Q1.** Does the reconciliation, as shown, establish that every binding aspect
of every one of the 16 checks carries one of the four classes? Name any row
where the class is wrong or the aspect is missing.

**Q2.** With this recorded as 7.1's verdict, is the exit criterion met? Answer
yes or no. If no, name the single thing still missing, and whether only the
owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
