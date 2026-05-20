/**
 * Zod schema for `.agent-user.md` body.
 *
 * Council CRITICAL (2026-05-18): a bare `z.string().max(8000)` is a length
 * gate, not validation. It accepts malformed frontmatter the agent's identity
 * parser then refuses to load. The wizard would happily write a file the
 * agent cannot consume.
 *
 * Resolution: validate with `gray-matter` server-side — same parser the
 * agent uses on `.agent-user.md` per ADR-010. The schema runs gray-matter
 * inside `.refine()`; a parse error surfaces as a Zod issue with the
 * underlying error message, returned to the client as HTTP 422.
 *
 * Hard length cap kept at 8 000 chars (form input cap, not security).
 */

import { z } from 'zod';
import matter from 'gray-matter';

const MAX_BODY_CHARS = 8_000;

function tryParse(body: string): { ok: true } | { ok: false; message: string } {
    try {
        matter(body);
        return { ok: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'gray-matter parse failed';
        return { ok: false, message };
    }
}

export const userMdSchema = z.object({
    body: z
        .string()
        .max(MAX_BODY_CHARS, `body must be ≤ ${MAX_BODY_CHARS} chars`)
        .superRefine((value, ctx) => {
            const result = tryParse(value);
            if (!result.ok) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `.agent-user.md frontmatter invalid: ${result.message}`,
                    path: ['body'],
                });
            }
        })
        .describe('Markdown body with optional YAML frontmatter; gray-matter must accept it.'),
});

export type UserMd = z.infer<typeof userMdSchema>;

export const USER_MD_MAX_CHARS = MAX_BODY_CHARS;
