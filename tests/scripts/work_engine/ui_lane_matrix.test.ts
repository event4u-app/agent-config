/**
 * UI-track lane matrix — the deterministic baseline for
 * `road-to-ui-track-integrity`.
 *
 * Three facts are asserted per lane, separately, because they fail
 * independently and the package has previously conflated them:
 *
 *   1. DETECTION  — what `detect_stack()` labels a given manifest shape.
 *   2. DISPATCH   — which directive name `apply` / `review` / `polish` emit.
 *   3. RESOLUTION — whether that directive name has a backing `SKILL.md`.
 *
 * `LANE_MATRIX` below is the measurement. Its diff across commits IS the
 * before/after evidence the roadmap's phases are scored against — a phase
 * that changes behaviour must change this table, and a phase that claims to
 * fix a lane without touching it did not fix it.
 *
 * Fixture ids map 1:1 onto the roadmap's Phase-0 steps
 * (`daf-lane-*`, `daf-placeholder-in-array`, `daf-states-type-bypass`).
 *
 * Rubric-scored siblings live in `tests/design-artifacts/eval-fixtures.md`
 * because no unit test can assert them — `daf-generic-apply-coverage` and
 * `daf-generic-apply-degrade` judge whether the agent actually *cited* the
 * stack corpus rather than emitting plausible framework code from memory, and
 * whether it stated the gap when no corpus exists. Both are red until
 * `road-to-universal-stack-coverage` Phase 2 lands the generic executor.
 *
 * One sibling id is deliberately NOT here: `daf-lane-recovery` is rubric-scored,
 * not deterministic — it asks whether the agent, handed a directive verb whose
 * name resolves to nothing, states which skills it actually used instead of
 * silently picking. No unit test can assert that; it is judged against
 * `tests/design-artifacts/eval-fixtures.md` § Lane fixtures. Named here so the
 * id has a citing surface.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    DEFAULT_STACK,
    KNOWN_STACKS,
    UNSUPPORTED_STACK,
    detect_stack,
} from '../../../src/agent-src/templates/scripts/work_engine/stack/detect.js';
import {
    STACK_DIRECTIVES,
    run as applyRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';
import {
    STACK_DIRECTIVES as REVIEW_DIRECTIVES,
    run as reviewRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';
import {
    STACK_DIRECTIVES as POLISH_DIRECTIVES,
    run as polishRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';
import { run as designRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';
import {
    STACK_BUNDLES,
    compose_bundle,
    scope_lines,
    workspace_roots_from_conflicts,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'src', 'skills');

const _tmpdirs: string[] = [];

/** Materialise a throwaway project root carrying the given manifests. */
function projectWith(manifests: Record<string, unknown>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-lane-'));
    _tmpdirs.push(root);
    for (const [name, body] of Object.entries(manifests)) {
        fs.writeFileSync(
            path.join(root, name),
            typeof body === 'string' ? body : JSON.stringify(body),
            'utf-8',
        );
    }
    return root;
}

/**
 * Path to a committed stack fixture.
 *
 * Committed rather than built in a temp dir on purpose: the shape under test IS
 * the artefact (a root manifest beside workspace globs and marker files), so a
 * builder that constructs it inline can drift from what a real repository looks
 * like without any test going red — which is exactly how M1 survived two edits.
 */
function fixture(name: string): string {
    return path.join(REPO_ROOT, 'tests', 'fixtures', 'stack', name);
}

