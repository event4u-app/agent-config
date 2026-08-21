/**
 * Class-A usage record — schema, skill-name normalisation, salted hashes,
 * and the JSONL appender (road-to-org-telemetry Phase 1).
 *
 * Class A is the package describing itself: a usage class, the skill that
 * was invoked, the host, the package version, the active rule-loading tier,
 * a pseudonymous user hash, a session hash, and an hour-bucketed timestamp.
 * It carries zero bytes of project content.
 *
 * PII-EXCLUSION-BY-CONSTRUCTION — the point of this file, not a caution.
 * `ClassARecord` has no field capable of holding free-form content: every
 * member is a string drawn from a closed vocabulary, an id validated by the
 * engagement redaction floor, or a hex digest. There is no `payload`, no
 * `notes`, no `extra: unknown`. A type that cannot carry a prompt has no
 * scrubber that can fail — the same principle `domain-safety-pii` § Surface 2
 * applies to log streams, and the same one the artefact-engagement event
 * already follows. Never widen this interface with a free-text member.
 *
 * Two host-supplied opaque tokens are deliberately hashed rather than
 * recorded: the session id and the login name. The session id in particular
 * is high-entropy and `check_secret_leak` correctly reads a raw one as a
 * candidate credential (a trap `orchestration_record_hook.ts` recorded when
 * it chose to generate its own id instead).
 *
 * PHASE BOUNDARY. This module writes to a local file and nothing else. The
 * outbound flush is Phase 2 and is blocked on the `sink-choice` blocker;
 * org-wide enablement is Phase 3 and is blocked on `dpo-signoff`. Nothing
 * here opens a socket, and no caller in this phase may make it do so.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { check_id_redaction, py_json_dumps_compact_sorted } from './engagement.js';

export const CLASS_A_SCHEMA_VERSION = 1;

/**
 * Record classes. `usage` is Phase 1; `self-repair` is Phase 5 step 5.1.
 *
 * Both are Class A — structural fields only — and both travel the same log,
 * spool and transport, discriminated by this field. `skill_usage_report`
 * filters on it so a defect report can never be counted as an invocation.
 */
export const ALLOWED_RECORD_CLASSES = ['usage', 'self-repair'] as const;

/**
 * Discipline-profile values, the knob that actually decides which rule
 * surfaces load.
 *
 * NOT `rule_loading_tier`. The settings template calls that one a "legacy
 * knob — superseded by discipline_profile above", and
 * `resolve_discipline_profile` confirms the precedence: an explicit
 * `discipline_profile` wins outright, and the legacy key is consulted only
 * when it is absent. Recording the legacy value would have described a knob
 * that does not decide the thing the record implies it decides.
 *
 * `auto` is in the vocabulary because it is a value an install genuinely
 * declares. Resolving it needs the session model id and the host capability
 * table, neither of which a post-tool hook has, so it is recorded verbatim
 * rather than guessed at.
 */
export const ALLOWED_DISCIPLINE_PROFILES = ['off', 'essential', 'full', 'custom', 'auto'] as const;

/**
 * Map a legacy `rule_loading_tier` onto a profile, exactly as
 * `resolve_discipline_profile` does for the explicit-absent case. Unknown
 * or absent → `null`, never the resolver's both-absent default: a record
 * must not claim a declaration the install never made.
 */
export function profile_from_legacy_tier(tier: string | null): string | null {
    switch (tier) {
        case 'minimal': return 'off';
        case 'balanced': return 'essential';
        case 'full': return 'full';
        case 'custom': return 'custom';
        default: return null;
    }
}

/** Digest length, in hex chars — matches the tier-usage signal contract. */
export const HASH_HEX_LEN = 16;

export class ClassARecordError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ClassARecordError';
    }
}

/**
 * One Class-A usage record. Every field is structural; see the file header
 * for why there is no free-form member and why that must stay true.
 */
