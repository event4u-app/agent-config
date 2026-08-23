/**
 * A1.1-A1.5 behaviour, pinned against the frontend corpus fixtures.
 *
 * Every case name here is a real directory under `tests/eval/frontend-corpus/`,
 * authored and hashed BEFORE this resolver existed (`34f7dc400`). That ordering
 * is the point: the fixtures state what the right answer is, and the resolver is
 * scored against them rather than the reverse.
 */
import { describe, expect, it } from 'vitest';

import {
    DEFAULTS,
    OPERATIONS,
    PRESERVE_DELTA_DIMENSIONS,
    degrade,
    operationConflicts,
    preserveViolations,
    resolveUiAuthority,
    type Signals,
} from './ui_authority.js';

describe('A1.1 — one object, fully populated', () => {
    it('always emits every required field', () => {
        const a = resolveUiAuthority();
        for (const k of [
            'surface_mode',
            'register',
            'change_intent',
            'reference_maturity',
            'primary_source',
            'constraints',
            'conflicts',
            'provenance',
            'verification',
        ]) {
            expect(a).toHaveProperty(k);
        }
        expect(a.verification).toBe('verified');
    });

    it('records provenance for every resolved field, so a wrong answer is traceable', () => {
        const a = resolveUiAuthority({ brief: { register: 'brand', path: 'brief.md' } });
        expect(a.provenance.map((p) => p.field)).toEqual(
            expect.arrayContaining(['surface_mode', 'register', 'change_intent', 'reference_maturity']),
        );
        expect(a.provenance.find((p) => p.field === 'register')).toMatchObject({
            source: 'surface-brief',
            detail: 'brief.md',
        });
    });

    it('carries fidelity_mandate rather than deriving one', () => {
        expect(resolveUiAuthority({ fidelity_mandate: 'phase-0-output' }).fidelity_mandate).toBe('phase-0-output');
        expect(resolveUiAuthority().fidelity_mandate).toBeNull();
    });
});

describe('A1.2 — explicit user authority wins; quoted text does not', () => {
    it('cases/explicit-redesign: the user’s change_intent beats every inference', () => {
        const a = resolveUiAuthority({
            user: { change_intent: 'redesign', register: 'brand', surface_mode: 'persuade' },
            incumbent: { coherent: true },
        });
        expect(a.change_intent).toBe('redesign');
        expect(a.provenance.find((p) => p.field === 'change_intent')?.source).toBe('user-instruction');
    });

    it('quoted text inside a supplied document is data, not authorisation', () => {
        const quoted: Signals = {
            user: { change_intent: 'redesign', register: 'brand', quoted: true },
            incumbent: { coherent: true },
        };
        const a = resolveUiAuthority(quoted);
        // The incumbent wins, exactly as if the quoted directive were absent.
        expect(a.change_intent).toBe('extend');
        expect(a.provenance.find((p) => p.field === 'change_intent')?.source).toBe('incumbent-scan');
    });

    it('a registered hard constraint outranks a user release', () => {
        const a = resolveUiAuthority({
            user: { change_intent: 'redesign' },
            hard_constraints: ['preserve_palette'],
        });
        expect(a.constraints.preserve_palette).toBe(true);
    });
});

describe('A1.3 — a missing DESIGN.md is not new-world', () => {
    it('cases/no-design-md-coherent-incumbent resolves extend with incumbent authority', () => {
        const a = resolveUiAuthority({
            incumbent: { coherent: true, type_families: ['ibm plex sans'] },
            design_md: { present: false },
        });
        expect(a.change_intent).toBe('extend');
        expect(a.primary_source.kind).toBe('incumbent');
        // The provenance assertion is load-bearing, not decoration. `extend` is
        // ALSO the declared default, so a value-only assertion cannot tell
        // "resolved from the coherent incumbent" from "fell through to the
        // default". A sabotage probe that disabled the A1.3 branch left this
        // test green until the source was asserted.
        expect(a.provenance.find((p) => p.field === 'change_intent')).toMatchObject({
            source: 'incumbent-scan',
            detail: expect.stringContaining('A1.3'),
        });
    });

    it('cases/greenfield — genuinely empty resolves new-world', () => {
        expect(resolveUiAuthority({ design_md: { present: false } }).change_intent).toBe('new-world');
    });

    it('an incoherent incumbent falls to the declared default, not to new-world', () => {
        const a = resolveUiAuthority({ incumbent: { coherent: false } });
        expect(a.change_intent).toBe(DEFAULTS.change_intent);
        expect(a.change_intent).not.toBe('new-world');
        // Same discriminator in the other direction: this one MUST read
        // `default`, so the pair separates the two paths that both yield
        // `extend`.
        expect(a.provenance.find((p) => p.field === 'change_intent')?.source).toBe('default');
    });
});

