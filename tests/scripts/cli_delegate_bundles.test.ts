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

/** Run one bundle and report whether it produced anything at all. */
function probe(bundle: string): { code: number; bytes: number } {
    try {
        const out = execFileSync(process.execPath, [bundle, '--help'], {
            cwd: REPO,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30_000,
        });
        return { code: 0, bytes: out.length };
    } catch (err) {
        const e = err as { status?: number; stdout?: string; stderr?: string };
        return {
            code: typeof e.status === 'number' ? e.status : 1,
            bytes: (e.stdout ?? '').length + (e.stderr ?? '').length,
        };
    }
}

describe('cli-delegate bundles', () => {
    let bundles: string[] = [];

    beforeAll(() => {
        // The REAL build script, not a re-spelled esbuild call: a test that
        // rebuilds with its own flags proves nothing about what ships. ~50ms.
        execFileSync('npm', ['run', '--silent', 'build:cli-delegate'], {
            cwd: REPO,
            stdio: 'ignore',
            timeout: 120_000,
        });
        bundles = fs
            .readdirSync(OUT_DIR)
            .filter((n) => n.startsWith('cmd_') && n.endsWith('.js'))
            .sort();
    }, 130_000);

    it('the build produces a bundle per _cli command', () => {
        // Guards the guard: if the outdir were empty the sweep below would pass
        // over nothing and report green, which is the failure class this whole
        // test exists for.
        const sources = fs
            .readdirSync(path.join(REPO, 'src', 'scripts', '_cli'))
            .filter((n) => n.startsWith('cmd_') && n.endsWith('.ts'));
        expect(sources.length).toBeGreaterThan(20);
        expect(bundles.length).toBeGreaterThanOrEqual(sources.length - 3);
    });

    it('no bundle is a silent no-op', () => {
        const silent: string[] = [];
        for (const name of bundles) {
            const { code, bytes } = probe(path.join(OUT_DIR, name));
            // Exit 0 with no output at all is the signature: the entry guard did
            // not fire, `main` never ran, and the process reported success.
            if (code === 0 && bytes === 0) {
                silent.push(name);
            }
        }
        expect(silent).toEqual([]);
    }, 120_000);
});
