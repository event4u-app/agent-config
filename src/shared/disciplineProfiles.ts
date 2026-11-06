/**
 * The non-kernel rules each narrowing `discipline_profile` installs.
 *
 * One list, two readers: `compile_router.ts` compiles it into
 * `dist/router.json` `profiles`, and the consumer install
 * (`src/install/rule_scope.ts`) narrows the rules tree to it. The kernel
 * (`type: always`) ships under every profile and is never listed here.
 *
 * `essential` is the set the post-repair rerun measured as an injected rule
 * set (`docs/benchmark.md` § Post-repair rerun). Adding a rule here changes
 * what an `essential` install loads, so it needs its own measurement.
 */
export const DISCIPLINE_PROFILE_RULES = {
    off: [] as readonly string[],
    essential: ['downstream-changes'] as readonly string[],
} as const;

export type NarrowingDisciplineProfile = keyof typeof DISCIPLINE_PROFILE_RULES;
