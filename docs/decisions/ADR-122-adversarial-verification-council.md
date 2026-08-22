---
adr: 122
status: accepted
date: 2026-07-14
decision: adversarial-verification-council
supersedes: —
superseded_by: —
phase: adversarial-verification-council
type: structural
---

# ADR-122 — Adversarial verification council: finding-coverage scope, advisory-only, default-off

## Status

Accepted (2026-07-14).

## Context

The verify/council family is mature: the external council engine, multi-round
debate, chairman mode (ADR-120), stance tally, `verify-repair-loop` (the
judge→revise→re-judge loop), the seven `judge-*` skills, `judge-synthesis`, the
`subagent-orchestration` mode set, and the `verify-budget` routing all ship. A
three-strand research pass (surface map + archived-roadmap autopsy + infra
inventory, 2026-07-14) confirmed that almost every *decision-consensus*
mechanism in this space is either built or is a recorded honest-null:

- recursive self-correction as a capability/discipline lever — honest-null,
  council-terminal (ADR-106);
- the judge→revise→re-judge loop — shipped as `verify-repair-loop`;
- personas / named-figure agents — placebo-null (Δ=0.17, p=0.607); provider
  diversity moved quality ~15× more than persona identity;
- browser-automation council members — maintainer-killed (council-modes 2c);
- a `--council` in-flow UX product surface — stub, gated on the
  orchestration-scope decision + a demand signal;
- "council beats a solo strong model on decision quality" —
  `council-vs-solo-baseline`, pre-registered `unbacked`, spend-gated.

The one un-mined, evidence-supported wedge is **adversarial verification as
defect FINDING coverage** (not decision quality). The `cross-vendor-parity`
claim is *backed*: different providers surface different real findings on
multi-file analysis; both catch a planted hollow impl; both stay silent on a
clean control. No wired surface exists that runs a model-diverse skeptic panel
adversarially against a real change to maximise defect-finding coverage — the
nearest kin (`judge-with-debate`, strict-er-wins on one verdict;
`judge-synthesis`, consume-only consensus) do something categorically different.

## Decision

Ship an **adversarial verification council** as a distinct, opt-in,
**advisory-only** surface, scoped to **finding coverage, not decision quality**:

1. **A 9th `subagent-orchestration` mode** `adversarial-verification-council`:
   N (default 2) distinct-model skeptics red-team a real, already-verified
   change through the `judge-*` lenses; each returns findings; results are
   reconciled into a findings-by-severity verdict with per-finding provenance and
   a cross-model confidence signal. Distinct from Mode 6 because the output is a
   **findings-union with provenance**, not a strict-er-wins single verdict.
2. **A machine-readable findings envelope** `adversarial-findings.json` (draft-07,
   hand-validated like `subagent-status.json`) — filling the gap of no shared
   judge-verdict schema.
3. **Countable reconciliation in TS with tests** (`adversarial_reconcile.ts`):
   dedup, severity-quorum confidence, and false-positive suppression. Never
   LLM-computed prose (anti-lesson). Never gates the change — only ranks and
   annotates findings.
4. **Opt-in wiring, default-off**: a `subagents.adversarial_council: off|ask|on`
   setting (default `off`); an opt-in escalation tier in `verify-budget` for
   explicitly high-risk changes; an opt-in flag on `/review-changes` (or
   `/judge`). The panel never auto-gates a change (Hard Floor: advisory only).
5. **Prove-or-drop against a pre-registered finding-coverage claim**
   (`adversarial-council-finding-coverage`, `unbacked` at start). The benchmark
   is a **two-stage residual-detection protocol** (single strong judge first →
   panel on the judge-passed residual subset), on a corpus with published
   judge-survivable subtlety distribution, with a **dual threshold** (relative
   ≥ +25% AND absolute ≥ +8 pp residual-recall lift) and a
   **controversial-but-correct FP control**. Honest-null is an accepted outcome
   and keeps the surface inert-by-default until a re-run of this same protocol
   clears both locked thresholds with the FP control held.

### Skeptic transport (fork F1)

Everyday mode uses an in-session subagent panel with enforced model diversity.
The **registered benchmark run and the opt-in high-risk tier require
cross-*vendor* skeptics** (via `council_cli.ts`, artefact/diff-as-text,
read-only) — the backed `cross-vendor-parity` signal is provider-level, so the
claim cannot rest on same-vendor model diversity alone.

## Consequences

- The package gains a defect-finding verification surface that composes existing
  primitives — no rebuilt engine, no recursion loop, no persona layer, no
  browser automation, no `--council` UX product.
