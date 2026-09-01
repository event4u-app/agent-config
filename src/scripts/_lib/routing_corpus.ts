/**
 * The corpus and catalogue substrate for the two routing measurements of
 * `road-to-governed-harness-evolution` — step 5.1 (description vs body) and
 * step 6.4 (delivery sets).
 *
 * ONE LOADER, TWO MEASUREMENTS. Both runs need the same three things: the
 * frozen train/holdout partition, the trigger cases, and the skill catalogue
 * the prompts are ranked against. Two loaders over one corpus is how two
 * measurements start disagreeing about what they measured, so there is one.
 *
 * THE SEAL IS ENFORCED BY REFUSAL, NOT BY FILTERING. The holdout partition
 * frozen in `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`
 * says: no analyzer authored in Phase 5 may read the sealed corpora. So
 * `loadTrainCases` never opens a holdout `evals/triggers.json` at all — the
 * partition is computed from the DIRECTORY NAME, before any file is read.
 * Filtering after the read would satisfy the letter and not the seal.
 *
 * The seal covers the corpus files and not the catalogue: a holdout skill's
 * `SKILL.md` is still ranked against, because removing it would measure a
 * catalogue that does not exist. The boundary is stated in the 5.1
 * pre-registration rather than left to be inferred here.
 *
 * NO SCORER OF ITS OWN. Every score comes from `src/shared/skillRanking.ts`,
 * the module the production ranker and the MCP handler already share. A second
 * scorer in a measurement module would measure the measurement.
 *
 * Pure of network and of clock; reads files and nothing else.
 */
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';

import { scoreSkill, tokenize, type RankableSkill } from '../../shared/skillRanking.js';

/**
 * The partition constant the freeze artefact fixes. Changing it re-partitions
 * the corpus and voids every result measured under the old one, which is why
 * it is a named export a test can pin rather than a literal.
 */
export const HOLDOUT_CEILING = 51;

export type Partition = 'holdout' | 'train';

/** `holdout iff sha256(<skill-directory-name>)[0] < 51`, from the freeze artefact. */
export function partitionOf(skill: string): Partition {
    const bucket = parseInt(createHash('sha256').update(skill).digest('hex').slice(0, 2), 16);
    return bucket < HOLDOUT_CEILING ? 'holdout' : 'train';
}

/** One adjudicated case: a prompt, and whether the owning skill must be delivered. */
export interface CorpusCase {
    readonly skill: string;
    readonly prompt: string;
    /** `true` = positive (must be delivered) · `false` = negative (must not). */
    readonly expect: boolean;
    /** Step 2.3's vocabulary where the file declares it; 876 of 931 cases do not. */
    readonly caseClass: 'exemplar' | 'near-miss' | 'counterexample' | null;
    readonly language: string | null;
}

interface RawQuery {
    q?: unknown;
    trigger?: unknown;
    class?: unknown;
    language?: unknown;
}

/**
 * The two corpus shapes this tree carries.
 *
 * `queries[]` is the modern one. Two train files — `brand-asset-generation` and
 * `estimate-ticket` — are the legacy `should_trigger` / `should_not_trigger`
 * pair that step 2.3 grandfathered, and `lint_skill_trigger_corpus` returns
 * before its class rules for exactly those two. A reader that understood only
 * the modern shape would drop them SILENTLY, which is worse than refusing them:
 * the run would report 80 train corpora where the partition says 82 and nothing
 * would say which two were missing. So both shapes are read, and
 * `legacyShaped` records which file used which.
 */
interface RawCorpus {
    queries?: RawQuery[];
    should_trigger?: unknown;
    should_not_trigger?: unknown;
}

export function skillsDir(repoRoot: string): string {
    return path.join(repoRoot, 'src', 'skills');
}

