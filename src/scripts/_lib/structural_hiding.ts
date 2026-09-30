/**
 * Structural-hiding pre-pass for fetched markup
 * (road-to-a-sanitize-list-that-is-generated, Phase 3).
 *
 * WHAT THIS IS FOR
 * ----------------
 * `retrieval_sanitize.sanitize_text` is a CODEPOINT floor: it removes bidi
 * controls, zero-width characters, the Unicode Tag block, control-char noise
 * and invisible fillers. Every one of those is a property of a character.
 *
 * Fetched markup carries a channel class that no codepoint predicate can see.
 * Text that is perfectly ordinary at the codepoint layer becomes invisible to a
 * human reader — and stays fully visible to a model reading the source — when
 * the MARKUP hides it: an HTML comment, an `aria-hidden` subtree, a
 * `<template>` block, a `style="display:none"` span. A grep for any of those in
 * the sanitize path returned zero before this file existed, so for fetched
 * markdown and HTML the dominant hiding class had no coverage at all.
 *
 * This module is that pre-pass. It runs AHEAD of the codepoint floor, on the
 * model-facing copy of fetched markup only, and it never touches a repository
 * file.
 *
 * WHAT IT DOES NOT CATCH — see {@link STRUCTURAL_HIDING_GAPS}
 * ----------------------------------------------------------
 * The register below is part of this module's contract rather than a footnote.
 * An inline-style substring matcher cited as "the taxonomy" is how a detector
 * like this becomes a false green, so every surface that claims this coverage
 * cites the register alongside the claim.
 *
 * NO RECALL OR COVERAGE FIGURE IS PUBLISHED FOR THIS LAYER, ANYWHERE.
 * A rate requires a frozen corpus of hiding techniques and none exists in this
 * tree. The covered-channel list and the gap register are the honest statement
 * of what this does; a number would be an invented denominator. The absence is
 * machine-checked — `check_read_surface_coverage` refuses a percentage token in
 * this file.
 */

/**
 * One structural-hiding channel this pre-pass removes.
 *
 * Exported so a caller can print exactly what it covers rather than
 * paraphrasing it, and so the fixture suite can assert one case per channel
 * without a second hand-written list to drift from.
 */
export interface HidingChannel {
    /** Stable id, used by the fixture suite. */
    readonly id: string;
    /** What the channel looks like in markup. */
    readonly detail: string;
}

/** The channels removed. Anything not here is not removed by this module. */
export const STRUCTURAL_HIDING_CHANNELS: readonly HidingChannel[] = [
    { id: 'html-comment', detail: '<!-- … --> — invisible to a reader, plain text to a parser' },
    { id: 'template-element', detail: '<template>…</template> — inert content the browser never renders' },
    { id: 'aria-hidden', detail: 'aria-hidden="true" — removed from the accessibility tree' },
    { id: 'inline-display-none', detail: 'style="display:none"' },
    { id: 'inline-visibility-hidden', detail: 'style="visibility:hidden"' },
    { id: 'inline-opacity-zero', detail: 'style="opacity:0"' },
    { id: 'inline-font-size-zero', detail: 'style="font-size:0"' },
    { id: 'inline-zero-box', detail: 'style="width:0" / "height:0"' },
];

/**
 * What this pre-pass does NOT catch.
 *
 * Restricted to uncovered classes on purpose: a register printed beside a
 * working detector invites the reading that the listed gaps are the only gaps.
 * Every entry here is a hiding technique that reaches the same end — content a
 * human never sees and a model does — through a route no substring match over
 * an inline `style` attribute can reach.
 */
export const STRUCTURAL_HIDING_GAPS: readonly string[] = [
    'stylesheet-driven hiding — a rule in a <style> block or an external sheet, where the element carries only a class',
    'class-driven hiding — `class="sr-only"`, `class="hidden"`, any framework utility whose meaning lives elsewhere',
    'off-screen positioning — `position:absolute; left:-9999px`, `transform: translate(-100%, 0)`, `clip-path`',
    'background-coloured text — foreground equal to background, which needs a computed style to detect',
    'fragmentation — a payload split across elements or interleaved with visible text, invisible to any per-element test',
    'homoglyph and confusable obfuscation — a codepoint-layer channel, reported (never rewritten) by `scan_encoding_findings`',
    'image-borne text — an instruction rendered into a picture, unreachable without OCR',
    'script-constructed content — text assembled at runtime by JavaScript this pre-pass never executes',
];

/** Inline-style declarations that hide an element outright. */
const _HIDING_STYLE_RE =
    /(?:^|[;\s])(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?(?:\s*[;!]|\s*$)|font-size\s*:\s*0(?:\.0+)?(?:px|em|rem|%)?(?:\s*[;!]|\s*$)|(?:width|height)\s*:\s*0(?:\.0+)?(?:px|em|rem|%)?(?:\s*[;!]|\s*$))/i;

