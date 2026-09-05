/**
 * A minimal unified-diff reader.
 *
 * Written rather than pulled in: nothing in `src/scripts/_lib/` parses a diff
 * (`grep -rl "diff --git" src/scripts/_lib/*.ts` returns nothing), and the two
 * consumers here need three facts a full patch library would surround with
 * fifty more — which side a line is on, what line number it lands on, and
 * whether the file was deleted outright.
 *
 * Deliberately tolerant in one direction only: an unparseable line is skipped
 * rather than thrown on, because a diff carrying an unexpected header must not
 * make the detector crash into a green. Deliberately strict in the other: a
 * hunk header that does not parse aborts the file, because line numbers that
 * are wrong are worse than absent — every finding this feeds is a `file:line`
 * claim a reader will try to open.
 */

export interface DiffLine {
    side: 'added' | 'removed' | 'context';
    /** 1-based line number on the side this line belongs to. */
    line: number;
    /** Line content with the leading +/-/space removed. */
    text: string;
}

export interface DiffHunk {
    header: string;
    lines: DiffLine[];
}

export interface DiffFile {
    /** Path as it appears after `b/`, or after `a/` for a deleted file. */
    path: string;
    /** True when the diff removes the file outright. */
    deleted: boolean;
    /** True when the diff creates the file. */
    added: boolean;
    hunks: DiffHunk[];
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const GIT_HEADER_RE = /^diff --git a\/(.+?) b\/(.+)$/;

/** Parse a unified diff into files and hunks. Never throws on content. */
export function parseUnifiedDiff(text: string): DiffFile[] {
    const files: DiffFile[] = [];
    let current: DiffFile | null = null;
    let hunk: DiffHunk | null = null;
    let oldNo = 0;
    let newNo = 0;

    for (const raw of text.split('\n')) {
        const gitHeader = GIT_HEADER_RE.exec(raw);
        if (gitHeader !== null) {
            current = { path: gitHeader[2] ?? '', deleted: false, added: false, hunks: [] };
            files.push(current);
            hunk = null;
            continue;
        }
        if (current === null) continue;

        if (raw.startsWith('deleted file mode')) {
            current.deleted = true;
            continue;
        }
        if (raw.startsWith('new file mode')) {
            current.added = true;
            continue;
        }
        if (raw.startsWith('+++ ')) {
            // `+++ /dev/null` is the other spelling of a deletion; some
            // producers emit it without the `deleted file mode` line.
            if (raw.slice(4).trim() === '/dev/null') current.deleted = true;
            continue;
        }
        if (raw.startsWith('--- ')) {
            if (raw.slice(4).trim() === '/dev/null') current.added = true;
            continue;
        }
        if (raw.startsWith('index ') || raw.startsWith('similarity index') || raw.startsWith('rename ')) {
            continue;
        }

        const hunkHeader = HUNK_RE.exec(raw);
        if (hunkHeader !== null) {
            oldNo = Number(hunkHeader[1]);
            newNo = Number(hunkHeader[3]);
            hunk = { header: raw, lines: [] };
            current.hunks.push(hunk);
            continue;
        }
        if (hunk === null) continue;

        if (raw.startsWith('+')) {
            hunk.lines.push({ side: 'added', line: newNo, text: raw.slice(1) });
            newNo += 1;
        } else if (raw.startsWith('-')) {
            hunk.lines.push({ side: 'removed', line: oldNo, text: raw.slice(1) });
            oldNo += 1;
        } else if (raw.startsWith(' ') || raw === '') {
            hunk.lines.push({ side: 'context', line: newNo, text: raw.slice(1) });
            oldNo += 1;
            newNo += 1;
        }
        // `\ No newline at end of file` and anything else: skipped on purpose.
    }
    return files;
}

/** Every added line across the whole diff, with its file. */
export function addedLines(files: readonly DiffFile[]): Array<{ file: DiffFile; line: DiffLine }> {
    const out: Array<{ file: DiffFile; line: DiffLine }> = [];
    for (const file of files) {
        for (const h of file.hunks) {
            for (const l of h.lines) {
                if (l.side === 'added') out.push({ file, line: l });
            }
        }
    }
    return out;
}
