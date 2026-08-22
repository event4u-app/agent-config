/**
 * billing_grant — the run-scoped answer to "plan quota is gone, may I spend?".
 *
 * The problem this closes is a billing-class switch nobody chose at the moment
 * it happened. A council seat on a vendor CLI under a subscription login is
 * unmetered; its api twin is metered USD. Until `api_on_quota: 'ask'` existed
 * that switch was decided once, at configuration time, and then applied
 * silently mid-round — see `transport_resolver.ts` § `FallbackPolicy`.
 *
 * A grant is the human's yes, and it is scoped to ONE run for two reasons.
 *
 * The first is that a run is the unit the question is answerable in. "May I
 * spend money finishing this?" needs the remaining scope in view; a standing
 * setting has no scope to show. The second is the failure a wall-clock TTL
 * produces: the git-guard grant expired after 30 minutes, so a drain outliving
 * its own grant re-asked mid-run — which is the interruption this whole
 * mechanism exists to remove. So the TTL here is the RUN, and `revoke` is
 * called from the path that already clears run-continuation state. A wall
 * clock appears only as a backstop for a run that died without cleaning up.
 *
 * Transport is an env var (`AC_BILLING_GRANT`) plus a file under
 * `agents/runtime/`. Both are needed and neither is redundant: the env var is
 * what a spawned subagent can read without knowing the repo root, and the file
 * is what makes the grant survive a subprocess boundary in the other
 * direction and gives `revoke` something to delete. `hardenedSpawnEnv()`
 * passes the `AC_` family through — verified, and pinned by a test in
 * `tests/scripts/_lib/spawn_env.test.ts`, because a future deny-family entry
 * would otherwise break the chain silently.
 *
 * PII-exclusion-by-construction: a grant record holds a run id, an ISO
 * timestamp, and nothing else. There is no field capable of carrying a prompt,
 * a path, or a credential, so there is no scrubbing pass here that could fail.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Env var the main session sets and every spawned worker reads. */
export const BILLING_GRANT_ENV = 'AC_BILLING_GRANT';

/** Directory, relative to the repo root, holding one file per live grant. */
export const BILLING_GRANT_DIR_REL = path.join('agents', 'runtime', 'billing-grants');

/**
 * Backstop only. A run that exits through its normal path calls `revoke`; this
 * bounds the damage of one that does not, and is deliberately far longer than
 * any run so it can never be the thing that ends a live grant.
 */
export const BILLING_GRANT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface BillingGrant {
    readonly run_id: string;
    readonly issued_at: string;
}

/** Filesystem-safe filename for a run id. Mirrors `run_checkpoint.checkpointFile`. */
export function grantFile(repoRoot: string, runId: string): string {
    return path.join(
        repoRoot,
        BILLING_GRANT_DIR_REL,
        `${runId.replace(/[^A-Za-z0-9_-]/g, '_')}.json`,
    );
}

/**
 * Record the human's yes for `runId` and return the env pair to hand to
 * subagents. Idempotent: re-issuing keeps the original `issued_at`, so a
 * second yes inside one run cannot extend the backstop window.
 */
export function issueBillingGrant(
    repoRoot: string,
    runId: string,
    now: () => Date = () => new Date(),
): BillingGrant {
    const file = grantFile(repoRoot, runId);
    const existing = _read(file);
    if (existing !== null && existing.run_id === runId) return existing;
    const grant: BillingGrant = { run_id: runId, issued_at: now().toISOString() };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(grant, null, 2)}\n`, 'utf8');
    return grant;
}

/**
 * Is a grant in force for `runId`?
 *
 * Both halves must agree, and the AND is the security property rather than
 * belt-and-braces: an env var alone is settable by anything in the process
 * tree, and a file alone would let a grant from a previous run authorise this
 * one. Requiring the env var to NAME the run whose file exists is what makes
 * a different run's grant unusable.
 */
export function isBillingGrantActive(
    repoRoot: string,
    runId: string,
    env: NodeJS.ProcessEnv = process.env,
    now: () => Date = () => new Date(),
): boolean {
    if ((env[BILLING_GRANT_ENV] ?? '').trim() !== runId) return false;
    const grant = _read(grantFile(repoRoot, runId));
    if (grant === null || grant.run_id !== runId) return false;
    const age = now().getTime() - Date.parse(grant.issued_at);
    return Number.isFinite(age) && age >= 0 && age <= BILLING_GRANT_MAX_AGE_MS;
}

/**
 * Ambient check for a caller that does not carry a run id — the council CLI
 * reading config, for instance. The env var names the run, so the file it
 * names is the one that must exist; there is no "any grant will do" branch.
 */
export function hasBillingGrant(
    repoRoot: string,
    env: NodeJS.ProcessEnv = process.env,
    now: () => Date = () => new Date(),
): boolean {
    const runId = (env[BILLING_GRANT_ENV] ?? '').trim();
    if (runId === '') return false;
    return isBillingGrantActive(repoRoot, runId, env, now);
}

/**
 * Remove the grant for `runId`. Safe to call when none exists.
 *
 * Called from `run_continuation_hook.clearRunState` — the one place a run is
 * declared over, and therefore the grant's real TTL. `clearRunState` is
 * exported for that reason: reaching it through the concern chain would mean
 * standing up the whole dispatch harness to assert one unlink.
 */
export function revokeBillingGrant(repoRoot: string, runId: string): void {
    try {
        fs.unlinkSync(grantFile(repoRoot, runId));
    } catch {
        // Already gone is the success case, not an error worth surfacing.
    }
}

function _read(file: string): BillingGrant | null {
    try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
        if (raw === null || typeof raw !== 'object') return null;
        const o = raw as Record<string, unknown>;
        if (typeof o.run_id !== 'string' || typeof o.issued_at !== 'string') return null;
        return { run_id: o.run_id, issued_at: o.issued_at };
    } catch {
        return null;
    }
}

/**
 * The id of the run a grant would be scoped to.
 *
 * Resolution order, first non-empty wins: `AC_BILLING_GRANT` (a grant already
 * in force names its own run), then `AC_RUN_ID` (what an orchestrating session
 * sets), then the host's session id. Returns `null` when none resolves — and
 * `null` is rendered as a literal placeholder rather than a fabricated id,
 * because a grant command carrying an invented run id would be a command that
 * silently authorises nothing.
 */
export function currentRunId(env: NodeJS.ProcessEnv = process.env): string | null {
    for (const key of [BILLING_GRANT_ENV, 'AC_RUN_ID', 'CLAUDE_CODE_SESSION_ID']) {
        const v = (env[key] ?? '').trim();
        if (v !== '') return v;
    }
    return null;
}
