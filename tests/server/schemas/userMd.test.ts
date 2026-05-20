/**
 * Tests for `userMdSchema`.
 *
 * Council CRITICAL (2026-05-18): the schema must use the SAME parser the
 * agent uses on `.agent-user.md` so the wizard cannot write a file the
 * agent then refuses to load. Cases:
 *
 *   - plain markdown without frontmatter           → ok
 *   - markdown with valid YAML frontmatter         → ok
 *   - body exactly at the 8 000-char cap           → ok
 *   - body over the 8 000-char cap                 → rejected
 *   - markdown with malformed YAML frontmatter     → rejected with a
 *     parser-derived message (not the length-cap message)
 */
import { describe, expect, it } from 'vitest';
import { USER_MD_MAX_CHARS, userMdSchema } from '../../../src/server/schemas/userMd.js';

describe('userMdSchema', () => {
    it('accepts plain markdown without frontmatter', () => {
        const result = userMdSchema.safeParse({ body: '# Hello\n\nplain markdown body.' });
        expect(result.success).toBe(true);
    });

    it('accepts markdown with valid YAML frontmatter', () => {
        const body = '---\nname: Matze\nrole: engineer\n---\n\n# About me\n\nbody text.';
        const result = userMdSchema.safeParse({ body });
        expect(result.success).toBe(true);
    });

    it('accepts a body exactly at the 8 000-char cap', () => {
        const body = 'a'.repeat(USER_MD_MAX_CHARS);
        const result = userMdSchema.safeParse({ body });
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
        // Unclosed map → gray-matter raises a YAML parse error.
        const body = '---\nname: Matze\nrole: : :\n---\n\nbody.';
        const result = userMdSchema.safeParse({ body });
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((i) => i.message).join(' | ');
            expect(messages).toMatch(/frontmatter invalid/);
        }
    });
});
