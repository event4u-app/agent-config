/**
 * The two result bundles `orchestrator.ts` returns — extracted, a PURE MOVE.
 *
 * The reason is arithmetic. `orchestrator.ts` sits ~850 lines above the 1,500-line
 * ceiling, so `check_source_size_budget` refuses ANY net growth in it: Phases 1 and 2 of
 * `road-to-council-evidence-integrity` added 122 lines and the gate said so, correctly.
 * Raising the baseline is what that gate's own message calls a defect rather than a fix.
 *
 * These two classes are the cleanest movable unit in the file: they are data carriers with
 * no logic and no dependency on anything else in the orchestrator, so moving them changes
 * no behaviour. `orchestrator.ts` re-exports both, so every existing import path keeps
 * resolving.
 *
 * Extracting a data carrier rather than shaving the new documentation was the choice: the
 * alternative was compressing comments that explain WHY a per-reviewer map exists and why
 * the re-ask is bounded at one, which buys the same green from worse code.
 */
import type { CouncilResponse } from './clients.js';
import { DEFAULT_MAX_TOKENS } from './clients.js';
import type { CostBudget } from './spend_gate.js';
import type { PriceTable } from './pricing.js';
import type { ProjectContext } from './project_context.js';
// TYPE-ONLY back-import. `OnOverrunCallback` is declared in orchestrator.ts, which also
// imports types from here — legal and runtime-free, because both directions are erased.
// The alternative was leaving the two options interfaces behind, which would have meant
// finding 19 lines elsewhere for no design reason.
import type { OnOverrunCallback } from './orchestrator.js';
import type {
    ConsensusBucket,
    ConsensusMetadata,
    Finding,
    FindingScore,
    FindingsExtraction,
} from './consensus.js';
import type { RecordedExtractionOutcome } from './inline_findings.js';

/**
 * Bundle returned by `run_peer_review()` (Phase 5 / F1).
 *
 * `responses` carries the per-reviewer critiques. `label_to_source`
 * is the anonymisation map captured server-side so the audit-trail
 * JSON can rehydrate it without leaking provider identity to the
 * member at prompt time.
 *
 * `persona_labels` is the (optional) Phase 6 / Step 3a wiring: when
 * the deliberation was an advisor-mode run, the source → persona
 * map flows through to the renderer so peer-review output can render
 * as `Response A (Contrarian)`. Plain-member runs leave it empty.
 */
/**
 * One question put to the council. Moved here with the result bundles: it is the same
 * kind of thing — a data carrier with no logic — and `orchestrator.ts` re-exports it, so
 * every import path is unchanged.
 */
export class CouncilQuestion {
    mode: string; // one of: prompt, roadmap, diff, files
    user_prompt: string; // bundled artefact text
    max_tokens: number;

    constructor(args: { mode: string; user_prompt: string; max_tokens?: number }) {
        this.mode = args.mode;
        this.user_prompt = args.user_prompt;
        this.max_tokens = args.max_tokens ?? DEFAULT_MAX_TOKENS;
    }
}

export class PeerReviewResult {
    responses: CouncilResponse[];
    /**
     * PER-REVIEWER label→source attribution — the authoritative mapping.
     *
     * Keyed by `provider:model`, because that is the identity `by_source` uses and the
     * identity a quote in the artefact has to resolve against. Added by step 1.2 of
     * `road-to-council-evidence-integrity`: each reviewer sees a DIFFERENT
     * self-filtered subset, and `anonymize_responses` restarts its label counter per
     * call, so `Response-A` means a different member for every reviewer. One map
     * cannot express that.
     */
    label_to_source_by_reviewer: Map<string, Map<string, string>>;
    /**
     * Flat compatibility view — the LAST reviewer's mapping, kept only because
     * `council_cli.ts:1480` serialises this field and `:1492` reads it back.
     *
     * It is wrong for any reviewer but the last, and it is retained rather than
     * removed so the serialisation contract does not break in the same change that
     * fixes the attribution. Read `label_to_source_by_reviewer` for anything that
     * resolves a quote.
     */
    label_to_source: Map<string, string>;
    persona_labels: Map<string, string>;

