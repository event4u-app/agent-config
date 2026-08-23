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
 * The stack-neutral build bundle. All three live in `engineering-base`, so they
 * are present in every install.
 *
 * `ui-apply-generic` leads: it carries the implementation contract that used to
 * exist only inside the framework executors, and it pulls framework idiom from
 * the 16-stack corpus rather than from prose. That is what turns this lane from
 * an honest refusal into actual coverage for Svelte, Astro, Angular and
 * anything future — without minting a skill per framework.
 *
 * The other two are the companions it composes with: `ui-component-architect`
 * ("the same lens applies to Blade, Livewire, React, or Vue trees") and
 * `tailwind-engineer` ("the **how** for any Tailwind-stack screen").
 */
const GENERIC_BUILD: ReadonlyArray<string> = [
    'ui-apply-generic',
    'ui-component-architect',
    'tailwind-engineer',
];

/** `design-review` is stack-neutral and ships in `engineering-base`. */
const GENERIC_REVIEW: ReadonlyArray<string> = ['design-review'];

/**
 * Lane → bundle. Keys mirror `KNOWN_STACKS`; the dispatch tables in
 * `apply` / `review` / `polish` keep their own verb strings (a tested public
 * contract) and consume this map only to name the skills in the halt body.
 */
export const STACK_BUNDLES: Readonly<Record<string, StackBundle>> = {
    // An unmodelled framework routes to the generic lane rather than refusing:
    // `ui-apply-generic` queries the stack corpus, which covers svelte, astro,
    // angular, nuxt and eleven more. Refusing while holding that corpus is the
    // "an honest refusal is not coverage" defect. A genuine ambiguity still
    // refuses — see `is_ambiguous_stack`.
    unknown: {
        build: GENERIC_BUILD,
        review: GENERIC_REVIEW,
        pack_agnostic: true,
    },
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
export const GENERIC_LANES: ReadonlySet<string> = new Set(['vue', 'plain', 'unknown']);

/** Lanes where the stack-neutral pair is the correct answer, not a shortfall. */
const NATIVELY_GENERIC_LANES: ReadonlySet<string> = new Set(['plain']);

/**
 * The label detection returns for a framework it recognises but does not
 * model. Mirrors `stack/detect.ts::UNSUPPORTED_STACK`; duplicated as a literal
 * because this module is import-free by design (the detector is a leaf module
 * the directives must not depend on).
 */
export const UNSUPPORTED_LANE = 'unknown';

/**
 * Return the bundle for a stack state.
 *
 * Composition wins when the state carries axes; the hand-written map is the
 * fallback for a legacy `state.stack` persisted before Detection v2. Keeping
 * both is not indecision — a state file written by an older run must still
 * dispatch, and the map is exactly what it expects.
 */
export function bundle_for(stack_state: unknown): StackBundle {
    if (typeof stack_state === 'object' && stack_state !== null) {
        const raw = (stack_state as Record<string, unknown>)['axes'];
        if (typeof raw === 'object' && raw !== null) {
            return compose_bundle(raw as Record<string, string>);
        }
        const label = (stack_state as Record<string, unknown>)['frontend'];
        if (typeof label === 'string' && label in STACK_BUNDLES) {
            return STACK_BUNDLES[label] as StackBundle;
        }
    }
    if (typeof stack_state === 'string' && stack_state in STACK_BUNDLES) {
        return STACK_BUNDLES[stack_state] as StackBundle;
    }
    return STACK_BUNDLES['plain'] as StackBundle;
}

/**
 * True when the `unknown` label came from a question, not from a coverage gap.
 *
 * `unknown` carries two different situations and they need opposite handling:
 *
 * - **An unmodelled framework** (svelte, astro, angular …). Since
 *   `ui-apply-generic` exists and queries the stack corpus, refusing here would
 *   be the "an honest refusal is not coverage" defect — the corpus almost
 *   certainly HAS the stack. Route to the generic lane, naming the framework.
 * - **A genuine ambiguity** — two SPA frameworks in one manifest, or several
 *   workspace roots. No executor can fix that: the open question is *which
 *   project is this*, and only the caller can answer. Refuse.
 *
 * `StackResult.ambiguity` is what distinguishes them, so the check is on the
 * ambiguity list rather than on the label.
 */
export function is_ambiguous_stack(stack_state: unknown): boolean {
    if (typeof stack_state !== 'object' || stack_state === null) return false;
    const raw = (stack_state as Record<string, unknown>)['ambiguity'];
    return Array.isArray(raw) && raw.length > 0;
}

/**
 * Questions for the refusal halt when detection cannot say what the project is.
 *
 * Not a directive — there is nothing honest to dispatch to, because the missing
 * input is a decision rather than a skill. `conflicts` are echoed verbatim from
 * `StackResult.ambiguity` so the user sees the actual collision.
 */
export function unsupported_stack_questions(
    step: string,
    conflicts: ReadonlyArray<string> = [],
): string[] {
    const lines = [
        '> Detection found conflicting signals, so it will not pick a stack for ' +
            `you at \`${step}\`. Guessing here is the failure this halt exists ` +
            'to prevent.',
    ];
    for (const c of conflicts) {
        lines.push(`> - \`${c}\``);
    }
    // A scope conflict has a *closed* option set — the detector already named
    // every candidate — so enumerate them instead of asking the open question.
    // "Which workspace?" answered from a list is a pick; answered as free text
    // it is a guess the agent has to validate, which is the same silent-pick
    // failure one layer up.
    const roots = workspace_roots_from_conflicts(conflicts);
    let n = 1;
    for (const root of roots) {
        lines.push(
            `> ${n}. Build for \`${root}\` — write it to \`state.stack.scope_root\` ` +
                'and re-run detection against that workspace.',
        );
        n += 1;
    }
    if (roots.length === 0) {
        lines.push(
            `> ${n}. Name the project to build for — the workspace path, or which ` +
                'framework owns this surface. Detection re-runs against that scope.',
        );
        n += 1;
    }
    lines.push(
        `> ${n}. Continue on the stack-neutral floor anyway — \`ui-apply-generic\` ` +
            'plus its companions. Output will not be idiomatic for either ' +
            'framework; say so in the result.',
        `> ${n + 1}. Abort — drop this UI request.`,
    );
    return lines;
}

/** Prefix of the ambiguity string the detector emits for a scope conflict. */
const _WORKSPACE_CONFLICT_PREFIX = 'workspace roots: ';

/**
 * The workspace names carried by a `workspace roots: a + b` conflict.
 *
 * Parsed back out of the ambiguity string rather than passed alongside it,
 * because `StackResult.ambiguity` is the serialized contract the halt already
 * echoes — adding a parallel field would give the same fact two representations
 * that can disagree after a round-trip through `state.stack`.
 */
export function workspace_roots_from_conflicts(
    conflicts: ReadonlyArray<string>,
): string[] {
    for (const c of conflicts) {
        if (c.startsWith(_WORKSPACE_CONFLICT_PREFIX)) {
            return c
                .slice(_WORKSPACE_CONFLICT_PREFIX.length)
                .split('+')
                .map((name) => name.trim())
                .filter((name) => name !== '');
        }
    }
    return [];
}

/**
 * Name the workspace a dispatch is scoped to, when it is not the project root.
 *
 * Returns an empty array for every non-monorepo project, so those halts stay
 * byte-identical. The line exists because the skills downstream read
 * `components.json`, `components/ui/*` and the styling config by path, and in a
 * monorepo none of those live at the repository root — which is the M5 prose
 * defect, restated where the agent actually acts on it.
 */
export function scope_lines(stack_state: unknown): string[] {
    if (typeof stack_state !== 'object' || stack_state === null) {
        return [];
    }
    const raw = (stack_state as Record<string, unknown>)['scope_root'];
    if (typeof raw !== 'string' || raw === '') {
        return [];
    }
    return [
        `> Scope: \`${raw}\` — the workspace this stack was detected in. Read ` +
            'and write component files, `components.json`, and the styling ' +
            'config under that path. The repository root carries none of them.',
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
export function bundle_line(
    stack_state: unknown,
    role: 'build' | 'review',
    stack_label?: string,
): string {
    const bundle = bundle_for(stack_state);
    const stack =
        stack_label ??
        (typeof stack_state === 'string'
            ? stack_state
            : String(
                  (stack_state as Record<string, unknown> | null)?.['frontend'] ?? 'plain',
              ));
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

// ── Axis-driven composition ─────────────────────────────────────────────────

/**
 * Overlay table: one axis value → the skills that add its idiom.
 *
 * This is what replaces lane enumeration. A lane is no longer a hand-written
 * bundle but the base plus whatever the axes turn on, so a stack the package has
 * never named still composes: `reactivity: livewire` pulls Livewire **with or
 * without** Flux, and `component_lib: flux` layers Flux on top. The two
 * full-match lanes fall out as a special case — that identity is the regression
 * witness, asserted in `ui_lane_matrix.test.ts`.
 *
 * Only axis values with a real overlay skill appear. Everything else is served
 * by the base plus its corpus query, which is the point: coverage without a
 * skill per framework.
 */
const _AXIS_OVERLAYS: Readonly<Record<string, ReadonlyArray<string>>> = {
    'reactivity:livewire': ['livewire'],
    'reactivity:react': ['react-shadcn-ui'],
    'component_lib:flux': ['flux'],
    'component_lib:shadcn': ['react-shadcn-ui'],
    'component_lib:radix': ['react-shadcn-ui'],
    'view:blade': ['blade-ui'],
    'meta:filament': ['livewire', 'blade-ui'],
};

/** Axes consulted for overlays, most-specific first. */
const _OVERLAY_AXES: ReadonlyArray<string> = [
    'component_lib',
    'meta',
    'reactivity',
    'view',
];

/** Skill → the pack it ships in, for the pack-agnostic determination. */
const _FRAMEWORK_PACK_SKILLS: ReadonlySet<string> = new Set([
    'livewire',
    'flux',
    'blade-ui',
    'react-shadcn-ui',
]);

/**
 * Derive a bundle from detected axes.
 *
 * Order is deliberate and matches the hand-written lanes: overlays first
 * (most-specific axis first), base last. An overlay carries framework idiom the
 * base cannot, so it must be read before the generic contract's fallbacks.
 *
 * `pack_agnostic` is computed, not declared: a composition that pulled in any
 * framework-pack skill is not safe as a fallback, and computing it removes the
 * chance of a hand-written `true` outliving the bundle it described.
 */
export function compose_bundle(axes: Readonly<Record<string, string>>): StackBundle {
    const build: string[] = [];
    for (const axis of _OVERLAY_AXES) {
        const value = axes[axis];
        if (value === undefined || value === 'none' || value === 'unknown') continue;
        for (const skill of _AXIS_OVERLAYS[`${axis}:${value}`] ?? []) {
            if (!build.includes(skill)) build.push(skill);
        }
    }
    for (const skill of GENERIC_BUILD) {
        if (!build.includes(skill)) build.push(skill);
    }
    return {
        build,
        review: GENERIC_REVIEW,
        pack_agnostic: !build.some((s) => _FRAMEWORK_PACK_SKILLS.has(s)),
    };
}
