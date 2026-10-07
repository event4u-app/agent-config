import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    FAMILY_ERE,
    TICKET_DENYLIST,
    TICKET_GRAMMAR,
    TICKET_TOKEN,
    checkSubject,
    classifySubject,
    firstTicket,
    renderBranch,
    ticketCandidates,
    VERSION_LIKE_KEYS,
} from '../../../src/scripts/_lib/git_convention_grammar.js';

const ROOT = path.resolve(__dirname, '..', '..', '..');

describe('ticket grammar', () => {
    it('returns every candidate in a name, not only the first', () => {
        expect(ticketCandidates('feat/DEV-12-OPS-7-thing').map((c) => c.token)).toEqual(['DEV-12', 'OPS-7']);
    });

    it('reads a security branch as no ticket', () => {
        const all = ticketCandidates('fix/CVE-2026-12345-patch');
        expect(all.map((c) => [c.token, c.status])).toEqual([['CVE-2026', 'standard-name']]);
        expect(firstTicket('fix/CVE-2026-12345-patch')).toBeNull();
        expect(firstTicket('fix/CVE-2026-12345-patch', ['CVE', 'DEV'])).toBeNull();
    });

    it('denies the seven standard prefixes and takes the next match', () => {
        expect(TICKET_DENYLIST).toEqual(['UTF', 'ISO', 'SHA', 'RFC', 'CVE', 'CWE', 'GHSA']);
        expect(firstTicket('fix/UTF-8-and-DEV-9-encoding')).toBe('DEV-9');
        expect(firstTicket('chore/CWE-79-xss')).toBeNull();
    });

    it('marks a key that is not on the allowlist as unknown, and omits it from the first ticket', () => {
        const all = ticketCandidates('feat/ABC-1-DEV-2-x', ['DEV']);
        expect(all.map((c) => c.status)).toEqual(['unknown-key', 'ticket']);
        expect(firstTicket('feat/ABC-1-DEV-2-x', ['DEV'])).toBe('DEV-2');
        expect(firstTicket('feat/ABC-1-x', ['DEV'])).toBeNull();
    });

    it('finds a ticket only as a whole token, never inside a longer one', () => {
        expect(ticketCandidates('feat/fooDEV-12-x')).toEqual([]);
        expect(ticketCandidates('feat/9DEV-12-x')).toEqual([]);
        expect(ticketCandidates('feat/DEV-12-x').map((c) => c.token)).toEqual(['DEV-12']);
        expect(checkSubject('feat(apiDEV-1): add x', { format: 'ticket-conventional' }).ok).toBe(true);
    });

    it('still reads a version-like key as a ticket shape, which ticket_keys settles', () => {
        expect(firstTicket('feat/HTTP2-1-client')).toBe('HTTP2-1');
        expect(firstTicket('feat/HTTP2-1-DEV-4-client', ['DEV'])).toBe('DEV-4');
        expect(TICKET_TOKEN).toBe(`(?<![A-Za-z0-9])${TICKET_GRAMMAR}(?![0-9])`);
    });

    it('without a card, reads a protocol or language name with a one-digit version as no ticket', () => {
        expect(ticketCandidates('feat/HTTP-2-support').map((c) => [c.token, c.status])).toEqual([['HTTP-2', 'version-like']]);
        expect(firstTicket('feat/HTTP-2-support')).toBeNull();
        expect(firstTicket('feat/PHP-8-upgrade')).toBeNull();
        expect(firstTicket('feat/PHP-8-DEV-12-upgrade')).toBe('DEV-12');
        // Two digits is a ticket number, not a major version.
        expect(firstTicket('feat/PHP-12-upgrade')).toBe('PHP-12');
        expect(VERSION_LIKE_KEYS).toContain('HTTP');
        expect(checkSubject('feat(HTTP-2): add client', { format: 'ticket-conventional' }).ok).toBe(true);
    });

    it('lets a card that lists such a key keep it as a ticket', () => {
        expect(firstTicket('feat/PHP-8-upgrade', ['PHP'])).toBe('PHP-8');
    });

    it('leaves a lowercase key undetected without a card, and matches a card key case-insensitively', () => {
        expect(ticketCandidates('feat/dev-12-export')).toEqual([]);
        expect(firstTicket('feat/dev-12-export', ['DEV'])).toBe('DEV-12');
        expect(firstTicket('feat/Dev-12-export', ['DEV'])).toBe('DEV-12');
        expect(ticketCandidates('feat/add-2-items', ['DEV'])).toEqual([]);
    });

    it('is the grammar the command suggester matches prompts with', () => {
        const src = fs.readFileSync(path.join(ROOT, 'src/scripts/command_suggester/match.ts'), 'utf8');
        const m = /const _TICKET_RE = \/([^/]+)\//.exec(src);
        expect(m).not.toBeNull();
        expect((m?.[1] as string).replace(/\\d/g, '[0-9]')).toBe(TICKET_GRAMMAR);
    });
});

