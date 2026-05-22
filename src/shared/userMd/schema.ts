/**
 * Schema for `.agent-user.yml` (the user-identity file).
 *
 * Pure YAML — no fenced-frontmatter wrapper. The wizard, the server
 * routes, and the on-disk file all carry the same shape: a single
 * object that round-trips through `js-yaml`. See
 * `docs/contracts/agent-user-schema.md` for the canonical reference.
 *
 * Lives under `src/shared/` so the Fastify server (request validation,
 * wizard finish) and the Vite-bundled UI (form validation) consume
 * the same Zod schema. ESLint forbids Node-only imports in this tree.
 */

import { z } from 'zod';

/** Hard cap on the optional `notes` block. Keeps the file loadable into every reply. */
export const USER_IDENTITY_NOTES_MAX_CHARS = 8_000;

/** Hard cap on the `voice_sample` block — one to three sentences in practice. */
export const USER_IDENTITY_VOICE_SAMPLE_MAX_CHARS = 2_000;

/** ISO-8601 date (`YYYY-MM-DD`) — `last_updated` is a date, not a timestamp. */
const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'last_updated must be ISO-8601 date (YYYY-MM-DD)');

export const userIdentitySchema = z.object({
    version: z.literal(1),
    identity: z.object({
        name: z.string().trim().min(1, 'identity.name is required'),
    }),
    language: z.string().trim().min(2, 'language must be a non-empty code'),
    role: z
        .array(z.string().trim().min(1, 'role entries must be non-empty'))
        .min(1, 'role must list at least one entry'),
    style: z.object({
        formality: z.enum(['informal', 'formal']),
        pace: z.enum(['rapid', 'pragmatic', 'thorough']),
    }),
    voice_sample: z
        .string()
        .trim()
        .min(1, 'voice_sample is required')
        .max(USER_IDENTITY_VOICE_SAMPLE_MAX_CHARS, 'voice_sample exceeds hard cap'),
    last_updated: isoDate,
    notes: z
        .string()
        .max(USER_IDENTITY_NOTES_MAX_CHARS, 'notes exceeds hard cap')
        .optional(),
});

export type UserIdentity = z.infer<typeof userIdentitySchema>;
