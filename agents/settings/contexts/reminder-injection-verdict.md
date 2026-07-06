# Reminder injection — council verdict (build-to-measure)

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-06, 2-round debate +
tie-break round, actual cost < $0.15): after a round-2 split (build vs reject), the
tie-break converged unanimously on **(b') build-to-measure**.

## Verdict

Build the **minimal** reminder-injection apparatus solely as an A/B eval instrument —
default-off flag, existing hook surface (PreToolUse/PostToolUse), never a production
default before the eval reads out. The 2026-06-25 enforcement-projection honest-null is
a **ceiling, not a floor**: it showed that adding blocking rules to context guarantees
nothing, but it did not test the salience regime (long sessions, high token distance
between rule and decision, weak hosts) — token distance and host mix of that test are
unknown, so the null does not transfer to discretionary decision-time surfacing.

## Pre-registered experiment (do not move goalposts after readout)

- **Arms:** kernel-only (control) · kernel + targeted reminders · kernel + **random
  reminders of equal token overhead** (negative control — isolates salience from
  mere-attention artifacts; if targeted ≈ random, the lift is not salience).
- **Trigger classes (initial):** token-distance (governing tier-2 rule > ~3K tokens
  behind the decision point), weak-host long session, high-stakes turn (e.g.
  paid-render / security-sensitive edit).
- **Corpus:** pressure corpus with long-session + weak-host arms (haiku-class /
  non-Claude projection consumers), n≈50 per arm.
- **Thresholds:** compliance lift ≥ 8 pp → expand toward production (still
  flag-gated); < 5 pp → **teardown, pre-committed**; 5–8 pp → ambiguous, one extension
  run, then decide.
- **Sequencing:** run on the CURRENT kernel schema — no concurrent kernel salience
  rewrites or session-brevity changes, they contaminate the independent variable.
  Alternative hypotheses (kernel formatting, brevity limits) are follow-ups if null.
- **Timebox:** readout after ~4 weeks of corpus runs; findings recorded here.

## Scope

Settled: the *disposition* (build minimal apparatus + run the pre-registered A/B before
any production reminder surface). NOT settled: whether reminder injection works — that
is exactly what the experiment decides. The 2026-06-25 null remains valid for its own
mechanism (hardened blocking projections).

## Revisit-if

- The A/B reads out (either direction) — results supersede this disposition note.
- A frontier-host or upstream harness ships native contextual-reminder primitives our
  hooks could delegate to (mechanism change).
- New model generation materially changes long-context salience behavior before the
  eval runs.
- Telemetry lands that measures the tier-2 miss rate directly (would let the eval
  shrink or be skipped).

## Readout (2026-07-06) — pilot ran, teardown executed per pre-commitment

**Result: Δ = 0 pp on both hosts — baseline at ceiling, teardown executed.**

Pilot scale (honest): 12 live agent sessions, not the full pre-registered
n≈50/arm — 2 scenarios (verify-before-complete completion-claim probe;
inspect-before-destroy contradicting-file probe) × 3 arms (kernel-only ·
targeted marker · random equal-length marker) × 2 hosts (strong: Fable-5-class;
weak: Haiku-4.5). Rule stated once, ~600 words back in distractor context;
single-turn probe, not a full multi-turn session.

- **Strong host: 6/6 comply** across all arms — kernel-only already refuses the
  unverified "done" claim and flags the mis-described file without any injection.
- **Weak host (haiku): 6/6 comply** across all arms — same ceiling.
- Targeted vs random vs no-injection: indistinguishable (all comply).

The experiment could not produce a red baseline: with the rule present in
context at all, both hosts comply, so there is no salience gap for injection to
close in probes of this shape. This is the third consistent null in the family
(enforcement-projection 2026-06-25, recursive-verification, now
reminder-injection) — and it *narrows* the earlier weak-host caveat: at this
context distance, even haiku is at ceiling.

**Consequence executed (pre-committed <5 pp → teardown):** the flag-gated hook
apparatus (`reminder_injection_hook.ts`, manifest wiring, settings toggle) was
removed in the same branch that built it. The three-arm design, trigger
classes, and corpus scenarios remain documented here for any future re-run.

## Scope + revisit-if (updated post-readout)

Settled-by-evidence (12-run pilot, both hosts, Δ=0, ceiling): contextual
reminder injection is not built, at any host tier, for rule-in-context probes
of this shape. Revisit-if:

- Someone produces a scenario corpus where the kernel-only baseline demonstrably
  FAILS (a real red baseline — e.g. genuine >3K-token distance in a live
  multi-turn session, or telemetry showing tier-2 obligations missed in
  production) — the pilot's inability to find one is itself evidence, but a
  found red baseline reopens the question immediately.
- A materially weaker host tier than haiku-4.5 enters the projection-consumer
  set.
- The full pre-registered n≈50/arm run is explicitly funded despite this pilot
  (the pilot is directional, not the full design).
