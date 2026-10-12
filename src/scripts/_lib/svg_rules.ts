/**
 * svg_rules — the SVG rule set, with no command-line surface attached.
 *
 * Split out of `lint_svg_asset.ts` for a measured reason, not a tidy one, and
 * the routing it was split FOR IS NOW LIVE.
 *
 * THIS PARAGRAPH USED TO SAY THE OPPOSITE, and it was false the moment the
 * routing landed — finding 10 of that change's own completion review, which is
 * the cheapest kind of defect to leave behind and the most expensive to read: a
 * reader opening this file to decide whether it sits on a hot path was told it
 * does not.
 *
 * It does. `hooks/design_pass_hook.ts` routes every `.svg` write here through
 * `hooks/svg_rules_loader.ts`, and `package.json`'s `build:hook-chunks` emits
 * this module as `dist/hooks/svg_rules.chunk.cjs` for exactly that. The chunk
 * is why it is live without being expensive: step 1.4 of
 * `road-to-svg-with-a-witness` imported these rules STATICALLY into the one
 * bundle every hook event loads — 30,924 bytes, 12,931 past the ceiling — and
 * an independent council refused it 2/2. Loaded as a chunk the same rules cost
 * 2,128 bytes in that bundle and are `require`d only for a path ending in
 * `.svg`.
 *
 * So: this module is on the `.svg` write path and on no other. Anything added
 * here is paid by an SVG write and by nothing else — a budget, not a licence.
 * Its other consumers are `lint_svg_asset` and the fixture report.
 *
 * `lint_svg_asset.ts` is now the CLI over this module and re-exports it, so
 * every existing import keeps resolving.
 */

import { attrsOf, parseDocument, tagEnd, type XmlDocument, type XmlNode } from './svg_dom.js';
import {
    type Box,
    elementExtent,
    pathDataError,
    pathExtent,
    pointsExtent,
    staticBox,
    tokenisePath,
} from './svg_geometry.js';

