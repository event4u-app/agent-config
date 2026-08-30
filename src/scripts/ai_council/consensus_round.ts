// The two-pass consensus round.
//
// Split out of `orchestrator.ts` in the change that made pass 1 conditional
// (Phase 1B, inline findings). `orchestrator.ts` sits ~750 lines past the
// 1500-line source-size ceiling, so the budget gate refuses new lines there —
// correctly: the fix for a bloated file is not a shorter comment, it is the
// concern moving out. This is the concern that moved, and it is the one the
// change actually edits.
//
// `orchestrator.ts` re-exports `run_consensus_scoring`, so every existing
// importer is untouched. The import of `consult` below closes a module cycle
// with that file; it is call-time, not init-time — nothing here runs at module
// load — which is the shape ESM resolves without a partial-initialization
// hazard.
import type { CouncilResponse, ExternalAIClient } from './clients.js';
import { DEFAULT_MAX_TOKENS } from './clients.js';
import type { Finding } from './consensus.js';
import {
    ConsensusBucket,
    FindingScore,
    aggregate_scores,
    anonymize_findings,
    bucket_by_threshold,
    parse_findings_outcome,
    parse_scores_response,
} from './consensus.js';
import type { RecordedExtractionOutcome } from './inline_findings.js';
import { takeInlineFindings } from './inline_findings.js';
import { consult } from './orchestrator.js';
import type { RunConsensusScoringOptions } from './orchestrator_results.js';
import { ConsensusResult, CouncilQuestion } from './orchestrator_results.js';
import { build_extraction_user_prompt, build_scoring_user_prompt } from './prompts.js';

/** Python `str.strip()` parity, as everywhere else in this package. */
const _pyStrip = (s: string): string => s.replace(/^\s+|\s+$/g, '');

/**
 * Two-pass consensus round (Phase 4 / F3).
 *
 * Pass 1 — extraction: each member re-emits its own deliberation as
 * a JSON array of `{id, text}` findings. Pass 2 — scoring: each
 * member sees the *other* members' findings under anonymous labels
 * and rates them 1-10 + agree/disagree + reason.
 *
 * The cost budget is shared across both passes; the daily ledger
 * receives both. Errors in one member's extraction or scoring tag
 * that member but never abort the round.
 */
