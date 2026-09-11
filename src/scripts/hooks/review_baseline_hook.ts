#!/usr/bin/env node
/**
 * review-baseline — `session_start` concern
 * (road-to-a-question-that-survives-the-turn Phase 2).
 *
 * WHAT IT DOES, and it is the whole of it: on session start, record how many
 * non-doc lines were ALREADY dirty, and what HEAD was. `end-review-nudge`
 * subtracts that at `stop` so a session is charged for its own mutation instead
 * of for whatever the working tree happened to be carrying.
 *
 * THE DEFECT IT CLOSES. `end_review_nudge_hook`'s own header names it: a dirty
 * tree that predates the session is counted as the session's, and the reason it
 * was not fixed was "no such baseline exists anywhere a `stop` concern can read
 * it". That was true of a phase with a one-concern scope, and stale by the time
 * it mattered — `session_start` is bound on seven hosts carrying fourteen
 * concerns. The measured consequence of leaving it: on a branch deliberately
 * accumulating work, the nudge read 1,771 lines of two crashed sessions'
 * uncommitted work and fired every turn. An advisory that always fires is noise,
 * and noise is worse than silence because it trains the reader to skip the one
 * that mattered.
 *
 * MEASURED WITH THE READER'S OWN INSTRUMENT. `totalNonDocMutatedLinesWithMeasure`
 * is imported from the nudge rather than reimplemented, so the two sides cannot
 * drift on what a "non-doc mutated line" is. A second counting implementation
 * would produce a baseline in one unit and a measurement in another, and the
 * subtraction would be silently wrong rather than visibly broken.
 *
 * CAPTURE ONLY. It never emits context, never warns, and always returns 0. A
 * `session_start` concern that could refuse would turn an unreadable git
 * directory into a session that cannot start, which is a far worse failure than
 * the noise it is fixing.
 *
 * NO PATHS, NO FINGERPRINTS. The record is two numbers and a timestamp. A
 * path-level change set was the shape the source draft proposed; it is a bigger
 * object with a bigger privacy surface, and nothing in the nudge consumes one.
 * The file cannot hold a path, a diff or a file body by construction, which is
 * the same PII-exclusion-by-construction the telemetry record keeps.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    baselineStateFile,
    currentHeadSha,
    type ReviewBaseline,
} from '../_lib/review_baseline.js';
import { deriveSessionKey, totalNonDocMutatedLinesWithMeasure } from './end_review_nudge_hook.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json } from './state_io.js';

const EXIT_OK = 0;

export function buildBaseline(workspaceRoot: string, now: Date = new Date()): ReviewBaseline {
    const measured = totalNonDocMutatedLinesWithMeasure(workspaceRoot);
    return {
        head_sha: currentHeadSha(workspaceRoot),
        baseline_lines: measured.lines,
        // Carried, not discarded. Past `UNTRACKED_FILE_CAP` the count is a
        // synthetic `THRESHOLD + 1 + tracked` chosen to be over the bar rather
        // than to be true, and subtracting that from a later exact count is
        // arithmetic over two different quantities. The consumer refuses the
        // subtraction when the two measures disagree; it can only do that if the
        // writer says which one it took.
        measure: measured.measure,
        written_at: now.toISOString(),
    };
}

export function main(): number {
    let envelope: JsonObject;
    let payload: JsonObject;
    try {
        [envelope, payload] = unwrap(readHookStdin(), 'claude');
    } catch {
        return EXIT_OK;
    }

    const event = String(envelope['event'] ?? '');
    if (event !== '' && event !== 'session_start') return EXIT_OK;

    const workspaceRoot =
        String((envelope['workspace_root'] as JsonValue | undefined) ?? '').trim() || process.cwd();

    // A baseline is written ONCE per session. A host that fires session_start
    // twice — Cline maps both TaskStart and TaskResume onto it — must not
    // re-baseline mid-session: the second write would fold everything the
    // session had already changed into its own baseline and the nudge would go
    // permanently quiet for that session. Over-writing is the silent failure
    // direction, so it is the one guarded.
    const sessionKey = deriveSessionKey(envelope, payload);
    const file = baselineStateFile(workspaceRoot, sessionKey);
    try {
        if (fs.existsSync(file)) return EXIT_OK;
    } catch {
        return EXIT_OK;
    }

    try {
        // `atomic_write_json` is already `AGENT_CONFIG_REPLAY`-aware, so a
        // fixture-replay run leaves no baseline behind.
        atomic_write_json(file, buildBaseline(workspaceRoot) as unknown as JsonObject);
    } catch {
        // An unwritable state dir degrades to today's behaviour — the nudge
        // reads `absent` and does not subtract. Never a failed session start.
    }
    return EXIT_OK;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