export interface ClassARecord {
    schema_version: number;
    /** Closed vocabulary — see `ALLOWED_RECORD_CLASSES`. */
    record_class: string;
    /** ISO-8601 UTC, HOUR resolution. Never an exact timestamp. */
    ts_bucket: string;
    /** Normalised skill id — see `normalise_skill_name`. */
    skill: string;
    /**
     * Host id (`claude`, `augment`, …) — an id-shaped enum, never a path.
     * `null` when the envelope carried none; the siblings in this tree
     * record an absent host as absent rather than as a sentinel string,
     * and `"unknown"` would be indistinguishable from a host so named.
     */
    host: string | null;
    /** Installed package version, or `null` when the install did not report one. */
    package_version: string | null;
    /** Declared discipline profile, or `null` when the install declared none. */
    discipline_profile: string | null;
    /** The org whose pack enabled this install. */
    org_id: string;
    /** Salted digest of host + login. Never the login itself. */
    user_hash: string;
    /**
     * Salted digest of the host session id, or `null` when the envelope
     * carried none. Never the raw id, and never a digest of the empty
     * string: that would be a valid, stable value, so every session-less
     * record in an org would collapse into one apparent session — a
     * fabricated fact wearing a hash's clothes.
     */
    session_hash: string | null;
}

/**
 * Canonical skill id.
 *
 * Phase 0's third spike measured the host sending ONE skill under two
 * spellings — `roadmap:process-full` (64 observations) and
 * `roadmap-process-full` (22), likewise `roadmap:ai-council`. Left alone,
 * per-skill counts split and the busiest skills undercount by roughly a
 * quarter.
 *
 * The collapse direction is `:` → `-`, and it is chosen because it is
 * TOTAL: every colon form has exactly one dash form, so the mapping is a
 * function. The other direction is not — `brand-asset-generation` has no
 * cluster and nothing in a hook can decide which dash of
 * `roadmap-process-full` would have been a colon without carrying the whole
 * command catalogue into the hot path.
 *
 * The two names that collide under this rule are the same skill, which is
 * the entire reason the rule exists. Should a genuinely distinct skill ever
 * be named exactly like another cluster's flattened form, the collision is
 * a naming defect upstream of this function, not a defect here — and the
 * duplicate name would already be ambiguous to a human reading the report.
 *
 * Throws on anything the engagement redaction floor rejects: a path, a file
 * extension, embedded whitespace, or an over-long value. The caller drops
 * the record rather than recording a name it could not validate.
 */
export function normalise_skill_name(raw: unknown): string {
    if (typeof raw !== 'string') {
        throw new ClassARecordError('skill must be a string');
    }
    const collapsed = raw.trim().replace(/:/gu, '-');
    check_id_redaction('skill', collapsed);
    return collapsed;
}

/**
 * ISO-8601 UTC truncated to the hour — `2026-08-18T21:00Z`.
 *
 * Hour buckets, never exact timestamps: the tier-usage signal contract
 * names exact timestamps in its forbidden list precisely because they
 * re-identify a single user's working pattern from an otherwise
 * pseudonymous record set.
 */
export function hour_bucket(d: Date): string {
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
        + `T${p(d.getUTCHours())}:00Z`;
}

/**
 * Salted digest, first `HASH_HEX_LEN` hex chars of a SHA-256.
 *
 * The salt is the org pack's, never this repository's — an unsalted hash of
 * a login name is reversible by dictionary in seconds, so a salt-less digest
 * would be an identifier wearing a hash's clothes. `read_remote_settings`
 * refuses to activate without one, which is what makes that guarantee
 * structural rather than a convention.
 *
 * Parts are joined on NUL, which cannot occur in a hostname, a login, or a
 * session id — so no pair of distinct inputs can produce one joined string.
 */
function _salted_digest(salt: string, parts: readonly string[]): string {
    if (!salt) {
        throw new ClassARecordError('salt must be non-empty — refusing to emit an unsalted digest');
    }
    const material = [salt, ...parts].join('\u0000');
    return crypto.createHash('sha256').update(material, 'utf-8').digest('hex').slice(0, HASH_HEX_LEN);
}

