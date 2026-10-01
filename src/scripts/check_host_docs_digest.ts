#!/usr/bin/env tsx
/**
 * check_host_docs_digest — the docs-drift watcher over `verified.docs_digest`.
 *
 * `host_lowering.yaml` records, per host, the page a row's answers were read
 * off (`verified.docs_url`) and the day they were read (`docs_at`). Those two
 * fields date the reading and nothing watches the page. A vendor can rewrite
 * its hooks contract the day after a row is filled, and every gate in this tree
 * stays green until the row's own `expires` lapses — up to a year later.
 *
 * `docs_digest` closes that window: the sha256 of the body as fetched by the
 * last digest run. This script re-fetches each `docs_url` and compares.
 *
 * It is deliberately NOT "as fetched on `docs_at`". Those are two events — the
 * reading a row's answers came from, and the hashing of a body — and the very
 * first fill separated them (digests taken 2026-10-01 against rows read
 * 2026-09-29). One sentence covering both asserted a provenance nobody had.
 *
 * WHAT A CHANGED DIGEST MEANS, AND WHAT IT DELIBERATELY DOES NOT.
 * A changed body is evidence that the page moved, never a reading of what it
 * now says. So the watcher adopts no upstream text, derives no slot, and
 * changes no `block_exit`. It does exactly one thing: it expires the row, which
 * hands the question to `lint_hook_manifest._check_host_lowering` — a gate that
 * already refuses an expired row carrying a blocking binding and only warns on
 * one that does not. A red there opens a local finding for a human to read the
 * page; it never encodes the page.
 *
 * WHY `expires` MOVES TO THE DAY BEFORE DETECTION, NOT TO THE DETECTION DATE.
 * The table's own header states the rule and the reason: the gate tests
 * `expires < today`, so `expires: <today>` is still valid TODAY and the refusal
 * would not land until tomorrow. "Valid through yesterday" is how a row stops
 * being current on the day the drift was seen. (The roadmap that asked for this
 * watcher wrote `expires: <today>`; the table header is the later and correct
 * statement, and this script follows the table.)
 *
 * WHY THE DIGEST IS NOT PART OF THE EXPIRY TEST ITSELF. A digest is evidence
 * about the page; `expires` is this package's review-by date. Collapsing them
 * would make a vendor's CSS rebuild read as a lapsed citation. The digest moves
 * `expires`; it is never compared against a clock.
 *
 * MODES
 *   (no flags)        Offline audit. Reports which rows can be watched, which
 *                     carry no digest yet, and which carry no URL to watch.
 *                     Touches the network never and exits 0 — it is a report,
 *                     not a gate, so a CI job may run it with no egress.
 *   --fetch           Re-fetch every `docs_url` and compare. Exit 1 if any
 *                     digest CHANGED, 0 otherwise. This is the scheduled job's
 *                     read-only mode: it NEVER touches the working tree. The
 *                     table is written by exactly one `writeFileSync` call and
 *                     it sits inside `if (doWrite)`, so `--fetch` alone cannot
 *                     reach it; `--write` without `--fetch` is refused outright
 *                     (exit 2) rather than silently doing nothing.
 *   --fetch --write   The same, and write the result back into the YAML: fill a
 *                     null digest, and on a CHANGED digest also pull `expires`
 *                     back to the day before detection.
 *   --self-test       Fixture round-trip over the pure functions. No network.
 *
 * A row whose `docs_url` is null is not a gap and is not an error: `cowork`
 * has no public hooks page to cite, which the table says in its own comment.
 * There is no body, so there is no digest, and the watcher reports it as
 * `no-url` and moves on.
 *
 * UNREACHABLE IS NOT CHANGED. A fetch that fails — offline runner, 503, a
 * timeout — establishes nothing about the page, so it never expires a row. It
 * is reported, and with `--strict-fetch` it also fails the run, so a scheduled
 * job can distinguish "nothing moved" from "nobody could look".
 *
 * GONE IS NOT UNREACHABLE. A 404/410 is the server answering authoritatively
 * that the page is not there, which is evidence the citation is dead — the
 * opposite of "nobody could look". It fails the run WITHOUT `--strict-fetch`,
 * because the scheduled job omits that flag precisely so transient flakes stay
 * quiet, and a dead citation keeping a stale digest and a year-long `expires`
 * in silence is the failure this watcher exists to prevent. It still writes
 * nothing: a human decides whether the page moved or the host dropped hooks.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { asOf } from './_lib/as_of.js';
import { sanitize_text } from './_lib/retrieval_sanitize.js';
import { HOST_LOWERING_PATH, parseHostLowering, type HostLowering } from './hooks/host_lowering.js';

/** sha256, hex — the digest shape `verified.docs_digest` carries. */
export function digestOf(body: string): string {
    return crypto.createHash('sha256').update(body, 'utf-8').digest('hex');
}

