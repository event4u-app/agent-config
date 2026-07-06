// Tests for src/scripts/measure_patterns.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script is a
// read-only reporter over the legacy `.agent-src.uncondensed/skills` corpus.
//
// Real-repo reality the contract makes us replicate-and-flag: that legacy
// skills dir does NOT exist on the current src/-based layout, so the .py hits
// its `SKILLS_DIR.is_dir()` guard and exits 3 with a stable, byte-reproducible
// stderr line. The TS twin reproduces both the exit code and the exact stderr
// message. Golden parity covers the default, --json, and --tier shapes — all
// of which reach the exit-3 guard identically in this repo. Argparse error
// banners (bad flag / bad --tier choice) are Python-version-dependent prose,
// so for those only the exit code (2) is compared. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_patterns.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). It scans src/skills (always present in-repo) → output is
// corpus-derived, asserted structurally (exit 0, non-empty, valid JSON,
// deterministic) rather than snapshotted.
describe('measure_patterns — CLI contract', () => {
    it('every reporting shape runs deterministically over src/skills (exit 0)', () => {
        for (const args of [[], ['--json'], ['--tier', '1'], ['--tier', '3']]) {
            const a = runTs(args);
            expect(a.status, `${args.join(' ')}: ${a.stderr}`).toBe(0);
            expect(a.stdout.length).toBeGreaterThan(0);
            expect(runTs(args).stdout, `${args.join(' ')} deterministic`).toBe(a.stdout);
        }
        expect(() => JSON.parse(runTs(['--json']).stdout)).not.toThrow();
    });

    it('bad flag → exit 2', () => {
        expect(runTs(['--bogus']).status).toBe(2);
    });

    it('invalid --tier choice → exit 2', () => {
        expect(runTs(['--tier', '9']).status).toBe(2);
    });
});
