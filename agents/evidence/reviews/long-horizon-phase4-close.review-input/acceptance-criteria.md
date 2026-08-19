## Acceptance criteria

- [~] A `process-full` contract run finishes a 3-phase roadmap with zero
      synchronous contacts, re-engaging across turns, and opens the PR.
      **Half observed, and the half that is missing is the load-bearing
      one.** The run that built this roadmap took both it and
      `road-to-council-api-fallback` from open to closed across every
      phase without a synchronous contact, and opened one PR. But it made
      no `sessions:claim`, so `run-continuation` never engaged — the
      zero-contact property came from the operator's standing mandate,
      NOT from the mechanism this roadmap built. Claiming it as evidence
      for the mechanism would be attributing a result to the wrong cause,
      which is precisely the attribution error § 0.1's own falsification
      criteria are written against. Re-run under a claim to close it.
      **Re-run under a claim 2026-08-19. It still did not engage, and the
      cause is a defect rather than a missing step** — see
      `blocker: worktree-claim-root-split`. The claim was made
      (`sessions:claim road-to-long-horizon-execution`, 10:41) and the
      roadmap carries `execution.mode: autonomous`, so both halves of the
      contract were present, and `run-continuation.jsonl` stayed absent
      through every turn boundary of the run.
      Diagnosed rather than assumed, in four steps: the concern IS
      functional through the host's own shim entry point — driving
      `agent-config dispatch:hook --event stop --project-dir <worktree>`
      with this session's id wrote `{"event":"complete", …}` immediately;
      the same call with an unknown session id wrote **nothing**, so
      "contract absent → no-op" leaves no trace and a silent ledger is
      indistinguishable from a concern that never ran; hook-written state
      from this session (`context-fill.json`, `hot-context.md`,
      `session-eol/`, `.dispatcher`) all landed in the MAIN checkout while
      `sessions:claim` wrote into the WORKTREE; and `run:supervise`
      independently listed this session as `roadmap=-` minutes after the
      claim, which is the same cause seen through the register.
      So the criterion is not "not tried" and not "will not measure" — it
      is blocked on one identified defect, and it closes on the first run
      after that defect is fixed.
- [-] A killed session resumes via the watcher and completes without a
      contact; the resumed run's first commit shows the re-verification.
      **CANCELLED 2026-08-19 — WILL-NOT-MEASURE.** This criterion needs a
      LIVE relaunch, and starting a session unattended is now a published
      refusal (step 4.0). Left `[ ]` it would be the indefinite pending
      D-5 names, dressed as an acceptance criterion.
      What the refusal does NOT cancel is the half that can be observed
      without a spawn: `run:supervise --print-relaunch` emits the exact
      resume command, whose prompt orders the checkpoint re-verification
      as the resumed run's first act, and `verifyCheckpoint`'s per-field
      report is pinned by `tests/scripts/run_checkpoint.test.ts`. The
      unobserved part is precisely "and no human was involved".
      Reopens with 4.0's condition — the first checkpoint written by a
      real dying run.
- [-] One roadmap is delivered fully unattended (scheduler → digest → PR)
      inside the pre-registered budget, and its rework rate is recorded.
      **CANCELLED 2026-08-19 — WILL-NOT-MEASURE.** The spawn it needs is
      not deferred any more; it is refused (step 4.0). No scheduler ships,
      by the same reasoning 4.1 already recorded: a scheduler that
      schedules work nothing can execute is worse than none.
      Consequence for the ledger, followed through rather than left
      dangling: `claim: unattended-demotion-gate` pre-registered a
      14-day rework comparison for a lane that will not run, and its own
      honest-null path says the capability CLOSES if the lane never runs.
      That path is now taken — see its CLAIMS.md entry. Registering a
      threshold and then never resolving it is the failure the entry was
      written to avoid, and it would be odd to reproduce it in the same
      roadmap that refuses the capability.
- [x] The locked classes still reach the user. Pinned twice in this
      change-set: the mode lock (`high_impact` / `user_required` cannot
      be `agent` or `council`) and the new `second_model` rung, which is
      refused on those two classes outright — including an explicit
      `null`, so the key cannot be accepted at any value and teach an
      author that the dimension exists there.
      `verify:` `npx vitest run tests/scripts/ai_council/config.test.ts`
- [x] Both § 0.1 baselines have at least one post-change measurement.
      **Measured 2026-08-19 against the main checkout** (`--root`, per the
      § 0.1 finding that a worktree reads a clean zero): contacts per run
      **median 0** · user wait **median 68.9 min** · elapsed **median
      421.7 min** · agent working **median 169.6 min**. Both claims stay
      `unbacked`; the measurement exists, the comparison does not.
      **NEITHER axis clears its pre-registered ≥ 20-run floor, and the
      report could not previously say so.** It printed `runs: 21` under a
      single ⚠️ SHORT WINDOW banner driven by the SESSION count, so a
      reader checking the floor read 21 and concluded the contact axis had
      cleared it. It had not: 2 of those 21 runs carry timing and no
      ledger entry, so the contact axis stands at **19**. One banner
      cannot answer a question two axes ask separately, and this run made
      exactly that misreading before the fix caught it. `interruption_report`
      now prints per-axis N against the floor on each axis header.
      **A structural finding, worth more than the numbers.** The
      wall-clock axis reads timing from `agents/runtime/.agent-chat-history`,
      whose retention is `DEFAULT_MAX_SESSIONS = 5`
      (`src/scripts/chat_history.ts`; `chat_history.max_sessions` is unset
      on every settings layer). Five retained sessions yielded **4**
      timing-bearing runs. So the ≥ 20-run floor of
      `roadmap-wall-clock-baseline` is **unreachable at default retention**
      — not "not yet reached". Backing it needs a different timing source
      or a retention change, or the claim closes on its own honest-null
      path; recorded in its CLAIMS.md entry as a dated post-registration
      finding, with the threshold left exactly as pre-registered.
      The contact axis is one run short and reachable, which is a
      different answer from the wall-clock axis's and is why they are no
      longer reported under one verdict.
      `verify:` `npx vitest run tests/scripts/interruption_report.test.ts` — 41 green.
