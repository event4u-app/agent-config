#!/usr/bin/env tsx
/**
 * `stubs:due` — what in the parked estate is waiting, and on whom.
 *
 * `road-to-inbox-harvest-2026-08-f-owner-decision-queue` Phase 2. The estate is
 * not short of plans; it was short of a front door. 76 stubs sit under
 * `agents/roadmaps/stubs/`, the progress dashboard excludes that directory ON
 * PURPOSE, and before this command nothing ever re-read them: exactly one of the
 * 76 carried a next-read date.
 *
 * ── What it does NOT do, and this is the load-bearing part ───────────────────
 * It is READ-ONLY and it authors nothing inside `agents/roadmaps/stubs/`. The AI
 * council of 2026-08-21 deleted the hand-maintained index that used to live in
 * `stubs/README.md`, because an authored append surface conflicted in every open
 * PR and drifted stale within a day of its own repair;
 * `check_no_stub_inventory_table` refuses its return.
 *
 * That verdict settled *an inventory of the directory living inside the
 * directory's own README*. This is a frontmatter field plus a query: the stub
 * files stay the single source, no row is authored twice, and there is no append
 * surface to conflict on. Different mechanism, so the lock does not apply —
 * recorded here rather than left for a later reader to re-derive.
 *
 * ── Three buckets, because they are three different problems ─────────────────
 * · OVERDUE — `review_by:` has passed. Late; re-read it.
 * · NO PROBE — carries `probe: none`. Not late: it has no finish line at all,
 *   which is an abandonment wearing a directory name.
 * · OWNER — the text routes a decision to the owner. Not late and not
 *   abandoned: it is waiting on a person, and no amount of re-reading moves it.
 *
 * Collapsing them into one count would tell a reader to re-read a file that
 * needs a decision, and to decide about a file that needs a probe.
 *
 * Exit codes: 0 always on the report path (this is a QUERY, not a gate) ·
 * 2 usage / unreadable corpus.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where the parked estate lives. */
export const STUB_DIR = 'agents/roadmaps/stubs';

/**
 * Phrases that mean "a person has to decide this".
 *
 * A literal list, never a heuristic: a general "looks like a decision" match
 * would flag every stub that mentions the word, and a query that over-reports is
 * a query nobody runs twice. Each entry is a phrase this repository's own stubs
 * and roadmaps actually use.
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

export interface StubRecord {
    /** Repo-relative path. */
    file: string;
    /** Parsed `review_by:`, or `null` when absent or unparseable. */
    reviewBy: string | null;
    /** True when the file declares `probe: none`. */
    probeNone: boolean;
    /** The owner-routing phrase that matched, or `null`. */
    ownerPhrase: string | null;
}

/** Read one stub's fields. Frontmatter only — the body is scanned separately. */
export function readStub(root: string, rel: string): StubRecord {
    const source = fs.readFileSync(path.join(root, rel), 'utf-8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(source);
    const front = fm?.[1] ?? '';
    const dateMatch = /^review_by:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(front);
    const lower = source.toLowerCase();
    const phrase = OWNER_ROUTING.find((p) => lower.includes(p)) ?? null;
    return {
        file: rel,
        reviewBy: dateMatch?.[1] ?? null,
        probeNone: /^probe:\s*none\s*$/m.test(front),
        ownerPhrase: phrase,
    };
}

/** Every stub file, sorted. `README.md` is the contract, not a stub. */
export function listStubs(root: string): string[] {
    const dir = path.join(root, STUB_DIR);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return entries
        .filter((n) => n.endsWith('.md') && n !== 'README.md')
        .map((n) => `${STUB_DIR}/${n}`)
        .sort();
}

export interface DueReport {
    total: number;
    /** `review_by:` in the past, or absent — both mean nobody scheduled a read. */
    overdue: readonly StubRecord[];
    /** `probe: none` — no finish line, which is not the same as late. */
    noProbe: readonly StubRecord[];
    /** Text routes a decision to a person. */
    owner: readonly StubRecord[];
}

/**
 * Classify the corpus against a date.
 *
 * `today` is a parameter rather than read from the clock, because a query whose
 * output depends on an unstated `Date.now()` cannot be tested and cannot be
 * quoted in a commit. The CLI passes the real date; a test passes a fixed one.
 */
export function report(root: string, today: string): DueReport {
    const records = listStubs(root).map((rel) => readStub(root, rel));
    return {
        total: records.length,
        // An ABSENT date counts as overdue, deliberately. The field is required
        // by the contract, so a missing one means the file predates the contract
        // or somebody skipped it — either way nobody has scheduled a read, which
        // is the state this query exists to surface.
        overdue: records.filter((r) => r.reviewBy === null || r.reviewBy <= today),
        noProbe: records.filter((r) => r.probeNone),
        owner: records.filter((r) => r.ownerPhrase !== null),
    };
}

function render(r: DueReport, today: string, write: (s: string) => void): void {
    write(`stubs:due — ${String(r.total)} stub(s) under ${STUB_DIR}, as of ${today}\n\n`);

    const section = (label: string, rows: readonly StubRecord[], detail: (s: StubRecord) => string): void => {
        write(`${label}: ${String(rows.length)}\n`);
        for (const s of rows) write(`  ${s.file}  ${detail(s)}\n`);
        if (rows.length > 0) write('\n');
    };

    section('OVERDUE — review_by has passed or is absent', r.overdue, (s) =>
        s.reviewBy === null ? '(no review_by — nobody scheduled a read)' : `review_by ${s.reviewBy}`,
    );
    section('NO PROBE — declares `probe: none`; no finish line, not merely late', r.noProbe, () => '');
    section('OWNER — the text routes a decision to a person', r.owner, (s) => `matched "${s.ownerPhrase ?? ''}"`);

    write(
        'This is a QUERY and exits 0 whatever it finds. It writes nothing and authors\n' +
            `no file under ${STUB_DIR} — see the header for why that boundary matters.\n`,
    );
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: stubs_due [--root DIR] [--today YYYY-MM-DD] [--json] [--counts]\n' +
                '  --today   classify against this date instead of the system clock\n' +
                '  --counts  print only the two dashboard integers\n',
        );
        return 0;
    }
    const rootIdx = argv.indexOf('--root');
    const rootArg = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
    const root = rootArg === undefined ? REPO_ROOT : path.resolve(rootArg);
    const todayIdx = argv.indexOf('--today');
    const todayArg = todayIdx >= 0 ? argv[todayIdx + 1] : undefined;
    const today = todayArg ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
        process.stderr.write(`stubs_due: --today must be YYYY-MM-DD, got "${today}"\n`);
        return 2;
    }

    const r = report(root, today);
    if (r.total === 0) {
        process.stderr.write(
            `stubs_due: found no stub under ${root}/${STUB_DIR} — the root moved, or this is not the repository root\n`,
        );
        return 2;
    }
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ today, ...r }, null, 2)}\n`);
        return 0;
    }
    if (argv.includes('--counts')) {
        // The two integers Phase 2.3 puts on the dashboard. Two integers are not
        // an inventory: no row, no link, nothing to conflict on.
        process.stdout.write(`${String(r.overdue.length)} ${String(r.owner.length)}\n`);
        return 0;
    }
    render(r, today, (s) => void process.stdout.write(s));
    return 0;
}

/* c8 ignore start */
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href;
}
if (isCliEntry()) {
    process.exit(main());
}
/* c8 ignore stop */
