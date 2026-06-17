<!-- analyzed: 2026-05-30 | commit: 57588489 | files: 3 -->
# Meta-Layer Classification — Phase 1 Step 2

> Companion to `meta-layer-inventory.md` (the auto-generated, regenerated-at-Step-6 ledger).
> This file is the **stable** classification of every concept-overlap row into
> **merge / delete / keep-with-reason**, per `road-to-leaner-core-and-discovery` Phase 1 Step 2.
> Lives separately so the Step-6 ledger regen does not wipe the classification.
> Source ledger: 303 surfaces scanned, 35 concept-overlap rows.

## Method

A row is an *overlap candidate* when one concept (a shared filename token / stem-containment)
is defined across ≥ 2 stable surfaces. Each row classified against three structural patterns,
applied in order:

1. **kernel-and-router P4 thin-rule split** — an always-loaded rule stub (≤ ~60 lines) whose
   body was deliberately migrated to an on-demand `*-mechanics` context, a `*-demos`/`*-examples`
   guideline (Pattern-Memory baselines), or a spec contract the rule `routes_to`. This is the
   package's intended architecture, not duplication. **keep-with-reason.**
2. **immutable provenance** — ADR decision records and the frozen `docs/contracts/pilot/`
   condensation baseline (the empirical `r=0.742` source-of-truth cited by `kernel-membership.md`).
   Editing or merging these destroys the audit trail. **keep-with-reason.**
3. **distinct-concern cluster** — files sharing a prefix word but defining *different* concepts
   (three independent safety floors; PHP-`git`/`security` guidelines vs the agent-behaviour rules;
   wing-handoff vs role-handoff). No single definition is duplicated. **keep-with-reason.**

A row matching none of the three would be a genuine **merge** / **delete** candidate.

## Result

| Classification | Rows |
|---|---:|
| keep-with-reason | 35 |
| merge | 0 |
| delete | 0 |

**Net new structural cut from this bounded re-run = 0.**

## Why zero is the honest, correct outcome

The prior `road-to-abstraction-budget-discovery` → `road-to-abstraction-reduction` arc already
executed the redundancy cut (frontmatter-defaults). This phase is the **bounded re-run** that arc
mandated, scoped to the *new* meta-layers the post-5.x feedback names (Iron Laws, value/measurement,
roadmap, linked-projects, marketplace, governance). The re-run finds those layers are the
**deliberate kernel-and-router split**, not accreted duplication:

- 26 rows are the rule→mechanics/demos/contract split (P4 architecture). Folding any back into its
  always-loaded rule would re-bloat the kernel budget — the exact problem the split solved.
- 9 cross-kind rows flagged for manual review are all distinct surfaces on inspection: an
  obligation-rule routing to its spec-contract (`provider-lifecycle`, `artifact-engagement`,
  `low-impact-corpus`), or a shared topic word across genuinely different scopes
  (`security`/`git` = agent-behaviour rule vs PHP coding guideline; `mental-models` = a 30-model
  catalog with 88 references vs an application-methodology guideline with 5).

Manufacturing cuts here would violate `minimal-safe-diff` and `preservation-guard`. The audit's
deliverable is therefore the **ledger + this classification + a verified no-cut finding** — the
minimal-doc outcome both council members demanded ("audit must not produce more docs/process").

## Per-row classification

All 35 rows → `keep-with-reason`. Structural reason by group:

- **P4 thin-rule split (rule ↔ mechanics/demos/examples/guideline/contract it routes to):**
  `direct-answers`, `language-and-tone`, `user-interaction`, `think-before-action`,
  `token-efficiency`, `augment-source-of-truth`, `skill-quality`, `roadmap-progress-sync`,
  `verify-before-complete`, `ask-when-uncertain`, `guidelines`, `slash-command-routing-policy`,
  `rule-type-governance`, `php-coding`, `role-mode-adherence`, `command-suggestion`,
  `artifact-engagement`, `provider-lifecycle`, `low-impact-corpus`, `agent-authority`.
  → *kernel-and-router P4 architecture; folding back re-bloats the always-loaded budget.*
- **Immutable provenance:** `pilot/*` (direct-answers/language-and-tone/agent-authority frozen
  baseline), `context-spine` ADRs, `user-type` axis ADRs, `implement-ticket` ADR+flow,
  `settings-sync` ADR+subset, `installed-tools` lockfile+manifest.
  → *ADR / frozen-baseline provenance; merging destroys the audit trail.*
- **Distinct-concern cluster:** `safety` (3 independent floors + a PHP pattern), `domain-safety`
  (disclaimer/pii/retention — distinct sectors), `mcp` / `mcp-tool` (phase scopes + tool inventory),
  `cost` (budget/dashboard/enforcement/profile), `security` & `git` (agent-rule vs PHP guideline),
  `cross-handoff` (wing vs role), `mental-models` (catalog vs methodology), `gate-onboarding`
  (linked-projects gate vs onboarding gate), `governance`.
  → *shared prefix word, different concept; no single definition duplicated.*

