// Tests for src/scripts/condense_memory.ts (Phase 2 of step-16-telegraph-substance).
//
// 1:1 port of tests/test_condense_memory.py (pytest → vitest, ADR-094 parity
// contract). A trailing golden-parity block runs python3 + tsx on identical
// inputs and asserts byte-identical condensed bodies (modulo the per-run
// `condensed_at:` timestamp) + backups + CLI messages, skipped without python3.

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CondensationRefused,
    condense_file,
    condense_text,
    decondense_file,
} from '../../src/scripts/condense_memory.js';
import { SensitivePathError } from '../../src/scripts/validate_safe_paths.js';



let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'condmem-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('condense_memory.ts — condense_text()', () => {
    it('drops articles and auxiliaries', () => {
        const out = condense_text('The agent is a tool that helps the user.\n');
        expect(out.includes('The')).toBe(false);
        expect(out.includes(' the ')).toBe(false);
        expect(out.includes(' is ')).toBe(false);
        expect(out.includes('agent')).toBe(true);
        expect(out.includes('tool')).toBe(true);
        expect(out.includes('user')).toBe(true);
    });

    it('preserves code fences byte for byte', () => {
        const src = 'Prose is here.\n\n```python\nx = the value\n```\n\nMore prose.\n';
        const out = condense_text(src);
        expect(out.includes('x = the value')).toBe(true);
        expect(out.includes('```python\n')).toBe(true);
    });

    it('preserves numbered options', () => {
        const src = 'Body prose is here.\n\n1. The first option\n2. The second option\n';
        const out = condense_text(src);
        expect(out.includes('1. The first option\n')).toBe(true);
        expect(out.includes('2. The second option\n')).toBe(true);
    });

    it('preserves status markers', () => {
        const src = 'Body prose is here.\n\n❌ The error happened\n✅ The success\n';
        const out = condense_text(src);
        expect(out.includes('❌ The error happened\n')).toBe(true);
        expect(out.includes('✅ The success\n')).toBe(true);
    });

    it('preserves iron-law allcaps', () => {
        const src = 'Body prose is here.\n\nNEVER COMMIT WITHOUT PERMISSION\n';
        const out = condense_text(src);
        expect(out.includes('NEVER COMMIT WITHOUT PERMISSION\n')).toBe(true);
    });

    it('preserves backtick spans', () => {
        const out = condense_text('The file `the/path.md` is the target.\n');
        expect(out.includes('`the/path.md`')).toBe(true);
    });

    it('preserves markdown link target', () => {
        const out = condense_text('See [the guide](docs/what-is-this.md) for the details.\n');
        expect(out.includes('docs/what-is-this.md')).toBe(true);
    });

    it('preserves bare url', () => {
        const out = condense_text('Read the doc at https://example.com/the/answer/is-here now.\n');
        expect(out.includes('https://example.com/the/answer/is-here')).toBe(true);
    });

    it('preserves bare path with slashes', () => {
        const out = condense_text('The path docs/is-the-thing/a-file.md is the target that we use.\n');
        expect(out.includes('docs/is-the-thing/a-file.md')).toBe(true);
    });

    it('condenses link text but not target', () => {
        const out = condense_text('See [the guide](docs/the-guide.md) here.\n');
        expect(out.includes('docs/the-guide.md')).toBe(true);
        expect(out.includes('[ guide]')).toBe(true); // "the" dropped from link text
    });

    it('idempotent on clean condensed text', () => {
        const once = condense_text('The agent is a helper.\n');
        const twice = condense_text(once);
        expect(twice).toBe(once);
    });
});

describe('condense_memory.ts — condense_file()', () => {
    it('writes backup and frontmatter', () => {
        const target = join(tmp, 'AGENTS.md');
        const body = 'The agent is a tool.\n';
        writeFileSync(target, body, 'utf-8');
        const backup = condense_file(target);
        expect(existsSync(backup)).toBe(true);
        expect(readFileSync(backup, 'utf-8')).toBe(body);
        const out = readFileSync(target, 'utf-8');
        expect(out.startsWith('---\n')).toBe(true);
        const expectedSha = createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');
        expect(out.includes(`original_sha256: ${expectedSha}`)).toBe(true);
        expect(out.includes('condensed_at:')).toBe(true);
    });

    it('refuses sensitive', () => {
        const target = join(tmp, '.env.local');
        writeFileSync(target, 'SECRET=x\n', 'utf-8');
        expect(() => condense_file(target)).toThrowError(SensitivePathError);
    });

    it('idempotent no-op', () => {
        const target = join(tmp, 'AGENTS.md');
        writeFileSync(target, 'The agent is a tool.\n', 'utf-8');
        condense_file(target);
        const first = readFileSync(target, 'utf-8');
        condense_file(target);
        expect(readFileSync(target, 'utf-8')).toBe(first);
    });

    it('refuses on body drift', () => {
        const target = join(tmp, 'AGENTS.md');
        writeFileSync(target, 'The agent is a tool.\n', 'utf-8');
        condense_file(target);
        const current = readFileSync(target, 'utf-8');
        writeFileSync(target, `${current}\nThe extra paragraph is added.\n`, 'utf-8');
        expect(() => condense_file(target)).toThrowError(CondensationRefused);
    });

    it('decondense restores original', () => {
        const target = join(tmp, 'AGENTS.md');
        const body = 'The agent is a tool.\n';
        writeFileSync(target, body, 'utf-8');
        condense_file(target);
        decondense_file(target);
        expect(readFileSync(target, 'utf-8')).toBe(body);
        expect(existsSync(join(tmp, 'AGENTS.md.original.md'))).toBe(false);
    });
});
