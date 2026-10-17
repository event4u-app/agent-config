/**
 * `token-seed-invalid` — the readers ask for validity, not for a file
 * (road-to-a-brand-the-tree-can-check 2.4).
 *
 * D8: `brand:status` parses each hit and names the first VALID one as the
 * brand, but the two other readers tested `isFile()` / "did JSON.parse throw".
 * A malformed `tokens.json` at the first canonical path therefore beat a valid
 * `assets/tokens.json` at the second: the scaffold seeded its plan from a file
 * nothing can read, the renderer fell through to its stated fallback, and
 * `brand:status` reported the valid file. Three readers, three answers to one
 * question.
 *
 * Each case pairs a broken file at the FIRST path with a valid one further
 * down, because that ordering is what makes the two predicates disagree — a
 * broken file alone would look the same under either.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { readBackgroundTokens } from '../../src/cli/commands/uiRenderAsset.js';
import { _brand_token_source } from '../../src/agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';
import { findBrandTokens } from '../../src/scripts/_cli/cmd_brand_status.js';
import { BRAND_TOKEN_PATHS } from '../../src/shared/brandTokenPaths.js';

function scratch(): string {
    return mkdtempSync(join(tmpdir(), 'brand-readers-'));
}

function writeAt(root: string, rel: string, body: string): void {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
}

/** A DTCG document carrying the backgrounds the renderer looks for. */
const VALID = JSON.stringify({
    color: {
        background: {
            light: { $value: '#fafafa', $type: 'color' },
            dark: { $value: '#101010', $type: 'color' },
        },
    },
});

describe('token-seed-invalid', () => {
    const [first, second] = BRAND_TOKEN_PATHS as [string, string];

    it('token-seed-invalid: the scaffold skips a malformed file for a valid one', () => {
        const root = scratch();
        writeAt(root, first, 'not json {');
        writeAt(root, second, VALID);
        expect(_brand_token_source(root)).toBe(second);
    });

    it('token-seed-invalid: the scaffold agrees with the resolver, file for file', () => {
        for (const broken of ['not json {', '[]', '{"color":{"brand":"#fff"}}']) {
            const root = scratch();
            writeAt(root, first, broken);
            writeAt(root, second, VALID);
            expect(_brand_token_source(root)).toBe(findBrandTokens(root));
        }
    });

    it('token-seed-invalid: a lone malformed file is no brand at all, not a brand', () => {
        const root = scratch();
        writeAt(root, first, 'not json {');
        expect(_brand_token_source(root)).toBeNull();
        expect(findBrandTokens(root)).toBeNull();
    });

    it('token-seed-invalid: the renderer reads the valid file past a malformed one', () => {
        const root = scratch();
        writeAt(root, first, '[]');
        writeAt(root, second, VALID);
        const reading = readBackgroundTokens(root);
        expect(reading.source).toBe('tokens');
        expect(reading.tokens_file).toBe(second);
        expect(reading.light).toBe('#fafafa');
    });

    it('token-seed-invalid: the renderer does not take a background from a non-DTCG file', () => {
        // `findToken` accepts a bare `value` key, so a file with no `$value`
        // anywhere used to yield a background and be reported as `tokens` —
        // a source `brand:status` calls invalid. This is the one case where
        // "parsed without throwing" and "is a token document" disagree.
        const root = scratch();
        writeAt(root, first, JSON.stringify({ background: { light: { value: '#ff0000' } } }));
        writeAt(root, second, VALID);
        const reading = readBackgroundTokens(root);
        expect(reading.tokens_file).toBe(second);
        expect(reading.light).toBe('#fafafa');
    });

    it('token-seed-invalid: the renderer still falls back when nothing is valid', () => {
        const root = scratch();
        writeAt(root, first, 'not json {');
        const reading = readBackgroundTokens(root);
        expect(reading.source).toBe('fallback');
        expect(reading.tokens_file).toBeNull();
    });

    it('token-seed-invalid: a valid file at the first path still wins', () => {
        const root = scratch();
        writeAt(root, first, VALID);
        writeAt(root, second, VALID);
        expect(_brand_token_source(root)).toBe(first);
        expect(readBackgroundTokens(root).tokens_file).toBe(first);
    });
});
