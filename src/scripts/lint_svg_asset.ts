#!/usr/bin/env node
/**
 * lint_svg_asset — the static witness for a hand-authored SVG.
 *
 * Phase 1 of `road-to-svg-with-a-witness`. Six lanes in this suite produce
 * hand-authored SVG (a missing icon glyph, a geometric mark, an illustration,
 * a diagram, an animated asset, a wireframe canvas) and none of them had a
 * check beyond the agent's own belief. This reads the defect classes that are
 * visible in the SOURCE. The classes that only exist once rendered — fill
 * ratio against a class threshold, text fit, resolved font family, draw-on
 * dead time, a hole that is actually near-white paint — belong to the engine
 * witness (`ui:render --profile asset`) and are deliberately NOT here.
 *
 * ADVISORY, like `lint_design_quality` and the design pass (decision E5). A
 * blocking promotion is a consumer-facing default flip and is out of scope;
 * step 5.2 records the measured bar such a promotion would have to cite.
 *
 * Two corrections from the roadmap's own reproduction run are load-bearing:
 *
 *   R9  — every motion rule binds PER ELEMENT or PER CSS SELECTOR, never per
 *         file. A file-scoped "does this file mention transform-box" test
 *         passes a file whose wrong element sits beside a correct twin, which
 *         is exactly the pair the fixture plants.
 *   R12 — draw-on dead time is NOT a static rule. A `stroke-dasharray` without
 *         `pathLength` is an intentional spinner pattern as often as it is a
 *         guess, and only `getTotalLength()` in a browser can tell them apart.
 *         The rule lives in the engine layer (step 2.1).
 *
 * Inline-ignore (same shape as `lint_design_quality`, works in XML comments):
 *   svg-asset-disable <rule-id> [-- reason]            (file scope)
 *   svg-asset-disable-next-line <rule-id> [-- reason]
 *   svg-asset-disable-line <rule-id> [-- reason]
 *
 * Per-project config (`.svg-asset.json` in the project root):
 *   { "ignoreRules": ["svg-a11y-generic-id"], "ignoreFiles": ["vendor/**"] }
 *
 * Usage:
 *   lint_svg_asset --dir <path> [--delivery inline|img|css-bg|document]
 *   lint_svg_asset --file <a.svg> [--file <b.svg>] [--delivery …]
 *   lint_svg_asset --file <after.svg> --baseline <before.svg> --allow id,id
 *
 * Exit codes: 0 = clean, 2 = findings, 1 = internal error (including the
 * scanned-nothing refusal — a gate that scanned no file is not a clean gate).
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import {
    SMIL_TAGS,
    declarationsOf,
    firstSmilLine,
    hasCssAnimation,
    hasReducedMotionQuery,
    hasSmilMarkup,
    readCssRules,
    smilVerdict,
} from './_lib/svg_motion.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Where the file is embedded. It decides what can EXECUTE, which is why the
 * safety family reads it (step 1.5). An undeclared mode is graded as `inline`,
 * the strictest — never as the mode that happens to be convenient.
 */
export type DeliveryMode = 'inline' | 'document' | 'img' | 'css-bg';

export const DELIVERY_MODES: readonly DeliveryMode[] = ['inline', 'document', 'img', 'css-bg'];

export type Severity = 'error' | 'warning' | 'inert';

export interface Finding {
    rule: string;
    file: string;
    line: number;
    snippet: string;
    severity: Severity;
}

export interface ProjectConfig {
    ignoreRules?: string[];
    ignoreFiles?: string[];
}

/** One parsed element. Attribute values are raw (entity-decoded for `&amp;` only). */
export interface SvgElement {
    name: string;
    attrs: Record<string, string>;
    line: number;
    /** Character offset of the opening `<`. */
    start: number;
    selfClosing: boolean;
    closing: boolean;
    raw: string;
}

// ---------------------------------------------------------------------------
// A deliberately small scanner
// ---------------------------------------------------------------------------

/**
 * Elements in document order.
 *
 * Not a conformant XML parser and not trying to be: it skips comments, CDATA
 * and the prolog, and reads tag names plus attributes. Everything the rules
 * below need is attribute-level or text-level, and pulling in a real parser
 * would make a dependency-free linter depend on one.
 */
export function parseElements(content: string): SvgElement[] {
    const out: SvgElement[] = [];
    const lineOf = lineIndexer(content);
    let i = 0;
    while (i < content.length) {
        const lt = content.indexOf('<', i);
        if (lt === -1) break;
        // Comments, CDATA and the prolog carry no elements.
        if (content.startsWith('<!--', lt)) {
            const end = content.indexOf('-->', lt + 4);
            i = end === -1 ? content.length : end + 3;
            continue;
        }
        if (content.startsWith('<![CDATA[', lt)) {
            const end = content.indexOf(']]>', lt + 9);
            i = end === -1 ? content.length : end + 3;
            continue;
        }
        if (content.startsWith('<!', lt) || content.startsWith('<?', lt)) {
            // A DOCTYPE may carry a bracketed internal subset; skip past it.
            const bracket = content.indexOf('[', lt);
            const close = content.indexOf('>', lt);
            if (bracket !== -1 && close !== -1 && bracket < close) {
                const endBracket = content.indexOf(']', bracket);
                const after = endBracket === -1 ? close : content.indexOf('>', endBracket);
                i = after === -1 ? content.length : after + 1;
            } else {
                i = close === -1 ? content.length : close + 1;
            }
            continue;
        }
        const gt = findTagEnd(content, lt);
        if (gt === -1) break;
        const raw = content.slice(lt, gt + 1);
        const closing = raw.startsWith('</');
        const selfClosing = raw.endsWith('/>');
        const nameMatch = /^<\/?\s*([A-Za-z_][\w.:-]*)/.exec(raw);
        if (!nameMatch) {
            i = gt + 1;
            continue;
        }
        out.push({
            name: (nameMatch[1] ?? '').toLowerCase(),
            attrs: closing ? {} : parseAttrs(raw),
            line: lineOf(lt),
            start: lt,
            selfClosing,
            closing,
            raw,
        });
        i = gt + 1;
    }
    return out;
}

/** End of the tag, honouring quoted attribute values that may contain `>`. */
function findTagEnd(content: string, from: number): number {
    let quote: string | null = null;
    for (let i = from + 1; i < content.length; i++) {
        const ch = content[i] as string;
        if (quote) {
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '>') return i;
    }
    return -1;
}

