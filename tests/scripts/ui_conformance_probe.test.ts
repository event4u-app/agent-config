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
import {
    INPUTS_SCHEMA,
    INPUT_KEYS,
    PROBE_VERSION,
    compareInputs,
} from '../../src/scripts/_lib/probe_inputs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FIXTURE = path.join(ROOT, 'tests', 'design-artifacts', 'fixtures', 'ui-conformance');
const OBS = path.join(FIXTURE, 'observations');

const reference = () => readObservation(path.join(OBS, 'reference.json'));
const defects = () => readObservation(path.join(OBS, 'variant-defects.json'));
const renamed = () => readObservation(path.join(OBS, 'variant-renamed.json'));
const noHandles = () => readObservation(path.join(OBS, 'reference-no-handles.json'));
const added = () => readObservation(path.join(OBS, 'variant-added.json'));
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
        // BOTH halves of the rename, since `road-to-a-probe-that-cannot-report-a-
        // false-green`. A rename is an omission AND an addition; the probe could
        // previously see only the omission, and reported one finding here.
        expect(artefact.findings).toHaveLength(2);
        expect(artefact.findings.map((f) => f.probe_id).sort()).toEqual(['status-badge', 'status-chip']);
        expect(artefact.findings.find((f) => f.probe_id === 'status-badge')).toMatchObject({
            expected: 'present',
            observed: 'absent',
        });
        expect(artefact.findings.find((f) => f.probe_id === 'status-chip')).toMatchObject({
            expected: 'absent',
            observed: 'present',
        });

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

describe('ui_conformance_probe — an empty comparison reports as empty', () => {
    // AC-1 of `road-to-a-probe-that-cannot-report-a-false-green`. Before that
    // roadmap this exact input returned five `exercised` rows with `findings: 0`
    // and `structure_gate: "passed"` — a comparison that never happened,
    // reported as a clean one, which the probe's own header (`:29`) forbids.

    it('never reports an exercised dimension when the reference collected zero nodes', () => {
        const artefact = evaluate(noHandles(), noHandles(), []);
        expect(artefact.dimensions).toHaveLength(DIMENSIONS.length);
        for (const row of artefact.dimensions) {
            expect(row.status).toBe('not_applicable');
            expect(row.findings).toBeNull();
        }
        expect(artefact.structure_gate).toBe('stopped');
        expect(artefact.findings).toEqual([]);
    });

    it('blames the handover, not the host, so the reading is actionable', () => {
        // Risk 1 of the roadmap: reusing the not-applicable shape for a second
        // cause makes the two indistinguishable unless the reason differs in the
        // one field a reader looks at. An operator who reads "no browser" goes
        // looking for a missing binary instead of fixing the handover.
        const empty = evaluate(noHandles(), noHandles(), []);
        const noBrowser = unavailableArtefact('x/index.html', 'no browser binary on this host');
        for (const row of empty.dimensions) {
            expect(row.reason ?? '').toMatch(/data-probe-id/);
            expect(row.reason ?? '').not.toMatch(/browser/i);
        }
        for (const row of noBrowser.dimensions) {
            expect(row.reason ?? '').toMatch(/browser/i);
        }
    });

    it('fires on the reference side only — a target with no handles is a structure failure, not a stop', () => {
        // Sensitivity: the branch must key on the REFERENCE being empty. A target
        // that collected nothing is a real comparison whose every node is missing,
        // and collapsing it into not-applicable would hide four real findings.
        const artefact = evaluate(reference(), { variant: 'empty-target', source: 'x', nodes: [] }, []);
        expect(artefact.dimensions.every((r) => r.status === 'exercised')).toBe(true);
        expect(artefact.findings.length).toBe(reference().nodes.length);
        expect(artefact.findings.every((f) => f.dimension === 'structure')).toBe(true);
    });

    it('carries the node counts each side actually observed', () => {
        // AC-3's additive half, and the readable form of the cause: an operator
        // who never reads the reason string still sees `reference_nodes: 0`.
        const empty = evaluate(noHandles(), noHandles(), []);
        expect(empty.reference_nodes).toBe(0);
        expect(empty.target_nodes).toBe(0);

        const real = evaluate(reference(), defects(), declarations());
        expect(real.reference_nodes).toBe(reference().nodes.length);
        expect(real.target_nodes).toBe(defects().nodes.length);
        expect(real.reference_nodes).not.toBe(real.target_nodes);
    });

    it('reports the counts as null, never 0, where nothing was observed at all', () => {
        // Same contract the dimension rows carry: a 0 here would read as "looked
        // and saw none", and the no-browser path never looked.
        const artefact = unavailableArtefact('x/index.html', 'no browser binary on this host');
        expect(artefact.reference_nodes).toBeNull();
        expect(artefact.target_nodes).toBeNull();
    });

    it('carries exactly the promised field set and no more', () => {
        // AC-3: the artefact grows only by fields a downstream reader was
        // promised. This branch adds the two node counts; `inputs` arrived
        // separately on main (the probe-inputs digests) and is listed here
        // because it IS promised — the merge is where the two additions met,
        // and an exhaustive list is the only shape that catches a third,
        // unannounced field.
        const artefact = evaluate(reference(), defects(), declarations());
        expect(Object.keys(artefact).sort()).toEqual(
            [
                'declared_suppressed',
                'dimensions',
                'findings',
                'generated_at',
                'host_class',
                'inputs',
                'reference',
                'reference_nodes',
                'schema',
                'structure_gate',
                'target',
                'target_nodes',
                'unmatched_nodes',
            ].sort(),
        );
    });
});

