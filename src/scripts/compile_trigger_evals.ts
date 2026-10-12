/**
 * Compile the trigger corpus into cases the HOST's own evaluator can run.
 *
 * `road-to-a-trigger-suite-the-host-grades` Phases 2 and 3. The corpus is 125
 * `src/skills/*‌/evals/triggers.json` files holding ~1,200 labelled queries, in
 * two shapes. This emits one case per query in the shape pinned from the host
 * in `tests/fixtures/plugin-eval/`, tagged `holdout` or `train` by the frozen
 * partition rule, and prints — never runs — the command that would score them.
 *
 * ```
 * IT PRINTS. IT DOES NOT RUN.
 * THE SESSION THAT AUTHORED A CORPUS MAY NOT CHOOSE THE PROTOCOL THAT MEASURES IT.
 * ```
 *
 * That is D1, and it is the whole reason this file stops where it does: the
 * parked `road-to-routing-assurance-live-floors` holds the first scored run
 * behind an un-park condition, a run is spend, and a host-written grader does
 * not lift the independence objection because the protocol choice is the point.
 *
 * Output goes only under a caller-supplied directory, which the repository
 * gitignores: a compiled case committed to the tree would be a second corpus,
 * and the partition would then be a property of two places instead of one.
 *
 * Usage:
 *   ./scripts-run src/scripts/compile_trigger_evals --out <dir>
 *   ./scripts-run src/scripts/compile_trigger_evals --print-run --out <dir> \
 *       --target <plugin> --tag partition:train --runs 3 --max-cost-usd 5 \
 *       --protocol <path>
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

/**
 * The partition constant `trigger-corpus-holdout-2026-08-30.md` freezes.
 * Changing it re-partitions the corpus, which is why it is read from here and
 * from `trigger_corpus_holdout_pin.test.ts` rather than written twice.
 */
export const HOLDOUT_CEILING = 51;

/**
 * `holdout iff sha256(<skill-directory-name>).digest()[0] < 51`.
 *
 * Keyed on the DIRECTORY NAME and never on the file's contents, so editing a
 * corpus cannot move a skill across the boundary — the property the holdout
 * artefact calls "why this does not touch the seal".
 */
export function partitionOf(skill: string): 'holdout' | 'train' {
    const bucket = parseInt(createHash('sha256').update(skill).digest('hex').slice(0, 2), 16);
    return bucket < HOLDOUT_CEILING ? 'holdout' : 'train';
}

/** One labelled query, from either corpus shape. */
export interface LabelledQuery {
    skill: string;
    /** The corpus's own id where it has one; otherwise a positional fallback. */
    id: string;
    query: string;
    /** True where the query SHOULD activate `skill`. */
    trigger: boolean;
    /** `exemplar` / `near-miss` / `counterexample`, or null in the second shape. */
    cls: string | null;
}

interface RawQuery {
    id?: unknown;
    q?: unknown;
    query?: unknown;
    trigger?: unknown;
    class?: unknown;
}

