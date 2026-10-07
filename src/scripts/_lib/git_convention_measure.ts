/**
 * Measures the convention an existing history already follows, so a project
 * with no declaration is offered its own format instead of the shipped default.
 *
 * The core is pure — commits, branch names and merge subjects in, a verdict
 * out — and the thresholds live here as constants: the reference page renders
 * them from this module, so the bar a reader sees is the bar the code applies.
 * `readHistory` is the one function that runs git.
 *
 * Every figure is a policy heuristic (council 2026-09-04), not a statistically
 * derived threshold.
 */
import { spawnSync } from 'node:child_process';

import { invalidReason } from './git_convention.js';
import { makeTargetDeps } from './git_convention_carrier.js';
import { classifySubject, COMMIT_TYPES, TICKET_GRAMMAR, type CommitFormat, type SubjectFamily } from './git_convention_grammar.js';

export const MEASURE_LIMIT = 200;
export const MEASURE_SINCE = '24 months ago';
export const MIN_N = 30;
/** With three or more human authors, over the per-author-capped sample. */
export const SHARE_BAR = 0.8;
/** With one or two authors, uncapped: a cap of 20 would put `MIN_N` out of reach. */
export const SMALL_TEAM_SHARE_BAR = 0.9;
export const MIN_CAPPED_AUTHORS = 3;
export const AUTHOR_CAP_PER_HALF = 20;
export const BULK_IMPORT_FILES = 500;
/** Merged branches are usually deleted, so far fewer names survive than commits. */
export const MIN_BRANCHES = 10;
/** The revision of the families and exclusions; a card measured under another one is re-measured. */
export const CLASSIFIER_VERSION = '2026-10-06';

export const BOT_AUTHOR = /\[bot\]|dependabot|renovate|github-actions|semantic-release|release-please/i;
export const AUTOMATION_SUBJECT = /^Revert |^Merge |^chore\(release\)|^Bump |^v?\d+\.\d+\.\d+$/;

export interface HistoryCommit {
    author: string;
    email: string;
    subject: string;
    /** Files the commit touched, or null when unknown. */
    files: number | null;
}

export interface FamilyShare {
    family: SubjectFamily | 'other';
    count: number;
    share: number;
}

export interface HalfReading {
    n: number;
    family: SubjectFamily | 'other' | null;
    share: number;
}

export interface SubjectMeasurement {
    eligible: number;
    excluded: { bots: number; automation: number; bulk: number };
    authors: number;
    capped: boolean;
    cappedTotal: number;
    bar: number;
    families: FamilyShare[];
    newer: HalfReading;
    older: HalfReading;
    halvesAgree: boolean;
    /** The family to propose, or null below the bar. */
    established: SubjectFamily | null;
    /** True when the halves disagree and only the newer half cleared the bar on its own. */
    migrating: boolean;
    /** Why the history is below the bar; empty when a family is established. */
    reasons: string[];
    /** The two strongest families with a grammar, strongest first. */
    strongest: SubjectFamily[];
}

function _key(c: HistoryCommit): string {
    return (c.email || c.author).toLowerCase();
}

function _cap(commits: readonly HistoryCommit[]): HistoryCommit[] {
    const seen = new Map<string, number>();
    return commits.filter((c) => {
        const k = _key(c);
        const n = (seen.get(k) ?? 0) + 1;
        seen.set(k, n);
        return n <= AUTHOR_CAP_PER_HALF;
    });
}

function _shares(commits: readonly HistoryCommit[]): FamilyShare[] {
    const counts = new Map<SubjectFamily | 'other', number>();
    for (const c of commits) {
        const f = classifySubject(c.subject);
        counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const total = commits.length;
    return [...counts.entries()]
        .map(([family, count]) => ({ family, count, share: total === 0 ? 0 : count / total }))
        .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));
}

function _half(commits: readonly HistoryCommit[]): HalfReading {
    const top = _shares(commits)[0];
    return { n: commits.length, family: top?.family ?? null, share: top?.share ?? 0 };
}

function _clears(n: number, top: FamilyShare | HalfReading | undefined, bar: number): top is FamilyShare | HalfReading {
    return n >= MIN_N && top !== undefined && top.family !== null && top.family !== 'other' && top.share >= bar;
}

