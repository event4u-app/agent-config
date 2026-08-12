/**
 * Staged-confirmation store — the I/O half, and the half that makes
 * exactly-once real.
 *
 * `staged_confirmation.ts` decides what a confirmation attempt MEANS. It cannot
 * make the transition happen only once: two processes that both read a
 * `pending` record and both conclude `execute` is a check-then-act race, and no
 * pure function closes it. So the claim is a **directory rename**, which the
 * filesystem performs atomically — the first caller moves
 * `pending/<token>.json` to `resolved/`, every later caller gets `ENOENT` and
 * learns the stage is already taken.
 *
 * That is also why the state lives in the path and not only in a field: a
 * read-modify-write of a `state:` key would reopen exactly the window the
 * rename closes.
 *
 * Records live under `agents/runtime/staged-confirmations/`, which the repo
 * `.gitignore` already covers via the `/agents/runtime/` catch-all — a staged
 * action is machine-generated local state, never a tracked artefact. The store
 * mirrors `_lib/self_repair_store.ts`: one file per identity, every read
 * tolerant of a malformed file, and no throw on a missing directory.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    confirmOnce,
    declineStage,
    type ConfirmOutcome,
    type StageState,
    type StagedAction,
    stageStatus,
} from './staged_confirmation.js';

export const STORE_REL = path.join('agents', 'runtime', 'staged-confirmations');

export function storeDir(root: string): string {
    return path.join(root, STORE_REL);
}

function pendingDir(root: string): string {
    return path.join(storeDir(root), 'pending');
}

function resolvedDir(root: string): string {
    return path.join(storeDir(root), 'resolved');
}

/**
 * A token is a filename before it is an identifier, so every site that turns
 * one into a path checks it first — the read verbs, the write verb, and the
 * record guard itself.
 *
 * `deriveToken` returns a 16-char sha256 prefix, so a token this module mints
 * is always safe. Everything else is a way in: `readPending`,
 * `claimConfirmation` and `declineConfirmation` take a caller-supplied token;
 * `putPending` joins `stage.token` from a caller-built record (verified: it
 * wrote outside the store root); and `isStage` accepted any string, so a record
 * written by something else carried its token into the prune path. All four are
 * guarded, and `path.join(pendingDir(root), '../x.json')` resolving outside
 * `pending/` is what makes that necessary.
 */
const _TOKEN_RE = /^[0-9a-f]{8,64}$/;

export function isSafeToken(token: string): boolean {
    return _TOKEN_RE.test(token);
}

/**
 * Every field the module later reads, `staged_at` included.
 *
 * It checked four of five while still asserting `v is StagedAction`, so a
 * record that was valid JSON but carried no `staged_at` passed the guard and
 * reached `listPending`'s `staged_at.localeCompare(...)`: a TypeError thrown
 * through `roadmap_gates.renderPending`, i.e. one malformed file on disk taking
 * out a shipped gate. An unsound guard is worse than no guard — it makes the
 * caller's `!== null` check read as a proof that it is not.
 */
function isStage(v: unknown): v is StagedAction {
    if (typeof v !== 'object' || v === null) {
        return false;
    }
    const s = v as Partial<StagedAction>;
    return (
        typeof s.token === 'string' &&
        isSafeToken(s.token) &&
        typeof s.action === 'string' &&
        typeof s.object === 'string' &&
        typeof s.staged_at === 'string' &&
        typeof s.expires_at === 'string'
    );
}

