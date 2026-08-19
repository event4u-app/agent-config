/**
 * response_render — the per-member meta line, and the one-call helper.
 *
 * Both are plumbing the orchestrator uses rather than orchestration, and both
 * were extracted when the mid-flight fallback grew them: `orchestrator.ts` is
 * ~1,000 lines over the source ceiling, and the documented response to growing
 * an over-ceiling file is extraction, never a raised baseline
 * (`gate-violation-baselines.json` § check_source_size_budget).
 */

import { CouncilResponse, type ExternalAIClient } from './clients.js';

/**
 * The shape `callMember` reads off a question. Structural rather than an
 * import of `CouncilQuestion`: that class lives in `orchestrator.ts`, and
 * importing it back would make this extraction a cycle.
 */
interface QuestionShape {
    readonly user_prompt: string;
    readonly max_tokens: number;
}

function _metaGet(d: Record<string, unknown>, k: string, dflt: unknown): unknown {
    const v = d[k];
    return v === undefined ? dflt : v;
}

/** Round half-to-even to `n` decimals, matching CPython's `format(x, ".nf")`. */
type FixedFn = (x: number, n: number) => string;

export interface MetaRenderDeps {
    readonly pyFixed: FixedFn;
}

export function renderResponseMeta(r: CouncilResponse, deps: MetaRenderDeps): string {
    const meta_dict: Record<string, unknown> = r.metadata ?? {};
    const billable = Boolean(_metaGet(meta_dict, 'billable', true));
    const estimated = Boolean(_metaGet(meta_dict, 'tokens_estimated', false));
    const parts: string[] = [];
    if (!billable) {
        const label = (_metaGet(meta_dict, 'subscription_label', null) ||
            'flat-rate') as string;
        parts.push(`cost: subscription (${label})`);
    } else {
        const cost_usd = _metaGet(meta_dict, 'cost_usd', undefined);
        if (typeof cost_usd === 'number' && !(typeof cost_usd === 'boolean')) {
            parts.push(`cost: $${deps.pyFixed(cost_usd, 4)}`);
        }
        const prefix = estimated ? '~' : '';
        parts.push(
            `tokens: ${prefix}${r.input_tokens} in / ${prefix}${r.output_tokens} out`,
        );
    }
    parts.push(`${r.latency_ms} ms`);
    // A seat that answered over api because its cli transport died says so
    // in the ARTEFACT, not only in metadata: otherwise the only visible
    // difference from "was api all along" is a cost line nobody planned.
    const fallback_from = _metaGet(meta_dict, 'fallback_from', null);
    if (typeof fallback_from === 'string' && fallback_from !== '') {
        const reason = _metaGet(meta_dict, 'fallback_reason', null);
        const sticky = _metaGet(meta_dict, 'fallback_sticky', false) === true;
        const why = typeof reason === 'string' && reason !== '' ? `: ${reason}` : '';
        parts.push(
            sticky
                ? `transport: api (${fallback_from} lost earlier this pass${why})`
                : `transport: api (fell back from ${fallback_from}${why})`,
        );
    }
    return `*${parts.join(' · ')}*`;
}


/** Error-tagged member call — the split/ask branch is one shape, not three. */
/**
 * One member call, error-tagged rather than throwing — the split/ask branch
 * appeared three times before this and is one shape, not three.
 */
export function callMember(
    client: ExternalAIClient,
    question: QuestionShape,
    opts: { split?: { stable: string; suffix: string } | null },
    systemFor: (m: ExternalAIClient) => string,
    excTag: (e: unknown) => string,
): CouncilResponse {
    try {
        return opts.split
            ? client.ask_split(
                  systemFor(client),
                  opts.split.stable,
                  opts.split.suffix,
                  question.max_tokens,
              )
            : client.ask(systemFor(client), question.user_prompt, question.max_tokens);
    } catch (exc) {
        return new CouncilResponse({
            provider: client.name,
            model: client.model,
            text: '',
            error: excTag(exc),
        });
    }
}

