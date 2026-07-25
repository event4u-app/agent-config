/**
 * The locked kernel set — one definition, imported everywhere.
 *
 * These nine rules are the Iron-Law floor (`docs/contracts/kernel-membership.md`
 * § 4). Before this module the list existed three times — in
 * `check_kernel_rule_bundle.ts`, `iron_law_sha.ts`, and `measure_rule_budget.ts`
 * — two of them carrying a "kept in sync with …" comment, which is the standard
 * way a list drifts: the comment records an intention, nothing enforces it.
 *
 * Membership is a governance decision, not a convenience. Adding or removing an
 * entry changes what may never be overridden, what the prefix-stability snapshot
 * covers, and what the one-kernel-rule-per-PR gate applies to. Change it here,
 * once, and let every consumer follow.
 */

/** Kernel rule ids, stem form (no extension), in stable sorted order. */
export const KERNEL_RULE_IDS: readonly string[] = [
    'agent-authority',
    'ask-when-uncertain',
    'commit-policy',
    'direct-answers',
    'language-and-tone',
    'no-cheap-questions',
    'non-destructive-by-default',
    'scope-control',
    'verify-before-complete',
] as const;

/** Same set, `.md` filename form — what path-matching consumers compare against. */
export const KERNEL_RULE_FILENAMES: ReadonlySet<string> = new Set(
    KERNEL_RULE_IDS.map((id) => `${id}.md`),
);

/** Set form of the stems, for membership tests that key on the id. */
export const KERNEL_RULE_ID_SET: ReadonlySet<string> = new Set(KERNEL_RULE_IDS);

/**
 * True when `name` names a kernel rule, in either stem or `.md` form.
 *
 * Accepts a bare id, a filename, or a path ending in either — callers hold the
 * name in all three shapes and should not each re-derive the normalisation.
 */
export function is_kernel_rule(name: string): boolean {
    const base = name.replace(/\\/g, '/').split('/').pop() ?? name;
    return KERNEL_RULE_ID_SET.has(base.replace(/\.md$/, ''));
}
