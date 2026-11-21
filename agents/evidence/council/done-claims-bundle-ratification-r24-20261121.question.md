<!-- evidence-type: analysis -->

# Ratification review — the dispatch bundle ceiling for the exit-code classifier — round 24

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose byte ceiling for the hook dispatch bundle (`dist/hooks/dispatch.js`, loaded by every hook event) is raised. ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it.

subject: c43b180648e9ce4963f9df3826f52fa93a63caac944f98394df41a160e8ace99

(The digest covers the gated file at commit `5784e1362a` on branch `feat/done-claims-with-read-exit-codes`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## Scope of this round

This round's raise pays for less code than rounds 1-23. After 23 rounds without a two-seat verdict, a council strategy round (2026-11-21) recommended reviewing the classifier on its own scope; roadmap decision D11 took detector G's repository-reading reason (`unlisted_surface`) and the live-surface reader off the live hook path. They now live in `_lib/unlisted_surface.ts` and `_lib/live_surfaces.ts`, which the dispatch bundle does not carry, and return later in a chunk loaded only on a completion claim, with its own ceiling and its own ratification. They are not shown and not under review here. The raise falls from +27,499 B to +11,772 B.

## The change, as bundled

1. **Masked exit codes.** `_lib/verification_command.ts` walks the line's pipelines once (`flowOf`), tracking every shell state that can reach each: the current status (0 / nonzero), the outcome of the last verifier that ran (none / pass / fail), whether that verifier's pipeline reports a filter's status, and whether the shell ended — at most 24 distinct states, so the walk is linear. `;` always runs the next pipeline, `&&` only on 0, `||` only on nonzero; a lone `exit`/`return` ends the shell (`$?`/no argument keeps the status, a literal gives `n % 256`, anything else — `exit "${PIPESTATUS[k]}"` included — is unknown); inside a pipeline it is an ordinary command. One status rule covers every pipeline: without pipefail its status is its last command's; under pipefail any failing member fails it and it passes only when every member does; `true`/`:` pass, `false` fails, a verifier passes or fails, any other command may do either. pipefail is on only after a plain `set -o pipefail` that is alone and unconditional; any other segment naming `set`/`shopt` and `pipefail` turns it off for what follows, reached or not. `exitMasking()` asks one exact question: **can the line end with a 0 while the last verifier that ran did not pass (or none ran)?** If yes, a recorded 0 proves nothing — `pipe` when on such a path the last verifier sat in a filtered pipeline, else `trailing`. `cmd || true` is NOT a masking case: it is the existing discard, `not_a_verification_command` before and after. `_lib/verification_evidence.ts` `classifyRun()` consults masking ONLY where the exit code would decide — after printed failures, load failures and empty suites — and ONLY when the recorded exit code is 0 (D9): then it returns `exit_masked`, an instrument-gap reason that never refuses a turn. No line of output is ever read as the verifier's status (D8). An `rtk` wrapper is peeled so `rtk vitest run` is still recognised as a verifier.
2. **Detector G, `partial_ratio` only.** `_lib/coverage_claim.ts` `partialRatioIn`: a reply that claims done and reports `N of M` with N < M outside a `Not verified:` block and not on a negated line. It RECORDS into per-session counters (`<key>.recorded.json`) and never refuses; `refusingFindings` drops it from the verdict. Regex over the reply only — no repository read, no tool calls.
3. **One completion trigger for D, F and G.** `completionClaimAt` returns the first line-anchored completion match whose own line is not negated. Detectors D (premature completion while CI is unsettled; refuses) and F (untested change; records) read it instead of their former first-match-only check. On origin/main the line helper missed a negation when the match began at a newline, so `Progress.\nFertig ist der Fix noch nicht.` was refused; now it is not. A negated line no longer hides a later affirmative one (`Status.\nFertig ist der Fix noch nicht.\nDone.` still refuses under D), which round 22 found weakened in an intermediate version.

A council (analysis, 2026-11-21) kept every new reason record-only with per-reason revisit conditions (D5-D7).

## History

Rounds 1-23 reviewed a larger scope that also carried `unlisted_surface` and the surface reader. The anthropic seat ratified 22 of 23 (refused round 12); the openai seat refused all 23, each time on 2-3 new findings, every one fixed with a regression test seen red first; about 60 % of rounds 13-23's findings were in the half D11 took off the live path. Four times a class was dropped instead of patched: D8 (no echoed status is read), D9 (masking replaces only a recorded 0, so no refusal can be demoted), D10 (no status handed on by an exit of `PIPESTATUS`; pipefail off after any other `set`/`shopt` naming it), D11 (this round's scope).

