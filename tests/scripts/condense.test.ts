// Tests for src/scripts/condense.ts (py2ts Phase 5 — the content-pipeline crown jewel).
//
// Two layers:
//   1. Unit suites ported 1:1 from tests/test_condense.py + tests/test_condense_paths.py.
//      The pytest suites monkeypatch module globals (condense.PROJECT_ROOT,
//      condense.HASH_FILE, condense.TARGET_DIR, …) and the multi-root helper
//      functions (condense.iter_all_sources / resolve_logical / artefact_roots).
//      The TS twin exposes the same surface through MODULE_STATE + the
//      _setStateForTest / _getStateForTest / _resetStateForTest seams; each
//      suite saves+restores the state it mutates (≈ pytest setUp/tearDown).
//   2. Golden-parity differential suites — run python3 vs tsx of condense on
//      the REAL repo for the read-only subcommands (byte-identical stdout +
//      stderr + exit), and assert that `--sync` then `--generate-tools` leave
//      ZERO git drift on the committed generated trees (the critical gate).
//      Each write test snapshots the tree and restores it in afterEach.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as condense from '../../src/scripts/condense.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TS = path.join(REPO_ROOT, 'src', 'scripts', 'condense.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkTmp(prefix = 'cond-'): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(p: string, text: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf-8');
}

/**
 * Mirror the pytest `_IsolateMultiRootMixin` — point the injectable multi-root
 * helpers at a tmp `source` tree. Yields [physical, logical] for every file,
 * resolves logical → physical, and roots = (source,).
 */
function isolateMultiRoot(source: string): void {
    const iter = function* (): Generator<[string, string]> {
        const walk = (dir: string): string[] => {
            const out: string[] = [];
            for (const name of fs.readdirSync(dir).sort()) {
                const full = path.join(dir, name);
                if (fs.statSync(full).isDirectory()) {
                    out.push(...walk(full));
                } else if (fs.statSync(full).isFile()) {
                    out.push(full);
                }
            }
            return out;
        };
        const files = walk(source).sort();
        for (const f of files) {
            yield [f, path.relative(source, f).split(path.sep).join('/')];
        }
    };
    const resolve = (rel: string): string | null => {
        const p = path.join(source, rel);
        return fs.existsSync(p) ? p : null;
    };
    const roots = (): string[] => [source];
    condense._setStateForTest({
        iter_all_sources: iter,
        resolve_logical: resolve,
        artefact_roots: roots,
    });
}


// ===========================================================================
// Ported from tests/test_condense.py
// ===========================================================================

describe('should_condense', () => {
    it('md file should condense', () => {
        expect(condense.should_condense('rules/token-efficiency.md')).toBe(true);
    });
    it('README should not condense', () => {
        expect(condense.should_condense('README.md')).toBe(false);
    });
    it('php file should not condense', () => {
        expect(condense.should_condense('src/scripts/scan.php')).toBe(false);
    });
    it('txt file should not condense', () => {
        expect(condense.should_condense('notes.txt')).toBe(false);
    });
    it('nested md should condense', () => {
        expect(condense.should_condense('skills/coder/SKILL.md')).toBe(true);
    });
});

