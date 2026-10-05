# Findings: lane-installed-layer-thinned
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: a916ccd7c59ae9c64eedc49f2756ce2b1fe3a9dc3460fd1408d42e46b33e8d26 | diff: a42028bd2dd5aba69bb6a7be0ed3ae51a17a5636 | reviewer: r2-fresh-subagent-lane-installed-layer-thinned | prompt_hash: b9acb8a85348a07f0e86077d81770f971a0c5674abdb33c635cdcb085861bcce -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-lane-installed-layer-thinned"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: a42028bd2dd5aba69bb6a7be0ed3ae51a17a5636
  scope_hash: a916ccd7c59ae9c64eedc49f2756ce2b1fe3a9dc3460fd1408d42e46b33e8d26
  roadmap: agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md
  roadmap_hash: b8f8cab1196711e9bc9df86d1d588769c22555e4ce2f2824097c110ac39d6648
  ac_hash: 602a1fadd60390be04692994f304024eca677801723b4fa32a748869c019ef0c
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T03:40:16Z
-->


Two blind rounds, by fresh subagents with no implementation context, at scopes
`4930bab7…` (round 1, 11 findings) and `b039e0cf…` (round 2, 12 findings). Both
prompts were assembled by `dispatch_r2_reviewer`, not hand-written, and neither
reviewer was told what verdict to reach. Round 2 was run against the repaired
tree precisely because a single pass over one's own fixes is not independent
evidence that they hold.

