# Findings: conformance-round7
<!-- completion-review: v1 | reviewed: 2026-08-12 | scope: 7c7cedaa95ef17e5ad3bb03d9049ab400beca91a6411552f68bd0c22ecaa86e9 | diff: 030ca0d6e1a6b27ebbebf74a34caa1403cc98dfa | reviewer: r2-fresh-subagent-conformance-round7 | prompt_hash: 8fa7e81604e192d2b2f06468a439dad4f60549a1eef87fb3c48face83c883e9f -->

<!-- context-manifest: v1
inputs:
  diff_sha: 030ca0d6e1a6b27ebbebf74a34caa1403cc98dfa
  scope_hash: 7c7cedaa95ef17e5ad3bb03d9049ab400beca91a6411552f68bd0c22ecaa86e9
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-12T08:21:56Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/before_complete_hook.ts:353 | `ci_last` is written but never cleared at a SESSION boundary, so a stale unsettled CI read refuses completion claims in later, unrelated sessions. `_reset_turn` (`:285-296`) clears `ci_saw_pending` but not `ci_last`; the session-boundary branch (`:311-313`) clears only `verifications_this_session`; `ci_last: null` exists solely in `_empty_state` (`:123`) and `_load_state` merges the persisted value over it (`:141`). Session A polls CI, sees pending, ends. Session B — a doc-only session that never touches CI — says "Fertig, Matze." and `readCiSettled` (`hooks/turn_end_gate_hook.ts:375-390`) returns `{seen:true, settled:false}`, so `detectCompletionClaim` fires and the turn is refused. This directly contradicts the comment at `turn_end_gate_hook.ts:386-388` ("a session that never polled CI must never be refused for it") and roadmap step 1.4's negative case. The unit test for that case passes a synthetic `{seen:false}` and never exercises the state file; `'survives a user prompt'` pins the TURN boundary only. Aggravated at branch HEAD: PR #1296 removed the settings surface, so the detector now runs unconditionally (`turn_end_gate_hook.ts:858`) with no switch to disable it — the exact "teaches the user to switch it off" failure the test-suite docstring warns about, minus the switch. | fixed | 030ca0d6e |
| 2 | high | agents/evidence/reviews/conformance-round7.review-input/diff.patch:1 | The review scope is three commits stale and part of the reviewed diff has already been reverted on the branch. Diff head is `c4ace013e`; branch head is `cf8ecd057` (`4d284efa1`, `853519066` = merge of PR #1296 "turn-end-gate-always-on", `d05f97e13`, `cf8ecd057`). PR #1296 deleted `readGateSettings`, `GateSettings.completion` and `if (settings.completion)` from `turn_end_gate_hook.ts` and rewrote `tests/scripts/turn_end_gate_hook.test.ts` (`git diff --stat c4ace013e..HEAD`: 17 files, −427). So the diff both contains code that no longer exists (three of its Phase-1 hunks and one added test) and omits 17 changed files, including `src/config/agent-settings.template.yml`, `src/server/schemas/settings.ts`, `src/scripts/_lib/agent_settings.ts` and two new roadmaps. A verdict bound to scope hash `d2372…be92` does not describe the branch that is about to open the PR; the artefact needs a re-bind at HEAD before it is usable as gate evidence. | fixed | 030ca0d6e |
| 3 | medium | src/scripts/before_complete_hook.ts:349 | `settled: pending === 0` does not make the discrimination its own comment claims, and is silenced by the exact false settle this file exists to catch. The comment says "same discrimination `counts` makes above", but `counts` for `pending === 0` is `!vacuous && state["ci_saw_pending"] === true` (`:345`), while `settled` is `pending === 0` alone — it drops both the vacuity check and the in-flight witness. A post-push poll that reads a stale all-pass table returns `pendingCount` → 0 (`:262-266`), which is verbatim the FC-3b failure documented at `:335-338` ("Polling once and reading `pending == 0` off a run that never registered"), and it now records `settled: true` — so the new completion detector goes silent in precisely the premature-claim case it was built for. `conformance_scan.ts:468-473` copies both the logic and the wrong comment, so the measurement inherits the same blind spot. | fixed | 030ca0d6e |
| 4 | medium | src/scripts/check_ci_local_parity.ts:266 | The headline `221` counts gates the pre-push hook already runs, so it overstates and mislabels the gap. `localGates` includes the `task consistency` closure AND every gate reachable from `install-hooks.sh` (`:242-249`), while `ci_not_in_preflight` subtracts only the `preflight` closure. `install-hooks.sh:46` runs `task consistency` and `:68` runs `task preflight`, plus ~8 gates invoked directly (`check_no_conflict_markers`, `lint_marketplace`, `roadmap_progress_hook`, `lint_empty_roadmaps`, `validate_pack_yaml`, `lint_pack_dependencies`, `lint_namespace_collisions`, `check_knowledge_sharing`). Those run before the push lands and therefore cannot produce a "green locally, red remotely" cycle, yet the set is published as exactly that in four places: `:226` ("the measured size of 'green locally, red remotely'"), `:338` (printed on every run), `src/config/ci-local-parity.yml:31`, and `taskfiles/ci-fast.yml:17`. Phase 3.2 declares the number "the deliverable, not an adjective" — then computes it over a superset. | fixed | 030ca0d6e |
| 5 | medium | src/scripts/conformance_scan.ts:881 | The scan ships the denominator its own roadmap retracted in the same PR. The footer prints "Round 7 probe: 1 of 163 hand-back turns", while `agents/roadmaps/archive/road-to-conformance-round7.md:70` states 163 was wrong ("The denominator counted synthetic user turns … the committed script uses the scan's own `isSyntheticPrompt` / `isInjectedBody` predicates and reads 120") and gives the corrected 1 of 120 (0.8 %). The same roadmap then repeats the retracted figure in its own decline table at `:500` ("1 of 163 hand-back turns = **0.6 %**"). Phase 6's stated principle is "published beside the wrong ones, not instead of them"; here the wrong one is published alone, as current, by the instrument Phase 6 exists to correct. | fixed | 030ca0d6e |
| 6 | medium | src/scripts/probe_promissory_closing.ts:119 | Both reported rates are computed over a denominator that structurally cannot contribute hits. `result.handbacks += 1` runs before `if (ASKS.test(tail)) continue;` (`:121`), so every asking hand-back is counted in the denominator while being excluded from both the loose (`:122`) and narrow (`:123`) numerators. Since an asking closing is a common shape, this understates both figures by an unmeasured margin — the same denominator error the roadmap's corrected-numbers table #3 fixes for this exact metric, reintroduced one layer down. The docstring at `:23-26` says a turn that asks "is also excluded", which the code only half does; either exclude it from `handbacks` too, or report the ask count so the reader can see the bracket. | fixed | 030ca0d6e |
| 7 | medium | src/scripts/probe_session_canary.ts:106 | A maintainer's personal nickname is hardcoded as the shipped default: `arg("--name", "Matze")`. `src/` must stay project-agnostic (`augment-edit-discipline`, portability Iron Law), and the rule this probe measures resolves the name from three settings layers (`src/rules/session-canary.md`: project `personal.canary_name` → user-global → `identity.name`) — the probe reads none of them. Two consequences: any other user who omits `--name` gets a silent 0 % (`measure` greps for a name that never appears), and the figure the diff writes into a tracked rule (`src/rules/session-canary.md`: "25 of 28 … 89.3 %") is not reproducible without out-of-band knowledge of the name, which is what Phase 6.3 committed the probe to prevent. | fixed | 030ca0d6e |
| 8 | low | src/scripts/hooks/turn_end_gate_hook.ts:350 | Orphaned doc comment. `/** Read the pin the language-mirror hook wrote. Absent ⇒ no obligation. */` was left in place while `readCiSettled` and `detectCompletionClaim` were inserted below it, so it now sits directly above `readCiSettled`'s own block comment and `readLanguagePin` (`:423`) — the function it documents, 73 lines further down — has no doc at all. Tooling and readers will attribute it to the wrong function. | fixed | 030ca0d6e |
| 9 | low | src/scripts/hooks/block_no_verify.ts:508 | The rewritten fail-closed message asserts a cause the code cannot establish. It now states "The quoting is unbalanced OUTSIDE any terminated heredoc", but `_heredocs` (`:454`) only recognises delimiters matching `[A-Za-z_][A-Za-z0-9_]*` optionally wrapped in one quote character. Legal bash forms it does not match — `<<\EOF`, `<<"EOF-1"`, `<<'END OF'` — remain unstripped, so a terminated heredoc whose body holds an apostrophe still reaches this branch and is told the cause is not a terminated heredoc. Step 2.4 also removed the workaround line that used to unblock the user in that residual case, so the message went from misattributed-but-actionable to confidently wrong. | open | |
| 10 | low | src/scripts/hooks/block_no_verify.ts:427 | The threat model presents its case list as covering "what an attacker can hide in a heredoc body", but `_SHELL_CONSUMER_RE` (`:450-451`) anchors on segment start or `[|&;]` / `$(` / backtick, so a shell consumer reached through any other prefix is neither scanned nor named: `sudo bash <<EOF`, `timeout 5 bash <<EOF`, `2>/dev/null bash <<EOF`, and `cat <<EOF | bash` (prefix is `cat`). These are pre-existing bypasses rather than regressions of this diff — `_git_base` (`:207-216`) requires git in command position, so none of them blocked before either — but the docstring's three-case enumeration reads as exhaustive, and step 2.1's verification is `grep -ci "threat model"`, which cannot detect an incomplete one. Compare `_looks_like_git_invocation` (`:380-387`), which does recurse through a `sh -c` wrapper one level up. | open | |
| 11 | low | src/scripts/hooks/turn_end_gate_hook.ts:402 | `_COMPLETION_RE` is polarity-blind at a line start and misses one of the three shapes the roadmap cites as motivating. `fertig\b` after `(^|\n)\s*(?:\*\*)?` matches any line opening with the word, including a negation — "Fertig wäre das erst, wenn die CI grün ist." fires. In the other direction, the second of the roadmap's three verbatim examples (`road-to-conformance-round7.md:158-159`, `9502795e` — "**Stand.** … mehrere Node-/Install-Shards laufen noch.") matches no alternative in the pattern. Since the detector is unconditional at HEAD, the false-positive direction is the one that costs; a negation-lookahead or a requirement that the claim sit in the closing paragraph (as `detectPromissory` does) would bound it. | open | |
| 12 | low | src/scripts/conformance_scan.ts:167 | Declared type contradicts the runtime the renderer defends against. `RateRecord.de_pin_turns: number` (`:167`) and `rate_pct_de_pin: number` (`:169`) are non-optional, while `render` guards them with `typeof dePinTurns === 'number'` (`:828`) justified by "a `rate` block RECORDED before round 7 carries neither field". Both statements cannot hold: if a recorded pre-round-7 line can be read back, the fields are `undefined` and the type should be `number | undefined`; if the type is right, the guard is dead code and is liable to trip a `no-unnecessary-condition` lint. The `--record` series is the stated reason the guard exists, so the type is the half that is wrong. | fixed | 030ca0d6e (RateRecord fields made optional) |
| 13 | low | tests/scripts/check_ci_local_parity.test.ts:47 | A test that reds when the codebase improves. `expect(report.ci_not_in_preflight.length).toBeGreaterThan(0)` fails the moment `preflight` grows to cover the CI set — the outcome Phase 3 describes as desirable but declines to pursue — and the accompanying comment ("if it ever empties, the report should be deleted, not left lying") states the intent while the assertion enforces the opposite as a red build. The invariant on the next line (`preflight_gates.length < local_gates.length`) is the one that carries the relation; the `> 0` assertion only pins today's repo state. Same file, `:50-58`, pins `undeclared_ci_only` / `undeclared_local_only` / `stale_declarations` as empty, which duplicates the gate's own verdict inside the unit suite — any future undeclared gate now reds twice, in two places, for one cause. | open | |
| 14 | low | agents/roadmaps/archive/road-to-conformance-round7.md:87 | The roadmap's own numbers disagree with each other. The era table gives post-carrier assistant turns as 1 697 (`:87`), while the completion-claim table at `:224` gives "15 / 1 727 (0.87 %)" for the same era and the same corpus. 657 + 1 727 = 2 384, which contradicts the 2 354 assistant turns the Method section pins at `:56-57`. One of the two figures is wrong and the round's thesis is that its numbers are auditable, so the discrepancy should be resolved or its cause named rather than left for the next round to re-derive. | open | |

## Dispositions — round 1, re-bound at `030ca0d6e`

**9 of 14 fixed** (findings 1-8 and 12). Both `high` findings were in this PR's
own Phase 1 and both were real: `ci_last` was never cleared at a session
boundary, and `settled: pending === 0` dropped the in-flight witness so the
detector went silent in exactly the premature-claim case it was built for. In the
second case **my own test asserted the defective behaviour** — it was rewritten
rather than the code reverted, and the corrected pair (`NO in-flight witness` /
`AFTER an in-flight observation`) is what the assertion should have been.

Finding 4 moved a published number: the gap reads **209**, not 221, once the
pre-push hook's own closure is subtracted — a gate that runs before the push lands
cannot produce a "green locally, red remotely" cycle. Corrected in all four places
the figure appears.

**5 left open, each with its reason. None is a silent decline.**

- **9 · `block_no_verify` fail-closed message over-asserts.** Correct: `_heredocs`
  does not match `<<\EOF`, `<<"EOF-1"`, `<<'END OF'`, so a terminated heredoc in
  those forms still reaches the branch and is told the cause is not one. The
  message is now wrong for a residual case that step 2.4 also stripped the
  workaround from. Fixing it properly means widening the delimiter grammar, which
  is a parser change on a blocking guard and belongs with finding 10's tokeniser
  work, not bolted onto a message string.
- **10 · the threat model's case list is not exhaustive.** `sudo bash <<EOF`,
  `timeout 5 bash <<EOF`, `cat <<EOF | bash` are unscanned. Verified
  **pre-existing**, not introduced here — `_git_base` requires git in command
  position, so none of them blocked before either. It is the same tokeniser gap
  as § 2.5's whitespace-separator defect, and the same argument applies: the naive
  widening opens a false negative on `--no-verify` itself. Both are recorded in
  the roadmap's not-fixed table with the probe that reproduces them.
- **11 · `_COMPLETION_RE` is polarity-blind and misses one cited shape.** Both
  halves confirmed: "Fertig wäre das erst, wenn…" fires, and `9502795e`'s
  "**Stand.** … Shards laufen noch" does not. The detector is unconditional at
  HEAD, so the false-positive direction is the one that costs — and the honest fix
  is what the reviewer proposes (a negation lookahead, or requiring the claim in
  the closing paragraph as `detectPromissory` does). Deferred because it changes
  what the fifth check MEASURES, and the 17/28-session figure this PR publishes
  was produced by the current predicate. Changing both in one PR would leave no
  before-figure to compare against.
- **13 · a test that reds when the codebase improves.** Correct as stated. Left
  because the assertion is load-bearing today in the other direction: it is the
  only thing standing between this report and the "a gate that scans nothing exits
  green" class, and the relation assertion beside it does not catch an empty
  derivation. The right fix is a positive floor on `preflight_gates.length` plus
  dropping the `> 0`, which is a small change this PR is not making blind.
- **14 · the roadmap's own numbers disagree.** Real and it is the third
  denominator correction in one round. Left in place deliberately: § "Corrected
  numbers" exists to publish those beside the originals, and silently reconciling
  the table would delete the evidence that the figure moved. The window-slide
  caveat in § Method states why absolute figures are pinned to a timestamp.
