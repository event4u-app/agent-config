// Tests for src/scripts/ai_council/compile_corpus.ts (py2ts Phase 1).
//
// Compiles the human-edited low-impact corpus Markdown to a YAML lockfile.
// The load-bearing parity surface is the PyYAML safe_dump emitter: the TS
// twin reimplements PyYAML's scalar-style analysis (plain / single-quoted /
// double-quoted), implicit re-typing (a plain "123" / "true" / "null" forces
// quoting), and block layout byte-for-byte. Golden parity drives the TS twin
// and the CPython original over the same corpora and asserts the emitted
// bytes are identical, plus the --check / parse-error CLI exit codes.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    SCHEMA_VERSION,
    _main,
    build_lock_document,
    compile_corpus,
    dump_lock_yaml,
} from '../../../src/scripts/ai_council/compile_corpus.js';
import { parse_corpus_strict } from '../../../src/scripts/ai_council/low_impact_corpus.js';
import { hasPython3, oracleFile, runPyCode, runPyScript, runTsScript } from './_harness.js';

const py3 = hasPython3();

const GOOD = [
    '## Validated',
    '',
    '<!-- intake-anchor: validated -->',
    '',
    '- "what port" — meta here',
    '',
    '## On Probation',
    '',
    '<!-- intake-anchor: probation -->',
    '',
    '- "how to test" — first-seen 2026-05-01',
    '',
    '## Anti-Examples (Always Ask User)',
    '',
    '- "delete prod?"',
    '',
    'last-upstreamed: 0123456789abcdef0123456789abcdef01234567',
    '',
].join('\n');

// Exercises the full scalar-quoting decision tree: numerics / bools / null
// that re-type (forcing quotes), colon + hash + leading-dash block indicators,
// trailing space, tab (forces double-quote), non-ASCII (plain under
// allow_unicode), and an empty trailing_metadata ('').
const EDGE = [
    '## Validated',
    '',
    '<!-- intake-anchor: validated -->',
    '',
    '- "what port" — meta plain',
    '- "123 numeric" — meta 456',
    '- "true" — yes',
    '- "has: colon spaced" — a: b meta',
    '- "naïve café über"',
    '- "with #hash" — has #mid',
    '- "leading dash phrase" — - dashmeta',
    '- "tab\tin\tphrase" — t\tt',
    '- "emoji 😀 face"',
    '- "null"',
    '- ".5 floaty" — 1e3',
    '',
    '## On Probation',
    '',
    '<!-- intake-anchor: probation -->',
    '',
    '- "how to test" — first-seen 2026-05-01',
    '',
    '## Anti-Examples (Always Ask User)',
    '',
    '- "delete prod?"',
    '',
    'last-upstreamed: 0123456789abcdef0123456789abcdef01234567',
    '',
].join('\n');

// All three section headings present with anchors, but no bullets → the
// probation/anti lists serialise as inline `[]`. (The strict parser requires
// both the validated + probation anchors whenever any section is present.)
const EMPTY_SECTIONS = [
    '## Validated',
    '',
    '<!-- intake-anchor: validated -->',
    '',
    '- "one validated phrase"',
    '',
    '## On Probation',
    '',
    '<!-- intake-anchor: probation -->',
    '',
    '## Anti-Examples (Always Ask User)',
    '',
].join('\n');

function tmpFile(name: string, content: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'compcorp-'));
    const p = path.join(dir, name);
    writeFileSync(p, content, { encoding: 'utf-8' });
    return p;
}

