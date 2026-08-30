/**
 * The host-emitted-event denominator — a typed, privacy-bounded count
 * reconstructed from a HOST-authored artefact.
 *
 * `road-to-journal-host-capture-measurement` Phase 2 step 2.1 and AC-2. The
 * survey of step 1.1
 * (`agents/evidence/analysis/host-denominator-obtainability-2026-08-29.md`)
 * established that exactly six `(platform, event)` cells carry an obtainable
 * host denominator, all on `claude`, all reconstructable from the per-session
 * transcript Claude Code writes at
 * `~/.claude/projects/<project-slug>/<session-id>.jsonl`.
 *
 * ## Why this module exists rather than a one-off script
 *
 * AC-2 requires the denominator's record type to be *asserted against a
 * committed key set, with a free-form write failing to type-check* — the same
 * privacy property `_lib/runtime_journal.ts` carries for the numerator. A
 * denominator computed inline in a script has no record type to assert, so the
 * two halves of the capture rate would have been held to different standards.
 * They are held to the same one here: {@link DENOMINATOR_RECORD_KEYS} is bound
 * to {@link HostDenominator} in both directions, and the record is passed
 * through the journal's own `NoFreeForm` guard rather than a local copy of it.
 *
 * ## The scope must match the numerator's, and v1 did not — R2 finding 1
 *
 * The numerator is ONE repository's journal (`<git-common-dir>/agent-journal/`,
 * shared across that repository's worktrees and reaching nothing else). v1 of
 * this module walked every project directory on the machine, so the ratio was
 * over two different populations. It was invisible in the first published run
 * only because the numerator was `store-absent`, and the evidence page's own
 * `Revisit-if` told the next reader to re-run the script on a machine where it
 * would not have been.
 *
 * {@link DenominatorScope} makes the scope an explicit, recorded field, and
 * `repository` is the default: a rate needs one population, and the numerator's
 * is the one that cannot be widened. `machine` remains available because a
 * machine-wide denominator is a legitimate *different* figure — it just may
 * never be divided by a repository-scoped numerator.
 *
 * ## The reconstruction is a stated rule set, not a heuristic
 *
 * {@link RECONSTRUCTION_RULE_VERSION} pins the rules, and the pinning matters:
 * a denominator whose derivation can be adjusted after the numerator is known
 * is not a denominator. v2 states two rules v1 left implicit — the sidechain
 * treatment of *assistant* records, which governs 97 % of the count, and the
 * direction in which the `session_start` rule fails.
 *
 * ## What this module refuses to count, and why that is the interesting half
 *
 * `stop` is journal-bound on `claude` and would widen the measurement from
 * five journal-bound cells to six. Three candidate denominators for it were
 * examined and **all three are refused**; {@link STOP_CANDIDATES} records them
 * with the reading that refuses each, and they disagree by a factor of about 44
 * (305 / 7). A `stop` denominator chosen from among three mutually inconsistent
 * candidates would be a number with a footnote where the footnote is
 * load-bearing.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

import type { NoFreeForm } from './runtime_journal.js';

type Assert<T extends true> = T;

/**
 * Bumped whenever any rule in {@link RECONSTRUCTION_RULES} changes. A published
 * rate cites this number, so a later reader can tell a re-measurement from a
 * re-derivation.
 *
 * - **v1** (2026-08-29) — the 1.1 survey's four rules plus the `isMeta` and
 *   `isSidechain` refinements on `user` records.
 * - **v2** (2026-08-29, after R2 review) — states the sidechain rule for
 *   *assistant* records, which v1 left implicit while it governed 97 % of the
 *   count; states the direction in which the `session_start` rule fails; and
 *   takes `first_at` as the MINIMUM timestamp rather than the first one in file
 *   order.
 */
export const RECONSTRUCTION_RULE_VERSION = 2;

