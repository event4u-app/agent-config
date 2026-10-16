<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for PR #2383 (fix/pin-deadlock-recovery-20261016),
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# PR #2383 — merge with one known-red, non-required test, or change the test?

Prior decision (council, 2/2, `agents/evidence/council/pin-deadlock-decision.md`): Option A — restore `src/scripts/_lib/ratification_subject.ts` to its pinned blob `3842d915…` (parameter properties) to unblock main; then stage 2 (gate the module, remove the pin); then re-apply #2375's refactor (declared fields) under a record. The seats accepted that until step 3 the danger gate's base classifier cannot run under `node --experimental-strip-types` and falls back to `tsx`.

CI on #2383 head `266f01b63`: both required checks ("Sync + Generate Tools Consistency", "Standing payload delta + budget gate") pass. 44 of 46 checks pass. Failing: "Node Tests" shard 2/4 on ubuntu and macOS, one test — the #2375 danger-gate test "where node strips types the base copy needs no node_modules, so a poisoned one cannot hide a gated change". It fails because the restored module carries parameter properties, which type stripping cannot run: the exact consequence the prior decision accepted. On main today the same shard is already red (two pin tests fail because main's module is off its pin); #2383 turns those green and this one red.

Ordering constraint: step 3 cannot be folded into step 2 or into #2383 — while main's pin is `3842d915…`, the base gate refuses any head whose module differs from it. So this test stays red from #2383's merge until step 3 merges (two more PRs).

Options:

1. Merge #2383 as is; the test stays red, named in the PR and in the stage-2 roadmap entry, until step 3.
2. Before merging, mark the test conditional — skip it while `PENDING_MECHANISM_PINS` still pins the module, with the skip removed by step 3. (A test change by the implementer; the weakening ladder applies.)
3. Before merging, change the test to assert the fallback instead (the base copy falls back to `tsx` while the module cannot be stripped), and restore the strip-types assertion in step 3.
4. Something else.

For each: what it weakens, what it hides, what it risks. State which you choose and any condition.
