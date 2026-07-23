---
status: blocked-for-later
complexity: medium
---

# Road to policy-evaluation core — deterministic Class-A slice of the rejected resident enforcement plane

> **Blocked until BOTH hold:** (1) the first native engine's Phase-5 benchmark
> verdict is published (ADR-124 sequencing rule; queue position 2 per the
> sequencing plan in `road-to-native-code-intelligence.md`), AND (2) a named
> consumer demand signal exists for machine-evaluable policy verdicts —
> not "two models suggested it" (the operator-harvest reopen standard).

## What this is — and what it is not

The Source-A/E harvest cycles (operator-runtime, positioning-and-enforcement)
rejected a **resident enforcement/control plane** — compiled runtime hooks,
shield-class interception, a daemon that polices tool calls. ADR-124
re-affirms that at Class B (route to `agent-ide-plugin` if ever needed). What
the reclassification sweep re-opened is the **Class-A slice**: a
*deterministic policy-evaluation core* — a one-shot evaluator that takes a
policy set (the suite's own rules/floors expressed as machine-checkable
predicates) plus a proposed action descriptor, and returns a verdict +
citation. No interception, no residency: hosts (or hooks that already exist)
*call* it; it never sits between the agent and its tools.

## Sketch (to be re-planned when unblocked)

- [ ] Predicate schema for machine-checkable floors (Hard-Floor triggers,
  scope gates, spend gates) — derived from the existing rule corpus, never a
  parallel truth source; each predicate cites its rule.
- [ ] `policy_eval` one-shot CLI: action descriptor in → verdict
  (allow / confirm-required / deny) + rule citation out; exit codes per house
  convention; zero network.
- [ ] Optional wiring into the existing PreToolUse dispatch as one more
  fail-closed handler on hook-capable hosts — reusing the dispatcher, adding
  no new runtime.
- [ ] Pre-registered efficacy measure (caught-violation rate on the existing
  pressure corpus vs prose-only baseline) + honest-null path, per ADR-124 § 3.

## Provenance

- Archived operator-runtime/positioning cycles: resident control plane
  rejected ("compiled runtime betrays no-runtime identity"; runtime hooks
  reach <30% of hosts — flip condition >60% recorded there).
- ADR-124 § 4 sweep (2026-07-23): resident plane re-affirmed B; deterministic
  evaluation core classed A and queued here.
