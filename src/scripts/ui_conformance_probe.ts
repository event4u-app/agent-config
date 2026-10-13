#!/usr/bin/env tsx
/**
 * `ui_conformance_probe` — behavioural evidence for a built UI surface.
 *
 * Phase 2 of `road-to-behaviour-evidence-over-pixels`. A Playwright consumer
 * that compares a target against a reference on the five dimensions a resting
 * frame cannot contain, and writes `ui-conformance.json`.
 *
 * NOT A GATE. It has no `lint_` / `check_` / `audit_` prefix, emits no
 * `scanned:` line and carries no `src/config/gate-coverage.yml` row, following
 * the `annotate_r1_outcomes.ts` precedent. It is mounted in shadow only: the
 * design-pass hook reads its artefact and reports a verdict that never blocks.
 * Making it a gate is a separate decision with its own six surfaces.
 *
 * THE STRUCTURE GATE IS PER NODE, AND THAT IS THE WHOLE DESIGN.
 * Nodes are keyed by `data-probe-id`. A reference node with no match in the
 * target produces a `structure` finding and is then simply not style-compared;
 * matched nodes are compared normally. The rejected alternative was a global
 * halt — stop the entire run on the first unmatched node. It reads stricter and
 * is worse: a target missing one element would report one finding and hide
 * every behavioural defect behind it, which is precisely the "looked clean
 * because it stopped early" failure. What the gate actually prevents is
 * comparing an unmatched node against whatever sits in its position, because
 * those style findings would be about the wrong element. Per-node matching
 * prevents that by construction, without hiding anything.
 *
 * NO AGGREGATE, ANYWHERE. Counters per dimension, never a single number
 * standing for conformance. A dimension that could not run reports
 * `not_applicable` with a reason and carries `findings: null` — never 0, which
 * would read as "ran and found nothing".
 *
 * TWO CAUSES OF `not_applicable`, NOT ONE. The clause above was written for a
 * host with no browser and then violated by the other empty input:
 * `evaluate()` used to stamp all five dimensions `exercised` with `findings: 0`
 * and return `structure_gate: 'passed'` for a reference that collected ZERO
 * nodes — which is what every design handover in this tree produces, since none
 * carries a `data-probe-id`. A comparison that never happened reported as a
 * clean one. Since `road-to-a-probe-that-cannot-report-a-false-green` an empty
 * reference takes the not-applicable path too, and its reason names the
 * HANDOVER rather than the host, so the two causes stay tellable apart in the
 * one field a reader looks at.
 *
 * THE ARTEFACT CARRIES ITS DENOMINATOR. `reference_nodes` and `target_nodes`
 * are how many handled nodes each side actually held — `null` where nothing was
 * observed at all, on the same never-0 contract as `findings`. Without them a
 * zero-node run and a fully-matched run were indistinguishable in the JSON, so
 * the cause above was readable only from prose.
 *
 * STRUCTURE IS SYMMETRIC. A handle present only in the target is a finding
 * (`expected: 'absent'`, `observed: 'present'`), mirroring the reference-side
 * one. `design-fidelity`'s Iron Law is "never omit or add an element" and the
 * add half was unobservable while the loop read `reference.nodes` alone; a
 * rename consequently reported one finding where it now reports two. The
 * finding keys on the handle, never on the DOM node, so the wrapper and portal
 * nodes a legitimate framework port inserts produce nothing.
 *
 * WHAT THIS DOES NOT FIX, said plainly because the fix is easy to over-read:
 * no design handover in this tree carries a `data-probe-id` at all, so every
 * real run still lands in the not-applicable branch. What changed is that the
 * run now SAYS so. The correspondence problem — getting handles into a handover
 * — is untouched, and nothing here promotes the probe out of shadow.
 *
 * WHAT THAT RUN NOW REPORTS, and it is a smaller thing than the five rows.
 * A reference with no handle carries a `page_signature`: per width, how many
 * rendered leaves of each KIND there are — control, heading, media, text, empty
 * — a multiset of `<child count>:<row|column|mixed>` over containers with two or
 * more rendered children, and whether the page overflows horizontally. Counts
 * and a flag; no aggregate, no coordinate, no size, no tag. It reports a removed
 * element, a lost control, a container that stopped stacking and a page that
 * started overflowing.
 *
 * AND WHAT IT STILL CANNOT. It establishes no correspondence between a
 * reference element and a target one, so it can name no node, cannot be matched
 * against a declared deviation, and is not a finding. Behaviour produces nothing
 * from it: a removed hover colour and a dead click handler change no leaf, no
 * arrangement and no overflow, and remain the business of the `interaction`
 * dimension, which needs handles. A change in size or spacing produces nothing
 * either, by the same construction that keeps it silent on a faithful port. And
 * a second defect behind a removed child is masked, because a container that has
 * lost a child drops out of the multiset entirely. The fixture README registers
 * all of it, with the one place the reading disagrees with the table it was
 * measured against.
 *
 * SO "IT REPORTS A REMOVED ELEMENT" IS TRUE OF A SINGLE CHANGE AND NOT IN
 * GENERAL, and the difference is worth the sentence. These are COUNTS: a
 * removal offset by an addition of the same kind at the same width nets to
 * nothing, and so does a reparenting that leaves the arrangement multiset
 * standing. Content removed from inside a heading or a control is invisible for
 * the same reason the wrapper around one is — the reading does not look in
 * there. Arrangement is decided over consecutive children in DOM order, so a
 * flex or grid reorder that changes only visual order produces nothing, and the
 * overflow flag is horizontal only.
 *
 * THE NOISE CONTROL. Computed-style comparison over every property fires on
 * font fallbacks and token indirection nobody cares about, so the compared set
 * is curated (`COMPARED_PROPERTIES`) to the properties a design token actually
 * lands in. A deviation that is intended is recorded in a sibling
 * `conformance.declared.json` and suppressed with its reason retained, so an
 * approved change is not re-litigated on every run.
 *
 * THE ARTEFACT KNOWS WHAT IT READ. `generated_at` alone made a run before the
 * last UI edit indistinguishable from one after it, so every artefact carries an
 * `inputs` block: a content digest of the target surface, of the reference, and
 * of the declarations file, plus the probe build that wrote them. The design-pass
 * reader recomputes those digests and reports `stale` when they moved — a file
 * comparison, no browser. The vocabulary is shared rather than duplicated
 * (`_lib/probe_inputs.ts`), because a producer and a consumer with separate
 * copies of a hash rule agree only until one of them is edited.
 *
 * Exit codes: 0 written (with or without findings) · 1 usage error.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { collectInputs, declarationsPathFor, type ProbeInputs } from './_lib/probe_inputs.js';

// Type-only, and that is load-bearing rather than stylistic: these are erased
// at compile time, so they add no second runtime path to a module that refuses
// to be loaded twice (see `loadPlaywright`).
import type * as PlaywrightTest from '@playwright/test';
type Page = PlaywrightTest.Page;

export const DIMENSIONS = [
    'structure',
    'computed_style',
    'interaction',
    'viewport_matrix',
    'media_emulation',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/**
 * Curated, not exhaustive. Every entry is a property a design token resolves
 * into or a layout property a breakpoint changes; nothing here fires on a font
 * fallback or on inherited text metrics.
 */
