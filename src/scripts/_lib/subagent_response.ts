/**
 * Structured subagent-response envelope + synthesis helpers (Phase 3 / A3).
 *
 * Pure, no-I/O. Pins the body a subagent returns inside the 4-status envelope
 * (the status stays the envelope; this is the body) and gives the orchestrator
 * the synthesis duties: surface evidence gaps, and force the full cross-model
 * judge when a mutating finding is low-confidence.
 *
 * Contract: `src/agent-src/contexts/execution/subagent-response-contract.md`.
 */

import { validateAssumption, type CapsuleAssumption } from './subagent_capsule.js';

export type Confidence = 'low' | 'medium' | 'high';

export interface Finding {
    title: string;
    /** Refs (file:line / id / path) backing this finding — never inline bodies. */
    evidence_refs?: string[];
    /** Does acting on this finding mutate files / state? */
    mutating?: boolean;
}

// ── Committed envelope size caps (road-to-token-economy-dispatch Phase 6.1) ──
// The envelope is the ONLY return channel: a worker's full result lands on
// disk (runtime artifact dir, gitignored) and the envelope carries paths +
// verdict + a BOUNDED summary. Without caps, transcript-shaped output flows
// back into the orchestrator context and refunds the isolation win — the
// measured spawn floor is ~251k tokens; a capped envelope is ≤ ~3k. Caps are
// validator ERRORS, never silent truncation (never-silent discipline): an
// oversized envelope is rejected loudly and the author shortens it.
/** Max chars for the summary — bounded prose, not a transcript. */
export const MAX_SUMMARY_CHARS = 2000;
/** Max chars for one line-shaped field (handoff, a risk, a finding title). */
export const MAX_RESPONSE_LINE_CHARS = 240;
/** Max entries per array (findings, risks, artifact_paths) — mirrors the capsule. */
export const MAX_RESPONSE_ENTRIES = 40;
/** Max chars for one artifact path ref. Mirrors the capsule's ref cap. */
export const MAX_ARTIFACT_REF_CHARS = 200;
/** Committed max for the WHOLE serialized envelope (~3k tokens ceiling). */
export const MAX_ENVELOPE_CHARS = 12000;

export interface SubagentResponse {
    summary: string;
    findings: Finding[];
    risks: string[];
    confidence: Confidence;
    handoff: string;
    /**
     * Where the worker's FULL results live on disk (runtime artifact dir,
     * gitignored) — the orchestrator consumes from these paths on demand,
     * never via wholesale transcript ingestion (Phase 6.1/6.2). Ref tokens
     * only, capped like every other array.
     */
    artifact_paths?: string[];
    /**
     * Premises the worker acted on, `{statement, basis, epistemic_state}` —
     * the same shape and the same validator as the CHECKPOINT capsule
     * (`subagent_capsule.ts`), so the completed-result and handoff surfaces
     * cannot drift apart. Optional: absent means not recorded, which is not
     * the same claim as "no assumptions were made".
     */
    assumptions?: CapsuleAssumption[];
}

const CONFIDENCE: ReadonlySet<string> = new Set<Confidence>(['low', 'medium', 'high']);

/**
 * The five fields `validateResponse` REQUIRES. Exported so the ledger's
 * classifier counts contract fields against the validator's own list rather
 * than a second copy that can drift from it.
 *
 * The optional fields (`artifact_paths`, `assumptions`) are deliberately NOT
 * here. The boundary this list defines is "did the author aim at the envelope
 * at all", and it is calibrated against a recorded measurement: every `fail`
 * in the live ledger carries `error_count: 5`, which is exactly the count of
 * required-field errors an object with none of them produces. Counting an
 * optional field as a hit would break that equivalence, so an object carrying
 * only `assumptions` reads as foreign — recorded here as a known edge, not as
 * an oversight.
 */
export const RESPONSE_REQUIRED_FIELDS: readonly string[] = [
    'summary',
    'handoff',
    'confidence',
    'findings',
    'risks',
];

/**
 * How many required contract fields are PRESENT on a decoded object.
 *
 * Presence, never validity: a `summary: 123` is a contract attempt with a
 * wrong type, which is a different defect from a fenced tool call that never
 * aimed at the envelope. That distinction is the whole point of the count —
 * `validateResponse` already reports the type errors.
 */