/** Pseudonymous per-user id. Stable per (salt, machine, login). */
export function derive_user_hash(salt: string, hostname: string, username: string): string {
    return _salted_digest(salt, ['user', hostname, username]);
}

/**
 * Pseudonymous per-session id, or `null` when the host supplied none.
 *
 * Domain-separated from the user hash by the literal prefix, so the same
 * salt cannot make the two digests collide or let one be derived from the
 * other.
 *
 * An absent session id returns `null` rather than hashing the empty string.
 * The empty-string digest is perfectly valid and perfectly stable, which is
 * exactly the problem: every session-less record in one org would share it
 * and read as a single busy session.
 */
export function derive_session_hash(salt: string, session_id: string): string | null {
    if (!session_id) {
        return null;
    }
    return _salted_digest(salt, ['session', session_id]);
}

export interface BuildClassAInput {
    skill: unknown;
    host: string | null;
    org_id: string;
    salt: string;
    hostname: string;
    username: string;
    session_id: string;
    package_version?: string | null;
    discipline_profile?: string | null;
    record_class?: string;
    now?: Date;
}

/**
 * Build one validated Class-A usage record. Pure — no I/O and no ambient
 * clock unless the caller omits `now`, so the mapping stays independently
 * testable.
 *
 * Throws rather than returning a partial record: a record that failed
 * validation is dropped by the caller, never written in a degraded shape.
 */
export function build_class_a_record(input: BuildClassAInput): ClassARecord {
    const skill = normalise_skill_name(input.skill);

    const host = input.host ?? null;
    if (host !== null) {
        check_id_redaction('host', host);
    }
    check_id_redaction('org_id', input.org_id);

    const record_class = input.record_class ?? 'usage';
    if (!(ALLOWED_RECORD_CLASSES as readonly string[]).includes(record_class)) {
        throw new ClassARecordError(
            `record_class must be one of ${ALLOWED_RECORD_CLASSES.join(', ')}`,
        );
    }

    const discipline_profile = input.discipline_profile ?? null;
    if (
        discipline_profile !== null
        && !(ALLOWED_DISCIPLINE_PROFILES as readonly string[]).includes(discipline_profile)
    ) {
        throw new ClassARecordError(
            `discipline_profile must be one of ${ALLOWED_DISCIPLINE_PROFILES.join(', ')} or null`,
        );
    }

    const package_version = input.package_version ?? null;
    if (package_version !== null) {
        check_id_redaction('package_version', package_version);
    }

    return {
        schema_version: CLASS_A_SCHEMA_VERSION,
        record_class,
        ts_bucket: hour_bucket(input.now ?? new Date()),
        skill,
        host,
        package_version,
        discipline_profile,
        org_id: input.org_id,
        user_hash: derive_user_hash(input.salt, input.hostname, input.username),
        session_hash: derive_session_hash(input.salt, input.session_id),
    };
}

/**
 * One Class-A SELF-REPAIR record (Phase 5, step 5.1).
 *
 * The shadow of a queued defect: it says a defect of a named class occurred,
 * on which host, at which package version, under which declared profile, for
 * which pseudonymous user. It says nothing about WHAT happened.
 *
 * A SEPARATE TYPE, NOT A WIDENED `ClassARecord`, AND THAT IS THE WHOLE POINT.
 * `DefectFinding` carries `evidence` (a quoted span of the offending text) and
 * `suggested_surface` (a free sentence). Those are the Class-B payload and
 * they ship only on explicit per-case approval. Adding either to a
 * telemetry record type — even optionally, even "sanitized" — would give this
 * type a field capable of holding project content, and the privacy property
 * this whole surface rests on is that no such field exists. There is then no
 * scrubber to fail. Keeping the automatic class in its own interface is how
 * that stays checkable by reading the type instead of auditing every writer.
 *
 * WHAT IS DELIBERATELY ABSENT: an enumerated active-rule / active-skill list.
 * The roadmap Context asks Class A to carry "the active rule and skill
 * snapshot" so that "this rule was loaded in six of seven reports of this
 * class" localizes an artefact. No producer for that exists on a hook path:
 * `match_prompt` needs the compiled router, which nothing in the hook surface
 * loads today and which is not established as present in a consumer install.
 * `discipline_profile` is recorded instead — the knob that decides which rule
 * surfaces load at all — and it is a profile-level snapshot, NOT the
 * per-artefact attribution key. That attribution claim stays unavailable, and
 * saying so here is cheaper than a reader inferring it from a field name.
 */