export const COMPARED_PROPERTIES = [
    'background-color',
    'color',
    'font-size',
    'line-height',
    'padding-top',
    'padding-left',
    'display',
    'flex-direction',
    'align-items',
    'gap',
    'outline-color',
    'outline-width',
    'transition-duration',
] as const;

/** Widest first. A divergence is attributed to the first width it appears at. */
export const VIEWPORTS = [1440, 768, 375, 320] as const;

export const INTERACTION_STATES = ['hover', 'focus', 'active', 'keyboard'] as const;

export type StyleMap = Record<string, string>;

export interface NodeObservation {
    probe_id: string;
    base: StyleMap;
    hover: StyleMap;
    focus: StyleMap;
    active: StyleMap;
    keyboard: StyleMap;
    reduced_motion: StyleMap;
    viewports: Record<string, StyleMap>;
    /**
     * A serialization of what a click did to the document, or null where the
     * node is not clickable. Comparing the EFFECT rather than the presence of a
     * listener is the point: a registered handler that mutates nothing and a
     * missing handler are the same defect to a user.
     */
    click_effect: string | null;
}

/**
 * The kinds a leaf is counted as. Four are the roadmap's; `empty` is the
 * residual and is named rather than folded into `text`, because "a wrapper that
 * renders nothing" and "a paragraph" are different things to lose.
 */
export const LEAF_KINDS = ['control', 'heading', 'media', 'text', 'empty'] as const;
export type LeafKind = (typeof LEAF_KINDS)[number];

/** One width's reading. Counts and a flag — no coordinate, no size, no tag. */
export interface WidthSignature {
    /** Every kind is present, including the zeroes: absent would read as 0 anyway. */
    leaves: Record<LeafKind, number>;
    /** A multiset: `<child count>:<row|column|mixed>` to how many containers carry it. */
    arrangement: Record<string, number>;
    overflow: boolean;
}

/** Keyed by viewport width, as a string, because JSON keys are strings. */
export type PageSignatureReading = Record<string, WidthSignature>;

export interface Observation {
    variant: string;
    source: string;
    nodes: NodeObservation[];
    /**
     * OPTIONAL, AND THAT IS THE CONTRACT RATHER THAN A CONVENIENCE. An
     * observation captured before this field existed has no signature, and a
     * reader must say `not_available` for it — never "no change", which is the
     * same fabricated green the five dimensions already refuse. Making the field
     * required would have forced every committed record to be re-captured on a
     * host with a browser before anything could read them at all.
     */
    signature?: PageSignatureReading;
}

export interface Declaration {
    probe_id: string;
    dimension: Dimension;
    property: string;
    reason: string;
}

export interface Finding {
    dimension: Dimension;
    probe_id: string;
    /** The interaction state, the viewport width, or null for a flat compare. */
    state: string | null;
    property: string | null;
    expected: string;
    observed: string;
    detail: string;
    /** Viewport dimension only: every width at which the divergence holds. */
    widths?: string[];
}

export interface DimensionRow {
    dimension: Dimension;
    status: 'exercised' | 'not_applicable';
    /** `null` on a not-applicable row. Never 0 — see the header. */
    findings: number | null;
    reason?: string;
}

/** One leaf kind whose count moved between the two sides, at one width. */
export interface LeafChange {
    kind: LeafKind;
    reference: number;
    target: number;
}

/** One arrangement key whose multiplicity moved. A key absent on a side is 0. */
export interface ArrangementChange {
    key: string;
    reference: number;
    target: number;
}

export interface WidthReading {
    width: string;
    /** Changed kinds only. An empty array means every kind held. */
    leaves: LeafChange[];
    /** Changed keys only. An empty array means the multiset held. */
    arrangement: ArrangementChange[];
    /** A PAIR, never a change flag: both sides are stated at every width. */
    overflow: { reference: boolean; target: boolean };
}

/**
 * THE FIXED SENTENCE, and it is fixed because the reading is easy to over-read.
 * A reader who takes a changed count for a located defect will go looking for
 * the node it happened to, and there is no such node: this reading never put the
 * two sides' elements into correspondence, which is the entire reason it can be
 * taken on a handover with no handles at all.
 */
