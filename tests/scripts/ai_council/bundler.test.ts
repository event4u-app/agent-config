// Tests for src/scripts/ai_council/bundler.ts (py2ts Phase 1).
//
// Context bundling for council consultations. Covers redaction (fail-closed,
// line-wise), the size guard (fail-loud BundleTooLarge), file/roadmap bundling
// + exclusions, and the git diff + surrounding-signature path (driven against a
// throwaway git repo so the diff bytes are deterministic).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    BundleTooLarge,
    FileNotFoundError,
    MAX_BUNDLE_BYTES,
    bundle_diff,
    bundle_diff_with_context,
    bundle_files,
    bundle_prompt,
    bundle_roadmap,
    redact,
} from '../../../src/scripts/ai_council/bundler.js';

// Secret-shaped tokens assembled from parts so this test file does not trip
// secret-scanning linters.
const SK_ANT = 'sk-ant-' + 'A'.repeat(12);
const SK_OPENAI = 'sk-' + 'B'.repeat(24);

function tmpDir(prefix = 'bundler-'): string {
    return mkdtempSync(path.join(tmpdir(), prefix));
}

describe('bundler — redact (line-wise, most-specific-first)', () => {
    it('scrubs Authorization, secret-like assignments, and key-like tokens', () => {
        const input = [
            'normal line',
            'Authorization: Bearer xyz',
            'api_key = value',
            SK_ANT,
            SK_OPENAI,
            'tail',
        ].join('\n');
        expect(redact(input)).toBe(
            [
                'normal line',
                '[redacted: Authorization header]',
                '[redacted: secret-like assignment]',
                '[redacted: anthropic-key-like token]',
                '[redacted: openai-key-like token]',
                'tail',
            ].join('\n'),
        );
    });
});

describe('bundler — bundle_prompt / bundle_files / bundle_roadmap', () => {
    it('bundle_prompt redacts + sets manifest', () => {
        const ctx = bundle_prompt('hi\ntoken: abc\nbye');
        expect(ctx.mode).toBe('prompt');
        expect(ctx.manifest).toEqual(['<inline prompt>']);
        expect(ctx.text).toContain('[redacted: secret-like assignment]');
    });

    it('bundle_files records manifest + exclusions for missing files', () => {
        const dir = tmpDir();
        const ok = path.join(dir, 'a.txt');
        writeFileSync(ok, 'content here', { encoding: 'utf-8' });
        const ctx = bundle_files([ok, path.join(dir, 'gone.txt')]);
        expect(ctx.manifest).toEqual([ok]);
        expect(ctx.excluded).toEqual([`${path.join(dir, 'gone.txt')} (not found)`]);
        expect(ctx.text).toContain('content here');
    });

    it('bundle_roadmap throws FileNotFoundError when absent', () => {
        expect(() => bundle_roadmap('/no/such/roadmap.md')).toThrow(FileNotFoundError);
    });

    it('size guard throws BundleTooLarge above the ceiling', () => {
        expect(() => bundle_prompt('x'.repeat(MAX_BUNDLE_BYTES + 1))).toThrow(BundleTooLarge);
    });
});

// ── git-backed diff fixtures ──────────────────────────────────────────────
function makeGitRepo(): string {
    const dir = tmpDir('bundler-git-');
    const run = (args: string[]): void => {
        execFileSync('git', args, { cwd: dir });
    };
    run(['init', '-q']);
    run(['config', 'user.email', 't@t.t']);
    run(['config', 'user.name', 't']);
    writeFileSync(path.join(dir, 'm.py'), 'def foo():\n    return 1\n', { encoding: 'utf-8' });
    run(['add', 'm.py']);
    run(['commit', '-qm', 'init']);
    writeFileSync(path.join(dir, 'm.py'), 'def foo():\n    return 2\n\n\ndef bar():\n    return 3\n', {
        encoding: 'utf-8',
    });
    run(['add', 'm.py']);
    run(['commit', '-qm', 'change']);
    return dir;
}

describe('bundler — git diff', () => {
    it('bundle_diff returns the raw diff with a manifest', () => {
        const repo = makeGitRepo();
        const ctx = bundle_diff('HEAD~1', 'HEAD', { cwd: repo });
        expect(ctx.mode).toBe('diff');
        expect(ctx.manifest).toEqual(['git diff HEAD~1..HEAD']);
        expect(ctx.text).toContain('def bar');
    });

    it('bundle_diff_with_context appends a Surrounding signatures section', () => {
        const repo = makeGitRepo();
        const ctx = bundle_diff_with_context('HEAD~1', 'HEAD', { cwd: repo });
        expect(ctx.text).toContain('## Surrounding signatures');
        expect(ctx.manifest[ctx.manifest.length - 1]).toMatch(/surrounding signatures for \d+ file/);
    });
});