export interface ClassADefectRecord {
    schema_version: number;
    record_class: string;
    ts_bucket: string;
    /** Detector / intake class — a closed vocabulary owned by the caller. */
    defect_class: string;
    /** Which intake produced it — also a closed vocabulary. */
    defect_source: string;
    /** How many times this fingerprint has been seen. A counter, not content. */
    occurrences: number;
    host: string | null;
    package_version: string | null;
    discipline_profile: string | null;
    org_id: string;
    user_hash: string;
    session_hash: string | null;
}

export interface BuildClassADefectInput {
    defect_class: string;
    defect_source: string;
    occurrences: number;
    host: string | null;
    org_id: string;
    salt: string;
    hostname: string;
    username: string;
    session_id: string;
    package_version?: string | null;
    discipline_profile?: string | null;
    now?: Date;
}

/**
 * Build one validated Class-A self-repair record. Pure, and throws rather
 * than returning a partial record — same contract as its usage sibling.
 *
 * `defect_class` and `defect_source` go through the same id-redaction floor as
 * every other id here, so a caller that ever passed a path, an extension or
 * an over-long free string gets an exception instead of an egress.
 */
export function build_class_a_defect_record(
    input: BuildClassADefectInput,
): ClassADefectRecord {
    check_id_redaction('defect_class', input.defect_class);
    check_id_redaction('defect_source', input.defect_source);
    check_id_redaction('org_id', input.org_id);

    const host = input.host ?? null;
    if (host !== null) {
        check_id_redaction('host', host);
    }

    const discipline_profile = input.discipline_profile ?? null;
    if (
        discipline_profile !== null
        && !(ALLOWED_DISCIPLINE_PROFILES as readonly string[]).includes(discipline_profile)
    ) {
        throw new ClassARecordError(
            `discipline_profile must be one of ${ALLOWED_DISCIPLINE_PROFILES.join(', ')} or null`,
        );
    }

    const package_version = input.package_version ?? null;
    if (package_version !== null) {
        check_id_redaction('package_version', package_version);
    }

    if (!Number.isInteger(input.occurrences) || input.occurrences < 1) {
        throw new ClassARecordError('occurrences must be a positive integer');
    }

    return {
        schema_version: CLASS_A_SCHEMA_VERSION,
        record_class: 'self-repair',
        ts_bucket: hour_bucket(input.now ?? new Date()),
        defect_class: input.defect_class,
        defect_source: input.defect_source,
        occurrences: input.occurrences,
        host,
        package_version,
        discipline_profile,
        org_id: input.org_id,
        user_hash: derive_user_hash(input.salt, input.hostname, input.username),
        session_hash: derive_session_hash(input.salt, input.session_id),
    };
}

