/**
 * History lane: files that change together, read from one bounded `git log` pass.
 *
 * A pair is coupled when both files appear in at least `min_co_changes` commits
 * of the window and that shared count is at least `min_strength` of the busier
 * file's own count. Bulk commits (formatting sweeps, renames of a tree) are
 * skipped: they couple everything with everything and say nothing. Renames are
 * followed so a file keeps the history it had under its old name, but only
 * files present in HEAD are reported — a coupling to a deleted file is not
 * something the agent can act on.
 *
 * A pair whose BOTH files are generated (a build projection, a lockfile, a
 * changelog, a regenerated dashboard — the `generated` globs) is dropped: such
 * files move together because one command rewrites them all, which is no
 * dependency an agent could miss. A glob without `/` matches the basename.
 */
import { globToRegExp } from '../../../_lib/infra_files/pipeline.js';
import { gitProbe } from '../../../_lib/spawn_env.js';
import type { CodeGraph } from '../../types.js';
import type { LaneOutput, LaneRelation, Witness } from '../lane_fact.js';
import defaults from './thresholds.json';

export interface HistoryThresholds {
    window_days: number;
    max_files_per_commit: number;
    min_co_changes: number;
    min_strength: number;
    generated: string[];
}

export const DEFAULT_HISTORY_THRESHOLDS: Readonly<HistoryThresholds> = defaults;

export interface ReadHistoryOptions extends Partial<HistoryThresholds> {
    /** Injected for tests; defaults to the hardened git probe. */
    git?: (root: string, args: readonly string[]) => string;
}

interface Commit {
    sha: string;
    date: string;
    /** canonical paths touched that exist in HEAD */
    files: string[];
    /** every path the commit touched, deleted ones included — what the bulk cut measures */
    touched: number;
}

const RS = '\x1e';
const US = '\x1f';

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

/**
 * Parse `--name-status -M` output, newest commit first, into commits whose
 * paths are mapped to the name each file carries today.
 */
export function parseNameStatusLog(out: string, current: ReadonlySet<string>): Commit[] {
    // Walking newest → oldest, a rename `old → new` means every older mention of
    // `old` is the file now called canonical(new).
    const alias = new Map<string, string>();
    const canonical = (p: string): string => alias.get(p) ?? p;
    const commits: Commit[] = [];
    for (const rec of out.split(RS)) {
        if (!rec.trim()) continue;
        const [header = '', ...lines] = rec.split('\n');
        const [sha = '', date = ''] = header.split(US);
        if (!sha) continue;
        const touched = new Set<string>();
        let raw = 0;
        for (const line of lines) {
            if (!line.trim()) continue;
            const cols = line.split('\t');
            const status = cols[0] ?? '';
            if ((status.startsWith('R') || status.startsWith('C')) && cols.length >= 3) {
                const from = cols[1] as string;
                const to = canonical(cols[2] as string);
                raw++;
                if (status.startsWith('R')) alias.set(from, to);
                touched.add(to);
            } else if (cols.length >= 2) {
                raw++;
                touched.add(canonical(cols[1] as string));
            }
        }
        if (raw === 0) continue;
        commits.push({ sha, date, files: [...touched].filter((p) => current.has(p)).sort(), touched: raw });
    }
    return commits;
}

function defaultGit(root: string, args: readonly string[]): string {
    return gitProbe(root, args, { maxBuffer: 512 * 1024 * 1024 });
}

