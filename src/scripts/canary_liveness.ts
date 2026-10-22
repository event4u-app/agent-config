#!/usr/bin/env node
/**
 * Liveness of the weekly cross-model canary (free-hands 5.3, gateway M9).
 *
 * ADR-118 makes the canary's red the maintainer notification, and six ignored
 * scheduled reds made it decorative. No new scheduled workflow: this reads the
 * existing workflow's scheduled runs, and a streak of three or more reds writes
 * one status line that `agent-config doctor` and the session-start
 * council-availability fact surface. One green run clears it.
 *
 * Usage:
 *   ./scripts-run src/scripts/canary_liveness [--refresh] [--json]
 *
 * `--refresh` asks `gh` for the workflow's recent scheduled runs; without it the
 * recorded state is printed. Nothing here calls a model or spends anything.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { CANARY_LIVENESS_RELPATH, CANARY_RED_STREAK, readCanaryStatusLine } from './_lib/canary_status.js';
import { sanitize_text } from './_lib/retrieval_sanitize.js';

const _ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export const CANARY_WORKFLOW = 'cross-model-canary.yml';

export interface CanaryRun {
    readonly id: number;
    /** The run's conclusion as `gh` reports it: `success`, `failure`, `skipped`, `cancelled`, … */
    readonly conclusion: string;
    readonly created_at: string;
}

export interface CanaryLiveness {
    readonly red_streak: number;
    /** `created_at` of the oldest red in the current streak; null without a streak. */
    readonly red_since: string | null;
    readonly last_run_id: number | null;
}

/** A red counts, a green ends the streak, anything else (skipped, cancelled, pending) is no evidence. */
export function foldCanaryRuns(runs: readonly CanaryRun[]): CanaryLiveness {
    const newestFirst = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at));
    let red_streak = 0;
    let red_since: string | null = null;
    for (const r of newestFirst) {
        if (r.conclusion === 'success') break;
        if (r.conclusion !== 'failure' && r.conclusion !== 'timed_out') continue;
        red_streak += 1;
        red_since = r.created_at;
    }
    return { red_streak, red_since, last_run_id: newestFirst[0]?.id ?? null };
}

export function statusLine(l: CanaryLiveness): string | null {
    if (l.red_streak < CANARY_RED_STREAK || l.red_since === null) return null;
    return (
        `cross-model canary: ${String(l.red_streak)} scheduled runs red in a row since ${l.red_since.slice(0, 10)} — ` +
        `the live tier is not answering; read \`gh run list --workflow ${CANARY_WORKFLOW} --event schedule\``
    );
}

export function recordCanaryRuns(repoRoot: string, runs: readonly CanaryRun[], now: Date = new Date()): string | null {
    const l = foldCanaryRuns(runs);
    const line = statusLine(l);
    const target = path.join(repoRoot, CANARY_LIVENESS_RELPATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify({ ...l, observed_at: now.toISOString(), line }, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, target);
    return line;
}

/** The workflow's recent scheduled runs, or null when `gh` cannot answer. */
export function fetchScheduledRuns(cwd: string): CanaryRun[] | null {
    const r = spawnSync(
        'gh',
        ['run', 'list', '--workflow', CANARY_WORKFLOW, '--event', 'schedule', '--limit', '10', '--json', 'databaseId,conclusion,createdAt'],
        { cwd, encoding: 'utf8', timeout: 30_000 },
    );
    if (r.status !== 0) return null;
    try {
        // `created_at` reaches the session-start context, so only a timestamp shape is kept.
        const rows = JSON.parse(sanitize_text(r.stdout)) as { databaseId?: unknown; conclusion?: unknown; createdAt?: unknown }[];
        return rows
            .filter((x) => typeof x.databaseId === 'number' && typeof x.createdAt === 'string' && _ISO_TS.test(x.createdAt))
            .map((x) => ({
                id: x.databaseId as number,
                conclusion: typeof x.conclusion === 'string' && /^[a-z_]+$/.test(x.conclusion) ? x.conclusion : '',
                created_at: x.createdAt as string,
            }));
    } catch {
        return null;
    }
}

export function main(argv: readonly string[], cwd: string = process.cwd()): number {
    if (argv.includes('--refresh')) {
        const runs = fetchScheduledRuns(cwd);
        if (runs === null) {
            process.stderr.write('canary_liveness: gh could not list the scheduled runs; the recorded state is unchanged\n');
            return 3;
        }
        recordCanaryRuns(cwd, runs);
    }
    const line = readCanaryStatusLine(cwd);
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ line })}\n`);
    else process.stdout.write(`${line ?? 'cross-model canary: no red streak recorded'}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
