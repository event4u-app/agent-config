#!/usr/bin/env tsx
/**
 * `pr_conflict_census` — which paths actually cost merge conflicts.
 *
 * Answers "why is everything red" as one command, so the measurement never has
 * to be reconstructed by hand (road-to-merge-surface-zero AC-4).
 *
 * THE MEASUREMENT, and why it is a count of conflicts rather than of churn.
 * `git show --name-only` on a MERGE commit prints the *combined* diff: only the
 * paths that differ from BOTH parents. A conflict-free merge therefore prints
 * nothing, and a merge that resolved conflicts prints exactly the resolved
 * paths. Validated in both directions before this script existed:
 *
 *   - a merge with five known conflicts printed those five paths;
 *   - a clean PR merge printed nothing.
 *
 * So the census counts RESOLUTIONS, not touches. That distinction is the whole
 * value: a file edited in every branch but never conflicting is not a merge
 * surface, and a file edited rarely but always conflicting is.
 *
 * WHAT IT CANNOT SEE, stated because a census that overstates its reach is
 * worse than none. A conflict resolved by rebase leaves no merge commit, so it
 * is invisible here. A squash-merge of a branch that itself merged main carries
 * the resolution inside one commit with one parent — also invisible. The number
 * is therefore a FLOOR on conflict cost, never a total.
 *
 * Exit codes: 0 always. This is an instrument, not a gate.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');

export interface CensusRow {
    path: string;
    /** Merge commits in which this path had to be resolved against both parents. */
    resolutions: number;
}

export interface Census {
    rows: CensusRow[];
    /** Merge commits examined. */
    merges: number;
    /** Merges that resolved at least one path. */
    conflicted: number;
    /** The `--since` ASKED for. Not necessarily the window measured — see below. */
    since: string;
    ref: string;
    /**
     * Merge commits the `--since` window contains, before `--limit` truncation.
     *
     * The gap between this and `merges` is the whole reason it is reported: on
     * this repository a 60-day window holds ~1,800 merge commits, so a default
     * limit of 200 measures the newest THREE DAYS while a naive header would
     * print "60 days ago → HEAD". A census that mislabels its own window is
     * worse than no census, because the number looks like a trend.
     */
    available: number;
    /** Oldest and newest merge date ACTUALLY scanned, `YYYY-MM-DD`. */
    scannedFrom: string;
    scannedTo: string;
}

function git(root: string, args: readonly string[]): string {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? (r.stdout ?? '') : '';
}

export function census(
    root = REPO_ROOT,
    opts: { since?: string | undefined; ref?: string | undefined; limit?: number | undefined } = {},
): Census {
    const since = opts.since ?? '60 days ago';
    const ref = opts.ref ?? 'HEAD';
    const limit = opts.limit ?? 200;
    const lines = git(root, [
        'log',
        '--merges',
        `--since=${since}`,
        '--format=%H %ad',
        '--date=short',
        ref,
    ])
        .split('\n')
        .filter((l) => l.trim() !== '');
    const available = lines.length;
    const scanned = lines.slice(0, limit);
    const merges = scanned.map((l) => l.split(' ')[0] ?? '').filter((h) => h !== '');
    const dates = scanned.map((l) => (l.split(' ')[1] ?? '').trim()).filter((d) => d !== '');
    const scannedTo = dates[0] ?? '';
    const scannedFrom = dates[dates.length - 1] ?? '';
    const counts = new Map<string, number>();
    let conflicted = 0;
    for (const h of merges) {
        const files = git(root, ['show', '--format=', '--name-only', h])
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l !== '');
        if (files.length > 0) conflicted += 1;
        for (const f of files) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const rows = [...counts.entries()]
        .map(([p, n]) => ({ path: p, resolutions: n }))
        .sort((a, b) => b.resolutions - a.resolutions || a.path.localeCompare(b.path));
    return { rows, merges: merges.length, conflicted, since, ref, available, scannedFrom, scannedTo };
}

/** Is this path a generated artefact, i.e. one that should never be hand-merged? */
export function isGenerated(p: string): boolean {
    return (
        /^docs\/(proof|catalog|skills-catalog)\.md$/.test(p) ||
        /^agents\/(index\.md|reports\/)/.test(p) ||
        /^internal\/reports\//.test(p) ||
        /^dist\//.test(p) ||
        p === 'llms.txt' ||
        /^src\/domains\/[^/]+\/pack\.yaml$/.test(p) ||
        // Added after the first full-window run, because the first version
        // MISSED the top four hotspots and reported 10 % generated where the
        // real share is far higher. All four are written by
        // `update_roadmap_progress` / the archive index builder / the
        // condensation pass, never by hand:
        p === 'agents/roadmaps-progress.md' ||
        /^agents\/roadmaps\/(archive\/(index\.json|INDEX\.md)|stubs\/README\.md)$/.test(p) ||
        p === 'internal/.condensation-hashes.json'
    );
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    const arg = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const top = Number(arg('--top') ?? '15');
    const limitArg = arg('--limit');
    const c = census(root, {
        since: arg('--since'),
        ref: arg('--ref'),
        // Parsed here and not only accepted in `census()`: the default of 200
        // measures the newest three days on this repository, so a caller asking
        // for a real window needs a way to say so from the CLI.
        limit: limitArg === undefined ? undefined : Number(limitArg),
    });
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(c, null, 2)}\n`);
        return 0;
    }
    // The window ACTUALLY scanned, never the one asked for. Printing `--since`
    // as though it were the window is how a three-day reading becomes a
    // sixty-day claim.
    process.stdout.write(
        `merge conflicts resolved, ${c.scannedFrom} → ${c.scannedTo} (${c.ref}): ` +
            `${String(c.conflicted)} of ${String(c.merges)} merge commit(s) resolved at least one path\n`,
    );
    if (c.available > c.merges) {
        process.stdout.write(
            `  ⚠️  TRUNCATED: \`--since ${c.since}\` holds ${String(c.available)} merge commit(s); ` +
                `${String(c.merges)} were scanned (--limit). Raise --limit for the full window.\n`,
        );
    }
    process.stdout.write('\n');
    if (c.rows.length === 0) {
        process.stdout.write('  (no resolutions in the window — every merge in it was clean)\n');
        return 0;
    }
    const width = Math.max(...c.rows.slice(0, top).map((r) => r.path.length));
    for (const r of c.rows.slice(0, top)) {
        const tag = isGenerated(r.path) ? ' [generated]' : '';
        process.stdout.write(
            `  ${String(r.resolutions).padStart(3)}  ${r.path.padEnd(width)}${tag}\n`,
        );
    }
    const gen = c.rows.filter((r) => isGenerated(r.path)).reduce((n, r) => n + r.resolutions, 0);
    const all = c.rows.reduce((n, r) => n + r.resolutions, 0);
    process.stdout.write(
        `\n  ${String(gen)} of ${String(all)} resolutions (${String(Math.round((gen / all) * 100))} %) are on GENERATED paths — ` +
            'a PR carrying a regenerated output it did not need to carry.\n' +
            '  Floor, not a total: a conflict resolved by rebase leaves no merge commit and is invisible here.\n',
    );
    return 0;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
