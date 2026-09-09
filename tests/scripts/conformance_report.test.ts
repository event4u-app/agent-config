/**
 * Per-dimension conformance — the corrupted-port discrimination.
 *
 * `road-to-design-intent-conformance` 4.1's verify clause is one sentence and
 * it is a discrimination claim, not a detection claim: *a deliberately
 * corrupted port reds the dimension that was corrupted **and no other***. Half
 * of these cases therefore assert what stays GREEN. A reporter that reds
 * everything on any corruption would pass a detection test and be useless — the
 * reader could not tell from it what to fix.
 *
 * Corruptions are applied to a single artifact string, one dimension at a time,
 * so the only variable between the control and each case is the corruption.
 */
import { describe, expect, it } from 'vitest';

import {
    DIMENSIONS,
    type Dimension,
    behaviourHooks,
    breakpoints,
    buildConformanceReport,
    formatConformanceReport,
    inlineStaticDeclarations,
    structuralCounts,
} from '../../src/scripts/_lib/conformance_report.js';

/**
 * One artifact exercising every dimension at once: landmarks and controls,
 * colours and lengths, a wired interaction, a breakpoint, an inline icon, and
 * no inline static style.
 */
const ARTIFACT = `<!doctype html>
<style>
  :root { --brand: #3b82f6; --ink: #111827; }
  .card { padding: 16px; border-radius: 8px; color: #111827; }
  @media (min-width: 48rem) { .card { padding: 24px; } }
</style>
<main>
  <header><nav><a href="/">Home</a></nav></header>
  <section class="card">
    <svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>
    <form><label for="q">Query</label><input id="q"><button>Go</button></form>
  </section>
  <footer>© 2026</footer>
</main>
<script>
  document.querySelector('button').addEventListener('click', () => {});
  document.querySelector('input').addEventListener('keydown', () => {});
</script>`;

/** A port that restructures nothing and drops nothing. */
const FAITHFUL = ARTIFACT;

