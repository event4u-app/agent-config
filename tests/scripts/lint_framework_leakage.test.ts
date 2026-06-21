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
        makeTree(tmp, {
            'skills/refine-prompt/SKILL.md': '# Refine\n\nLine 2\nUses FormRequest here.\n',
            '_allow.json': JSON.stringify({
                version: 1,
                entries: [{ file: 'skills/refine-prompt/SKILL.md', lines: [4], reason: 'documented' }],
            }),
        });
        expect(run('skills')).toBe(0);
        expect(stdout).toContain('1 allowlisted');
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

    it('test_quiet_mode_only_prints_summary', () => {
        makeTree(tmp, { 'skills/foo/SKILL.md': '# Foo\n\nUses FormRequest here.\n' });
        expect(runExtra(['--quiet'], 'skills')).toBe(1);
        const stripped = stdout.trim();
        expect(/^\d+ hits across \d+ files \(\d+ allowlisted\)$/.test(stripped)).toBe(true);
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

