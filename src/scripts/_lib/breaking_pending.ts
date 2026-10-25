/**
 * The rows under `BREAKING_CHANGES.md`'s `## Pending` heading, each with the
 * commit its `Landed` cell cites. Shared by the release cut, which skips a row an
 * earlier tag already carries, and by `lint_breaking_changes_index`, which
 * refuses a row that cites no commit; kept dependency-free so the lint's
 * fixture can copy it alongside the script.
 */
export interface PendingRow {
    readonly changes: string;
    readonly commit: string | null;
}

export function pendingRows(index: string): PendingRow[] {
    const rows: PendingRow[] = [];
    let inPending = false;
    for (const line of index.split('\n')) {
        if (line.startsWith('## ')) {
            inPending = line.startsWith('## Pending');
            continue;
        }
        if (!inPending || !line.startsWith('|')) continue;
        const cols = line.split('|');
        const changes = (cols[2] ?? '').trim();
        if (changes === '' || changes === 'What changes' || /^-+$/u.test(changes)) continue;
        const commit = /`([0-9a-f]{7,40})`/u.exec(cols[1] ?? '')?.[1] ?? null;
        rows.push({ changes, commit });
    }
    return rows;
}

/** The commit each Pending row cites, or null for a row citing none. */
export function pendingRowCommits(index: string): (string | null)[] {
    return pendingRows(index).map((r) => r.commit);
}
