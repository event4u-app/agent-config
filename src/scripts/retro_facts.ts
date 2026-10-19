#!/usr/bin/env node
/**
 * Retro facts — the deterministic half of a retro (`docs/contracts/retro-v1.md`).
 *
 * Reads what a merged PR or a finished session left behind, and nothing else:
 * no model, no transcript, no settings. Every field is a {@link Fact} —
 * `measured`, `missing` or `not-applicable` — because a triage that reads a
 * failed lookup as `0` scores a broken forge call as a smooth PR, and the
 * contract forbids a missing field from ever lowering a score.
 *
 * Text a third party wrote (review comments, review bodies) is never a fact.
 * It is carried as {@link UntrustedDatum}: quoted, length-capped, and passed
 * through the injection scanner first, so whatever reads these facts later sees
 * a planted instruction as a flagged datum and not as something to act on.
 *
 * Session state is per workspace (`session_eol.ts` writes under the workspace
 * that ran the session), so a session reader that only looked at its own
 * checkout would lose every session that ran in a worktree. The reader
 * enumerates `git worktree list` and searches each.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { derive_session_tag } from './chat_history.js';
import { _scan } from './injection_scan_hook.js';
import {
    liveForgeApi,
    originUrl,
    resolveForgeRepo,
    type ForgeApi,
} from './_lib/forge_reader.js';
import { listRecords } from './_lib/self_repair_store.js';
import { RUN_JSON, readRunJson, type Door, type RunJsonRow } from './analysis_run_record.js';
import type { RunState } from './analysis_run.js';
import { eolSessionKey, readEolCounters, type StoredEolCounters } from './_lib/session_eol.js';

export type Fact<T> =
    | { status: 'measured'; value: T }
    | { status: 'missing'; reason: string }
    | { status: 'not-applicable'; reason: string };

const measured = <T>(value: T): Fact<T> => ({ status: 'measured', value });
const missing = <T>(reason: string): Fact<T> => ({ status: 'missing', reason });
const notApplicable = <T>(reason: string): Fact<T> => ({ status: 'not-applicable', reason });

/** One git invocation; `null` on any failure. Injected so tests run offline. */
export type GitRun = (args: readonly string[]) => string | null;

export interface UntrustedDatum {
    kind: 'data';
    source: 'review-comment' | 'review';
    quoted: string;
    injection: { risk_level: 'high' | 'medium' | 'low'; channels: string[] };
}

/** Third-party text is quoted up to this many characters; the rest is cut. */
export const QUOTE_MAX_CHARS = 500;

function datum(source: UntrustedDatum['source'], text: string): UntrustedDatum {
    const scan = _scan(text);
    return {
        kind: 'data',
        source,
        quoted: text.slice(0, QUOTE_MAX_CHARS),
        injection: { risk_level: scan.risk_level, channels: scan.detections.map((d) => d.channel) },
    };
}

function obj(v: unknown): Record<string, unknown> | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** A list response, or `null`. Accepts `--paginate --slurp` page arrays too. */
function list(v: unknown): Record<string, unknown>[] | null {
    if (!Array.isArray(v)) return null;
    const flat = v.every(Array.isArray) ? (v as unknown[][]).flat() : v;
    return flat.map(obj).filter((x): x is Record<string, unknown> => x !== null);
}

// ---------------------------------------------------------------------------
// PR facts
// ---------------------------------------------------------------------------

export interface PrFacts {
    unit: 'pr';
    pr: number;
    merge_sha: Fact<string>;
    /** Distinct head SHAs with a workflow run on the PR branch. */
    ci_heads: Fact<number>;
    /** Heads with at least one failing run. */
    red_heads: Fact<number>;
    /** Red heads followed by a head with no failing run. */
    red_to_green: Fact<number>;
    /** Heads pushed after the first red head. */
    repair_commits: Fact<number>;
    /** PR commits that revert another commit. */
    in_pr_reverts: Fact<number>;
    /** Top-level review comments (a reply is part of its thread). */
    review_threads: Fact<number>;
    /** A commit on the base reverting the merge commit. */
    later_revert: Fact<boolean>;
    /** The PR's row of a `/pr:merge all` drain summary, by column header. */
    drain_row: Fact<Record<string, string>>;
    untrusted_text: UntrustedDatum[];
}

