/**
 * The runtime event journal — a durable, episode-keyed record of the dispatch
 * stream, written by hook invocations that terminate.
 *
 * `road-to-runtime-event-journal` Phases 1 and 2. Every writer here starts,
 * writes, and exits: this is Class A under ADR-124, the same shape as
 * `_lib/test_red_state.ts`, and it opens no Class-B surface. The storage
 * choice is precedented rather than novel — `code_graph/sqlite_store.ts` and
 * `mcp_telemetry_store.ts` already run SQLite on the Class-A path through
 * `_lib/sqlite_guard.ts`.
 *
 * ## Privacy is a property of the schema, not of a scrubber
 *
 * {@link JournalEvent} has **no field capable of holding free-form content**.
 * That is enforced three ways, deliberately overlapping, because a scrubbing
 * pass is exactly the mechanism that fails silently:
 *
 * 1. {@link JOURNAL_RECORD_KEYS} is the committed key set, bound to the record
 *    type in BOTH directions by a compile-time assertion below — adding a
 *    field without adding its key, or vice versa, does not compile.
 * 2. {@link NoFreeForm} resolves to `never` if the record ever acquires a key
 *    from {@link FreeFormKey} (`prompt`, `body`, `path`, `payload`, ...), and
 *    it is applied to {@link JournalEvent} in an assertion that fails to
 *    type-check rather than warning.
 * 3. Write time rejects absolute paths, over-long locators, and a `capability`
 *    that is not a bounded identifier. Belt and braces: (1) and (2) stop a
 *    *schema* mistake, (3) stops a *value* mistake in a field that is legal.
 *
 * ## Where the database lives — ACCEPTED, and the contract says so
 *
 * `<git-common-dir>/agent-journal/journal.sqlite`. This is the NORMATIVE path,
 * not an implementation detail that drifted from a spec: the roadmap's step 1.1
 * and `docs/contracts/runtime-persistence-tiers.md` were amended to state it,
 * by AI council decision 2026-08-28 (anthropic + openai, 2/2 convergent).
 *
 * The roadmap originally specified `agents/runtime/state/`, which is
 * **worktree-local**: `_lib/session_register.ts` documents the measurement
 * (2026-08-07) that concerns run with `CWD = envelope.workspace_root`, so in a
 * linked worktree that directory is the worktree's own and a fresh worktree's
 * does not exist at all. Putting the journal there would give every checkout
 * its own database and make AC-3 — "two concurrent writers **from two worktrees
 * of one repository** both land" — **unfalsifiable by construction**: two
 * writers to two different files always both land, and the test could never go
 * red. Both council seats reached that conclusion independently, and the real
 * contention the shared path creates then found three genuine durability bugs
 * (see § Transient errors below, and the capture evidence page).
 *
 * `<git-common-dir>` is inside `.git/`, so the store is untracked for the same
 * reason `agents/runtime/` is gitignored. The worktree-local path is kept as
 * the documented **fallback** for a root that is not inside a git repository,
 * where there is no common dir to use. {@link resolveJournal} reports which of
 * the two it picked and why.
 *
 * ## Two identities, because one was underspecified
 *
 * Council 2026-08-28, decision 2. The module used to carry a single opaque
 * `namespace` — the digest of the common git directory — and describe it as
 * keeping records "attributable when read together". That description was
 * **false in one direction**: the common git dir is the one directory every
 * worktree of a repo shares BY DEFINITION, so the digest cannot attribute a
 * record to a particular worktree, and no amount of reading it more carefully
 * would make it do so. The concept is now split, and both halves are recorded:
 *
 * - **{@link JournalEvent.repository_id}** — digest of the common git
 *   directory. **Identical across every worktree of one repository**, distinct
 *   between repositories. This is what makes an episode opened in one checkout
 *   joinable from another, and what keeps two repositories' records
 *   attributable when their stores are read together.
 * - **{@link JournalEvent.worktree_id}** — digest of the **per-worktree** git
 *   directory (`_lib/git_common_dir.ts::git_dir`). **Distinct for every
 *   checkout of one repository**, including the main one. This is the
 *   attribution the single field could not carry.
 *
 * Both are 12 hex characters from a domain-separated SHA-256, never a path.
 * The domain separation is why `repository_id !== worktree_id` even in a main
 * checkout, where the two inputs are the same directory: two ids that collide
 * on the commonest layout would read as one concept wearing two names.
 *
 * The privacy property is unchanged and is enforced on the new field too:
 * {@link JOURNAL_RECORD_KEYS} is bound to the record type in both directions,
 * {@link NoFreeForm} makes a free-form key a compile error, and
 * {@link requireDigest} refuses a value at write time that is not a bounded
 * 12-hex identifier — so a future edit that assigned a raw absolute path to
 * `worktree_id` fails at the write, not in a review.
 *
 * ## Cleanup when a worktree, or the repository, is deleted
 *
 * Stated because a storage contract that is silent about deletion is a contract
 * with a hole, and because the honest answer is partly "nothing":
 *
 * - **A linked worktree is deleted (or `git worktree prune`d).** *Nothing
 *   happens.* Its records stay in the shared store, carrying a `worktree_id`
 *   that no longer resolves to a directory. They are not orphaned in any way a
 *   reader can trip over — `repository_id` still identifies the repository and
 *   the episode ids still join — and they expire on the ordinary 30-day TTL
 *   anchored at episode close ({@link episodeAnchor}, {@link pruneExpired}).
 *   There is **no worktree-liveness reaper**, deliberately: a record is
 *   evidence about a run that happened, and a checkout being removed afterwards
 *   does not make the run un-happen. `_lib/session_register.ts` reaps SESSION
 *   records because a stale session record makes a live-session claim that has
 *   gone false; a journal event claims only that an event occurred.
 * - **The main repository is deleted.** The store goes with it. It lives inside
 *   `.git/`, so `rm -rf <repo>` removes `journal.sqlite` and its WAL sidecars in
 *   the same operation. There is nothing to clean up elsewhere, and nothing
 *   outside the repository is ever written — see {@link resolveJournal}, whose
 *   only two outputs are under `<git-common-dir>` or under the root itself.
 * - **The fallback path** (no git repository) is under the root and disappears
 *   with it on the same terms.
 *
 * ## Transient errors never reach the corruption path
 *
 * Restated at the top of the file because it is the defect that cost the most
 * to find and would be cheapest to reintroduce. {@link openJournal} probes the
 * schema version of an existing database before opening it, and a probe failure
 * used to set `drift = true`, which calls {@link discard} — which DELETES the
 * database and its WAL sidecars.
 *
 * Under real two-process contention the losing process's probe threw
 * `SQLITE_BUSY`, and this path then **deleted a healthy database holding
 * another process's 120 committed records, while both processes exited 0.**
 * Measured, not predicted.
 *
 * {@link isBusyError} is the separation: `SQLITE_BUSY` / `SQLITE_LOCKED` (and
 * their message forms) mean *another process is holding the lock*, never *this
 * file is unreadable*. Only a genuinely unreadable file is rebuilt. **A rebuild
 * path that can fire on contention is a data-destruction path** — never widen
 * that `catch` to treat an unclassified failure as drift.
 *
 * ## The episode boundary (blocker: what-counts-as-an-episode-boundary)
 *
 * Resolved by council 2026-08-28 as (c), one episode per task, with the
 * roadmap's own opening rule REJECTED by both seats: the episode opens on the
 * **first event carrying a `task_id`** — envelope correlation — and never on
 * "the first mutating action", which would omit the reads and dispatch
 * decisions that explain why the mutation happened. An event with no `task_id`
 * stays session-scoped and is **marked** `session_fallback`, never silently
 * dropped. Every record carries its boundary provenance and the version of the
 * rule that derived it, so a later reconstruction can produce a corrected
 * episode VIEW without rewriting a single record.
 *
 * ## Retention (blocker: journal-retention-and-size)
 *
 * Resolved as (c): a 30-day TTL anchored on **episode close**, plus an
 * explicit, time-bounded, human-only hold. Holds are append-only
 * `retention_hold` / `retention_release` records in their own table — never a
 * mutable pin table — and they expire too (180 days, renewable), because a
 * hold surface that never expires quietly recreates the unbounded store the
 * TTL exists to prevent.
 *
 * **A derived or session-fallback boundary may not carry an episode-only
 * hold.** Both council seats found the same combined failure: a hold makes a
 * mis-derived boundary durable, so pinning an episode that was really three
 * tasks retains two unrelated tasks forever. {@link createHold} widens such a
 * hold to the containing session rather than refusing it.
 *
 * ## The honest limit on "human-only"
 *
 * {@link createHold} refuses a `created_by` that names an agent, and this
 * module documents that the observed agent may never hold its own episodes.
 * That is a **refusal at the API surface, not an authorization boundary**:
 * nothing inside a single-process Class-A store can distinguish a human's
 * keystroke from an agent that passed a human-looking string. The check stops
 * the accident and the reflex; it does not stop a determined caller, and
 * claiming otherwise would be the kind of coverage inflation this repository
 * keeps removing. A real boundary needs a signer or an out-of-process gate,
 * and neither is Class A.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

import { current_branch, git_common_dir, git_dir } from './git_common_dir.js';
import type { TerminalState } from './outcome_envelope.js';
import { RUN_TERMINAL_STATES } from './outcome_vocabularies.js';
import {
    isSqliteAvailableSync,
    loadSqliteSync,
    readUserVersion,
    stampUserVersion,
} from './sqlite_guard.js';

/** Compile-time assertion helper: `Assert<false>` is a type error. */
type Assert<T extends true> = T;

