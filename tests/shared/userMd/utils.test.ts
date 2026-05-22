/**
 * Tests for `parseUserIdentity`, `composeUserIdentity`, and
 * `parseLegacyUserMd` in `@shared/userMd/utils`.
 *
 * Contract gates (`docs/contracts/agent-user-schema.md`):
 *   - `parseUserIdentity` returns a plain object; empty body → `{}`.
 *   - `composeUserIdentity` emits YAML in BLOCK style for list-valued
 *     fields so git diffs stay line-oriented.
 *   - compose ↔ parse is a stable round-trip.
 *   - `parseLegacyUserMd` accepts the old fenced-frontmatter
 *     `.agent-user.md` body, mapping any trailing markdown into `notes`.
 */
import { describe, expect, it } from 'vitest';
import {
    composeUserIdentity,
    parseLegacyUserMd,
    parseUserIdentity,
} from '@shared/userMd/utils.js';

describe('parseUserIdentity', () => {
    it('returns an empty object for an empty body', () => {
        expect(parseUserIdentity('')).toEqual({});
    });

    it('returns an empty object for whitespace-only input', () => {
        expect(parseUserIdentity('   \n\n')).toEqual({});
    });

    it('parses a valid YAML identity object', () => {
        const body = 'identity:\n  name: Matze\nrole:\n  - founder\n  - engineer\n';
        const result = parseUserIdentity(body);
        expect(result).toEqual({
            identity: { name: 'Matze' },
            role: ['founder', 'engineer'],
        });
    });

    it('throws on non-object YAML (top-level array)', () => {
        expect(() => parseUserIdentity('- a\n- b\n')).toThrow(/object/);
    });

    it('throws on malformed YAML', () => {
        expect(() => parseUserIdentity('name: : :\n')).toThrow();
    });
});

describe('composeUserIdentity', () => {
    it('emits list-valued fields in block style (one entry per line)', () => {
        const composed = composeUserIdentity({
            identity: { name: 'Matze' },
            role: ['founder', 'engineer'],
        });
        expect(composed).toContain('role:\n  - founder\n  - engineer');
        expect(composed).not.toContain('role: [');
    });

    it('terminates with a single trailing newline', () => {
        const composed = composeUserIdentity({ identity: { name: 'Matze' } });
        expect(composed.endsWith('\n')).toBe(true);
    });

    it('round-trips parse → compose → parse without drift', () => {
        const original = {
            version: 1,
            identity: { name: 'Matze' },
            language: 'de',
            role: ['founder', 'engineer'],
            style: { formality: 'informal', pace: 'pragmatic' },
            voice_sample: 'Mach das einfach.',
            last_updated: '2026-05-19',
        };
        const reparsed = parseUserIdentity(composeUserIdentity(original));
        expect(reparsed).toEqual(original);
    });
});

describe('parseLegacyUserMd', () => {
    it('returns an empty object for an empty body', () => {
        expect(parseLegacyUserMd('')).toEqual({});
    });

    it('captures a fenced frontmatter block as the identity object', () => {
        const body = [
            '---',
            'version: 1',
            'identity:',
            '  name: Matze',
            'role:',
            '  - founder',
            '---',
            '',
        ].join('\n');
        const result = parseLegacyUserMd(body);
        expect(result).toEqual({
            version: 1,
            identity: { name: 'Matze' },
            role: ['founder'],
        });
    });

    it('captures trailing markdown body as `notes` when frontmatter omits it', () => {
        const body = [
            '---',
            'identity:',
            '  name: Matze',
            '---',
            '',
            '# Notes',
            '',
            'extra context.',
            '',
        ].join('\n');
        const result = parseLegacyUserMd(body);
        expect(result.identity).toEqual({ name: 'Matze' });
        expect(typeof result.notes).toBe('string');
        expect(result.notes as string).toContain('extra context.');
    });

    it('does not overwrite an existing `notes` field from the frontmatter', () => {
        const body = [
            '---',
            'identity:',
            '  name: Matze',
            'notes: "from frontmatter"',
            '---',
            '',
            'trailing prose.',
            '',
        ].join('\n');
        const result = parseLegacyUserMd(body);
        expect(result.notes).toBe('from frontmatter');
    });

    it('treats a body without a frontmatter fence as notes-only', () => {
        const result = parseLegacyUserMd('# Hello\n\nplain markdown body.');
        expect(result).toEqual({ notes: '# Hello\n\nplain markdown body.' });
    });
});
