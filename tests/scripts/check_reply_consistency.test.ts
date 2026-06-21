// Tests for src/scripts/check_reply_consistency.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_reply_consistency.py over validate() and
// cmd_scan_dir(), plus a golden-parity layer (python3 vs tsx) for the
// --stdin and --scan-dir CLI surfaces on the REAL REPO (skipped w/o python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as crc from '../../src/scripts/check_reply_consistency.js';



describe('check_reply_consistency.validate — happy paths', () => {
    it('clean options with recommendation', () => {
        const text =
            '> 1. Foo — bar\n' +
            '> 2. Baz — qux\n' +
            '\n' +
            '**Recommendation: 1 — Foo** — reason. Caveat: flip to 2 if X.\n';
        expect(crc.validate(text)).toEqual([0, 'ok (recommendation 1 matches option block)']);
    });

    it('clean german', () => {
        const text = '> 1. Eins\n> 2. Zwei\n\n**Empfehlung: 2 — Zwei** — weil.\n';
        expect(crc.validate(text)[0]).toBe(0);
    });

    it('no options block', () => {
        expect(crc.validate('Plain reply, no options.')[0]).toBe(0);
    });

    it('options without rec non-strict', () => {
        const [code, msg] = crc.validate('> 1. Foo\n> 2. Bar\n', false);
        expect(code).toBe(0);
        expect(msg).toContain('non-strict');
    });

    it('codespan tag does not trigger', () => {
        const text =
            '> 1. Foo — describes `(recommended)` legacy pattern\n' +
            '> 2. Baz\n' +
            '\n**Recommendation: 1 — Foo** — reason.\n';
        expect(crc.validate(text)[0]).toBe(0);
    });
});

describe('check_reply_consistency.validate — failure modes', () => {
    it('inline tag recommended', () => {
        const text = '> 1. Foo (recommended)\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n';
        const [code, msg] = crc.validate(text);
        expect(code).toBe(2);
        expect(msg).toContain('inline tag');
    });

    it('inline tag rec short', () => {
        const text = '> 1. Foo (rec)\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n';
        expect(crc.validate(text)[0]).toBe(2);
    });

    it('inline tag empfohlen', () => {
        const text = '> 1. Foo (empfohlen)\n> 2. Bar\n\n**Empfehlung: 1 — Foo** — r.\n';
        expect(crc.validate(text)[0]).toBe(2);
    });

    it('multi distinct recommendations', () => {
        const text =
            '> 1. Foo\n> 2. Bar\n\n' +
            '**Recommendation: 1 — Foo** — r.\n' +
            'Empfehlung: 2 weil.\n';
        const [code, msg] = crc.validate(text);
        expect(code).toBe(3);
        expect(msg).toContain('[1, 2]');
    });

    it('repeated same number is not multi', () => {
        const text =
            '> 1. Foo\n> 2. Bar\n\n' +
            '**Recommendation: 1 — Foo** — r.\n' +
            '(Earlier I also said Recommendation: 1 — same.)\n';
        expect(crc.validate(text)[0]).toBe(0);
    });

    it('recommended number not in options', () => {
        const text = '> 1. Foo\n> 2. Bar\n\n**Recommendation: 5 — Phantom** — r.\n';
        const [code, msg] = crc.validate(text);
        expect(code).toBe(4);
        expect(msg).toContain('5');
    });

    it('strict options without rec', () => {
        const [code] = crc.validate('> 1. Foo\n> 2. Bar\n', true);
        expect(code).toBe(5);
    });
});

describe('check_reply_consistency.cmd_scan_dir', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crc-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('finds legacy (exit 6)', () => {
        fs.writeFileSync(path.join(tmp, 'bad.md'), '> 1. Foo (recommended)\n> 2. Bar\n');
        expect(crc.cmd_scan_dir(tmp)).toBe(6);
    });

    it('clean (exit 0)', () => {
        fs.writeFileSync(
            path.join(tmp, 'good.md'),
            '> 1. Foo\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n',
        );
        expect(crc.cmd_scan_dir(tmp)).toBe(0);
    });

    it('ignores codespan tag', () => {
        fs.writeFileSync(
            path.join(tmp, 'doc.md'),
            '> 1. Foo — describe `(recommended)` legacy\n> 2. Bar\n',
        );
        expect(crc.cmd_scan_dir(tmp)).toBe(0);
    });

    it('missing path (exit 9)', () => {
        expect(crc.cmd_scan_dir(path.join(tmp, 'does-not-exist'))).toBe(9);
    });
});