export function run_consensus_scoring(
    members: ExternalAIClient[],
    deliberation_responses: CouncilResponse[],
    opts: RunConsensusScoringOptions = {},
): ConsensusResult {
    const budget = opts.budget ?? null;
    const table = opts.table ?? null;
    const on_overrun = opts.on_overrun ?? null;
    const project = opts.project ?? null;
    const original_ask = opts.original_ask ?? '';
    const max_tokens = opts.max_tokens ?? DEFAULT_MAX_TOKENS;
    const strong_threshold = opts.strong_threshold ?? 0.7;
    const minority_threshold = opts.minority_threshold ?? 0.4;
    const inline_extractions = opts.inline_extractions ?? null;

    if (members.length === 0 || deliberation_responses.length === 0) {
        return new ConsensusResult({
            bucket: new ConsensusBucket(),
            findings: [],
            scores: [],
            metadata: new Map(),
            extraction_responses: [],
            scoring_responses: [],
        });
    }

    // ── Pass 1: extraction ──────────────────────────────────────────
    const member_by_name = new Map<string, ExternalAIClient>();
    for (const m of members) {
        member_by_name.set(m.name, m);
    }
    const extraction_responses: CouncilResponse[] = [];
    const all_findings: Finding[] = [];
    // Per-member extraction outcome — step 2.2. Recorded rather than derived from the
    // findings count, because "zero findings" and "could not be read" are different facts
    // and the count cannot tell them apart. `parsed-after-reask` is kept distinct from
    // `parsed`: a member that needed a second ask is a signal about the prompt or the
    // member, and collapsing it into `parsed` would hide the only evidence that the
    // re-ask is doing anything.
    const parse_outcomes = new Map<string, RecordedExtractionOutcome>();
    for (const resp of deliberation_responses) {
        const member = member_by_name.get(resp.provider);
        if (member === undefined || resp.error || !_pyStrip(resp.text)) {
            continue;
        }
        const source = `${member.name}:${member.model}`;

        // Phase 1B replaces the second call, it does not delete it: no harvested
        // block → fall through to the extraction call over untouched text.
        if (takeInlineFindings(inline_extractions, source, parse_outcomes, all_findings)) {
            continue;
        }

        const question = new CouncilQuestion({
            mode: 'prompt',
            user_prompt: build_extraction_user_prompt(resp.text),
            max_tokens,
        });
        const extracted = consult([member], question, budget, {
            table,
            on_overrun,
            project,
            original_ask,
        });
        extraction_responses.push(...extracted);
        if (extracted.length === 0 || extracted[0]!.error) {
            continue;
        }
        let ex = parse_findings_outcome(extracted[0]!.text, { source });

        // Step 2.2 — ONE bounded re-ask on `parse_failed`, and one only.
        //
        // A member that said something no parser could read used to be indistinguishable
        // from a member that found nothing: `parse_findings_response` returned `[]` for
        // both, and this loop pushed the empty array with no branch. So an unparseable
        // answer counted as a clean zero-findings review.
        //
        // ONE re-ask, not a loop. A re-ask is a paid call, and an unbounded retry turns
        // one unparseable answer into open-ended spend — the failure mode the N=3
        // validation budget exists for, reached here by a different road. `empty` is NOT
        // re-asked: a member that said nothing has nothing to restate, and re-asking it
        // buys a second silence.
        if (ex.outcome === 'parse_failed') {
            const retry_q = new CouncilQuestion({
                mode: 'prompt',
                user_prompt:
                    build_extraction_user_prompt(resp.text) +
                    '\n\nYour previous answer could not be parsed. Reply with ONLY a JSON ' +
                    'array of {"id": string, "text": string} objects, no prose before or ' +
                    'after it. An empty array [] is a valid answer meaning you found nothing.',
                max_tokens,
            });
            const retried = consult([member], retry_q, budget, {
                table,
                on_overrun,
                project,
                original_ask,
            });
            extraction_responses.push(...retried);
            if (retried.length > 0 && !retried[0]!.error) {
                ex = parse_findings_outcome(retried[0]!.text, { source });
            }
            parse_outcomes.set(source, ex.outcome === 'parsed' ? 'parsed-after-reask' : 'parse_failed');
        } else {
            parse_outcomes.set(source, ex.outcome);
        }
        all_findings.push(...ex.findings);
    }

    if (all_findings.length === 0) {
        return new ConsensusResult({
            bucket: new ConsensusBucket(),
            findings: [],
            scores: [],
            metadata: new Map(),
            parse_outcomes,
            extraction_responses,
            scoring_responses: [],
        });
    }

    // ── Pass 2: scoring (each member rates the OTHERS' findings) ────
    const scoring_responses: CouncilResponse[] = [];
    const all_scores: FindingScore[] = [];
    for (const member of members) {
        const scorer = `${member.name}:${member.model}`;
        const others = all_findings.filter((f) => f.source !== scorer);
        if (others.length === 0) {
            continue;
        }
        const anon = anonymize_findings(others);
        const label_to_id = new Map<string, string>();
        const anon_text = new Map<string, string>();
        for (const [label, f] of anon) {
            label_to_id.set(label, f.id);
            anon_text.set(label, f.text);
        }
        const question = new CouncilQuestion({
            mode: 'prompt',
            user_prompt: build_scoring_user_prompt(anon_text),
            max_tokens,
        });
        const scored = consult([member], question, budget, {
            table,
            on_overrun,
            project,
            original_ask,
        });
        scoring_responses.push(...scored);
        if (scored.length === 0 || scored[0]!.error) {
            continue;
        }
        for (const s of parse_scores_response(scored[0]!.text, { scorer })) {
            const real_id = label_to_id.get(s.finding_id);
            if (real_id === undefined) {
                continue;
            }
            all_scores.push(
                new FindingScore(real_id, s.scorer, s.score, s.agree, s.reason),
            );
        }
    }

    const metadata = aggregate_scores(all_findings, all_scores);
    const bucket = bucket_by_threshold(all_findings, metadata, {
        strong: strong_threshold,
        minority: minority_threshold,
    });
    return new ConsensusResult({
        bucket,
        findings: all_findings,
        scores: all_scores,
        metadata,
        parse_outcomes,
        extraction_responses,
        scoring_responses,
    });
}