// ---------------------------------------------------------------------------
// Versions and constants
// ---------------------------------------------------------------------------

/**
 * Bump on ANY table or column change. A mismatch discards and rebuilds.
 *
 * v2 (council 2026-08-28, decision 2): `namespace` became
 * {@link JournalEvent.repository_id} and {@link JournalEvent.worktree_id} was
 * added. A v1 database is discarded on open rather than migrated — the store is
 * a gitignored, rebuildable record under `.git/`, and a migration path for a
 * schema nothing has consumed yet would be code with no reader.
 */
export const JOURNAL_SCHEMA_VERSION = 3;

/**
 * The version of the boundary-derivation rule recorded on every event.
 *
 * v1 is the council's adopted rule: explicit `episode_id` wins; else derive
 * from `task_id`; else fall back to the session and mark it. Bump this when
 * the derivation changes, so a reconstruction can tell which rule produced a
 * given record instead of assuming the current one.
 */
export const BOUNDARY_RULE_VERSION = 1;

/** Default TTL, anchored on episode close. Council 2026-08-28, constraint 1. */
export const RETENTION_TTL_DAYS = 30;

/** Default hold window. Holds expire too. Council 2026-08-28, constraint 4. */
export const HOLD_DEFAULT_DAYS = 180;

/**
 * How long an un-closed episode must be silent before its last event counts as
 * its anchor. Below this it is treated as live and never expires — a TTL
 * anchored on write rather than close would expire an episode still running.
 */
export const INACTIVITY_ANCHOR_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// The event vocabulary partition (AC-1)
// ---------------------------------------------------------------------------

/**
 * Members of `EVENT_VOCABULARY` this module writes a record for.
 *
 * Deliberately not imported from `hooks/dispatch_hook.ts`: that module resolves
 * the hook manifest from its own file location at import time, which makes it a
 * poor dependency for a library used from arbitrary roots. The test enumerates
 * the real `EVENT_VOCABULARY` and asserts this set plus {@link NOT_RECORDED}
 * partitions it exactly, so a copy that drifts fails rather than passing.
 */
export const RECORDED_EVENTS: ReadonlySet<string> = new Set([
    'session_start',
    'session_end',
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
    'stop',
    'pre_compact',
    'agent_error',
    'subagent_start',
    'subagent_stop',
]);

/**
 * Members deliberately NOT recorded, each with the reason — silence about an
 * event is not coverage.
 *
 * **Currently empty, and the emptiness is the finding.** All ten members of the
 * vocabulary are recordable: the journal stores what the dispatcher hands it
 * and has no per-event exclusion. The value of the partition is therefore not
 * what it excludes today but that an eleventh member cannot arrive without a
 * decision — the coverage test fails until it is placed in one set or the
 * other, with a reason if it lands here.
 */
export const NOT_RECORDED: ReadonlyMap<string, string> = new Map<string, string>();

/**
 * Partition check, extracted so the test can exercise its failure mode against
 * a synthetic vocabulary as well as the real one.
 *
 * Returns the members covered by neither set and the ones claimed by both — a
 * member in both sets is as much a coverage defect as one in neither, because
 * the reader cannot tell which claim is live.
 */
export function partitionGaps(
    vocabulary: Iterable<string>,
    recorded: ReadonlySet<string> = RECORDED_EVENTS,
    notRecorded: ReadonlyMap<string, string> = NOT_RECORDED,
): { uncovered: string[]; doubleClaimed: string[]; unreasoned: string[] } {
    const uncovered: string[] = [];
    const doubleClaimed: string[] = [];
    for (const member of vocabulary) {
        const inRecorded = recorded.has(member);
        const inNot = notRecorded.has(member);
        if (!inRecorded && !inNot) uncovered.push(member);
        if (inRecorded && inNot) doubleClaimed.push(member);
    }
    const unreasoned = [...notRecorded.entries()]
        .filter(([, reason]) => reason.trim() === '')
        .map(([member]) => member);
    return { uncovered, doubleClaimed, unreasoned };
}

// ---------------------------------------------------------------------------
// The record shape (1.1, 2.1, AC-2)
// ---------------------------------------------------------------------------

/** Boundary provenance. Recorded on every event, never inferred at read time. */
export const BOUNDARY_STATUSES = ['explicit', 'derived', 'session_fallback'] as const;
export type BoundaryStatus = (typeof BOUNDARY_STATUSES)[number];

/** What the orchestrator did with a return. Phase 3 fills it; Phase 1 stores it. */
export const CONSUMPTION_STATES = ['consumed', 'partially-consumed', 'rejected-with-reason'] as const;
export type Consumption = (typeof CONSUMPTION_STATES)[number];

/**
 * The six terminal states as a runtime array.
 *
 * Re-export of `RUN_TERMINAL_STATES` from `outcome_vocabularies.ts`. It used to
 * be a second literal list here, guarded by two type-level assertions that
 * bound it to the imported TYPE in both directions. That guard worked — but a
 * guarded duplicate is still a duplicate, and it was the only one the step-1.3
 * anti-duplicate check found in this tree
 * (`road-to-experience-loop-broadening` 1.3). Re-exporting removes the second
 * list, which makes the assertions tautological, so they are gone too: there is
 * now nothing to drift.
 *
 * The name is kept because it is exported and pinned by
 * `tests/scripts/runtime_journal.test.ts:205,207`.
 */
