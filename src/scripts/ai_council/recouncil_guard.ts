/**
 * The re-council guard — warn before paying twice for one deliberation.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 1A. The
 * phase's own framing is the design constraint: *"the cheapest quality
 * improvement is not paying twice for the same deliberation"*, and it sits
 * before any sophisticated routing on purpose.
 *
 * FOUR CONSTRAINTS FROM THE STEPS, EACH LOAD-BEARING:
 *
 *   1A.1 Reuse the EXISTING question hash. `_sha256_hex` is imported from
 *        `blind_review.ts`, not reimplemented — two hashes of one question are
 *        two answers to "is this the same question", and the second is the one
 *        nobody updates.
 *   1A.2 WARN, NEVER PROHIBIT. {@link RecouncilVerdict} carries no field a
 *        caller could read as a block, which is stronger than a documented
 *        promise not to block: there is nothing to misread.
 *   1A.3 Near-duplicate detection on the ALREADY-IMPORTED similarity
 *        mechanism — `trigrams` from `_lib/lexical_index.ts`, the BM25 core
 *        ADR-061 already sanctions. No embeddings, no new infrastructure. The
 *        threshold is PRE-REGISTERED below, before any tuning on the retained
 *        corpus.
 *   1A.4 Three states, distinguishable: exact + same config, exact + stale
 *        config, near-duplicate.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { jaccardSimilarity, MERGE_THRESHOLD } from '../_lib/text_similarity.js';
import { _sha256_hex } from './blind_review.js';

/**
 * The near-duplicate threshold — and it is REUSED, not chosen.
 *
 * Step 1A.3 asks for the threshold to be pre-registered before any tuning on
 * the retained local corpus. `MERGE_THRESHOLD` in `_lib/text_similarity.ts` is
 * already that: fixed by an AI-council verdict of 2026-07-05 as the point at
 * which two texts are treated as duplicates, long before this guard existed and
 * with no knowledge of the council-question corpus it is now applied to. A
 * number nobody could have tuned against this corpus is the strongest form of
 * pre-registration available, and re-declaring `0.8` here would fork it — the
 * same defect 1A.1 forbids for the hash.
 *
 * `revisit-if`: the retained corpus produces a false positive at this value
 * (two questions a human calls different, scored at or above it), or a
 * one-sentence rewrite of a real question scores below it. Either falsifies the
 * number, and the fix then belongs in `text_similarity.ts` where its other
 * consumers can see it move.
 */
export const NEAR_DUPLICATE_THRESHOLD = MERGE_THRESHOLD;

/** The three states step 1A.4 requires the warning to distinguish. */
export type RepeatState =
    /** Same question text, and the configuration that would run it is unchanged. */
    | 'exact-same-config'
    /** Same question text, but the members or round count have moved since. */
    | 'exact-stale-config'
    /** Not the same text, but above the pre-registered similarity threshold. */
    | 'near-duplicate';

/** One prior run, as read from a retained response artefact. */
export interface PriorRun {
    /** Path of the retained artefact. */
    readonly artifactPath: string;
    /** The question file it ran over, as the artefact recorded it. */
    readonly questionPath: string;
    /** ISO date of the artefact, for the warning's "prior run date". */
    readonly ranAt: string;
    /** Sorted member ids + round count — the "relevant configuration". */
    readonly configFingerprint: string;
    /** `_sha256_hex` of the question text, when the question file still exists. */
    readonly questionHash: string | null;
    /** The question text, for the near-duplicate pass. `null` when the file is gone. */
    readonly questionText: string | null;
}

/**
 * A finding. There is DELIBERATELY no `block`, `refuse` or `severity` field:
 * step 1A.2 requires that no code path can turn this into an unconditional
 * block, and a type that cannot express one is the strongest available form of
 * that guarantee.
 */
export interface RecouncilVerdict {
    readonly state: RepeatState;
    readonly prior: PriorRun;
    /** Token Jaccard against the prior question, 0..1. Exactly 1 on an exact repeat. */
    readonly similarity: number;
}

/** Sorted members plus rounds — what 1A.4 calls the relevant configuration. */
export function configFingerprint(members: readonly string[], rounds: number): string {
    return `${[...members].sort().join(',')}|rounds=${String(rounds)}`;
}

/**
 * Read the retained response artefacts into prior runs.
 *
 * Tolerant of every read failure by design: a malformed or half-written
 * artefact must not break a council run. The guard is an advisory, and an
 * advisory that can throw is worse than one that stays quiet.
 */
