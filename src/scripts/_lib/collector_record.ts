/**
 * collector_record — the supervised telemetry collector's data contract
 * (`road-to-supervised-telemetry-collector` Phase 2.1).
 *
 * ## Why an allowlist and not a scrubber
 *
 * "No free-form field" is necessary and **not sufficient**. A council seat
 * enumerated the leaks that *structured* fields still carry, and each one is
 * defended against here by construction rather than by a cleaning pass:
 *
 * | Leak class | How this schema refuses it |
 * |---|---|
 * | Repository / worktree identifiers | No field can hold a path, a repo name, a branch or a remote. There is nothing to scrub. |
 * | Command names and arguments | No field can hold a command. `event` is a closed enum of hook events, not an invocation. |
 * | Error enums with interpolated values | `outcome` is a closed enum with no payload. An error carries its CLASS and never its text. |
 * | Hashes stable enough to identify a user or repo | `machine_id` and `episode_id` are locally generated random ids, never derived from hostname, username, repo path or any host fact. A derived id is a pseudonym for the thing it derives from. |
 * | Timestamps + a machine identifier | `occurred_on` is a UTC **date**, never a precise time. A per-second timestamp beside a stable machine id is a behavioural fingerprint — it reconstructs working hours, session lengths and idle gaps. |
 *
 * This is the same PII-exclusion-by-construction principle the package already
 * applies to its telemetry events: a type that CANNOT hold a phone number needs
 * no scrubber that might fail. Widening this record with a `payload`, `notes`,
 * `context` or `extra: unknown` field would void the entire argument, and the
 * unknown-key rejection below exists to make that impossible by accident.
 *
 * ## Unknown fields are REJECTED, never dropped
 *
 * Dropping is the dangerous default. A producer that adds `repo_path` and sees
 * its records accepted has been told the field is fine; the leak then lives in
 * the producer, where this schema cannot see it, and the next reader of the
 * store finds a clean record and a dirty writer. Rejection turns that into a
 * loud failure at the boundary, which is where it is cheap.
 *
 * ## What this module does NOT do
 *
 * It does not write, store, transmit or aggregate anything. It is the contract
 * only. Deletion and opt-out are 2.3; the upgrade/rollback transitions are 2.4;
 * the collector itself is Phase 4 and is default-off.
 */

/** Hook events, mirroring `dispatch_hook.EVENT_VOCABULARY`. Closed. */
export const COLLECTOR_EVENTS = [
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
] as const;
export type CollectorEvent = (typeof COLLECTOR_EVENTS)[number];

/**
 * Terminal states of a capture attempt. Closed, and deliberately three.
 *
 * Metric definition item 5 requires that a startup failure be distinguishable
 * from a write loss: "a 40 % rate made of startup failures and a 40 % rate made
 * of write losses call for different fixes and the single ratio cannot
 * distinguish them". A single `ok: boolean` would collapse exactly that.
 */
export const COLLECTOR_OUTCOMES = ['captured', 'startup_failure', 'write_failure'] as const;
export type CollectorOutcome = (typeof COLLECTOR_OUTCOMES)[number];

/** Host platforms. Closed — a free string here would carry an arbitrary label. */
export const COLLECTOR_PLATFORMS = [
    'augment',
    'claude',
    'cline',
    'copilot',
    'cowork',
    'cursor',
    'gemini',
    'windsurf',
] as const;
export type CollectorPlatform = (typeof COLLECTOR_PLATFORMS)[number];

/** The current record schema version. Bumped by a 2.4 migration, never silently. */
export const COLLECTOR_SCHEMA_VERSION = 1;

/**
 * One capture record. Every field is listed in {@link FIELD_PURPOSE} with its
 * purpose, its cardinality limit and why a coarser form does not suffice.
 *
 * There is no index signature, and adding one would defeat the schema.
 */
export interface CollectorRecord {
    schema_version: number;
    machine_id: string;
    episode_id: string;
    event: CollectorEvent;
    sequence: number;
    outcome: CollectorOutcome;
    platform: CollectorPlatform;
    occurred_on: string;
    collector_version: string;
}

