/**
 * Render `config/agent-settings.template.yml` for the wizard's "Skip" path.
 *
 * Source of truth for placeholder semantics is `scripts/install.py`
 * (`_render_template`, `_parse_profile_ini`). The wizard's Skip handler
 * cannot shell out to Python — npm/npx flows ship Node only — so this
 * helper mirrors the install-time substitution in TypeScript.
 *
 * Contract:
 *   - Reads `config/profiles/<profile>.ini` from `packageRoot`.
 *   - Each ini key `foo_bar` substitutes the `__FOO_BAR__` placeholder.
 *   - Injects runtime-only values (`user_type`) from the caller.
 *   - Fails loudly if any placeholder remains unfilled — catches typos
 *     and missing profile entries the same way the Python path does.
 *
 * No YAML parsing: we treat the template as text and replace tokens.
 * The schema-↔-template parity test guarantees every placeholder we
 * touch corresponds to a real schema leaf.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type CostProfile = 'minimal' | 'balanced' | 'full';

export interface SubstituteOptions {
    /** Package root — `config/profiles/<profile>.ini` resolves under this. */
    packageRoot: string;
    /** Profile to materialize. */
    profile: CostProfile;
    /** User-type slug (e.g. `solo-dev`); injected as `__USER_TYPE__`. */
    userType: string;
    /** Optional override values keyed by ini key (tests). */
    overrides?: Record<string, string>;
}

const PLACEHOLDER_RE = /__[A-Z][A-Z0-9_]*__/g;

/**
 * Parse a profile `.ini` file the same way `scripts/install.py` does:
 * `key=value` per line, `;` line comments, blank lines ignored. Whitespace
 * around `=` is stripped. Duplicate keys: last wins.
 */
export function parseProfileIni(body: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const raw of body.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === '' || line.startsWith(';') || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (key === '') continue;
        out[key] = value;
    }
    return out;
}

/**
 * Substitute every `__KEY__` placeholder in `template` using `values`.
 * `values` is keyed by lowercase ini key; the placeholder is the
 * uppercased key wrapped in `__`. Throws if any placeholder remains.
 */
export function applyPlaceholders(template: string, values: Record<string, string>): string {
    let body = template;
    for (const [key, value] of Object.entries(values)) {
        const placeholder = `__${key.toUpperCase()}__`;
        if (body.includes(placeholder)) {
            body = body.split(placeholder).join(value);
        }
    }
    const leftover = Array.from(new Set(body.match(PLACEHOLDER_RE) ?? [])).sort();
    if (leftover.length > 0) {
        throw new Error(
            `Template has unfilled placeholders after profile render: ${leftover.join(', ')}`,
        );
    }
    return body;
}

/**
 * Read `config/profiles/<profile>.ini`, merge runtime values, and return
 * the rendered template body. Caller writes the body via `writeAtomic`.
 */
export async function renderSettingsTemplate(opts: SubstituteOptions): Promise<string> {
    const templatePath = join(opts.packageRoot, 'config', 'agent-settings.template.yml');
    const profilePath = join(opts.packageRoot, 'config', 'profiles', `${opts.profile}.ini`);

    const [template, iniBody] = await Promise.all([
        readFile(templatePath, 'utf8'),
        readFile(profilePath, 'utf8'),
    ]);

    const profileValues = parseProfileIni(iniBody);
    if (profileValues.rule_loading_tier !== opts.profile) {
        throw new Error(
            `Profile preset ${opts.profile}.ini has rule_loading_tier=` +
                `${JSON.stringify(profileValues.rule_loading_tier)} but caller asked for ${opts.profile}`,
        );
    }

    const merged: Record<string, string> = {
        ...profileValues,
        user_type: opts.userType,
        ...(opts.overrides ?? {}),
    };

    return applyPlaceholders(template, merged);
}