/** `commits` newest first, as `git log` prints them. */
export function measureSubjects(commits: readonly HistoryCommit[]): SubjectMeasurement {
    const excluded = { bots: 0, automation: 0, bulk: 0 };
    const eligible = commits.filter((c) => {
        if (BOT_AUTHOR.test(c.author) || BOT_AUTHOR.test(c.email)) excluded.bots++;
        else if (AUTOMATION_SUBJECT.test(c.subject)) excluded.automation++;
        else if (c.files !== null && c.files > BULK_IMPORT_FILES) excluded.bulk++;
        else return true;
        return false;
    });
    const authors = new Set(eligible.map(_key)).size;
    const capped = authors >= MIN_CAPPED_AUTHORS;
    const bar = capped ? SHARE_BAR : SMALL_TEAM_SHARE_BAR;
    // Split before capping: a cap over the whole sample lets one author's
    // newest commits fill the quota and empty the older half.
    const cut = Math.ceil(eligible.length / 2);
    const newerRaw = eligible.slice(0, cut);
    const olderRaw = eligible.slice(cut);
    const newerSample = capped ? _cap(newerRaw) : newerRaw;
    const olderSample = capped ? _cap(olderRaw) : olderRaw;
    const sample = [...newerSample, ...olderSample];
    const families = _shares(sample);
    const newer = _half(newerSample);
    const older = _half(olderSample);
    const halvesAgree = newer.family !== null && newer.family === older.family;
    const top = families[0];

    let established: SubjectFamily | null = null;
    let migrating = false;
    const reasons: string[] = [];
    if (eligible.length < MIN_N) reasons.push(`n ${eligible.length} < ${MIN_N}`);
    if (top === undefined || top.family === 'other') reasons.push('no family with a grammar leads');
    else if (top.share < bar) reasons.push(`${top.family} at ${pct(top.share)} < ${pct(bar)}`);
    if (!halvesAgree && eligible.length > 0) reasons.push(`the halves disagree (newer ${newer.family ?? '—'}, older ${older.family ?? '—'})`);
    if (reasons.length === 0 && top !== undefined) established = top.family as SubjectFamily;
    else if (!halvesAgree && _clears(newer.n, newer, bar)) {
        established = newer.family as SubjectFamily;
        migrating = true;
    }
    return {
        eligible: eligible.length,
        excluded,
        authors,
        capped,
        cappedTotal: sample.length,
        bar,
        families,
        newer,
        older,
        halvesAgree,
        established,
        migrating,
        reasons: established === null || migrating ? reasons : [],
        strongest: families.filter((f) => f.family !== 'other').slice(0, 2).map((f) => f.family as SubjectFamily),
    };
}

export type BranchShape = '{type}/{ticket}-{slug}' | '{type}/{ticket}/{slug}' | '{ticket}-{slug}' | '{ticket}/{slug}' | '{type}/{slug}';

const BRANCH_TYPES = [...COMMIT_TYPES, 'feature', 'bugfix', 'hotfix'].join('|');
const BRANCH_SHAPES: ReadonlyArray<readonly [BranchShape, RegExp]> = [
    ['{type}/{ticket}-{slug}', new RegExp(`^(${BRANCH_TYPES})/${TICKET_GRAMMAR}-[^/]+$`)],
    ['{type}/{ticket}/{slug}', new RegExp(`^(${BRANCH_TYPES})/${TICKET_GRAMMAR}/[^/]+$`)],
    ['{ticket}-{slug}', new RegExp(`^${TICKET_GRAMMAR}-[^/]+$`)],
    ['{ticket}/{slug}', new RegExp(`^${TICKET_GRAMMAR}/[^/]+$`)],
    ['{type}/{slug}', new RegExp(`^(${BRANCH_TYPES})/[^/]+$`)],
];
const BOT_BRANCH = /^(dependabot|renovate|release-please)[/-]/;

export interface BranchMeasurement {
    sampled: number;
    shapes: { shape: BranchShape | 'other'; count: number; share: number }[];
    /** A pattern the reader accepts, or null when no shape clears the bar. */
    pattern: BranchShape | null;
    share: number;
}

export function classifyBranch(name: string): BranchShape | 'other' {
    return BRANCH_SHAPES.find(([, re]) => re.test(name))?.[0] ?? 'other';
}

