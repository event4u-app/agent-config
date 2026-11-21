<!-- evidence-type: analysis -->

# Ratification review — the dispatch bundle ceiling for detector G and the exit-code classifier — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose byte ceiling for the hook dispatch bundle (`dist/hooks/dispatch.js`, loaded by every hook event) is raised. ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it.

subject: 0506452b6c14c03b2b3767f2cfe89c2260ac1ee5ac2dcfec2393f1a439df57c5

(The digest covers the gated file at commit `060dbc1ade` on branch `feat/done-claims-with-read-exit-codes`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Roadmap `road-to-done-claims-with-read-exit-codes` adds three things to the turn-end hook path:

1. **Masked exit codes.** `_lib/verification_command.ts` `exitMasking()` classifies a verification command whose recorded exit code is not the verifier's: `pipe` (a verifier piped into a filter with no `pipefail` set earlier on the line and no `exit`/`return` of `PIPESTATUS`) and `trailing` (a verifier followed by `;` or `||` and a non-verifying command that does not propagate the failure). `cmd || true` is NOT a masking case: it is the existing discard, classified `not_a_verification_command` before and after this change. An `rtk` wrapper is peeled so `rtk vitest run` is still recognised as a verifier. `_lib/verification_evidence.ts` `classifyRun()` reports `exit_masked` as an instrument-gap reason: it is counted, it never refuses a turn.
2. **Detector G (`coverage`).** `_lib/coverage_claim.ts`: a reply that claims done and reports `N of M` with N < M (`partial_ratio`), or a turn that edited a runnable surface, ran nothing that drives it, and claims done without a `Not verified:` list naming it (`unlisted_surface`). It RECORDS into per-session counters (`<key>.recorded.json`) and never refuses; `refusingFindings` drops it from the verdict.
3. **Live surfaces.** `_lib/live_surfaces.ts` derives runnable surfaces from repo files (package.json dev/start/preview/serve, tauri.conf.json, playwright baseURL, compose ports, Taskfile dev/run/serve). Detector G calls it in memory; the `verify:surfaces` CLI (`derive_live_surfaces.ts`, not in the bundle) writes the map to `agents/state/live-surfaces.json`.

A council (analysis, 2026-11-21, one round; the openai seat answered, the anthropic seat failed) kept all three new reasons record-only with per-reason revisit conditions (D5-D7 in the roadmap).

## History

Round 1 (at `ecd13e5d92`) split 1-1. The anthropic seat ratified. The openai seat refused on four findings, all fixed with red-first tests in `207591fe27` and `96f21c8f8e`:

- **The masking check ran before the load-failure and zero-tests checks**, so a masked run that loaded nothing or discovered no tests turned from a refusing reason into the non-refusing `exit_masked`. Now `classifyRun` consults masking only at the two points where the exit code decides (after a printed failure, a load failure and an empty suite have had their say). Tests: a masked run with `Cannot find module` stays `fixture_or_load_failure`; one with `Tests 0 passed (0)` stays `zero_tests_discovered`.
- **The echoed exit code was read from anywhere in the output.** Now it is read only from a line of its own (`^exit[ _code]?[=:]N$`) and only when the command echoes the verifier's status: `PIPESTATUS`, or `$?` on a trailing mask; after a pipe `$?` is the filter's code. Tests: a log line `src/exit.ts: exit=1 handled` is not read; `task ci | tail -5; echo "exit=$?"` stays `exit_masked`; `echo "exit=${PIPESTATUS[0]}"` with `exit=2` reads 2.
- **Any mention of `PIPESTATUS` suppressed the pipe finding.** Now only `exit`/`return` of `PIPESTATUS` does; printing it still masks. Tests both ways.
- **Detector G read the repo before its cheap checks, and its reads were unbounded.** Derivation now runs only for a claimed turn with edits; every input read is `statSync` → regular file ≤ 1 MiB, so a FIFO named `package.json` is skipped (test with `mkfifo`), and an oversized file is skipped (red-first test). A browser run (`playwright test`, `ui:render`) now drives only web surfaces (`npm-script`, `playwright`), not compose services or Taskfile tasks (red-first test). A `Not verified:` block names a surface by whole word, so "the development notes" does not list `dev` (red-first test). The CLI cache writer moved out of the bundled module.

The seat's pre-merge suggestion to split the classifier change into its own PR is not taken: the roadmap ships the three record-only reasons together, and the verdict changes the classifier can cause are now confined to the exit-code decision point and listed below.

**What the classifier still changes, stated.** At the exit-code decision point only: a masked run whose recorded code is the filter's no longer passes or fails on that code. A passing summary under a masking pipe classifies `exit_masked` instead of `PASS_EVIDENCE_OK` (both leave the turn unrefusable); a filter's nonzero code (`vitest | grep foo` finding nothing) classifies `exit_masked` instead of `nonzero_exit_without_test_failure` — a refusing reason becomes an instrument gap, because the code it rested on was `grep`'s. An echoed verifier code of nonzero still refuses as before.

**Budget.** Measured by the gate's own build: 1,610,811 B with the change against 1,595,228 B on origin/main `4bb96fb2fb` (+15,583 B; round 1 measured +17,762 B before the CLI split). The ceiling rises 1,595,300 → 1,610,970 B (measurement plus 159 B) with a `raise_log` entry that names the chunk alternative (about 11.6 KB, loaded only when the completion trigger matches) as the next move if G is armed or room is needed.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the code shown whose bytes it pays for — that should block the raise? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate beyond what is stated above? Is the ceiling raise sized to the measurement?
3. Does any new detector or reason refuse a turn, or change a verdict the hook returns, other than as stated above?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
✅  hook bundle: 1610811 B / 1610970 B ceiling, 1 YAML reader(s) [yaml], 345 modules
origin/main 4bb96fb2fb: 1595228 B / 1595300 B ceiling
per input, bytes in output: _lib/coverage_claim.ts 5814 · _lib/live_surfaces.ts 5805 · _lib/verification_evidence.ts 11524 · _lib/verification_command.ts 7818 · _lib/turn_end_refusals.ts 9130 · hooks/turn_end_gate_hook.ts 19732
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..806c725546 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1610970,
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
+            "to": 1610970,
+            "by": "agent, feat/done-claims-with-read-exit-codes (road-to-done-claims-with-read-exit-codes Phases 1, 3 and 4)",
+            "what_was_added": "Detector G of turn-end-gate (`_lib/coverage_claim.ts`, 5,814 B) with the live-surface reader it calls (`_lib/live_surfaces.ts`, 5,805 B; the cache writer and CLI stay in `derive_live_surfaces.ts`, outside the bundle), and the masked-exit-code classification in `_lib/verification_command.ts` / `_lib/verification_evidence.ts` with the record-only refusal plumbing in `_lib/turn_end_refusals.ts` and the hook. Measured by this gate: 1,610,811 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +15,583 B.",
+            "why_it_could_not_be_avoided": "Not unavoidable in the strict sense, and stated as such: a conditional chunk loaded only when the completion trigger matches could carry the detector body and the reader (about 11.6 KB) off the parse of every other hook event. It was not split here because detector G is record-only while its arming is measured (council D5-D7, 2026-11-21: all three new reasons record-only), and detector D takes the shared completion trigger from the same module, so the split needs its own loader, digest check, chunk ceiling and schema pin. If G is armed, or the next concern needs room, that chunk is the move. Room already made: the hook source sat at its line ceiling, so the detector body lives in its own module; the reader is shared with the `verify:surfaces` verb rather than written twice, and that verb's cache writer and CLI were split out of the bundled module (ratification round 1). Sized to the measurement plus 159 B.",
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
import * as fs from 'node:fs';
import * as path from 'node:path';

import { deriveLiveSurfaces, type LiveSurface } from './live_surfaces.js';
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
const NOT_VERIFIED_RE = /^\s*(?:[-*]\s+)?(?:\*\*)?(?:not verified|nicht verifiziert)\b/im;

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
    const spans: Array<[number, number]> = [];
    const re = new RegExp(NOT_VERIFIED_RE.source, 'gim');
    for (const m of text.matchAll(re)) {
        const start = text.lastIndexOf('\n', m.index) + 1;
        const blank = text.slice(start).search(/\n[ \t]*\n/);
        spans.push([start, blank === -1 ? text.length : start + blank]);
    }
    return spans;
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
    for (const m of text.matchAll(RATIO_RE)) {
        const n = Number(m[1]);
        const total = Number(m[2]);
        if (!(n < total) || total === 0) continue;
        const at = m.index;
        if (spans.some(([s, e]) => at >= s && at < e)) continue;
        if (NEGATED_CLAIM_RE.test(lineAround(text, at))) continue;
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

/** Surfaces a render or browser run reaches without naming them: a web page. */
const BROWSER_KINDS: ReadonlySet<LiveSurface['kind']> = new Set(['npm-script', 'playwright']);

/** A call that drove `surface`: its start command, its URL, or a render or browser run over a web page. */
function drives(command: string, surface: LiveSurface): boolean {
    if (BROWSER_KINDS.has(surface.kind) && /\bui:render\b|\bplaywright\s+test\b/.test(command)) return true;
    if (surface.start !== null && command.includes(surface.start)) return true;
    return surface.url !== undefined && command.includes(surface.url);
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
    const edits = calls.filter((c) => EDIT_TOOLS.has(c.name) && c.path !== undefined).map((c) => c.path as string);
    if (edits.length === 0) return null;
    const surfaces = given ?? deriveLiveSurfaces(workspaceRoot);
    if (surfaces.length === 0) return null;
    const commands = calls.map((c) => c.command ?? '').filter((c) => c !== '');
    const text = ratioProse(fenceStripped);
    const listed = notVerifiedSpans(text).map(([s, e]) => text.slice(s, e)).join('\n');
    for (const surface of surfaces) {
        const root = path.resolve(workspaceRoot, surface.root);
        const edited = edits.find((p) => {
            const rel = path.relative(root, path.resolve(workspaceRoot, p));
            return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
        });
        if (edited === undefined) continue;
        if (commands.some((c) => drives(c, surface))) continue;
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

/** Read a session's record-only counters; anything unreadable starts fresh. */
export function readRecorded(file: string): RecordedCounts | null {
    try {
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<RecordedCounts>;
        if (typeof o.counts !== 'object' || o.counts === null) return null;
        return {
            counts: o.counts,
            codes: typeof o.codes === 'object' && o.codes !== null ? o.codes : {},
            first_at: typeof o.first_at === 'string' ? o.first_at : '',
            last_at: typeof o.last_at === 'string' ? o.last_at : '',
        };
    } catch {
        return null;
    }
}

export function recordedFile(stateDir: string, sessionKey: string): string {
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

/** Inputs are small config files; anything larger is not one, and is not read. */
const MAX_INPUT_BYTES = 1024 * 1024;

/**
 * A regular file of bounded size, or null. The hook runs this on a Stop event
 * in a repo it does not control, so a FIFO or device named `package.json`
 * would block a synchronous read that no `try` can recover from.
 */
export function readText(file: string): string | null {
    try {
        const st = fs.statSync(file);
        if (!st.isFile() || st.size > MAX_INPUT_BYTES) return null;
        return fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
}

export function rel(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}

function npmScripts(root: string, inputs: string[]): { surfaces: LiveSurface[]; scripts: Record<string, string> } {
    const file = path.join(root, 'package.json');
    const text = readText(file);
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
        const text = readText(file);
        if (text === null) continue;
        inputs.push(file);
        let conf: { app?: { windows?: unknown }; tauri?: { windows?: unknown }; build?: { devUrl?: unknown } };
        try {
            conf = JSON.parse(text) as typeof conf;
        } catch {
            continue;
        }
        const windows = conf.app?.windows ?? conf.tauri?.windows;
        const list = Array.isArray(windows) && windows.length > 0 ? windows : [{}];
        const start = typeof scripts['tauri'] === 'string' ? 'npm run tauri dev' : 'npx tauri dev';
        list.forEach((w, i) => {
            const win = (typeof w === 'object' && w !== null ? w : {}) as Record<string, unknown>;
            const width = win['width'];
            const height = win['height'];
            const entry: LiveSurface = {
                kind: 'tauri',
                name: typeof win['title'] === 'string' ? win['title'] : `window ${String(i + 1)}`,
                start,
                root: '.',
                derived_from: `${rel(root, file)}:${String(lineOf(text, typeof width === 'number' ? /"width"\s*:/ : /"windows"\s*:/))}`,
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

function playwrightBaseUrls(root: string, inputs: string[]): LiveSurface[] {
    const out: LiveSurface[] = [];
    for (const ext of ['ts', 'js', 'mjs', 'cjs', 'mts']) {
        const file = path.join(root, `playwright.config.${ext}`);
        const text = readText(file);
        if (text === null) continue;
        inputs.push(file);
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
        names = fs.readdirSync(root).filter((n) => /^(docker-)?compose[\w.-]*\.ya?ml$/.test(n)).sort();
    } catch {
        return out;
    }
    for (const name of names) {
        const file = path.join(root, name);
        const text = readText(file);
        if (text === null) continue;
        inputs.push(file);
        let doc: { services?: Record<string, { ports?: unknown }> };
        try {
            doc = (parseYaml(text) ?? {}) as typeof doc;
        } catch {
            continue;
        }
        for (const [service, spec] of Object.entries(doc.services ?? {})) {
            const ports = Array.isArray(spec?.ports) ? spec.ports : [];
            for (const p of ports) {
                const host = /^(?:[\d.]+:)?(\d+):\d+/.exec(String(p));
                if (host === null) continue;
                out.push({
                    kind: 'compose',
                    name: service,
                    start: `docker compose -f ${name} up ${service}`,
                    url: `http://localhost:${host[1] as string}`,
                    root: '.',
                    derived_from: `${name}:${String(lineOf(text, new RegExp(`^\\s+${escapeRe(service)}\\s*:`)))}`,
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
        const text = readText(file);
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
    const npm = npmScripts(root, inputs);
    const surfaces = [
        ...npm.surfaces,
        ...tauriWindows(root, npm.scripts, inputs),
        ...playwrightBaseUrls(root, inputs),
        ...composePorts(root, inputs),
        ...taskfileTasks(root, inputs),
    ];
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
index 430ba3dca8..1ca8d4875f 100644
--- a/src/scripts/_lib/turn_end_refusals.ts
+++ b/src/scripts/_lib/turn_end_refusals.ts
@@ -51,7 +51,8 @@ import * as path from 'node:path';
 import { read_lockfile } from './installed_lock.js';
 
 /**
- * The six detectors, in the order the gate runs them.
+ * The seven detectors, in the order the gate runs them. G (`coverage`) records
+ * and never refuses, so its count here is a finding count, not a refusal one.
  *
  * The roadmap's § 0 names three (A promissory, B language, C verification).
  * That was true of the draft and is not true of the tree: detector D
@@ -81,6 +82,7 @@ export const DETECTOR_IDS = [
     'completion',
     'pending-decision',
     'untested',
+    'coverage',
 ] as const;
 
 export type RefusalDetectorId = (typeof DETECTOR_IDS)[number];
@@ -515,6 +517,23 @@ export const SHADOW_MAX_ROWS = 200;
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
@@ -716,15 +735,19 @@ export function pruneAgedRefusalState(
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
+                const raw = fs.readFileSync(file, 'utf-8');
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
@@ -867,7 +890,7 @@ export function collectRefusalStats(workspaceRoot: string): RefusalStats {
         // here because relying on another function's strictness for a
         // correctness property is how the property disappears when that
         // function is loosened.
-        if (name.endsWith(SHADOW_SUFFIX)) continue;
+        if (name.endsWith(SHADOW_SUFFIX) || name.endsWith(RECORDED_SUFFIX)) continue;
         let rec: RefusalRecord | null = null;
         try {
             rec = parseRecord(fs.readFileSync(path.join(dir, name), 'utf-8'));
diff --git a/src/scripts/_lib/verification_command.ts b/src/scripts/_lib/verification_command.ts
index c0beb7f9a0..6b7e81c1f4 100644
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
 
@@ -244,8 +251,14 @@ export function undiscardedSegments(command: string): string[] {
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
@@ -349,6 +362,69 @@ export function isVerificationCommand(command: string): boolean {
     return segments.some((seg) => !failureIsDiscarded(seg) && segmentVerifies(seg.words));
 }
 
+/** How a command line hides its verifier's exit code from the recorder. */
+export type ExitMasking = 'pipe' | 'trailing';
+
+/** `set -o pipefail`, `set -euo pipefail`, `set -e -o pipefail`. */
+const SETS_PIPEFAIL = /^set\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*o\s+pipefail\b/;
+
+/**
+ * Does the exit code of this command line belong to something other than the
+ * command that verified?
+ *
+ * The recorder keeps ONE exit code per call, and it is the last pipeline's.
+ * `tsc | tail -5` reports `tail`'s 0, and `task ci; echo "exit=$?"` reports
+ * `echo`'s 0, so a failing run reads as a pass. Two shapes:
+ *
+ * - `pipe`: a verifying segment pipes into another command, no earlier
+ *   segment on the same line set `pipefail`, and the line does not end the
+ *   shell with `exit`/`return` of `PIPESTATUS`. Printing `PIPESTATUS` does not
+ *   count: the record still holds the printer's code. A pipefail from an rc
+ *   file or a sourced script is invisible here, which is why the reason starts
+ *   as an instrument gap.
+ * - `trailing`: a verifying segment is followed by `;` or `||` and then by a
+ *   command that does not verify. `cmd || true` is a discard and stays
+ *   `failureIsDiscarded`'s case; `cmd || exit 1` / `cmd; exit $?` propagate
+ *   the failure; `task sync; task ci` ends on a verifier whose code is real.
+ */
+export function exitMasking(command: string): ExitMasking | null {
+    if (!command) return null;
+    const segments = splitSegments(stripComment(command));
+    const exitsPipestatus = segments.some(
+        (seg) => /^(?:exit|return)$/.test(seg.words[0] ?? '') && /\bPIPESTATUS\b/.test(seg.words.slice(1).join(' ')),
+    );
+    let pipefailSet = false;
+    for (const seg of segments) {
+        const text = seg.words.join(' ');
+        if (SETS_PIPEFAIL.test(text)) pipefailSet = true;
+        if (failureIsDiscarded(seg) || !segmentVerifies(seg.words)) continue;
+        if (seg.nextSep === '|') {
+            if (!pipefailSet && !exitsPipestatus) return 'pipe';
+            continue;
+        }
+        if (seg.nextSep === ';' || seg.nextSep === '||') {
+            if (failurePropagates(seg, segments)) continue;
+            const next = segments[segments.indexOf(seg) + 1];
+            if (next && segmentVerifies(next.words)) continue;
+            return 'trailing';
+        }
+    }
+    return null;
+}
+
+/** `cmd || exit 1`, `cmd || false`, `cmd; exit $?` — the failure reaches the caller. */
+function failurePropagates(seg: Segment, segments: readonly Segment[]): boolean {
+    const next = segments[segments.indexOf(seg) + 1];
+    if (!next) return true;
+    const head = seg.nextHead;
+    const arg = (next.words[1] ?? '').replace(/^["']|["']$/g, '');
+    if (head === 'exit' || head === 'return') {
+        if (seg.nextSep === '||') return arg !== '0';
+        return arg === '' || arg === '$?';
+    }
+    return seg.nextSep === '||' && head === 'false';
+}
+
 /**
  * The RECORDER's net — deliberately wider than the predicate above, and not a
  * leftover of the two-regex era it replaces.
diff --git a/src/scripts/_lib/verification_evidence.ts b/src/scripts/_lib/verification_evidence.ts
index 383f66da39..7267082a36 100644
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
@@ -357,6 +366,24 @@ export function classifyRun(record: unknown): VerificationVerdict {
         return { kind: 'INVALID_RUN', reason: 'exit_code_unavailable' };
     }
 
+    // A MASKED EXIT CODE belongs to `tail` or `echo`, not to the verifier, so
+    // it is not read — but only where the exit code would decide. A printed
+    // failure, a load failure and an empty suite are read off the output and
+    // keep their verdicts. An exit code the line echoed for the verifier itself
+    // (`; echo "exit=$?"` right after it, or `PIPESTATUS`) is read instead.
+    const masking = exitMasking(r.command);
+    const exitVerdict = (code: number): VerificationVerdict => {
+        let real = code;
+        if (masking !== null) {
+            const echoed = echoesVerifierCode(r.command as string, masking) ? echoedExitCode(text) : null;
+            if (echoed === null) return { kind: 'INVALID_RUN', reason: 'exit_masked' };
+            real = echoed;
+        }
+        return real === 0
+            ? { kind: 'PASS_EVIDENCE_OK' }
+            : { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
+    };
+
     // A LOAD FAILURE, and only where it is not contradicted by a clean summary.
     // The patterns are broad on purpose — `fatal error`, `cannot find module` —
     // and a passing run that merely PRINTS one is common: vitest echoes a
@@ -381,16 +408,34 @@ export function classifyRun(record: unknown): VerificationVerdict {
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
+}
+
+/**
+ * Whether the line echoes the VERIFIER's exit code rather than a filter's:
+ * `PIPESTATUS` names it whatever the shape; `$?` names it only on a trailing
+ * mask, where the echo runs right after the verifier — after a pipe it is the
+ * filter's code.
+ */
+function echoesVerifierCode(command: string, masking: 'pipe' | 'trailing'): boolean {
+    if (/\bPIPESTATUS\b/.test(command)) return true;
+    return masking === 'trailing' && command.includes('$?');
+}
+
+/**
+ * The last exit code the output echoed itself: `exit=1`, `exit code: 0`.
+ *
+ * The shape `echo "exit=$?"` / `echo "exit code: ${PIPESTATUS[0]}"` prints.
+ * The last one wins, because it was printed after the run it reports.
+ */
+function echoedExitCode(text: string): number | null {
+    // A line of its own, so a test name or log line that mentions `exit=1` is not read as one.
+    const matches = [...text.matchAll(/^[ \t]*exit(?:[ _]code)?[ \t]*[=:][ \t]*(\d{1,3})[ \t]*$/gim)];
+    const last = matches[matches.length - 1];
+    return last ? Number(last[1]) : null;
 }
 
 /**
@@ -633,9 +678,15 @@ export function describeRecordFinding(
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