export interface PrFactsInput {
    pr: number;
    slug: string;
    api: ForgeApi;
    git: GitRun;
    root: string;
}

const RUNS_PER_PAGE = 100;

interface RunFacts {
    ci_heads: Fact<number>;
    red_heads: Fact<number>;
    red_to_green: Fact<number>;
    repair_commits: Fact<number>;
}

function runFacts(runsResponse: unknown): RunFacts {
    const body = obj(runsResponse);
    const runs = body === null ? null : list(body['workflow_runs']);
    const total = body === null ? null : body['total_count'];
    const fail = (reason: string): RunFacts => ({
        ci_heads: missing(reason),
        red_heads: missing(reason),
        red_to_green: missing(reason),
        repair_commits: missing(reason),
    });
    if (runs === null) return fail('workflow runs not read');
    if (typeof total === 'number' && total > runs.length) {
        return fail(`${total} runs exceed the one page read (${runs.length}); a partial count would understate`);
    }
    const heads = new Map<string, { first: string; red: boolean }>();
    for (const r of runs) {
        const sha = r['head_sha'];
        if (typeof sha !== 'string') continue;
        const at = typeof r['created_at'] === 'string' ? r['created_at'] : '';
        const red = RED_CONCLUSIONS.has(String(r['conclusion']));
        const h = heads.get(sha);
        if (h === undefined) heads.set(sha, { first: at, red });
        else heads.set(sha, { first: at < h.first ? at : h.first, red: h.red || red });
    }
    const ordered = [...heads.values()].sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0));
    let redToGreen = 0;
    for (let i = 0; i + 1 < ordered.length; i++) {
        if (ordered[i]!.red && !ordered[i + 1]!.red) redToGreen += 1;
    }
    const firstRed = ordered.findIndex((h) => h.red);
    return {
        ci_heads: measured(ordered.length),
        red_heads: measured(ordered.filter((h) => h.red).length),
        red_to_green: measured(redToGreen),
        repair_commits: measured(firstRed === -1 ? 0 : ordered.length - firstRed - 1),
    };
}

const REVERT_RE = /This reverts commit [0-9a-f]{7,40}/;

const RED_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure']);

/** Every drain summary the evidence directory holds, oldest modification first. */
function drainSummaries(root: string): string[] {
    const dir = path.join(root, 'agents', 'evidence');
    const out: { file: string; mtime: number }[] = [];
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    for (const n of names) {
        if (!/drain.*summary.*\.md$/.test(n)) continue;
        const file = path.join(dir, n);
        try {
            const st = fs.statSync(file);
            if (st.isFile()) out.push({ file, mtime: st.mtimeMs });
        } catch {
            continue;
        }
    }
    return out.sort((a, b) => a.mtime - b.mtime || (a.file < b.file ? -1 : 1)).map((x) => x.file);
}

/**
 * A drain table is one whose header names a disposition or a conflict column;
 * any other table in the file (questions, verdicts) is not a PR ledger and a
 * small PR number would collide with its row numbers.
 */
