---
adr: 227
status: accepted
date: 2026-08-13
decision: paths-scoping-is-saturated-not-a-corpus-lever
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopens on either of two observations, not on a calendar. First — a rule is
  added or rewritten that carries a truthful path surface AND an obligation that
  does not need to survive `/compact`: that rule is a legitimate `paths:`
  candidate, and if such rules accumulate past roughly 10 % of the projected
  corpus the saturation finding no longer holds. Second — the host changes the
  `/compact` semantics recorded in
  `agents/evidence/analysis/claude-code-rules-dir-contract.md`, so that a
  path-scoped rule is re-injected after compaction: that removes the correctness
  objection and re-opens the conversion of keyword-triggered rules on its own
  merits. A third, weaker trigger: the host gains a semantic (non-path) scoping
  key, which would be a different mechanism and needs its own measurement.
---

# ADR-227 — `paths:` scoping is saturated; the corpus lever is projection-set selection

## Status

**Accepted** · 2026-08-13. Records the outcome of
`road-to-always-loaded-corpus-scoping`, which was pre-registered to accept "no"
as a result. The result is neither the expected "no" nor the hoped-for "yes, by
N %": the mechanism works and is already fully used.

## Context

Two gates measure the always-loaded rule corpus from different ends and both are
strained. `check_token_regression` reports `eager_rule_load` at **108,742**
exact-BPE tokens against a 106,704 baseline, leaving 3.1 % of its 5 % allowance —
so the contributor who happens to cross the line pays a condensation round for
inherited growth. `check_standing_rule_delivery` is **red at 196,959 / 110,000
(179.1 %)** on maintainer machines, because the host loads `~/.claude/rules/` and
`<project>/.claude/rules/` both with no dedup.

ADR-226 declined layer suppression *in this repository*, because the project
layer is the sole carrier of `source-of-truth.md`. That left corpus size as the
only lever here, and this roadmap asked whether `paths:` scoping could pull it.

Its pre-registered Risk 1 was that `paths:` would be **projection-inert**, by
analogy to `triggers:` having no runtime consumer on any host.

## Decision

**Reject `paths:` scoping as a corpus-shrinking lever, on saturation rather than
on inertness. Record projection-set selection — the already-built workspace and
pack axes — as the measured remaining lever, and leave the decision to activate
either one to its own change.**

Three findings carry it. The full measurement, with per-rule tables, is
`agents/evidence/analysis/always-loaded-corpus-scoping-verdict.md`.

**1. `paths:` is not inert — Risk 1 is false.** The host reads `paths:` (probed
fixture `claude-code-rules-dir-contract.md`, host 2.1.226, gate outcome A), and
`condense.ts:1508` `_emit_claude_rule` already emits it, derived from each rule's
`triggers:` by `derive_trigger_globs`. The analogy failed because the emitter
*translates* agent-config's unread vocabulary into the one key the host reads.

**2. The axis is saturated at 100 % conversion.** Exactly **25 of 116** source
rules declare a path-shaped trigger (`file_pattern` / `path_prefix`), and all 25
carry `paths:` in the projection. Of the 110 projected rules, 25 (17,628 tok) are
scoped and 85 (68,863 tok) load unconditionally — 9 of those legitimately
(kernel / `alwaysApply`), leaving 76 rules and 62,511 tok (72.3 %) that *look*
addressable. **None of the 76 declares a path-shaped trigger**; the kind census
is `keyword` 73, `phrase` 51, `file_pattern` 0, `path_prefix` 0. There is nothing
left to convert.

**3. Converting keyword-triggered rules is a correctness regression, not a
saving.** A `keyword` trigger fires on intent anywhere in a turn; a `paths:` glob
fires when the host reads a matching file. Authoring a glob for a rule with no
file surface relocates its delivery instead of narrowing it — and the probed
fixture records that path-scoped rules are **not re-injected after `/compact`**,
so an obligation that must survive compaction cannot be path-scoped at all.
`_emit_claude_rule`'s own docstring already refuses this for kernel rules
(*"a correctness regression dressed as a byte saving"*); the argument does not
stop at the kernel boundary, it stops wherever compaction survival matters, which
is most of the 76. The single truthful candidate found by inspection,
`preservation-guard`, carries 1.4 % of the corpus and is itself compaction-
sensitive.