export const PAGE_SIGNATURE_SCOPE =
    'This reading names kinds of leaf and of container, never nodes. It establishes no ' +
    'correspondence between a reference element and a target one, so it cannot be matched ' +
    'against a declared deviation and it is not a finding.';

/**
 * The handle-free reading as it reaches the artefact.
 *
 * A FIELD, NEVER A SIXTH DIMENSION. The five dimension rows answer "was this
 * node compared, and what diverged"; this answers neither, because it has no
 * node. Giving it a row would make `findings` a count over two different kinds
 * of statement and would break the invariant that no dimension is exercised on
 * zero nodes — which is the one thing the roadmap this comes from was told to
 * keep untouched.
 */
export interface PageSignatureField {
    status: 'read' | 'not_available';
    /** Present on `not_available` only, naming which side was missing it. */
    reason?: string;
    scope: typeof PAGE_SIGNATURE_SCOPE;
    /** One entry per viewport width when read; empty when not available. */
    widths: WidthReading[];
}

export interface SuppressedDeviation {
    probe_id: string;
    property: string;
    reason: string;
    expected: string;
    observed: string;
}

export interface ProbeArtefact {
    schema: 'ui-conformance/v1';
    generated_at: string;
    /**
     * What this run read, by content. Beside `generated_at` rather than instead
     * of it: the timestamp says when, the digests say against what — and only
     * the second question can be re-asked later.
     */
    inputs: ProbeInputs;
    host_class: 'A' | 'B' | 'C' | 'unknown';
    target: string;
    reference: string | null;
    /**
     * The denominator each side actually had. `null` where nothing was observed
     * at all — the same contract `findings` carries, and for the same reason: a
     * 0 would read as "looked and saw none", which the no-browser path did not.
     */
    reference_nodes: number | null;
    target_nodes: number | null;
    structure_gate: 'passed' | 'stopped';
    /** Reference-side only: the nodes whose STYLE comparison was skipped. */
    unmatched_nodes: string[];
    dimensions: DimensionRow[];
    findings: Finding[];
    declared_suppressed: SuppressedDeviation[];
    /**
     * PRESENT ONLY WHERE THE REFERENCE COLLECTED NO HANDLE. With handles there
     * are five dimensions that can answer about located nodes, and a second,
     * weaker reading beside them would be read as corroboration it is not:
     * a kind-level count agreeing with a per-node comparison adds nothing and
     * disagreeing with one says nothing about which is right.
     */
    page_signature?: PageSignatureField;
}

// ---------------------------------------------------------------- pure core

export function readObservation(file: string): Observation {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Observation;
}

export function loadDeclarations(file: string): Declaration[] {
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as { declared?: Declaration[] };
        return raw.declared ?? [];
    } catch {
        // A missing declaration file means nothing is declared, which is the
        // strict reading. It is never an error: most targets declare nothing.
        return [];
    }
}

const isDeclared = (d: readonly Declaration[], probeId: string, dimension: Dimension, property: string): Declaration | undefined =>
    d.find((x) => x.probe_id === probeId && x.dimension === dimension && x.property === property);

/** Did driving this state change anything, relative to the given baseline? */
function stateDelta(base: StyleMap, state: StyleMap): string[] {
    return COMPARED_PROPERTIES.filter((p) => base[p] !== state[p]);
}

/**
 * Which reading each state is measured AGAINST, and `active` is the interesting
 * one. A pointer cannot press an element without hovering it first, so the
 * `:active` reading always carries the `:hover` styles too. Measured against
 * `base`, removing a single hover rule therefore surfaces as TWO findings —
 * hover lost and active lost — which counts one defect twice and was exactly
 * what the fixture caught on the first run. Measuring `active` against `hover`
 * isolates what pressing actually contributes, and a design that darkens
 * further on press still reports correctly.
 */
const STATE_BASELINE: Record<(typeof INTERACTION_STATES)[number], 'base' | 'hover'> = {
    hover: 'base',
    active: 'hover',
    focus: 'base',
    keyboard: 'base',
};

/**
 * The second cause of `not_applicable`, and it is deliberately worded to be
 * unmistakable for the first.
 *
 * A handover carrying no `data-probe-id` and a host carrying no browser both
 * end in five not-applicable rows, so the reason string is the one field a
 * reader can tell them apart by. An operator who reads "no browser" goes
 * looking for a missing binary instead of fixing the handover — so this text
 * names the handover and never the host, and `reference_nodes: 0` makes the
 * same cause readable from the data without the prose being read at all.
 */
const EMPTY_REFERENCE_REASON =
    'the reference observation carries no data-probe-id handles, so there was nothing to ' +
    'compare against. The capture ran and collected zero nodes: this is a property of the ' +
    'handover, not of this machine.';

/**
 * The handle-free reading, taken from two captured signatures.
 *
 * ABSENT IS `not_available`, NEVER "NO CHANGE", and that is the same contract
 * `findings: null` carries one level up. An observation captured before the
 * capture learned to sweep widths has no signature at all; reporting it as
 * unchanged would be a comparison that never happened, presented as a clean one.
 * The check runs on BOTH sides, because a reader that only looked at the
 * reference would say "no change" for a target captured by an older probe.
 */
/**
 * Is one width's record complete enough to be read?
 *
 * VALIDATED AT THE BOUNDARY, BECAUSE THE INTERFACE DOES NOT REACH IT. An
 * observation arrives through `JSON.parse` and an unchecked cast, so
 * `WidthSignature` is a claim about the file rather than a guarantee. The first
 * version read a missing leaf count as `a.leaves[k] ?? 0`, which turns a
 * structurally incomplete record into a confident "this kind is at zero" and
 * can report a change that is an artefact of the file being short. That is the
 * fabricated-clean reading the rest of this module refuses, arriving through the
 * one door nothing was watching.
 */
