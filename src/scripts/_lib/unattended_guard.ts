/**
 * unattended_guard — the three preconditions an unattended run must clear
 * before anything spawns, and the ledger that bounds it once it has.
 *
 * road-to-long-horizon-execution Phase 4.0 (sequencing UOTL Phase 7.1).
 *
 * ## What this is, and what it deliberately is not
 *
 * It is NOT the spawner. There is no `spawnHeadlessAgent` here and that is a
 * decision, not an omission — see § "Why the spawn is not in this file".
 *
 * It IS the layer that has to be right BEFORE a spawn is safe, and every part
 * of it is testable offline with no spend:
 *
 *   1. **Remote safety.** A worktree an unattended agent works in must carry
 *      no production remote. UOTL 7.1 says so; the failure it prevents is an
 *      unattended push reaching a real remote because a worktree inherited
 *      the parent's `origin`.
 *   2. **A budget with a ledger.** A cap nobody decrements is a comment. The
 *      ledger is a file, spend is booked against it, and an exhausted budget
 *      refuses — before the call, never after.
 *   3. **Job dedup.** Two schedulers, or one scheduler and one human, must
 *      not run the same roadmap at the same head twice. The key is derived
 *      from the work, not from a random id, so the second caller recognises
 *      the first caller's job.
 *
 * ## Why the spawn is not in this file
 *
 * Writing a spawner means choosing an invocation shape, an auth path and a
 * sandbox posture for a process that spends money with nobody watching. Each
 * of those is a decision with a blast radius, and none of them is testable
 * without spending. Shipping an untested one behind a flag that reads as
 * finished is how a capability nobody validated ends up in a scheduler.
 *
 * The guard lands first on purpose: it is the half that can be verified, and
 * it is the half whose absence makes the other half unsafe. Phase 4.2's
 * pre-registered demotion gate has to exist before a first unattended run
 * either way, so the ordering costs nothing.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const BUDGET_REL = path.join('agents', 'runtime', 'state', 'unattended-budget.json');
export const JOBS_REL = path.join('agents', 'runtime', 'state', 'unattended-jobs.json');

/**
 * Remote URL fragments that mark a remote as PRODUCTION-reachable.
 *
 * Deliberately a shape test rather than a host allowlist: the question is not
 * "which forge" but "can a push from here reach something real". A local path
 * remote or a remote pointing inside this checkout cannot; anything that
 * resolves over the network can.
 */
export function isProductionRemote(url: string): boolean {
    const u = url.trim();
    if (u === '') return false;
    // A filesystem path — a sibling worktree, a bare mirror on disk. A push
    // there is recoverable and reaches nobody.
    if (u.startsWith('/') || u.startsWith('.') || u.startsWith('file://')) return false;
    return (
        u.startsWith('http://') ||
        u.startsWith('https://') ||
        u.startsWith('ssh://') ||
        u.startsWith('git://') ||
        /^[\w.-]+@[\w.-]+:/.test(u) // scp-style: git@github.com:org/repo.git
    );
}

export interface RemoteVerdict {
    readonly safe: boolean;
    /** Every remote found, so a refusal can name the one that failed. */
    readonly remotes: ReadonlyArray<{ name: string; url: string; production: boolean }>;
    readonly reason: string;
}

/**
 * Is this worktree safe for an unattended agent to work in?
 *
 * Fails CLOSED on an unreadable git config: "I could not tell" and "there is
 * no production remote" must not resolve to the same answer when the
 * consequence of being wrong is an unattended push to a real remote.
 */
export function checkRemotes(worktree: string): RemoteVerdict {
    const r = spawnSync('git', ['remote', '-v'], { cwd: worktree, encoding: 'utf-8' });
    if (r.status !== 0) {
        return {
            safe: false,
            remotes: [],
            reason:
                `could not read remotes in ${worktree} (git exited ${String(r.status)}) — ` +
                `refusing, because "unreadable" and "none" must not mean the same thing here`,
        };
    }
    const seen = new Map<string, string>();
    for (const line of (r.stdout ?? '').split('\n')) {
        const m = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line.trim());
        if (m !== null) seen.set(m[1] as string, m[2] as string);
    }
    const remotes = [...seen.entries()].map(([name, url]) => ({
        name,
        url,
        production: isProductionRemote(url),
    }));
    const bad = remotes.filter((x) => x.production);
    if (bad.length > 0) {
        return {
            safe: false,
            remotes,
            reason:
                `production-reachable remote(s): ${bad.map((b) => `${b.name} → ${b.url}`).join(', ')} — ` +
                `an unattended run must not be able to push to a real remote (UOTL 7.1)`,
        };
    }
    return { safe: true, remotes, reason: 'no production-reachable remote' };
}

/** The cap and what has been spent against it. */
export interface UnattendedBudget {
    schema_version: 1;
    /** Hard ceiling in USD. `0` disables unattended runs entirely. */
    max_usd: number;
    /** Hard ceiling in tokens across the window. `0` disables. */
    max_tokens: number;
    spent_usd: number;
    spent_tokens: number;
    /** ISO date the window opened; a new UTC day resets both counters. */
    window_opened: string;
}

export function emptyBudget(day: string): UnattendedBudget {
    // Both ceilings default to ZERO, which disables unattended runs. An
    // absent budget file must not read as "unlimited" — that is the one
    // default that turns a missing config into unbounded spend.
    return {
        schema_version: 1,
        max_usd: 0,
        max_tokens: 0,
        spent_usd: 0,
        spent_tokens: 0,
        window_opened: day,
    };
}

