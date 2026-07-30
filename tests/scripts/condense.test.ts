// Tests for src/scripts/condense.ts (py2ts Phase 5 — the content-pipeline crown jewel).
//
// Unit suites ported 1:1 from tests/test_condense.py + tests/test_condense_paths.py.
// The pytest suites monkeypatch module globals (condense.PROJECT_ROOT,
// condense.HASH_FILE, condense.TARGET_DIR, …) and the multi-root helper
// functions (condense.iter_all_sources / resolve_logical / artefact_roots).
// The TS twin exposes the same surface through MODULE_STATE + the
// _setStateForTest / _getStateForTest / _resetStateForTest seams; each
// suite saves+restores the state it mutates (≈ pytest setUp/tearDown).
//
// The python twin these suites were ported from is gone, so the golden-parity
// differential layer this header used to describe is gone with it — the whole-repo
// projection is now covered by check_condensation's byte-exactness invariant
// (dist == rewrite(src)), which is stronger than a py-vs-tsx stdout diff.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as condense from '../../src/scripts/condense.js';

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

    // Contract CHANGED by ADR-201 (accepted 2026-07-29): this asserted that `.md`
    // was SKIPPED here, because an agent wrote the condensed body into dist/ by
    // hand. That LLM rewrite is removed — `.md` is now copied verbatim and
    // path-rewritten, so dist is a deterministic derivation of src. The old
    // assertion is preserved as the `COPY_MD_VERBATIM = false` branch's contract.
    it('copies md files verbatim (ADR-201: no LLM rewrite in the pipeline)', () => {
        write(path.join(source, 'rules', 'test.md'), '# Rule');
        expect(condense.sync_non_md(source, target)).toBe(1);
        expect(fs.readFileSync(path.join(target, 'rules', 'test.md'), 'utf-8')).toBe('# Rule');
    });

    // ADR telegraph/0002 § part 1 — the coupling test. Router membership alone was
    // never zero-cost: a compile-time-disabled rule was dropped from router.json
    // while its body still shipped as a file, and the HOST READS THE FILE. Without
    // this test the second half of "dormancy" would be asserted, not enforced —
    // which is precisely the failure that ADR recorded against its own first draft.
    const withSettings = (yaml: string): void => {
        const f = path.join(tmp, 'settings.yml');
        fs.writeFileSync(f, yaml, 'utf-8');
        condense._setStateForTest({ SETTINGS_FILE: f });
    };

    it('a compile-time-DISABLED rule is not emitted into the projection', () => {
        write(path.join(source, 'rules', 'telegraph-speak.md'), '# Telegraph\n');
        withSettings('telegraph:\n  speak: false\n');
        condense.sync_non_md(source, target);
        expect(fs.existsSync(path.join(target, 'rules', 'telegraph-speak.md'))).toBe(false);
    });

    it('an ENABLED rule is emitted — the gate opts in, it does not allowlist', () => {
        write(path.join(source, 'rules', 'telegraph-speak.md'), '# Telegraph\n');
        withSettings('telegraph:\n  speak: true\n');
        condense.sync_non_md(source, target);
        expect(fs.existsSync(path.join(target, 'rules', 'telegraph-speak.md'))).toBe(true);
    });

    it('an ungated rule is unaffected by the toggle map', () => {
        write(path.join(source, 'rules', 'some-other-rule.md'), '# Other\n');
        withSettings('telegraph:\n  speak: false\n');
        condense.sync_non_md(source, target);
        expect(fs.existsSync(path.join(target, 'rules', 'some-other-rule.md'))).toBe(true);
    });

    it('the family master switch overrides an explicit opt-in', () => {
        write(path.join(source, 'rules', 'telegraph-speak.md'), '# Telegraph\n');
        withSettings('telegraph:\n  enabled: false\n  speak: true\n');
        condense.sync_non_md(source, target);
        expect(fs.existsSync(path.join(target, 'rules', 'telegraph-speak.md'))).toBe(false);
    });

    it('the copy is byte-exact — the property the removal exists to create', () => {
        // Determinism was the sub-gate that FAILED before ADR-201: the hash covered
        // the source and never the output, so dist could diverge undetectably.
        // A verbatim copy makes `dist == rewrite(src)` checkable for the first time.
        const body = '# Rule\n\nProse with **emphasis** and `code`.\n\n```\nNEVER X\n```\n';
        write(path.join(source, 'rules', 'exact.md'), body);
        condense.sync_non_md(source, target);
        expect(fs.readFileSync(path.join(target, 'rules', 'exact.md'), 'utf-8')).toBe(body);
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

describe('is_projection_stale / list_changed_md — the post-ADR-201 basis', () => {
    // The hash cache is gone. Staleness is now read off the projection itself:
    // `dist != rewrite(src)`. These two suites pin the property the cache never
    // had (it looked at the source only) and the property its absence must keep.
    let tmp: string;
    let source: string;
    let target: string;
    let saved: ReturnType<typeof condense._getStateForTest>;

    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp('stale-');
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
        isolateMultiRoot(source);
        condense._setStateForTest({ TARGET_DIR: target });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    /** Write a source file and its correct projection, so the pair starts in sync. */
    function writeSyncedPair(rel: string, body: string): void {
        const src = path.join(source, rel);
        write(src, body);
        write(path.join(target, rel), condense._rewrite_paths(body, rel));
    }

    it('an in-sync pair is not stale', () => {
        writeSyncedPair('rules/a.md', '---\ntype: "auto"\n---\n\n# A\n\nbody\n');
        expect(condense.is_projection_stale('rules/a.md')).toBe(false);
        expect(condense.list_changed_md(source)).toEqual([]);
    });

    it('finds a pair desynchronised in dist — the case the hash cache could not see', () => {
        // The old cache stored a hash of the SOURCE. Corrupting dist left the
        // stored hash matching, so a hand-edited projection read as current.
        writeSyncedPair('rules/b.md', '---\ntype: "auto"\n---\n\n# B\n\nbody\n');
        expect(condense.is_projection_stale('rules/b.md')).toBe(false);
        write(path.join(target, 'rules/b.md'), 'someone hand-edited the projection\n');
        expect(condense.is_projection_stale('rules/b.md')).toBe(true);
        expect(condense.list_changed_md(source)).toContain('rules/b.md');
    });

    it('finds a pair desynchronised at the source', () => {
        writeSyncedPair('rules/c.md', '---\ntype: "auto"\n---\n\n# C\n\nbody\n');
        write(path.join(source, 'rules/c.md'), '---\ntype: "auto"\n---\n\n# C\n\nedited\n');
        expect(condense.is_projection_stale('rules/c.md')).toBe(true);
        expect(condense.list_changed_md(source)).toContain('rules/c.md');
    });

    it('a never-projected source is stale', () => {
        write(path.join(source, 'rules/d.md'), '# D\n');
        expect(condense.is_projection_stale('rules/d.md')).toBe(true);
    });

    it('a source that does not exist is not stale — check_sync owns that verdict', () => {
        expect(condense.is_projection_stale('rules/nope.md')).toBe(false);
    });

    it('needs no hash file: nothing reads or writes one', () => {
        // The permanent post-removal state. If any code path resurrected a cache,
        // it would appear on disk here — annotate_discovery used to do exactly that.
        writeSyncedPair('rules/e.md', '---\ntype: "auto"\n---\n\n# E\n\nbody\n');
        write(path.join(source, 'rules/f.md'), '# F\n');
        const before = fs.readdirSync(tmp).sort();
        expect(condense.list_changed_md(source)).toEqual(['rules/f.md']);
        expect(condense.is_projection_stale('rules/e.md')).toBe(false);
        expect(fs.readdirSync(tmp).sort()).toEqual(before);
        expect(fs.existsSync(path.join(tmp, 'internal'))).toBe(false);
    });
});