function widthIsComplete(row: unknown): row is WidthSignature {
    if (!row || typeof row !== 'object') return false;
    const r = row as Partial<WidthSignature>;
    if (typeof r.overflow !== 'boolean') return false;
    if (!r.leaves || typeof r.leaves !== 'object') return false;
    if (!r.arrangement || typeof r.arrangement !== 'object') return false;
    const countable = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    if (!LEAF_KINDS.every((k) => countable((r.leaves as Record<string, unknown>)[k]))) return false;
    return Object.values(r.arrangement as Record<string, unknown>).every(countable);
}

export function readPageSignature(reference: Observation, target: Observation): PageSignatureField {
    const missing: string[] = [];
    if (!reference.signature) missing.push('the reference');
    if (!target.signature) missing.push('the target');
    const incomplete =
        !missing.length &&
        VIEWPORTS.some(
            (w) => !widthIsComplete(reference.signature?.[String(w)]) || !widthIsComplete(target.signature?.[String(w)]),
        );
    if (missing.length || incomplete) {
        return {
            status: 'not_available',
            scope: PAGE_SIGNATURE_SCOPE,
            reason: missing.length
                ? `${missing.join(' and ')} carries no page signature, so there was nothing to read. ` +
                  'An observation captured before the probe swept widths has none; this is not a ' +
                  'statement that the two pages agree.'
                : 'a page signature is present but is not complete at every width the probe sweeps — a ' +
                  'width is absent, or a leaf count or overflow flag is missing or not a count. A short ' +
                  'record read as zeroes would report a change the file never recorded, so the whole ' +
                  'reading is withheld. Re-capture rather than read it.',
            widths: [],
        };
    }

    const widths = VIEWPORTS.map((w) => {
        const key = String(w);
        const a = reference.signature![key]!;
        const b = target.signature![key]!;
        // No `?? 0` here, and the asymmetry with the arrangement block below is
        // the whole point. Every leaf kind is present in a record the validator
        // accepted, so a default would only ever paper over a record it rejected.
        const leaves: LeafChange[] = LEAF_KINDS.filter((k) => a.leaves[k] !== b.leaves[k]).map((k) => ({
            kind: k,
            reference: a.leaves[k],
            target: b.leaves[k],
        }));
        // The union of both sides' keys, so a key that exists only in the target
        // is reported as 0 -> n rather than silently skipped. A multiset read
        // from one side alone is the add-half blindness the structure dimension
        // already had to be taught out of.
        //
        // `?? 0` IS CORRECT HERE and wrong one block up. The multiset is sparse
        // by construction: a key absent on a side means no container on that side
        // had that shape, which is a measured zero, not a short record.
        const arrangementKeys = [...new Set([...Object.keys(a.arrangement), ...Object.keys(b.arrangement)])].sort();
        const arrangement: ArrangementChange[] = arrangementKeys
            .filter((k) => (a.arrangement[k] ?? 0) !== (b.arrangement[k] ?? 0))
            .map((k) => ({ key: k, reference: a.arrangement[k] ?? 0, target: b.arrangement[k] ?? 0 }));
        return { width: key, leaves, arrangement, overflow: { reference: a.overflow, target: b.overflow } };
    });

    return { status: 'read', scope: PAGE_SIGNATURE_SCOPE, widths };
}

