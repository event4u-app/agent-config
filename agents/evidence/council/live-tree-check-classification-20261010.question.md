<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-10, committed verbatim so the
     verdict beside it can be checked against what was asked. Not edited after
     the run. -->

# Step 7.1 — classify each live-tree measurement check pinned red on the trunk

One question for `road-to-authority-routing-mechanism` step 7.1, executing
defect 6 of the authority-routing record: *"Whether these are invariants,
snapshots, tolerances or observations changes what the gate attests. The agent
may refresh clearly observational data; it may not silently weaken a required
invariant."*

Answer on the measurement below. Do not summarise it back.

## The four classes, as the step defines them

- **invariant** — must always hold; stays a required gate.
- **snapshot** — a point-in-time reading, refreshable by the agent per a stated
  rule, never silently.
- **tolerance** — a bounded range with an accepted-risk waiver (the precedent is
  `ratification-artifact.md`'s own `strict_required_status_checks`).
- **observation** — informational, demoted to non-blocking, with the demotion
  recorded inline and its reason stated.

## How the population was measured, including what was thrown out

Every `check_*.ts` and `lint_*.ts` under `src/scripts/` was run against a clean
worktree at `origin/main` (`bbe5b73be`), 2026-10-10. The first sweep returned
**exit 127 for all ~300** — macOS ships no `timeout(1)`, so nothing ran. That
run was discarded, two known-green controls were used to prove the harness, and
the sweep was repeated. The projections (`dist/`, `.claude/`) were then built,
which moved three checks from red to green and so identified them as artefacts
of the bare worktree rather than trunk state.

Two further classes were then excluded, and the exclusions matter as much as
the inclusions:

- **Needs an argument.** `check_candidate_lines`, `check_evaluator_budgets`,
  `lint_mandated_lines`, `check_md_language`, `check_proposal`,
  `check_reply_consistency`, `check_memory_*`, `lint_explain_trace`,
  `lint_persistence`, `check_release_pr_shape` print a usage line. They were
  called wrong; they are not red.
- **Needs a build step.** `check_artefact_checksums`, `lint_discovery_manifest`,
  `lint_featured_skills`, `lint_mcp_registry_manifest`, `check_site_links`,
  `check_token_regression`, `lint_trust_coherence`, `lint_value_dashboard` fail
  on a missing generated input (`site/dist`, a discovery manifest, a bench
  report). Red on build order, not on tree state.

## The population — 16 checks, with what each actually reports

| # | Check | What it reported |
|---|---|---|
| 1 | `check_gate_completeness` | **237 violations against a baseline of 214 — 23 new.** "A ratchet only turns one way." |
| 2 | `lint_ticked_unmet_criteria` | 4 criteria ticked `[x]` over their own "NOT met" — **all four in `agents/roadmaps/archive/`** |
| 3 | `check_rule_invariants` | 2 missing kernel rule invariants |
| 4 | `check_augment_description_cap` | 5 auto-rule descriptions exceed 150 chars |
| 5 | `check_trigger_evals` | trigger-set regressions |
| 6 | `lint_subagent_determinism` | subagent determinism violations |
| 7 | `lint_rule_enforcement_declaration` | `neighbour-precedence` declares a model-carried gap in frontmatter and never states it in its body |
| 8 | `check_token_quality_golden` | a tagged rule (`security-sensitive-stop`) has no router trigger the prompt exercises |
| 9 | `check_council_layout` | council layout violations |
| 10 | `check_knowledge_cards` | 3 violations across 1 card |
| 11 | `check_public_links` | `docs/contracts/collector-operations.md` links to itself |
| 12 | `lint_agents_layout` | unknown flat files under `agents/` |
| 13 | `lint_eval_freshness` | `threat-modeling` ships a SHA-pinned manifest with no `upstream.last_checked` |
| 14 | `lint_readme_jargon` | a line needs role-first language |
| 15 | `lint_readme_serial_comma` | a serial comma before a final "and" |
| 16 | `check_composite_arming` | no composite store at `agents/evidence/hook-composite-readings.jsonl` |

## What makes a classification WRONG — decide against these

- **`invariant` is wrong** where the check measures something that legitimately
  moves as the tree grows. A ratchet that must be hand-raised on every ordinary
  change is not an invariant; it is a snapshot wearing one, and it trains people
  to raise it without reading.
- **`snapshot` is wrong** where the number falling would mean a control stopped
  firing. Refreshing that is the silent weakening the record forbids.
- **`observation` is wrong** where the finding names a live defect a reader must
  act on. Demoting it buries the defect rather than classifying it.
- **`tolerance` is wrong** without a stated bound AND a named party who accepts
  the residual risk. A tolerance with neither is an observation with extra
  words.
- **Any classification is wrong** if it is chosen because it makes the trunk
  green soonest.

## Two moves that are forbidden here, by name

- Do **not** classify `check_gate_completeness` as a snapshot because 23 new
  violations are inconvenient to fix. If it is a snapshot, say what rule governs
  a refresh and who may run it.
- Do **not** give one blanket class to all 16. The step asks for a verdict **per
  check**, and a blanket answer is the thing it exists to prevent.

## What to return

1. **A rule** that decides the class from a check's own properties — the thing
   that generalises past these 16.
2. **A class per check**, all 16, by number.
3. For every `snapshot`: the refresh rule and who may run it. For every
   `tolerance`: the bound and the party accepting the risk. For every
   `observation`: what makes its findings safe to not block on.
4. **Which of the 16, if any, you cannot classify from this evidence**, and what
   you would need. An honest abstention is a better answer than a guess.
5. Confidence, and any dissent you would want recorded.
