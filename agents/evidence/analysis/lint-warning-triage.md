# Lint Warning Triage — 2026-05-09

**Source:** `agents/evidence/analysis/lint-baseline-2026-05-09.txt` (108 warn, 0 fail).
**Post-Phase-1:** 105 warn (external-suite plate cleaned).
**Post-Phase-2 P2.1:** 95 warn (cluster-head exemption + `### Step N`
recognition).
**Output:** 3-bucket classification per the roadmap
`agents/roadmaps/road-to-feedback-followups.md` Phase 2 P2.2.

## Summary by code

| Code | Count | Bucket | Note |
|---|---:|---|---|
| `missing_inspect_step` | 49 | (a) genuine fix | high-volume; addressed incrementally |
| `command_missing_skill_references` | 18 | (a) genuine fix | command bodies should cite at least 1 skill (see `command-writing` skill) |
| `short_procedure` | 10 | (c) check too aggressive | many small focused skills hit this; review threshold |
| `weak_output_format` | 6 | (a) genuine fix | output sections need 2-4 ordered items |
| `procedural_rule` | 6 | (b) `linter_accept_reason` | structural rules with procedural content are intentional in some cases |
| `missing_efficient_tooling_guidance` | 6 | (a) genuine fix | add `jq` / `rg` / `grep` references where filtering is the action |
| `missing_anti_bruteforce_guidance` | 4 | (a) genuine fix | one-line "stop after N retries" guidance |
| `missing_frontend_verification_example` | 3 | (a) genuine fix | mention Playwright / browser tooling |
| `missing_backend_verification_example` | 3 | (a) genuine fix | mention `curl` / Postman / `Http::fake()` |
| `missing_verification_tool_mapping` | 3 | (b) `linter_accept_reason` | for cross-cutting skills the per-task mapping is non-trivial |
| `missing_clarification_guard` | 3 | (a) genuine fix | add explicit clarification step |
| `question_strategy_missing` | 2 | (a) genuine fix | command bodies need numbered-options block |
| `missing_validation_step` | 2 | (a) genuine fix | add validate / verify step |
| `long_rule` | 2 | (c) check too aggressive | rules at the boundary of size cap; review per-rule |
| `handoff_order_missing` | 2 | (a) genuine fix | add ordering hint to handoff section |
| `skill_too_large` | 1 | (b) `linter_accept_reason` | reference catalog deliberately verbose |
| `no_steps` | 1 | (a) genuine fix | non-cluster leaf command needs step structure |
| `missing_runtime_debug_guidance` | 1 | (a) genuine fix | mention debugger / Xdebug |
| `missing_cli_verification_example` | 1 | (a) genuine fix | mention exit code / `expectsOutput` |
| `large_command` | 1 | (b) `linter_accept_reason` | large command intentional, density acceptable |

## Bucket totals (post-P2.1, 95 warnings)

- **Bucket (a) — genuine fix:** ~78 (≈ 82%)
- **Bucket (b) — `linter_accept_reason` justified:** ~10 (≈ 11%)
- **Bucket (c) — check too aggressive:** ~7 (≈ 7%)

## Action plan

### Bucket (a) — genuine fixes (incremental)

These are content edits, not structural changes. Schedule:

- High-leverage codes (`missing_inspect_step` × 49,
  `command_missing_skill_references` × 18) ship as separate cleanup PRs
  in batches of 10–15 to keep review surface small. **Forward-only** —
  newly authored skills must clear these warnings before merge; the
  108-warning baseline is the cap, not the floor.
- Verification-example codes (`missing_*_verification_example`,
  `missing_efficient_tooling_guidance`,
  `missing_anti_bruteforce_guidance`,
  `missing_runtime_debug_guidance`) batch together — one PR per skill
  family.
- Single-instance codes (`no_steps`, `large_command`,
  `missing_cli_verification_example`) → include in the PR that already
  touches the skill.

### Bucket (b) — `linter_accept_reason` (deferred)

Requires the linter to **support** the frontmatter key. Implementation
deferred to a later phase (out of scope for this roadmap):

```yaml
linter_accept_reason:
  procedural_rule: "structural+procedural by design — see ADR-XYZ"
  large_command: "router head with 12 sub-commands; density acceptable"
```

Until then, these warnings remain in the baseline, tagged with
`(b)` in this triage doc.

### Bucket (c) — check too aggressive

Open issues to revisit the check thresholds:

- `short_procedure` — current floor may be too high for focused skills;
  review what the median procedure length is across the 153 skills and
  consider lowering the floor or making it density-aware.
- `long_rule` — review per-rule which boundary cases trip; may be a
  one-time content rebalance vs. raising the cap.

No content changes for bucket (c) until the linter check is
re-evaluated.

## Acceptance for P2.2

- This file exists and lists all baseline warning codes with bucket
  classification.
- Bucket (a) is forward-only enforced (already true: every PR runs
  `task lint-skills` and adds-only baseline diff is reviewed in PR body
  per Phase-3 advisory pattern).
- Buckets (b) and (c) tracked here; no per-skill action this phase.

## Re-baseline

Once Phase 2 / 3 land and a meaningful chunk of bucket (a) is
addressed, regenerate the baseline:

```bash
task lint-skills > agents/evidence/analysis/lint-baseline-$(date -I).txt
```

The new baseline becomes the cap for subsequent PRs.