// ── Retention — the growth budget for the local record log ──────────────
//
// Phase 1 shipped this file as append-only with no cap and no pruning, and
// `flush: never` endorses that as an indefinite steady state: one line per
// skill invocation, forever. Its own completion review raised it, and
// `scale-discipline` R-A7 makes it an obligation rather than a nicety —
// an append-only store declares a retention policy (TTL, pruning job,
// partition rotation, or archive path) or it is not finished.
//
// This is the TTL-plus-pruning shape, enforced by the only writer, so it
// cannot be bypassed by a caller that forgets to run a sweep.
//
// THE NUMBERS ARE MEASURED, NOT GUESSED. On the busiest machine this tree
// has observed, `agents/runtime/state/tool-result-census.jsonl` carries 24
// `Skill` tool events across 3.62 days — 6.6 per day — and a Class-A line
// serialises to 248–286 bytes (measured over four skill-name lengths), so
// call it 270. That machine therefore writes ≈ 637 KiB per year.
//
// The AGE cap is the policy that actually binds: at the observed rate 90
// days is ≈ 600 records ≈ 160 KiB, so it fires regularly and keeps the file
// small. The BYTE cap is a backstop for a rate this tree has not observed —
// a shared machine, a much heavier user — where it bounds the file at 2 MiB
// (≈ 7,700 records) regardless of dates. A cap chosen so generously that it
// can never fire is a policy on paper only, which is the failure this repo
// keeps finding in its own gates; 2 MiB is reached in about twelve days at
// 100× the observed rate and in about 3.2 years at 1×, and both of those are
// the point. (The 1× figure read "eight years" until the completion review
// did the division: 2,097,152 B ÷ (6.6/day × 270 B) ≈ 1,177 days. A number
// nobody checks is how a measured default quietly becomes a guessed one.)
//
// WHAT RETENTION COSTS UNDER `flush: never`. With no transport configured
// the local file is the only store, so a record evicted here is a record
// that is never sent anywhere. That is the intended trade — a growth budget
// is a decision to lose the oldest data rather than to keep all of it — but
// it is stated here rather than left for an operator to discover from a
// short file. An org that needs the full history configures a flush.

/** Days a record is kept before the age pass drops it. */
export const DEFAULT_RETENTION_MAX_AGE_DAYS = 90;

/** Hard ceiling on the log, in bytes, regardless of record age. */
export const DEFAULT_RETENTION_MAX_BYTES = 2 * 1024 * 1024;

/**
 * How much of the byte cap a byte-triggered prune leaves behind.
 *
 * Hysteresis, not tidiness: pruning back to exactly the cap would leave the
 * file at the trigger point, so the next append would prune again and every
 * append after it would pay a full rewrite. At 0.75 a quarter of the cap
 * must re-accumulate first.
 */
export const RETENTION_KEEP_FRACTION = 0.75;

export interface RetentionPolicy {
    readonly max_age_days: number;
    readonly max_bytes: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
    max_age_days: DEFAULT_RETENTION_MAX_AGE_DAYS,
    max_bytes: DEFAULT_RETENTION_MAX_BYTES,
};

/**
 * Epoch ms for a record line, or `null` when the line carries no readable
 * `ts_bucket`.
 *
 * `null` is not an error path — see `enforce_retention` for why an undatable
 * line is retained rather than dropped.
 */
export function record_line_ms(line: string): number | null {
    if (!line.trim()) {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(line);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) {
        return null;
    }
    const bucket = (parsed as Record<string, unknown>)['ts_bucket'];
    if (typeof bucket !== 'string') {
        return null;
    }
    const ms = Date.parse(bucket);
    return Number.isNaN(ms) ? null : ms;
}

/** Bytes of the log head read to find the oldest datable record. */
export const RETENTION_HEAD_WINDOW_BYTES = 8192;

/**
 * Timestamp of the OLDEST DATABLE record, read from the head of the file.
 *
 * Not "the first line": a single undatable line at the head would otherwise
 * answer the whole age question with `null` and disable the age policy for as
 * long as that line survives — which, since `enforce_retention` deliberately
 * keeps undatable lines, is until the byte cap evicts it. On a low-volume log
 * that is years. Scanning the window instead means one corrupt head line
 * costs nothing.
 *
 * `null` when the window holds no datable line at all. That case is bounded
 * by the byte cap rather than by age, and it is a genuinely corrupt file
 * rather than an ordinary one — the alternative, treating it as due, would
 * read the whole file on every append forever.
 *
 * Only complete lines are considered: a final fragment with no newline may be
 * a torn write, and half a record parses as nothing useful.
 */