/**
 * Which population the denominator is over.
 *
 * `repository` — only transcripts whose project directory belongs to the
 * measured repository or one of its worktrees. This is the scope the
 * repository-scoped journal numerator can actually reach, and it is the default
 * for that reason.
 *
 * `machine` — every transcript on the machine. A legitimate figure about the
 * host, and NOT divisible by a repository-scoped numerator.
 */
export const DENOMINATOR_SCOPES = ['repository', 'machine'] as const;
export type DenominatorScope = (typeof DENOMINATOR_SCOPES)[number];

/**
 * The six `(claude, event)` cells the 1.1 survey found `counted`. This is the
 * measurement's scope and no more: a rate over six of 43 bound cells is a
 * different claim from a rate over all of them.
 */
export const COUNTED_EVENTS = [
    'session_start',
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
    'subagent_start',
    'subagent_stop',
] as const;

export type CountedEvent = (typeof COUNTED_EVENTS)[number];

/**
 * Of the six, the five where `journal-record` is actually bound in
 * `src/scripts/hook_manifest.yaml` on the `claude` platform.
 *
 * `pre_tool_use` is the omission and it is deliberate rather than an oversight
 * to be corrected here: that slot carries the safety guards, and the journal is
 * not among them. Its numerator is therefore zero **by construction**, which is
 * a different fact from zero-because-nothing-fired, and the published table
 * separates the two instead of averaging them into one rate.
 */
export const JOURNAL_BOUND_COUNTED_EVENTS = [
    'session_start',
    'user_prompt_submit',
    'post_tool_use',
    'subagent_start',
    'subagent_stop',
] as const;

type _BoundIsSubsetOfCounted = Assert<
    Exclude<(typeof JOURNAL_BOUND_COUNTED_EVENTS)[number], CountedEvent> extends never ? true : false
>;

/** Human-readable statement of every rule the reconstruction applies. */
export const RECONSTRUCTION_RULES: Readonly<Record<string, string>> = Object.freeze({
    session_start:
        'One per transcript file. NOT an iff, and v1 claimed it was: the host fires `SessionStart` again on resume, clear and compact while a resumed session appends to the SAME file (under-count), and a compacted or forked session can produce a SECOND file for one logical session (over-count on the population side). Both directions are present and neither is corrected, so this cell is the least precise of the six and the population figure derived from it inherits that.',
    user_prompt_submit:
        'A `type: "user"` record carrying no `tool_result` content block. REFINEMENT 1: records with `isMeta: true` are excluded — an injected system reminder is not a user prompt submit. REFINEMENT 2: records with `isSidechain: true` are excluded — a subagent brief does not fire the host event in the parent session. The two exclusion counters are INDEPENDENT: a record carrying both flags increments both, so they may sum to more than the number of records excluded.',
    pre_tool_use:
        'One per `tool_use` content block in a `type: "assistant"` record. Sidechain records ARE INCLUDED — a subagent tool call fires the parent session tool hooks — and the sidechain share is counted separately in `sidechain_tool_use_blocks` so a reader who disagrees can subtract it. v1 left this rule unstated while it governed about 97 % of the six-cell total, which is why it is written here rather than inferred from the code.',
    post_tool_use:
        'One per `tool_use` content block in a `type: "assistant"` record. Same sidechain treatment, same separately-published share.',
    subagent_start:
        'One per `tool_use` content block whose `name` is `Agent` or `Task`. A subset of the tool_use blocks, and a distinct host event. Sidechain-nested spawns are included and counted in `sidechain_agent_tool_use_blocks`.',
    subagent_stop:
        'One per `tool_use` content block whose `name` is `Agent` or `Task`. Same treatment as `subagent_start`.',
});

/**
 * The three refused candidates for a `stop` denominator, each with the reading
 * that refuses it. Kept in code rather than only in prose so a later attempt
 * meets the measurement before it meets the idea.
 *
 * All three readings are from one transcript,
 * `b818ccad-3581-4773-b9a2-c7272af04ce2`, and they disagree by a factor of
 * about 44 (305 / 7 = 43.6).
 */