export function evaluate(
    reference: Observation,
    target: Observation,
    declarations: readonly Declaration[],
): ProbeArtefact {
    // AN EMPTY COMPARISON IS NOT A CLEAN ONE.
    // Keyed on the REFERENCE only, and that asymmetry is the whole point: a
    // target that collected nothing is a real comparison in which every node is
    // missing, and four real structure findings must not be collapsed into a
    // shrug. A reference that collected nothing has no question to ask, so no
    // dimension was entered and none may report a count.
    if (reference.nodes.length === 0) {
        return {
            schema: 'ui-conformance/v1',
            generated_at: new Date().toISOString(),
            host_class: resolveHostClass(),
            target: target.source,
            reference: reference.source,
            reference_nodes: 0,
            target_nodes: target.nodes.length,
            // The empty-reference path READ both sources — it found no handles
            // in the reference, which is a property of the handover, not a
            // failure to look. So it records the same digests the normal path
            // does; omitting them would make a stopped run indistinguishable
            // from one whose inputs were never seen.
            inputs: collectInputs(target.source, reference.source),
            structure_gate: 'stopped',
            unmatched_nodes: [],
            dimensions: DIMENSIONS.map((d) => ({
                dimension: d,
                status: 'not_applicable' as const,
                findings: null,
                reason: `${d} was never entered: ${EMPTY_REFERENCE_REASON}`,
            })),
            findings: [],
            declared_suppressed: [],
            // The one branch that carries it. Everything above this line is the
            // honest statement that nothing was compared; this is the one thing
            // that could still be said about the pages, and saying it does not
            // move a single row above out of `not_applicable`.
            page_signature: readPageSignature(reference, target),
        };
    }

    const targetById = new Map(target.nodes.map((n) => [n.probe_id, n]));
    const findings: Finding[] = [];
    const suppressed: SuppressedDeviation[] = [];
    const unmatched: string[] = [];

    for (const ref of reference.nodes) {
        const got = targetById.get(ref.probe_id);
        if (!got) {
            unmatched.push(ref.probe_id);
            findings.push({
                dimension: 'structure',
                probe_id: ref.probe_id,
                state: null,
                property: null,
                expected: 'present',
                observed: 'absent',
                detail:
                    `no node carries data-probe-id="${ref.probe_id}" in the target. ` +
                    'Style comparison is skipped for this node rather than run against ' +
                    'whatever occupies its position.',
            });
            continue;
        }

        // --- computed_style, at the base viewport
        for (const p of COMPARED_PROPERTIES) {
            if (ref.base[p] === got.base[p]) continue;
            const declared = isDeclared(declarations, ref.probe_id, 'computed_style', p);
            if (declared) {
                suppressed.push({
                    probe_id: ref.probe_id,
                    property: p,
                    reason: declared.reason,
                    expected: ref.base[p] ?? '',
                    observed: got.base[p] ?? '',
                });
                continue;
            }
            findings.push({
                dimension: 'computed_style',
                probe_id: ref.probe_id,
                state: null,
                property: p,
                expected: ref.base[p] ?? '',
                observed: got.base[p] ?? '',
                detail: `resolved ${p} differs at the base viewport`,
            });
        }

        // --- interaction: a state the reference reacts to and the target does not
        for (const state of INTERACTION_STATES) {
            const baseline = STATE_BASELINE[state];
            const refDelta = stateDelta(baseline === 'hover' ? ref.hover : ref.base, ref[state]);
            const gotDelta = stateDelta(baseline === 'hover' ? got.hover : got.base, got[state]);
            const lost = refDelta.filter((p) => !gotDelta.includes(p));
            if (!lost.length) continue;
            if (isDeclared(declarations, ref.probe_id, 'interaction', lost[0]!)) continue;
            findings.push({
                dimension: 'interaction',
                probe_id: ref.probe_id,
                state,
                property: lost[0]!,
                expected: `${state} changes ${lost.join(', ')}`,
                observed: gotDelta.length ? `${state} changes ${gotDelta.join(', ')}` : `${state} changes nothing`,
                detail:
                    `the reference responds to ${state} on this node and the target does not. ` +
                    'No resting capture at any viewport contains this difference.',
            });
        }

        // --- interaction: a handler whose effect disappeared
        if (ref.click_effect !== null && ref.click_effect !== got.click_effect) {
            findings.push({
                dimension: 'interaction',
                probe_id: ref.probe_id,
                state: 'click',
                property: null,
                expected: ref.click_effect,
                observed: got.click_effect ?? 'no effect',
                detail:
                    'clicking this node changes the document in the reference and does not in ' +
                    'the target. The element renders identically in both.',
            });
        }

        // --- viewport_matrix: ONE finding per breakpoint row, not per property.
        // A single removed media rule usually changes several properties at once
        // (this fixture's changes both `flex-direction` and `align-items`), and
        // reporting one finding each would count one defect several times and
        // make "exactly the matching breakpoint row is red" untestable. The row
        // is the unit a reader acts on: this node does not change at this width.
        const perWidth = new Map<string, string[]>();
        for (const w of VIEWPORTS) {
            const key = String(w);
            const refV = ref.viewports[key];
            const gotV = got.viewports[key];
            if (!refV || !gotV) continue;
            const diverging = COMPARED_PROPERTIES.filter(
                (p) =>
                    refV[p] !== gotV[p] &&
                    // A divergence already visible at the base viewport is a flat
                    // style difference, not a breakpoint one. Reporting it in both
                    // dimensions would count one defect twice.
                    ref.base[p] === got.base[p] &&
                    !isDeclared(declarations, ref.probe_id, 'viewport_matrix', p),
            );
            if (diverging.length) perWidth.set(key, diverging);
        }
        if (perWidth.size) {
            const widths = [...perWidth.keys()];
            const first = widths[0]!;
            const properties = perWidth.get(first)!;
            findings.push({
                dimension: 'viewport_matrix',
                probe_id: ref.probe_id,
                state: first,
                property: properties.join(', '),
                expected: properties.map((p) => `${p}: ${ref.viewports[first]?.[p] ?? ''}`).join('; '),
                observed: properties.map((p) => `${p}: ${got.viewports[first]?.[p] ?? ''}`).join('; '),
                detail:
                    `this node's layout diverges at ${widths.join('px, ')}px while matching at the base ` +
                    'viewport — a breakpoint the target does not cross.',
                widths,
            });
        }

        // --- media_emulation
        const refMotion = stateDelta(ref.base, ref.reduced_motion);
        const gotMotion = stateDelta(got.base, got.reduced_motion);
        const lostMotion = refMotion.filter((p) => !gotMotion.includes(p));
        if (lostMotion.length && !isDeclared(declarations, ref.probe_id, 'media_emulation', lostMotion[0]!)) {
            findings.push({
                dimension: 'media_emulation',
                probe_id: ref.probe_id,
                state: 'reduced-motion',
                property: lostMotion[0]!,
                expected: `reduced motion changes ${lostMotion.join(', ')}`,
                observed: 'reduced motion changes nothing',
                detail: 'the reference presents a reduced-motion alternative on this node and the target does not',
            });
        }
    }

    // --- structure, from the TARGET side. `design-fidelity`'s Iron Law is
    // "never omit or add an element" and only the omit half was observable: the
    // loop above reads `reference.nodes`, so a handle present only in the target
    // reached nothing.
    //
    // KEYED ON THE HANDLE, NEVER ON THE DOM NODE, and that is what keeps this
    // from reddening correct work. A faithful port into a component framework
    // inserts wrapper and portal nodes the handover never had; none of them
    // carries a `data-probe-id`, so none of them is observed here. Excluding the
    // false-positive class by construction, rather than by a heuristic, is the
    // difference between a dimension that gets acted on and one that gets muted.
    const referenceIds = new Set(reference.nodes.map((n) => n.probe_id));
    const addedIds = target.nodes
        .map((n) => n.probe_id)
        .filter((id) => !referenceIds.has(id))
        .sort();
    for (const id of addedIds) {
        findings.push({
            dimension: 'structure',
            probe_id: id,
            state: null,
            property: null,
            expected: 'absent',
            observed: 'present',
            detail:
                `a node carries data-probe-id="${id}" in the target and no node carries it in ` +
                'the reference. There is nothing to compare its style against, so it is reported ' +
                'and then left alone — the mirror of the missing-node case above.',
        });
    }

    const dimensions: DimensionRow[] = DIMENSIONS.map((d) => ({
        dimension: d,
        status: 'exercised',
        findings: findings.filter((f) => f.dimension === d).length,
    }));

    return {
        schema: 'ui-conformance/v1',
        generated_at: new Date().toISOString(),
        inputs: collectInputs(target.source, reference.source),
        host_class: resolveHostClass(),
        target: target.source,
        reference: reference.source,
        reference_nodes: reference.nodes.length,
        target_nodes: target.nodes.length,
        // Both directions stop the gate, because both describe a node that was
        // never style-compared. `unmatched_nodes` keeps its narrower meaning —
        // the reference-side nodes whose comparison was SKIPPED — so a reader of
        // that list still learns exactly what it always said.
        structure_gate: unmatched.length || addedIds.length ? 'stopped' : 'passed',
        unmatched_nodes: unmatched,
        dimensions,
        findings,
        declared_suppressed: suppressed,
    };
}

