/**
 * Re-council savings — the reconciliation half of Phase 10.5.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 10.5 asks
 * for four figures — *duplicates prevented, near-duplicate warnings, reruns
 * intentionally confirmed, spend saved* — and its `verify:` is
 * *"the figures reconcile against the retained artifacts"*.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT — read this before quoting a number.
 *
 *   1. **It is a reconstruction, not instrumentation.** The guard it measures,
 *      `recouncil_guard.ts`, PERSISTS NOTHING: `warnIfRecounciled` returns
 *      `void` and writes only to an injected sink (`recouncil_guard.ts:273`,
 *      `:289`). Nothing in the tree records that a warning fired, that a user
 *      saw it, or that a run was abandoned because of it. So `duplicates
 *      prevented` and `reruns intentionally confirmed` are NOT observable, and
 *      this module refuses to emit a number for them — see
 *      {@link RecouncilSavings.duplicates_prevented}. What IS computable is the
 *      guard's own detector replayed over the retained corpus: how many
 *      questions the guard WOULD have flagged.
 *   2. **The denominator is accidental, not designed.** The retained corpus is
 *      whatever the (unrun) reaper left behind — `prune_all_council_artifacts`
 *      (`session.ts:468`) has exactly one caller, the manual CLI
 *      `council_prune.ts`, bound to no hook, Taskfile target or workflow. So
 *      the corpus is not "the last N days of council traffic"; it is "every
 *      artefact ever written that nobody deleted by hand". A rate computed
 *      over it is a rate over an unknown sampling frame.
 *
 * Both limits are structural, and the report prints them next to every figure
 * rather than in a footnote, because a savings number quoted without them is
 * the exact overstatement this roadmap's § Prevented items exists to catch.
 *
 * Deterministic and offline: no provider call, no network, no writes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { jaccardSimilarity } from '../_lib/text_similarity.js';
import { _sha256_hex } from './blind_review.js';
import { NEAR_DUPLICATE_THRESHOLD, checkRecouncil, readPriorRuns } from './recouncil_guard.js';
import type { PriorRun } from './recouncil_guard.js';

/** One retained question file, hashed and read. */
export interface QuestionRecord {
    /** Path relative to the corpus root — stable across machines. */
    readonly rel: string;
    readonly text: string;
    readonly sha256: string;
}

/** A pair of distinct questions at or above the threshold. */
export interface NearDuplicatePair {
    readonly a: string;
    readonly b: string;
    readonly score: number;
}

/**
 * The four figures 10.5 names, with the two that are NOT observable typed as
 * `null` rather than zero.
 *
 * `null` and `0` are different claims and the difference is the whole point:
 * zero would assert *"the guard prevented no duplicate"*, which nothing in the
 * tree can support; `null` asserts *"no mechanism records this"*, which is a
 * fact about `recouncil_guard.ts` and is citable.
 */
export interface RecouncilSavings {
    /** Retained question files read. */
    readonly questions: number;
    /** Distinct sha256 over those files. */
    readonly distinct_hashes: number;
    /** Question files whose hash is shared with an earlier file — exact repeats. */
    readonly exact_repeat_files: number;
    /** Distinct unordered pairs at or above the threshold, excluding exact repeats. */
    readonly near_duplicate_pairs: number;
    /** Questions that participate in at least one such pair. */
    readonly near_duplicate_questions: number;
    /** Response artefacts the guard's own reader admits as prior runs. */
    readonly prior_runs_readable: number;
    /**
     * Prior runs whose question file still resolves, i.e. the ones the guard can
     * actually COMPARE against. The gap between this and `prior_runs_readable`
     * is the guard's real reach over the retained corpus.
     */
    readonly prior_runs_with_question_text: number;
    /** Retained artefacts the reader rejects (no leading JSON, unreadable, a directory). */
    readonly prior_runs_rejected: number;
    /** Questions the guard's own `checkRecouncil` flags against the prior runs. */
    readonly guard_would_flag: number;
    /** NOT OBSERVABLE — the guard persists no outcome. Always `null`; see the module header. */
    readonly duplicates_prevented: null;
    /** NOT OBSERVABLE — same reason. Always `null`. */
    readonly reruns_confirmed: null;
    /** NOT OBSERVABLE — a spend figure needs a prevented run, which is not recorded. Always `null`. */
    readonly spend_saved_usd: null;
    readonly threshold: number;
}