describe('cleanup_stale', () => {
    let tmp: string;
    let source: string;
    let target: string;
    let saved: ReturnType<typeof condense._getStateForTest>;

    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('deletes stale files', () => {
        write(path.join(source, 'file_a.md'), 'a');
        write(path.join(target, 'file_a.md'), 'a');
        write(path.join(target, 'file_b.md'), 'b');
        const deleted = condense.cleanup_stale(source, target);
        expect(deleted).toBe(1);
        expect(fs.existsSync(path.join(target, 'file_a.md'))).toBe(true);
        expect(fs.existsSync(path.join(target, 'file_b.md'))).toBe(false);
    });

    it('no stale files', () => {
        write(path.join(source, 'file_a.md'), 'a');
        write(path.join(target, 'file_a.md'), 'a');
        expect(condense.cleanup_stale(source, target)).toBe(0);
    });

    it('removes empty directories', () => {
        write(path.join(source, 'rules', 'a.md'), 'a');
        write(path.join(target, 'rules', 'a.md'), 'a');
        write(path.join(target, 'old-dir', 'stale.md'), 'stale');
        condense.cleanup_stale(source, target);
        expect(fs.existsSync(path.join(target, 'old-dir'))).toBe(false);
    });

    it('preserves nested structure', () => {
        write(path.join(source, 'skills', 'coder', 'SKILL.md'), 'skill');
        write(path.join(target, 'skills', 'coder', 'SKILL.md'), 'skill');
        write(path.join(target, 'skills', 'old-skill', 'SKILL.md'), 'old');
        condense.cleanup_stale(source, target);
        expect(fs.existsSync(path.join(target, 'skills', 'coder', 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(target, 'skills', 'old-skill'))).toBe(false);
    });

    it('nonexistent target returns zero', () => {
        expect(condense.cleanup_stale(source, path.join(tmp, 'nope'))).toBe(0);
    });
});

describe('copy_file', () => {
    let tmp: string;
    let source: string;
    let target: string;
    beforeEach(() => {
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
    });
    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('copies file as-is', () => {
        const sf = path.join(source, 'scan.php');
        write(sf, "<?php echo 'hello';");
        const tf = path.join(target, 'scan.php');
        condense.copy_file(sf, tf);
        expect(fs.existsSync(tf)).toBe(true);
        expect(fs.readFileSync(tf, 'utf-8')).toBe("<?php echo 'hello';");
    });

    it('creates target directory', () => {
        const sf = path.join(source, 'scripts', 'scan.php');
        write(sf, '<?php');
        const tf = path.join(target, 'scripts', 'scan.php');
        condense.copy_file(sf, tf);
        expect(fs.existsSync(tf)).toBe(true);
    });
});

describe('sync_non_md', () => {
    let tmp: string;
    let source: string;
    let target: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('copies php files', () => {
        write(path.join(source, 'scripts', 'scan.php'), '<?php');
        expect(condense.sync_non_md(source, target)).toBe(1);
        expect(fs.existsSync(path.join(target, 'scripts', 'scan.php'))).toBe(true);
    });

    it('skips condensable md files', () => {
        write(path.join(source, 'rules', 'test.md'), '# Rule');
        expect(condense.sync_non_md(source, target)).toBe(0);
        expect(fs.existsSync(path.join(target, 'rules', 'test.md'))).toBe(false);
    });

    it('copies readme as-is', () => {
        write(path.join(source, 'README.md'), '# Readme');
        expect(condense.sync_non_md(source, target)).toBe(1);
        expect(fs.readFileSync(path.join(target, 'README.md'), 'utf-8')).toBe('# Readme');
    });
});

describe('list_md_files', () => {
    let tmp: string;
    let source: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        fs.mkdirSync(source);
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('lists md files', () => {
        write(path.join(source, 'rules', 'a.md'), 'rule');
        write(path.join(source, 'rules', 'b.md'), 'rule');
        const files = condense.list_md_files(source);
        expect(files.length).toBe(2);
        expect(files).toContain('rules/a.md');
        expect(files).toContain('rules/b.md');
    });

    it('excludes readme', () => {
        write(path.join(source, 'README.md'), 'readme');
        write(path.join(source, 'rules', 'a.md'), 'rule');
        const files = condense.list_md_files(source);
        expect(files.length).toBe(1);
        expect(files).not.toContain('README.md');
    });

    it('excludes non-md', () => {
        write(path.join(source, 'scripts', 'scan.php'), '<?php');
        expect(condense.list_md_files(source).length).toBe(0);
    });
});

describe('file_hash', () => {
    it('returns consistent hash', () => {
        const tmp = mkTmp();
        const p = path.join(tmp, 'x.md');
        write(p, 'hello world');
        try {
            const h1 = condense.file_hash(p);
            const h2 = condense.file_hash(p);
            expect(h1).toBe(h2);
            expect(h1.length).toBe(64);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('different content different hash', () => {
        const tmp = mkTmp();
        const a = path.join(tmp, 'a.md');
        const b = path.join(tmp, 'b.md');
        write(a, 'content a');
        write(b, 'content b');
        try {
            expect(condense.file_hash(a)).not.toBe(condense.file_hash(b));
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
