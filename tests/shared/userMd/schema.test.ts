/**
 * Tests for `userIdentitySchema` in `@shared/userMd/schema`.
 *
 * The schema is the single source of truth shared by the Fastify server
 * (request validation, wizard finish) and the Vite-bundled UI (form
 * validation). It validates a pure YAML object — there is no fenced
 * frontmatter wrapper, no string body, no markdown round-trip.
 *
 * Contract reference: `docs/contracts/agent-user-schema.md`.
 */
import { describe, expect, it } from 'vitest';
import {
    USER_IDENTITY_NOTES_MAX_CHARS,
    USER_IDENTITY_VOICE_SAMPLE_MAX_CHARS,
    userIdentitySchema,
} from '@shared/userMd/schema.js';

/** Fully-populated identity object — every required field present. */
function validIdentity(over: Partial<{
    version: 1;
    identity: { name: string };
    language: string;
    role: string[];
    style: { formality: 'informal' | 'formal'; pace: 'rapid' | 'pragmatic' | 'thorough' };
    voice_sample: string;
    last_updated: string;
    notes: string;
}> = {}): Record<string, unknown> {
    return {
        version: 1,
        identity: { name: 'Matze' },
        language: 'de',
        role: ['founder'],
        style: { formality: 'informal', pace: 'pragmatic' },
        voice_sample: 'Mach das einfach.',
        last_updated: '2026-05-19',
        ...over,
    };
}

describe('userIdentitySchema — strict v1 contract', () => {
    it('accepts a fully-populated identity object', () => {
        const result = userIdentitySchema.safeParse(validIdentity());
        expect(result.success).toBe(true);
    });

    it('accepts an identity with optional notes block', () => {
        const result = userIdentitySchema.safeParse(validIdentity({ notes: 'extra context.' }));
        expect(result.success).toBe(true);
    });

    it('accepts notes exactly at the hard cap', () => {
        const notes = 'x'.repeat(USER_IDENTITY_NOTES_MAX_CHARS);
        const result = userIdentitySchema.safeParse(validIdentity({ notes }));
        expect(result.success).toBe(true);
    });

    it('rejects notes over the hard cap', () => {
        const notes = 'x'.repeat(USER_IDENTITY_NOTES_MAX_CHARS + 1);
        const result = userIdentitySchema.safeParse(validIdentity({ notes }));
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/notes/);
        }
    });

    it('rejects voice_sample over the hard cap', () => {
        const voiceSample = 'x'.repeat(USER_IDENTITY_VOICE_SAMPLE_MAX_CHARS + 1);
        const result = userIdentitySchema.safeParse(validIdentity({ voice_sample: voiceSample }));
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/voice_sample/);
        }
    });
});

describe('userIdentitySchema — required-field enforcement', () => {
    it('rejects missing version', () => {
        const obj = validIdentity();
        delete (obj as Record<string, unknown>).version;
        const result = userIdentitySchema.safeParse(obj);
        expect(result.success).toBe(false);
    });

    it('rejects non-literal version (must be 1)', () => {
        const result = userIdentitySchema.safeParse(validIdentity({ version: 2 as unknown as 1 }));
        expect(result.success).toBe(false);
    });

    it('rejects missing identity.name', () => {
        const result = userIdentitySchema.safeParse(validIdentity({ identity: { name: '' } }));
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths.some((p) => p.includes('identity.name'))).toBe(true);
        }
    });

    it('rejects empty role list', () => {
        const result = userIdentitySchema.safeParse(validIdentity({ role: [] }));
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/role/);
        }
    });

    it('accepts free-form role entries (forward-compat per contract)', () => {
        const result = userIdentitySchema.safeParse(
            validIdentity({ role: ['inventor', 'archivist'] }),
        );
        expect(result.success).toBe(true);
    });

    it('rejects invalid style.formality enum', () => {
        const result = userIdentitySchema.safeParse(
            validIdentity({
                style: { formality: 'casual' as 'informal', pace: 'pragmatic' },
            }),
        );
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths.some((p) => p.includes('style.formality'))).toBe(true);
        }
    });

    it('rejects invalid style.pace enum', () => {
        const result = userIdentitySchema.safeParse(
            validIdentity({
                style: { formality: 'informal', pace: 'zen' as 'pragmatic' },
            }),
        );
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths.some((p) => p.includes('style.pace'))).toBe(true);
        }
    });

    it('rejects malformed last_updated (non-ISO)', () => {
        const result = userIdentitySchema.safeParse(validIdentity({ last_updated: '19.05.2026' }));
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/last_updated/);
        }
    });
});
