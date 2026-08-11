/**
 * Staged-action confirmations — the exactly-once half of the
 * `requires_confirmation` primitive (road-to-inbox-harvest-2026-08-b-dispatch-safety
 * Phase 2).
 *
 * `src/rules/non-destructive-by-default.md` already states the whole policy:
 * ask and act are strictly sequential, and the approval names the exact object.
 * What the tree had no mechanism for is the second half of that sentence — a
 * staged action that is executed **once** when the approval arrives, and not
 * again when the same approval arrives twice (a re-run, a retried hook, an
 * operator pressing enter on a stale prompt).
 *
 * Exactly-once is a `rename(2)`, not a read-then-write. Reading a record,
 * checking a `consumed` boolean and writing it back has a window between the
 * read and the write in which a second caller reads the same `false`; a rename
 * is atomic on every POSIX filesystem and on NTFS, so the *first* caller moves
 * the file and every later caller gets `ENOENT`. The file's location is its
 * state — `pending/` or `consumed/` — which also means the state cannot
 * disagree with itself the way a flag inside a mutable record can.
 *
 * Records live under `agents/runtime/confirmations/`, covered by the repo
 * `.gitignore`'s `/agents/runtime/` catch-all: a staged action is machine-local
 * state, never a tracked artefact — the same placement `self_repair_store.ts`
 * uses for the same reason.
 *
 * **Nothing in the shipped tree stages an action yet, deliberately.** Whether
 * the primitive binds — and what the five hosts without a `pre_tool_use` slot
 * get — is step 2.4, deferred behind `blocker: confirmation-degraded-host-semantics`.
 * `stageAction` is reachable only through an explicitly injected stager
 * ({@link DecisionGateHook}'s `stage` option), so the default behaviour of every
 * shipped path is byte-identical to before this module existed. Shipping the
 * mechanism unbound and saying so is the honest shape; shipping it bound and
 * claiming enforcement three hosts cannot provide is the failure
 * `src/rules/ui-audit-gate.md` names.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Relative store root, mirroring `self_repair_store.STORE_REL`. */
export const CONFIRMATIONS_REL = path.join('agents', 'runtime', 'confirmations');

export function pendingDir(root: string): string {
    return path.join(root, CONFIRMATIONS_REL, 'pending');
}

export function consumedDir(root: string): string {
    return path.join(root, CONFIRMATIONS_REL, 'consumed');
}

/**
 * What a caller declares when staging.
 *
 * Every field is a short scalar. There is deliberately no `payload` / `notes` /
 * `extra` field: a type that cannot hold free-form content has no scrubber that
 * can fail (`domain-safety-pii` § Surface 2). `object` is the one field that
 * carries caller text, and it is required rather than optional — an approval
 * that does not name the exact object is the thing
 * `non-destructive-by-default` forbids.
 */
export interface StageInput {
    /** Which gate or surface staged this. */
    readonly gate_id: string;
    /** Work-engine phase, or `''` when staged outside a phase. */
    readonly phase: string;
    /** The verb that will run on approval — `push`, `publish`, `delete`. */
    readonly action: string;
    /** The exact object the approval names — a branch, a path, an amount. */
    readonly object: string;
}

export interface StagedAction extends StageInput {
    readonly token: string;
    /** ISO-8601, stamped at stage time. */
    readonly staged_at: string;
}

export type ConfirmStatus =
    /** This call consumed the token; the caller may execute now. */
    | 'executed'
    /** A previous call already consumed it; the caller must NOT execute. */
    | 'already_executed'
    /** No such token was ever staged here. */
    | 'unknown';

export interface ConfirmOutcome {
    readonly status: ConfirmStatus;
    /** The staged record, when one is recoverable; `null` on `unknown`. */
    readonly record: StagedAction | null;
}

/** Options exist so tests pin a token and a timestamp instead of guessing. */
export interface StageOptions {
    readonly token?: string;
    readonly now?: string;
}

function recordFile(dir: string, token: string): string {
    return path.join(dir, `${token}.json`);
}

function isStaged(v: unknown): v is StagedAction {
    if (typeof v !== 'object' || v === null) {
        return false;
    }
    const r = v as Partial<StagedAction>;
    return (
        typeof r.token === 'string' &&
        typeof r.gate_id === 'string' &&
        typeof r.action === 'string' &&
        typeof r.object === 'string'
    );
}

function readAt(file: string): StagedAction | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return isStaged(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Stage an action and return its record. The token is the approval's name;
 * surface it to the human so the confirmation can reference exactly this
 * staging and not a similar one.
 */
export function stageAction(
    root: string,
    input: StageInput,
    opts: StageOptions = {},
): StagedAction {
    const record: StagedAction = {
        token: opts.token ?? randomUUID(),
        gate_id: input.gate_id,
        phase: input.phase,
        action: input.action,
        object: input.object,
        staged_at: opts.now ?? new Date().toISOString(),
    };
    const dir = pendingDir(root);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        recordFile(dir, record.token),
        `${JSON.stringify(record, null, 2)}\n`,
        'utf-8',
    );
    return record;
}

/**
 * Consume a token exactly once.
 *
 * The first call renames `pending/<token>.json` into `consumed/` and returns
 * `executed`. Every later call finds nothing to rename and returns
 * `already_executed` (the consumed record is still there to prove it) or
 * `unknown` (nothing by that name was ever staged). A caller executes on
 * `executed` and on nothing else.
 */
export function confirmAction(root: string, token: string): ConfirmOutcome {
    const from = recordFile(pendingDir(root), token);
    const to = recordFile(consumedDir(root), token);
    fs.mkdirSync(consumedDir(root), { recursive: true });
    try {
        const record = readAt(from);
        fs.renameSync(from, to);
        return { status: 'executed', record: record ?? readAt(to) };
    } catch {
        const consumed = readAt(to);
        return consumed === null
            ? { status: 'unknown', record: null }
            : { status: 'already_executed', record: consumed };
    }
}

/** Every staged-but-unconfirmed action, oldest staging first. */
export function listPending(root: string): StagedAction[] {
    let names: string[];
    try {
        names = fs.readdirSync(pendingDir(root));
    } catch {
        return [];
    }
    const out: StagedAction[] = [];
    for (const n of names) {
        if (!n.endsWith('.json')) {
            continue;
        }
        const rec = readAt(path.join(pendingDir(root), n));
        if (rec !== null) {
            out.push(rec);
        }
    }
    out.sort((a, b) => a.staged_at.localeCompare(b.staged_at));
    return out;
}
