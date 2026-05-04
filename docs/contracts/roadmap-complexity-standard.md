---
stability: beta
---

# Roadmap Complexity Standard

> **Audience:** roadmap authors and reviewers in `agents/roadmaps/`.
> **Linter:** `scripts/lint_roadmap_complexity.py` (run via
> `task lint-roadmap-complexity`).
> **Source:** Phase 5 of the `road-to-context-layer-maturity` work
> (now archived); reviewer-flagged drift after the
> structural-optimization roadmap proved that "heavy" is correct for
> structural work but wrong for normal feature work.

Roadmaps drift toward heavyweight whenever the previous one was
heavyweight. This contract pins **two tiers**, names exemplars, and
hard-fails the lint on tier mismatch.

## Tiers

### Lightweight (default)

Almost every roadmap is lightweight. The shape:

- **≤ 6 phases** total
- **≤ 1 page per phase** (≈ 60 source lines including header + steps
  + exit gate; the linter doesn't enforce per-phase line budgets, but
  reviewers do)
- **No nested council debates** inside the roadmap (no
  `## Council Round 1`, `## Council Round 2`, `### Verdict` sections)
- **No 178-step backlogs** — phases are delivery-shaped, not
  task-shaped
- **≤ 600 lines total** (frontmatter + body, blank lines counted)
- Frontmatter declares `complexity: lightweight`

**Exemplars:**

- `road-to-context-layer-maturity.md` (archived) — six phases,
  ~376 lines, no nested council; the seed roadmap that triggered this
  standard. Self-tagged as `lightweight`.
- `road-to-rule-hardening.md` (archived) — five phases, ~263 lines;
  mechanized the rule layer; sibling of the seed, also lightweight.

**Typical use:** feature work, follow-ups, bounded refactors,
mechanization passes, telemetry plumbing.

### Structural (rare)

Triggered only when the work changes a contract layer or a budget
invariant. The shape:

- Multi-round council, locked decisions, file-ownership matrix,
  gating contracts on phase boundaries
- **> 600 lines** total (typical: 800 – 1500)
- May include `## Council Round N` / `### Verdict` blocks, ADR
  cross-links, decision matrices
- Frontmatter declares `complexity: structural`

**Exemplars:**

- Archived `agents/roadmaps/_archived/road-to-structural-optimization.md`
  (closed 2026-05-03 after 6 phases of council-driven budget work).
  ~1.5k lines, multi-round council, file-ownership matrix.

**Triggered by:** changes to a public contract surface in
`docs/contracts/`, a budget invariant in
[`load-context-budget-model.md`](load-context-budget-model.md), or a
priority hierarchy in
[`rule-priority-hierarchy.md`](rule-priority-hierarchy.md).
**Requires:** explicit user opt-in on creation. The agent must not
upgrade a lightweight roadmap to structural mid-flight without that
opt-in.

## Anti-game clause

The trigger is **contract-layer change**, not line count alone. A
heavy roadmap split into two lightweights to dodge the gate is a
linter-defeat — reviewers flag it on PR review. Conversely, a
roadmap that legitimately needs the structural shape but tries to
hide as `lightweight` to skip council overhead is the same defeat in
the other direction.

## Frontmatter

Every roadmap in `agents/roadmaps/` (including draft and archived
ones) declares its tier:

```yaml
---
complexity: lightweight
---
```

or

```yaml
---
complexity: structural
status: draft
---
```

Other frontmatter keys (`status:`, `owner:`, `target_release:`) are
permitted alongside but not required by this contract.

## Linter contract

`scripts/lint_roadmap_complexity.py` (≤ 150 LOC, stdlib only)
enforces the **measurable** subset of this standard:

| Check | Lightweight | Structural |
|---|---|---|
| `complexity:` frontmatter declared | required | required |
| Total line count | ≤ 600 | > 0 (no upper cap) |
| `## Phase N` heading count | ≤ 6 | no cap |
| `## Council Round N` / `### Verdict` blocks | forbidden | allowed |
| Council session cross-links (`agents/sessions/.../council-…`) | warn | allowed |

The linter runs on every roadmap file under `agents/roadmaps/` and
exits non-zero on any violation. Hooked into `task ci` via
`task lint-roadmap-complexity`.

**Out of scope for the linter** (reviewer judgment only): step count,
per-phase length, the contract-layer-change trigger for the
structural tier.

## Migration

Phase 5.3 of `road-to-context-layer-maturity` applies the standard
retroactively to all open roadmaps in `agents/roadmaps/`: each gets
a `complexity:` tag based on the rules above. No content rewrites
land in that step — only the tag.

Roadmaps that exceed the lightweight cap but plausibly should be
lightweight (e.g. they accumulated drift) are tagged `structural`
for now and may be split or trimmed in a follow-up. The migration
records existing reality, not aspirational reality.
