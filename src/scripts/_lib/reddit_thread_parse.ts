#!/usr/bin/env tsx
/**
 * reddit_thread_parse.ts — deterministic old.reddit thread → JSON extractor.
 *
 * WHY THIS EXISTS. Reach research needs the *shape* of a discussion (who said
 * what, to whom, and how well it landed), not a screenshot. The public JSON
 * endpoints are rate-limited and auth-gated; the rendered `old.reddit.com` HTML
 * is not. So this reads that HTML and emits a stable record.
 *
 * DETERMINISTIC BY CONSTRUCTION. stdin → stdout. No network, no filesystem
 * write, no clock, no environment read, no state. The same bytes in always
 * produce the same bytes out, which is what makes the committed fixtures under
 * `tests/fixtures/reddit-thread/` a real regression lock rather than a smoke
 * test. Fetching is the CALLER's job (`curl … | tsx this-file`) — keeping the
 * request outside this module is what keeps it testable offline.
 *
 * NESTING IS THE POINT — NOT A FLAT REGEX. old.reddit renders a reply as a
 * `div.thing` inside its parent's `div.child > div.sitetable.listing`. Reply
 * order and parent linkage ARE the signal being extracted, so `depth` and
 * `parent_id` come from a real tag-stack walk over the container structure
 * (`_scanDivs` → `_collectComments`). A regex over `data-fullname` would return
 * the right ids in the wrong tree and quietly destroy the only thing worth
 * reading. There is no DOM library in this package's runtime dependencies
 * (`happy-dom` is dev-only, and adding a dep for this is not warranted), hence
 * the hand-rolled scanner — which also skips `<script>` / `<style>` bodies and
 * HTML comments so markup inside them cannot shift the depth count.
 *
 * NULL OVER GUESSES. A score-hidden comment yields `score: null`, never `0` —
 * old.reddit omits the `span.score.unvoted` entirely for those, and reporting
 * `0` would invent a downvoted comment that does not exist. Same for a missing
 * or `[deleted]` author.
 *
 * HOSTILE INPUT BY DEFINITION. This parses third-party HTML that any anonymous
 * user can write into. Every emitted string therefore passes `sanitize_text`
 * (the shared retrieval floor) which strips bidi / zero-width / Unicode-Tag
 * hidden-instruction vectors and control-char noise. Visible text is preserved
 * verbatim as DATA — a comment body that reads like an instruction stays inert
 * prose in a JSON string, and is never treated as one (untrusted-input floor).
 *
 * Entities are decoded to a FIXED POINT (bounded, `_ENTITY_PASSES`): measured
 * reality on this content is that `&amp;#32;` survives a single unescape pass,
 * so one pass would leak a literal `&#32;` into the output. Decoding runs
 * BEFORE sanitizing, so a numeric escape cannot smuggle a hidden codepoint past
 * the floor.
 *
 * Output shape (stdout, one JSON object):
 *   { thread:    { title, author, score, permalink },
 *     comments:  [ { id, author, score, depth, parent_id, body } ],
 *     login_wall: boolean }
 *
 * Exit codes:
 *   0 — parsed (including a legitimately empty / login-walled page).
 *   3 — unusable input: nothing on stdin.
 *
 * Invocation:
 *   curl -sSL … 'https://old.reddit.com/r/x/comments/ID/' \
 *     | tsx src/scripts/_lib/reddit_thread_parse.ts
 */
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { sanitize_text } from './retrieval_sanitize.js';

/** Header fields of the submission itself. `null` for anything not present. */
export interface ThreadHeader {
    readonly title: string | null;
    readonly author: string | null;
    readonly score: number | null;
    readonly permalink: string | null;
}

/** One comment, located in the reply tree by `depth` + `parent_id`. */
export interface ParsedComment {
    /** Reddit fullname, e.g. `t1_onfj038` — unique within the page. */
    readonly id: string;
    /** `null` when absent or `[deleted]` — never a placeholder string. */
    readonly author: string | null;
    /** `null` when the score is hidden — never `0`. */
    readonly score: number | null;
    /** 0 for a top-level comment; +1 per enclosing comment container. */
    readonly depth: number;
    /** Fullname of the enclosing comment, or `null` at top level. */
    readonly parent_id: string | null;
    /** Visible body text, entity-decoded then sanitized. */
    readonly body: string;
}