- A new shared findings schema exists that future judge-panel work can reuse.
- The value claim is measurable (finding coverage on a static corpus, unlike
  orchestration value in the no-runtime harness), and its resolution is honest:
  a null keeps the surface off by default, like recursive-verification.
- Default-off means zero cost/behaviour change until a consumer opts in.

## Landmine-clearance (do-not-relitigate map)

Each settled decision this roadmap does NOT touch:

- **Recursion / re-attempt loop** — not added; the panel is single-pass finding
  generation, not a self-correction loop.
- **judge→revise→re-judge** — reused (`verify-repair-loop`), not rebuilt.
- **Council engine / debate / budget / redaction / chairman** — reused, not
  re-proposed.
- **Personas / named-figure agents / persona panel-mode** — not used; skeptics
  are model-diverse, not persona-diverse.
- **Browser-automation / web-subscription scraping** — not revived.
- **`--council` in-flow UX product / verdict-report product layer** — not built;
  the findings envelope is an engineering contract, not a productized report.
- **council-vs-solo decision-quality claim** — out of scope; the claim here is
  finding coverage, resting on the backed `cross-vendor-parity` signal.
- **Orchestration value measured in a no-runtime harness** — not claimed; the
  benchmark measures finding coverage on a static planted-defect corpus.
- **Prose-computed reconciliation** — reconciliation is TS with tests.

## Alternatives

- **Extend Mode 6 `judge-with-debate`** — rejected: its strict-er-wins single
  verdict is a go/no-go decision, categorically different from a findings-union;
  overloading it would blur two contracts.
- **Build on the external `ai-council` for the everyday path** — rejected: the
  external council is artefact-only / read-only by Hard-Floor contract; the
  everyday code path is in-session `subagent-orchestration`. External
  cross-vendor is reserved for the registered claim + high-risk tier.
- **Default-on** — rejected: no evidence yet; default-off until the
  pre-registered claim is `backed`.

## References

- `agents/roadmaps/archive/road-to-adversarial-verification-council.md` — the roadmap.
- ADR-106 (recursive-verification honest-null), ADR-117 (subagents.auto flip),
  ADR-120 (council chairman mode), ADR-109 (subagent-v1 contract).
- `docs/CLAIMS.md#adversarial-council-finding-coverage` — the pre-registered claim.
- `cross-vendor-parity` (backed) — the evidence the finding-coverage scope rests on.

## Addendum (2026-07-21) — finding-coverage claim resolved HONEST-NULL

The pre-registered `adversarial-council-finding-coverage` claim was executed and
resolved **negative**. A curated judge-survivable corpus
(`internal/bench/adversarial-council/`: 12 planted-defect fixtures across
multi-file-interaction / logic-inversion / security-masked / complex-state + 3
controversial-but-correct clean controls; subtlety distribution published;
passed an independent validity audit after one fixture was repaired) was run
cross-vendor (anthropic `claude-sonnet-4-5` + openai `gpt-4o`) under the
maintainer spend authorization.

**Result:** on the judge-passed residual, the 2-vendor skeptic panel matched the
single skeptic exactly (residual recall 0.60 = 0.60, **zero lift** — the second
vendor's catches were a strict subset of the first's), at a **100%** false-
positive rate on the controversial-but-correct controls under the adversarial-
skeptic posture. Both locked recall thresholds missed -> honest-null. **The
Mode 9 `adversarial-verification-council` surface stays default-off** (no
settings change — it already ships off), recorded like recursive-verification
(ADR-106). **Reopen condition, which the measurement itself supplies:** a re-run
of the two-stage residual-detection protocol that clears both locked thresholds
(relative ≥ +25 % AND absolute ≥ +8 pp residual-recall lift) with the
controversial-but-correct FP control held. Nothing else — an argument that the
panel ought to help is not the condition, and the zero-lift result is what the
re-run has to overturn. Detail + reproducible artifact:
`docs/benchmark.md#adversarial-verification-council`,
`internal/bench/adversarial-council/runs/`.

**Transport lesson (durable):** `council_cli run`/`debate` is a *deliberation*
transport — multi-round peer-review with cross-member visibility, prose output.
It is the WRONG tool for an independent-skeptic, structured-output benchmark (it
violated the independence requirement and defeated JSON scoring; the first run
through it was rejected as an artifact). The valid measurement uses direct,
independent per-vendor client calls with a strict-JSON contract and a
deterministic, pre-validated scorer.
