/**
 * Warm-worker reuse decision — pure, no I/O.
 *
 * The caller reaches this only after the in-session and lookup rungs have
 * declined to stay in-session; it answers one question for one candidate
 * worker: re-task it (`resume`) or spawn cold (`fresh`). Every condition is an
 * input, so no prose sets a number and the decision object can be replayed.
 *
 * The register of workers is a VIEW: callers derive each {@link WorkerState}
 * from the subagent ledger and the worker's transcript at decision time, and
 * address the worker by its durable name. Nothing here is a store, and no
 * field can hold the host's opaque per-run token — the ledger refuses to write
 * one for the same reason.
 */
import { validateCapsule, type WorkerCapsule } from './subagent_capsule.js';

export type ReuseClass = 'continuity' | 'never';

/** One candidate worker as derived at decision time. */
export interface WorkerState {
    /** Durable name — the only address a resume uses. */
    name: string;
    /** Domain the durable name encodes. */
    domain: string;
    /** From the worker's definition; `never` for judges and reviewers. */
    reuse: ReuseClass;
    last_request_at_ms: number;
    /** The worker's effective cache TTL. */
    cache_ttl_ms: number;
    /** Tokens currently in the worker's transcript. */
    transcript_tokens: number;
    /** The worker's capsule watermark (`worker_budget.watermarkForTier`). */
    capsule_watermark_tokens: number;
    /** A compaction boundary appears in the transcript. */
    compacted: boolean;
    /** Workspace facts recorded at the worker's last stop. */
    worktree: string;
    branch_head: string;
    skill_set_signature: string;
    /** Installed package version at the worker's last stop — the policy epoch. */
    package_version: string;
}

/** The dispatch being decided, with the current workspace facts. */
export interface ReuseContext {
    domain: string;
    now_ms: number;
    /**
     * Observed median first-call cost of a FRESH run of this definition, from
     * the cache-realization report. `null` when none was observed; a resume is
     * then refused rather than compared against an invented constant.
     */
    observed_fresh_cold_start_tokens: number | null;
    worktree: string;
    branch_head: string;
    skill_set_signature: string;
    package_version: string;
}