function parseAttrs(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /([A-Za-z_:][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const key = (m[1] ?? '').toLowerCase();
        const value = m[3] ?? m[4] ?? '';
        attrs[key] = value.replace(/&amp;/g, '&');
    }
    return attrs;
}

function lineIndexer(content: string): (offset: number) => number {
    const starts: number[] = [0];
    for (let i = 0; i < content.length; i++) if (content[i] === '\n') starts.push(i + 1);
    return (offset: number): number => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] as number) <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
}

/** The text between an opening and its matching closing tag, for simple leaves. */
function textOf(content: string, elements: SvgElement[], index: number): string {
    const el = elements[index];
    if (!el || el.selfClosing) return '';
    const openEnd = content.indexOf('>', el.start);
    const closeTag = `</${el.name}`;
    const closeAt = content.toLowerCase().indexOf(closeTag, openEnd);
    if (openEnd === -1 || closeAt === -1) return '';
    return content.slice(openEnd + 1, closeAt);
}

// ---------------------------------------------------------------------------
// Shared readings
// ---------------------------------------------------------------------------

export interface ViewBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

export function readViewBox(el: SvgElement | undefined): ViewBox | null {
    const raw = el?.attrs['viewbox'];
    if (!raw) return null;
    const parts = raw.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    const [x, y, w, h] = parts as [number, number, number, number];
    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
}

/** Every `#id` this file points at, from `href`/`xlink:href` and from `url(#…)`. */
export function referencedIds(content: string, elements: SvgElement[]): Set<string> {
    const ids = new Set<string>();
    for (const el of elements) {
        for (const key of ['href', 'xlink:href']) {
            const v = el.attrs[key];
            if (v && v.startsWith('#')) ids.add(v.slice(1));
        }
    }
    const urlRe = /url\(\s*['"]?#([^)'"\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(content)) !== null) ids.add(m[1] as string);
    // `begin="other.end"` and `<set attributeName=…>` name elements too.
    const beginRe = /\b(?:begin|end)\s*=\s*"([A-Za-z_][\w.:-]*)\./g;
    while ((m = beginRe.exec(content)) !== null) ids.add(m[1] as string);
    return ids;
}


// ---------------------------------------------------------------------------
// Rule family — structure
// ---------------------------------------------------------------------------

function ruleMissingXmlns(elements: SvgElement[], file: string): Finding[] {
    const root = elements.find((el) => el.name === 'svg' && !el.closing);
    if (!root) return [];
    if (root.attrs['xmlns']) return [];
    return [
        {
            rule: 'svg-structure-missing-xmlns',
            file,
            line: root.line,
            snippet: 'root <svg> has no xmlns — the file does not render as a standalone document or through <img>',
            severity: 'error',
        },
    ];
}

interface Box {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * The box of an element whose geometry is fully numeric and untransformed.
 *
 * Returns `null` for anything else — a transform, a percentage, a unit, a
 * `path`. That conservatism is the rule's whole safety margin: a box this
 * function guesses at is a box the "entirely outside" test would flag wrongly.
 */
export function staticBox(el: SvgElement): Box | null {
    if (el.attrs['transform'] || el.attrs['style']?.includes('transform')) return null;
    const num = (k: string): number | null => {
        const v = el.attrs[k];
        if (v === undefined) return null;
        if (!/^-?\d+(\.\d+)?$/.test(v.trim())) return null;
        return Number(v);
    };
    switch (el.name) {
        case 'rect': {
            const x = num('x') ?? 0;
            const y = num('y') ?? 0;
            const w = num('width');
            const h = num('height');
            if (w === null || h === null) return null;
            return { minX: x, minY: y, maxX: x + w, maxY: y + h };
        }
        case 'circle': {
            const cx = num('cx') ?? 0;
            const cy = num('cy') ?? 0;
            const r = num('r');
            if (r === null) return null;
            return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
        }
        case 'ellipse': {
            const cx = num('cx') ?? 0;
            const cy = num('cy') ?? 0;
            const rx = num('rx');
            const ry = num('ry');
            if (rx === null || ry === null) return null;
            return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry };
        }
        case 'line': {
            const x1 = num('x1');
            const y1 = num('y1');
            const x2 = num('x2');
            const y2 = num('y2');
            if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
            return {
                minX: Math.min(x1, x2),
                minY: Math.min(y1, y2),
                maxX: Math.max(x1, x2),
                maxY: Math.max(y1, y2),
            };
        }
        default:
            return null;
    }
}

/** Is this element inside a `<defs>`, `<symbol>`, `<clipPath>`, `<mask>` or `<marker>`? */
function buildContainerDepth(elements: SvgElement[]): Map<number, string[]> {
    const stack: string[] = [];
    const out = new Map<number, string[]>();
    elements.forEach((el, idx) => {
        if (el.closing) {
            if (stack[stack.length - 1] === el.name) stack.pop();
            out.set(idx, [...stack]);
            return;
        }
        out.set(idx, [...stack]);
        if (!el.selfClosing) stack.push(el.name);
    });
    return out;
}

const NON_RENDERED_CONTAINERS = new Set(['defs', 'symbol', 'clippath', 'mask', 'marker', 'pattern']);

function ruleOutsideViewBox(elements: SvgElement[], file: string): Finding[] {
    const root = elements.find((el) => el.name === 'svg' && !el.closing);
    const vb = readViewBox(root);
    if (!vb) return [];
    const ancestry = buildContainerDepth(elements);
    const findings: Finding[] = [];
    elements.forEach((el, idx) => {
        if (el.closing) return;
        const chain = ancestry.get(idx) ?? [];
        if (chain.some((c) => NON_RENDERED_CONTAINERS.has(c))) return;
        // A transform anywhere up the chain moves the box; staticBox already
        // refuses an element with its own, and this refuses an inherited one.
        if (chain.length && hasTransformedAncestor(elements, idx)) return;
        const box = staticBox(el);
        if (!box) return;
        const outside =
            box.maxX <= vb.x || box.minX >= vb.x + vb.w || box.maxY <= vb.y || box.minY >= vb.y + vb.h;
        if (!outside) return;
        findings.push({
            rule: 'svg-structure-outside-viewbox',
            file,
            line: el.line,
            snippet:
                `<${el.name}> box (${box.minX},${box.minY})-(${box.maxX},${box.maxY}) lies entirely outside ` +
                `viewBox ${vb.x} ${vb.y} ${vb.w} ${vb.h} — it will never paint`,
            severity: 'error',
        });
    });
    return findings;
}

function hasTransformedAncestor(elements: SvgElement[], index: number): boolean {
    const stack: SvgElement[] = [];
    for (let i = 0; i < index; i++) {
        const el = elements[i] as SvgElement;
        if (el.closing) {
            if (stack[stack.length - 1]?.name === el.name) stack.pop();
            continue;
        }
        if (!el.selfClosing) stack.push(el);
    }
    return stack.some((el) => Boolean(el.attrs['transform']));
}

/**
 * Path-data grammar check.
 *
 * Reports only data that no conformant parser could accept — a command letter
 * followed by the wrong number of coordinates, or a stray token. A path whose
 * numbers are odd but well-formed is a design question, not a parse error.
 */
export function pathDataError(d: string): string | null {
    const trimmed = d.trim();
    if (!trimmed) return 'empty d attribute';
    if (!/^[mM]/.test(trimmed)) return 'path data does not start with a moveto command';
    const argCount: Record<string, number> = {
        m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0,
    };
    const tokens = trimmed.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    if (!tokens) return 'path data holds no commands';
    let i = 0;
    while (i < tokens.length) {
        const tok = tokens[i] as string;
        if (!/^[a-zA-Z]$/.test(tok)) return `unexpected token "${tok}" where a command letter was required`;
        const cmd = tok.toLowerCase();
        if (!(cmd in argCount)) return `unknown path command "${tok}"`;
        const need = argCount[cmd] as number;
        i += 1;
        if (need === 0) continue;
        let consumed = 0;
        while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i] as string)) {
            i += 1;
            consumed += 1;
        }
        if (consumed === 0 || consumed % need !== 0) {
            return `command "${tok}" takes ${need} coordinate(s) per repetition, got ${consumed}`;
        }
    }
    return null;
}