export interface ParsedThread {
    readonly thread: ThreadHeader;
    readonly comments: ParsedComment[];
    /**
     * True when the page is a login / interstitial rather than a thread —
     * detected structurally (no comment nodes AND a login marker), so a real
     * thread that merely links to `/login` is never misread as a wall.
     */
    readonly login_wall: boolean;
}

/**
 * Entity-decode passes. Two are needed in practice (`&amp;#32;` → `&#32;` →
 * ` `); the third is headroom. Bounded on purpose — an unbounded loop over
 * attacker-supplied text is a denial-of-service lever.
 */
const _ENTITY_PASSES = 3;

const _NAMED_ENTITIES: Readonly<Record<string, string>> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    // Reddit's markdown renderer emits these directly.
    hellip: '…',
    mdash: '—',
    ndash: '–',
    lsquo: '‘',
    rsquo: '’',
    ldquo: '“',
    rdquo: '”',
};

/** One entity-decode pass: named + decimal + hex numeric references. */
function _decodeOnce(text: string): string {
    return text.replace(/&(#[Xx]?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]{1,31});/g, (whole, bodyRaw: string) => {
        const body = bodyRaw;
        if (body.startsWith('#')) {
            const isHex = body[1] === 'x' || body[1] === 'X';
            const digits = isHex ? body.slice(2) : body.slice(1);
            if (digits === '') {
                return whole;
            }
            const cp = Number.parseInt(digits, isHex ? 16 : 10);
            // Surrogates and out-of-range values are not codepoints; leave the
            // reference visible rather than emitting a replacement char.
            if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
                return whole;
            }
            return String.fromCodePoint(cp);
        }
        const named = _NAMED_ENTITIES[body.toLowerCase()];
        return named ?? whole;
    });
}

/**
 * Decode HTML entities to a fixed point (at most `_ENTITY_PASSES` passes).
 * Stops as soon as a pass is a no-op, so well-formed input costs one pass.
 */
export function decodeEntities(text: string): string {
    let current = text;
    for (let pass = 0; pass < _ENTITY_PASSES; pass += 1) {
        const next = _decodeOnce(current);
        if (next === current) {
            return current;
        }
        current = next;
    }
    return current;
}

/** Decode-then-sanitize. The ONLY way a string reaches the output. */
function _clean(text: string): string {
    return sanitize_text(decodeEntities(text));
}

interface DivToken {
    readonly isEnd: boolean;
    /** Raw attribute text of an open tag (`''` for a close tag). */
    readonly attrs: string;
    /** Offset of `<`. */
    readonly start: number;
    /** Offset just past `>`. */
    readonly end: number;
}

const _RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/**
 * Walk every tag in the document and yield the `div` tokens in order.
 *
 * Every tag is parsed — not just divs — because only a full walk knows where a
 * tag actually ends: a quoted attribute may contain `>` (old.reddit ships
 * inline `onclick=` handlers), and `<script>` / `<style>` / `<title>` bodies
 * are raw text where a literal `<div` must NOT count as an element. Skipping
 * those is what keeps the depth arithmetic honest.
 */