## Consequences

- **Phase 3's pilot did not run, and that is the recorded outcome rather than a
  deferral.** Its pre-registration required declaring a target set of clearly
  surface-scoped rules *before* editing; the set is empty. Declaring one anyway
  by authoring globs is the goalpost-shift the pre-registration exists to
  prevent.
- **The two strained gates stay strained by this decision.** Nothing here moves
  `eager_rule_load` or `standing_rule_delivery`. The next contributor meeting the
  5 % cliff should read this record first: condensing their own rule is the
  available move, and it is not because scoping was untried.
- **The measured remaining lever is projection-set selection, and it is larger
  than `paths:` would have been.** Both axes are already built
  (`rule_in_scope`, `src/install/ruleInScope.ts:107`) and both ship inactive,
  because `projection.rule_workspaces` / `projection.rule_packs` resolve to
  `null` when absent and `null` means no filtering. Measured on this checkout:

  | Configuration | Pruned | Share of projected corpus |
  |---|---:|---:|
  | `projection.rule_packs: auto` | 6,458 tok (8 rules) | 7.5 % |
  | `projection.rule_workspaces: [agent-config-maintainer]` | 34,373 tok (38 rules) | 39.7 % |
  | both | 37,067 tok (42 rules) | 42.9 % |

- **Activating either axis is deliberately NOT decided here.** It changes what
  every install receives, which is a consumer-visible decision and a maintainer
  call — and the roadmap's own Phase 1 Step 4 sends projection-set selection to a
  separate roadmap precisely so that converting this one in place cannot hide
  that the original hypothesis was refuted. The numbers above are the input that
  decision needs; the decision is not taken by measuring it.
- **ADR-226's second review trigger does not fire.** It reopens when *"the
  always-loaded corpus shrinks enough that the doubled delivery fits under the
  cap"*. This roadmap shrank nothing, so layer suppression stays declined for
  this repository on the grounds ADR-226 already recorded.

## Alternatives considered

- **Author `file_pattern` triggers for the 76 keyword-triggered rules.**
  Rejected on the two correctness grounds in Decision §3, not on effort. This is
  the option a reader is most likely to reach for; the `/compact` semantics are
  the reason it is wrong.
- **Scope kernel rules anyway, accepting the compaction loss.** Rejected — an
  Iron-Law obligation that silently stops applying after `/compact` is the
  invisible failure the roadmap's own Risk 2 names, and no token figure buys it.
- **Activate `projection.rule_workspaces` in the same change.** Rejected as
  scope: it is a different mechanism with a consumer-visible blast radius, and
  bundling it would let a 42.9 % headline stand in for a hypothesis that was
  actually refuted.
- **Re-anchor `token-baseline.json` to buy room.** Rejected — the roadmap's own
  framing is that the previous re-anchor "bought room; it did not fix the shape",
  and a re-anchor with no adoption behind it is exactly the silent baseline bump
  the file's convention forbids.

## References

- `agents/evidence/analysis/always-loaded-corpus-scoping-verdict.md` — Phase 1
  verdict and Phase 2 inventory, with the per-rule tables.
- `agents/evidence/analysis/claude-code-rules-dir-contract.md` — the probed host
  fixture; source of the `paths:` semantics and the `/compact` constraint.
- `docs/decisions/ADR-226-package-repo-keeps-both-rule-layers.md` — why layer
  suppression is declined here, which is what made corpus size the only lever.
- `src/scripts/condense.ts:1332,1508` — `derive_trigger_globs`,
  `_emit_claude_rule`.
- `src/install/ruleInScope.ts:107` — the workspace / pack / role scope predicate.
- `src/config/budgets.yml` — `standing_rule_delivery` derivation and cap.
