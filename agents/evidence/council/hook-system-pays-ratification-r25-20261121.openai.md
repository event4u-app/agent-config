<!-- evidence-type: original-review -->
<!-- check-refs: skip -->

<!-- The openai seat's reply of 2026-11-21 to the prompt in
     hook-system-pays-ratification-r25-20261121.question.md, verbatim (codex-default). -->

## Assessment

**Mixed. Refuse ratification as shown.** D1 expressly authorizes the budget redesign, and the allowlist directly addresses the second-parser incident. The dispatcher diff still leaves an exception path that can prevent delivery of an already-computed hook verdict.

## Where I agree with Reviewer A

- **D1 covers both budget changes.** It calls for “one overall ceiling with real headroom” and explicitly ends the per-chunk and chunk-group ceilings, `shrink_only`, and the `raise_log` obligation. That settles the scope of the owner directive. Whether it satisfies ADR-268 § 4 remains open because § 4 is absent from the evidence. Include the operative clause. If it separately requires two-provider approval for weakening a watched control, that approval is the additional basis.
- **The allowlist targets the incident.** With only `yaml` listed, the checker adds a finding for an unlisted npm package and returns `1` when findings exist. Invalid budget input and build failures also produce nonzero status in the shown branches. The wider aggregate ceiling and removal of chunk ceilings do relax the size policy. The checker still rejects violations of the new policy.
- **The monitoring note and test inventory address the stated conditions at the level shown.** `max_bytes_note` gives the response to a breach, and the test names cover recovery, failed resets, and re-entry. The names establish intended coverage. Test results and the implementation of `unlistedPackages()` would substantiate it. The 18-versus-28 discrepancy is bookkeeping and remains unresolved without the retired file.

## Where I disagree with Reviewer A

**The strongest reason to withhold ratification is the loss of the per-file feedback exception boundary.** In `dispatch_hook.ts`’s `_write_feedback`, the new per-concern `update_json_under_lock()` call is outside a `try/catch`. In `state_io.ts`, `release(held)` runs in `finally`, where an exception can override any pending return, including `"written"` or `"failed"`. `is_replay_mode()` and `path.resolve()` also run before the first catch. `LockedUpdateResult` constrains returned values. The excerpt leaves the no-throw claim unproven. Since `main` invokes `_write_feedback` after `_reduce(rcs)`, an escaping exception can stop normal verdict delivery.

I also disagree that a new monitoring protocol is a ratification prerequisite. The stated condition was a note on what to do when the backstop trips, and the budget file provides one. Reviewer A’s suggested base-branch lookup would retrieve the configured ceiling. A meaningful per-PR size delta needs the measured bundle size at the base revision.

## New points and next steps

- **The environment scope begins after dispatch setup.** `openConcernEnvScope()` inherits the enclosing hardened baseline, which protects inner concern bodies and the explicit child environment once the scope opens. A synchronous nested `main()` still runs argument handling and pre-loop setup with the outer concern’s live environment. `recoverConcernEnv()` only acts when a restore is owed. Verify whether any pre-loop guard, selection step, or child launch reads that environment, and cover an environment-sensitive path through `main()` in the re-entry test. The shown severity reduction, advisory ceiling, and permission-verdict calls retain their logic. The excerpt does not establish broader isolation or show an expansion of concern authority.
- **Restore per-file exception containment and verify verdict delivery.** Keep a caller-side catch around each feedback write, contain failures in the diagnostic path, and test a throwing lock cleanup against a dispatch with a computed block verdict. Confirm that the host receives the original verdict and exit status. Include ADR-268 § 4 in the next review packet so the authorization question can be decided directly.

**The strongest counterargument** is that the feedback concern may be resolved by a small amount of evidence or a small patch. If `release()` and the pre-`try` operations are demonstrably non-throwing for dispatcher inputs, the concrete exception concern narrows substantially. The allowlist already provides a direct check for the dependency addition that motivated the redesign.

STANCE: refused | CONFIDENCE: med | DEALBREAKER: yes
