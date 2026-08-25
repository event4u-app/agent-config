<!-- evidence-type: analysis -->

# Lapsed beta-contract inventory — 2026-08-25

> `road-to-contract-review-deadlines` step **0.1**. Produced so that D3's
> enforcement has a dispositioned backlog behind it: turning the gate on before
> this exists converts one silent red into 86 loud ones on the next PR, which is
> how a gate gets bypassed rather than adopted.

## Method, and what a row's disposition IS

Scope, run at HEAD on 2026-08-25:

```
docs/contracts/*.md  where  stability: beta  AND  keep-beta-until < 2026-08-25
```

Per row: the lapsed date, its age in days, the file's last commit date, and its
**inbound reference count** — the number of tracked files other than itself that
mention its basename (`git grep --files-with-matches <basename>`).

**The disposition column is a PROPOSAL produced by a stated rule, not a
per-contract judgement.** The rule, so any row can be challenged by challenging
the rule rather than by arguing about a file:

| condition | proposed | why |
|---|---|---|
| inbound references `== 0` | **unmaintained** | nothing in the tree depends on it, so extending its window is ceremony |
| references `>= 5` **and** no commit in `> 30` days | **promote** | widely depended on and settled — stable by behaviour rather than by declaration |
| otherwise | **extend** | still moving, or too thinly depended on to call stable |
| carries `superseded-by:` | supersede | **zero rows** — no contract in the tree carries the field |

The two thresholds (5 references, 30 days) are **stated defaults, not measured
optima**. They are written here rather than buried so that a maintainer who
disagrees can move one number and re-run, instead of re-litigating 86 rows.
*Revisit-if:* a promote-proposed contract turns out to have been quiet because it
was abandoned rather than because it was settled — which the reference count is a
proxy for and not a proof of.

## The counts — they sum to 86

| disposition | count |
|---|---:|
| extend with a reason | 49 |
| promote to stable | 36 |
| record as unmaintained | 1 |
| supersede | 0 |
| **total** | **86** |

## The finding that matters more than the counts

**These are not 86 independent expiries. 44 of them lapsed on the SAME DAY.**

| lapsed on | contracts |
|---|---:|
| 2026-08-12 | 44 |
| 2026-08-13 | 11 |
| 2026-08-14 | 9 |
| 2026-08-15 | 3 |
| 2026-08-17 | 11 |
| 2026-08-18 | 1 |
| 2026-08-19 | 4 |
| 2026-08-21 | 1 |
| 2026-08-23 | 2 |

64 of 86 fall in a four-day band (2026-08-12 → 2026-08-15), and the whole
population spans **2 to 13 days** of age. That shape is a
**cohort artifact**: one past session set a uniform review window across the
contract corpus, and it expired en masse. It is not 86 separate reviews that
were each independently missed.

**Why that matters for step 0.2.** The question there is whether a lapsed
deadline should FAIL a build or REPORT. A cohort that expires together is
evidence for the *cadence* being wrong rather than for 86 individual lapses of
discipline — and a red gate applied to a cohort artifact produces one loud
failure on an arbitrary future PR whose author did nothing wrong. The counts
above are the input to that decision; this paragraph is not the decision.

## The one unmaintained row, named

The single `references == 0` row is the only contract in the corpus that nothing
else in the tree points at. It is proposed `unmaintained` rather than deleted:
a zero reference count says nothing points at it *today*, which is an argument
for stopping the review ceremony, not for removing the record.

## The full table

`age` is days past the deadline as of 2026-08-25. `last commit` is the file's own
most recent commit. `refs` is inbound references excluding itself.

