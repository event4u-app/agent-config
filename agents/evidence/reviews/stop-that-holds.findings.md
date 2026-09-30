# Findings: stop-that-holds
<!-- completion-review: v1 | reviewed: 2026-09-30 | scope: 720e7a9c7b533dc3850335fea36a033564c7ba43e8c1c64b3babcee9a7141204 | diff: 948f8f25bc342bb59d0f0715ac3da2caeed67def | reviewer: fresh-subagent-independent-review-stop-that-holds | author: claude-opus-5-worktree-agent-a56b5d27939142856 | prompt_hash: 70f9af6b53da7cf6cd925f6c54d620410af325a5e3532a1ae0f8f0aa6f5a84dc -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["fresh-subagent-independent-review-stop-that-holds"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-30 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 948f8f25bc342bb59d0f0715ac3da2caeed67def
  scope_hash: 720e7a9c7b533dc3850335fea36a033564c7ba43e8c1c64b3babcee9a7141204
  roadmap: agents/roadmaps/road-to-a-stop-that-holds.md
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-29T21:25:00Z
-->

**The review's own verdict was `do not merge on the current evidence`**, and it
was right. Its two blockers were reproduced independently before being acted on,
against 1,077 object-shaped and 11 string-shaped tool results in this machine's
own transcripts: Claude Code's Bash result carries no exit-code field on success
and is a bare `Error: Exit code N` string on failure, so the record path was
inert on the one host that binds the gate. Every finding below is acted on in
the same branch.

**The manifest's `tools:` line is a fixed literal the parser requires, and it
UNDERSTATES what the review ran.** Beyond the diff and the branch-scoped file
reads it names, the reviewer ran single-file `vitest` and several read-only
gates (`check_claims`, `check_detector_corpus`, `check_references`,
`lint_hook_manifest`), and it scanned this machine's own Claude Code transcripts
to measure the payload shapes behind findings 1 and 2. Recorded here because the
manifest cannot say it.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/scripts/before_complete_hook.ts:376 | `_extract_exit_code` looked for five numeric field names. Claude Code's Bash result carries none of them — success is an object `{stdout, stderr, interrupted, isImage, noOutputExpected}`, failure is the string `Error: Exit code N\n…`. Every run recorded `exit_code: null`, classified `exit_code_unavailable`, became an instrument gap, and the turn ended normally — including a turn whose vitest run had reported two failures with the count sitting parseable in the record. | fixed | `728259377` — three readings with provenance on the row: a numeric field, the `Error: Exit code N` prefix, and the object form carrying `interrupted: false` beside a stream key. The third is a positive host signal, not an inference from silence. |
| 2 | critical | src/scripts/before_complete_hook.ts:331 | `_extract_output` returned `JSON.stringify(v)` for an object response, and every parser is line-anchored. JSON escapes a newline as two characters, so no summary could ever parse from the success shape. Latent behind finding 1; live the moment it was fixed, where it would have turned detector F into a refusal of honest TDD. | fixed | `728259377` — new `_extract_run_streams` pulls stdout and stderr as real strings. `_extract_output` is untouched: it feeds the pre-existing `vacuous` counters, whose behavior must not move. `stderr_tail` is now written — it was declared and read while nothing populated it. |
| 3 | medium | src/scripts/_lib/verification_evidence.ts:335 | `LOAD_FAILURE_PATTERNS` ran above the summary, so a passing run that merely PRINTED one of ten broad phrases was refused. vitest echoes `stderr` prefix blocks verbatim, so any test exercising an error path is a candidate. | fixed | `728259377` — honoured only when no summary parsed or the summary reports `passed === 0`. The case the old ordering defended is already covered by `zero_tests_discovered`. |
| 4 | medium | src/scripts/hooks/turn_end_gate_hook.ts:928 | Detector F's new clause fired on `edited.some(_isTestPath)` — ANY test edit — while step 5.1 authorises it for "a NEW test file". Tightening an assertion in an existing test alongside a production change was refused with `no_red_evidence`. | fixed | `285c51ec3` — `Write` on a test path is the proxy for new; `Edit`/`MultiEdit` presuppose a file that existed. The narrowing can only allow turns the previous line refused. |
| 5 | medium | src/scripts/_lib/verification_evidence.ts:512 | `hasRedThenGreen` required `FAIL_EVIDENCE` for the red half, so the canonical TDD first red — a new test importing a module that does not exist yet, printing `Cannot find module` — was not a red. The shape of work that created this module would have been refused. Also: a single-file red paired with a whole-suite green was refused. | fixed | `728259377` — a load failure, a bare non-zero exit and a zero-test discovery all count as reds; the green half keeps the placement and freshness checks. A whole-suite green settles any reddened target, being strictly stronger evidence. |
| 6 | medium | docs/contracts/hook-architecture-v1.md | The table published 28 == 28 and was already 28 rows against a grep of 29 at the merge base: a merge brought in `AGENT_CONFIG_TOOL_BYTE_CENSUS`. AC-5 closed on the false equality, and nothing gated it. | fixed | `948f8f25b` — row added, and `check_kill_switch_table` compares the two SETS on every run. Observed RED before the row landed, naming the missing switch. Self-test 6/6, 4 rejecting. |
| 7 | medium | src/scripts/hooks/obligation_settle_hook.ts | The join matched the writer on the session and NOT on the root: reader read `workspace_root`/`workspace`/`cwd`, writer reads `workspace`/`cwd`/`project_dir`. It agreed only by coincidence of today's two envelope shapes, while the docstring claimed "resolved the way the WRITER does". | fixed | `27deeb0a3` — the reader calls the injector's own `workspaceRoot`. One resolver, no drift. |
| 8 | medium | tests/hooks/obligation_settle.test.ts | The case named `REPRODUCES the zero-shadow defect` asserted a property of the NEW resolver on empty inputs and never called `main()`. Before the fix it could only have failed on a missing export, which the roadmap evidence explicitly claims it did not. | fixed | `27deeb0a3` — `resolveSettleContextPreFix` is kept reachable with the SAME arity as the live resolver, and the case drives `main()` through both over one ledger. A narrower signature would let the fixture pass the envelope in as `env`, missing for the wrong reason. |
| 9 | medium | tests/ (whole diff) | The producer/consumer seam was never crossed: every gate-side fixture hand-wrote a record, every recorder-side test asserted only substring containment, and no test used a real host payload shape. That is how findings 1 and 2 shipped green. | fixed | `728259377` — `tests/scripts/verification_record_roundtrip.test.ts`, 16 cases driving the real recorder with both real payload shapes into the real classifier. 13 of 16 fail against the pre-fix recorder, shown by restoring both defects and restoring the file from a copy. |
| 10 | low | src/scripts/hooks/turn_end_gate_hook.ts:243 | The `Finding.mode` docstring said "Only detector C sets it" while detector F set it two functions below. | fixed | `285c51ec3` |
| 11 | low | src/scripts/hooks/turn_end_gate_hook.ts:964 | The no-test-file verdict was labelled `mode: 'record'` whenever a run state happened to exist, although no record contributed to it. | fixed | `285c51ec3` — labelled `transcript`. |
| 12 | low | src/scripts/hooks/turn_end_gate_hook.ts:1416 | The state read sat above the re-entrancy early-allow, so every refusal retry paid a file read and JSON parse it discarded. | fixed | `285c51ec3` — moved below `alreadyRefusedTurn`. |
| 13 | low | src/scripts/before_complete_hook.ts:382 | `MAX_VERIFICATION_RUNS_PER_TURN` kept the newest, so a chatty turn could drop the red half of its own red→green pair — detector F's question is answered by the head. | fixed | `728259377` — `_cap_runs` keeps the earliest failing record alongside the newest runs. |
| 14 | low | src/scripts/before_complete_hook.ts:571 | `RUN_OUTPUT_TAIL_BYTES` is applied as `.slice(-N)` on a string, i.e. CHARACTERS not bytes. | fixed | `728259377` — documented as a bound on the state file rather than a promise about it; the name is kept for its importers. |
| 15 | low | src/scripts/hooks/obligation_settle_hook.ts | The writer defaults an unnamed session to the literal `unknown` and writes delivered rows there; the reader returns empty and allows, so that population is invisible to every reading of the bar. | accepted-risk | `27deeb0a3`. Joining it would aggregate unrelated sessions into one bucket, which is worse than not reading it: a shadow row claiming to be about "one session's turn" would be about several. `WRITER_UNNAMED_SESSION` is exported for a future census and the asymmetry is named in the code. |
| 16 | low | src/scripts/_lib/verification_evidence.ts:139 | `canVerify` skips a whole segment when its leading executable is blocked, so a runner invoked as an argument to a blocked executable (`find … -exec npx vitest run {} \;`) classifies `not_a_verification_command`. | deferred | agents/roadmaps/road-to-a-stop-that-holds.md — a refusing verdict on a rare shape. The fix is a parser for `-exec`-style argument positions, which is a larger surface than the case warrants; noted rather than guessed at. |
| 17 | low | src/scripts/_lib/verification_evidence.ts:266 | `parseTap` matches any output with line-initial `ok` / `not ok`, so a stray `not ok` in prose becomes `FAIL_EVIDENCE`; `parseVitestOrJest` matches any line beginning `Tests `. | deferred | agents/roadmaps/road-to-a-stop-that-holds.md — reached only when the stricter parsers decline. Both directions are wrong in the refusing direction, which argues for a fix; it needs a corpus of real runner output to tighten against rather than a guess at the shape, and that corpus does not exist in this tree. |
| 18 | low | src/scripts/_lib/verification_evidence.ts:483 | `testTargetKey`'s `[./]` prefix requirement makes `foo_test.go` key-less while `pkg/foo_test.go` keys. | deferred | agents/roadmaps/road-to-a-stop-that-holds.md — inconsistent grouping with no live consequence: a key-less record joins the whole-suite group, which now settles any reddened target, so the direction is toward allowing. |
| 19 | low | tests/hooks/obligation_settle.test.ts | `process.chdir(root)` in `beforeEach` mutates process-global state shared with sibling suites in the same vitest worker. | accepted-risk | Pre-existing shape for a hook whose `main()` reads `process.cwd()`; the `afterEach` restores it. Removing the need means threading a root through `main()`, which is a wider change than this review's scope. |
| 20 | low | src/scripts/_lib/verification_evidence.ts | `hasRedThenGreen` and `testTargetKey` had no unit tests — only coverage behind detector F. | fixed | `728259377` — both are exercised directly by the round-trip suite, and `hasRedThenGreen` is asserted by name in five of its cases. |

**Ordering note, stated rather than hidden.** This artifact was committed AFTER
the fixes it records, so an ancestry check will report against it. That is the
true history: the review was dispatched to a fresh subagent on the pushed
branch, its report came back naming two blockers, both were independently
reproduced, and the repairs landed before this package was scaffolded. Recording
the findings late is worse than on time and better than not at all.

**What the review did NOT find, recorded because an empty category is a
result.** No off-by-one or boundary error in `readRunEvidence`, `hasRedThenGreen`
or `placeRecord`; `readTurnRunState`'s liveness predicate and ownership check
sound with all six branches tested; no lost, mis-ordered or mis-attributed run
in the recorder, verified end to end with a five-event sequence; no session-key
shape mismatch on the gate side; the extracted selector moved byte-identically
(its `_VERIFY_RE` block hashes equal to `origin/main`); replay reproducibility
unchanged by construction; no projection debt; `check_claims` clause (9)
internally consistent, with its self-correction of the plan's citation judged
right; and the `daemon-host-kill-switch` refusal judged the right call and the
right form.
