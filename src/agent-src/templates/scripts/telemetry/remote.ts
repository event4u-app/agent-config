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

/** Usage classes. Phase 5 adds the self-repair class; Phase 1 emits one. */
export const ALLOWED_RECORD_CLASSES = ['usage'] as const;

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
 * Append one record as a JSONL line.
 *
 * Uses the engagement module's compact-sorted serializer so a Class-A line
 * is byte-comparable with the records already in this tree rather than
 * carrying a second JSON convention.
 */
export function append_class_a_record(log_path: string, record: ClassARecord): void {
    const payload = `${py_json_dumps_compact_sorted(record as unknown as Record<string, unknown>)}\n`;
    fs.mkdirSync(path.dirname(log_path) || '.', { recursive: true });
    fs.appendFileSync(log_path, payload, { encoding: 'utf-8' });
}
