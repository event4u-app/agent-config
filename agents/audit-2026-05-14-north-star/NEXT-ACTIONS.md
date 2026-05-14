# NEXT ACTIONS — North Star Restructure (deferred)

> User picked Option 2 on 2026-05-14: commit audit material now,
> roadmap restructure later. **Do not let this drift.**

## Pending — roadmap tree restructure

Authoritative spec: [`council-synthesis.md § 6`](council-synthesis.md)
+ [`council-synthesis.md § 9`](council-synthesis.md).

### Renames (6 × `git mv`)

| Current path | New path |
|---|---|
| `agents/roadmaps/step-2-ai-council-consolidation.md` | `agents/roadmaps/step-3-ai-council-consolidation.md` |
| `agents/roadmaps/step-3-public-personas.md` | `agents/roadmaps/step-7-public-personas.md` |
| `agents/roadmaps/step-4-ghostwriter.md` | `agents/roadmaps/step-8-ghostwriter.md` |
| `agents/roadmaps/step-5-test-cleanup.md` | `agents/roadmaps/step-6-test-cleanup.md` |
| `agents/roadmaps/step-6-user-types-axis.md` | `agents/roadmaps/step-9-user-types-axis.md` |

(`step-1-v2-feedback-followup.md` stays.)

### New roadmap drafts (3 × `roadmap-writing` skill)

| New file | Pillar | Source |
|---|---|---|
| `agents/roadmaps/step-2-skill-inventory-rationalization.md` | P0 (NEW) | Council Opus #5 + o1 "skill usage stats collector" — target 208 → ≤ 160 |
| `agents/roadmaps/step-4-measurement-and-benchmark.md` | P1 | 25-prompt corpus, selection-accuracy, cost-tracker (session jsonl), 60-day baseline, projection fidelity |
| `agents/roadmaps/step-5-minimal-schema.md` | P3 | `model_tier` + `## Deep Reference` only. **No** `schema_version`, `distinguishes_from`, `disambiguation`, migration registry (council shrunk this). |

### Verification gates

After renames + new drafts:

1. `task lint-skills` → green
2. `python3 scripts/check_roadmap_trackable.py` → all parseable
3. `agents/roadmaps-progress.md` regenerated (auto)
4. `task ci` → green
5. Commit chain: (b) renames as one commit · (c) new drafts as one commit

### Acceptance gates (G0–G4)

See [`council-synthesis.md § 8`](council-synthesis.md). G0–G4 all green = v3.0.0 ship.

## Pending — compression decision (criterion-deferred)

Per [`council-synthesis.md § 7`](council-synthesis.md):

- Until `task bench` exists: `caveman.speak_scope` stays default `off`.
- After 60-day baseline:
  - measured saving < 30 % → **deprecate** the feature (Opus reasoning)
  - measured saving ≥ 30 % + <5 % quality regression → **flip default on** with carve-outs

Bound to step-4 completion. Don't decide before then.

## Pending — open council questions (parked from `north-star-plan.md § 6`)

1. Runtime stop-hook approach (CLI vs native-hook vs none) — decide during step-3 (ai-council-consolidation).
2. `AGENT: <slug>` marker contract — decide during step-3.
3. Default-on caveman — decide at step-4 closeout (see above).

## When this file gets deleted

When all three new roadmap files exist **and** the 6 renames are
committed, this `NEXT-ACTIONS.md` may be removed. Until then it is
the single authoritative pending-actions surface for the North Star
restructure.
