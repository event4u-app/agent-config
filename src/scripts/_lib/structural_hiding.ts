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
 * the MARKUP hides it: an HTML comment, a `<template>` block, a
 * `style="display:none"` span. This module is that pre-pass. It runs AHEAD of
 * the codepoint floor, on the model-facing copy of fetched markup only, and it
 * never touches a repository file.
 *
 * WHY A TOKENIZER AND NOT A MATCHER
 * ---------------------------------
 * A first version of this module was BUILT and REFUSED by an independent
 * two-provider council review on 2026-09-29. It scanned forward with regexes
 * and `indexOf`, and a scanner cannot answer the only question that matters
 * here — "is this `<` a tag?" — because the answer depends on the state the
 * parser is in. Four shapes the review named, each of which defeats a scanner
 * and each of which has a fixture in `tests/scripts/structural_hiding.test.ts`:
 *
 *   1. a comment containing a same-name opening or closing tag
 *      (`<!-- </div> -->` inside a hidden `<div>` closed it early);
 *   2. tag-like text inside `<script>` / `<style>`, which are RAWTEXT elements
 *      where `<div>` is character data and not a tag at all;
 *   3. nested same-name hidden and visible elements, which need a real open-
 *      element stack rather than a forward re-scan;
 *   4. unterminated markup — an unclosed comment, tag or element at EOF.
 *
 * So this version tokenizes first ({@link tokenize}) and walks the token
 * stream against an explicit open-element stack ({@link strip_structural_hiding}).
 * A stripper that can be confused by the content it is defending against is
 * worse than none, because it reports success.
 *
 * REMOVAL POLICY — REMOVAL IS NEVER SILENT
 * ----------------------------------------
 * The same review named silent irreversible deletion as a defect in its own
 * right: a caller debugging a corrupted result has nothing to go on. Four
 * properties, all asserted by the fixture suite:
 *
 *   - **A sentinel is left in place.** Every removal emits
 *     `[removed: structural-hiding/<channel-id>]` where the content was.
 *   - **The sentinel vocabulary is closed.** `<channel-id>` always comes from
 *     {@link STRUCTURAL_HIDING_CHANNELS}; no byte of the input is ever echoed
 *     into it, so the marker cannot itself carry a payload.
 *   - **Every removal is reported structurally.** {@link StructuralStripResult}
 *     carries one {@link StructuralRemoval} per removed span with its offsets
 *     into the INPUT, so the caller — which still holds the input — can recover
 *     exactly what was dropped. The pre-pass is pure and writes nothing.
 *   - **Unterminated markup fails closed, and says so.** An unresolvable tail
 *     is dropped rather than emitted, and `truncated` is set.
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
 * this file, and refuses any surface that claims this coverage without citing
 * the gap register.
 *
 * WHAT THE MISSING CORPUS MEANS, since "none exists" reads two ways. It is not
 * "we could build one and have not got to it". The space of hiding techniques
 * is adversarial and not enumerable: a corpus would fix a denominator that the
 * next technique invalidates, and the number computed against it would outlive
 * its own validity. A corpus is a research artefact, not a module dependency,
 * and none is in scope for this layer. What the module can honestly state is
 * the list of channels it declares, which is enumerable, and what it knows it
 * misses, which is the register — so that is what it states.
 */

/**
 * One structural-hiding channel this pre-pass removes.
 *
 * Exported so a caller can print exactly what it covers rather than
 * paraphrasing it, and so the fixture suite can assert one case per channel
 * without a second hand-written list to drift from.
 */
export interface HidingChannel {
    /** Stable id, used by the fixture suite and by the removal sentinel. */
    readonly id: string;
    /** What the channel looks like in markup. */
    readonly detail: string;
}

/** The channels removed. Anything not here is not removed by this module. */
export const STRUCTURAL_HIDING_CHANNELS: readonly HidingChannel[] = [
    { id: 'html-comment', detail: '<!-- … --> — invisible to a reader, plain text to a parser' },
    { id: 'template-element', detail: '<template>…</template> — inert content the browser never renders' },
    { id: 'inline-display-none', detail: 'style="display:none"' },
    { id: 'inline-visibility-hidden', detail: 'style="visibility:hidden"' },
    { id: 'inline-opacity-zero', detail: 'style="opacity:0"' },
    { id: 'inline-font-size-zero', detail: 'style="font-size:0"' },
    { id: 'inline-zero-box', detail: 'style="width:0" / "height:0"' },
    { id: 'hidden-attribute', detail: 'the HTML5 boolean `hidden` attribute' },
];