export const STOP_CANDIDATES: readonly Readonly<{
    candidate: string;
    reading: number;
    refused_because: string;
}>[] = Object.freeze([
    Object.freeze({
        candidate: 'assistant records carrying a `stop_reason`',
        reading: 305,
        refused_because:
            'counts assistant MESSAGES, not turn completions — every one read `stop_reason: "tool_use"` and none `end_turn`, so it over-counts by about two orders of magnitude (the 1.1 survey established this).',
    }),
    Object.freeze({
        candidate: '`type: "last-prompt"` records',
        reading: 95,
        refused_because:
            'written once per assistant leaf and repeating the SAME prompt text, so it is a per-turn marker whose mapping onto the `stop` hook event is unverified rather than a published count.',
    }),
    Object.freeze({
        candidate: '`hookInfos` entries whose command carries `--event stop`',
        reading: 7,
        refused_because:
            'host-authored and event-named — the strongest of the three — but it appears on only 7 of about 95 turns in the same session, so the host records these entries selectively (they co-occur with `hookAdditionalContext` / `preventedContinuation`) and the artefact UNDER-counts dispatches.',
    }),
]);

/**
 * One denominator reading. These fields and no others.
 *
 * Every field is a bounded scalar: a count, an ISO calendar date, a scope
 * literal, or the one platform literal the survey found countable. Nothing here
 * can hold a path, a project name, a session id, a prompt, or a tool name — the
 * same property the numerator's record carries, asserted the same way.
 */
export interface HostDenominator {
    /** The only platform with an obtainable host denominator (1.1 survey). */
    platform: 'claude';
    /** Which population the counts are over. See {@link DenominatorScope}. */
    scope: DenominatorScope;
    /** Which rule set produced the counts. See {@link RECONSTRUCTION_RULE_VERSION}. */
    reconstruction_rule_version: number;
    /** Inclusive window start, ISO calendar date (`YYYY-MM-DD`). */
    window_start: string;
    /** Inclusive window end, ISO calendar date (`YYYY-MM-DD`). */
    window_end: string;
    /** Transcripts inside the scope, before windowing. */
    transcripts_found: number;
    /** Project directories skipped because they are outside the scope. */
    transcripts_out_of_scope: number;
    /** Transcripts whose earliest record falls inside the window. */
    sessions_in_window: number;
    /** Transcripts whose earliest record predates the window. */
    sessions_before_window: number;
    /** Transcripts whose earliest record postdates the window. */
    sessions_after_window: number;
    /** Transcripts carrying no parseable timestamped record at all. */
    sessions_undatable: number;
    session_start: number;
    user_prompt_submit: number;
    pre_tool_use: number;
    post_tool_use: number;
    subagent_start: number;
    subagent_stop: number;
    /** `user` records excluded by refinement 1 (`isMeta`). Audit trail. */
    excluded_meta_user_records: number;
    /** `user` records excluded by refinement 2 (`isSidechain`). Audit trail. */
    excluded_sidechain_user_records: number;
    /** Of `pre_tool_use` / `post_tool_use`, how many came from sidechain records. */
    sidechain_tool_use_blocks: number;
    /** Of `subagent_start` / `subagent_stop`, how many came from sidechain records. */
    sidechain_agent_tool_use_blocks: number;
    /** Directories the walk could not read. Never silently zero. */
    unreadable_directories: number;
    /** Transcript lines that did not parse as JSON. Never silently discarded. */
    unparseable_lines: number;
}