## Council gate (Step 3) — evidence closing the CONDITIONAL verdict

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, CLI transport, 2026-05-30, analysis lens, 2 rounds)
returned **CONDITIONAL ZERO NET CUT**: it confirmed the 26 P4-split rows and the provenance cluster as
keep, but flagged the 9 cross-kind "prefix-collision" rows as *inferred-distinct without file:line
evidence* — demanding a content diff before any "distinct" verdict, and naming `mental-models` (88-vs-5
ref asymmetry) and the "3 safety floors" claim as the strongest merge/rename suspects.

The evidence gap is now closed with file-content citations:

- **`security`** — `.agent-src/rules/security-sensitive-stop.md` (tier-2a agent-behaviour rule: "threat-model
  BEFORE editing auth/billing/tenants/secrets paths") vs `docs/guidelines/php/security.md` (PHP *code*
  conventions: SQLi / XSS / CSRF / headers). Disjoint surfaces — agent-action gate vs code-writing guide.
  **Distinct, confirmed.**
- **`git`** — `.agent-src/rules/git-history-discipline.md` (agent-ops rule: no rebase/squash without ask)
  vs `docs/guidelines/php/git.md` (project branch-naming / PR conventions). **Distinct, confirmed.**
- **`mental-models`** — contract = the 30-model **catalog** with `*Cited by:*` skill links (the registry
  88 surfaces reference); guideline = an **application methodology** for deep-reading/analysis (5 refs from
  research skills). The 17:1 asymmetry is explained, not a duplication: catalog-registry vs niche-workflow
  methodology. They overlap on a few model *names*, not on content/purpose. **Distinct, confirmed — not a merge.**
- **`safety` (3 floors)** — `engineering-safety-floor` (core, always-active), `finance-safety-floor`
  (activates only under `pack-finance-*`), `strategy-safety-floor` (activates only under
  `pack-founder-strategy`). Disjoint activation conditions; not a hierarchical stack. **Genuinely
  independent, confirmed** (refutes the council's "mis-named layers" suspicion with evidence).

**Resolved verdict: ZERO NET CUT — evidence-backed, not inferred.** No GO-approved merge or delete is
carried into Steps 4/5.

## Council-actionable that IS a leaner-core win — tool-level namespace hygiene (Step 6)

Both members ranked "reduce prefix-collision scan noise" as a high/quick-win action. The council's
*rename* framing (e.g. `security` → `agent-security`) is rejected on `minimal-safe-diff` /
`preservation-guard` grounds — renaming 9 established, heavily-cross-referenced always-loaded rules for
cosmetic scan-tidiness is exactly the drive-by churn the audit must not produce. The correct, safe fix is
at the **tool** level: teach `inventory_meta_layers.py` to not group a cross-stack agent-rule with a
PHP coding guideline that merely shares a topic word. This drops the false-positive overlap count
legitimately (the noise was never real overlap) and makes the Step-6 "overlap count dropped" assertion
meaningful — executed in Step 6.

## Step 6 — re-run delta (concept-overlap count dropped)

After the tool-level namespace-hygiene refinement (cross-stack guard + multi-token containment in
`inventory_meta_layers._same_concept`), the inventory was re-run:

| Metric | Before (Step 1–2) | After (Step 6) | Delta |
|---|---:|---:|---:|
| Concept rows | 35 | 32 | −3 |
| Overlap candidates (`overlap=Y`) | 33 | 29 | −4 |

The dropped rows (`git`, `security`, and the PHP-`strategy` member of the safety-floor cluster) were all
**false positives** — a PHP coding guideline coincidentally sharing one topic word with an agent rule.
No genuine concept was removed; the legitimate `floor-safety` 3-rule family and every P4 / provenance row
remain. This is the council-requested noise reduction achieved at the tool level, not by renaming rules.

**Content surface unchanged** — zero rules/contracts/guidelines were merged or deleted. The "leaner core"
result of Phase 1 is the *verified finding* that the concept surface is already at its intended floor
(the prior abstraction-reduction did the cut), plus a sharper audit tool for the next re-run. CI gate is
remote per `quality.local_auto_run: false` (roadmap-ci-steps-policy); the new tool is py_compile-clean and
touches no condensed `.agent-src/` content, so condensation hashes are unaffected.

## Optional non-cut improvement (NOT executed — adds lines, fails the "removes surface" premise)

`mental-models` contract (catalog) and guideline (methodology) do not cross-reference each other.
A reciprocal one-line cross-link would aid navigation, but it *adds* surface rather than removing it,
so it is out of scope for an audit whose premise is reduction. Recorded for a future docs pass.