export type DigestState =
    /** Row has a digest and the fetched body still hashes to it. */
    | 'unchanged'
    /** Row had a digest and the body now hashes to something else. */
    | 'changed'
    /** Row had no digest; this run establishes the first one. */
    | 'filled'
    /** Row cites no page — nothing to hash. Not a defect. */
    | 'no-url'
    /** The page could not be read — transient. Establishes nothing either way. */
    | 'unreachable'
    /**
     * The page is GONE — the server answered, authoritatively, that it is not
     * there (404/410).
     *
     * Split from `unreachable` because lumping them made a dead citation
     * indistinguishable from a flaky one, and the scheduled job deliberately
     * does not pass `--strict-fetch` so that flakes stay quiet. A removed page
     * is the opposite of "nobody could look": it is strong evidence the
     * citation is no longer valid, and a row whose page no longer exists must
     * not keep a year-long `expires` and a stale digest in silence.
     */
    | 'gone';

export interface DigestFinding {
    readonly host: string;
    readonly surface: string;
    readonly url: string | null;
    readonly state: DigestState;
    /** Digest recorded in the table before this run. */
    readonly was: string | null;
    /** Digest computed this run, or null when nothing was read. */
    readonly now: string | null;
    /** Why a fetch failed, for `unreachable`. */
    readonly detail?: string | undefined;
}

/** The one state that moves `expires`. */
export function isDrift(f: DigestFinding): boolean {
    return f.state === 'changed';
}

