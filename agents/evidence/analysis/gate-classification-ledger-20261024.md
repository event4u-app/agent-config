<!-- evidence-type: analysis -->

# Contract-and-classification ledger for the 16 live-tree checks — provisional

Step 7.1 of `road-to-authority-routing-mechanism`, D30's owed item. A provisional
verdict per check, made under existing authority. This is the first of three
trust events D30 separates, **evidence ledger → classification verdict →
governed registry entry**. It is not a registry entry and claims no independent
approval. Promoting any row into a governed registry needs the second principal
`external-bootstrap-boundary-for-phases-2-3` names.

## How each row was built

The population is the 16 checks D14 classified, as listed in
`agents/evidence/analysis/live-tree-check-remeasure-20261017.md`. Each row was
read from the check's own source: its header contract, plus a grep for a
baseline, a clock, git or network access, and an allowlist. Observed red or
green is **not** an input. D14 refused to read class off a failure, and this
ledger keeps that refusal. Where the source states its own contract ("not a
build failure", "may only go down"), the row cites it.

Vocabulary, from D24 and D21:

- **invariant** — a property that must always hold. It has no baseline, or a
  shrink-only grandfather list. A time-qualified invariant names its clock and
  window.
- **snapshot** — compared against a recorded baseline that a governed act can
  move in the permissive direction.
- **tolerance** — a bounded range with a stated bound **and** a named party
  accepting the risk.
- **observation** — reported, never blocking, by its own contract.

Rows are per aspect, so one check can carry more than one class.

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

## Current enforcement, recorded separately

From `agents/evidence/analysis/gate-invocation-inventory-20261024.md`:

- eight checks block the required `Standing payload delta + budget gate` context
  in their default mode (rows 4, 6, 8, 9, 10, 11, 14, 15);
- seven block only the local `task ci` chain or the non-required
  `Rule backstops` (rows 1, 2, 3, 5, 7, 12, 13);
- `check_composite_arming` blocks nothing, because its store run is
  `continue-on-error: true`.

No observation aspect blocks at any caller found. Semantic class and current
exit behaviour diverge in **one** place: row 16, *store absent*, exits 1. The
divergence is recorded here and is not a reclassification.

## Assurance level of each invariant

The four classes do not change, but *invariant* covers three different
guarantees (openai), so each invariant row carries one of these qualifiers:

- **repository-consistency**: the check compares the tree against an
  expectation the same authority can edit in the same change. These are row 1's
  ratchet, row 2, row 3 and row 7. They are consistency checks, not
  independently anchored invariants (anthropic).
- **environment-dependent**:
  - row 5 freshness (runner clock and time zone);
  - the current-scope rows of checks 9 and 12 (the disk);
  - row 10 C5 (git history depth).
- **fixed-policy**: every other invariant row.

## The ledger — revision 3

Revision 3 applies the 2026-10-24 round on revision 2 (D32). That round left exactly one closure blocker: the absent composite store carried a fifth value instead of a class. It is now an observation, and the missing-evidence state is runtime metadata only. Revision 3 also applies five refinements:

- the stale snapshot reference is removed;
- row 5 states the property as computed;
- row 11 enumerates every error-severity rule;
- rows 9 and 12 separate the scope measured today from the target index scope, with an operational definition;
- row 16 separates current behaviour from a future transition.

Revision 2 applied the 2026-10-24 ledger round (D31). Both seats rejected
closure of revision 1 and agreed on five corrections, all applied here:

- row 1's ratchet is an invariant, not a snapshot;
- row 10 is split per check, C1 to C6;
- row 11's warning property is named;
- row 16 separates missing, malformed and insufficient evidence;
- rows 9 and 12 record a canonical measurement scope.

Revision 2 also dropped revision 1's *proves or asserts* column. Every row's
script **computes** its property from files the same repository authority
controls, and no independent party verifies it (openai's hardest pushback).

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

## Totals — revision 4

37 aspect rows over 16 checks. Under the governing definition, the two target-scope rows are migration notes, so **35 classified aspects**, every one in one of the four classes:

- **invariant 29**, after excluding the two target-scope migration notes from the 31 invariant rows:
  - three hold only in a named invocation mode: `--require-complete`, and `--strict` on two checks;
  - one is time-qualified;
  - the two target-scope rows of checks 9 and 12 are **not** counted. The current-scope rows beside them carry the classification.
- **observation 6**:
  - token-golden default coverage;
  - C3 live URL;
  - card freshness;
  - the beta marker in default mode;
  - composite arming;
  - composite store absent.
- **snapshot 0**.
- **tolerance 0**.

No aspect carries a value outside the four classes. Runtime metadata such as `not-evaluated: evidence-missing` is stated next to a class, never in place of one. Every binding aspect of every one of the 16 checks carries a class (the aggregation rule above, checked mechanically).

The three D14 abstentions are resolved as follows:

- `check_council_layout`: an invariant over the disk scope it measures today;
- `check_knowledge_cards`: eight aspects, of which six are invariants and two are observations;
- `check_composite_arming`: two observations and one invariant.

## What this ledger does not decide

- **Gate membership.** Classification is not gate membership (D14, D22). An
  observation row says what the check's own contract claims. It does not demote
  anything. Demotion is 7.2, and its own rule says every demotion is recorded
  with its reason.
- **Refresh authority.** No row is a snapshot any more. Whether any
  shrink-only list may ever be raised, and by whom, is owner-reserved (D31).
- **Truthfulness.** For every row the script computes the property from
  files the same repository authority controls. No independent party verifies
  the computation.

## Unresolved, and who decides

| Question | Needs |
|---|---|
| Which object rows 9 and 12 should inspect: the index, the checked-out commit, or the synthetic merge result. Moving from the disk to tracked paths stops detecting untracked entries, which is a reduction of detectable states (openai) and needs a justification | council, before 7.2 changes either check |
| The bootstrap deadline after which an absent composite store fails | council (a reversible value) |
| Any authority to raise the `check_gate_completeness` baseline, or any exception to a shrink-only list | owner-reserved second principal (`external-bootstrap-boundary-for-phases-2-3`); until then the lists are shrink-only invariants |
| Demoting an observation aspect to non-blocking (7.2) | council, after the invocation-mode and consumer inventory; each demotion carries old behaviour, new behaviour, reason, consumers and a rollback condition |
| Promotion of any row into a governed registry | owner-reserved second principal |
