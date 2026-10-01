#!/usr/bin/env tsx
/**
 * measure_skill_ranker_baseline — the number Phase 3 has to beat.
 *
 * `road-to-skill-delivery-over-mcp` Phase 0.3 asked for a top-1 / top-3 hit
 * rate for the incumbent keyword ranker, "over the 496-line corpus … against
 * the corpus's expected skill per line". Building it surfaced two defects in
 * that premise, and this file is written around them rather than over them.
 *
 * DEFECT A — the routing matrix had no expected SKILL. `tests/eval/routing-matrix/`
 * is keyed by `rule:` and every prompt was labelled with the RULE it should
 * activate. Scoring a skill ranker against it would need a skill label that did
 * not exist there, so a "hit rate" over it would be invented.
 *
 * **Defect A is CLOSED as of `road-to-a-menu-whose-precision-is-measured` 1.1.**
 * Every case in the matrix now carries an `expected_skills` list, hand-written
 * by seats that had not read this ranker's scoring (the protocol is in
 * `tests/eval/routing-matrix/README.md`). An EMPTY list is a first-class value
 * meaning "deliberately no skill expectation", and such a row is excluded from
 * the accuracy denominator rather than counted as a miss. So the matrix arm now
 * has ground truth; `--corpus routing-matrix` scores against it.
 *
 * DEFECT B — the published size is stale, repeatedly. 496 was published while
 * the matrix held 499, and 499 is still published in several sites while the
 * matrix holds more than that again. The size is therefore MEASURED on every run
 * and printed, never asserted from a constant.
 *
 * THE INTERVAL, AND THE REFUSAL TO PRINT A VERDICT UNDER n = 100.
 * A hit rate over 26 prompts
 * moves ~4 points per prompt; quoting it as "61.5 %" invites a comparison the
 * sample cannot carry. Both arms therefore report a 95 % Wilson score interval
 * (`_lib/capture_rate.ts` — Wilson rather than the normal approximation for the
 * same reason stated there: near p = 1 the normal one produces bounds above 1).
 *
 * Below {@link MIN_POWERED_N} labelled rows the arm's `verdict` is
 * `underpowered`. That is not a failure and not an exit code — the point
 * estimate and the interval are still printed, because suppressing them would
 * replace a wide measurement with no measurement. It is a label that travels
 * with the number so a later reader cannot quote the point estimate alone.
 *
 * Usage:
 *     ./scripts-run src/scripts/measure_skill_ranker_baseline
 *     ./scripts-run src/scripts/measure_skill_ranker_baseline --corpus routing-matrix
 *     ./scripts-run src/scripts/measure_skill_ranker_baseline --corpus all
 *     ./scripts-run src/scripts/measure_skill_ranker_baseline --ranker keyword-v2
 *     ./scripts-run src/scripts/measure_skill_ranker_baseline --corpus routing-matrix --slice sealed
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { wilsonInterval } from './_lib/capture_rate.js';
import { fnv1a } from './_lib/fnv.js';
import { rank } from './skill_tools/score_skill_relevance.js';
import type { RankOptions } from '../shared/skillRanking.js';

export const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const LABELLED_CORPORA = ['tests/eval/corpus-dev.yaml', 'tests/eval/corpus-non-dev.yaml'];
const MATRIX_DIR = 'tests/eval/routing-matrix';
/** Where the projected skills live in this checkout. */
export const SKILLS_DIR = path.join(REPO, 'src', 'skills');

/**
 * The smallest labelled corpus this report will call powered.
 *
 * 100 is the roadmap's number, not a derived optimum, and it is stated as such:
 * at n = 100 a point estimate near 0.7 carries a 95 % Wilson half-width of
 * roughly ±9 points, which is wide but no longer moves on a single prompt the
 * way a 26-row denominator does. Raise it with a dated reason if a decision
 * ever needs a tighter bound than that.
 */
export const MIN_POWERED_N = 100;

export type CorpusName = 'labelled' | 'routing-matrix' | 'all';
export const CORPUS_NAMES: readonly CorpusName[] = ['labelled', 'routing-matrix', 'all'];

export interface LabelledPrompt {
    id: string;
    corpus: string;
    prompt: string;
    expected: string[];
}

/**
 * Minimal reader for the two eval corpora. They are hand-written YAML with a
 * fixed two-space list shape; a full YAML parse is avoided so this script has
 * the same zero-dependency profile as the ranker it measures.
 */
