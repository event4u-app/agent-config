/**
 * One answer envelope for every answer surface. The agent receives the answer,
 * its counts, whether it is complete, what cut it, how sure it is, which graph
 * it came from, at most five `file:line` witnesses and at most three next
 * commands — never a file dump.
 *
 * Budgets are on the SERIALIZED envelope (O15): `hint` 250 tokens (ids only),
 * `concise` 800 (the default), `detailed` 2,000 (the ceiling). Items are packed
 * by a budget search in their given order; what does not fit is counted, not
 * hidden. A content-addressed `packet_id` with a TTL lets a subagent receive
 * the same answer by reference.
 */
import { createHash } from 'node:crypto';

import { gpt_tokens } from '../_lib/token_count.js';

export type AnswerFormat = 'hint' | 'concise' | 'detailed';

export const FORMAT_BUDGET: Readonly<Record<AnswerFormat, number>> = { hint: 250, concise: 800, detailed: 2000 };
export const MAX_EVIDENCE = 5;
export const MAX_NEXT = 3;
export const PACKET_TTL_SECONDS = 3600;

export interface AnswerItem {
    /** the stable id a later fetch uses */
    id: string;
    /** one line; dropped in `hint` */
    text?: string;
}

export interface Witness {
    generation: string | null;
    commit: string | null;
    staleness: 'fresh' | 'stale' | 'unknown';
    /** the command that re-checks this answer against the live tree */
    confirm: string | null;
}

export interface AnswerEnvelope {
    answer: AnswerItem[];
    counts: { shown: number; total: number; text_only: number };
    complete: boolean;
    truncated_by: 'budget' | 'limit' | null;
    confidence: 'high' | 'medium' | 'low';
    witness: Witness;
    evidence: string[];
    next: string[];
    packet_id: string;
    ttl_seconds: number;
    format: AnswerFormat;
    /** a header shown when the budget cut the answer */
    notice?: string;
}

export interface EnvelopeInput {
    items: readonly AnswerItem[];
    /** the true total when `items` is already a page of a larger set */
    total?: number;
    confidence: AnswerEnvelope['confidence'];
    witness: Witness;
    evidence?: readonly string[];
    next?: readonly string[];
    /** items that carry text but no id a fetch could open */
    textOnly?: number;
}

export const envelopeTokens = (e: AnswerEnvelope): number => gpt_tokens(JSON.stringify(e)).tokens;

const packetId = (items: readonly AnswerItem[], witness: Witness): string => `pk_${createHash('sha256').update(JSON.stringify([items, witness.commit, witness.generation])).digest('hex').slice(0, 16)}`;

const EVIDENCE = /^[^\s:]+:\d+$/;

export function makeEnvelope(input: EnvelopeInput, format: AnswerFormat = 'concise'): AnswerEnvelope {
    const budget = FORMAT_BUDGET[format];
    const shape = (it: AnswerItem): AnswerItem => (format === 'hint' || it.text === undefined ? { id: it.id } : { id: it.id, text: it.text });
    const total = Math.max(input.total ?? input.items.length, input.items.length);
    const base = (shown: AnswerItem[], truncated: AnswerEnvelope['truncated_by']): AnswerEnvelope => ({
        answer: shown,
        counts: { shown: shown.length, total, text_only: input.textOnly ?? 0 },
        complete: shown.length === total,
        truncated_by: shown.length === total ? null : truncated,
        confidence: input.confidence,
        witness: input.witness,
        evidence: (input.evidence ?? []).filter((e) => EVIDENCE.test(e)).slice(0, format === 'hint' ? 0 : MAX_EVIDENCE),
        next: (input.next ?? []).slice(0, MAX_NEXT),
        packet_id: packetId(input.items, input.witness),
        ttl_seconds: PACKET_TTL_SECONDS,
        format,
        ...(shown.length === total ? {} : { notice: `showing ${shown.length} of ${total} — narrow your question, or ask for format detailed` }),
    });
    const all = input.items.map(shape);
    const full = base(all, input.total !== undefined && input.total > all.length ? 'limit' : null);
    if (envelopeTokens(full) <= budget) return full;
    // Largest prefix that fits: binary search on the item count.
    let lo = 0;
    let hi = all.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (envelopeTokens(base(all.slice(0, mid), 'budget')) <= budget) lo = mid;
        else hi = mid - 1;
    }
    const packed = base(all.slice(0, lo), 'budget');
    if (envelopeTokens(packed) <= budget) return packed;
    // Even the header is over budget: drop evidence and next commands, keep the counts.
    return { ...packed, evidence: [], next: packed.next.slice(0, 1) };
}

/** Structural check of an envelope from any producer; returns the problems found. */
export function validateEnvelope(e: AnswerEnvelope): string[] {
    const problems: string[] = [];
    if (!(e.format in FORMAT_BUDGET)) problems.push(`unknown format ${String(e.format)}`);
    else if (envelopeTokens(e) > FORMAT_BUDGET[e.format]) problems.push(`over the ${e.format} budget: ${envelopeTokens(e)} > ${FORMAT_BUDGET[e.format]} tok`);
    if (e.counts.shown !== e.answer.length) problems.push('counts.shown differs from the answer length');
    if (e.counts.total < e.counts.shown) problems.push('counts.total is below counts.shown');
    if (e.complete !== (e.counts.shown === e.counts.total)) problems.push('complete disagrees with the counts');
    if (!e.complete && e.truncated_by === null) problems.push('an incomplete answer names no truncation');
    if (e.evidence.length > MAX_EVIDENCE || e.evidence.some((x) => !EVIDENCE.test(x))) problems.push('evidence must be at most five file:line entries');
    if (e.next.length > MAX_NEXT) problems.push('at most three next commands');
    if (!/^pk_[0-9a-f]{16}$/.test(e.packet_id)) problems.push('packet_id is not content-addressed');
    if (e.format === 'hint' && e.answer.some((a) => a.text !== undefined)) problems.push('hint carries ids only');
    return problems;
}
