<!-- evidence-type: analysis -->

# Ratification review — the dispatch bundle ceiling for detector G and the exit-code classifier — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose byte ceiling for the hook dispatch bundle (`dist/hooks/dispatch.js`, loaded by every hook event) is raised. ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it.

subject: f754a3925725cf6de089929bf4d1dfb3e296ca9258f0e223575c9b586c6a96a2

(The digest covers the gated file at commit `ecd13e5d92` on branch `feat/done-claims-with-read-exit-codes`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Roadmap `road-to-done-claims-with-read-exit-codes` adds three things to the turn-end hook path:

1. **Masked exit codes.** `_lib/verification_command.ts` classifies a verification command whose exit code is not the verifier's (`cmd | tail` without `pipefail`, `cmd; echo …`, a trailing `|| true`) as `exit_masked`, and peels an `rtk` wrapper so `rtk vitest run` is still recognised as a verifier. `_lib/verification_evidence.ts` records `exit_masked` as an instrument-gap reason: it is counted, it never refuses a turn.
2. **Detector G (`coverage`).** `_lib/coverage_claim.ts`: a reply that claims done and reports `N of M` with N < M (`partial_ratio`), or a turn that edited a runnable surface, ran nothing that drives it, and claims done without a `Not verified:` list (`unlisted_surface`). It RECORDS into per-session counters (`<key>.recorded.json`) and never refuses; `refusingFindings` drops it from the verdict.
3. **Live surfaces.** `derive_live_surfaces.ts` derives runnable surfaces from repo files (package.json dev/start/preview/serve, tauri.conf.json, playwright baseURL, compose ports, Taskfile dev/run/serve). Detector G derives them in memory; the `verify:surfaces` CLI verb writes them to `agents/state/live-surfaces.json`.

A council (analysis, 2026-11-21, one round; the openai seat answered, the anthropic seat failed) kept all three new reasons record-only with per-reason revisit conditions (recorded as D5-D7 in the roadmap). Nothing in this change refuses a turn that was allowed before.

**Budget.** Measured by the gate's own build: 1,612,990 B with the change against 1,595,228 B on origin/main `4bb96fb2fb` (+17,762 B). Per input: `derive_live_surfaces.ts` 8,560 B, `_lib/coverage_claim.ts` 5,490 B, the rest is growth in the classifier, the refusal plumbing and the hook. The ceiling rises 1,595,300 → 1,613,150 B (measurement plus 160 B) with a `raise_log` entry. The entry says plainly that the raise is not unavoidable: a conditional chunk loaded only when the completion trigger matches could take about 14 KB off every other event's parse. It was not split because G is record-only while its arming is measured and detector D shares the completion trigger from the same module, so a split needs its own loader, digest check, chunk ceiling and schema pin.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the code shown whose bytes it pays for — that should block the raise? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Is the ceiling raise sized to the measurement, and is the stated chunk alternative a reason to refuse this raise now rather than a revisit condition?
3. Does any new detector or reason refuse a turn, or otherwise change a verdict the hook returns?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
✅  hook bundle: 1612990 B / 1613150 B ceiling, 1 YAML reader(s) [yaml], 345 modules
origin/main 4bb96fb2fb: 1595228 B / 1595300 B ceiling
per input, bytes in output: derive_live_surfaces.ts 8560 · _lib/coverage_claim.ts 5490 · _lib/verification_evidence.ts 11343 · _lib/verification_command.ts 7717 · _lib/turn_end_refusals.ts 9135 · hooks/turn_end_gate_hook.ts 19732
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..14d44dd049 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1613150,
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
+            "to": 1613150,
+            "by": "agent, feat/done-claims-with-read-exit-codes (road-to-done-claims-with-read-exit-codes Phases 1, 3 and 4)",
+            "what_was_added": "Detector G of turn-end-gate (`_lib/coverage_claim.ts`, 5,490 B) with the live-surface derivation it reads (`derive_live_surfaces.ts`, 8,560 B), and the masked-exit-code classification in `_lib/verification_command.ts` / `_lib/verification_evidence.ts` with the record-only refusal plumbing in `_lib/turn_end_refusals.ts` and the hook (about 3,700 B together). Measured by this gate: 1,612,990 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +17,762 B.",
+            "why_it_could_not_be_avoided": "Not unavoidable in the strict sense, and stated as such: a conditional chunk loaded only when the completion trigger matches could carry the detector body and the derivation (about 14 KB) off the parse of every other hook event. It was not split here because detector G is record-only while its arming is measured (council D5-D7, 2026-11-21: all three new reasons record-only), and detector D takes the shared completion trigger from the same module, so the split needs its own loader, digest check, chunk ceiling and schema pin. If G is armed, or the next concern needs room, that chunk is the move. Room already made: the hook source sat at its line ceiling, so the detector body lives in its own module, and the derivation is shared with the `verify:surfaces` verb rather than written twice. Sized to the measurement plus 160 B.",
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

import { deriveLiveSurfaces, type LiveSurface } from '../derive_live_surfaces.js';
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

/** A call that drove `surface`: its start command, its URL, or a real render or browser run. */
function drives(command: string, surface: LiveSurface): boolean {
    if (/\bui:render\b|\bplaywright\s+test\b/.test(command)) return true;
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
    surfaces: readonly LiveSurface[] = deriveLiveSurfaces(workspaceRoot),
): CoverageFinding | null {
    if (surfaces.length === 0 || completionClaimAt(visible) === null) return null;
    const edits = calls.filter((c) => EDIT_TOOLS.has(c.name) && c.path !== undefined).map((c) => c.path as string);
    if (edits.length === 0) return null;
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
        if (names.some((n) => listed.includes(n))) continue;
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

## New file: `src/scripts/derive_live_surfaces.ts`

```ts
#!/usr/bin/env tsx
/**
 * The reachability map: every surface a repo can run, derived from its files.
 *
 * A completion claim over a change to an app is only as good as the check that
 * drove the app. Before an agent can say what it did NOT verify, it needs to
 * know what there was to verify, and that list must not depend on anyone
 * writing it down: a hand-kept list goes stale the day a script is renamed,
 * and the owner asked for none (2026-11-21). So every entry here is read off a
 * file the repo already keeps, and names the file and line it came from.
 *
 * Read: `package.json` scripts `dev|start|preview|serve`, `tauri.conf.json`
 * windows (repo root or `src-tauri/`), `playwright.config.*` `baseURL`,
 * `docker-compose*.yml` / `compose*.yml` service ports, and Taskfile tasks
 * `dev|run|serve`. A repo whose app starts some other way reads as having no
 * surface, which is a miss the verify skill names rather than a pass.
 *
 * Writes `agents/state/live-surfaces.json` (gitignored) and regenerates it when
 * any input file is newer than the map.
 *
 * Usage:
 *   agent-config verify:surfaces [--root DIR] [--json] [--quiet]
 *
 * Exit 0 always on a readable root; 2 on a usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'derive_live_surfaces';

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

function readText(file: string): string | null {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
}

function rel(root: string, file: string): string {
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

function derive(root: string): { surfaces: LiveSurface[]; inputs: string[] } {
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

function mtime(file: string): number {
    try {
        return fs.statSync(file).mtimeMs;
    } catch {
        return Number.NaN;
    }
}

/**
 * The map, regenerated when it is missing, unreadable, or older than any input
 * it was derived from (or any input that now exists and did not then).
 */
export function ensureLiveSurfaces(root: string, force = false): LiveSurfaceMap {
    const out = path.join(root, LIVE_SURFACES_REL);
    if (!force) {
        const outAt = mtime(out);
        const cached = readText(out);
        if (cached !== null && Number.isFinite(outAt)) {
            try {
                const map = JSON.parse(cached) as LiveSurfaceMap;
                const fresh = derive(root).inputs;
                const stale = fresh.some((f) => !(mtime(f) <= outAt))
                    || fresh.length !== (map.inputs ?? []).length;
                if (!stale && Array.isArray(map.surfaces)) return map;
            } catch {
                // Unreadable map: regenerate below.
            }
        }
    }
    const { surfaces, inputs } = derive(root);
    const map: LiveSurfaceMap = {
        generated_at: new Date().toISOString(),
        inputs: inputs.map((f) => rel(root, f)),
        surfaces,
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);
    return map;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    // The dispatcher strips a global `--root` and exports it here, so
    // `agent-config verify:surfaces --root X` reaches this default, not argv.
    let root = process.env['AGENT_CONFIG_PROJECT_ROOT'] || process.cwd();
    let quiet = false;
    let asJson = false;
    let force = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(`${_PROG}: --root needs a path\n`);
                return 2;
            }
            root = path.resolve(next);
            i += 1;
        } else if (a === '--quiet') {
            quiet = true;
        } else if (a === '--json') {
            asJson = true;
        } else if (a === '--force') {
            force = true;
        } else {
            process.stderr.write('usage: verify:surfaces [--root DIR] [--json] [--force] [--quiet]\n');
            return 2;
        }
    }
    const map = ensureLiveSurfaces(root, force);
    if (quiet) return 0;
    if (asJson) {
        process.stdout.write(`${JSON.stringify(map, null, 2)}\n`);
        return 0;
    }
    if (map.surfaces.length === 0) {
        process.stdout.write(
            `no runnable surface derived under ${root} — a change here has no live check to owe, ` +
                'or the repo starts its app in a way this reader does not know (list it as not verified)\n',
        );
        return 0;
    }
    for (const s of map.surfaces) {
        const where = s.url ?? s.size ?? '';
        process.stdout.write(`${s.kind}\t${s.name}\t${s.start ?? '—'}\t${where}\t${s.derived_from}\n`);
    }
    return 0;
}

// Detector G imports this module into the hook bundle, where every module
// shares the bundle's `import.meta.url`; the bundle flag keeps `main()` from
// running on a hook dispatch.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
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
index c0beb7f9a0..77a99da362 100644
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
@@ -349,6 +362,65 @@ export function isVerificationCommand(command: string): boolean {
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
+ * - `pipe`: a verifying segment pipes into another command, and no earlier
+ *   segment on the same line set `pipefail`, and the line never reads
+ *   `PIPESTATUS`. A pipefail from an rc file or a sourced script is invisible
+ *   here, which is why the reason starts as an instrument gap.
+ * - `trailing`: a verifying segment is followed by `;` or `||` and then by a
+ *   command that does not verify. `cmd || true` is a discard and stays
+ *   `failureIsDiscarded`'s case; `cmd || exit 1` / `cmd; exit $?` propagate
+ *   the failure; `task sync; task ci` ends on a verifier whose code is real.
+ */
+export function exitMasking(command: string): ExitMasking | null {
+    if (!command) return null;
+    const segments = splitSegments(stripComment(command));
+    const readsPipestatus = /\bPIPESTATUS\b/.test(command);
+    let pipefailSet = false;
+    for (const seg of segments) {
+        const text = seg.words.join(' ');
+        if (SETS_PIPEFAIL.test(text)) pipefailSet = true;
+        if (failureIsDiscarded(seg) || !segmentVerifies(seg.words)) continue;
+        if (seg.nextSep === '|') {
+            if (!pipefailSet && !readsPipestatus) return 'pipe';
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
index 383f66da39..3475a0c35e 100644
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
@@ -357,6 +366,17 @@ export function classifyRun(record: unknown): VerificationVerdict {
         return { kind: 'INVALID_RUN', reason: 'exit_code_unavailable' };
     }
 
+    // A MASKED EXIT CODE belongs to `tail` or `echo`, not to the verifier, so
+    // it is not read. Printed failures above still win, because they
+    // happened. An exit code the command echoed itself (`echo "exit=$?"`) is
+    // the verifier's own and is read instead.
+    let exitCode: number = r.exit_code;
+    if (exitMasking(r.command) !== null) {
+        const echoed = echoedExitCode(text);
+        if (echoed === null) return { kind: 'INVALID_RUN', reason: 'exit_masked' };
+        exitCode = echoed;
+    }
+
     // A LOAD FAILURE, and only where it is not contradicted by a clean summary.
     // The patterns are broad on purpose — `fatal error`, `cannot find module` —
     // and a passing run that merely PRINTS one is common: vitest echoes a
@@ -381,18 +401,30 @@ export function classifyRun(record: unknown): VerificationVerdict {
         if (summary.total !== null && summary.total > 0 && summary.passed === 0) {
             return { kind: 'INVALID_RUN', reason: 'zero_tests_discovered' };
         }
-        if (r.exit_code !== 0) {
+        if (exitCode !== 0) {
             return { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
         }
         return { kind: 'PASS_EVIDENCE_OK' };
     }
 
-    if (r.exit_code !== 0) {
+    if (exitCode !== 0) {
         return { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
     }
     return { kind: 'PASS_EVIDENCE_OK' };
 }
 
+/**
+ * The last exit code the output echoed itself: `exit=1`, `exit code: 0`.
+ *
+ * The shape `echo "exit=$?"` / `echo "exit code: ${PIPESTATUS[0]}"` prints.
+ * The last one wins, because it was printed after the run it reports.
+ */
+function echoedExitCode(text: string): number | null {
+    const matches = [...text.matchAll(/\bexit(?:[ _]code)?\s*[=:]\s*(\d{1,3})\b/gi)];
+    const last = matches[matches.length - 1];
+    return last ? Number(last[1]) : null;
+}
+
 /**
  * The runner a command names, or `other`.
  *
@@ -633,9 +665,15 @@ export function describeRecordFinding(
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
