/**
 * Every `cli-delegate` bundle must actually run.
 *
 * `exec_ts` in the Bash dispatcher prefers `dist/cli-delegate/<name>.js` over the
 * `.ts` source, so a consumer never executes the file a developer tests. Four
 * commands shipped as **silent no-ops** because of that gap — `agent-config
 * doctor`, `migrate`, `refresh` and `session:recycle` each produced zero bytes
 * and exit 0 on every installed copy, while the same sources ran correctly under
 * `tsx`.
 *
 * The cause was not one bug. `--splitting` turns an entry file into a re-export
 * shim and moves the module body into a shared chunk, where `import.meta.url` is
 * the CHUNK's url and can never equal `process.argv[1]` — so an entry guard
 * written as that comparison fires or does not fire depending on where esbuild
 * happened to place the code. Commands that worked did so by accident, and any
 * dependency change can flip one into silence.
 *
 * Which is why this test executes the bundles rather than inspecting them: a
 * bundle that does nothing and exits 0 is indistinguishable from a working one
 * by every means except running it. It found the fourth command (`refresh`)
 * after the first three had been fixed by hand.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(REPO, 'dist', 'cli-delegate');

/**
 * Run one bundle and report what actually happened.
 *
 * `died` is separate from the exit code on purpose: a timeout kill, a signal,
 * and a spawn failure all arrive with a null/undefined status, and folding them
 * into "exit 1" would let a HUNG entry guard — a plausible regression — read as
 * a healthy non-zero exit. The assertion below is `bytes > 0 && !died`, so every
 * abnormal end fails rather than only the one shape that shipped.
 */
function probe(bundle: string): { code: number; bytes: number; died: string | null } {
    try {
        const out = execFileSync(process.execPath, [bundle, '--help'], {
            cwd: REPO,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30_000,
        });
        return { code: 0, bytes: out.length, died: null };
    } catch (err) {
        const e = err as {
            status?: number | null;
            signal?: string | null;
            code?: string;
            stdout?: string;
            stderr?: string;
        };
        const bytes = (e.stdout ?? '').length + (e.stderr ?? '').length;
        if (typeof e.status === 'number') {
            return { code: e.status, bytes, died: null };
        }
        return {
            code: -1,
            bytes,
            died: e.signal ? `killed by ${e.signal}` : (e.code ?? 'spawn failed'),
        };
    }
}

describe('cli-delegate bundles', () => {
    let bundles: string[] = [];

    beforeAll(() => {
        // The REAL build script, not a re-spelled esbuild call: a test that
        // rebuilds with its own flags proves nothing about what ships. Measured
        // ~2.5s for the whole file, most of it the 29 node spawns below; esbuild
        // itself is ~50ms and the npm wrapper the rest.
        try {
            execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
                'run',
                '--silent',
                'build:cli-delegate',
            ], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 120_000 });
        } catch (err) {
            // Surface the compiler diagnostics. Swallowing them leaves the suite
            // red with nothing to read, in a file written to diagnose exactly
            // that kind of silence.
            const e = err as { stdout?: string; stderr?: string };
            throw new Error(
                `build:cli-delegate failed\n${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim(),
            );
        }
        bundles = fs
            .readdirSync(OUT_DIR)
            .filter((n) => n.startsWith('cmd_') && n.endsWith('.js'))
            .sort();
    }, 130_000);

    it('the build produces a bundle per _cli command', () => {
        // Guards the guard: a sweep over an empty outdir passes vacuously. The
        // build globs `src/scripts/_cli/cmd_*.ts`, so the relation is exactly
        // one bundle per source. An earlier version allowed a slack of three for
        // no reason, which would have let three commands drop out of the build
        // and still report green — the failure class this file exists for.
        const sources = fs
            .readdirSync(path.join(REPO, 'src', 'scripts', '_cli'))
            .filter((n) => n.startsWith('cmd_') && n.endsWith('.ts'))
            .map((n) => n.replace(/\.ts$/, ''))
            .sort();
        expect(bundles.map((n) => n.replace(/\.js$/, ''))).toEqual(sources);
    });

    it('no bundle is a silent no-op', () => {
        const broken: string[] = [];
        for (const name of bundles) {
            const { code, bytes, died } = probe(path.join(OUT_DIR, name));
            // Zero output is the signature of the shipped defect: the entry guard
            // did not fire and `main` never ran. `died` covers the neighbours a
            // status-only check would have called healthy.
            if (died !== null) {
                broken.push(`${name} (${died})`);
            } else if (bytes === 0) {
                broken.push(`${name} (no output, exit ${String(code)})`);
            }
        }
        expect(broken).toEqual([]);
    }, 120_000);
});
