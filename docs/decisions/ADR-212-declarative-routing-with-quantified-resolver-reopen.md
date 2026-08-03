---
adr: 212
status: accepted
date: 2026-08-03
decision: declarative-routing-with-quantified-resolver-reopen
supersedes: —
superseded_by: —
phase: road-to-tested-routing Phase 5
type: structural
review_trigger: >-
  Reopen when the deterministic trigger fires: after the Phase-3
  word-boundary-anchored matcher, ≥ 30% of tier-2 rules fail their
  routing-matrix floor (tests/eval/routing-matrix/ executed by
  tests/scripts/routing_matrix.test.ts) — then the layer-1 resolver spike
  runs per internal/bench/layer1-resolver-PREREG.md (T1–T4 unchanged) with
  the two invariants below. Also reopen if a materially weaker host tier
  enters the consumer set (the ADR-054 corpus contained zero weak-host
  sessions) or an explicitly funded run of the full pre-registered design
  is authorized.
---

# ADR-212 — Rule routing stays declarative; the runtime resolver was evaluated and not built (quantified reopen)

## Status

**Accepted** · 2026-08-03. Amends [`ADR-040`](ADR-040-execution-model-projection-time-filtering.md)
(projection-time filtering) by correcting its stale factual premise and
recording the resolver evaluation ADR-040 said must happen in "a separate
ADR … never silently as part of the projection work". It does NOT reverse
ADR-040's decision. [`ADR-054`](ADR-054-rule-adherence-decay-triggered-restate.md)
(rejected) is explicitly untouched — that record rejected an
adherence/salience mechanism on an honest null; this record governs
delivery and token economy, a different mechanism.

## Context

A routing-delivery failure (the session-canary hook's settings gate read
only the project layer, 2026-08) prompted a full architecture map and a
maintainer mandate to re-question prior locks: *"if active routing is
better, we tip the ADRs."* Findings and evidence consulted:

- **There is no runtime router.** `dist/router.json` is consumed offline
  only; on hosts that load all rules (Claude Code, Cline, Gemini),
  activation is model judgment over descriptions; Cursor/Windsurf attach
  host-natively via derived globs; the hook layer is the only
  deterministic runtime routing.
- **ADR-040's factual premise is stale** — it asserted "no plugin API, no
  hook, no interception" (2026-06); the hook layer now registers ten
  session_start concerns and three user_prompt_submit concerns under a
  pre-registered 250 ms p95 budget. A stale premise is grounds to REOPEN a
  decision, not to ignore it — hence this record.
- **AI council, 2 rounds, 2026-08-03** (claude-sonnet-4-5 + gpt-4o):
  converged AGAINST building the pre-registered layer-1 resolver now.
  Load-bearing arguments: (1) the resolver's "intelligence" is the same
  lexical matcher the declarative pipeline uses — matcher repairs benefit
  both, without runtime infrastructure; (2) validation precedes
  infrastructure — coverage data first, resolver only if data shows
  systematic failure; (3) the failure asymmetry (under-injection silently
  drops a guardrail) demands kernel + tier-1 stay always-loaded under ANY
  resolver; (4) deterministic replay stays the verdict instrument — no LLM
  judge in gate paths. Round-1 dissent (injection-on-match differs
  materially from the nulled thin-pointer variant) was withdrawn in round
  2 for the build-now question and survives only as framing for the
  reopen mechanism.
- **Prior evidence honored, not relitigated:** the thin-projection honest
  null (36.2% win-rate vs a 48% pre-registered floor), the ADR-054 null
  (0/67 blind-adjudicated violations), and
  [`internal/bench/layer1-resolver-PREREG.md`](../../internal/bench/layer1-resolver-PREREG.md)
  (T1–T4 binding thresholds; P1 transport, P2 corpus, P3 lock).