export { elementExtent, pathDataError, pathExtent, pointsExtent, staticBox, tokenisePath };
export type { Box };
import {
    SMIL_TAGS,
    declarationsOf,
    firstSmilLine,
    hasCssAnimation,
    hasReducedMotionQuery,
    hasSmilMarkup,
    readCssRules,
    smilVerdict,
} from './svg_motion.js';

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
        if (content.startsWith('<?', lt)) {
            // A PROCESSING INSTRUCTION ENDS AT `?>`, NEVER AT THE FIRST `>`.
            //
            // Finding 3 of the third completion review, reproduced by running
            // `scanSvg`: this branch shared the DOCTYPE's first-`>` search, so
            // `<?xml-stylesheet href="a.css?x=1><script/>"?>` — a legal PI
            // whose quoted pseudo-attribute contains a `>` — ended early and
            // the remainder was parsed as markup. `<script/>` then became a
            // real element and the file was reported
            // `svg-safety-active-content` at severity `error`, on a document
            // that contains no script. Under finding 4's static-only path that
            // false error is a BLOCKING refusal, so the two compound.
            //
            // `svg_dom.parseDocument` always did this correctly; the two
            // scanners disagreeing about where the prolog ends is what the
            // module header below now says plainly instead of claiming they
            // are one scan.
            const end = content.indexOf('?>', lt + 2);
            i = end === -1 ? content.length : end + 2;
            continue;
        }
        if (content.startsWith('<!', lt)) {
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
        const gt = tagEnd(content, lt);
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
            attrs: closing ? {} : attrsOf(raw),
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


/**
 * Blank out every XML comment, preserving offsets and line breaks.
 *
 * Finding 2.3 of `road-to-svg-rules-in-the-dispatch-path`, from the R2
 * completion review of the parent change: `parseElements` skips comments and
 * the content-level regex rules did not, so the two disagreed about what the
 * file contains. A commented `url(#x)` marked a `<defs>` entry used, and a
 * commented `@media (prefers-reduced-motion)` suppressed the
 * no-reduced-motion rule — in both directions a finding was lost to markup
 * that does not render.
 *
 * Every character inside `<!--` … `-->` becomes a space, the delimiters
 * included, and newlines are kept. That keeps every offset and every line
 * number identical to the raw text, so a rule can report a position in the
 * masked string and have it mean the same thing in the file. An unterminated
 * comment masks to end of input, which is what a browser does with it too.
 *
 * NOT applied to `parseIgnores`, deliberately: the inline
 * `svg-asset-disable` markers LIVE in comments, so masking them would make every one of them silently stop
 * working. The raw text is the right input there and the masked text is the
 * right input everywhere else.
 */
export function maskComments(content: string): string {
    if (!content.includes('<!--')) return content;
    const out = content.split('');
    let i = 0;
    while (i < out.length) {
        const start = content.indexOf('<!--', i);
        if (start === -1) break;
        const close = content.indexOf('-->', start + 4);
        const end = close === -1 ? content.length : close + 3;
        for (let j = start; j < end; j += 1) {
            if (out[j] !== '\n' && out[j] !== '\r') out[j] = ' ';
        }
        i = end;
    }
    return out.join('');
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
    const root = elements.find((el) => localName(el.name) === 'svg' && !el.closing);
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
    const root = elements.find((el) => localName(el.name) === 'svg' && !el.closing);
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

// An UNQUOTED value counts. Finding 1 of the fifth completion review: this
// fallback exists because the attribute parser only sees quoted values, and it
// required a quote itself — so `onload=alert(1)`, which every browser runs,
// produced zero findings while `onload="alert(1)"` produced an error. The
// safety family missing the unquoted spelling is the one miss that matters,
// because an attacker writes whichever spelling is not checked.
const ACTIVE_ATTR_RE = /\son[a-z]+\s*=\s*(["']|[^\s>"'])/i;

/** An element's name without its namespace prefix: `svg:script` is a `script`. */
export function localName(name: string): string {
    return name.replace(/^[^:]*:/, '');
}

/** Elements that run or embed foreign content when the graphic is inlined. */
const ACTIVE_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object']);

/** A URL that executes or opens a document when followed. */
const isActiveUrl = (raw: string): boolean => /^(javascript:|data:text\/html)/i.test(resolvedUrl(raw));

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
        const local = localName(el.name);
        // SMIL that writes an active URL into an href is the same href, later.
        const animatesHref =
            (local === 'set' || local === 'animate') && /^(xlink:)?href$/i.test(el.attrs['attributename'] ?? '');
        if (
            animatesHref &&
            ['to', 'from', 'by', 'values'].some((k) => (el.attrs[k] ?? '').split(';').some(isActiveUrl))
        ) {
            findings.push({
                rule: 'svg-safety-active-content',
                file,
                line: el.line,
                snippet: `<${el.name} attributeName="href"> animates in an active URL; delivery mode "${mode}" grades it ${severity}`,
                severity,
            });
        }
        if (ACTIVE_ELEMENTS.has(local)) {
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
            if (isActiveUrl(value)) {
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

const NAMED_URL_ENTITIES: Record<string, string> = {
    colon: ':', sol: '/', tab: '\t', newline: '\n', period: '.', lpar: '(', rpar: ')', amp: '&',
};

/**
 * The URL a browser would actually resolve from an attribute value: character
 * references decoded, leading/trailing C0 controls and spaces stripped, tab and
 * newline removed anywhere. The trailing `;` of a reference is optional on
 * purpose: an `.svg` parsed as XML needs it, but the same graphic inlined in an
 * HTML host is parsed by the HTML tokenizer, which decodes `&#106avascript:`
 * too — over-reading XML here costs precision, under-reading HTML costs a miss.
 * The raw value is attacker-chosen, so a scheme test
 * against it is a test of one spelling — ` https:`, `ht\ttps:`, `&#106;avascript:`
 * all load, and all passed.
 */
export function resolvedUrl(raw: string): string {
    const decoded = raw.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi, (m, hex, dec, name) => {
        const cp = hex ? parseInt(hex, 16) : dec ? parseInt(dec, 10) : NaN;
        if (!Number.isNaN(cp)) return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
        return NAMED_URL_ENTITIES[(name as string).toLowerCase()] ?? m;
    });
    return decoded.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[\t\n\r]/g, '');
}

/** CSS escapes decoded: `\\68 ` and `\\h` both read `h`. */
function cssUnescape(raw: string): string {
    return raw.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (m, hex, ch) => {
        if (hex) {
            const cp = parseInt(hex, 16);
            return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
        }
        return ch as string;
    });
}

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
            if (v && EXTERNAL_URL_RE.test(resolvedUrl(v))) {
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
    // `@import "https://…"` names its target without `url()`. The target is
    // resolved before the scheme test — XML references and CSS escapes both
    // reach the stylesheet loader decoded.
    const importRe = /@import\s+(?:url\(\s*)?(['"])([^'"]*)\1/gi;
    while ((m = importRe.exec(content)) !== null) {
        const target = resolvedUrl(cssUnescape(resolvedUrl(m[2] ?? '')));
        if (!EXTERNAL_URL_RE.test(target)) continue;
        findings.push({
            rule: 'svg-safety-external-reference',
            file,
            line: lineOf(m.index),
            snippet: `@import "${target.slice(0, 60)}" loads from outside the file; mode "${mode}" grades it ${severity}`,
            severity,
        });
    }
    return dedupe(findings);
}

// ---------------------------------------------------------------------------
// Rule family — vector honesty (defect D3)
// ---------------------------------------------------------------------------


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
            // EVERY `<image>` counts, whatever it points at. Finding 7 of the
            // fifth completion review: both arms of the `if` added 1, so the
            // test and the regex behind it decided nothing — a dead constant
            // and a dead branch dressed as a discrimination, which is the
            // class this change has now found five times under other names.
            // The comment on the else arm was the correct rule all along: an
            // `<image>` of unknown type is still not vector geometry, and an
            // href this scanner cannot classify is exactly the case where
            // guessing "vector" would be the unsafe answer.
            raster += 1;
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

/** Is `elements[index]` a direct child of the root `<svg>`? */
/**
 * Is the element at `index` a direct child of the root graphic?
 *
 * Counts open/close depth over the flat list. Step 3.1 of
 * `road-to-svg-review-followups` moved the AUTHORITY for this question onto
 * the parse tree ({@link directChildrenOfRoot}); this stays as the flat
 * reading it is cross-checked against, because a depth counter and a tree
 * agreeing on every fixture is evidence the tree is right, while replacing one
 * with the other is evidence of nothing.
 */
function isDirectChildOfRoot(elements: SvgElement[], index: number): boolean {
    let depth = 0;
    for (let i = 0; i < index; i++) {
        const el = elements[i] as SvgElement;
        if (el.closing) depth -= 1;
        else if (!el.selfClosing) depth += 1;
    }
    return depth === 1;
}

/**
 * The root graphic's direct element children, from the parse tree.
 *
 * Parentage decided by ancestry rather than by a depth count: the two agree on
 * a well-formed file and the tree is the one that stays right on a file that
 * is not, because a stray closing tag moves a depth counter and does not move
 * an ancestor chain.
 */
export function directChildrenOfRoot(doc: XmlDocument): XmlNode[] {
    const root = doc.elements.find((el) => localName(el.name) === 'svg');
    if (root === undefined) return [];
    return root.children.filter((n) => n.kind === 'element');
}

/**
 * Well-formedness, reported rather than assumed.
 *
 * Step 3.1. `<g><path></g></path>` carries both tags, both spelled correctly,
 * and is not a tree — which is precisely what a flat element list cannot see
 * and what a pattern over the raw text cannot decide. A file that does not
 * parse is a FINDING, never a skipped file: a skip reads as clean in every
 * count that matters.
 *
 * Capped at the first five errors. One mistake inside a deep document can
 * produce an error per remaining tag, and a wall of them buries the first,
 * which is the only one a reader can act on.
 */
/**
 * A gradient whose stops are all the same colour is a flat fill in costume.
 *
 * Step 3.1 of `road-to-svg-from-a-live-session`. A rejected 195 KB trace
 * carried 355 gradient definitions, nine of them with identical stops, and the
 * static witness reported one finding: a missing accessible name. Two external
 * reviews counted the gradients by hand. This is cheap to decide from the
 * bytes and nothing was deciding it.
 *
 * WARNING, not an error. A degenerate gradient renders correctly; it costs
 * bytes and makes a file harder to edit, which is a reading rather than a
 * defect — and the cost family above it is deliberately ungated for the same
 * reason.
 *
 * Colour comparison is textual after whitespace and case normalisation, so
 * `#FFF` and `#ffffff` are NOT reported as identical. That is the conservative
 * direction: a false negative costs a reading, a false positive costs trust in
 * every other finding beside it.
 */
function ruleDegenerateGradient(elements: SvgElement[], file: string): Finding[] {
    const findings: Finding[] = [];
    const open: Array<{ el: SvgElement; stops: Array<{ color: string; opacity: string }> }> = [];
    for (const el of elements) {
        if (el.name === 'lineargradient' || el.name === 'radialgradient') {
            if (el.closing) {
                const g = open.pop();
                if (!g || g.stops.length < 2) continue;
                const first = g.stops[0] as { color: string; opacity: string };
                const same = g.stops.every((s) => s.color === first.color && s.opacity === first.opacity);
                if (!same) continue;
                findings.push({
                    rule: 'svg-structure-degenerate-gradient',
                    file,
                    line: g.el.line,
                    snippet:
                        `<${g.el.name} id="${g.el.attrs['id'] ?? ''}"> has ${String(g.stops.length)} stops, all ` +
                        `${first.color || '(inherited)'} at opacity ${first.opacity} — a flat fill in a gradient's ` +
                        'clothes, which costs bytes and makes the file harder to edit',
                    severity: 'warning',
                });
            } else if (!el.selfClosing) {
                open.push({ el, stops: [] });
            }
            continue;
        }
        if (el.name === 'stop' && !el.closing) {
            const host = open[open.length - 1];
            if (!host) continue;
            const style = el.attrs['style'] ?? '';
            const fromStyle = /stop-color\s*:\s*([^;]+)/i.exec(style)?.[1];
            const opacityFromStyle = /stop-opacity\s*:\s*([^;]+)/i.exec(style)?.[1];
            host.stops.push({
                color: (fromStyle ?? el.attrs['stop-color'] ?? '').trim().toLowerCase(),
                opacity: (opacityFromStyle ?? el.attrs['stop-opacity'] ?? '1').trim(),
            });
        }
    }
    return findings;
}

function ruleWellFormed(doc: XmlDocument, file: string): Finding[] {
    if (doc.errors.length === 0) return [];
    const shown = doc.errors.slice(0, 5);
    const more = doc.errors.length - shown.length;
    return shown.map((e, i) => ({
        rule: 'svg-structure-not-well-formed',
        file,
        line: e.line,
        snippet:
            `${e.message} (column ${String(e.column)})` +
            (i === shown.length - 1 && more > 0 ? ` — and ${String(more)} further error(s)` : ''),
        severity: 'error' as Severity,
    }));
}

function rootNameState(content: string, doc: XmlDocument, elements: SvgElement[]): NameState {
    const rootIdx = elements.findIndex((el) => localName(el.name) === 'svg' && !el.closing);
    const root = rootIdx === -1 ? undefined : elements[rootIdx];
    // A DIRECT child of the root only. The first `<title>` ANYWHERE was wrong
    // in both directions: a chart's nested series title read as the graphic's
    // name, producing a false `svg-a11y-double-name` beside an `aria-label`,
    // and hiding a genuinely unnamed graphic behind a descendant's title.
    const titleIdx = elements.findIndex(
        (el, i) => el.name === 'title' && !el.closing && rootIdx !== -1 && isDirectChildOfRoot(elements, i),
    );
    // Step 3.1: the PARSE TREE decides parentage, and the depth count above is
    // kept as the reading it is checked against. The two agree on every
    // well-formed file; where they disagree the file is not well-formed, which
    // `svg-structure-not-well-formed` already reports, and the tree is the one
    // that is still right — a stray closing tag moves a depth counter and does
    // not move an ancestor chain.
    const titleIsDirectChild = directChildrenOfRoot(doc).some((n) => n.name === 'title');
    const hasTitle =
        titleIsDirectChild && titleIdx !== -1 && textOf(content, elements, titleIdx).trim().length > 0;

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

function ruleAccessibleName(s: NameState, file: string): Finding[] {
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

function ruleDoubleName(s: NameState, file: string): Finding[] {
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
    // ONE parse, and ONE name state. Finding 10 of the third completion
    // review, re-measured because the previous round's disposition was taken
    // on the wrong regime: over the seven small real fixtures the duplicate
    // parse is 0.03% of the dispatch, which is why it was accepted then — but
    // on a 760 KB file `parseDocument` is 8.2 ms against a 163 ms `scanSvg`,
    // so two redundant parses plus a recomputed name state are about 10% of a
    // pass that now runs on every `.svg` write. The document and the state are
    // passed rather than cached: a module-level cache in a hook is shared
    // mutable state, and the only thing that needed fixing was recomputation
    // inside one call.
    const doc = parseDocument(content);
    const nameState = rootNameState(content, doc, elements);
    // Finding 2.3: the content-level rules read the SAME file the element
    // parser reads. `maskComments` keeps every offset, so a line number taken
    // here still names the right line in the raw text.
    const text = maskComments(content);
    const raw: Finding[] = [
        ...ruleWellFormed(doc, relPath),
        // No `text` argument: the rule reads elements only, and comment
        // skipping already happened inside `parseElements`. Passing the masked
        // text told a reader the parameter was load-bearing (finding 12);
        // `no-unused-vars` could not catch it because two later parameters were
        // used.
        ...ruleDegenerateGradient(elements, relPath),
        ...ruleMissingXmlns(elements, relPath),
        ...ruleOutsideViewBox(elements, relPath),
        ...ruleUnparseablePath(elements, relPath),
        ...ruleUnusedDefs(text, elements, relPath),
        ...ruleDanglingReference(text, elements, relPath),
        ...ruleActiveContent(text, elements, relPath, mode),
        ...ruleInternalSubset(text, relPath),
        ...ruleExternalReference(text, elements, relPath, mode),
        ...ruleEmbeddedRaster(elements, relPath),
        ...ruleGenericId(elements, relPath),
        ...ruleAccessibleName(nameState, relPath),
        ...ruleDoubleName(nameState, relPath),
        ...ruleKeySplinesRange(elements, relPath),
        ...ruleTransformBox(text, elements, relPath),
        ...ruleNoReducedMotion(text, elements, relPath),
        ...ruleSmilCssOnlyBranch(text, relPath),
        ...ruleDMorphMismatch(elements, relPath),
    ];
    // RAW, not masked — the inline `svg-asset-disable` markers live in comments.
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
/**
 * The TOP-LEVEL `<svg>` elements of a host document, by offset.
 *
 * Depth-counted, not matched. Finding 3 of the fifth completion review: the
 * non-greedy `/<svg\b[\s\S]*?<\/svg\s*>/` ended at the FIRST `</svg>`, which
 * on a graphic containing a nested `<svg>` — legal, and how a sprite or a
 * symbol is embedded — is the inner one. The slice was then a truncated
 * fragment, so the host reported a FALSE `svg-structure-not-well-formed` for
 * an unclosed root AND missed everything after the inner close, including a
 * real `<script>` that the same bytes report correctly when scanned flat. A
 * false structure error and a missed active-content error, from one regex.
 *
 * A nested graphic is part of its parent and is not returned separately: the
 * rules read the whole thing, exactly as a browser does.
 */
/**
 * Blank the BODY of every `<script>` and `<style>`, offsets and newlines kept.
 *
 * Finding 1 of the review of this branch, and it is a regression this branch
 * introduced: emitting an unterminated graphic made `topLevelGraphics` count
 * `<svg …>` wherever it appears — including inside a JavaScript string, where
 * it is text rather than markup. A host containing NO SVG element at all, but
 * mentioning one in a script, went from zero findings to five, four of them in
 * the blocking families the static witness counts. Fail-CLOSED rather than
 * fail-open, so it refuses a valid document instead of passing a bad one, but
 * a gate that refuses a correct turn is the failure this change has spent six
 * rounds removing.
 *
 * The tags survive; only what is between them is blanked. `ruleActiveContent`
 * keys on the element NAME, so a real `<script>` inside a graphic is still
 * found — masking its body hides nothing the rules read.
 */
function maskScriptBodies(content: string): string {
    const out = content.split('');
    const re = /<(script|style)\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
        const bodyStart = m.index + m[0].length;
        const close = content.toLowerCase().indexOf(`</${(m[1] as string).toLowerCase()}`, bodyStart);
        const bodyEnd = close === -1 ? content.length : close;
        for (let i = bodyStart; i < bodyEnd; i += 1) {
            if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
        }
        re.lastIndex = bodyEnd;
    }
    return out.join('');
}

function topLevelGraphics(text: string): Array<{ start: number; end: number }> {
    const out: Array<{ start: number; end: number }> = [];
    const tagRe = /<(\/?)svg\b[^>]*?(\/?)>/gi;
    let depth = 0;
    let start = -1;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(text)) !== null) {
        const closing = t[1] === '/';
        const selfClosing = t[2] === '/';
        if (closing) {
            if (depth === 0) continue;
            depth -= 1;
            if (depth === 0 && start !== -1) {
                out.push({ start, end: t.index + t[0].length });
                start = -1;
            }
            continue;
        }
        if (selfClosing) {
            // An empty graphic at top level is still a graphic.
            if (depth === 0) out.push({ start: t.index, end: t.index + t[0].length });
            continue;
        }
        if (depth === 0) start = t.index;
        depth += 1;
    }
    // AN UNTERMINATED GRAPHIC IS STILL A GRAPHIC, to end of input.
    //
    // Finding 1 of the sixth completion review, and it FAILS OPEN, which is
    // why it is the one that matters: a host whose inline `<svg>` is never
    // closed was dropped whole, so `scanHostHtml` returned zero findings — a
    // planted `<script>` included — `staticWitness` then reported `errors: 0`,
    // and that is exactly the condition `dischargeFor` uses to discharge the
    // BLOCKING turn-end obligation on the static-only path. A malformed file
    // discharged a gate that a well-formed one with the same script does not.
    //
    // NOT a regression of the depth counter that replaced the regex: the old
    // `/<svg\b[\s\S]*?<\/svg\s*>/` required a closing tag and matched nothing
    // here either. The rewrite preserved the hole rather than opening it, and
    // the honest version of that sentence is worth more than the flattering
    // one. Emitting the fragment hands `scanSvg` a document whose root is
    // never closed — it reports that AND everything inside it, which is both
    // answers the reader needs.
    if (depth > 0 && start !== -1) out.push({ start, end: text.length });
    return out;
}

export function scanHostHtml(content: string, relPath: string, opts: ScanOptions = {}): Finding[] {
    const mode: DeliveryMode = opts.delivery ?? 'inline';
    const findings: Finding[] = [];
    const lineOf = lineIndexer(content);
    const graphics: Array<{ body: string; offset: number }> = [];
    // Finding 2.3 on the host side: a graphic inside an HTML comment is not on
    // the page, so it is not scanned and its ids do not collide with anything.
    // Masking preserves offsets, so `lineOf` — built from the raw text — still
    // answers correctly for the graphics that survive.
    const hostText = maskScriptBodies(maskComments(content));
    for (const m of topLevelGraphics(hostText)) {
        // The MATCH is found in the masked text — a graphic inside an HTML
        // comment is not on the page — but the BODY is sliced from the raw
        // text at the same offsets.
        //
        // Finding 16 of this change's completion review: handing the masked
        // slice to `scanSvg` meant its own `parseIgnores` saw every
        // `svg-asset-disable` marker blanked, which is precisely the failure
        // `maskComments`' doc warns about. Suppression survived only because
        // this function re-filters on absolute lines at the end — the inner
        // pass was inert, and silently so, which made the outer re-filter
        // load-bearing without anything saying it was.
        graphics.push({ body: content.slice(m.start, m.end), offset: m.start });
    }

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
                    // ITS OWN RULE ID. Finding 4 of the fifth completion
                    // review: this error shared `svg-a11y-generic-id` with the
                    // single-graphic WARNING about a generic name, so one
                    // `svg-asset-disable svg-a11y-generic-id` — a reasonable
                    // thing to write when you have deliberately named
                    // something `icon` — silenced a real collision between two
                    // graphics as well. Two findings, two severities, two
                    // remedies; one id was one too few.
                    rule: 'svg-a11y-duplicate-id',
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

// ---------------------------------------------------------------------------
// Inline-ignore + config
// ---------------------------------------------------------------------------

/**
 * Which lines a rule is suppressed on, and whether the whole file is.
 *
 * Finding 6 of the fifth completion review: "whole file" used to be spelled as
 * the numbers 1..10_000 in a Set — so a directive cost ten thousand entries on
 * a path that now runs on every `.svg` write, AND a file longer than ten
 * thousand lines silently stopped being suppressed past that line. A flag says
 * the same thing in one bit and has no horizon.
 */
export interface RuleIgnore {
    lines: Set<number>;
    wholeFile: boolean;
}

export function parseIgnores(lines: string[]): Map<string, RuleIgnore> {
    const ignores = new Map<string, RuleIgnore>();
    const slot = (rule: string): RuleIgnore => {
        const found = ignores.get(rule) ?? { lines: new Set<number>(), wholeFile: false };
        ignores.set(rule, found);
        return found;
    };
    const add = (rule: string, line: number): void => {
        slot(rule).lines.add(line);
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const next = /svg-asset-disable-next-line\s+([\w-]+)/i.exec(line);
        if (next?.[1]) add(next[1].toLowerCase(), i + 2);
        const same = /svg-asset-disable-line\s+([\w-]+)/i.exec(line);
        if (same?.[1]) add(same[1].toLowerCase(), i + 1);
        const whole = /svg-asset-disable\s+([\w-]+)/i.exec(line);
        if (whole?.[1] && !/-next-line|-line\s/.test(line)) {
            slot(whole[1].toLowerCase()).wholeFile = true;
        }
    }
    return ignores;
}

function isIgnored(ignores: Map<string, RuleIgnore>, finding: Finding): boolean {
    const hit = ignores.get(finding.rule.toLowerCase());
    if (hit === undefined) return false;
    return hit.wholeFile || hit.lines.has(finding.line);
}
