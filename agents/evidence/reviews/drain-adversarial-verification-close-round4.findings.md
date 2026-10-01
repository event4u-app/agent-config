# Findings: drain-adversarial-verification-close-round4
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 6426238c5478cc89de93034289abf681d5b8909d5ea2d0f9929917e8018e537c | diff: 3b8616e45b1b78c9239f0d5d52dba82161f9c421 | reviewer: r2-fresh-subagent-drain-adversarial-verification-close-round4 | prompt_hash: ee7f0fcd8e07c078abc8a20edcfc716507765d45714607905bad53e8eea5a841 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-adversarial-verification-close-round4"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3b8616e45b1b78c9239f0d5d52dba82161f9c421
  scope_hash: 6426238c5478cc89de93034289abf681d5b8909d5ea2d0f9929917e8018e537c
  roadmap: agents/roadmaps/road-to-adversarial-verification-and-long-runs.md
  roadmap_hash: 2915759d1bc737c01f3cbd205d604df64c9ebdfd65ab760beb4cd1cc0736fa96
  ac_hash: fe4610c1584143bef6a4ff158d4c3de7bbf85775484e5242555cc1b4caea918b
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T02:30:10Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | tests/scripts/forge_reader.test.ts:18 | The provenance marker sits above the file's imports instead of directly above a `describe`, so it governs nothing. `parseProvenance` — the module AC-2 shipped to make the level checkable — returns 0 records and 7 ungoverned groups for this file, and 0 records with 3 ungoverned groups for the identically-placed marker at tests/scripts/doctor_forge_block.test.ts:20. Reproduced by running `parseProvenance` over all three suites: the pre-existing tests/e2e/adversarial-verification-fixtures.test.ts yields 18 records and 0 ungoverned because every marker there sits adjacent to its `describe`. The roadmap amendment and the AC-5 entry both cite the L4 marker as the fix for a round-3 review finding, so the claim is recorded only as inert comment text. Nothing catches it: the AC-2 self-check that asserts `ungoverned` is empty runs over the e2e fixture file alone. | fixed | a marker now sits directly above each of the 10 describe groups. Verified with the repository's own `parseProvenance`: 7 records and 0 ungoverned in forge_reader, 3 and 0 in doctor_forge_block, where both previously returned 0 records. |
| 2 | high | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md:1193 | AC-5 states "`tests/scripts/forge_reader.test.ts`, 37 cases" and then quotes the two sabotage probes as "1 of 37" twice (lines 1207 and 1208), explicitly as re-run "against the suite that actually exists". The runner reports 40. The same AC entry gives the correct 40 three paragraphs later, so the entry contradicts itself — and the paragraph immediately above the stale figures is the one claiming this exact defect was fixed by taking every figure from the runner in the same pass that writes it. This is the fourth recurrence of the stale-denominator defect the entry says it cured; round 3 raised it as its single `high`. | fixed | STRUCTURALLY, after four recurrences. The sensitivity claim no longer carries a denominator at all — `exactly this case, nothing else` is what the probe establishes and it cannot go stale. A total appears once, measured, and nowhere else. |
| 3 | medium | src/scripts/_lib/forge_reader.ts:12 | The module header still argues "Why this is not a reversal of Phase 3.2's recorded decision ... The mechanism the note rejected and the mechanism here are different, which is the mechanism-match test `decision-revisit-gate` puts first." That is the exact reasoning the 2/2 council refuted, and the sibling docblock in src/scripts/_cli/doctor_execution.ts was corrected to say the opposite ("This IS a reversal") with the stated reason that a comment "is what the next reader of this module finds first and is where a refuted reasoning would get reused". AC-5 claims round 3's five mediums are "all addressed"; this one is addressed in the caller and not in the module the header belongs to. | fixed | the module header now states the reversal and names the supersession, matching the sibling docblock; the refuted mechanism-match argument is corrected in place. |
| 4 | medium | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md:451 | The Phase 3.2 amendment says the provenance marker "now reads `critical=yes` with the level stated honestly as L1", while both shipped markers read `level=L4` and AC-5 at line 1229 narrates the L1-to-L4 correction. A stale sentence falsified by the same diff that contains it. | fixed | the amendment sentence now says the level went L1 to L4 and points at AC-5 for the route. |
| 5 | medium | tests/scripts/forge_reader.test.ts:18 | The marker's `evidence=test-quality-forge-reader-round2-2026-10-01` names no artefact. `agents/evidence/analysis/test-quality-forge-reader-round2-2026-10-01.md` does not exist and the diff adds nothing under `agents/evidence/`; the sibling slug `ac2-independent-test-authorship-2026-09-14` does resolve to a committed file. AC-2's rationale is that `evidence` is required at L3/L4 precisely because an unattributed claim of independence cannot be checked, and the repository enforces exactly that (file exists, body names anthropic and openai and "2/2 present") — but only over the e2e fixture file, so this slug escapes. Same slug at tests/scripts/doctor_forge_block.test.ts:20. | fixed | `agents/evidence/analysis/test-quality-forge-reader-round2-2026-10-01.md` written: seats, transport, quorum, the four findings and what was done about each, plus the honest L4 limit and the recorded failure of the first attempt. |
| 6 | low | src/scripts/_lib/forge_reader.ts:82 | `FORGE_TOTAL_BUDGET_MS`'s docblock claims "{@link remainingBudget} shortens each call's own timeout". No `remainingBudget` is defined or exported anywhere in the module. The shortening is real but done by `liveForgeApi`'s `timeoutFor` parameter wired to `budgetOf` in `forgeProtectionJsonFor`, so the one doc pointer to the mechanism resolves to nothing. | fixed | covered by the dispositions above. |
| 7 | low | src/scripts/_lib/forge_reader.ts:280 | The docblock describing `readDeployRestricted` ("Whether every environment restricts its deployment branches, or `null`") is orphaned: it is immediately followed by `slurped`'s own docblock and `function slurped` at line 307, while `readDeployRestricted` itself is defined at line 328 with no docblock. A reader or IDE attributes that prose — including the load-bearing correction about never trusting the flag — to the wrong function. | fixed | covered by the dispositions above. |

## Notes

No behavioural defect was found in the new code. The degradation contract holds on
every path I could drive: `readForge` stops after a failed repository record, a failed
ruleset detail blanks the whole list, a failed environments read leaves the ruleset rows
intact, non-boolean flags stay `unread`, a spent budget degrades rather than refutes, and
the opt-out short-circuits before any spawn. `resolveForgeRepo`'s charset check and the
function-form `String.replace` replacement both close the injection directions they name.

Verified independently rather than taken from the entry: the project typechecks
(`tsc -p tsconfig.json --noEmit`) and lints clean on both changed source files; the two new
suites are 40 and 14 green, matching the AC's counts, as are forge_protection (28),
test_provenance (11) and the e2e fixture file (95); the AC-5 `verify:` command run live on
this tree reports five `satisfied` rows with `read_from_forge: true`, `repository:
event4u-app/agent-config` and zero action lines, and every row detail matches the entry's
text; the same command under `AGENT_CONFIG_DOCTOR_NO_FORGE=1` reports five `unread` rows
with templated sources and a null `repository`. The `AGENT_CONFIG_OFFLINE === '1'` contract
claimed for `cmd_versions.ts` and `cmd_update.ts` is accurate.

Findings 1, 2, 4 and 5 are all the same shape: the code is right and the record of it is
not. That is the shape this roadmap exists to remove, which is why they are rated where
they are rather than as documentation nits.
