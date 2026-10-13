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
    LEAF_KINDS,
    PAGE_SIGNATURE_SCOPE,
    VIEWPORTS,
    type WidthReading,
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
            'variant-no-handles-declared',
            'variant-no-handles-media-rule',
            'variant-no-handles-removed',
            'reference-boxless',
            'variant-boxless',
        ] as const) {
            const fresh = await captureVariant(path.join(FIXTURE, variant, 'index.html'));
            const frozen = readObservation(path.join(OBS, `${variant}.json`));
            expect(fresh.nodes, `${variant} drifted from its frozen observation`).toEqual(frozen.nodes);
            // The signature is frozen on exactly the same terms as the nodes: CI
            // installs no browser, so the committed record IS the evidence, and a
            // record nothing re-measures is a recording of a claim.
            expect(fresh.signature, `${variant} signature drifted`).toEqual(frozen.signature);
        }

        // The port pair lives one directory up and carries no handle, so `nodes`
        // is empty on both sides and the signature is the only thing to compare —
        // which is the point: these three files are the whole evidence base for
        // the faithful-port control, and a stale record of them would make that
        // control a recording of a claim rather than evidence for it.
        for (const name of ['design', 'port-faithful', 'port-regenerated'] as const) {
            const fresh = await captureVariant(path.join(FIXTURE, '..', `${name}.html`));
            const frozen = readObservation(path.join(OBS, `${name}.json`));
            expect(fresh.nodes).toEqual([]);
            expect(fresh.signature, `${name} signature drifted`).toEqual(frozen.signature);
        }
    }, 600_000);

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