describe('subject grammar per format', () => {
    it('accepts the ticket as the scope under ticket-scope', () => {
        expect(checkSubject('feat(DEV-1): add x', { format: 'ticket-scope' }).ok).toBe(true);
        expect(checkSubject('feat: add x', { format: 'ticket-scope' }).ok).toBe(true);
        expect(checkSubject('Add x', { format: 'ticket-scope' }).ok).toBe(false);
    });

    it('rejects a ticket anywhere inside a scope under ticket-conventional', () => {
        const rule = { format: 'ticket-conventional' } as const;
        expect(checkSubject('DEV-1 feat(api): add x', rule).ok).toBe(true);
        expect(checkSubject('feat(api): add x', rule).ok).toBe(true);
        expect(checkSubject('DEV-1 feat(DEV-1): add x', rule).ok).toBe(false);
        const compound = checkSubject('DEV-1 feat(api,DEV-1): add x', rule);
        expect(compound.ok).toBe(false);
        expect(compound.ok ? '' : compound.rule).toContain('scope');
        expect(checkSubject('DEV-1 feat(api/DEV-2): add x', rule).ok).toBe(false);
        expect(checkSubject('DEV-1 feat(iso-8601): add x', rule).ok).toBe(true);
    });

    it('rejects a standard name standing where the ticket goes', () => {
        expect(checkSubject('CVE-2026 fix: patch', { format: 'ticket-conventional' }).ok).toBe(false);
    });
});

describe('subject grammar per approved family', () => {
    it('has a validator for every measured family', () => {
        expect(checkSubject('[DEV-1] Fix thing', { family: 'ticket-prefix' }).ok).toBe(true);
        expect(checkSubject('Fix thing', { family: 'ticket-prefix' }).ok).toBe(false);
        expect(checkSubject(':bug: fix thing', { family: 'gitmoji' }).ok).toBe(true);
        expect(checkSubject('Fix the thing', { family: 'imperative-plain' }).ok).toBe(true);
        expect(checkSubject('Fix the thing.', { family: 'imperative-plain' }).ok).toBe(false);
        expect(checkSubject('fix(api): x', { family: 'conventional' }).ok).toBe(true);
        expect(checkSubject('DEV-1 fix(DEV-1): x', { family: 'ticket-conventional' }).ok).toBe(false);
    });

    it('classifies first hit wins, ticket-conventional before ticket-prefix', () => {
        expect(classifySubject('DEV-1 feat(api): x')).toBe('ticket-conventional');
        expect(classifySubject('DEV-1: x')).toBe('ticket-prefix');
        expect(classifySubject('feat: x')).toBe('conventional');
        expect(classifySubject('🐛 fix')).toBe('gitmoji');
        expect(classifySubject('whatever.')).toBe('other');
    });

    it('is the classifier the conventional-commits-writing skill names, without restating it', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'src/skills/conventional-commits-writing/SKILL.md'), 'utf8');
        expect(skill).not.toContain(TICKET_GRAMMAR);
        expect(skill).toContain('](../git-workflow/references/commit-subject.md)');
        for (const [family] of FAMILY_ERE) expect(skill, family).toContain(`\`${family}\``);
    });
});

describe('branch renderer', () => {
    it('fills the placeholders', () => {
        expect(renderBranch('{type}/{slug}', { type: 'feat', slug: 'x' })).toEqual({ ok: true, name: 'feat/x' });
        expect(renderBranch('{ticket}-{slug}', { ticket: 'DEV-1', slug: 'x' })).toEqual({ ok: true, name: 'DEV-1-x' });
    });

    it('drops an empty placeholder with the separator after it, or before it when last', () => {
        expect(renderBranch('{ticket}-{slug}', { slug: 'x' })).toEqual({ ok: true, name: 'x' });
        expect(renderBranch('{type}/{ticket}/{slug}', { type: 'fix', slug: 'x' })).toEqual({ ok: true, name: 'fix/x' });
        expect(renderBranch('{type}/{slug}/{ticket}', { type: 'fix', slug: 'x' })).toEqual({ ok: true, name: 'fix/x' });
    });

    it('prefixes the slug with a ticket that has no slot', () => {
        expect(renderBranch('{type}/{slug}', { type: 'feat', ticket: 'DEV-1234', slug: 'export' })).toEqual({
            ok: true,
            name: 'feat/DEV-1234-export',
        });
        expect(renderBranch('{type}/{slug}', { type: 'feat', ticket: 'DEV-1234', slug: 'DEV-1234-export' })).toEqual({
            ok: true,
            name: 'feat/DEV-1234-export',
        });
    });

    it('never rewrites a literal character and refuses input outside the alphabet', () => {
        expect(renderBranch('team--{type}__{slug}', { type: 'feat', slug: 'x' })).toEqual({ ok: true, name: 'team--feat__x' });
        expect(renderBranch('{type}/{slug}', { type: 'feat', slug: 'has space' }).ok).toBe(false);
        expect(renderBranch('{type}/{slug}', { type: 'feat', slug: '' }).ok).toBe(false);
        expect(renderBranch('{ticket}-{slug}', { ticket: 'dev-1', slug: 'x' }).ok).toBe(false);
    });
});

describe('the family EREs are POSIX extended, as the reference says', () => {
    // The reference is the fallback a command applies with `grep -E` when the
    // binary cannot run, so each expression must compile under the system grep.
    const grepE = (ere: string, input: string) => spawnSync('grep', ['-E', ere], { input, encoding: 'utf8' });
    const SUBJECTS = ['feat(api): add x', 'DEV-1 fix: y', '[DEV-1] z', ':sparkles: add x', '✨ add x', 'Add the thing', 'add the thing.', '~ tilde'];

    it.each(FAMILY_ERE.map(([family, ere]) => [family, ere] as const))('%s compiles under grep -E', (_family, ere) => {
        expect(grepE(ere, 'x\n').status).not.toBe(2);
    });

    it('grep -E classifies like the in-process matcher, first hit wins', () => {
        for (const subject of SUBJECTS) {
            const byGrep = FAMILY_ERE.find(([, ere]) => grepE(ere, `${subject}\n`).status === 0)?.[0] ?? 'other';
            expect(byGrep, subject).toBe(classifySubject(subject));
        }
    });
});