function prColumn(header: readonly string[]): number | null {
    if (!header.some((h) => /disposition|conflict/i.test(h))) return null;
    const i = header.findIndex((h) => /^(#|pr\b|pull)/i.test(h));
    return i === -1 ? null : i;
}

/** The PR number in a cell, through `#`, backtick and markdown-link wrappers. */
function prInCell(cell: string): number | null {
    const m = /#?(\d+)/.exec(cell.replace(/`/g, ''));
    return m === null ? null : Number(m[1]);
}

function cells(line: string): string[] {
    return line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
}

/** The PR's row, keyed by the table's own header. The most recently modified summary wins. */
export function readDrainRow(root: string, pr: number): Record<string, string> | null {
    let found: Record<string, string> | null = null;
    for (const file of drainSummaries(root)) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        let header: string[] | null = null;
        let col: number | null = null;
        for (const line of text.split('\n')) {
            if (!line.trim().startsWith('|')) {
                header = null;
                continue;
            }
            const c = cells(line);
            if (c.every((x) => /^:?-+:?$/.test(x))) continue;
            if (header === null) {
                header = c;
                col = prColumn(c);
                continue;
            }
            if (col !== null && prInCell(c[col] ?? '') === pr) {
                found = Object.fromEntries(header.map((h, i) => [h, c[i] ?? '']));
            }
        }
    }
    return found;
}

export function readPrFacts(input: PrFactsInput): PrFacts {
    const { pr, slug, api, git, root } = input;
    const base = `repos/${slug}/pulls/${pr}`;
    const pull = obj(api.get(base));

    let mergeSha: Fact<string>;
    if (pull === null) mergeSha = missing('pull request not read');
    else if (typeof pull['merge_commit_sha'] === 'string' && typeof pull['merged_at'] === 'string') {
        mergeSha = measured(pull['merge_commit_sha']);
    } else mergeSha = notApplicable('pull request is not merged');

    const headRef = obj(pull?.['head'])?.['ref'];
    const baseRef = obj(pull?.['base'])?.['ref'];
    const runs: RunFacts =
        typeof headRef === 'string'
            ? runFacts(
                  api.get(
                      `repos/${slug}/actions/runs?branch=${encodeURIComponent(headRef)}&event=pull_request&per_page=${RUNS_PER_PAGE}`,
                  ),
              )
            : runFacts(null);

    const commits = list(api.get(`${base}/commits?per_page=100`, true));
    const inPrReverts: Fact<number> =
        commits === null
            ? missing('commits not read')
            : measured(
                  commits.filter((c) => {
                      const msg = obj(c['commit'])?.['message'];
                      return typeof msg === 'string' && REVERT_RE.test(msg);
                  }).length,
              );

    const untrusted: UntrustedDatum[] = [];
    const comments = list(api.get(`${base}/comments?per_page=100`, true));
    let reviewThreads: Fact<number> = missing('review comments not read');
    if (comments !== null) {
        reviewThreads = measured(comments.filter((c) => c['in_reply_to_id'] === undefined || c['in_reply_to_id'] === null).length);
        for (const c of comments) {
            if (typeof c['body'] === 'string' && c['body'].trim() !== '') untrusted.push(datum('review-comment', c['body']));
        }
    }
    for (const r of list(api.get(`${base}/reviews?per_page=100`, true)) ?? []) {
        if (typeof r['body'] === 'string' && r['body'].trim() !== '') untrusted.push(datum('review', r['body']));
    }

    let laterRevert: Fact<boolean>;
    if (mergeSha.status !== 'measured') {
        laterRevert = mergeSha.status === 'missing' ? missing('merge commit unknown') : notApplicable('not merged');
    } else {
        const ref = typeof baseRef === 'string' ? `origin/${baseRef}` : 'HEAD';
        const out = git(['log', ref, '--format=%H', `--grep=This reverts commit ${mergeSha.value}`]);
        laterRevert = out === null ? missing('git log on the base failed') : measured(out.trim() !== '');
    }

    const row = readDrainRow(root, pr);
    return {
        unit: 'pr',
        pr,
        merge_sha: mergeSha,
        ...runs,
        in_pr_reverts: inPrReverts,
        review_threads: reviewThreads,
        later_revert: laterRevert,
        drain_row: row === null ? notApplicable('no drain summary names this PR') : measured(row),
        untrusted_text: untrusted,
    };
}

// ---------------------------------------------------------------------------
// Session facts
// ---------------------------------------------------------------------------

export interface SessionFacts {
    unit: 'session';
    tag: string;
    /** Every workspace searched: the checkout and each of its worktrees. */
    workspaces: Fact<string[]>;
    /** The workspace whose end-of-life state carried the session. */
    found_in: Fact<string>;
    turns: Fact<number>;
    assistant_records: Fact<number>;
    tool_calls: Fact<number>;
    compactions: Fact<number>;
    final_context_tokens: Fact<number>;
    interruptions: Fact<{ ask: number; handback: number; none: number }>;
    self_repair_in_window: Fact<number>;
    roadmap: Fact<string>;
    branch: Fact<string>;
}

export interface SessionFactsInput {
    /** The raw session id — needed for the end-of-life state, which is keyed by its hash. */
    sessionId?: string;
    /** The session tag, when the id is not known. */
    tag?: string;
    root: string;
    git?: GitRun;
}

const liveGit =
    (cwd: string): GitRun =>
    (args) => {
        // An inherited GIT_DIR (a hook runs inside git) would point every call
        // at another repository than the one at `cwd`.
        const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
        const r = spawnSync('git', [...args], { cwd, env, encoding: 'utf8', timeout: 5_000 });
        return r.status === 0 && typeof r.stdout === 'string' ? r.stdout : null;
    };

/** The checkout and every worktree of it, from `git worktree list --porcelain`. */
export function listWorkspaces(root: string, git: GitRun): Fact<string[]> {
    const out = git(['worktree', 'list', '--porcelain']);
    if (out === null) return missing('git worktree list failed; only this checkout searched');
    const paths = out
        .split('\n')
        .filter((l) => l.startsWith('worktree '))
        .map((l) => l.slice('worktree '.length).trim());
    return paths.length === 0 ? missing('git listed no worktree') : measured(paths);
}

const LEDGER_REL = path.join('agents', 'runtime', 'state', 'interruptions.jsonl');

function num(v: unknown): Fact<number> {
    return typeof v === 'number' && Number.isFinite(v) ? measured(v) : missing('not counted by the writer of this state');
}

export function readSessionFacts(input: SessionFactsInput): SessionFacts {
    const git = input.git ?? liveGit(input.root);
    const tag = input.sessionId !== undefined ? derive_session_tag(input.sessionId) : (input.tag ?? '');
    const workspaces = listWorkspaces(input.root, git);
    const dirs = workspaces.status === 'measured' ? workspaces.value : [input.root];

    let counters: StoredEolCounters | null = null;
    let foundIn: Fact<string> = missing('no end-of-life state for this session in any workspace');
    if (input.sessionId === undefined) {
        foundIn = missing('end-of-life state is keyed by the session id; only a tag was given');
    } else {
        const key = eolSessionKey(input.sessionId);
        for (const ws of dirs) {
            counters = readEolCounters(ws, key);
            if (counters !== null) {
                foundIn = measured(ws);
                break;
            }
        }
    }
    const eolGone = foundIn.status === 'missing' ? foundIn.reason : '';

    let ledgerSeen = false;
    const turns = new Map<number, { kind: string; at: string; roadmap: unknown }>();
    for (const ws of dirs) {
        let raw: string;
        try {
            raw = fs.readFileSync(path.join(ws, LEDGER_REL), 'utf-8');
        } catch {
            continue;
        }
        ledgerSeen = true;
        for (const line of raw.split('\n')) {
            let r: Record<string, unknown> | null;
            try {
                r = obj(JSON.parse(line));
            } catch {
                continue;
            }
            if (r === null || r['run_id'] !== tag || typeof r['turn'] !== 'number') continue;
            if (turns.has(r['turn'])) continue;
            turns.set(r['turn'], {
                kind: String(r['kind']),
                at: typeof r['at'] === 'string' ? r['at'] : '',
                roadmap: r['roadmap'],
            });
        }
    }
    const interruptions: SessionFacts['interruptions'] = ledgerSeen
        ? measured({
              ask: [...turns.values()].filter((t) => t.kind === 'ask').length,
              handback: [...turns.values()].filter((t) => t.kind === 'handback').length,
              none: [...turns.values()].filter((t) => t.kind === 'none').length,
          })
        : missing('no interruption ledger in any workspace');
    const roadmapName = [...turns.values()].map((t) => t.roadmap).find((r): r is string => typeof r === 'string');

    const stamps = [
        ...[...turns.values()].map((t) => t.at),
        ...(counters?.compactions ?? []).map((c) => c.timestamp ?? ''),
        counters?.final_context_at ?? '',
    ]
        .filter((s) => s !== '')
        .sort();
    let selfRepair: Fact<number> = missing('the session has no known time window');
    if (stamps.length >= 2) {
        const [from, to] = [stamps[0]!, stamps[stamps.length - 1]!];
        const seen = new Set<string>();
        for (const ws of dirs) {
            for (const rec of listRecords(ws)) {
                // A record first seen earlier and seen again inside the window is
                // a recurrence during the session, so either stamp counts.
                const inside = (t: string): boolean => t >= from && t <= to;
                if (inside(rec.first_seen) || inside(rec.last_seen)) seen.add(rec.fingerprint);
            }
        }
        selfRepair = measured(seen.size);
    }

    return {
        unit: 'session',
        tag,
        workspaces,
        found_in: foundIn,
        turns: counters === null ? missing(eolGone) : num(counters.turns),
        assistant_records: counters === null ? missing(eolGone) : num(counters.assistant_records),
        tool_calls: counters === null ? missing(eolGone) : num(counters.tool_calls),
        compactions:
            counters === null
                ? missing(eolGone)
                : Array.isArray(counters.compactions)
                  ? measured(counters.compactions.length)
                  : missing('compactions not recorded'),
        final_context_tokens: counters === null ? missing(eolGone) : num(counters.final_context_tokens),
        interruptions,
        self_repair_in_window: selfRepair,
        roadmap: roadmapName === undefined ? missing('no claimed roadmap in the ledger') : measured(roadmapName),
        branch: missing('nothing in the tree records which branch a session worked on'),
    };
}

// ---------------------------------------------------------------------------
// Analysis run — the unit kind `analysis-run`
// ---------------------------------------------------------------------------

/**
 * What one emitted roadmap shows about whether the run was adopted.
 *
 * Only an **archived** roadmap has a final reading: while it is still active,
 * its open steps may yet be done or cancelled, so counting them now would score
 * unfinished work as rejected. That state is `missing`, never `{done: 0}`.
 */
export interface RoadmapAdoption {
    slug: string;
    /** Which roadmap subdirectory held the file; `null` when none did. */
    found_in: string | null;
    archived: boolean;
    steps: Fact<AdoptionCounts>;
}

export interface AdoptionCounts {
    done: number;
    cancelled: number;
}

/** One analyst's contribution to the run, as `run.json` records it. */
export interface AnalystContribution {
    analyst_id: string;
    mode: RunJsonRow['mode'];
    family: string;
    loops: number;
    top_tier: RunJsonRow['top_tier'];
}

export interface AnalysisRunFacts {
    unit: 'analysis-run';
    /** The identity part of the unit key for this kind: the analysis round. */
    round_id: string;
    /** The door the round came through — the run's source. */
    source: Fact<Door>;
    final_state: Fact<RunState>;
    roadmaps_emitted: Fact<string[]>;
    adoption_per_roadmap: Fact<RoadmapAdoption[]>;
    /** Summed over the emitted roadmaps, and taken only once every one is archived. */
    adoption: Fact<AdoptionCounts>;
    /**
     * Always a named absence: `run.json` records which roadmaps a run emitted
     * and which analysts ran, and nothing that joins the two. Reporting a number
     * here would attribute adoption to an analyst on no evidence.
     */
    adoption_per_analyst: Fact<Record<string, AdoptionCounts>>;
    analysts: Fact<AnalystContribution[]>;
    seats: Fact<{ used: string[]; failed: string[] }>;
    recurrence_hits: Fact<number>;
    ci_rounds: Fact<number>;
    tokens: Fact<number>;
    wall_clock_seconds: Fact<number>;
}

export interface AnalysisRunFactsInput {
    roundId: string;
    root: string;
}

/** Where `analysis_run_record.ts` writes the round's record. */
export function analysisRunDir(root: string, roundId: string): string {
    return path.join(root, 'agents', 'runtime', 'analysis', roundId);
}

/** Roadmap subdirectories a slug may resolve in; `archive` first because it decides the reading. */
const ROADMAP_DIRS = ['archive', '', 'later', 'stubs', 'skipped'] as const;

function normaliseSlug(slug: string): string {
    return slug.replace(/^agents\/roadmaps\//, '').replace(/\.md$/, '');
}

/** `[x]` done and `[-]` cancelled; `[ ]` open and `[~]` deferred are neither. */
export function countAdoption(markdown: string): AdoptionCounts {
    let done = 0;
    let cancelled = 0;
    for (const line of markdown.split('\n')) {
        const m = /^\s*-\s\[(.)\]\s/.exec(line);
        if (m === null) continue;
        if (m[1] === 'x' || m[1] === 'X') done += 1;
        else if (m[1] === '-') cancelled += 1;
    }
    return { done, cancelled };
}

function roadmapAdoption(root: string, slug: string): RoadmapAdoption {
    const rel = normaliseSlug(slug);
    for (const dir of ROADMAP_DIRS) {
        const file = path.join(root, 'agents', 'roadmaps', dir, `${rel}.md`);
        if (!fs.existsSync(file)) continue;
        const found = dir === '' ? '.' : dir;
        if (dir !== 'archive') {
            return {
                slug: rel,
                found_in: found,
                archived: false,
                steps: missing(`still in ${found}; only an archived roadmap has a final step reading`),
            };
        }
        return { slug: rel, found_in: found, archived: true, steps: measured(countAdoption(fs.readFileSync(file, 'utf8'))) };
    }
    return { slug: rel, found_in: null, archived: false, steps: missing('no roadmap directory holds this slug') };
}

/**
 * Facts for one analysis round: its door, its analysts, and whether the
 * roadmaps it emitted were adopted — read from the round's own `run.json`
 * (ADR-288 D9) and from the roadmap tree. No model, no transcript.
 */
export function readAnalysisRunFacts(input: AnalysisRunFactsInput): AnalysisRunFacts {
    const dir = analysisRunDir(input.root, input.roundId);
    let run;
    try {
        run = readRunJson(dir);
    } catch (err) {
        const reason = fs.existsSync(path.join(dir, RUN_JSON))
            ? `${RUN_JSON} is unreadable: ${err instanceof Error ? err.message : String(err)}`
            : `no ${RUN_JSON} under ${path.join('agents', 'runtime', 'analysis', input.roundId)}`;
        return {
            unit: 'analysis-run',
            round_id: input.roundId,
            source: missing(reason),
            final_state: missing(reason),
            roadmaps_emitted: missing(reason),
            adoption_per_roadmap: missing(reason),
            adoption: missing(reason),
            adoption_per_analyst: notApplicable('run.json joins no emitted roadmap to an analyst'),
            analysts: missing(reason),
            seats: missing(reason),
            recurrence_hits: missing(reason),
            ci_rounds: missing(reason),
            tokens: missing(reason),
            wall_clock_seconds: missing(reason),
        };
    }

    const per = run.roadmaps_emitted.map((slug) => roadmapAdoption(input.root, slug));
    const unread = per.filter((p) => !p.archived);
    const adoption: Fact<AdoptionCounts> =
        per.length === 0
            ? notApplicable('the run emitted no roadmap')
            : unread.length > 0
              ? missing(`${unread.length} of ${per.length} emitted roadmaps are not archived: ${unread.map((p) => p.slug).join(', ')}`)
              : measured(
                    per.reduce(
                        (sum, p) => ({
                            done: sum.done + (p.steps.status === 'measured' ? p.steps.value.done : 0),
                            cancelled: sum.cancelled + (p.steps.status === 'measured' ? p.steps.value.cancelled : 0),
                        }),
                        { done: 0, cancelled: 0 },
                    ),
                );

    const byAnalyst = new Map<string, AnalystContribution>();
    for (const row of run.rows) {
        const seen = byAnalyst.get(row.analyst_id);
        if (seen === undefined) {
            byAnalyst.set(row.analyst_id, {
                analyst_id: row.analyst_id,
                mode: row.mode,
                family: row.family,
                loops: 1,
                top_tier: { ...row.top_tier },
            });
            continue;
        }
        seen.loops += 1;
        seen.top_tier.added += row.top_tier.added;
        seen.top_tier.changed += row.top_tier.changed;
        seen.top_tier.killed += row.top_tier.killed;
    }

    return {
        unit: 'analysis-run',
        round_id: run.run_id,
        source: measured(run.door),
        final_state: measured(run.final_state),
        roadmaps_emitted: measured([...run.roadmaps_emitted]),
        adoption_per_roadmap: measured(per),
        adoption,
        adoption_per_analyst: notApplicable('run.json joins no emitted roadmap to an analyst'),
        analysts: measured([...byAnalyst.values()]),
        seats: measured({ used: [...run.seats.used], failed: [...run.seats.failed] }),
        recurrence_hits: measured(run.recurrence_hits),
        ci_rounds: measured(run.ci_rounds),
        tokens: measured(run.tokens),
        wall_clock_seconds: measured(run.wall_clock_seconds),
    };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argValue(argv: readonly string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    return i === -1 ? null : (argv[i + 1] ?? null);
}

export function main(argv: readonly string[] = process.argv.slice(2), out = (s: string) => process.stdout.write(`${s}\n`)): number {
    const root = process.cwd();
    const prArg = argValue(argv, '--pr');
    if (prArg !== null) {
        const pr = Number(prArg);
        if (!Number.isInteger(pr) || pr <= 0) {
            out('retro_facts: --pr needs a pull request number');
            return 2;
        }
        const target = resolveForgeRepo(originUrl(root));
        if (target === null) {
            out('retro_facts: origin is not a GitHub repository');
            return 2;
        }
        const api = liveForgeApi(undefined, undefined, { host: target.host, cwd: root });
        out(JSON.stringify(readPrFacts({ pr, slug: target.slug, api, git: liveGit(root), root }), null, 2));
        return 0;
    }
    const sessionId = argValue(argv, '--session');
    const tag = argValue(argv, '--tag');
    if (sessionId !== null || tag !== null) {
        const facts = readSessionFacts({
            root,
            ...(sessionId !== null ? { sessionId } : {}),
            ...(tag !== null ? { tag } : {}),
        });
        out(JSON.stringify(facts, null, 2));
        return 0;
    }
    const round = argValue(argv, '--analysis-run');
    if (round !== null) {
        if (round === '' || round.startsWith('-')) {
            out('retro_facts: --analysis-run needs an analysis round id');
            return 2;
        }
        out(JSON.stringify(readAnalysisRunFacts({ roundId: round, root }), null, 2));
        return 0;
    }
    out('usage: retro_facts --pr N | --session ID | --tag TAG | --analysis-run ROUND');
    return 2;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