| contract | lapsed | age | last commit | refs | proposed |
|---|---|---:|---|---:|---|
| `command-clusters.md` | 2026-08-12 | 13 | 2026-08-21 | 134 | extend |
| `hook-architecture-v1.md` | 2026-08-12 | 13 | 2026-08-24 | 96 | extend |
| `kernel-membership.md` | 2026-08-12 | 13 | 2026-08-04 | 86 | extend |
| `ai-council-config.md` | 2026-08-12 | 13 | 2026-08-22 | 83 | extend |
| `rule-router.md` | 2026-08-12 | 13 | 2026-08-12 | 76 | extend |
| `agent-user-schema.md` | 2026-08-13 | 12 | 2026-07-30 | 47 | extend |
| `implement-ticket-flow.md` | 2026-08-12 | 13 | 2026-08-10 | 46 | extend |
| `provider-lifecycle.md` | 2026-08-15 | 10 | 2026-08-23 | 41 | extend |
| `frontmatter-contract.md` | 2026-08-19 | 6 | 2026-08-14 | 34 | extend |
| `profile-system.md` | 2026-08-14 | 11 | 2026-08-04 | 33 | extend |
| `command-surface-tiers.md` | 2026-08-12 | 13 | 2026-08-14 | 27 | extend |
| `agents-layout.md` | 2026-08-17 | 8 | 2026-08-12 | 25 | extend |
| `ui-track-flow.md` | 2026-08-12 | 13 | 2026-07-31 | 21 | extend |
| `condensation-default-kill-criterion.md` | 2026-08-14 | 11 | 2026-08-12 | 19 | extend |
| `mcp-tool-inventory.md` | 2026-08-14 | 11 | 2026-08-16 | 19 | extend |
| `subagent-boundary.md` | 2026-08-17 | 8 | 2026-08-11 | 19 | extend |
| `load-context-budget-model.md` | 2026-08-12 | 13 | 2026-08-04 | 17 | extend |
| `gui-wizard.md` | 2026-08-19 | 6 | 2026-08-07 | 16 | extend |
| `settings-api.md` | 2026-08-18 | 7 | 2026-08-05 | 16 | extend |
| `smoke-contracts.md` | 2026-08-14 | 11 | 2026-08-04 | 15 | extend |
| `package-self-orientation.md` | 2026-08-12 | 13 | 2026-08-22 | 13 | extend |
| `adr-architectural-consensus-mechanism.md` | 2026-08-12 | 13 | 2026-08-04 | 12 | extend |
| `cost-summary-schema.md` | 2026-08-15 | 10 | 2026-08-16 | 12 | extend |
| `benchmark-corpus-spec.md` | 2026-08-14 | 11 | 2026-08-02 | 11 | extend |
| `multi-tool-projection-fidelity.md` | 2026-08-13 | 12 | 2026-08-22 | 10 | extend |
| `rule-classification.md` | 2026-08-12 | 13 | 2026-08-04 | 10 | extend |
| `telegraph-telemetry.md` | 2026-08-15 | 10 | 2026-08-12 | 9 | extend |
| `ui-stack-extension.md` | 2026-08-12 | 13 | 2026-07-31 | 8 | extend |
| `adr-chat-history-split.md` | 2026-08-12 | 13 | 2026-08-04 | 7 | extend |
| `local-server-api.md` | 2026-08-17 | 8 | 2026-07-28 | 7 | extend |
| `rule-interactions.md` | 2026-08-12 | 13 | 2026-08-06 | 7 | extend |
| `skill-domains.md` | 2026-08-12 | 13 | 2026-08-04 | 5 | extend |
| `brand-token-consumption.md` | 2026-08-17 | 8 | 2026-07-06 | 4 | extend |
| `command-taxonomy.md` | 2026-08-12 | 13 | 2026-05-26 | 4 | extend |
| `governance-enforcement-projection.md` | 2026-08-17 | 8 | 2026-08-04 | 4 | extend |
| `linear-ai-rules-inclusion.md` | 2026-08-12 | 13 | 2026-08-04 | 4 | extend |
| `release-trunk-sync.md` | 2026-08-12 | 13 | 2026-06-04 | 4 | extend |
| `router-blending.md` | 2026-08-13 | 12 | 2026-08-04 | 4 | extend |
| `adr-forecast-construction-shape.md` | 2026-08-12 | 13 | 2026-05-18 | 3 | extend |
| `discovery-manifest.md` | 2026-08-19 | 6 | 2026-06-05 | 3 | extend |
| `linter-structural-model.md` | 2026-08-12 | 13 | 2026-06-11 | 3 | extend |
| `one-off-script-lifecycle.md` | 2026-08-12 | 13 | 2026-05-21 | 3 | extend |
| `tier-3-contrib-plugin.md` | 2026-08-12 | 13 | 2026-07-16 | 3 | extend |
| `agents-md-tech-stack.md` | 2026-08-12 | 13 | 2026-06-11 | 2 | extend |
| `cost-dashboard.md` | 2026-08-12 | 13 | 2026-06-06 | 2 | extend |
| `init-telemetry.md` | 2026-08-13 | 12 | 2026-05-18 | 2 | extend |
| `installer-agent-mode.md` | 2026-08-19 | 6 | 2026-05-21 | 2 | extend |
| `linear-ai-three-layers.md` | 2026-08-12 | 13 | 2026-08-04 | 2 | extend |
| `review-lens-schema.md` | 2026-08-17 | 8 | 2026-07-06 | 1 | extend |
| `no-runtime-boundary.md` | 2026-08-17 | 8 | 2026-07-23 | 38 | promote |
| `ghostwriter-schema.md` | 2026-08-13 | 12 | 2026-06-05 | 30 | promote |
| `persona-schema.md` | 2026-08-12 | 13 | 2026-07-12 | 27 | promote |
| `write-engine.md` | 2026-08-13 | 12 | 2026-07-11 | 27 | promote |
| `local-knowledge-ingestion.md` | 2026-08-23 | 2 | 2026-05-25 | 23 | promote |
| `benchmark-report-schema.md` | 2026-08-14 | 11 | 2026-06-04 | 21 | promote |
| `load-context-schema.md` | 2026-08-12 | 13 | 2026-06-06 | 21 | promote |
| `memory-visibility-v1.md` | 2026-08-12 | 13 | 2026-06-14 | 21 | promote |
| `role-experience.md` | 2026-08-23 | 2 | 2026-06-08 | 20 | promote |
| `ticket-bundle-format.md` | 2026-08-17 | 8 | 2026-07-06 | 20 | promote |
| `cross-wing-handoff.md` | 2026-08-12 | 13 | 2026-05-26 | 18 | promote |
| `config-presets.md` | 2026-08-14 | 11 | 2026-06-06 | 17 | promote |
| `workflow-packs.md` | 2026-08-12 | 13 | 2026-05-26 | 17 | promote |
| `decision-trace-v1.md` | 2026-08-12 | 13 | 2026-05-26 | 15 | promote |
| `user-type-schema.md` | 2026-08-14 | 11 | 2026-05-26 | 15 | promote |
| `audit-log-v1.md` | 2026-08-12 | 13 | 2026-06-23 | 14 | promote |
| `cost-profile-defaults.md` | 2026-08-13 | 12 | 2026-06-05 | 11 | promote |
| `trust-and-safety.md` | 2026-08-21 | 4 | 2026-06-06 | 11 | promote |
| `orchestration-dsl-v1.md` | 2026-08-12 | 13 | 2026-06-04 | 10 | promote |
| `installed-tools-lockfile.md` | 2026-08-12 | 13 | 2026-06-04 | 9 | promote |
| `universal-skills.md` | 2026-08-13 | 12 | 2026-06-14 | 9 | promote |
| `capability-boundary.md` | 2026-08-17 | 8 | 2026-07-06 | 8 | promote |
| `context-paths.md` | 2026-08-12 | 13 | 2026-05-26 | 8 | promote |
| `file-ownership-matrix.md` | 2026-08-12 | 13 | 2026-05-26 | 8 | promote |
| `adr-install-user-type-axis.md` | 2026-08-13 | 12 | 2026-06-05 | 7 | promote |
| `adr-user-types-axis.md` | 2026-08-14 | 11 | 2026-06-06 | 7 | promote |
| `decision-engine-gates.md` | 2026-08-13 | 12 | 2026-05-18 | 7 | promote |
| `low-impact-corpus-format.md` | 2026-08-13 | 12 | 2026-06-04 | 7 | promote |
| `roadmap-complexity-standard.md` | 2026-08-12 | 13 | 2026-05-18 | 7 | promote |
| `rule-priority-hierarchy.md` | 2026-08-12 | 13 | 2026-05-26 | 7 | promote |
| `adr-gtm-context-spine.md` | 2026-08-12 | 13 | 2026-06-04 | 6 | promote |
| `adr-settings-sync-engine.md` | 2026-08-12 | 13 | 2026-06-05 | 6 | promote |
| `adr-wing4-context-spine.md` | 2026-08-12 | 13 | 2026-06-04 | 6 | promote |
| `command-category-governance.md` | 2026-08-17 | 8 | 2026-07-06 | 5 | promote |
| `safety-model.md` | 2026-08-12 | 13 | 2026-06-06 | 5 | promote |
| `settings-sync-yaml-subset.md` | 2026-08-12 | 13 | 2026-06-05 | 5 | promote |
| `creative-pack-boundary.md` | 2026-08-17 | 8 | 2026-07-06 | 0 | unmaintained |

## What this inventory does NOT do

- It does not **apply** any disposition. No contract's frontmatter is edited by
  this file, and Phase 1's gate is not enabled by it.
- It does not claim the promote-proposed set is stable. It claims they are
  widely referenced and quiet, which is the observable proxy the rule uses.
- It does not cover the 35 beta contracts whose deadline is still in the future,
  nor the pairs measured in `wording-baseline-2026-08-25.md`. Different question.

