/**
 * The live state of the pull requests THIS session opened, carried into every
 * prompt — so a session never reports a PR as waiting after it merged.
 *
 * Measured 2026-10-20: a session told the owner "#2534 waits for you" an hour
 * after the owner had merged it. The state it reported was the one it saw when
 * it opened the PR; nothing told a running session that a PR changed state, and
 * the live-state rule that forbids answering from memory is model-carried. This
 * module is the carrier: the `pr-url-reminder` concern records a PR the moment
 * `gh pr create` prints its URL, and the `session-register` concern's
 * `user_prompt_submit` beat re-reads the recorded PRs and injects their state.
 *
 * - **Store:** `<git-common-dir>/agent-session-prs/<session>.json`, one file per
 *   session and one writer each, shared by every worktree of the repo.
 * - **Throttle:** at most one `gh` call per {@link PROBE_INTERVAL_MS}, one GraphQL
 *   query for every tracked PR at once, bounded by {@link PROBE_TIMEOUT_MS}.
 *   Between probes the block repeats the last reading with its time, so a stale
 *   reading is labelled stale rather than passed off as live.
 * - **Lifetime:** a merged or closed PR is reported once more, as a change, and
 *   then dropped; the block disappears when nothing open is tracked.
 * - **Failure:** an unreachable `gh` keeps the last reading and says the probe
 *   failed. Never throws, never blocks.
 * - **What reaches the model from GitHub:** a state coerced to four enum values,
 *   and a merge time that must read as an ISO timestamp after `sanitize_text`,
 *   else it is dropped. No other remote byte is emitted.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { git_common_dir } from './git_common_dir.js';
import { sanitize_text } from './retrieval_sanitize.js';
import { safe_stem } from './session_register.js';

export const PROBE_INTERVAL_MS = 5 * 60 * 1000;
export const PROBE_TIMEOUT_MS = 8_000;
const MAX_TRACKED = 10;
const STORE_DIRNAME = 'agent-session-prs';

export type PrState = 'OPEN' | 'MERGED' | 'CLOSED' | 'UNKNOWN';

export interface TrackedPr {
    number: number;
    url: string;
    state: PrState;
    /** Set when the last probe saw a state different from the one before it, until reported. */
    changed_from?: PrState;
    merged_at?: string | null;
}

export interface PrStore {
    prs: TrackedPr[];
    /** ISO time of the last probe attempt; absent before the first. */
    probed_at?: string;
    probe_failed?: boolean;
}

/** `{number: {state, mergedAt}}` for the asked numbers, or null when unreadable. */
export type PrProbe = (cwd: string, numbers: readonly number[]) => Record<number, { state: PrState; merged_at: string | null }> | null;

function store_file(root: string, session_id: string): string | null {
    const common = git_common_dir(root);
    return common === null ? null : path.join(common, STORE_DIRNAME, `${safe_stem(session_id)}.json`);
}

export function read_store(root: string, session_id: string): PrStore {
    const file = store_file(root, session_id);
    if (file === null) return { prs: [] };
    try {
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as PrStore;
        return Array.isArray(o.prs) ? o : { prs: [] };
    } catch {
        return { prs: [] };
    }
}

function write_store(root: string, session_id: string, store: PrStore): void {
    const file = store_file(root, session_id);
    if (file === null) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    write_atomic(file, `${JSON.stringify(store, null, 2)}\n`);
}

/** Record a PR this session created. Idempotent per number. */
export function record_pr(root: string, session_id: string, url: string): void {
    const m = /\/pull\/(\d+)/.exec(url);
    if (m === null || session_id === '') return;
    const number = Number.parseInt(m[1] ?? '', 10);
    const store = read_store(root, session_id);
    if (store.prs.some((p) => p.number === number)) return;
    store.prs = [...store.prs, { number, url, state: 'OPEN' as PrState }].slice(-MAX_TRACKED);
    // A new PR should be read on the next prompt, not after the throttle window.
    delete store.probed_at;
    write_store(root, session_id, store);
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function iso_or_null(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const clean = sanitize_text(v);
    return ISO_RE.test(clean) ? clean : null;
}

export const gh_probe: PrProbe = (cwd, numbers) => {
    const fields = numbers.map((n) => `p${n}: pullRequest(number: ${n}) { state mergedAt }`).join(' ');
    const query = `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { ${fields} } }`;
    try {
        const out = execFileSync(
            'gh',
            ['api', 'graphql', '-f', `query=${query}`, '-F', 'owner={owner}', '-F', 'repo={repo}'],
            { cwd, encoding: 'utf-8', timeout: PROBE_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const repo = (JSON.parse(out) as { data?: { repository?: Record<string, { state?: string; mergedAt?: string | null } | null> } })
            .data?.repository;
        if (repo === undefined) return null;
        const res: Record<number, { state: PrState; merged_at: string | null }> = {};
        for (const n of numbers) {
            const pr = repo[`p${n}`];
            const s = pr?.state;
            res[n] = {
                state: s === 'OPEN' || s === 'MERGED' || s === 'CLOSED' ? s : 'UNKNOWN',
                merged_at: iso_or_null(pr?.mergedAt),
            };
        }
        return res;
    } catch {
        return null;
    }
};

function hhmm(iso: string): string {
    return iso.slice(11, 16);
}

/**
 * Probe when the throttle allows, persist, and render the block. `null` when
 * this session tracks no PR. Never throws.
 */
export function pr_watch_block(
    root: string,
    session_id: string,
    now: Date = new Date(),
    probe: PrProbe = gh_probe,
): string | null {
    try {
        const store = read_store(root, session_id);
        if (store.prs.length === 0) return null;
        const last = store.probed_at === undefined ? Number.NaN : Date.parse(store.probed_at);
        if (!(now.getTime() - last < PROBE_INTERVAL_MS)) {
            const live = probe(root, store.prs.map((p) => p.number));
            store.probed_at = now.toISOString();
            store.probe_failed = live === null;
            if (live !== null) {
                for (const p of store.prs) {
                    const got = live[p.number];
                    if (got === undefined) continue;
                    if (got.state !== p.state) p.changed_from = p.state;
                    p.state = got.state;
                    p.merged_at = got.merged_at;
                }
            }
        }
        const lines = store.prs.map((p) => {
            const change = p.changed_from !== undefined ? `  ← CHANGED from ${p.changed_from}` : '';
            const when = p.state === 'MERGED' && p.merged_at ? ` at ${p.merged_at}` : '';
            return `- #${p.number} ${p.state}${when}${change}`;
        });
        const asOf = store.probed_at === undefined ? 'never read' : `read ${hhmm(store.probed_at)} UTC`;
        const block = [
            '<session-prs>',
            `Pull requests this session opened (${asOf}${store.probe_failed ? ', the last read FAILED — state unverified' : ''}):`,
            ...lines,
            'State them from this block, or run `gh pr view <n>` first — never from memory.',
            'A merged PR waits for nobody.',
            '</session-prs>',
        ].join('\n');
        // Every change is in the block just rendered; keep only what can still change.
        store.prs = store.prs
            .filter((p) => p.state === 'OPEN' || p.state === 'UNKNOWN')
            .map(({ changed_from: _reported, ...rest }) => rest);
        write_store(root, session_id, store);
        return block;
    } catch {
        return null;
    }
}
