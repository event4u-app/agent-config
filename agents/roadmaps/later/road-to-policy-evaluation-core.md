---
status: blocked-for-later
complexity: lightweight
---

# Road to policy-evaluation core — deterministic Class-A slice of the rejected resident enforcement plane

> **Arrivals:** 3 (at least) — latest `inbox-2026-09-i` (2026-09-05); earlier: two untracked prior rounds on the same subject, recorded in that round's recurrence table.

> **Blocked until BOTH hold:** (1) the first native engine's Phase-5 benchmark
> verdict is published (ADR-124 sequencing rule; queue position 2 per the
> sequencing plan in `road-to-native-code-intelligence.md`), AND (2) a named
> consumer demand signal exists for machine-evaluable policy verdicts —
> not "two models suggested it" (the operator-harvest reopen standard).
>
> **Gate (1) HAS FIRED — and it fired AGAINST this roadmap (2026-07-28).** The
> first native engine's verdict is an honest null: the code graph measured
> recall **0.365 vs disciplined grep 0.797** (Δ −43.2 pp) and is now
> permanently `enabled: false` with a deprecation date
> (`docs/CLAIMS.md` `code-graph-retrieval-null`; `docs/MIGRATION.md`
> § Scheduled deprecations). So the sequencing rule no longer blocks this
> roadmap — but the evidence it produced argues against starting it as
> designed. Council 2026-07-28 (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
> 2 rounds) read the null's root cause as a **category limit, not a bug**:
> static graphs cannot represent dynamic dispatch, runtime-constructed
> identifiers, or non-hoisted arrow functions (170 TS vs 13,428 PHP symbol
> nodes on same-shaped repos). Both members recommended treating this roadmap
> as **approach-invalidated** rather than unblocked.
>
> **Consequence for the resume decision:** gate (2) — a named consumer demand
> signal — is now the ONLY gate, and it must be met by a demand signal for
> *policy verdicts*, not for graph retrieval. If that signal arrives, the
> roadmap needs a re-scope to a non-graph mechanism before any build, and the
> re-scope must state how it avoids the measured category limit above.
> Whether the file is instead archived outright is the maintainer's
> disposition call — recorded here rather than executed unilaterally, since
> archiving buries planned work.

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
