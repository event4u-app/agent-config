<!-- evidence-type: analysis -->

# Ratification review — the dispatch bundle ceiling for the exit-code classifier — round 33

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose byte ceiling for the hook dispatch bundle (`dist/hooks/dispatch.js`, loaded by every hook event) is raised. ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it.

subject: 891c74c262db4d21ccaf0a04e8ee79d73a0853128d0775b62466a935cc495418

(The digest covers the gated file at commit `2fff9484f0` on branch `feat/done-claims-with-read-exit-codes`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## Scope of this round

This round's raise pays for less code than rounds 1-23 (rounds 24-32 were on this scope). After 23 rounds without a two-seat verdict, a council strategy round (2026-11-21) recommended reviewing the classifier on its own scope; roadmap decision D11 took detector G's repository-reading reason (`unlisted_surface`) and the live-surface reader off the live hook path. They now live in `_lib/unlisted_surface.ts` and `_lib/live_surfaces.ts`, which the dispatch bundle does not carry, and return later in a chunk loaded only on a completion claim, with its own ceiling and its own ratification. They are not shown and not under review here. Checked in the built bundle, not assumed: `grep -c` over `dist/hooks/dispatch.js` for `unlistedSurfaceIn`, `deriveLiveSurfaces`, `shellWords`, `playwrightBaseUrls` and `MAX_COMPOSE_FILES` returns 0 (the hook's exported test helper `detectCoverageGap` that imports `unlisted_surface.ts` is unused on the live path and dropped by the bundler). The raise falls from +27,499 B to +14,137 B.

## The change, as bundled

1. **Masked exit codes.** `_lib/verification_command.ts` walks the line's pipelines once (`flowOf`), tracking every shell state that can reach each: the current status (0 / nonzero), the outcome of the last verifier that ran (none / pass / fail), whether that verifier's pipeline reports a filter's status, and whether the shell ended — at most 24 distinct states, so the walk is linear. `;` always runs the next pipeline, `&&` only on 0, `||` only on nonzero; a lone `exit` — the word itself, not a path such as `/x/exit` — ends the shell with the status its argument gives (the argument read without its redirections, attached or spaced; digits right before `<`/`>` name a file descriptor, as in Bash); with a redirection, which can fail and stop `exit` from running, the line may also go on with a nonzero status (`$?`/no argument keeps the status, a literal, signed or not and of any size, gives `n mod 256` (computed exactly), anything else — `exit "${PIPESTATUS[k]}"` included — is unknown); inside a pipeline it is an ordinary command, and so is a `return` (at the top level of a Bash call it errors and the line goes on — round 24). One status rule covers every pipeline: without pipefail its status is its last command's; under pipefail any failing member fails it and it passes only when every member does; the bare words `true`/`:` pass and `false` fails (a path such as `/x/true`, or any segment with a redirection, which can fail on the redirection, is any other command), a verifier passes or fails, any other command may do either; a lone plain `set` the walk reads succeeds. pipefail and errexit are read from a plain `set` (`-e`, `-o errexit`, `-o pipefail`, `+` forms, clusters such as `-euo pipefail`) that is alone and unconditional; after any other segment with a `set` or `shopt` word (including one that only prints the words) both are unknown, and the walk follows both settings. Under errexit a failing pipeline that closes its list (`;` or the end) ends the shell; one inside an `&&`/`||` list does not. `exitMasking()` asks one exact question: **can the line end with a 0 while the last verifier that ran did not pass (or none ran)?** If yes, a recorded 0 proves nothing — `pipe` when on such a path the last verifier sat in a filtered pipeline, else `trailing`. `cmd || true` is NOT a masking case: it is the existing discard, `not_a_verification_command` before and after. `_lib/verification_evidence.ts` `classifyRun()` consults masking ONLY where the exit code would decide — after printed failures, load failures and empty suites — and ONLY when the recorded exit code is 0 (D9): then it returns `exit_masked`, an instrument-gap reason that never refuses a turn. No line of output is ever read as the verifier's status (D8). An `rtk` wrapper is peeled so `rtk vitest run` is still recognised as a verifier.
2. **Detector G, `partial_ratio` only.** `_lib/coverage_claim.ts` `partialRatioIn`: a reply that claims done and reports `N of M` with N < M outside a `Not verified:` block and not on a negated line. It RECORDS into per-session counters (`<key>.recorded.json`) and never refuses; `refusingFindings` drops it from the verdict. Regex over the reply only — no repository read, no tool calls.
3. **Detector G's completion trigger.** `completionClaimAt` (in `_lib/coverage_claim.ts`) returns the first line-anchored completion match whose own line is not negated; the indentation it allows after a newline is any whitespace except a line break, and each phrase that ends in a word ends in `\b`. It is read only by G's record-only `partial_ratio`. **Detectors D and F are unchanged from origin/main** (round 31): they keep the hook's own `_COMPLETION_RE`, `_NEGATED_CLAIM_RE` and `_lineAround`, byte for byte, so this raise changes no D or F verdict.

A council (analysis, 2026-11-21) kept every new reason record-only with per-reason revisit conditions (D5-D7).

## History

Rounds 1-23 reviewed a larger scope that also carried `unlisted_surface` and the surface reader. The anthropic seat ratified 22 of 23 (refused round 12); the openai seat refused all 23, each time on 2-3 new findings, every one fixed with a regression test seen red first; about 60 % of rounds 13-23's findings were in the half D11 took off the live path. Four times a class was dropped instead of patched: D8 (no echoed status is read), D9 (masking replaces only a recorded 0, so no refusal can be demoted), D10 (no status handed on by an exit of `PIPESTATUS`; pipefail off after any other `set`/`shopt` naming it), D11 (this round's scope).

Round 32 (anthropic `ratified`; openai refused), fixed with tests seen red first: the `exit` operand parser dropped a whole token with an attached redirection (`task ci || exit -256>/dev/null` exits 0 after a failure), rejected `+1`, and used floating-point `Number` for large literals (`exit 9007199254740993` exits 1). It now splits an attached redirection off the token (digits right before `<`/`>` are a file descriptor, so `exit 1>/dev/null` has no argument and keeps the failure, as Bash does), accepts a sign, and computes `mod 256` with `BigInt` (tests: `exit -256>/dev/null` is `trailing`; `exit +1`, `exit 9007199254740993` and `exit 1>/dev/null` mask nothing; `exit 9007199254740992` is `trailing`).

Round 31 (anthropic `confirmed-non-expanding`; openai refused): (1) the shared trigger let `Progress.\nDone. CI is not done yet.` escape D because `not done` sat on the claim's line, while origin/main refused it; together with rounds 22-28, every D/F verdict change came from sharing G's trigger with them. **D and F are now restored to origin/main exactly** (test: D refuses that reply; the branch's mixed-reply D/F tests are removed with the change they tested). (2) `task ci || exit -1` exits 255, but `-1` was not read as a literal — signed literals are now read (test: masks nothing). (3) the `exit_masked` repair text recommended `set -o pipefail` for every case; it now also says that behind `;` or `||` the verifier must be the last command of the line (test).

Round 30 (anthropic `ratified`; openai refused), fixed with tests seen red first, both spurious gaps (a pass counted as `exit_masked`): (1) round 29's branch for a redirected `exit` dropped its argument and invented an exit 0, so `task ci || exit 1 >/dev/null` read as masked — the argument is now read without its redirections (`>x`, `2>&1`, or `>` and its target) and keeps its status, and the failed-redirection branch continues with a nonzero (tests: `task ci || exit 1 >/dev/null` and `task ci || exit 1 > /dev/null` mask nothing; round 29's `commandSegments` test still lists the command after the `exit`); (2) `set -o pipefail || exit 0; task ci` read as masked because the walk gave a recognised `set` an unknown status — a lone `set` the walk parses now succeeds (test: masks nothing).

Round 29 (anthropic `confirmed-non-expanding`; openai refused): `task ci; exit 1 >/dev/null/child; :` can exit 0 after a failing `task ci`, because the failed redirection stops `exit`. The classifier already answered `trailing` for that line before any change (the argument `1 >/dev/null/child` is not a literal, so the status was unknown), so the regression test pinning it was green from the start and is stated as such. The walk did, however, end the path at that `exit`, which is wrong for reachability: an `exit` with a redirection now also leaves the line running with a nonzero status (test, seen red before the change: `commandSegments('exit 1 >/dev/null/child; npm run dev')` lists `npm run dev`). On the round's other note: `recordGraphFeeder` receives the unfiltered findings but reads only detector F (`findings.find((x) => x.detector === 'untested')`), so a `coverage` finding changes nothing there.

Round 28 (anthropic `confirmed-non-expanding`; openai refused), fixed with tests seen red first: (1) round 27's `task complete\b` dropped `Task completed.`, which origin/main matched — the phrase is now `task completed?\b` (test: `Task completed.` is a claim for D and F; `Task completeness …` is not); (2) `true >/dev/null/child || exit 0; task ci` exits 0 in Bash without reaching `task ci`, because the redirection fails — a segment with a redirection now has an unknown status (test: `trailing`).

Round 27 (anthropic `confirmed-non-expanding`; openai refused), fixed with tests seen red first: (1) `task complete` had no closing word boundary, so after a negated first line `Task completeness remains under review.` counted as a claim and D or F could newly refuse — every word-ending phrase of the trigger now ends in `\b` (test: that reply is no claim and D returns nothing); (2) errexit was not modelled, so `set -euo pipefail; task ci; echo ready` read as `trailing` although a failing `task ci` exits before the echo — the walk now models errexit as above (tests: that line, `set -e; npx tsc --noEmit; echo done` and `set -o errexit; task ci; echo ok` mask nothing; `set -e; task ci || echo failed`, `set -e; task ci | tail -5`, `set -e; set +e; task ci; echo ready` and `false && set -e; task ci; echo ready` still mask). Not changed: the `rtk proxy` peel in two helpers (round 25 note).

Round 26 (anthropic `confirmed-non-expanding`; openai refused), fixed with tests seen red first: (1) `set -o pipefail; printf '%s\n' 'set +o pipefail'; false | true || exit 0; task ci` — the walk took the printed words as an unset, assumed pipefail off, skipped the `exit 0` and credited `task ci`; assuming either setting can miss, so a doubtful pipefail is now `unknown` and the walk follows both (test: `trailing`); `/nonexistent/true || exit 0; task ci` — the walk gave the path the builtin's status; only bare `true`/`:`/`false` are known now (test: `trailing`); (2) `[ \t]*` dropped a claim indented with a non-breaking space that `\s*` had matched — the indentation is now `[^\S\n]*`, which keeps the old matches on one line and still never crosses a line break (test: `Progress.\n\u00a0Done.` is a claim); (3) the ratio pattern's `\s*` could span a line break into a negated line (`Done.\n2 of\n3 not yet verified.`) — it is now `[^\S\n]*` (test: records nothing). anthropic asked for end-to-end tests of the `rtk` and D/F verdict changes; the existing tests exercise `classifyRun`, `detectCompletionClaim` and `detectUntestedChange` directly, and the hook's end-to-end test covers the ratio recording beside the refusal record.

Round 25 (both seats refused). anthropic: the raise_log said "measurement plus 160 B" while the ceiling rises 88 B more than the growth — both are true, because origin/main carried 72 B of headroom under its own ceiling; the entry now states that arithmetic. It also asked that the D/F verdict change be named in the PR description, which it will be. openai, fixed with tests seen red first: (1) the trigger's `(^|\n)\s*` rescanned a long run of blank lines from every newline once D, F and G read past a negated first claim (100,000 blank lines took about 4 s) — the indentation is now `[ \t]*` (test: under 1 s); (2) `task ci || /nonexistent/exit 1; true` exits 0 in Bash, but the walk took the basename `exit` as the shell builtin — only the bare word `exit` ends the line now (test: `trailing`); (3) a CRLF blank line did not end a `Not verified:` block, so a later ratio was swallowed — the ratio view normalises line endings first (test: the later ratio records `partial_ratio`). Not changed: the `rtk proxy` peel appears in two helpers (`segmentVerifies`, `leadingExecutable`); both peel the same prefix and are covered by the step-1.5 tests.

Round 24, the first on this scope (anthropic `confirmed-non-expanding`; openai refused): (1) the prompt called F record-only, which it is not — corrected in point 3 and in the verdict-change paragraph below, with the new F/D finding on a mixed reply stated; (2) asked to verify the bundle carries no `unlisted_surface` / reader code — checked, see Scope; (3) `task ci; return 1; true` exits 0 in Bash because a top-level `return` errors and the line continues, while the walk ended the path — `return` is now an ordinary command (tests: that line and `task ci || return 1; echo ready` are `trailing`).

Round 23 (openai refused, anthropic ratified): (1) a pipeline with a verifier ignored a known `false`/`true` member — `set -o pipefail; false | npx tsc --noEmit && npm run dev`, `npx tsc --noEmit | true || npm run dev` — now the single status rule in point 1 (tests for both, and `npx tsc --noEmit | false && npm run dev`); (2) and (3), credit for a run before the edit and a compose port entry that throws on coercion, were fixed with tests in the reader half that D11 took off the live path.

Note on direction, since D9: every remaining way the masking reading can be wrong is a MISS (a masked line classified as before) or a SPURIOUS gap (a pass counted as `exit_masked`); neither changes a turn verdict against origin/main.

**Not changed, with reasons.** (a) `set -o pipefail; task ci | grep foo` with a passing `task ci` and a `grep` that matches nothing records 1 and refuses as `nonzero_exit_without_test_failure` — exactly as on origin/main, where pipefail lines were never inspected; the roadmap's AC-1 pins the other direction (a `set -o pipefail; … | tail` control stays `PASS_EVIDENCE_OK`). A pre-existing limit, not a weakening. (b) The `rtk` peel makes `rtk vitest run` / `rtk tsc` classify on the wrapped command instead of as `not_a_verification_command`. That moves verdicts in BOTH directions, and this is stated plainly: such a run can now refuse (`FAIL_EVIDENCE` on printed failures, `nonzero_exit_without_test_failure`), and it can now also count as pass evidence (`PASS_EVIDENCE_OK`) where before it counted as no verification at all. That is the intent of roadmap step 1.5: in a session whose host rewrites every command through `rtk` (an output filter that passes the wrapped command's exit code through), no verification run was recognised, so the gate refused every honest turn and accepted none on evidence. The wrapped command is classified by exactly the rules an unwrapped one is. (c) The per-session `.recorded.json` fold is read-modify-write outside the atomic write; Stop events of one session arrive in sequence and these are telemetry counters for a later arming decision, so a lost increment under an unusual overlap is a revisit item before arming. (e) A newline inside one Bash call is not a separator for this parser (`splitSegments`, unchanged from origin/main), so `task ci\necho done` reads as one segment whose verifier is last: a MISS, which under D9 classifies exactly as on origin/main. Splitting on newlines here would also split heredoc bodies into commands, crediting a verifier or start command a heredoc only writes to a file, so it is left for the shell-backed records D8 names.

