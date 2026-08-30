/**
 * Experience cards — the `kind: experience` variant of the knowledge card.
 *
 * **Where these live, and why it was a decision.** AI council 2026-08-30,
 * anthropic + openai, 2/2 convergent: they live in `agents/knowledge/`
 * alongside external-source cards, as a STRICT TAGGED UNION on a required
 * `kind` field — never as one schema with conditional fields.
 *
 * The distinction the council insisted on is the whole design. Making the
 * external card's checks (authoritative pointer, pointer resolution,
 * git-ancestry across `source_version`s) *optional* would hide two contracts
 * inside one nominal schema, which is the union-of-what-producers-send failure
 * this repository refuses elsewhere. Making them **variant invariants** — they
 * apply, in full, to `kind: external` and are not part of the `experience`
 * variant at all — keeps one contract per variant and one directory.
 *
 * The reusable boundary the council left behind, recorded so the next proposal
 * is measured against it rather than re-argued: *a new store is justified only
 * when its records cannot share the existing carrier's identity, discovery path
 * and consumer lifecycle — not merely because they have different provenance or
 * validation rules.* Experience cards share all three, so they are a variant.
 */

/**
 * How a card's statement was arrived at.
 *
 * The split is load-bearing rather than descriptive: `observed` and `derived`
 * are FACTUAL — something happened, or follows from something that happened —
 * while `inferred` and `hypothesized` are GENERATIVE. Only the factual pair may
 * act as a hard filter; the generative pair may at most reduce ranking weight.
 * Letting a hypothesis filter is how a guess becomes a rule without anyone
 * deciding it should.
 */
export const EPISTEMIC_TYPES = ['observed', 'derived', 'inferred', 'hypothesized'] as const;
export type EpistemicType = (typeof EPISTEMIC_TYPES)[number];

/** Only a factual statement may exclude a candidate outright. */
export function mayHardFilter(t: EpistemicType): boolean {
    return t === 'observed' || t === 'derived';
}

/**
 * The promotion ladder. A card starts at `session` and climbs one rung at a
 * time; `repo` is the last rung reachable on the evidence that produced it.
 */
export const CARD_SCOPES = ['session', 'repo', 'workspace', 'organization', 'global'] as const;
export type CardScope = (typeof CARD_SCOPES)[number];

/** Where the evidence for a promotion came from. */
export const EVIDENCE_POOLS = ['development', 'held-out', 'independent'] as const;
export type EvidencePool = (typeof EVIDENCE_POOLS)[number];

/**
 * A card is admissible only from the mining gate or an explicit seed. Never
 * invented, and never pre-seeded as a family of plausible-looking entries.
 */
export interface CardProvenance {
    /**
     * A pattern id from `extract_audit_patterns`, which mints a pattern only at
     * count >= 2 across INDEPENDENT `work_id`s. One run repeating itself is not
     * a pattern.
     */
    pattern_ref?: string;
    /** An explicit `### SEED —` block a human wrote. */
    seed_ref?: string;
}

export interface ExperienceCard {
    kind: 'experience';
    id: string;
    scope: CardScope;
    /** When this card applies. Id-shaped tokens, never prose. */
    trigger_context: string[];
    /** What to do. One compact statement. */
    strategy: string;
    /**
     * What would show this card is wrong. REQUIRED, and the field that makes a
     * card a claim rather than an opinion: a card with no falsifier can never
     * be retired on evidence, only on taste.
     */
    falsifier: string;
    confidence: 'low' | 'medium' | 'high';
    /** Card ids this one contradicts. Recorded, never silently resolved. */
    contradictions: string[];
    /** Card ids this one replaces. */
    supersedes: string[];
    /**
     * ISO date after which this card must be re-checked. REQUIRED: an
     * unexpiring empirical claim outlives the conditions that produced it and
     * nobody notices, because nothing ever asks.
     */
    expiry: string;
    epistemic_type: EpistemicType;
    provenance: CardProvenance;
    /** Cases where the strategy failed. Narrows the card; never widens it. */
    anti_patterns: string[];
}

export class CardContractError extends Error {}

/** Admissible iff it carries a mining-gate pattern or a human seed. */
export function isAdmissible(p: CardProvenance): boolean {
    return (
        (typeof p.pattern_ref === 'string' && p.pattern_ref.trim().length > 0) ||
        (typeof p.seed_ref === 'string' && p.seed_ref.trim().length > 0)
    );
}

/** Fields whose absence makes a card inadmissible, in the order a linter reports them. */
export const REQUIRED_CARD_FIELDS = [
    'id',
    'scope',
    'trigger_context',
    'strategy',
    'falsifier',
    'confidence',
    'contradictions',
    'supersedes',
    'expiry',
    'epistemic_type',
] as const;

export interface CardFailure {
    /** What went wrong, id-shaped. */
    anti_pattern: string;
    /**
     * Present only when the failure is being used to argue the card applies
     * MORE widely. That is the move this type exists to refuse.
     */
    widen_scope_to?: CardScope;
}

