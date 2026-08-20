#!/usr/bin/env node
/**
 * The detached Class-A sender (road-to-org-telemetry Phase 2, step 2.1).
 *
 * Spawned by `spawn_detached_sender` and never by a human. It is the ONLY
 * code in this tree that makes an outbound telemetry call, which is why it is
 * one small file with no imports beyond node builtins: the egress surface
 * should be readable end to end in one screen by anyone auditing what leaves
 * a machine.
 *
 * PLAIN JS, DELIBERATELY. Its siblings here are TypeScript resolved by `tsx`
 * at import time. A detached child inherits no such resolution, so a `.ts`
 * sender would depend on finding a `tsx` binary in a consumer install at
 * session teardown. `process.execPath` — plain node — exists by construction.
 * The cost of that choice is that this file cannot import the sibling
 * modules, so the drain algorithm lives HERE and nowhere else; the TypeScript
 * side owns enqueue and spawn only, and there is no second copy to drift.
 *
 * CLAIM-BY-RENAME, NOT READ-THEN-TRUNCATE. `rename` is atomic within a
 * filesystem, so a session that appends a record while this process is
 * sending writes to a fresh spool rather than into bytes about to be deleted.
 * Read-then-truncate loses exactly those records, silently, and only under
 * concurrency — the failure shape that never shows up in a single-session
 * test.
 *
 * FAILURE KEEPS THE DATA. A non-2xx, a timeout, a DNS failure, a thrown
 * anything: the claimed lines go back in front of the spool and the next
 * session's flush tries again. "Local retention for the next flush" is the
 * step's own wording and this is it. Exit code is always 0 — nothing reads it
 * (`stdio: 'ignore'`), and a non-zero from a detached child is a log line
 * nobody will ever see.
 */
import * as fs from 'node:fs';

const DEFAULT_TIMEOUT_MS = 1000;

function parse_args(argv) {
    const out = { spool: '', endpoint: '', timeout_ms: DEFAULT_TIMEOUT_MS };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--spool') {
            out.spool = argv[i + 1] ?? '';
            i += 1;
        } else if (a === '--endpoint') {
            out.endpoint = argv[i + 1] ?? '';
            i += 1;
        } else if (a === '--timeout') {
            const n = Number.parseInt(argv[i + 1] ?? '', 10);
            if (Number.isFinite(n) && n > 0) out.timeout_ms = n;
            i += 1;
        }
    }
    return out;
}

/**
 * Take the spool by rename. Returns the claim path, or `null` when there is
 * nothing to send — including the race where a sibling sender claimed it
 * first, which is a no-op rather than an error.
 */
export function claim_spool(spool_path) {
    let size = 0;
    try {
        size = fs.statSync(spool_path).size;
    } catch {
        return null;
    }
    if (size === 0) return null;
    const claim = `${spool_path}.sending.${process.pid}.${Date.now()}`;
    try {
        fs.renameSync(spool_path, claim);
    } catch {
        return null;
    }
    return claim;
}

/** Put the claimed lines back in FRONT of whatever arrived meanwhile. */
export function restore_claim(claim_path, spool_path) {
    try {
        const claimed = fs.readFileSync(claim_path, 'utf-8');
        let current = '';
        try {
            current = fs.readFileSync(spool_path, 'utf-8');
        } catch {
            current = '';
        }
        fs.writeFileSync(spool_path, claimed + current, { encoding: 'utf-8' });
        fs.unlinkSync(claim_path);
        return true;
    } catch {
        // The claim file survives under its own name; the next sender's
        // `claim_spool` will not see it, so it is recoverable by hand rather
        // than lost. Better than a partial write over the live spool.
        return false;
    }
}

/**
 * POST the batch as NDJSON. Returns true only on a 2xx.
 *
 * The body is the spooled bytes verbatim — every line is a Class-A record
 * whose fields are all structural (see `remote.ts`), so there is no
 * serialisation step here that could introduce a field the record type does
 * not have.
 */
export async function post_batch(endpoint, body, timeout_ms) {
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-ndjson' },
            body,
            signal: AbortSignal.timeout(timeout_ms),
        });
        return res.ok === true;
    } catch {
        return false;
    }
}

export async function run(args) {
    if (!args.spool || !args.endpoint) return 'no-op';
    const claim = claim_spool(args.spool);
    if (claim === null) return 'no-op';

    let body = '';
    try {
        body = fs.readFileSync(claim, 'utf-8');
    } catch {
        return 'read-failed';
    }
    if (body.length === 0) {
        try {
            fs.unlinkSync(claim);
        } catch {
            /* nothing to clean */
        }
        return 'no-op';
    }

    const ok = await post_batch(args.endpoint, body, args.timeout_ms);
    if (ok) {
        try {
            fs.unlinkSync(claim);
        } catch {
            /* sent; a stale claim is harmless */
        }
        return 'sent';
    }
    restore_claim(claim, args.spool);
    return 'retained';
}

const _entry = process.argv[1] ?? '';
const _invoked_directly = _entry !== '' && import.meta.url === new URL(`file://${_entry}`).href;

if (_invoked_directly) {
    run(parse_args(process.argv.slice(2)))
        .then(() => process.exit(0))
        .catch(() => process.exit(0));
}

export { parse_args };
