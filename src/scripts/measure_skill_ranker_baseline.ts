#!/usr/bin/env tsx
/**
 * measure_skill_ranker_baseline — the number Phase 3 has to beat.
 *
 * `road-to-skill-delivery-over-mcp` Phase 0.3 asked for a top-1 / top-3 hit
 * rate for the incumbent keyword ranker, "over the 496-line corpus … against
 * the corpus's expected skill per line". Building it surfaced two defects in
 * that premise, and this file is written around them rather than over them.
 *
 * DEFECT A — the 496-line corpus has no expected SKILL. `tests/eval/routing-matrix/`
 * is keyed by `rule:` and every prompt is labelled with the RULE it should
 * activate. Scoring a skill ranker against it would need a skill label that
 * does not exist there, so a "hit rate" over it would be invented.
 *
 * DEFECT B — 496 is stale. The matrix holds 499 prompts today
 * (`grep -h "^\s*- prompt:" tests/eval/routing-matrix/*.yaml | wc -l`), and 496
 * is still published in six places including `hook-token-budget.json`.
 *
 * So the baseline is measured against the corpus that DOES carry expected
 * skills — `tests/eval/corpus-{dev,non-dev}.yaml`, 26 labelled prompts — and
 * the routing matrix is reported alongside it as what it can honestly be: a
 * COVERAGE measurement (does the ranker return anything at all, and how
 * confident) with no ground truth and therefore no accuracy.
 *
 * Both halves are emitted in one JSON object so a later ranker revision can be
 * compared on the same two axes in one run:
 *
 *   ./scripts-run src/scripts/measure_skill_ranker_baseline --json
 *   ./scripts-run src/scripts/measure_skill_ranker_baseline --ranker keyword-v2 --json
 *
 * A 26-prompt denominator is small and is stated as such in the output. It is
 * the whole labelled ground truth this repository has.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rank } from './skill_tools/score_skill_relevance.js';
import type { RankOptions } from '../shared/skillRanking.js';

export const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const LABELLED_CORPORA = ['tests/eval/corpus-dev.yaml', 'tests/eval/corpus-non-dev.yaml'];
const MATRIX_DIR = 'tests/eval/routing-matrix';
/** Where the projected skills live in this checkout. */
export const SKILLS_DIR = path.join(REPO, 'src', 'skills');

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

/** Every `- prompt:` string in the rule routing matrix. No skill label exists. */
export function readMatrixPrompts(repo = REPO): string[] {
    const dir = path.join(repo, MATRIX_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.yaml')) continue;
        for (const raw of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
            const m = /^\s*-?\s*prompt:\s*"(.*)"\s*$/.exec(raw.replace(/\r$/, ''));
            if (m && m[1]) out.push(m[1]);
        }
    }
    return out;
}

export interface AccuracyArm {
    corpus_prompts: number;
    top1: number;
    top3: number;
    misses: string[];
    denominator_note: string;
}

export interface CoverageArm {
    corpus_prompts: number;
    prompts_with_any_result: number;
    mean_top_score: number;
    note: string;
}

export interface RankerBaseline {
    schema: 1;
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

export function measure(opts: { ranker: string; commit: string; skillsDir?: string; repo?: string }): RankerBaseline {
    const repo = opts.repo ?? REPO;
    const skillsDir = opts.skillsDir ?? SKILLS_DIR;
    // `keyword-v2` is Phase 3.1: the same formula with `triggers:` prose folded
    // into each skill's term source. Any other label measures v1.
    const rankOpts: RankOptions = opts.ranker === 'keyword-v2' ? { includeTriggers: true } : {};
    const labelled = readLabelledPrompts(repo);
    let top1 = 0;
    let top3 = 0;
    const misses: string[] = [];
    for (const p of labelled) {
        const rows = rank(p.prompt, skillsDir, rankOpts);
        if (hitAt(rows, 1, p.expected)) top1++;
        if (hitAt(rows, 3, p.expected)) top3++;
        else misses.push(p.id);
    }

    const matrix = readMatrixPrompts(repo);
    let withResult = 0;
    let scoreSum = 0;
    for (const prompt of matrix) {
        const rows = rank(prompt, skillsDir, rankOpts);
        if (rows.length > 0) {
            withResult++;
            scoreSum += rows[0]![1];
        }
    }

    const skillsIndexed = fs.existsSync(skillsDir)
        ? fs.readdirSync(skillsDir).filter((s) => fs.existsSync(path.join(skillsDir, s, 'SKILL.md'))).length
        : 0;

    return {
        schema: 1,
        ranker: opts.ranker,
        commit: opts.commit,
        skills_dir: path.relative(repo, skillsDir),
        skills_indexed: skillsIndexed,
        accuracy: {
            corpus_prompts: labelled.length,
            top1: labelled.length ? Math.round((top1 / labelled.length) * 1000) / 1000 : 0,
            top3: labelled.length ? Math.round((top3 / labelled.length) * 1000) / 1000 : 0,
            misses,
            denominator_note:
                'tests/eval/corpus-dev.yaml + corpus-non-dev.yaml — the only expected-skill ground ' +
                'truth in this tree. Small; a single prompt moves each rate by ~4 points.',
        },
        matrix_coverage: {
            corpus_prompts: matrix.length,
            prompts_with_any_result: withResult,
            mean_top_score: withResult ? Math.round((scoreSum / withResult) * 100) / 100 : 0,
            note:
                'tests/eval/routing-matrix/ is labelled with the expected RULE, never a skill, so ' +
                'this arm carries no accuracy — only whether the ranker answers at all and how ' +
                'confident its top answer is. Its size is measured here, not assumed: the roadmap ' +
                'and five other sites still publish 496.',
        },
    };
}

export function main(argv: readonly string[]): number {
    const ranker = argv.includes('--ranker') ? (argv[argv.indexOf('--ranker') + 1] ?? 'keyword-v1') : 'keyword-v1';
    const commit = argv.includes('--commit') ? (argv[argv.indexOf('--commit') + 1] ?? 'unknown') : 'unknown';
    const out = measure({ ranker, commit });
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    process.exit(main(process.argv.slice(2)));
}
