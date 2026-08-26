/**
 * Shared markdown line classifier — the frontmatter / fence / indented-code /
 * marker skip machinery that decides which lines of a `.md` file are PROSE.
 *
 * ## Why this exists
 *
 * `check_md_language.ts` has carried this machinery since it was ported from
 * Python (ADR-200), and its CLI contract is pinned byte-for-byte. When
 * `road-to-canonical-terms` 2.2 called for a second prose-scanning gate it said
 * explicitly: reuse that machinery "rather than a second copy of it". A second
 * copy is how two gates end up disagreeing about what a fence is — one of them
 * flags a word inside a code block and the other does not, and nobody can say
 * which is right because there is no single definition to consult.
 *
 * So the classifier moved here verbatim and both callers read it. The
 * behaviour is unchanged on purpose: `check_md_language`'s test suite pins the
 * exact finding list, and this extraction is a refactor that must not move it.
 *
 * ## What counts as a skip, and what does not
 *
 * - **frontmatter** — a `---` fence opening on line 1 and everything to its close.
 * - **fence** — ``` or ~~~ toggles, and every line between them. The fence
 *   markers themselves are skipped too.
 * - **indented-code** — four leading spaces on a line that does not start a
 *   list item. Markdown's indented-code rule, with the list carve-out this
 *   tree's own deeply-nested bullets need.
 * - **marker** — a caller-supplied per-line opt-out (`<!-- x: ignore -->`) or a
 *   labelled bilingual anchor. Callers pass their own patterns; the module has
 *   no opinion about which markers exist.
 *
 * Everything else is prose, and prose carries `text` with inline code spans
 * blanked out — because a word named inside backticks is being QUOTED, not used.
 */

/** What a classifier pass decided about one line. */
export type MarkdownLineKind =
    | 'frontmatter'
    | 'fence'
    | 'indented-code'
    | 'marker'
    | 'prose';

export interface MarkdownLine {
    /** 1-based line number, matching every editor and every gate message. */
    lineno: number;
    /** The line exactly as it appears in the file. */
    raw: string;
    kind: MarkdownLineKind;
    /**
     * Scannable text — the raw line with inline code spans removed. Only
     * meaningful when `kind === 'prose'`; empty string otherwise.
     */
    text: string;
}

export interface MarkdownScanOptions {
    /**
     * Per-line skip patterns tested against the RAW line. A match classifies
     * the line `marker`. Callers own their own markers; this module ships none.
     */
    markers?: readonly RegExp[];
}

/** Inline code spans — a term inside backticks is named, not used. */
const INLINE_CODE_RE = /`[^`]*`/g;

/**
 * Python `str.splitlines()` — universal-newline split with no trailing empty
 * element. Kept identical to the version `check_md_language` was ported with,
 * because its line numbers are part of that gate's pinned output.
 */
export function splitlines(text: string): string[] {
    if (text === '') return [];
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            lines.push(current);
            current = '';
            if (text[i + 1] === '\n') i += 1; // \r\n consumed as one
            continue;
        }
        if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            lines.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current !== '') lines.push(current);
    return lines;
}

/** Blank out inline code spans so a quoted term is not read as a used one. */
export function stripInlineCode(text: string): string {
    return text.replace(INLINE_CODE_RE, '');
}

function lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/**
 * Classify every line of a markdown document.
 *
 * Pure over the content string — no filesystem access — so a caller can test
 * the classification from a literal without a repo.
 */
export function classifyMarkdownLines(
    content: string,
    opts: MarkdownScanOptions = {},
): MarkdownLine[] {
    const markers = opts.markers ?? [];
    const out: MarkdownLine[] = [];
    const lines = splitlines(content);

    let inFence = false;
    let inFrontmatter = false;

    for (let idx = 0; idx < lines.length; idx++) {
        const raw = lines[idx] as string;
        const lineno = idx + 1;
        const stripped = lstrip(raw);

        // YAML frontmatter at the top of the file.
        if (lineno === 1 && stripped === '---') {
            inFrontmatter = true;
            out.push({ lineno, raw, kind: 'frontmatter', text: '' });
            continue;
        }
        if (inFrontmatter) {
            if (stripped === '---') inFrontmatter = false;
            out.push({ lineno, raw, kind: 'frontmatter', text: '' });
            continue;
        }

        // Fenced code blocks — the markers themselves are skipped too.
        if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
            inFence = !inFence;
            out.push({ lineno, raw, kind: 'fence', text: '' });
            continue;
        }
        if (inFence) {
            out.push({ lineno, raw, kind: 'fence', text: '' });
            continue;
        }

        // Indented code blocks (4+ leading spaces, non-list).
        const listStarts = ['-', '*', '+', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        if (raw.startsWith('    ') && !listStarts.some((c) => stripped.startsWith(c))) {
            out.push({ lineno, raw, kind: 'indented-code', text: '' });
            continue;
        }

        // Caller-supplied per-line markers.
        if (markers.some((re) => { re.lastIndex = 0; return re.test(raw); })) {
            out.push({ lineno, raw, kind: 'marker', text: '' });
            continue;
        }

        out.push({ lineno, raw, kind: 'prose', text: stripInlineCode(raw) });
    }

    return out;
}
