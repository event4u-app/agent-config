<!-- evidence-type: analysis -->

# Ratification review — the dispatch bundle ceiling for detector G and the exit-code classifier — round 19

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose byte ceiling for the hook dispatch bundle (`dist/hooks/dispatch.js`, loaded by every hook event) is raised. ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it.

subject: f90992555a09226fca5950d93651961c3902bee9492f20ee3fee159149d4dcbc

(The digest covers the gated file at commit `f68f71092d` on branch `feat/done-claims-with-read-exit-codes`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Roadmap `road-to-done-claims-with-read-exit-codes` adds three things to the turn-end hook path:

1. **Masked exit codes.** `_lib/verification_command.ts` `exitMasking()` reads the line only up to the first lone `exit`/`return` that runs unconditionally (nothing after it runs), and within that reads from the LAST pipeline that contains a verifier backwards: when that verifier is reached only through a `||` (an earlier pipeline's 0 skips it), the earlier verifier's reading counts too. `pipe`: its verifier is not the pipeline's last command and no earlier `set -o pipefail` covers it (a `set` counts only when it runs alone and unconditionally — not behind `&&`/`||`, not inside a pipeline; a later `set +o pipefail` turns it off), so the pipeline's status is a filter's — — and with or without pipefail, a verifier whose very next command (after `;`) is a lone `exit`/`return` whose argument is exactly `${PIPESTATUS[k]}` (optionally quoted) with `k` the verifier's index is unmasked. `trailing`: its status is the verifier's, and following the rest of the line a failure does not reach the recorded code (`failureReachesRecord`): an `&&` command is skipped on failure (an `&& exit 0` too); `|| exit` and `|| exit N` with N a literal nonzero modulo 256 end the shell with a failure (`exit 00`, `exit 256`, `exit "$code"` do not count); `|| false` standing alone keeps a failure only until the next command (`|| false | cat` does not); `; exit` / `; exit $?` pass the status on (an `exit` inside a pipeline ends only its subshell and counts as an ordinary command); any other command that runs after a failure replaces it. `cmd || true` is NOT a masking case: it is the existing discard, `not_a_verification_command` before and after. `_lib/verification_evidence.ts` `classifyRun()` consults masking ONLY where the exit code would decide — after printed failures, load failures and empty suites have had their say — and ONLY when the recorded exit code is 0 (new in this round, roadmap decision D9): then it returns `exit_masked`, an instrument-gap reason that never refuses a turn. A nonzero recorded code keeps exactly the verdict it had on origin/main. No line of output is ever read as the verifier's status (D8, round 7). An `rtk` wrapper is peeled so `rtk vitest run` is still recognised as a verifier.
2. **Detector G (`coverage`).** `_lib/coverage_claim.ts`: a reply that claims done and reports `N of M` with N < M (`partial_ratio`), or a turn that edited a runnable surface, ran nothing that drives it, and claims done without a `Not verified:` list naming it (`unlisted_surface`). It RECORDS into per-session counters (`<key>.recorded.json`) and never refuses; `refusingFindings` drops it from the verdict.
3. **Live surfaces.** `_lib/live_surfaces.ts` derives runnable surfaces from repo files. Detector G calls it in memory, only for a claimed turn with edits; the `verify:surfaces` CLI (`derive_live_surfaces.ts`, not in the bundle) writes the map to `agents/state/live-surfaces.json`.

A council (analysis, 2026-11-21) kept all three new reasons record-only with per-reason revisit conditions (D5-D7 in the roadmap).

## History

Rounds 1-11 each split 1-1: the anthropic seat passed every round (`ratified` in 1-6 and 8-11, `confirmed-non-expanding` in 7). Round 12 refused 0-2; rounds 13-18 split 1-1 again (anthropic ratified); the openai seat refused every round, each time on a new finding, every one fixed with a test seen red first. Five of the openai findings across rounds 2-6 were ways an `exit=N` line in the output could belong to another command than the verifier: a filter's `PIPESTATUS[1]`, an echo after another echo, a constant printed by a `printf` format, an `|| echo` skipped on success, and (round 6) an echo redirected to `/dev/null`. The command text cannot establish where an echo's output went. **Round 7 dropped the echoed-status reading entirely** (D8, recorded in the roadmap's Decisions table with this reasoning and a revisit condition: shell-backed records that carry the verifier's own status). A masked run is `exit_masked`, full stop. This costs nothing against origin/main, where those same lines read the echo's own 0 and passed.

Round 18: anthropic ratified; openai refused on three points, fixed with tests in the `fix(turn-end-gate)` commit before `f68f71092d`:

- **A skipped `||` fallback.** `task ci | tail -5 || npx tsc --noEmit` is now `pipe`: `tail`'s 0 skips `tsc`, so the earlier verifier's masking is read (test).
- **Requests that never reach the surface.** A surface URL credits an HTTP client or render only when one of its arguments IS the URL (`curl 'https://example.invalid/?next=http://localhost:3000'` does not); a start command behind `false &&` is not reached (tests).
- **Documentation edits.** An edit to a documentation file (`.md`, `.mdx`, `.markdown`, `.txt`, `.rst`, `.adoc`, or anything under `docs/`) is not an edit to a runnable surface (test: an edit to `docs/README.md` records nothing). Every derived surface's root is the repo root, so this is the boundary that ties an edit to "something that runs".

Round 17: anthropic ratified; openai refused on two points plus two suggestions, done in the `fix(turn-end-gate)` commit before `0e2901aae6`:

- **Ratios on one long negated line.** Each line's negation is decided once (line bounds move forward with the matches, the result is cached per line), not once per ratio (test: 40,000 `1/2` entries on one line ending `not yet` finish in well under 1 s; it took over 1 s before).
- **Credit for a command that never runs.** `commandSegments` now stops at a lone `exit`/`return` that runs unconditionally, so `exit 0; npm run dev` drives nothing (test).
- **Masked zero beside a refusing record** (requested regression): `readRunEvidence` over a masked `npx vitest run | tail -5` (recorded 0) and `npx tsc --noEmit` (recorded 2) reports `passed: false`, `failed: false`, `instrumentGap: true` (test) — so detectors C and E take the transcript path described below, where the masked verification command after the edit allows the turn, as the recorded pass did on origin/main.
- The bounded reader moved to its own module, `_lib/bounded_read.ts`, used by the surface reader and by the refusal-state pruner, so the pruner no longer depends on surface discovery.

Round 16: anthropic ratified; openai refused on three points, fixed with tests in the `fix(turn-end-gate)` commit before `8036cbf626`:

- **`Not verified:` spans in linear time.** Block ends are found once, headings are walked in order and spans in one block merge; ratio lookup is a binary search over the disjoint spans (test: a reply with 20,000 `Not verified: 2/3` lines in one block finishes in well under 1 s).
- **A `webServer` written inside a string literal.** Keys are matched on a same-length copy whose string interiors are blanked; the command value is then read from the original at that position (test: `const example = "webServer: { command: 'npm run preview' }"` beside a real `webServer` starting `dev` leaves `preview` unlisted).
- **An unreachable final verifier.** `task ci | tail -5; exit 0; npx tsc --noEmit` is now `pipe`: the line is cut after the unconditional `exit 0`, so `tsc` is not taken as the last verifier (test).

Round 15: anthropic ratified; openai refused on three points, fixed with tests in the `fix(turn-end-gate)` commit before `5135592a52`:

- **Comment stripping.** The Playwright config's comments are now removed by one linear, string-aware pass (`stripJsComments`): a `/*` inside a string is not a comment, and an unclosed `/*` ends the scan instead of causing rescans (test: a config whose string holds 200,000 `/*` openers runs the detector in well under 1 s).
- **`set -o pipefail; task ci | tail -5; exit "${PIPESTATUS[0]}"`** is now unmasked (it was a spurious `exit_masked` gap): the explicit `PIPESTATUS[k]` exit is honoured with pipefail on as well (test).
- **URL credit.** A surface URL credits only a segment that is an HTTP client (`curl`, `wget`, `http`, `https`, `xh`, `hurl`) or a render; `true http://localhost:3000` no longer credits a compose service, `curl -s …:3000/health` still does (tests).

On anthropic's round-15 note about detector C, checked in the code (unchanged by this PR): `readRunEvidence` reports `instrumentGap` when only gap reasons were found; detector C (`turn_end_gate_hook.ts:742-756`) then does not refuse on the records and falls back to the transcript path, the pre-record behavior, which allows the turn when a Bash call after the last edit is a verification attempt — and the masked command itself is one. Detector E's red-then-green check likewise returns early on `instrumentGap` (`:882`). So a pass turned into `exit_masked` leaves the turn allowed.

Round 14 (run twice; the first run timed out on both seats): anthropic ratified; openai refused on three points, fixed with red-first tests in the `fix(turn-end-gate)` commit before `9165394b1c`:

- **Compose line index.** Replaced the per-line regex (super-linear on a long whitespace run inside a block scalar) with a linear scan: an indented line, the text before its first `:`, no `#` or space in the key (test: a 400,000-space block-scalar line indexes in well under 1 s).
- **webServer credit per config.** Only the `command:` inside a config's `webServer: { … }` entry counts (comments removed); any other `command:` property does not. Each npm surface records which root configs start it (`webServerOf`), and a run naming `-c X` credits only scripts X starts (tests: `metadata.command: 'npm run preview'` does not credit `preview`; with two root configs starting `dev` and `preview`, `-c playwright.config.ts` leaves `preview` unlisted).
- **`Not verified:` heading after blank lines.** The heading pattern's leading whitespace is now horizontal only, so the span starts on the heading line (test: `Done.\n\n\n\nNot verified: 40/41 pages` records nothing).

The classifier test diff is omitted from this round's prompt to keep it within the seats' time limit; every case named above is in it.

Round 13: anthropic ratified; openai refused on three points (a first run of the round lost the openai seat, so the round was run again on the same prompt). Fixed in the `fix(verify)` commit before `789f962942`:

- **Work cap during construction.** The 64-surface cap is now enforced while building: a tauri window list is cut to 64 before any surface is built, compose ports stop at the cap, and finding compose files walks at most 4,096 directory entries through `opendirSync` instead of listing and sorting the whole directory (test: a config listing 200,000 windows derives 64 surfaces in well under 2 s).
- **webServer attribution.** An npm script is marked as started by playwright only when it is the command in a `command:` string of a root `playwright.config.*`, after comments are removed (test: the config also mentions `npm run preview` in a comment; `preview` still records `unlisted_surface`).
- **Masking parsed only when it can matter.** `exitMasking()` now runs only for a recorded 0, after the output-based decisions.

Round 12 refused 0-2. Fixed with red-first tests in the `fix(turn-end-gate)` commit before `6eab2f1a22`:

- **anthropic: counter path built from an unvalidated key.** The key is in fact `deriveSessionKey()` — the first 32 hex characters of a sha256 of the session id (`turn_end_refusals.ts:109`) — so no path syntax can reach it; `recordedFile` now refuses anything that is not 32 lowercase hex characters anyway (test: `../../evil` throws; a derived key builds the expected path). The pruner's counter read also passes the state directory as the containment root.
- **openai: a playwright run credited every npm script.** The reader now marks an npm-script surface `webServer: true` only when a root `playwright.config.*` text starts that script (`npm run X`, `pnpm X`, `yarn X`, `bun run X`); a playwright run credits only such a surface (test: with `dev` and `preview` and a config starting `npm run dev`, an edit plus `npx playwright test` records `unlisted_surface` for `preview`).
- **openai: unbounded work per surface.** At most 64 surfaces per derivation (test: 500 tauri windows → 64), and each recorded command is split into segments once, not once per surface.
- **openai: counter values unvalidated.** `readRecorded` keeps only non-negative safe integers in `counts` and `codes` (test: `"9"` and `-1` are dropped).

Round 11: anthropic ratified; openai refused on three points, fixed with tests in the `fix(turn-end-gate)` commit before `6c7eb24fd4`:

- **Counter reads.** `readRecorded` and the pruner's `.recorded.json` branch read through the same bounded, non-blocking, regular-file `readText` as the repository inputs, so a FIFO at a counter path cannot stall the Stop hook (test: `readRecorded` on a FIFO returns null; this test was added with the fix, since against the old code it blocks the worker rather than failing).
- **Negation past a blank line.** `COMPLETION_RE`'s `(^|\n)\s*` can start before a blank line; `lineAround` now skips all leading whitespace to the first non-blank character (test with `Progress update.\n\nFertig ist der Fix noch nicht.\n165 von 405`). Shared with D and F, where it can only allow more honest closings.
- **Browser credit.** A `playwright test` run credits an npm surface only through the repo's own root `playwright.config.*` (no `--config`, or one naming the root config); `-c apps/admin/playwright.config.ts` does not credit the root `npm run dev` (test). `ui:render` keeps crediting web surfaces.

Round 10: anthropic ratified; openai refused on three points. Fixed with red-first tests in the two `fix(...)` commits before `3967be8a0e`:

- `task ci || exit 00` / `|| exit 256` were read as keeping the failure (both end with 0; a missed mask under D9, never a worse verdict). A literal code now counts only when nonzero modulo 256; a non-literal (`exit "$code"`) does not count. Tests for all three.
- **A negation on the claim's own line was missed** when `COMPLETION_RE` matched at the `\n` before the claim: `lineAround` returned the empty line. `lineAround` now steps past a leading newline. This is the shared helper detectors D and F already used (moved here from the hook), so their negation check is corrected the same way — it can only ALLOW more honest "not done yet" closings, never refuse more. Test: `Progress update.\nFertig ist der Fix noch nicht.\n165 von 405` records nothing.
- **The reader's parent-directory race.** Not fully closable here, and stated as a residual in the code: Node has no `openat`, so a directory swapped again between the post-open re-check and its `stat` cannot be excluded by any sequence of path calls. The reader already resolves and checks containment before open, opens the real path with `O_NOFOLLOW | O_NONBLOCK`, and after open re-resolves, re-checks containment and requires the same inode and device. The residual needs a process that swaps directories inside the workspace at the instant of a Stop hook — a process that already controls the files the agent runs (`package.json` scripts, the Taskfile) — and what the reader returns becomes surface names in a local, record-only counter that is never displayed outward or sent anywhere.

Round 9: anthropic ratified; openai refused on the post-open check (it compared the descriptor with the re-resolved path but did not re-check that path's containment) and on `exitsWithPipestatus` accepting `exit "${PIPESTATUS[0]}" | cat` and any argument merely containing the expansion. Fixed: the path resolved after open must again be inside the workspace's real path and match the descriptor's inode and device; `exitsWithPipestatus` requires a lone command and the bare expansion (tests: both shapes are now `pipe`, the plain `exit "${PIPESTATUS[0]}"` stays unmasked). The seat also asked that the `rtk` change be described in both directions — point (b) now does.

Round 8: the openai seat refused on two masking paths the classifier MISSED (a recorded 0 that should have been `exit_masked` but passed — the same `PASS_EVIDENCE_OK` origin/main gives those lines, so no verdict worsened against origin/main): `false && set -o pipefail; task ci | tail -5` and `task ci || exit 1 | cat`; plus a `tauri.conf.json` of JSON `null` that threw and dropped the whole surface finding, and a check-then-open window on a swapped parent directory. Fixed with red-first tests in the two `fix(...)` commits before `f43a446bb7`: a `set` counts only alone and unconditionally; an `exit` in a pipeline is an ordinary command; a non-object tauri config is skipped (test: `null` beside a valid `package.json` keeps the npm surface); reads open the contained real path with `O_NOFOLLOW` and, after opening, re-resolve the path and require the same inode and device. A hook-level test pins that a coverage finding beside a refusing finding leaves exactly the refusing one.

Note on direction, since D9: every remaining way the masking reading can be wrong is a MISS (a masked line classified as before) or a SPURIOUS gap (a pass counted as `exit_masked`); neither changes a turn verdict against origin/main.

Round 7: the openai seat refused on shell paths where the masking reading attributes the verifier's own nonzero status to a filter and so demotes a real failure (`tsc --noEmit && task ci | tail -5` with `tsc` failing; `set -e; tsc --noEmit; echo done`), on `|| false | cat`, and on a symlinked parent directory. Fixed with red-first tests in the two `fix(...)` commits before `2db964c52a`:

- **No refusal can be demoted (D9).** Masking now replaces only a recorded 0. Any nonzero recorded code keeps the verdict origin/main gave it, whatever the shell actually ran — this removes the whole class of "the classifier mistook which command failed" in the refusing direction, not one shape at a time. Tests: `npx vitest run | grep foo` (1), `npx tsc --noEmit && task ci | tail -5` (2) and `set -e; npx tsc --noEmit; echo done` (2) all stay `nonzero_exit_without_test_failure`.
- `|| false` keeps a failure only when it stands alone; `npx tsc --noEmit || false | cat` with a recorded 0 is `exit_masked` (test).
- Input reads resolve the real path and refuse anything outside the workspace's real path, so a symlinked `src-tauri` directory is not read through (test), on top of `O_NOFOLLOW` for the last component.

Round 6's other points, fixed with red-first tests:

- A surface URL now counts only as a whole host:port (`http://localhost:3000` does not match `…:30000`) and only in a segment that is not `echo`/`printf` (test: `curl …:30000` and `echo …:3000` do not drive a `3000` compose service; `curl -s …:3000/health` does).
- A `Not verified:` entry written in inline code (`` `npm run dev` ``) still lists the surface (test).
- Input files are opened `O_RDONLY | O_NONBLOCK | O_NOFOLLOW`: a symlinked input is not followed out of the repo (test).

Earlier rounds, all still in place: masking only at the exit-code decision point; pipeline-aware attribution (`set -o pipefail; task ci | tail -5; echo done` is `trailing`; `task ci | tail -5; npx tsc --noEmit` is unmasked so a failing final `tsc` still refuses); browser runs and start commands recognised on parsed command segments (`echo "playwright test"` / `echo "npm run dev"` drive nothing; every `playwright test` segment in a call is checked against its `--config`, resolved from the workspace root); bounded reads (descriptor `fstat`, regular file ≤ 1 MiB, at most eight compose files, per-file line indexes for compose services and tauri windows); `Not verified:` needs its colon and matches surface names as whole words; detector G reads the repo only for a claimed turn with edits.

**Not changed, with reasons.** (a) `set -o pipefail; task ci | grep foo` with a passing `task ci` and a `grep` that matches nothing records 1 and refuses as `nonzero_exit_without_test_failure` — exactly as on origin/main, where pipefail lines were never inspected; the roadmap's AC-1 pins the other direction (a `set -o pipefail; … | tail` control stays `PASS_EVIDENCE_OK`). A pre-existing limit, not a weakening. (b) The `rtk` peel makes `rtk vitest run` / `rtk tsc` classify on the wrapped command instead of as `not_a_verification_command`. That moves verdicts in BOTH directions, and this is stated plainly: such a run can now refuse (`FAIL_EVIDENCE` on printed failures, `nonzero_exit_without_test_failure`), and it can now also count as pass evidence (`PASS_EVIDENCE_OK`) where before it counted as no verification at all. That is the intent of roadmap step 1.5: in a session whose host rewrites every command through `rtk` (an output filter that passes the wrapped command's exit code through), no verification run was recognised, so the gate refused every honest turn and accepted none on evidence. The wrapped command is classified by exactly the rules an unwrapped one is. (c) The per-session `.recorded.json` fold is read-modify-write outside the atomic write; Stop events of one session arrive in sequence and these are telemetry counters for a later arming decision, so a lost increment under an unusual overlap is a revisit item before arming. (d) Splitting the classifier into its own PR, and moving detector G into a conditional chunk now, are both declined: the roadmap ships the three record-only reasons together, the raise_log names the chunk (about 13.3 KB) as the next move if G is armed or the bundle needs room, and every verdict change the classifier can cause is listed below.

**What the classifier changes, stated.** Exactly one thing: a line `exitMasking` flags, with a recorded exit code of 0 and no printed failure, load failure or empty suite, classifies `exit_masked` instead of `PASS_EVIDENCE_OK`. Both leave the turn unrefusable, so no turn verdict changes; the run is counted as a gap instead of a pass. Every other run — any nonzero recorded code, any unmasked line — classifies exactly as on origin/main. Separately, the `rtk` peel (point (b) above) moves `rtk`-wrapped runs from "no verification" to the ordinary rules, in both directions.

**Budget.** Measured by the gate's own build: 1,620,447 B with the change against 1,595,228 B on origin/main `4bb96fb2fb` (+25,219 B). The ceiling rises 1,595,300 → 1,620,607 B (measurement plus 160 B) with a `raise_log` entry that names the chunk alternative.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the code shown whose bytes it pays for — that should block the raise? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate beyond what is stated above? Is the ceiling raise sized to the measurement?
3. Does any new detector or reason refuse a turn, or change a verdict the hook returns, other than as stated above?

The LAST line of your reply must be exactly this shape, in plain text — no markdown, no bold, no heading, nothing after it — with all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
✅  hook bundle: 1620447 B / 1620607 B ceiling, 1 YAML reader(s) [yaml], 346 modules
origin/main 4bb96fb2fb: 1595228 B / 1595300 B ceiling
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..57e89feea2 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1620607,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -287,6 +287,15 @@
             "what_was_added": "The generation lock (`_lib/generation_lock.ts`) behind `state_io`, the language-mirror tool lock and the egress session table, replacing their stat-then-remove reclaim, which let two callers hold after a stale break or a release. Measured by this gate: 1,595,152 B with the change against 1,595,013 B on origin/main 24f323151a, +139 B; the old lock code that left `state_io` and the language mirror pays for most of the helper.",
             "why_it_could_not_be_avoided": "The change fitted under the old ceiling until its last two review rounds: a completion review measured `state_io`'s 5 s wait at 7.2-11.9 s, which needed a wall-clock deadline, and ratification round 16 asked that no attempt start after it, which needs a capped sleep and a check after it. Room was made first: the release wrapper and the try blocks around a release that cannot throw were removed, the pruner's lock cleanup became one acquire-and-release, and the wait loop was written in its shortest form. Sized to the measurement plus 148 B.",
             "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading."
+        },
+        {
+            "date": "2026-11-21",
+            "from": 1595300,
+            "to": 1620607,
+            "by": "agent, feat/done-claims-with-read-exit-codes (road-to-done-claims-with-read-exit-codes Phases 1, 3 and 4)",
+            "what_was_added": "Detector G of turn-end-gate (`_lib/coverage_claim.ts`, 6,901 B) with the live-surface reader it calls (`_lib/live_surfaces.ts`, 6,394 B; the cache writer and CLI stay in `derive_live_surfaces.ts`, outside the bundle), and the masked-exit-code classification in `_lib/verification_command.ts` / `_lib/verification_evidence.ts` with the record-only refusal plumbing in `_lib/turn_end_refusals.ts` and the hook. Measured by this gate: 1,620,447 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +25,219 B.",
+            "why_it_could_not_be_avoided": "Not unavoidable in the strict sense, and stated as such: a conditional chunk loaded only when the completion trigger matches could carry the detector body and the reader (about 13.3 KB) off the parse of every other hook event. It was not split here because detector G is record-only while its arming is measured (council D5-D7, 2026-11-21: all three new reasons record-only), and detector D takes the shared completion trigger from the same module, so the split needs its own loader, digest check, chunk ceiling and schema pin. If G is armed, or the next concern needs room, that chunk is the move. Room already made: the hook source sat at its line ceiling, so the detector body lives in its own module; the reader is shared with the `verify:surfaces` verb rather than written twice, and that verb's cache writer and CLI were split out of the bundled module (ratification round 1); rounds 1 to 18 also tightened the classifier and the reader, dropped reading an echoed status (D8) and limited masking to a recorded 0 (D9), for about 9.7 KB net. Sized to the measurement plus 160 B.",
+            "what_would_have_caught_it": "This gate, on the first full local CI mirror run of the branch; the per-step checks of the roadmap did not build the bundle."
         }
     ],
     "chunks": [
```

## New file: `src/scripts/_lib/coverage_claim.ts`

```ts
/**
 * Detector G of `turn-end-gate` — a completion claim wider than its evidence.
 *
 * It lives here rather than in the hook for the reason detector E does: the
 * hook sits at its source-size ceiling, and this module imports nothing from
 * it. The hook passes the two prose views in, so neither side imports the other.
 *
 * Two reasons share the one id, `coverage`, because both answer "is the claim
 * as wide as the evidence":
 *
 *   · `partial_ratio` — the reply claims done and reports `N of M` with N < M.
 *     The measured case: a book reported complete with about 165 of 405 pages
 *     covered.
 *   · `unlisted_surface` — the turn edited a runnable surface, ran nothing that
 *     drives it, and the reply claims done without saying what is not verified.
 *
 * It RECORDS and never refuses. A new detector owes pre-registered bars before
 * it can refuse a turn (`docs/contracts/turn-end-detector-demotion.md`), and a
 * ratio beside a claim is not always a claim about that ratio ("2 of 3 options"
 * in a reply that also says "fertig"). The arming decision reads a measurement
 * of how often it fires and on what.
 */
import * as path from 'node:path';

import { readText } from './bounded_read.js';
import { deriveLiveSurfaces, type LiveSurface } from './live_surfaces.js';
import { commandSegments } from './verification_command.js';
import { RECORDED_SUFFIX, type RefusalDetectorId } from './turn_end_refusals.js';

/**
 * A completion claim in the delivered reply. Deliberately narrow: the German and
 * English closings the corpus actually produced, anchored to a line so a mid-reply
 * "fertig" inside a sentence about something else does not fire.
 *
 * Measured shapes it must catch (round 7, § Phase 1): "Fertig, Matze." ·
 * "Damit ist alles erledigt." · "Aufgabe erledigt." · "der komplette Auftrag ist
 * durch".
 *
 * Shared with detector D, which is why it lives here: detector G uses the same
 * trigger and adds no completion keyword of its own, per the 2026-08-12 council
 * bound quoted on `NEGATED_CLAIM_RE`.
 */
export const COMPLETION_RE =
    /(^|\n)\s*(?:\*\*)?(?:fertig\b|damit ist alles erledigt|aufgabe erledigt|alles erledigt\b|komplett(?:er)? (?:auftrag|abgearbeitet)|der komplette auftrag ist durch|done[.!]|all done\b|task complete)/i;

/**
 * The line the claim was found on says the opposite of a claim.
 *
 * A line-anchored keyword cannot tell "Fertig." from "Fertig ist der Fix noch
 * nicht." — both open with the same token, and the second is exactly the honest
 * status report this gate exists to ENCOURAGE. Measured 2026-08-12: three of ten
 * realistic closings were refused, and all three were "not done yet" lines.
 *
 * This is a negation check on the SAME line, not another attempt to enumerate
 * completion phrasings. The council that reviewed this guard (anthropic +
 * openai, 2026-08-12) stated the bound plainly: a finite pattern cannot cover an
 * infinite false-positive set, so extending the keyword list again would repeat
 * the move that has already failed three times on the sibling git guard. What
 * makes a block defensible here is not the pattern — it is that the pattern only
 * fires as a TRIGGER to consult structured CI state (`ci.settled`), which is the
 * council's Tier-2 shape. This check removes the cases where the prose itself
 * already contradicts the trigger.
 */
export const NEGATED_CLAIM_RE =
    /\b(noch nicht|nicht fertig|nicht durch|wäre verfrüht|ist verfrüht|not yet|not done|isn'?t done|nein)\b/i;

/** The line `at` falls on — the scope a negation has to appear in to count. */
export function lineAround(prose: string, at: number): string {
    // A match anchored on `(^|\n)\s*` can start at a newline, or before a blank
    // line; its line is the one the first non-blank character is on.
    while (at < prose.length && /\s/.test(prose[at] as string)) at += 1;
    const start = prose.lastIndexOf('\n', at) + 1;
    const end = prose.indexOf('\n', at);
    return prose.slice(start, end === -1 ? prose.length : end);
}

/** Detectors that record a finding and never refuse the turn. */
export const RECORD_ONLY_DETECTORS: ReadonlySet<RefusalDetectorId> = new Set<RefusalDetectorId>([
    'coverage',
]);

export type CoverageCode = 'partial_ratio' | 'unlisted_surface';

/** The shape the gate collects. Kept structural so this module imports no hook. */
export interface CoverageFinding {
    detector: 'coverage';
    evidence: string;
    reason: string;
    code: CoverageCode;
}

/** A `Not verified:` / `Nicht verifiziert:` line — the reply's own list of what it did not check. */
const NOT_VERIFIED_RE = /^[ \t]*(?:[-*][ \t]+)?(?:\*\*)?(?:not verified|nicht verifiziert)(?:\*\*)?[ \t]*:/im;

/** `165 of 405`, `165 von 405`, `40/41`. */
const RATIO_RE = /\b(\d+)\s*(?:of|von|\/)\s*(\d+)\b/gi;

/**
 * The reply with code, quotes and tables removed but ratios kept.
 *
 * `visibleProse` in the hook also drops every path-shaped token, and `40/41`
 * is one, so the ratio has to be read off this narrower view.
 */
function ratioProse(fenceStripped: string): string {
    return fenceStripped
        .replace(/`[^`\n]*`/g, ' ')
        .replace(/^[ \t]*>.*$/gm, ' ')
        .replace(/^[ \t]*\|.*\|[ \t]*$/gm, ' ');
}

/** Offsets covered by a `Not verified:` line and the non-blank block it opens. */
function notVerifiedSpans(text: string): Array<[number, number]> {
    // Linear: block ends are found once, headings are walked in order, and spans in
    // one block merge, so many headings in one block cost one pass, not one each.
    const ends: number[] = [];
    for (const m of text.matchAll(/\n[ \t]*\n/g)) ends.push(m.index);
    const spans: Array<[number, number]> = [];
    let e = 0;
    const re = new RegExp(NOT_VERIFIED_RE.source, 'gim');
    for (const m of text.matchAll(re)) {
        const start = text.lastIndexOf('\n', m.index) + 1;
        while (e < ends.length && (ends[e] as number) < start) e += 1;
        const end = e < ends.length ? (ends[e] as number) : text.length;
        const last = spans[spans.length - 1];
        if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end);
        else spans.push([start, end]);
    }
    return spans;
}

/** Whether `at` falls in one of `spans` (sorted, disjoint). */
function inSpans(spans: ReadonlyArray<[number, number]>, at: number): boolean {
    let lo = 0;
    let hi = spans.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const [s, t] = spans[mid] as [number, number];
        if (at < s) hi = mid - 1;
        else if (at >= t) lo = mid + 1;
        else return true;
    }
    return false;
}

/** Whether the reply claims completion, on a line that does not negate it. */
export function completionClaimAt(visible: string): number | null {
    const m = COMPLETION_RE.exec(visible);
    if (m === null) return null;
    if (NEGATED_CLAIM_RE.test(lineAround(visible, m.index))) return null;
    return m.index;
}

/**
 * Reason `partial_ratio`: a completion claim and an `N of M` with N < M that
 * the reply did not list under what it has not verified.
 *
 * @param fenceStripped the reply with fenced blocks removed
 * @param visible       the hook's `visibleProse` of the same reply
 */
export function partialRatioIn(fenceStripped: string, visible: string): CoverageFinding | null {
    if (completionClaimAt(visible) === null) return null;
    const text = ratioProse(fenceStripped);
    const spans = notVerifiedSpans(text);
    // Each line's negation is decided once, not once per ratio on it.
    const negatedLine = new Map<number, boolean>();
    let lineStart = 0;
    let lineEnd = -1;
    for (const m of text.matchAll(RATIO_RE)) {
        const n = Number(m[1]);
        const total = Number(m[2]);
        if (!(n < total) || total === 0) continue;
        const at = m.index;
        if (inSpans(spans, at)) continue;
        if (at > lineEnd) {
            // Matches arrive in order, so the line bounds only move forward.
            lineStart = text.lastIndexOf('\n', at) + 1;
            const nl = text.indexOf('\n', at);
            lineEnd = nl === -1 ? text.length : nl;
        }
        let negated = negatedLine.get(lineStart);
        if (negated === undefined) {
            negated = NEGATED_CLAIM_RE.test(text.slice(lineStart, lineEnd));
            negatedLine.set(lineStart, negated);
        }
        if (negated) continue;
        return {
            detector: 'coverage',
            code: 'partial_ratio',
            evidence: lineAround(text, at).trim().slice(0, 120),
            reason:
                `partial_ratio: a completion claim beside ${m[0]} — report what is left, or ` +
                'list it under "Not verified:" (verify-completion-evidence)',
        };
    }
    return null;
}

export interface RecordedCounts {
    counts: Record<string, number>;
    codes: Record<string, number>;
    first_at: string;
    last_at: string;
}

/** The structural slice of a transcript tool call this detector reads. */
export interface CallLike {
    name: string;
    command?: string;
    path?: string;
}

const EDIT_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** A documentation file: by extension, or anywhere under a `docs/` directory. */
const DOC_PATH = /(?:\.(?:md|mdx|markdown|txt|rst|adoc)$)|(?:(?:^|\/)docs\/)/i;

/** Surfaces a render or browser run reaches without naming them: a web page. */
const BROWSER_KINDS: ReadonlySet<LiveSurface['kind']> = new Set(['npm-script', 'playwright']);

/** The config path a `playwright test` run names (`--config X`, `-c X`, quoted or not); null when none. */
function playwrightConfig(command: string): string | null {
    const m = /\s(?:--config(?:=|\s+)|-c\s+)("[^"]+"|'[^']+'|\S+)/.exec(command);
    return m ? (m[1] as string).replace(/^["']|["']$/g, '') : null;
}

/** `start` run as one of the line's commands, not merely mentioned in one. */
function runsCommand(segs: readonly string[], start: string): boolean {
    return segs.some((x) => x === start || x.startsWith(`${start} `));
}

/** A segment that runs `playwright test` or `agent-config ui:render`, behind an env prefix or a runner. */
const PLAYWRIGHT_RUN = /^(?:\w+=\S*\s+)*(?:(?:npx|bunx|pnpm(?:\s+exec)?|yarn)\s+)?playwright\s+test\b/;
const HTTP_CLIENT = /^(?:\w+=\S*\s+)*(?:curl|wget|http|https|xh|hurl)\b/;
const RENDER_RUN = /^(?:\w+=\S*\s+)*(?:(?:npx|bunx|pnpm(?:\s+exec)?|yarn)\s+)?(?:\S*\/)?agent-config\s+ui:render\b/;

/**
 * A call that drove `surface`: its start command, its URL, or a render or browser
 * run over a web page. A `playwright test` run that names another config does not
 * drive a surface derived from this one.
 */
function drives(segs: readonly string[], surface: LiveSurface, root: string): boolean {
    const playwrightRuns = segs.filter((x) => PLAYWRIGHT_RUN.test(x));
    if (surface.kind === 'playwright' && playwrightRuns.length > 0) {
        const config = surface.derived_from.replace(/:\d+$/, '');
        return playwrightRuns.some((run) => {
            const named = playwrightConfig(run);
            return named === null || path.relative(root, path.resolve(root, named)).split(path.sep).join('/') === config;
        });
    }
    // A playwright run credits an npm surface only through this repo's own root config
    // (its webServer); a run naming another app's config does not.
    const servedBy = surface.webServerOf ?? [];
    if (surface.kind === 'npm-script' && servedBy.length > 0 && playwrightRuns.length > 0) {
        // Credit only through a config whose webServer starts this script: the one a run names,
        // or, with none named, any root config.
        const own = playwrightRuns.some((run) => {
            const named = playwrightConfig(run);
            if (named === null) return true;
            return servedBy.includes(path.relative(root, path.resolve(root, named)).split(path.sep).join('/'));
        });
        if (own) return true;
    }
    if (BROWSER_KINDS.has(surface.kind) && segs.some((x) => RENDER_RUN.test(x))) return true;
    if (surface.start !== null && runsCommand(segs, surface.start)) return true;
    // A URL counts as a whole host:port.
    if (surface.url === undefined) return false;
    const escaped = surface.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Only a request actually made — an HTTP client or a render — whose target argument IS the
    // URL, not one that merely contains it (`?next=http://localhost:3000`).
    const url = new RegExp(`^${escaped}(?![\\w])`);
    return segs.some(
        (x) => (HTTP_CLIENT.test(x) || RENDER_RUN.test(x)) && x.split(/\s+/).some((w) => url.test(w.replace(/^["']/, ''))),
    );
}

/**
 * Reason `unlisted_surface`: a completion claim, a turn that edited a file
 * under a derived surface's root, no call that drove that surface, and no
 * `Not verified:` block naming it.
 *
 * The map is derived in memory (`deriveLiveSurfaces`), never written from the
 * Stop path: the gate runs in consumer repos, and a turn-end hook that drops a
 * file into one is a side effect nobody asked for.
 */
export function unlistedSurfaceIn(
    fenceStripped: string,
    visible: string,
    calls: readonly CallLike[],
    workspaceRoot: string,
    given?: readonly LiveSurface[],
): CoverageFinding | null {
    // The cheap checks first: most turn ends claim nothing or edit nothing, and
    // those never read the repo.
    if (completionClaimAt(visible) === null) return null;
    // Documentation is not part of what a surface runs.
    const edits = calls
        .filter((c) => EDIT_TOOLS.has(c.name) && c.path !== undefined)
        .map((c) => c.path as string)
        .filter((p) => !DOC_PATH.test(p.split(path.sep).join('/')));
    if (edits.length === 0) return null;
    const surfaces = given ?? deriveLiveSurfaces(workspaceRoot);
    if (surfaces.length === 0) return null;
    // Each command split once, not once per surface.
    const commands = calls
        .map((c) => c.command ?? '')
        .filter((c) => c !== '')
        .map((c) => commandSegments(c).map((x) => x.trim()));
    // Inline code kept (backticks dropped): a list entry is often `npm run dev`.
    const text = fenceStripped.replace(/`/g, ' ');
    const listed = notVerifiedSpans(text).map(([s, e]) => text.slice(s, e)).join('\n');
    for (const surface of surfaces) {
        const root = path.resolve(workspaceRoot, surface.root);
        const edited = edits.find((p) => {
            const rel = path.relative(root, path.resolve(workspaceRoot, p));
            return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
        });
        if (edited === undefined) continue;
        if (commands.some((c) => drives(c, surface, workspaceRoot))) continue;
        const names = [surface.name, surface.start, surface.url].filter((x): x is string => typeof x === 'string');
        if (names.some((n) => namedIn(listed, n))) continue;
        return {
            detector: 'coverage',
            code: 'unlisted_surface',
            evidence: `${path.relative(workspaceRoot, edited)} under ${surface.kind} ${surface.name}`,
            reason:
                `unlisted_surface: a completion claim over ${surface.kind} "${surface.name}" ` +
                `(${surface.start ?? 'no start command'}), which nothing in the turn drove — drive it, ` +
                'or list it under "Not verified:" (verify-completion-evidence)',
        };
    }
    return null;
}

/** `name` as a whole word of `text`: `dev` is named by "dev (npm run dev)", not by "development". */
function namedIn(text: string, name: string): boolean {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^\\w-])${escaped}(?:$|[^\\w-])`, 'i').test(text);
}

/** Both reasons, ratio first: the hook's one entry point for detector G. */
export function coverageGapIn(
    fenceStripped: string,
    visible: string,
    calls: readonly CallLike[],
    workspaceRoot: string | undefined,
): CoverageFinding | null {
    const ratio = partialRatioIn(fenceStripped, visible);
    if (ratio !== null || workspaceRoot === undefined) return ratio;
    try {
        return unlistedSurfaceIn(fenceStripped, visible, calls, workspaceRoot);
    } catch {
        // A surface read that fails is no finding; this detector never decides a turn.
        return null;
    }
}

/** Fold record-only findings into a session's counters. Pure. */
export function foldRecorded(
    prev: RecordedCounts | null,
    findings: ReadonlyArray<{ detector: string; code?: string }>,
    at: string,
): RecordedCounts {
    const counts = { ...(prev?.counts ?? {}) };
    const codes = { ...(prev?.codes ?? {}) };
    for (const f of findings) {
        counts[f.detector] = (counts[f.detector] ?? 0) + 1;
        if (f.code !== undefined) codes[f.code] = (codes[f.code] ?? 0) + 1;
    }
    return { counts, codes, first_at: prev?.first_at ?? at, last_at: at };
}

/** The entries of `v` that are non-negative safe integers; anything else is dropped. */
function countsOnly(v: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
        if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) out[k] = n;
    }
    return out;
}

/** Read a session's record-only counters; anything unreadable starts fresh. */
export function readRecorded(file: string): RecordedCounts | null {
    try {
        // Bounded, non-blocking, regular files only: a FIFO here must not stall the Stop hook.
        const raw = readText(file);
        if (raw === null) return null;
        const o = JSON.parse(raw) as Partial<RecordedCounts>;
        if (typeof o.counts !== 'object' || o.counts === null) return null;
        return {
            counts: countsOnly(o.counts),
            codes: countsOnly(o.codes),
            first_at: typeof o.first_at === 'string' ? o.first_at : '',
            last_at: typeof o.last_at === 'string' ? o.last_at : '',
        };
    } catch {
        return null;
    }
}

export function recordedFile(stateDir: string, sessionKey: string): string {
    // Only a derived key (`deriveSessionKey`: 32 hex characters) names a counter file.
    if (!/^[0-9a-f]{32}$/.test(sessionKey)) throw new Error('recordedFile: not a derived session key');
    return path.join(stateDir, `${sessionKey}${RECORDED_SUFFIX}`);
}
```

## New file: `src/scripts/_lib/live_surfaces.ts`

```ts
/**
 * The reachability map's reader: every surface a repo can run, derived from its
 * files. See `derive_live_surfaces.ts` for why the list is derived and never
 * hand-kept.
 *
 * Split from that CLI so detector G (`_lib/coverage_claim.ts`) carries only the
 * read into the hook dispatch bundle, and not the cache writer or the CLI.
 *
 * Read: `package.json` scripts `dev|start|preview|serve`, `tauri.conf.json`
 * windows (repo root or `src-tauri/`), `playwright.config.*` `baseURL`,
 * `docker-compose*.yml` / `compose*.yml` service ports, and Taskfile tasks
 * `dev|run|serve`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { readText } from './bounded_read.js';

export { readText } from './bounded_read.js';

export const LIVE_SURFACES_REL = path.join('agents', 'state', 'live-surfaces.json');

export type SurfaceKind = 'npm-script' | 'tauri' | 'playwright' | 'compose' | 'taskfile';

export interface LiveSurface {
    kind: SurfaceKind;
    name: string;
    /** The command that starts it, as the repo spells it. */
    start: string | null;
    url?: string;
    /** `WIDTHxHEIGHT` for a desktop window. */
    size?: string;
    /** Directory, relative to the root, whose files this surface runs. */
    root: string;
    /** `file:line` the entry was read from. */
    derived_from: string;
    /** npm-script only: the root playwright configs (repo-relative) whose `webServer` starts this script. */
    webServerOf?: string[];
}

export interface LiveSurfaceMap {
    generated_at: string;
    inputs: string[];
    surfaces: LiveSurface[];
}

const NPM_SURFACE_SCRIPTS: readonly string[] = ['dev', 'start', 'preview', 'serve'];
const TASK_SURFACE_NAMES: ReadonlySet<string> = new Set(['dev', 'run', 'serve']);

/** 1-based line of the first line matching `re`, or 1. */
function lineOf(text: string, re: RegExp): number {
    const idx = text.split('\n').findIndex((l) => re.test(l));
    return idx === -1 ? 1 : idx + 1;
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compose files read per derivation; with the per-file bound this caps the whole read. */
const MAX_COMPOSE_FILES = 8;
/** Directory entries looked at when finding compose files. */
const MAX_DIR_ENTRIES = 4096;
/**
 * `//` and `/* *\/` comments removed in one linear pass that skips string literals,
 * so neither a comment opener inside a string nor an unclosed one costs a rescan.
 */
function stripJsComments(text: string): string {
    let out = '';
    let i = 0;
    let quote: string | null = null;
    while (i < text.length) {
        const c = text[i] as string;
        if (quote !== null) {
            out += c;
            if (c === '\\' && i + 1 < text.length) {
                out += text[i + 1];
                i += 2;
                continue;
            }
            if (c === quote) quote = null;
            i += 1;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            quote = c;
            out += c;
            i += 1;
            continue;
        }
        if (c === '/' && text[i + 1] === '/') {
            const nl = text.indexOf('\n', i);
            i = nl === -1 ? text.length : nl;
            continue;
        }
        if (c === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end === -1 ? text.length : end + 2;
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

/** `text` with every string literal's contents replaced by spaces; quotes and length kept. */
function maskStringInteriors(text: string): string {
    let out = '';
    let quote: string | null = null;
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i] as string;
        if (quote === null) {
            if (c === '"' || c === "'" || c === '`') quote = c;
            out += c;
            continue;
        }
        if (c === '\\' && i + 1 < text.length) {
            out += '  ';
            i += 1;
            continue;
        }
        if (c === quote) {
            quote = null;
            out += c;
            continue;
        }
        out += c === '\n' ? '\n' : ' ';
    }
    return out;
}

/** Surfaces per derivation, enforced while building as well as at the end. */
const MAX_SURFACES = 64;

export function rel(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}

function npmScripts(root: string, inputs: string[]): { surfaces: LiveSurface[]; scripts: Record<string, string> } {
    const file = path.join(root, 'package.json');
    const text = readText(file, root);
    if (text === null) return { surfaces: [], scripts: {} };
    inputs.push(file);
    let scripts: Record<string, string> = {};
    try {
        const json = JSON.parse(text) as { scripts?: Record<string, string> };
        scripts = json.scripts ?? {};
    } catch {
        return { surfaces: [], scripts: {} };
    }
    const surfaces: LiveSurface[] = [];
    for (const name of NPM_SURFACE_SCRIPTS) {
        if (typeof scripts[name] !== 'string') continue;
        surfaces.push({
            kind: 'npm-script',
            name,
            start: `npm run ${name}`,
            root: '.',
            derived_from: `package.json:${String(lineOf(text, new RegExp(`"${escapeRe(name)}"\\s*:`)))}`,
        });
    }
    return { surfaces, scripts };
}

function tauriWindows(root: string, scripts: Record<string, string>, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const candidate of ['tauri.conf.json', path.join('src-tauri', 'tauri.conf.json')]) {
        const file = path.join(root, candidate);
        const text = readText(file, root);
        if (text === null) continue;
        inputs.push(file);
        let conf: { app?: { windows?: unknown }; tauri?: { windows?: unknown }; build?: { devUrl?: unknown } };
        try {
            conf = JSON.parse(text) as typeof conf;
        } catch {
            continue;
        }
        if (typeof conf !== 'object' || conf === null || Array.isArray(conf)) continue;
        const windows = conf.app?.windows ?? conf.tauri?.windows;
        // Cut before building: a sub-1 MiB config can list hundreds of thousands of windows.
        const list = (Array.isArray(windows) && windows.length > 0 ? windows : [{}]).slice(0, MAX_SURFACES);
        const start = typeof scripts['tauri'] === 'string' ? 'npm run tauri dev' : 'npx tauri dev';
        // Each line once per file, not one full-file scan per window.
        const widthLine = lineOf(text, /"width"\s*:/);
        const windowsLine = lineOf(text, /"windows"\s*:/);
        list.forEach((w, i) => {
            const win = (typeof w === 'object' && w !== null ? w : {}) as Record<string, unknown>;
            const width = win['width'];
            const height = win['height'];
            const entry: LiveSurface = {
                kind: 'tauri',
                name: typeof win['title'] === 'string' ? win['title'] : `window ${String(i + 1)}`,
                start,
                root: '.',
                derived_from: `${rel(root, file)}:${String(typeof width === 'number' ? widthLine : windowsLine)}`,
            };
            if (typeof width === 'number' && typeof height === 'number') {
                entry.size = `${String(width)}x${String(height)}`;
            }
            if (typeof conf.build?.devUrl === 'string') entry.url = conf.build.devUrl;
            out.push(entry);
        });
    }
    return out;
}

function playwrightBaseUrls(root: string, inputs: string[], texts: Array<{ config: string; text: string }>): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const ext of ['ts', 'js', 'mjs', 'cjs', 'mts']) {
        const file = path.join(root, `playwright.config.${ext}`);
        const text = readText(file, root);
        if (text === null) continue;
        inputs.push(file);
        texts.push({ config: rel(root, file), text });
        const m = /baseURL\s*:\s*['"`]([^'"`]+)['"`]/.exec(text);
        if (m === null) continue;
        out.push({
            kind: 'playwright',
            name: 'baseURL',
            start: 'npx playwright test',
            url: m[1] as string,
            root: '.',
            derived_from: `${rel(root, file)}:${String(lineOf(text, /baseURL\s*:/))}`,
        });
    }
    return out;
}

function composePorts(root: string, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    let names: string[] = [];
    try {
        // A bounded directory walk: at most MAX_DIR_ENTRIES names are looked at.
        const dirHandle = fs.opendirSync(root);
        try {
            for (let i = 0; i < MAX_DIR_ENTRIES; i += 1) {
                const entry = dirHandle.readSync();
                if (entry === null) break;
                if (/^(docker-)?compose[\w.-]*\.ya?ml$/.test(entry.name)) names.push(entry.name);
            }
        } finally {
            dirHandle.closeSync();
        }
        names = names.sort().slice(0, MAX_COMPOSE_FILES);
    } catch {
        return out;
    }
    for (const name of names) {
        const file = path.join(root, name);
        const text = readText(file, root);
        if (text === null) continue;
        inputs.push(file);
        let doc: { services?: Record<string, { ports?: unknown }> };
        try {
            doc = (parseYaml(text) ?? {}) as typeof doc;
        } catch {
            continue;
        }
        // One pass over the file for every service's line, not one scan per service.
        const lineOfService = new Map<string, number>();
        text.split('\n').forEach((l, i) => {
            // A linear scan, no regex: an indented `key:` line.
            if (l === '' || (l[0] !== ' ' && l[0] !== '\t')) return;
            const colon = l.indexOf(':');
            if (colon < 0) return;
            const key = l.slice(0, colon).trim();
            if (key === '' || key.includes('#') || key.includes(' ')) return;
            if (!lineOfService.has(key)) lineOfService.set(key, i + 1);
        });
        for (const [service, spec] of Object.entries(doc.services ?? {})) {
            const ports = Array.isArray(spec?.ports) ? spec.ports : [];
            const line = lineOfService.get(service) ?? 1;
            for (const p of ports.slice(0, MAX_SURFACES)) {
                if (out.length >= MAX_SURFACES) break;
                const host = /^(?:[\d.]+:)?(\d+):\d+/.exec(String(p));
                if (host === null) continue;
                out.push({
                    kind: 'compose',
                    name: service,
                    start: `docker compose -f ${name} up ${service}`,
                    url: `http://localhost:${host[1] as string}`,
                    root: '.',
                    derived_from: `${name}:${String(line)}`,
                });
            }
        }
    }
    return out;
}

