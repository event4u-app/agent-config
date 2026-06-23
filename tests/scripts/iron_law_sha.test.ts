
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/iron_law_sha.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'iron_law_sha.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const EMPTY_SHA = crypto.createHash('sha256').update(Buffer.from('', 'utf-8')).digest('hex');

describe('iron_law_sha — algorithm', () => {
    it('no fences hashes the empty string', () => {
        expect(mod.iron_law_sha('plain text, no fences')).toBe(EMPTY_SHA);
    });

    it('empty fence hashes the empty string', () => {
        const text = '```\n```';
        expect(mod.iron_law_sha(text)).toBe(EMPTY_SHA);
    });

    it('collapses whitespace, strips per line, upper-cases', () => {
        // Two fences; the language tag line is dropped by the regex.
        const a = '```\nfoo   bar\n```';
        const b = '```text\n  foo bar  \n```';
        // Both collapse to "FOO BAR" after WS-collapse + strip + upper.
        const expected = crypto
            .createHash('sha256')
            .update(Buffer.from('FOO BAR', 'utf-8'))
            .digest('hex');
        expect(mod.iron_law_sha(a)).toBe(expected);
        expect(mod.iron_law_sha(b)).toBe(expected);
    });

    it('concatenates multiple fences with no separator', () => {
        const text = '```\nALPHA\n```\nprose\n```\nBETA\n```';
        // norm = "ALPHA" + "BETA" (each WS-collapsed/stripped/upper)
        const expected = crypto
            .createHash('sha256')
            .update(Buffer.from('ALPHABETA', 'utf-8'))
            .digest('hex');
        expect(mod.iron_law_sha(text)).toBe(expected);
    });
});
