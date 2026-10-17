<!-- evidence-type: analysis -->

# The CI wait stays in the foreground until it is measured

AI council, 2026-10-17. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present before and after the run, two rounds, blind review, `$0.00` (both
seats subscription-authed). The prompt is committed verbatim beside this file as
`ci-wait-foreground-2026-10-17.question.md`. Raw response:
`agents/runtime/council/responses/ci-wait-foreground-2026-10-17.md` (local,
gitignored). For `road-to-agent-throughput-recovery` step 3.1, row D9.

## Verdict

- **anthropic — (c).** Measure first: what share of `sleep-poll` minutes is CI
  polling, and how often a lane had a workable next step during a CI wait.
  Until then keep the foreground settle. Its reading of the evidence: 212 min
  of `sleep-poll` and an unmeasured overlap mean the benefit of a background
  settle is unproven, while its cost (obligation state, stale-head
  reconciliation, background process management) is not.
- **openai — no option in the final round.** It reviewed the prompt as a pull
  request without a code diff and returned REQUEST_CHANGES: the obligation's
  lifecycle (persistence, concurrent PRs, a superseding push, launch failure,
  cancellation, cleanup) is unspecified, and "reverting the reminder text
  restores today's behaviour" is unsupported if obligation state persists. The
  other seat's final text summarises its first round as recommending (b); that
  first-round text is not in the recorded response.

Read together: no seat supports (b) in the final round; one chooses (c); the
other abstains and names the lifecycle a (b) would have to specify first. That
is not a 2/2 verdict. **Recorded outcome: no transition.** Today's foreground
wait stands, which needs no authority; under `decision-revisit-gate` an
abstention is an escalation condition, so adopting (b) later needs the
measurement, a specified lifecycle and a council that actually concludes —
or the owner.

## Strongest argument against (c), from the seat that chose it

Delaying a plausible optimisation: if the measurement shows little parallel
work, the time went into proving there was nothing to win.

## revisit-if

The measurement shows more than 60 % of CI waits had a workable next step in
the same lane, or `sleep-poll` turns out dominated by non-CI waits, or a
cheaper mitigation without obligation state appears.

## The mode mismatch, stated

The run used `--prompt-mode pr`, which frames the artefact as a pull-request
diff. One seat answered the frame instead of the question. The prompt itself
asked for one option; the next council on this subject should use a decision
mode.
