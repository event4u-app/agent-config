# ADR-003 — Flat Cluster Sub-Commands and Colon-Canonical Invocation

- **Status:** Accepted (2026-05-07)
- **Phase:** Command-cluster contract (Phase 2 follow-up)
- **Supersedes:** none — extends the locked cluster set in
  `docs/contracts/command-clusters.md`.
- **Related:** `roadmap-process` migration (2026-05-07) — the trigger
  that forced the decision; `contexts/execution/roadmap-process-loop.md`
  (the shared mechanics extracted alongside).

## Context

`roadmap-execute` was being replaced by an autonomous-execution surface
with three scopes: single step, single phase, full roadmap. The
question was where those three commands live in the cluster catalog.
Four shapes were on the table:

- **A — separate `/roadmap-process` cluster.** Two top-level clusters
  (`/roadmap` for authoring, `/roadmap-process` for execution).
- **B — sub-sub-commands** (`/roadmap:process:phase`). One cluster,
  two-level dispatch.
- **C — flat under `/roadmap`, no verb** (`/roadmap:step` ·
  `/roadmap:phase` · `/roadmap:full`). Verb hidden in cluster
  description.
- **D — flat under `/roadmap`, verb fused with scope**
  (`/roadmap:process-step` · `/roadmap:process-phase` ·
  `/roadmap:process-full`). One cluster, one dispatch level, composite
  sub-name carries the verb.

Existing infrastructure assumed a single dispatch level: the contract
table at `docs/contracts/command-clusters.md`, the linter
`scripts/lint_no_new_atomic_commands.py`, and the dispatcher-shape
checker `scripts/check_cluster_patterns.py` all parse one column of
sub-names per cluster.

## Decision

1. **Cluster depth stays flat.** A cluster has exactly one level of
   sub-commands. No sub-sub-commands. Option B is rejected.

2. **Verb-and-scope sub-commands use a composite name** joined by `-`
   (`process-step`, `process-phase`, `process-full`). The verb stays
   visible in the autocomplete list; symmetry with sibling
   sub-commands (`/roadmap:create`) is preserved as
   verb-or-noun-per-sub. Option D wins over C.

3. **Colon is the canonical invocation form** (`/<cluster>:<sub>`).
   The space-separated form (`/<cluster> <sub>`) remains a
   first-class equivalent — both forms route to the same dispatcher.
   Autocompletion-aware UIs (Claude Code picker, IDE slash-menus,
   shell completers) MUST surface the colon form because it stays a
   single token.

4. **Future verb+scope clusters follow the same shape.** Any future
   cluster with multiple verbs (e.g. an authoring verb and an
   execution verb) uses composite sub-names rather than introducing a
   second cluster or a second dispatch level.

## Rationale

- **Option A (separate cluster)** scatters one domain across two
  top-level surfaces. Users have to remember which cluster owns
  which verb; the catalog grows without adding capability.
- **Option B (sub-sub)** would be the first two-level dispatcher in
  the repo. Cost: contract change in `command-clusters.md`,
  linter change in `lint_no_new_atomic_commands.py` (parse a second
  column), pattern-checker change in `check_cluster_patterns.py`
  (allow nested dispatch sections), plus an ADR to set the precedent
  — for a cohesion benefit that Option D delivers at zero
  architectural cost.
- **Option C (no verb)** breaks symmetry: `/roadmap:create` is a
  verb, `/roadmap:phase` is a scope. The mental model becomes
  inconsistent in the same cluster.
- **Option D (composite verb-scope)** keeps the cluster flat, keeps
  the verb visible, costs nothing in the linter or contract
  parser (one row, four sub-names, kebab-case as before), and
  scales to any future verb+scope cluster.

The colon form was already canonical for flag-clusters
(`/commit:in-chunks`, `/create-pr:description-only`). Promoting it
to the canonical form for dispatcher-clusters too unifies the
catalog: every sub-command is a single token.

## Consequences

- **Pro:** Zero architectural cost. The locked contract, both
  linters, the dispatcher pattern checker, and the routing rule all
  keep working unchanged. The cluster row in
  `docs/contracts/command-clusters.md` extends with three new
  sub-names.
- **Pro:** Single-token autocompletion across the entire command
  surface. Greppable in chat history and logs.
- **Pro:** Domain cohesion — `/roadmap:*` covers the full
  authoring + execution lifecycle.
- **Con:** Sub-names get longer when the verb is non-obvious from the
  cluster. `/roadmap:process-phase` is 24 chars vs.
  `/roadmap-process:phase` (Option A, 23 chars) or
  `/roadmap:phase` (Option C, 16 chars). Acceptable trade for
  symmetry and zero contract churn.
- **Con:** A cluster cannot grow into a true two-level surface
  without revisiting this ADR. Rolling back to Option B is the
  escape hatch if a future cluster genuinely needs nested verbs.

## Rollback

If a future cluster grows past ~8 sibling sub-commands and the
composite-name pattern produces ambiguous or unreadable
sub-commands, revisit by:

1. Splitting the cluster into two flat clusters (Option A on a
   case-by-case basis), or
2. Introducing sub-sub-commands as a deliberate contract change —
   updating `command-clusters.md`, `lint_no_new_atomic_commands.py`,
   `check_cluster_patterns.py`, and superseding this ADR.

Both moves are reversible. This ADR locks the default, not the
ceiling.

## See also

- [`docs/contracts/command-clusters.md`](../contracts/command-clusters.md)
  — locked cluster set + sub-command naming contract.
- [`.agent-src.uncondensed/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md`](../../.agent-src.uncondensed/contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md)
  — runtime routing semantics and the colon-canonical rule.
- [`.agent-src.uncondensed/contexts/execution/roadmap-process-loop.md`](../../.agent-src.uncondensed/contexts/execution/roadmap-process-loop.md)
  — the shared mechanics that motivated the cluster shape.
