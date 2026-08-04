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

## AFTER

(to be filled by the measurement after the cut — same command, same metric)