/**
 * Deliberately NOT channels, with the reason.
 *
 * This list exists because its first entry was a shipped defect. A reviewer
 * asking "why is `aria-hidden` missing?" must find the answer here rather than
 * read the omission as an oversight and restore it.
 */
export const STRUCTURAL_HIDING_NON_CHANNELS: readonly HidingChannel[] = [
    {
        id: 'aria-hidden',
        detail:
            'aria-hidden="true" is NOT a hiding channel. Its content is VISIBLE to sighted ' +
            'readers — it is a screen-reader affordance that removes an element from the ' +
            'accessibility tree, not from the page. Stripping it deletes legitimate visible ' +
            'text. It was on the channel list of the version this module replaces, and the ' +
            'per-channel fixtures did not catch it because a fixture written from the same ' +
            'wrong list agrees with it.',
    },
];

/**
 * What this pre-pass does NOT catch.
 *
 * Restricted to uncovered classes on purpose: a register printed beside a
 * working detector invites the reading that the listed gaps are the only gaps.
 * Every entry here is a hiding technique that reaches the same end — content a
 * human never sees and a model does — through a route no per-element test over
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
    'tiny-but-nonzero sizing — `font-size:1px`, `opacity:0.01`; only exact-zero forms are matched, because a threshold would need a corpus to set',
];

/* ------------------------------------------------------------------ *
 * Tokenizer
 * ------------------------------------------------------------------ */

/** A token kind. `comment` covers bogus comments and doctypes too. */
export type TokenKind = 'text' | 'comment' | 'start' | 'end';

/** One token, always carrying its exact span in the input. */
export interface Token {
    readonly kind: TokenKind;
    /** Offset of the token's first character in the input. */
    readonly start: number;
    /** Offset just past the token's last character. */
    readonly end: number;
    /** Lower-cased tag name — `start` and `end` tokens only. */
    readonly name?: string;
    /** Parsed attributes, lower-cased names — `start` tokens only. */
    readonly attrs?: ReadonlyMap<string, string>;
    /** True for `<br/>` and for void elements — `start` tokens only. */
    readonly selfClosing?: boolean;
    /** True when the token ran to EOF without its terminator. */
    readonly unterminated?: boolean;
}

/** Result of one tokenizer pass. */
export interface TokenizeResult {
    readonly tokens: readonly Token[];
    /** True when any token ran to EOF without its terminator. */
    readonly unterminated: boolean;
}

/** Void elements: never carry a closing tag, so they never hide a subtree. */
const VOID_TAGS: ReadonlySet<string> = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Elements whose content is character data, not markup.
 *
 * This is the state a scanner does not have, and finding #2 of the review is
 * exactly its absence: inside `<script>`, the text `</div>` is three characters
 * and a slash, not an end tag.
 */
const RAWTEXT_TAGS: ReadonlySet<string> = new Set(['script', 'style', 'textarea', 'title']);

const ASCII_ALPHA = /[A-Za-z]/;
const TAG_NAME_CHAR = /[A-Za-z0-9:_.-]/;
const WHITESPACE = /[ \t\n\f\r]/;

/** Read a tag name starting at `i`; returns the name and the next offset. */
function readTagName(html: string, i: number): { name: string; next: number } {
    let j = i;
    while (j < html.length && TAG_NAME_CHAR.test(html[j] as string)) j += 1;
    return { name: html.slice(i, j).toLowerCase(), next: j };
}

/**
 * Parse a start tag's attribute list, beginning just past the tag name.
 *
 * Quoting is honoured, so a `>` inside `style="a>b"` does not end the tag —
 * the failure that makes a naive `indexOf('>')` strip the wrong span. Returns
 * `null` when the tag never closes (unterminated markup at EOF).
 */