afterAll(() => {
    for (const d of _tmpdirs) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/** True when `<name>` resolves to a real skill directory with a SKILL.md. */
function skillExists(name: string): boolean {
    return fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md'));
}

interface Lane {
    /** Roadmap fixture id. */
    readonly id: string;
    /** Manifests placed at the project root. */
    readonly manifests: Record<string, unknown>;
    /** What `detect_stack` labels it. */
    readonly detects: string;
    /**
     * Whether the dispatched apply directive resolves to a real skill file.
     * Always `false`, and correctly so: directive names are agent-interpreted
     * verbs, not skill paths. What must resolve is the lane's BUNDLE — see the
     * bundle-resolution block below.
     */
    readonly dispatchResolves: boolean;
}

/**
 * The baseline, and the record of what each phase changed.
 *
 * Every row was measured, not assumed. A `// Was X` comment marks a row a
 * phase moved; a row without one has held since the first measurement.
 */
const LANE_MATRIX: readonly Lane[] = [
    {
        id: 'daf-lane-react-shadcn',
        manifests: {
            'package.json': {
                dependencies: { react: '^18', '@radix-ui/react-dialog': '^1' },
            },
        },
        detects: 'react-shadcn',
        dispatchResolves: false,
    },
    {
        id: 'daf-lane-livewire-no-flux',
        manifests: {
            'composer.json': {
                require: { 'laravel/framework': '^11', 'livewire/livewire': '^3' },
            },
        },
        // Was `plain` — detection required Livewire AND Flux.
        detects: 'blade-livewire',
        dispatchResolves: false,
    },
    {
        id: 'daf-lane-filament',
        manifests: {
            'composer.json': {
                require: { 'laravel/framework': '^11', 'filament/filament': '^3' },
            },
        },
        // Was `plain` — Filament was unmodelled (0 files under src/).
        detects: 'filament',
        dispatchResolves: false,
    },
    {
        id: 'daf-lane-vue',
        manifests: { 'package.json': { dependencies: { vue: '^3' } } },
        detects: 'vue',
        dispatchResolves: false,
    },
    {
        id: 'daf-lane-static-html',
        manifests: { 'package.json': { devDependencies: { tailwindcss: '^4' } } },
        detects: 'plain',
        dispatchResolves: false,
    },
    {
        id: 'daf-lane-react-no-radix',
        manifests: { 'package.json': { dependencies: { react: '^18' } } },
        // Was `plain` — React alone failed the shadcn/Radix marker check.
        detects: 'react',
        dispatchResolves: false,
    },
    {
        // New in Phase 2: a framework we recognise but do not model is no
        // longer indistinguishable from a genuinely plain project.
        id: 'daf-lane-unmodelled-svelte',
        manifests: { 'package.json': { dependencies: { svelte: '^5' } } },
        detects: 'unknown',
        dispatchResolves: false,
    },
    {
        id: 'daf-lane-unmodelled-inertia',
        manifests: {
            'composer.json': { require: { 'inertiajs/inertia-laravel': '^1' } },
        },
        detects: 'unknown',
        dispatchResolves: false,
    },
    // ── road-to-universal-stack-coverage Phase 0 ────────────────────────────
    // Measured baseline for the shapes the flat label cannot express. Each row
    // is a real project shape; the `corpus` note records whether the knowledge
    // to serve it already exists in design-intelligence/data/stacks/.
    {
        // Laravel + Alpine + Tailwind — no Livewire, so no Blade guidance at
        // all despite `view: blade` being unambiguous. corpus: laravel.csv.
        id: 'daf-lane-blade-alpine',
        manifests: {
            'composer.json': { require: { 'laravel/framework': '^11' } },
            'package.json': { dependencies: { alpinejs: '^3', tailwindcss: '^4' } },
        },
        detects: 'plain',
        dispatchResolves: false,
    },
    {
        // Next collapses into `react`, losing the Next idiom. corpus: nextjs.csv.
        id: 'daf-lane-next-tailwind',
        manifests: {
            'package.json': { dependencies: { next: '^15', react: '^19', tailwindcss: '^4' } },
        },
        detects: 'react',
        dispatchResolves: false,
    },
    {
        // Nuxt collapses into `vue` — and never reaches the unmodelled check,
        // because `vue` (a Nuxt dependency) matches first. A priority-order
        // artefact of the flat label. corpus: nuxtjs.csv + nuxt-ui.csv.
        id: 'daf-lane-nuxt',
        manifests: { 'package.json': { dependencies: { nuxt: '^3', vue: '^3' } } },
        detects: 'vue',
        dispatchResolves: false,
    },
    {
        // Refused, though astro.csv exists — the core claim of the successor
        // roadmap: an honest refusal is not coverage.
        id: 'daf-lane-astro',
        manifests: { 'package.json': { dependencies: { astro: '^4' } } },
        detects: 'unknown',
        dispatchResolves: false,
    },
    {
        // Refused, though angular.csv exists.
        id: 'daf-lane-angular',
        manifests: { 'package.json': { dependencies: { '@angular/core': '^18' } } },
        detects: 'unknown',
        dispatchResolves: false,
    },
    // ── road-to-monorepo-scope-and-detection Phase 2 ───────────────────────
    // The two live-run cases the roadmap recorded as defects: both resolved to
    // `component_lib: none` because the table knew only the `@radix-ui/` scope.
    {
        // shadcn's `new-york` style moved to the unified `radix-ui` package in
        // February 2026. Was `react` with `component_lib: none`.
        id: 'daf-lane-radix-unified',
        manifests: { 'package.json': { dependencies: { react: '^19', 'radix-ui': '^1.1' } } },
        detects: 'react-shadcn',
        dispatchResolves: false,
    },
    {
        // Base UI is a primitive layer shadcn accepts, but it is not shadcn:
        // without `components.json` this stays `react`, and only the
        // component_lib axis carries the extra fact. Was `component_lib: none`.
        id: 'daf-lane-base-ui',
        manifests: { 'package.json': { dependencies: { react: '^19', '@base-ui/react': '^1.0' } } },
        detects: 'react',
        dispatchResolves: false,
    },
    {
        // No htmx signal anywhere in the detector. corpus: none.
        id: 'daf-lane-htmx',
        manifests: { 'package.json': { dependencies: { 'htmx.org': '^2' } } },
        detects: 'plain',
        dispatchResolves: false,
    },
];

describe('UI lane matrix — detection', () => {
    for (const lane of LANE_MATRIX) {
        it(`${lane.id}: detects as \`${lane.detects}\``, () => {
            const root = projectWith(lane.manifests);
            expect(detect_stack(root).frontend).toBe(lane.detects);
        });
    }

    it('daf-lane-monorepo: a single frontend scope is detected, not refused', () => {
        // Thrice-changed row, and the reason matters. It was `plain` (silent
        // generic tooling over the whole repo), then `unknown` (refused as a
        // wrong-scope call), then `react-shadcn` — but measured against a
        // monorepo with NO root `package.json`, which is not a shape that
        // exists. That is M2: the row passed before and after the M1 defect,
        // so it witnessed nothing. It now loads a fixture that looks like a
        // repository — root manifest, `pnpm-workspace.yaml`, `turbo.json` —
        // and its pre-state (`plain`, recorded in the fixture README) is the
        // defect this roadmap fixes.
        const r = detect_stack(fixture('mono-pnpm-turbo'));
        expect(r.frontend).toBe('react-shadcn');
        // `shadcn`, not `radix`: the workspace carries `components.json`, and the
        // signal table's documented rule is that the marker file beats the bare
        // dependency. The pre-conversion row asserted `radix` because its
        // throwaway workspace had no marker file at all.
        expect(r.axes.component_lib).toBe('shadcn');
        expect(r.ambiguity).toEqual([]);
        // The scope is the workspace that owns `components.json`, never the
        // repository root — the layout shadcn's own CLI scaffolds.
        expect(r.scope_root).toBe(path.join('packages', 'ui'));
    });

    it('several workspace roots are named, not picked', () => {
        // Two workspaces that genuinely disagree (react vs vue). The refusal
        // contract that governs a single manifest governs scope selection too.
        const r = detect_stack(fixture('mono-two-frontends'));
        expect(r.frontend).toBe(UNSUPPORTED_STACK);
        expect(r.ambiguity.join(' ')).toContain('workspace roots');
        expect(r.ambiguity.join(' ')).toContain('admin');
        expect(r.scope_root).toBe('');
    });

    it('greenfield-nested: a nested manifest with no root manifest still descends', () => {
        // The pre-conversion shape, kept deliberately. No root manifest at all
        // is not a monorepo — it is a scaffold in progress — and the descent
        // path that serves it is a different branch from the workspace-root
        // predicate Phase 1 added. Dropping this row would have retired the
        // only coverage that branch has.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-lane-mono-'));
        _tmpdirs.push(root);
        const pkgDir = path.join(root, 'packages', 'web');
        fs.mkdirSync(pkgDir, { recursive: true });
        fs.writeFileSync(
            path.join(pkgDir, 'package.json'),
            JSON.stringify({ dependencies: { react: '^18', '@radix-ui/react-slot': '^1' } }),
            'utf-8',
        );
        const r = detect_stack(root);
        expect(r.frontend).toBe('react-shadcn');
        expect(r.axes.component_lib).toBe('radix');
        expect(r.ambiguity).toEqual([]);
    });

    it('mono-nx: a workspace declared only by nx.json is descended into', () => {
        const r = detect_stack(fixture('mono-nx'));
        expect(r.frontend).toBe('react');
        expect(r.scope_root).toBe(path.join('packages', 'ui'));
    });

    it('mono-devdep-root: root test tooling is not the application', () => {
        // Pre-state was `react` — the root's shared Testing-Library setup in
        // devDependencies matched the flat label before any descent ran, so a
        // Vue application was handed a React lane.
        const r = detect_stack(fixture('mono-devdep-root'));
        expect(r.frontend).toBe('vue');
        expect(r.scope_root).toBe(path.join('apps', 'web'));
    });

    it('mono-pnpm-libs: pnpm-workspace.yaml globs are a declarative source', () => {
        const r = detect_stack(fixture('mono-pnpm-libs'));
        expect(r.frontend).toBe('react');
        expect(r.scope_root).toBe(path.join('libs', 'ui'));
    });

    it('the unified radix package and Base UI are on the component_lib axis', () => {
        // § Context recorded both of these returning `component_lib: none` at
        // the pinned commit — the signal table was one major behind.
        const radix = detect_stack(
            projectWith({ 'package.json': { dependencies: { react: '^19', 'radix-ui': '^1.1' } } }),
        );
        expect(radix.axes.component_lib).toBe('radix');

        for (const name of ['@base-ui/react', '@base-ui-components/react']) {
            const base = detect_stack(
                projectWith({ 'package.json': { dependencies: { react: '^19', [name]: '^1.0' } } }),
            );
            // `react`, never `react-shadcn`: shadcn-on-Base-UI is identified by
            // `components.json` alone, exactly as it was before.
            expect(base.frontend).toBe('react');
            expect(base.axes.component_lib).toBe('base-ui');
        }
    });

    it('the css axis separates the two Tailwind majors by marker file', () => {
        expect(detect_stack(fixture('tailwind-v3')).axes.css).toBe('tailwind-v3');
        expect(detect_stack(fixture('tailwind-v4')).axes.css).toBe('tailwind-v4');
        // Neither marker present: the axis stays undifferentiated rather than
        // guessing a major, which is what keeps the value reachable for the
        // bundle corpus that still names it.
        expect(
            detect_stack(projectWith({ 'package.json': { devDependencies: { tailwindcss: '^4' } } }))
                .axes.css,
        ).toBe('tailwind');
    });

    it('a non-monorepo carries an empty scope_root, not a path', () => {
        // `scope_root` is repo-relative, so "the project root" is the empty
        // string — which is also what `scaffold.ts` defaults to when the field
        // is absent, keeping every non-monorepo project byte-identical.
        expect(detect_stack(projectWith({ 'package.json': { dependencies: { react: '^18' } } })).scope_root).toBe('');
    });

    it('an empty repo stays the default — greenfield must not be refused', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-lane-green-'));
        _tmpdirs.push(root);
        expect(detect_stack(root).frontend).toBe(DEFAULT_STACK);
    });

    it('daf-lane-mixed-repo: react AND vue is reported, not silently picked', () => {
        // Was `react` with no warning — priority order resolved the ambiguity
        // instead of surfacing it, so a project that is genuinely both got one
        // lane and no signal. Guessing is the worse property for a global
        // package: asking costs one turn, a wrong silent pick costs the run.
        const root = projectWith({
            'package.json': { dependencies: { react: '^18', vue: '^3' } },
        });
        const r = detect_stack(root);
        expect(r.frontend).toBe(UNSUPPORTED_STACK);
        expect(r.ambiguity).toContain('reactivity: react + vue');
    });

    it('alpine and htmx do not count as an ambiguity next to a framework', () => {
        // Progressive-enhancement layers legitimately co-exist with a
        // framework; treating them as a conflict would refuse ordinary
        // Laravel+Alpine and React+htmx projects.
        const root = projectWith({
            'composer.json': { require: { 'laravel/framework': '^11' } },
            'package.json': { dependencies: { alpinejs: '^3', 'htmx.org': '^2' } },
        });
        expect(detect_stack(root).ambiguity).toEqual([]);
    });

    it('axes express what the flat label cannot', () => {
        // The measured argument for axes over an enum. Nuxt is on the
        // unmodelled-marker list yet resolves to `vue`, because Vue is a Nuxt
        // dependency and matched first — no ordering of one list can express
        // "Nuxt implies Vue but is not Vue". As axes both facts fit.
        const nuxt = detect_stack(
            projectWith({ 'package.json': { dependencies: { nuxt: '^3', vue: '^3' } } }),
        );
        expect(nuxt.frontend).toBe('vue');
        expect(nuxt.axes.reactivity).toBe('vue');
        expect(nuxt.axes.meta).toBe('nuxt');

        // Same shape for Next over React — nextjs.csv becomes reachable
        // without minting a `next` label.
        const next = detect_stack(
            projectWith({ 'package.json': { dependencies: { next: '^15', react: '^19' } } }),
        );
        expect(next.frontend).toBe('react');
        expect(next.axes.reactivity).toBe('react');
        expect(next.axes.meta).toBe('nextjs');
    });

    it('the flux distinction is structural, not a lane name', () => {
        const base = { 'laravel/framework': '^11', 'livewire/livewire': '^3' };
        const without = detect_stack(projectWith({ 'composer.json': { require: base } }));
        const withFlux = detect_stack(
            projectWith({ 'composer.json': { require: { ...base, 'livewire/flux': '^1' } } }),
        );
        // Same view + reactivity; the ONLY difference is the component library.
        // Phase 3 composes on exactly that, so Flux-less Livewire gets Livewire
        // guidance without Flux guidance.
        expect(without.axes.view).toBe('blade');
        expect(without.axes.reactivity).toBe('livewire');
        expect(without.axes.component_lib).toBe('none');
        expect(withFlux.axes.component_lib).toBe('flux');
    });

    it('an unresolved axis on a real project is `unknown`, not `none`', () => {
        // "Absent" and "not recognised" are different facts; conflating them is
        // what made a refusal indistinguishable from a plain project.
        const htmx = detect_stack(
            projectWith({ 'package.json': { dependencies: { 'htmx.org': '^2' } } }),
        );
        expect(htmx.axes.reactivity).toBe('htmx');
        expect(htmx.axes.view).toBe('unknown');

        const greenfield = detect_stack(
            fs.mkdtempSync(path.join(os.tmpdir(), 'ui-lane-axes-')),
        );
        expect(greenfield.axes.view).toBe('none');
    });

    it('a corpus exists for stacks the detector refuses', () => {
        // The successor roadmap's premise, asserted rather than assumed: the
        // knowledge to serve svelte / astro / angular / nuxt is already in the
        // tree, so refusing them is a wiring gap, not a knowledge gap.
        const stacksDir = path.join(
            REPO_ROOT, 'src', 'skills', 'design-intelligence', 'data', 'stacks',
        );
        for (const csv of ['svelte.csv', 'astro.csv', 'angular.csv', 'nuxtjs.csv']) {
            expect(fs.existsSync(path.join(stacksDir, csv)), csv).toBe(true);
        }
    });

    it('every detected label is a KNOWN_STACKS member', () => {
        for (const lane of LANE_MATRIX) {
            expect(KNOWN_STACKS.has(lane.detects)).toBe(true);
        }
    });
});

describe('UI lane matrix — dispatch resolution', () => {
    it('the three dispatch tables cover exactly the same stack labels', () => {
        const keys = (t: Record<string, string>) => Object.keys(t).sort();
        expect(keys(REVIEW_DIRECTIVES)).toEqual(keys(STACK_DIRECTIVES));
        expect(keys(POLISH_DIRECTIVES)).toEqual(keys(STACK_DIRECTIVES));
    });

    it('every dispatch table key is a KNOWN_STACKS member', () => {
        for (const stack of Object.keys(STACK_DIRECTIVES)) {
            expect(KNOWN_STACKS.has(stack)).toBe(true);
        }
    });

    for (const lane of LANE_MATRIX) {
        it(`${lane.id}: apply directive resolves to a skill = ${lane.dispatchResolves}`, () => {
            const directive = STACK_DIRECTIVES[lane.detects] ?? STACK_DIRECTIVES['plain'];
            expect(directive).toBeTruthy();
            expect(skillExists(directive as string)).toBe(lane.dispatchResolves);
        });
    }

    it('directive names are VERBS, not skill paths — none resolves to a skill', () => {
        const all = [
            ...Object.values(STACK_DIRECTIVES),
            ...Object.values(REVIEW_DIRECTIVES),
            ...Object.values(POLISH_DIRECTIVES),
        ];
        const unresolved = all.filter((name) => !skillExists(name));
        // Pinned architectural fact, not a defect record. Of the engine's 11
        // literal directive verbs only 2 (`existing-ui-audit`, `refine-prompt`)
        // name a skill; the other 9 (`run-tests`, `create-plan`, `apply-plan`,
        // …) resolve to nothing and are interpreted by the agent. The UI verbs
        // follow that norm. What has to resolve is the BUNDLE (next block) —
        // authoring 12 `ui-apply-*` skill files would make these lanes the
        // engine's only exception. See
        // agents/settings/contexts/frontend-fidelity-cut.md § Amendment.
        expect(unresolved.length).toBe(all.length);
    });
});

describe('UI lane matrix — bundle resolution (what must actually exist)', () => {
    it('every dispatchable lane has a bundle', () => {
        for (const stack of Object.keys(STACK_DIRECTIVES)) {
            // `unknown` deliberately has none — there is nothing honest to
            // dispatch to, so the step refuses instead.
            if (stack === 'unknown') continue;
            expect(STACK_BUNDLES[stack], stack).toBeDefined();
        }
    });

    it('an unmodelled framework now DISPATCHES to the generic lane', () => {
        // Reversed deliberately. Refusing while the stack corpus holds svelte,
        // astro, angular and eleven more IS the "honest refusal is not
        // coverage" defect. `ui-apply-generic` queries that corpus, so an
        // unmodelled framework gets served — and told it is not idiomatic.
        const st = new DeliveryState({
            ticket: {},
            stack: { frontend: 'unknown', mtime: 0 },
        } as never);
        const r = applyRun(st);
        expect(r.outcome).toBe('blocked'); // delegation halt, not a refusal
        const body = r.questions.join('\n');
        expect(body).toContain('@agent-directive');
        expect(body).toContain('ui-apply-generic');
    });

    it('a genuine ambiguity still refuses, and names the collision', () => {
        // The other half of `unknown`. No executor can resolve "which project
        // is this" — that is a decision, and only the caller has it.
        const st = new DeliveryState({
            ticket: {},
            stack: {
                frontend: 'unknown',
                mtime: 0,
                ambiguity: ['reactivity: react + vue'],
            },
        } as never);
        const r = applyRun(st);
        expect(r.outcome).toBe('blocked');
        const body = r.questions.join('\n');
        expect(body).not.toContain('@agent-directive');
        expect(body).toContain('react + vue');
        expect(body).toContain('Abort');
    });

    it('every bundle member resolves to a real skill', () => {
        for (const [lane, bundle] of Object.entries(STACK_BUNDLES)) {
            for (const name of [...bundle.build, ...bundle.review]) {
                expect(skillExists(name), `${lane} → ${name}`).toBe(true);
            }
        }
    });

    it('the fallback lane is pack-agnostic', () => {
        // `plain` catches every unrecognised project, so its bundle may not
        // depend on a framework pack the consumer might not have installed.
        expect(STACK_BUNDLES['plain']?.pack_agnostic).toBe(true);
    });

    it('a dispatch halt names the bundle skills, so the agent cannot guess', () => {
        const st = new DeliveryState({
            ticket: {},
            stack: { frontend: 'plain', mtime: 0 },
        } as never);
        const body = applyRun(st).questions.join('\n');
        for (const name of STACK_BUNDLES['plain']?.build ?? []) {
            expect(body).toContain(name);
        }
    });

    it('the scope question names each workspace, and only those', () => {
        // Phase 4.2. A scope conflict has a closed candidate set, so the halt
        // enumerates it. The open "name the workspace" ask is what this
        // replaces: answered as free text it is a guess the agent must then
        // validate, which is the silent pick the detector refused one layer up.
        const detected = detect_stack(fixture('mono-two-frontends'));
        expect(workspace_roots_from_conflicts(detected.ambiguity)).toEqual(['admin', 'web']);

        const st = new DeliveryState({
            ticket: {},
            stack: { frontend: detected.frontend, mtime: 0, ambiguity: detected.ambiguity },
        } as never);
        const r = applyRun(st);
        expect(r.outcome).toBe('blocked');
        const body = r.questions.join('\n');
        expect(body).toContain('Build for `admin`');
        expect(body).toContain('Build for `web`');
        expect(body).toContain('state.stack.scope_root');
        // The generic free-text ask is gone precisely when the roots are known.
        expect(body).not.toContain('Name the project to build for');
        expect(body).toContain('Abort');
    });

    it('a scoped dispatch tells the agent which workspace to write in', () => {
        // Phase 4.1. The skills downstream resolve `components.json` and
        // `components/ui/*` by path; in a monorepo none of them sit at the
        // repository root, so the halt has to carry the scope.
        const detected = detect_stack(fixture('mono-pnpm-turbo'));
        expect(detected.scope_root).not.toBe('');
        const stack = {
            frontend: detected.frontend,
            mtime: 0,
            scope_root: detected.scope_root,
        };
        // `polish` short-circuits to SUCCESS with nothing to fix, so it only
        // reaches its dispatch halt once review has left findings behind.
        const extra: Record<string, Record<string, unknown>> = {
            apply: {},
            review: {},
            polish: { ui_review: { findings: [{ code: 'contrast' }], review_clean: false } },
        };
        for (const [step, run] of [
            ['apply', applyRun],
            ['review', reviewRun],
            ['polish', polishRun],
        ] as const) {
            const st = new DeliveryState({
                ticket: {},
                stack,
                ...extra[step],
            } as never);
            const r = run(st);
            expect(r.outcome, step).toBe('blocked');
            expect(r.questions.join('\n'), step).toContain(`Scope: \`${detected.scope_root}\``);
        }
    });

    it('a non-monorepo halt carries no scope line at all', () => {
        // The byte-identical guarantee: every project that is not a monorepo
        // must produce exactly the halt it produced before Phase 4.
        expect(scope_lines({ frontend: 'react', mtime: 0 })).toEqual([]);
        expect(scope_lines({ frontend: 'react', mtime: 0, scope_root: '' })).toEqual([]);
        const st = new DeliveryState({
            ticket: {},
            stack: { frontend: 'react', mtime: 0 },
        } as never);
        expect(applyRun(st).questions.join('\n')).not.toContain('Scope: `');
    });

    it('a lane with no framework-specific executor says so in the halt', () => {
        const st = new DeliveryState({
            ticket: {},
            stack: { frontend: 'vue', mtime: 0 },
        } as never);
        expect(applyRun(st).questions.join('\n')).toContain('no `vue`-specific executor');
    });
});

describe('UI lane matrix — axis composition', () => {
    // The regression witness for Phase 3: the hand-written lanes must fall out
    // of composition. If a framework overlay stops appearing, or stops leading,
    // the composition is wrong regardless of what the lint says.
    const CASES: ReadonlyArray<[string, Record<string, unknown>]> = [
        ['blade-livewire-flux', { 'composer.json': { require: { 'laravel/framework': '^11', 'livewire/livewire': '^3', 'livewire/flux': '^1' } } }],
        ['blade-livewire', { 'composer.json': { require: { 'laravel/framework': '^11', 'livewire/livewire': '^3' } } }],
        ['filament', { 'composer.json': { require: { 'laravel/framework': '^11', 'filament/filament': '^3' } } }],
        ['react-shadcn', { 'package.json': { dependencies: { react: '^18', '@radix-ui/x': '^1' } } }],
        ['react', { 'package.json': { dependencies: { react: '^18' } } }],
        ['vue', { 'package.json': { dependencies: { vue: '^3' } } }],
        ['plain', { 'package.json': { devDependencies: { tailwindcss: '^4' } } }],
    ];

    for (const [label, manifests] of CASES) {
        it(`${label}: composition reproduces the hand-written overlays, in order`, () => {
            const detected = detect_stack(projectWith(manifests));
            const composed = compose_bundle(
                detected.axes as unknown as Record<string, string>,
            );
            const hand = STACK_BUNDLES[label] as { build: readonly string[] };
            // The overlays lead, in the same order the hand-written lane had.
            expect(composed.build.slice(0, hand.build.length)).toEqual(
                hand.build.filter((s) => composed.build.includes(s)).length ===
                    hand.build.length
                    ? [...hand.build]
                    : composed.build.slice(0, hand.build.length),
            );
            for (const skill of hand.build) {
                expect(composed.build, `${label} lost ${skill}`).toContain(skill);
            }
        });
    }

    it('the generic contract is appended everywhere, not only to plain lanes', () => {
        // Deliberate divergence from the hand-written map, which omitted the
        // base because it did not exist. The generic contract is a FLOOR —
        // verbatim microcopy, tokens, a11y, states — and a Flux project needs
        // it as much as a Svelte one. Framework overlays still win on their
        // own subject; see ui-apply-generic § Gotchas.
        const flux = detect_stack(
            projectWith({
                'composer.json': {
                    require: { 'laravel/framework': '^11', 'livewire/livewire': '^3', 'livewire/flux': '^1' },
                },
            }),
        );
        const composed = compose_bundle(flux.axes as unknown as Record<string, string>);
        expect(composed.build).toContain('ui-apply-generic');
        expect(composed.build.indexOf('flux')).toBeLessThan(
            composed.build.indexOf('ui-apply-generic'),
        );
    });

    it('a stack no lane ever named still composes', () => {
        // Nuxt: no hand-written lane, and the flat label calls it `vue`. The
        // composition serves it from the base plus its corpus, which is the
        // alternative to minting a lane per framework.
        const nuxt = detect_stack(
            projectWith({ 'package.json': { dependencies: { nuxt: '^3', vue: '^3' } } }),
        );
        const composed = compose_bundle(nuxt.axes as unknown as Record<string, string>);
        expect(composed.build).toContain('ui-apply-generic');
        expect(composed.pack_agnostic).toBe(true);
    });

    it('pack_agnostic is computed, never declared', () => {
        // A hand-written `true` can outlive the bundle it described. Computing
        // it from the members removes that failure mode.
        const blade = compose_bundle({
            view: 'blade', reactivity: 'livewire', component_lib: 'none', css: 'none', meta: 'none',
        });
        expect(blade.pack_agnostic).toBe(false);
        const bare = compose_bundle({
            view: 'none', reactivity: 'none', component_lib: 'none', css: 'tailwind', meta: 'none',
        });
        expect(bare.pack_agnostic).toBe(true);
    });
});

describe('UI validation gates — placeholder + state shape', () => {
    it('daf-placeholder-in-array: a placeholder inside an array reaches the brief lock', () => {
        const st = new DeliveryState({
            ticket: {},
            ui_design: {
                layout: 'x',
                components: ['nav'],
                states: {
                    empty: 'e',
                    loading: 'l',
                    error: 'r',
                    success: 's',
                    disabled: 'd',
                },
                microcopy: { nav_items: ['Home', 'TODO: Link'] },
                a11y: 'x',
                design_confirmed: true,
            },
        } as never);
        const r = designRun(st);
        // Was `success` at baseline (the walker skipped arrays). Now rejected,
        // and the halt names the exact element, not just the list.
        expect(r.outcome).toBe('blocked');
        expect(r.questions.join('\n')).toContain('nav_items[1]');
    });

    it('daf-placeholder-in-array: the same hole exists on the rendered-output gate', () => {
        const st = new DeliveryState({
            ticket: {
                ui_apply: {
                    rendered: { 'nav.tsx': ['<a>Home</a>', '<a>TODO: Link</a>'] },
                    files: ['nav.tsx'],
                },
            },
        } as never);
        // Was `success` at baseline — the consumer-side gate shared the
        // producer-side gate's array-blind recursion, so "defense in depth"
        // described two layers that failed on identical inputs.
        expect(applyRun(st).outcome).toBe('blocked');
    });

    it('a placeholder inside a required state is rejected, not just counted', () => {
        const st = new DeliveryState({
            ticket: {},
            ui_design: {
                layout: 'x',
                components: ['nav'],
                states: {
                    empty: 'No items yet',
                    loading: 'Loading…',
                    error: 'TBD',
                    success: 'Saved',
                    disabled: 'n/a',
                },
                microcopy: { cta: 'Save' },
                a11y: 'x',
                design_confirmed: true,
            },
        } as never);
        const r = designRun(st);
        // The five states were truthiness-checked only, so `TBD` passed and the
        // brief looked complete while covering nothing.
        expect(r.outcome).toBe('blocked');
        expect(r.questions.join('\n')).toContain('states.error');
    });

    it('an explicit `n/a` state is legitimate, not filler', () => {
        // A static landing page has no error state. Declaring that is the
        // opposite of inventing filler, so the gate must not reject it — this is
        // why it demands five keys instead of branching on page type.
        const st = new DeliveryState({
            ticket: {},
            ui_design: {
                layout: 'x',
                components: ['hero'],
                states: {
                    empty: 'n/a',
                    loading: 'n/a',
                    error: 'n/a',
                    success: 'n/a',
                    disabled: 'n/a',
                },
                microcopy: { cta: 'Get started' },
                a11y: 'x',
                design_confirmed: true,
            },
        } as never);
        expect(designRun(st).outcome).toBe('success');
    });

    it('daf-states-type-bypass: a non-dict `states` skips all five state checks', () => {
        const st = new DeliveryState({
            ticket: {},
            ui_design: {
                layout: 'x',
                components: ['nav'],
                states: 'n/a',
                microcopy: { cta: 'Save' },
                a11y: 'x',
                design_confirmed: true,
            },
        } as never);
        // Was `success` at baseline — the per-state loop was `_isDict`-guarded,
        // so a string satisfied a gate that covered no state at all.
        const r = designRun(st);
        expect(r.outcome).toBe('blocked');
        expect(r.questions.join('\n')).toContain('states.error');
    });
});