export function countContractFields(input: unknown): number {
    if (input === null || typeof input !== 'object') return 0;
    const r = input as Record<string, unknown>;
    return RESPONSE_REQUIRED_FIELDS.filter((k) => Object.hasOwn(r, k)).length;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/** Validate the envelope shape. Counts/refs only — reject inline-body evidence. */
export function validateResponse(input: unknown): ValidationResult {
    const errors: string[] = [];
    if (input === null || typeof input !== 'object') {
        return { valid: false, errors: ['response is not an object'] };
    }
    const r = input as Record<string, unknown>;
    if (typeof r.summary !== 'string') errors.push('summary missing or not a string');
    if (typeof r.handoff !== 'string') errors.push('handoff missing or not a string');
    if (!CONFIDENCE.has(r.confidence as string)) errors.push(`confidence must be low|medium|high (got ${String(r.confidence)})`);
    if (!Array.isArray(r.findings)) errors.push('findings missing or not an array');
    if (!Array.isArray(r.risks)) errors.push('risks missing or not an array');
    if (Array.isArray(r.findings)) {
        for (const [i, f] of (r.findings as Finding[]).entries()) {
            if (!f || typeof f.title !== 'string') errors.push(`finding[${i}] missing title`);
            const refs = f?.evidence_refs;
            if (refs && refs.some((x) => typeof x !== 'string' || x.includes('\n'))) {
                errors.push(`finding[${i}] evidence_refs must be ref tokens, not bodies`);
            }
        }
    }
    if (r.assumptions !== undefined) {
        if (!Array.isArray(r.assumptions)) {
            errors.push('assumptions must be an array of {statement, basis, epistemic_state}');
        } else {
            for (const [i, a] of (r.assumptions as unknown[]).entries()) {
                errors.push(...validateAssumption(a, `assumptions[${i}]`));
            }
        }
    }
    // ── Committed size caps (Phase 6.1) — errors, never silent truncation ──
    if (typeof r.summary === 'string' && r.summary.length > MAX_SUMMARY_CHARS) {
        errors.push(`summary is ${r.summary.length} chars (max ${MAX_SUMMARY_CHARS}) — the envelope carries a bounded summary; the full result belongs on disk (artifact_paths)`);
    }
    if (typeof r.handoff === 'string' && r.handoff.length > MAX_RESPONSE_LINE_CHARS) {
        errors.push(`handoff is ${r.handoff.length} chars (max ${MAX_RESPONSE_LINE_CHARS})`);
    }
    for (const [key, arr] of [
        ['findings', r.findings],
        ['risks', r.risks],
        ['artifact_paths', r.artifact_paths],
    ] as const) {
        if (Array.isArray(arr) && arr.length > MAX_RESPONSE_ENTRIES) {
            errors.push(`${key} carries ${arr.length} entries (max ${MAX_RESPONSE_ENTRIES}) — an envelope is a handoff, not a transcript`);
        }
    }
    if (Array.isArray(r.risks)) {
        for (const [i, risk] of (r.risks as unknown[]).entries()) {
            if (typeof risk === 'string' && risk.length > MAX_RESPONSE_LINE_CHARS) {
                errors.push(`risks[${i}] is ${risk.length} chars (max ${MAX_RESPONSE_LINE_CHARS})`);
            }
        }
    }
    if (Array.isArray(r.findings)) {
        for (const [i, f] of (r.findings as Finding[]).entries()) {
            if (f && typeof f.title === 'string' && f.title.length > MAX_RESPONSE_LINE_CHARS) {
                errors.push(`finding[${i}] title is ${f.title.length} chars (max ${MAX_RESPONSE_LINE_CHARS})`);
            }
        }
    }
    if (r.artifact_paths !== undefined) {
        if (!Array.isArray(r.artifact_paths)) {
            errors.push('artifact_paths must be an array of path ref tokens');
        } else {
            for (const [i, p] of (r.artifact_paths as unknown[]).entries()) {
                if (typeof p !== 'string' || p.includes('\n') || p.length > MAX_ARTIFACT_REF_CHARS) {
                    errors.push(`artifact_paths[${i}] must be a single-line path ref ≤ ${MAX_ARTIFACT_REF_CHARS} chars`);
                }
            }
        }
    }
    try {
        const serialized = JSON.stringify(input);
        if (serialized.length > MAX_ENVELOPE_CHARS) {
            errors.push(`envelope serializes to ${serialized.length} chars (max ${MAX_ENVELOPE_CHARS}) — move content to disk and reference it via artifact_paths`);
        }
    } catch {
        errors.push('envelope is not JSON-serializable');
    }
    return { valid: errors.length === 0, errors };
}

/**
 * Synthesis gaps the orchestrator must resolve before adopting the response:
 * a finding with no evidence ref is an unbacked claim to re-check.
 */
export function synthesisGaps(response: SubagentResponse): string[] {
    const gaps: string[] = [];
    for (const f of response.findings) {
        if (!f.evidence_refs || f.evidence_refs.length === 0) {
            gaps.push(`finding "${f.title}" has no evidence — re-check before adopting`);
        }
    }
    return gaps;
}

/**
 * Confidence → verify-budget link. A mutating finding returned at `low`
 * confidence forces the full cross-model judge (no deterministic-only pass).
 * Returns true when the full judge is mandatory for this finding.
 */
export function forcesJudge(f: Finding, confidence: Confidence): boolean {
    return f.mutating === true && confidence === 'low';
}
