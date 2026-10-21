/**
 * Session facts for the retro (`docs/contracts/retro-v1.md`) — the half of the
 * fact reader that the session-start probe and the session-end hook reach.
 *
 * Kept apart from `retro_facts.ts` so a hook bundle that sweeps sessions does
 * not carry the PR reader's forge client, injection scanner and analysis-run
 * record: the probe must stay inside the hook bundle budget. `retro_facts.ts`
 * re-exports everything here, so callers keep one import path.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { listSessionPointers, markerForBranch } from './retro_queue.js';
import { eolSessionKey, readEolCounters, type StoredEolCounters } from './_lib/session_eol.js';
import { derive_session_tag } from './_lib/session_tag.js';
import { listRecords } from './_lib/self_repair_store.js';

export type Fact<T> =
    | { status: 'measured'; value: T }
    | { status: 'missing'; reason: string }
    | { status: 'not-applicable'; reason: string };

export const measured = <T>(value: T): Fact<T> => ({ status: 'measured', value });
export const missing = <T>(reason: string): Fact<T> => ({ status: 'missing', reason });

/** One git invocation; `null` on any failure. Injected so tests run offline. */
export type GitRun = (args: readonly string[]) => string | null;

export function obj(v: unknown): Record<string, unknown> | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}


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
    /** From the session's pointer, written by the session-end hook. */
    branch: Fact<string>;
    /** The PR that branch was pushed for, from the push marker or the queue entry it became. */
    pr: Fact<number>;
}

export interface SessionFactsInput {
    /** The raw session id — needed for the end-of-life state, which is keyed by its hash. */
    sessionId?: string;
    /**
     * The session tag, when the id is not known. A session pointer carrying the
     * tag supplies the hashed end-of-life key, so a tag alone reaches the state.
     */
    tag?: string;
    root: string;
    git?: GitRun;
}

export const liveGit =
    (cwd: string, timeoutMs: () => number = () => 5_000): GitRun =>
    (args) => {
        // A caller with a deadline passes the time it has left; none left is no call.
        const timeout = Math.min(5_000, timeoutMs());
        if (timeout <= 0) return null;
        // An inherited GIT_DIR (a hook runs inside git) would point every call
        // at another repository than the one at `cwd`.
        const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
        const r = spawnSync('git', [...args], { cwd, env, encoding: 'utf8', timeout });
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

function sessionPr(root: string, branch: string | null): Fact<number> {
    if (branch === null) return missing('no branch recorded for the session');
    const pr = markerForBranch(root, branch);
    return pr === null ? missing(`no push of ${branch} was recorded with a PR`) : measured(pr);
}

export function readSessionFacts(input: SessionFactsInput): SessionFacts {
    const git = input.git ?? liveGit(input.root);
    const tag = input.sessionId !== undefined ? derive_session_tag(input.sessionId) : (input.tag ?? '');
    const workspaces = listWorkspaces(input.root, git);
    const listed = workspaces.status === 'measured' ? workspaces.value : [input.root];

    const wantKey = input.sessionId !== undefined ? eolSessionKey(input.sessionId) : null;
    const pointer =
        listSessionPointers(input.root).find((p) => (wantKey !== null ? p.eol_key === wantKey : p.tag === tag)) ??
        null;
    // A pointer's workspace is searched too: it is where the state was written.
    const dirs = pointer !== null && !listed.includes(pointer.workspace) ? [...listed, pointer.workspace] : listed;

    let counters: StoredEolCounters | null = null;
    let foundIn: Fact<string> = missing('no end-of-life state for this session in any workspace');
    const key = wantKey ?? pointer?.eol_key ?? null;
    if (key === null) {
        foundIn = missing('end-of-life state is keyed by the session id; only a tag was given and no pointer carries it');
    } else {
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
        branch:
            pointer === null
                ? missing('no session pointer — the session ended before pointers existed, or the retro is off')
                : pointer.branch === null
                  ? missing('the session ended on a detached HEAD')
                  : measured(pointer.branch),
        pr: sessionPr(input.root, pointer?.branch ?? null),
    };
}

