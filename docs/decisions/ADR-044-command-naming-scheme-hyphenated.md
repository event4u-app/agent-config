---
adr: 044
status: accepted
date: 2026-06-03
decision: command-naming-scheme-hyphenated
supersedes: —
superseded_by: —
phase: v6.0.0 · D structural restructure
type: decision
---

# ADR-044 — Command naming scheme: `<pack>-<verb>`, hyphenated, no colon namespacing

## Status

**Accepted** · 2026-06-03. Authored as Phase 4b / Step 11 of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/road-to-6.0.0-d-structural-restructure.md).
Builds on [`ADR-041`](ADR-041-controlled-command-verbs.md) (controlled verb
allowlist — still applies, unchanged) and
[`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) (the `src/domains/<pack>/`
collapse that gives each command a pack-physical home). Sits alongside the
locked-cluster contract ([`command-clusters.md`](../contracts/command-clusters.md)).

## Context

6.0.0-D moves every command into `src/domains/<pack>/<verb>/command.md` — the
path now carries pack ownership. With ownership in the path, the historical
**colon cluster syntax** (`feature:plan`, `git:pr`, `git:pr:create`) is no longer
needed to express grouping, and it actively fights the Claude Code projection.

The naming question was settled by an **authoritative claude-code-guide finding**
plus the AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-03):

1. **Claude Code SHADOWS a bare colon cluster-head** when a same-named
   subdirectory exists. Observed: with `/create-pr` and
   `/create-pr:description-only` both present, the bare `/create-pr` head is
   hidden and only the sub is shown. A cluster head with no default action
   becomes invisible.
2. **Claude Code does NOT support two-colon multi-level invocation**
   (`git:pr:create` ✗). Only a single colon level resolves.

So colon namespacing cannot express the `git/pr/create` depth the domain tree
now has, and bare cluster heads disappear from the surface anyway.

## Decision

1. **`<pack>-<verb>`, hyphenated.** Every project command is invoked as a flat,
   hyphenated name. `feature:plan` → `feature-plan`; `git:pr:create` →
   `git-pr-create`; `git:commit` → `git-commit`. No colon namespacing for
   project commands.

2. **Cluster heads fold away.** A bare orchestrator command with no default
   action is not a visible command. Its sub-commands render as standalone flat
   hyphenated commands. (The *structural* move of head files into the flat layout
   is Step 13; the *behavioral* folding of N routers into one is staged in 6.0.x
   per the scope-line rule, not done here.)

3. **A sub-action is a separate command only if it is a distinct workflow** —
   otherwise it is a **flag** on the parent. `commit --in-chunks`, not
   `commit-in-chunks`, once the merge evidence (Step 13b) confirms the split is
   artificial. Sibling variants that differ only in a parameter are flags, never
   a second command.

4. **The controlled-verb allowlist (ADR-041) still applies, unchanged.** The
   leading token of every visible command must be drawn from
   [`src/config/discovery/command-verbs.yml`](../../config/discovery/command-verbs.yml).
   This ADR governs the *shape* (`<pack>-<verb>`, hyphenated); ADR-041 governs the
   *verb vocabulary*. They compose.

5. **Same short-descriptive-name discipline for skills and rules.** The flat
   `src/skills/` and `src/rules/` library is a single global namespace. Names are
   short, descriptive, and globally unique after normalization (lowercase,
   `_`→`-`) — enforced by the single-namespace collision lint (Phase 0, Step 4).
   No skill / rule / command name may collide across the three surfaces.

6. **6.0.0-D is rename + alias only — NO consolidation.** Every renamed command
   keeps its old invocation working as a deprecation alias (`replaces:` /
   `superseded_by`, routed by `migrate`). Nothing is removed in 6.0-D. Merging
   clusters, dropping old aliases, and converting surplus leaf commands to skills
   are Phase 8 / 6.1 work (their own roadmap).

## Consequences

- **Positive.** The surface reads as a flat, predictable verb vocabulary scoped
  by pack prefix. Every command resolves under Claude Code (no shadowed heads, no
  unsupported two-colon depth). The `src/domains/<pack>/<verb>/` path and the
  `<pack>-<verb>` invocation name line up one-to-one.
- **Positive.** Rename-with-alias means zero breakage in 6.0-D: old colon
  invocations keep resolving through the deprecation alias until a later major.
- **Negative / accepted.** Flat hyphenated names are longer than the colon sub
  (`git-pr-create` vs `git:pr:create`). The gain — universal resolvability and a
  single namespace — outweighs the few extra characters.
- **Negative / accepted.** The fold of cluster heads into flat subs increases the
  raw command *count* in the tree before 6.1 consolidation shrinks it. This is the
  cost of "structure first, consolidate second" (the feedback-2 guardrail).

## Amendment — 2026-06-04 · slug-canonicalization mechanism (Step 12)

> **Accepted** · 2026-06-04. Implementing Step 12 surfaced that Decision §1's
> shorthand "`<pack>-<verb>`" is under-specified and inconsistent with
> product-surface commands. Routed to the AI council (anthropic/claude-sonnet-4-5
> + openai/gpt-4o, design + peer-review, 2026-06-04). The council **rejected**
> frontmatter-as-slug and the hybrid override model as split-brain ("two trust
> anchors"), and converged on **path = single source of truth** (Reviewer A)
> **with a pack-scoped namespace policy** (peer-review synthesis). This amendment
> locks that mechanism before any rename lands.

### A1 — Canonical slug source is the PATH, pack-stripped

The slug a command projects to (`.agent-src/commands/<slug>.md`, then
`.claude` / `.cursor`) is **derived from the source path**, pack segment
stripped, remaining subpath hyphenated:

- `src/domains/engineering-base/feature/plan/command.md` → `feature-plan`
- `src/domains/meta/council/analysis/command.md` → `council-analysis`

Frontmatter `name:` is **display/metadata only — never the slug source**. This
locks the generator's de-facto behaviour (`_command_path_to_slug`) as the single
source of truth. There is no frontmatter slug override; relocating a command's
directory is the only way to change its slug.

### A2 — Decision §1's "`<pack>-<verb>`" is shorthand, not a mechanical rule

The pack name is **not auto-prefixed** into the slug. The real rule is
"hyphenated subpath within the pack". This is why `meta/council` → `council`
(NOT `meta-council`) and `meta/research` → `research` — product-surface commands
keep their bare name. ADR-044 §1's examples (`git-commit`, `feature-plan`) read
as `<pack>-<verb>` only by coincidence of their paths; the governing rule is the
subpath, not a pack prefix.

### A3 — Pack-scoped prefix is opt-in via `pack.yaml`

A pack whose bare verbs are generic/ambiguous (`commit`, `pr`, `sync`) MAY
declare `slug_prefix: <p>` in its `pack.yaml`. Then every command in that pack
projects as `<p>-<subpath>`:

- `git` pack with `slug_prefix: git` → `git/commit` → `git-commit`,
  `git/pr/create` → `git-pr-create`.
- `meta` pack (no `slug_prefix`) → `meta/council` → `council`.

Default = no prefix. This is the council's pack-scoped namespace policy and the
only sanctioned way to obtain a pack-prefixed slug. No per-command override.

### A4 — Slug uniqueness is GLOBAL

`.agent-src/commands/` is a flat namespace; the Phase-0 single-namespace
collision lint (Step 4) already enforces global uniqueness across skills /
rules / commands. `slug_prefix` packs participate in the same global namespace
(the prefix is part of the unique slug, not a separate scope).

### A5 — Alias mechanism: `replaces:` list, routed by `migrate`

A renamed command carries `replaces: [<old-slug>, …]` listing every prior
invocation (the legacy colon name for Class A, the pre-rehome name for Class B).
`migrate` reads these and rewrites old invocations to the new slug. The
`superseded_by:` **shim** convention is reserved for **true command
supersession** (one command replaced by a different one) and is NOT used for an
in-place rename alias — a command never both *is* a slug and *is superseded*.
One slug per file; `replaces:` carries the history.

### A6 — Three rename classes, distinct sequencing

| Class | Pattern | Example | Lane |
|---|---|---|---|
| **A** | colon → hyphen (punctuation only; path-slug already correct) | `feature:plan` → `feature-plan` | **Step 12** — reconcile `name:` display + `replaces:[old-colon]` + refs/evals; no path move |
| **B1** | pack-prefix (generic verb gains a `slug_prefix` pack) | `commit` → `git-commit` | **Step 12** — gated on the `git` pack + its `slug_prefix`; a directory move into the pack |
| **B2** | semantic rebrand (taxonomy changed) | `agent-handoff` → `session-handoff` | **Step 13** (pack/taxonomy restructure) — NOT Step 12; it changes pack membership AND name |

Lumping B1 and B2 was the council's named false-dichotomy: B2 is a rebrand of the
domain, not a rename, and ships with the pack restructure.

### A7 — Pre-flight gates before any rename lands

1. **No-op baseline.** Before touching the divergent commands, prove the
   path-slug derivation is unchanged for the already-aligned commands (assert the
   set of projected slugs is byte-identical pre/post the generator's
   `slug_prefix` support; only the opted-in pack's slugs may change).
2. **Circular-`replaces:` lint.** Reject any `replaces:` chain that cycles or
   points at a live slug.
3. **Global-collision lint** (Phase-0) must stay green after each class.
4. **Rollback.** Each class is its own commit; a class that fails its gate is
   reverted without touching the others (move-one-validate-one cadence).

### A8 — `migrate` I/O (the trust-boundary the council flagged)

- **Input:** command frontmatter `replaces:` across `src/domains/**`, producing
  an `old-slug → new-slug` map. Reads source, not the projected `.agent-src/`.
- **Output:** rewrites old invocations in the consumer's own artefacts (saved
  commands, docs) to the new slug; emits the map for audit. It mutates
  user-facing invocations only — never the package source.

## Amendment — 2026-06-04 · cluster-subs follow their head (Class A → Step 13)

> **Accepted** · 2026-06-04. Routed to the AI council (anthropic/claude-sonnet-4-5
> + openai/gpt-4o, design mode) when implementing Step 12. Both members converged
> on a classification tiebreaker the original A6 table missed.

### A9 — A colon-named **cluster sub** follows its HEAD's lane, regardless of
path-slug status.

A6 classified `feature:plan` → `feature-plan` as **Class A → Step 12** because
the path-slug is already correct. That reading misses **structural membership**:
the colon was never decorative punctuation — it encoded cluster membership, and
every remaining colon-named command in the tree is a tier-2 cluster sub whose
HEAD move is **Step 13** (Decision §2). Renaming a sub colon→hyphen in Step 12
while its head moves in Step 13 splits one coherent change across two steps and
produces a command-scattered intermediate state (hyphenated subs under unmigrated
heads).

**The tiebreaker:** a Class-A rename that targets a **cluster sub** is performed
**in Step 13, together with its head's structural move** — per cluster, atomically.
Two consequences the council named:

1. **Verb governance lands with the head, not before it.** Subs like
   `video:storyboard` / `analytics:show` / `profile:show` would each force a new
   ADR-041 verb (`video` / `analytics` / `profile`) just to align a display name.
   The verb-namespace budget is decided WITH the cluster's head restructure in
   Step 13, never burned prematurely in Step 12.
2. **Step 12's delivered scope is therefore B1 (the `git` pack rename) + the
   `slug_prefix` pipeline** — the only genuinely standalone structural renames.
   All other KEEP renames are either cluster subs (this A9) or B2 semantic
   rebrands (A6) — both Step 13.

Standalone (non-cluster-sub) Class-A renames, should any appear, stay in Step 12
per A6. None exist in the current tree.

## Alternatives considered

- **Frontmatter `name:` as the slug source (council option a).** Rejected: two
  trust anchors (slug from frontmatter, pack from path), commands become
  non-relocatable, and `name:` / `replaces:` create a multi-field slug conflict.
- **Hybrid: optional frontmatter override wins, else path (council option c).**
  Rejected: institutionalises "sometimes path, sometimes frontmatter" — a
  permanent split-brain with no north star for new contributors.
- **Keep colon namespacing (`git:pr:create`).** Rejected: Claude Code does not
  resolve two-colon depth, and bare heads are shadowed — the syntax cannot
  express the domain tree.
- **Single colon level only (`git:commit`, `git-pr-create` for depth-3).**
  Rejected: mixing colon and hyphen by depth is inconsistent and surprising; a
  uniform hyphenated scheme is simpler to teach and to lint.
- **Consolidate while renaming.** Rejected per the feedback-2 hard guardrail:
  "Erst Strukturbruch. Dann Konsolidierungsroadmap." Doing both at once makes the
  6.0 break un-reviewable and risky.

## References

- [`ADR-041`](ADR-041-controlled-command-verbs.md) — controlled verb allowlist (composes with this ADR).
- [`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) — `src/domains/<pack>/` collapse.
- [`command-clusters.md`](../contracts/command-clusters.md) — locked clusters + sub-command naming + command justification.
- [`agents/reports/command-classification-6.0.0-d.md`](../../agents/reports/command-classification-6.0.0-d.md) — the 150-command rename worksheet driven by this scheme (Step 12).
