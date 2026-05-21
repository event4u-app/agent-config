/**
 * Tests for project signal auto-detection.
 *
 * Uses injected `fileExists` / `readFile` to avoid touching the real fs.
 */

import { describe, expect, it } from 'vitest';

import { detectPacks } from '../src/detect.js';

function fakeFs(files: Record<string, string>): {
    fileExists: (p: string) => boolean;
    readFile: (p: string) => string;
} {
    return {
        fileExists: (p: string) => p in files,
        readFile: (p: string) => {
            const v = files[p];
            if (v === undefined) throw new Error(`fake fs: missing ${p}`);
            return v;
        },
    };
}

describe('detectPacks', () => {
    const root = '/proj';

    it('detects php from composer.json', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({ '/proj/composer.json': '{}' }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['php']);
    });

    it('detects laravel from composer dependency', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({
                '/proj/composer.json': JSON.stringify({
                    require: { 'laravel/framework': '^11' },
                }),
            }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['php', 'laravel']);
    });

    it('detects symfony from composer dependency', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({
                '/proj/composer.json': JSON.stringify({
                    require: { 'symfony/framework-bundle': '^7' },
                }),
            }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['php', 'symfony']);
    });

    it('detects javascript + typescript + react + nextjs from package.json', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({
                '/proj/package.json': JSON.stringify({
                    dependencies: { react: '^18', next: '^14' },
                    devDependencies: { typescript: '^5' },
                }),
            }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['javascript', 'typescript', 'react', 'nextjs']);
    });

    it('detects typescript from tsconfig.json when package.json has none', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({
                '/proj/package.json': '{}',
                '/proj/tsconfig.json': '{}',
            }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['javascript', 'typescript']);
    });

    it('detects python from pyproject.toml', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({ '/proj/pyproject.toml': '' }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['python']);
    });

    it('detects python from requirements.txt when pyproject absent', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({ '/proj/requirements.txt': 'flask' }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['python']);
    });

    it('returns empty for an empty project', () => {
        const signals = detectPacks({ projectRoot: root, ...fakeFs({}) });
        expect(signals).toEqual([]);
    });

    it('tolerates malformed composer.json without crashing', () => {
        const signals = detectPacks({
            projectRoot: root,
            ...fakeFs({ '/proj/composer.json': '{not json' }),
        });
        expect(signals.map((s) => s.packId)).toEqual(['php']);
    });
});
