# Layer-1 rule resolver — pre-registration (fixed before any resolver code)

Registered 2026-08-02 · owner: maintainer · road-to-renewal-foundation Phase 3.

**Status on registration day: steps 3 and 4 are PARKED as infeasible-as-specified.**
Two preconditions are missing, both found by inventorying the spike's own
dependencies rather than by attempting it. They are named in § Preconditions
and are the reopen terms. This record exists so the next attempt starts from a
declared bar instead of re-deriving one — which is the entire point of writing
thresholds before code.

## What is measured

Whether replacing the eager always-on non-kernel rule load with a prompt-time
resolver — matching the prompt and touched paths against `dist/router.json`
triggers and injecting only the matched non-kernel rule bodies, kernel always
full — buys tokens without losing rule adherence.

**Not measured:** semantic retrieval. The resolver matches keyword / phrase /
path only. Embedding-based trigger matching is out of scope; its reopen
condition is the injection-precision threshold below being unreachable by
lexical matching, which would indicate a mechanism ceiling rather than an
implementation gap.

## Arms

| arm | rule layer |
|---|---|
| `eager` (control) | today's shipped behaviour — every non-kernel rule body always present |
| `resolved` | kernel always + only the non-kernel rules whose triggers match the turn |

Both arms read the SAME `dist/router.json`. No per-prompt tuning, no
hand-picked rule sets.

## Binding thresholds — declared before any code

| # | metric | threshold | why this number |
|---|---|---|--:|
| T1 | token delta on the primary surface (`.claude` rules, `audit_initial_context`) | **≥ 25,000 GPT tok** reduction vs the eager arm | below that the pack axis (measured −8,110) plus the catalog dedup (−4,213) already deliver a comparable share at a fraction of the risk, so a resolver would not earn a runtime mechanism |
| T2 | injection precision — matched rules that the prompt genuinely concerns, over the 678-trigger set | **≥ 0.70** | a resolver that injects most of the set on most prompts has not resolved anything; 0.70 is the point at which the injected set is meaningfully narrower than eager |
| T3 | non-kernel missed-load (recall) on a labelled corpus | **≥ 0.95** | the quality arm. A missed rule is a silently dropped guardrail; the asymmetry against T2 is deliberate — over-injecting costs tokens, under-injecting costs behaviour |
| T4 | hook wall-clock | within `src/config/hook-latency-budget.json` `any_hook_event.p95_ci = 250 ms` | reuses the shipped, already-pre-registered budget rather than inventing a second one |

**Any one threshold missed ⇒ the spike is a LOSS**, parks permanently with its
numbers next to ADR-054, and flips nothing.

**A WIN flips nothing by itself either.** It produces a decision record
(council pass + explicit maintainer sign-off) in a SEPARATE PR from the
measurement. No default changes ride with the numbers.

## The verdict instrument for T3 — named, and NOT anchor scoring

T3's verdict mechanism is **router-telemetry replay**:
`src/scripts/router_telemetry.ts::aggregate_replay`, which already emits
`intended_vs_observed_match` and `unintended_activation_histogram` against
corpus-declared `intended_triggers`. It is deterministic, has no model in the
loop, and its report schema is already committed
(`internal/bench/reports/router-telemetry/latest.json`).

**ADR-202 anchor scoring is excluded**, per that record's own terms: it is a
FINAL honest null (inter-evaluator κ = 0.472 against a registered 0.800 floor)
whose reopen term demands *a different instrument, not a third attempt*. Its
anchors may serve as raw material only; no verdict here depends on them.

## Corpus

`internal/bench/corpora/router-coverage/` — the only corpus in the repo that
labels non-kernel RULE activation (`intended_triggers`, spec:
`docs/contracts/benchmark-corpus-spec.md`). Today: **5 files, 24 prompts, 10
distinct rule ids labelled out of 97 non-kernel rules.**