export const TERMINAL_STATES = RUN_TERMINAL_STATES;

/**
 * Keys a record may never carry. Not an exhaustive list of every bad name — it
 * is the set of names an author reaches for when they want to stash content,
 * which is the failure mode this guard exists to make non-compiling.
 */
export const FREE_FORM_KEYS = [
    'prompt',
    'prompt_text',
    'text',
    'content',
    'body',
    'file_body',
    'message',
    'output',
    'stdout',
    'stderr',
    'diff',
    'source',
    'snippet',
    'excerpt',
    'detail',
    'details',
    'note',
    'notes',
    'comment',
    'reason',
    'payload',
    'extra',
    'metadata',
    'data',
    'args',
    'env',
    'cwd',
    'path',
    'file_path',
    'abs_path',
    'absolute_path',
] as const;

export type FreeFormKey = (typeof FREE_FORM_KEYS)[number];

/**
 * `T` when `T` carries no {@link FreeFormKey}, and `never` when it does.
 *
 * Applied to {@link JournalEvent} in `_RecordCarriesNoFreeFormField` below: a
 * record type that grows a `payload` or a `detail` makes that assertion
 * `Assert<false>`, which is a compile error, not a lint warning.
 */
export type NoFreeForm<T> = Extract<keyof T, FreeFormKey> extends never ? T : never;

/** One journal event. These fields and no others. */
export interface JournalEvent {
    /** Monotonic within one database. Assigned by SQLite, never by a caller. */
    seq: number;
    /** A member of `EVENT_VOCABULARY`. */
    event: string;
    /** Opaque episode id. Derived per {@link BOUNDARY_RULE_VERSION}. */
    episode_id: string;
    /** Opaque host session id. */
    session_id: string;
    /** Opaque envelope task id, when the envelope assigned one. */
    task_id: string | null;
    /** Opaque prompt id, when the event has one. */
    prompt_id: string | null;
    /** How `episode_id` was arrived at. */
    boundary_status: BoundaryStatus;
    /** Which derivation rule produced `boundary_status`. */
    boundary_rule_version: number;
    /**
     * Digest of the **common** git directory — the same value from every
     * worktree of one repository. See the module docstring's § Two identities.
     */
    repository_id: string;
    /**
     * Digest of the **per-worktree** git directory — a distinct value for every
     * checkout of one repository, the main one included. Bounded identifier,
     * never a path: {@link requireDigest} refuses anything else at write time.
     */
    worktree_id: string;
    /** ISO-8601 instant. */
    at: string;
    /** Bounded identifier: the hook or command name. Never free text. */
    capability: string;
    /** Imported from `outcome_envelope.ts`; null until an episode terminates. */
    terminal_state: TerminalState | null;
    /** Repo-relative locator for the return. Never an absolute path. */
    return_ref: string | null;
    /** Repo-relative locator for the verification. Never an absolute path. */
    verification_ref: string | null;
    /** What the orchestrator did with the return. Phase 3 fills it. */
    consumption: Consumption | null;
    /** Provisional per-record expiry; see {@link effectiveExpiry}. ISO-8601. */
    retain_until: string;
    /**
     * The `seq` this event AMENDS, or `null` for an original observation.
     *
     * Outcomes arrive late — rework, a regression, a review landing after the
     * episode closed — and this store is append-only by construction (`seq` is
     * assigned by SQLite, never by a caller), so the original cannot be edited
     * and must not be. An amendment is a NEW ROW pointing at the one it
     * revises; the original stays byte-identical and {@link reconstructEpisode}
     * folds the chain. That matters for the repeated-failure rate in
     * particular: a repeat is exactly the signal that surfaces after the record
     * is written, so a rate over unamended rows undercounts what it measures.
     */
    amends_seq: number | null;
}

/** The committed key set. AC-2 asserts a record's keys against exactly this. */
export const JOURNAL_RECORD_KEYS = Object.freeze([
    'seq',
    'event',
    'episode_id',
    'session_id',
    'task_id',
    'prompt_id',
    'boundary_status',
    'boundary_rule_version',
    'repository_id',
    'worktree_id',
    'at',
    'capability',
    'terminal_state',
    'return_ref',
    'verification_ref',
    'consumption',
    'retain_until',
    'amends_seq',
] as const);

type _KeysCoverTheRecord = Assert<
    Exclude<keyof JournalEvent, (typeof JOURNAL_RECORD_KEYS)[number]> extends never ? true : false
>;
type _KeysAddNothing = Assert<
    Exclude<(typeof JOURNAL_RECORD_KEYS)[number], keyof JournalEvent> extends never ? true : false
>;
type _RecordCarriesNoFreeFormField = Assert<[NoFreeForm<JournalEvent>] extends [never] ? false : true>;

// ---------------------------------------------------------------------------
// Retention records
// ---------------------------------------------------------------------------

export const RETENTION_KINDS = ['retention_hold', 'retention_release'] as const;
export type RetentionKind = (typeof RETENTION_KINDS)[number];

export const HOLD_SCOPES = ['episode', 'session'] as const;
export type HoldScope = (typeof HOLD_SCOPES)[number];

/**
 * One append-only retention record.
 *
 * `reason` is free text and is the one place in this module that holds any.
 * That is deliberate and bounded: it is human-authored, capped at 500
 * characters, lives in a table {@link NoFreeForm} does not govern, and exists
 * because a hold whose reason nobody wrote down is unreviewable. The EVENT
 * record — the one written on every hook invocation, at volume, by machinery —
 * carries none.
 */
export interface RetentionRecord {
    seq: number;
    kind: RetentionKind;
    scope: HoldScope;
    /** `episode_id` for an episode-scoped record, `session_id` for a session one. */
    scope_id: string;
    repository_id: string;
    created_at: string;
    /** Who created it. Must not name an agent — see the module docstring. */
    created_by: string;
    reason: string;
    retain_until: string;
}

/** Raised when a caller asks the journal to violate its own contract. */
export class JournalContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JournalContractError';
    }
}

// ---------------------------------------------------------------------------
// Value validation (the third privacy layer)
// ---------------------------------------------------------------------------

/** A bounded identifier: a hook or command name, never a sentence. */
const CAPABILITY_RE = /^[a-z0-9][a-z0-9._:-]{0,63}$/;
/** An opaque id: a uuid, a hash, a host token. Bounded and punctuation-poor. */
const OPAQUE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** Locators are repo-relative and short. 256 is generous for a path in-tree. */
const MAX_REF_LEN = 256;
/**
 * The shape {@link digest} produces: exactly twelve lower-case hex characters.
 *
 * `repository_id` and `worktree_id` are checked against this at write time.
 * They are derived internally today, so the check cannot fail from here — which
 * is the point: it is the value-level half of the no-absolute-path property,
 * and it fires the day someone hands the writer an id from somewhere else.
 */
const DIGEST_RE = /^[0-9a-f]{12}$/;

/**
 * Actor names that read as the agent rather than a human.
 *
 * Matched case-insensitively against the whole value and against a leading
 * `<word>:` prefix. See the module docstring for what this does and does not
 * guarantee.
 */
