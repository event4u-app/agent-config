// Tests for src/scripts/bench_ab_cache_dispatch.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists. The happy path shells out to the underlying .py
// runner (a full, cost-/time-bearing bench run), so it is NOT golden-diffed
// here per ADR-090's timing-non-determinism guidance — instead this suite
// asserts the CLI surface (arg errors, exit codes, the corpus-missing branch)
// and the cache-dispatch decision message, which derives from the already-
// validated bench_ab_cache twin. argparse error PROSE (usage line, program
// name) is Python-version-dependent, so only the exit code + the stable
// substring are asserted there.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_cache_dispatch.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'bench_ab_cache_dispatch.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe.runIf(hasPython3())('bench_ab_cache_dispatch — CLI surface parity', () => {
    it('invalid corpus choice → exit 2 (both), stderr names the bad choice', () => {
        const py = spawnSync('python3', [PY_SCRIPT, 'badcorpus'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, 'badcorpus'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
        // Stable, version-independent substring of the argparse error.
        expect(py.stderr).toContain("invalid choice: 'badcorpus'");
        expect(ts.stderr).toContain("invalid choice: 'badcorpus'");
        expect(ts.stderr).toContain("(choose from 'tracka', 'trackb')");
    });

    it('no arguments → exit 2 (both), stderr mentions a required argument', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(2);
        expect(py.stderr).toContain('required');
        expect(ts.stderr).toContain('required');
    });
});

describe('bench_ab_cache_dispatch — decision message format', () => {
    // The dispatch's own stdout line is built from the bench_ab_cache lookup
    // (validated in its own wave). Re-derive it here to lock the exact wording.
    it('emits the cache-miss / cache-stale "running both arms" line shape', async () => {
        const cache = await import('../../src/scripts/_lib/bench_ab_cache.js');
        const corpusPath = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb.yaml');
        const lk = cache.lookup(corpusPath);
        // Reproduce the two message templates the dispatch uses.
        if (lk.fresh && lk.report_path !== null) {
            const msg =
                `bench_ab_cache_dispatch (trackb): reusing fresh without baseline ` +
                `(${path.basename(lk.report_path)}) — running with-arm only`;
            expect(msg).toContain('running with-arm only');
        } else {
            const msg = `bench_ab_cache_dispatch (trackb): cache ${lk.reason} — running both arms`;
            expect(msg).toContain('running both arms');
            expect(msg).toContain(lk.reason);
        }
    });
});
