// Golden-parity tests for src/scripts/_cli/explain_last/scrubber.ts (py2ts
// Phase 1, ADR-200). The scrubber is the leaf dependency of the whole
// explain_last subtree — every other module's free-form output passes
// through it, so its redaction classes are pinned here byte-for-byte.
//
// Strategy: run the REAL python3 scrubber and the tsx twin over an identical
// corpus and assert byte-identical results per string. The Python side is
// loaded via a DIRECT-FILE importlib loader (scrubber.py has no sibling
// imports, so no sys.modules registration is needed for this module). The TS
// side is imported directly through tsx. Covers every redaction class
// (secret / api_key / email / url / path / internal-host / money), the
// long-string summary, idempotence, the non-string passthrough, and the
// Unicode `\w`/`\b` behaviour of Python's `re`.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { scrub_string } from '../../../src/scripts/_cli/explain_last/scrubber.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRUBBER_PY = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'explain_last', 'scrubber.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = hasPython3();

/**
 * Run the Python scrubber over a JSON array of strings via a direct-file
 * importlib loader and return its per-string `scrub_string` output as a JSON
 * array of strings. No PYTHONPATH needed — scrubber.py imports nothing local.
 */
function pyScrub(inputs: string[]): string[] {
    const code = [
        'import importlib.util, json, sys',
        `spec = importlib.util.spec_from_file_location("scrubmod", ${JSON.stringify(SCRUBBER_PY)})`,
        'mod = importlib.util.module_from_spec(spec)',
        'spec.loader.exec_module(mod)',
        'data = json.loads(sys.stdin.read())',
        'out = [mod.scrub_string(s) for s in data]',
        'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
    ].join('\n');
    const res = spawnSync('python3', ['-c', code], {
        encoding: 'utf8',
        input: JSON.stringify(inputs),
    });
    if (res.status !== 0) {
        throw new Error(`python scrubber failed: ${res.stderr}`);
    }
    return JSON.parse(res.stdout) as string[];
}

const CORPUS: string[] = [
    // secrets
    'sk_live_ABCDEF123456 then more',
    'token ghp_abcdef1234567890 here',
    'AKIAABCDEFGHIJ',
    'api_key = ABCDEFGHIJKL123',
    'API-KEY: ZZZZZZZZZZZZ99',
    'api_key: short', // below the 12-char floor → untouched
    // emails (incl. Unicode local/host parts — Python `\w` is Unicode-aware)
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

describe('explain_last/scrubber — golden parity', () => {
    it.runIf(HAVE_PYTHON)('matches python3 scrub_string on the full corpus', () => {
        const expected = pyScrub(CORPUS);
        const actual = CORPUS.map((s) => scrub_string(s));
        expect(actual).toEqual(expected);
    });

    it.runIf(HAVE_PYTHON)('is idempotent — scrubbing twice equals scrubbing once', () => {
        const once = CORPUS.map((s) => scrub_string(s) as string);
        const twice = once.map((s) => scrub_string(s));
        const pyOnce = pyScrub(CORPUS);
        const pyTwice = pyScrub(pyOnce);
        expect(once).toEqual(pyOnce);
        expect(twice).toEqual(pyTwice);
        expect(twice).toEqual(once); // idempotence holds on both sides
    });

    it('returns non-string inputs unchanged (isinstance guard)', () => {
        // Mirrors `if not isinstance(value, str) or not value: return value`.
        expect(scrub_string(null as unknown as string)).toBe(null);
        expect(scrub_string(42 as unknown as string)).toBe(42);
        expect(scrub_string('')).toBe('');
    });

    it.runIf(HAVE_PYTHON)('long-string summary uses the POST-mask code-point length', () => {
        // `aaa…` (250) → "<250 chars>"; a 199-char clean string is untouched;
        // a 201-char clean string is summarized. All three pinned to python.
        const probes = ['a'.repeat(199), 'a'.repeat(201), 'b'.repeat(250)];
        expect(probes.map((s) => scrub_string(s))).toEqual(pyScrub(probes));
    });

    it.runIf(HAVE_PYTHON)('emits a Unicode code-point count (not UTF-16 units)', () => {
        // Astral chars count as ONE code point in Python `len`; a string of
        // 201 emoji must summarize to "<201 chars>", not "<402 chars>".
        const s = '😀'.repeat(201);
        expect(scrub_string(s)).toEqual(pyScrub([s])[0]);
    });
});

// touch import so unused-var lints stay quiet when python is absent
void pathToFileURL;
