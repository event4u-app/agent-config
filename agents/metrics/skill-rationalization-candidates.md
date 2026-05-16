# Skill Rationalization Candidates

> Combines [`skill-usage-report.md`](skill-usage-report.md) (activation
> baseline) and [`skill-overlap.md`](skill-overlap.md) (structural
> overlap) into per-skill recommendations. Authored per
> [`skill-management`](../../.agent-src.uncompressed/skills/skill-management/SKILL.md).
> See [`step-2-skill-inventory-rationalization.md`](../roadmaps/step-2-skill-inventory-rationalization.md)
> Phase 2 Step 3.

**Generated:** 2026-05-16 · **Soak baseline started:** 2026-05-16
(see `skill-usage-baseline-start.txt`) · **Status: interim** — activation
data covers 1 session, not the 30-day floor.

## Recommendation schema

`recommended_action ∈ { keep, merge_into:<slug>, supersede_by:<slug>, archive }`

- `keep` — distinct role; structural overlap is intentional (router
  family, dispatched siblings, reference + implementor pair).
- `merge_into:<target>` — source folds into target; target adopts
  trigger phrases that don't conflict. Archive note required.
- `supersede_by:<target>` — source becomes a thin redirect to target.
  Archive note required.
- `archive` — no replacement; the capability is gone. Archive note
  required.

## Structural overlap pass (16 pairs flagged, 2026-05-16)

The overlap detector found **0 merge candidates** structurally. Every
flagged pair maps to an intentional family with router-dispatched
roles, not a duplicate:

| pair | tier | scores | family | recommended_action |
|---|---|---|---|---|
| `blade-ui` ↔ `fe-design` | strong | t=0.06 s=0.80 | stack implementor + framework-agnostic reference (cited by `directives/ui/design.py`) | `keep` both |
| `api-design` ↔ `api-endpoint` | candidate | t=0.15 s=0.50 | strategy reference + "create endpoint" implementor | `keep` both |
| `laravel` ↔ `symfony-workflow` | candidate | t=0.44 s=0.0 | framework-specific PHP writers; routed per project | `keep` both |
| `blade-ui` ↔ `livewire` ↔ `flux` ↔ `react-shadcn-ui` | candidate | t=0.32–0.42 s=0.0 | UI-stack family dispatched by `directives/ui/{apply,review,polish}.py` | `keep` all four |
| `command-writing` ↔ `rule-writing` ↔ `persona-writing` | candidate | t=0.33–0.38 s≤0.21 | meta-authoring siblings (one per artifact kind) | `keep` all three |
| `performance-analysis` ↔ `security-audit` | candidate | t=0.35 s=0.0 | both gated on explicit user request; distinct subject | `keep` both |
| `judge-bug-hunter` ↔ `judge-code-quality` | candidate | t=0.35 s=0.0 | review-judge family dispatched by `/review-changes` | `keep` both |
| `project-analyzer` ↔ `universal-project-analysis` | candidate | t=0.35 s=0.0 | single-pass scan + multi-pass orchestrator, cross-reference each other | `keep` both |
| `project-analysis-laravel` ↔ `project-analysis-node-express` ↔ `project-analysis-symfony` | candidate | t=0.31–0.33 s=0.0 | framework-specific deep analyzers, dispatched by `universal-project-analysis` | `keep` all |

**Read-out:** structural overlap alone is not sufficient evidence for
rationalization. All flagged pairs are router-dispatched families where
the apparent overlap is a *symptom of the routing pattern*, not
duplication. Without activation data, no merges are justified.

## Activation pass — BLOCKED on 30-day soak

Day-0 baseline (1 session, 181 exposures, 0 mentions) shows:

- **0 active** — expected; one short session can't produce activation
  signal across 210 skills.
- **181 exposed-only** — every skill the catalog presented this turn.
  *Not* evidence of disuse.
- **156 dead** — skills not exposed in the one session. *Not* evidence
  of disuse either; the agent ships catalog subsets per turn.

Acting on these counts now would archive useful skills. The 30-day
soak (Phase 2 Step 1) gates all activation-driven recommendations.

**Re-run sequence after 2026-06-15:**

1. `task skill-usage:collect` — pull every session emitted since
   baseline.
2. `task skill-usage:report` — regenerate the 30-day rolling window.
3. `task skill-overlap` — re-run structural pass against the current
   skill set.
4. Regenerate this file: tier rows where `exposures_30d ≥ 1 ∧
   mentions_30d == 0 ∧ flagged in overlap` as `merge_into:<target>`;
   tier rows where `exposures_30d == 0 ∧ mentions_30d == 0` as
   `archive`.

## Path to the ≤ 160 target

The roadmap exit criterion is `≥ 48 skills tagged for
merge/supersede/archive`. With **0 merges** from structural overlap
and **0 confirmed dead** before the soak completes, the table is
deliberately empty of action rows today. Two scenarios for closing the
gap on 2026-06-15:

- **Path A (soak proves disuse):** activation report identifies ≥ 48
  skills with `exposures_30d ≥ 1 ∧ mentions_30d == 0` for the full
  window. Archive or merge per the recommendation schema above.
- **Path B (soak proves intentional sparseness):** the catalog is
  *meant* to be wider than the activation surface (router pre-filters
  reduce listings before exposure). In that case the target moves to
  the **listing surface**, not the skill count — rationalization
  becomes a router-tuning problem, not a deletion problem. Document
  the pivot in `step-2` Phase 2 exit notes and reopen the roadmap.

The decision between Path A and Path B is the *outcome* of the soak,
not an input — do not pre-bias toward either before the data lands.