export function readHistory(root: string, opts: ReadHistoryOptions = {}): LaneOutput {
    const t: HistoryThresholds = {
        window_days: opts.window_days ?? DEFAULT_HISTORY_THRESHOLDS.window_days,
        max_files_per_commit: opts.max_files_per_commit ?? DEFAULT_HISTORY_THRESHOLDS.max_files_per_commit,
        min_co_changes: opts.min_co_changes ?? DEFAULT_HISTORY_THRESHOLDS.min_co_changes,
        min_strength: opts.min_strength ?? DEFAULT_HISTORY_THRESHOLDS.min_strength,
        generated: opts.generated ?? DEFAULT_HISTORY_THRESHOLDS.generated,
    };
    const isGenerated = generatedMatcher(t.generated);
    const git = opts.git ?? defaultGit;
    const output: LaneOutput = { lane: 'history', facts: [], relations: [], skipped: [] };
    const skip = (reason: string): LaneOutput => {
        output.skipped.push({ file: '.git', reason });
        return output;
    };
    let head: string;
    try {
        head = git(root, ['log', '-1', '--format=%cI']).trim();
    } catch {
        return skip('not a git repository or no commits');
    }
    if (!head) return skip('no commits');
    try {
        // A shallow clone holds a commit or two: no coupling would look like "no coupling".
        if (git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true') return skip('shallow clone');
    } catch {
        return skip('cannot tell whether the clone is shallow');
    }
    // Anchored on HEAD's commit date, not the clock, so one commit yields one answer.
    const since = new Date(new Date(head).getTime() - t.window_days * 86_400_000).toISOString();
    let current: Set<string>;
    let log: string;
    try {
        current = new Set(
            git(root, ['-c', 'core.quotePath=false', 'ls-files', '-z', '--', '.'])
                .split('\0')
                .filter(Boolean),
        );
        log = git(root, [
            '-c',
            'core.quotePath=false',
            'log',
            `--since=${since}`,
            '--no-merges',
            '-M',
            '--relative',
            '--name-status',
            `--format=${RS}%H${US}%cs`,
            '--',
            '.',
        ]);
    } catch {
        return skip('git log failed');
    }

    const commits = parseNameStatusLog(log, current);
    const perFile = new Map<string, number>();
    const pairs = new Map<string, { count: number; sha: string; date: string }>();
    let bulk = 0;
    for (const c of commits) {
        if (c.touched > t.max_files_per_commit) {
            bulk++;
            continue;
        }
        for (const f of c.files) perFile.set(f, (perFile.get(f) ?? 0) + 1);
        for (let i = 0; i < c.files.length; i++) {
            for (let j = i + 1; j < c.files.length; j++) {
                const key = `${c.files[i]}\0${c.files[j]}`;
                const p = pairs.get(key);
                // Commits arrive newest first, so the first sighting is the latest one.
                if (p) p.count++;
                else pairs.set(key, { count: 1, sha: c.sha, date: c.date });
            }
        }
    }
    if (bulk > 0) output.skipped.push({ file: '.git', reason: `${bulk} commit(s) over ${t.max_files_per_commit} files skipped` });

    const relations: LaneRelation[] = [];
    let generatedPairs = 0;
    for (const [key, p] of pairs) {
        if (p.count < t.min_co_changes) continue;
        const [a = '', b = ''] = key.split('\0');
        const strength = p.count / Math.max(perFile.get(a) ?? 0, perFile.get(b) ?? 0);
        if (strength < t.min_strength) continue;
        if (isGenerated(a) && isGenerated(b)) {
            generatedPairs++;
            continue;
        }
        relations.push({
            relation: 'co-changes',
            from: a,
            to: b,
            attrs: {
                count: p.count,
                strength: round3(strength),
                last_sha: p.sha,
                last_date: p.date,
                files: [a, b],
                window_days: t.window_days,
            },
            witness: commitWitness(a, p.sha),
            rung: 'T1',
            owner: '.git',
            guess: false,
        });
    }
    if (generatedPairs > 0) output.skipped.push({ file: '.git', reason: `${generatedPairs} coupled pair(s) of two generated files skipped` });
    relations.sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : x.to < y.to ? -1 : x.to > y.to ? 1 : 0));
    output.relations = relations;
    return output;
}

/** Matcher for the `generated` globs; a glob without `/` is tested against the basename. */
export function generatedMatcher(globs: readonly string[]): (file: string) => boolean {
    const full = globs.filter((g) => g.includes('/')).map(globToRegExp);
    const base = globs.filter((g) => !g.includes('/')).map(globToRegExp);
    return (file) => {
        if (full.some((re) => re.test(file))) return true;
        const name = file.slice(file.lastIndexOf('/') + 1);
        return base.some((re) => re.test(name));
    };
}

/** A commit is the span: the witness names the file and the commit that last coupled it. */
function commitWitness(file: string, sha: string): Witness {
    return { file, line: 1, hash: sha.slice(0, 8) };
}

export interface HiddenDependency {
    a: string;
    b: string;
    count: number;
    strength: number;
    last_sha: string;
    witnesses: [Witness, Witness];
}

/**
 * Coupled pairs the static graph has no edge for, in either direction, between
 * any symbol of one file and any symbol of the other.
 */
export function hiddenDependencies(output: LaneOutput, graph: Pick<CodeGraph, 'nodes' | 'edges'>): HiddenDependency[] {
    const fileOf = new Map<string, string>();
    for (const n of graph.nodes) fileOf.set(n.id, n.source_file);
    const linked = new Set<string>();
    for (const e of graph.edges) {
        const s = fileOf.get(e.source);
        const d = fileOf.get(e.target);
        if (!s || !d || s === d) continue;
        linked.add(`${s}\0${d}`);
        linked.add(`${d}\0${s}`);
    }
    const out: HiddenDependency[] = [];
    for (const r of output.relations) {
        if (r.relation !== 'co-changes') continue;
        if (linked.has(`${r.from}\0${r.to}`)) continue;
        const sha = String(r.attrs.last_sha ?? '');
        out.push({
            a: r.from,
            b: r.to,
            count: Number(r.attrs.count ?? 0),
            strength: Number(r.attrs.strength ?? 0),
            last_sha: sha,
            witnesses: [commitWitness(r.from, sha), commitWitness(r.to, sha)],
        });
    }
    return out;
}
