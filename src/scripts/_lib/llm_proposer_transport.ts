/**
 * The metered transport for the LLM proposer arm — one provider, one call shape.
 *
 * `road-to-governed-evidence-production` step 2.1. Deliberately a SEPARATE file
 * from `_lib/llm_candidate_proposer.ts`: the arm holds the role constraint and
 * must stay transport-free so it can be exercised with a stub, and the transport
 * holds the one thing a reviewer has to read whole before money moves.
 *
 * ## What this file may and may not do
 *
 * It may send a prompt and return the text that came back. It may not score,
 * rank, filter, or select — and structurally it cannot: {@link GenerationResult}
 * has no field that could carry a judgement, and this module never sees more
 * than one request at a time. The narrowed park admits exactly this role; see
 * `docs/contracts/metered-proposer-protocol.md`.
 *
 * ## The model per tier is PINNED TO A DATED ID, or refused
 *
 * A frozen execution protocol whose model is a floating alias is not frozen: the
 * alias moves and a later run answers a different question. So {@link TIER_MODEL}
 * carries dated ids only, and the `high` tier is deliberately `null` because no
 * dated `claude-opus-4-1-*` id exists anywhere in this tree to pin it to.
 * Requesting `high` therefore REFUSES with a message naming what has to be
 * pinned first, rather than resolving an alias and calling the protocol frozen.
 *
 * `high` is reachable only through an `execution_failed` escalation
 * (`_lib/evolution_roi.ts:128`), so a run that never hits a transport error
 * never touches it.
 *
 * ## Nothing here has been executed
 *
 * As of the commit that adds it, this module has made zero live calls. Its
 * request shape is proven by {@link describeRequest}, which returns exactly what
 * would be sent without sending it, and by a unit test over that description.
 * The live path is unexercised, and saying so is cheaper than implying a probe
 * that the park forbids.
 */

import { load_anthropic_key } from '../ai_council/clients.js';
import type {
    GenerationRequest,
    GenerationResult,
    TextGenerator,
} from './llm_candidate_proposer.js';
import type { ModelTier } from './evolution_roi.js';

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Dated model id per tier, or `null` where this tree pins none.
 *
 * The two dated ids are the ones already used elsewhere in this repository
 * (`src/scripts/rdp_gate_classify.ts:66`, `src/scripts/bench_ab_v2_run.ts`), so
 * they are not invented here.
 */
export const TIER_MODEL: Readonly<Record<ModelTier, string | null>> = {
    lite: 'claude-haiku-4-5-20251001',
    medium: 'claude-sonnet-4-5-20250929',
    high: null,
};

/** Sampling parameters. Frozen with the protocol; not tuned per run. */
export const MAX_TOKENS = 8192;
export const TEMPERATURE = 0;

export class TransportRefusedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TransportRefusedError';
    }
}

/** The model id for a tier, or a refusal naming what must be pinned. */
export function modelForTier(tier: ModelTier): string {
    const model = TIER_MODEL[tier];
    if (model === null) {
        throw new TransportRefusedError(
            `tier '${tier}' has no dated model id pinned in TIER_MODEL, so it cannot be sent: a ` +
                'floating alias would make the frozen execution protocol answer a different ' +
                'question on a later run. Pin a dated id and record it in ' +
                'docs/contracts/metered-proposer-protocol.md before using this tier',
        );
    }
    return model;
}

/** The exact HTTP request body a call would carry. Sends nothing. */
export function describeRequest(req: GenerationRequest): {
    url: string;
    model: string;
    body: Record<string, unknown>;
} {
    const model = modelForTier(req.tier);
    return {
        url: ANTHROPIC_URL,
        model,
        body: {
            model,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE,
            system: req.system,
            messages: [{ role: 'user', content: req.prompt }],
        },
    };
}

/** Rough token estimate for a dry-run cost line. Characters over four. */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

interface AnthropicResponse {
    content?: Array<{ type?: string; text?: string }>;
}

/**
 * Bind the metered port to the Anthropic messages API.
 *
 * The key is read at CALL time rather than at module load, so importing this
 * module — which the tests do — never touches the filesystem for a credential
 * and never fails on a machine that has none.
 */
export function anthropicGenerator(keyPath: string | null = null): TextGenerator {
    return async (req: GenerationRequest): Promise<GenerationResult> => {
        const described = describeRequest(req);
        const key = load_anthropic_key(keyPath);
        const resp = await fetch(described.url, {
            method: 'POST',
            headers: {
                'x-api-key': key,
                'anthropic-version': ANTHROPIC_VERSION,
                'content-type': 'application/json',
            },
            body: JSON.stringify(described.body),
        });
        if (!resp.ok) {
            throw new TransportRefusedError(
                `${described.model} returned HTTP ${String(resp.status)}: ${(await resp.text()).slice(0, 300)}`,
            );
        }
        const data = (await resp.json()) as AnthropicResponse;
        const text = (data.content ?? [])
            .filter((b) => b.type === 'text')
            .map((b) => b.text ?? '')
            .join('');
        // An empty body is returned AS an empty body rather than repaired here.
        // The arm's own output contract refuses it and classifies the refusal;
        // repairing it in the transport would move a decision into the layer
        // that is supposed to have none.
        return { text, model: described.model };
    };
}