/** The committed key set. AC-2 asserts a record's keys against exactly this. */
export const DENOMINATOR_RECORD_KEYS = Object.freeze([
    'platform',
    'scope',
    'reconstruction_rule_version',
    'window_start',
    'window_end',
    'transcripts_found',
    'transcripts_out_of_scope',
    'sessions_in_window',
    'sessions_before_window',
    'sessions_after_window',
    'sessions_undatable',
    'session_start',
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
    'subagent_start',
    'subagent_stop',
    'excluded_meta_user_records',
    'excluded_sidechain_user_records',
    'sidechain_tool_use_blocks',
    'sidechain_agent_tool_use_blocks',
    'unreadable_directories',
    'unparseable_lines',
] as const);

type _KeysCoverTheRecord = Assert<
    Exclude<keyof HostDenominator, (typeof DENOMINATOR_RECORD_KEYS)[number]> extends never
        ? true
        : false
>;
type _KeysAddNothing = Assert<
    Exclude<(typeof DENOMINATOR_RECORD_KEYS)[number], keyof HostDenominator> extends never
        ? true
        : false
>;
/**
 * Fails to compile if {@link HostDenominator} ever grows a key from the
 * journal's `FREE_FORM_KEYS` — the numerator's guard, reused rather than
 * re-implemented, so the two halves cannot drift apart. The list itself is not
 * imported as a value here: only the type-level guard is needed, and the test
 * asserts the runtime mirror against the journal's own export directly.
 */
type _RecordCarriesNoFreeFormField = Assert<
    [NoFreeForm<HostDenominator>] extends [never] ? false : true
>;

/** Raised when a record is handed to {@link validateDenominator} and fails it. */
export class DenominatorContractError extends Error {}

/** Keys that are not counts. Everything else must be a non-negative integer. */
const NON_COUNT_KEYS = new Set<string>(['platform', 'scope', 'window_start', 'window_end']);

/**
 * Runtime half of the schema guard: an unknown key is **REJECTED, not
 * dropped**, on the same reasoning `_lib/collector_record.ts` states — a
 * producer whose extra field is silently discarded has been told the field is
 * fine, and the leak then lives upstream where this schema cannot see it.
 */
export function validateDenominator(record: Record<string, unknown>): HostDenominator {
    const allowed = new Set<string>(DENOMINATOR_RECORD_KEYS);
    for (const key of Object.keys(record)) {
        if (!allowed.has(key)) {
            throw new DenominatorContractError(`unknown field '${key}' — REJECTED, not dropped`);
        }
    }
    for (const key of DENOMINATOR_RECORD_KEYS) {
        if (!(key in record)) {
            throw new DenominatorContractError(`missing field '${key}'`);
        }
    }
    if (record.platform !== 'claude') {
        throw new DenominatorContractError(
            `platform must be 'claude' — the only cell set with an obtainable host denominator`,
        );
    }
    if (!(DENOMINATOR_SCOPES as readonly string[]).includes(record.scope as string)) {
        throw new DenominatorContractError(
            `scope must be one of ${DENOMINATOR_SCOPES.join(' | ')} — an unrecorded scope is how ` +
                `a denominator ends up over a different population than its numerator`,
        );
    }
    for (const key of DENOMINATOR_RECORD_KEYS) {
        if (NON_COUNT_KEYS.has(key)) continue;
        const value = record[key];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new DenominatorContractError(`field '${key}' must be a non-negative integer`);
        }
    }
    for (const key of ['window_start', 'window_end'] as const) {
        const value = record[key];
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new DenominatorContractError(
                `field '${key}' must be an ISO calendar date (YYYY-MM-DD) — a per-second timestamp beside a session count reconstructs working hours`,
            );
        }
    }
    if ((record.window_start as string) > (record.window_end as string)) {
        throw new DenominatorContractError(
            `window_start '${String(record.window_start)}' is after window_end ` +
                `'${String(record.window_end)}' — an inverted window files every transcript as ` +
                `out-of-window and reports a zero denominator instead of a bad input`,
        );
    }
    return record as unknown as HostDenominator;
}

