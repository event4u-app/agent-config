/**
 * Zod schema for `.agent-user.md` body.
 *
 * Council CRITICAL (2026-05-18): a bare `z.string().max(8000)` is a length
 * gate, not validation. It accepts malformed frontmatter the agent's identity
 * parser then refuses to load. The wizard would happily write a file the
 * agent cannot consume.
 *
 * Resolution: validate via the shared `parseUserMd` helper — same
 * fenced-frontmatter + `js-yaml` parser the agent uses at load time
 * per ADR-010. The schema runs the parser inside `.superRefine()` and
 * then validates the parsed frontmatter against the v1 contract
 * (`docs/contracts/agent-user-schema.md`). Errors surface as Zod
 * issues with the underlying message; the route returns HTTP 422.
 *
 * Strictness (A4 · 2026-05-19): the schema enforces the locked v1
 * frontmatter — `version`, `identity.name`, `language`, `role[≥1]`,
 * `style.formality`, `style.pace`, `voice_sample`, `last_updated`. Plain
 * markdown without frontmatter is rejected; the wizard cannot finish on a
 * partial body.
 *
 * Hard length cap kept at 8 000 chars (form input cap, not security).
 */

import { z } from 'zod';
import { parseUserMd } from './utils.js';

const MAX_BODY_CHARS = 8_000;

/**
 * Seeded role enum mirrors `SEED_PROFILE_IDS` in
 * `scripts/config/profiles.py`. Per contract, free-form additions are
 * accepted (forward-compat); closed validation lives in the wizard, not
 * the loader. The schema therefore validates `role` as `string().min(1)`
 * — the constant is exported for the wizard UI to use as the seeded
 * combobox options.
 */
export const SEED_ROLE_IDS = [
    'founder',
    'developer',
    'content_creator',
    'agency',
    'finance',
    'ops',
] as const;

/** `YYYY-MM-DD` — agent bumps `last_updated` on every accept. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** BCP-47-ish: lowercase primary tag, optional region. "de", "en", "en-US". */
const LANGUAGE_TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

/**
 * Strict v1 frontmatter shape. Exported for the wizard UI form and for
 * direct unit tests; the route-level schema (`userMdSchema` below) parses
 * a body string and feeds the result through this.
 */
export const frontmatterSchema = z.object({
    version: z.literal(1, { errorMap: () => ({ message: 'version must be 1' }) }),
    identity: z.object({
        name: z.string().min(1, 'identity.name is required'),
        nickname: z.string().min(1).optional(),
    }),
    language: z
        .string()
        .regex(LANGUAGE_TAG, 'language must be a BCP-47 tag (e.g. "de", "en", "en-US")'),
    role: z
        .array(z.string().min(1, 'role entries must be non-empty'))
        .min(1, 'role must list at least one entry'),
    style: z.object({
        formality: z.enum(['informal', 'formal'], {
            errorMap: () => ({ message: 'style.formality must be "informal" or "formal"' }),
        }),
        pace: z.enum(['pragmatic', 'thorough', 'rapid'], {
            errorMap: () => ({ message: 'style.pace must be "pragmatic", "thorough", or "rapid"' }),
        }),
    }),
    voice_sample: z.string().min(1, 'voice_sample is required'),
    last_updated: z.string().regex(ISO_DATE, 'last_updated must be YYYY-MM-DD'),
});

export type UserMdFrontmatter = z.infer<typeof frontmatterSchema>;

function tryParse(
    body: string,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
    try {
        const result = parseUserMd(body);
        // `parseUserMd` returns an empty object when no frontmatter
        // fence is present; the contract requires v1 frontmatter, so
        // empty objects fall through to `frontmatterSchema` and fail
        // there with the missing-required-field issues the wizard
        // wants to surface.
        return { ok: true, data: result.data };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'frontmatter parse failed';
        return { ok: false, message };
    }
}

export const userMdSchema = z.object({
    body: z
        .string()
        .max(MAX_BODY_CHARS, `body must be ≤ ${MAX_BODY_CHARS} chars`)
        .superRefine((value, ctx) => {
            const parsed = tryParse(value);
            if (!parsed.ok) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `.agent-user.md frontmatter invalid: ${parsed.message}`,
                    path: ['body'],
                });
                return;
            }
            const shape = frontmatterSchema.safeParse(parsed.data);
            if (shape.success) return;
            for (const issue of shape.error.issues) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: issue.message,
                    path: ['body', ...issue.path],
                });
            }
        })
        .describe('Markdown body with v1 frontmatter per agent-user-schema contract.'),
});

export type UserMd = z.infer<typeof userMdSchema>;

export const USER_MD_MAX_CHARS = MAX_BODY_CHARS;
