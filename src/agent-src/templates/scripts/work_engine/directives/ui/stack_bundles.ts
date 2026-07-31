/**
 * Verb → skill-bundle map for the stack-dispatched UI steps.
 *
 * The UI steps halt with `@agent-directive: ui-apply-<stack>` (and the
 * `ui-design-review-` / `ui-polish-` equivalents). Those names are **directive
 * verbs, not skill paths** — the same shape as `run-tests`, `create-plan`, and
 * `apply-plan`, which likewise resolve to no skill file. Only 2 of the engine's
 * 11 literal verbs name a real skill, so a verb is something the agent
 * interprets, and the mapping from verb to the skills that implement it is a
 * separate fact that has to be written down somewhere.
 *
 * Before this module that mapping lived only in a prose table in
 * `docs/contracts/ui-track-flow.md`. Nothing verified it, and two of its four
 * rows were wrong: `vue` pointed at the directive verb itself (naming no skill
 * at all) and `plain` — which is also the fallback for every unrecognised
 * project — pointed at `blade-ui`, a skill whose frontmatter is
 * `packs: [laravel]` and which a non-Laravel consumer therefore does not have
 * installed.
 *
 * Keeping the map here makes it checkable: `lint_ui_stack_bundles` asserts every
 * member resolves to a real skill, and that no lane reachable without the
 * `laravel` pack names a `laravel`-only skill. A CI check in this repo cannot
 * see a consumer's installed pack combination, so the second assertion is the
 * part that actually prevents the `plain → blade-ui` class of defect.
 */

/** Skills that implement a lane, in the order the agent should load them. */
export interface StackBundle {
    /** Skills that build / fix UI for this lane (`apply`, `polish`). */
    readonly build: ReadonlyArray<string>;
    /** Skills that review UI for this lane (`review`). */
    readonly review: ReadonlyArray<string>;
    /**
     * True when every skill above ships outside the framework packs, i.e. the
     * lane is safe as a fallback for a consumer whose packs we cannot predict.
     * Only lanes marked `pack_agnostic` may be used as `DEFAULT_*`.
     */
    readonly pack_agnostic: boolean;
}

/**
 * The pack-agnostic pair. Both live in `engineering-base`, so they are present
 * in every install; both self-describe as stack-neutral
 * (`ui-component-architect`: "the same lens applies to Blade, Livewire, React,
 * or Vue trees"; `tailwind-engineer`: "the **how** for any Tailwind-stack
 * screen"). This is the honest floor for a lane with no framework-specific
 * executor — not a claim that the lane is fully served.
 */
const GENERIC_BUILD: ReadonlyArray<string> = ['ui-component-architect', 'tailwind-engineer'];

/** `design-review` is stack-neutral and ships in `engineering-base`. */
const GENERIC_REVIEW: ReadonlyArray<string> = ['design-review'];

/**
 * Lane → bundle. Keys mirror `KNOWN_STACKS`; the dispatch tables in
 * `apply` / `review` / `polish` keep their own verb strings (a tested public
 * contract) and consume this map only to name the skills in the halt body.
 */
export const STACK_BUNDLES: Readonly<Record<string, StackBundle>> = {
    'blade-livewire-flux': {
        build: ['flux', 'livewire', 'blade-ui'],
        review: GENERIC_REVIEW,
        pack_agnostic: false,
    },
    // Livewire without Flux — the common Laravel frontend. Previously fell
    // into `plain` because detection required Livewire AND Flux.
    'blade-livewire': {
        build: ['livewire', 'blade-ui'],
        review: GENERIC_REVIEW,
        pack_agnostic: false,
    },
    // Filament is Livewire + Blade + Tailwind under the hood; the same
    // executors apply. A Filament-specific skill is gated on evidence that
    // these produce unusable output for it, not assumed.
    filament: {
        build: ['livewire', 'blade-ui'],
        review: GENERIC_REVIEW,
        pack_agnostic: false,
    },
    'react-shadcn': {
        build: ['react-shadcn-ui'],
        review: GENERIC_REVIEW,
        pack_agnostic: false,
    },
    // React without Radix/shadcn. `react-shadcn-ui` still carries the React
    // component idiom; the shadcn-specific parts simply do not apply.
    react: {
        build: ['react-shadcn-ui'],
        review: GENERIC_REVIEW,
        pack_agnostic: false,
    },
    // No Vue executor exists. The previous prose row pointed at the directive
    // verb itself, which named nothing; the generic pair is a smaller lie and a
    // stated one — the halt body says the lane has no Vue-specific skill.
    vue: {
        build: GENERIC_BUILD,
        review: GENERIC_REVIEW,
        pack_agnostic: true,
    },
    plain: {
        build: GENERIC_BUILD,
        review: GENERIC_REVIEW,
        pack_agnostic: true,
    },
};

