/**
 * One start-tag reader for the web-launch gate and its third-party classifier.
 *
 * A verdict about a page must depend on what its tags say, never on the order,
 * quoting or case they are written in. A regex that expects `name` before
 * `content` reads `<meta content="noindex" name="robots">` as no noindex at all,
 * so every check reads attributes through `attr()` instead of matching a tag.
 *
 * No dependency: the gate ships to consumers through `src/scripts/`, and a DOM
 * library is a dev-only dependency here.
 */

export interface Tag {
    name: string;
    /** The start tag up to and including its `>`; empty when the tag is unclosed. */
    tag: string;
    line: number;
    closed: boolean;
    /** Offset of the `>` that closes the start tag, or -1 when unclosed. */
    end: number;
}

/** Tags that make the browser fetch something. */
export const LOADABLE_TAGS: readonly string[] = ['link', 'script', 'iframe', 'img', 'video', 'audio', 'source', 'embed'];
/** Tags whose attributes carry a page's indexing and metadata claims. */
export const HEAD_TAGS: readonly string[] = ['meta', 'link', 'title'];

/** Every tag of `names` in a page, with the 1-based line it starts on. Linear: tag starts are in order, so lines and `>` searches only move forward. */
export function tagsOf(text: string, names: readonly string[] = LOADABLE_TAGS): Tag[] {
    // `(?=[\s/>]|$)` rather than `\b`: `\b` lets `<link-x` match `link`.
    const found = [...text.matchAll(new RegExp(`<(${names.join('|')})(?=[\\s/>]|$)`, 'gi'))];
    const out: Tag[] = [];
    let gt = -2;
    let line = 1;
    let nl = text.indexOf('\n');
    found.forEach((m, k) => {
        const at = m.index ?? 0;
        for (; nl !== -1 && nl < at; nl = text.indexOf('\n', nl + 1)) line++;
        if (gt !== -1 && gt < at) gt = text.indexOf('>', at);
        const closed = gt !== -1 && gt < (found[k + 1]?.index ?? Infinity);
        out.push({ name: (m[1] ?? '').toLowerCase(), tag: closed ? text.slice(at, gt + 1) : '', line, closed, end: closed ? gt : -1 });
    });
    return out;
}

/**
 * The value of attribute `name` on a start tag — double-quoted, single-quoted or
 * unquoted, any case. The name must follow whitespace, so `data-src` is never
 * read as `src`. An unquoted value stops at whitespace or the tag's `/>`.
 */
export function attr(tag: string, name: string): string | undefined {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`\\s${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+?)(?=\\s|\\/?>|$))`, 'i').exec(tag);
    return m === null ? undefined : (m[1] ?? m[2] ?? m[3] ?? '');
}

/** The trimmed text of the first `<title>`, or undefined when there is none or it is empty. */
export function titleOf(text: string): string | undefined {
    const t = tagsOf(text, ['title']).find((x) => x.closed);
    if (t === undefined) return undefined;
    const close = text.toLowerCase().indexOf('</title', t.end + 1);
    if (close < 0) return undefined;
    const body = text.slice(t.end + 1, close).trim();
    return body.length === 0 ? undefined : body;
}
