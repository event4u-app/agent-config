/**
 * Optional subagent-v1 fields → Claude Code native agent frontmatter lines.
 *
 * The schema names the host's loading knobs vendor-neutrally; the host
 * spelling lives here and nowhere else, the way `model_tier` → `model` lives in
 * `model_tier.ts`. A field is emitted only when the source declares it, so a
 * definition that sets none of them projects byte-identically to before.
 *
 * Two fields are deliberately NOT emitted:
 *  - `reuse` is read by `_lib/worker_reuse.ts` (condition (g)) off the source
 *    definition. The host has no per-definition reuse key; writing one would be
 *    a line the host ignores and a reader might mistake for an enforced switch.
 *  - `cache_ttl` has no per-definition host key either — the host's TTL knob is
 *    a settings value.
 *
 * `omit_project_instructions` → `omitClaudeMd` drops the instruction hierarchy
 * for that definition, so a definition setting it relies on its dispatch to
 * carry the floor and the user's constraints.
 */

export function nativeFieldLines(fm: Record<string, unknown>): string {
    const out: string[] = [];
    if (typeof fm['effort'] === 'string') out.push(`effort: ${fm['effort']}`);
    if (typeof fm['max_turns'] === 'number') out.push(`maxTurns: ${fm['max_turns']}`);
    if (typeof fm['background'] === 'boolean') out.push(`background: ${fm['background']}`);
    const skills = fm['preload_skills'];
    if (Array.isArray(skills) && skills.length > 0) out.push(`skills: [${skills.map(String).join(', ')}]`);
    if (fm['omit_project_instructions'] === true) out.push('omitClaudeMd: true');
    return out.map((l) => `${l}\n`).join('');
}