function readAttrs(
    html: string,
    from: number,
): { attrs: Map<string, string>; selfClosing: boolean; end: number } | null {
    const attrs = new Map<string, string>();
    let i = from;
    let selfClosing = false;

    for (;;) {
        while (i < html.length && WHITESPACE.test(html[i] as string)) i += 1;
        if (i >= html.length) return null; // EOF inside the tag
        const ch = html[i] as string;

        if (ch === '>') return { attrs, selfClosing, end: i + 1 };
        if (ch === '/') {
            selfClosing = true;
            i += 1;
            continue;
        }

        // Attribute name.
        const nameStart = i;
        while (
            i < html.length &&
            !WHITESPACE.test(html[i] as string) &&
            html[i] !== '=' &&
            html[i] !== '>' &&
            html[i] !== '/'
        ) {
            i += 1;
        }
        if (i === nameStart) {
            // A character that starts no name and ends no tag — consume it so
            // the loop always advances. Never spin on malformed input.
            i += 1;
            continue;
        }
        const name = html.slice(nameStart, i).toLowerCase();

        while (i < html.length && WHITESPACE.test(html[i] as string)) i += 1;
        if (html[i] !== '=') {
            attrs.set(name, ''); // valueless attribute
            selfClosing = false; // a `/` before a real attribute was not a close
            continue;
        }
        i += 1; // past '='
        while (i < html.length && WHITESPACE.test(html[i] as string)) i += 1;
        if (i >= html.length) return null;

        const quote = html[i] as string;
        let value: string;
        if (quote === '"' || quote === "'") {
            const close = html.indexOf(quote, i + 1);
            if (close === -1) return null; // unterminated attribute value
            value = html.slice(i + 1, close);
            i = close + 1;
        } else {
            const vs = i;
            while (i < html.length && !WHITESPACE.test(html[i] as string) && html[i] !== '>') i += 1;
            value = html.slice(vs, i);
        }
        attrs.set(name, value);
        selfClosing = false;
    }
}

/**
 * Tokenize markup into text / comment / start / end tokens.
 *
 * Deterministic, pure, single pass, no backtracking. Every branch advances the
 * cursor, so the loop terminates on any input including adversarial markup.
 */
export function tokenize(html: string): TokenizeResult {
    const tokens: Token[] = [];
    let unterminated = false;
    let i = 0;
    let textStart = 0;

    const flushText = (upTo: number): void => {
        if (upTo > textStart) tokens.push({ kind: 'text', start: textStart, end: upTo });
    };

    while (i < html.length) {
        const lt = html.indexOf('<', i);
        if (lt === -1) break;

        const next = html[lt + 1];

        // Comment, doctype, CDATA, or bogus comment.
        if (next === '!') {
            flushText(lt);
            if (html.startsWith('<!--', lt)) {
                const close = html.indexOf('-->', lt + 4);
                if (close === -1) {
                    tokens.push({ kind: 'comment', start: lt, end: html.length, unterminated: true });
                    unterminated = true;
                    textStart = html.length;
                    i = html.length;
                    break;
                }
                tokens.push({ kind: 'comment', start: lt, end: close + 3 });
                i = close + 3;
            } else {
                const close = html.indexOf('>', lt + 2);
                if (close === -1) {
                    tokens.push({ kind: 'comment', start: lt, end: html.length, unterminated: true });
                    unterminated = true;
                    textStart = html.length;
                    i = html.length;
                    break;
                }
                tokens.push({ kind: 'comment', start: lt, end: close + 1 });
                i = close + 1;
            }
            textStart = i;
            continue;
        }

        // End tag.
        if (next === '/' && ASCII_ALPHA.test(html[lt + 2] ?? '')) {
            const { name, next: afterName } = readTagName(html, lt + 2);
            const parsed = readAttrs(html, afterName); // end tags may carry (ignored) attrs
            if (parsed === null) {
                flushText(lt);
                unterminated = true;
                textStart = html.length;
                i = html.length;
                break;
            }
            flushText(lt);
            tokens.push({ kind: 'end', start: lt, end: parsed.end, name });
            i = parsed.end;
            textStart = i;
            continue;
        }

        // Start tag.
        if (ASCII_ALPHA.test(next ?? '')) {
            const { name, next: afterName } = readTagName(html, lt + 1);
            const parsed = readAttrs(html, afterName);
            if (parsed === null) {
                // Unterminated tag at EOF. Fail closed: the tail is dropped.
                flushText(lt);
                unterminated = true;
                textStart = html.length;
                i = html.length;
                break;
            }
            flushText(lt);
            const selfClosing = parsed.selfClosing || VOID_TAGS.has(name);
            tokens.push({
                kind: 'start',
                start: lt,
                end: parsed.end,
                name,
                attrs: parsed.attrs,
                selfClosing,
            });
            i = parsed.end;
            textStart = i;

            // RAWTEXT: everything up to the matching close tag is character data.
            if (!selfClosing && RAWTEXT_TAGS.has(name)) {
                const closeAt = findRawtextClose(html, i, name);
                if (closeAt === -1) {
                    tokens.push({ kind: 'text', start: i, end: html.length, unterminated: true });
                    unterminated = true;
                    textStart = html.length;
                    i = html.length;
                    break;
                }
                if (closeAt > i) tokens.push({ kind: 'text', start: i, end: closeAt });
                const afterClose = html.indexOf('>', closeAt);
                const endOff = afterClose === -1 ? html.length : afterClose + 1;
                tokens.push({ kind: 'end', start: closeAt, end: endOff, name });
                if (afterClose === -1) unterminated = true;
                i = endOff;
                textStart = i;
            }
            continue;
        }

        // A `<` that starts nothing — ordinary text. Advance past it only.
        i = lt + 1;
    }

    flushText(html.length);
    return { tokens, unterminated };
}