/** The day before `today`, in ISO form — see the header for why. */
export function dayBefore(today: string): string {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

/**
 * Classify one row against a body that was (or was not) read.
 *
 * Split from the fetching so the whole decision is testable with no network —
 * the half that carries the risk is this one, and a test that could only reach
 * it through a live HTTP call would be watching the wrong thing.
 */
export function classify(
    host: string,
    surface: string,
    url: string | null,
    recorded: string | null,
    body: string | null,
    detail?: string,
): DigestFinding {
    if (url === null) {
        return { host, surface, url, state: 'no-url', was: recorded, now: null };
    }
    if (body === null) {
        // `gone` is decided by the CALLER (it saw the status code) and arrives
        // as the detail prefix, because `classify` is pure and never fetches.
        const state: DigestState = detail !== undefined && detail.startsWith('GONE ') ? 'gone' : 'unreachable';
        return { host, surface, url, state, was: recorded, now: null, detail };
    }
    const now = digestOf(body);
    if (recorded === null) {
        return { host, surface, url, state: 'filled', was: null, now };
    }
    return { host, surface, url, state: recorded === now ? 'unchanged' : 'changed', was: recorded, now };
}

/** Every (host, surface) the table carries, with the URL and digest it records. */
export function watchable(
    table: HostLowering,
): ReadonlyArray<{ host: string; surface: string; url: string | null; digest: string | null }> {
    const out: Array<{ host: string; surface: string; url: string | null; digest: string | null }> = [];
    for (const [host, surfaces] of table) {
        for (const [surface, row] of surfaces) {
            if (row.verified === null) continue;
            out.push({
                host,
                surface,
                url: row.verified.docs_url,
                digest: row.verified.docs_digest,
            });
        }
    }
    return out;
}

/**
 * Write findings back into the YAML TEXT by editing the two lines that change.
 *
 * NOT a `parseDocument` round-trip, and the reason is measured rather than
 * assumed. `parseDocument(...).toString()` on this table keeps every comment
 * but renormalises the hand-aligned flow mappings in `slots:` — 361 bytes of
 * deliberate column alignment across 32 rows, none of it this watcher's to
 * touch. A scheduled job whose first write reformats a third of the file is a
 * job whose diffs nobody reads. Editing the `docs_digest:` and `expires:` lines
 * in place keeps the change to exactly the lines whose content changed, which
 * is also what makes the resulting commit reviewable.
 *
 * The two lines are located structurally, not by a bare `grep`: the walk tracks
 * the host (indent 2) and surface (indent 6) headers and only rewrites fields
 * inside that row's `verified:` block, so a `docs_digest:` appearing in a
 * comment or under a different host is never hit.
 */
export function applyFindings(
    yamlText: string,
    findings: readonly DigestFinding[],
    today: string,
): { text: string; expired: string[]; written: string[]; missed: string[] } {
    const wanted = new Map<string, DigestFinding>();
    for (const f of findings) {
        if (f.state === 'no-url' || f.state === 'unreachable') continue;
        wanted.set(`${f.host}/${f.surface}`, f);
    }
    if (wanted.size === 0) return { text: yamlText, expired: [], written: [], missed: [] };

    const expired: string[] = [];
    // Which rows a line was actually rewritten for. Without this the caller
    // reported `filled` — "newly recorded" — for a row whose `verified:` block
    // carries no `docs_digest:` key at all: the walk finds nothing to replace,
    // writes nothing, and the run still claims success. A write claimed and not
    // performed is worse than a loud failure, so the two sets are compared.
    const written: string[] = [];
    const lines = yamlText.split('\n');
    let host: string | null = null;
    let surface: string | null = null;
    let inVerified = false;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        const hostM = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
        if (hostM) {
            host = hostM[1] as string;
            surface = null;
            inVerified = false;
            continue;
        }
        const surfaceM = /^ {6}([A-Za-z0-9_-]+):\s*$/.exec(line);
        if (surfaceM) {
            surface = surfaceM[1] as string;
            inVerified = false;
            continue;
        }
        if (/^ {8}verified:\s*$/.test(line)) {
            inVerified = true;
            continue;
        }
        // Any other KEY at the row's own indent closes the block — but a
        // comment at that indent does not. The table puts long findings in
        // `#`-comments at every depth, and treating one as the block end would
        // silently stop rewriting the fields below it: a no-op write that
        // reports success, which is the worst shape a watcher can have.
        if (inVerified && /^ {8}\S/.test(line) && !/^\s*#/.test(line)) {
            inVerified = false;
            continue;
        }
        if (!inVerified || host === null || surface === null) continue;

        const f = wanted.get(`${host}/${surface}`);
        if (f === undefined) continue;

        // A DRIFTED ROW KEEPS ITS RECORDED DIGEST. Two reasons, and the second
        // is the one that matters more.
        //
        // 1. Provenance. `docs_digest` is "the sha256 of the body as fetched on
        //    `docs_at`". Writing the NEW body's hash while leaving `docs_at`
        //    untouched makes the row assert a reading that never happened — a
        //    false statement in a table whose entire purpose is that its
        //    statements are true, and a quiet form of exactly the "adopts no
        //    upstream text" this module promises not to do.
        // 2. The drift signal would erase itself. Overwriting the digest means
        //    the NEXT run compares new-against-new and reports `unchanged`, so
        //    a human who misses the one red week never learns the page moved.
        //    Keeping the old digest holds the row red until a human re-reads
        //    the page and re-establishes `docs_at` + `docs_digest` together.
        //
        // So drift writes `expires` ONLY. A first fill (`filled`) still writes
        // the digest, because there is no prior reading to contradict.
        if (isDrift(f)) {
            const expiresM = /^(\s+expires:\s*).*$/.exec(line);
            if (expiresM) {
                lines[i] = `${expiresM[1] as string}${dayBefore(today)}`;
                expired.push(`${host}/${surface}`);
                written.push(`${host}/${surface}`);
            }
            continue;
        }
        const digestM = /^(\s+docs_digest:\s*).*$/.exec(line);
        if (digestM) {
            lines[i] = `${digestM[1] as string}${f.now ?? 'null'}`;
            written.push(`${host}/${surface}`);
        }
    }
    const missed = [...wanted.keys()].filter((k) => !written.includes(k));
    return { text: lines.join('\n'), expired, written, missed };
}

