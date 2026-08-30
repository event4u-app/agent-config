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
    redactSourceShape,
} from '../../src/scripts/_lib/source_redact.js';
import { sourceHeaderHits } from '../../src/scripts/_lib/source_shape.js';

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

    it('a reused compiled pattern set does not skip hits across many files', () => {
        // The review noted that global String.replace resets regex state on its
        // own, so this does not prove the explicit lastIndex reset is load
        // bearing — it is belt-and-braces, and the test is kept for the
        // property that actually matters: reusing one compiled set over many
        // files is the intended usage and must be stable.
        const pats = patterns();
        for (let i = 0; i < 5; i += 1) {
            expect(redactSourceTokens('example-denied-slug', pats).count).toBe(1);
        }
    });

    // A cross-model review correctly called the previous version of this test
    // BACKWARDS: it asserted that a non-denied token survives, which a totally
    // neutered matcher also satisfies. It proved nothing about sensitivity. The
    // real discriminator is a paired assertion — the denied token must go AND
    // the neighbouring one must stay — because no single broken implementation
    // satisfies both.
    it('discriminates: the denied token goes, the non-denied neighbour stays', () => {
        const r = redactSourceTokens('example-denied-slug and a-token-that-is-not-denied', patterns());
        expect(r.count).toBe(1);
        expect(r.text).toBe(`${REDACTION_MARKER} and a-token-that-is-not-denied`);
    });
});

describe('source_redact — overlapping patterns cannot partially expose a token', () => {
    // This is a LIVE defect class, not a hypothetical: two pairs in the shipped
    // denylist have this shape, where a `\b`-bounded entry matches inside a
    // longer hyphenated entry because a hyphen is a word boundary. Applying
    // patterns sequentially let the short one consume the head and leave the
    // tail in the clear, emitting `[REDACTED:src-conf]-<tail>` — which still
    // names the source. The real pairs are NOT quoted here: this repo's own
    // step 2.2 had to fix a gate test that published real names, and repeating
    // it inside the redactor's own suite would be the same defect. The fixture
    // below reproduces the shape with invented tokens.
    const overlapping = () =>
        loadDenyPatterns(fixtureConfig(['\\bexample-denied\\b', 'example-denied-labs']));

    it('redacts the WHOLE longer token, not just its head', () => {
        const r = redactSourceTokens('see example-denied-labs for details', overlapping());
        expect(r.text).toBe(`see ${REDACTION_MARKER} for details`);
        expect(r.text).not.toContain('-labs');
    });

    it('still redacts the shorter token when it stands alone', () => {
        const r = redactSourceTokens('see example-denied for details', overlapping());
        expect(r.text).toBe(`see ${REDACTION_MARKER} for details`);
    });

    it('order in the config file does not change the outcome', () => {
        const reversed = loadDenyPatterns(
            fixtureConfig(['example-denied-labs', '\\bexample-denied\\b']),
        );
        expect(redactSourceTokens('x example-denied-labs y', reversed).text).toBe(
            `x ${REDACTION_MARKER} y`,
        );
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

describe('redactSourceShape — the half a deny set cannot reach', () => {
    it('rewrites a speaking inbox directory name and keeps the path shape', () => {
        const r = redactSourceShape('see `agents/tmp.old/some-project-round/chat.txt` for the transcript');
        expect(r.count).toBe(1);
        expect(r.text).toContain('agents/tmp.old/' + REDACTION_MARKER + '/chat.txt');
        expect(r.text).not.toContain('some-project-round');
    });

    it('leaves an OPAQUE round id alone', () => {
        for (const name of ['inbox-2026-08-h', 'round-a91f3c', 'S17']) {
            const r = redactSourceShape('quoting `agents/tmp.old/' + name + '/`');
            expect(r.count, name).toBe(0);
            expect(r.text, name).toContain(name);
        }
    });

    it('leaves a named working set alone', () => {
        const r = redactSourceShape('inputs live in `agents/tmp/bench-local/`');
        expect(r.count).toBe(0);
        expect(r.text).toContain('bench-local');
    });

    it('rewrites a speaking Source header VALUE and keeps the header', () => {
        const r = redactSourceShape('> **Source:** `a-speaking-external-reference` (2026-08-01)');
        expect(r.count).toBe(1);
        expect(r.text).toBe('> **Source:** ' + REDACTION_MARKER);
        expect(r.text).not.toContain('a-speaking-external-reference');
    });

    it('leaves an ENC1 Source value and an opaque one alone', () => {
        expect(redactSourceShape('> **Source:** ENC1:AAAABBBBCCCC').count).toBe(0);
        expect(redactSourceShape('> **Source:** inbox-2026-08-h').count).toBe(0);
    });

    it('is IDEMPOTENT — a second pass over redacted text changes nothing', () => {
        const once = redactSourceShape('> **Source:** `speaking-name`\nand `agents/tmp/speaking-dir/x`');
        expect(once.count).toBe(2);
        const twice = redactSourceShape(once.text);
        expect(twice.count, 'a redactor that re-redacts its own marker never converges').toBe(0);
        expect(twice.text).toBe(once.text);
    });

    it('the GATE accepts what this redactor writes — the two must agree', () => {
        const redacted = redactSourceShape('> **Source:** `speaking-name`').text;
        expect(sourceHeaderHits(redacted), 'a redacted header must not be a finding').toEqual([]);
    });

    it('leaves text with neither class untouched', () => {
        const clean = 'an ordinary paragraph naming src/scripts/thing.ts and nothing else';
        const r = redactSourceShape(clean);
        expect(r.count).toBe(0);
        expect(r.text).toBe(clean);
    });
});
