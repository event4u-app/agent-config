/**
 * The global user-memory audit render — Phase 4 of road-to-global-user-memory
 * ("delete, revoke, audit"). Renders what the GLOBAL layer currently holds —
 * `~/.event4u/agent-config/user/profile.md` and its `observations.jsonl`
 * buffer — without requiring a human to open raw JSONL. This is the global
 * layer only, not the merged effective profile `/agents user show` already
 * renders (project-local `.agent-user.md` never leaves the project it lives
 * in, so it has nothing to audit at this layer).
 *
 * Every free-text value that ever originated from a buffered observation or
 * a profile field — `suggest`, `evidence`, `project_name`, a profile field's
 * string value, a tombstone's `reason` — is routed through the SAME
 * `knowledge_global_redaction.redaction_scan` gate the write path already
 * runs (Phase 2's `evaluateCaptureGuards` /
 * `evaluateContextCaptureGuards`) before it may appear in the rendered
 * output. That gate's `project_path` category already flags absolute-path
 * shapes (`/Users/`, `/home/`, `/opt/`, `/private/`, a configured
 * `repo_root`) in free text, so a stray path mentioned inside an
 * observation's own `suggest`/`evidence` text is caught the same way a
 * credential or an email would be — this module never needs a second path
 * detector. The only path-shaped strings this render ever emits verbatim
 * are the two canonical, tool-owned storage locations (`profilePath`,
 * `bufferPath`) it resolves itself — never a value that came from
 * user-authored or agent-authored content. `context.project_path` (a raw
 * project directory, one of the fields road-to-global-user-memory Phase 3
 * flagged as a narrower-but-real metadata surface) is never read by this
 * module at all — only `context.project_name` (already a basename) ever
 * reaches the render, and it still passes the same scan.
 *
 * Pure, read-only. Never writes to `profile.md`, the buffer, or the
 * revocation ledger.
 */
import { redaction_scan } from './knowledge_global_redaction.js';
import {
    getPath,
    loadGlobalProfileLayer,
    mergeUserProfileLayers,
    resolveGlobalProfilePath,
} from './agent_user_profile.js';
import * as revocations from './user_global_revocations.js';
import {
    ALLOWED_OBSERVATION_FIELDS,
    findPromotionCandidates,
    readGlobalObservations,
    resolveGlobalObservationsPath,
} from './user_global_observations.js';
import type { ObservationField } from './user_global_observations.js';
import type * as user_global_paths from './user_global_paths.js';

const REDACTED_MARKER = '[redacted]';

/** `true` when `text` fails the write-path redaction gate — the sole criterion for masking a render value. */
function _isClean(text: string): boolean {
    return redaction_scan(text).length === 0;
}

/** Redact `text` if it fails the same gate the write path already runs; pass through unchanged otherwise. */
function _safe(text: string): string {
    return _isClean(text) ? text : REDACTED_MARKER;
}

/** Render a parsed profile leaf value (string, string[], or other scalar) as a redaction-checked display string. */
function _renderFieldValue(value: unknown): string {
    if (Array.isArray(value)) {
        return _safe(value.map((v) => String(v)).join(', '));
    }
    return _safe(String(value));
}

export interface AuditProfileField {
    readonly path: string;
    readonly value: string;
}

export interface AuditBufferFieldCount {
    readonly field: string;
    readonly count: number;
}

export interface AuditPromotionCandidate {
    readonly suggest: string;
    readonly seenCount: number;
    readonly projects: readonly string[];
}

export interface GlobalMemoryAuditRender {
    readonly profilePath: string | null;
    readonly profileExists: boolean;
    readonly profileLastUpdated: string | undefined;
    readonly profileFields: readonly AuditProfileField[];
    readonly bufferPath: string | null;
    readonly bufferEntryCount: number;
    readonly bufferFieldCounts: readonly AuditBufferFieldCount[];
    readonly promotionCandidates: readonly AuditPromotionCandidate[];
    readonly revocationCount: number;
    /** Pre-formatted, print-ready block — every value already passed the redaction gate above. */
    readonly text: string;
}

/**
 * Build the audit render for the global layer. `env` is honoured exactly
 * like every other global-artefact reader (`$EVENT4U_CONFIG_HOME`, the
 * legacy `~/.config/agent-config/` fallback) — tests MUST inject it rather
 * than touch the real `~/.event4u/`.
 */
export function renderGlobalMemoryAudit(
    options: { env?: user_global_paths.EnvMap | null } = {},
): GlobalMemoryAuditRender {
    const env = options.env ?? null;

    const profileLayer = loadGlobalProfileLayer(env);
    const merged = mergeUserProfileLayers(profileLayer, null);
    const profilePath = resolveGlobalProfilePath(env);
    const profileFields: AuditProfileField[] = Object.keys(merged.sources)
        .sort()
        .map((dottedPath) => ({
            path: dottedPath,
            value: _renderFieldValue(getPath(merged.profile, dottedPath.split('.'))),
        }));
    const profileLastUpdated =
        typeof profileLayer?.data.last_updated === 'string' ? profileLayer.data.last_updated : undefined;

    const bufferPath = resolveGlobalObservationsPath(env);
    const { entries } = readGlobalObservations({ env });
    const fieldCounts = new Map<ObservationField, number>();
    for (const entry of entries) {
        if ((ALLOWED_OBSERVATION_FIELDS as readonly string[]).includes(entry.field)) {
            const field = entry.field as ObservationField;
            fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
        }
    }
    const bufferFieldCounts: AuditBufferFieldCount[] = [...fieldCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([field, count]) => ({ field, count }));

    const promotionCandidates: AuditPromotionCandidate[] = findPromotionCandidates(entries).map((c) => ({
        suggest: _safe(c.observation.suggest),
        seenCount: c.seenCount,
        projects: c.projects.map((p) => _safe(p)),
    }));

    const revocationCount = revocations.loadTombstones(env).length;

    const lines: string[] = [];
    lines.push('Global user-memory audit');
    lines.push('');
    lines.push(`Profile: ${profilePath ?? '(none — no observation has been accepted yet)'}`);
    if (profileFields.length === 0) {
        lines.push('  (no fields set)');
    } else {
        for (const field of profileFields) {
            lines.push(`  ${field.path}: ${field.value}`);
        }
    }
    if (profileLastUpdated !== undefined) {
        lines.push(`  last_updated: ${profileLastUpdated}`);
    }
    lines.push('');
    lines.push(`Buffer: ${bufferPath ?? '(none — no observation has been buffered yet)'} (${entries.length} entries)`);
    if (bufferFieldCounts.length === 0) {
        lines.push('  (empty)');
    } else {
        for (const fc of bufferFieldCounts) {
            lines.push(`  ${fc.field}: ${fc.count}×`);
        }
    }
    lines.push('');
    lines.push(`Promotion candidates (seen_count ≥ 3): ${promotionCandidates.length}`);
    for (const candidate of promotionCandidates) {
        lines.push(`  "${candidate.suggest}" — seen in ${candidate.seenCount} projects (${candidate.projects.join(', ')})`);
    }
    lines.push('');
    lines.push(`Revocation ledger: ${revocationCount} tombstone(s)`);

    return {
        profilePath,
        profileExists: profileLayer !== null,
        profileLastUpdated,
        profileFields,
        bufferPath,
        bufferEntryCount: entries.length,
        bufferFieldCounts,
        promotionCandidates,
        revocationCount,
        text: lines.join('\n'),
    };
}