export function utcDay(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

export function readBudget(repoRoot: string, now: Date = new Date()): UnattendedBudget {
    const day = utcDay(now);
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(path.join(repoRoot, BUDGET_REL), 'utf-8'));
    } catch {
        return emptyBudget(day);
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyBudget(day);
    const o = raw as Record<string, unknown>;
    const num = (k: string): number => {
        const v = o[k];
        return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
    };
    const opened = typeof o['window_opened'] === 'string' ? o['window_opened'] : day;
    // A new UTC day rolls the window: the caps persist, the spend resets.
    const rolled = opened !== day;
    return {
        schema_version: 1,
        max_usd: num('max_usd'),
        max_tokens: num('max_tokens'),
        spent_usd: rolled ? 0 : num('spent_usd'),
        spent_tokens: rolled ? 0 : num('spent_tokens'),
        window_opened: rolled ? day : opened,
    };
}

export function writeBudget(repoRoot: string, b: UnattendedBudget): void {
    const file = path.join(repoRoot, BUDGET_REL);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(b, null, 2)}\n`, 'utf-8');
}

export interface BudgetVerdict {
    readonly allowed: boolean;
    readonly reason: string;
}

/**
 * May a run costing `usd` / `tokens` proceed?
 *
 * Checked BEFORE the call, never after: a cap enforced on the way out has
 * already been exceeded by the time it fires.
 */
export function checkBudget(b: UnattendedBudget, usd: number, tokens: number): BudgetVerdict {
    if (b.max_usd <= 0 && b.max_tokens <= 0) {
        return {
            allowed: false,
            reason:
                'no unattended budget configured (both ceilings are 0) — an absent budget ' +
                'disables unattended runs rather than permitting unbounded ones',
        };
    }
    if (b.max_usd > 0 && b.spent_usd + usd > b.max_usd) {
        return {
            allowed: false,
            reason: `USD ceiling: ${b.spent_usd} spent + ${usd} projected > ${b.max_usd}`,
        };
    }
    if (b.max_tokens > 0 && b.spent_tokens + tokens > b.max_tokens) {
        return {
            allowed: false,
            reason: `token ceiling: ${b.spent_tokens} spent + ${tokens} projected > ${b.max_tokens}`,
        };
    }
    return { allowed: true, reason: 'within budget' };
}

export function bookSpend(
    b: UnattendedBudget,
    usd: number,
    tokens: number,
): UnattendedBudget {
    return { ...b, spent_usd: b.spent_usd + usd, spent_tokens: b.spent_tokens + tokens };
}

/**
 * The dedup key for one unit of unattended work.
 *
 * Derived from WHAT is being done — roadmap plus the commit it starts from —
 * not from a random id, so a second caller with the same work recognises the
 * first caller's job. A random id would make every duplicate look new, which
 * is exactly the collision this exists to catch.
 */
export function jobKey(roadmapSlug: string, head: string): string {
    return `${roadmapSlug}@${head.slice(0, 12)}`;
}

export type JobLedger = Record<string, { started_at: string }>;

export function readJobs(repoRoot: string): JobLedger {
    try {
        const raw: unknown = JSON.parse(fs.readFileSync(path.join(repoRoot, JOBS_REL), 'utf-8'));
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const out: JobLedger = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
                const started = (v as Record<string, unknown>)['started_at'];
                if (typeof started === 'string') out[k] = { started_at: started };
            }
        }
        return out;
    } catch {
        return {};
    }
}

export function writeJobs(repoRoot: string, jobs: JobLedger): void {
    const file = path.join(repoRoot, JOBS_REL);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(jobs, null, 2)}\n`, 'utf-8');
}

export interface PreflightInput {
    readonly repoRoot: string;
    readonly worktree: string;
    readonly roadmapSlug: string;
    readonly head: string;
    readonly projectedUsd: number;
    readonly projectedTokens: number;
    readonly now?: Date;
}

export interface PreflightVerdict {
    readonly ok: boolean;
    /** Every failed precondition, not just the first — one run, one full answer. */
    readonly refusals: readonly string[];
    readonly jobKey: string;
}

/**
 * All three preconditions, reported together.
 *
 * Returns every refusal rather than short-circuiting: an operator fixing one
 * precondition at a time round-trips N times, and the whole point of a
 * preflight is that it answers in one pass.
 */
export function preflight(input: PreflightInput): PreflightVerdict {
    const refusals: string[] = [];
    const key = jobKey(input.roadmapSlug, input.head);

    const remotes = checkRemotes(input.worktree);
    if (!remotes.safe) refusals.push(`remote: ${remotes.reason}`);

    const budget = readBudget(input.repoRoot, input.now ?? new Date());
    const verdict = checkBudget(budget, input.projectedUsd, input.projectedTokens);
    if (!verdict.allowed) refusals.push(`budget: ${verdict.reason}`);

    const jobs = readJobs(input.repoRoot);
    if (jobs[key] !== undefined) {
        refusals.push(
            `dedup: job '${key}' already started at ${jobs[key]?.started_at ?? 'unknown'} — ` +
                `the same roadmap at the same head is already in flight`,
        );
    }

    return { ok: refusals.length === 0, refusals, jobKey: key };
}
