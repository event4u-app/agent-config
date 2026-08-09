# Blind register — plan 3 (activation red-baseline; outcome withheld at writing time)

## 1. Three most probable causes of death, ranked

**#1 — The pre-registered bar is unsatisfiable by the corpus that exists, and the search dies as a measurement artifact rather than a verdict.** The bar demands ≥5 sessions × ≥8 turns, an *objectively* violated obligation, the rule *manually verified as still in context*, and *turn-by-turn token accounting proving ≥3K tokens of distance*. The redacted chat-history JSONL was never designed to support this reconstruction: redaction plausibly strips exactly the material (file paths, diff contents, verification-command output) needed to decide "machine-checkable obligation violated" and to rebuild per-turn token positions. The initiative then closes on Branch A — "no red baseline found" — but the honest reading is "the corpus cannot answer the question." Because Branch A's consequence is *permanent* refusal (ADR-054 → `rejected`, D1 refused, standing design deleted), a data-quality failure gets laundered into a fourth "null," and the operator's original complaint ("skills and rules do not always fire") survives untouched under a now-locked door.

**#2 — The `in-context-and-violated` vs `not-projected` triage drains the corpus into the wrong bucket.** The plan's cleanest move — routing not-projected rules to "a different fix" — is also its most likely kill mechanism: for any candidate failure, proving the rule *was* projected into that specific session, months later, from JSONL alone, is the hardest classification, so ambiguous rows default to `not-projected` or `rejected`. The activation corpus empties not because activation works but because the classifier is asymmetric. The separately-recorded projection defects then have no roadmap, no owner, and no phase — they were explicitly deferred to "a different fix" that this file never creates.

**#3 — Branch B stalls at candidate 1–2 with an unmeasurable "closes the gap" criterion.** The verify clause says each cheap candidate is "measured against the Phase-0 corpus," but candidates 1–3 (written-down state, file→skill table, stop-event warner) are *preventive* mechanisms and the corpus is *historical* failures — there is no defined procedure for replaying old sessions against a new static table. The team ships candidate 2 (cheap, build-step-integrated, feels like progress), declares the gap plausibly closed without a comparable measurement, and the resolver question is never actually decided — the initiative ends in the exact "architecture instead of evidence" state it set out to escape.

## 2. One untested hidden dependency

The plan assumes the redacted JSONL retains **turn-level token positions and enough obligation-relevant content to adjudicate violations mechanically**. It pre-registers the bar *before looking*, but never runs a one-session feasibility probe confirming the data can carry a single conforming row. Everything downstream depends on this, and nothing tests it.

## 3. One modification that makes failure survivable

Split Branch A into two distinct exits: **A1 "searched and found nothing"** (→ permanent refusal, as written) and **A2 "corpus could not decide"** (insufficient redaction fidelity, ambiguous projection status, <5 reconstructible sessions) → ADR-054 stays `proposed` with a named data-collection prerequisite (e.g., unredacted-enough logging for N future sessions), and the refusal is *deferred, not permanent*. This one fork prevents a measurement failure from being irreversibly recorded as an evidential null.

## 4. Tripwire metric with horizon

**Metric:** after sweeping the first 10 candidate sessions, count rows where both (a) the obligation violation is machine-decidable from the JSONL and (b) token distance is reconstructible. **Threshold/horizon:** if fewer than 2 of 10 sessions yield even one fully-reconstructible candidate row within the first analysis week, cause #1 is materializing — stop the sweep, invoke the A2 exit design before any verdict commit.