const AGENT_ACTOR_WORDS: ReadonlySet<string> = new Set([
    'agent',
    'ai',
    'assistant',
    'auto',
    'automation',
    'bot',
    'claude',
    'codex',
    'copilot',
    'cursor',
    'gemini',
    'hook',
    'llm',
    'model',
    'orchestrator',
    'subagent',
    'system',
]);

/** True when `actor` names an agent rather than a person. */
export function isAgentActor(actor: string): boolean {
    const v = actor.trim().toLowerCase();
    if (v === '') return true;
    if (AGENT_ACTOR_WORDS.has(v)) return true;
    const prefix = v.split(':', 1)[0] ?? '';
    return AGENT_ACTOR_WORDS.has(prefix);
}

/** True when `ref` is a safe repo-relative locator. */
export function isRepoRelativeRef(ref: string): boolean {
    if (ref === '' || ref.length > MAX_REF_LEN) return false;
    if (ref.startsWith('/') || ref.startsWith('\\')) return false;
    if (/^[A-Za-z]:[\\/]/.test(ref)) return false; // windows drive
    if (/[\u0000-\u001f]/.test(ref)) return false;
    if (ref.startsWith('~')) return false;
    const parts = ref.split(/[\\/]/);
    return !parts.includes('..');
}

function requireRef(name: string, ref: string | null | undefined): string | null {
    if (ref === null || ref === undefined) return null;
    if (!isRepoRelativeRef(ref)) {
        throw new JournalContractError(
            `${name} must be a repo-relative locator under ${MAX_REF_LEN} characters — ` +
                `refused ${JSON.stringify(ref.slice(0, 60))}. An absolute path names the machine ` +
                'that wrote the record, which is the privacy failure the schema exists to prevent.',
        );
    }
    return ref;
}

/** Refuse an identity value that is not a bounded digest. */
function requireDigest(name: string, value: string): string {
    if (!DIGEST_RE.test(value)) {
        throw new JournalContractError(
            `${name} must be a 12-character hex digest matching ${String(DIGEST_RE)} — refused ` +
                `${JSON.stringify(value.slice(0, 60))}. This field identifies a repository or a ` +
                'checkout; a path here would name the machine that wrote the record, which is the ' +
                'privacy failure the schema exists to prevent.',
        );
    }
    return value;
}

function requireId(name: string, id: string | null | undefined, optional: boolean): string | null {
    if (id === null || id === undefined || id === '') {
        if (optional) return null;
        throw new JournalContractError(`${name} is required and must be a non-empty opaque id.`);
    }
    if (!OPAQUE_ID_RE.test(id)) {
        throw new JournalContractError(
            `${name} must be a bounded opaque id matching ${String(OPAQUE_ID_RE)} — refused ` +
                `${JSON.stringify(id.slice(0, 60))}. Free text in an id field is content in disguise.`,
        );
    }
    return id;
}

// ---------------------------------------------------------------------------
// Location and repository_id (2.3)
// ---------------------------------------------------------------------------

export const JOURNAL_DIR_NAME = 'agent-journal';
export const JOURNAL_FILE_NAME = 'journal.sqlite';
/** The documented fallback path when no common git dir resolves. */
export const JOURNAL_FALLBACK_REL = path.join('agents', 'runtime', 'state', JOURNAL_FILE_NAME);

export interface JournalLocation {
    /** Absolute path to the database file. */
    readonly path: string;
    /**
     * `repo-shared` — under the common git dir, so every worktree of the repo
     * writes ONE database. `worktree-local` — the fallback, outside a repo.
     */
    readonly scope: 'repo-shared' | 'worktree-local';
    /** Why that scope was chosen. Never a silent default. */
    readonly reason: string;
    /** Digest of the common git dir — one value per repository. */
    readonly repository_id: string;
    /** Digest of the per-worktree git dir — one value per checkout. */
    readonly worktree_id: string;
}

/**
 * Twelve hex characters — citable in prose, and it carries no path.
 *
 * `domain` is not decoration: `repository_id` and `worktree_id` are digests of
 * the SAME directory in a main checkout, and two ids that collide on the
 * commonest layout would read as one concept wearing two names. Separating the
 * domains makes them differ everywhere, which is what lets a test assert the
 * two are distinct concepts rather than assert a coincidence.
 */
function digest(domain: string, input: string): string {
    return crypto.createHash('sha256').update(`${domain}\u0000${input}`).digest('hex').slice(0, 12);
}

/** Domain tags for {@link digest}. Distinct so the two ids never collide. */
const REPO_DOMAIN = 'agent-journal/repository';
const WORKTREE_DOMAIN = 'agent-journal/worktree';

/**
 * Where this root's journal lives, and the two identities its records carry.
 *
 * Both are resolved by `_lib/git_common_dir.ts` rather than by shelling out —
 * that module's own header records why: an inherited `GIT_DIR` silently
 * redirects `git` to the wrong repository inside a hook, and `rev-parse
 * --git-common-dir` prints a relative path from a main checkout and an absolute
 * one from a worktree, so the raw output is not comparable across checkouts.
 * The helper realpaths both, which is what makes one stable digest per
 * repository and one per checkout possible.
 *
 * - `repository_id` — digest of `git_common_dir(root)`, the directory every
 *   worktree of a repo shares. Same value from every checkout.
 * - `worktree_id` — digest of `git_dir(root)`: `.git` in a main checkout, the
 *   linked gitdir (`<common>/worktrees/<name>`) in a worktree. Different value
 *   for every checkout.
 *
 * Outside a git repository neither is resolvable from git, so both fall back to
 * the realpath of the root — which IS the checkout there — under their own
 * domains. That is reported through `scope` and `reason`, never silently.
 */
export function resolveJournal(root: string): JournalLocation {
    const common = git_common_dir(root);
    if (common !== null) {
        // `git_dir` resolves for any root `git_common_dir` resolved for; the
        // fallback keeps a degenerate layout writing a well-shaped id rather
        // than throwing on the hook path.
        const own = git_dir(root) ?? common;
        return {
            path: path.join(common, JOURNAL_DIR_NAME, JOURNAL_FILE_NAME),
            scope: 'repo-shared',
            reason: 'common git dir resolved — every worktree of this repo writes one database',
            repository_id: digest(REPO_DOMAIN, common),
            worktree_id: digest(WORKTREE_DOMAIN, own),
        };
    }
    let real = path.resolve(root);
    try {
        real = fs.realpathSync(real);
    } catch {
        /* keep the resolved form */
    }
    return {
        path: path.join(real, JOURNAL_FALLBACK_REL),
        scope: 'worktree-local',
        reason: 'no common git dir — not inside a git repository; falling back to the tree-local path',
        repository_id: digest(REPO_DOMAIN, real),
        worktree_id: digest(WORKTREE_DOMAIN, real),
    };
}

/**
 * A cache key for a derived episode PROJECTION — repository_id plus branch.
 *
 * Deliberately NOT a record field: the repository_id is branch-independent by
 * construction, which is the property that lets two branches of one repo share
 * a journal. A projection built while on one branch must not be silently reused
 * on another, so the invalidation lives on the projection key rather than on
 * the records it is derived from. Records stay append-only.
 */
