# Duplicate-trigger clusters — Phase 4 Step 1 + 2

**Generated:** 2026-05-28 · Phase 4 of `road-to-value-dashboard-netto-cuts.md`.

## Method

Walked `dist/router.json::tier_{1,2}[*].triggers[*]` and grouped by
`(trigger_type, trigger_value)`. Any (type, value) pair referenced by
more than one rule is a duplicate cluster.

## Aggregate

- Total unique trigger values: **374**
- Clusters with >1 rule: **16** (≈ 4.3 % of triggers)

## Per-cluster decision

The roadmap allows two outcomes per cluster:
**(a) delete-only** — keep one canonical trigger, drop variants;
**(b) leave as-is** — the duplicates are semantically distinct
despite identical surface form (the rules each need to fire for
different reasons on the same surface).

| # | Trigger | Rules | Verdict | Rationale |
|---|---|---|---|---|
| 1 | `path_prefix '.agent-src.uncondensed/skills/'` | skill-quality (T1) + domain-adoption-policy (T2) + framework-neutrality-in-generic-skills (T2) | **leave as-is** | Three orthogonal concerns: quality (gates the skill body), adoption (gates domain inclusion), neutrality (gates framework leakage). All three must consider activation on a skill-file edit. |
| 2 | `path_prefix 'agents/roadmaps/'` | no-roadmap-references (T1) + roadmap-progress-sync (T1) + roadmap-ci-steps-policy (T2) | **leave as-is** | Three orthogonal concerns: stable-link policy, dashboard regen, CI-step prohibition. |
| 3 | `intent 'PR body'` | no-attribution-footers (T1) + no-decorative-emojis-in-git-surfaces (T1) | **leave as-is** | Two hygiene rules on the same artefact; one gates footers, one gates emojis. |
| 4 | `intent 'commit message'` | no-attribution-footers (T1) + no-decorative-emojis-in-git-surfaces (T1) | **leave as-is** | Same as #3. |
| 5 | `intent 'post PR comment'` | no-decorative-emojis-in-git-surfaces (T1) + no-pr-progress-comments (T2) | **leave as-is** | One gates emojis, one gates whether to post at all. |
| 6 | `keyword '/audio:'` | media-governance-routing (T2) + provider-lifecycle-discipline (T2) | **leave as-is** | Governance ≠ lifecycle; both fire on media commands. |
| 7 | `keyword '/image:'` | media-governance-routing (T2) + provider-lifecycle-discipline (T2) | **leave as-is** | Same as #6. |
| 8 | `keyword '/video:'` | media-governance-routing (T2) + provider-lifecycle-discipline (T2) | **leave as-is** | Same as #6. |
| 9 | `keyword 'DCF'` | domain-safety-disclaimer (T2) + finance-safety-floor (T2) | **leave as-is** | General advisory floor + finance-specific floor; both apply to DCF work. |
| 10 | `keyword 'FormRequest'` | laravel-routing (T1) + framework-neutrality-in-generic-skills (T2) | **leave as-is** | Routing-to-Laravel + cross-stack neutrality check; both legitimate. |
| 11 | `keyword 'artisan'` | docker-commands (T1) + laravel-routing (T1) | **leave as-is** | Container-host policy + Laravel routing; both gates on artisan usage. |
| 12 | `keyword 'composer'` | docker-commands (T1) + cli-output-handling (T2) | **leave as-is** | Container policy + CLI-output filtering; both apply to composer invocations. |
| 13 | `keyword 'phpstan'` | php-coding (T1) + cli-output-handling (T2) | **leave as-is** | PHP-coding standards + CLI-output filtering. |
| 14 | `keyword 'valuation'` | domain-safety-disclaimer (T2) + finance-safety-floor (T2) | **leave as-is** | Same as #9. |
| 15 | `path_prefix '.agent-src.uncondensed/rules/'` | framework-neutrality-in-generic-skills (T2) + rule-type-governance (T2) | **leave as-is** | Neutrality on rule bodies + rule-tier governance; orthogonal. |
| 16 | `path_prefix '.augment/'` | augment-source-of-truth (T1) + augment-edit-discipline (T2) | **leave as-is** | Source-of-truth gate + edit-discipline; both fire on `.augment/` writes. |

## Cumulative verdict

**0 of 16 clusters are eligible for delete-only dedup.** Every
identified duplicate is a cross-cutting concern where multiple rules
legitimately need to consider activation on the same trigger
surface. The council's prior estimate (500-1 950 token saving from
dedup) was based on an unsupported 30 % redundancy hypothesis;
verified redundancy is **0 %**.

## Token-delta impact

`dist/router.json` unchanged; no rule frontmatter edited; **0 tokens
saved**. The roadmap's Phase 4 ships as **closed-with-zero-cuts** —
the absence of waste is itself the finding.

## Rollback

n/a — no edits made.