/**
 * The artefact a host that cannot run the probe must still produce. Emitting
 * nothing is indistinguishable from a clean run to everything downstream.
 */
export function unavailableArtefact(target: string, reason: string, reference: string | null = null): ProbeArtefact {
    return {
        schema: 'ui-conformance/v1',
        generated_at: new Date().toISOString(),
        // A degraded run still records what it WOULD have compared. An artefact
        // with no inputs block reads as a version skew to the reader, which is a
        // different and less useful statement than "this host has no browser".
        inputs: collectInputs(target, reference),
        host_class: 'unknown',
        target,
        reference: null,
        // Null, never 0 — nothing was observed on either side, and a 0 would
        // read as "looked and saw none".
        reference_nodes: null,
        target_nodes: null,
        structure_gate: 'stopped',
        unmatched_nodes: [],
        dimensions: DIMENSIONS.map((d) => ({
            dimension: d,
            status: 'not_applicable' as const,
            findings: null,
            reason: `${d} needs a browser engine this host did not provide: ${reason}`,
        })),
        findings: [],
        declared_suppressed: [],
    };
}

export function resolveHostClass(): ProbeArtefact['host_class'] {
    if (!chromiumAvailable()) return 'unknown';
    return process.env['CI'] ? 'C' : 'A';
}

// ------------------------------------------------------------ browser layer

/**
 * ONE loader, memoized, and that is not a style preference. Playwright throws
 * `Requiring @playwright/test second time` when the same process reaches it
 * through both CJS `require` and ESM `import`, so the availability probe and
 * the capture must share a single path. `createRequire` rather than a bare
 * `require`, because this file is ESM and a bare `require` is undefined
 * under tsx.
 */
let playwrightModule: typeof PlaywrightTest | null | undefined;
function loadPlaywright(): typeof PlaywrightTest | null {
    if (playwrightModule !== undefined) return playwrightModule;
    try {
        const req = createRequire(import.meta.url);
        playwrightModule = req('@playwright/test') as typeof PlaywrightTest;
    } catch {
        playwrightModule = null;
    }
    return playwrightModule;
}

export function chromiumAvailable(): boolean {
    try {
        // Resolving the module is not enough — the binaries are a separate
        // install, and this package declares the runner without installing them.
        const pw = loadPlaywright();
        const exe = pw?.chromium?.executablePath?.();
        return Boolean(exe && fs.existsSync(exe));
    } catch {
        return false;
    }
}

const READ_STYLES = (el: Element, props: readonly string[]): Record<string, string> => {
    const cs = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const p of props) out[p] = cs.getPropertyValue(p).trim();
    return out;
};

/**
 * The handle-free reading, taken in the page. Serialized into the browser by
 * `page.evaluate`, so it closes over nothing and takes its vocabulary as an
 * argument.
 *
 * WHAT IT DOES NOT LOOK INSIDE, which is the whole design rather than an
 * optimisation. A control, a heading and a media element are counted as one
 * leaf each and never descended into. The literal reading — "an element with no
 * rendered element child" — would make `<button>Save</button>` a control and
 * `<button><span>Save</span></button>` a text leaf inside a container, so
 * wrapping a label in a span, which is the most ordinary thing a component
 * framework does on a faithful port, would read as a lost control. That is the
 * exact false-positive class the census-by-tag prototype was refuted for, and
 * refusing to look inside a semantic atom excludes it by construction instead of
 * by a tolerance. An `<svg>` is the same case from the other side: descending
 * into its paths would make the count a function of how complex the icon is.
 *
 * THE COST, stated rather than discovered later: an `<a>` that wraps a whole
 * card is one control leaf, and everything inside it is invisible to this
 * reading. That is a loss of SENSITIVITY, never a false report, and this
 * reading is built to prefer silence over noise — it is registered as a limit
 * in the fixture README beside the other two.
 *
 * Row, column or mixed is decided from the rendered boxes of consecutive
 * children and then thrown away: nothing a coordinate could be reconstructed
 * from reaches the record.
 *
 * FLAT ON PURPOSE — no inner helper and no recursion, and that is a constraint
 * of the carrier rather than a style. This file is run through a transform that
 * keeps function names, which wraps every named inner function in a `__name`
 * helper that exists in the module and not in the page. `page.evaluate`
 * serializes the function and nothing else, so the first version of this
 * reading threw `ReferenceError: __name is not defined` in the browser on its
 * first run. An explicit stack has no inner function to be named.
 */
