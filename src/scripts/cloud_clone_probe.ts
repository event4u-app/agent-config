#!/usr/bin/env tsx
/**
 * `cloud_clone_probe` — simulate what a Claude Code cloud session receives from
 * a repository (road-to-an-install-the-cloud-clone-carries, 0.2).
 *
 * Clones the repository locally into a temp dir (no network: the source is a
 * path), points `HOME` at an empty dir and sets `CLAUDE_CODE_REMOTE=true`, then
 * runs the `cloud-reach` measurement on the clone and prints JSON. The temp dirs
 * are removed afterwards; the source repository is only read.
 *
 * NOT A GATE: no `lint_`/`check_` prefix, no gate-coverage row. It produces a
 * baseline a human records; it never fails a build.
 *
 * Usage: ./scripts-run src/scripts/cloud_clone_probe [repo-path]
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkCloudReach, measureCloudReach, type CloudReach } from './_lib/cloud_reach.js';

export interface CloneProbeResult {
    schema_version: 1;
    source_head: string;
    simulated_env: { HOME: 'empty'; CLAUDE_CODE_REMOTE: 'true' };
    measurement: CloudReach | null;
    check: { status: string; message: string };
}

export function probeClone(source: string): CloneProbeResult {
    const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: source }).toString().trim();
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-clone-'));
    const home = path.join(work, 'home');
    const clone = path.join(work, 'clone');
    fs.mkdirSync(home);
    try {
        execFileSync('git', ['clone', '--quiet', '--no-hardlinks', source, clone], {
            stdio: 'ignore',
            env: { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
        });
        const env = { HOME: home, CLAUDE_CODE_REMOTE: 'true', PATH: process.env['PATH'] ?? '' };
        const check = checkCloudReach(clone, env);
        return {
            schema_version: 1,
            source_head: head,
            simulated_env: { HOME: 'empty', CLAUDE_CODE_REMOTE: 'true' },
            measurement: measureCloudReach(clone),
            check: { status: check.status, message: check.message },
        };
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
}

function main(argv: string[]): number {
    const source = path.resolve(argv[0] ?? process.cwd());
    process.stdout.write(JSON.stringify(probeClone(source), null, 2) + '\n');
    return 0;
}

function isCliEntry(): boolean {
    if (!process.argv[1]) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