async function fetchBody(url: string, timeoutMs: number): Promise<{ body: string | null; detail?: string }> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ac.signal, redirect: 'follow' });
        // 404/410 is the server stating authoritatively that the page is not
        // there. Everything else non-ok — 5xx, 429, a proxy error — may be
        // transient and must not condemn a citation.
        if (res.status === 404 || res.status === 410) {
            return { body: null, detail: `GONE HTTP ${res.status}` };
        }
        if (!res.ok) return { body: null, detail: `HTTP ${res.status}` };
        return { body: await res.text() };
    } catch (exc) {
        // The ONE fetch-derived string this script ever prints, so it is the one
        // that gets the sanitize floor. The body is hashed and discarded — a
        // sha256 cannot carry a bidi override — but an exception message can
        // quote a server-supplied URL or header, and this text lands on stdout
        // in a CI log a human reads. Stripping hidden-instruction vectors here
        // is what makes this module's `covered` row in
        // `docs/contracts/retrieval-read-surfaces.md` a true statement rather
        // than an import that satisfies a generator.
        return { body: null, detail: sanitize_text(exc instanceof Error ? exc.message : String(exc)) };
    } finally {
        clearTimeout(timer);
    }
}

const KNOWN_FLAGS: ReadonlySet<string> = new Set([
    '--fetch',
    '--write',
    '--self-test',
    '--strict-fetch',
    '--quiet',
    '--lowering',
    '--today',
]);

const STATE_ICON: Record<DigestState, string> = {
    unchanged: '✅',
    changed: '❌',
    filled: '🆕',
    'no-url': '—',
    unreachable: '⚠️ ',
    gone: '💀',
};