const READ_SIGNATURE = (kinds: readonly string[]): {
    leaves: Record<string, number>;
    arrangement: Record<string, number>;
    overflow: boolean;
} => {
    // CURATED, NOT EXHAUSTIVE — the same stance `COMPARED_PROPERTIES` takes one
    // screen up, and stated because the prose around this reads like a semantic
    // classification rather than a selector list. An element carrying a role
    // outside this set is counted by what it contains rather than as a control.
    const CONTROL =
        'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],' +
        '[role="checkbox"],[role="switch"],[role="tab"],[role="menuitem"],[role="radio"],' +
        '[role="slider"],[role="spinbutton"],[role="combobox"],[role="option"],[contenteditable]';
    const HEADING = 'h1,h2,h3,h4,h5,h6,[role="heading"]';
    const MEDIA = 'img,svg,canvas,video,audio,picture,iframe,object,embed,[role="img"]';

    const leaves: Record<string, number> = {};
    for (const k of kinds) leaves[k] = 0;
    const arrangement: Record<string, number> = {};

    const stack: Element[] = document.body ? [document.body] : [];
    while (stack.length) {
        const el = stack.pop() as Element;

        let kind = '';
        if (el.matches(CONTROL)) kind = 'control';
        else if (el.matches(HEADING)) kind = 'heading';
        else if (el.matches(MEDIA)) kind = 'media';
        if (kind) {
            leaves[kind] = (leaves[kind] ?? 0) + 1;
            continue;
        }

        // A BOXLESS ELEMENT IS TRANSPARENT, NOT ABSENT — the two are opposites
        // and the first version of this conflated them. "A zero box is not
        // rendered" is true of the ELEMENT and says nothing about its children:
        // `display: contents` generates no box at all while rendering its
        // subtree normally, and a zero-height wrapper with overflowing content
        // is the same case from the other side. Dropping such an element
        // together with its subtree made every control inside a
        // `display: contents` wrapper invisible — measured at 0 where the page
        // showed 2 — which is the census reporting a loss that did not happen.
        // So a boxless, non-hidden element is neither a leaf nor a container:
        // its children are lifted into its parent's list, in document order, and
        // it contributes nothing of its own. An element that is boxless AND has
        // no children still contributes nothing, exactly as before.
        const children: Element[] = [];
        const pending: Element[] = Array.from(el.children);
        while (pending.length) {
            const c = pending.shift() as Element;
            const cs = getComputedStyle(c);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = c.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) children.push(c);
            else pending.unshift(...Array.from(c.children));
        }

        if (children.length === 0) {
            // RENDERED TEXT, NOT TEXT CONTENT. `textContent` includes the text
            // of `display: none` and `visibility: hidden` descendants, so a
            // wrapper whose only content is hidden counted as a text leaf — the
            // census inventing a leaf the page does not show, which is the exact
            // mirror of the defect above. `innerText` is the rendered reading and
            // is the right primitive; `textContent` stays as the fallback for an
            // element that has no `innerText`, such as a non-HTML one.
            const asHtml = el as Partial<HTMLElement>;
            const shown = typeof asHtml.innerText === 'string' ? asHtml.innerText : (el.textContent ?? '');
            kind = shown.trim().length ? 'text' : 'empty';
            leaves[kind] = (leaves[kind] ?? 0) + 1;
            continue;
        }

        if (children.length > 1) {
            let shape = '';
            for (let i = 1; i < children.length; i += 1) {
                const a = (children[i - 1] as Element).getBoundingClientRect();
                const b = (children[i] as Element).getBoundingClientRect();
                const sharesRows = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
                const sharesColumns = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0;
                shape += !sharesRows ? 'c' : sharesColumns ? 'm' : 'r';
            }
            const axis = /^r+$/.test(shape) ? 'row' : /^c+$/.test(shape) ? 'column' : 'mixed';
            const key = `${children.length}:${axis}`;
            arrangement[key] = (arrangement[key] ?? 0) + 1;
        }

        for (const c of children) stack.push(c);
    }

    const doc = document.documentElement;
    return { leaves, arrangement, overflow: doc.scrollWidth > doc.clientWidth };
};