export function readLabelledPrompts(repo = REPO): LabelledPrompt[] {
    const out: LabelledPrompt[] = [];
    for (const rel of LABELLED_CORPORA) {
        const file = path.join(repo, rel);
        if (!fs.existsSync(file)) continue;
        const corpus = path.basename(rel, '.yaml');
        let id = '';
        let prompt = '';
        for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
            const line = raw.replace(/\r$/, '');
            if (/^\s*#/.test(line)) continue;
            const mId = /^\s*-\s+id:\s*(\S+)\s*$/.exec(line);
            if (mId) {
                id = mId[1]!;
                prompt = '';
                continue;
            }
            const mPrompt = /^\s*prompt:\s*"(.*)"\s*$/.exec(line);
            if (mPrompt) {
                prompt = mPrompt[1]!;
                continue;
            }
            const mExp = /^\s*expected_skills:\s*\[(.*)\]\s*$/.exec(line);
            if (mExp && id && prompt) {
                const expected = mExp[1]!
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                out.push({ id, corpus, prompt, expected });
                id = '';
                prompt = '';
            }
        }
    }
    return out;
}

export interface MatrixCase {
    rule: string;
    section: 'positives' | 'near_misses';
    ordinal: number;
    prompt: string;
    /** `undefined` = the key is missing (a defect the lint catches); `[]` = deliberately unlabelled. */
    expected?: string[];
}

/**
 * Every case in the rule routing matrix, with its `expected_skills` label when
 * one is present.
 *
 * Line-oriented for the same reason as the reader above, and because a YAML
 * round-trip through this directory would reformat 100+ hand-kept fixtures.
 * A case is `prompt:` plus the keys indented under it up to the next `- `.
 */