function _scanDivs(html: string): DivToken[] {
    const tokens: DivToken[] = [];
    const length = html.length;
    let index = 0;

    while (index < length) {
        const lt = html.indexOf('<', index);
        if (lt === -1) {
            break;
        }

        // HTML comment / CDATA / doctype-ish bogus comment.
        if (html.startsWith('<!--', lt)) {
            const close = html.indexOf('-->', lt + 4);
            index = close === -1 ? length : close + 3;
            continue;
        }
        if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
            const close = html.indexOf('>', lt + 2);
            index = close === -1 ? length : close + 1;
            continue;
        }

        const isEnd = html[lt + 1] === '/';
        const nameStart = lt + (isEnd ? 2 : 1);
        const nameMatch = /^[A-Za-z][A-Za-z0-9-]*/.exec(html.slice(nameStart, nameStart + 32));
        if (!nameMatch) {
            // A stray `<` in text — not a tag. Step past it.
            index = lt + 1;
            continue;
        }
        const name = nameMatch[0].toLowerCase();

        // Find the tag end, honouring quoted attribute values.
        let cursor = nameStart + nameMatch[0].length;
        let quote: string | null = null;
        let tagEnd = -1;
        while (cursor < length) {
            const ch = html[cursor];
            if (quote !== null) {
                if (ch === quote) {
                    quote = null;
                }
            } else if (ch === '"' || ch === "'") {
                quote = ch;
            } else if (ch === '>') {
                tagEnd = cursor;
                break;
            }
            cursor += 1;
        }
        if (tagEnd === -1) {
            break; // truncated tag at EOF
        }

        const attrs = html.slice(nameStart + nameMatch[0].length, tagEnd);
        index = tagEnd + 1;

        if (!isEnd && _RAW_TEXT_TAGS.has(name) && !attrs.trimEnd().endsWith('/')) {
            // Raw-text element: everything up to its close tag is text.
            const closeRe = new RegExp(`</${name}\\s*>`, 'i');
            const rest = html.slice(index);
            const closeMatch = closeRe.exec(rest);
            index = closeMatch ? index + closeMatch.index + closeMatch[0].length : length;
            continue;
        }

        if (name === 'div') {
            tokens.push({ isEnd, attrs: isEnd ? '' : attrs, start: lt, end: index });
        }
    }

    return tokens;
}

/** Read one attribute out of a raw attribute string. */
function _attr(attrs: string, key: string): string | null {
    const re = new RegExp(`\\b${key}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
    const match = re.exec(attrs);
    if (!match) {
        return null;
    }
    return match[2] ?? match[3] ?? null;
}

/** True when the tag's `class` attribute carries the given whole word. */
function _hasClass(attrs: string, className: string): boolean {
    const raw = _attr(attrs, 'class');
    if (raw === null) {
        return false;
    }
    // Reddit writes `class=" thing id-x &#32; comment "` — the entity is a
    // separator, so decode before word-splitting.
    return decodeEntities(raw).split(/\s+/).includes(className);
}

interface CommentNode {
    readonly id: string;
    readonly attrs: string;
    readonly depth: number;
    readonly parent_id: string | null;
    /** Offset just past this comment's own open tag. */
    readonly contentStart: number;
    /** Offset just past its matching `</div>`; `html.length` if unbalanced. */
    contentEnd: number;
    /** Start offset of its first descendant comment, if any. */
    firstChildStart: number | null;
}

/**
 * Tag-stack walk producing every comment node with a REAL `depth` /
 * `parent_id` taken from container nesting.
 *
 * A `div.thing[data-type="comment"]` is a comment. Sibling `data-type`s
 * (`morechildren` stubs, the `link` header) are deliberately not: the
 * `morechildren` stub reuses its parent's `id`, so keying off `id` alone would
 * emit a duplicate node.
 */
function _collectComments(html: string): CommentNode[] {
    const tokens = _scanDivs(html);
    const nodes: CommentNode[] = [];
    /** Every open div, by nesting order. `null` for a non-comment div. */
    const divStack: (CommentNode | null)[] = [];
    /** The open comment ancestors, innermost last. */
    const commentStack: CommentNode[] = [];

    for (const token of tokens) {
        if (token.isEnd) {
            const popped = divStack.pop();
            if (popped) {
                popped.contentEnd = token.start;
                commentStack.pop();
            }
            continue;
        }

        const isComment = _attr(token.attrs, 'data-type') === 'comment' && _hasClass(token.attrs, 'thing');
        if (!isComment) {
            divStack.push(null);
            continue;
        }

        const parent = commentStack[commentStack.length - 1] ?? null;
        const id = _attr(token.attrs, 'data-fullname') ?? _attr(token.attrs, 'id') ?? `#${nodes.length}`;
        const node: CommentNode = {
            id,
            attrs: token.attrs,
            depth: commentStack.length,
            parent_id: parent?.id ?? null,
            contentStart: token.end,
            contentEnd: html.length,
            firstChildStart: null,
        };
        // Ancestors record where their own content stops and replies begin.
        for (const ancestor of commentStack) {
            if (ancestor.firstChildStart === null) {
                ancestor.firstChildStart = token.start;
            }
        }
        nodes.push(node);
        divStack.push(node);
        commentStack.push(node);
    }

    return nodes;
}

