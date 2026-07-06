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