export function readMatrixCases(repo = REPO): MatrixCase[] {
    const dir = path.join(repo, MATRIX_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: MatrixCase[] = [];
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.yaml')) continue;
        const rule = name.replace(/\.yaml$/, '');
        let section: MatrixCase['section'] = 'positives';
        let ordinal = 0;
        let current: MatrixCase | undefined;
        for (const raw of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
            const line = raw.replace(/\r$/, '');
            if (/^positives:\s*$/.test(line)) {
                section = 'positives';
                ordinal = 0;
                current = undefined;
                continue;
            }
            if (/^near_misses:\s*$/.test(line)) {
                section = 'near_misses';
                ordinal = 0;
                current = undefined;
                continue;
            }
            const mPrompt = /^\s*-?\s*prompt:\s*"(.*)"\s*$/.exec(line);
            if (mPrompt && mPrompt[1] !== undefined) {
                current = { rule, section, ordinal: ordinal++, prompt: mPrompt[1] };
                out.push(current);
                continue;
            }
            const mExp = /^\s*expected_skills:\s*\[(.*)\]\s*$/.exec(line);
            if (mExp && current) {
                current.expected = mExp[1]!
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
        }
    }
    return out;
}

/** Every `- prompt:` string in the rule routing matrix, label or no label. */
export function readMatrixPrompts(repo = REPO): string[] {
    return readMatrixCases(repo).map((c) => c.prompt);
}

/** The matrix rows that carry a NON-EMPTY label — the accuracy denominator. */
export function readMatrixLabelledPrompts(repo = REPO): LabelledPrompt[] {
    return readMatrixCases(repo)
        .filter((c) => (c.expected?.length ?? 0) > 0)
        .map((c) => ({
            id: `${c.rule}#${c.section}[${c.ordinal}]`,
            corpus: 'routing-matrix',
            prompt: c.prompt,
            expected: c.expected!,
        }));
}

export function promptsForCorpus(corpus: CorpusName, repo = REPO): LabelledPrompt[] {
    if (corpus === 'labelled') return readLabelledPrompts(repo);
    if (corpus === 'routing-matrix') return readMatrixLabelledPrompts(repo);
    return [...readLabelledPrompts(repo), ...readMatrixLabelledPrompts(repo)];
}

/**
 * Which half of the corpus a row belongs to.
 *
 * `road-to-a-ranker-that-routes` 1.2. Tuning and reading on one corpus of 390
 * overfits it: a signal chosen because it lifted the number on the rows it was
 * chosen from will lift the number on exactly those rows, and the interval
 * printed beside it then describes the fitting rather than the ranker. Every
 * lift claim in Phases 2 and 3 is read on `sealed` only.
 */
export type SliceName = 'all' | 'tuning' | 'sealed';
export const SLICE_NAMES: readonly SliceName[] = ['all', 'tuning', 'sealed'];

/**
 * One row in twenty-five-and-a-bit — i.e. 20 % — goes to the sealed slice.
 *
 * Stated as a modulus rather than a fraction because the partition has to be a
 * pure function of the id: a share applied to a shuffled list would move every
 * row the moment a prompt is added, and the sealed slice would stop being the
 * same slice between two runs of the same measurement.
 */
export const SEALED_MODULUS = 5;

/**
 * The slice one case id falls in — deterministic, order-independent, stable
 * under corpus growth.
 *
 * Keyed on the id and nothing else. Keying on the prompt text would move a row
 * across the boundary when a typo is fixed; keying on position would move every
 * row behind an insertion. The id is the one coordinate that survives both.
 */
export function sliceForId(id: string): Exclude<SliceName, 'all'> {
    return fnv1a(id) % SEALED_MODULUS === 0 ? 'sealed' : 'tuning';
}

/** The rows of `prompts` that fall in `slice`; `all` is the identity. */
export function partitionBySlice<T extends { id: string }>(
    prompts: readonly T[],
    slice: SliceName,
): T[] {
    if (slice === 'all') return [...prompts];
    return prompts.filter((p) => sliceForId(p.id) === slice);
}

/** How the corpus divides, printed on every run so a reader never assumes it. */
export interface SliceSizes {
    all: number;
    tuning: number;
    sealed: number;
    sealed_modulus: number;
}

export function sliceSizes(prompts: readonly { id: string }[]): SliceSizes {
    const sealed = prompts.filter((p) => sliceForId(p.id) === 'sealed').length;
    return {
        all: prompts.length,
        tuning: prompts.length - sealed,
        sealed,
        sealed_modulus: SEALED_MODULUS,
    };
}

/**
 * The packs a skill declares, read from its own `packs:` frontmatter block.
 *
 * Line-oriented, and deliberately NOT read from `src/packs/*\/pack.yaml`: those
 * manifests are generated FROM this frontmatter, and four of them
 * (`analytics`, `core`, `memory`, `product-reasoning`) carry no skill at all.
 * A pack with no skill can never own a labelled prompt, so a census over the
 * manifest set would state a floor nothing could ever meet.
 */
export function packsForSkill(skillsDir: string, name: string): string[] {
    const file = path.join(skillsDir, name, 'SKILL.md');
    if (!fs.existsSync(file)) return [];
    const text = fs.readFileSync(file, 'utf8');
    if (!text.startsWith('---')) return [];
    const end = text.indexOf('\n---', 3);
    if (end === -1) return [];
    const lines = text.slice(3, end).split('\n');
    const at = lines.findIndex((l) => /^packs:/u.test(l));
    if (at === -1) return [];
    const out: string[] = [];
    for (let i = at + 1; i < lines.length; i += 1) {
        const m = /^\s+-\s+(\S+)\s*$/u.exec(lines[i] as string);
        if (!m) break;
        out.push(m[1] as string);
    }
    return out;
}

/** Every pack id that at least one shipped skill declares. The census domain. */
export function allPacks(skillsDir: string): string[] {
    const packs = new Set<string>();
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const p of packsForSkill(skillsDir, entry.name)) packs.add(p);
    }
    return [...packs].sort();
}

/**
 * How many labelled prompts each pack owns, via the packs of its expected skills.
 *
 * A prompt counts ONCE per pack however many of that pack's skills it expects —
 * otherwise a single prompt naming three `laravel` skills would satisfy a
 * three-prompt floor on its own, which is the shape of coverage this census
 * exists to refuse.
 */
export function packCensus(prompts: readonly LabelledPrompt[], skillsDir: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of allPacks(skillsDir)) out[p] = 0;
    for (const prompt of prompts) {
        const packs = new Set<string>();
        for (const skill of prompt.expected) for (const pack of packsForSkill(skillsDir, skill)) packs.add(pack);
        for (const pack of packs) out[pack] = (out[pack] ?? 0) + 1;
    }
    return out;
}

/** Packs owning fewer than `floor` labelled prompts, sorted by pack id. */
export function packsBelow(census: Record<string, number>, floor: number): string[] {
    return Object.keys(census)
        .filter((p) => (census[p] ?? 0) < floor)
        .sort();
}

/** The per-pack floor `road-to-a-menu-whose-precision-is-measured` 1.1 states. */
export const MIN_PROMPTS_PER_PACK = 3;

export interface Interval {
    lower: number;
    upper: number;
}