/** Read every `*.md` question under `root`, recursively, sorted for determinism. */
export function readQuestions(root: string): QuestionRecord[] {
    const out: QuestionRecord[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of [...entries].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))) {
            const abs = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(abs);
                continue;
            }
            if (!e.name.endsWith('.md')) continue;
            let text: string;
            try {
                text = fs.readFileSync(abs, 'utf8');
            } catch {
                continue;
            }
            out.push({ rel: path.relative(root, abs), text, sha256: _sha256_hex(text) });
        }
    };
    walk(root);
    return out;
}

/** Files whose hash was already seen — the exact-repeat count, first occurrence excluded. */
export function exactRepeats(questions: readonly QuestionRecord[]): QuestionRecord[] {
    const seen = new Set<string>();
    const repeats: QuestionRecord[] = [];
    for (const q of questions) {
        if (seen.has(q.sha256)) repeats.push(q);
        else seen.add(q.sha256);
    }
    return repeats;
}

/**
 * Every distinct unordered pair at or above `threshold`, EXCLUDING identical
 * texts — an exact repeat is already counted by {@link exactRepeats} and
 * counting it twice would inflate the near-duplicate figure with the same
 * event.
 *
 * O(n²) on purpose: n is the retained corpus (hundreds), the comparison is the
 * guard's own `jaccardSimilarity`, and an index would be a second similarity
 * mechanism beside the one `recouncil_guard.ts:1A.3` pins.
 */
export function nearDuplicatePairs(
    questions: readonly QuestionRecord[],
    threshold: number = NEAR_DUPLICATE_THRESHOLD,
): NearDuplicatePair[] {
    const pairs: NearDuplicatePair[] = [];
    for (let i = 0; i < questions.length; i++) {
        const a = questions[i] as QuestionRecord;
        for (let j = i + 1; j < questions.length; j++) {
            const b = questions[j] as QuestionRecord;
            if (a.sha256 === b.sha256) continue;
            const score = jaccardSimilarity(a.text, b.text);
            if (score >= threshold) pairs.push({ a: a.rel, b: b.rel, score });
        }
    }
    return pairs;
}

/** How many distinct questions appear in at least one pair. */
export function questionsInPairs(pairs: readonly NearDuplicatePair[]): number {
    const ids = new Set<string>();
    for (const p of pairs) {
        ids.add(p.a);
        ids.add(p.b);
    }
    return ids.size;
}

/**
 * Replay the guard's own detector: for each question, would `checkRecouncil`
 * have returned a verdict against the retained prior runs?
 *
 * The question's own prior run is excluded by artefact path where it is
 * identifiable, so a question is not reported as a repeat of itself.
 */
export function guardWouldFlag(
    questions: readonly QuestionRecord[],
    priors: readonly PriorRun[],
    corpusRelPrefix: string,
): number {
    let flagged = 0;
    for (const q of questions) {
        const own = path.posix.join(corpusRelPrefix, q.rel.split(path.sep).join('/'));
        const others = priors.filter((p) => p.questionPath !== own);
        if (checkRecouncil(q.text, '(config not reconstructible)', others) !== null) flagged++;
    }
    return flagged;
}

