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
 * THE NOISE CONTROL. Computed-style comparison over every property fires on
 * font fallbacks and token indirection nobody cares about, so the compared set
 * is curated (`COMPARED_PROPERTIES`) to the properties a design token actually
 * lands in. A deviation that is intended is recorded in a sibling
 * `conformance.declared.json` and suppressed with its reason retained, so an
 * approved change is not re-litigated on every run.
 *
 * Exit codes: 0 written (with or without findings) · 1 usage error.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

export interface Observation {
    variant: string;
    source: string;
    nodes: NodeObservation[];
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
    host_class: 'A' | 'B' | 'C' | 'unknown';
    target: string;
    reference: string | null;
    structure_gate: 'passed' | 'stopped';
    unmatched_nodes: string[];
    dimensions: DimensionRow[];
    findings: Finding[];
    declared_suppressed: SuppressedDeviation[];
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

export function evaluate(
    reference: Observation,
    target: Observation,
    declarations: readonly Declaration[],
): ProbeArtefact {
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

    const dimensions: DimensionRow[] = DIMENSIONS.map((d) => ({
        dimension: d,
        status: 'exercised',
        findings: findings.filter((f) => f.dimension === d).length,
    }));

    return {
        schema: 'ui-conformance/v1',
        generated_at: new Date().toISOString(),
        host_class: resolveHostClass(),
        target: target.source,
        reference: reference.source,
        structure_gate: unmatched.length ? 'stopped' : 'passed',
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
export function unavailableArtefact(target: string, reason: string): ProbeArtefact {
    return {
        schema: 'ui-conformance/v1',
        generated_at: new Date().toISOString(),
        host_class: 'unknown',
        target,
        reference: null,
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

export async function captureVariant(indexHtml: string): Promise<Observation> {
    const pw = loadPlaywright();
    if (!pw) throw new Error('captureVariant: @playwright/test is not resolvable on this host');
    const browser = await pw.chromium.launch();
    const url = pathToFileURL(indexHtml).href;
    const props = [...COMPARED_PROPERTIES];
    const nodes: NodeObservation[] = [];

    try {
        const page = await browser.newPage({ viewport: { width: VIEWPORTS[0], height: 900 } });
        await page.goto(url);
        const ids = await page.$$eval('[data-probe-id]', (els) =>
            els.map((e) => e.getAttribute('data-probe-id') ?? ''),
        );

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

    return { variant: path.basename(path.dirname(indexHtml)), source: indexHtml, nodes };
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
        artefact = unavailableArtefact(target, 'no Chromium binary resolved from @playwright/test');
    } else if (!referencePath) {
        artefact = unavailableArtefact(target, 'no --reference given; a comparison needs an intended implementation');
        for (const row of artefact.dimensions) {
            row.reason = `${row.dimension} needs a --reference to compare against; none was given`;
        }
    } else {
        artefact = evaluate(await captureVariant(referencePath), await captureVariant(target), loadDeclarations(path.join(path.dirname(target), 'conformance.declared.json')));
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
