// Tests for src/scripts/lint_framework_leakage.ts (py2ts Phase 4 / Wave 4b).
//
// Two layers:
//   1. The pytest suite tests/test_lint_framework_leakage.py ported 1:1 —
//      each builds a tmp .agent-src.uncondensed/ subtree, points REPO_ROOT +
//      ALLOWLIST_FILE at it (mirrors the pytest monkeypatch), and asserts
//      exit code + captured stdout.
//   2. A golden-parity layer that runs python3 vs tsx on the REAL REPO across
//      the real CI args (default / --quiet / --json), asserting byte-identical
//      stdout/stderr/exit. Skipped without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as mod from '../../src/scripts/lint_framework_leakage.js';



// --- ported pytest harness --------------------------------------------------

function makeTree(tmp: string, files: Record<string, string>): string {
    for (const [rel, body] of Object.entries(files)) {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
    }
    return tmp;
}

describe('lint_framework_leakage — ported pytest suite', () => {
    let tmp: string;
    let stdout: string;
    let stdoutSpy: { mockRestore: () => void };
    let exitSpy: { mockRestore: () => void };

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flk-'));
        stdout = '';
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
            stdout += String(chunk);
            return true;
        });
        // process.exit(2) on unknown path → throw so we can assert (pytest SystemExit).
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`process.exit:${code ?? 0}`);
        }) as never);
        mod._setReposForTest({ repoRoot: tmp, allowlistFile: path.join(tmp, '_allow.json') });
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
        exitSpy.mockRestore();
        mod._resetReposForTest();
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function run(...paths: string[]): number {
        return mod.main(['--paths', ...paths]);
    }
    /**
     * A run with NO `--paths`, i.e. the shape CI uses.
     *
     * The unused-exemption check is deliberately inert under `--paths`, where
     * "unused" means "out of scope", so every assertion about it has to come
     * through here — `run()` would make those specs pass for the wrong reason.
     */
    function runFull(): number {
        return mod.main([]);
    }
    function runExtra(extra: string[], ...paths: string[]): number {
        return mod.main([...extra, '--paths', ...paths]);
    }

    it('test_clean_file_passes', () => {
        makeTree(tmp, { 'skills/code-refactoring/SKILL.md': '# Code Refactoring\n\nGeneric advice.\n' });
        expect(run('skills')).toBe(0);
        expect(stdout).toContain('0 hits across 0 files');
    });

    it('test_formrequest_in_generic_fails', () => {
        makeTree(tmp, { 'skills/api-endpoint/SKILL.md': '# API Endpoint\n\nUse a FormRequest for validation.\n' });
        expect(run('skills')).toBe(1);
        expect(stdout).toContain('FormRequest');
        expect(stdout).toContain('1 hits across 1 files');
    });

    it('test_formrequest_in_carve_out_passes', () => {
        makeTree(tmp, { 'skills/laravel-validation/SKILL.md': '# Laravel Validation\n\nUse a FormRequest for validation.\n' });
        expect(run('skills')).toBe(0);
    });

    it('test_phpstan_mandate_fails', () => {
        makeTree(tmp, { 'rules/verify-before-complete.md': '# Verify\n\nAlways run PHPStan before claiming done.\n' });
        expect(run('rules')).toBe(1);
    });

    it('test_allowlisted_line_passes', () => {
        // Anchored, not `lines: [4]`. Position keying is retired: it drifts out
        // from under its own exemption on any edit above the line, and three
        // shipped entries had rotted that way before the migration.
        makeTree(tmp, {
            'skills/refine-prompt/SKILL.md': '# Refine\n\nLine 2\nUses FormRequest here.\n',
            '_allow.json': JSON.stringify({
                version: 1,
                entries: [
                    {
                        file: 'skills/refine-prompt/SKILL.md',
                        anchor: 'Uses FormRequest here.',
                        reason: 'documented',
                    },
                ],
            }),
        });
        expect(run('skills')).toBe(0);
        expect(stdout).toContain('1 allowlisted');
    });

    it('test_position_keyed_entry_is_refused', () => {
        // The fixture is CLEAN on purpose. An earlier version of this spec used a
        // file carrying an un-exempted `FormRequest`, so the run exited 1 whether
        // or not the validator existed — it passed for a reason it was not
        // testing, and deleting the check it claims to pin left it green. With no
        // leakage in the tree the only thing that can return 1 is the refusal.
        makeTree(tmp, {
            'skills/refine-prompt/SKILL.md': '# Refine\n\nNothing framework-specific here.\n',
            '_allow.json': JSON.stringify({
                version: 1,
                entries: [{ file: 'skills/refine-prompt/SKILL.md', lines: [3], reason: 'documented' }],
            }),
        });
        expect(run('skills')).toBe(1);
    });

    it('test_exemption_that_suppresses_nothing_is_refused', () => {
        // An anchor resolving to a line says nothing about that line producing a
        // hit. Re-keying a drifted position entry to an anchor preserved the rot
        // silently until this check; five shipped entries were in that state.
        makeTree(tmp, {
            'skills/refine-prompt/SKILL.md': '# Refine\n\nNothing framework-specific here.\n',
            '_allow.json': JSON.stringify({
                version: 1,
                entries: [
                    {
                        file: 'skills/refine-prompt/SKILL.md',
                        anchor: 'Nothing framework-specific here.',
                        reason: 'documented',
                    },
                ],
            }),
        });
        expect(runFull()).toBe(1);
    });

    it('test_unused_check_is_skipped_when_paths_narrow_the_scan', () => {
        // `--paths` makes "unused" mean "out of scope". The guard for this was
        // first written as `paths.length === 0`, which never fired: the default
        // IS a non-empty list of three subdirectories, so the check silently did
        // nothing on exactly the full runs it exists for.
        makeTree(tmp, {
            'skills/refine-prompt/SKILL.md': '# Refine\n\nNothing framework-specific here.\n',
            'rules/other.md': '# Other\n\nAlso clean.\n',
            '_allow.json': JSON.stringify({
                version: 1,
                entries: [{ file: 'rules/other.md', anchor: 'Also clean.', reason: 'documented' }],
            }),
        });
        expect(run('skills')).toBe(0);
    });

    it('test_allowlist_whole_file_passes', () => {
        makeTree(tmp, {
            'commands/optimize/augmentignore.md': '# x\n\nFormRequest line\nPHPStan line\n',
            '_allow.json': JSON.stringify({
                version: 1,
                entries: [{ file: 'commands/optimize/augmentignore.md', lines: '*', reason: 'per-stack rules' }],
            }),
        });
        expect(run('commands')).toBe(0);
    });

    it('test_json_output_shape', () => {
        makeTree(tmp, { 'skills/foo/SKILL.md': '# Foo\n\nUses FormRequest here.\n' });
        expect(runExtra(['--json'], 'skills')).toBe(1);
        const data = JSON.parse(stdout);
        expect(data.version).toBe(1);
        expect(Array.isArray(data.hits)).toBe(true);
        expect(data.summary.total_hits).toBeGreaterThanOrEqual(1);
        expect('files' in data.summary).toBe(true);
        expect('allowlisted' in data.summary).toBe(true);
    });

    it('test_quiet_mode_prints_summary_and_denominator_but_no_per_hit_detail', () => {
        // `--quiet` suppresses the per-hit listing. It does NOT suppress the
        // completeness line: CI passes `--quiet`, and a denominator only
        // visible without it is not a denominator (the recorded `lint_handoffs`
        // lesson, restated in `_lib/scan_scope.ts`).
        makeTree(tmp, { 'skills/foo/SKILL.md': '# Foo\n\nUses FormRequest here.\n' });
        expect(runExtra(['--quiet'], 'skills')).toBe(1);
        const lines = stdout.trim().split('\n').filter((l) => l.trim() !== '');
        expect(lines.some((l) => /^\d+ hits across \d+ files \(\d+ allowlisted\)$/.test(l))).toBe(true);
        expect(lines.some((l) => /^lint_framework_leakage ledger: scanned=\d+ planned=\d+ skipped=\d+$/.test(l))).toBe(
            true,
        );
        expect(stdout).not.toContain('FormRequest here.');
    });

    it('test_multistack_table_with_2_ecosystems_passes', () => {
        makeTree(tmp, {
            'skills/onboard/SKILL.md':
                '# Onboard\n\nDetect stack:\n- composer.json → PHP project\n- package.json → Node project\n',
        });
        expect(run('skills')).toBe(0);
    });

    it('test_unknown_path_argument_errors', () => {
        makeTree(tmp, { 'skills/x/SKILL.md': '# x\n' });
        expect(() => run('does-not-exist')).toThrow('process.exit:2');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

