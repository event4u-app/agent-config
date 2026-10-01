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
 * `docs_digest` closes that window: the sha256 of the body as fetched on
 * `docs_at`. This script re-fetches each `docs_url` and compares.
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
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
    /** The page could not be read. Establishes nothing either way. */
    | 'unreachable';

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
        return { host, surface, url, state: 'unreachable', was: recorded, now: null, detail };
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
): { text: string; expired: string[] } {
    const wanted = new Map<string, DigestFinding>();
    for (const f of findings) {
        if (f.state === 'no-url' || f.state === 'unreachable') continue;
        wanted.set(`${f.host}/${f.surface}`, f);
    }
    if (wanted.size === 0) return { text: yamlText, expired: [] };

    const expired: string[] = [];
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
        // Any other key at the row's own indent closes the block.
        if (inVerified && /^ {8}\S/.test(line)) {
            inVerified = false;
            continue;
        }
        if (!inVerified || host === null || surface === null) continue;

        const f = wanted.get(`${host}/${surface}`);
        if (f === undefined) continue;

        const digestM = /^(\s+docs_digest:\s*).*$/.exec(line);
        if (digestM) {
            lines[i] = `${digestM[1] as string}${f.now ?? 'null'}`;
            continue;
        }
        if (isDrift(f)) {
            const expiresM = /^(\s+expires:\s*).*$/.exec(line);
            if (expiresM) {
                lines[i] = `${expiresM[1] as string}${dayBefore(today)}`;
                expired.push(`${host}/${surface}`);
            }
        }
    }
    return { text: lines.join('\n'), expired };
}

async function fetchBody(url: string, timeoutMs: number): Promise<{ body: string | null; detail?: string }> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ac.signal, redirect: 'follow' });
        if (!res.ok) return { body: null, detail: `HTTP ${res.status}` };
        return { body: await res.text() };
    } catch (exc) {
        return { body: null, detail: exc instanceof Error ? exc.message : String(exc) };
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
    if (!drifted.text.includes('expires: 2026-09-30')) problems.push('drift must pull expires to the day before');
    if (!drifted.text.includes('WHY THIS FILE EXISTS')) problems.push('write must preserve comments');
    if (drifted.expired.join() !== 'claude/any') problems.push('drift must report the row it expired');

    // The write touches EXACTLY the two lines whose content changed, and the
    // hand-aligned `slots:` block is not one of them. Counting the differing
    // lines is what keeps the "minimal diff" claim in the block comment above
    // honest; asserting only that the new value is present would pass just as
    // well on a full reformat.
    const before = src.split('\n');
    const after = drifted.text.split('\n');
    const changedLines = before.length === after.length
        ? before.reduce((n, l, i) => (l === after[i] ? n : n + 1), 0)
        : -1;
    if (changedLines !== 2) {
        problems.push(`drift write must change exactly 2 lines, changed ${changedLines}`);
    }

    // Another host's row must be untouched by a finding that does not name it.
    if (!drifted.text.includes('expires: 2027-09-29')) problems.push('a sibling row must not be expired');

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
    const valueOf = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
    };
    const tablePath = valueOf('--lowering') ?? HOST_LOWERING_PATH;
    const today = valueOf('--today') ?? new Date().toISOString().slice(0, 10);

    if (doWrite && !doFetch) {
        process.stderr.write('check_host_docs_digest: `--write` needs `--fetch` — there is nothing to write without a read.\n');
        return 2;
    }

    let text: string;
    try {
        text = fs.readFileSync(tablePath, 'utf-8');
    } catch (exc) {
        process.stderr.write(`check_host_docs_digest: cannot read ${tablePath}: ${String(exc)}\n`);
        return 2;
    }
    const table = parseHostLowering(text);
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
                        `       seen: ${new Date().toISOString()}\n`,
                );
            }
        }
    }

    const drifted = findings.filter(isDrift);
    const unreachable = findings.filter((f) => f.state === 'unreachable');

    if (doWrite) {
        const { text: next, expired } = applyFindings(text, findings, today);
        if (next !== text) {
            fs.writeFileSync(tablePath, next);
            process.stdout.write(`✍️   ${path.basename(tablePath)} updated.\n`);
        }
        for (const e of expired) {
            process.stdout.write(
                `   ${e}: docs body changed — \`expires\` pulled to ${dayBefore(today)}. ` +
                    'Read the page and re-establish the row; `lint_hook_manifest` refuses it now if it carries a blocking binding.\n',
            );
        }
    }

    if (drifted.length > 0) {
        process.stderr.write(
            `❌  check_host_docs_digest: ${drifted.length} host doc page(s) changed since the row was established: ` +
                `${drifted.map((f) => f.host).join(', ')}. This is a signal to READ the page, never to adopt it.\n`,
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
        process.stdout.write(
            `✅  check_host_docs_digest: no host documentation drift ` +
                `(${findings.filter((f) => f.state === 'unchanged').length} unchanged, ` +
                `${findings.filter((f) => f.state === 'filled').length} newly recorded, ` +
                `${unreachable.length} unreachable).\n`,
        );
    }
    return 0;
}

const _invokedDirectly =
    process.argv[1] !== undefined && /check_host_docs_digest\.ts$/.test(process.argv[1]);
if (_invokedDirectly) {
    void main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
