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
- [ ] A killed session resumes via the watcher and completes without a
      contact; the resumed run's first commit shows the re-verification.
- [~] One roadmap is delivered fully unattended (scheduler → digest → PR)
      inside the pre-registered budget, and its rework rate is recorded.
      **Deferred** — this is an observation of a live multi-day run, and
      the spawn it needs is 4.0's deferred half.
- [x] The locked classes still reach the user. Pinned twice in this
      change-set: the mode lock (`high_impact` / `user_required` cannot
      be `agent` or `council`) and the new `second_model` rung, which is
      refused on those two classes outright — including an explicit
      `null`, so the key cannot be accepted at any value and teach an
      author that the dimension exists there.
      `verify:` `npx vitest run tests/scripts/ai_council/config.test.ts`
- [~] Both § 0.1 baselines have at least one post-change measurement.
      **Deferred** — the pre-registered claims fix ≥ 20 recorded runs
      before any comparison, and the window held 18 at measurement time.