function readStageFile(file: string): StagedAction | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return isStage(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function writeStageFile(file: string, stage: StagedAction): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(stage, null, 2)}\n`, 'utf-8');
}

/**
 * Persist a freshly staged action. Returns the path written.
 *
 * Throws on an unsafe token rather than returning: a caller reaching here with
 * one built the record itself and has a bug, and `writeStageFile` creates
 * directories, so a silent refusal would look like a successful stage nothing
 * can ever confirm.
 */
export function putPending(root: string, stage: StagedAction): string {
    if (!isSafeToken(stage.token)) {
        throw new Error(
            `staged-confirmation: refusing to write under an unsafe token '${stage.token}' — ` +
                'a token is a filename and must match the deriveToken shape',
        );
    }
    const file = path.join(pendingDir(root), `${stage.token}.json`);
    writeStageFile(file, stage);
    return file;
}

export function readPending(root: string, token: string): StagedAction | null {
    if (!isSafeToken(token)) {
        return null;
    }
    return readStageFile(path.join(pendingDir(root), `${token}.json`));
}

export function readResolved(root: string, token: string): StagedAction | null {
    if (!isSafeToken(token)) {
        return null;
    }
    return readStageFile(path.join(resolvedDir(root), `${token}.json`));
}

/**
 * Every stage still in `pending/`, with its effective status at `now` so an
 * expired one is never rendered as awaiting approval. Sorted by `staged_at`
 * (oldest first, ties by token) so two runs on an unchanged store print
 * byte-identical output.
 */
export function listPending(
    root: string,
    now: number,
): { stage: StagedAction; status: StageState | 'expired' }[] {
    let names: string[];
    try {
        names = fs.readdirSync(pendingDir(root));
    } catch {
        return [];
    }
    const out: { stage: StagedAction; status: StageState | 'expired' }[] = [];
    for (const n of names.sort()) {
        if (!n.endsWith('.json')) {
            continue;
        }
        const stage = readStageFile(path.join(pendingDir(root), n));
        if (stage !== null) {
            out.push({ stage, status: stageStatus(stage, now) });
        }
    }
    out.sort(
        (a, b) =>
            a.stage.staged_at.localeCompare(b.stage.staged_at) ||
            a.stage.token.localeCompare(b.stage.token),
    );
    return out;
}

/**
 * Atomically claim a pending stage and decide the outcome.
 *
 * Order matters and is the whole mechanism:
 *
 *   1. Read the record. An absent one is `token-mismatch` — from the caller's
 *      side an unknown token and a wrong token are the same fact, and inventing
 *      a third outcome for "was never staged" would only be actionable if the
 *      store were a public index, which it is not.
 *   2. Ask `confirmOnce` what the outcome WOULD be. A mismatch, a decline, or
 *      an expiry never claims anything — a stale surface must not consume a
 *      stage a human might still legitimately confirm.
 *   3. Only for `execute`: rename `pending/` → `resolved/`. That is the claim.
 *      `ENOENT` means a concurrent caller won the race, so this caller reports
 *      `already-confirmed` and does NOT act — the exactly-once guarantee.
 *   4. Write the confirmed record into `resolved/`, overwriting the moved file
 *      with the same content plus `state`/`resolved_at`.
 */
export function claimConfirmation(
    root: string,
    token: string,
    now: number,
): { outcome: ConfirmOutcome; stage: StagedAction | null } {
    if (!isSafeToken(token)) {
        // Nothing this module staged can have that shape, so the honest answer
        // is the same one an unknown token gets — and refusing here is what
        // keeps the rename below off an arbitrary path.
        return { outcome: 'token-mismatch', stage: null };
    }
    const pendingFile = path.join(pendingDir(root), `${token}.json`);
    const stage = readStageFile(pendingFile);
    if (stage === null) {
        const already = readResolved(root, token);
        if (already !== null) {
            // `pruneExpired` moves a stage here WITHOUT rewriting `state`, so the
            // status is derived rather than read off the field — otherwise an
            // expired stage swept out of `pending/` would report as confirmed,
            // which is the one wrong answer available here.
            const status = stageStatus(already, now);
            const outcome: ConfirmOutcome =
                status === 'expired' ? 'expired' : status === 'declined' ? 'declined' : 'already-confirmed';
            return { outcome, stage: already };
        }
        return { outcome: 'token-mismatch', stage: null };
    }

    const decided = confirmOnce(stage, token, now);
    if (decided.outcome !== 'execute') {
        return decided;
    }

    const resolvedFile = path.join(resolvedDir(root), `${token}.json`);
    fs.mkdirSync(resolvedDir(root), { recursive: true });
    try {
        fs.renameSync(pendingFile, resolvedFile);
    } catch {
        // Lost the race, or the pending file vanished between the read and the
        // rename. Either way this caller has NOT claimed the stage and must not
        // act on it.
        return { outcome: 'already-confirmed', stage: readResolved(root, token) ?? stage };
    }
    writeStageFile(resolvedFile, decided.stage);
    return decided;
}

/** Decline a pending stage. Same claim discipline as `claimConfirmation`. */
export function declineConfirmation(
    root: string,
    token: string,
    now: number,
): { declined: boolean; stage: StagedAction | null } {
    if (!isSafeToken(token)) {
        return { declined: false, stage: null };
    }
    const pendingFile = path.join(pendingDir(root), `${token}.json`);
    const stage = readStageFile(pendingFile);
    if (stage === null) {
        return { declined: false, stage: readResolved(root, token) };
    }
    const decided = declineStage(stage, token, now);
    if (!decided.declined) {
        return { declined: false, stage };
    }
    const resolvedFile = path.join(resolvedDir(root), `${token}.json`);
    fs.mkdirSync(resolvedDir(root), { recursive: true });
    try {
        fs.renameSync(pendingFile, resolvedFile);
    } catch {
        return { declined: false, stage: readResolved(root, token) ?? stage };
    }
    writeStageFile(resolvedFile, decided.stage);
    return { declined: true, stage: decided.stage };
}

/**
 * Move expired stages out of `pending/` so the enumeration stays a list of
 * live decisions. Housekeeping only — `stageStatus` already derives expiry, so
 * skipping the sweep changes what is *listed*, never what may execute.
 */
export function pruneExpired(root: string, now: number): number {
    let names: string[];
    try {
        names = fs.readdirSync(pendingDir(root));
    } catch {
        return 0;
    }
    let moved = 0;
    for (const name of names.sort()) {
        if (!name.endsWith('.json')) {
            continue;
        }
        // Move the file that was ENUMERATED, never a path rebuilt from the
        // record's `token` field. The two disagree whenever a filename and its
        // token do — a record written by anything but `putPending` — and the
        // rebuilt path then hits ENOENT, gets swallowed by the catch below, and
        // the stage sits in `pending/` forever while `moved` under-reports it.
        const from = path.join(pendingDir(root), name);
        const stage = readStageFile(from);
        if (stage === null || stageStatus(stage, now) !== 'expired') {
            continue;
        }
        const to = path.join(resolvedDir(root), name);
        fs.mkdirSync(resolvedDir(root), { recursive: true });
        try {
            fs.renameSync(from, to);
        } catch {
            continue;
        }
        moved += 1;
    }
    return moved;
}