/** A zeroed record for the given scope and window. */
export function emptyDenominator(
    windowStart: string,
    windowEnd: string,
    scope: DenominatorScope = 'repository',
): HostDenominator {
    return validateDenominator({
        platform: 'claude',
        scope,
        reconstruction_rule_version: RECONSTRUCTION_RULE_VERSION,
        window_start: windowStart,
        window_end: windowEnd,
        transcripts_found: 0,
        transcripts_out_of_scope: 0,
        sessions_in_window: 0,
        sessions_before_window: 0,
        sessions_after_window: 0,
        sessions_undatable: 0,
        session_start: 0,
        user_prompt_submit: 0,
        pre_tool_use: 0,
        post_tool_use: 0,
        subagent_start: 0,
        subagent_stop: 0,
        excluded_meta_user_records: 0,
        excluded_sidechain_user_records: 0,
        sidechain_tool_use_blocks: 0,
        sidechain_agent_tool_use_blocks: 0,
        unreadable_directories: 0,
        unparseable_lines: 0,
    });
}

/** Per-transcript counts, before windowing folds them into a total. */
export interface TranscriptCounts {
    /**
     * MINIMUM record timestamp in the file, not the first one in file order.
     * A transcript whose leading record is back-dated would otherwise be
     * windowed by that record's day, which decides whether the whole file's
     * counts land in the denominator at all (R2 finding 12).
     */
    first_at: string | null;
    user_prompt_submit: number;
    tool_use_blocks: number;
    agent_tool_use_blocks: number;
    sidechain_tool_use_blocks: number;
    sidechain_agent_tool_use_blocks: number;
    excluded_meta_user_records: number;
    excluded_sidechain_user_records: number;
    unparseable_lines: number;
}

/**
 * Apply {@link RECONSTRUCTION_RULES} to one transcript's records.
 *
 * Pure: takes already-parsed records, touches no filesystem, so the rules are
 * testable against inline fixtures and the published counts are reproducible
 * without the measured machine's `~/.claude`.
 */
export function countTranscript(records: readonly Record<string, unknown>[]): TranscriptCounts {
    const out = emptyTranscriptCounts();
    for (const record of records) foldRecord(out, record);
    return out;
}

/** A zeroed per-transcript accumulator. */
export function emptyTranscriptCounts(): TranscriptCounts {
    return {
        first_at: null,
        user_prompt_submit: 0,
        tool_use_blocks: 0,
        agent_tool_use_blocks: 0,
        sidechain_tool_use_blocks: 0,
        sidechain_agent_tool_use_blocks: 0,
        excluded_meta_user_records: 0,
        excluded_sidechain_user_records: 0,
        unparseable_lines: 0,
    };
}

/**
 * Apply the rules to a single record. The one place the rules live — the
 * whole-file and the streaming path both call it, so they cannot diverge.
 */
export function foldRecord(out: TranscriptCounts, record: Record<string, unknown>): void {
    const at = record.timestamp;
    if (typeof at === 'string' && at.length > 0) {
        // MINIMUM, not first-seen. See TranscriptCounts.first_at.
        if (out.first_at === null || at < out.first_at) out.first_at = at;
    }

    const sidechain = record.isSidechain === true;

    if (record.type === 'user') {
        // The two exclusion counters are INDEPENDENT: a record carrying both
        // flags increments both. v1 tested `isSidechain` first and returned, so
        // the two counts were published as independent while they were not
        // (R2 finding 11).
        if (sidechain) out.excluded_sidechain_user_records += 1;
        if (record.isMeta === true) out.excluded_meta_user_records += 1;
        if (sidechain || record.isMeta === true) return;

        const content = (record.message as { content?: unknown } | undefined)?.content;
        const carriesToolResult =
            Array.isArray(content) &&
            content.some(
                (block) =>
                    typeof block === 'object' &&
                    block !== null &&
                    (block as { type?: unknown }).type === 'tool_result',
            );
        if (!carriesToolResult) out.user_prompt_submit += 1;
        return;
    }

    if (record.type === 'assistant') {
        const content = (record.message as { content?: unknown } | undefined)?.content;
        if (!Array.isArray(content)) return;
        for (const block of content) {
            if (typeof block !== 'object' || block === null) continue;
            const typed = block as { type?: unknown; name?: unknown };
            if (typed.type !== 'tool_use') continue;
            out.tool_use_blocks += 1;
            if (sidechain) out.sidechain_tool_use_blocks += 1;
            if (typed.name === 'Agent' || typed.name === 'Task') {
                out.agent_tool_use_blocks += 1;
                if (sidechain) out.sidechain_agent_tool_use_blocks += 1;
            }
        }
    }
}

