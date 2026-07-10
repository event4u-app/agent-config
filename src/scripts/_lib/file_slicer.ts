/**
 * Deterministic document slicer for oversized knowledge ingest
 * (road-to-retrieval-substrate-hardening B8).
 *
 * Splits a large markdown document into bounded slices at the cleanest
 * available boundary — heading > paragraph (blank line) > line — while
 * guaranteeing three invariants a downstream re-assembler can rely on:
 *
 *   1. GAP-FREE + NON-OVERLAPPING — slices cover contiguous line ranges over
 *      the whole document, in order.
 *   2. CONCAT == ORIGINAL — joining every slice's `text` in order reproduces
 *      the input byte-for-byte (slices are exact offset ranges).
 *   3. PARENTED — every slice carries its source `parentPath` (when given) and
 *      its `[startLine, endLine)` range, so a chunk can point home.
 *
 * Deterministic: identical input + budget → identical slices.
 */

export interface Slice {
    parentPath: string | null;
    index: number;
    startLine: number; // 0-based, inclusive
    endLine: number; // 0-based, exclusive
    text: string;
}

/** Default per-slice character budget. */
export const DEFAULT_MAX_CHARS = 2000;

function _lineStartOffsets(text: string): number[] {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') starts.push(i + 1);
    }
    return starts; // one entry per line; starts[k] = offset where line k begins
}

function _isHeading(line: string): boolean {
    return /^#{1,6}\s/.test(line);
}
function _isBlank(line: string): boolean {
    return line.trim() === '';
}

/**
 * Slice `text` into ≤ `maxChars` pieces (best-effort — a single over-long line
 * is emitted whole rather than split mid-line, preserving invariant 2).
 * `parentPath` is stamped on every slice.
 */
export function sliceDocument(
    text: string,
    opts: { maxChars?: number; parentPath?: string } = {},
): Slice[] {
    const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
    const parentPath = opts.parentPath ?? null;
    if (text === '') return [];

    const starts = _lineStartOffsets(text);
    const nLines = starts.length;
    // lineAt(k) = the raw text of line k INCLUDING its trailing newline (if any).
    const lineEnd = (k: number): number => (k + 1 < nLines ? starts[k + 1]! : text.length);
    const lines: string[] = [];
    for (let k = 0; k < nLines; k++) lines.push(text.slice(starts[k]!, lineEnd(k)));

    const slices: Slice[] = [];
    let sliceStartLine = 0;
    let idx = 0;
    const flush = (endLine: number): void => {
        if (endLine <= sliceStartLine) return;
        const from = starts[sliceStartLine]!;
        const to = endLine < nLines ? starts[endLine]! : text.length;
        slices.push({ parentPath, index: idx++, startLine: sliceStartLine, endLine, text: text.slice(from, to) });
        sliceStartLine = endLine;
    };

    let curChars = 0;
    for (let k = 0; k < nLines; k++) {
        const lineLen = lines[k]!.length;
        const wouldExceed = curChars + lineLen > maxChars && k > sliceStartLine;
        // Cut BEFORE a heading that opens a new section (clean boundary), or
        // when the budget would overflow — preferring a preceding blank line.
        const headingBoundary = _isHeading(lines[k]!) && k > sliceStartLine;
        if (headingBoundary || wouldExceed) {
            // Prefer to end the previous slice at the last blank line in-range,
            // so a slice ends on a paragraph boundary when one is available.
            let cut = k;
            if (wouldExceed && !headingBoundary) {
                for (let b = k - 1; b > sliceStartLine; b--) {
                    if (_isBlank(lines[b]!)) {
                        cut = b + 1;
                        break;
                    }
                }
            }
            flush(cut);
            curChars = 0;
            for (let j = sliceStartLine; j <= k; j++) curChars += lines[j]!.length;
        } else {
            curChars += lineLen;
        }
    }
    flush(nLines);
    return slices;
}

/** True iff the slices reproduce `text` exactly, gap-free and non-overlapping. */
export function verifySlices(text: string, slices: readonly Slice[]): boolean {
    if (slices.length === 0) return text === '';
    let expectedLine = 0;
    const parts: string[] = [];
    for (const s of slices) {
        if (s.startLine !== expectedLine) return false; // gap or overlap
        expectedLine = s.endLine;
        parts.push(s.text);
    }
    return parts.join('') === text;
}