    constructor(args: {
        responses: CouncilResponse[];
        label_to_source_by_reviewer?: Map<string, Map<string, string>>;
        label_to_source: Map<string, string>;
        persona_labels: Map<string, string>;
    }) {
        this.responses = args.responses;
        this.label_to_source_by_reviewer = args.label_to_source_by_reviewer ?? new Map();
        this.label_to_source = args.label_to_source;
        this.persona_labels = args.persona_labels;
    }
}

/**
 * Bundle returned by `run_consensus_scoring()`.
 *
 * `bucket` is renderer-ready; `findings`, `scores`, and `metadata`
 * are kept for audit-trail JSON (council-sessions/*.json).
 */
export class ConsensusResult {
    bucket: ConsensusBucket;
    findings: Finding[];
    scores: FindingScore[];
    metadata: Map<string, ConsensusMetadata>;
    /**
     * Per-member extraction outcome, keyed by `provider:model` — step 2.2 of
     * `road-to-council-evidence-integrity`.
     *
     * `parsed` · `parsed-after-reask` · `empty` · `parse_failed`. Recorded rather than
     * derived from the findings count, because "found nothing" and "could not be read"
     * are different facts and a count cannot tell them apart — which is exactly how an
     * unparseable answer used to read as a clean zero-findings review.
     *
     * `parsed-after-reask` is deliberately distinct from `parsed`: a member needing a
     * second ask is a signal about the prompt or the member, and folding it into `parsed`
     * would hide the only evidence that the re-ask does anything.
     *
     * Additive and optional, so no existing constructor call changes.
     */
    parse_outcomes: Map<string, RecordedExtractionOutcome>;
    extraction_responses: CouncilResponse[];
    scoring_responses: CouncilResponse[];

    constructor(args: {
        bucket: ConsensusBucket;
        findings: Finding[];
        scores: FindingScore[];
        metadata: Map<string, ConsensusMetadata>;
        parse_outcomes?: Map<string, RecordedExtractionOutcome>;
        extraction_responses: CouncilResponse[];
        scoring_responses: CouncilResponse[];
    }) {
        this.bucket = args.bucket;
        this.findings = args.findings;
        this.scores = args.scores;
        this.metadata = args.metadata;
        this.parse_outcomes = args.parse_outcomes ?? new Map();
        this.extraction_responses = args.extraction_responses;
        this.scoring_responses = args.scoring_responses;
    }
}

export interface RunPeerReviewOptions {
    budget?: CostBudget | null;
    table?: PriceTable | null;
    on_overrun?: OnOverrunCallback | null;
    project?: ProjectContext | null;
    original_ask?: string;
    max_tokens?: number;
    persona_labels?: Map<string, string> | null;
}

export interface RunConsensusScoringOptions {
    budget?: CostBudget | null;
    table?: PriceTable | null;
    on_overrun?: OnOverrunCallback | null;
    project?: ProjectContext | null;
    original_ask?: string;
    max_tokens?: number;
    strong_threshold?: number;
    minority_threshold?: number;
    /**
     * Phase 1B: findings already harvested from each member's own deliberation
     * reply by `harvest_inline_findings`, keyed `provider:model`. A member with
     * an entry skips the separate extraction call entirely; a member without one
     * takes the shipped extraction path unchanged. Absent → extraction-always,
     * call-for-call identical to today.
     *
     * A pre-computed map rather than a boolean because the harvest must run
     * BEFORE peer review and synthesis read the responses, which is upstream of
     * this function — see `harvest_inline_findings` for why that ordering is
     * load-bearing.
     */
    inline_extractions?: ReadonlyMap<string, FindingsExtraction> | null;
}
