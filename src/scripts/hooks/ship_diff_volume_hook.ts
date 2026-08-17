#!/usr/bin/env node
/**
 * `ship-diff-volume` — a shipping-intent gate on diff VOLUME.
 *
 * Complementary to `minimal-safe-diff`, not a duplicate of it, and the
 * distinction is the reason this exists: that concern counts unique FILES
 * TOUCHED PER TURN, which is a within-session shape signal. This one measures
 * total changed LINES on the branch AT A SHIP VERB — the moment the change
 * leaves for review. A twelve-turn change of four files each time trips
 * neither; a single-turn 3,000-line change trips only this one.
 *
 * THE THRESHOLD IS DERIVED FROM THIS REPOSITORY'S OWN HISTORY, never copied
 * from the reference that suggested the gate. Replay of the 40 most recently
 * merged PRs (agents/evidence/eval-findings/metric-loop-s04.md) put the
 * corrected p90 at 1,695 lines.
 *
 * THE EXCLUSION SET IS PART OF THE DEFINITION, NOT A TUNING PARAMETER. The
 * same replay found the naive metric double-counting: four of the five largest
 * PRs were dominated by `*.review-input/diff.patch` — a committed copy of the
 * very diff being measured — and the fifth by a generated index. Precision at
 * the raw p90 was 2/5, below the pre-registered 0.50 floor; excluding the
 * repository's own bookkeeping moved it to 5/5. Removing an input that was
 * never shipping volume is a correction. Growing this set until a firing goes
 * away would be tuning, and the kill criterion applies to that.
 *
 * WARN-LEVEL FIRST. It never blocks; escalation waits for one release of
 * recorded firings, per the phase. Exit code is always 0 on the advisory path;
 * 2 is the warn-in-context channel this estate's dispatcher reads.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json } from './state_io.js';

export const STATE_FILE = path.join('agents', 'state', 'ship-diff-volume.json');

/** Derived: corrected p90 over the last 40 merged PRs (spike s04). */
export const DEFAULT_THRESHOLD = 1695;

/**
 * Paths excluded from the volume because they are not shipping volume.
 *
 * Each entry is a category of artefact the change did not author: a snapshot of
 * the diff itself, a generated index, or a projection tree regenerated from
 * source. None is a threshold in disguise.
 */
export const EXCLUDED = [
    '.review-input/', // a committed copy of the diff being measured
    'agents/roadmaps/archive/index.json', // generated index
    'dist/', // projection of src/
    '.augment/',
    '.claude/',
    '.cursor/',
    '.clinerules/',
] as const;

/** Ship verbs — the moment a change leaves for review. */
const SHIP_PATTERNS = [/\bgit\s+push\b/, /\bgh\s+pr\s+create\b/] as const;

export function isShipCommand(cmd: string): boolean {
    return SHIP_PATTERNS.some((re) => re.test(cmd));
}

export function isExcluded(p: string): boolean {
    return EXCLUDED.some((e) => (e.endsWith('/') ? p.startsWith(e) || p.includes(e) : p === e));
}

/** `git diff --numstat` output → corrected volume plus what was excluded. */
export function correctedVolume(numstat: string): { volume: number; excluded: number; files: number } {
    let volume = 0;
    let excluded = 0;
    let files = 0;
    for (const line of numstat.split('\n')) {
        const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
        if (m === null) continue;
        const add = m[1] === '-' ? 0 : Number(m[1]);
        const del = m[2] === '-' ? 0 : Number(m[2]);
        const p = m[3]!;
        if (isExcluded(p)) {
            excluded += add + del;
            continue;
        }
        volume += add + del;
        files += 1;
    }
    return { volume, excluded, files };
}

function extractCommand(envelope: Record<string, unknown>): string {
    const ti = envelope['tool_input'];
    if (ti !== null && typeof ti === 'object') {
        const c = (ti as Record<string, unknown>)['command'];
        if (typeof c === 'string') return c;
    }
    const c = envelope['command'];
    return typeof c === 'string' ? c : '';
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    const idx = args.indexOf('--command');
    let cmd = idx >= 0 && args[idx + 1] !== undefined ? args[idx + 1]! : '';
    if (!cmd) {
        const raw = readHookStdin();
        let envelope: Record<string, unknown> = {};
        if (raw.trim()) {
            try {
                envelope = JSON.parse(raw) as Record<string, unknown>;
            } catch {
                envelope = {};
            }
        }
        cmd = extractCommand(envelope);
    }
    if (!isShipCommand(cmd)) return 0;

    let numstat: string;
    let base: string;
    try {
        base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf-8' }).trim();
        numstat = execFileSync('git', ['diff', '--numstat', `${base}...HEAD`], {
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
        });
    } catch {
        // No merge base, no origin, a detached probe — nothing to say. An
        // advisory concern that guesses on missing input is worse than silent.
        return 0;
    }

    const { volume, excluded, files } = correctedVolume(numstat);
    const over = volume >= DEFAULT_THRESHOLD;

    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        atomic_write_json(STATE_FILE, {
            schema_version: 1,
            base,
            corrected_volume: volume,
            excluded_volume: excluded,
            files_counted: files,
            threshold: DEFAULT_THRESHOLD,
            warning: over,
            checked_at: new Date().toISOString(),
        });
    } catch {
        // State is observability, never the gate. A read-only tree must not
        // turn an advisory warning into a failed ship.
    }

    if (!over) return 0;

    process.stderr.write(
        `ship-diff-volume: ${String(volume)} changed lines against ${DEFAULT_THRESHOLD} ` +
            `(${String(files)} file(s); ${String(excluded)} line(s) excluded as bookkeeping).\n` +
            `Every PR above this line in the last 40 named two or more concerns in its own title. ` +
            `Splitting is a suggestion, not a requirement — this warns and never blocks.\n`,
    );
    return 2; // warn-in-context; advisory severity means the dispatcher does not block
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