describe('the structure reading without handles — Phase 1, registered before the code', () => {
    // Phase 1.1 and 1.2 of `road-to-a-structure-reading-without-handles`. Both
    // tests were written BEFORE the capture learned to record a signature, so
    // what they assert is a prediction rather than a transcription.

    const SIGNATURE_VARIANTS = [
        'variant-no-handles-declared',
        'variant-no-handles-media-rule',
        'variant-no-handles-removed',
    ] as const;

    it('no-handles-control: the five dimension rows stay not-applicable and no row is added', () => {
        // THE CONTROL EVERY LATER STEP FLIPS OR KEEPS, and it is the keeping half
        // that matters. A reading for a handle-free handover is worth having only
        // if it costs nothing that already works: the zero-nodes invariant of
        // `road-to-a-probe-that-cannot-report-a-false-green` says no dimension may
        // be exercised on zero nodes, and this asserts the new reading did not
        // quietly become a sixth dimension that violates it.
        const artefact = evaluate(noHandles(), noHandles(), []);

        expect(artefact.dimensions).toHaveLength(DIMENSIONS.length);
        expect(artefact.dimensions.map((r) => r.dimension).sort()).toEqual([...DIMENSIONS].sort());
        for (const row of artefact.dimensions) {
            expect(row.status).toBe('not_applicable');
            expect(row.findings).toBeNull();
        }
        expect(artefact.findings).toEqual([]);
        expect(artefact.structure_gate).toBe('stopped');
        expect(artefact.reference_nodes).toBe(0);
    });

    it('signature-fixture-variants-exist: three single-change variants sit beside the existing ones', () => {
        // Phase 1.2. Each variant differs from `reference-no-handles/` in exactly
        // one file and in one way. A fixture that drifted into carrying two
        // changes would let a reading claim a defect it had not isolated, so the
        // single-change property is asserted rather than described.
        const refDir = path.join(FIXTURE, 'reference-no-handles');
        const read = (dir: string, file: string): string => fs.readFileSync(path.join(dir, file), 'utf-8');

        for (const variant of SIGNATURE_VARIANTS) {
            const dir = path.join(FIXTURE, variant);
            expect(fs.existsSync(dir), `${variant} is missing`).toBe(true);
            for (const file of ['index.html', 'styles.css', 'app.js']) {
                expect(fs.existsSync(path.join(dir, file)), `${variant}/${file}`).toBe(true);
            }
            // The behaviour file never differs: every one of the three is a
            // structural or stylistic change, and a script difference would make
            // the variant a second question.
            expect(read(dir, 'app.js'), `${variant}/app.js`).toBe(read(refDir, 'app.js'));
            // And none carries a handle: the reading under test applies only where
            // the reference collected none, so a variant that grew one would
            // silently move the comparison onto the five dimensions instead.
            //
            // Matched on the ATTRIBUTE form, not on the name. The first version of
            // this assertion grepped the bare token and failed on the fixture's own
            // comment, which names the attribute to explain why there is none —
            // a true report of the wrong thing. An attribute is an `=` away from a
            // mention, and only the former is a handle.
            expect(read(dir, 'index.html')).not.toMatch(/data-probe-id\s*=/);
        }

        // Declared deviation: the stylesheet moved, the markup did not.
        const declared = path.join(FIXTURE, 'variant-no-handles-declared');
        expect(read(declared, 'styles.css')).toMatch(/line-height: 28px/);
        expect(read(declared, 'styles.css')).not.toMatch(/line-height: 24px/);

        // Missing media block: the narrow-width rule is gone, nothing else is.
        const media = path.join(FIXTURE, 'variant-no-handles-media-rule');
        expect(read(refDir, 'styles.css')).toMatch(/max-width: 480px/);
        expect(read(media, 'styles.css')).not.toMatch(/max-width: 480px/);
        expect(read(media, 'styles.css')).toMatch(/line-height: 24px/);

        // Removed element: the markup lost the badge, the stylesheet is identical.
        const removed = path.join(FIXTURE, 'variant-no-handles-removed');
        expect(read(refDir, 'index.html')).toMatch(/class="badge"/);
        expect(read(removed, 'index.html')).not.toMatch(/class="badge"/);
        expect(read(removed, 'styles.css')).toBe(read(refDir, 'styles.css'));
    });

    it('signature-captured-at-four-widths: every committed observation carries a reading at each width', () => {
        // Phase 2.1. The sweep moved OUT of the per-handle loop, which is the one
        // structural thing the capture change does: every width sweep this file
        // had lived inside that loop, so a page with no handles was never resized
        // and the capture of the commonest input in the tree consisted of opening
        // the page and closing it. A record whose `nodes` is empty and whose
        // `signature` is full is the proof the sweep is no longer gated on a
        // handle, and it is asserted on the HANDLE-FREE records specifically.
        const handleFree = ['reference-no-handles', 'design', 'port-faithful', 'port-regenerated'];
        for (const name of handleFree) {
            const obs = readObservation(path.join(OBS, `${name}.json`));
            expect(obs.nodes, `${name} is supposed to carry no handle`).toEqual([]);
            const sig = obs.signature;
            expect(sig, `${name} carries no signature`).toBeDefined();
            expect(Object.keys(sig ?? {}).sort()).toEqual([...VIEWPORTS].map(String).sort());
            for (const w of VIEWPORTS) {
                const row = (sig ?? {})[String(w)];
                expect(row, `${name} at ${w}`).toBeDefined();
                // Every kind present, including the zeroes: an absent key and a
                // zero would be read the same way by a diff, and only one of them
                // is honest about a page that has no media at all.
                expect(Object.keys(row!.leaves).sort()).toEqual([...LEAF_KINDS].sort());
                for (const k of LEAF_KINDS) expect(typeof row!.leaves[k]).toBe('number');
                expect(typeof row!.overflow).toBe('boolean');
                for (const key of Object.keys(row!.arrangement)) {
                    expect(key, `${name} at ${w} carries a malformed arrangement key`).toMatch(
                        /^[0-9]+:(row|column|mixed)$/,
                    );
                }
            }
        }

        // NO COORDINATE AND NO SIZE REACHES THE RECORD. The boxes are read to
        // decide row from column and then dropped; a serialized signature that
        // contained a pixel value would make this reading a size comparison by
        // accident, which is the thing D1 rejected.
        const raw = fs.readFileSync(path.join(OBS, 'design.json'), 'utf-8');
        const signatureBlock = JSON.stringify(readObservation(path.join(OBS, 'design.json')).signature);
        expect(raw.length).toBeGreaterThan(0);
        expect(signatureBlock).not.toMatch(/px|width"\s*:\s*[0-9]+\.|top|left|bottom|right/);

        // The width sweep reaches a page WITH handles too — it is not a
        // handle-free special case, it is unconditional.
        expect(readObservation(path.join(OBS, 'reference.json')).signature).toBeDefined();
    });

    it('signature-absent-is-not-available: a record without the field yields not-available, never no-change', () => {
        // Phase 2.2 and Risk 4. `legacy-no-signature.json` is the committed
        // pre-change record of `reference-no-handles`, taken from git rather than
        // hand-written, so the positive control is a real artefact of the state
        // this branch migrates from and not a mock that resembles one.
        const legacy = readObservation(path.join(OBS, 'legacy-no-signature.json'));
        expect(legacy.signature).toBeUndefined();

        const fresh = readObservation(path.join(OBS, 'reference-no-handles.json'));
        expect(fresh.signature).toBeDefined();

        // Either side missing it is enough to withhold the reading. Asserted in
        // both directions because a reader that checked only the reference would
        // report "no change" for a target captured by an older probe, which is
        // the fabricated green this whole artefact refuses elsewhere.
        for (const [a, b] of [
            [legacy, fresh],
            [fresh, legacy],
            [legacy, legacy],
        ] as const) {
            const artefact = evaluate(a, b, []);
            expect(artefact.page_signature?.status).toBe('not_available');
            expect(artefact.page_signature?.widths).toEqual([]);
            expect(artefact.page_signature?.reason ?? '').toMatch(/signature/);
        }

        // Sensitivity in the other direction: with both sides carrying the field
        // the same call reads it rather than withholding it. Without this, the
        // assertions above are satisfied by a probe that never reads a signature.
        expect(evaluate(fresh, fresh, []).page_signature?.status).toBe('read');
    });

    it('signature-fixture-variants-exist: the README registers a reading for each of them', () => {
        // A fixture whose expected reading lives only in a test is a fixture whose
        // prediction can be edited to match the code. The README is where the
        // registration is auditable without reading the assertions.
        const readme = fs.readFileSync(path.join(FIXTURE, 'README.md'), 'utf-8');
        for (const variant of SIGNATURE_VARIANTS) {
            expect(readme, `README does not register ${variant}`).toMatch(variant);
        }
        expect(readme).toMatch(/Registered table/);
        expect(readme).toMatch(/Masking reads as absence/);
        expect(readme).toMatch(/Behaviour produces nothing/);
    });
});

describe('the structure reading without handles — Phase 3, a field beside the five rows', () => {
    const obs = (name: string) => readObservation(path.join(OBS, `${name}.json`));

    /** The reading for one pair, as the artefact carries it, keyed by width. */
    const reading = (ref: string, tgt: string): Record<string, WidthReading> => {
        const field = evaluate(obs(ref), obs(tgt), []).page_signature;
        expect(field?.status, `${ref} to ${tgt}`).toBe('read');
        return Object.fromEntries((field?.widths ?? []).map((w) => [w.width, w]));
    };

    const leafChanges = (w: WidthReading): string[] =>
        w.leaves.map((l) => `${l.kind} ${l.reference}->${l.target}`).sort();
    const arrangementChanges = (w: WidthReading): string[] =>
        w.arrangement.map((a) => `${a.key} ${a.reference}->${a.target}`).sort();

    it('page-signature-field: the field is on the artefact only where the reference carried no handle', () => {
        // Phase 3.1. The five rows, the findings list and the structure gate are
        // what the two archived roadmaps built; none of them moves.
        const empty = evaluate(obs('reference-no-handles'), obs('variant-no-handles-removed'), []);
        expect(empty.page_signature).toBeDefined();
        expect(empty.page_signature?.status).toBe('read');
        expect(empty.page_signature?.widths.map((w) => w.width)).toEqual([...VIEWPORTS].map(String));
        for (const row of empty.dimensions) {
            expect(row.status).toBe('not_applicable');
            expect(row.findings).toBeNull();
        }
        expect(empty.findings).toEqual([]);
        expect(empty.structure_gate).toBe('stopped');

        // With handles the five dimensions have a question to ask, and a weaker
        // second reading beside them would be read as corroboration it is not.
        const handled = evaluate(reference(), defects(), declarations());
        expect(handled.page_signature).toBeUndefined();
        expect(evaluate(reference(), reference(), []).page_signature).toBeUndefined();
        expect(evaluate(reference(), added(), []).page_signature).toBeUndefined();
        // Including the degrade path: a host with no browser read no page at all.
        expect(unavailableArtefact('x/index.html', 'no browser').page_signature).toBeUndefined();

        // NO AGGREGATE. The probe's own header forbids a single number standing
        // for conformance, and the walk that proves it for the five dimensions is
        // run here over the branch that actually carries the new field.
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
        walk(empty);
        for (const k of keys) expect(k).not.toMatch(/score|percent|fidelity|(^|_)rate(_|$)/i);
        expect(keys.has('page_signature')).toBe(true);
    });

    it('page-signature-table: every registered row holds, and the four that must be empty are empty', () => {
        // Phase 3.2. The four silent rows come first, because they carry more
        // weight than the loud ones: a reading that is loud about a real loss is
        // worth nothing if it is also loud about a faithful port, a declared
        // change of size, a renamed handle, or the same page with handles on it.
        for (const target of ['variant-no-handles-declared', 'variant-renamed', 'reference'] as const) {
            const r = reading('reference-no-handles', target);
            for (const w of VIEWPORTS) {
                expect(leafChanges(r[String(w)]!), `${target} at ${w}`).toEqual([]);
                expect(arrangementChanges(r[String(w)]!), `${target} at ${w}`).toEqual([]);
                expect(r[String(w)]!.overflow.reference).toBe(r[String(w)]!.overflow.target);
            }
        }

        // The faithful port — the fourth silent row, and the one the whole shape
        // was chosen for. Its markup is restructured the way a real port
        // restructures markup, and the reading says nothing at any width.
        const faithful = reading('design', 'port-faithful');
        for (const w of VIEWPORTS) {
            expect(leafChanges(faithful[String(w)]!), `faithful at ${w}`).toEqual([]);
            expect(arrangementChanges(faithful[String(w)]!), `faithful at ${w}`).toEqual([]);
            expect(faithful[String(w)]!.overflow.reference).toBe(faithful[String(w)]!.overflow.target);
        }
        // Registered as "both overflow at 320", which is a statement about the
        // pages and not only about their agreement.
        expect(faithful['320']!.overflow).toEqual({ reference: true, target: true });
        expect(faithful['1440']!.overflow).toEqual({ reference: false, target: false });

        // The removed element, on its single-change variant.
        const removed = reading('reference-no-handles', 'variant-no-handles-removed');
        for (const w of VIEWPORTS) {
            expect(leafChanges(removed[String(w)]!), `removed at ${w}`).toEqual(['text 2->1']);
        }

        // The missing narrow-width media block, at 375 and 320 ONLY. The two wide
        // widths are the sensitivity half: a reading that fired at every width
        // would satisfy the first assertion and be measuring nothing.
        const media = reading('reference-no-handles', 'variant-no-handles-media-rule');
        for (const w of ['1440', '768'] as const) {
            expect(leafChanges(media[w]!), `media at ${w}`).toEqual([]);
            expect(arrangementChanges(media[w]!), `media at ${w}`).toEqual([]);
        }
        for (const w of ['375', '320'] as const) {
            expect(leafChanges(media[w]!), `media at ${w}`).toEqual([]);
            expect(arrangementChanges(media[w]!), `media at ${w}`).toEqual(['2:column 1->0', '2:row 0->1']);
        }

        // The regenerated port. The second leaf kind here is the one place this
        // reading disagrees with the table the fixture README registers, which
        // attributes the same lost leaf to `text`. The disagreement, its cause and
        // what would settle it are in that README; asserting the measured label
        // rather than the registered one is deliberate, and neither is silently
        // corrected to the other.
        const regen = reading('design', 'port-regenerated');
        for (const w of VIEWPORTS) {
            expect(leafChanges(regen[String(w)]!), `regenerated at ${w}`).toEqual([
                'control 5->2',
                'empty 1->0',
                'heading 5->4',
            ]);
            expect(arrangementChanges(regen[String(w)]!).length, `regenerated arrangement at ${w}`).toBeGreaterThan(0);
        }
        for (const w of ['375', '320'] as const) {
            expect(arrangementChanges(regen[w]!)).toContain('3:column 1->0');
            expect(arrangementChanges(regen[w]!)).toContain('3:row 0->1');
        }
        expect(regen['375']!.overflow).toEqual({ reference: false, target: true });
    });

    it('page-signature-table: a boxless wrapper is a markup technique, not a design loss', () => {
        // D11, added after an INDEPENDENT review of the first implementation
        // converged on this as a blocker. `reference-boxless/` and
        // `variant-boxless/` render the same page; the second wraps its two
        // buttons in a `display: contents` element, which generates no box, so
        // its children lay themselves out in `main` exactly as the first page's
        // do. A faithful port does this whenever a component boundary must not
        // become a layout box.
        const r = reading('reference-boxless', 'variant-boxless');
        for (const w of VIEWPORTS) {
            expect(leafChanges(r[String(w)]!), `boxless at ${w}`).toEqual([]);
            expect(arrangementChanges(r[String(w)]!), `boxless at ${w}`).toEqual([]);
            expect(r[String(w)]!.overflow.reference).toBe(r[String(w)]!.overflow.target);
        }

        // Silence is not enough on its own: two pages the census cannot SEE also
        // read as identical. The absolute counts are asserted so the agreement is
        // an agreement about something.
        //
        // `control: 2` is the blocker's regression. Measured on a reduced form of
        // this page before the fix: 0, because an element whose own box was zero
        // was dropped TOGETHER WITH ITS SUBTREE.
        //
        // `empty: 1` is the second defect's. The bordered div's only content is
        // hidden, so the page shows an empty box; `textContent` returns the
        // hidden words and would have made it a `text` leaf.
        //
        // `text: 2` is the third's, found by a SECOND round of the same
        // independent review, against the fix for the first. The paragraph is
        // one; the other is an inline run inside a boxless wrapper. The lift
        // that fixed the first defect moves ELEMENT children, so a wrapper
        // carrying only text lifted nothing, its parent stayed a container
        // rather than becoming a text leaf, and the text was counted nowhere.
        // Measured `text: 0` on a page that renders it. A regression reads 1
        // here, which is why the count is asserted and not just the silence.
        for (const name of ['reference-boxless', 'variant-boxless'] as const) {
            const sig = readObservation(path.join(OBS, `${name}.json`)).signature;
            for (const w of VIEWPORTS) {
                expect(sig?.[String(w)]?.leaves, `${name} at ${w}`).toEqual({
                    control: 2,
                    heading: 0,
                    media: 0,
                    text: 2,
                    empty: 1,
                });
            }
        }
    });

    it('signature-absent-is-not-available: a structurally short record is withheld, not read as zeroes', () => {
        // Also from the independent review. An observation crosses a JSON
        // boundary through an unchecked cast, so `WidthSignature` is a claim
        // about the file rather than a guarantee. Reading a missing leaf count as
        // 0 turns a short record into a confident "this kind is at zero" and can
        // report a change the file never recorded — the fabricated-clean reading
        // the rest of this module refuses, arriving through an unwatched door.
        const whole = readObservation(path.join(OBS, 'reference-no-handles.json'));
        expect(evaluate(whole, whole, []).page_signature?.status).toBe('read');

        const maim = (edit: (sig: Record<string, Record<string, unknown>>) => void) => {
            const copy = JSON.parse(JSON.stringify(whole)) as typeof whole;
            edit(copy.signature as unknown as Record<string, Record<string, unknown>>);
            return evaluate(copy, whole, []).page_signature;
        };

        // A whole width gone · one leaf kind gone · a count that is not a count ·
        // a negative count · an overflow flag that is not a flag. Each on its own
        // withholds the WHOLE reading, because a partial one cannot say which of
        // its rows the short record touched.
        for (const [name, edit] of [
            ['a width missing', (s: Record<string, Record<string, unknown>>) => delete s['375']],
            ['a kind missing', (s: Record<string, Record<string, unknown>>) => delete (s['1440']!['leaves'] as Record<string, unknown>)['media']],
            ['a count that is a string', (s: Record<string, Record<string, unknown>>) => ((s['768']!['leaves'] as Record<string, unknown>)['text'] = '2')],
            ['a negative count', (s: Record<string, Record<string, unknown>>) => ((s['320']!['leaves'] as Record<string, unknown>)['control'] = -1)],
            // A count is an integer. `Number.isFinite` admitted 3.7, which no
            // capture can produce, so a half-written record carrying one was
            // read as a reading. Found by the second review round.
            ['a fractional count', (s: Record<string, Record<string, unknown>>) => ((s['768']!['leaves'] as Record<string, unknown>)['empty'] = 3.7)],
            ['overflow that is not a boolean', (s: Record<string, Record<string, unknown>>) => (s['1440']!['overflow'] = 'no')],
        ] as const) {
            const field = maim(edit);
            expect(field?.status, name).toBe('not_available');
            expect(field?.widths, name).toEqual([]);
        }

        // Sensitivity in the other direction: an arrangement key absent on one
        // side is NOT a short record. The multiset is sparse by construction — a
        // missing key means no container on that side had that shape, which is a
        // measured zero. Withholding here would make the reading useless, since
        // every real difference shows up as exactly this.
        const sparse = maim((s) => delete (s['1440']!['arrangement'] as Record<string, unknown>)['2:row']);
        expect(sparse?.status).toBe('read');
        const at1440 = sparse?.widths.find((w) => w.width === '1440');
        expect(at1440?.arrangement.map((a) => a.key)).toContain('2:row');
    });

    it('header-names-page-signature: the header describes the run that exists, and what it still cannot do', () => {
        // Phase 4.2. The header's "every real run still lands in the
        // not-applicable branch" was true and complete when it was written; it is
        // true and INCOMPLETE now, which is the worse state of the two — a reader
        // who stops there concludes a real run produces nothing.
        const src = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'ui_conformance_probe.ts'), 'utf-8');
        const header = src.slice(0, src.indexOf('*/'));

        expect(header).toMatch(/lands in the not-applicable branch/);
        const after = header.slice(header.indexOf('lands in the not-applicable branch'));

        // What such a run now reports, named in the header rather than only in a
        // type a reader has to go and find.
        expect(after).toMatch(/page_signature/);
        for (const kind of LEAF_KINDS) expect(after, `header omits the ${kind} kind`).toMatch(kind);
        expect(after).toMatch(/row\|column\|mixed/);
        expect(after).toMatch(/overflow/);

        // And what it still cannot. Each of these is a limit the fixture
        // registers; a header that listed the gains and not the limits would be
        // the over-read the paragraph above it exists to prevent.
        expect(after).toMatch(/no aggregate/i);
        expect(after).toMatch(/not a finding/);
        expect(after).toMatch(/declared deviation/);
        expect(after).toMatch(/masked/);
        expect(after).toMatch(/interaction/);

        // The promotion clause is untouched: this reading changes nothing about
        // the probe's standing.
        expect(header).toMatch(/nothing here promotes the probe out of shadow/);
        expect(header).toMatch(/NOT A GATE/);
    });

    it('page-signature-scope-sentence: the field states what it is not, in one fixed sentence', () => {
        // Phase 3.3. The sentence travels WITH the reading, because a reader who
        // takes a changed count for a located defect will go looking for the node
        // it happened to, and there is no such node.
        const field = evaluate(obs('reference-no-handles'), obs('variant-no-handles-removed'), []).page_signature;
        expect(field?.scope).toBe(PAGE_SIGNATURE_SCOPE);
        expect(PAGE_SIGNATURE_SCOPE).toMatch(/kinds of leaf and of container/);
        expect(PAGE_SIGNATURE_SCOPE).toMatch(/never nodes/);
        expect(PAGE_SIGNATURE_SCOPE).toMatch(/declared deviation/);
        expect(PAGE_SIGNATURE_SCOPE).toMatch(/not a finding/);

        // It travels on the withheld reading too. An operator who sees
        // `not_available` is exactly the operator most likely to go looking for
        // the thing this sentence says is not there.
        const legacy = readObservation(path.join(OBS, 'legacy-no-signature.json'));
        const withheld = evaluate(legacy, legacy, []).page_signature;
        expect(withheld?.status).toBe('not_available');
        expect(withheld?.scope).toBe(PAGE_SIGNATURE_SCOPE);
    });
});