export function _oldest_datable_ms(log_path: string): number | null {
    let fd: number;
    try {
        fd = fs.openSync(log_path, 'r');
    } catch {
        return null;
    }
    try {
        const buf = Buffer.alloc(RETENTION_HEAD_WINDOW_BYTES);
        const read = fs.readSync(fd, buf, 0, buf.length, 0);
        if (read <= 0) {
            return null;
        }
        const chunk = buf.subarray(0, read).toString('utf-8');
        const lines = chunk.split('\n');
        // Drop the trailing element: it is either empty (the window ended on a
        // newline) or an incomplete line (the window cut mid-record).
        lines.pop();
        for (const line of lines) {
            const ms = record_line_ms(line);
            if (ms !== null) {
                return ms;
            }
        }
        return null;
    } catch {
        return null;
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Is a prune owed right now?
 *
 * Deliberately cheap, because it runs on every append: one `stat`, and — only
 * when the byte cap has not already decided it — one bounded read of the
 * first line. The file is append-only and written in chronological order, so
 * the first line is the oldest record: if IT is inside the window, nothing in
 * the file is outside it, and the whole age pass is answered without reading
 * the rest.
 */
export function retention_due(
    log_path: string,
    policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
    now: Date = new Date(),
): boolean {
    let size: number;
    try {
        size = fs.statSync(log_path).size;
    } catch {
        return false;
    }
    if (size === 0) {
        return false;
    }
    if (size > policy.max_bytes) {
        return true;
    }
    const oldest = _oldest_datable_ms(log_path);
    if (oldest === null) {
        return false;
    }
    return oldest < now.getTime() - policy.max_age_days * 86_400_000;
}

export interface RetentionResult {
    readonly kept: number;
    readonly dropped_by_age: number;
    readonly dropped_by_size: number;
}

/**
 * Apply the retention policy to the log, in place.
 *
 * Age first, then bytes, because the age pass is the policy and the byte cap
 * is the backstop: running bytes first could evict a record the age window
 * still covers while leaving nothing for the age pass to do.
 *
 * AN UNDATABLE LINE IS KEPT BY THE AGE PASS. This file has exactly one
 * writer, so a line without a readable `ts_bucket` is corruption rather than
 * an old record, and deleting data on the strength of not being able to read
 * it is the wrong default. It still counts toward the byte cap, so it is
 * evicted from the oldest end eventually — bounded, but never silently
 * discarded for being unparseable.
 *
 * The rewrite goes through a sibling temp file and a rename, so a crash
 * mid-prune leaves the original log intact rather than a truncated one.
 */
export function enforce_retention(
    log_path: string,
    policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
    now: Date = new Date(),
): RetentionResult {
    let raw: string;
    try {
        raw = fs.readFileSync(log_path, 'utf-8');
    } catch {
        return { kept: 0, dropped_by_age: 0, dropped_by_size: 0 };
    }
    const lines = raw.split('\n').filter((l) => l.length > 0);
    const total = lines.length;

    const cutoff = now.getTime() - policy.max_age_days * 86_400_000;
    const survived_age = lines.filter((l) => {
        const ms = record_line_ms(l);
        return ms === null || ms >= cutoff;
    });
    const dropped_by_age = total - survived_age.length;

    // Byte cap: keep the NEWEST suffix that fits under the kept-fraction of
    // the cap. Walking from the end is what makes "drop the oldest" true.
    const budget = Math.floor(policy.max_bytes * RETENTION_KEEP_FRACTION);
    let used = 0;
    let start = survived_age.length;
    for (let i = survived_age.length - 1; i >= 0; i -= 1) {
        const cost = Buffer.byteLength(`${survived_age[i] as string}\n`);
        if (used + cost > budget) {
            break;
        }
        used += cost;
        start = i;
    }
    const kept_lines = survived_age.slice(start);
    const dropped_by_size = survived_age.length - kept_lines.length;

    if (dropped_by_age === 0 && dropped_by_size === 0) {
        return { kept: total, dropped_by_age: 0, dropped_by_size: 0 };
    }

    const payload = kept_lines.length === 0 ? '' : `${kept_lines.join('\n')}\n`;

    // A unique temp name per prune, then one rename.
    //
    // The rename is atomic, so no reader ever sees a half-written log and a
    // crash mid-prune leaves the original intact. What it does NOT give is
    // mutual exclusion: two processes rooted at the same project can both
    // read, both prune, and the later rename wins, losing the records the
    // other appended in between. A fixed temp path made that worse — the two
    // writers shared one scratch file — so the name carries the pid.
    //
    // Stated rather than solved: a lock is the fix, and it belongs with the
    // Phase 2 transport, which introduces a second writer to the same file
    // and is where the locking contract has to be decided anyway. Until then
    // the exposure is bounded to records written inside one prune window on a
    // log that only exceeded its budget.
    const tmp = `${log_path}.retention.${process.pid}.tmp`;
    fs.writeFileSync(tmp, payload, { encoding: 'utf-8' });
    fs.renameSync(tmp, log_path);

    return { kept: kept_lines.length, dropped_by_age, dropped_by_size };
}

/** Append one line to one bounded JSONL file. Both targets share it. */
function _append_and_bound(
    target: string,
    payload: string,
    policy: RetentionPolicy,
    now: Date,
): void {
    fs.mkdirSync(path.dirname(target) || '.', { recursive: true });
    fs.appendFileSync(target, payload, { encoding: 'utf-8' });
    if (retention_due(target, policy, now)) {
        enforce_retention(target, policy, now);
    }
}

/**
 * Append one record as a JSONL line, then enforce the retention policy.
 *
 * Uses the engagement module's compact-sorted serializer so a Class-A line
 * is byte-comparable with the records already in this tree rather than
 * carrying a second JSON convention.
 *
 * Enforcement runs AFTER the append and only when `retention_due` says so,
 * which makes the common append one extra `stat` plus one bounded read. It
 * lives here rather than in a separate sweep because this is the only writer:
 * a policy a caller has to remember to run is a policy that stops running.
 *
 * THE SPOOL IS WRITTEN HERE, IN THE SAME CALL (Phase 2, step 2.1). When
 * `spool_path` is given, the SAME bytes are appended to the outbound spool
 * under the SAME retention policy, and the session-end flush then only has
 * to drain a file. The alternative — a flush that works out for itself which
 * logged records are still unsent — needs a byte watermark into a file that
 * `enforce_retention` rewrites in place, and a watermark over a compacting
 * file is a silent-corruption pair: the offset survives the prune, the
 * records it points at do not. Enqueue-at-write has no watermark to
 * invalidate and spools each record exactly once, by the only writer.
 *
 * The spool inherits the log's growth budget rather than getting its own,
 * which is what answers Phase 0's unmeasured "queue growth bound across a
 * multi-day outage": a sink that is down for days cannot push the spool past
 * `max_bytes`. The cost of that bound is that the oldest UNSENT records are
 * dropped rather than kept — the same trade the log already makes, stated
 * here rather than discovered later in a truncated file.
 */
export function append_class_a_record(
    log_path: string,
    record: ClassARecord | ClassADefectRecord,
    policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
    now: Date = new Date(),
    spool_path: string | null = null,
): void {
    const payload = `${py_json_dumps_compact_sorted(record as unknown as Record<string, unknown>)}\n`;
    _append_and_bound(log_path, payload, policy, now);
    if (spool_path !== null && spool_path !== '') {
        _append_and_bound(spool_path, payload, policy, now);
    }
}