export function readPriorRuns(responsesDir: string, repoRoot: string): PriorRun[] {
    let names: string[];
    try {
        names = fs.readdirSync(responsesDir).filter((f) => f.endsWith('.md'));
    } catch {
        return [];
    }
    const out: PriorRun[] = [];
    for (const name of names) {
        const abs = path.join(responsesDir, name);
        let head: Record<string, unknown>;
        let stat: fs.Stats;
        try {
            stat = fs.statSync(abs);
            const text = fs.readFileSync(abs, 'utf8');
            const json = _leadingJson(text);
            // A file with no leading object is not a council artefact at all —
            // skipped rather than admitted as a prior run with empty fields,
            // which would put noise in a warning whose whole value is that it
            // is rare enough to read.
            if (json === null) continue;
            head = JSON.parse(json) as Record<string, unknown>;
        } catch {
            continue;
        }
        const questionPath = typeof head['artefact'] === 'string' ? head['artefact'] : '';
        const members = Array.isArray(head['members']) ? (head['members'] as string[]) : [];
        const rounds = typeof head['rounds'] === 'number' ? head['rounds'] : 0;
        let questionHash: string | null = null;
        let questionText: string | null = null;
        if (questionPath !== '') {
            try {
                const q = fs.readFileSync(path.join(repoRoot, questionPath), 'utf8');
                questionHash = _sha256_hex(q);
                questionText = q;
            } catch {
                // The question file was moved or pruned. The run is still a
                // prior run; it simply cannot be compared by text, and saying
                // that is better than dropping the record.
            }
        }
        out.push({
            artifactPath: abs,
            questionPath,
            ranAt: stat.mtime.toISOString().slice(0, 10),
            configFingerprint: configFingerprint(members, rounds),
            questionHash,
            questionText,
        });
    }
    return out;
}

/** The leading `{...}` object of an artefact, brace-balanced, or `null`. */
function _leadingJson(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
        const c = text[i] as string;
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth += 1;
        else if (c === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * Is this question already deliberated?
 *
 * Returns the STRONGEST finding, or `null`. Exact beats near-duplicate, and a
 * stale-config exact beats a near-duplicate: a caller shown two findings reads
 * neither, and the exact one carries more information.
 */
export function checkRecouncil(
    questionText: string,
    currentConfig: string,
    priors: readonly PriorRun[],
    threshold: number = NEAR_DUPLICATE_THRESHOLD,
): RecouncilVerdict | null {
    const hash = _sha256_hex(questionText);

    for (const p of priors) {
        if (p.questionHash === hash) {
            return {
                state: p.configFingerprint === currentConfig ? 'exact-same-config' : 'exact-stale-config',
                prior: p,
                similarity: 1,
            };
        }
    }
    let best: RecouncilVerdict | null = null;
    for (const p of priors) {
        if (p.questionText === null) continue;
        const s = jaccardSimilarity(questionText, p.questionText);
        if (s >= threshold && (best === null || s > best.similarity)) {
            best = { state: 'near-duplicate', prior: p, similarity: s };
        }
    }
    return best;
}

/**
 * The warning text.
 *
 * Every line step 1A.2 names is present — prior run date, prior artifact path,
 * the fact that the question appears already deliberated, and the path to
 * re-run — and 1A.3 requires the SCORE to be printed, so it is, on every state
 * rather than only the near-duplicate one. A score of 1.00 on an exact repeat
 * tells the reader which comparison fired.
 */
export function renderRecouncilWarning(v: RecouncilVerdict): string {
    const what: Record<RepeatState, string> = {
        'exact-same-config':
            'this exact question has already been deliberated, and the configuration that would run it is unchanged',
        'exact-stale-config':
            'this exact question has already been deliberated, but the members or round count have moved since — the prior verdict may rest on evidence this configuration would not produce',
        'near-duplicate':
            'a question above the pre-registered similarity threshold has already been deliberated',
    };
    return [
        `⚠️  council:re-council — ${what[v.state]}.`,
        `    prior run    ${v.prior.ranAt}`,
        `    prior answer ${v.prior.artifactPath}`,
        `    question     ${v.prior.questionPath || '(not recorded)'}`,
        `    similarity   ${v.similarity.toFixed(2)} (threshold ${String(NEAR_DUPLICATE_THRESHOLD)}, pre-registered)`,
        '    This is a WARNING, never a refusal. Re-run with --confirm to deliberate again.',
        '',
    ].join('\n');
}
