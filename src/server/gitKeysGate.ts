/**
 * The settings route's handling of the three `git.*` keys.
 *
 * In global mode the route writes the user-global file, and `load_agent_settings`
 * discards `git.*` keys from that file, so a value saved there has no effect in
 * any repository. The form is not offered those keys, and a non-default value is
 * refused with the place a team declares them instead (ADR-282). A template
 * default is accepted: the form round-trips it, and `upgrade` inserts it too.
 *
 * In every mode a value goes through the same check `git:convention show` and
 * `settings:check` run, so a pattern that would reach a shell is refused here as
 * well.
 */
import { GIT_CONVENTION_KEYS, invalidReason, type GitConventionKey } from '../scripts/_lib/git_convention.js';

export const WITHHELD_GIT_KEYS: readonly string[] = GIT_CONVENTION_KEYS.map((k) => `git.${k}`);

export const WITHHELD_REASON =
    'This form writes your user-global settings file, which does not carry git.* keys. ' +
    'A team declares them in .git-convention.yml at the repository root; one checkout can set them in its project settings file.';

export interface FieldIssue {
    path: string;
    message: string;
}

function _gitSection(values: Record<string, unknown>): Record<string, unknown> | null {
    const git = values['git'];
    return git !== null && typeof git === 'object' && !Array.isArray(git) ? (git as Record<string, unknown>) : null;
}

function _normalise(key: GitConventionKey, value: string): string {
    return key === 'branch_pattern' ? value.trim() : value.trim().toLowerCase();
}

/** The values and the JSON schema with the `git` section removed. */
export function withholdGitKeys<S extends { properties?: Record<string, unknown>; required?: string[] }>(
    values: Record<string, unknown>,
    schema: S,
): { values: Record<string, unknown>; schema: S } {
    const { git: _git, ...rest } = values;
    const properties = { ...(schema.properties ?? {}) };
    delete properties['git'];
    const next = { ...schema, properties } as S;
    if (Array.isArray(schema.required)) next.required = schema.required.filter((k) => k !== 'git');
    return { values: rest, schema: next };
}

/**
 * Field issues for the `git.*` values of a write. `defaults` is the template's
 * `git` section; `userGlobal` is true when the write lands in the user-global file.
 */
export function gitKeyWriteIssues(
    values: Record<string, unknown>,
    defaults: Record<string, unknown>,
    userGlobal: boolean,
): FieldIssue[] {
    const git = _gitSection(values);
    if (git === null) return [];
    const fallback = _gitSection(defaults) ?? {};
    const issues: FieldIssue[] = [];
    for (const key of GIT_CONVENTION_KEYS) {
        const raw = git[key];
        if (typeof raw !== 'string') continue;
        const value = _normalise(key, raw);
        const why = invalidReason(key, value);
        if (why !== null) {
            issues.push({ path: `git.${key}`, message: why });
            continue;
        }
        const def = fallback[key];
        if (userGlobal && !(typeof def === 'string' && _normalise(key, def) === value)) {
            issues.push({ path: `git.${key}`, message: WITHHELD_REASON });
        }
    }
    return issues;
}

/**
 * The write candidate with the `git` section the file already holds. In global
 * mode the form never showed that section, and the schema's `.default({})`
 * fills template defaults into whatever arrives, so a value the user-global
 * file carries would otherwise read as a change the user made: a guarded-key
 * confirmation for a field they never saw, then a silent reset.
 *
 * `fileValues` is that file alone, never the merged view: the merge carries
 * the template defaults and any project layer, and copying a project value
 * here would write it into the user-global file without passing the gate.
 */
export function keepWithheldGit(candidate: Record<string, unknown>, fileValues: Record<string, unknown>): Record<string, unknown> {
    const { git: _sent, ...rest } = candidate;
    return 'git' in fileValues ? { ...rest, git: fileValues['git'] } : rest;
}