/** Branch names without their remote prefix; the default branch and bots already excluded by the caller or here. */
export function measureBranches(names: readonly string[]): BranchMeasurement {
    const sample = names.filter((n) => !BOT_BRANCH.test(n));
    const counts = new Map<BranchShape | 'other', number>();
    for (const n of sample) {
        const s = classifyBranch(n);
        counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const shapes = [...counts.entries()]
        .map(([shape, count]) => ({ shape, count, share: count / sample.length }))
        .sort((a, b) => b.count - a.count || a.shape.localeCompare(b.shape));
    const top = shapes[0];
    const clear = top !== undefined && top.shape !== 'other' && sample.length >= MIN_BRANCHES && top.share >= SHARE_BAR
        && invalidReason('branch_pattern', top.shape) === null;
    return { sampled: sample.length, shapes, pattern: clear ? (top.shape as BranchShape) : null, share: top?.share ?? 0 };
}

export interface UpdateStyle {
    merges: number;
    baseMerges: number;
    observed: 'merge' | 'linear';
}

/** Merges of the default branch into a topic branch, read from their default subjects. */
export function measureUpdateStyle(mergeSubjects: readonly string[], defaultBranch: string): UpdateStyle {
    const name = defaultBranch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const base = new RegExp(`^Merge (remote-tracking )?branch '(origin/)?${name}'`);
    const baseMerges = mergeSubjects.filter((s) => base.test(s)).length;
    return { merges: mergeSubjects.length, baseMerges, observed: baseMerges > 0 ? 'merge' : 'linear' };
}

/** The `git.commit_format` value a family maps to, or null when it maps to none. */
export function formatForFamily(family: SubjectFamily): CommitFormat | null {
    if (family === 'conventional') return 'ticket-scope';
    if (family === 'ticket-conventional') return 'ticket-conventional';
    return null;
}

/** The `.git-convention.yml` content for a choice, or null when neither key has a value. `update_strategy` is never written. */
export function teamFile(family: SubjectFamily | null, pattern: BranchShape | null): string | null {
    const format = family === null ? null : formatForFamily(family);
    if (format === null && pattern === null) return null;
    return ['git:', ...(format === null ? [] : [`  commit_format: ${format}`]), ...(pattern === null ? [] : [`  branch_pattern: "${pattern}"`]), ''].join('\n');
}

export function pct(x: number): string {
    return `${Math.round(x * 100)} %`;
}

function _git(cwd: string, args: readonly string[]): string | null {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
}

export interface History {
    trunk: string;
    defaultBranch: string;
    commits: HistoryCommit[];
    branches: string[];
    mergeSubjects: string[];
}

/** No default branch could be resolved, so nothing was sampled; `reason` says why. */
export interface TrunkUnresolved {
    unresolved: string;
}

/**
 * The default branch as the carrier resolves it, or why there is none. A
 * branch name guessed in its place (`main`, `master`, the current `HEAD`)
 * samples another history and proposes a convention from it.
 */
function _trunk(cwd: string): { trunk: string; remote: string; name: string } | TrunkUnresolved {
    const ref = makeTargetDeps(cwd).defaultBranch();
    if (ref === null) {
        return { unresolved: 'no default branch could be resolved — origin names none and refs/remotes/origin/HEAD is not set' };
    }
    if (_git(cwd, ['rev-parse', '-q', '--verify', `${ref}^{commit}`]) === null) {
        return { unresolved: `the default branch ${ref} is not in this checkout — fetch it first` };
    }
    const slash = ref.indexOf('/');
    return { trunk: ref, remote: ref.slice(0, slash), name: ref.slice(slash + 1) };
}

/**
 * The sample `measureSubjects`, `measureBranches` and `measureUpdateStyle` read,
 * `TrunkUnresolved` without a default branch, or null outside a git repository.
 */
export function readHistory(cwd: string, limit = MEASURE_LIMIT): History | TrunkUnresolved | null {
    if (_git(cwd, ['rev-parse', '--git-dir']) === null) return null;
    const t = _trunk(cwd);
    if ('unresolved' in t) return t;
    const log = _git(cwd, ['log', t.trunk, '--no-merges', '-n', String(limit), `--since=${MEASURE_SINCE}`, '--pretty=format:%x1e%aN%x09%aE%x09%s', '--shortstat']) ?? '';
    const commits: HistoryCommit[] = log
        .split('\x1e')
        .filter((r) => r.trim() !== '')
        .map((r) => {
            const [head = '', ...rest] = r.split('\n');
            const [author = '', email = '', ...subject] = head.split('\t');
            const stat = /(\d+) files? changed/.exec(rest.join('\n'));
            return { author, email, subject: subject.join('\t'), files: stat === null ? null : Number(stat[1]) };
        });
    const refs = _git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes']) ?? '';
    const branches = refs
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r !== '' && r.includes('/'))
        .map((r) => ({ remote: r.slice(0, r.indexOf('/')), name: r.slice(r.indexOf('/') + 1) }))
        .filter((b) => b.name !== 'HEAD' && !(b.name === t.name && b.remote === t.remote))
        .map((b) => b.name);
    const merges = _git(cwd, ['log', '--all', '--merges', '-n', String(limit), `--since=${MEASURE_SINCE}`, '--pretty=format:%s']) ?? '';
    return {
        trunk: t.trunk,
        defaultBranch: t.name,
        commits,
        branches,
        mergeSubjects: merges.split('\n').filter((s) => s !== ''),
    };
}