/** Everything, over one corpus root. `repoRoot` is where `questionPath` values resolve. */
export function computeSavings(
    repoRoot: string,
    threshold: number = NEAR_DUPLICATE_THRESHOLD,
): RecouncilSavings {
    const questionsDir = path.join(repoRoot, 'agents/runtime/council/questions');
    const responsesDir = path.join(repoRoot, 'agents/runtime/council/responses');
    const questions = readQuestions(questionsDir);
    const priors = readPriorRuns(responsesDir, repoRoot);
    let candidates = 0;
    try {
        candidates = fs.readdirSync(responsesDir).filter((f) => f.endsWith('.md')).length;
    } catch {
        candidates = 0;
    }
    const pairs = nearDuplicatePairs(questions, threshold);
    return {
        questions: questions.length,
        distinct_hashes: new Set(questions.map((q) => q.sha256)).size,
        exact_repeat_files: exactRepeats(questions).length,
        near_duplicate_pairs: pairs.length,
        near_duplicate_questions: questionsInPairs(pairs),
        prior_runs_readable: priors.length,
        prior_runs_with_question_text: priors.filter((p) => p.questionText !== null).length,
        prior_runs_rejected: candidates - priors.length,
        guard_would_flag: guardWouldFlag(questions, priors, 'agents/runtime/council/questions'),
        duplicates_prevented: null,
        reruns_confirmed: null,
        spend_saved_usd: null,
        threshold,
    };
}

/** The two limits, printed with every figure rather than footnoted. */
export const SAVINGS_LIMITS: readonly string[] = [
    'RECONSTRUCTION, NOT INSTRUMENTATION — recouncil_guard.warnIfRecounciled returns void ' +
        'and writes only to an injected sink (recouncil_guard.ts:273,:289). No warning, ' +
        'no abandonment and no confirmation is persisted anywhere, so duplicates_prevented, ' +
        'reruns_confirmed and spend_saved_usd are null, never zero.',
    'ACCIDENTAL DENOMINATOR — the retained corpus is what an unrun reaper left behind. ' +
        'prune_all_council_artifacts (session.ts:468) has one caller, the manual CLI ' +
        'council_prune.ts, bound to no hook, Taskfile target or workflow. Any rate over ' +
        'this corpus is a rate over an unknown sampling frame.',
];

export function renderSavings(s: RecouncilSavings): string {
    const n = (v: number | null): string => (v === null ? 'null (not observable)' : String(v));
    return (
        [
            `retained questions          ${String(s.questions)}`,
            `distinct question hashes    ${String(s.distinct_hashes)}`,
            `exact repeat files          ${String(s.exact_repeat_files)}`,
            `near-duplicate pairs        ${String(s.near_duplicate_pairs)} (threshold ${s.threshold.toFixed(2)})`,
            `questions in >=1 pair       ${String(s.near_duplicate_questions)}`,
            `prior runs readable         ${String(s.prior_runs_readable)}`,
            `  …with a resolvable question ${String(s.prior_runs_with_question_text)}`,
            `prior runs rejected         ${String(s.prior_runs_rejected)}`,
            `guard would flag            ${String(s.guard_would_flag)}`,
            `duplicates prevented        ${n(s.duplicates_prevented)}`,
            `reruns confirmed            ${n(s.reruns_confirmed)}`,
            `spend saved (USD)           ${n(s.spend_saved_usd)}`,
            '',
            'LIMITS:',
        ]
            .concat(SAVINGS_LIMITS.map((l) => `  - ${l}`))
            .join('\n') + '\n'
    );
}

/** `./scripts-run src/scripts/ai_council/recouncil_savings [--root <path>]` */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const i = argv.indexOf('--root');
    const root = i !== -1 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : process.cwd();
    process.stdout.write(`corpus root ${root}\n`);
    process.stdout.write(renderSavings(computeSavings(root)));
    if (argv.includes('--pairs')) {
        const qs = readQuestions(path.join(root, 'agents/runtime/council/questions'));
        for (const p of nearDuplicatePairs(qs)) {
            process.stdout.write(`  pair ${p.score.toFixed(3)}  ${p.a}  <->  ${p.b}\n`);
        }
    }
    return 0;
}

// Self-execution guard — see topology_bench_manifest.ts for why realpath on both sides.
{
    const nodeFs = await import('node:fs');
    const nodeUrl = await import('node:url');
    const invoked = process.argv[1];
    if (invoked !== undefined && invoked !== '') {
        let here = '';
        let there = ' ';
        try {
            here = nodeFs.realpathSync(nodeUrl.fileURLToPath(import.meta.url));
            there = nodeFs.realpathSync(invoked);
        } catch {
            here = '';
            there = ' ';
        }
        if (here === there) process.exit(await main());
    }
}
