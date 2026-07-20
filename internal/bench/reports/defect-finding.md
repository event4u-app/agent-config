# Defect-finding benchmark — results (road-to-team-mode Phase 5)

> Run 2026-07-20. Codex reviewer: `gpt-5.5`. Primary metric = deterministic
> recall against corpus ground truth; blind rubric judge (secondary) deferred.

## Per-arm

| arm | recall | correctness | design | false-pos | calls | $ |
|---|--:|--:|--:|--:|--:|--:|
| self-review | 1 | 1 | 1 | 1 | 12 | 0.0438 |
| team | 1 | 1 | 1 | 0 | 12 | 0 |
| council | 1 | 1 | 1 | 0 | 24 | 0.0394 |

## Verdict

- H1 (team − self, correctness recall Δ): **0** — met: false
- H2 (council vs team, design recall |Δ|): **0** — met: true
- H3 (false positives ≤ 1/arm): true

**Disposition:** HONEST NULL — arms indistinguishable within pre-registered thresholds; no lift claim binds.

Total billable: $0.0832 (arm b codex = subscription, $0 billable).