const CORRUPTIONS: ReadonlyArray<readonly [Dimension, string]> = [
    // structure — the footer landmark disappears.
    ['structure', ARTIFACT.replace('<footer>© 2026</footer>', '<div>© 2026</div>')],
    // values — the brand colour is swapped for a near neighbour.
    ['values', ARTIFACT.replace(/#3b82f6/g, '#3b82f7')],
    // behaviour — the keyboard interaction is dropped.
    [
        'behaviour',
        ARTIFACT.replace("document.querySelector('input').addEventListener('keydown', () => {});", ''),
    ],
    // responsive — the breakpoint is dropped and its DECLARATION IS KEPT. The
    // first version of this row deleted the whole `@media` block, which also
    // removed `24px` and reddened `values` as well — a corruption that touches
    // two axes cannot test discrimination between them. The fixture was wrong,
    // not the reporter.
    [
        'responsive',
        ARTIFACT.replace(
            '@media (min-width: 48rem) { .card { padding: 24px; } }',
            '.card--wide { padding: 24px; }',
        ),
    ],
    // icons — the inline icon is replaced by a text glyph.
    [
        'icons',
        ARTIFACT.replace('<svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>', '<span>▢</span>'),
    ],
    // carrier — a static declaration is moved INTO a style attribute.
    ['carrier', ARTIFACT.replace('<section class="card">', '<section style="padding: 16px">')],
];

describe('the control', () => {
    it('a faithful port conforms on every dimension', () => {
        const r = buildConformanceReport({ artifact: ARTIFACT, implementation: FAITHFUL });
        expect(r.deviating).toEqual([]);
        expect(r.overall).toBe('conforms');
    });

    it('reports one verdict per declared dimension, in order', () => {
        const r = buildConformanceReport({ artifact: ARTIFACT, implementation: FAITHFUL });
        expect(r.dimensions.map((d) => d.dimension)).toEqual([...DIMENSIONS]);
    });
});

describe('a corrupted port reds the corrupted dimension AND NO OTHER', () => {
    it.each(CORRUPTIONS)('%s', (dimension, corrupted) => {
        const r = buildConformanceReport({ artifact: ARTIFACT, implementation: corrupted });
        expect(r.deviating).toEqual([dimension]);
        expect(r.overall).toBe('deviates');
    });

    it('names both sides on every finding it emits', () => {
        for (const [, corrupted] of CORRUPTIONS) {
            const r = buildConformanceReport({ artifact: ARTIFACT, implementation: corrupted });
            for (const d of r.dimensions) {
                for (const f of d.findings) {
                    // A finding naming only the port is unactionable: the reader
                    // cannot tell a dropped thing from a thing never present.
                    expect(f.artifact).not.toBe('');
                    expect(f.implementation).not.toBe('');
                }
            }
        }
    });
});

describe('a green pixel diff cannot produce a pass', () => {
    // Enforced by construction rather than by policy: pixel is not a dimension,
    // so there is no input through which it could carry a verdict.
    it('pixel is not one of the dimensions', () => {
        expect([...DIMENSIONS]).not.toContain('pixel' as Dimension);
    });

    // The case that motivates the whole module. `port-regenerated`-shaped: a
    // document that renders the same and has dropped an interaction still
    // deviates, because behaviour is scored on its own axis.
    it('a visually identical port that dropped an interaction still deviates', () => {
        const sameLooksNoBehaviour = ARTIFACT.replace(
            "document.querySelector('button').addEventListener('click', () => {});",
            '',
        );
        const r = buildConformanceReport({
            artifact: ARTIFACT,
            implementation: sameLooksNoBehaviour,
        });
        expect(r.overall).toBe('deviates');
        expect(r.deviating).toEqual(['behaviour']);
    });

    it('says on every report what it did not measure', () => {
        const r = buildConformanceReport({ artifact: ARTIFACT, implementation: FAITHFUL });
        expect(formatConformanceReport(r)).toContain('pixel similarity is not a dimension');
    });
});

describe('value rows carry distances regardless of the verdict', () => {
    const TOKENS = [
        { name: 'color.brand', value: '#3b82f7' },
        { name: 'space.4', value: '16px' },
    ];

    it('a conforming port still reports a distance per value', () => {
        const r = buildConformanceReport({
            artifact: ARTIFACT,
            implementation: FAITHFUL,
            tokens: TOKENS,
        });
        const brand = r.values.find((v) => v.artifact === '#3b82f6');
        expect(brand?.distance).toBeGreaterThan(0);
        expect(brand?.resolved).toBe('#3b82f6');
    });

    it('reports no-candidate rather than nothing when the project has no tokens', () => {
        const r = buildConformanceReport({ artifact: ARTIFACT, implementation: FAITHFUL });
        expect(r.values.length).toBeGreaterThan(0);
        expect(r.values.every((v) => v.outcome === 'no-candidate')).toBe(true);
    });
});

describe('the extractors', () => {
    it('counts structural tags and ignores incidental ones', () => {
        const counts = structuralCounts('<main><div><p></p></div><button></button></main>');
        expect(counts.get('main')).toBe(1);
        expect(counts.get('button')).toBe(1);
        expect(counts.has('div')).toBe(false);
    });

    it('reads hooks from listeners and from on* attributes alike', () => {
        expect([...behaviourHooks(`addEventListener('click', f)`)]).toEqual(['click']);
        expect([...behaviourHooks(`<button onclick="f()">`)]).toEqual(['click']);
    });

    // Blind-review regressions, both directions of the same regex.
    it('reads a mixed-case or custom event name', () => {
        expect([...behaviourHooks(`addEventListener('DOMContentLoaded', f)`)]).toEqual([
            'domcontentloaded',
        ]);
        expect([...behaviourHooks(`addEventListener('itemAdded', f)`)]).toEqual(['itemadded']);
    });

    it('does not read an attribute that merely starts with the letters on', () => {
        expect([...behaviourHooks(`<div onboarding="x">`)]).toEqual([]);
    });

    it('reads a single-quoted style attribute and ignores a lookalike one', () => {
        expect(inlineStaticDeclarations(`<div style='width: 40px'>`)).toEqual(['width: 40px']);
        expect(inlineStaticDeclarations(`<div data-style="width: 40px">`)).toEqual([]);
    });

    it('reads min- and max-width breakpoints', () => {
        const bp = breakpoints('@media (min-width: 48rem){} @media (max-width: 600px){}');
        expect(bp).toEqual(new Set(['48rem', '600px']));
    });

    // Regression from a blind review: capturing only the FIRST bound left the
    // second counted as a value, reddening two dimensions for one corruption.
    it('reads BOTH bounds of a compound query', () => {
        const bp = breakpoints('@media (min-width: 48rem) and (max-width: 80rem){}');
        expect(bp).toEqual(new Set(['48rem', '80rem']));
    });

    it('a compound-query bound is not counted as a value', () => {
        const art = '<style>@media (min-width: 48rem) and (max-width: 80rem){.a{color:#111827}}</style>';
        const imp = '<style>.a{color:#111827}</style>';
        expect(buildConformanceReport({ artifact: art, implementation: imp }).deviating).toEqual([
            'responsive',
        ]);
    });

    // The carrier rule's own carve-out: `style=` is legitimate for what only
    // the runtime knows, so a custom property or a var() is not a finding.
    it('does not treat a custom property or a var() as a static declaration', () => {
        expect(inlineStaticDeclarations('<div style="--x: 3">')).toEqual([]);
        expect(inlineStaticDeclarations('<div style="width: var(--w)">')).toEqual([]);
        expect(inlineStaticDeclarations('<div style="width: 40px">')).toEqual(['width: 40px']);
    });
});