/** Fold one transcript's counts into a denominator, honouring the window. */
export function accumulate(
    into: HostDenominator,
    counts: TranscriptCounts,
    windowStart: string,
    windowEnd: string,
): void {
    into.transcripts_found += 1;
    into.unparseable_lines += counts.unparseable_lines;

    if (counts.first_at === null) {
        into.sessions_undatable += 1;
        return;
    }
    const day = counts.first_at.slice(0, 10);
    if (day < windowStart) {
        into.sessions_before_window += 1;
        return;
    }
    if (day > windowEnd) {
        // v1 filed this under `sessions_before_window`, which is reachable via
        // `--days`, clock skew or a future-dated fixture and was silent because
        // the totals still reconciled (R2 finding 10).
        into.sessions_after_window += 1;
        return;
    }

    into.sessions_in_window += 1;
    into.session_start += 1;
    into.user_prompt_submit += counts.user_prompt_submit;
    into.pre_tool_use += counts.tool_use_blocks;
    into.post_tool_use += counts.tool_use_blocks;
    into.subagent_start += counts.agent_tool_use_blocks;
    into.subagent_stop += counts.agent_tool_use_blocks;
    into.excluded_meta_user_records += counts.excluded_meta_user_records;
    into.excluded_sidechain_user_records += counts.excluded_sidechain_user_records;
    into.sidechain_tool_use_blocks += counts.sidechain_tool_use_blocks;
    into.sidechain_agent_tool_use_blocks += counts.sidechain_agent_tool_use_blocks;
}

/** The total across the six counted cells — the denominator of the rate. */
export function totalCountedEvents(record: HostDenominator): number {
    return COUNTED_EVENTS.reduce((sum, event) => sum + record[event], 0);
}

/** The total across the five journal-bound counted cells. */
export function totalJournalBoundEvents(record: HostDenominator): number {
    return JOURNAL_BOUND_COUNTED_EVENTS.reduce((sum, event) => sum + record[event], 0);
}

/**
 * Claude Code's project-directory name for a working directory.
 *
 * The host replaces every path separator, and every `.`, with `-`. Derived by
 * inspection of the directories this machine carries rather than from a
 * documented rule, which is why {@link repositoryScopeSlugs} returns the slugs
 * it computed: a slug matching no directory is then visible as an empty scope
 * rather than as a silently small denominator.
 */
export function projectSlug(dir: string): string {
    return dir.replace(/[/.]/g, '-');
}

/** The result of asking git which directories belong to the measured repo. */
export interface RepositoryScope {
    /** Absolute worktree paths, main checkout first. Empty outside a repo. */
    worktrees: readonly string[];
    /** The project-directory slugs those paths map to. */
    slugs: readonly string[];
}

/**
 * Every worktree of the repository containing `root`, as project slugs.
 *
 * The numerator's journal lives at the repository's COMMON git dir and is
 * therefore shared by every worktree of that repository and reachable from none
 * other. So the matching denominator is exactly this set — which cannot be
 * derived from a path prefix, because a linked worktree may live anywhere (this
 * repository's own live under `/private/tmp/`).
 *
 * `git worktree list --porcelain` is the only source that knows. A failure
 * returns an EMPTY scope rather than falling back to machine-wide: a silent
 * widening is precisely the defect this function exists to fix.
 */