The rows below transcribe both rounds, with the severity vocabulary mapped onto
this contract's (`major` → `high`, `nit` → `low`). `R1` / `R2` names the round.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/scripts/report_standing_payload_by_host.ts:232 | R1 — the codex writer citation was re-anchored to `install.ts:1385`, but the anchor string is on 1381; `assertWritersResolve` reads `lines[n-1]` and the CLI exits non-zero. Deterministic, and invisible to the suites this session had run. | fixed | Re-anchored again as the extraction shrank install.ts; now 1382, verified by `report_standing_payload_by_host.test.ts`; a42028bd2 |
| 2 | critical | src/scripts/_lib/agent_settings.ts:308 | R1 — `lean_projection.mode` / `.hosts` added to `MERGEABLE_KEYS`, but `tests/lib/agent_settings.test.ts` pins that list with an exact `toEqual` and was not in the changed-file set, so the test failed. Its own comment states the governance half too: "widening the user-global surface requires an ADR", and every other entry cites one. | fixed | ADR-278 written; pinned list updated by exactly the two rows; a2a592945 |
| 3 | high | src/scripts/_lib/installed_layer.ts + src/scripts/install.ts | R2 — step 1.4 says "AT INSTALL, the receipt reports … and warns". No install-side caller existed: `buildHostLimitRows` was reachable only from the standalone report CLI, and the step's own verify tests that module, so the closure was green against a surface no consumer runs. | fixed | `installReceiptBudgetLines` added and wired; a case under the step's own `-t combined` filter exercises it; a42028bd2 |
| 4 | high | src/scripts/install.ts:3022 | R1 — `installerThinsHost` resolved `process.cwd()`'s cascade: a per-checkout value gating a machine-global mutation of `~/.claude/rules`. Both directions bite, and the project layer merges last and wins. | fixed | The predicate pins the project layer to a path no tree contains; both directions asserted, plus the production call shape from a disagreeing cwd; a2a592945 |
| 5 | high | src/install/installThinLayer.ts:141 | R1 — `split_frontmatter` answers `['', text]` for an unterminated block, so `'' + stub` deleted the `package:` line the orphan reaper calls its only ownership evidence. Silent and permanent. | fixed | Guarded and reported, asserted on the bytes; R2 then found the guard's own gap — see row 9; a2a592945 |
| 6 | high | src/scripts/_lib/installed_layer.ts:283 | R1 — `new URL(import.meta.url).pathname` percent-encodes a space and yields a drive path on Windows; the read then fails, is swallowed, and EVERY host reads `unpublished` with no warning. The budget measurement degrades to "not measured" with no signal. | fixed | `fileURLToPath`, matching the function whose parity the comment claimed; a2a592945 |
| 7 | high | tests/scripts/install_thin_layer.test.ts | R2 — the rollback case passed one digest as both `recordedSha256` and `onDiskSha256`, so `decideDeployWrite` returned `write` by definition of equal digests. It would have passed under the ordering it said it existed to catch, and the module header claimed it "pins directly" what it did not pin. | fixed | Both digests taken; early reads `preserve`, late reads `write`. A sibling case pins the ordering itself by index over the installer source; a42028bd2 |
| 8 | high | src/install/installThinLayer.ts:113 | R2 — `_globSortedMd` swallows an unreadable directory and answers `[]`, so a wrongly resolved package root produced zero stubs, zero counters and a success-shaped receipt. The installer's try/catch sees only throws. | fixed | An empty stub map is reported as a failure naming the directory; a42028bd2 |
| 9 | medium | src/install/installThinLayer.ts:165 | R2 — the new frontmatter guard sniffed `startsWith('---')`, so a BOM or leading whitespace took the "no block here" branch into the write the guard prevents. | fixed | Guard is a regex over an optional BOM and leading whitespace; asserted; a42028bd2 |
| 10 | medium | src/install/installThinLayer.ts:140 | R2 — kept-vs-thinned was decided by `is_thin_entry` over `build_thin`'s OUTPUT, but that function returns the source text verbatim on the full branch. A source rule whose body contained the marker would have been written as `installedFrontmatter + fullSourceText`, duplicating the frontmatter. 0 such rules ship, so latent. | fixed | Decided by identity against the source bytes; a poisoned-fixture case pins it; a42028bd2 |
| 11 | medium | src/scripts/_lib/lean_projection_mode.ts:303 | R1 + R2 — `modeExplicit` was computed eagerly through a second full cascade for every caller, including the per-prompt delivery concern, which destructures it away and discards it. R1 found the false docstring, R2 the avoidable cost. | fixed | Lazy getter; the hot path pays one read again and the docstrings say so; a42028bd2 |
| 12 | medium | src/scripts/_lib/installed_layer.ts:358 | R2 — rows were layer-driven while the quoted requirement is limit-driven, so a host with a published limit and no layer entry got no row. The two sources agree today, which means they can only diverge in the direction the code did not cover. | fixed | The limits table's hosts are unioned in; a42028bd2 |
| 13 | medium | src/install/installThinLayer.ts:119 | R1 — every read failure was classified `absent`, documented as "out of rule scope". `EACCES`/`EISDIR`/`EIO` reported as a scoping outcome, and the receipt prints failures and not absences. | fixed | Only `ENOENT` is an absence; a directory-in-place-of-a-file case pins it; a2a592945 |
| 14 | medium | tests/scripts/install_thin_layer.test.ts:469 | R2 — a negative `toContain` on a hand-respelled prefix of `STUB_LAW_OPEN`, whose own docstring argues that a re-spelled detector drifts silently. A negative assertion on a stale literal passes forever. | fixed | Imports the exported constant; a42028bd2 |
| 15 | medium | src/scripts/_lib/lean_projection_mode.ts:397 | R2 — `installerThinsHost` always sets `settingsPath`, so a `projectRoot` handed to it is discarded on the first line; the cases passed one as if it were the mechanism under test. Behaviour correct, mechanism misread. | fixed | Documented on the constant; the cases stop passing a `projectRoot` that does nothing; a42028bd2 |
| 16 | medium | src/install/installThinLayer.ts:165 | R2 — a ZERO-BYTE installed rule yields `frontmatter === ''` without matching the guard, so a stub is written with no frontmatter. | accepted-risk | A zero-byte file carries no `package:` / `source_path:` keys, so the write destroys nothing. The class the guard exists for is "a block that exists and was not parsed"; a file with no bytes has no block. Revisit if the copy is ever observed producing one |
| 17 | low | src/scripts/_lib/thin_rules.ts:484 | R1 — `build_thin`'s `roots` docstring said "three directories up", one screen below the `REPO_ROOT` note explaining it is four. | fixed | a2a592945 |
| 18 | low | src/scripts/_lib/installed_layer.ts:134 | R1 — the `warn` field documented "crosses it" while it fires at `LIMIT_WARN_FRACTION` of the limit. The rendered string was correct; the published contract was not. | fixed | a2a592945 |
| 19 | low | tests/scripts/installed_layer_report.test.ts:316 | R1 — the boundary case derived from a literal `0.8` while a sibling line used `LIMIT_WARN_FRACTION`; a moved constant would have silently measured the wrong boundary. | fixed | a2a592945 |
| 20 | low | src/install/installThinLayer.ts:145 | R1 — `thinned` was incremented on the no-write path, so a repeat install's receipt claimed work it had not done. | fixed | `rewritten` split out; the receipt says "already thinned" when nothing was written; a2a592945 |
| 21 | low | src/scripts/_lib/installed_layer.ts:283 | R2 — `defaultHostLimitsPath`'s comment said `_lib/` sits two directories under the package root. It sits three, and the two hops land on `src/`, which is why the result is right — the comment's arithmetic is the half a reader would trust when changing the hops. | fixed | a42028bd2 |
| 22 | low | src/scripts/project_thin_rules.ts:21 | R2 — the header still claimed to hold the `BODY_LINK_PREFIX` literal and argued a twin-parity exemption for it. The literal moved to `_lib/thin_rules.ts` with the mechanism. | fixed | a42028bd2 |
| 23 | low | src/config/gate-violation-baselines.json | R2 — the record carried two histories: `note` said 17,585 to 17,575 while `reason` still said "Lowered 17,590 to 17,585 on 2026-10-03". A reader cannot tell which is current. | fixed | `reason` states the present number and keeps the earlier text behind a marker; a42028bd2 |