/**
 * The slice of a comment that belongs to IT and not to its replies — from just
 * past its open tag to the start of its first nested reply.
 *
 * This is defence-in-depth, NOT a fix for an observed bug — measured, and the
 * measurement is recorded here so nobody re-derives it: removing the cut changes
 * **nothing** on either the committed fixture (15 comments) or a 134-comment live
 * thread spanning 7 depths — 0 differing fields. The reason is that both
 * `_extractScore` and `_extractBody` take the FIRST match in the region, and a
 * comment's own score span and body always precede its first child's.
 *
 * Keep the cut anyway: it is two lines, and it is what makes those extractors free
 * to stop being first-match (a last-match, a max-of, or a multi-capture variant
 * would silently start reading the child's values without it). Do not add a test
 * asserting it — there is no behavioural difference to assert.
 */
function _ownRegion(html: string, node: CommentNode): string {
    const end = node.firstChildStart ?? node.contentEnd;
    return html.slice(node.contentStart, Math.max(node.contentStart, end));
}

/**
 * Score from the `unvoted` variant — the only one that is the real number
 * (`dislikes` is score−1, `likes` is score+1). Absent → `null`, because
 * old.reddit omits the span entirely on a score-hidden comment.
 */
function _extractScore(region: string): number | null {
    const match = /<(?:span|div)\b[^>]*\bclass\s*=\s*"[^"]*\bscore\b[^"]*\bunvoted\b[^"]*"[^>]*\btitle\s*=\s*"(-?\d+)"/i.exec(
        region,
    );
    if (!match?.[1]) {
        return null;
    }
    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) ? value : null;
}

const _BLOCK_BREAK_RE =
    /<\s*\/?\s*(?:p|br|div|blockquote|li|ul|ol|h[1-6]|pre|tr|table|hr)\b[^>]*>/gi;