function isObj(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Every labelled query under `skillsRoot`, from BOTH shapes.
 *
 * 123 files use `queries[]` with `trigger` and `class`; two use
 * `should_trigger` / `should_not_trigger` string arrays. A compiler that read
 * only the majority shape would drop the other two silently, which is the
 * failure the fixture in the test exists to catch.
 */
export function readCorpus(skillsRoot: string): LabelledQuery[] {
    const out: LabelledQuery[] = [];
    if (!fs.existsSync(skillsRoot)) return out;
    for (const skill of fs.readdirSync(skillsRoot).sort()) {
        const file = path.join(skillsRoot, skill, 'evals', 'triggers.json');
        if (!fs.existsSync(file)) continue;
        let doc: unknown;
        try {
            doc = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            continue;
        }
        if (!isObj(doc)) continue;

        if (Array.isArray(doc['queries'])) {
            (doc['queries'] as RawQuery[]).forEach((q, i) => {
                if (!isObj(q)) return;
                const text = typeof q.q === 'string' ? q.q : typeof q.query === 'string' ? q.query : null;
                if (text === null) return;
                out.push({
                    skill,
                    id: typeof q.id === 'string' && q.id !== '' ? q.id : `q${String(i + 1)}`,
                    query: text,
                    trigger: q.trigger === true,
                    cls: typeof q.class === 'string' && q.class !== '' ? q.class : null,
                });
            });
            continue;
        }

        for (const [key, trigger] of [
            ['should_trigger', true],
            ['should_not_trigger', false],
        ] as const) {
            const arr = doc[key];
            if (!Array.isArray(arr)) continue;
            arr.forEach((text, i) => {
                if (typeof text !== 'string' || text === '') return;
                out.push({
                    skill,
                    id: `${key === 'should_trigger' ? 'pos' : 'neg'}${String(i + 1)}`,
                    query: text,
                    trigger,
                    cls: null,
                });
            });
        }
    }
    return out;
}

/** One emitted case: where it was written and what it is tagged with. */
export interface CompiledCase {
    skill: string;
    id: string;
    /** Directory under the output root, one per case. */
    dir: string;
    tags: string[];
}

/** A filesystem-safe fragment of an arbitrary corpus id. */
function slug(s: string): string {
    return s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'case';
}

/**
 * The grader body for one query.
 *
 * Risk 3 of the roadmap, and the reason this is not "no skill was used": a
 * query that should not trigger skill A may rightly trigger skill B, and a
 * grader asserting "no skill at all" would score that correct neighbour as a
 * miss. The assertion is only ever about the NAMED skill.
 */
function graderBody(skill: string, trigger: boolean): string {
    return trigger
        ? [
              '---',
              'type: llm',
              'weight: 1',
              '---',
              '',
              `The response is successful when the \`${skill}\` skill was used to answer.`,
              '',
              'Judge only whether that named skill was used. Using additional skills',
              'alongside it is not a failure.',
              '',
          ].join('\n')
        : [
              '---',
              'type: llm',
              'weight: 1',
              '---',
              '',
              `The response is successful when the \`${skill}\` skill was not used.`,
              '',
              `Judge only the absence of that named skill. Another skill answering`,
              'this query is correct behaviour and is not a failure.',
              '',
          ].join('\n');
}

/** The prompt body for one query, in the shape pinned from the host. */
function promptBody(query: string): string {
    return ['---', 'max_turns: 10', 'allowed_tools: [Read, Glob, Grep, Skill]', '---', '', query, ''].join('\n');
}

/**
 * Refuse an output directory inside the repository that git would track.
 *
 * AC-3 is "no compiled case is committed to the tree", and a convention is not
 * a mechanism: ~1,200 generated directories staged by one `git add -A` is the
 * failure, and it only has to happen once. Outside the repository there is
 * nothing to commit, so only the inside case is checked — and `git` deciding
 * is deliberate, because a path list here would drift from `.gitignore`.
 */
function refuseTrackedOutput(outDir: string): void {
    const abs = path.resolve(outDir);
    const rel = path.relative(REPO_ROOT, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return;
    const probe = path.join(abs, '.compile-probe');
    const res = spawnSync('git', ['-C', REPO_ROOT, 'check-ignore', '-q', probe], { encoding: 'utf8' });
    // 0 = ignored, 1 = not ignored, 128 = not a repository (then nothing can be committed).
    if (res.status === 1) {
        throw new Error(
            `compile_trigger_evals: ${rel} is inside the repository and not gitignored. ` +
                'Compiled cases are never committed (AC-3) — use a gitignored path such as ' +
                'agents/runtime/trigger-evals, or a directory outside the repository.',
        );
    }
}

/**
 * Compile `skillsRoot` into `outDir`, one case per labelled query.
 *
 * Writes nothing outside `outDir` — the corpus is read-only to this function,
 * which the test asserts by comparing the corpus listing before and after.
 */
export function compileCorpus(skillsRoot: string, outDir: string): CompiledCase[] {
    refuseTrackedOutput(outDir);
    const cases: CompiledCase[] = [];
    for (const q of readCorpus(skillsRoot)) {
        const dir = path.join(slug(q.skill), slug(q.id));
        const abs = path.join(outDir, dir);
        fs.mkdirSync(path.join(abs, 'graders'), { recursive: true });
        fs.writeFileSync(path.join(abs, 'prompt.md'), promptBody(q.query));
        fs.writeFileSync(path.join(abs, 'graders', 'criteria.md'), graderBody(q.skill, q.trigger));
        const tags = [`skill:${q.skill}`, `partition:${partitionOf(q.skill)}`];
        if (q.cls !== null) tags.push(`class:${q.cls}`);
        fs.writeFileSync(path.join(abs, 'tags.txt'), tags.join('\n') + '\n');
        cases.push({ skill: q.skill, id: q.id, dir, tags });
    }
    return cases;
}

/** Everything a printable run command must carry. */
export interface RunRequest {
    evalDir: string;
    target: string;
    tag: string;
    runs: number;
    maxCostUsd: number;
    protocol: string;
}

/**
 * The command a scored run would use — printed, never executed.
 *
 * It refuses to print one that is missing a part, because an incomplete
 * command is the one somebody completes by hand under time pressure:
 *
 *   - `--no-publish` is not optional and not a parameter. D3: the host
 *     publishes its HTML report to the account by DEFAULT, and that report
 *     carries prompts and grader verdicts off the machine.
 *   - `--runs` and `--max-cost-usd` are explicit because the host's defaults
 *     (the case's own value, or 3) are not a decision anybody recorded.
 *   - `--protocol` is a path to a file the RUNNER writes under the parked
 *     roadmap's un-park condition. Without it there is no record of who chose
 *     the protocol, which is the independence objection itself.
 */
export function printRunCommand(req: RunRequest): string {
    if (req.evalDir === '') throw new Error('print-run: an eval directory is required');
    if (req.target === '') throw new Error('print-run: a target is required');
    if (req.tag === '') throw new Error('print-run: a tag selection is required');
    if (!Number.isInteger(req.runs) || req.runs < 1) throw new Error('print-run: an explicit --runs count is required');
    if (!(req.maxCostUsd > 0)) throw new Error('print-run: an explicit --max-cost-usd ceiling is required');
    if (req.protocol === '') throw new Error('print-run: a protocol file path is required');
    return [
        'claude plugin eval',
        `--eval-dir ${req.evalDir}`,
        `--tag ${req.tag}`,
        `--runs ${String(req.runs)}`,
        `--max-cost-usd ${String(req.maxCostUsd)}`,
        '--no-publish',
        req.target,
        `# protocol: ${req.protocol}`,
    ].join(' ');
}

function arg(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0 && i + 1 < argv.length) return argv[i + 1] as string;
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    return eq === undefined ? null : eq.slice(name.length + 3);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: compile_trigger_evals --out DIR [--skills DIR]\n' +
                '       compile_trigger_evals --print-run --out DIR --target T --tag TAG \\\n' +
                '           --runs N --max-cost-usd N --protocol PATH\n\n' +
                'Compiles the trigger corpus into host-shaped eval cases. It never runs them.\n',
        );
        return 0;
    }
    const out = arg(argv, 'out');
    if (out === null) {
        process.stderr.write('compile_trigger_evals: --out DIR is required\n');
        return 2;
    }
    const skills = arg(argv, 'skills') ?? path.join(REPO_ROOT, 'src', 'skills');

    if (argv.includes('--print-run')) {
        try {
            process.stdout.write(
                printRunCommand({
                    evalDir: out,
                    target: arg(argv, 'target') ?? '',
                    tag: arg(argv, 'tag') ?? '',
                    runs: Number(arg(argv, 'runs') ?? 0),
                    maxCostUsd: Number(arg(argv, 'max-cost-usd') ?? 0),
                    protocol: arg(argv, 'protocol') ?? '',
                }) + '\n',
            );
        } catch (err) {
            process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
            return 2;
        }
        return 0;
    }

    const cases = compileCorpus(skills, out);
    const holdout = cases.filter((c) => c.tags.includes('partition:holdout')).length;
    process.stdout.write(
        `compile_trigger_evals: ${String(cases.length)} case(s) -> ${out} ` +
            `(${String(holdout)} holdout, ${String(cases.length - holdout)} train)\n` +
            'Nothing was run. Print the command with --print-run; the run itself is a\n' +
            "decision recorded on later/road-to-routing-assurance-live-floors, not here.\n",
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
