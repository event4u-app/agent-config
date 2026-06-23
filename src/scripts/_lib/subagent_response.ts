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

export type Confidence = 'low' | 'medium' | 'high';

export interface Finding {
    title: string;
    /** Refs (file:line / id / path) backing this finding — never inline bodies. */
    evidence_refs?: string[];
    /** Does acting on this finding mutate files / state? */
    mutating?: boolean;
}

export interface SubagentResponse {
    summary: string;
    findings: Finding[];
    risks: string[];
    confidence: Confidence;
    handoff: string;
}

const CONFIDENCE: ReadonlySet<string> = new Set<Confidence>(['low', 'medium', 'high']);

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
