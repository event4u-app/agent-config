/**
 * The Class-A self-repair shadow (road-to-org-telemetry Phase 5, step 5.1).
 *
 * One function, called from `self_repair_hook.ts` immediately after a defect
 * is queued. It emits a structural record saying that a defect of a named
 * class occurred — never what happened.
 *
 * WHY THIS IS NOT A CONCERN OF ITS OWN. The event it reacts to is not a host
 * event; it is "the self-repair store just accepted a record". Binding a
 * second concern to the same two slots would re-run the detectors to find out
 * whether the first one wrote anything, so the emission belongs at the seam
 * where the answer is already in hand.
 *
 * WHAT IT CANNOT LEAK, BY CONSTRUCTION. `ClassADefectRecord` has no field able
 * to hold free-form text. `DefectFinding.evidence` (a quoted span of the
 * offending text) and `suggested_surface` (a free sentence) are the Class-B
 * payload and are not passed to the builder at all — not sanitized, not
 * truncated, not optional. There is no scrubber here because there is nothing
 * for a scrubber to fail on.
 *
 * DEFAULT-OFF on the same terms as every other telemetry writer: `active`
 * needs `enabled` AND an endpoint AND an org id AND a salt, none of which this
 * public repository ships a value for. Inactive means zero file operations.
 *
 * NEVER THROWS. The caller wraps it, and the store write has already
 * succeeded by the time it runs; a telemetry failure must not cost the user
 * their turn or their queued defect.
 */
import * as os from 'node:os';
import * as path from 'node:path';

import {
    append_class_a_record,
    build_class_a_defect_record,
} from '../../agent-src/templates/scripts/telemetry/remote.js';
import {
    FLUSH_SESSION_END,
    spool_path_for,
} from '../../agent-src/templates/scripts/telemetry/transport.js';
import { DEFECT_CLASSES, type DefectRecord } from '../_lib/self_repair.js';
import { is_replay_mode } from './state_io.js';
import {
    extractDisciplineProfile,
    extractPackageVersion,
    readSettingsFor,
} from './telemetry_usage_hook.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

/** Host id off the dispatcher envelope, or `null` when it carried none. */
export function hostOf(env: JsonObject): string | null {
    const v = str(env['platform']) || str(env['host']);
    return v === '' ? null : v;
}

/** The host session id, hashed downstream and never recorded raw. */
export function sessionIdOf(env: JsonObject): string {
    return str(env['session_id']) || str(env['sessionId']);
}

export type ShadowOutcome =
    | 'inactive'
    | 'replay'
    | 'unknown-class'
    | 'written'
    | 'failed';

/**
 * Emit the shadow for one queued defect. Returns what it did, for tests —
 * the caller ignores it.
 */
export function emitDefectShadow(
    root: string,
    rec: DefectRecord,
    env: JsonObject,
): ShadowOutcome {
    try {
        const { settings, text, root: projectRoot } = readSettingsFor(root);
        if (!settings.active) return 'inactive';
        if (is_replay_mode()) return 'replay';

        // The vocabulary is pinned in `self_repair.ts` and mirrored into the
        // upstream issue form by test. A class outside it means a detector was
        // added without the rest of its registration; recording it would put
        // an unpinned value into an org's record set, so it is dropped and the
        // local queue keeps the defect regardless.
        if (!(DEFECT_CLASSES as readonly string[]).includes(rec.defect_class)) {
            return 'unknown-class';
        }

        const record = build_class_a_defect_record({
            defect_class: rec.defect_class,
            defect_source: rec.source,
            occurrences: rec.occurrences,
            host: hostOf(env),
            org_id: settings.org_id,
            salt: settings.salt,
            hostname: os.hostname(),
            username: os.userInfo().username,
            session_id: sessionIdOf(env),
            package_version: extractPackageVersion(process.env),
            discipline_profile: extractDisciplineProfile(text),
        });

        const logPath = path.isAbsolute(settings.log_path)
            ? settings.log_path
            : path.join(projectRoot, settings.log_path);
        const spool = settings.flush === FLUSH_SESSION_END ? spool_path_for(logPath) : null;
        append_class_a_record(
            logPath,
            record,
            {
                max_age_days: settings.retention_max_age_days,
                max_bytes: settings.retention_max_bytes,
            },
            new Date(),
            spool,
        );
        return 'written';
    } catch {
        return 'failed';
    }
}