describe('A1.4 / A2.1 — surface-local stays local', () => {
    it('near-miss/surface-mode-not-product-mode: the brief outranks PRODUCT.md', () => {
        const a = resolveUiAuthority({
            brief: { surface_mode: 'persuade', register: 'brand', path: 'brief.md' },
            product_md: { present: true, register: 'product' },
            incumbent: { coherent: true },
        });
        expect(a.surface_mode).toBe('persuade');
        expect(a.register).toBe('brand');
        expect(a.provenance.find((p) => p.field === 'register')?.source).toBe('surface-brief');
    });

    it('PRODUCT.md never supplies surface_mode — only the brief or the user does', () => {
        const a = resolveUiAuthority({ product_md: { present: true, register: 'product' } });
        expect(a.provenance.find((p) => p.field === 'surface_mode')?.source).toBe('default');
    });
});

describe('A1.5 — the intent-aware gate, against the pre-registered threshold', () => {
    const incumbent = {
        palette: ['#16181d', '#ffffff', '#5b616b', '#e3e5e9'],
        type_families: ['newsreader', 'inter'],
    };

    it('near-miss/refine-preserves-world: a palette delta under preserve blocks', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' }, incumbent: { coherent: true } });
        const v = preserveViolations(a, incumbent, { palette: ['#16181d', '#ff6a3d'], type_families: ['newsreader'] });
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('palette');
        expect(v[0]).toContain('#ff6a3d');
    });

    it('a type-family delta under preserve blocks', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' } });
        const v = preserveViolations(a, incumbent, { palette: [], type_families: ['fraunces'] });
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('type_family');
    });

    it('near-miss/refine-preserves-world: spacing-only refinement does NOT block', () => {
        // The whole point of the verb. Spacing, rhythm, weight and size are
        // outside the threshold, so a refine that touches only those passes.
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' }, incumbent: { coherent: true } });
        expect(preserveViolations(a, incumbent, incumbent)).toEqual([]);
    });

    it('cases/explicit-redesign: the same delta under redesign does NOT block', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'redesign' } });
        expect(preserveViolations(a, incumbent, { palette: ['#ff6a3d'], type_families: ['fraunces'] })).toEqual([]);
    });

    it('transparent / currentColor / inherit are never a palette delta', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' } });
        expect(
            preserveViolations(a, incumbent, {
                palette: ['transparent', 'currentColor', 'inherit'],
                type_families: [],
            }),
        ).toEqual([]);
    });

    it('the threshold covers exactly the two pre-registered dimensions', () => {
        expect([...PRESERVE_DELTA_DIMENSIONS]).toEqual(['palette', 'type_family']);
    });
});

describe('A4.1 — six operations as one field, with a conflict path', () => {
    it('exposes exactly the six the step names', () => {
        expect(Object.keys(OPERATIONS).sort()).toEqual([
            'bolder',
            'clarify',
            'distill',
            'harden',
            'polish',
            'quieter',
        ]);
    });

    it('bolder under preserve surfaces a conflict instead of mutating', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' } });
        const c = operationConflicts(a, 'bolder');
        expect(c.length).toBeGreaterThan(0);
        expect(c.map((x) => x.dimension).sort()).toEqual(['palette', 'type_family']);
        expect(c[0]!.blocked_by).toMatch(/^preserve_/);
    });

    it('polish under preserve is clean — it touches no locked dimension', () => {
        const a = resolveUiAuthority({ user: { change_intent: 'preserve' } });
        expect(operationConflicts(a, 'polish')).toEqual([]);
    });

    it('bolder under redesign is clean', () => {
        expect(operationConflicts(resolveUiAuthority({ user: { change_intent: 'redesign' } }), 'bolder')).toEqual([]);
    });
});

describe('graft 2 — a pass that could not run says so', () => {
    it('degrade carries a reason', () => {
        const d = degrade(resolveUiAuthority(), 'render artefact absent');
        expect(d.verification).toBe('degraded');
        expect(d.degradation_reason).toBe('render artefact absent');
    });

    it('refuses a reason-free degrade by construction', () => {
        expect(() => degrade(resolveUiAuthority(), '   ')).toThrow(/non-empty degradation_reason/);
    });

    it('supports unverified as a distinct state', () => {
        expect(degrade(resolveUiAuthority(), 'no host capability', 'unverified').verification).toBe('unverified');
    });
});

describe('reference maturity — the wireframe trap', () => {
    it('cases/wireframe: a wireframe is recorded as structure, never as a pixel mandate', () => {
        const a = resolveUiAuthority({ reference: { maturity: 'wireframe', path: 'wireframe.md' } });
        expect(a.reference_maturity).toBe('wireframe');
        // `brief`, not `comp`: a wireframe does not become the visual source.
        expect(a.primary_source.kind).toBe('brief');
    });

    it('cases/supplied-runnable-html: a runnable artifact IS the source', () => {
        const a = resolveUiAuthority({ reference: { maturity: 'runnable-artifact', path: 'design.html' } });
        expect(a.primary_source).toStrictEqual({ kind: 'artifact', path: 'design.html' });
    });

    it('cases/supplied-finished-comp: a comp is translated, not adopted as code', () => {
        const a = resolveUiAuthority({ reference: { maturity: 'finished-comp', path: 'HANDOVER.md' } });
        expect(a.primary_source.kind).toBe('comp');
    });
});
