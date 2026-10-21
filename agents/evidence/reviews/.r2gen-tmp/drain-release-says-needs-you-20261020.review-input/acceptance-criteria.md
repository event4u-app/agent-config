## Acceptance Criteria

- [x] **AC-1** Replaying 10.0.0 → 16.0.0 through the new bump rule yields minor
      for 13.0.0, 14.0.0 and 16.0.0 and major for 12.0.0 and 15.0.0.
- [x] **AC-2** A release-span commit carrying `!` with no `Consumer-Impact:`
      trailer fails the release check; the same commit with a trailer passes.
- [x] **AC-3** The new comparator returns `true` for
      `('16.6.0','16.6.0-next.3')` while the pinned `_is_newer` fixture still
      returns `false`.
- [ ] **AC-4** Over a ≥ 40-case matrix, `classifyUpdate` returns `ask` for
      every input whose `engines.node` is unsatisfied, and `auto` for **no**
      input carrying an unknown, a missing provenance or a project pin.
      Open for the owner (2026-10-18): the AI council split on whether this
      text may be amended to the shipped `action` form — `anthropic` (3) leave
      it with the owner, `openai` (1) amend with ordered wording. Both agree
      the shipped behaviour is right. Record and the proposed wording:
      `agents/evidence/council/release-impact-ac4-wording-20261018.md`.
- [x] **AC-5** `classifyUpdate` performs no filesystem or network access,
      asserted by a test that calls it with a frozen input.
- [x] **AC-6** The banner, `upgrade` and `update` produce byte-identical
      recorded stdout before and after the whole change.
      (Evidence under step 4.3: no file in their import closure changed.)
- [x] **AC-7** Every row of `BREAKING_CHANGES.md`'s table carries a
      `Consumer impact` value from the enum.
- [x] **AC-8** `task ci` green.
      (Closes with the PR that closes this file: the remote pipeline is the
      authoritative run, and a green it has not yet reported is not evidence.)
      Closed by this PR's final pipeline run, which is the run the merge is
      bound to — so the box cannot ship checked over a red.
      **One reading on the way there is worth recording rather than
      absorbing.** Head `2e05048b7` read `stop` p95 272 ms against the
      `any_hook_event` cap of 250 in `src/config/hook-latency-budget.json`.
      It is a runner-speed reading, not a regression: `main` at `fba00aabf`
      carries byte-identical hook code and read 182 ms, and the control
      (`node -e 0`, none of this tree's code) moved 20 → 27 ms on the same
      run while every slot moved 35–46 % with it. Nothing in this branch is
      in the hook bundle's import closure — `major_surface.ts` is imported
      only by its own test. The cap is **not** touched: that file is
      pre-registered and owner-owned, and its own text calls raising a number
      without a measured distribution beside it the config-bending it exists
      to make visible. Re-measured on a fresh runner instead. If the overshoot
      reproduces on a runner whose control reads ~20 ms, it stops being a
      reading and becomes the finding that `stop` has grown into the tallest
      slot while `any_hook_event` still carries the cap it had when
      `pre_tool_use` was — the same pathology that forced that cap's
      re-derivation from 150 to 175.
