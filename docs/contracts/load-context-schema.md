---
stability: beta
---

# `load_context:` Frontmatter Schema

> **Audience:** rule authors and reviewers who want to keep an Always-rule
> small while making deeper reasoning available on demand.
> **Linter:** `scripts/lint_load_context.py` (run via `task lint-load-context`).
> **Companion:** [`rule-priority-hierarchy.md`](rule-priority-hierarchy.md) —
> hierarchy that decides *which* rule wins when several fire on the same turn.

This contract defines the frontmatter convention by which a rule (or
another context) declares the deeper reading material it relies on.
The convention is **lazy by default**: declared entries are *available
to load* when the situation demands them, never auto-loaded into every
turn.

## Schema

Two keys, both optional, both top-level frontmatter:

```yaml
---
type: "always"
description: "..."
load_context:                # lazy — on-demand reference list
  - .agent-src.uncompressed/contexts/<file>.md
  - agents/contexts/<file>.md
load_context_eager:          # opt-in eager — auto-loaded on rule fire
  - .agent-src.uncompressed/contexts/<file>.md
---
```

| Key | Loading | When to use |
|---|---|---|
| `load_context:` | **Lazy.** The agent reads the entry only when the rule's reasoning needs it. | Default. Use for everything that is "available knowledge" rather than "on every turn". |
| `load_context_eager:` | **Eager.** The entry is concatenated into the active context whenever the rule fires. | Only when the deeper material is needed *every single time* the rule fires. Counts against the combined char budget. |

**No default eager-load.** A rule with `load_context:` only does **not**
auto-load anything; the agent decides per turn. Eager loading is
opt-in and budget-gated.

## Path rules

- Paths are repo-root relative.
- Paths MUST end in `.md`.
- Allowed roots: `.agent-src.uncompressed/contexts/`, `agents/contexts/`,
  `.agent-src/contexts/` (compressed mirror). Any other root → linter
  error.
- A rule MAY reference contexts under either tree, but a
  `.agent-src.uncompressed/` rule SHOULD NOT eager-load an
  `agents/contexts/` file (project-local leak into shared package).
  Linter warns on this combination.
- A context file may itself declare `load_context:` (chain reasoning).
  The linter rejects cycles.

## Subdirectory conventions

Subdirectories under `contexts/` are **conventional, not enforced**.
The linter only validates the root prefix; subdirectory layout is a
documentation contract for human reviewers.

Two canonical subdirectories are in production:

| Subdir | Holds | First consumer |
|---|---|---|
| `contexts/execution/` | runtime decision logic, mechanics, and examples for execution-time rules (autonomy detection, verification mechanics, etc.) | `autonomous-execution` (Phase 2 of `road-to-pr-34-followups`) |
| `contexts/authority/` | mechanics behind authority gates — what makes commits, scope changes, and git ops legal vs. illegal | `commit-policy` and `scope-control` (Phase 6 of `road-to-pr-34-followups`) |

A third subdirectory, `contexts/communication/`, was proposed by the
PR #34 round-6 review for user-interaction and language-and-tone
mechanics. It is **not yet created** — the anti-speculation guard in
Phase 6 forbids creating a context root before its triggering rule
exists. Add it the same turn as the first migrating rule, not before.

A new subdirectory is justified when:

- A second rule needs to share contexts with the first one, AND
- The contexts have a coherent topic (execution, authority, communication, …), AND
- The triggering rule and its content move at the same time
  (no empty subdir reservations).

Single-rule contexts that don't fit one of the canonical topics live
directly under `contexts/` (see `contexts/model-recommendations.md`,
`contexts/skills-and-commands.md`).

## Combined char-budget guard

`load_context_eager:` triggers a budget check:

```
chars(rule.md) + sum(chars(eager_target.md) for each entry) ≤ rule_cap
```

`rule_cap` is the per-rule budget:

- Always rule: 2,500
- Auto rule: 4,000
- Safety rule (`type: "always"` AND covers Hard-Floor topics): 5,000

Linter computes the rule's class from frontmatter `type:` and the
hard-floor allowlist (`non-destructive-by-default`,
`security-sensitive-stop`). Exceeding the cap → linter error.

Lazy `load_context:` does **not** count against the budget — by
definition it is not loaded into every turn.

## Public-vs-internal leak

A rule shipped to consumers (`.agent-src.uncompressed/rules/`) may
declare `load_context:` entries pointing at:

- `.agent-src.uncompressed/contexts/` — public, OK.
- `agents/contexts/` — package-internal, **lint warning** (the entry
  will not exist in consumer projects).

Project-local rules may reference either. The linter classifies by
the rule's tree, not by the target's tree.

## No circular references

A `load_context:` graph that cycles fails the linter. Cycles are
defined across both `load_context:` and `load_context_eager:` edges.

## Examples

### Real consumer — `autonomous-execution`

`.agent-src.uncompressed/rules/autonomous-execution.md` is the first
production rule to declare `load_context:`. Its frontmatter:

```yaml
---
type: "auto"
description: "Deciding whether to ask the user or just act on a workflow step — trivial-vs-blocking classification, autonomy opt-in detection, commit default; defers to non-destructive-by-default for the Hard Floor"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncompressed/contexts/execution/autonomy-detection.md
  - .agent-src.uncompressed/contexts/execution/autonomy-mechanics.md
  - .agent-src.uncompressed/contexts/execution/autonomy-examples.md
---
```

Three lazy-loaded contexts, no `load_context_eager:`. The agent reads
each context only when the corresponding section of the slim rule
points at it (the rule body cites the same paths in prose so the
load is intent-driven, not blanket).

Pattern proven by this consumer:

- **Slim the rule to obligations only** — the 192-line pre-split
  source dropped to 119 lines (≤ 120 target met) by extracting LOGIC
  (detection algorithm), MECHANICS (setting table, cloud behavior),
  and EXAMPLES (anchor phrases, worked cases, failure modes) into
  three separate context files.
- **Cite, don't duplicate** — the slim rule contains zero
  algorithm/mechanics/example prose; everything moved was physically
  removed (verified by Phase 2.5 obligation diff:
  [`agents/reports/pr-34-phase-2-5-autonomous-execution-obligation-check.md`](../../agents/reports/pr-34-phase-2-5-autonomous-execution-obligation-check.md)).
- **Lazy by default** — no eager-load is declared; the budget guard
  is therefore a no-op for this rule.

`task lint-load-context` reports **1 declarer**, all paths resolve,
no cycles.

## Stability

`beta` — schema is settled and serves one production rule
(`autonomous-execution`). A breaking schema change is a SemVer-minor
pre-1.0 bump. Adding a new optional key is non-breaking. The first
consumer surfaced no schema gaps; the next migration batch (roadmap
`road-to-pr-34-followups` Phase 6 — `commit-policy`, `scope-control`,
`verify-before-complete`) is the next stress test.

## Cross-references

- [`rule-priority-hierarchy.md`](rule-priority-hierarchy.md) — which
  rule wins on conflict; this schema is orthogonal (depth, not
  priority).
- [`rule-interactions.yml`](rule-interactions.yml) — pairwise rule
  interaction matrix.
- [`STABILITY.md`](STABILITY.md) — beta-tag implications.