export function repositoryScopeSlugs(root: string): RepositoryScope {
    let stdout: string;
    try {
        stdout = execFileSync('git', ['-C', root, 'worktree', 'list', '--porcelain'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return { worktrees: [], slugs: [] };
    }
    const worktrees: string[] = [];
    for (const line of stdout.split('\n')) {
        if (!line.startsWith('worktree ')) continue;
        const dir = line.slice('worktree '.length).trim();
        if (dir.length === 0) continue;
        try {
            worktrees.push(fs.realpathSync(dir));
        } catch {
            worktrees.push(dir);
        }
    }
    return { worktrees, slugs: worktrees.map(projectSlug) };
}

/** What a scoped walk found, and what it could not read. */
export interface TranscriptWalk {
    files: readonly string[];
    /** Project directories skipped because they are outside the scope. */
    outOfScope: number;
    /** Directories that could not be listed. Reported, never swallowed. */
    unreadable: number;
}

/**
 * Every `*.jsonl` under a Claude Code projects root, recursively.
 *
 * Recursive on purpose: a flat one-level walk under-enumerates this machine's
 * store by more than half (992 of 2,300 files), and a denominator that silently
 * misses two thirds of its population is worse than none. Symlinked directories
 * and transcripts are followed for the same reason — `isDirectory()` and
 * `isFile()` are both false for a symlink, and v1 skipped them silently.
 *
 * `slugs` restricts the walk to the given top-level project directories. An
 * EMPTY array means "no directory is in scope" and yields no files — never "all
 * of them", which is the widening the scope field exists to prevent.
 */
export function findTranscripts(projectsRoot: string, slugs?: readonly string[]): TranscriptWalk {
    const files: string[] = [];
    let unreadable = 0;
    let outOfScope = 0;
    const inScope = slugs === undefined ? null : new Set(slugs);

    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            unreadable += 1;
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            let isDir = entry.isDirectory();
            let isFile = entry.isFile();
            if (entry.isSymbolicLink()) {
                try {
                    const st = fs.statSync(full);
                    isDir = st.isDirectory();
                    isFile = st.isFile();
                } catch {
                    unreadable += 1;
                    continue;
                }
            }
            if (isDir) walk(full);
            else if (isFile && entry.name.endsWith('.jsonl')) files.push(full);
        }
    };

    let top: fs.Dirent[];
    try {
        top = fs.readdirSync(projectsRoot, { withFileTypes: true });
    } catch {
        return { files: [], outOfScope: 0, unreadable: 1 };
    }
    for (const entry of top) {
        const full = path.join(projectsRoot, entry.name);
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            // A transcript directly under the root belongs to no project
            // directory, so it can never be attributed to a repository scope.
            if (inScope === null) files.push(full);
            else outOfScope += 1;
            continue;
        }
        if (inScope !== null && !inScope.has(entry.name)) {
            outOfScope += 1;
            continue;
        }
        walk(full);
    }
    files.sort();
    return { files, outOfScope, unreadable };
}

/** Stream one transcript file and count it. Unparseable lines are COUNTED. */
export async function countTranscriptFile(file: string): Promise<TranscriptCounts> {
    const out = emptyTranscriptCounts();
    const stream = readline.createInterface({
        input: fs.createReadStream(file, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });
    for await (const line of stream) {
        if (line.trim().length === 0) continue;
        try {
            const parsed = JSON.parse(line);
            if (typeof parsed === 'object' && parsed !== null) {
                foldRecord(out, parsed as Record<string, unknown>);
            } else {
                out.unparseable_lines += 1;
            }
        } catch {
            // A truncated tail line is not a host event — but it is not nothing
            // either, and every other exclusion class here is published.
            out.unparseable_lines += 1;
        }
    }
    return out;
}
