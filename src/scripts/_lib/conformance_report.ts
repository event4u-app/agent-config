/**
 * Per-dimension conformance of a port against the artifact it was ported from.
 *
 * WHY A DIMENSION REPORT AND NOT A SCORE. `internal/bench/ui` already scores a
 * port on pixel / dom / tokens / interactions and produces one weighted number.
 * A number answers "how close", which is the right question for a benchmark and
 * the wrong one for a fidelity gate: a port can be pixel-identical and still
 * have dropped a keyboard interaction, inlined every value the project has a
 * token for, or lost a breakpoint. Averaged into a weighted score those
 * disappear, because the axis that carries them is small and the axis that
 * hides them is large.
 *
 * A GREEN PIXEL DIFF ALONE CANNOT PRODUCE A PASS, and that is enforced by
 * construction rather than by policy: pixel similarity is not one of the
 * dimensions below. It is evidence a human may read; it is never an input to
 * `overall`.
 *
 * WHAT EACH ROW OWES. Every finding cites BOTH sides — what the artifact has
 * and what the implementation has. A finding that names only the implementation
 * is unactionable: the reader cannot tell whether the port dropped something or
 * whether the artifact never had it.
 *
 * SCOPE, stated because the honest version is narrower than the obvious one.
 * These are static checks over two documents' text. They catch the deviations
 * that leave a textual trace — a value gone, a handler gone, a breakpoint gone.
 * They do NOT catch a deviation that is only visible when rendered, and they do
 * not claim to. Where a rendered comparison is available it belongs beside this
 * report, not inside it.
 */
import { type TokenCandidate, type ValueKind, type ValueRow, reconcileValue } from './design_tolerance.js';
import { recordToleranceShadow } from './tolerance_shadow.js';

export type Dimension = 'structure' | 'values' | 'behaviour' | 'responsive' | 'icons' | 'carrier';

export const DIMENSIONS: readonly Dimension[] = [
    'structure',
    'values',
    'behaviour',
    'responsive',
    'icons',
    'carrier',
];

export interface Finding {
    dimension: Dimension;
    /** What the artifact carries. Never omitted — see the header. */
    artifact: string;
    /** What the implementation carries in its place. */
    implementation: string;
    detail: string;
}

export interface DimensionVerdict {
    dimension: Dimension;
    verdict: 'conforms' | 'deviates';
    findings: Finding[];
}

export interface ConformanceReport {
    dimensions: DimensionVerdict[];
    /** Value rows with their distance, reported whether or not they deviate. */
    values: ValueRow[];
    overall: 'conforms' | 'deviates';
    /** Dimensions that deviated, in `DIMENSIONS` order. */
    deviating: Dimension[];
}

// ------------------------------------------------------------- extraction

