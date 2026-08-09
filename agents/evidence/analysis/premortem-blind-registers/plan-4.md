# Blind register — plan 4 (reminder-injection A/B; outcome withheld at writing time)

## 1. Three most probable causes of death, ranked

**#1 — The pressure corpus cannot generate a measurable baseline miss rate.** The whole design assumes the kernel-only control arm produces enough tier-2 compliance *failures* to lift against. But the trigger classes (token-distance >~3K, weak-host long session, high-stakes turn) are hypothesized, not measured — the plan itself notes tier-2 miss-rate telemetry does not exist (it's a revisit-if condition). If the control arm misses at, say, 4% rather than 30%, an 8 pp lift is arithmetically unreachable at n≈50 per arm: the experiment reads out `< 5 pp` and triggers the pre-committed teardown — not because reminders don't work, but because the corpus never manufactured the failure regime the reminders were built to fix. The initiative dies by its own kill-threshold on a floor effect it never checked for.

**#2 — The sequencing freeze breaks over a ~4-week timebox.** The plan requires running on the *current* kernel schema with no concurrent kernel salience rewrites or session-brevity changes. In a repo that ships kernel-rule PRs continuously (with a 24h-soak cadence, not a freeze culture), four weeks of corpus runs is a long window to hold the independent variable still. One merged kernel formatting or brevity change mid-run contaminates all three arms asymmetrically; the readout is then unattributable, the "do not move goalposts" clause forbids re-cutting the data, and the honest answer is "invalid run" — which in practice means quiet abandonment rather than a clean re-run.

**#3 — The equal-token random-reminder arm is not actually a negative control.** Building "random reminders of equal token overhead" that are genuinely inert is hard: random rule text injected at PreToolUse still nudges behavior (caution, verbosity, refusal rate) on weak hosts. If random ≈ targeted because *both* lift, the pre-registered read is "not salience" and the mechanism is declared dead — when the true finding was "any decision-time injection helps." The design's own isolation logic converts a positive result into a teardown verdict.

## 2. One untested hidden dependency

The plan assumes **hook-injected reminders on weak-host / non-Claude projection consumers are actually delivered into model context**. The arms live on the "existing hook surface (PreToolUse/PostToolUse)" — but the weak-host arm is defined as projection consumers, several of which have no hook slots at all, and hosts that do have them may discard advisory-path context. The experiment never verifies delivery before measuring effect; a zero-delivery arm reads as a clean null.

## 3. One modification that makes failure survivable

Run a **stage-0 baseline gate**: before building the injection arms, run the kernel-only corpus alone and require a control-arm tier-2 miss rate ≥ ~15% (making an 8 pp lift detectable at n≈50). If the baseline is below the floor, the pre-committed outcome is "re-cut trigger classes / grow n," not teardown. This converts death cause #1 from a fatal `< 5 pp → teardown` into a corpus-redesign loop, and produces the miss-rate telemetry the revisit-if clause wanted anyway.

## 4. Tripwire metric with horizon

**Metric:** control-arm (kernel-only) tier-2 compliance-failure rate on trigger-class turns. **Threshold + horizon:** after the first 10 corpus runs per arm (~week 1 of the 4-week timebox), if control-arm miss rate < 12%, halt injection runs — the 8 pp lift threshold is statistically unreachable and cause #1 is materializing.