describe('compile_corpus — pure builders', () => {
    it('SCHEMA_VERSION is 1', () => {
        expect(SCHEMA_VERSION).toBe(1);
    });

    it('build_lock_document drops section + carries provenance', () => {
        const src = tmpFile('c.md', GOOD);
        const text = readFileSync(src, { encoding: 'utf-8' });
        const doc = build_lock_document(src, parse_corpus_strict(src), text);
        expect(doc.schema_version).toBe(1);
        expect(doc.provenance.last_upstreamed).toBe('0123456789abcdef0123456789abcdef01234567');
        expect(doc.provenance.source_sha256).toMatch(/^[0-9a-f]{64}$/u);
        // section field is dropped from the entry dict.
        expect(Object.keys(doc.validated[0] as object).sort()).toEqual([
            'line_no',
            'normalised',
            'phrase',
            'trailing_metadata',
        ]);
        expect(doc.validated[0]?.phrase).toBe('what port');
    });

    it('dump_lock_yaml ends with exactly one trailing newline', () => {
        const src = tmpFile('c.md', GOOD);
        const text = readFileSync(src, { encoding: 'utf-8' });
        const out = dump_lock_yaml(build_lock_document(src, parse_corpus_strict(src), text));
        expect(out.endsWith('\n')).toBe(true);
        expect(out.endsWith('\n\n')).toBe(false);
    });

    it('compile_corpus writes the lockfile + returns the same text', () => {
        const src = tmpFile('c.md', GOOD);
        const outPath = path.join(path.dirname(src), 'c.lock.yaml');
        const written = compile_corpus(src, outPath);
        expect(readFileSync(outPath, { encoding: 'utf-8' })).toBe(written);
        expect(written).toContain('schema_version: 1');
    });

    it('missing source → empty validated/probation/anti, hash of empty bytes', () => {
        const outPath = tmpFile('out.yaml', '');
        const written = compile_corpus('/no/such/corpus.md', outPath);
        // SHA-256 of the empty string.
        expect(written).toContain(
            'source_sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        );
        expect(written).toContain('validated: []');
    });
});

describe('compile_corpus — CLI exit codes', () => {
    it('parse error returns 2', () => {
        const bad = tmpFile('d.md', '### Validated\n\n- "x"\n');
        const out = tmpFile('o.yaml', '');
        expect(_main(['--source', bad, '--out', out])).toBe(2);
    });

    it('--check on a stale (missing) lockfile returns 1', () => {
        const src = tmpFile('c.md', GOOD);
        expect(_main(['--check', '--source', src, '--out', '/no/such/out.yaml'])).toBe(1);
    });

    it('--check on a fresh lockfile returns 0', () => {
        const src = tmpFile('c.md', GOOD);
        const out = path.join(path.dirname(src), 'c.lock.yaml');
        compile_corpus(src, out);
        expect(_main(['--check', '--source', src, '--out', out])).toBe(0);
    });
});

describe.runIf(py3)('compile_corpus — golden parity vs CPython twin (byte-exact YAML)', () => {
    function pyCompile(corpus: string): string {
        // `--out <out>` is a volatile scratch OUTPUT path passed as a CLI arg: the
        // oracle keys the snapshot on the invocation, so `scratch: [out]` collapses
        // the volatile path to a stable token in the key, and `outputs: { lock: out }`
        // freezes the WRITTEN lockfile bytes (read after the spawn). Normal mode
        // replays the frozen bytes via oracleFile — no live python3. (`--source` is a
        // stable input fixture the oracle content-hashes; leave it.)
        const out = path.join(mkdtempSync(path.join(tmpdir(), 'pycc-')), 'lock.yaml');
        const res = runPyScript('ai_council/compile_corpus', ['--source', corpus, '--out', out], {
            outputs: { lock: out },
            scratch: [out],
        });
        expect(res.status, res.stderr).toBe(0);
        const lock = oracleFile(res, 'lock');
        expect(lock, 'frozen python lockfile must exist').not.toBeNull();
        return (lock as Buffer).toString('utf-8');
    }

    function tsCompile(corpus: string): string {
        const out = path.join(mkdtempSync(path.join(tmpdir(), 'tscc-')), 'lock.yaml');
        const res = runTsScript('ai_council/compile_corpus', ['--source', corpus, '--out', out]);
        expect(res.status, res.stderr).toBe(0);
        return readFileSync(out, { encoding: 'utf-8' });
    }

    it('clean corpus → byte-identical lockfile', () => {
        const src = tmpFile('c.md', GOOD);
        expect(tsCompile(src)).toBe(pyCompile(src));
    });

    it('quoting edge cases → byte-identical lockfile', () => {
        const src = tmpFile('edge.md', EDGE);
        const pyOut = pyCompile(src);
        const tsOut = tsCompile(src);
        expect(tsOut).toBe(pyOut);
        // Sanity: a whole-string bool / null re-types → forced single-quote.
        expect(pyOut).toContain("phrase: 'true'");
        expect(pyOut).toContain("phrase: 'null'");
        // A leading-`#` block indicator inside the phrase forces single-quote.
        expect(pyOut).toContain("phrase: 'with #hash'");
        // A colon-space block indicator forces single-quote.
        expect(pyOut).toContain("phrase: 'has: colon spaced'");
        // "123 numeric" is NOT a whole-string int → stays plain.
        expect(pyOut).toContain('phrase: 123 numeric');
        // Tab forces double-quote with a \t escape.
        expect(pyOut).toContain('phrase: "tab\\tin\\tphrase"');
        // Non-ASCII stays plain under allow_unicode.
        expect(pyOut).toContain('phrase: naïve café über');
    });

    it('empty probation/anti sections → "[]" inline, byte-identical', () => {
        const src = tmpFile('empty.md', EMPTY_SECTIONS);
        const pyOut = pyCompile(src);
        expect(pyOut).toContain('probation: []');
        expect(pyOut).toContain('anti_examples: []');
        expect(tsCompile(src)).toBe(pyOut);
    });

    it('missing source → byte-identical (empty-hash) lockfile', () => {
        const missing = path.join(tmpdir(), 'definitely-not-here-compcorp.md');
        expect(tsCompile(missing)).toBe(pyCompile(missing));
    });

    it('parse-error stderr + exit code match', () => {
        const bad = tmpFile('bad.md', '### Validated\n\n- "x"\n');
        const out = tmpFile('o.yaml', '');
        // Error exit writes NO output file — the observable is exit-code + stderr only.
        // `--out <out>` is still a volatile path in argv, so `scratch: [out]` keeps the
        // snapshot key stable across capture/replay; no `outputs` (nothing to freeze).
        const py = runPyScript('ai_council/compile_corpus', ['--source', bad, '--out', out], {
            scratch: [out],
        });
        const ts = runTsScript('ai_council/compile_corpus', ['--source', bad, '--out', out]);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('build_lock_document structured output matches', () => {
        const src = tmpFile('c.md', GOOD);
        const expected = JSON.parse(
            (() => {
                const code = [
                    'import json, sys',
                    'from pathlib import Path',
                    'from scripts.ai_council import compile_corpus as C',
                    'p = Path(sys.argv[1])',
                    'text = p.read_text(encoding="utf-8")',
                    'from scripts.ai_council.low_impact_corpus import parse_corpus_strict',
                    'doc = C.build_lock_document(p, parse_corpus_strict(p), text)',
                    'print(json.dumps(doc, ensure_ascii=False))',
                ].join('\n');
                const res = runPyCode(code, [src]);
                expect(res.status, res.stderr).toBe(0);
                return res.stdout;
            })(),
        ) as Record<string, unknown>;
        const text = readFileSync(src, { encoding: 'utf-8' });
        const doc = build_lock_document(src, parse_corpus_strict(src), text);
        expect(JSON.parse(JSON.stringify(doc))).toEqual(expected);
    });
});