/** `aria-hidden="true"` in any quoting style. */
const _ARIA_HIDDEN_RE = /\baria-hidden\s*=\s*(?:"true"|'true'|true)/i;

/** Elements that are inert wherever they appear. */
const _ALWAYS_HIDDEN_TAGS: ReadonlySet<string> = new Set(['template']);

/** True when an opening tag's attribute text marks the element as hidden. */
export function isHiddenAttrs(tagName: string, attrs: string): boolean {
    if (_ALWAYS_HIDDEN_TAGS.has(tagName.toLowerCase())) return true;
    if (_ARIA_HIDDEN_RE.test(attrs)) return true;
    const styleMatch = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (styleMatch === null) return false;
    const style = styleMatch[1] ?? styleMatch[2] ?? styleMatch[3] ?? '';
    return _HIDING_STYLE_RE.test(style);
}

interface OpenTag {
    readonly name: string;
    readonly attrs: string;
    /** Offset of `<`. */
    readonly start: number;
    /** Offset just past `>`. */
    readonly end: number;
    /** True for `<br/>`-style self-closing tags. */
    readonly selfClosing: boolean;
}

/** Void elements that never carry a closing tag, so they never hide a subtree. */
const _VOID_TAGS: ReadonlySet<string> = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Read the tag that starts at `lt`, or `null` when this is not an open tag.
 *
 * Attribute scanning honours quoting, so a `>` inside `style="a>b"` does not
 * end the tag early — the failure that makes a naive `indexOf('>')` strip the
 * wrong span.
 */
function _readOpenTag(html: string, lt: number): OpenTag | null {
    if (html[lt + 1] === '/' || html[lt + 1] === '!' || html[lt + 1] === '?') return null;
    const nameMatch = /^[A-Za-z][A-Za-z0-9-]*/.exec(html.slice(lt + 1, lt + 65));
    if (nameMatch === null) return null;
    const name = nameMatch[0];
    let cursor = lt + 1 + name.length;
    let quote: string | null = null;
    while (cursor < html.length) {
        const ch = html[cursor];
        if (quote !== null) {
            if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '>') {
            const attrs = html.slice(lt + 1 + name.length, cursor);
            return {
                name,
                attrs,
                start: lt,
                end: cursor + 1,
                selfClosing: attrs.trimEnd().endsWith('/') || _VOID_TAGS.has(name.toLowerCase()),
            };
        }
        cursor += 1;
    }
    return null; // unterminated tag — leave the tail alone
}

/**
 * Offset just past the matching close tag for an open tag, nesting-aware.
 * Returns `html.length` when the element is never closed.
 */
function _matchingCloseEnd(html: string, open: OpenTag): number {
    const lower = open.name.toLowerCase();
    let depth = 1;
    let cursor = open.end;
    while (cursor < html.length) {
        const lt = html.indexOf('<', cursor);
        if (lt === -1) break;
        const close = /^<\/([A-Za-z][A-Za-z0-9-]*)\s*>/.exec(html.slice(lt, lt + 70));
        if (close !== null) {
            if ((close[1] ?? '').toLowerCase() === lower) {
                depth -= 1;
                if (depth === 0) return lt + close[0].length;
            }
            cursor = lt + close[0].length;
            continue;
        }
        const nested = _readOpenTag(html, lt);
        if (nested !== null && nested.name.toLowerCase() === lower && !nested.selfClosing) {
            depth += 1;
            cursor = nested.end;
            continue;
        }
        cursor = lt + 1;
    }
    return html.length;
}

/**
 * Remove structurally hidden content from a markup string.
 *
 * Covers exactly {@link STRUCTURAL_HIDING_CHANNELS}. Visible text is returned
 * untouched, including the markup around it — this is a pre-pass, not a
 * markup-to-text converter, so a caller that also wants the codepoint floor
 * composes the two (see `retrieval_sanitize.sanitize_markup`).
 *
 * Deterministic and pure: no network, no I/O, no model call.
 */
export function strip_structural_hiding(html: string): string {
    let out = '';
    let cursor = 0;
    while (cursor < html.length) {
        const lt = html.indexOf('<', cursor);
        if (lt === -1) {
            out += html.slice(cursor);
            break;
        }
        out += html.slice(cursor, lt);

        if (html.startsWith('<!--', lt)) {
            const close = html.indexOf('-->', lt + 4);
            cursor = close === -1 ? html.length : close + 3;
            continue;
        }
        const open = _readOpenTag(html, lt);
        if (open === null) {
            out += html[lt];
            cursor = lt + 1;
            continue;
        }
        if (isHiddenAttrs(open.name, open.attrs)) {
            cursor = open.selfClosing ? open.end : _matchingCloseEnd(html, open);
            continue;
        }
        out += html.slice(open.start, open.end);
        cursor = open.end;
    }
    return out;
}
