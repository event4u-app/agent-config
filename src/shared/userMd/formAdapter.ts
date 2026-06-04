/**
 * Form adapter for `.agent-user.yml`.
 *
 * Bridges the parsed-YAML object (signal in WizardPage / UserMdPanel)
 * and the structured UserMdForm value. Lives under `src/shared/` so
 * server and UI round-trip identically; ESLint forbids Node imports in
 * this tree.
 *
 * Defaults mirror `src/templates/agent-user.yml` so a fresh form is fully
 * renderable (every field has *something*), while keeping `name`,
 * `role[0]`, and `voice_sample` empty — the wizard surfaces those as
 * 422 issues when the user tries to finish with them blank.
 *
 * Round-trip discipline: the form value **is** the identity object
 * (post-migration to pure YAML). `mergeIdentity` is the soft merge used
 * when reading a partial or legacy file; validation runs server-side on
 * save via `userIdentitySchema`.
 */

import type { UserIdentity } from './schema.js';

/**
 * Defaults for a fresh form. Matches `src/templates/agent-user.yml`:
 * `last_updated` is 1970-01-01 so any user-driven edit visibly bumps it.
 */
export function defaultIdentity(): UserIdentity {
    return {
        version: 1,
        identity: { name: '' },
        language: 'en',
        role: [],
        style: { pace: 'pragmatic' },
        voice_sample: '',
        last_updated: '1970-01-01',
    };
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

function pickPace(value: unknown): UserIdentity['style']['pace'] {
    return value === 'thorough' || value === 'rapid' ? value : 'pragmatic';
}

function pickRoles(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    // Drop empty-string entries — an empty role entry is meaningless and
    // would fail the schema's per-entry min(1). Returning `[]` is allowed
    // (role is optional; the wizard must not block setup on a role pick).
    return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

function pickNotes(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    return value === '' ? undefined : value;
}

/**
 * Merge a parsed YAML object over defaults field-by-field. Malformed or
 * missing entries fall through to the default so the form always has a
 * complete shape to render — validation runs server-side on save.
 */
export function mergeIdentity(parsed: Record<string, unknown>): UserIdentity {
    const def = defaultIdentity();
    const identityRaw = isObject(parsed.identity) ? parsed.identity : {};
    const styleRaw = isObject(parsed.style) ? parsed.style : {};
    const notes = pickNotes(parsed.notes);
    const out: UserIdentity = {
        version: 1,
        identity: { name: pickString(identityRaw.name, def.identity.name) },
        language: pickString(parsed.language, def.language),
        role: pickRoles(parsed.role),
        style: {
            pace: pickPace(styleRaw.pace),
        },
        voice_sample: pickString(parsed.voice_sample, def.voice_sample),
        last_updated: pickString(parsed.last_updated, def.last_updated),
    };
    if (notes !== undefined) out.notes = notes;
    return out;
}
