#!/usr/bin/env tsx
/**
 * Refresh `tests/timing-manifest.json`, the per-file seconds the balanced
 * vitest sequencer (`tests/_lib/balanced-sequencer.ts`) assigns shards by.
 *
 * Input is the log of the node-tests jobs of one CI run, as
 * `gh run view --job <id> --log` prints it: every file line of vitest's default
 * reporter carries the file's duration, and the line prefix names the job, so
 * the OS comes from the log itself. Measured on CI rather than locally, because
 * a laptop's relative file costs are not a runner's.
 *
 * Usage:
 *   ./scripts-run src/scripts/plan_test_shards --run <run-id> [--write]
 *   ./scripts-run src/scripts/plan_test_shards --from-logs <file...> [--write]
 *
 * Without --write it prints the summary and leaves the manifest alone.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'tests', 'timing-manifest.json');
const REPO = 'event4u-app/agent-config';

const ANSI = /\x1b\[[0-9;]*m|\^\[\[[0-9;]*m/g;
const FILE_LINE = /(?:✓|×|↓)\s+(?:\S+\s+)?((?:tests|src)\/\S+\.test\.tsx?)\s+\([^)]*\)\s+(\d+)ms\s*$/;

export interface Durations {
    ubuntu: Record<string, number>;
    macos: Record<string, number>;
}

/** Per-file seconds by OS from one or more node-tests job logs. */
export function parseLogs(text: string): Durations {
    const out: Durations = { ubuntu: {}, macos: {} };
    for (const raw of text.split('\n')) {
        const line = raw.replace(ANSI, '');
        const m = FILE_LINE.exec(line);
        if (m === null) continue;
        const os = /macos/i.test(line.split('\t')[0] ?? '') ? 'macos' : 'ubuntu';
        out[os][m[1] as string] = Math.round(Number(m[2]) / 10) / 100;
    }
    return out;
}

function sortedRecord(r: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.entries(r).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function logsForRun(runId: string): string {
    const jobs = spawnSync('gh', ['api', `repos/${REPO}/actions/runs/${runId}/jobs?per_page=100`, '--jq',
        '.jobs[] | select(.name|startswith("Node Tests")) | .id'], { encoding: 'utf-8' });
    if (jobs.status !== 0) throw new Error(`gh api failed: ${jobs.stderr}`);
    return jobs.stdout
        .split('\n')
        .filter((id) => id.trim() !== '')
        .map((id) => {
            const r = spawnSync('gh', ['run', 'view', '--job', id.trim(), '--repo', REPO, '--log'], {
                encoding: 'utf-8',
                maxBuffer: 256 * 1024 * 1024,
            });
            if (r.status !== 0) throw new Error(`gh run view --job ${id} failed: ${r.stderr}`);
            return r.stdout;
        })
        .join('\n');
}

export function main(argv: readonly string[]): number {
    const runAt = argv.indexOf('--run');
    const logsAt = argv.indexOf('--from-logs');
    let text: string;
    let source: string;
    if (runAt >= 0 && argv[runAt + 1] !== undefined) {
        source = `run ${argv[runAt + 1] as string}`;
        text = logsForRun(argv[runAt + 1] as string);
    } else if (logsAt >= 0) {
        const files = argv.slice(logsAt + 1).filter((a) => !a.startsWith('--'));
        source = files.map((f) => path.basename(f)).join(', ');
        text = files.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
    } else {
        process.stderr.write('usage: plan_test_shards --run <run-id> | --from-logs <file...> [--write]\n');
        return 2;
    }
    const d = parseLogs(text);
    const n = { ubuntu: Object.keys(d.ubuntu).length, macos: Object.keys(d.macos).length };
    process.stdout.write(`files with a duration: ubuntu ${String(n.ubuntu)} · macos ${String(n.macos)}\n`);
    if (n.ubuntu === 0 || n.macos === 0) {
        process.stderr.write('❌  no durations for one OS — refusing to write a manifest that would balance nothing\n');
        return 1;
    }
    if (argv.includes('--write')) {
        const manifest = { source, ubuntu: sortedRecord(d.ubuntu), macos: sortedRecord(d.macos) };
        fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
        process.stdout.write(`wrote ${path.relative(REPO_ROOT, MANIFEST)}\n`);
    }
    return 0;
}

if (process.argv[1] !== undefined && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url) {
    process.exit(main(process.argv.slice(2)));
}
