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

const START_RE = new Map<string, RegExp>();
function startRe(names: readonly string[]): RegExp {
    const key = names.join('|');
    let re = START_RE.get(key);
    if (re === undefined) {
        // `(?=[\s/>]|$)` rather than `\b`: `\b` lets `<link-x` match `link`.
        re = new RegExp(`<(${key})(?=[\\s/>]|$)`, 'gi');
        START_RE.set(key, re);
    }
    re.lastIndex = 0;
    return re;
}

/** Every tag of `names` in a page, with the 1-based line it starts on. Linear: one window per tag start. */
export function tagsOf(text: string, names: readonly string[] = LOADABLE_TAGS): Tag[] {
    const starts: number[] = [0];
    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
    const lineAt = (pos: number): number => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] ?? 0) <= pos) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
    const found = [...text.matchAll(startRe(names))];
    const out: Tag[] = [];
    // The next `>` only moves forward, so all the searches together read the text once.
    let gt = -2;
    found.forEach((m, k) => {
        const at = m.index ?? 0;
        if (gt !== -1 && gt < at) gt = text.indexOf('>', at);
        const next = found[k + 1]?.index ?? Number.POSITIVE_INFINITY;
        const name = (m[1] ?? '').toLowerCase();
        const closed = gt !== -1 && gt < next;
        out.push({ name, tag: closed ? text.slice(at, gt + 1) : '', line: lineAt(at), closed, end: closed ? gt : -1 });
    });
    return out;
}

const ATTR_RE = new Map<string, RegExp>();
/**
 * The value of attribute `name` on a start tag — double-quoted, single-quoted or
 * unquoted, any case. The name must follow whitespace, so `data-src` is never
 * read as `src`. An unquoted value stops at whitespace or the tag's `/>`.
 */
export function attr(tag: string, name: string): string | undefined {
    let re = ATTR_RE.get(name);
    if (re === undefined) {
        const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(`\\s${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+?)(?=\\s|\\/?>|$))`, 'i');
        ATTR_RE.set(name, re);
    }
    const m = re.exec(tag);
    if (m === null) return undefined;
    return m[1] ?? m[2] ?? m[3] ?? '';
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