export async function captureVariant(indexHtml: string): Promise<Observation> {
    const pw = loadPlaywright();
    if (!pw) throw new Error('captureVariant: @playwright/test is not resolvable on this host');
    const browser = await pw.chromium.launch();
    const url = pathToFileURL(indexHtml).href;
    const props = [...COMPARED_PROPERTIES];
    const nodes: NodeObservation[] = [];
    const signature: PageSignatureReading = {};

    try {
        const page = await browser.newPage({ viewport: { width: VIEWPORTS[0], height: 900 } });
        await page.goto(url);
        const ids = await page.$$eval('[data-probe-id]', (els) =>
            els.map((e) => e.getAttribute('data-probe-id') ?? ''),
        );

        // OUTSIDE THE PER-HANDLE LOOP, which is the one structural thing this
        // change does. Every width sweep this file had lived inside that loop, so
        // a page with no handles was never resized at all and the capture of the
        // commonest input in the tree — a handover carrying no `data-probe-id` —
        // consisted of opening the page and closing it. Four resizes and one DOM
        // walk each now happen whether or not a handle is ever found.
        //
        // Before the loop rather than after it, so the loop starts from the same
        // state it always did; the viewport is put back explicitly rather than
        // left to the loop's own first `setViewportSize`, because relying on that
        // would couple two things that have no reason to stay coupled.
        for (const w of VIEWPORTS) {
            await page.setViewportSize({ width: w, height: 900 });
            signature[String(w)] = (await page.evaluate(READ_SIGNATURE, [...LEAF_KINDS])) as WidthSignature;
        }
        await page.setViewportSize({ width: VIEWPORTS[0], height: 900 });

        for (const id of ids.filter(Boolean).sort()) {
            const sel = `[data-probe-id="${id}"]`;
            await page.setViewportSize({ width: VIEWPORTS[0], height: 900 });
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await page.reload();

            const base = await page.$eval(sel, READ_STYLES, props);

            await page.hover(sel).catch(() => undefined);
            const hover = await page.$eval(sel, READ_STYLES, props);
            await page.mouse.move(0, 0);

            await page.$eval(sel, (el) => (el as HTMLElement).focus?.());
            const focus = await page.$eval(sel, READ_STYLES, props);
            await page.$eval(sel, (el) => (el as HTMLElement).blur?.());

            const box = await page.$eval(sel, (el) => {
                const r = el.getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            });
            await page.mouse.move(box.x, box.y);
            await page.mouse.down();
            const active = await page.$eval(sel, READ_STYLES, props);
            await page.mouse.up();
            await page.reload();

            const keyboard = await captureKeyboardState(page, id, sel, props);

            await page.emulateMedia({ reducedMotion: 'reduce' });
            const reducedMotion = await page.$eval(sel, READ_STYLES, props);
            await page.emulateMedia({ reducedMotion: 'no-preference' });

            const viewports: Record<string, StyleMap> = {};
            for (const w of VIEWPORTS) {
                await page.setViewportSize({ width: w, height: 900 });
                viewports[String(w)] = await page.$eval(sel, READ_STYLES, props);
            }
            await page.setViewportSize({ width: VIEWPORTS[0], height: 900 });

            const clickEffect = await captureClickEffect(page, sel);

            nodes.push({
                probe_id: id,
                base,
                hover,
                focus,
                active,
                keyboard,
                reduced_motion: reducedMotion,
                viewports,
                click_effect: clickEffect,
            });
        }
        await page.close();
    } finally {
        await browser.close();
    }

    return { variant: path.basename(path.dirname(indexHtml)), source: indexHtml, nodes, signature };
}

/**
 * Keyboard focus, reached by actually pressing Tab. `element.focus()` does not
 * set `:focus-visible` in Chromium when the last input was not a keyboard, so a
 * programmatic focus would silently report the focus ring as absent.
 */
async function captureKeyboardState(
    page: Page,
    id: string,
    sel: string,
    props: readonly string[],
): Promise<StyleMap> {
    await page.reload();
    for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
        const hit = await page.evaluate(
            (probeId) => document.activeElement?.getAttribute('data-probe-id') === probeId,
            id,
        );
        if (hit) break;
    }
    const styles = await page.$eval(sel, READ_STYLES, props);
    await page.reload();
    return styles;
}

/**
 * Click, then serialize what CHANGED about the document — a delta, never an
 * absolute snapshot.
 *
 * The absolute form was the first implementation and it was wrong in a way the
 * fixture caught: the snapshot listed every `data-probe-id` on the page, so
 * renaming ONE unrelated element changed the recorded click effect of EVERY
 * node, and the renamed variant produced a spurious interaction finding on a
 * button whose handler was untouched. A delta is scoped to the nodes the click
 * actually moved, so an unrelated rename is invisible here and stays the
 * structure dimension's business.
 *
 * A node whose click changes nothing reports null — the correct reading for a
 * paragraph, and the defect reading for a button.
 */
async function captureClickEffect(page: Page, sel: string): Promise<string | null> {
    const snapshot = (): Promise<Record<string, string>> =>
        page.evaluate(() =>
            Object.fromEntries(
                [...document.querySelectorAll('[data-probe-id]')].map((e) => [
                    e.getAttribute('data-probe-id') ?? '',
                    `${e.hasAttribute('hidden') ? 'hidden' : 'shown'}/${e.getAttribute('aria-expanded') ?? '-'}`,
                ]),
            ),
        );
    await page.reload();
    const before = await snapshot();
    await page.click(sel, { timeout: 2000 }).catch(() => undefined);
    const after = await snapshot();
    await page.reload();

    const changed = Object.keys({ ...before, ...after })
        .filter((id) => before[id] !== after[id])
        .sort()
        .map((id) => `${id}: ${before[id] ?? 'absent'} -> ${after[id] ?? 'absent'}`);
    return changed.length ? changed.join('; ') : null;
}

// -------------------------------------------------------------------- CLI

const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main(): Promise<number> {
    const target = arg('target');
    if (!target) {
        process.stderr.write('usage: ui_conformance_probe --target <index.html> [--reference <index.html>] [--out <file>]\n');
        return 1;
    }
    const out = arg('out') ?? path.join('agents', 'runtime', 'state', 'ui-conformance.json');
    const referencePath = arg('reference');

    let artefact: ProbeArtefact;
    if (!chromiumAvailable()) {
        artefact = unavailableArtefact(target, 'no Chromium binary resolved from @playwright/test', referencePath ?? null);
    } else if (!referencePath) {
        artefact = unavailableArtefact(target, 'no --reference given; a comparison needs an intended implementation');
        for (const row of artefact.dimensions) {
            row.reason = `${row.dimension} needs a --reference to compare against; none was given`;
        }
    } else {
        artefact = evaluate(await captureVariant(referencePath), await captureVariant(target), loadDeclarations(declarationsPathFor(target)));
    }

    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(artefact, null, 2)}\n`);
    for (const row of artefact.dimensions) {
        const count = row.findings === null ? `not-applicable — ${row.reason ?? ''}` : String(row.findings);
        process.stdout.write(`${row.dimension}: ${count}\n`);
    }
    process.stdout.write(`structure_gate: ${artefact.structure_gate}\n`);
    return 0;
}

export const _HERE = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main().then((c) => process.exit(c));
}