/**
 * Is this `src/skills/<name>` entry test scaffolding rather than a skill?
 *
 * A `__`-prefixed directory is scaffolding by convention, and a real skill can
 * never be named one: `skill.schema.json` pins `name` to `^[a-z][a-z0-9-]*$`
 * and requires it to match the parent directory, so a leading underscore fails
 * `validate_frontmatter`. This predicate therefore cannot hide a shipped skill.
 *
 * WHY IT EXISTS, measured rather than assumed.
 * `tests/scripts/lint_originality.test.ts:64` writes a re-skin fixture to
 * `src/skills/__origtest_reskin_fixture/SKILL.md` in the REAL tree and removes
 * it in `afterEach`, because the linter resolves its corpus from a
 * module-level ROOT and takes no root argument. During that window any
 * concurrently-running test file that counts the catalogue sees 300 where the
 * commit holds 299 — which is what failed
 * `tests/scripts/routing_signal_measurement.test.ts` on
 * `Node Tests (ubuntu-latest, shard 2/4)` in runs 33418425604 and 33424783559,
 * intermittently, while passing in isolation and passing on the next run over
 * two markdown files nothing reads.
 *
 * Reproduced locally before this line was written: with the fixture present on
 * disk the assertion fails `300` vs `299`, character for character the CI
 * message; with this predicate active it passes.
 *
 * Excluding the prefix here rather than threading a root through the linter is
 * the smaller change by an order of magnitude: ROOT is baked into ten
 * module-level constants there, and refactoring a shipped gate to suit a test
 * is a worse trade than a naming convention the tree already follows.
 */
export function isScaffoldingSkillDir(name: string): boolean {
    return name.startsWith('__');
}

/** Every skill directory that carries a trigger corpus, with its partition. */
export function corpusSkills(repoRoot: string): { skill: string; partition: Partition }[] {
    const dir = skillsDir(repoRoot);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .sort()
        .filter((skill) => !isScaffoldingSkillDir(skill))
        .filter((skill) => fs.existsSync(path.join(dir, skill, 'evals', 'triggers.json')))
        .map((skill) => ({ skill, partition: partitionOf(skill) }));
}

/**
 * The train cases. A holdout corpus is never opened — the partition is decided
 * from the directory name and the sealed path is skipped before any read.
 */
export function loadTrainCases(repoRoot: string): CorpusCase[] {
    const dir = skillsDir(repoRoot);
    const out: CorpusCase[] = [];
    for (const { skill, partition } of corpusSkills(repoRoot)) {
        if (partition === 'holdout') continue;
        const raw = JSON.parse(
            fs.readFileSync(path.join(dir, skill, 'evals', 'triggers.json'), 'utf8'),
        ) as RawCorpus;
        if (Array.isArray(raw.queries)) {
            for (const q of raw.queries) {
                if (typeof q.q !== 'string' || typeof q.trigger !== 'boolean') continue;
                const declared = typeof q.class === 'string' ? q.class : null;
                out.push({
                    skill,
                    prompt: q.q,
                    expect: q.trigger,
                    caseClass:
                        declared === 'exemplar' ||
                        declared === 'near-miss' ||
                        declared === 'counterexample'
                            ? declared
                            : null,
                    language: typeof q.language === 'string' ? q.language : null,
                });
            }
            continue;
        }
        for (const [key, expect] of [
            ['should_trigger', true],
            ['should_not_trigger', false],
        ] as const) {
            const list = raw[key];
            if (!Array.isArray(list)) continue;
            for (const prompt of list) {
                if (typeof prompt !== 'string') continue;
                out.push({ skill, prompt, expect, caseClass: null, language: null });
            }
        }
    }
    return out;
}

/** Which train corpora use the legacy shape. Reported so the count is explainable. */
export function legacyShaped(repoRoot: string): string[] {
    const dir = skillsDir(repoRoot);
    const out: string[] = [];
    for (const { skill, partition } of corpusSkills(repoRoot)) {
        if (partition === 'holdout') continue;
        const raw = JSON.parse(
            fs.readFileSync(path.join(dir, skill, 'evals', 'triggers.json'), 'utf8'),
        ) as RawCorpus;
        if (!Array.isArray(raw.queries)) out.push(skill);
    }
    return out;
}