## The §2.5 ordering was not met, and the gate will say so

Contract §2.5 asks for the findings artifact to be committed BEFORE the commits
that fix its rows, so a record cannot be written to match repairs that already
landed. That did not happen here: both rounds were commissioned after the
implementation was pushed, so every `fixed` row cites a commit that predates this
file's first-add commit, and `check_completion_review` reports `fix-before-artifact`
for each one. It runs `--advisory` in CI, so this is a warning rather than a
failure — which is the reason to state it here rather than let the warning carry
it. The rows are a transcription of two reports that exist in full in the session
record; what the ordering costs is the ability to prove that from the tree alone,
and nothing in this file should be read as that proof.

## What the rounds could not check

Neither reviewer executed a test, a gate or an install. Every "the test asserts
X" above is a reading of the assertion and the code it calls, which is why rows 1
and 2 were confirmed by a run afterwards rather than treated as proven on the
reading alone. Neither reviewer treated the generated bundles as more than build
output, so `dist/install/install.mjs` is unverified by the review as a faithful
build of these sources; the install-bundle freshness gate verifies it instead.

Round 2 declared three reads outside its stated allowlist rather than taking them
silently — `check_source_size_budget.ts`, `_lib/rule_injection.ts` and
`globalRuleLayers.ts`, all read-only, all to settle the two numbers its prompt
asked it to verify instead of reporting them unverified. Round 1 declared three
of its own on the same terms.

AC-1 (an opted-in install under 75,000 package-owned characters on an empty
`HOME`), AC-2 (one arrival record per supported host version) and AC-3 (the
standing-only fixture with the carrier off) are not discharged by this diff and
remain open on the roadmap. AC-3's fixture exists and is green; the AC asks for
it on a real install with the carrier disabled, which is Phase 2 work.
