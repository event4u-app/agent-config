import { describe, expect, it } from 'vitest';

import { assertOutbound, neutraliseForGithub, outboundRefusals, OutboundRefusedError } from '../../src/scripts/_lib/outbound_text.js';

describe('outboundRefusals', () => {
    it('names what fired and never echoes the body', () => {
        const body = 'key ghp_0123456789abcdefghijklmnopqrstuvwxyzAB at /home/bob/x and mail bob@corp.internal.io';
        const r = outboundRefusals(body);
        expect(r.some((x) => x.startsWith('credential'))).toBe(true);
        expect(r).toContain('absolute local path');
        expect(r).toContain('e-mail address');
        expect(r.join(' ')).not.toContain('ghp_');
        expect(r.join(' ')).not.toContain('bob');
    });

    it('passes a plain ledger with repo-relative anchors and documentation addresses', () => {
        expect(outboundRefusals('| 1 | point A | src/scripts/x.ts:12 | t@example.com |')).toEqual([]);
    });

    it('assertOutbound throws an OutboundRefusedError', () => {
        expect(() => assertOutbound('see /Users/carol/secret', 'PR body')).toThrow(OutboundRefusedError);
    });
});

describe('neutraliseForGithub', () => {
    it('breaks mentions, links, images and HTML while keeping the words', () => {
        const out = neutraliseForGithub('hi @team, [x](https://a.b) ![i](http://c.d) <b>bold</b> www.e.f');
        expect(out).toContain('@​team');
        expect(out).not.toContain('](');
        expect(out).not.toMatch(/https?:\/\//u);
        expect(out).not.toContain('<b>');
        expect(out).toContain('bold');
    });

    it('leaves an e-mail-shaped address alone so the refusal can still see it', () => {
        expect(neutraliseForGithub('a@b.co')).toBe('a@b.co');
    });
});