Round 23 (openai refused, anthropic ratified): (1) a pipeline with a verifier ignored a known `false`/`true` member — `set -o pipefail; false | npx tsc --noEmit && npm run dev`, `npx tsc --noEmit | true || npm run dev` — now the single status rule in point 1 (tests for both, and `npx tsc --noEmit | false && npm run dev`); (2) and (3), credit for a run before the edit and a compose port entry that throws on coercion, were fixed with tests in the reader half that D11 took off the live path.

Note on direction, since D9: every remaining way the masking reading can be wrong is a MISS (a masked line classified as before) or a SPURIOUS gap (a pass counted as `exit_masked`); neither changes a turn verdict against origin/main.

**Not changed, with reasons.** (a) `set -o pipefail; task ci | grep foo` with a passing `task ci` and a `grep` that matches nothing records 1 and refuses as `nonzero_exit_without_test_failure` — exactly as on origin/main, where pipefail lines were never inspected; the roadmap's AC-1 pins the other direction (a `set -o pipefail; … | tail` control stays `PASS_EVIDENCE_OK`). A pre-existing limit, not a weakening. (b) The `rtk` peel makes `rtk vitest run` / `rtk tsc` classify on the wrapped command instead of as `not_a_verification_command`. That moves verdicts in BOTH directions, and this is stated plainly: such a run can now refuse (`FAIL_EVIDENCE` on printed failures, `nonzero_exit_without_test_failure`), and it can now also count as pass evidence (`PASS_EVIDENCE_OK`) where before it counted as no verification at all. That is the intent of roadmap step 1.5: in a session whose host rewrites every command through `rtk` (an output filter that passes the wrapped command's exit code through), no verification run was recognised, so the gate refused every honest turn and accepted none on evidence. The wrapped command is classified by exactly the rules an unwrapped one is. (c) The per-session `.recorded.json` fold is read-modify-write outside the atomic write; Stop events of one session arrive in sequence and these are telemetry counters for a later arming decision, so a lost increment under an unusual overlap is a revisit item before arming. (e) A newline inside one Bash call is not a separator for this parser (`splitSegments`, unchanged from origin/main), so `task ci\necho done` reads as one segment whose verifier is last: a MISS, which under D9 classifies exactly as on origin/main. Splitting on newlines here would also split heredoc bodies into commands, crediting a verifier or start command a heredoc only writes to a file, so it is left for the shell-backed records D8 names.

**What the classifier changes, stated.** Exactly one thing: a line `exitMasking` flags, with a recorded exit code of 0 and no printed failure, load failure or empty suite, classifies `exit_masked` instead of `PASS_EVIDENCE_OK`. Both leave the turn unrefusable, so no turn verdict changes; the run is counted as a gap instead of a pass. Every other run — any nonzero recorded code, any unmasked line — classifies exactly as on origin/main. Separately, the `rtk` peel (point (b) above) moves `rtk`-wrapped runs from "no verification" to the ordinary rules, in both directions. Separately, point 3 changes when detector D refuses: it no longer refuses a closing whose only completion line is negated on its own line, and it still refuses when a later line claims completion.

**Budget.** Measured by the gate's own build: 1,607,000 B with the change against 1,595,228 B on origin/main `4bb96fb2fb` (+11,772 B). The ceiling rises 1,595,300 → 1,607,160 B (measurement plus 160 B) with a `raise_log` entry that states what left the bundle and why.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the code shown whose bytes it pays for — that should block the raise? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate beyond what is stated above? Is the ceiling raise sized to the measurement?
3. Does any new detector or reason refuse a turn, or change a verdict the hook returns, other than as stated above?