const HEX_RE = /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g;
const LENGTH_RE = /\b\d*\.?\d+(?:px|rem)\b/g;
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)\b/g;
// EVERY width bound in a query, not the first. `@media (min-width: 48rem) and
// (max-width: 80rem)` has two, and capturing one left `80rem` counted as a
// VALUE — which reds two dimensions for one corruption and breaks the
// one-dimension property 4.1's verify clause rests on. Found by a blind review.
const MEDIA_QUERY_RE = /@media[^{]+/g;
const MEDIA_BOUND_RE = /\(\s*(?:min|max)-width\s*:\s*([^)]+)\)/g;
// Case-insensitive on the listener name: the first version required an
// all-lowercase quoted name, so `addEventListener('DOMContentLoaded', …)` and
// any camelCase custom event were invisible to the behavior dimension that
// exists to catch a dropped interaction. Blind-review finding.
const LISTENER_RE = /addEventListener\(\s*['"]([A-Za-z][A-Za-z0-9_:.-]*)['"]/g;

/**
 * `on*` ATTRIBUTES, matched against a closed set rather than by shape.
 *
 * A word boundary does not separate `onclick` from `onboarding` — both begin
 * with `on` and both are followed by `=`, so a shape rule reads the second as a
 * hook named `boarding`. It is the inline-handler namespace that is closed, so
 * the set is what discriminates. A custom event never appears as an attribute
 * anyway; it appears in `addEventListener`, which the regex above reads openly.
 */
const INLINE_EVENTS = new Set([
    'click', 'dblclick', 'mousedown', 'mouseup', 'mouseenter', 'mouseleave',
    'mousemove', 'mouseover', 'mouseout', 'keydown', 'keyup', 'keypress',
    'input', 'change', 'submit', 'reset', 'focus', 'blur', 'focusin',
    'focusout', 'scroll', 'wheel', 'load', 'error', 'resize', 'toggle',
    'select', 'drag', 'dragstart', 'dragend', 'dragover', 'drop', 'touchstart',
    'touchend', 'touchmove', 'pointerdown', 'pointerup', 'pointermove',
    'animationend', 'transitionend', 'contextmenu', 'copy', 'cut', 'paste',
    'invalid', 'play', 'pause', 'ended',
]);
const ON_ATTR_RE = /(?:^|[\s"'`<])on([a-z]+)\s*=/g;
// Attribute-bounded and quote-agnostic. Unbounded, it false-positived on any
// attribute ENDING in `style` (`data-style=`, `hover-style=`); double-quote-only,
// it missed `style='…'` entirely. Blind-review finding.
const INLINE_STYLE_RE = /(?:^|[\s"'`<])style\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Landmark and control tags — the structural skeleton, not every `<div>`. */
const STRUCTURAL_TAGS = new Set([
    'main',
    'header',
    'footer',
    'nav',
    'aside',
    'section',
    'article',
    'form',
    'table',
    'dialog',
    'button',
    'input',
    'select',
    'textarea',
    'a',
    'label',
    'svg',
]);

function setMinus(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const v of a) if (!b.has(v)) out.add(v);
    return out;
}

function matchSet(text: string, re: RegExp, group = 0): Set<string> {
    const out = new Set<string>();
    for (const m of text.matchAll(re)) {
        const v = m[group];
        if (typeof v === 'string' && v !== '') out.add(v.toLowerCase().trim());
    }
    return out;
}

/** Counts per structural tag; a dropped control is a count change, not absence. */
export function structuralCounts(html: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const m of html.matchAll(TAG_RE)) {
        const tag = (m[1] as string).toLowerCase();
        if (!STRUCTURAL_TAGS.has(tag)) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
}

/** Event names the document wires, from listeners and from `on*` attributes. */
export function behaviourHooks(html: string): Set<string> {
    const out = new Set<string>();
    for (const m of html.matchAll(LISTENER_RE)) {
        out.add((m[1] as string).toLowerCase());
    }
    for (const m of html.matchAll(ON_ATTR_RE)) {
        const name = (m[1] as string).toLowerCase();
        if (INLINE_EVENTS.has(name)) out.add(name);
    }
    return out;
}

/** Breakpoints, normalised so `48rem` and `48 rem` are one value. */
export function breakpoints(html: string): Set<string> {
    const out = new Set<string>();
    for (const q of html.matchAll(MEDIA_QUERY_RE)) {
        for (const b of (q[0] as string).matchAll(MEDIA_BOUND_RE)) {
            const v = (b[1] as string).toLowerCase().trim();
            if (v !== '') out.add(v);
        }
    }
    return out;
}

/**
 * Static declarations sitting in a `style=` attribute.
 *
 * The carrier axis: static presentation belongs in CSS or classes, and `style=`
 * is for what only the runtime knows. A port that moves the artifact's inline
 * styles into classes is CONFORMING as long as the resolved value is identical
 * — which is why this counts declarations the IMPLEMENTATION added, never ones
 * it removed.
 */
export function inlineStaticDeclarations(html: string): string[] {
    const out: string[] = [];
    for (const m of html.matchAll(INLINE_STYLE_RE)) {
        for (const decl of ((m[1] ?? m[2] ?? '') as string).split(';')) {
            const trimmed = decl.trim();
            if (trimmed === '') continue;
            // A custom property or a `var()` is plausibly runtime-driven.
            if (trimmed.startsWith('--') || trimmed.includes('var(')) continue;
            out.push(trimmed.toLowerCase());
        }
    }
    return out;
}

/** Inline `<svg>` occurrences — the icon carrier a port reproduces. */
export function inlineSvgCount(html: string): number {
    return (html.match(/<svg\b/gi) ?? []).length;
}

// ------------------------------------------------------------------ report

function verdictFor(dimension: Dimension, findings: Finding[]): DimensionVerdict {
    return { dimension, verdict: findings.length > 0 ? 'deviates' : 'conforms', findings };
}

export interface ReportInput {
    artifact: string;
    implementation: string;
    /** Project tokens, so a value row can carry its distance. */
    tokens?: readonly TokenCandidate[];
    /**
     * Repo root. When given, every measurable value row is appended to the
     * shadow log as a `tolerance_shadow` record.
     *
     * OPT-IN, and that is the whole design: a report is also built by tests and
     * by a reader inspecting a port, and a window that recorded those would be
     * measuring its own test fixtures. The caller that wants the window says so.
     */
    shadowRoot?: string;
}

/**
 * Build the report. Pure over two strings, so a test can corrupt exactly one
 * dimension and assert that exactly one reds.
 */
export function buildConformanceReport(input: ReportInput): ConformanceReport {
    const { artifact, implementation } = input;
    const tokens = input.tokens ?? [];

    // --- structure
    const structureFindings: Finding[] = [];
    const aCounts = structuralCounts(artifact);
    const iCounts = structuralCounts(implementation);
    for (const tag of new Set([...aCounts.keys(), ...iCounts.keys()])) {
        const a = aCounts.get(tag) ?? 0;
        const i = iCounts.get(tag) ?? 0;
        // `svg` is the icons dimension's subject; counting it here too would
        // red two dimensions for one corruption and break the step's verify.
        if (tag === 'svg' || a === i) continue;
        structureFindings.push({
            dimension: 'structure',
            artifact: `${String(a)} × <${tag}>`,
            implementation: `${String(i)} × <${tag}>`,
            detail: `structural element count differs for <${tag}>`,
        });
    }

    // --- values, and their distances
    const aHex = matchSet(artifact, HEX_RE);
    const iHex = matchSet(implementation, HEX_RE);
    // A breakpoint's own length belongs to `responsive`, not to `values`.
    // Without this both axes red on one corruption — measured: dropping
    // `@media (min-width: 48rem)` also dropped `48rem` from the value set, so
    // the responsive case reported `['values', 'responsive']` and the step's
    // "and no other" clause could not hold. Same shape as the `svg` exclusion
    // in the structure loop above.
    const aLen = setMinus(matchSet(artifact, LENGTH_RE), breakpoints(artifact));
    const iLen = setMinus(matchSet(implementation, LENGTH_RE), breakpoints(implementation));
    const valueFindings: Finding[] = [];
    const valueRows: ValueRow[] = [];
    // Parallel to `valueRows`: a row does not carry its own kind, and the
    // shadow record needs it to pick the right candidate-threshold spread.
    const valueKinds: ValueKind[] = [];

    for (const hex of aHex) {
        // Reported on every value, present or missing — the distance is the
        // point, not the verdict (`design_tolerance.ts` header).
        valueRows.push(reconcileValue('color', hex, tokens));
        valueKinds.push('color');
        if (!iHex.has(hex)) {
            valueFindings.push({
                dimension: 'values',
                artifact: hex,
                implementation: iHex.size > 0 ? `absent (port uses ${[...iHex].join(', ')})` : 'absent',
                detail: 'a colour the artifact states does not appear in the port',
            });
        }
    }
    for (const len of aLen) {
        valueRows.push(reconcileValue('length', len, tokens));
        valueKinds.push('length');
        if (!iLen.has(len)) {
            valueFindings.push({
                dimension: 'values',
                artifact: len,
                implementation: 'absent',
                detail: 'a length the artifact states does not appear in the port',
            });
        }
    }

    // --- behaviour
    const aHooks = behaviourHooks(artifact);
    const iHooks = behaviourHooks(implementation);
    const behaviourFindings: Finding[] = [];
    for (const hook of aHooks) {
        if (iHooks.has(hook)) continue;
        behaviourFindings.push({
            dimension: 'behaviour',
            artifact: `wires \`${hook}\``,
            implementation: 'not wired',
            detail: `an interaction the artifact wires is missing from the port`,
        });
    }

    // --- responsive
    const aBp = breakpoints(artifact);
    const iBp = breakpoints(implementation);
    const responsiveFindings: Finding[] = [];
    for (const bp of aBp) {
        if (iBp.has(bp)) continue;
        responsiveFindings.push({
            dimension: 'responsive',
            artifact: `breakpoint ${bp}`,
            implementation: iBp.size > 0 ? `only ${[...iBp].join(', ')}` : 'no breakpoints',
            detail: 'a breakpoint the artifact declares is missing from the port',
        });
    }

    // --- icons
    const aSvg = inlineSvgCount(artifact);
    const iSvg = inlineSvgCount(implementation);
    const iconFindings: Finding[] = [];
    if (aSvg !== iSvg) {
        iconFindings.push({
            dimension: 'icons',
            artifact: `${String(aSvg)} inline <svg>`,
            implementation: `${String(iSvg)} inline <svg>`,
            detail: 'the port does not carry the artifact’s icon count',
        });
    }

    // --- carrier
    const aInline = new Set(inlineStaticDeclarations(artifact));
    const carrierFindings: Finding[] = [];
    for (const decl of inlineStaticDeclarations(implementation)) {
        if (aInline.has(decl)) continue;
        carrierFindings.push({
            dimension: 'carrier',
            artifact: 'not inline in the artifact',
            implementation: `style="${decl}"`,
            detail: 'a static declaration the port put inline; static presentation belongs in a class',
        });
    }

    const dimensions: DimensionVerdict[] = [
        verdictFor('structure', structureFindings),
        verdictFor('values', valueFindings),
        verdictFor('behaviour', behaviourFindings),
        verdictFor('responsive', responsiveFindings),
        verdictFor('icons', iconFindings),
        verdictFor('carrier', carrierFindings),
    ];
    const deviating = dimensions.filter((d) => d.verdict === 'deviates').map((d) => d.dimension);

    // The one place the shadow window is fed. Without this the records the
    // flip criterion is meant to read never exist, and its reverse trigger is
    // satisfied by construction — the defect a blind review caught on the
    // branch that introduced the module.
    if (input.shadowRoot !== undefined) {
        recordToleranceShadow(
            input.shadowRoot,
            valueRows.map((row, i) => ({ kind: valueKinds[i] as ValueKind, row })),
        );
    }

    return {
        dimensions,
        values: valueRows,
        overall: deviating.length > 0 ? 'deviates' : 'conforms',
        deviating,
    };
}

/** One line per dimension, then the value rows with their distances. */
export function formatConformanceReport(report: ConformanceReport): string {
    const lines: string[] = [];
    for (const d of report.dimensions) {
        const mark = d.verdict === 'conforms' ? '✅' : '❌';
        lines.push(`${mark} ${d.dimension}: ${d.verdict} (${String(d.findings.length)} finding(s))`);
        for (const f of d.findings) {
            lines.push(`     artifact: ${f.artifact}  ·  port: ${f.implementation}  —  ${f.detail}`);
        }
    }
    lines.push(
        `\noverall: ${report.overall}` +
            (report.deviating.length > 0 ? ` (${report.deviating.join(', ')})` : ''),
    );
    // Stated on every report, not only on a failing one: a reader who sees a
    // pass has to know what it did NOT measure.
    lines.push('pixel similarity is not a dimension here and cannot produce a pass on its own.');
    return lines.join('\n');
}