function ruleUnparseablePath(elements: SvgElement[], file: string): Finding[] {
    const findings: Finding[] = [];
    for (const el of elements) {
        if (el.closing) continue;
        const d = el.attrs['d'];
        if (d === undefined) continue;
        const err = pathDataError(d);
        if (err) {
            findings.push({
                rule: 'svg-structure-unparseable-path',
                file,
                line: el.line,
                snippet: `<${el.name} d="…"> ${err}`,
                severity: 'error',
            });
        }
    }
    return findings;
}

function ruleUnusedDefs(content: string, elements: SvgElement[], file: string): Finding[] {
    const used = referencedIds(content, elements);
    const ancestry = buildContainerDepth(elements);
    const findings: Finding[] = [];
    elements.forEach((el, idx) => {
        if (el.closing) return;
        const id = el.attrs['id'];
        if (!id) return;
        const chain = ancestry.get(idx) ?? [];
        if (!chain.includes('defs')) return;
        // A `<symbol>` is a sprite-sheet entry addressed from a HOST page, so
        // the file cannot see its own reference. Exempt by construction —
        // flagging it would red every sprite sheet in existence.
        if (el.name === 'symbol') return;
        if (used.has(id)) return;
        findings.push({
            rule: 'svg-structure-unused-defs',
            file,
            line: el.line,
            snippet: `<${el.name} id="${id}"> sits in <defs> and nothing in this file references it`,
            severity: 'warning',
        });
    });
    return findings;
}

