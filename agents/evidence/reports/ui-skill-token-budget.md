# UI reference skills — progressive-disclosure token budget (pre-registered)

> Hand-maintained pre-registration + measurement record (routing-correctness
> Phase 3). The BEFORE numbers and the threshold were committed BEFORE the
> first cut — commit ancestry is the freeze proof.

## Pre-registered threshold (frozen before any cut)

- **Metric (proxy for tokens-per-UI-task):** summed GPT-token count of the
  four SKILL.md bodies (`fe-design`, `design-intelligence`,
  `existing-ui-audit`, `design-review`) — the payload an invocation loads
  today, measured with `src/scripts/_lib/token_count.ts` (tiktoken
  cl100k_base).
- **Threshold: total reduced by ≥ 30%**, with ZERO passages deleted — every
  moved section survives verbatim in the skill's `references/` sub-files
  (the section-level entry points), and the SKILL.md keeps frontmatter,
  when-to-use, the procedure skeleton, Iron-Law/anti-slop content, and a
  section index that names which reference file to load per task shape
  (preservation-guard applies).

## BEFORE (2026-08-04, at the pre-registration commit)

| Skill | chars | GPT tokens |
|---|---|---|
| fe-design | 22,852 | 5,374 |
| design-intelligence | 19,965 | 4,949 |
| existing-ui-audit | 17,765 | 4,350 |
| design-review | 15,521 | 3,730 |
| **Total** | **76,103** | **18,403** |

## AFTER (same command, same metric)

| Skill | chars | GPT tokens | references/ entry points |
|---|---|---|---|
| fe-design | 7,749 | 1,795 | design-patterns.md · design-read-and-memory.md |
| design-intelligence | 10,752 | 2,613 | context-and-registers.md · integration-mapping.md (+ the two pre-existing) |
| existing-ui-audit | 16,461 | 4,052 | anti-slop-cross-reference.md |
| design-review | 11,156 | 2,688 | review-communication.md · verification-automation.md |
| **Total** | **46,118** | **11,148** | |

**Reduction: 39.4% — the pre-registered ≥30% threshold is met.** (Output format + Gotcha stayed in-body for existing-ui-audit — required skill sections per the linter; only the anti-slop cross-reference moved.) Every moved
section survives VERBATIM in its references/ file; each SKILL.md carries a
"Section index — load on demand" routing table. `design-intelligence` stays
inside its rich-class band (2,000–5,000 tokens) with the "Why this skill is
rich" section retained; lint_token_budget_discipline, audit_skill_overlap
(0 pairs ≥ 70%), and skill_linter --changed (44/44) are green.

Output-quality judgment stays routed to `bench:ui` — this work adds NO second
UI harness (roadmap non-goal upheld).