export function projectionKey(root: string): string {
    const { repository_id } = resolveJournal(root);
    const branch = current_branch(root);
    return `${repository_id}:${branch ?? 'detached'}`;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface JournalHandle {
    readonly db: DatabaseSync;
    readonly location: JournalLocation;
    close(): void;
}

function createSchema(db: DatabaseSync): void {
    // WAL is what lets a second process write while a first one is mid-write;
    // busy_timeout is what turns the residual lock contention into a wait
    // rather than an immediate SQLITE_BUSY. Both are load-bearing for 1.3, and
    // neutralising either one is what makes that test go red.
    // ORDER IS LOAD-BEARING, and the WAL transition needs more than ordering.
    // `busy_timeout` comes FIRST so every statement after it waits instead of
    // failing. It is not enough on its own: `PRAGMA journal_mode = WAL` takes
    // an exclusive lock and does NOT invoke the busy handler, so it returns
    // SQLITE_BUSY immediately when a second process is opening the same fresh
    // database. Measured, not predicted — the two-process test failed on that
    // exact line with the timeout already set. ensureWal() carries the bounded
    // retry the PRAGMA will not do for itself.
    db.exec('PRAGMA busy_timeout = 5000');
    ensureWal(db);
    db.exec('PRAGMA synchronous = NORMAL');
    db.exec(
        `CREATE TABLE IF NOT EXISTS journal_event (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT NOT NULL,
            episode_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            task_id TEXT,
            prompt_id TEXT,
            boundary_status TEXT NOT NULL,
            boundary_rule_version INTEGER NOT NULL,
            repository_id TEXT NOT NULL,
            worktree_id TEXT NOT NULL,
            at TEXT NOT NULL,
            capability TEXT NOT NULL,
            terminal_state TEXT,
            return_ref TEXT,
            verification_ref TEXT,
            consumption TEXT,
            retain_until TEXT NOT NULL,
            amends_seq INTEGER
        )`,
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_event_episode ON journal_event(repository_id, episode_id, seq)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_event_session ON journal_event(repository_id, session_id, seq)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_event_task ON journal_event(repository_id, task_id)');
    // The worktree attribution the single-id schema could not express. Indexed
    // because "which checkout produced these records" is the question the field
    // was added to answer, and an unindexed answer is a table scan.
    db.exec('CREATE INDEX IF NOT EXISTS idx_event_worktree ON journal_event(repository_id, worktree_id, seq)');
    db.exec(
        `CREATE TABLE IF NOT EXISTS retention_record (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            scope TEXT NOT NULL,
            scope_id TEXT NOT NULL,
            repository_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL,
            reason TEXT NOT NULL,
            retain_until TEXT NOT NULL
        )`,
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_hold_scope ON retention_record(repository_id, scope, scope_id, seq)');
}

/**
 * Is this failure lock contention rather than corruption?
 *
 * `node:sqlite` surfaces `errcode` (5 = SQLITE_BUSY, 6 = SQLITE_LOCKED) on the
 * thrown error; the message check is the fallback for a runtime that does not.
 * The distinction is load-bearing: a rebuild path that fires on contention
 * deletes healthy records belonging to another process.
 */
function isBusyError(exc: unknown): boolean {
    const e = exc as { errcode?: unknown; code?: unknown; message?: unknown };
    if (e?.errcode === 5 || e?.errcode === 6) return true;
    if (typeof e?.code === 'string' && /BUSY|LOCKED/i.test(e.code)) return true;
    return typeof e?.message === 'string' && /database is locked|database table is locked|busy/i.test(e.message);
}

/** Synchronous sleep. The Class-A path is sync end to end; no event loop here. */
function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** The current persisted journal mode, lower-cased. A read; takes no lock. */
function journalMode(db: DatabaseSync): string {
    const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode?: unknown } | undefined;
    return String(row?.journal_mode ?? '').toLowerCase();
}

/**
 * Put the database in WAL, retrying while another process holds the lock.
 *
 * The transition is one-time — the mode is persisted in the file header — so
 * after the first successful call every later opener reads `wal` and returns
 * without touching a lock at all. Only the opening race pays the retry.
 */
function ensureWal(db: DatabaseSync): void {
    const deadline = Date.now() + 5000;
    for (;;) {
        if (journalMode(db) === 'wal') return;
        try {
            db.exec('PRAGMA journal_mode = WAL');
            if (journalMode(db) === 'wal') return;
        } catch (exc) {
            if (!isBusyError(exc)) throw exc;
        }
        if (Date.now() >= deadline) {
            throw new JournalContractError(
                'could not switch the journal into WAL mode within 5s — another process holds the ' +
                    'database lock. The journal is unavailable; degrade rather than failing the hook.',
            );
        }
        sleepSync(15);
    }
}

function discard(dbPath: string): void {
    for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
        try {
            fs.rmSync(p, { force: true });
        } catch {
            /* best-effort */
        }
    }
}

/**
 * Open (creating on first write) the journal for `root`.
 *
 * Throws {@link JournalContractError} when `node:sqlite` is unavailable —
 * callers on the hook path should probe {@link isJournalAvailable} first and
 * degrade rather than failing the hook. A journal that cannot be written is a
 * degraded state to report, never a reason to break the run that reports it.
 */
export function openJournal(root: string): JournalHandle {
    if (!isSqliteAvailableSync()) {
        throw new JournalContractError(
            'node:sqlite is unavailable in this runtime — the journal cannot be opened. ' +
                'Probe isJournalAvailable() and degrade instead of failing the hook.',
        );
    }
    const location = resolveJournal(root);
    fs.mkdirSync(path.dirname(location.path), { recursive: true });
    const { DatabaseSync } = loadSqliteSync('runtime_journal');

    if (fs.existsSync(location.path)) {
        let drift = false;
        let probe: DatabaseSync | null = null;
        try {
            probe = new DatabaseSync(location.path);
            probe.exec('PRAGMA busy_timeout = 5000');
            const v = readUserVersion(probe);
            drift = v !== 0 && v !== JOURNAL_SCHEMA_VERSION;
        } catch (exc) {
            // A LOCKED database is not a corrupt one. Treating contention as
            // corruption here made the version probe destroy a concurrent
            // writer's records — measured, not predicted: the two-process test
            // reported both writers exiting 0 and only one writer's 120 events
            // surviving, because the loser's probe threw SQLITE_BUSY and this
            // branch then called discard() on a healthy database. Only a
            // genuinely unreadable file is rebuilt; a busy one is left alone.
            drift = !isBusyError(exc);
        } finally {
            try {
                probe?.close();
            } catch {
                /* best-effort */
            }
        }
        if (drift) discard(location.path);
    }

    const db = new DatabaseSync(location.path);
    createSchema(db);
    stampUserVersion(db, JOURNAL_SCHEMA_VERSION);
    return {
        db,
        location,
        close(): void {
            try {
                db.close();
            } catch {
                /* best-effort */
            }
        },
    };
}

/** Non-throwing probe: can a journal be opened in this runtime at all? */
export function isJournalAvailable(): boolean {
    return isSqliteAvailableSync();
}

/** Open, run, close. The Class-A shape: start, write, exit. */
export function withJournal<T>(root: string, fn: (h: JournalHandle) => T): T {
    const h = openJournal(root);
    try {
        return fn(h);
    } finally {
        h.close();
    }
}

// ---------------------------------------------------------------------------
// Boundary derivation (2.1) and writing (1.1, 1.2)
// ---------------------------------------------------------------------------

export interface BoundaryDecision {
    readonly episode_id: string;
    readonly boundary_status: BoundaryStatus;
    readonly boundary_rule_version: number;
}

/**
 * Rule v1, stated once so both the writer and any later reconstruction can cite
 * the same version.
 *
 * - An explicit `episode_id` from the envelope wins -> `explicit`.
 * - Else a `task_id` derives one -> `derived`. The FIRST event carrying that
 *   task id therefore opens the episode, which is the council's adopted rule.
 * - Else the session is the fallback key -> `session_fallback`, marked.
 */
export function deriveBoundary(input: {
    repository_id: string;
    session_id: string;
    task_id?: string | null;
    episode_id?: string | null;
}): BoundaryDecision {
    if (input.episode_id !== null && input.episode_id !== undefined && input.episode_id !== '') {
        return {
            episode_id: input.episode_id,
            boundary_status: 'explicit',
            boundary_rule_version: BOUNDARY_RULE_VERSION,
        };
    }
    if (input.task_id !== null && input.task_id !== undefined && input.task_id !== '') {
        return {
            episode_id: `ep-${digest('agent-journal/episode', `${input.repository_id} task ${input.task_id}`)}`,
            boundary_status: 'derived',
            boundary_rule_version: BOUNDARY_RULE_VERSION,
        };
    }
    return {
        episode_id: `sess-${digest('agent-journal/session', `${input.repository_id} session ${input.session_id}`)}`,
        boundary_status: 'session_fallback',
        boundary_rule_version: BOUNDARY_RULE_VERSION,
    };
}

export interface RecordEventInput {
    event: string;
    session_id: string;
    capability: string;
    task_id?: string | null;
    prompt_id?: string | null;
    episode_id?: string | null;
    terminal_state?: TerminalState | null;
    return_ref?: string | null;
    verification_ref?: string | null;
    consumption?: Consumption | null;
    /**
     * The `seq` this event amends. Omit for an original observation.
     * See {@link JournalEvent.amends_seq} for why an amendment is a new row.
     */
    amends_seq?: number | null;
    /** ISO instant; defaults to now. Injectable so tests are deterministic. */
    at?: string;
}

/** Append one event. Returns the record as written, `seq` included. */
export function recordEvent(h: JournalHandle, input: RecordEventInput): JournalEvent {
    if (!RECORDED_EVENTS.has(input.event)) {
        const why = NOT_RECORDED.get(input.event);
        throw new JournalContractError(
            why === undefined
                ? `unknown event ${JSON.stringify(input.event)} — not a member of the recorded set. ` +
                  'Add it to RECORDED_EVENTS or to NOT_RECORDED with a reason; silence is not coverage.'
                : `event ${JSON.stringify(input.event)} is deliberately not recorded: ${why}`,
        );
    }
    if (!CAPABILITY_RE.test(input.capability)) {
        throw new JournalContractError(
            `capability must be a bounded identifier matching ${String(CAPABILITY_RE)} — refused ` +
                `${JSON.stringify(input.capability.slice(0, 60))}. This field names a hook or a ` +
                'command; free text here is a content field wearing an identifier name.',
        );
    }
    const session_id = requireId('session_id', input.session_id, false) as string;
    const task_id = requireId('task_id', input.task_id, true);
    const prompt_id = requireId('prompt_id', input.prompt_id, true);
    const explicit = requireId('episode_id', input.episode_id, true);

    if (
        input.terminal_state !== null &&
        input.terminal_state !== undefined &&
        !(TERMINAL_STATES as readonly string[]).includes(input.terminal_state)
    ) {
        throw new JournalContractError(
            `terminal_state ${JSON.stringify(input.terminal_state)} is not one of the six.`,
        );
    }
    if (
        input.consumption !== null &&
        input.consumption !== undefined &&
        !(CONSUMPTION_STATES as readonly string[]).includes(input.consumption)
    ) {
        throw new JournalContractError(`consumption ${JSON.stringify(input.consumption)} is not a known state.`);
    }

    const at = input.at ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(at))) {
        throw new JournalContractError(`at ${JSON.stringify(at)} is not an ISO-8601 instant.`);
    }
    const repository_id = requireDigest('repository_id', h.location.repository_id);
    const worktree_id = requireDigest('worktree_id', h.location.worktree_id);
    const boundary = deriveBoundary({ repository_id, session_id, task_id, episode_id: explicit });
    const retain_until = new Date(Date.parse(at) + RETENTION_TTL_DAYS * DAY_MS).toISOString();

    const row: Omit<JournalEvent, 'seq'> = {
        event: input.event,
        episode_id: boundary.episode_id,
        session_id,
        task_id,
        prompt_id,
        boundary_status: boundary.boundary_status,
        boundary_rule_version: boundary.boundary_rule_version,
        repository_id,
        worktree_id,
        at,
        capability: input.capability,
        terminal_state: input.terminal_state ?? null,
        return_ref: requireRef('return_ref', input.return_ref),
        verification_ref: requireRef('verification_ref', input.verification_ref),
        consumption: input.consumption ?? null,
        retain_until,
        amends_seq: input.amends_seq ?? null,
    };

    h.db
        .prepare(
            `INSERT INTO journal_event
             (event, episode_id, session_id, task_id, prompt_id, boundary_status,
              boundary_rule_version, repository_id, worktree_id, at, capability,
              terminal_state, return_ref, verification_ref, consumption, retain_until,
              amends_seq)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            row.event,
            row.episode_id,
            row.session_id,
            row.task_id,
            row.prompt_id,
            row.boundary_status,
            row.boundary_rule_version,
            row.repository_id,
            row.worktree_id,
            row.at,
            row.capability,
            row.terminal_state,
            row.return_ref,
            row.verification_ref,
            row.consumption,
            row.retain_until,
            row.amends_seq,
        );
    const seqRow = h.db.prepare('SELECT last_insert_rowid() AS seq').get() as { seq: number | bigint };
    return { seq: Number(seqRow.seq), ...row };
}

function toEvent(r: Record<string, unknown>): JournalEvent {
    return {
        seq: Number(r['seq']),
        event: String(r['event']),
        episode_id: String(r['episode_id']),
        session_id: String(r['session_id']),
        task_id: (r['task_id'] as string | null) ?? null,
        prompt_id: (r['prompt_id'] as string | null) ?? null,
        boundary_status: String(r['boundary_status']) as BoundaryStatus,
        boundary_rule_version: Number(r['boundary_rule_version']),
        repository_id: String(r['repository_id']),
        worktree_id: String(r['worktree_id']),
        at: String(r['at']),
        capability: String(r['capability']),
        terminal_state: (r['terminal_state'] as TerminalState | null) ?? null,
        return_ref: (r['return_ref'] as string | null) ?? null,
        verification_ref: (r['verification_ref'] as string | null) ?? null,
        consumption: (r['consumption'] as Consumption | null) ?? null,
        retain_until: String(r['retain_until']),
        amends_seq: r['amends_seq'] === null || r['amends_seq'] === undefined ? null : Number(r['amends_seq']),
    };
}

/** Every event of one episode, in write order. */
export function readEpisodeEvents(h: JournalHandle, episode_id: string, repository_id?: string): JournalEvent[] {
    const ns = repository_id ?? h.location.repository_id;
    const rows = h.db
        .prepare('SELECT * FROM journal_event WHERE repository_id = ? AND episode_id = ? ORDER BY seq')
        .all(ns, episode_id) as Record<string, unknown>[];
    return rows.map(toEvent);
}

/** Every event of one repository_id, in write order. */
export function readAllEvents(h: JournalHandle, repository_id?: string): JournalEvent[] {
    const ns = repository_id ?? h.location.repository_id;
    const rows = h.db
        .prepare('SELECT * FROM journal_event WHERE repository_id = ? ORDER BY seq')
        .all(ns) as Record<string, unknown>[];
    return rows.map(toEvent);
}

// ---------------------------------------------------------------------------
// Episode reconstruction (2.2)
// ---------------------------------------------------------------------------

/**
 * One episode, rebuilt from the journal alone.
 *
 * Every nullable field is either non-null or named in {@link
 * EpisodeReconstruction.absent}. A reader can therefore tell "not recorded"
 * from "recorded as nothing", which is the distinction a reconstruction with
 * in-memory help never has to make and one without it must.
 */
export interface EpisodeReconstruction {
    repository_id: string;
    episode_id: string;
    boundary_status: BoundaryStatus;
    boundary_rule_version: number;
    session_ids: string[];
    /**
     * Every checkout that contributed an event, in first-seen order. An episode
     * spanning two worktrees lists both — the attribution a single repository
     * id cannot give, surfaced where a reconstruction reader needs it.
     */
    worktree_ids: string[];
    task_id: string | null;
    prompt_id: string | null;
    opened_at: string;
    opened_by: { seq: number; event: string; capability: string };
    closed_at: string | null;
    terminal_state: TerminalState | null;
    return_ref: string | null;
    verification_ref: string | null;
    consumption: Consumption | null;
    capabilities: string[];
    /**
     * How many rows in this episode were superseded by a later amendment.
     *
     * Reported rather than hidden: a projection that silently differs from the
     * raw rows is the shape a reader cannot audit, and this number is how they
     * tell "the store says X" from "the store's latest word is X".
     */
    amendment_count: number;
    events: JournalEvent[];
    retain_until: string;
    /** Names of the nullable fields that are genuinely absent. */
    absent: string[];
}

/** The nullable fields of a reconstruction, so a test can enumerate them. */
export const RECONSTRUCTION_NULLABLE_FIELDS = [
    'task_id',
    'prompt_id',
    'closed_at',
    'terminal_state',
    'return_ref',
    'verification_ref',
    'consumption',
] as const;

/**
 * Rebuild one episode from stored records, with no in-memory state.
 *
 * Returns `null` when the episode has no records at all — an absent episode is
 * reported as absent, never as an empty success.
 */
export function reconstructEpisode(
    h: JournalHandle,
    episode_id: string,
    repository_id?: string,
): EpisodeReconstruction | null {
    const events = readEpisodeEvents(h, episode_id, repository_id);
    if (events.length === 0) return null;
    const first = events[0]!;

    // Amendment folding. `events` is returned WHOLE and untouched -- every
    // original row is still there, byte-identical, which is the property the
    // append-only store exists to guarantee. What the projection does is
    // decide which rows are still EFFECTIVE.
    const amended = new Set<number>();
    for (const e of events) {
        if (e.amends_seq !== null) amended.add(e.amends_seq);
    }
    const effective = events.filter((e) => !amended.has(e.seq));

    // LAST terminal state, not the first. This is the line the amendment path
    // exists for: an outcome that arrives after the episode closed is the whole
    // point, and `find` would have kept returning the superseded verdict
    // forever while the amendment sat in the table unread.
    let closing: JournalEvent | null = null;
    for (let i = effective.length - 1; i >= 0; i -= 1) {
        if (effective[i]!.terminal_state !== null) {
            closing = effective[i]!;
            break;
        }
    }

    const latest = <K extends keyof JournalEvent>(k: K): JournalEvent[K] | null => {
        for (let i = effective.length - 1; i >= 0; i -= 1) {
            const v = effective[i]![k];
            if (v !== null && v !== undefined) return v;
        }
        return null;
    };

    const out: EpisodeReconstruction = {
        repository_id: first.repository_id,
        episode_id: first.episode_id,
        boundary_status: first.boundary_status,
        boundary_rule_version: first.boundary_rule_version,
        session_ids: [...new Set(events.map((e) => e.session_id))],
        worktree_ids: [...new Set(events.map((e) => e.worktree_id))],
        task_id: (latest('task_id') as string | null) ?? null,
        prompt_id: (latest('prompt_id') as string | null) ?? null,
        opened_at: first.at,
        opened_by: { seq: first.seq, event: first.event, capability: first.capability },
        closed_at: closing?.at ?? null,
        terminal_state: closing?.terminal_state ?? null,
        return_ref: (latest('return_ref') as string | null) ?? null,
        verification_ref: (latest('verification_ref') as string | null) ?? null,
        consumption: (latest('consumption') as Consumption | null) ?? null,
        capabilities: [...new Set(events.map((e) => e.capability))],
        /** How many rows in this episode were superseded by an amendment. */
        amendment_count: amended.size,
        events,
        retain_until: events[events.length - 1]!.retain_until,
        absent: [],
    };
    out.absent = RECONSTRUCTION_NULLABLE_FIELDS.filter((k) => out[k] === null);
    return out;
}

// ---------------------------------------------------------------------------
// Retention: holds, anchors, pruning
// ---------------------------------------------------------------------------

export interface CreateHoldInput {
    scope: HoldScope;
    scope_id: string;
    /** MUST NOT name an agent. See the module docstring's honest limit. */
    created_by: string;
    reason: string;
    /** ISO instant; defaults to `at` + {@link HOLD_DEFAULT_DAYS}. */
    retain_until?: string;
    at?: string;
}

function insertRetention(h: JournalHandle, rec: Omit<RetentionRecord, 'seq'>): RetentionRecord {
    h.db
        .prepare(
            `INSERT INTO retention_record
             (kind, scope, scope_id, repository_id, created_at, created_by, reason, retain_until)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            rec.kind,
            rec.scope,
            rec.scope_id,
            rec.repository_id,
            rec.created_at,
            rec.created_by,
            rec.reason,
            rec.retain_until,
        );
    const seqRow = h.db.prepare('SELECT last_insert_rowid() AS seq').get() as { seq: number | bigint };
    return { seq: Number(seqRow.seq), ...rec };
}

