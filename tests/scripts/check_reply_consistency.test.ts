// Tests for src/scripts/check_reply_consistency.ts (strict-by-default rewrite).
//
// Drives check_reply() (per-block validation per user-interaction.md Iron
// Law 1 + user-interaction-mechanics § pre-send self-check) and the
// cmd_scan_dir() legacy inline-tag sweep. Cases that encoded the old
// prototype's behavior (lax default, whole-reply "multiple distinct
// recommendations = error") are replaced by the spec'd semantics.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as crc from '../../src/scripts/check_reply_consistency.js';

describe('check_reply_consistency.check_reply — happy paths', () => {
    it('clean options with adjacent recommendation', () => {
        const text =
            '> 1. Foo — bar\n' +
            '> 2. Baz — qux\n' +
            '\n' +
            '**Recommendation: 1 — Foo** — reason. Caveat: flip to 2 if X.\n';
        expect(crc.check_reply(text)).toEqual([]);
    });

    it('clean german', () => {
        const text = '> 1. Eins\n> 2. Zwei\n\n**Empfehlung: 2 — Zwei** — weil.\n';
        expect(crc.check_reply(text)).toEqual([]);
    });

    it('no options block', () => {
        expect(crc.check_reply('Plain reply, no options.')).toEqual([]);
    });

    it('codespan tag does not trigger', () => {
        const text =
            '> 1. Foo — describes `(recommended)` legacy pattern\n' +
            '> 2. Baz\n' +
            '\n**Recommendation: 1 — Foo** — reason.\n';
        expect(crc.check_reply(text)).toEqual([]);
    });

    it('two blocks with two different recommendation lines is VALID', () => {
        const text =
            '> 1. Fix the code\n' +
            '> 2. Fix the test\n' +
            '\n' +
            '**Recommendation: 1 — Fix the code** — the test asserts the contract.\n' +
            '\n' +
            'And for the follow-up:\n' +
            '\n' +
            '> 1. Ship now\n' +
            '> 2. Wait for review\n' +
            '> 3. Skip\n' +
            '\n' +
            '**Recommendation: 2 — Wait for review** — the diff touches auth.\n';
        expect(crc.check_reply(text)).toEqual([]);
    });

    it('wrong-language-only label still counts (documented limit — script cannot know user language)', () => {
        // Per Iron Law 1 a wrong-language label = no recommendation, but the
        // draft alone does not carry the user's language; both labels pass.
        const text = '> 1. Foo\n> 2. Bar\n\n**Empfehlung: 1 — Foo** — reason in English.\n';
        expect(crc.check_reply(text)).toEqual([]);
    });

    it('example options block inside a code fence is ignored', () => {
        const text =
            'The format looks like this:\n' +
            '\n' +
            '```\n' +
            '> 1. Foo\n' +
            '> 2. Bar\n' +
            '```\n' +
            '\n' +
            'No live options in this reply.\n';
        expect(crc.check_reply(text)).toEqual([]);
    });
});

describe('check_reply_consistency.check_reply — failure modes', () => {
    it('missing recommendation on a single block fails (strict is the default)', () => {
        const findings = crc.check_reply('> 1. Foo\n> 2. Bar\n');
        expect(findings).toHaveLength(1);
        expect(findings[0]!.message).toContain('without a Recommendation');
    });

    it('two blocks with only one recommendation fails on the unguarded block', () => {
        const text =
            '> 1. Foo\n' +
            '> 2. Bar\n' +
            '\n' +
            '**Recommendation: 1 — Foo** — reason.\n' +
            '\n' +
            '> 1. Alpha\n' +
            '> 2. Beta\n';
        const findings = crc.check_reply(text);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.line).toBe(6);
        expect(findings[0]!.message).toContain('without a Recommendation');
    });

    it('recommendation separated by a heading is not adjacent', () => {
        const text =
            '> 1. Foo\n' +
            '> 2. Bar\n' +
            '\n' +
            '## Next steps\n' +
            '\n' +
            '**Recommendation: 1 — Foo** — reason.\n';
        const findings = crc.check_reply(text);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.message).toContain('without a Recommendation');
    });

    it('recommendation beyond the 2-non-blank-line window is not adjacent', () => {
        const text =
            '> 1. Foo\n' +
            '> 2. Bar\n' +
            '\n' +
            'Some prose line one.\n' +
            'Some prose line two.\n' +
            '**Recommendation: 1 — Foo** — too far down.\n';
        const findings = crc.check_reply(text);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.message).toContain('without a Recommendation');
    });

    it('recommendation number out of the block range fails', () => {
        const text = '> 1. Foo\n> 2. Bar\n\n**Recommendation: 5 — Phantom** — r.\n';
        const findings = crc.check_reply(text);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.message).toContain('recommendation 5 not present');
    });

    it('two recommendation lines under one block fails', () => {
        const text =
            '> 1. Foo\n' +
            '> 2. Bar\n' +
            '\n' +
            '**Recommendation: 1 — Foo** — r.\n' +
            'Empfehlung: 2 — weil.\n';
        const findings = crc.check_reply(text);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.message).toContain('multiple recommendation lines');
    });

    it('inline tag recommended', () => {
        const text = '> 1. Foo (recommended)\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n';
        const findings = crc.check_reply(text);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.message).toContain('inline tag');
    });

    it('inline tag rec short', () => {
        const text = '> 1. Foo (rec)\n> 2. Bar\n\n**Recommendation: 1 — Foo** — r.\n';
        expect(crc.check_reply(text)[0]!.message).toContain('inline tag');
    });

    it('inline tag empfohlen', () => {
        const text = '> 1. Foo (empfohlen)\n> 2. Bar\n\n**Empfehlung: 1 — Foo** — r.\n';
        expect(crc.check_reply(text)[0]!.message).toContain('inline tag');
    });
});

describe('check_reply_consistency.find_option_blocks', () => {
    it('splits two blocks separated by a recommendation line', () => {
        const text =
            '> 1. Foo\n> 2. Bar\n\n**Recommendation: 1** — r.\n\n> 1. Alpha\n> 2. Beta\n> 3. Gamma\n';
        const blocks = crc.find_option_blocks(text);
        expect(blocks).toHaveLength(2);
        expect(blocks[0]!.numbers).toEqual([1, 2]);
        expect(blocks[1]!.numbers).toEqual([1, 2, 3]);
    });

    it('a single numbered line is not an options block', () => {
        expect(crc.find_option_blocks('1. lone item\n\nprose\n')).toEqual([]);
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

    it('finds legacy inline tag (exit 2)', () => {
        fs.writeFileSync(path.join(tmp, 'bad.md'), '> 1. Foo (recommended)\n> 2. Bar\n');
        expect(crc.cmd_scan_dir(tmp)).toBe(2);
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

    it('missing path (exit 1)', () => {
        expect(crc.cmd_scan_dir(path.join(tmp, 'does-not-exist'))).toBe(1);
    });
});