- **External landscape (2026-08-03 tree audits, anonymized per
  source-confidentiality):** one operator-runtime reference now ships
  semantic rule-shard retrieval with an always-include core-rules
  invariant — corroborating both the kernel-always-full invariant and the
  PREREG's stance that semantic retrieval (not more lexical machinery) is
  the mechanism to evaluate IF the lexical ceiling is hit. No surveyed
  suite ships prompt-time rule routing on a host-projected (daemon-free)
  architecture.

## Decision

1. **Rule routing stays declarative** (projection-time filtering +
   host-native attachment + model judgment), hardened by the
   road-to-tested-routing test surface: live `routing:doctor`, composed
   session_start chain tests, per-rule routing matrices (tier-1 hard
   floor, tier-2 ratchet), and the derived router-coverage corpus.
2. **The matcher root-cause repair shipped** (word-boundary-anchored
   `keyword`, phrase stays substring; census 495 → 433 with zero intended
   positives lost) — the repair the resolver would have needed anyway,
   delivered to the declarative pipeline instead.
3. **The layer-1 resolver is NOT built now.** Its evaluation bar stays
   the pre-registered T1–T4; this record clears PREREG P3 by being the
   amending decision record ADR-040 demanded, and P2 is factually
   satisfied (97 labelled rule ids ≥ the 50-id bar).
4. **Two invariants bind any future resolver:** kernel + tier-1 rules
   stay full-bodied everywhere (never probabilistically delivered), and
   resolver failure fails OPEN to eager (never fewer rules than today on
   error). P1 (a user_prompt_submit stdout transport) remains its own
   contract change if and only if the reopen fires.
5. **The reopen is quantified and deterministic** (see
   `review_trigger`): ≥ 30% of tier-2 rules failing their matrix floor
   post-anchoring runs the PREREG spike — no restated complaint, no
   council re-run, no silence.

## Monitoring note — German-inflection recall (added 2026-08-03, before the first rules-mode canary run)

The anchored matcher's documented recall cost is inflected forms
(German verb endings; the plural-s relief covers English plurals only).
Pre-registered trigger, fixed BEFORE any canary data exists: if the
weekly rules-mode canary shows German-prompt recall ≥ 15 percentage
points below English-prompt recall on the same suite for TWO consecutive
scheduled runs, an inflection-relief change (e.g. optional `-e`/`-en`
right-edge relief) runs as its own measured before/after PR — the same
shape as the anchoring change itself. This trigger governs matcher
relief only; it is NOT a resolver reopen (that stays the ≥ 30% tier-2
floor-failure trigger above).

## Consequences

- Routing complaints now have a live diagnosis path (`routing:doctor`)
  and a deterministic regression surface; "routing doesn't work" becomes
  a checkable claim.
- The resolver question stops recurring conversationally: it either
  fires its trigger and runs the pre-registered spike, or stays closed.
- LLM-side evals (rules mode, weekly cross-model canary) are advisory
  diagnostics by construction — a breach fails only the scheduled job.

## Alternatives considered

- **Build the resolver now** — rejected (council 2-round convergence):
  no measured delivery failure to fix, thin-projection null unaddressed,
  T3 recall unproven for lexical matching, transport precondition (P1)
  would force a hook-contract change ahead of any evidence.
- **Reject the resolver permanently** — rejected: a 0/67 null from blunt
  instruments does not earn epistemic closure (ADR-054's own record), and
  the maintainer mandate explicitly demands locks stay revisitable.

## References

- The executing roadmap (road-to-tested-routing; transient layer, archived
  on completion — not linked per no-roadmap-references).
- [`docs/contracts/rule-router.md`](../contracts/rule-router.md) —
  matching semantics updated in the same change.
- [`internal/bench/layer1-resolver-PREREG.md`](../../internal/bench/layer1-resolver-PREREG.md)
  — binding thresholds + preconditions; P3 pointer updated to this ADR.
- Council raw sessions: `agents/runtime/council/responses/` (local-only,
  auto-pruned) — convergence inlined above per no-roadmap-references.
