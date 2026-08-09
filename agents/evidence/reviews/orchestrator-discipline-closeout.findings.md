# Findings: orchestrator-discipline-closeout
<!-- completion-review: v1 | reviewed: 2026-08-09 | scope: 53f24f59f7dd6d19b122f9e010af5808b17a5c65a080215729ea9c1ec5bc156d | diff: e01b6f284affa9bab5ec323e1c9c415962366fb7 | reviewer: r2-fresh-subagent-orchestrator-discipline-closeout | prompt_hash: 04673167ce35b51776114c546c68d7aafd99ca60ba56e529d29a8aabad7e74d7 -->

<!-- context-manifest: v1
inputs:
  diff_sha: e01b6f284affa9bab5ec323e1c9c415962366fb7
  scope_hash: 53f24f59f7dd6d19b122f9e010af5808b17a5c65a080215729ea9c1ec5bc156d
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-09T10:30:00Z
-->

<!-- fix-pass: v1 | applied: 2026-08-09 | re-bound in place per the completion-review
     contract §2.5 — the normal fix-pass path, NOT §2.7's superseding rename,
     which is the archival step for a terminal round. The findings were
     committed unfixed first (82170344f), then
     repaired; no second review was dispatched, because re-dispatching after an
     unwelcome verdict selects the answer instead of measuring it. All five are
     fixed; none was argued down.
     `scope_hash` is re-bound in BOTH the header and the context-manifest, per
     contract §2.5 (a fix commit necessarily moves the scope) and §5 (the two
     must agree — the gate reports `manifest-header-mismatch` otherwise). The
     re-bind is stable because review artefacts are themselves excluded from
     the scope, so committing this file does not move it again.
     `diff:` and `diff_sha` deliberately still read e01b6f284 — the head the
     reviewer actually read. The contract calls that field provenance and never
     compares it, and advancing it would misstate which tree was reviewed. So
     the pair is honest by construction: scope says what this verdict is bound
     to now, diff says what was in front of the reviewer then.

     SECOND re-bind, 2026-08-09, after merging origin/main (#1224 landed on the
     same roadmap and the same two hook files). What the reviewer did NOT see,
     named rather than absorbed silently:
       - #1224's own code, which carries its own review and council pass on its
         own PR — merged-in upstream, not this branch's delta;
       - two documentation corrections the merge forced here: the calibration
         biases folded into the carried-forward decisions note, and acceptance
         criterion 5's test count restated 36 → 47.
     Both are prose, neither changes a shipped code path, and re-dispatching a
     review over an accepted verdict to cover two doc lines would buy less than
     it costs. This paragraph exists so a reader can tell that from the record
     instead of inferring it from an unchanged hash. -->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/routing_doctor.ts:518 | The two-readers disagreement is removed in one direction and created in the other. `platform` is never detected from the environment — `main()` hard-defaults it to `"claude"` and only `--platform` overrides it. Since :220 now keys capability resolution on that same string, `routing:doctor` run with no flag on a non-Claude host reports the Claude registry row (`subagent_spawn: true`) while `delegation_nudge_hook`, which reads the real envelope `platform`, resolves `false` for that host. The docstring's claim at :197-198 ("mirrors exactly what the delegation layer would resolve") is false for that invocation, and `_render` (:483) prints only the resolved boolean with no indication that it came from an assumed platform rather than an observed one — so the misdiagnosis is unfalsifiable from the output. | fixed | 2c176b212 — `host_platform` + `host_platform_assumed` added to the report; `main()` tracks whether `--platform` was given; `_render` prints `(host=X, ASSUMED)` plus an explicit warning line when it was not. The docstring's over-claim is corrected to say it mirrors the delegation layer FOR that platform. |
| 2 | medium | tests/scripts/routing_doctor.test.ts:167 | The added comment claims "the two cases below pin both halves of the resolution order, so a future edit cannot re-introduce the disagreement by touching only one reader", but neither new case discriminates the settings-override half. The pre-existing test at :141-166 writes `host_capabilities.subagent_spawn: true` on platform `claude` — a value the committed registry now also yields — so its assertion passes even if the override argument were dropped. The two new cases (:174 registry-hit, :189 registry-miss) both run with no settings file. Net effect: deleting `sub["host_capabilities"]` from the `resolveHostCapabilities` call at routing_doctor.ts:220 leaves all three doctor tests green. A discriminating case (override `false` on a known host, or override `true` on an unknown host) is missing. | fixed | 2c176b212 — Added a discriminating case: override `subagent_spawn: false` on `claude`, a value the registry cannot yield. Mutation-probed — dropping `sub["host_capabilities"]` from the call site turns exactly this test red (1 failed / 16 passed), which the previous three did not. |
| 3 | medium | agents/roadmaps/archive/road-to-orchestrator-discipline-carriers.md:320 | The roadmap is archived with all three blockers still `Status: open`, and the dashboard drops them from tracking in the same change (`agents/roadmaps-progress.md:5`, open blockers 24 → 21; the `blockers-road-to-orchestrator-discipline-carriers` section deleted). `f4-full-blocking-decision` is not inert: it is cited as the owner of the unverified stop-slot delivery question by Phase 5's own exit note (:332) and by AC-5 (:534-536). After archival no tracked surface enumerates it, so an open decision that other shipped text defers to becomes invisible. | fixed | 3c17c11f7 — The three open blockers are carried forward verbatim in `agents/settings/contexts/orchestrator-carriers-open-decisions.md`; the hook header now cites that note instead of the archived blocker name, and the archived Blockers section points at it. |
| 4 | low | src/scripts/routing_doctor.ts:213 | The new third parameter is declared optional (`platform?`, a nullable string union) on an exported function whose own docstring (:201-202) states "It must be threaded in, not defaulted here". Omitting the argument silently reproduces the exact pre-fix behaviour (registry skipped → all-false) instead of failing to compile. A required parameter would make the regression this change fixes uncompilable rather than merely discouraged by a comment. | fixed | 2c176b212 — `platform` is now required, and a second required `platform_assumed` alongside it. Single in-tree call site; omission is a compile error rather than a comment. |
| 5 | low | agents/roadmaps/archive/road-to-orchestrator-discipline-carriers.md:351 | Acceptance criterion 1 is checked `[x]` while its own verification note (:485-488) records that the `ask` verdict it asserts holds only for the no-settings-file case, and that a consumer carrying the shipped template (`auto: "on"`) lands on `dispatch` instead. The criterion text still reads "A fresh clone … the fresh-clone verdict is `ask`", and the test that pins it (tests/scripts/routing_doctor.test.ts:174) uses an empty tmpdir rather than an installed tree — so criterion, evidence, and test disagree about what "fresh clone" denotes. | fixed | 3c17c11f7 — Criterion text names the state it actually asserts (a clone with NO settings file) and records that an install carrying the shipped template lands on `dispatch` instead. Scope clarified, assertion unchanged. |
