/**
 * The parked estate's two integers, for the dashboard header.
 *
 * `road-to-inbox-harvest-2026-08-f-owner-decision-queue` Phase 2.3. Split out of
 * `update_roadmap_progress.ts` rather than left inline, and the reason is
 * mechanical: that file is past the 1500-line ceiling
 * `check_source_size_budget` charges, so lines added to it are paid back by
 * extraction rather than by a baseline bump.
 *
 * **Two integers are not an inventory.** No row, no link, nothing to conflict
 * on — which is exactly the distinction that keeps this clear of the 2026-08-21
 * council verdict that deleted the hand-maintained index in `stubs/README.md`,
 * and of `check_no_stub_inventory_table`, which refuses its return.
 *
 * The dashboard excludes `stubs/` on purpose and that does not change. What was
 * missing is that a maintainer had no way to learn a stub had gone unread
 * without listing the directory.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Frontmatter block, matching the parent script's own pattern. */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---[ \t\n\r\f\v]*\n/;

/**
 * Phrases that mean "a person has to decide this".
 *
 * A literal list, never a heuristic: a general "looks like a decision" match
 * would count every stub that mentions the word, and a count that over-reports
 * is a count nobody trusts twice. Kept in sync with `stubs_due.ts` by the test
 * that asserts both readers agree on the same corpus.
 */
const OWNER_ROUTING = [
    'owner-reserved',
    'owner reserved',
    'owner: maintainer',
    'reserved to the owner',
    'requires owner',
    'maintainer decision',
    'owner decision',
    'owner sign-off',
    'awaiting the owner',
];

/**
 * Count overdue stubs and stubs routing a decision to a person.
 *
 * Returns `null` on any failure — a dashboard is not the place to surface a
 * parse error, and an absent `stubs/` directory in a consumer install is normal
 * rather than a fault. `today` is a parameter so the count is testable.
 */
export function stub_queue_counts(
    roadmap_root: string,
    today: string = new Date().toISOString().slice(0, 10),
): { overdue: number; owner: number } | null {
    const dir = path.join(roadmap_root, 'stubs');
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'README.md');
    } catch {
        return null;
    }
    if (names.length === 0) return null;
    let overdue = 0;
    let owner = 0;
    for (const n of names) {
        let source: string;
        try {
            source = fs.readFileSync(path.join(dir, n), 'utf-8');
        } catch {
            continue;
        }
        const fm = FRONTMATTER_RE.exec(source);
        const due = /^review_by:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(fm?.[1] ?? '');
        // An ABSENT date counts as overdue: the contract requires it, so missing
        // means nobody scheduled a read — the state the count exists to surface.
        if (due === null || (due[1] as string) <= today) overdue += 1;
        const lower = source.toLowerCase();
        if (OWNER_ROUTING.some((phrase) => lower.includes(phrase))) owner += 1;
    }
    return { overdue, owner };
}