The LAST line of your reply must be exactly this shape, in plain text — no markdown, no bold, no heading, nothing after it — with all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
✅  hook bundle: 1607000 B / 1607160 B ceiling, 1 YAML reader(s) [yaml], 346 modules
origin/main 4bb96fb2fb: 1595228 B / 1595300 B ceiling
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..d05ceba791 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1607160,
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
+            "to": 1607160,
+            "by": "agent, feat/done-claims-with-read-exit-codes (road-to-done-claims-with-read-exit-codes Phases 1 and 3)",
+            "what_was_added": "The masked-exit-code classification in `_lib/verification_command.ts` / `_lib/verification_evidence.ts` (one reachability walk over the line's pipelines; `exit_masked` only for a recorded 0), the `rtk` peel, the shared completion trigger `completionClaimAt` that detectors D, F and G read, detector G's `partial_ratio` reason, and the record-only plumbing in `_lib/turn_end_refusals.ts` and the hook. Measured by this gate: 1,607,000 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +11,772 B.",
+            "why_it_could_not_be_avoided": "Not unavoidable in the strict sense, and stated as such. Detector G's second reason, `unlisted_surface`, and the live-surface reader it calls (about 15.7 KB with their shell-word target reader) were taken OFF the live path in ratification round 23 (roadmap decision D11): they move to `_lib/unlisted_surface.ts` beside `_lib/live_surfaces.ts`, used by the `verify:surfaces` verb and tests, and return in a chunk loaded only when the completion trigger matches, with its own ceiling, under a follow-up roadmap. What remains is the classifier, the shared trigger and a regex-only ratio check. Rounds 1 to 23 tightened the classifier, dropped reading an echoed status (D8), limited masking to a recorded 0 (D9), dropped crediting an exit of PIPESTATUS and turned pipefail off on any other set or shopt naming it (D10). Sized to the measurement plus 160 B.",
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
 * Shared with detector D, which is why it lives here: detector G uses the same
 * trigger and adds no completion keyword of its own, per the 2026-08-12 council
 * bound quoted on `NEGATED_CLAIM_RE`.
 */