function ruleDanglingReference(content: string, elements: SvgElement[], file: string): Finding[] {
    const defined = new Set<string>();
    for (const el of elements) if (!el.closing && el.attrs['id']) defined.add(el.attrs['id'] as string);
    const findings: Finding[] = [];
    const lineOf = lineIndexer(content);

    for (const el of elements) {
        if (el.closing) continue;
        for (const key of ['href', 'xlink:href']) {
            const v = el.attrs[key];
            if (!v || !v.startsWith('#')) continue;
            const id = v.slice(1);
            if (defined.has(id)) continue;
            findings.push({
                rule: 'svg-structure-dangling-reference',
                file,
                line: el.line,
                snippet: `<${el.name} ${key}="${v}"> points at an id this file does not define`,
                severity: 'error',
            });
        }
    }
    const urlRe = /url\(\s*['"]?#([^)'"\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(content)) !== null) {
        const id = m[1] as string;
        if (defined.has(id)) continue;
        findings.push({
            rule: 'svg-structure-dangling-reference',
            file,
            line: lineOf(m.index),
            snippet: `url(#${id}) points at an id this file does not define`,
            severity: 'error',
        });
    }
    return dedupe(findings);
}

// ---------------------------------------------------------------------------
// Rule family — safety, graded per delivery mode (step 1.5)
// ---------------------------------------------------------------------------

/**
 * What a delivery mode can execute.
 *
 * `inline` and `document` run script in an origin that matters, so active
 * content is an ERROR there. `img` and `css-bg` run nothing and load nothing,
 * so the same file is `inert` — reported, never called clean, because the same
 * bytes can be inlined tomorrow with no edit to the file (decision E12).
 */
export function safetySeverity(mode: DeliveryMode): Severity {
    return mode === 'img' || mode === 'css-bg' ? 'inert' : 'error';
}

const ACTIVE_ATTR_RE = /\son[a-z]+\s*=\s*["']/i;

function ruleActiveContent(
    content: string,
    elements: SvgElement[],
    file: string,
    mode: DeliveryMode,
): Finding[] {
    const severity = safetySeverity(mode);
    const findings: Finding[] = [];
    const lineOf = lineIndexer(content);

    for (const el of elements) {
        if (el.closing) continue;
        if (el.name === 'script' || el.name === 'foreignobject') {
            findings.push({
                rule: 'svg-safety-active-content',
                file,
                line: el.line,
                snippet: `<${el.name}> is active content; delivery mode "${mode}" grades it ${severity}`,
                severity,
            });
        }
        for (const [key, value] of Object.entries(el.attrs)) {
            if (/^on[a-z]+$/.test(key)) {
                findings.push({
                    rule: 'svg-safety-active-content',
                    file,
                    line: el.line,
                    snippet: `<${el.name} ${key}="…"> is an event handler; delivery mode "${mode}" grades it ${severity}`,
                    severity,
                });
            }
            if (/^\s*javascript:/i.test(value)) {
                findings.push({
                    rule: 'svg-safety-active-content',
                    file,
                    line: el.line,
                    snippet: `<${el.name} ${key}="javascript:…"> is an active URL; delivery mode "${mode}" grades it ${severity}`,
                    severity,
                });
            }
        }
    }
    // A handler written on an element the scanner did not turn into attributes
    // (an unquoted value, say) still has to be seen.
    if (!findings.length && ACTIVE_ATTR_RE.test(content)) {
        const idx = content.search(ACTIVE_ATTR_RE);
        findings.push({
            rule: 'svg-safety-active-content',
            file,
            line: lineOf(idx),
            snippet: `an on* event handler attribute is present; delivery mode "${mode}" grades it ${severity}`,
            severity,
        });
    }
    return dedupe(findings);
}

/**
 * An internal DTD subset or an entity declaration.
 *
 * A BARE public DOCTYPE is clean and deliberately so — exported assets carry
 * one routinely and it is harmless. What is not harmless is the bracketed
 * subset, which is where billion-laughs and external-entity payloads live.
 */
function ruleInternalSubset(content: string, file: string): Finding[] {
    const lineOf = lineIndexer(content);
    const findings: Finding[] = [];
    const entity = /<!ENTITY\b/i.exec(content);
    if (entity) {
        findings.push({
            rule: 'svg-safety-internal-subset',
            file,
            line: lineOf(entity.index),
            snippet: '<!ENTITY declaration — an entity-expansion surface; a bare public DOCTYPE is clean, this is not',
            severity: 'error',
        });
    }
    const doctype = /<!DOCTYPE[^>[]*\[/i.exec(content);
    if (doctype) {
        findings.push({
            rule: 'svg-safety-internal-subset',
            file,
            line: lineOf(doctype.index),
            snippet: 'DOCTYPE carries an internal subset "[…]" — strip it; a bare public DOCTYPE is clean',
            severity: 'error',
        });
    }
    return dedupe(findings);
}

const EXTERNAL_URL_RE = /^(?:https?:|ftp:|\/\/)/i;

function ruleExternalReference(
    content: string,
    elements: SvgElement[],
    file: string,
    mode: DeliveryMode,
): Finding[] {
    const severity = safetySeverity(mode);
    const findings: Finding[] = [];
    const lineOf = lineIndexer(content);

    for (const el of elements) {
        if (el.closing) continue;
        for (const key of ['href', 'xlink:href', 'src']) {
            const v = el.attrs[key];
            if (v && EXTERNAL_URL_RE.test(v)) {
                findings.push({
                    rule: 'svg-safety-external-reference',
                    file,
                    line: el.line,
                    snippet: `<${el.name} ${key}="${v.slice(0, 60)}"> loads from outside the file; mode "${mode}" grades it ${severity}`,
                    severity,
                });
            }
        }
    }
    const urlRe = /url\(\s*['"]?((?:https?:|ftp:|\/\/)[^)'"\s]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(content)) !== null) {
        findings.push({
            rule: 'svg-safety-external-reference',
            file,
            line: lineOf(m.index),
            snippet: `url(${(m[1] ?? '').slice(0, 60)}) loads from outside the file; mode "${mode}" grades it ${severity}`,
            severity,
        });
    }
    return dedupe(findings);
}

// ---------------------------------------------------------------------------
// Rule family — vector honesty (defect D3)
// ---------------------------------------------------------------------------

const RASTER_HREF_RE = /^(?:data:image\/(?:png|jpe?g|gif|webp|bmp|avif)|[^?#]*\.(?:png|jpe?g|gif|webp|bmp|avif)(?:[?#]|$))/i;

/** Geometry elements that ARE vector drawing. `rect`/`circle` count (D3's false red). */
export const VECTOR_GEOMETRY = new Set([
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'textpath', 'use',
]);

export interface VectorVerdict {
    /** `true` only when the file paints exclusively with vector geometry. */
    trueVector: boolean;
    rasterElements: number;
    vectorElements: number;
    reason: string;
}

/**
 * Replaces the presence-of-`<path>` check (`logo-generation/SKILL.md:53-55`),
 * which was false-green and false-red at once: a raster beside one dummy path
 * passed, and a mark built from `rect`/`circle` — the very thing that file
 * recommends — failed.
 */
export function vectorVerdict(elements: SvgElement[]): VectorVerdict {
    let raster = 0;
    let vector = 0;
    for (const el of elements) {
        if (el.closing) continue;
        if (el.name === 'image') {
            const href = el.attrs['href'] ?? el.attrs['xlink:href'] ?? '';
            if (RASTER_HREF_RE.test(href) || href.startsWith('data:image/')) raster += 1;
            else raster += 1; // an <image> of unknown type is still not vector geometry
            continue;
        }
        if (el.name === 'foreignobject') {
            raster += 1;
            continue;
        }
        if (VECTOR_GEOMETRY.has(el.name)) vector += 1;
    }
    if (raster > 0) {
        return {
            trueVector: false,
            rasterElements: raster,
            vectorElements: vector,
            reason: `carries ${raster} raster/foreignObject element(s) — not a true vector whatever else it contains`,
        };
    }
    return {
        trueVector: vector > 0,
        rasterElements: 0,
        vectorElements: vector,
        reason:
            vector > 0
                ? `${vector} vector geometry element(s), no embedded raster`
                : 'no painted geometry at all',
    };
}

function ruleEmbeddedRaster(elements: SvgElement[], file: string): Finding[] {
    const verdict = vectorVerdict(elements);
    if (verdict.rasterElements === 0) return [];
    const first = elements.find((el) => !el.closing && (el.name === 'image' || el.name === 'foreignobject'));
    return [
        {
            rule: 'svg-vector-embedded-raster',
            file,
            line: first?.line ?? 1,
            snippet: `${verdict.reason}; ${verdict.vectorElements} vector element(s) beside it does not make it one`,
            severity: 'error',
        },
    ];
}

// ---------------------------------------------------------------------------
// Rule family — accessibility
// ---------------------------------------------------------------------------

/**
 * Ids that collide the moment two graphics are inlined on one page (R7: two
 * inline graphics both using `id="title"` made the accessibility tree name
 * both after the first).
 */
export const GENERIC_IDS = new Set([
    'title', 'desc', 'a', 'b', 'c', 'g', 'gradient', 'grad', 'mask', 'clip', 'clippath',
    'shadow', 'icon', 'path', 'path1', 'layer1', 'layer_1', 'svg', 'defs', 'filter', 'glow',
]);

function ruleGenericId(elements: SvgElement[], file: string): Finding[] {
    const findings: Finding[] = [];
    for (const el of elements) {
        if (el.closing) continue;
        const id = el.attrs['id'];
        if (!id) continue;
        if (!GENERIC_IDS.has(id.toLowerCase())) continue;
        findings.push({
            rule: 'svg-a11y-generic-id',
            file,
            line: el.line,
            snippet: `id="${id}" collides with any second graphic inlined on the same page — namespace it`,
            severity: 'warning',
        });
    }
    return findings;
}

interface NameState {
    root: SvgElement | undefined;
    hidden: boolean;
    hasTitle: boolean;
    hasLabel: boolean;
    hasLabelledBy: boolean;
    /** `aria-labelledby` resolving to this graphic's own `<title>` — one name, not two. */
    labelledByOwnTitle: boolean;
    hasRoleImg: boolean;
}

function rootNameState(content: string, elements: SvgElement[]): NameState {
    const rootIdx = elements.findIndex((el) => el.name === 'svg' && !el.closing);
    const root = rootIdx === -1 ? undefined : elements[rootIdx];
    const titleIdx = elements.findIndex((el) => el.name === 'title' && !el.closing);
    const hasTitle = titleIdx !== -1 && textOf(content, elements, titleIdx).trim().length > 0;

    // `aria-labelledby="x"` + `<title id="x">` is the CANONICAL pattern, not a
    // collision: the attribute POINTS AT the title rather than competing with
    // it. Counting the pair as two names reds the one shape the accessibility
    // guidance actually asks for, which is the false red that gets a linter
    // switched off (Risk 1).
    const titleIds = new Set(
        elements
            .filter((el) => el.name === 'title' && !el.closing && el.attrs['id'])
            .map((el) => el.attrs['id'] as string),
    );
    const labelledBy = (root?.attrs['aria-labelledby'] ?? '').trim();
    const labelledByTargets = labelledBy.split(/\s+/).filter(Boolean);
    const labelledByOwnTitle =
        labelledByTargets.length > 0 && labelledByTargets.every((id) => titleIds.has(id));

    return {
        root,
        hidden: (root?.attrs['aria-hidden'] ?? '').toLowerCase() === 'true',
        hasTitle,
        hasLabel: Boolean(root?.attrs['aria-label']?.trim()),
        hasLabelledBy: labelledBy.length > 0,
        labelledByOwnTitle,
        hasRoleImg: (root?.attrs['role'] ?? '').toLowerCase() === 'img',
    };
}

function ruleAccessibleName(content: string, elements: SvgElement[], file: string): Finding[] {
    const s = rootNameState(content, elements);
    if (!s.root) return [];
    // A graphic declared decorative is correct with no name — that is the
    // other half of the pattern, not a gap in it.
    if (s.hidden) return [];
    if (s.hasTitle || s.hasLabel || s.hasLabelledBy) return [];
    return [
        {
            rule: 'svg-a11y-no-accessible-name',
            file,
            line: s.root.line,
            snippet:
                'graphic has no accessible name and is not aria-hidden="true" — add role="img" with a <title>, ' +
                'or declare it decorative',
            severity: 'error',
        },
    ];
}

function ruleDoubleName(content: string, elements: SvgElement[], file: string): Finding[] {
    const s = rootNameState(content, elements);
    if (!s.root) return [];
    // A labelledby that resolves to this graphic's own <title> is the SAME
    // name reached through a reference, so it is not counted twice.
    const labelledByIsSeparate = s.hasLabelledBy && !s.labelledByOwnTitle;
    const names = [s.hasLabel, labelledByIsSeparate, s.hasTitle].filter(Boolean).length;
    if (names < 2) return [];
    return [
        {
            rule: 'svg-a11y-double-name',
            file,
            line: s.root.line,
            snippet:
                'graphic declares more than one accessible name (aria-label / aria-labelledby / <title>) — ' +
                'only one wins and which one is renderer-dependent',
            severity: 'error',
        },
    ];
}

// ---------------------------------------------------------------------------
// Rule family — motion. Every rule binds per element or per selector (R9).
// ---------------------------------------------------------------------------

function ruleKeySplinesRange(elements: SvgElement[], file: string): Finding[] {
    const findings: Finding[] = [];
    for (const el of elements) {
        if (el.closing) continue;
        const raw = el.attrs['keysplines'];
        if (!raw) continue;
        const nums = raw.split(/[;\s,]+/).filter(Boolean).map(Number);
        const bad = nums.filter((n) => Number.isFinite(n) && (n < 0 || n > 1));
        if (!bad.length) continue;
        findings.push({
            rule: 'svg-motion-keysplines-range',
            file,
            line: el.line,
            snippet:
                `<${el.name} keySplines="${raw}"> holds ${bad.join(', ')} outside [0,1] — SMIL rejects the ` +
                'whole animation rather than clamping it, so the element never moves',
            severity: 'error',
        });
    }
    return findings;
}

/**
 * `transform-origin` without `transform-box`.
 *
 * PER ELEMENT and PER SELECTOR, which is the R9 correction: a file-scoped
 * "does `transform-box` appear anywhere" test passes a file whose wrong
 * element sits beside a correct twin, and the fixture plants exactly that.
 */
function ruleTransformBox(content: string, elements: SvgElement[], file: string): Finding[] {
    const findings: Finding[] = [];

    for (const el of elements) {
        if (el.closing) continue;
        const style = el.attrs['style'] ?? '';
        const decls = declarationsOf(style);
        const origin = decls['transform-origin'] ?? el.attrs['transform-origin'];
        if (!origin) continue;
        if (isOriginDefault(origin)) continue;
        const box = decls['transform-box'] ?? el.attrs['transform-box'];
        if (box) continue;
        findings.push({
            rule: 'svg-motion-transform-box',
            file,
            line: el.line,
            snippet:
                `<${el.name}> sets transform-origin: ${origin} with no transform-box — in SVG the origin ` +
                'resolves against the view box, not the element, so the pivot lands somewhere else',
            severity: 'error',
        });
    }

    for (const rule of readCssRules(content)) {
        const decls = declarationsOf(rule.body);
        const origin = decls['transform-origin'];
        if (!origin || isOriginDefault(origin)) continue;
        if (decls['transform-box']) continue;
        findings.push({
            rule: 'svg-motion-transform-box',
            file,
            line: rule.line,
            snippet:
                `selector "${rule.selector}" sets transform-origin: ${origin} with no transform-box — ` +
                'the pivot resolves against the view box',
            severity: 'error',
        });
    }
    return dedupe(findings);
}

function isOriginDefault(value: string): boolean {
    const v = value.trim().toLowerCase();
    return v === '0 0' || v === '0px 0px' || v === '0' || v === 'left top' || v === '0% 0%';
}

function ruleNoReducedMotion(content: string, elements: SvgElement[], file: string): Finding[] {
    if (!hasSmilMarkup(content) && !hasCssAnimation(content)) return [];
    if (hasReducedMotionQuery(content)) return [];
    const line = hasSmilMarkup(content)
        ? firstSmilLine(content)
        : (elements.find((el) => !el.closing)?.line ?? 1);
    return [
        {
            rule: 'svg-motion-no-reduced-motion',
            file,
            line,
            snippet:
                'the file animates and carries no prefers-reduced-motion route at all — a viewer who asked ' +
                'the OS to stop motion still gets it',
            severity: 'error',
        },
    ];
}

/**
 * SMIL whose only reduced-motion route is CSS (R4).
 *
 * Measured: under emulated `reduce`, a page-level `svg * { animation: none
 * !important }` left an `<animate>` moving `cx` from 20.2 to 76.8 in 700 ms.
 * CSS `animation` does not reach SMIL, so a file that believes it is covered
 * is covered by nothing. The reading itself lives in `_lib/svg_motion.ts`, so
 * DQ4's inline half (step 1.3) cannot drift away from this one.
 */
function ruleSmilCssOnlyBranch(content: string, file: string): Finding[] {
    if (smilVerdict(content) !== 'css-only') return [];
    return [
        {
            rule: 'svg-motion-smil-css-only',
            file,
            line: firstSmilLine(content),
            snippet:
                'this file animates with SMIL and its only reduced-motion route is a CSS declaration — ' +
                'CSS animation/transition properties do not reach SMIL, so the animation keeps running',
            severity: 'error',
        },
    ];
}

const PATH_COMMAND_RE = /[a-zA-Z]/g;

/**
 * An `<animate attributeName="d">` whose `values` entries are not the same
 * shape. SVG morphs a path by interpolating coordinate lists, so two values
 * with a different command count or a different command sequence do not
 * interpolate — the browser snaps instead of morphing, or refuses outright.
 */
function ruleDMorphMismatch(elements: SvgElement[], file: string): Finding[] {
    const findings: Finding[] = [];
    for (const el of elements) {
        if (el.closing) continue;
        if (!SMIL_TAGS.has(el.name)) continue;
        if ((el.attrs['attributename'] ?? '').toLowerCase() !== 'd') continue;
        const raw = el.attrs['values'];
        if (!raw) continue;
        const entries = raw.split(';').map((s) => s.trim()).filter(Boolean);
        if (entries.length < 2) continue;
        const shapes = entries.map((e) => (e.match(PATH_COMMAND_RE) ?? []).join('').toUpperCase());
        const first = shapes[0] as string;
        const differing = shapes.findIndex((s) => s !== first);
        if (differing === -1) continue;
        findings.push({
            rule: 'svg-motion-d-morph-mismatch',
            file,
            line: el.line,
            snippet:
                `<${el.name} attributeName="d"> value ${differing + 1} has command sequence "${shapes[differing]}" ` +
                `against "${first}" in value 1 — a path morph interpolates coordinates, not commands`,
            severity: 'error',
        });
    }
    return findings;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

function dedupe(findings: Finding[]): Finding[] {
    const seen = new Set<string>();
    const out: Finding[] = [];
    for (const f of findings) {
        const key = `${f.rule}::${f.file}::${f.line}::${f.snippet}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(f);
    }
    return out;
}

export interface ScanOptions {
    /** Undeclared is graded as `inline`, the strictest (step 1.5). */
    delivery?: DeliveryMode | undefined;
}

/** Every static finding for one file's bytes. */
export function scanSvg(content: string, relPath: string, opts: ScanOptions = {}): Finding[] {
    const mode: DeliveryMode = opts.delivery ?? 'inline';
    const elements = parseElements(content);
    const raw: Finding[] = [
        ...ruleMissingXmlns(elements, relPath),
        ...ruleOutsideViewBox(elements, relPath),
        ...ruleUnparseablePath(elements, relPath),
        ...ruleUnusedDefs(content, elements, relPath),
        ...ruleDanglingReference(content, elements, relPath),
        ...ruleActiveContent(content, elements, relPath, mode),
        ...ruleInternalSubset(content, relPath),
        ...ruleExternalReference(content, elements, relPath, mode),
        ...ruleEmbeddedRaster(elements, relPath),
        ...ruleGenericId(elements, relPath),
        ...ruleAccessibleName(content, elements, relPath),
        ...ruleDoubleName(content, elements, relPath),
        ...ruleKeySplinesRange(elements, relPath),
        ...ruleTransformBox(content, elements, relPath),
        ...ruleNoReducedMotion(content, elements, relPath),
        ...ruleSmilCssOnlyBranch(content, relPath),
        ...ruleDMorphMismatch(elements, relPath),
    ];
    const ignores = parseIgnores(content.split('\n'));
    return dedupe(raw).filter((f) => !isIgnored(ignores, f));
}

/**
 * Inline SVG inside a host HTML page.
 *
 * Each `<svg>…</svg>` is scanned on its own so a per-element rule keeps its
 * own line numbers, and the id rules then run once ACROSS the graphics —
 * which is the whole of R7: two graphics are each individually fine and
 * collide only together.
 */
export function scanHostHtml(content: string, relPath: string, opts: ScanOptions = {}): Finding[] {
    const mode: DeliveryMode = opts.delivery ?? 'inline';
    const findings: Finding[] = [];
    const lineOf = lineIndexer(content);
    const svgRe = /<svg\b[\s\S]*?<\/svg\s*>/gi;
    const graphics: Array<{ body: string; offset: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = svgRe.exec(content)) !== null) graphics.push({ body: m[0] ?? '', offset: m.index });

    for (const g of graphics) {
        const baseLine = lineOf(g.offset) - 1;
        // Two families are dropped for an inline graphic, each for a reason
        // the slice itself cannot see:
        //   · the host supplies the namespace, so a missing xmlns is correct;
        //   · the reduced-motion ROUTE may live in the host's own <style> or
        //     in a <picture> wrapper, and this slice ends at </svg>. Judging
        //     the route from inside the slice would red every correctly
        //     covered inline animation. DQ4 owns the inline case (step 1.3)
        //     and reads the whole document, which is where that answer is.
        for (const f of scanSvg(g.body, relPath, { delivery: mode })) {
            if (f.rule === 'svg-structure-missing-xmlns') continue;
            if (f.rule === 'svg-motion-no-reduced-motion') continue;
            if (f.rule === 'svg-motion-smil-css-only') continue;
            findings.push({ ...f, line: f.line + baseLine });
        }
    }

    // Cross-graphic id collisions — the finding R7 named.
    const seen = new Map<string, number>();
    for (const g of graphics) {
        const baseLine = lineOf(g.offset) - 1;
        for (const el of parseElements(g.body)) {
            if (el.closing) continue;
            const id = el.attrs['id'];
            if (!id) continue;
            const key = id.toLowerCase();
            if (seen.has(key)) {
                findings.push({
                    rule: 'svg-a11y-generic-id',
                    file: relPath,
                    line: el.line + baseLine,
                    snippet:
                        `id="${id}" is already used by another inline graphic on this page (line ${seen.get(key)}) — ` +
                        'the accessibility tree names both after the first',
                    severity: 'error',
                });
            } else {
                seen.set(key, el.line + baseLine);
            }
        }
    }

    const ignores = parseIgnores(content.split('\n'));
    return dedupe(findings).filter((f) => !isIgnored(ignores, f));
}

// ---------------------------------------------------------------------------
// Step 1.2 — preservation readout for a surgical edit
// ---------------------------------------------------------------------------

export interface PreservationChange {
    id: string;
    element: string;
    attribute: string;
    before: string;
    after: string;
}

/**
 * Canonicalised attribute map — number formatting, attribute order and
 * whitespace normalised away, so a re-serialisation that changed nothing reads
 * as nothing changed.
 */
export function canonicalAttrs(attrs: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of Object.keys(attrs).sort()) {
        const v = (attrs[key] ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g, (n) => {
                const num = Number(n);
                return Number.isFinite(num) ? String(Number(num.toFixed(4))) : n;
            });
        out[key] = v;
    }
    return out;
}

/**
 * Every element outside the allowed set that changed between two revisions.
 *
 * NO PIXEL DIFF decides this. Anti-aliasing and font metrics would make a
 * pixel comparison a per-machine verdict, and the discipline this witnesses —
 * `design-fidelity-mechanics.md` § surgical edits — is about which elements
 * the edit was allowed to touch, which is an attribute fact.
 */
export function preservationReadout(
    beforeContent: string,
    afterContent: string,
    allowedIds: readonly string[],
): PreservationChange[] {
    const allow = new Set(allowedIds.map((s) => s.trim()).filter(Boolean));

    /**
     * A stable key per element, and the id chain above it.
     *
     * An element WITHOUT an id is keyed by its nearest id-bearing ancestor plus
     * its tag and its ordinal INSIDE that ancestor — never by a document-wide
     * index. A document-wide index shifts for every element after an allowed
     * deletion, so removing one child of the allowed group reported every
     * un-idded element after it as changed. Measured on the `grouped-transforms`
     * triple: the correct edit reported `rect#7 (element)` and the readout could
     * not tell a clean surgical edit from a dirty one.
     */
    const index = (content: string): Map<string, { el: SvgElement; chain: string[] }> => {
        const map = new Map<string, { el: SvgElement; chain: string[] }>();
        const stack: Array<{ name: string; id: string | null }> = [];
        const ordinals = new Map<string, number>();
        for (const el of parseElements(content)) {
            if (el.closing) {
                if (stack[stack.length - 1]?.name === el.name) stack.pop();
                continue;
            }
            const chain = stack.map((f) => f.id).filter((x): x is string => x !== null);
            const ownerId = [...stack].reverse().find((f) => f.id !== null)?.id ?? '';
            const own = el.attrs['id'] ?? null;
            let key: string;
            if (own) {
                key = own;
            } else {
                const bucket = `${ownerId}/${el.name}`;
                const n = (ordinals.get(bucket) ?? 0) + 1;
                ordinals.set(bucket, n);
                key = `${bucket}#${n}`;
            }
            map.set(key, { el, chain: own ? [...chain, own] : chain });
            if (!el.selfClosing) stack.push({ name: el.name, id: own });
        }
        return map;
    };

    const before = index(beforeContent);
    const after = index(afterContent);
    const changes: PreservationChange[] = [];
    /** An element inside an allowed subtree is itself allowed. */
    const permitted = (entry: { chain: string[] } | undefined): boolean =>
        Boolean(entry && entry.chain.some((id) => allow.has(id)));

    for (const [key, beforeEntry] of before) {
        if (permitted(beforeEntry)) continue;
        const afterEntry = after.get(key);
        if (!afterEntry) {
            changes.push({
                id: key,
                element: beforeEntry.el.name,
                attribute: '(element)',
                before: 'present',
                after: 'removed',
            });
            continue;
        }
        const a = canonicalAttrs(beforeEntry.el.attrs);
        const b = canonicalAttrs(afterEntry.el.attrs);
        for (const attr of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if ((a[attr] ?? '') === (b[attr] ?? '')) continue;
            changes.push({
                id: key,
                element: beforeEntry.el.name,
                attribute: attr,
                before: a[attr] ?? '(absent)',
                after: b[attr] ?? '(absent)',
            });
        }
    }
    for (const [key, afterEntry] of after) {
        if (permitted(afterEntry) || before.has(key)) continue;
        changes.push({
            id: key,
            element: afterEntry.el.name,
            attribute: '(element)',
            before: 'absent',
            after: 'added',
        });
    }
    return changes;
}

// ---------------------------------------------------------------------------
// Inline-ignore + config
// ---------------------------------------------------------------------------

const ALL_LINES = 10_000;

export function parseIgnores(lines: string[]): Map<string, Set<number>> {
    const ignores = new Map<string, Set<number>>();
    const add = (rule: string, line: number): void => {
        const set = ignores.get(rule) ?? new Set<number>();
        set.add(line);
        ignores.set(rule, set);
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const next = /svg-asset-disable-next-line\s+([\w-]+)/i.exec(line);
        if (next?.[1]) add(next[1].toLowerCase(), i + 2);
        const same = /svg-asset-disable-line\s+([\w-]+)/i.exec(line);
        if (same?.[1]) add(same[1].toLowerCase(), i + 1);
        const whole = /svg-asset-disable\s+([\w-]+)/i.exec(line);
        if (whole?.[1] && !/-next-line|-line\s/.test(line)) {
            const set = new Set<number>();
            for (let n = 1; n <= ALL_LINES; n++) set.add(n);
            ignores.set(whole[1].toLowerCase(), set);
        }
    }
    return ignores;
}

function isIgnored(ignores: Map<string, Set<number>>, finding: Finding): boolean {
    return ignores.get(finding.rule.toLowerCase())?.has(finding.line) ?? false;
}

export function loadConfig(dir: string): ProjectConfig {
    const configPath = path.join(dir, '.svg-asset.json');
    if (!fs.existsSync(configPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ProjectConfig;
    } catch {
        return {};
    }
}

function* walkDir(dir: string, ext: RegExp): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        if (entry.isDirectory()) yield* walkDir(full, ext);
        else if (ext.test(entry.name)) yield full;
    }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readFlag(args: string[], name: string): string | undefined {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
}

function readAll(args: string[], name: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[i + 1] as string);
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = [...argv];
    const jsonMode = args.includes('--json');
    const quiet = args.includes('--quiet');
    const deliveryRaw = readFlag(args, '--delivery');
    if (deliveryRaw && !DELIVERY_MODES.includes(deliveryRaw as DeliveryMode)) {
        process.stderr.write(
            `[lint_svg_asset] unknown --delivery "${deliveryRaw}"; expected one of ${DELIVERY_MODES.join(', ')}\n`,
        );
        return 1;
    }
    const delivery = deliveryRaw as DeliveryMode | undefined;

    // --- step 1.2: preservation readout -------------------------------------
    const baseline = readFlag(args, '--baseline');
    if (baseline) {
        const files = readAll(args, '--file');
        const after = files[0];
        if (!after) {
            process.stderr.write('[lint_svg_asset] --baseline needs a --file <after.svg> to compare against\n');
            return 1;
        }
        if (!fs.existsSync(baseline) || !fs.existsSync(after)) {
            process.stderr.write('[lint_svg_asset] --baseline or --file path not found\n');
            return 1;
        }
        const allow = (readFlag(args, '--allow') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const changes = preservationReadout(
            fs.readFileSync(baseline, 'utf-8'),
            fs.readFileSync(after, 'utf-8'),
            allow,
        );
        if (jsonMode) {
            process.stdout.write(`${JSON.stringify(changes, null, 2)}\n`);
            return changes.length ? 2 : 0;
        }
        if (!changes.length) {
            if (!quiet) {
                process.stdout.write(
                    `✅  lint_svg_asset --baseline: nothing changed outside ${allow.length} allowed id(s).\n`,
                );
            }
            return 0;
        }
        for (const c of changes) {
            process.stdout.write(
                `❌ ${after} [svg-preserve-changed-outside-allowed] <${c.element} id="${c.id}"> ` +
                    `${c.attribute}: "${c.before}" → "${c.after}"\n`,
            );
        }
        process.stdout.write(
            `\nlint_svg_asset: ${changes.length} element change(s) outside the allowed set. ` +
                'A surgical edit touches only what it declared.\n',
        );
        return 2;
    }

    // --- scanning -----------------------------------------------------------
    const explicit = readAll(args, '--file');
    const dirArg = readFlag(args, '--dir');
    const targets: string[] = [];
    let roots: string[] = [];

    if (explicit.length) {
        targets.push(...explicit.map((f) => path.resolve(f)));
        roots = targets;
    } else {
        const scanDir = dirArg ? path.resolve(dirArg) : path.resolve(process.cwd(), 'src');
        roots = [scanDir];
        if (!fs.existsSync(scanDir)) {
            if (!quiet) process.stderr.write(`[lint_svg_asset] scan directory not found: ${scanDir}\n`);
            process.stderr.write(
                'This linter is opt-in. Run with --dir <path> or --file <a.svg> pointing at your assets.\n',
            );
            return 0;
        }
        for (const f of walkDir(scanDir, /\.(svg|html|htm)$/i)) targets.push(f);
    }

    const config = loadConfig(process.cwd());
    const ignoreRules = new Set((config.ignoreRules ?? []).map((r) => r.toLowerCase()));
    const ignoreGlobs = config.ignoreFiles ?? [];
    const scanned = targets.filter((f) => !ignoreGlobs.some((g) => f.includes(g.replace('**', ''))));

    try {
        assertScanned({ gate: 'lint_svg_asset', scanned: scanned.length, units: 'SVG/HTML file(s)', roots });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const all: Finding[] = [];
    for (const abs of scanned) {
        const rel = path.relative(process.cwd(), abs);
        try {
            const content = fs.readFileSync(abs, 'utf-8');
            const findings = /\.svg$/i.test(abs)
                ? scanSvg(content, rel, { delivery })
                : scanHostHtml(content, rel, { delivery });
            all.push(...findings.filter((f) => !ignoreRules.has(f.rule.toLowerCase())));
        } catch (err) {
            if (!quiet) process.stderr.write(`[lint_svg_asset] error: ${abs}: ${err}\n`);
        }
    }

    if (jsonMode) {
        process.stdout.write(`${JSON.stringify(all, null, 2)}\n`);
        return all.length > 0 ? 2 : 0;
    }
    if (!all.length) {
        if (!quiet) {
            process.stdout.write(
                `✅  lint_svg_asset: clean — ${scanned.length} file(s) checked, no violations.\n`,
            );
        }
        return 0;
    }
    const errors = all.filter((f) => f.severity === 'error');
    const warnings = all.filter((f) => f.severity === 'warning');
    const inert = all.filter((f) => f.severity === 'inert');
    for (const f of all) {
        const icon = f.severity === 'error' ? '❌' : f.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
        process.stdout.write(`${icon} ${f.file}:${f.line} [${f.rule}] ${f.snippet}\n`);
    }
    process.stdout.write(
        `\nlint_svg_asset: ${errors.length} error(s), ${warnings.length} warning(s), ${inert.length} inert. ` +
            'Use svg-asset-disable-next-line <rule> -- reason or .svg-asset.json to suppress. ' +
            'Advisory: an "inert" row is not a clean row — the same file inlined tomorrow is an error.\n',
    );
    return 2;
}

/* c8 ignore start — entrypoint guard, exercised by the CLI not by the tests */
const invokedDirectly =
    typeof process !== 'undefined' &&
    Array.isArray(process.argv) &&
    /lint_svg_asset\.(ts|js)$/.test(process.argv[1] ?? '');
if (invokedDirectly) process.exit(main());
/* c8 ignore stop */
