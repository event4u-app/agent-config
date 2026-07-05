// Tests for src/scripts/measure_skill_reduction.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script is a
// read-only reporter over the legacy `.agent-src.uncondensed/skills` corpus.
//
// Real-repo reality the contract makes us replicate-and-flag: that legacy
// skills dir does NOT exist on the current src/-based layout. Unlike
// measure_patterns (which has an is_dir guard → exit 3), this script does an
// UN-GUARDED `sorted(SKILLS_DIR.iterdir())`, so a missing dir raises an
// uncaught FileNotFoundError → traceback → exit 1 with EMPTY stdout. The TS
// twin reproduces the crash (throwing on readdir ENOENT → exit 1, empty
// stdout). The traceback prose is interpreter-specific, so on the crash path
// only the exit code + empty stdout are compared. When the skills dir is
// present the default + --json shapes are byte-identical. Skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'measure_skill_reduction.ts');
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
describe('measure_skill_reduction — CLI contract', () => {
    it('default + --json run deterministically over src/skills (exit 0)', () => {
        for (const args of [[], ['--json']]) {
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
});
