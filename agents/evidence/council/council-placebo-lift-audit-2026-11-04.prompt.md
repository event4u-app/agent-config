# Council question — should the `placebo` arm stay in the footprint-lift audit?

<!-- evidence-type: analysis -->

## Context

`bench_ab_v2_run` (an A/B harness that runs the Claude CLI on coding tasks under
several "arms") audits each finished sweep. One audit direction, the
footprint-lift check (`audit_activation` in `src/scripts/_lib/bench_ab_activation.ts`),
requires every arm that is expected to carry a treatment to have a total prompt
footprint (input + cache read + cache creation tokens, summed over the whole
multi-turn run) of at least 1.2x the paired `vanilla` run with the same seed. A
pair below that is a `collapsed-to-baseline` violation, and any violation marks
the whole report "NOT publishable".

The 1.2 threshold was calibrated against `package` (4.7x and 6.8x observed) and
`rules-kernel-dc` (1.7x observed). An arm can opt out with `min_lift_ratio: null`,
which narrows its audit to the per-trial text direction (a text arm must carry
its injection, a non-text arm must not), checked both ways. `bare-principle`
(one sentence) and `profile-minimal` use this opt-out.

`placebo` injects inert prose through the system prompt, length-matched to the
RDP injection: 6,709 characters, roughly 1.7k tokens per turn. A test asserts
`placebo` stays in the lift-audit set, with the comment "Every arm that DOES carry
a real surface stays audited — this is the half that must not silently shrink."

## Measurement (2026-11-04, `claude-haiku-4-5`, 2 tasks x 12 seeds)

- `vanilla` first-turn cache creation: ~11.3k tokens. Whole-run prompt footprint
  median 82k (task 1) and 125k (task 2); range 72k–235k, driven by turn count.
- `placebo` footprint median 77k (task 1) and 131k (task 2).
- 19 of 24 `placebo` pairs fall below 1.2x; observed ratios 0.37–1.17. Per-trial
  text direction: all 24 `placebo` runs carried their injection.

## Question

Should `placebo` keep the footprint-lift check, receive `min_lift_ratio: null`
(text direction only), or be audited some other way? State the reasoning and
any condition under which your answer would change.