/** Offset of the `<` of the matching RAWTEXT close tag, or -1. */
function findRawtextClose(html: string, from: number, name: string): number {
    let i = from;
    for (;;) {
        const lt = html.indexOf('</', i);
        if (lt === -1) return -1;
        const { name: candidate, next } = readTagName(html, lt + 2);
        const after = html[next] ?? '>';
        if (candidate === name && (after === '>' || after === '/' || WHITESPACE.test(after))) return lt;
        i = lt + 2;
    }
}

/* ------------------------------------------------------------------ *
 * Hidden-element predicate
 * ------------------------------------------------------------------ */

/** Inline-style declarations that hide an element outright. */
const HIDING_STYLE_RULES: readonly { readonly channel: string; readonly re: RegExp }[] = [
    { channel: 'inline-display-none', re: /(?:^|;)\s*display\s*:\s*none\s*(?:!\s*important\s*)?(?:;|$)/i },
    { channel: 'inline-visibility-hidden', re: /(?:^|;)\s*visibility\s*:\s*hidden\s*(?:!\s*important\s*)?(?:;|$)/i },
    { channel: 'inline-opacity-zero', re: /(?:^|;)\s*opacity\s*:\s*0(?:\.0+)?\s*(?:!\s*important\s*)?(?:;|$)/i },
    {
        channel: 'inline-font-size-zero',
        re: /(?:^|;)\s*font-size\s*:\s*0(?:\.0+)?(?:px|em|rem|pt|%)?\s*(?:!\s*important\s*)?(?:;|$)/i,
    },
    {
        channel: 'inline-zero-box',
        re: /(?:^|;)\s*(?:width|height)\s*:\s*0(?:\.0+)?(?:px|em|rem|pt|%)?\s*(?:!\s*important\s*)?(?:;|$)/i,
    },
];

/**
 * The channel that hides this element, or `null` when it is visible.
 *
 * Reads the PARSED attribute map, never the raw tag text — an attribute value
 * is already unquoted here, so no substring match can escape its own attribute.
 */
