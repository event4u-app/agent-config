#!/usr/bin/env tsx
/**
 * host-rate-marker — the host's own `StopFailure` with error class
 * `rate_limit` writes the `quota_parked` marker, tagged host-sourced.
 *
 * Bound on `agent_error`, onto which Claude's `StopFailure` is lowered. Which
 * failure classes park is one table, {@link HOST_FAILURE_PARKS}: an auth,
 * account or org failure is not a quota wall, and reading it as one would tell
 * an operator to wait for a reset that will fix nothing. A class the table does
 * not name writes nothing. The reset time, when known, comes from the quota
 * ledger the status-line tap already writes — never from a credential or an
 * error string. It records and never acts: nothing here sleeps, retries or
 * relaunches, and the exit is 0 on every path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { exhaustedResetAt } from '../_lib/pressure.js';
import { readQuotaLedger } from '../_lib/quota_ledger.js';
import { writeQuotaParked } from '../_lib/quota_parked.js';
import type { EnvMap } from '../_lib/user_global_paths.js';
import { resolveConsumerRoot } from './subagent_ledger_hook.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

type JsonObject = { [k: string]: unknown };
const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The host vendor whose plan window a host-sourced marker describes. */
const HOST_PROVIDER = 'anthropic';

/**
 * Host failure class → does it park the run. The class names are the host's
 * documentation, not observed here, so an unlisted class maps to nothing.
 */
export const HOST_FAILURE_PARKS: Readonly<Record<string, boolean>> = Object.freeze({
    rate_limit: true,
    authentication_failed: false,
    billing_error: false,
    oauth_org_not_allowed: false,
    invalid_request: false,
    server_error: false,
    overloaded: false,
    max_output_tokens: false,
    unknown: false,
});

function parks(errorClass: unknown): boolean {
    return typeof errorClass === 'string' && Object.hasOwn(HOST_FAILURE_PARKS, errorClass) && HOST_FAILURE_PARKS[errorClass] === true;
}

function ledgerResetAt(env: EnvMap | null, nowMs: number): number | null {
    try {
        return exhaustedResetAt(readQuotaLedger(env, nowMs), nowMs);
    } catch {
        return null;
    }
}

function processEnvelope(envelope: unknown, root: string, env: EnvMap | null): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
        if (payload['hook_event_name'] !== 'StopFailure' || !parks(payload['error'])) return EXIT_ALLOW;
        const session = payload['session_id'];
        if (typeof session !== 'string' || session === '') return EXIT_ALLOW;
        const now = new Date();
        writeQuotaParked(root, session, [HOST_PROVIDER], () => now, 'host', ledgerResetAt(env, now.getTime()));
    } catch {
        // A marker that cannot be written is a missed record, never a blocked stop.
    }
    return EXIT_ALLOW;
}

/** String-in entry for tests and the dispatcher. */
export function run(stdinText: string, root: string, env: EnvMap | null = null): number {
    let envelope: unknown;
    try {
        envelope = stdinText.trim() ? JSON.parse(stdinText) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, root, env);
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: unknown = {};
    try {
        envelope = raw.trim() ? JSON.parse(raw) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, resolveConsumerRoot(envelope as never), null);
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());
