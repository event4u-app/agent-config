<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for the pending-mechanism pin deadlock on main,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Decide how to unblock main: a pending-mechanism pin no head can satisfy

The owner has directed that technical decisions about the ratification gate's modules go to the council. This is one.

## Facts, from the tree and CI

- `src/scripts/check_kernel_edit_ratified.ts` on main (`a10aa16a1`) carries `PENDING_MECHANISM_PINS = { 'src/scripts/_lib/ratification_subject.ts': '3842d915…' }`. `pinViolations(files, root, commit)` (lines 188–203) reads the module at the HEAD commit and pushes a violation whenever its blob differs from the pin — for every diff, whatever files it names.
- The required CI step "Kernel / governance-hook edits carry a ratification artifact" (job "Sync + Generate Tools Consistency", `.github/workflows/consistency.yml`) runs the BASE revision's copy of the gate against the PR head (`npx tsx "$BASE_DIR/$GATE" --root "$PWD" --base-ref "$BASE_SHA"`).
- Main's module is blob `176f6532…`, not `3842d915…`: #2379's branch merged main, which carried #2375's council-reviewed refactor of the module (three refusal classes declare their fields instead of using parameter properties, because the danger gate's base classifier now runs under `node --experimental-strip-types`, which cannot carry a parameter property; without it the danger gate falls back to the checkout's `tsx`).
- Consequence, observed: the step fails on every open PR (#2381, #2382 checked). PR #2382, which moves the pin to `176f6532…` with a 2/2 council ratification, is refused by the BASE gate with "src/scripts/_lib/ratification_subject.ts is 176f6532…, pinned to 3842d915…". No PR whose head module is not `3842d915…` can pass while main's pin is `3842d915…`.
- The same PR is also red on `check_test_delta`: a code path changed with no test path. The escape is the `test-delta-acknowledged` label, reserved to the owner.
- #2379's planned stage 2 gates the module (adds it to the mechanism set) and removes its pin.

## Options

A. One PR that reverts `_lib/ratification_subject.ts` to blob `3842d915…` (the pin is untouched) and adds a test asserting that each pinned module's committed blob equals its pin (the test that would have caught this; it is red on main today, green after the revert). The base gate passes it. The danger gate's base-classifier run falls back to `tsx` until the refactor returns. Then stage 2 (gate the module, remove the pin, module unchanged), then a PR re-applying #2375's refactor under a ratification record.

B. Merge #2382 past the failing required check (an administrative bypass of branch protection). Not available to the agent; owner action.

C. One PR that reverts the module to `3842d915…` AND does stage 2 (gate it, remove the pin) in the same diff; then re-apply the refactor. Two PRs instead of three, but the unblock waits on a full stage-2 review.

D. Something else you identify.

For each option name what it weakens, what it risks, and how long main stays blocked. State which you choose and why, any condition on it, and your stance on whether #2382 should be closed.