function taskfileTasks(root: string, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const name of ['Taskfile.yml', 'Taskfile.yaml']) {
        const file = path.join(root, name);
        const text = readText(file, root);
        if (text === null) continue;
        inputs.push(file);
        let doc: { tasks?: Record<string, unknown> };
        try {
            doc = (parseYaml(text) ?? {}) as typeof doc;
        } catch {
            continue;
        }
        for (const task of Object.keys(doc.tasks ?? {})) {
            if (!TASK_SURFACE_NAMES.has(task)) continue;
            out.push({
                kind: 'taskfile',
                name: task,
                start: `task ${task}`,
                root: '.',
                derived_from: `${name}:${String(lineOf(text, new RegExp(`^\\s+${escapeRe(task)}\\s*:`)))}`,
            });
        }
    }
    return out;
}

export function derive(root: string): { surfaces: LiveSurface[]; inputs: string[] } {
    const inputs: string[] = [];
    const playwrightTexts: Array<{ config: string; text: string }> = [];
    const npm = npmScripts(root, inputs);
    const surfaces = [
        ...npm.surfaces,
        ...tauriWindows(root, npm.scripts, inputs),
        ...playwrightBaseUrls(root, inputs, playwrightTexts),
        ...composePorts(root, inputs),
        ...taskfileTasks(root, inputs),
    ].slice(0, MAX_SURFACES);
    // The npm script a root playwright config starts as its webServer is driven by a playwright run.
    // The `command:` of each config's `webServer: { … }` entry, comments removed; any other
    // `command:` property (metadata, projects) does not start a server.
    const webServers = playwrightTexts.flatMap(({ config, text }) => {
        const code = stripJsComments(text);
        // Find the keys on a copy whose string interiors are blanked (same length), so a
        // `webServer: { command: … }` written inside a string literal is not a key.
        const masked = maskStringInteriors(code);
        const m = /webServer\s*:\s*\{([^{}]*)\}/.exec(masked);
        if (m === null) return [];
        const bodyAt = m.index + m[0].indexOf('{') + 1;
        const cmd = /command\s*:\s*(['"`])/.exec(m[1] as string);
        if (cmd === null) return [];
        const open = bodyAt + cmd.index + cmd[0].length;
        const close = code.indexOf(cmd[1] as string, open);
        return close < 0 ? [] : [{ config, command: code.slice(open, close).trim() }];
    });
    for (const s of surfaces) {
        if (s.kind !== 'npm-script') continue;
        const run = new RegExp(`(?:^|[;&|]\\s*)(?:npm run|pnpm(?: run)?|yarn|bun run) ${escapeRe(s.name)}(?:$|\\s)`);
        const of = webServers.filter((w) => run.test(w.command)).map((w) => w.config);
        if (of.length > 0) s.webServerOf = of;
    }
    return { surfaces, inputs };
}

/** Every runnable surface the repo at `root` declares. Pure read. */
export function deriveLiveSurfaces(root: string): LiveSurface[] {
    return derive(root).surfaces;
}
```

## Diff of the changed hook-path modules (origin/main...HEAD)

```diff
diff --git a/src/scripts/_lib/turn_end_refusals.ts b/src/scripts/_lib/turn_end_refusals.ts
index 430ba3dca8..a818b7fb42 100644
--- a/src/scripts/_lib/turn_end_refusals.ts
+++ b/src/scripts/_lib/turn_end_refusals.ts
@@ -49,9 +49,11 @@ import * as fs from 'node:fs';
 import * as path from 'node:path';
 
 import { read_lockfile } from './installed_lock.js';
+import { readText } from './bounded_read.js';
 
 /**
- * The six detectors, in the order the gate runs them.
+ * The seven detectors, in the order the gate runs them. G (`coverage`) records
+ * and never refuses, so its count here is a finding count, not a refusal one.
  *
  * The roadmap's § 0 names three (A promissory, B language, C verification).
  * That was true of the draft and is not true of the tree: detector D
@@ -81,6 +83,7 @@ export const DETECTOR_IDS = [
     'completion',
     'pending-decision',
     'untested',
+    'coverage',
 ] as const;
 
 export type RefusalDetectorId = (typeof DETECTOR_IDS)[number];
@@ -515,6 +518,23 @@ export const SHADOW_MAX_ROWS = 200;
  */
 export const SHADOW_SUFFIX = '.shadow.json';
 
+/**
+ * A record-only detector's per-session counters (`_lib/coverage_claim.ts`).
+ * Pure measurement like a shadow record, so it ages out the same way and is
+ * never read as a refusal.
+ */
+export const RECORDED_SUFFIX = '.recorded.json';
+
+/** The `last_at` of a record-only counter file, or null when it has none. */
+function recordedLastAt(raw: string): string | null {
+    try {
+        const o = JSON.parse(raw) as { last_at?: unknown };
+        return typeof o.last_at === 'string' ? o.last_at : null;
+    } catch {
+        return null;
+    }
+}
+
 export function sessionShadowFile(workspaceRoot: string, sessionKey: string): string {
     return path.join(refusalStateDir(workspaceRoot), `${sessionKey}${SHADOW_SUFFIX}`);
 }
@@ -716,15 +736,21 @@ export function pruneAgedRefusalState(
         // ends `.json`, and `parseRecord` rejects it for lacking `refused_at`.
         // Left to the branch below it would land in `kept` FOREVER — the
         // unbounded growth this pruner exists to stop, reintroduced by the
-        // instrument step 2.1 added. Its own clock is `last_at`.
-        if (name.endsWith(SHADOW_SUFFIX)) {
-            let shadow: ShadowRecord | null = null;
+        // instrument step 2.1 added. Its own clock is `last_at`. A record-only
+        // counter file has the same shape of clock and the same nothing to protect.
+        if (name.endsWith(SHADOW_SUFFIX) || name.endsWith(RECORDED_SUFFIX)) {
+            let lastAt: string | null = null;
             try {
-                shadow = parseShadowRecord(fs.readFileSync(file, 'utf-8'));
+                // The counter file is read bounded and non-blocking, as the hook reads it.
+                const raw = name.endsWith(RECORDED_SUFFIX) ? readText(file, dir) : fs.readFileSync(file, 'utf-8');
+                if (raw === null) throw new Error('unreadable counter');
+                lastAt = name.endsWith(RECORDED_SUFFIX)
+                    ? recordedLastAt(raw)
+                    : (parseShadowRecord(raw)?.last_at ?? null);
             } catch {
-                shadow = null;
+                lastAt = null;
             }
-            const shadowAt = shadow === null ? NaN : Date.parse(shadow.last_at);
+            const shadowAt = lastAt === null ? NaN : Date.parse(lastAt);
             // KEEP-ON-UNPARSEABLE IS NOT INHERITED, and the asymmetry with the
             // branch below is the point. A refusal record that will not parse
             // may still carry the wedge marker, so deleting it is the one
@@ -867,7 +893,7 @@ export function collectRefusalStats(workspaceRoot: string): RefusalStats {
         // here because relying on another function's strictness for a
         // correctness property is how the property disappears when that
         // function is loosened.
-        if (name.endsWith(SHADOW_SUFFIX)) continue;
+        if (name.endsWith(SHADOW_SUFFIX) || name.endsWith(RECORDED_SUFFIX)) continue;
         let rec: RefusalRecord | null = null;
         try {
             rec = parseRecord(fs.readFileSync(path.join(dir, name), 'utf-8'));
diff --git a/src/scripts/_lib/verification_command.ts b/src/scripts/_lib/verification_command.ts
index c0beb7f9a0..e01f585885 100644
--- a/src/scripts/_lib/verification_command.ts
+++ b/src/scripts/_lib/verification_command.ts
@@ -101,8 +101,15 @@ const DELEGATING_HEADS: ReadonlySet<string> = new Set([
     'sudo',
     'time',
     'command',
+    // `rtk` rewrites commands to filter their output and passes the wrapped
+    // command's exit code through; `rtk proxy` runs it unfiltered. Without
+    // these a run the operator really read classified as no verification.
+    'rtk',
 ]);
 
+/** A subcommand of `rtk` that delegates to the rest of the line unchanged. */
+const RTK_DELEGATING_SUBCOMMANDS: ReadonlySet<string> = new Set(['proxy']);
+
 /** A Maven / Gradle goal that runs the test phase, bare or task-path qualified. */
 const JVM_TEST_GOAL = /^(?:[\w.-]*:)*(test|verify|check)$/;
 
@@ -226,6 +233,34 @@ function failureIsDiscarded(seg: Segment): boolean {
     return false;
 }
 
+/** The segments of a command line that can run, as text: the commands it runs, not the words it mentions. */
+export function commandSegments(command: string): string[] {
+    if (!command) return [];
+    const out: string[] = [];
+    let before: Segment['nextSep'] = null;
+    let skipChain = false;
+    for (const seg of splitSegments(stripComment(command))) {
+        // Nothing after a lone `exit`/`return` that runs unconditionally is reached.
+        const h = bareName(seg.words[0] ?? '');
+        const lone = before !== '|' && seg.nextSep !== '|';
+        if ((h === 'exit' || h === 'return') && lone && (before === null || before === ';')) break;
+        // `false && …` never runs what follows it in the `&&` chain.
+        if (skipChain) {
+            if (seg.nextSep !== '&&') skipChain = false;
+            before = seg.nextSep;
+            continue;
+        }
+        if (h === 'false' && lone && seg.nextSep === '&&') {
+            skipChain = true;
+            before = seg.nextSep;
+            continue;
+        }
+        out.push(seg.words.join(' '));
+        before = seg.nextSep;
+    }
+    return out;
+}
+
 /**
  * The command's segments whose failure the shell does NOT discard, as text.
  *
@@ -244,8 +279,14 @@ export function undiscardedSegments(command: string): string[] {
 function segmentVerifies(rawWords: readonly string[]): boolean {
     const w = rawWords.filter((x) => x.length > 0);
     let idx = 0;
-    // Peel delegating prefixes: `npx vitest run`, `sudo make test`.
-    while (idx < w.length && DELEGATING_HEADS.has(bareName(w[idx] as string))) idx += 1;
+    // Peel delegating prefixes: `npx vitest run`, `sudo make test`, `rtk proxy tsc`.
+    while (idx < w.length && DELEGATING_HEADS.has(bareName(w[idx] as string))) {
+        const peeled = bareName(w[idx] as string);
+        idx += 1;
+        if (peeled === 'rtk' && idx < w.length && RTK_DELEGATING_SUBCOMMANDS.has(bareName(w[idx] as string))) {
+            idx += 1;
+        }
+    }
     if (idx >= w.length) return false;
 
     const head = bareName(w[idx] as string);
@@ -349,6 +390,159 @@ export function isVerificationCommand(command: string): boolean {
     return segments.some((seg) => !failureIsDiscarded(seg) && segmentVerifies(seg.words));
 }
 
+/** How a command line hides its verifier's exit code from the recorder. */
+export type ExitMasking = 'pipe' | 'trailing';
+
+/** `set -o pipefail`, `set -euo pipefail`, `set -e -o pipefail`. */
+const SETS_PIPEFAIL = /^set\s+(?:[-+][A-Za-z]+\s+)*-[A-Za-z]*o\s+pipefail\b/;
+/** `set +o pipefail` — turns it off again. */
+const UNSETS_PIPEFAIL = /^set\s+(?:[-+][A-Za-z]+\s+)*\+[A-Za-z]*o\s+pipefail\b/;
+
+/** One pipeline: its segments, the separator after it, and whether pipefail covers it. */
+interface Pipeline {
+    readonly segs: readonly Segment[];
+    readonly sepAfter: '&&' | '||' | ';' | null;
+    readonly pipefail: boolean;
+}
+
+function pipelinesOf(command: string): Pipeline[] {
+    const out: Pipeline[] = [];
+    let cur: Segment[] = [];
+    let pipefail = false;
+    let sepBefore: Pipeline['sepAfter'] = null;
+    for (const seg of splitSegments(stripComment(command))) {
+        cur.push(seg);
+        if (seg.nextSep === '|') continue;
+        out.push({ segs: cur, sepAfter: seg.nextSep as Pipeline['sepAfter'], pipefail });
+        // A `set` changes the line only when it runs for sure and in this shell:
+        // alone (a pipeline runs it in a subshell) and not behind `&&` / `||`.
+        if (cur.length === 1 && (sepBefore === null || sepBefore === ';')) {
+            const text = (cur[0] as Segment).words.join(' ');
+            if (SETS_PIPEFAIL.test(text)) pipefail = true;
+            if (UNSETS_PIPEFAIL.test(text)) pipefail = false;
+        }
+        sepBefore = seg.nextSep as Pipeline['sepAfter'];
+        cur = [];
+    }
+    return out;
+}
+
+/** Index, within its pipeline, of the verifying segment; -1 when none. */
+function verifierIndex(p: Pipeline): number {
+    for (let i = p.segs.length - 1; i >= 0; i -= 1) {
+        const seg = p.segs[i] as Segment;
+        if (!failureIsDiscarded(seg) && segmentVerifies(seg.words)) return i;
+    }
+    return -1;
+}
+
+function head(p: Pipeline | undefined): string {
+    return bareName(p?.segs[0]?.words[0] ?? '');
+}
+
+function argsOf(p: Pipeline | undefined): string {
+    return (p?.segs[0]?.words.slice(1) ?? []).join(' ');
+}
+
+
+/** `exit`/`return` of `PIPESTATUS[k]` right after a filtered pipeline: the verifier's code reaches the caller. */
+function exitsWithPipestatus(prev: Pipeline, next: Pipeline | undefined, k: number): boolean {
+    const h = head(next);
+    if (prev.sepAfter !== ';' || (h !== 'exit' && h !== 'return') || next?.segs.length !== 1) return false;
+    // The argument is the expansion itself, nothing around it.
+    const arg = argsOf(next).replace(/^"(.*)"$/, '$1');
+    return new RegExp(`^\\$\\{?PIPESTATUS\\[${String(k)}\\]\\}?$`).test(arg);
+}
+
+/**
+ * Follow the line after a pipeline whose status is the verifier's: does a
+ * failure still reach the recorded code? `&&` runs only on success, so a
+ * failure skips it (an `&& exit 0` too); `|| exit` / `|| exit N` with N nonzero modulo 256 end the shell with a failure;
+ * `|| false` keeps a failure until the next command; `; exit` / `; exit $?`
+ * pass the current status on. Anything else that runs after a failure replaces
+ * the code.
+ */
+function failureReachesRecord(ps: readonly Pipeline[], v: number): boolean {
+    for (let j = v + 1; j < ps.length; j += 1) {
+        const sep = (ps[j - 1] as Pipeline).sepAfter;
+        const h = head(ps[j]);
+        const arg = argsOf(ps[j]).replace(/^["']|["']$/g, '');
+        // `exit` inside a pipeline ends only its subshell.
+        const ends = (h === 'exit' || h === 'return') && (ps[j] as Pipeline).segs.length === 1;
+        // A failure skips an `&&` command, `exit` included, and reaches whatever follows.
+        if (sep === '&&') continue;
+        if (sep === '||') {
+            // `exit` alone keeps the failing status; a literal code keeps a failure
+            // only when it is nonzero modulo 256 (`exit 00`, `exit 256` end with 0);
+            // anything else (`exit "$code"`) is unknown and does not count.
+            if (ends) return arg === '' || arg === '$?' || (/^\d+$/.test(arg) && Number(arg) % 256 !== 0);
+            // `|| false` alone; `|| false | cat` ends on `cat`'s status.
+            if (h === 'false' && (ps[j] as Pipeline).segs.length === 1) continue;
+            return false;
+        }
+        return ends && (arg === '' || arg === '$?');
+    }
+    return true;
+}
+
+/** The pipelines up to and including the first lone `exit`/`return` that runs unconditionally. */
+function reachable(ps: readonly Pipeline[]): Pipeline[] {
+    for (let i = 0; i < ps.length; i += 1) {
+        const before = i === 0 ? ';' : (ps[i - 1] as Pipeline).sepAfter;
+        const h = head(ps[i]);
+        if (before === ';' && (h === 'exit' || h === 'return') && (ps[i] as Pipeline).segs.length === 1) return ps.slice(0, i + 1);
+    }
+    return [...ps];
+}
+
+/**
+ * Does the exit code of this command line belong to something other than the
+ * command that verified?
+ *
+ * The recorder keeps ONE exit code per call: the status of the last pipeline
+ * that ran. `tsc | tail -5` reports `tail`'s 0, and `task ci; echo "exit=$?"`
+ * reports `echo`'s 0, so a failing run reads as a pass. Read off the LAST
+ * pipeline that verifies:
+ *
+ * - `pipe`: its verifier is not the pipeline's last command and no earlier
+ *   `set -o pipefail` covers it, so the pipeline's status is a filter's —
+ *   unless the very next command exits with that verifier's `PIPESTATUS[k]`.
+ *   Printing `PIPESTATUS` does not count: the record holds the printer's code.
+ *   A pipefail from an rc file is invisible here, which is why the reason is
+ *   an instrument gap.
+ * - `trailing`: its status is the verifier's, and a later command runs
+ *   after a failure (after `;` or `||`) and replaces the code
+ *   (`failureReachesRecord`). `cmd || exit 1` and `cmd; exit $?` propagate;
+ *   `cmd || false; echo ready` does not; `cmd && echo ok` runs only on
+ *   success; `task sync; task ci` ends on a verifier whose code is real;
+ *   `cmd || true` is a discard, not a verifier.
+ */
+export function exitMasking(command: string): ExitMasking | null {
+    if (!command) return null;
+    const ps = reachable(pipelinesOf(command));
+    // From the last verifier back: a verifier reached only through `||` can be skipped
+    // by an earlier pipeline's 0, so that earlier verifier's reading counts too.
+    for (let v = ps.length - 1; v >= 0; v -= 1) {
+        if (verifierIndex(ps[v] as Pipeline) === -1) continue;
+        const m = maskingAt(ps, v);
+        if (m !== null) return m;
+        let skippable = false;
+        for (let j = v - 1; j >= 0; j -= 1) if ((ps[j] as Pipeline).sepAfter === '||') skippable = true;
+        if (!skippable) return null;
+    }
+    return null;
+}
+
+/** The masking reading of the line taking pipeline `v` as the verifier whose code is recorded. */
+function maskingAt(ps: readonly Pipeline[], v: number): ExitMasking | null {
+    const p = ps[v] as Pipeline;
+    const k = verifierIndex(p);
+    // An explicit `exit "${PIPESTATUS[k]}"` carries the verifier's code with or without pipefail.
+    if (k < p.segs.length - 1 && exitsWithPipestatus(p, ps[v + 1], k)) return null;
+    if (k < p.segs.length - 1 && !p.pipefail) return 'pipe';
+    return failureReachesRecord(ps, v) ? null : 'trailing';
+}
+
 /**
  * The RECORDER's net — deliberately wider than the predicate above, and not a
  * leftover of the two-regex era it replaces.
diff --git a/src/scripts/_lib/verification_evidence.ts b/src/scripts/_lib/verification_evidence.ts
index 383f66da39..f1f586a028 100644
--- a/src/scripts/_lib/verification_evidence.ts
+++ b/src/scripts/_lib/verification_evidence.ts
@@ -33,7 +33,7 @@
  * overrides it too).
  */
 
-import { isVerificationCommand, undiscardedSegments } from './verification_command.js';
+import { exitMasking, isVerificationCommand, undiscardedSegments } from './verification_command.js';
 
 
 export type InvalidRunReason =
@@ -43,7 +43,8 @@ export type InvalidRunReason =
     | 'unreadable_record'
     | 'not_a_verification_command'
     | 'exit_code_unavailable'
-    | 'timeout_or_killed';
+    | 'timeout_or_killed'
+    | 'exit_masked';
 
 export type VerificationVerdict =
     | { readonly kind: 'PASS_EVIDENCE_OK' }
@@ -82,6 +83,10 @@ export interface RunRecord {
 export const INSTRUMENT_GAP_REASONS: ReadonlySet<InvalidRunReason> = new Set<InvalidRunReason>([
     'exit_code_unavailable',
     'unreadable_record',
+    // A masked exit code is a gap in what the record can prove, and a
+    // `pipefail` set in an rc file is invisible on the command line. It
+    // records until road-to-done-claims-with-read-exit-codes Phase 5 arms it.
+    'exit_masked',
 ]);
 
 /** Whether this verdict leaves the turn unrefusable — a pass, or a gap in the instrument. */
@@ -115,17 +120,21 @@ const NON_VERIFYING_EXECUTABLES: ReadonlySet<string> = new Set([
 
 /** Wrappers that prefix a real command without being one. */
 const COMMAND_PREFIXES: ReadonlySet<string> = new Set([
-    'bunx', 'command', 'env', 'exec', 'nice', 'nohup', 'npx', 'sudo', 'time',
+    'bunx', 'command', 'env', 'exec', 'nice', 'nohup', 'npx', 'rtk', 'sudo', 'time',
 ]);
 
 /** The executable a single command segment actually runs, lower-cased and unpathed. */
 function leadingExecutable(segment: string): string | null {
+    let previous = '';
     for (const raw of segment.trim().split(/\s+/)) {
         if (raw === '') continue;
         if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(raw)) continue; // FOO=bar prefix
         const base = (raw.split('/').pop() ?? raw).replace(/\.exe$/i, '').toLowerCase();
         if (base === '') continue;
-        if (COMMAND_PREFIXES.has(base)) continue;
+        if (COMMAND_PREFIXES.has(base) || (previous === 'rtk' && base === 'proxy')) {
+            previous = base;
+            continue;
+        }
         return base;
     }
     return null;
@@ -357,6 +366,23 @@ export function classifyRun(record: unknown): VerificationVerdict {
         return { kind: 'INVALID_RUN', reason: 'exit_code_unavailable' };
     }
 
+    // A MASKED EXIT CODE belongs to `tail` or `echo`, not to the verifier, so
+    // it is not read — but only where the exit code would decide. A printed
+    // failure, a load failure and an empty suite are read off the output and
+    // keep their verdicts. No `exit=N` line in the output is read in its place
+    // (D8): where a status echo's output went cannot be established from the
+    // command text. And only a recorded 0 is replaced (D9): a nonzero code keeps
+    // the verdict it always had, so masking can turn a pass into a gap but never
+    // demote a refusal, whatever the shell actually ran.
+    const command = r.command;
+    const exitVerdict = (code: number): VerificationVerdict => {
+        // Parsed only on the one path that can use it: a recorded 0.
+        if (code === 0 && exitMasking(command) !== null) return { kind: 'INVALID_RUN', reason: 'exit_masked' };
+        return code === 0
+            ? { kind: 'PASS_EVIDENCE_OK' }
+            : { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
+    };
+
     // A LOAD FAILURE, and only where it is not contradicted by a clean summary.
     // The patterns are broad on purpose — `fatal error`, `cannot find module` —
     // and a passing run that merely PRINTS one is common: vitest echoes a
@@ -381,16 +407,10 @@ export function classifyRun(record: unknown): VerificationVerdict {
         if (summary.total !== null && summary.total > 0 && summary.passed === 0) {
             return { kind: 'INVALID_RUN', reason: 'zero_tests_discovered' };
         }
-        if (r.exit_code !== 0) {
-            return { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
-        }
-        return { kind: 'PASS_EVIDENCE_OK' };
+        return exitVerdict(r.exit_code);
     }
 
-    if (r.exit_code !== 0) {
-        return { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
-    }
-    return { kind: 'PASS_EVIDENCE_OK' };
+    return exitVerdict(r.exit_code);
 }
 
 /**
@@ -633,9 +653,15 @@ export function describeRecordFinding(
             + 'the last edit' + tail
         );
     }
+    const masked = reasons.includes('exit_masked')
+        ? ' — a masked exit code is the exit code of `tail` or `echo`, not of the '
+          + 'verifier: re-run with `set -o pipefail;` in front, or use the '
+          + "runner's own filter flag instead of a pipe"
+        : '';
     return (
         'this turn changed a file and no recorded run after the last edit proves '
         + `anything — the runs seen classify as ${[...new Set(reasons)].join(', ')}`
+        + masked
         + tail
     );
 }
diff --git a/src/scripts/hooks/turn_end_gate_hook.ts b/src/scripts/hooks/turn_end_gate_hook.ts
index cb948cdbcb..246a5335b7 100644
--- a/src/scripts/hooks/turn_end_gate_hook.ts
+++ b/src/scripts/hooks/turn_end_gate_hook.ts
@@ -9,7 +9,7 @@
  * is deliberately not another reminder. It is a check at the point of
  * delivery that can say no.
  *
- * SIX detectors ride on one guard, because building the unsafe part twice
+ * SEVEN detectors ride on one guard, because building the unsafe part twice
  * is how a second detector becomes a second outage:
  *
  *   A — promissory closing  (`promissory`, FC-5, 20 measured occurrences)
@@ -33,6 +33,8 @@
  *   F — untested change     (`untested`; the turn changed production code,
  *                            touched no test, and claimed done —
  *                            `detectUntestedChange`.)
+ *   G — coverage gap        (`coverage`; a done claim wider than its evidence,
+ *                            `detectCoverageGap`; RECORDS, never refuses.)
  *
  * The SVG render obligation (`openSvgObligation`) also runs in that list but
  * reports under C's id, `verification`, so it is not a seventh detector.
@@ -210,6 +212,16 @@ import { type GraphState, graphState } from '../code_graph/detect.js';
 import { isVerificationAttempt, isVerificationCommand } from '../_lib/verification_command.js';
 import { isTestPath as _isTestPath } from '../_lib/test_path.js';
 import { openSvgObligation } from './svg_obligation.js';
+import {
+    COMPLETION_RE,
+    NEGATED_CLAIM_RE,
+    RECORD_ONLY_DETECTORS,
+    foldRecorded,
+    lineAround,
+    coverageGapIn,
+    readRecorded,
+    recordedFile,
+} from '../_lib/coverage_claim.js';
 // Round 8 — the record path detector C prefers over its own regex. The regex
 // reads a command's TEXT and `echo test` matches it; these read what the run
 // exited with and what it printed.
@@ -265,7 +277,8 @@ export type DetectorId =
     | 'verification'
     | 'completion'
     | 'pending-decision'
-    | 'untested';
+    | 'untested'
+    | 'coverage';
 
 export interface Finding {
     detector: DetectorId;
@@ -284,6 +297,8 @@ export interface Finding {
      * corpus reading stays reproducible after the record path landed.
      */
     mode?: 'record' | 'transcript';
+    /** The reason code, where one detector carries several (G: `partial_ratio`). */
+    code?: string;
 }
 
 // ---------------------------------------------------------------------------
@@ -545,46 +560,6 @@ export function readCiSettled(
 }
 
 
-/**
- * A completion claim in the delivered reply. Deliberately narrow: the German and
- * English closings the corpus actually produced, anchored to a line so a mid-reply
- * "fertig" inside a sentence about something else does not fire.
- *
- * Measured shapes it must catch (round 7, § Phase 1): "Fertig, Matze." ·
- * "Damit ist alles erledigt." · "Aufgabe erledigt." · "der komplette Auftrag ist
- * durch".
- */
-const _COMPLETION_RE =
-    /(^|\n)\s*(?:\*\*)?(?:fertig\b|damit ist alles erledigt|aufgabe erledigt|alles erledigt\b|komplett(?:er)? (?:auftrag|abgearbeitet)|der komplette auftrag ist durch|done[.!]|all done\b|task complete)/i;
-
-/**
- * The line the claim was found on says the opposite of a claim.
- *
- * A line-anchored keyword cannot tell "Fertig." from "Fertig ist der Fix noch
- * nicht." — both open with the same token, and the second is exactly the honest
- * status report this gate exists to ENCOURAGE. Measured 2026-08-12: three of ten
- * realistic closings were refused, and all three were "not done yet" lines.
- *
- * This is a negation check on the SAME line, not another attempt to enumerate
- * completion phrasings. The council that reviewed this guard (anthropic +
- * openai, 2026-08-12) stated the bound plainly: a finite pattern cannot cover an
- * infinite false-positive set, so extending the keyword list again would repeat
- * the move that has already failed three times on the sibling git guard. What
- * makes a block defensible here is not the pattern — it is that the pattern only
- * fires as a TRIGGER to consult structured CI state (`ci.settled`), which is the
- * council's Tier-2 shape. This check removes the cases where the prose itself
- * already contradicts the trigger.
- */
-const _NEGATED_CLAIM_RE =
-    /\b(noch nicht|nicht fertig|nicht durch|wäre verfrüht|ist verfrüht|not yet|not done|isn'?t done|nein)\b/i;
-
-/** The line `at` falls on — the scope a negation has to appear in to count. */
-function _lineAround(prose: string, at: number): string {
-    const start = prose.lastIndexOf('\n', at) + 1;
-    const end = prose.indexOf('\n', at);
-    return prose.slice(start, end === -1 ? prose.length : end);
-}
-
 export function detectCompletionClaim(
     reply: string,
     ci: { seen: boolean; settled: boolean },
@@ -592,12 +567,12 @@ export function detectCompletionClaim(
     // A session that never read CI has nothing to be premature about.
     if (!ci.seen || ci.settled) return null;
     const prose = visibleProse(reply);
-    const m = _COMPLETION_RE.exec(prose);
+    const m = COMPLETION_RE.exec(prose);
     if (!m) return null;
     const at = m.index;
     // The trigger fired, but the line it fired on negates it — a status report,
     // not a claim. Refusing these punishes exactly the honesty the gate wants.
-    if (_NEGATED_CLAIM_RE.test(_lineAround(prose, at))) return null;
+    if (NEGATED_CLAIM_RE.test(lineAround(prose, at))) return null;
     return {
         detector: 'completion',
         evidence: prose.slice(at, at + 120).trim(),
@@ -607,6 +582,16 @@ export function detectCompletionClaim(
     };
 }
 
+/** Detector G — see `_lib/coverage_claim.ts`. Records only. */
+export function detectCoverageGap(reply: string, calls: readonly ToolCall[] = [], root?: string): Finding | null {
+    return coverageGapIn(stripFencedBlocks(reply), visibleProse(reply), calls, root);
+}
+
+/** The findings that refuse the turn; a record-only detector's are counted instead. */
+export function refusingFindings(findings: readonly Finding[]): Finding[] {
+    return findings.filter((f) => !RECORD_ONLY_DETECTORS.has(f.detector));
+}
+
 /**
  * Read the pin the language-mirror hook wrote. Absent ⇒ no obligation.
  *
@@ -902,9 +887,9 @@ export function detectUntestedChange(
     // "done" — two lists of completion phrasings would drift, and the negation
     // check is what keeps an honest "noch nicht fertig" from being refused.
     const prose = visibleProse(reply);
-    const m = _COMPLETION_RE.exec(prose);
+    const m = COMPLETION_RE.exec(prose);
     if (!m) return null;
-    if (_NEGATED_CLAIM_RE.test(_lineAround(prose, m.index))) return null;
+    if (NEGATED_CLAIM_RE.test(lineAround(prose, m.index))) return null;
 
     const shown = source.slice(0, 3).join(', ');
     if (noRedEvidence) {
@@ -1016,6 +1001,19 @@ export function alreadyRefusedTurn(
  * into one is what step 1.1 forbids in the reader — doing it in the writer would
  * put the same defect somewhere the reader cannot fix.
  */
+/** Count a record-only detector's findings beside the refusal record; never a verdict. */
+function markRecordOnly(workspaceRoot: string, sessionKey: string, findings: readonly Finding[]): void {
+    const recorded = findings.filter((f) => RECORD_ONLY_DETECTORS.has(f.detector));
+    if (recorded.length === 0 || is_replay_mode()) return;
+    try {
+        const file = recordedFile(path.dirname(sessionStateFile(workspaceRoot, sessionKey)), sessionKey);
+        const next = foldRecorded(readRecorded(file), recorded, new Date().toISOString());
+        atomic_write_json(file, next as unknown as Record<string, unknown>);
+    } catch {
+        // An instrument is never a reason to change what the gate does.
+    }
+}
+
 function markRefusedTurn(
     workspaceRoot: string,
     sessionKey: string,
@@ -1279,6 +1277,8 @@ function runDetectors(inputs: DetectorInputs): Finding[] {
         // opposite trigger, opposite treatment of `dispatchOpen`.
         openSvgObligation(workspaceRoot, toolCalls, runState?.asset_renders ?? null),
         dispatchOpen ? null : detectUntestedChange(lastAssistant, toolCalls, runState),
+        // G is a completion claim too, so an open dispatch excuses it like D.
+        dispatchOpen ? null : detectCoverageGap(lastAssistant, toolCalls, workspaceRoot),
     ]) {
         if (f) findings.push(f);
     }
@@ -1376,7 +1376,7 @@ function recordShadow(inputs: DetectorInputs, layer: ShadowLayer): void {
         atomic_write_json(
             file,
             foldShadow(prev, {
-                detectors: findings.map((f) => f.detector),
+                detectors: refusingFindings(findings).map((f) => f.detector),
                 turnOrdinal: inputs.turnOrdinal,
                 at: new Date().toISOString(),
                 layer,
@@ -1443,17 +1443,19 @@ export function main(): number {
     // turn the gate allows and a turn it refuses are both in the record — a
     // recall reading needs the allowed turns as its negative arm.
     recordGraphFeeder(inputs, findings, 'live');
-    if (findings.length === 0) return EXIT_ALLOW;
+    markRecordOnly(inputs.workspaceRoot, inputs.sessionKey, findings);
+    const refusing = refusingFindings(findings);
+    if (refusing.length === 0) return EXIT_ALLOW;
 
     markRefusedTurn(
         inputs.workspaceRoot,
         inputs.sessionKey,
         inputs.turnOrdinal,
-        findings.map((f) => f.detector),
+        refusing.map((f) => f.detector),
         inputs.promptId,
     );
 
-    const lines = findings.map(
+    const lines = refusing.map(
         (f) => `  · ${f.detector}: ${f.reason}\n    evidence: ${JSON.stringify(f.evidence)}`,
     );
     process.stderr.write(
```
