// Tests for src/scripts/lint_hidden_unicode.ts (py2ts Phase 1 — VERIFY).
//
// No pytest suite exists. Golden-parity layer runs python3 vs tsx and asserts
// byte-identical stdout/stderr/exit. Two parity surfaces:
//   1. the REAL repo `src/` tree (clean exit-0 path; default + --json),
//   2. a self-contained fixture repo carrying its own _lib + linter so the
//      linter's `ROOT = parents[3]` resolves to the fixture (crafted-hit
//      exit-1 path; default + --json + --fix).
//
// Smuggling codepoints are embedded via escape sequences (String.fromCodePoint)
// so this test file itself stays clean of the very tokens the linter flags.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as lhu from '../../src/scripts/lint_hidden_unicode.js';
import * as sl from '../../src/scripts/_lib/security_lint.js';



// Invisible codepoints via escape — keeps this file clean of literal smuggles.
const ZW = String.fromCodePoint(0x200b); // ZERO WIDTH SPACE
const RLO = String.fromCodePoint(0x202e); // RIGHT-TO-LEFT OVERRIDE
const TAG_A = String.fromCodePoint(0xe0041); // TAG LATIN CAPITAL LETTER A
const CTRL = String.fromCodePoint(0x01); // control-char (unnamed)
const PUA = String.fromCodePoint(0xe000); // PUA (unnamed)
const VS = [0xe0100, 0xe0101, 0xe0102].map((c) => String.fromCodePoint(c)).join('');

// --- Unit spec over exported pure helpers -----------------------------------

describe('lint_hidden_unicode — _classify', () => {
    it('classifies the codepoint families', () => {
        expect(lhu._classify(0x202e)).toBe('bidi-control');
        expect(lhu._classify(0x200b)).toBe('zero-width');
        expect(lhu._classify(0xe0041)).toBe('unicode-tag');
        expect(lhu._classify(0x206a)).toBe('deprecated-format');
        expect(lhu._classify(0xe000)).toBe('private-use-area');
        expect(lhu._classify(0x01)).toBe('control-char');
        expect(lhu._classify(0x7f)).toBe('control-char');
    });
    it('returns null for ordinary text and the tab/newline/CR carve-outs', () => {
        expect(lhu._classify('a'.codePointAt(0)!)).toBeNull();
        expect(lhu._classify(0x09)).toBeNull();
        expect(lhu._classify(0x0a)).toBeNull();
        expect(lhu._classify(0x0d)).toBeNull();
    });
});

describe('lint_hidden_unicode — _scan over a built ScannedFile', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    });
    function scanText(body: string): sl.Finding[] {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hu-unit-'));
        const p = path.join(tmp, 'f.md');
        fs.writeFileSync(p, body, 'utf-8');
        return lhu._scan(sl.scan_file(p));
    }

    it('reports a bidi control with the exact CPython name + codepoint', () => {
        const hits = scanText(`clean\nbad${RLO}mid\n`);
        expect(hits).toHaveLength(1);
        expect(hits[0]!.line).toBe(2);
        expect(hits[0]!.severity).toBe('HIGH');
        expect(hits[0]!.message).toBe('bidi-control U+202E (RIGHT-TO-LEFT OVERRIDE)');
        expect(hits[0]!.is_fail).toBe(true);
    });

    it('names a Tag-block char, falls back to <unnamed> for control/PUA', () => {
        const hits = scanText(`a${TAG_A}b\nc${CTRL}d\ne${PUA}f\n`);
        expect(hits.map((h) => h.message)).toEqual([
            'unicode-tag U+E0041 (TAG LATIN CAPITAL LETTER A)',
            'control-char U+0001 (<unnamed>)',
            'private-use-area U+E000 (<unnamed>)',
        ]);
    });

    it('flags a variation-selector run of >=3 once per line', () => {
        const hits = scanText(`vs${VS} tail\n`);
        expect(hits).toHaveLength(1);
        expect(hits[0]!.message).toBe('variation-selector run x3 (steganography signature)');
    });

    it('respects the security-lint allow pragma (whole file exempt)', () => {
        const hits = scanText(
            `<!-- security-lint: allow hidden-unicode "teaching" -->\nbad${ZW}here\n`,
        );
        expect(hits).toHaveLength(0);
    });

    it('skips a ```security-example fence but not ordinary text', () => {
        const hits = scanText('```security-example\n' + `bad${ZW}here\n` + '```\n' + `live${ZW}x\n`);
        expect(hits).toHaveLength(1);
        expect(hits[0]!.line).toBe(4);
    });
});