**What the classifier changes, stated.** Exactly one thing: a line `exitMasking` flags, with a recorded exit code of 0 and no printed failure, load failure or empty suite, classifies `exit_masked` instead of `PASS_EVIDENCE_OK`. Both leave the turn unrefusable, so no turn verdict changes; the run is counted as a gap instead of a pass. Every other run — any nonzero recorded code, any unmasked line — classifies exactly as on origin/main. Separately, the `rtk` peel (point (b) above) moves `rtk`-wrapped runs from "no verification" to the ordinary rules, in both directions.

**Budget.** Measured by the gate's own build: 1,609,365 B with the change against 1,595,228 B on origin/main `4bb96fb2fb` (+14,137 B). The ceiling rises 1,595,300 → 1,609,525 B (measurement plus 160 B; origin/main had 72 B of headroom, so the ceiling moves 14,225 B for 14,137 B of growth; restoring D and F re-adds the hook's own trigger copy) with a `raise_log` entry that states what left the bundle and why.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the code shown whose bytes it pays for — that should block the raise? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate beyond what is stated above? Is the ceiling raise sized to the measurement?
3. Does any new detector or reason refuse a turn, or change a verdict the hook returns, other than as stated above?

The LAST line of your reply must be exactly this shape, in plain text — no markdown, no bold, no heading, nothing after it — with all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
✅  hook bundle: 1609365 B / 1609525 B ceiling, 1 YAML reader(s) [yaml], 346 modules
origin/main 4bb96fb2fb: 1595228 B / 1595300 B ceiling
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..c4f14a61e2 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1609525,
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
+            "to": 1609525,
+            "by": "agent, feat/done-claims-with-read-exit-codes (road-to-done-claims-with-read-exit-codes Phases 1 and 3)",
+            "what_was_added": "The masked-exit-code classification in `_lib/verification_command.ts` / `_lib/verification_evidence.ts` (one reachability walk over the line's pipelines; `exit_masked` only for a recorded 0), the `rtk` peel, detector G's completion trigger `completionClaimAt` and its `partial_ratio` reason (detectors D and F keep their origin/main trigger, unchanged), and the record-only plumbing in `_lib/turn_end_refusals.ts` and the hook. Measured by this gate: 1,609,365 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +14,137 B.",
+            "why_it_could_not_be_avoided": "Not unavoidable in the strict sense, and stated as such. Detector G's second reason, `unlisted_surface`, and the live-surface reader it calls (about 15.7 KB with their shell-word target reader) were taken OFF the live path in ratification round 23 (roadmap decision D11): they move to `_lib/unlisted_surface.ts` beside `_lib/live_surfaces.ts`, used by the `verify:surfaces` verb and tests, and return in a chunk loaded only when the completion trigger matches, with its own ceiling, under a follow-up roadmap. What remains is the classifier, G's trigger and a regex-only ratio check. Rounds 1 to 23 tightened the classifier, dropped reading an echoed status (D8), limited masking to a recorded 0 (D9), dropped crediting an exit of PIPESTATUS and made the walk follow both settings of pipefail and errexit where the text cannot say (D10); round 27 added errexit to the walk. The ceiling is the measurement plus 160 B; origin/main carried 72 B of headroom under its own ceiling, so the ceiling rises 14,225 B for 14,137 B of growth.",
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
 *     It reads the repository, so it lives in `unlisted_surface.ts`, outside the
 *     hook bundle until a chunk loaded only on a claim carries it (D11).
 *
 * It RECORDS and never refuses. A new detector owes pre-registered bars before
 * it can refuse a turn (`docs/contracts/turn-end-detector-demotion.md`), and a
 * ratio beside a claim is not always a claim about that ratio ("2 of 3 options"
 * in a reply that also says "fertig"). The arming decision reads a measurement
 * of how often it fires and on what.
 */
