#!/usr/bin/env node
// The Phase 7 execution universe and red predicate, recorded as code. The
// universe is every `src/scripts/check_*.ts` and `lint_*.ts` at a revision; a
// script is run with no arguments from the repository root under a timeout, and
// its outcome is classified by the predicate below.
//
//   node gate-phase7-harness.mjs --universe [rev]   list the universe at rev (default HEAD)
//   node gate-phase7-harness.mjs --run <id> [...]   run scripts at the working tree and classify
import { execFileSync, spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DISCOVERY = /^src\/scripts\/(check|lint)_[a-z0-9_]+\.ts$/;
export const TIMEOUT_MS = 240_000;

export function universe(rev = 'HEAD') {
    return execFileSync('git', ['ls-tree', '--name-only', rev, 'src/scripts/'], { cwd: ROOT, encoding: 'utf8' })
        .split('\n')
        .filter((f) => DISCOVERY.test(f))
        .map((f) => path.basename(f, '.ts'))
        .sort();
}

/**
 * The predicate, in decision order; the first rule that matches decides.
 * `not-run` (no exit code, e.g. spawn failure or timeout) is never green.
 */
export function classify({ status, output }) {
    if (status === null) return 'not-run';
    if (status === 0) return 'green';
    if (/^usage:|\busage: /im.test(output) && status === 2) return 'needs-argument';
    if (/ENOENT[^\n]*(dist\/|\.claude\/|\.augment\/)|run `task (sync|generate-tools)`|not built/i.test(output)) return 'needs-build';
    return 'red';
}

export function run(id) {
    const res = spawnSync(path.join(ROOT, 'scripts-run'), [`src/scripts/${id}`], { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_MS });
    return { id, status: res.status, outcome: classify({ status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` }) };
}

const argv = process.argv.slice(2);
if (argv[0] === '--universe') {
    const u = universe(argv[1] ?? 'HEAD');
    for (const id of u) console.log(id);
    console.log(`# ${u.length} scripts at ${argv[1] ?? 'HEAD'}`);
} else if (argv[0] === '--run') {
    for (const id of argv.slice(1)) {
        const r = run(id);
        console.log(`${r.id} | exit ${String(r.status)} | ${r.outcome}`);
    }
} else {
    console.error('usage: gate-phase7-harness.mjs --universe [rev] | --run <id> [...]');
    process.exit(2);
}