export interface AccuracyArm {
    corpus: CorpusName;
    /** Which half of the corpus this arm read. `all` is the whole of it. */
    slice: SliceName;
    /** The division of the FULL corpus, printed whichever slice was read. */
    slice_sizes: SliceSizes;
    corpus_prompts: number;
    top1: number;
    top1_ci95: Interval;
    top3: number;
    top3_ci95: Interval;
    /** `underpowered` below MIN_POWERED_N labelled rows; `measured` at or above. */
    verdict: 'underpowered' | 'measured';
    min_powered_n: number;
    misses: string[];
    denominator_note: string;
    /** Pack ids at least one shipped skill declares — the census domain. */
    packs_total: number;
    min_prompts_per_pack: number;
    /** Packs this corpus leaves under the floor. Empty is the passing shape. */
    packs_below_floor: string[];
    /** Full census, so a reader can see the distribution and not just the failures. */
    pack_census: Record<string, number>;
}

export interface CoverageArm {
    corpus_prompts: number;
    labelled_prompts: number;
    unlabelled_prompts: number;
    missing_label_key: number;
    prompts_with_any_result: number;
    mean_top_score: number;
    note: string;
}

export interface RankerBaseline {
    schema: 2;
    ranker: string;
    commit: string;
    skills_dir: string;
    skills_indexed: number;
    accuracy: AccuracyArm;
    matrix_coverage: CoverageArm;
}

