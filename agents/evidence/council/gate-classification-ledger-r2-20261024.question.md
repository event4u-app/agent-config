<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (eighth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger
     and would implement step 7.2 from the verdict. -->

# Step 7.1: does revision 2 of the classification ledger apply the corrections, and may its verdict be recorded as 7.1's classification?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Do not assume facts not stated here; where a fact is missing,
say so and say what would settle it. The agent asking you wrote the ledger and
would implement step 7.2 from your verdict, so treat its proposals with
suspicion and say where they overreach.

## The step and its exit criterion, verbatim

Step 7.1: "Run the council to classify each live-tree measurement check
currently pinned red on the trunk: invariant (must always hold), snapshot (a
point-in-time reading, refreshable), tolerance (a bounded range with an
accepted-risk waiver …), or observation (informational, never blocking).
Record the verdict per check."

Phase exit: "every live-tree check pinned red at Phase 7 start carries a
classification in 7.1's record."

## What the previous round required, and nothing else

Earlier today the same two seats reviewed revision 1 and rejected closure. They
agreed on most rows and required exactly these corrections:

1. row 1's adoption ratchet is a shrink-only invariant, not a snapshot;
2. row 10 split per check (C1–C6);
3. row 11's warnings named;
4. row 16 split into missing, malformed and insufficient evidence;
5. rows 9 and 12 record a canonical tracked-file scope, because scanning the
   disk is a measurement-scope defect.

Their other points went to step 7.2, not 7.1:
- an inventory of invocation modes and consumers;
- a rollback envelope for demotions;
- a bootstrap deadline for the composite store;
- the scope fix in code.

Raising a baseline or excepting a shrink-only list is owner-reserved.

## Revision 2, verbatim

## The ledger — revision 2

Revision 2 applies the 2026-10-24 ledger round (D31). Both seats rejected
closure of revision 1 and agreed on five corrections, all applied here:

- row 1's ratchet is an invariant, not a snapshot;
- row 10 is split per check, C1 to C6;
- row 11's warning property is named;
- row 16 separates missing, malformed and insufficient evidence;
- rows 9 and 12 record a canonical measurement scope.

The last column now says **computes** instead of *proves*. The script
computes the property from files the same repository authority controls, and
no independent party verifies it (openai's hardest pushback).

| # | Check | Aspect | Property measured (from source) | Inputs / trust dependencies | Applicability / invocation mode | What makes it vary | Class | Evidence for the class |
|---|---|---|---|---|---|---|---|---|
| 1 | `check_gate_completeness` | adoption ratchet | un-adopted gate count ≤ the recorded count | `src/config/gate-violation-baselines.json` (governed input), gate sources | always | new gates, adoption | **invariant** (shrink-only) | header: the count "may only go down". No authorised upward refresh is documented, and an edit's technical ability to raise the number is not authorisation |
| 1 | | exemption marker | every `// ledger-exempt:` carries a reason of minimum length | gate sources | always | gate edits | **invariant** | "an empty or near-empty reason is a hard failure"; form only, the header says truth is a human read |
| 1 | | scan scope | the gate scanned a non-dead scope (the CI-registered gate estate) | `assertScanned` | always | tree layout | **invariant** | dead scope throws, no baseline |
| 2 | `lint_ticked_unmet_criteria` | ticked-vs-NOT-met | no `[x] AC` whose own text says `NOT met` | roadmaps, frozen digest list in source (governed input) | always | roadmap edits | **invariant** | frozen, digest-pinned exemptions; an unmatched entry is an error, so the list only shrinks |
| 3 | `check_rule_invariants` | kernel strings present | each string of `tests/golden/invariants.json` is in the kernel rule's source and its `dist/` projection | `tests/golden/invariants.json` (governed input), `src/rules/`, `dist/agent-src/rules/` | needs the projection built | a rule reworded; the expectation file edited | **invariant** | no baseline; the expectation file is the contract and shares edit authority with the rules (weak independence) |
| 4 | `check_augment_description_cap` | description length | every `type: auto` rule description ≤ `DESC_CAP` | `src/rules/*.md` | always | rule edits | **invariant** | fixed cap |
| 5 | `check_trigger_evals` | freshness | `last_eval` present and its age in days ≤ 90 | `triggers.json`; clock `asOf()` (pinnable through `AC_AS_OF` or `--today`), local calendar date of the runner | always | the calendar | **invariant, time-qualified** | D24. Window 90 d. Day 90 passes, day 91 fails (`age > 90`). No grace. The runner's local time zone decides the date. A `last_eval` in the future is not rejected by the code (unspecified) |
| 5 | | structure | non-empty queries, each `q` and boolean `trigger`, both classes present | same | always | edits | **invariant** | fixed rule |
| 6 | `lint_subagent_determinism` | schema consts | five determinism rules on `src/subagents/*.md` | same | always | edits | **invariant** | fixed rules |
| 7 | `lint_rule_enforcement_declaration` | declaration | a rule outside the legacy list declares `enforced_by:`; `none` states its gap in the body | `src/rules/`, `src/config/rule-enforcement-baseline.json` (governed input) | always | rule additions | **invariant** (shrink-only list) | list "may only shrink"; a stale entry must leave in the same change; declaration only, not that the backstop works |
| 8 | `check_token_quality_golden` | structure | unknown rule ids, bad scenarios, a labelled task without anchors | golden YAML, `dist/router.json` | always, every mode | edits | **invariant** | "Structural errors … always fail" |
| 8 | | coverage and stubs — default mode | uncovered rules and stub tasks | same | invocation without `--require-complete` | labelling work | **observation** | "REPORTED, not a failure, by default" |
| 8 | | coverage and stubs — `--require-complete` | no stub, no uncovered rule, required scenarios present, for the given `--scope` | same | invocation with `--require-complete` (the operator-completion gate) | labelling work | **invariant** in that mode | the header names it the completion gate, which fails on any remaining stub |
| 9 | `check_council_layout` | placement | council artefacts only in canonical or allowlisted directories, **over tracked files** | `agents/` | canonical scope: files tracked by git, plus staged additions. Today the script reads the disk, including untracked files | edits | **invariant** over the canonical scope | fixed rule. The disk scope is a measurement-scope defect (both seats). The fix is owed (D31). A local workspace-hygiene reading over untracked files would be a separate **observation** |
| 10 | `check_knowledge_cards` | C1 size | a card ≤ 150 lines | `agents/knowledge/*.md` (external arm) | always | card edits | **invariant** | error |
| 10 | | C2 pointer present | `links.authoritative` in frontmatter | same | always | card edits | **invariant** | error |
| 10 | | C3 local pointer | a local pointer path exists | same + the tree | always | card or tree edits | **invariant** | error |
| 10 | | C3 live URL | the URL answers | same + network | only with `--check-urls` | the remote site | **observation** | network-dependent and opt-in; not reproducible offline |
| 10 | | C4 trust tag | `trust` present; `type: anti-hallucination` | same | always | card edits | **invariant** | error |
| 10 | | C5 evidence consistency | distinct `source_version`s form a git-ancestry chain; `observed_at` span ≤ 7 days | same + git history | always | card edits, history | **invariant** | error. The span compares recorded timestamps, not the clock |
| 10 | | C6 strict sources | `source=<path:line>` references exist and are non-empty | same + the tree | only with `--strict` | tree edits | **invariant** in that mode | error when enabled |
| 10 | | freshness | newest `observed_at` older than `--freshness-days` | same + clock | only with the flag; default 0 = off | the calendar | **observation** | "Honest freshness signal (NOT a failure)" |
| 11 | `check_public_links` | stability-tier links | the public surface never links to an `experimental` contract (and the other error-severity rules) | README, AGENTS.md, architecture doc, contract frontmatter | always | doc edits | **invariant** | error severity, exit 1 |
| 11 | | beta marker — default mode | a link to a `beta` contract carries a visible `(beta)` or `[beta]` marker | same | invocation without `--strict` | doc edits | **observation** | warning severity, exit 0 |
| 11 | | beta marker — `--strict` | same property | same | invocation with `--strict` | doc edits | **invariant** in that mode | warnings fail with `--strict` |
| 12 | `lint_agents_layout` | top-level allowlist | every top-level entry under `agents/` is allowlisted, **over tracked files** | `agents/`, `ALLOWED_SOURCE_DIRS` in source | canonical scope as row 9; today it reads the disk | new directories | **invariant** over the canonical scope | fixed allowlist. The same scope defect as row 9, owed |
| 13 | `lint_eval_freshness` | eval attached | `upstream.last_eval` present with `sha_at_eval == upstream.sha` | manifests | in scope when a skill ships triggers and a pinned corpus | corpus SHA bumps | **invariant** | SHA equality, no clock |
| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | no named risk owner, so not a tolerance |
| 15 | `lint_readme_serial_comma` | serial comma | no serial comma in README prose | README.md | always | README edits | **invariant** | fixed rule |
| 16 | `check_composite_arming` | arming verdict | ≥ 10 usable composite readings from ≥ 2 sessions | the composite store | a valid store exists | new readings | **observation** | "'not yet' is a successful measurement, never a build failure" |
| 16 | | store malformed | the store exists and every line parses | same | the store exists | a corrupt append | **invariant** | a corrupt store is a broken input contract (both seats); today exit 1 |
| 16 | | store absent | — | same | no store file | bootstrap | **evaluation state** `not-evaluated: evidence-missing` until a bootstrap deadline; after it, an invariant failure | D24; the deadline itself is undecided (D31) |

## Totals — revision 2

32 aspect rows over 16 checks:

- **invariant 26**. Three of them hold only in a named invocation mode: `--require-complete`, and `--strict` on two checks (C6 and the beta marker). One is time-qualified. Two hold over the canonical tracked-file scope, with a scope fix owed.
- **observation 5**: token-golden default coverage, C3 live URL, card freshness, the beta marker in default mode, and composite arming. Row 9 also names a local-hygiene reading over untracked files. No script measures it yet, so it is not counted as a row.
- **snapshot 0**.
- **tolerance 0**.
- **evaluation state 1**: the composite store absent.

Every one of the 16 checks carries at least one classified aspect, and no aspect is left without a class or a named evaluation state. The three D14 abstentions are resolved as follows:

- `check_council_layout`: invariant over tracked files;
- `check_knowledge_cards`: split into seven aspects;
- `check_composite_arming`: an observation, an invariant and an evaluation state.

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

## Unresolved, and who decides — revision 2

| Question | Needs |
|---|---|
| Fix rows 9 and 12 to scan tracked files plus staged additions | agent, under existing authority; it narrows a scope to the canonical one and weakens no rule. Owed before 7.2 relies on either check |
| The bootstrap deadline after which an absent composite store fails | council (a reversible value) |
| Any authority to raise the `check_gate_completeness` baseline, or any exception to a shrink-only list | owner-reserved second principal (`external-bootstrap-boundary-for-phases-2-3`); until then the lists are shrink-only invariants |
| Demoting an observation aspect to non-blocking (7.2) | council, after the invocation-mode and consumer inventory; each demotion carries old behaviour, new behaviour, reason, consumers and a rollback condition |
| Promotion of any row into a governed registry | owner-reserved second principal |

## Questions

**Q1 — The five corrections.** Is each applied correctly? For any that is not,
say what is still wrong.

**Q2 — New errors.** Did revision 2 introduce a wrong class, a bundled aspect or
an unsupported claim anywhere else?

**Q3 — Closure.** If this revision is recorded as the verdict, is 7.1's exit
criterion met? Answer yes or no. If no, name the single thing still missing,
and say whether only the owner-reserved second principal can supply it.

**Q4 — 7.2's first item.** Name the first item of step 7.2 that may proceed
under existing authority.

Answer each question with a recommendation, the strongest objection to it, and
your confidence.