function selfTest(): number {
    const problems: string[] = [];
    if (digestOf('abc') !== crypto.createHash('sha256').update('abc').digest('hex')) {
        problems.push('digestOf disagrees with sha256');
    }
    if (dayBefore('2026-10-01') !== '2026-09-30') problems.push('dayBefore month boundary');
    if (dayBefore('2026-01-01') !== '2025-12-31') problems.push('dayBefore year boundary');

    const same = classify('h', 'any', 'u', digestOf('body'), 'body');
    if (same.state !== 'unchanged') problems.push('equal body must be unchanged');
    const moved = classify('h', 'any', 'u', digestOf('body'), 'other');
    if (moved.state !== 'changed') problems.push('different body must be changed');
    if (classify('h', 'any', 'u', null, 'body').state !== 'filled') problems.push('null digest must fill');
    if (classify('h', 'any', null, null, null).state !== 'no-url') problems.push('null url must be no-url');
    if (classify('h', 'any', 'u', 'd', null).state !== 'unreachable') problems.push('no body must be unreachable');

    // An unreachable row must not expire anything — the property the whole
    // "unreachable is not changed" paragraph rests on.
    const src = fs.readFileSync(HOST_LOWERING_PATH, 'utf-8');
    const untouched = applyFindings(src, [classify('claude', 'any', 'u', 'd', null)], '2026-10-01');
    if (untouched.expired.length !== 0) problems.push('unreachable must not expire a row');
    if (untouched.text !== src) problems.push('unreachable must not edit the table');

    const drifted = applyFindings(src, [classify('claude', 'any', 'u', 'old', 'new-body')], '2026-10-01');
    if (!drifted.text.includes('WHY THIS FILE EXISTS')) problems.push('write must preserve comments');
    if (drifted.expired.join() !== 'claude/any') problems.push('drift must report the row it expired');

    // The write touches EXACTLY the one line whose content changed — `expires`
    // — and the hand-aligned `slots:` block is not it. Counting the differing
    // lines is what keeps the "minimal diff" claim in the block comment above
    // honest; asserting only that the new value is present would pass just as
    // well on a full reformat. One line and not two: a drifted row keeps its
    // recorded digest, see `applyFindings`.
    const before = src.split('\n');
    const after = drifted.text.split('\n');
    const changedLines = before.length === after.length
        ? before.reduce((n, l, i) => (l === after[i] ? n : n + 1), 0)
        : -1;
    if (changedLines !== 1) {
        problems.push(`drift write must change exactly 1 line, changed ${changedLines}`);
    }

    // A sibling row must be untouched. Derived from the table rather than
    // compared against a literal date: a hard-coded `expires` here reds the
    // self-test whenever an unrelated row is legitimately renewed, which is a
    // fixture asserting the calendar instead of the code.
    const siblingBefore = parseHostLowering(src).get('gemini')?.get('any')?.verified;
    const siblingAfter = parseHostLowering(drifted.text).get('gemini')?.get('any')?.verified;
    if (siblingBefore?.expires !== siblingAfter?.expires) problems.push('a sibling row must not be expired');
    if (siblingBefore?.docs_digest !== siblingAfter?.docs_digest) problems.push('a sibling digest must not move');

    // The drifted row's OWN digest is unchanged, anchored at the row rather
    // than by a bare `includes` that any row could satisfy.
    const driftedRow = parseHostLowering(drifted.text).get('claude')?.get('any')?.verified;
    if (driftedRow?.expires !== '2026-09-30') problems.push('drifted row must expire to the day before');
    if (driftedRow?.docs_digest !== parseHostLowering(src).get('claude')?.get('any')?.verified?.docs_digest) {
        problems.push('drift must not overwrite the recorded digest');
    }

    // 404 is not a flake.
    if (classify('h', 'any', 'u', 'd', null, 'GONE HTTP 404').state !== 'gone') problems.push('404 must be gone');
    if (classify('h', 'any', 'u', 'd', null, 'HTTP 503').state !== 'unreachable') problems.push('503 must be unreachable');

    for (const p of problems) process.stderr.write(`❌  ${p}\n`);
    if (problems.length === 0) process.stdout.write('✅  check_host_docs_digest: self-test passed.\n');
    return problems.length === 0 ? 0 : 1;
}