/**
 * Create a hold. Human callers only, and a mis-derived boundary widens.
 *
 * Returns one record per hold written — an episode-only hold on a `derived` or
 * `session_fallback` episode widens to its containing session(s), so an episode
 * spanning two sessions produces two records rather than one hold that silently
 * covers the wrong set.
 */
export function createHold(h: JournalHandle, input: CreateHoldInput): RetentionRecord[] {
    if (isAgentActor(input.created_by)) {
        throw new JournalContractError(
            `created_by ${JSON.stringify(input.created_by)} names an agent. Only a human may set a ` +
                'retention hold: an agent that can hold its own episodes can defeat retention, and it ' +
                'need not do so deliberately. (This is a refusal at the API surface, not an ' +
                'authorization boundary — see the module docstring.)',
        );
    }
    const reason = input.reason.trim();
    if (reason === '') {
        throw new JournalContractError('a hold requires a reason — a hold nobody explained is unreviewable.');
    }
    if (!(HOLD_SCOPES as readonly string[]).includes(input.scope)) {
        throw new JournalContractError(`unknown hold scope ${JSON.stringify(input.scope)}.`);
    }
    const created_at = input.at ?? new Date().toISOString();
    const retain_until =
        input.retain_until ?? new Date(Date.parse(created_at) + HOLD_DEFAULT_DAYS * DAY_MS).toISOString();
    if (Date.parse(retain_until) <= Date.parse(created_at)) {
        throw new JournalContractError('retain_until must be after created_at — holds expire too.');
    }
    const ns = h.location.repository_id;
    const base = {
        kind: 'retention_hold' as const,
        repository_id: ns,
        created_at,
        created_by: input.created_by.trim(),
        reason: reason.slice(0, 500),
        retain_until,
    };

    if (input.scope === 'session') {
        return [insertRetention(h, { ...base, scope: 'session', scope_id: input.scope_id })];
    }

    const events = readEpisodeEvents(h, input.scope_id, ns);
    if (events.length === 0) {
        throw new JournalContractError(
            `no records for episode ${JSON.stringify(input.scope_id)} — refusing to hold an episode ` +
                'that does not exist, because its boundary provenance cannot be checked.',
        );
    }
    if (events[0]!.boundary_status === 'explicit') {
        return [insertRetention(h, { ...base, scope: 'episode', scope_id: input.scope_id })];
    }
    // Widen. Council 2026-08-28: a hold makes a mis-derived boundary durable,
    // so a boundary the rule DERIVED never carries an episode-only hold.
    const sessions = [...new Set(events.map((e) => e.session_id))];
    const widened =
        `${base.reason} [widened from episode ${input.scope_id}: ` +
        `boundary_status=${events[0]!.boundary_status}]`;
    return sessions.map((s) =>
        insertRetention(h, { ...base, reason: widened.slice(0, 500), scope: 'session', scope_id: s }),
    );
}

