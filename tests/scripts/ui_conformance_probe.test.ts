/**
 * Fixture test for `ui_conformance_probe` — Phase 2.4 and Phase 3 of
 * `road-to-behaviour-evidence-over-pixels`.
 *
 * TWO LAYERS, ON PURPOSE. The detection logic runs over FROZEN observation
 * records captured from a real Chromium run and committed beside the fixture, so
 * CI — which installs no browser binaries — exercises the real comparison rather
 * than skipping it. A browser-gated block then re-captures those observations
 * live and asserts they still match the frozen ones, which is what keeps the
 * frozen records from quietly going stale. Without that second layer the frozen
 * fixture would be a recording of a claim rather than evidence for it.
 *
 * The degrade path is asserted POSITIVELY and always runs: a host with no
 * browser must produce not-applicable rows carrying reasons, and no dimension
 * may read zero findings because it did not run.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DIMENSIONS,
    captureVariant,
    chromiumAvailable,
    evaluate,
    loadDeclarations,
    readObservation,
    unavailableArtefact,
} from '../../src/scripts/ui_conformance_probe.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FIXTURE = path.join(ROOT, 'tests', 'design-artifacts', 'fixtures', 'ui-conformance');
const OBS = path.join(FIXTURE, 'observations');

const reference = () => readObservation(path.join(OBS, 'reference.json'));
const defects = () => readObservation(path.join(OBS, 'variant-defects.json'));
const renamed = () => readObservation(path.join(OBS, 'variant-renamed.json'));
const declarations = () => loadDeclarations(path.join(FIXTURE, 'variant-defects', 'conformance.declared.json'));

describe('ui_conformance_probe — the frozen fixture', () => {
    it('finds four of four planted defects, one per intended dimension', () => {
        const artefact = evaluate(reference(), defects(), declarations());
        const byDimension = new Map<string, number>();
        for (const f of artefact.findings) byDimension.set(f.dimension, (byDimension.get(f.dimension) ?? 0) + 1);

        // D4 missing element, D1 hover colour + D3 dead handler, D2 media rule.
        expect(byDimension.get('structure')).toBe(1);
        expect(byDimension.get('interaction')).toBe(2);
        expect(byDimension.get('viewport_matrix')).toBe(1);
        expect(artefact.findings).toHaveLength(4);

        // Each planted defect is identified by the node it was planted on, so a
        // count of four cannot be reached by four findings about one element.
        const ids = artefact.findings.map((f) => `${f.dimension}:${f.probe_id}`).sort();
        expect(ids).toEqual([
            'interaction:toggle',
            'interaction:toggle',
            'structure:status-badge',
            'viewport_matrix:toolbar',
        ]);
    });

    it('raises nothing for the declared deviation', () => {
        const artefact = evaluate(reference(), defects(), declarations());
        expect(artefact.findings.filter((f) => f.probe_id === 'body')).toEqual([]);
        expect(artefact.declared_suppressed).toHaveLength(1);
        expect(artefact.declared_suppressed[0]).toMatchObject({ probe_id: 'body', property: 'line-height' });
    });

    it('would report the declared deviation if it were not declared', () => {
        // Sensitivity: the suppression must be doing the work, not the absence of
        // a difference. With no declaration file the same run raises it.
        const artefact = evaluate(reference(), defects(), []);
        const body = artefact.findings.filter((f) => f.probe_id === 'body');
        expect(body).toHaveLength(1);
        expect(body[0]!.dimension).toBe('computed_style');
    });

    it('stops at structure on the renamed variant, with zero style findings', () => {
        const artefact = evaluate(reference(), renamed(), []);
        expect(artefact.structure_gate).toBe('stopped');
        expect(artefact.findings.every((f) => f.dimension === 'structure')).toBe(true);
        expect(artefact.findings).toHaveLength(1);
        expect(artefact.findings[0]!.probe_id).toBe('status-badge');

        // The point of the gate: no style finding is invented against a node that
        // merely sits where the renamed one used to.
        for (const d of ['computed_style', 'interaction', 'viewport_matrix', 'media_emulation'] as const) {
            expect(artefact.findings.filter((f) => f.dimension === d)).toEqual([]);
        }
    });

    it('reports a clean reference-against-itself run — the false-positive reading', () => {
        const artefact = evaluate(reference(), reference(), []);
        expect(artefact.findings).toEqual([]);
        expect(artefact.structure_gate).toBe('passed');
    });
});

describe('ui_conformance_probe — Phase 3 state and breakpoint sensitivity', () => {
    it('turns exactly the hover state red when one hover rule is removed', () => {
        const artefact = evaluate(reference(), defects(), declarations());
        const hover = artefact.findings.filter((f) => f.state === 'hover');
        expect(hover).toHaveLength(1);
        expect(hover[0]!.probe_id).toBe('toggle');
        // Focus, active, keyboard and reduced-motion are unaffected by D1.
        for (const s of ['focus', 'keyboard', 'reduced-motion'] as const) {
            expect(artefact.findings.filter((f) => f.state === s)).toEqual([]);
        }
    });

    it('turns exactly the matching breakpoint row red when one media rule is removed', () => {
        const artefact = evaluate(reference(), defects(), declarations());
        const rows = artefact.findings.filter((f) => f.dimension === 'viewport_matrix');
        expect(rows).toHaveLength(1);
        expect(rows[0]!.state).toBe('375');
        expect(rows[0]!.probe_id).toBe('toolbar');
    });
});

describe('ui_conformance_probe — honest degrade', () => {
    it('emits a not-applicable row with a reason for every dimension, and never a zero count', () => {
        const artefact = unavailableArtefact('tests/fixture/index.html', 'no browser binary on this host');
        expect(artefact.dimensions).toHaveLength(DIMENSIONS.length);
        for (const row of artefact.dimensions) {
            expect(row.status).toBe('not_applicable');
            // The load-bearing assertion: null, never 0. A zero reads as "ran and
            // found nothing", which is the fabricated green this contract exists
            // to prevent.
            expect(row.findings).toBeNull();
            expect(typeof row.reason).toBe('string');
            expect((row.reason ?? '').length).toBeGreaterThan(10);
        }
        expect(artefact.host_class).toBe('unknown');
    });

    it('never emits a scalar aggregate anywhere in the artefact', () => {
        const artefact = evaluate(reference(), defects(), declarations());
        const keys = new Set<string>();
        const walk = (v: unknown): void => {
            if (Array.isArray(v)) return v.forEach(walk);
            if (v && typeof v === 'object') {
                for (const [k, inner] of Object.entries(v)) {
                    keys.add(k);
                    walk(inner);
                }
            }
        };
        walk(artefact);
        for (const k of keys) {
            // `rate` is anchored to a word boundary on purpose: an unanchored
            // match fires on `generated_at`, which is not an aggregate.
            expect(k).not.toMatch(/score|percent|fidelity|(^|_)rate(_|$)/i);
        }
    });

    it('carries no aggregate in the source either', () => {
        const src = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'ui_conformance_probe.ts'), 'utf-8');
        // The roadmap's own verify line for Phase 2.3.
        expect(src).not.toMatch(/score|percent|%/);
    });
});

describe('ui_conformance_probe — the frozen records are still true', () => {
    const live = chromiumAvailable();

    it.skipIf(!live)('re-captures the fixture live and matches the committed observations', async () => {
        for (const variant of ['reference', 'variant-defects', 'variant-renamed'] as const) {
            const fresh = await captureVariant(path.join(FIXTURE, variant, 'index.html'));
            const frozen = readObservation(path.join(OBS, `${variant}.json`));
            expect(fresh.nodes, `${variant} drifted from its frozen observation`).toEqual(frozen.nodes);
        }
    }, 120_000);

    it('records whether the live layer ran, so a skip is visible rather than silent', () => {
        // Not an assertion about the host — an assertion that the host question
        // was asked and answered. In CI this is false and the block above is
        // skipped; the frozen records still carry the detection assertions.
        expect(typeof live).toBe('boolean');
    });
});
