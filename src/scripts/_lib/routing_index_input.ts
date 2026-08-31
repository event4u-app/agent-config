/**
 * routing_index_input — what the skill index is built OVER, derived from the
 * 5.1 verdict file (`road-to-governed-harness-evolution` step 6.5).
 *
 * Step 6.5 reads: *"Index the body only if 5.1 measured a signal. Otherwise
 * description-only. verify: the indexer`s input set derives from the 5.1
 * verdict file."*
 *
 * SO THE ANSWER IS NOT WRITTEN HERE. This module contains no opinion about the
 * body. It opens
 * `agents/evidence/analysis/routing-body-signal-verdict.json`, reads
 * `body_signal.verdict`, and returns the input set that verdict licenses. Flip
 * the file and the input set flips; delete the file and it falls back. A module
 * that hardcoded `description` would satisfy the step`s OUTCOME today and fail
 * its verify, because the outcome would not derive from anything.
 *
 * FAIL-CLOSED, IN THE DIRECTION THAT COSTS LESS. Missing file, unparseable
 * JSON, unknown verdict token, or a missing `proxy_to_real_fidelity` field all
 * resolve to **description-only** with the reason recorded. Only the literal
 * token `signal` widens the index. The asymmetry is deliberate: a stale or
 * broken record must never be able to widen what the suite indexes, and the
 * measured cost of widening on a `harmful` verdict is +7.22 pp of false
 * activation.
 *
 * WHY THE FIDELITY FIELD GATES THE READ. The 5.1 verdict ships its own bound —
 * `proxy_to_real_fidelity`, null and unmeasured-by-construction — precisely so
 * a consumer cannot take the conclusion without it. A record that has lost that
 * field is a record whose provenance has been edited, and this resolver refuses
 * it rather than trusting the half that survived.
 *
 * Pure of network and of clock; reads one file.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Where step 5.1 writes its machine-readable verdict. */
export const VERDICT_REL = 'agents/evidence/analysis/routing-body-signal-verdict.json';

/** The two input sets step 6.5 can resolve to. Ordered, so they are comparable. */
export const DESCRIPTION_ONLY = ['name', 'description'] as const;
export const DESCRIPTION_AND_BODY = ['name', 'description', 'body'] as const;

export interface IndexInput {
    readonly fields: readonly string[];
    /** The token read from the verdict file, or `null` when none could be read. */
    readonly verdict: string | null;
    readonly reason: string;
    /** `true` only when the verdict file licensed the wider set. */
    readonly indexesBody: boolean;
}

const descriptionOnly = (verdict: string | null, reason: string): IndexInput => ({
    fields: DESCRIPTION_ONLY,
    verdict,
    reason,
    indexesBody: false,
});

/**
 * The input set the 5.1 verdict at `repoRoot` licenses.
 *
 * `verdictPath` exists so a test can point the resolver at a fixture record
 * instead of writing to the tracked one.
 */
export function resolveIndexInput(repoRoot: string, verdictPath?: string): IndexInput {
    const file = verdictPath ?? path.join(repoRoot, VERDICT_REL);
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch {
        return descriptionOnly(null, `no readable 5.1 verdict at ${VERDICT_REL} — fail-closed`);
    }
    if (parsed['proxy_to_real_fidelity'] === undefined) {
        return descriptionOnly(
            null,
            'the 5.1 verdict carries no proxy_to_real_fidelity bound — refused, fail-closed',
        );
    }
    const body = parsed['body_signal'];
    const token =
        typeof body === 'object' && body !== null
            ? (body as Record<string, unknown>)['verdict']
            : undefined;
    if (typeof token !== 'string') {
        return descriptionOnly(null, 'the 5.1 verdict carries no body_signal.verdict — fail-closed');
    }
    if (token === 'signal') {
        return {
            fields: DESCRIPTION_AND_BODY,
            verdict: token,
            reason: 'the 5.1 verdict is `signal` — the body is indexed',
            indexesBody: true,
        };
    }
    return descriptionOnly(token, `the 5.1 verdict is \`${token}\`, not \`signal\` — description-only`);
}

/** The `Arm` name the routing corpus uses for the resolved input set. */
export function resolveIndexArm(
    repoRoot: string,
    verdictPath?: string,
): 'description' | 'description+body' {
    return resolveIndexInput(repoRoot, verdictPath).indexesBody ? 'description+body' : 'description';
}