/** Release a hold — an append-only counter-record, never a delete. */
export function releaseHold(
    h: JournalHandle,
    input: { scope: HoldScope; scope_id: string; created_by: string; reason: string; at?: string },
): RetentionRecord {
    if (isAgentActor(input.created_by)) {
        throw new JournalContractError(
            `created_by ${JSON.stringify(input.created_by)} names an agent — releases are human-only too.`,
        );
    }
    const created_at = input.at ?? new Date().toISOString();
    return insertRetention(h, {
        kind: 'retention_release',
        scope: input.scope,
        scope_id: input.scope_id,
        repository_id: h.location.repository_id,
        created_at,
        created_by: input.created_by.trim(),
        reason: input.reason.trim().slice(0, 500) || 'released',
        retain_until: created_at,
    });
}

/** Every retention record for one scope id, in write order. */
export function readRetention(h: JournalHandle, scope: HoldScope, scope_id: string): RetentionRecord[] {
    const rows = h.db
        .prepare('SELECT * FROM retention_record WHERE repository_id = ? AND scope = ? AND scope_id = ? ORDER BY seq')
        .all(h.location.repository_id, scope, scope_id) as Record<string, unknown>[];
    return rows.map((r) => ({
        seq: Number(r['seq']),
        kind: String(r['kind']) as RetentionKind,
        scope: String(r['scope']) as HoldScope,
        scope_id: String(r['scope_id']),
        repository_id: String(r['repository_id']),
        created_at: String(r['created_at']),
        created_by: String(r['created_by']),
        reason: String(r['reason']),
        retain_until: String(r['retain_until']),
    }));
}

