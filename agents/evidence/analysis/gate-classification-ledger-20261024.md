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

## The ledger

| # | Check | Aspect | Property measured (from source) | Inputs / trust dependencies | Applicability | What makes it vary | Provisional class | Evidence for the class | Producer proves or asserts |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `check_gate_completeness` | adoption ratchet | un-adopted gate count is at or under the recorded count | `src/config/gate-violation-baselines.json`, gate sources | always | new gates, adoption, baseline edits | **snapshot** | header: "today's un-adopted count is recorded, and it may only go down"; `checkRatchet` passes `improved` and the baseline is a governed file a change can raise | proves (counts files) |
| 1 | | exemption marker | every `// ledger-exempt:` carries a reason of minimum length | gate sources | always | gate edits | **invariant** | header: "an empty or near-empty reason is a hard failure" | proves form; cannot judge truth (header says so) |
| 1 | | scan scope | the gate scanned a non-dead scope | `assertScanned` | always | tree layout | **invariant** | dead scope throws, no baseline | proves |
| 2 | `lint_ticked_unmet_criteria` | ticked-vs-NOT-met | no `[x] AC` whose own text says `NOT met` | roadmaps, frozen digest list in source | always | roadmap edits | **invariant** | a frozen, digest-pinned exemption list; an unmatched entry is itself an error, so the list only shrinks | proves |
| 3 | `check_rule_invariants` | kernel strings present | each string of `tests/golden/invariants.json` is present in the kernel rule's source **and** its `dist/` projection | `tests/golden/invariants.json`, `src/rules/`, `dist/agent-src/rules/` | needs the projection built (prerequisite) | a rule reworded; the expectation file edited | **invariant** | no baseline; the expectation file is the contract | proves presence; the expectation file is a governed input whose edit path is the kernel-rule edit path |
| 4 | `check_augment_description_cap` | description length | every `type: auto` rule's description ≤ `DESC_CAP` | `src/rules/*.md` | always | rule edits | **invariant** | fixed cap, no baseline | proves |
| 5 | `check_trigger_evals` | freshness | `last_eval` present and ≤ 90 days old | `src/skills/*/evals/triggers.json`; clock = run date or `--today` | always | **the calendar**, with no tree change | **invariant, time-qualified** (clock: run date; window 90 d; grace none) | D24: a freshness window is an invariant with a time qualifier | proves age; asserts nothing about the eval's quality |
| 5 | | structure | non-empty queries, each with `q` and boolean `trigger`, both classes present | same files | always | edits | **invariant** | fixed structural rule | proves |
| 6 | `lint_subagent_determinism` | schema consts | `schema_version`, `discovery.visible`, unique tools, name = stem, global uniqueness | `src/subagents/*.md` | always | edits | **invariant** | fixed rules | proves |
| 7 | `lint_rule_enforcement_declaration` | declaration | a rule outside the legacy list declares `enforced_by:`; `none` states the gap in its body | `src/rules/`, `src/config/rule-enforcement-baseline.json` | always | rule additions | **invariant** | header: the legacy list "may only shrink"; a stale entry must leave in the same change — shrink-only, so invariant by D21's predicate | proves declaration; asserts nothing about whether the declared backstop works (header says so) |
| 8 | `check_token_quality_golden` | structure | unknown rule ids, bad scenarios, a `labelled` task without anchors | `internal/bench/corpora/token-quality-golden.yaml`, `dist/router.json` | needs `dist/router.json` (prerequisite) | edits | **invariant** | header: "Structural errors … always fail" | proves |
| 8 | | coverage and stubs | uncovered rules and stub tasks | same | default mode | labelling work | **observation** | header: "an unfilled (`stub`) task or an uncovered rule is REPORTED, not a failure, by default" | reports |
| 9 | `check_council_layout` | placement | council artefacts only in canonical or allowlisted directories | **the working tree on disk** under `agents/`, `runtime/` and `audits/` exempt | differs by environment: a local tree with untracked files sees more than a CI checkout | untracked local files | **invariant**, with an applicability note | fixed placement rule, no baseline; the D14 abstention is explained by the environment dependence, not by the class | proves for the tree it sees |
| 10 | `check_knowledge_cards` | C1–C5 | size, pointer, pointer resolution, trust tag, observed_at span ≤ 7 days | `agents/knowledge/*.md`, git ancestry | always; C3 live URL only with `--check-urls`, C6 only with `--strict` | card edits | **invariant** | each is an error; the 7-day span compares recorded timestamps, not the clock | proves |
| 10 | | freshness | newest `observed_at` older than `--freshness-days` | same, clock | only when the flag is set; default off | the calendar | **observation** | source: "Honest freshness signal (NOT a failure)" | reports |
| 11 | `check_public_links` | stability-tier links | public-surface links into `docs/contracts/` respect the target's `stability:` | README, AGENTS.md, architecture doc, contract frontmatter | always | doc edits | **invariant** | errors fail, no baseline | proves |
| 11 | | warnings | softer link findings | same | always | doc edits | **observation** | printed as warnings, exit 0 | reports |
| 12 | `lint_agents_layout` | top-level allowlist | every top-level entry under `agents/` is allowlisted | **the working tree on disk**, `ALLOWED_SOURCE_DIRS` in source | differs by environment, like row 9 | new directories, local files | **invariant**, with an applicability note | fixed allowlist in source; extending it is an edit, not a baseline refresh | proves for the tree it sees |
| 13 | `lint_eval_freshness` | eval attached | in-scope skills carry `upstream.last_eval` with `sha_at_eval == upstream.sha` | `src/skills/*/data/manifest.json` | in scope only when the skill ships triggers and a pinned corpus | corpus SHA bumps | **invariant** (not time-based despite its name) | header: SHA equality, no clock | proves the record exists; asserts nothing about the eval |
| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** with a numeric bound | fixed bound in source; no named party accepts a risk, so it is not a tolerance (D14's rule) | proves |
| 15 | `lint_readme_serial_comma` | serial comma | no comma before a final "and"/"or" in README prose | README.md | always | README edits | **invariant** | fixed rule | proves |
| 16 | `check_composite_arming` | arming verdict | whether ≥ 10 composite readings from ≥ 2 sessions exist | `agents/evidence/hook-composite-readings.jsonl` | always | new bench readings | **observation** | header: "'not yet' is a successful measurement, never a build failure" | reports |
| 16 | | store readable | the evidence store exists and parses | same file | always | a missing or malformed store | — (evaluation state, not a class) | D24: missing evidence is an evaluation state; today exit 1 conflates it with a failure, which the experimental collector's `not-evaluated: evidence-missing` would separate | — |

## Totals

- 23 aspect rows over 16 checks.
- **invariant 17** (one of them time-qualified, two with an environment
  applicability note);
- **snapshot 1** (`check_gate_completeness`, adoption ratchet);
- **observation 4** (token-golden coverage, knowledge-card freshness,
  public-link warnings, composite arming); of these only composite arming is
  red today;
- **tolerance 0** (no row has a named risk owner);
- **1 evaluation state**, not classified.

All three D14 abstentions now carry a provisional class:

- `check_council_layout` is an invariant. The abstention was its environment
  dependence, not ambiguity of class.
- `check_knowledge_cards` is an invariant, with an observation aspect.
- `check_composite_arming` is an observation, plus an evaluation state.

## What this ledger does not decide

- **Gate membership.** Classification is not gate membership (D14, D22). An
  observation row says what the check's own contract claims. It does not demote
  anything. Demotion is 7.2, and its own rule says every demotion is recorded
  with its reason.
- **Refresh authority for the one snapshot.** Who may raise the
  `check_gate_completeness` baseline is a governed act. D24 makes
  `refresh_authority` a governed assertion, and independent approval of it is
  owner-reserved.
- **Truthfulness.** For every row, "proves" means the script computes the
  property from files it reads. It does not mean an independent party verified
  the computation.

## Unresolved, and who decides

| Question | Needs |
|---|---|
| Is the environment dependence of rows 9 and 12 an applicability condition to record, or a defect to fix (scan tracked files only)? | council (reversible, technical) |
| Should `check_composite_arming` exit 0 when its store is missing, as its own header says, or keep exit 1? | council; the header and the observed behaviour disagree |
| Who may refresh the `check_gate_completeness` baseline upward? | owner-reserved for independent approval (`external-bootstrap-boundary-for-phases-2-3`); council for a provisional rule |
| Promotion of any row into a governed registry | owner-reserved second principal |