export const REFUSAL_REASONS = [
    'domain_mismatch',
    'cache_ttl_expired',
    'transcript_over_cold_start',
    'no_observed_cold_start',
    'over_capsule_watermark',
    'compacted',
    'workspace_changed',
    'not_continuity',
    'policy_epoch_changed',
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

/**
 * Reasons that retire a worker rather than merely skip it: the task is still
 * this worker's, but its context is no longer worth paying for, so a successor
 * is briefed from its capsule. A domain mismatch or a `never` definition is a
 * different task or a judge, and spawns plain fresh.
 */
export const RETIRING_REASONS: readonly RefusalReason[] = [
    'cache_ttl_expired',
    'transcript_over_cold_start',
    'no_observed_cold_start',
    'over_capsule_watermark',
    'compacted',
    'workspace_changed',
    'policy_epoch_changed',
];

export interface WorkerReuseDecision {
    verdict: 'resume' | 'fresh';
    /** The worker to re-task on `resume`; `null` on `fresh`. */
    name: string | null;
    /** Every failing condition, in condition order; empty on `resume`. */
    reasons: RefusalReason[];
    inputs: { worker: WorkerState; context: ReuseContext };
}

export function decideWorkerReuse(worker: WorkerState, context: ReuseContext): WorkerReuseDecision {
    const reasons: RefusalReason[] = [];
    if (worker.domain !== context.domain) reasons.push('domain_mismatch');
    if (context.now_ms - worker.last_request_at_ms >= worker.cache_ttl_ms) reasons.push('cache_ttl_expired');
    if (context.observed_fresh_cold_start_tokens === null) reasons.push('no_observed_cold_start');
    else if (worker.transcript_tokens >= context.observed_fresh_cold_start_tokens) reasons.push('transcript_over_cold_start');
    if (worker.transcript_tokens >= worker.capsule_watermark_tokens) reasons.push('over_capsule_watermark');
    if (worker.compacted) reasons.push('compacted');
    if (
        worker.worktree !== context.worktree ||
        worker.branch_head !== context.branch_head ||
        worker.skill_set_signature !== context.skill_set_signature
    ) {
        reasons.push('workspace_changed');
    }
    if (worker.reuse !== 'continuity') reasons.push('not_continuity');
    if (worker.package_version !== context.package_version) reasons.push('policy_epoch_changed');

    return {
        verdict: reasons.length === 0 ? 'resume' : 'fresh',
        name: reasons.length === 0 ? worker.name : null,
        reasons,
        inputs: { worker, context },
    };
}

/** Names of the workers that would be re-tasked for this dispatch, in input order. */
export function eligibleWorkers(workers: readonly WorkerState[], context: ReuseContext): string[] {
    return workers.filter((w) => decideWorkerReuse(w, context).verdict === 'resume').map((w) => w.name);
}

/**
 * Reasons the shadow guard can record before any worker is compared: the host
 * offers no resume, no worker register was recorded, or the register is empty.
 * An unrecorded register is NOT an empty one — conflating them would let a
 * missing writer read as "no worker was ever eligible".
 */
export type ShadowPreconditionReason = 'host_resume_unobserved' | 'worker_register_unrecorded' | 'no_candidate';

export type ShadowReuseVerdict =
    | { verdict: 'would_resume'; name: string; reasons: [] }
    | { verdict: 'fresh'; name: null; reasons: Array<RefusalReason | ShadowPreconditionReason> };

export interface ShadowReuseInput {
    /** The host row's `worker_resume`; false means nothing below is read. */
    host_resume: boolean;
    /** The register view, or null when none was recorded. */
    workers: readonly WorkerState[] | null;
    context: ReuseContext | null;
}

/**
 * The verdict `spawn-guard-shadow` records for one spawn: the first eligible
 * worker by name, or `fresh` with every candidate's refusal reasons, each once,
 * in condition order.
 */
export function shadowReuseVerdict(input: ShadowReuseInput): ShadowReuseVerdict {
    if (!input.host_resume) return { verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] };
    if (input.workers === null || input.context === null) {
        return { verdict: 'fresh', name: null, reasons: ['worker_register_unrecorded'] };
    }
    if (input.workers.length === 0) return { verdict: 'fresh', name: null, reasons: ['no_candidate'] };
    const seen = new Set<RefusalReason>();
    for (const w of input.workers) {
        const d = decideWorkerReuse(w, input.context);
        if (d.verdict === 'resume' && d.name !== null) return { verdict: 'would_resume', name: d.name, reasons: [] };
        for (const r of d.reasons) seen.add(r);
    }
    return { verdict: 'fresh', name: null, reasons: REFUSAL_REASONS.filter((r) => seen.has(r)) };
}

export type SuccessorBrief =
    | { kind: 'resume'; name: string }
    | { kind: 'fresh' }
    | { kind: 'successor'; predecessor: string; generation: number; capsule: WorkerCapsule }
    | { kind: 'stop-loss'; predecessor: string; errors: string[] };

/**
 * What the orchestrator does with a decision. A retired worker's successor is
 * briefed from the predecessor's `worker` capsule; a missing or invalid
 * capsule never briefs one and falls back to the stop-loss path loudly.
 */
export function briefSuccessor(decision: WorkerReuseDecision, capsule: WorkerCapsule | null): SuccessorBrief {
    if (decision.verdict === 'resume' && decision.name !== null) return { kind: 'resume', name: decision.name };
    if (!decision.reasons.some((r) => RETIRING_REASONS.includes(r))) return { kind: 'fresh' };
    if (decision.reasons.includes('domain_mismatch') || decision.reasons.includes('not_continuity')) {
        return { kind: 'fresh' };
    }
    const predecessor = decision.inputs.worker.name;
    if (capsule === null) return { kind: 'stop-loss', predecessor, errors: ['no capsule from the retired worker'] };
    const errors = validateCapsule(capsule);
    if (errors.length > 0) return { kind: 'stop-loss', predecessor, errors };
    return { kind: 'successor', predecessor, generation: capsule.generation + 1, capsule };
}