export interface FieldContract {
    /** What the metric needs this field FOR. A field with no purpose is removed. */
    purpose: string;
    /** The bound on distinct values, and what enforces it. */
    cardinality: string;
    /** Why a coarser or absent form does not suffice. */
    why_not_coarser: string;
}

/**
 * The per-field contract. Step 2.1 requires every field to carry all three
 * lines; `collector_record.test.ts` asserts the keys here are exactly the keys
 * of the record, so a field cannot be added without stating its purpose.
 */
export const FIELD_PURPOSE: Readonly<Record<keyof CollectorRecord, FieldContract>> = {
    schema_version: {
        purpose: 'Selects the migration path when an older package meets a newer record (2.4).',
        cardinality: 'One small integer per shipped schema. Currently 1.',
        why_not_coarser:
            'Absent, a rollback cannot tell a record it can read from one it must quarantine.',
    },
    machine_id: {
        purpose:
            'Satisfies the population floor and concentration cap of metric item 7 — at least ' +
            'five distinct machines, no single machine over 40 % of the denominator.',
        cardinality: 'One per machine per rotation. A locally generated random UUID.',
        why_not_coarser:
            'Without a per-machine key the concentration cap is unmeasurable, and a rate ' +
            'measured on one laptop would report that laptop as the population. It is random ' +
            'rather than derived precisely so it identifies a COUNTING UNIT and not a person: ' +
            'a hash of hostname, username or repo path is a pseudonym for those things and ' +
            'is re-identifiable by anyone holding the same inputs.',
    },
    episode_id: {
        purpose: 'Part of the deduplication key of metric item 4; scopes `sequence`.',
        cardinality: 'One per session. Locally generated random UUID, never reused.',
        why_not_coarser:
            'Without it, `sequence` has no scope and two sessions on one machine collide, ' +
            'which would silently merge two episodes into one and under-count the denominator.',
    },
    event: {
        purpose: 'Which (platform, event) cell the dispatch belonged to.',
        cardinality: `Closed enum, ${COLLECTOR_EVENTS.length} values.`,
        why_not_coarser:
            'Per-cell capture is the whole point — an aggregate rate cannot show that one ' +
            'event is never captured while the total looks healthy. It is an enum rather ' +
            'than a string so no interpolated value can ride along inside it.',
    },
    sequence: {
        purpose: 'Part of the deduplication key of metric item 4; orders records in an episode.',
        cardinality: 'Monotonic non-negative integer within one episode.',
        why_not_coarser:
            'Deduplication happens at READ time by design, so a duplicate must remain ' +
            'observable as a defect; without a sequence a retried write is indistinguishable ' +
            'from a second real dispatch and would inflate the numerator.',
    },
    outcome: {
        purpose: 'Metric item 5 — separates a missed capture from a failed start.',
        cardinality: `Closed enum, ${COLLECTOR_OUTCOMES.length} values.`,
        why_not_coarser:
            'A boolean collapses the two failure modes the metric definition explicitly ' +
            'requires to stay apart, because they call for different fixes. The enum carries ' +
            'no payload, so an error class can never smuggle its message.',
    },
    platform: {
        purpose:
            'Per-platform reporting, and the row on which the lifecycle evidence of AC-8 is ' +
            'either verified or explicitly unverified.',
        cardinality: `Closed enum, ${COLLECTOR_PLATFORMS.length} values.`,
        why_not_coarser:
            'The council resolution on `lifecycle-ci-runner-provisioning` narrows the public ' +
            'claim to the verified platform row, so a reading that cannot be attributed to a ' +
            'platform cannot support or refute that claim.',
    },
    occurred_on: {
        purpose: 'Attributes the record to a day inside the 21-day window of metric item 8.',
        cardinality: 'One UTC calendar date, `YYYY-MM-DD`. At most 63 distinct values per window.',
        why_not_coarser:
            'The window is counted in days, so a day is exactly the resolution the metric ' +
            'needs and no more. It is NOT a timestamp on purpose: a per-second time beside a ' +
            'stable `machine_id` reconstructs working hours, session length and idle gaps, ' +
            'which is the timestamp-plus-identifier leak class this schema refuses.',
    },
    collector_version: {
        purpose: 'Distinguishes a capture loss caused by a released defect from a host cause.',
        cardinality: 'One per released package version.',
        why_not_coarser:
            'Without it a regression in one release is averaged into the window and cannot ' +
            'be isolated to the version that caused it.',
    },
};