**Excluded from T3 by construction, not counted as misses:**
`communication-through-line`, `size-enforcement`, `telegraph-speak` — all three
carry ZERO triggers after the 2026-08-02 `intent:` removal and are
description-activated only. A lexical resolver structurally cannot inject them;
counting them as recall failures would measure the schema, not the resolver.

## Preconditions — blocking, and the reopen terms

### P1 — there is no per-prompt injection transport

`src/scripts/hooks/dispatch_hook.ts` forwards a concern's `context` string to
stdout **only** when the event is `session_start`; every other event keeps the
swallow-stdout contract. So `session_start` has a channel but no prompt yet,
and `user_prompt_submit` has a prompt but no channel. The resolver as specified
cannot be built on today's hook layer.

**Reopen when:** the dispatcher's stdout contract is extended to a second event
(a change to `docs/contracts/hook-architecture-v1.md` § Stdout reply) in its
own change, with its own decision record.

### P2 — the corpus covers 10 % of the population

A T3 recall threshold over 10 of 97 rules would produce a number with no power.
The roadmap's own warning — "a shallow version yields a false null" — describes
this corpus exactly.

**Reopen when:** `router-coverage` labels ≥ 50 distinct non-kernel rule ids, or
a power analysis justifies a smaller number (the shape used in
`internal/bench/corpora/scale-history-PREREG.md` § Power analysis).

### P3 — the lock

ADR-040 ("Pack-scoped surfacing is projection-time filtering, not a runtime
resolver") binds on MECHANISM: *"the filter is a build-time set operation …
not a request-time hook"*, and its rejected alternative #2 is literally a
read-time filtering hook. The AI council (2026-08-02) ruled it binding and the
remedy a superseding ADR — never reinterpretation, and never a silent proceed;
ADR-040 itself says a runtime resolver, if it ever ships, is *"a separate ADR
… never silently as part of the projection work"*.

Noted for that ADR when it is written: ADR-040's factual premise about hooks is
stale. It asserted "no plugin API, no hook, no interception" in 2026-06;
`src/scripts/hook_manifest.yaml` now registers ten concerns on `session_start`
and three on `user_prompt_submit`, with a pre-registered latency budget. A
stale premise is grounds to REOPEN a decision, not grounds to ignore it.

**Reopen when:** a superseding/amending ADR is accepted. **→ CLEARED
2026-08-03 by ADR-212** (`docs/decisions/ADR-212-declarative-routing-with-quantified-resolver-reopen.md`):
it amends ADR-040 with the corrected hook-layer premise, records the
council verdict (resolver not built now), and quantifies THE reopen
trigger — ≥ 30% of tier-2 rules failing their routing-matrix floor after
the anchored matcher. P2 is also satisfied (97 labelled rule ids in
`router-coverage/routing-matrix-derived.yaml`). P1 (per-prompt transport)
remains open and becomes actionable only if ADR-212's trigger fires.
Kernel + tier-1 always-full and fail-open-to-eager are binding invariants
on any future spike (ADR-212 § Decision 4).

## What landed instead, and why it is not the spike

Step 2's trigger-precision pass shipped on its own merit: the trigger set has
live consumers today (`router_telemetry`'s shipped analysis) whose signal is
degraded by keywords that match as unanchored substrings. Two provably
redundant short keywords were removed and `lint_trigger_precision.ts` ratchets
the rest at 22.

**The durable repair, deliberately NOT taken:** anchor `keyword` matching on
word boundaries. That fixes all 316 single-token keywords at once and would
make the `keyword`/`phrase` distinction mean something — but it changes shipped
activation semantics for every rule, so it needs its own change with its own
before/after over the coverage corpus and the telemetry replay. Reopen term:
the trigger-precision ratchet stops falling while `unintended_activation_histogram`
stays non-trivial.

## Honest-null consequence (binding)

If the spike ever runs and misses any threshold, the result is published with
its numbers under a "known cost" heading and the resolver is parked
permanently. A resident process, a per-tool plugin, or a relaxed threshold is
NOT improvised as a rescue — the same stance
`src/config/hook-latency-budget.json` already takes for hook latency.
