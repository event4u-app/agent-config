<!-- evidence-type: analysis -->

# Thirteen of sixteen, and three honest abstentions

**Date:** 2026-10-10 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: classification convergent on all 16; step completion GREENLIGHT WITHHELD by both seats**

Executes step 7.1 of `road-to-authority-routing-mechanism`, which carries
defect 6 of the authority-routing record: *"Whether these are invariants,
snapshots, tolerances or observations changes what the gate attests."*

## The measurement, including the run that was thrown away

Every `check_*.ts` and `lint_*.ts` under `src/scripts/` was run against a clean
worktree at `origin/main` (`bbe5b73be`).

**The first sweep returned exit 127 for all ~300 scripts and was discarded.**
macOS ships no `timeout(1)`, so nothing had run; reporting that as "every gate
is red" would have been the largest false finding available. Two known-green
controls were then used to prove the harness before the sweep was repeated.

Building the projections (`dist/`, `.claude/`) moved **three** checks from red
to green — `check_bridge_derivation`, `check_host_loadability`,
`check_rule_projection_integrity` — identifying them as artefacts of the bare
worktree rather than trunk state.

Two further classes were excluded, and the exclusions carry as much weight as
the inclusions:

- **Needs an argument** (10 checks) — they print a usage line. They were called
  wrong; they are not red.
- **Needs a build step** (8 checks) — they fail on a missing generated input.
  Red on build order, not on tree state.

What remains is **16 checks genuinely red on the trunk**.

## The verdict — identical in both seats, on all sixteen

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

**Zero tolerances and zero observations.** Both seats: a tolerance needs a
stated bound AND a named party accepting the residual risk, and none of the 16
has either; an observation would bury a live defect a reader must act on.

## The one snapshot, and what governs it

`check_gate_completeness` reads **237 violations against a baseline of 214 — 23
new**. Both seats classify the baseline as a snapshot and refuse to let that
licence a refresh now:

- **Refresh trigger:** only a reviewed change to the population, scope, counting
  semantics or repository partition that makes the old count non-comparable.
- **Refresh method:** enumerate the 23 by rule, distinguishing newly-detected
  pre-existing debt from newly-introduced defects.
- **Authority:** the agent may calculate and propose; a gate-policy CODEOWNER or
  the authority-record owner approves. Never the agent that calculated it.
- **Forbidden:** refreshing because violations rose, or to make the trunk green.
- **Blocked now:** anthropic — *"If any are from degraded coverage (not new
  rules), they're invariant failures and must be fixed before refresh is even
  considered."*

openai records a dissent worth keeping: **#1 contains two objects.** The numeric
debt baseline is a snapshot; the prohibition on unjustified new debt is an
invariant. *"A single class field cannot faithfully represent both unless the
registry separately models the measurement and its governing policy."*

## The three abstentions, and exactly what each needs

Both seats abstained on the same three, and anthropic names the reason as a
principle: *"'Layout violations' does not reveal whether these are schema
requirements or debt measurements."*

- **#9 `check_council_layout`** — the exact layout predicates; whether the
  expected layout is policy-derived or baseline-derived; representative
  violations.
- **#10 `check_knowledge_cards`** — the three predicates, their normative source,
  and whether any concern freshness or scoring rather than schema.
- **#16 `check_composite_arming`** — whether the JSONL is committed evidence,
  generated build output or runtime state; its producer; when its absence is
  permitted.

## Why step 7.1 does NOT close on this round

**Both seats withhold greenlight, for the same reason, and it is the right
reason:** deriving a check's semantics from its observed failure grants the
classifier discretion exactly when a red trunk creates pressure to weaken
enforcement. openai: *"I would change my mind only if each script already has a
stable, reviewed contract from which class, prerequisites, gate membership and
refresh authority can be mechanically derived."* anthropic asks for the same
contracts in the same words.

Two further findings, neither asked for:

- **The taxonomy contains a contradiction.** The record says *"the agent may
  refresh clearly observational data"*, while the step's own vocabulary makes
  **snapshots** the refreshable class and **observations** the non-blocking one.
  openai's repair: observations are reported, never refreshed; snapshots are
  refreshed under explicit authority; invariants change only by changing the
  policy; tolerances need bound, owner, rationale and expiry.
- **Classification is not gate membership.** anthropic's dissent: the step
  conflates *what kind of requirement is this* with *should this block
  completion*. Some of the 16 may be diagnostics worth running and not worth
  blocking on, and that is a separate decision this round did not take.

Both also note the exclusions prove the sweep **lacks an execution contract**:
that a check needs an undocumented argument or build step is not evidence it is
healthy.

## Prompt provenance

Committed beside this record as
`live-tree-check-classification-20261010.question.md`. It defined the four
classes, stated what makes **each** classification wrong, disclosed the
discarded first sweep, and forbade by name the two easy moves — classifying #1
as a snapshot because 23 violations are inconvenient, and giving one blanket
class to all 16. Both seats answered per check and both declined the blanket.
