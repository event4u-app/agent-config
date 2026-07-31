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
import { STACK_DIRECTIVES as REVIEW_DIRECTIVES } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';
import { STACK_DIRECTIVES as POLISH_DIRECTIVES } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';
import { run as designRun } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';
import { STACK_BUNDLES } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.js';

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

    it('daf-lane-monorepo: manifests below the root are a wrong-scope call', () => {
        // Was `plain`. The detector still reads root manifests only — that is
        // documented and intentional — but a root with no manifest and a
        // workspace that has one is a scope error, not a plain project, so it
        // reports `unknown` and dispatch refuses instead of running generic
        // tooling over the whole repo.
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-lane-mono-'));
        _tmpdirs.push(root);
        const pkgDir = path.join(root, 'packages', 'web');
        fs.mkdirSync(pkgDir, { recursive: true });
        fs.writeFileSync(
            path.join(pkgDir, 'package.json'),
            JSON.stringify({ dependencies: { react: '^18', '@radix-ui/react-slot': '^1' } }),
            'utf-8',
        );
        expect(detect_stack(root).frontend).toBe(UNSUPPORTED_STACK);
    });

    it('an empty repo stays the default — greenfield must not be refused', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-lane-green-'));
        _tmpdirs.push(root);
        expect(detect_stack(root).frontend).toBe(DEFAULT_STACK);
    });

    it('daf-lane-mixed-repo: react AND vue in one manifest picks silently', () => {
        // Baseline defect. Priority order resolves the ambiguity instead of
        // surfacing it, so a project that is genuinely both gets one lane and
        // no warning. For a global package, guessing is the worse property —
        // road-to-universal-stack-coverage Phase 1 turns this into a halt.
        const root = projectWith({
            'package.json': { dependencies: { react: '^18', vue: '^3' } },
        });
        expect(detect_stack(root).frontend).toBe('react');
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

    it('the unmodelled lane refuses instead of dispatching', () => {
        const st = new DeliveryState({
            ticket: {},
            stack: { frontend: 'unknown', mtime: 0 },
        } as never);
        const r = applyRun(st);
        expect(r.outcome).toBe('blocked');
        const body = r.questions.join('\n');
        // No directive verb — a refusal, not a delegation.
        expect(body).not.toContain('@agent-directive');
        expect(body).toContain('does not model');
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

    it('a lane with no framework-specific executor says so in the halt', () => {
        const st = new DeliveryState({
            ticket: {},
            stack: { frontend: 'vue', mtime: 0 },
        } as never);
        expect(applyRun(st).questions.join('\n')).toContain('no `vue`-specific executor');
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