/** Markup → visible text. Block boundaries become newlines; tags vanish. */
function _htmlToText(fragment: string): string {
    return fragment
        .replace(_BLOCK_BREAK_RE, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * The comment's markdown body. Takes the FIRST `div.md` in the own-region:
 * the rendered body precedes both the reply form's empty template and any
 * nested reply, so "first" is unambiguous.
 */
function _extractBody(region: string): string {
    const open = /<div\b[^>]*\bclass\s*=\s*"[^"]*\bmd\b[^"]*"[^>]*>/i.exec(region);
    if (!open) {
        return '';
    }
    // Balanced-div walk so a nested <div> inside the body (code block, table)
    // does not truncate it at the first </div>.
    const bodyStart = open.index + open[0].length;
    const tokens = _scanDivs(region.slice(bodyStart));
    let depth = 0;
    let bodyEnd = region.length - bodyStart;
    for (const token of tokens) {
        if (token.isEnd) {
            if (depth === 0) {
                bodyEnd = token.start;
                break;
            }
            depth -= 1;
        } else {
            depth += 1;
        }
    }
    return _htmlToText(region.slice(bodyStart, bodyStart + bodyEnd));
}

/** `[deleted]` / `[removed]` are placeholders, not authors → `null`. */
function _normalizeAuthor(raw: string | null): string | null {
    if (raw === null) {
        return null;
    }
    const author = _clean(raw).trim();
    if (author === '' || author === '[deleted]' || author === '[removed]') {
        return null;
    }
    return author;
}

/** Header of the submission — from the `data-type="link"` thing. */
function _extractThread(html: string): ThreadHeader {
    const tokens = _scanDivs(html);
    const linkToken = tokens.find(
        (token) => !token.isEnd && _attr(token.attrs, 'data-type') === 'link' && _hasClass(token.attrs, 'thing'),
    );
    if (!linkToken) {
        return { title: null, author: null, score: null, permalink: null };
    }
    const { attrs } = linkToken;
    const region = html.slice(linkToken.end, linkToken.end + 20_000);

    const titleMatch = /<a\b[^>]*\bclass\s*=\s*"[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(region);
    const rawTitle = titleMatch?.[1] ?? null;
    const title = rawTitle === null ? null : _clean(_htmlToText(rawTitle)) || null;

    const rawScore = _attr(attrs, 'data-score');
    let score: number | null = null;
    if (rawScore !== null && /^-?\d+$/.test(rawScore.trim())) {
        score = Number.parseInt(rawScore.trim(), 10);
    } else {
        score = _extractScore(region);
    }

    const permalinkRaw = _attr(attrs, 'data-permalink') ?? _attr(attrs, 'data-url');
    const permalink = permalinkRaw === null ? null : _clean(permalinkRaw).trim() || null;

    return { title, author: _normalizeAuthor(_attr(attrs, 'data-author')), score, permalink };
}

/**
 * Login / interstitial detection — STRUCTURAL, and only ever consulted when the
 * page yielded zero comment nodes. A real thread routinely links to `/login`
 * (every vote arrow is `login-required`), so a marker alone must never flip
 * this; the absence of any comment node is the load-bearing half.
 */
function _detectLoginWall(html: string, commentCount: number): boolean {
    if (commentCount > 0) {
        return false;
    }
    const hasLoginForm = /<form\b[^>]*\b(?:id|class|action)\s*=\s*"[^"]*login[^"]*"/i.test(html);
    const hasPasswordField =
        /<input\b[^>]*\btype\s*=\s*"password"/i.test(html) || /<input\b[^>]*\bname\s*=\s*"passwd"/i.test(html);
    const hasRefreshRedirect = /<meta\b[^>]*\bhttp-equiv\s*=\s*"refresh"/i.test(html);
    const hasBlockedMarker = /\b(?:you must log in|log ?in to continue|whoa there, pardner|rate ?limit)\b/i.test(html);
    return hasLoginForm || hasPasswordField || hasRefreshRedirect || hasBlockedMarker;
}

/**
 * Parse a thread page. Pure: no I/O, no clock, no globals. Returns an empty
 * `comments` array (never a fabricated one) when the page carries no comment
 * nodes.
 */
export function parseThread(html: string): ParsedThread {
    const nodes = _collectComments(html);
    const loginWall = _detectLoginWall(html, nodes.length);

    if (loginWall) {
        // A wall has no thread to report and no comments to invent.
        return {
            thread: { title: null, author: null, score: null, permalink: null },
            comments: [],
            login_wall: true,
        };
    }

    const comments: ParsedComment[] = nodes.map((node) => {
        const region = _ownRegion(html, node);
        return {
            id: _clean(node.id).trim(),
            author: _normalizeAuthor(_attr(node.attrs, 'data-author')),
            score: _extractScore(region),
            depth: node.depth,
            parent_id: node.parent_id === null ? null : _clean(node.parent_id).trim(),
            body: _clean(_extractBody(region)),
        };
    });

    return { thread: _extractThread(html), comments, login_wall: false };
}

function _readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
        process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        process.stdin.on('error', reject);
    });
}

const HELP = `reddit_thread_parse — deterministic old.reddit thread HTML → JSON

Usage:
  curl -sSL -H 'User-Agent: <a real browser UA>' \\
    'https://old.reddit.com/r/<sub>/comments/<id>/' \\
    | tsx src/scripts/_lib/reddit_thread_parse.ts

Reads HTML on stdin, writes one JSON object on stdout:
  { thread: { title, author, score, permalink },
    comments: [ { id, author, score, depth, parent_id, body } ],
    login_wall: boolean }

Offline and deterministic: no request, no write, no clock. Fetching is the
caller's job, which is what makes the committed fixtures a real regression lock.
\`depth\` / \`parent_id\` come from container nesting, not a flat regex.
A hidden score is \`null\`, never \`0\`. Every string passes the sanitize floor
(bidi / zero-width / Unicode-Tag vectors stripped; visible text kept as DATA).

Exit codes: 0 parsed (incl. an empty or login-walled page) · 3 empty stdin.
`;

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(HELP);
        return 0;
    }

    const html = await _readStdin();
    if (html.trim() === '') {
        process.stderr.write('❌  reddit_thread_parse: no HTML on stdin (pipe a thread page in)\n');
        return 3;
    }

    process.stdout.write(`${JSON.stringify(parseThread(html), null, 2)}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation makes the raw URLs differ (import.meta.url is the
    // resolved real path while argv[1] keeps the symlink path) — compare
    // realpaths so the CLI still fires through a projection symlink.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(await main());
}