// --- Source pass: raw control bytes make a text file invisible to tools ------
//
// `road-to-runtime-encoding-hardening` S0.0c. These assertions exist because a
// green run of this pass would otherwise be indistinguishable from a pass whose
// file list was empty — the exact failure the pass was added to catch.
describe('lint_hidden_unicode — _scanSourceControlBytes (source pass)', () => {
    /** Write a file under sl.ROOT (the pass resolves paths against it). */
    function withRepoFile(rel: string, bytes: Buffer, fn: (rel: string) => void): void {
        const abs = path.join(sl.ROOT, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, bytes);
        try {
            fn(rel);
        } finally {
            fs.rmSync(abs, { force: true });
        }
    }

    const NUL = Buffer.from([0x00]);

    it('flags a raw NUL and names the line + the escape to use', () => {
        const body = Buffer.concat([
            Buffer.from('const a = 1;\nconst k = `x'),
            NUL,
            Buffer.from('y`;\n'),
        ]);
        withRepoFile('tmp-hu-source-probe.ts', body, (rel) => {
            const hits = lhu._scanSourceControlBytes([rel]);
            expect(hits).toHaveLength(1);
            expect(hits[0]!.line).toBe(2);
            expect(hits[0]!.severity).toBe('HIGH');
            expect(hits[0]!.is_fail).toBe(true);
            expect(hits[0]!.message).toContain('raw control character U+00');
            expect(hits[0]!.message).toContain('\\0');
        });
    });

    it('flags other C0 controls but never tab / LF / CR', () => {
        const body = Buffer.concat([Buffer.from('a\tb\r\nc'), Buffer.from([0x07]), Buffer.from('d\n')]);
        withRepoFile('tmp-hu-source-ctrl.ts', body, (rel) => {
            const hits = lhu._scanSourceControlBytes([rel]);
            expect(hits).toHaveLength(1);
            expect(hits[0]!.message).toContain('raw control character U+07');
            expect(hits[0]!.line).toBe(2);
        });
    });

    it('flags DEL and the C1 range, which a byte-level check misses', () => {
        // Regression lock on a real hole. The first version of this pass tested
        // BYTES <= 0x1F, so DEL (a single byte ABOVE the range) and the C1
        // controls (two-byte UTF-8, no byte <= 0x1F) both slipped through — and
        // `tests/scripts/retrieval_sanitize.test.ts` was consequently rendered
        // as `Bin` by git, unreviewable on a PR, while passing this check.
        const body = Buffer.from(`const a = 'x${String.fromCodePoint(0x7f)}';\n`, 'utf-8');
        withRepoFile('tmp-hu-source-del.ts', body, (rel) => {
            const hits = lhu._scanSourceControlBytes([rel]);
            expect(hits).toHaveLength(1);
            expect(hits[0]!.message).toContain('U+7F');
        });
        const c1 = Buffer.from(`const b = 'y${String.fromCodePoint(0x85)}';\n`, 'utf-8');
        // Prove the trap: the C1 encoding really contains no byte <= 0x1F.
        expect([...c1].some((b) => b !== 0x0a && b <= 0x1f)).toBe(false);
        withRepoFile('tmp-hu-source-c1.ts', c1, (rel) => {
            const hits = lhu._scanSourceControlBytes([rel]);
            expect(hits).toHaveLength(1);
            expect(hits[0]!.message).toContain('U+85');
        });
    });

    it('passes a file whose NUL is written as the \\0 escape (the fix)', () => {
        // Two ASCII chars, backslash + zero — identical runtime string, and the
        // file stays readable by grep / file(1). This is what the fix produces.
        const body = Buffer.from('const k = `x\\0y`;\n');
        withRepoFile('tmp-hu-source-escaped.ts', body, (rel) => {
            expect(lhu._scanSourceControlBytes([rel])).toEqual([]);
        });
    });

    it('ignores binary extensions and non-UTF-8 content', () => {
        const withNul = Buffer.concat([Buffer.from('PK'), NUL, Buffer.from('data')]);
        withRepoFile('tmp-hu-source.png', withNul, (rel) => {
            expect(lhu._scanSourceControlBytes([rel])).toEqual([]);
        });
        // Invalid UTF-8 with an unlisted extension → binary regardless.
        const invalidUtf8 = Buffer.concat([Buffer.from([0xff, 0xfe]), NUL]);
        withRepoFile('tmp-hu-source.weirdext', invalidUtf8, (rel) => {
            expect(lhu._scanSourceControlBytes([rel])).toEqual([]);
        });
    });

    it('ignores generated projections — an authoring rule, fixed at the source', () => {
        const body = Buffer.concat([Buffer.from('const k = `x'), NUL, Buffer.from('y`;\n')]);
        withRepoFile('dist/agent-src/tmp-hu-generated.ts', body, (rel) => {
            expect(lhu._scanSourceControlBytes([rel])).toEqual([]);
        });
    });

    it('reports the real repo as clean — the regression lock', () => {
        // Guards the S0.0c fix: 25 files carried raw control bytes and were
        // silently unreadable by grep. If one comes back, this goes red.
        const eligible = lhu._eligibleSourceFiles();
        expect(eligible).not.toBeNull();
        // Scope assertion: a pass over an empty list would "succeed" vacuously.
        expect(eligible!.length).toBeGreaterThan(500);
        expect(lhu._scanSourceControlBytes(eligible)).toEqual([]);
    });
});
