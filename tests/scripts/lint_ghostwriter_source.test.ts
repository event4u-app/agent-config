// Tests for src/scripts/lint_ghostwriter_source.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Light behavioural spec over exported pure helpers
// (validate_alias, is_latin_or_allowed) and the documented-path cases. There is
// no python3 parity layer: the Python source has been retired.
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as lgs from '../../src/scripts/lint_ghostwriter_source.js';



describe('lint_ghostwriter_source — validate_alias', () => {
    it('accepts a plain Latin alias', () => {
        expect(lgs.validate_alias('Alex')).toBeNull();
    });

    it('rejects a non-string alias with the Python type name', () => {
        expect(lgs.validate_alias(42)).toBe('alias must be a string, got int');
        expect(lgs.validate_alias(true)).toBe('alias must be a string, got bool');
    });

    it('rejects an alias shorter than ALIAS_MIN_LEN', () => {
        expect(lgs.ALIAS_MIN_LEN).toBe(2);
        expect(lgs.validate_alias('x')).toBe("alias 'x' is shorter than 2 characters");
    });

    it('rejects an alias containing a non-Latin character', () => {
        const err = lgs.validate_alias('Аlex'); // Cyrillic А (homoglyph)
        expect(err).not.toBeNull();
        expect(err).toContain('non-Latin or homoglyph-prone');
    });
});

describe('lint_ghostwriter_source — is_latin_or_allowed', () => {
    it('accepts ASCII letters and digits', () => {
        expect(lgs.is_latin_or_allowed('A')).toBe(true);
        expect(lgs.is_latin_or_allowed('z')).toBe(true);
        expect(lgs.is_latin_or_allowed('7')).toBe(true);
    });
    it('rejects a Cyrillic homoglyph', () => {
        expect(lgs.is_latin_or_allowed('А')).toBe(false); // U+0410
    });
});

// --- documented-path (road-to-a-brand-the-tree-can-check 0.5 / 1.1) ---------
//
// Every ghostwriter command writes profiles to agents/reference/ghostwriter/.
// The managed ignore block and the lint roots must cover that path, and keep
// the legacy agents/ghostwriter/ one, or a real-person profile is committable.
describe('lint_ghostwriter_source — documented-path', () => {
    const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

    function ignored(rel: string): boolean {
        const block = fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'gitignore-block.txt'), 'utf-8');
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ignore-'));
        try {
            execFileSync('git', ['init', '-q'], { cwd: tmp });
            fs.writeFileSync(path.join(tmp, '.gitignore'), block);
            const r = spawnSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: tmp });
            return r.status === 0;
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    }

    it.each([
        'agents/reference/ghostwriter/someone.md',
        'agents/reference/ghostwriter/someone.md.bak',
        'agents/reference/ghostwriter/nested/someone.md',
        'agents/ghostwriter/someone.md',
        'agents/ghostwriter/someone.md.bak',
        'agents/ghostwriter/nested/someone.md',
    ])('documented-path: the managed block ignores %s', (rel) => {
        expect(ignored(rel)).toBe(true);
    });

    it.each(['agents/reference/ghostwriter/README.md', 'agents/ghostwriter/README.md'])(
        'documented-path: the managed block keeps %s tracked',
        (rel) => {
            expect(ignored(rel)).toBe(false);
        },
    );

    it('documented-path: the lint roots name the canonical path first and keep the legacy one', () => {
        const dirs = (lgs as Record<string, unknown>)['CONSUMER_DIRS'] as string[] | undefined;
        const rels = (dirs ?? []).map((d) => path.relative(REPO_ROOT, d).split(path.sep).join('/'));
        expect(rels).toEqual(['agents/reference/ghostwriter', 'agents/ghostwriter']);
    });

    it('documented-path: the lint reads a nested profile at the canonical path', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-lint-'));
        try {
            const canonical = path.join(tmp, 'reference', 'ghostwriter');
            fs.mkdirSync(path.join(canonical, 'nested'), { recursive: true });
            fs.writeFileSync(path.join(canonical, 'README.md'), '# readme\n');
            fs.writeFileSync(path.join(canonical, 'nested', 'fake.md'), '---\nfictional: true\n---\n');
            const lint = lgs.lint_consumer_side as (dirs?: readonly string[]) => string[];
            const joined = lint([canonical]).join('\n');
            expect(joined).toContain("'fictional: true' in consumer tree");
            expect(joined).toContain('fake.md');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

