---
adr: 226
status: superseded
date: 2026-08-13
decision: package-repo-keeps-both-rule-layers
supersedes: —
superseded_by: ADR-236
phase: —
type: structural
review_trigger: >-
  Reopens on either of two observations, not on a calendar. First — the project
  rule layer stops being the sole carrier of a maintainer-scoped rule: if
  `source-of-truth.md` and every other `workspaces: [agent-config-maintainer]`
  rule also reaches the global layer, the asymmetry this record rests on is gone
  and `--layer=global` costs nothing. Second — the always-loaded corpus shrinks
  enough that the doubled delivery fits under the
  `standing_rule_delivery` cap without suppressing a layer at all, which is what
  the corpus-scoping roadmap is measuring. A third, weaker trigger: the host
  gains real dedup across the two layers, which would dissolve the problem
  rather than answer it.
---

# ADR-226 — This repository keeps both rule layers; `--layer` suppression is for consumers

## Status

**Superseded** · by [ADR-236](ADR-236-one-artefact-one-layer.md), 2026-08-19.
Accepted 2026-08-13.

**What replaced it, and what did not.** ADR-236 partitions the two layers — every
artefact is delivered from exactly one, chosen by `workspaces:` — so the question
this record answered ("which layer wins") no longer arises. That is an owner
decision about delivery topology, **not** a refutation of the reasoning below:
both halves were re-verified on a freshly regenerated tree and both hold.
`source-of-truth.md` is still the only project-only rule, and ADR-236 keeps it in
the project layer, which is what this record was protecting. The structural
generated-vs-installed divergence is confirmed and larger — 2 rules then, **110**
now.

**Two figures here have expired; do not re-derive them from this file.**
`--layer=project` is recorded below as costing 22 rules — on a fresh tree it costs
**5**. And the "two shared rules already differ in body" reason is now **0** prose
divergence; the gate still refuses a suppression, but over frontmatter rather than
prose. Neither moved the conclusion at the time, and neither survives as a number.

Read together with
[`single-delivery-partition-census.md`](../../agents/evidence/analysis/single-delivery-partition-census.md),
whose mandatory projection-shape field exists because a stale reading of these same
two layers produced two refuted analyses.

Original status note, kept: records why the standing-rule-delivery remedy the
tooling recommends is declined *in this repository specifically*, so the next
session that reads the warning does not re-derive the answer or apply it and
lose a rule.

## Context

`check_standing_rule_delivery` is red on maintainer machines — measured
2026-08-13 at 185,207 tokens against a 110,000 cap — because Claude Code loads
`~/.claude/rules/` and `<project>/.claude/rules/` **both**, user layer first,
with no dedup. `agent-config routing:doctor` reports the same condition and
prints the remedy directly: *"91 rule(s) delivered twice (~77,033 tok) … run
`agent-config install --layer=<global|project>`"*.

Taking that advice inside this repository was measured before it was applied,
and the measurement is what produced this record:

| Layer | Rules | Tokens |
|---|--:|--:|
| global (`~/.claude/rules/`) | 114 | 107,204 |
| project (`<repo>/.claude/rules/`) | 92 | 78,003 |

The global layer is a near-perfect **superset** of the project layer, with
exactly one exception: **`source-of-truth.md` exists only in the project layer.**
That is not an accident of staleness — the rule is
`workspaces: [agent-config-maintainer]`, so it is projected into this repository
and, correctly, nowhere else.

## Decision

**This repository keeps both rule layers.** `--layer=global` and
`--layer=project` are the right remedy for a *consumer* project and are not
applied here.

The reasoning is asymmetric, which is why a global default would be wrong in
both directions:

- **`--layer=global` costs `source-of-truth.md`** — the rule that says never edit
  a generated projection, in the one repository where every generated projection
  lives. Suppressing the only layer that carries it is precisely the "obligation
  only the suppressed copy carries" that `install.ts::_gate_rule_layer_overlap`
  refuses on, and it refuses here regardless: two shared rules already differ in
  body, and the gate declines a suppression over divergence.
- **`--layer=project` costs 22 rules**, among them `session-canary`,
  `self-repair-loop`, `secret-vcs-guard`, `evaluator-independence` and
  `senior-engineering-discipline` — a strictly worse trade.
- **Divergence here is structural, not a defect to repair.** The project layer is
  generated from `src/`; the global layer comes from an installed release. This
  repository is *ahead of its own release by construction*, so "refresh until the
  layers agree" has no fixed point while any rule edit is in flight — which, in
  this repository, is the normal state.

## Consequences

- `check_standing_rule_delivery` stays red on a maintainer machine that has the
  package installed globally. It is a real measurement of a real doubled
  delivery; it is simply not actionable here by layer suppression. Read it as
  *this developer's session pays for two layers*, not as *this repository is
  misconfigured*.
- The gate keeps its value where it matters — a consumer project, where the two
  layers genuinely duplicate and one can be suppressed without losing anything.
- The real lever is the size of the corpus itself, not which copy of it loads.
  That is measured separately, and this record deliberately does not pre-empt its
  outcome.
- Anyone who runs the `routing:doctor` remedy in this repository will lose
  `source-of-truth.md` from their session and will not be told. This record is
  the only warning that exists; nothing enforces it.

## Alternatives considered

- **`--layer=both-acknowledged`** — keeps both layers and states the cost.
  Rejected as a null move: it changes no tokens and only converts a measurement
  into an acknowledgement, which reads as resolution without being one.
- **Refresh the project layer, then suppress** — rejected because refreshing
  raises divergence rather than lowering it here (the tree leads the release),
  and because it writes into the working environment of any parallel session in
  the same checkout.
- **Also project maintainer-scoped rules into the global layer** — rejected:
  `source-of-truth.md` is about *this* repository's projections and would be
  wrong guidance in every consumer project, which is exactly what the
  `workspaces:` scope encodes.

## References

- `src/scripts/check_standing_rule_delivery.ts` — the measurement.
- `src/scripts/install.ts::_gate_rule_layer_overlap` — the divergence refusal.
- `src/scripts/_lib/rule_layer_overlap.ts` — `decideLayerAction`, `refresh_required`.
- `src/config/budgets.yml` — the `standing_rule_delivery` cap and its derivation.
- `src/rules/source-of-truth.md` — the rule the global-layer choice would drop.
