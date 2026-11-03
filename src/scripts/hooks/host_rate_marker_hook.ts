#!/usr/bin/env tsx
/**
 * host-rate-marker — the host's own `StopFailure` with error class
 * `rate_limit` writes the `quota_parked` marker, tagged host-sourced.
 *
 * Bound on `agent_error`, onto which Claude's `StopFailure` is lowered. Which
 * failure classes park is one set, {@link HOST_FAILURE_PARKS}: an auth,
 * account or org failure is not a quota wall, and reading it as one would tell
 * an operator to wait for a reset that will fix nothing. The reset time is not
 * looked up here: `run_supervise` reads it from the quota ledger when it reports
 * the marker, which keeps the ledger and pressure model out of the dispatch
 * bundle. It records and never acts: nothing here sleeps, retries or relaunches,
 * and the exit is 0 on every path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { writeQuotaParked } from '../_lib/quota_parked.js';
import { resolveConsumerRoot } from './subagent_ledger_hook.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

type JsonObject = { [k: string]: unknown };
const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The host vendor whose plan window a host-sourced marker describes. */
const HOST_PROVIDER = 'anthropic';

/**
 * The host failure classes that park a run. Auth, account, org and every other
 * class are not a quota wall; a class this set does not name writes nothing.
 */
export const HOST_FAILURE_PARKS: ReadonlySet<string> = new Set(['rate_limit']);

function processEnvelope(envelope: unknown, root: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
        if (payload['hook_event_name'] !== 'StopFailure' || !HOST_FAILURE_PARKS.has(String(payload['error']))) return EXIT_ALLOW;
        const session = payload['session_id'];
        if (typeof session !== 'string' || session === '') return EXIT_ALLOW;
        writeQuotaParked(root, session, [HOST_PROVIDER], () => new Date(), 'host');
    } catch {
        // A marker that cannot be written is a missed record, never a blocked stop.
    }
    return EXIT_ALLOW;
}

/** String-in entry for tests and the dispatcher. */
export function run(stdinText: string, root: string): number {
    let envelope: unknown;
    try {
        envelope = stdinText.trim() ? JSON.parse(stdinText) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, root);
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: unknown = {};
    try {
        envelope = raw.trim() ? JSON.parse(raw) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, resolveConsumerRoot(envelope as never));
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