export async function main(argv: readonly string[]): Promise<number> {
    for (const a of argv) {
        if (a.startsWith('--') && !KNOWN_FLAGS.has(a.split('=')[0] ?? a)) {
            process.stderr.write(
                `check_host_docs_digest: unknown flag \`${a}\`. Known: ${[...KNOWN_FLAGS].sort().join(', ')}\n`,
            );
            return 2;
        }
    }
    if (argv.includes('--self-test')) return selfTest();

    const quiet = argv.includes('--quiet');
    const doFetch = argv.includes('--fetch');
    const doWrite = argv.includes('--write');
    const strictFetch = argv.includes('--strict-fetch');
    /**
     * Resolve `--flag value` AND `--flag=value`, and refuse a flag with no value.
     *
     * The first version accepted only the space form while the unknown-flag
     * guard above split on `=` — so `--lowering=/nonexistent` passed validation
     * and was then silently ignored, and the run read the REAL table and
     * reported green. That is the precise fail-open this guard exists to
     * prevent, and a sibling gate shipped it once already. A missing value is
     * an error rather than a null, because `--today` as the last argument used
     * to fall through to the wall clock and `--today --quiet` used to take
     * `--quiet` as the date.
     */
    const bad: string[] = [];
    const valueOf = (flag: string): string | null => {
        const inline = argv.find((a) => a.startsWith(`${flag}=`));
        if (inline !== undefined) {
            const v = inline.slice(flag.length + 1);
            if (v === '') bad.push(`${flag}= has an empty value`);
            return v === '' ? null : v;
        }
        const i = argv.indexOf(flag);
        if (i < 0) return null;
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
            bad.push(`${flag} needs a value`);
            return null;
        }
        return next;
    };
    const tablePath = valueOf('--lowering') ?? HOST_LOWERING_PATH;
    const todayRaw = valueOf('--today');
    if (todayRaw !== null && !/^\d{4}-\d{2}-\d{2}$/.test(todayRaw)) {
        bad.push(`--today ${todayRaw} is not an ISO YYYY-MM-DD date`);
    }
    if (bad.length > 0) {
        for (const b of bad) process.stderr.write(`check_host_docs_digest: ${b}.\n`);
        return 2;
    }
    // `asOf()` rather than the wall clock: a verdict that depends on the hour it
    // ran is not reproducible from the commit, and this one writes a date INTO
    // the tree. It resolves --as-of, AC_AS_OF and the commit date under CI.
    const today = todayRaw ?? asOf().toISOString().slice(0, 10);

    if (doWrite && !doFetch) {
        process.stderr.write('check_host_docs_digest: `--write` needs `--fetch` — there is nothing to write without a read.\n');
        return 2;
    }

    // The PARSE is inside the guard too, not only the read. A malformed table
    // threw past the `return 2` contract and surfaced as an unhandled rejection
    // — a stack trace on the scheduled job, which contradicts that job's own
    // promise that a red there means "go read a page, nothing is broken here".
    let text: string;
    let table: HostLowering;
    try {
        text = fs.readFileSync(tablePath, 'utf-8');
        table = parseHostLowering(text);
    } catch (exc) {
        process.stderr.write(
            `check_host_docs_digest: cannot read or parse ${tablePath}: ` +
                `${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }
    const rows = watchable(table);

    if (!doFetch) {
        const withDigest = rows.filter((r) => r.digest !== null).length;
        const noUrl = rows.filter((r) => r.url === null).length;
        if (!quiet) {
            process.stdout.write(
                `check_host_docs_digest: ${rows.length} verified row(s) — ` +
                    `${withDigest} watched, ${rows.length - withDigest - noUrl} awaiting a first digest, ` +
                    `${noUrl} with no page to watch.\n`,
            );
            for (const r of rows) {
                const mark = r.url === null ? '—' : r.digest === null ? '🆕' : '✅';
                process.stdout.write(`  ${mark} ${r.host}/${r.surface}  ${r.url ?? '(no docs_url)'}\n`);
            }
            process.stdout.write('  Offline report — pass `--fetch` to compare against the live pages.\n');
        }
        return 0;
    }

    const findings: DigestFinding[] = [];
    for (const r of rows) {
        if (r.url === null) {
            findings.push(classify(r.host, r.surface, null, r.digest, null));
            continue;
        }
        const { body, detail } = await fetchBody(r.url, 30_000);
        findings.push(classify(r.host, r.surface, r.url, r.digest, body, detail));
    }

    if (!quiet) {
        for (const f of findings) {
            const extra = f.state === 'unreachable' ? ` (${f.detail ?? 'unreadable'})` : '';
            process.stdout.write(`  ${STATE_ICON[f.state]} ${f.host}/${f.surface} — ${f.state}${extra}\n`);
            // A drift line names everything needed to act on it without a
            // second run: which page, what it hashed to before, what it hashes
            // to now, and when that was seen. A bare "changed" sends the reader
            // back to the terminal to find out what changed about what.
            if (isDrift(f)) {
                process.stdout.write(
                    `       url:  ${f.url ?? '(none)'}\n` +
                        `       was:  ${f.was ?? 'null'}\n` +
                        `       now:  ${f.now ?? 'null'}\n` +
                        `       seen: ${today}\n`,
                );
            }
        }
    }

    const drifted = findings.filter(isDrift);
    const unreachable = findings.filter((f) => f.state === 'unreachable');

    if (doWrite) {
        const { text: next, expired, missed } = applyFindings(text, findings, today);
        if (next !== text) {
            fs.writeFileSync(tablePath, next);
            process.stdout.write(`✍️   ${path.basename(tablePath)} updated.\n`);
            // The compiled sibling is fingerprinted over the YAML TEXT, so any
            // write here desyncs it and reds `task preflight` and CI. Both
            // completion reviewers found this the same way: by watching it
            // happen on this branch. Naming the command beats rediscovering it.
            process.stdout.write(
                '   NEXT: ./scripts-run src/scripts/compile_hook_manifest --table host-lowering\n' +
                    '   (the compiled sibling is hashed over the YAML text, so this write makes it stale)\n',
            );
        }
        for (const e of expired) {
            process.stdout.write(
                `   ${e}: docs body changed — \`expires\` pulled to ${dayBefore(today)}, digest left as recorded. ` +
                    'Read the page and re-establish `docs_at` + `docs_digest` together; `lint_hook_manifest` refuses the row now if it carries a blocking binding.\n',
            );
        }
        if (missed.length > 0) {
            // A row the walk could not write — most plausibly a `verified:`
            // block carrying no `docs_digest:` key at all. Silence here would
            // have the run report "newly recorded" for a row it never touched.
            process.stderr.write(
                `❌  check_host_docs_digest: ${missed.length} row(s) were resolved but NOT written: ` +
                    `${missed.join(', ')}. The \`verified:\` block is probably missing the key the walk rewrites. ` +
                    'Nothing was claimed for them.\n',
            );
            return 2;
        }
    }

    if (drifted.length > 0) {
        process.stderr.write(
            `❌  check_host_docs_digest: ${drifted.length} host doc page(s) changed since the row was established: ` +
                `${drifted.map((f) => f.host).join(', ')}. This is a signal to READ the page, never to adopt it.\n`,
        );
        return 1;
    }
    const gone = findings.filter((f) => f.state === 'gone');
    if (gone.length > 0) {
        process.stderr.write(
            `❌  check_host_docs_digest: ${gone.length} cited page(s) are GONE (404/410): ` +
                `${gone.map((f) => `${f.host} ${f.url ?? ''}`).join(', ')}. ` +
                'A removed page is not a flake — the citation is dead and the row still carries its digest and `expires`. ' +
                'Find the current page, re-read it, and re-establish the row by hand.\n',
        );
        return 1;
    }
    if (unreachable.length > 0 && strictFetch) {
        process.stderr.write(
            `❌  check_host_docs_digest: ${unreachable.length} page(s) could not be read ` +
                `(${unreachable.map((f) => f.host).join(', ')}). Unreachable establishes nothing — re-run with egress.\n`,
        );
        return 1;
    }
    if (!quiet) {
        const filled = findings.filter((f) => f.state === 'filled').length;
        // "newly recorded" is only true when something was written. In the
        // read-only mode the scheduled job runs, a row with a null digest was
        // computed and discarded, and calling that "recorded" would have the
        // weekly job claim, every week and forever, to have fixed something it
        // did not touch.
        const filledPhrase = doWrite
            ? `${filled} newly recorded`
            : `${filled} with no digest yet (not written — this run is read-only)`;
        process.stdout.write(
            `✅  check_host_docs_digest: no host documentation drift ` +
                `(${findings.filter((f) => f.state === 'unchanged').length} unchanged, ` +
                `${filledPhrase}, ${unreachable.length} unreachable).\n`,
        );
    }
    return 0;
}

const _invokedDirectly =
    process.argv[1] !== undefined && /check_host_docs_digest\.ts$/.test(process.argv[1]);
if (_invokedDirectly) {
    // `.catch` as well as `.then`: without it any throw this module did not
    // anticipate leaves an unhandled rejection rather than the documented
    // exit-2 contract, and on a scheduled job the difference between "exit 2,
    // something is wrong with the inputs" and a bare stack trace is the whole
    // signal.
    void main(process.argv.slice(2))
        .then((code) => {
            process.exitCode = code;
        })
        .catch((exc: unknown) => {
            process.stderr.write(
                `check_host_docs_digest: unexpected failure: ${exc instanceof Error ? exc.stack ?? exc.message : String(exc)}\n`,
            );
            process.exitCode = 2;
        });
}