const COMPLETION_RE =
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
const NEGATED_CLAIM_RE =
    /\b(noch nicht|nicht fertig|nicht durch|wäre verfrüht|ist verfrüht|not yet|not done|isn'?t done|nein)\b/i;

/** The line `at` falls on — the scope a negation has to appear in to count. */
function lineAround(prose: string, at: number): string {
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
 * Shared by detectors D, F and G: a negated claim does not hide a later affirmative
 * one. The trigger is line-anchored, so each line is checked once.
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
index c0beb7f9a0..abada3b864 100644
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
@@ -349,6 +363,213 @@ export function isVerificationCommand(command: string): boolean {
     return segments.some((seg) => !failureIsDiscarded(seg) && segmentVerifies(seg.words));
 }
 
+/** How a command line hides its verifier's exit code from the recorder. */
+export type ExitMasking = 'pipe' | 'trailing';
+
+/** `set -o pipefail`, `set -euo pipefail`, `set -e -o pipefail`. */
+const SETS_PIPEFAIL = /^set\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*o\s+pipefail$/;
+/**
+ * A segment with a `set` / `shopt` word and a `pipefail` word may turn it off
+ * (`set +o pipefail`, `shopt -uo pipefail`, `eval 'set +o pipefail'`). Two linear tests.
+ */
+function touchesPipefail(text: string): boolean {
+    return /\b(?:set|shopt)\b/.test(text) && /\bpipefail\b/.test(text);
+}
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
+        // pipefail is on only after a plain `set -o pipefail` that runs for sure and in
+        // this shell: alone (a pipeline runs it in a subshell) and not behind `&&` / `||`.
+        // Any other `set` / `shopt` naming pipefail turns it off for what follows, reached
+        // or not (D10): whether it ran is not read from the text, and off only adds gaps.
+        const sure = cur.length === 1 && (sepBefore === null || sepBefore === ';');
+        for (const s of cur) {
+            const text = s.words.join(' ');
+            if (!touchesPipefail(text)) continue;
+            pipefail = sure && SETS_PIPEFAIL.test(text);
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
+/**
+ * One pass over the line's pipelines, tracking every shell state that can reach
+ * each one. A state is the current status (0 / nonzero), the outcome of the last
+ * verifier that ran, whether that verifier's pipeline reports a filter's status,
+ * and whether the shell ended. There are at most 24 distinct states, so the pass is linear in the line.
+ *
+ * Both `exitMasking` and `commandSegments` read this one walk, so "which commands
+ * can run" and "whose status is recorded" follow the same reachability rules:
+ * `;` always runs the next pipeline, `&&` only on 0, `||` only on nonzero; a lone
+ * `exit`/`return` ends the shell (inside a pipeline it ends only its subshell).
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
+    const h = head(p);
+    const lone = p.segs.length === 1;
+    if (lone && (h === 'exit' || h === 'return')) {
+        const arg = argsOf(p).replace(/^["']|["']$/g, '');
+        if (arg === '' || arg === '$?') return [{ ...s, ended: true }];
+        if (/^\d+$/.test(arg)) return [{ ...s, zero: Number(arg) % 256 === 0, ended: true }];
+        // Any other argument, `${PIPESTATUS[k]}` included (D10): the text cannot say which
+        // pipeline ran last, so the status it hands on is unknown.
+        return [
+            { ...s, zero: true, ended: true },
+            { ...s, zero: false, ended: true },
+        ];
+    }
+    const k = verifierIndex(p);
+    // The pipeline's status is its last command's; under pipefail any failing member fails
+    // it, and it passes only when every member does. `true` / `:` pass and `false` fails;
+    // any other non-verifier member may do either. One rule, with or without a verifier.
+    const heads = p.segs.map((seg) => bareName(seg.words[0] ?? ''));
+    const lastAt = heads.length - 1;
+    const passes = (x: string): boolean => x === 'true' || x === ':';
+    const others = heads.filter((_, i) => i !== k);
+    const zeros = (verifier: Verdict): boolean[] => {
+        if (p.pipefail) {
+            if (verifier === 'fail' || others.includes('false')) return [false];
+            return others.every(passes) ? [true] : [true, false];
+        }
+        if (k === lastAt) return [verifier === 'pass'];
+        const last = heads[lastAt] as string;
+        if (last === 'false') return [false];
+        return passes(last) ? [true] : [true, false];
+    };
+    if (k === -1) return zeros('none').map((zero) => ({ ...s, zero }));
+    // A 0 says nothing about the verifier when a filter after it reports the status.
+    const filtered = !p.pipefail && k !== lastAt;
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
index cb948cdbcb..7f56e8a79f 100644
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
@@ -210,6 +213,15 @@ import { type GraphState, graphState } from '../code_graph/detect.js';
 import { isVerificationAttempt, isVerificationCommand } from '../_lib/verification_command.js';
 import { isTestPath as _isTestPath } from '../_lib/test_path.js';
 import { openSvgObligation } from './svg_obligation.js';
+import {
+    RECORD_ONLY_DETECTORS,
+    completionClaimAt,
+    foldRecorded,
+    partialRatioIn,
+    readRecorded,
+    recordedFile,
+} from '../_lib/coverage_claim.js';
+import { coverageGapIn } from '../_lib/unlisted_surface.js';
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
@@ -592,12 +567,10 @@ export function detectCompletionClaim(
     // A session that never read CI has nothing to be premature about.
     if (!ci.seen || ci.settled) return null;
     const prose = visibleProse(reply);
-    const m = _COMPLETION_RE.exec(prose);
-    if (!m) return null;
-    const at = m.index;
-    // The trigger fired, but the line it fired on negates it — a status report,
-    // not a claim. Refusing these punishes exactly the honesty the gate wants.
-    if (_NEGATED_CLAIM_RE.test(_lineAround(prose, at))) return null;
+    // A trigger on a line that negates it is a status report, not a claim; refusing
+    // it punishes the honesty the gate wants. A later affirmative line still claims.
+    const at = completionClaimAt(prose);
+    if (at === null) return null;
     return {
         detector: 'completion',
         evidence: prose.slice(at, at + 120).trim(),
@@ -607,6 +580,16 @@ export function detectCompletionClaim(
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
@@ -901,10 +884,7 @@ export function detectUntestedChange(
     // The claim gate, reusing detector D's pair rather than a second dialect of
     // "done" — two lists of completion phrasings would drift, and the negation
     // check is what keeps an honest "noch nicht fertig" from being refused.
-    const prose = visibleProse(reply);
-    const m = _COMPLETION_RE.exec(prose);
-    if (!m) return null;
-    if (_NEGATED_CLAIM_RE.test(_lineAround(prose, m.index))) return null;
+    if (completionClaimAt(visibleProse(reply)) === null) return null;
 
     const shown = source.slice(0, 3).join(', ');
     if (noRedEvidence) {
@@ -1016,6 +996,19 @@ export function alreadyRefusedTurn(
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
@@ -1279,6 +1272,9 @@ function runDetectors(inputs: DetectorInputs): Finding[] {
         // opposite trigger, opposite treatment of `dispatchOpen`.
         openSvgObligation(workspaceRoot, toolCalls, runState?.asset_renders ?? null),
         dispatchOpen ? null : detectUntestedChange(lastAssistant, toolCalls, runState),
+        // G is a completion claim too, so an open dispatch excuses it like D; only its
+        // `partial_ratio` reason runs here (D11, `unlisted_surface` reads the repo).
+        dispatchOpen ? null : partialRatioIn(stripFencedBlocks(lastAssistant), visibleProse(lastAssistant)),
     ]) {
         if (f) findings.push(f);
     }
@@ -1376,7 +1372,7 @@ function recordShadow(inputs: DetectorInputs, layer: ShadowLayer): void {
         atomic_write_json(
             file,
             foldShadow(prev, {
-                detectors: findings.map((f) => f.detector),
+                detectors: refusingFindings(findings).map((f) => f.detector),
                 turnOrdinal: inputs.turnOrdinal,
                 at: new Date().toISOString(),
                 layer,
@@ -1443,17 +1439,19 @@ export function main(): number {
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