function hitAt(rows: readonly (readonly [string, number, string[]])[], n: number, expected: readonly string[]): boolean {
    const top = rows.slice(0, n).map((r) => r[0]);
    return expected.some((e) => top.includes(e));
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

function ci(successes: number, trials: number): Interval {
    const raw = wilsonInterval(successes, trials);
    return { lower: round3(raw.lower), upper: round3(raw.upper) };
}

const DENOMINATOR_NOTES: Record<CorpusName, string> = {
    labelled:
        'tests/eval/corpus-dev.yaml + corpus-non-dev.yaml — the two hand-written eval corpora. ' +
        'Small; a single prompt moves each rate by ~4 points, which is why the interval is ' +
        'printed beside the point estimate and not instead of it.',
    'routing-matrix':
        'tests/eval/routing-matrix/ rows whose expected_skills list is NON-EMPTY. A row with an ' +
        'empty list is a deliberate "no skill expectation" and is excluded from the ' +
        'denominator — never counted as a miss.',
    all:
        'Both labelled sources pooled. The two were written under different protocols, so a ' +
        'pooled rate is a convenience reading and the per-corpus arms are the citable ones.',
};

export function measureAccuracy(opts: {
    corpus: CorpusName;
    repo: string;
    skillsDir: string;
    rankOpts: RankOptions;
    slice?: SliceName;
}): AccuracyArm {
    const slice = opts.slice ?? 'all';
    const whole = promptsForCorpus(opts.corpus, opts.repo);
    const labelled = partitionBySlice(whole, slice);
    let top1 = 0;
    let top3 = 0;
    const misses: string[] = [];
    for (const p of labelled) {
        const rows = rank(p.prompt, opts.skillsDir, opts.rankOpts);
        if (hitAt(rows, 1, p.expected)) top1++;
        if (hitAt(rows, 3, p.expected)) top3++;
        else misses.push(p.id);
    }
    const n = labelled.length;
    const census = packCensus(labelled, opts.skillsDir);
    return {
        corpus: opts.corpus,
        slice,
        slice_sizes: sliceSizes(whole),
        corpus_prompts: n,
        top1: n ? round3(top1 / n) : 0,
        top1_ci95: ci(top1, n),
        top3: n ? round3(top3 / n) : 0,
        top3_ci95: ci(top3, n),
        verdict: n >= MIN_POWERED_N ? 'measured' : 'underpowered',
        min_powered_n: MIN_POWERED_N,
        misses,
        denominator_note: DENOMINATOR_NOTES[opts.corpus],
        packs_total: Object.keys(census).length,
        min_prompts_per_pack: MIN_PROMPTS_PER_PACK,
        packs_below_floor: packsBelow(census, MIN_PROMPTS_PER_PACK),
        pack_census: census,
    };
}

/**
 * The ranker label → the options it means.
 *
 * One table rather than a conditional at each call site, because a measurement
 * harness that resolves `--ranker` differently from the report that quotes it
 * is a comparison of two things under one name. Every entry past `keyword-v1`
 * is a candidate configuration under `road-to-a-ranker-that-routes` Phase 2,
 * each a single flag so it can be measured alone, plus the combinations the
 * same phase names. A label this table does not know measures `keyword-v1` —
 * the baseline — rather than throwing, because the two callers that resolve a
 * label are a report and a bench and neither should die on a typo while the
 * other reports a figure.
 */
export const RANKER_LABELS: Readonly<Record<string, RankOptions>> = {
    'keyword-v1': {},
    'keyword-v2': { includeTriggers: true },
    'when-to-use': { includeWhenToUse: true },
    headings: { includeHeadings: true },
    idf: { idfWeighting: true },
    'idf+when-to-use': { idfWeighting: true, includeWhenToUse: true },
};

export function rankOptionsFor(ranker: string): RankOptions {
    return RANKER_LABELS[ranker] ?? {};
}

export function measure(opts: {
    ranker: string;
    commit: string;
    corpus?: CorpusName;
    slice?: SliceName;
    skillsDir?: string;
    repo?: string;
}): RankerBaseline {
    const repo = opts.repo ?? REPO;
    const skillsDir = opts.skillsDir ?? SKILLS_DIR;
    // `keyword-v2` is Phase 3.1: the same formula with `triggers:` prose folded
    // into each skill's term source. Any other label measures v1.
    const rankOpts: RankOptions = rankOptionsFor(opts.ranker);
    const corpus = opts.corpus ?? 'labelled';
    const accuracy = measureAccuracy({ corpus, repo, skillsDir, rankOpts, slice: opts.slice });

    const cases = readMatrixCases(repo);
    let withResult = 0;
    let scoreSum = 0;
    for (const c of cases) {
        const rows = rank(c.prompt, skillsDir, rankOpts);
        if (rows.length > 0) {
            withResult++;
            scoreSum += rows[0]![1];
        }
    }

    const skillsIndexed = fs.existsSync(skillsDir)
        ? fs.readdirSync(skillsDir).filter((s) => fs.existsSync(path.join(skillsDir, s, 'SKILL.md'))).length
        : 0;

    return {
        schema: 2,
        ranker: opts.ranker,
        commit: opts.commit,
        skills_dir: path.relative(repo, skillsDir),
        skills_indexed: skillsIndexed,
        accuracy,
        matrix_coverage: {
            corpus_prompts: cases.length,
            labelled_prompts: cases.filter((c) => (c.expected?.length ?? 0) > 0).length,
            unlabelled_prompts: cases.filter((c) => c.expected?.length === 0).length,
            missing_label_key: cases.filter((c) => c.expected === undefined).length,
            prompts_with_any_result: withResult,
            mean_top_score: withResult ? Math.round((scoreSum / withResult) * 100) / 100 : 0,
            note:
                'Coverage over EVERY matrix case, labelled or not: whether the ranker answers at ' +
                'all and how confident its top answer is. Accuracy over the labelled subset is ' +
                'the `accuracy` arm under `--corpus routing-matrix`. Size is measured here, never ' +
                'asserted: 496 and 499 are both published elsewhere and both stale.',
        },
    };
}

function parseCorpus(argv: readonly string[]): CorpusName {
    const i = argv.indexOf('--corpus');
    if (i === -1) return 'labelled';
    const raw = argv[i + 1];
    if (!raw || !CORPUS_NAMES.includes(raw as CorpusName)) {
        throw new Error(
            `measure_skill_ranker_baseline: --corpus expects one of ${CORPUS_NAMES.join(' | ')}, got ${raw ?? '(nothing)'}`,
        );
    }
    return raw as CorpusName;
}

export function parseSlice(argv: readonly string[]): SliceName {
    const i = argv.indexOf('--slice');
    if (i === -1) return 'all';
    const raw = argv[i + 1];
    if (!raw || !SLICE_NAMES.includes(raw as SliceName)) {
        throw new Error(
            `measure_skill_ranker_baseline: --slice expects one of ${SLICE_NAMES.join(' | ')}, got ${raw ?? '(nothing)'}`,
        );
    }
    return raw as SliceName;
}

export function main(argv: readonly string[]): number {
    const ranker = argv.includes('--ranker') ? (argv[argv.indexOf('--ranker') + 1] ?? 'keyword-v1') : 'keyword-v1';
    const commit = argv.includes('--commit') ? (argv[argv.indexOf('--commit') + 1] ?? 'unknown') : 'unknown';
    let corpus: CorpusName;
    let slice: SliceName;
    try {
        corpus = parseCorpus(argv);
        slice = parseSlice(argv);
    } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
    }
    const out = measure({ ranker, commit, corpus, slice });
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.exit(main(process.argv.slice(2)));
}