export function hidingChannelFor(name: string, attrs: ReadonlyMap<string, string>): string | null {
    if (name === 'template') return 'template-element';
    if (attrs.has('hidden')) {
        const v = (attrs.get('hidden') ?? '').trim().toLowerCase();
        // `hidden`, `hidden=""`, `hidden="hidden"`, `hidden="true"` all hide.
        // `hidden="until-found"` does NOT — the content is reachable by find-in-page.
        if (v !== 'until-found') return 'hidden-attribute';
    }
    const style = attrs.get('style');
    if (style !== undefined) {
        for (const rule of HIDING_STYLE_RULES) {
            if (rule.re.test(style)) return rule.channel;
        }
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Stripper
 * ------------------------------------------------------------------ */

/** One removed span, reported so a caller can debug a corrupted result. */
export interface StructuralRemoval {
    /** A {@link STRUCTURAL_HIDING_CHANNELS} id. Never derived from input. */
    readonly channel: string;
    /** Offset of the removed span's first character in the INPUT. */
    readonly start: number;
    /** Offset just past the removed span's last character in the INPUT. */
    readonly end: number;
}

/** Result of one strip pass. */
export interface StructuralStripResult {
    /** The model-facing copy, with hidden spans replaced by sentinels. */
    readonly text: string;
    /** Every removal, in document order. */
    readonly removals: readonly StructuralRemoval[];
    /** True when unterminated markup made the tail unresolvable. */
    readonly truncated: boolean;
}

/**
 * The sentinel left where content was removed.
 *
 * `channel` always comes from the closed vocabulary above, so no byte of the
 * input ever reaches the output through this path.
 */
export function removalSentinel(channel: string): string {
    return `[removed: structural-hiding/${channel}]`;
}

interface OpenElement {
    readonly name: string;
    /** Set when this element is the root of a hidden subtree. */
    readonly hiddenChannel: string | null;
    /** Input offset where the hidden subtree began. */
    readonly hiddenStart: number;
}

/**
 * Remove structurally hidden content from a markup string.
 *
 * Covers exactly {@link STRUCTURAL_HIDING_CHANNELS} and deliberately not
 * {@link STRUCTURAL_HIDING_NON_CHANNELS}; the classes it cannot reach at all
 * are {@link STRUCTURAL_HIDING_GAPS}. Visible text is returned untouched,
 * including the markup around it — this is a pre-pass, not a markup-to-text
 * converter, so a caller that also wants the codepoint floor composes the two.
 *
 * Deterministic and pure: no network, no I/O, no model call.
 */
export function strip_structural_hiding(html: string): StructuralStripResult {
    const { tokens, unterminated } = tokenize(html);
    const removals: StructuralRemoval[] = [];
    const stack: OpenElement[] = [];
    let out = '';
    /** Index into `stack` of the hidden root, or -1 when nothing is hidden. */
    let hiddenAt = -1;

    for (const t of tokens) {
        if (t.kind === 'start') {
            const name = t.name as string;
            const attrs = t.attrs as ReadonlyMap<string, string>;

            if (hiddenAt !== -1) {
                // Inside a hidden subtree: track depth, emit nothing.
                if (!(t.selfClosing ?? false)) {
                    stack.push({ name, hiddenChannel: null, hiddenStart: 0 });
                }
                continue;
            }

            const channel = hidingChannelFor(name, attrs);
            if (channel === null) {
                out += html.slice(t.start, t.end);
                if (!(t.selfClosing ?? false)) {
                    stack.push({ name, hiddenChannel: null, hiddenStart: 0 });
                }
                continue;
            }

            if (t.selfClosing ?? false) {
                // No subtree to drop — just the tag itself.
                removals.push({ channel, start: t.start, end: t.end });
                out += removalSentinel(channel);
                continue;
            }
            stack.push({ name, hiddenChannel: channel, hiddenStart: t.start });
            hiddenAt = stack.length - 1;
            continue;
        }

        if (t.kind === 'end') {
            const name = t.name as string;
            // Nearest matching open element. A stray end tag matches nothing
            // and is ignored, exactly as a browser ignores it.
            let idx = -1;
            for (let k = stack.length - 1; k >= 0; k -= 1) {
                if (stack[k]?.name === name) {
                    idx = k;
                    break;
                }
            }
            if (idx === -1) {
                if (hiddenAt === -1) out += html.slice(t.start, t.end);
                continue;
            }
            const closingHidden = hiddenAt !== -1 && idx <= hiddenAt;
            if (closingHidden) {
                const root = stack[hiddenAt] as OpenElement;
                removals.push({
                    channel: root.hiddenChannel as string,
                    start: root.hiddenStart,
                    end: t.end,
                });
                out += removalSentinel(root.hiddenChannel as string);
                hiddenAt = -1;
            } else if (hiddenAt === -1) {
                out += html.slice(t.start, t.end);
            }
            stack.length = idx;
            continue;
        }

        if (t.kind === 'comment') {
            if (hiddenAt !== -1) continue; // already inside a removed span
            removals.push({ channel: 'html-comment', start: t.start, end: t.end });
            out += removalSentinel('html-comment');
            continue;
        }

        // text
        if (hiddenAt === -1) out += html.slice(t.start, t.end);
    }

    // An unclosed hidden element swallows the rest of the document. Fail
    // closed: it is already excluded from `out`; record it and say so.
    if (hiddenAt !== -1) {
        const root = stack[hiddenAt] as OpenElement;
        removals.push({
            channel: root.hiddenChannel as string,
            start: root.hiddenStart,
            end: html.length,
        });
        out += removalSentinel(root.hiddenChannel as string);
    }

    return { text: out, removals, truncated: unterminated || hiddenAt !== -1 };
}
