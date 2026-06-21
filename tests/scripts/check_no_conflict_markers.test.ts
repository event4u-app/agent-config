/**
 * Golden-parity tests for `src/scripts/check_no_conflict_markers.ts`
 * (py2ts Phase 4 / Wave 4b — NEW PORT, ADR-096).
 *
 * The Python original (`check_no_conflict_markers.py`) and the TS twin produce
 * byte-identical stdout/stderr and the same exit code across the clean path,
 * both fail branches (unmerged index entries + conflict markers in a tracked
 * file), the `--quiet` success suppression, the `conflict-marker-check: ignore`
 * per-line skip, the allowlist skip + over-cap (exit 2), and the usage error
 * (exit 2). Each script resolves its REPO from `parents[2]` of its own location
 * and loads its sibling allowlist, so the fixtures copy BOTH scripts into
 * `<work>/src/scripts/` and run them inside a git-init'd tmp tree. The `--help`
 * prose is intentionally NOT byte-compared (argparse multi-line help).
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
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_conflict_markers.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_conflict_markers.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

// --- Layer 1: golden parity on the real repo -------------------------------

describe.skipIf(!py3)('check_no_conflict_markers — golden parity (real repo)', () => {
    function same(args: readonly string[]): void {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], big(REPO_ROOT));
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big(REPO_ROOT));
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }
    it('default run matches byte-for-byte', () => same([]));
    it('--quiet (real CI invocation) matches byte-for-byte', () => same(['--quiet']));

    it('usage error on an unrecognized arg matches byte-for-byte (exit 2)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], big(REPO_ROOT));
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], big(REPO_ROOT));
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
    });
});

// --- Layer 2: synthetic fixtures (clean + each fail branch) ----------------

describe.skipIf(!py3)('check_no_conflict_markers — golden parity (synthetic)', () => {
    let work: string;
    let scriptsDir: string;

    // Conflict-marker fragments assembled at runtime so the literal envelope
    // never appears in THIS test file's tracked source (the repo-wide guard
    // would otherwise flag this very file).
    const LT7 = '<'.repeat(7);
    const GT7 = '>'.repeat(7);
    const EQ7 = '='.repeat(7);
    const BAR7 = '|'.repeat(7);
    const IGNORE = 'conflict-marker-check' + ': ignore';

    function writeAllowlist(files: string[]): void {
        fs.writeFileSync(
            path.join(scriptsDir, 'check_no_conflict_markers_allowlist.json'),
            JSON.stringify({ files }) + '\n',
            'utf-8',
        );
    }

    function initRepo(): void {
        spawnSync('git', ['init', '-q'], big(work));
        spawnSync('git', ['config', 'user.email', 't@t'], big(work));
        spawnSync('git', ['config', 'user.name', 't'], big(work));
        spawnSync('git', ['add', '-A'], big(work));
    }

    function runPy(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        return spawnSync(
            'python3',
            [path.join(scriptsDir, 'check_no_conflict_markers.py'), ...args],
            big(work),
        );
    }
    function runTs(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        return spawnSync(
            TSX_BIN,
            [path.join(scriptsDir, 'check_no_conflict_markers.ts'), ...args],
            big(work),
        );
    }
    function expectSame(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        return ts;
    }

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cncm-')));
        scriptsDir = path.join(work, 'src', 'scripts');
        fs.mkdirSync(scriptsDir, { recursive: true });
        fs.copyFileSync(PY_SCRIPT, path.join(scriptsDir, 'check_no_conflict_markers.py'));
        fs.copyFileSync(TS_SCRIPT, path.join(scriptsDir, 'check_no_conflict_markers.ts'));
        writeAllowlist([]);
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('clean tree → exit 0, success line byte-identical', () => {
        fs.writeFileSync(path.join(work, 'a.txt'), 'no markers here\n', 'utf-8');
        initRepo();
        const ts = expectSame([]);
        expect(ts.status).toBe(0);
        expect((ts.stdout as string)).toContain('✅');
    });

    it('--quiet on a clean tree → no stdout, exit 0', () => {
        fs.writeFileSync(path.join(work, 'a.txt'), 'no markers here\n', 'utf-8');
        initRepo();
        const ts = expectSame(['--quiet']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toBe('');
    });

    it('conflict markers in a tracked file → exit 1, finding on stderr', () => {
        fs.writeFileSync(
            path.join(work, 'conflicted.txt'),
            `${LT7} HEAD\nmine\n${EQ7}\ntheirs\n${GT7} branch\n`,
            'utf-8',
        );
        initRepo();
        const ts = expectSame([]);
        expect(ts.status).toBe(1);
        expect((ts.stderr as string)).toContain('conflict markers in tracked files');
        expect((ts.stderr as string)).toContain('conflicted.txt');
    });

    it('diff3 base-marker variant also trips the start signal → exit 1', () => {
        fs.writeFileSync(
            path.join(work, 'conflicted3.txt'),
            `${BAR7} base\nbase content\n${EQ7}\ntheirs\n${GT7} branch\n`,
            'utf-8',
        );
        initRepo();
        const ts = expectSame([]);
        expect(ts.status).toBe(1);
        expect((ts.stderr as string)).toContain('conflicted3.txt');
    });

    it('per-line `conflict-marker-check: ignore` skips the markers → exit 0', () => {
        fs.writeFileSync(
            path.join(work, 'doc.md'),
            `${LT7} HEAD ${IGNORE}\n${GT7} branch ${IGNORE}\n`,
            'utf-8',
        );
        initRepo();
        const ts = expectSame([]);
        expect(ts.status).toBe(0);
    });

    it('allowlisted file with markers → exit 0', () => {
        fs.writeFileSync(
            path.join(work, 'merge-conflict-doc.md'),
            `${LT7} HEAD\nmine\n${GT7} branch\n`,
            'utf-8',
        );
        writeAllowlist(['merge-conflict-doc.md']);
        initRepo();
        const ts = expectSame([]);
        expect(ts.status).toBe(0);
    });

    it('unmerged index entries → exit 1, finding on stderr', () => {
        // Manufacture a real conflicted index: two branches edit the same file,
        // then merge with conflict so `git ls-files -u` lists the path.
        fs.writeFileSync(path.join(work, 'm.txt'), 'base\n', 'utf-8');
        initRepo();
        spawnSync('git', ['commit', '-qm', 'base'], big(work));
        spawnSync('git', ['checkout', '-qb', 'feat'], big(work));
        fs.writeFileSync(path.join(work, 'm.txt'), 'theirs\n', 'utf-8');
        spawnSync('git', ['commit', '-aqm', 'theirs'], big(work));
        void (spawnSync('git', ['checkout', '-q', 'main'], big(work)).status === 0 ||
            spawnSync('git', ['checkout', '-q', 'master'], big(work)));
        fs.writeFileSync(path.join(work, 'm.txt'), 'mine\n', 'utf-8');
        spawnSync('git', ['commit', '-aqm', 'mine'], big(work));
        spawnSync('git', ['merge', 'feat'], big(work)); // conflicts, leaves unmerged index
        const ls = spawnSync('git', ['ls-files', '-u'], big(work));
        // Only assert parity when the conflicted-index state was actually produced.
        if ((ls.stdout as string).trim().length > 0) {
            const ts = expectSame([]);
            expect(ts.status).toBe(1);
            expect((ts.stderr as string)).toContain('unmerged (conflicted) paths');
        }
    });

    it('allowlist over the 20-entry cap → exit 2, both byte-identical', () => {
        writeAllowlist(Array.from({ length: 21 }, (_, i) => `f${i}.md`));
        fs.writeFileSync(path.join(work, 'a.txt'), 'clean\n', 'utf-8');
        initRepo();
        const ts = expectSame([]);
        expect(ts.status).toBe(2);
        expect((ts.stderr as string)).toContain('tighten the guard');
    });
});
