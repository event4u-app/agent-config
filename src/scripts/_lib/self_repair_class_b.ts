/**
 * The Class-B path (road-to-org-telemetry Phase 5, step 5.2).
 *
 * Class A is the automatic half: structural fields, no content, shipped under
 * recorded org consent. Class B is an abstracted CASE — what was expected
 * versus what happened, and which artefacts were involved — and it ships only
 * on explicit per-case approval of the exact text that would leave.
 *
 * THE GATE IS THE HUMAN READING THE OUTBOUND TEXT, NOT A FILTER. Rank 1 of the
 * roadmap risk register is "an abstraction miss ships a path or an identifier
 * out of a consumer project", and its stated mitigation is per-case review of
 * the exact outbound text rather than a filter heuristic. So this module's job
 * is to make the exact bytes visible and then refuse to release them unless the
 * approval names those same bytes. `approve` takes a digest of the rendered
 * text; a text that changed after the human read it no longer matches, and the
 * release refuses rather than shipping something nobody approved.
 *
 * SILENT SHIPPING IS PERMANENTLY OUT OF SCOPE, and the step says so in those
 * words. There is deliberately no "auto-approve", no allow-list of
 * self-evidently safe classes, and no timeout that approves by default.
 *
 * TWO EXISTING PRIMITIVES ARE REUSED RATHER THAN RE-INVENTED:
 *  - `renderReport` is "the existing symptom format" the step names.
 *  - `egressBlockedReason` is the audited privacy floor — the same one the
 *    local corpus write and the upstream release already pass through. It
 *    REFUSES rather than rewriting, which is the property that makes it a gate;
 *    a module that silently scrubbed and shipped would be a soft gate wearing
 *    a hard gate's name.
 *
 * WHAT THIS MODULE DOES NOT DO: send anything. Transport and sink-side storage
 * are Phase 5 step 5.3, transferred with `sink-choice` — no sink exists for an
 * approved case to travel to. `ClassBRecord` is therefore built, gated and
 * held; the field that carries the text is `case_text` and it is a typed
 * member of a typed record, never a string interpolated into a prompt.
 */
import * as crypto from 'node:crypto';

import {
    type DefectRecord,
    egressBlockedReason,
    renderReport,
} from './self_repair.js';

/** Schema version for the Class-B envelope, independent of Class A. */
export const CLASS_B_SCHEMA_VERSION = 1;

/**
 * One approved case.
 *
 * `case_text` is the ONLY free-form member and it exists on purpose: Class B
 * is defined as an abstracted case, so a Class-B record without text would be
 * a Class-A record. The controls are that it is (a) a named, typed field
 * rather than an open `payload`, (b) present only after `approve` matched a
 * digest a human read, and (c) documented as data end to end — see
 * `assertNeverInterpolated`.
 */
export interface ClassBRecord {
    schema_version: number;
    record_class: 'case';
    /** Detector / intake class, from the pinned vocabulary. */
    defect_class: string;
    /** Fingerprint of the local record this case abstracts. */
    fingerprint: string;
    /** SHA-256 of `case_text`, so a consumer can verify what was approved. */
    case_digest: string;
    /** The abstracted case, exactly as the human approved it. */
    case_text: string;
}

export type ClassBRefusal =
    | { ok: false; reason: string; kind: 'privacy-floor' | 'digest-mismatch' | 'empty' };

export type ClassBResult = { ok: true; record: ClassBRecord } | ClassBRefusal;

/** SHA-256 hex of the exact bytes a human is asked to approve. */
export function caseDigest(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

/**
 * Render the exact outbound text for one record, or refuse.
 *
 * Refusal comes from the audited privacy floor and is returned as a reason
 * string for the caller to show. It is NOT downgraded to a scrub-and-continue:
 * a record whose evidence trips the floor stays local, which is the same
 * verdict the upstream release path already reaches.
 */
export function renderCase(
    record: DefectRecord,
    repoRoot?: string | null,
): { ok: true; text: string; digest: string } | ClassBRefusal {
    const blocked = egressBlockedReason(record, repoRoot ?? null);
    if (blocked !== null) {
        return { ok: false, reason: blocked, kind: 'privacy-floor' };
    }
    // `issue` is the route whose rendering carries no patch and no repository
    // path — the narrowest of the existing shapes, and the right one for a
    // case that travels to a telemetry sink rather than to a code host.
    const text = renderReport(record, 'issue');
    if (text.trim() === '') {
        return { ok: false, reason: 'nothing to send', kind: 'empty' };
    }
    return { ok: true, text, digest: caseDigest(text) };
}

/**
 * Approve one rendered case for release.
 *
 * `approved_digest` is what the human saw. If the text has changed since —
 * a new occurrence folded in, a re-render, anything — the digests differ and
 * this refuses. That is the difference between approving a case and approving
 * a category.
 */
export function approve(
    record: DefectRecord,
    text: string,
    approved_digest: string,
): ClassBResult {
    const actual = caseDigest(text);
    if (actual !== approved_digest) {
        return {
            ok: false,
            kind: 'digest-mismatch',
            reason:
                'the approved text is not the text that would be sent — '
                + 're-render, read it again, and approve the new digest',
        };
    }
    return {
        ok: true,
        record: {
            schema_version: CLASS_B_SCHEMA_VERSION,
            record_class: 'case',
            defect_class: record.defect_class,
            fingerprint: record.fingerprint,
            case_digest: actual,
            case_text: text,
        },
    };
}

/**
 * Serialise an approved case as ONE JSON object.
 *
 * This is the whole of "quoted, typed data" (step 5.3's repository-side half):
 * the text is a JSON string value, so a downstream reader parses it into a
 * field. Nothing here concatenates it into a sentence, a prompt, or a shell
 * argument, and rank 2 of the risk register — a crafted complaint steering a
 * generated change — is what that discipline is for.
 */
export function serialiseCase(record: ClassBRecord): string {
    return JSON.stringify(record);
}

/**
 * Guard for a downstream consumer: refuse a prompt-shaped use of case text.
 *
 * Deliberately a narrow, honest tool. It cannot stop a caller that never asks;
 * what it does is give the generation step in Phase 6 something to call, so
 * "reads taxonomy fields only, never Class-B free text" is a check rather than
 * a convention. The intended use is at the boundary where a record becomes
 * model input.
 */
export function assertNeverInterpolated(candidate: string, record: ClassBRecord): void {
    if (record.case_text !== '' && candidate.includes(record.case_text)) {
        throw new Error(
            'Class-B case text must reach a model as quoted data, never as part '
            + 'of an instruction string — pass the record, not a concatenation',
        );
    }
}