/** Field names the record accepts. Derived from the contract, never hand-listed. */
export const ALLOWED_FIELDS: ReadonlySet<string> = new Set(Object.keys(FIELD_PURPOSE));

export interface ValidationResult {
    ok: boolean;
    /** Every problem found, so one round-trip reports all of them. */
    errors: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date must be REAL, not merely date-SHAPED. `2026-99-99` matches the regex
 * above and is not a day; letting it through would put a record in no window at
 * all while looking well-formed. Round-tripping through `Date` is what
 * distinguishes the two — `2026-02-30` normalises to March and fails to match.
 */
function isRealDate(value: string): boolean {
    if (!DATE_RE.test(value)) {
        return false;
    }
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
/** RFC-4122 shape. The generator is local and random; this checks the FORM only. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a candidate record against the allowlist.
 *
 * An unknown key is an ERROR, never a silent drop — see the module docstring.
 */
export function validateRecord(candidate: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
        return { ok: false, errors: ['record must be a JSON object'] };
    }
    const rec = candidate as Record<string, unknown>;

    for (const key of Object.keys(rec)) {
        if (!ALLOWED_FIELDS.has(key)) {
            errors.push(
                `unknown field '${key}' — REJECTED, not dropped. Every field must be declared ` +
                    `in FIELD_PURPOSE with a purpose, a cardinality limit and why a coarser ` +
                    `form does not suffice.`,
            );
        }
    }
    for (const key of ALLOWED_FIELDS) {
        // `key in rec` is TRUE for a key present with an `undefined` value, and
        // every type guard below is `!== undefined`-gated — so testing presence
        // alone let `{ platform: undefined }` through with no constraint applied
        // at all. Explicit-undefined is treated as missing, which is what it is.
        if (!(key in rec) || rec[key] === undefined) {
            errors.push(`missing required field '${key}'`);
        }
    }

    if (rec.schema_version !== undefined && !Number.isInteger(rec.schema_version)) {
        errors.push('schema_version must be an integer');
    }
    for (const key of ['machine_id', 'episode_id'] as const) {
        const v = rec[key];
        if (v !== undefined && (typeof v !== 'string' || !UUID_RE.test(v))) {
            errors.push(
                `${key} must be a locally generated random UUID — a value derived from a ` +
                    `hostname, username or repository path is a pseudonym for it, not an ` +
                    `anonymous counting key`,
            );
        }
    }
    if (rec.event !== undefined && !(COLLECTOR_EVENTS as readonly string[]).includes(rec.event as string)) {
        errors.push(`event must be one of the ${COLLECTOR_EVENTS.length} declared hook events`);
    }
    if (rec.outcome !== undefined && !(COLLECTOR_OUTCOMES as readonly string[]).includes(rec.outcome as string)) {
        errors.push(`outcome must be one of: ${COLLECTOR_OUTCOMES.join(', ')}`);
    }
    if (
        rec.platform !== undefined &&
        !(COLLECTOR_PLATFORMS as readonly string[]).includes(rec.platform as string)
    ) {
        errors.push(`platform must be one of: ${COLLECTOR_PLATFORMS.join(', ')}`);
    }
    if (rec.sequence !== undefined && (!Number.isInteger(rec.sequence) || (rec.sequence as number) < 0)) {
        errors.push('sequence must be a non-negative integer');
    }
    if (rec.occurred_on !== undefined && (typeof rec.occurred_on !== 'string' || !isRealDate(rec.occurred_on))) {
        errors.push(
            'occurred_on must be a UTC calendar date (YYYY-MM-DD). A precise timestamp beside ' +
                'a stable machine_id is a behavioural fingerprint and is refused here.',
        );
    }
    if (rec.collector_version !== undefined && typeof rec.collector_version !== 'string') {
        errors.push('collector_version must be a string');
    }

    return { ok: errors.length === 0, errors };
}

/** The deduplication key of metric item 4. Read-time dedup; never write-time. */
export function dedupKey(rec: CollectorRecord): string {
    return `${rec.machine_id}|${rec.episode_id}|${rec.event}|${rec.sequence}`;
}
