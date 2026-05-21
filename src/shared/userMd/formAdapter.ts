/**
 * Form adapter for `.agent-user.md`.
 *
 * Bridges the raw markdown body (signal in WizardPage / UserMdPanel) and
 * the structured UserMdForm value. Lives under `src/shared/` so both the
 * server and the UI can round-trip identically; ESLint enforces no-Node
 * imports (`./schema.ts` and `./utils.ts` already comply).
 *
 * Default frontmatter mirrors `templates/agent-user.md` so a freshly
 * loaded body without frontmatter still produces a renderable form (every
 * field has *something*), while keeping `name`, `role[0]`, and
 * `voice_sample` empty — the wizard surfaces those as 422 issues when
 * the user tries to finish with them blank.
 *
 * Round-trip discipline: `formToBody` always emits block-style YAML via
 * `composeUserMd`; `bodyToForm` runs `parseUserMd` and merges field-by-
 * field over `defaultFrontmatter()` so a malformed or partial frontmatter
 * never crashes the form.
 */

import { parseUserMd, composeUserMd } from './utils.js';
import type { UserMdFrontmatter } from './schema.js';

export interface UserMdFormValue {
    frontmatter: UserMdFrontmatter;
    content: string;
}

/**
 * Defaults for a fresh form. Matches `templates/agent-user.md`:
 * `last_updated` is 1970-01-01 so any user-driven edit visibly bumps it.
 */
export function defaultFrontmatter(): UserMdFrontmatter {
    return {
        version: 1,
        identity: { name: '' },
        language: 'en',
        role: [''],
        style: { formality: 'informal', pace: 'pragmatic' },
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

function pickFormality(value: unknown): UserMdFrontmatter['style']['formality'] {
    return value === 'formal' ? 'formal' : 'informal';
}

function pickPace(value: unknown): UserMdFrontmatter['style']['pace'] {
    return value === 'thorough' || value === 'rapid' ? value : 'pragmatic';
}

function pickRoles(value: unknown): string[] {
    if (!Array.isArray(value)) return [''];
    const filtered = value.filter((v): v is string => typeof v === 'string');
    return filtered.length === 0 ? [''] : filtered;
}

/**
 * Merge parsed frontmatter over defaults field-by-field. Malformed or
 * missing entries fall through to the default so the form always has a
 * complete shape to render — validation runs server-side on save.
 */
export function mergeFrontmatter(parsed: Record<string, unknown>): UserMdFrontmatter {
    const def = defaultFrontmatter();
    const identityRaw = isObject(parsed.identity) ? parsed.identity : {};
    const styleRaw = isObject(parsed.style) ? parsed.style : {};
    const identity: UserMdFrontmatter['identity'] = {
        name: pickString(identityRaw.name, def.identity.name),
    };
    const nickname = identityRaw.nickname;
    if (typeof nickname === 'string' && nickname !== '') identity.nickname = nickname;
    return {
        version: 1,
        identity,
        language: pickString(parsed.language, def.language),
        role: pickRoles(parsed.role),
        style: {
            formality: pickFormality(styleRaw.formality),
            pace: pickPace(styleRaw.pace),
        },
        voice_sample: pickString(parsed.voice_sample, def.voice_sample),
        last_updated: pickString(parsed.last_updated, def.last_updated),
    };
}

/**
 * Parse a raw `.agent-user.md` body into the structured form value. Empty
 * or frontmatter-less bodies produce defaults; the markdown content is
 * preserved verbatim so a manually edited file round-trips cleanly when
 * the user clicks Save without touching the form.
 */
export function bodyToForm(body: string): UserMdFormValue {
    const parsed = parseUserMd(body);
    return {
        frontmatter: mergeFrontmatter(parsed.data),
        content: parsed.content,
    };
}

/**
 * Compose a structured form value back into a markdown body. The result
 * always carries block-style frontmatter per the contract.
 */
export function formToBody(value: UserMdFormValue): string {
    return composeUserMd({
        data: value.frontmatter as unknown as Record<string, unknown>,
        content: value.content,
    });
}
