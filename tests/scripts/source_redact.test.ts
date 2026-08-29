/**
 * Tests for `_lib/source_redact.ts` — the write-time deny-set redactor
 * (`road-to-source-silence` Phase 3.4, first half).
 *
 * The fixture config uses INVENTED tokens, never a real deny entry. A test that
 * hard-codes a real source name republishes the thing the module exists to
 * remove — the same failure step 2.2 of that roadmap already had to fix once in
 * the gate's own test.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    REDACTION_MARKER,
    loadDenyPatterns,
    redactSourceTokens,
    writeRedacted,
} from '../../src/scripts/_lib/source_redact.js';

/** A throwaway denylist config carrying only invented tokens. */
function fixtureConfig(deny: string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-redact-'));
    const p = path.join(dir, 'denylist.json');
    fs.writeFileSync(p, JSON.stringify({ deny, skip_paths: [] }), 'utf-8');
    return p;
}

describe('source_redact — loadDenyPatterns', () => {
    it('compiles every deny entry', () => {
        const pats = loadDenyPatterns(fixtureConfig(['example-denied-slug', 'example-denied-word']));
        expect(pats).toHaveLength(2);
    });

    it('refuses an empty deny list rather than silently matching nothing', () => {
        expect(() => loadDenyPatterns(fixtureConfig([]))).toThrow(/empty deny list/);
    });

    it('the SHIPPED config loads — the module and the gate read one source of truth', () => {
        expect(loadDenyPatterns().length).toBeGreaterThan(0);
    });
});

describe('source_redact — redactSourceTokens', () => {
    const patterns = () => loadDenyPatterns(fixtureConfig(['example-denied-slug']));

    it('replaces a hit with the marker and counts it', () => {
        const r = redactSourceTokens('we borrowed this from example-denied-slug, honestly', patterns());
        expect(r.count).toBe(1);
        expect(r.text).toContain(REDACTION_MARKER);
        expect(r.text).not.toContain('example-denied-slug');
    });

    it('replaces EVERY occurrence on a line, not just the first', () => {
        const r = redactSourceTokens('example-denied-slug and example-denied-slug again', patterns());
        expect(r.count).toBe(2);
        expect(r.text).not.toContain('example-denied-slug');
    });

    it('is case-insensitive, matching the gate', () => {
        const r = redactSourceTokens('EXAMPLE-DENIED-SLUG', patterns());
        expect(r.count).toBe(1);
    });

    it('leaves clean text byte-identical — no redaction, no count', () => {
        const clean = 'diff --git a/src/x.ts b/src/x.ts\n+const y = 1;\n';
        const r = redactSourceTokens(clean, patterns());
        expect(r.text).toBe(clean);
        expect(r.count).toBe(0);
    });

    it('is line-local: surrounding diff structure survives intact', () => {
        const patch = [
            'diff --git a/a.md b/a.md',
            '--- a/a.md',
            '+++ b/a.md',
            '@@ -1,2 +1,2 @@',
            '-old line mentioning example-denied-slug here',
            '+new line',
        ].join('\n');
        const r = redactSourceTokens(patch, patterns());
        const lines = r.text.split('\n');
        expect(lines).toHaveLength(6);
        expect(lines[0]).toBe('diff --git a/a.md b/a.md');
        expect(lines[3]).toBe('@@ -1,2 +1,2 @@');
        expect(lines[4]).toBe(`-old line mentioning ${REDACTION_MARKER} here`);
        expect(lines[5]).toBe('+new line');
    });

    it('a reused compiled pattern does not skip hits — lastIndex is reset per call', () => {
        // A `g` RegExp carries lastIndex across .replace calls. Reusing one
        // compiled set over many files is the intended usage, so this is the
        // bug the reset guards against.
        const pats = patterns();
        const first = redactSourceTokens('example-denied-slug', pats);
        const second = redactSourceTokens('example-denied-slug', pats);
        expect(first.count).toBe(1);
        expect(second.count).toBe(1);
    });

    // SENSITIVITY PROBE. If the matcher were neutralised — the deny list empty,
    // the pattern never compiled — every assertion above would still pass on
    // clean input. This one fails in that case, so the suite can tell "nothing
    // to redact" from "redaction is broken".
    it('SENSITIVITY: a token absent from the deny set is NOT redacted', () => {
        const r = redactSourceTokens('a-token-that-is-not-denied', patterns());
        expect(r.count).toBe(0);
        expect(r.text).toBe('a-token-that-is-not-denied');
    });
});

describe('source_redact — writeRedacted', () => {
    it('writes redacted bytes to disk and returns the count', () => {
        const pats = loadDenyPatterns(fixtureConfig(['example-denied-slug']));
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-redact-out-'));
        const dest = path.join(dir, 'diff.patch');

        const count = writeRedacted(dest, 'from example-denied-slug', pats);

        expect(count).toBe(1);
        const written = fs.readFileSync(dest, 'utf-8');
        expect(written).toBe(`from ${REDACTION_MARKER}`);
        expect(written).not.toContain('example-denied-slug');
    });
});
