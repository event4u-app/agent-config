/**
 * Tests for `userMdSchema` and `frontmatterSchema`.
 *
 * Council CRITICAL (2026-05-18): the schema must use the SAME parser the
 * agent uses on `.agent-user.md` so the wizard cannot write a file the
 * agent then refuses to load.
 *
 * A4 (2026-05-19): tightened to the v1 contract
 * (`docs/contracts/agent-user-schema.md`). Plain markdown without
 * frontmatter is rejected; every required field must be present.
 */
import { describe, expect, it } from 'vitest';
import {
    SEED_ROLE_IDS,
    USER_MD_MAX_CHARS,
    frontmatterSchema,
    userMdSchema,
} from '@shared/userMd/schema.js';

/** v1-valid frontmatter — every required field present per contract. */
function validBody(over: Partial<{ identity: string; role: string; style: string; voice: string; lastUpdated: string }> = {}): string {
    const identity = over.identity ?? '  name: "Matze"';
    const role = over.role ?? '  - founder';
    const style = over.style ?? '  formality: "informal"\n  pace: "pragmatic"';
    const voice = over.voice ?? 'Mach das einfach.';
    const lastUpdated = over.lastUpdated ?? '2026-05-19';
    return [
        '---',
        'version: 1',
        'identity:',
        identity,
        'language: "de"',
        'role:',
        role,
        'style:',
        style,
        'voice_sample: |',
        `  ${voice}`,
        `last_updated: "${lastUpdated}"`,
        '---',
        '',
        '# Notes',
        'body.',
        '',
    ].join('\n');
}

describe('userMdSchema — strict v1 contract', () => {
    it('accepts a fully-populated v1 frontmatter', () => {
        const result = userMdSchema.safeParse({ body: validBody() });
        expect(result.success).toBe(true);
    });

    it('rejects plain markdown without frontmatter', () => {
        const result = userMdSchema.safeParse({ body: '# Hello\n\nplain markdown body.' });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/version|identity\.name|role|voice_sample/);
        }
    });

    it('accepts a body exactly at the 8 000-char cap', () => {
        // Pad the Notes section so the body lands on the cap while still
        // carrying valid frontmatter.
        const base = validBody();
        const padded = base + 'x'.repeat(USER_MD_MAX_CHARS - base.length);
        const result = userMdSchema.safeParse({ body: padded });
        expect(result.success).toBe(true);
    });

    it('rejects a body over the 8 000-char cap', () => {
        const body = 'a'.repeat(USER_MD_MAX_CHARS + 1);
        const result = userMdSchema.safeParse({ body });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages.some((m) => m.includes('8000'))).toBe(true);
        }
    });

    it('rejects malformed YAML frontmatter with a parser-derived message', () => {
        const body = '---\nname: Matze\nrole: : :\n---\n\nbody.';
        const result = userMdSchema.safeParse({ body });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/frontmatter invalid/);
        }
    });
});

describe('frontmatterSchema — required fields', () => {
    it('rejects missing identity.name', () => {
        const result = userMdSchema.safeParse({ body: validBody({ identity: '  nickname: "Matze"' }) });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths.some((p) => p.includes('identity.name'))).toBe(true);
        }
    });

    it('rejects empty role list', () => {
        const result = userMdSchema.safeParse({ body: validBody({ role: '  []' }).replace(/role:\n  \[\]/, 'role: []') });
        expect(result.success).toBe(false);
    });

    it('rejects invalid style.formality enum', () => {
        const result = userMdSchema.safeParse({
            body: validBody({ style: '  formality: "casual"\n  pace: "pragmatic"' }),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/formality/);
        }
    });

    it('rejects invalid style.pace enum', () => {
        const result = userMdSchema.safeParse({
            body: validBody({ style: '  formality: "informal"\n  pace: "zen"' }),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/pace/);
        }
    });

    it('rejects malformed last_updated (non-ISO)', () => {
        const result = userMdSchema.safeParse({ body: validBody({ lastUpdated: '19.05.2026' }) });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/last_updated/);
        }
    });

    it('accepts seeded role enum values directly via frontmatterSchema', () => {
        for (const role of SEED_ROLE_IDS) {
            const result = frontmatterSchema.safeParse({
                version: 1,
                identity: { name: 'Matze' },
                language: 'de',
                role: [role],
                style: { formality: 'informal', pace: 'pragmatic' },
                voice_sample: 'sample',
                last_updated: '2026-05-19',
            });
            expect(result.success).toBe(true);
        }
    });

    it('accepts free-form role entries (forward-compat per contract)', () => {
        const result = frontmatterSchema.safeParse({
            version: 1,
            identity: { name: 'Matze' },
            language: 'de',
            role: ['inventor', 'archivist'],
            style: { formality: 'informal', pace: 'pragmatic' },
            voice_sample: 'sample',
            last_updated: '2026-05-19',
        });
        expect(result.success).toBe(true);
    });
});