import * as path from 'node:path';

import { readText } from './bounded_read.js';
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
 * Detector G's copy of detector D's trigger, adding no completion keyword of its
 * own, per the 2026-08-12 council bound quoted on `NEGATED_CLAIM_RE`. D and F keep
 * their own copy in the hook unchanged; G reads past a negated first line and
 * bounds its phrases with `\b`, which matters only for what G records.
 */
const COMPLETION_RE =
    /(^|\n)[^\S\n]*(?:\*\*)?(?:fertig\b|damit ist alles erledigt\b|aufgabe erledigt\b|alles erledigt\b|komplett(?:er)? (?:auftrag|abgearbeitet)\b|der komplette auftrag ist durch\b|done[.!]|all done\b|task completed?\b)/i;

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
const NEGATED_CLAIM_RE =
    /\b(noch nicht|nicht fertig|nicht durch|wäre verfrüht|ist verfrüht|not yet|not done|isn'?t done|nein)\b/i;

/** The line `at` falls on — the scope a negation has to appear in to count. */
function lineAround(prose: string, at: number): string {
    // A match anchored on `(^|\n)[^\S\n]*` starts at the newline before its line
    // (indentation never crosses a line break, so blank lines are never rescanned).
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
const RATIO_RE = /\b(\d+)[^\S\n]*(?:of|von|\/)[^\S\n]*(\d+)\b/gi;

/**
 * The reply with code, quotes and tables removed but ratios kept.
 *
 * `visibleProse` in the hook also drops every path-shaped token, and `40/41`
 * is one, so the ratio has to be read off this narrower view.
 */
function ratioProse(fenceStripped: string): string {
    return fenceStripped
        .replace(/\r\n?/g, '\n')
        .replace(/`[^`\n]*`/g, ' ')
        .replace(/^[ \t]*>.*$/gm, ' ')
        .replace(/^[ \t]*\|.*\|[ \t]*$/gm, ' ');
}

/** Offsets covered by a `Not verified:` line and the non-blank block it opens. */
export function notVerifiedSpans(text: string): Array<[number, number]> {
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

const COMPLETION_ALL_RE = new RegExp(COMPLETION_RE.source, 'gi');

/**
 * Where the reply first claims completion on a line that does not negate it, or null.
 * Detector G's trigger: a negated claim does not hide a later affirmative one. The
 * trigger is line-anchored, so each line is checked once.
 */
export function completionClaimAt(visible: string): number | null {
    for (const m of visible.matchAll(COMPLETION_ALL_RE)) {
        if (!NEGATED_CLAIM_RE.test(lineAround(visible, m.index))) return m.index;
    }
    return null;
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
index c0beb7f9a0..b62b2ac740 100644
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
 
@@ -226,6 +233,7 @@ function failureIsDiscarded(seg: Segment): boolean {
     return false;
 }
 
+
 /**
  * The command's segments whose failure the shell does NOT discard, as text.
  *
@@ -244,8 +252,14 @@ export function undiscardedSegments(command: string): string[] {
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
@@ -349,6 +363,263 @@ export function isVerificationCommand(command: string): boolean {
     return segments.some((seg) => !failureIsDiscarded(seg) && segmentVerifies(seg.words));
 }
 
+/** How a command line hides its verifier's exit code from the recorder. */
+export type ExitMasking = 'pipe' | 'trailing';
+
+/** Whether a shell option covers a pipeline; `unknown` when the text cannot say. */
+type Setting = 'on' | 'off' | 'unknown';
+
+/** One pipeline: its segments, the separator after it, and the options covering it. */
+interface Pipeline {
+    readonly segs: readonly Segment[];
+    readonly sepAfter: '&&' | '||' | ';' | null;
+    readonly pipefail: Setting;
+    readonly errexit: Setting;
+}
+
+/**
+ * What a plain `set` turns on or off: `-e`, `-o errexit`, `-o pipefail`, and the
+ * `+` forms, in clusters (`-euo pipefail`). null for anything else it is given.
+ */
+function setOptions(words: readonly string[]): { pipefail?: boolean; errexit?: boolean } | null {
+    if (words[0] !== 'set' || words.length < 2) return null;
+    const out: { pipefail?: boolean; errexit?: boolean } = {};
+    for (let i = 1; i < words.length; i += 1) {
+        const w = words[i] as string;
+        if (!/^[-+][A-Za-z]+$/.test(w)) return null;
+        const on = w[0] === '-';
+        for (const flag of w.slice(1)) {
+            if (flag === 'e') out.errexit = on;
+            else if (flag === 'o') {
+                const name = words[i + 1];
+                if (name === 'pipefail') out.pipefail = on;
+                else if (name === 'errexit') out.errexit = on;
+                else return null;
+                i += 1;
+            } else if (!'uxv'.includes(flag)) return null;
+        }
+    }
+    return out;
+}
+
+function pipelinesOf(command: string): Pipeline[] {
+    const out: Pipeline[] = [];
+    let cur: Segment[] = [];
+    let pipefail: Setting = 'off';
+    let errexit: Setting = 'off';
+    let sepBefore: Pipeline['sepAfter'] = null;
+    for (const seg of splitSegments(stripComment(command))) {
+        cur.push(seg);
+        if (seg.nextSep === '|') continue;
+        out.push({ segs: cur, sepAfter: seg.nextSep as Pipeline['sepAfter'], pipefail, errexit });
+        // A plain `set` that runs for sure and in this shell — alone (a pipeline runs it in
+        // a subshell), not behind `&&` / `||` — sets pipefail / errexit on or off. Any other
+        // segment with a `set` or `shopt` word leaves them `unknown` (D10): the walk then
+        // follows both settings, so neither is assumed.
+        const sure = cur.length === 1 && (sepBefore === null || sepBefore === ';');
+        const opts = sure ? setOptions((cur[0] as Segment).words) : null;
+        if (opts !== null) {
+            if (opts.pipefail !== undefined) pipefail = opts.pipefail ? 'on' : 'off';
+            if (opts.errexit !== undefined) errexit = opts.errexit ? 'on' : 'off';
+        } else if (cur.some((x) => /\b(?:set|shopt)\b/.test(x.words.join(' ')))) {
+            pipefail = 'unknown';
+            errexit = 'unknown';
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
+
+/**
+ * One pass over the line's pipelines, tracking every shell state that can reach
+ * each one. A state is the current status (0 / nonzero), the outcome of the last
+ * verifier that ran, whether that verifier's pipeline reports a filter's status,
+ * and whether the shell ended. There are at most 24 distinct states, so the pass is linear in the line.
+ *
+ * Both `exitMasking` and `commandSegments` read this one walk, so "which commands
+ * can run" and "whose status is recorded" follow the same reachability rules:
+ * `;` always runs the next pipeline, `&&` only on 0, `||` only on nonzero; a lone
+ * `exit` ends the shell (inside a pipeline it ends only its subshell); a top-level
+ * `return` in a Bash call errors and the line goes on, so it is an ordinary command.
+ */
+type Verdict = 'none' | 'pass' | 'fail';
+interface FlowState {
+    readonly zero: boolean;
+    readonly last: Verdict;
+    /** The last verifier ran inside a pipeline whose status is a filter's. */
+    readonly filtered: boolean;
+    readonly ended: boolean;
+}
+
+interface Flow {
+    /** For each pipeline, whether any state runs it. */
+    readonly runs: readonly boolean[];
+    /** The states the line can end in. */
+    readonly finals: readonly FlowState[];
+}
+
+function keyOf(s: FlowState): string {
+    return `${s.zero ? 0 : 1}${s.last}${s.filtered ? 1 : 0}${s.ended ? 1 : 0}`;
+}
+
+function uniq(states: readonly FlowState[]): FlowState[] {
+    const seen = new Map<string, FlowState>();
+    for (const s of states) if (!seen.has(keyOf(s))) seen.set(keyOf(s), s);
+    return [...seen.values()];
+}
+
+/** The states running pipeline `p` can leave behind, from state `s`. */
+function step(s: FlowState, p: Pipeline): FlowState[] {
+    const runs =
+        p.pipefail === 'unknown' ? [...stepUnder(s, p, true), ...stepUnder(s, p, false)] : stepUnder(s, p, p.pipefail === 'on');
+    // errexit ends the shell on a failing pipeline that closes its list (`;` or the end);
+    // a failure inside an `&&` / `||` list does not. Unknown: both.
+    if (p.errexit === 'off' || p.sepAfter === '&&' || p.sepAfter === '||') return runs;
+    return runs.flatMap((r) => {
+        if (r.zero || r.ended) return [r];
+        const exited = { ...r, ended: true };
+        return p.errexit === 'on' ? [exited] : [r, exited];
+    });
+}
+
+function stepUnder(s: FlowState, p: Pipeline, pipefail: boolean): FlowState[] {
+    const lone = p.segs.length === 1;
+    // The shell's own `exit`, not an executable that happens to be named so.
+    if (lone && p.segs[0]?.words[0] === 'exit') {
+        // The argument without its redirections (`>x`, `2>&1`, `-1>x`, or `>` and its
+        // target). Digits right before `<` / `>` name a file descriptor, not an argument.
+        const words = p.segs[0].words.slice(1);
+        const args: string[] = [];
+        let redirected = false;
+        for (let i = 0; i < words.length; i += 1) {
+            const w = words[i] as string;
+            const at = w.search(/[<>]/);
+            if (at === -1) {
+                args.push(w);
+                continue;
+            }
+            redirected = true;
+            const before = w.slice(0, at);
+            if (before !== '' && !/^\d+$/.test(before)) args.push(before);
+            if (/^[<>]+&?$/.test(w.slice(at))) i += 1;
+        }
+        const arg = args.join(' ').replace(/^["']|["']$/g, '');
+        let ran: FlowState[];
+        if (arg === '' || arg === '$?') ran = [{ ...s, ended: true }];
+        else if (/^[+-]?\d+$/.test(arg)) ran = [{ ...s, zero: BigInt(arg) % 256n === 0n, ended: true }];
+        // Any other argument, `${PIPESTATUS[k]}` included (D10): the text cannot say which
+        // pipeline ran last, so the status it hands on is unknown.
+        else ran = [{ ...s, zero: true, ended: true }, { ...s, zero: false, ended: true }];
+        // A failed redirection stops `exit` from running; the line goes on with a nonzero.
+        return redirected ? [...ran, { ...s, zero: false }] : ran;
+    }
+    const k = verifierIndex(p);
+    // The pipeline's status is its last command's; under pipefail any failing member fails
+    // it, and it passes only when every member does. `true` / `:` pass and `false` fails;
+    // any other non-verifier member may do either. One rule, with or without a verifier.
+    // The bare words only: `/x/true` is an executable, not the builtin; and a segment with
+    // a redirection can fail on the redirection, so its status is unknown.
+    const heads = p.segs.map((seg) => (seg.words.some((w) => /[<>]/.test(w)) ? '' : (seg.words[0] ?? '')));
+    const lastAt = heads.length - 1;
+    const passes = (x: string): boolean => x === 'true' || x === ':';
+    const others = heads.filter((_, i) => i !== k);
+    const zeros = (verifier: Verdict): boolean[] => {
+        if (pipefail) {
+            if (verifier === 'fail' || others.includes('false')) return [false];
+            return others.every(passes) ? [true] : [true, false];
+        }
+        if (k === lastAt) return [verifier === 'pass'];
+        const last = heads[lastAt] as string;
+        if (last === 'false') return [false];
+        return passes(last) ? [true] : [true, false];
+    };
+    // A plain `set` the walk read succeeds.
+    if (k === -1 && lone && setOptions((p.segs[0] as Segment).words) !== null) return [{ ...s, zero: true }];
+    if (k === -1) return zeros('none').map((zero) => ({ ...s, zero }));
+    // A 0 says nothing about the verifier when a filter after it reports the status.
+    const filtered = !pipefail && k !== lastAt;
+    const out: FlowState[] = [];
+    for (const last of ['pass', 'fail'] as const) {
+        for (const zero of zeros(last)) out.push({ ...s, zero, last, filtered });
+    }
+    return out;
+}
+
+function flowOf(ps: readonly Pipeline[]): Flow {
+    let states: FlowState[] = [{ zero: true, last: 'none', filtered: false, ended: false }];
+    const runs: boolean[] = [];
+    for (let i = 0; i < ps.length; i += 1) {
+        const p = ps[i] as Pipeline;
+        const sep = i === 0 ? ';' : (ps[i - 1] as Pipeline).sepAfter;
+        const next: FlowState[] = [];
+        let ran = false;
+        for (const s of states) {
+            const go = !s.ended && (sep === ';' || sep === null || (sep === '&&' ? s.zero : !s.zero));
+            if (!go) {
+                next.push(s);
+                continue;
+            }
+            ran = true;
+            next.push(...step(s, p));
+        }
+        runs.push(ran);
+        states = uniq(next);
+    }
+    return { runs, finals: states };
+}
+
+/** The segments of a command line that can run, as text: the commands it runs, not the words it mentions. */
+export function commandSegments(command: string): string[] {
+    if (!command) return [];
+    const ps = pipelinesOf(command);
+    const { runs } = flowOf(ps);
+    const out: string[] = [];
+    ps.forEach((p, i) => {
+        if (runs[i]) for (const seg of p.segs) out.push(seg.words.join(' '));
+    });
+    return out;
+}
+
+/**
+ * Does the exit code of this command line belong to something other than the
+ * command that verified?
+ *
+ * The recorder keeps ONE exit code per call: the status of the last pipeline
+ * that ran. `tsc | tail -5` reports `tail`'s 0, and `task ci; echo "exit=$?"`
+ * reports `echo`'s 0, so a failing run reads as a pass. The question asked of
+ * the line is exact: can it end with a 0 while the last verifier that ran did
+ * not pass (or none ran)? If so, a recorded 0 proves nothing about the verifier.
+ *
+ * - `pipe`: that 0 can come from a filter after the verifier — no earlier
+ *   unconditional `set -o pipefail` covers the pipeline. `PIPESTATUS`, printed
+ *   or passed to `exit`, carries nothing (D10). A pipefail from an rc file is
+ *   invisible here, which is why the reason is an instrument gap.
+ * - `trailing`: that 0 can come from a later command — `cmd; echo`, `cmd || echo`,
+ *   `cmd || false; echo ready`, `cmd || exit 0`, or a verifier that `||` skips.
+ *   `cmd && echo ok`, `cmd || exit 1`, `cmd; exit $?` and `task sync; task ci`
+ *   end with a 0 only when the verifier passed. `cmd || true` is a discard,
+ *   not a verifier.
+ */
+export function exitMasking(command: string): ExitMasking | null {
+    if (!command) return null;
+    const ps = pipelinesOf(command);
+    if (!ps.some((p) => verifierIndex(p) !== -1)) return null;
+    const bad = flowOf(ps).finals.filter((s) => s.zero && s.last !== 'pass');
+    if (bad.length === 0) return null;
+    return bad.some((s) => s.filtered) ? 'pipe' : 'trailing';
+}
+
 /**
  * The RECORDER's net — deliberately wider than the predicate above, and not a
  * leftover of the two-regex era it replaces.
diff --git a/src/scripts/_lib/verification_evidence.ts b/src/scripts/_lib/verification_evidence.ts
index 383f66da39..6eb3b589ae 100644
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
@@ -633,9 +653,16 @@ export function describeRecordFinding(
             + 'the last edit' + tail
         );
     }
+    const masked = reasons.includes('exit_masked')
+        ? ' — a masked exit code is the exit code of `tail` or `echo`, not of the '
+          + 'verifier: behind a pipe, re-run with `set -o pipefail;` in front or use the '
+          + "runner's own filter flag; behind `;` or `||`, make the verifier the last "
+          + 'command of the line'
+        : '';
     return (
         'this turn changed a file and no recorded run after the last edit proves '
         + `anything — the runs seen classify as ${[...new Set(reasons)].join(', ')}`
+        + masked
         + tail
     );
 }
diff --git a/src/scripts/hooks/turn_end_gate_hook.ts b/src/scripts/hooks/turn_end_gate_hook.ts
index cb948cdbcb..cdb22f874e 100644
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
@@ -33,6 +33,9 @@
  *   F — untested change     (`untested`; the turn changed production code,
  *                            touched no test, and claimed done —
  *                            `detectUntestedChange`.)
+ *   G — coverage gap        (`coverage`; a done claim wider than its evidence;
+ *                            RECORDS, never refuses. The live path runs only
+ *                            `partial_ratio`; `unlisted_surface` is not wired, D11.)
  *
  * The SVG render obligation (`openSvgObligation`) also runs in that list but
  * reports under C's id, `verification`, so it is not a seventh detector.
@@ -210,6 +213,14 @@ import { type GraphState, graphState } from '../code_graph/detect.js';
 import { isVerificationAttempt, isVerificationCommand } from '../_lib/verification_command.js';
 import { isTestPath as _isTestPath } from '../_lib/test_path.js';
 import { openSvgObligation } from './svg_obligation.js';
+import {
+    RECORD_ONLY_DETECTORS,
+    foldRecorded,
+    partialRatioIn,
+    readRecorded,
+    recordedFile,
+} from '../_lib/coverage_claim.js';
+import { coverageGapIn } from '../_lib/unlisted_surface.js';
 // Round 8 — the record path detector C prefers over its own regex. The regex
 // reads a command's TEXT and `echo test` matches it; these read what the run
 // exited with and what it printed.
@@ -265,7 +276,8 @@ export type DetectorId =
     | 'verification'
     | 'completion'
     | 'pending-decision'
-    | 'untested';
+    | 'untested'
+    | 'coverage';
 
 export interface Finding {
     detector: DetectorId;
@@ -284,6 +296,8 @@ export interface Finding {
      * corpus reading stays reproducible after the record path landed.
      */
     mode?: 'record' | 'transcript';
+    /** The reason code, where one detector carries several (G: `partial_ratio`). */
+    code?: string;
 }
 
 // ---------------------------------------------------------------------------
@@ -607,6 +621,16 @@ export function detectCompletionClaim(
     };
 }
 
+/** Detector G, both reasons (`_lib/coverage_claim.ts`); the live path runs `partialRatioIn` alone (D11). */
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
@@ -1016,6 +1040,19 @@ export function alreadyRefusedTurn(
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
@@ -1279,6 +1316,9 @@ function runDetectors(inputs: DetectorInputs): Finding[] {
         // opposite trigger, opposite treatment of `dispatchOpen`.
         openSvgObligation(workspaceRoot, toolCalls, runState?.asset_renders ?? null),
         dispatchOpen ? null : detectUntestedChange(lastAssistant, toolCalls, runState),
+        // G is a completion claim too, so an open dispatch excuses it like D; only its
+        // `partial_ratio` reason runs here (D11, `unlisted_surface` reads the repo).
+        dispatchOpen ? null : partialRatioIn(stripFencedBlocks(lastAssistant), visibleProse(lastAssistant)),
     ]) {
         if (f) findings.push(f);
     }
@@ -1376,7 +1416,7 @@ function recordShadow(inputs: DetectorInputs, layer: ShadowLayer): void {
         atomic_write_json(
             file,
             foldShadow(prev, {
-                detectors: findings.map((f) => f.detector),
+                detectors: refusingFindings(findings).map((f) => f.detector),
                 turnOrdinal: inputs.turnOrdinal,
                 at: new Date().toISOString(),
                 layer,
@@ -1443,17 +1483,19 @@ export function main(): number {
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