/**
 * Fold a failure into a card.
 *
 * **A failure narrows; it never widens.** The temptation is real and specific:
 * a card fails in a neighbouring context, and the natural-sounding repair is
 * "so the card is really about the broader case". That reasoning turns every
 * piece of disconfirming evidence into an expansion, which is the exact inverse
 * of what evidence is for. A failure adds an anti-pattern and nothing else.
 */
export function applyFailure(card: ExperienceCard, failure: CardFailure): ExperienceCard {
    if (failure.widen_scope_to !== undefined) {
        throw new CardContractError(
            `a failure may not widen scope (${card.scope} -> ${failure.widen_scope_to}). ` +
                'A failure adds an anti-pattern; it never extends applicability. ' +
                'Widening on disconfirming evidence is the inverse of what evidence is for.',
        );
    }
    return { ...card, anti_patterns: [...card.anti_patterns, failure.anti_pattern] };
}

export interface PromotionEvidence {
    pool: EvidencePool;
}

/**
 * Promote one rung.
 *
 * Two refusals, and they answer the two ways a card gets over-promoted:
 *
 * 1. **One level at a time.** A two-level raise skips the rung where the card
 *    would have been checked against a wider population.
 * 2. **Past `repo` needs evidence the card did not produce.** The runs that
 *    minted a card cannot also demonstrate it transfers — that is the same data
 *    answering its own question. Above `repo`, the evidence must be held-out or
 *    independent.
 */
export function promote(
    card: ExperienceCard,
    target: CardScope,
    evidence: PromotionEvidence,
): ExperienceCard {
    const from = CARD_SCOPES.indexOf(card.scope);
    const to = CARD_SCOPES.indexOf(target);
    if (to - from !== 1) {
        throw new CardContractError(
            `promotion moves exactly one rung: ${card.scope} -> ${target} is ${to - from}. ` +
                'A skipped rung is a population the card was never checked against.',
        );
    }
    if (to > CARD_SCOPES.indexOf('repo') && evidence.pool === 'development') {
        throw new CardContractError(
            `raising past repo scope needs held-out or independent evidence; got '${evidence.pool}'. ` +
                'The runs that produced a card cannot also show it transfers.',
        );
    }
    return { ...card, scope: target };
}

// ---------------------------------------------------------------------------
// Admission and duplicate checks — the linter's pure core
// ---------------------------------------------------------------------------

import { jaccardSimilarity } from './text_similarity.js';

export interface CardViolation {
    card_id: string;
    code:
        | 'not-admissible'
        | 'missing-field'
        | 'unknown-epistemic-type'
        | 'unknown-scope'
        | 'duplicates-rule';
    detail: string;
}

/**
 * Everything a card must satisfy to be admissible, in one pass.
 *
 * `rules` is a map of live rule id -> its text. Passed IN rather than read
 * here: this stays pure so the duplicate threshold can be tested against
 * synthetic text instead of against whatever the rule corpus happens to say
 * today.
 */
export function checkCard(
    card: Partial<ExperienceCard> & { id?: string },
    rules: ReadonlyMap<string, string> = new Map(),
    duplicateThreshold = DUPLICATE_THRESHOLD,
): CardViolation[] {
    const id = card.id ?? '<unnamed>';
    const out: CardViolation[] = [];

    for (const f of REQUIRED_CARD_FIELDS) {
        const v = (card as Record<string, unknown>)[f];
        const empty =
            v === undefined ||
            v === null ||
            (typeof v === 'string' && v.trim().length === 0) ||
            (Array.isArray(v) && f === 'trigger_context' && v.length === 0);
        if (empty) out.push({ card_id: id, code: 'missing-field', detail: f });
    }

    if (card.epistemic_type !== undefined && !(EPISTEMIC_TYPES as readonly string[]).includes(card.epistemic_type)) {
        out.push({ card_id: id, code: 'unknown-epistemic-type', detail: String(card.epistemic_type) });
    }
    if (card.scope !== undefined && !(CARD_SCOPES as readonly string[]).includes(card.scope)) {
        out.push({ card_id: id, code: 'unknown-scope', detail: String(card.scope) });
    }
    if (card.provenance === undefined || !isAdmissible(card.provenance)) {
        out.push({
            card_id: id,
            code: 'not-admissible',
            detail: 'needs a pattern_ref from the mining gate or an explicit seed_ref — never invented',
        });
    }

    // A card is not a rule: empirical, scoped and probabilistic versus
    // normative. One that restates a live rule adds no knowledge and creates a
    // second place the same instruction can drift.
    const text = `${card.strategy ?? ''} ${(card.trigger_context ?? []).join(' ')}`.trim();
    if (text.length > 0) {
        for (const [ruleId, ruleText] of rules) {
            if (jaccardSimilarity(text, ruleText) >= duplicateThreshold) {
                out.push({
                    card_id: id,
                    code: 'duplicates-rule',
                    detail: `restates the live rule '${ruleId}' — a card is not a rule`,
                });
            }
        }
    }
    return out;
}

/**
 * Similarity at or above which a card is treated as restating a rule.
 *
 * Stated as a named constant rather than inlined so it is one number a reviewer
 * can argue with, and so the tests exercise the same value the linter uses.
 */
export const DUPLICATE_THRESHOLD = 0.6;