describe('ui_conformance_probe — additions are findings', () => {
    // AC-2. `src/rules/design-fidelity.md`'s Iron Law says "never omit or add an
    // element"; only the omit half was observable before this roadmap.

    it('turns exactly one structure row red for a target handle the reference lacks', () => {
        const artefact = evaluate(reference(), added(), []);
        const structure = artefact.findings.filter((f) => f.dimension === 'structure');
        expect(structure).toHaveLength(1);
        expect(structure[0]).toMatchObject({
            probe_id: 'extra-badge',
            expected: 'absent',
            observed: 'present',
        });
    });

    it('leaves every other dimension at zero for the same case', () => {
        const artefact = evaluate(reference(), added(), []);
        for (const d of ['computed_style', 'interaction', 'viewport_matrix', 'media_emulation'] as const) {
            expect(artefact.findings.filter((f) => f.dimension === d)).toEqual([]);
        }
        expect(artefact.findings).toHaveLength(1);
    });

    it('stops the structure gate, because an added node has nothing to be compared against', () => {
        const artefact = evaluate(reference(), added(), []);
        expect(artefact.structure_gate).toBe('stopped');
        // `unmatched_nodes` keeps its reference-side meaning — the nodes whose
        // STYLE comparison was skipped. An added node was never going to be
        // compared, so it does not belong in that list.
        expect(artefact.unmatched_nodes).toEqual([]);
        expect(artefact.target_nodes).toBe(reference().nodes.length + 1);
    });

    it('still reports a clean run when the two sides carry the same handles', () => {
        // Sensitivity in the other direction: the addition sweep must not fire on
        // a matched node. Without this, "exactly one finding" above could be
        // satisfied by a probe that reds on everything.
        const artefact = evaluate(reference(), reference(), []);
        expect(artefact.findings).toEqual([]);
        expect(artefact.structure_gate).toBe('passed');
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
        for (const variant of [
            'reference',
            'variant-defects',
            'variant-renamed',
            'reference-no-handles',
            'variant-added',
        ] as const) {
            const fresh = await captureVariant(path.join(FIXTURE, variant, 'index.html'));
            const frozen = readObservation(path.join(OBS, `${variant}.json`));
            expect(fresh.nodes, `${variant} drifted from its frozen observation`).toEqual(frozen.nodes);
        }
    }, 300_000);

    it('records whether the live layer ran, so a skip is visible rather than silent', () => {
        // Not an assertion about the host — an assertion that the host question
        // was asked and answered. In CI this is false and the block above is
        // skipped; the frozen records still carry the detection assertions.
        expect(typeof live).toBe('boolean');
    });
});

describe('the artefact knows what it read — Phase 1', () => {
    it('every artefact carries an inputs block with all three keys', () => {
        const artefact = evaluate(reference(), defects(), declarations());
        expect(artefact.inputs.schema).toBe(INPUTS_SCHEMA);
        expect(artefact.inputs.probe).toBe(PROBE_VERSION);
        for (const key of INPUT_KEYS) {
            // A silently missing key is the failure 1.2 exists to prevent, so
            // presence is asserted per key rather than by a whole-shape match.
            expect(artefact.inputs[key], `inputs.${key}`).toBeDefined();
            expect(artefact.inputs[key].state).toMatch(/^(read|absent)$/);
        }
        expect(artefact.inputs.target.digest).toMatch(/^sha256:/);
        expect(artefact.inputs.reference.digest).toMatch(/^sha256:/);
    });

    it('two evaluations over unchanged inputs agree on every digest', () => {
        // `generated_at` differs between the two and the digests must not — that
        // separation is the whole reason for recording both.
        const a = evaluate(reference(), defects(), declarations());
        const b = evaluate(reference(), defects(), declarations());
        // Presence asserted before equality. A sensitivity probe that deleted the
        // block entirely left this test GREEN without it — `undefined` equals
        // `undefined` — which made the assertion true and worthless.
        expect(a.inputs).toBeDefined();
        expect(a.inputs).toStrictEqual(b.inputs);
    });

    it('the degraded artefact records its inputs too, rather than omitting them', () => {
        // An artefact with no inputs block reads to the design-pass hook as a
        // version skew, which is a weaker and different statement than "this
        // host could not run a browser".
        const a = unavailableArtefact(
            path.relative(ROOT, path.join(FIXTURE, 'variant-defects', 'index.html')),
            'no browser on this host',
        );
        for (const key of INPUT_KEYS) expect(a.inputs[key], `inputs.${key}`).toBeDefined();
        expect(a.inputs.reference.state).toBe('absent');
        expect(a.inputs.reference.reason).toBeTruthy();
    });

    it('the reader can compare the block the probe just wrote', () => {
        // Producer and consumer in one assertion: a round trip through the real
        // comparison, not a hand-built fixture that only resembles one.
        const artefact = evaluate(reference(), defects(), declarations());
        expect(compareInputs(artefact.inputs, (p) => p).verdict).toBe('unchanged');
    });
});
