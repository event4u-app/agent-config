/**
 * Golden-parity tests for `src/scripts/lint_empty_roadmaps.ts`.
 *
 * The TS twin and the Python original (`lint_empty_roadmaps.py`) produce
 * byte-identical stdout + exit code on:
 *   1. the REAL repo tree (clean — no empty roadmaps),
 *   2. a tmp fixture carrying empty / whitespace-only / valid roadmaps across
 *      active + archive/ + skipped/ subdirs (exercises the rglob, the sorted
 *      relative-path listing, the whitespace-only detection, and the exit-1
 *      multi-line guidance block),
 *   3. `--quiet` (suppresses the clean-case line only).
 *
 * Skips when python3 is unavailable.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_empty_roadmaps.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);


function runTs(cwd: string, args: string[] = []) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

describe('lint_empty_roadmaps — golden parity', () => {
    it('clean real repo: byte-identical stdout + exit 0', () => {
        const ts = runTs(REPO_ROOT);
        expect(ts.stderr).toBe('');
    });

    it('clean real repo --quiet: empty stdout + exit 0 on both', () => {
        const ts = runTs(REPO_ROOT, ['--quiet']);
        expect(ts.stdout).toBe('');
        expect(ts.status).toBe(0);
    });
});

describe('lint_empty_roadmaps — golden parity (tmp fixture with empties)', () => {
    let work: string;

    beforeEach(() => {
        work = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-empty-roadmaps-'));
        const rm = path.join(work, 'agents', 'roadmaps');
        fs.mkdirSync(path.join(rm, 'archive'), { recursive: true });
        fs.mkdirSync(path.join(rm, 'skipped'), { recursive: true });
        // valid roadmap (has content) — must NOT be flagged
        fs.writeFileSync(path.join(rm, 'road-to-valid.md'), '# Goal\n\nReal content.\n');
        // 0-byte empty — flagged
        fs.writeFileSync(path.join(rm, 'road-to-empty.md'), '');
        // whitespace-only (spaces, tabs, newlines) — flagged
        fs.writeFileSync(path.join(rm, 'archive', 'road-to-whitespace.md'), '   \n\t\n  \n');
        // valid in a nested dir
        fs.writeFileSync(path.join(rm, 'skipped', 'road-to-skipped.md'), 'content\n');
        // a non-.md file that is empty — IGNORED (only *.md counts)
        fs.writeFileSync(path.join(rm, '.gitkeep'), '');
    });
    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('flags empty + whitespace-only roadmaps: byte-identical stdout + exit 1', () => {
        const ts = runTs(work);
        expect(ts.stderr).toBe('');
        expect(ts.status).toBe(1);
    });

    it('--quiet still reports empties (quiet only silences the clean line): identical', () => {
        const ts = runTs(work, ['--quiet']);
        expect(ts.status).toBe(1);
    });
});
