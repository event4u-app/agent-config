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