/** True when an unreleased, unexpired hold covers this scope id at `now`. */
export function isHeld(h: JournalHandle, scope: HoldScope, scope_id: string, now: string): boolean {
    const t = Date.parse(now);
    let held = false;
    for (const r of readRetention(h, scope, scope_id)) {
        held = r.kind === 'retention_hold' ? Date.parse(r.retain_until) > t : false;
    }
    return held;
}

export type AnchorVia = 'episode_closed_at' | 'session_end' | 'inactivity' | 'active';

export interface EpisodeAnchor {
    readonly via: AnchorVia;
    /** Null when the episode is still live and therefore has no expiry yet. */
    readonly anchor: string | null;
}

/**
 * Resolve the retention anchor for one episode — council constraint 1's ladder.
 *
 * `episode_closed_at` (the first event carrying a terminal state) -> the
 * episode's `session_end` event -> the last event, but only once it is past
 * {@link INACTIVITY_ANCHOR_MS}. A live episode has no anchor, and therefore no
 * expiry: a TTL anchored on WRITE rather than close would expire an episode
 * that is still running, which is the failure the ladder exists to prevent.
 *
 * `retain_until` on the record is the provisional per-record floor written at
 * insert time, when the anchor is by definition not yet known. This function is
 * the authoritative expiry and {@link pruneExpired} uses it.
 */
export function episodeAnchor(h: JournalHandle, episode_id: string, now: string): EpisodeAnchor {
    const events = readEpisodeEvents(h, episode_id);
    if (events.length === 0) return { via: 'active', anchor: null };
    const closed = events.find((e) => e.terminal_state !== null);
    if (closed !== undefined) return { via: 'episode_closed_at', anchor: closed.at };
    const ended = events.find((e) => e.event === 'session_end');
    if (ended !== undefined) return { via: 'session_end', anchor: ended.at };
    const last = events[events.length - 1]!;
    if (Date.parse(now) - Date.parse(last.at) >= INACTIVITY_ANCHOR_MS) {
        return { via: 'inactivity', anchor: last.at };
    }
    return { via: 'active', anchor: null };
}

/** The effective expiry for one episode, or null while it is live. */
export function effectiveExpiry(h: JournalHandle, episode_id: string, now: string): string | null {
    const { anchor } = episodeAnchor(h, episode_id, now);
    if (anchor === null) return null;
    return new Date(Date.parse(anchor) + RETENTION_TTL_DAYS * DAY_MS).toISOString();
}

export interface PruneReport {
    readonly examined: number;
    readonly deleted_episodes: string[];
    readonly deleted_events: number;
    readonly held_episodes: string[];
    readonly live_episodes: string[];
}

/**
 * Delete every episode past its effective expiry and not covered by a hold.
 *
 * Reports what it kept and why, so a reader can tell "retained on purpose" from
 * "not yet expired" without re-deriving the ladder.
 */
export function pruneExpired(h: JournalHandle, now: string = new Date().toISOString()): PruneReport {
    const ns = h.location.repository_id;
    const rows = h.db
        .prepare('SELECT DISTINCT episode_id, session_id FROM journal_event WHERE repository_id = ?')
        .all(ns) as { episode_id: string; session_id: string }[];
    const deleted_episodes: string[] = [];
    const held_episodes: string[] = [];
    const live_episodes: string[] = [];
    let deleted_events = 0;
    for (const { episode_id, session_id } of rows) {
        const expiry = effectiveExpiry(h, episode_id, now);
        if (expiry === null || Date.parse(expiry) > Date.parse(now)) {
            live_episodes.push(episode_id);
            continue;
        }
        if (isHeld(h, 'episode', episode_id, now) || isHeld(h, 'session', session_id, now)) {
            held_episodes.push(episode_id);
            continue;
        }
        const before = readEpisodeEvents(h, episode_id).length;
        h.db.prepare('DELETE FROM journal_event WHERE repository_id = ? AND episode_id = ?').run(ns, episode_id);
        deleted_events += before;
        deleted_episodes.push(episode_id);
    }
    return { examined: rows.length, deleted_episodes, deleted_events, held_episodes, live_episodes };
}
