// Contract tests for src/scripts/_cli/explain_last/scrubber.ts (py2ts
// Phase 1, ADR-200). The scrubber is the leaf dependency of the whole
// explain_last subtree — every other module's free-form output passes
// through it, so its redaction classes are pinned here.
//
// Covers every redaction class (secret / api_key / email / url / path /
// internal-host / money), the long-string summary, idempotence, the
// non-string passthrough, and the Unicode `\w`/`\b` behaviour. The tsx twin
// is the source of truth (the python original was deleted in the py2ts
// teardown); the redaction output is pinned via inline snapshots.
import { describe, expect, it } from 'vitest';

import { scrub_string } from '../../../src/scripts/_cli/explain_last/scrubber.js';

const CORPUS: string[] = [
    // secrets
    'sk_live_ABCDEF123456 then more',
    'token ghp_abcdef1234567890 here',
    'AKIAABCDEFGHIJ',
    'api_key = ABCDEFGHIJKL123',
    'API-KEY: ZZZZZZZZZZZZ99',
    'api_key: short', // below the 12-char floor → untouched
    // emails (incl. Unicode local/host parts — `\w` is Unicode-aware)
    'a@b.co',
    'x.y+z@host-1.io',
    'café@exämple.com',
    'naïve@münchen.local',
    // paths
    '/Users/möchte/f and more',
    '/home/x/ä.py',
    'C:\\Temp\\a',
    'see /opt/data/x.json done',
    '/private/var/tmp/z',
    // urls (path/query/fragment stripped)
    'visit https://example.com/path?q=1#frag end',
    'ftp://h.io/x',
    'ws://a/b and wss://c/d',
    // internal hostnames
    'srv1.internal',
    'MY-Box.LOCAL',
    'a.localx', // not a boundary match → untouched
    'box.internal:8080',
    // money
    '$1,234.50 and USD 500 plus €99',
    'total €1,000 spent',
    'no-money $ alone',
    // resolution-order interaction (secrets/urls before path sweep)
    'mix /Users/m/x https://h.io/p a@b.com $5 srv.internal end',
    // long string → post-mask length summary
    'x'.repeat(250),
    // empties / passthrough
    '',
    'normal text with no secrets',
];

describe('explain_last/scrubber — contract', () => {
    it('scrub_string over the full corpus (pinned redaction output)', () => {
        expect(CORPUS.map((s) => scrub_string(s))).toMatchInlineSnapshot(`
          [
            "<secret> then more",
            "token <secret> here",
            "<secret>",
            "api_key=<secret>",
            "api_key=<secret>",
            "api_key: short",
            "<email>",
            "<email>",
            "<email>",
            "<email>",
            "<path> and more",
            "<path>",
            "<path>",
            "see <path> done",
            "<path>",
            "visit https://example.com/… end",
            "ftp://h.io/…",
            "ws://a/… and wss://c/…",
            "<host>",
            "<host>",
            "a.localx",
            "<host>:8080",
            "<money> and <money> plus <money>",
            "total <money> spent",
            "no-money $ alone",
            "mix <path> https://h.io/… <email> <money> <host> end",
            "<250 chars>",
            "",
            "normal text with no secrets",
          ]
        `);
    });

    it('is idempotent — scrubbing twice equals scrubbing once', () => {
        const once = CORPUS.map((s) => scrub_string(s) as string);
        const twice = once.map((s) => scrub_string(s));
        expect(twice).toEqual(once);
    });

    it('returns non-string inputs unchanged (isinstance guard)', () => {
        // Mirrors `if not isinstance(value, str) or not value: return value`.
        expect(scrub_string(null as unknown as string)).toBe(null);
        expect(scrub_string(42 as unknown as string)).toBe(42);
        expect(scrub_string('')).toBe('');
    });

    it('long-string summary uses the POST-mask code-point length', () => {
        // `aaa…` (250) → "<250 chars>"; a 199-char clean string is untouched;
        // a 201-char clean string is summarized.
        const probes = ['a'.repeat(199), 'a'.repeat(201), 'b'.repeat(250)];
        expect(probes.map((s) => scrub_string(s))).toMatchInlineSnapshot(`
          [
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "<201 chars>",
            "<250 chars>",
          ]
        `);
    });

    it('emits a Unicode code-point count (not UTF-16 units)', () => {
        // Astral chars count as ONE code point; a string of 201 emoji must
        // summarize to "<201 chars>", not "<402 chars>".
        expect(scrub_string('😀'.repeat(201))).toMatchInlineSnapshot(`"<201 chars>"`);
    });
});
