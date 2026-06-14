// Tests for src/scripts/ai_council/bundler.ts (py2ts Phase 1).
//
// Context bundling for council consultations. Golden-parity against the
// CPython twin covers redaction (fail-closed, line-wise), the size guard
// (fail-loud BundleTooLarge), file/roadmap bundling + exclusions, and the git
// diff + surrounding-signature path (driven against a throwaway git repo so
// the diff bytes are deterministic).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    BundleTooLarge,
    type CouncilContext,
    FileNotFoundError,
    MAX_BUNDLE_BYTES,
    bundle_diff,
    bundle_diff_with_context,
    bundle_files,
    bundle_prompt,
    bundle_roadmap,
    redact,
} from '../../../src/scripts/ai_council/bundler.js';
import { hasPython3, runPyCode } from './_harness.js';

const py3 = hasPython3();

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

describe.runIf(py3)('bundler — golden parity vs CPython twin', () => {
    function pyBundle(snippet: string, args: string[]): unknown {
        const code = [
            'import json, sys',
            'from scripts.ai_council import bundler as B',
            snippet,
        ].join('\n');
        const res = runPyCode(code, args);
        expect(res.status, res.stderr).toBe(0);
        return JSON.parse(res.stdout);
    }

    const ctxToObj = (c: CouncilContext): Record<string, unknown> => ({
        mode: c.mode,
        text: c.text,
        manifest: c.manifest,
        excluded: c.excluded,
    });

    const dumpCtx =
        'def dump(c):\n    return {"mode": c.mode, "text": c.text, "manifest": c.manifest, "excluded": c.excluded}\n';

    it('redact() matches line-wise', () => {
        const input = `n\nAuthorization: x\nsecret: y\n${SK_ANT}\n${SK_OPENAI}\nz`;
        const expected = pyBundle('print(json.dumps(B.redact(sys.argv[1])))', [input]) as string;
        expect(redact(input)).toBe(expected);
    });

    it('bundle_prompt matches', () => {
        const text = 'hello\npassword=abc\nworld';
        const expected = pyBundle(dumpCtx + 'print(json.dumps(dump(B.bundle_prompt(sys.argv[1]))))', [
            text,
        ]);
        expect(ctxToObj(bundle_prompt(text))).toEqual(expected);
    });

    it('bundle_files matches (incl. exclusions)', () => {
        const dir = tmpDir();
        const ok = path.join(dir, 'a.txt');
        writeFileSync(ok, 'line\ntoken: secret\nend', { encoding: 'utf-8' });
        const missing = path.join(dir, 'gone.txt');
        const expected = pyBundle(
            dumpCtx + 'print(json.dumps(dump(B.bundle_files([sys.argv[1], sys.argv[2]]))))',
            [ok, missing],
        );
        expect(ctxToObj(bundle_files([ok, missing]))).toEqual(expected);
    });

    it('bundle_roadmap matches', () => {
        const dir = tmpDir();
        const rm = path.join(dir, 'road.md');
        writeFileSync(rm, '## Roadmap\nsecret: hunter2\nplain\n', { encoding: 'utf-8' });
        const expected = pyBundle(
            dumpCtx + 'print(json.dumps(dump(B.bundle_roadmap(sys.argv[1]))))',
            [rm],
        );
        expect(ctxToObj(bundle_roadmap(rm))).toEqual(expected);
    });

    it('BundleTooLarge message matches', () => {
        const expected = pyBundle(
            'try:\n'
                + '    B.bundle_prompt("x" * (50 * 1024 + 1))\n'
                + '    print(json.dumps("NO RAISE"))\n'
                + 'except B.BundleTooLarge as e:\n'
                + '    print(json.dumps(str(e)))',
            [],
        ) as string;
        try {
            bundle_prompt('x'.repeat(MAX_BUNDLE_BYTES + 1));
            throw new Error('expected throw');
        } catch (e) {
            expect((e as Error).message).toBe(expected);
        }
    });

    it('bundle_diff matches against a fixed git repo', () => {
        const repo = makeGitRepo();
        const expected = pyBundle(
            dumpCtx + 'print(json.dumps(dump(B.bundle_diff("HEAD~1", "HEAD", cwd=sys.argv[1]))))',
            [repo],
        );
        expect(ctxToObj(bundle_diff('HEAD~1', 'HEAD', { cwd: repo }))).toEqual(expected);
    });

    it('bundle_diff_with_context matches (signature section)', () => {
        const repo = makeGitRepo();
        const expected = pyBundle(
            dumpCtx
                + 'print(json.dumps(dump(B.bundle_diff_with_context("HEAD~1", "HEAD", cwd=sys.argv[1]))))',
            [repo],
        );
        expect(ctxToObj(bundle_diff_with_context('HEAD~1', 'HEAD', { cwd: repo }))).toEqual(expected);
    });
});