/** A catalogue entry: what the ranker sees, plus the body the 5.1 arm adds. */
export interface CatalogueEntry extends RankableSkill {
    readonly name: string;
    readonly description: string;
    readonly personas: readonly string[];
    /** SKILL.md with its frontmatter removed. Empty when the file has none. */
    readonly body: string;
}

/** Minimal frontmatter split. Returns `[block, body]`; `['', text]` when absent. */
export function splitFrontmatter(text: string): [string, string] {
    if (!text.startsWith('---')) return ['', text];
    const end = text.indexOf('\n---', 3);
    if (end === -1) return ['', text];
    return [text.slice(3, end), text.slice(end + 4)];
}

/** `name`, `description` and `personas` out of a frontmatter block. */
export function readMeta(block: string): { name: string; description: string; personas: string[] } {
    let name = '';
    let description = '';
    const personas: string[] = [];
    let inPersonas = false;
    for (const raw of block.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (inPersonas && /^ {2}- /.test(line)) {
            personas.push(line.slice(4).trim().replace(/^["']|["']$/g, ''));
            continue;
        }
        inPersonas = false;
        const m = /^([a-zA-Z_][\w-]*)[ \t]*:[ \t]*(.*)$/.exec(line);
        if (!m) continue;
        const key = m[1] as string;
        const value = (m[2] as string).trim().replace(/^["']|["']$/g, '');
        if (key === 'personas' && value === '') inPersonas = true;
        else if (key === 'name') name = value;
        else if (key === 'description') description = value;
    }
    return { name, description, personas };
}

/** Every skill directory`s `SKILL.md`, name-sorted. The ranking universe. */
export function loadCatalogue(repoRoot: string): CatalogueEntry[] {
    const dir = skillsDir(repoRoot);
    if (!fs.existsSync(dir)) return [];
    const out: CatalogueEntry[] = [];
    for (const skill of fs.readdirSync(dir).sort()) {
        if (isScaffoldingSkillDir(skill)) continue;
        const file = path.join(dir, skill, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        const [block, body] = splitFrontmatter(fs.readFileSync(file, 'utf8'));
        const meta = readMeta(block);
        out.push({
            name: meta.name || skill,
            description: meta.description,
            personas: meta.personas,
            body,
        });
    }
    return out;
}

/** The two 5.1 arms. `description` is today's production condition. */
export const ARMS = ['description', 'description+body'] as const;
export type Arm = (typeof ARMS)[number];

/**
 * The indexed term set per arm.
 *
 * The `description` arm reproduces `skillTerms(skill, {})` exactly — same
 * inputs, same tokenizer — so the control arm IS the shipped behaviour rather
 * than a re-implementation of it.
 */
export function armTerms(entry: CatalogueEntry, arm: Arm): Set<string> {
    const parts = [entry.name, entry.description];
    if (arm === 'description+body') parts.push(entry.body);
    return tokenize(parts.join(' '));
}

export interface RankedName {
    readonly name: string;
    readonly score: number;
}

/**
 * Top-k by score, ties broken on name — the total order `rankSkills` already
 * defines. Zero scores are dropped, because a skill the scorer gives 0 is not
 * delivered by the shipped ranker either.
 */
export function topK(
    prompt: string,
    catalogue: readonly CatalogueEntry[],
    terms: ReadonlyMap<string, Set<string>>,
    k: number,
): RankedName[] {
    const taskTerms = tokenize(prompt);
    const rows: RankedName[] = [];
    for (const entry of catalogue) {
        const t = terms.get(entry.name);
        if (t === undefined) continue;
        const score = scoreSkill(taskTerms, entry, t);
        if (score > 0) rows.push({ name: entry.name, score });
    }
    rows.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return rows.slice(0, k);
}

/** Term sets for one arm, keyed by the name `topK` ranks on. */
export function termIndex(catalogue: readonly CatalogueEntry[], arm: Arm): Map<string, Set<string>> {
    const index = new Map<string, Set<string>>();
    for (const entry of catalogue) index.set(entry.name, armTerms(entry, arm));
    return index;
}