/**
 * Lanes served by the stack-neutral pair rather than a framework executor.
 *
 * `plain` and `vue` share the bundle but not the meaning, and the halt body has
 * to say which it is. For `plain` the pair IS the right answer — there is no
 * framework to be idiomatic about. For `vue` it is a gap: a Vue project has a
 * definite idiom and the package has no executor for it, so the result must not
 * read as Vue support.
 */
export const GENERIC_LANES: ReadonlySet<string> = new Set(['vue', 'plain']);

/** Lanes where the stack-neutral pair is the correct answer, not a shortfall. */
const NATIVELY_GENERIC_LANES: ReadonlySet<string> = new Set(['plain']);

/**
 * The label detection returns for a framework it recognises but does not
 * model. Mirrors `stack/detect.ts::UNSUPPORTED_STACK`; duplicated as a literal
 * because this module is import-free by design (the detector is a leaf module
 * the directives must not depend on).
 */
export const UNSUPPORTED_LANE = 'unknown';

/** Return the bundle for `stack`, or the `plain` bundle when unmapped. */
export function bundle_for(stack: string): StackBundle {
    return STACK_BUNDLES[stack] ?? (STACK_BUNDLES['plain'] as StackBundle);
}

/**
 * Questions for the refusal halt on an unmodelled framework.
 *
 * Not a directive — there is nothing honest to dispatch to. The agent names
 * the actual markers from the manifest (it has filesystem access; the engine
 * deliberately does not carry them on `StackResult`), and the user chooses
 * between the stack-neutral floor and stopping.
 */
export function unsupported_stack_questions(step: string): string[] {
    return [
        '> Detection found a frontend framework this package does not model, ' +
            `so there is no \`${step}\` lane for it.`,
        '> Name the markers you see in `composer.json` / `package.json` so the ' +
            'choice below is made on the real stack, not on a guess.',
        '> 1. Continue on the stack-neutral floor — `ui-component-architect` + ' +
            '`tailwind-engineer`. Output will not be idiomatic for this ' +
            'framework; say so in the result.',
        '> 2. Abort — drop this UI request and add a lane first ' +
            '(`docs/contracts/ui-stack-extension.md`).',
    ];
}

/**
 * Render the "load these skills" line for a dispatch halt.
 *
 * The engine cannot load a skill itself; naming the bundle is what stops the
 * agent from resolving an unresolvable verb by guessing. A lane with no
 * framework-specific executor says that outright rather than presenting the
 * generic pair as if it were stack support.
 */
export function bundle_line(stack: string, role: 'build' | 'review'): string {
    const bundle = bundle_for(stack);
    const skills = role === 'review' ? bundle.review : bundle.build;
    const rendered = skills.map((name) => `\`${name}\``).join(' + ');
    if (NATIVELY_GENERIC_LANES.has(stack)) {
        return `> Skills: ${rendered} — stack-neutral, which is what \`${stack}\` means.`;
    }
    if (GENERIC_LANES.has(stack)) {
        return (
            `> Skills: ${rendered} — there is no \`${stack}\`-specific executor, ` +
            'so this is the stack-neutral floor, not idiomatic ' +
            `\`${stack}\`. Say so in the result.`
        );
    }
    return `> Skills: ${rendered}.`;
}
