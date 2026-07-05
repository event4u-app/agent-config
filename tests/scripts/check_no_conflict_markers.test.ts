/**
 * CLI-contract tests for `src/scripts/check_no_conflict_markers.ts`
 * (py2ts Phase 4 / Wave 4b — ADR-096).
 *
 * The tsx twin is the source of truth (the python original was deleted in the
 * teardown). Layer 1 asserts the CLI runs deterministically on the real repo;
 * Layer 2 drives synthetic git fixtures through the clean path, both fail
 * branches (unmerged index entries + conflict markers in a tracked file), the
 * `--quiet` success suppression, the `conflict-marker-check: ignore` per-line
 * skip, the allowlist skip + over-cap (exit 2), and the usage error (exit 2).
 * The script resolves its REPO from `parents[2]` of its own location and loads
 * its sibling allowlist, so the fixtures copy the TS twin into
 * `<work>/src/scripts/` and run it inside a git-init'd tmp tree.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_conflict_markers.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

// --- Layer 1: CLI contract on the real repo --------------------------------

describe('check_no_conflict_markers — CLI contract (real repo)', () => {
    function stable(args: readonly string[]): void {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big(REPO_ROOT));
        const b = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big(REPO_ROOT));
        expect(a.status, a.stderr as string).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    }
    it('default run is deterministic', () => stable([]));
    it('--quiet (real CI invocation) is deterministic', () => stable(['--quiet']));

    it('usage error on an unrecognized arg → exit 2', () => {
        expect(spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], big(REPO_ROOT)).status).toBe(2);
    });
});

// --- Layer 2: synthetic fixtures (clean + each fail branch) ----------------

describe('check_no_conflict_markers — synthetic fixtures', () => {
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

    function runTs(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        return spawnSync(
            TSX_BIN,
            [path.join(scriptsDir, 'check_no_conflict_markers.ts'), ...args],
            big(work),
        );
    }

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cncm-')));
        scriptsDir = path.join(work, 'src', 'scripts');
        fs.mkdirSync(scriptsDir, { recursive: true });
        fs.copyFileSync(TS_SCRIPT, path.join(scriptsDir, 'check_no_conflict_markers.ts'));
        writeAllowlist([]);
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('clean tree → exit 0, success line', () => {
        fs.writeFileSync(path.join(work, 'a.txt'), 'no markers here\n', 'utf-8');
        initRepo();
        const ts = runTs([]);
        expect(ts.status).toBe(0);
        expect(ts.stdout as string).toContain('✅');
    });

    it('--quiet on a clean tree → no stdout, exit 0', () => {
        fs.writeFileSync(path.join(work, 'a.txt'), 'no markers here\n', 'utf-8');
        initRepo();
        const ts = runTs(['--quiet']);
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
        const ts = runTs([]);
        expect(ts.status).toBe(1);
        expect(ts.stderr as string).toContain('conflict markers in tracked files');
        expect(ts.stderr as string).toContain('conflicted.txt');
    });

    it('diff3 base-marker variant also trips the start signal → exit 1', () => {
        fs.writeFileSync(
            path.join(work, 'conflicted3.txt'),
            `${BAR7} base\nbase content\n${EQ7}\ntheirs\n${GT7} branch\n`,
            'utf-8',
        );
        initRepo();
        const ts = runTs([]);
        expect(ts.status).toBe(1);
        expect(ts.stderr as string).toContain('conflicted3.txt');
    });

    it('per-line `conflict-marker-check: ignore` skips the markers → exit 0', () => {
        fs.writeFileSync(
            path.join(work, 'doc.md'),
            `${LT7} HEAD ${IGNORE}\n${GT7} branch ${IGNORE}\n`,
            'utf-8',
        );
        initRepo();
        expect(runTs([]).status).toBe(0);
    });

    it('allowlisted file with markers → exit 0', () => {
        fs.writeFileSync(
            path.join(work, 'merge-conflict-doc.md'),
            `${LT7} HEAD\nmine\n${GT7} branch\n`,
            'utf-8',
        );
        writeAllowlist(['merge-conflict-doc.md']);
        initRepo();
        expect(runTs([]).status).toBe(0);
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
        // Only assert when the conflicted-index state was actually produced.
        if ((ls.stdout as string).trim().length > 0) {
            const ts = runTs([]);
            expect(ts.status).toBe(1);
            expect(ts.stderr as string).toContain('unmerged (conflicted) paths');
        }
    });

    it('allowlist over the 20-entry cap → exit 2', () => {
        writeAllowlist(Array.from({ length: 21 }, (_, i) => `f${i}.md`));
        fs.writeFileSync(path.join(work, 'a.txt'), 'clean\n', 'utf-8');
        initRepo();
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        expect(ts.stderr as string).toContain('tighten the guard');
    });
});
