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
 *       --model <id> --ablation none --protocol <path>
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    deriveFloors,
    ingestCases,
    invokedFromTrace,
    selectBaseline,
    sha256,
    unitRows,
    type CaseRow,
    type UnitRow,
} from './_lib/routing_baseline.js';

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
        } catch (err) {
            // A skipped file shrinks the compiled set with no trace; refuse instead.
            throw new Error(`compile_trigger_evals: ${path.relative(skillsRoot, file)} is not valid JSON (${err instanceof Error ? err.message : String(err)})`);
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
export function slug(s: string): string {
    return s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'case';
}

/**
 * The regex the host's `tool_used` grader tests against a Skill call's JSON
 * input, e.g. `{"skill":"ac:code-review"}` (plugin-namespaced) or
 * `{"skill":"code-review"}` (user-level).
 *
 * The leading `[":]` and the trailing quote anchor the WHOLE name, so
 * `code-review` does not match `requesting-code-review`. Verified on host
 * 2.1.311: the grader is `new RegExp(input_match).test(inputText)`.
 */
export function skillInputPattern(skill: string): string {
    return `[":]${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
}

/**
 * The grader body for one query — a deterministic `tool_used` check.
 *
 * Not an `llm` grader: its default focus is the LAST MESSAGE, which never
 * shows whether a skill was invoked, so its verdict would be a judge guessing
 * from prose. The tool call is the observation.
 * `arm: both` keeps it scored under ablation instead of display-only.
 *
 * Risk 3 of the roadmap, and the reason this is not "no skill was used": a
 * query that should not trigger skill A may rightly trigger skill B, and a
 * grader asserting "no skill at all" would score that correct neighbour as a
 * miss. The assertion is only ever about the NAMED skill.
 */
export function graderBody(skill: string, trigger: boolean): string {
    const lines = ['---', 'type: tool_used', 'tool: Skill', `input_match: '${skillInputPattern(skill)}'`];
    if (!trigger) lines.push('min: 0', 'max: 0');
    lines.push('arm: both', 'weight: 1', '---', '');
    return lines.join('\n');
}

/**
 * The prompt body for one query, in the shape pinned from the host.
 *
 * Tags live in the frontmatter because that is where the host reads them —
 * `--tag` filters on it (verified on 2.1.311); a side file is ignored.
 */
function promptBody(query: string, tags: readonly string[], extraTools: readonly string[] = []): string {
    return [
        '---',
        'max_turns: 10',
        `allowed_tools: [${['Read', 'Glob', 'Grep', 'Skill', ...extraTools].join(', ')}]`,
        `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`,
        '---',
        '',
        query,
        '',
    ].join('\n');
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
export function refuseTrackedOutput(outDir: string): void {
    const abs = path.resolve(outDir);
    const rel = path.relative(REPO_ROOT, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return;
    const probe = path.join(abs, '.compile-probe');
    const res = spawnSync('git', ['-C', REPO_ROOT, 'check-ignore', '-q', probe], { encoding: 'utf8' });
    // 0 = ignored, 1 = not ignored, 128 = not a repository (then nothing can be
    // committed). Anything else — git missing, killed — cannot say, so refuses.
    if (res.status !== 0 && res.status !== 128) {
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
    return compileQueries(readCorpus(skillsRoot), outDir);
}

/**
 * Compile an explicit query list into `outDir`. `dirOf` names each case's
 * directory; the default is `<skill>/<id>`, and a baseline passes a ranked
 * name so the host's case order is the protocol's order.
 */
export function compileQueries(
    queries: readonly LabelledQuery[],
    outDir: string,
    dirOf: (q: LabelledQuery, i: number) => string = (q) => path.join(slug(q.skill), slug(q.id)),
    opts: { grader?: (q: LabelledQuery) => string; extraTools?: readonly string[] } = {},
): CompiledCase[] {
    refuseTrackedOutput(outDir);
    const cases: CompiledCase[] = [];
    const owner = new Map<string, string>();
    queries.forEach((q, i) => {
        const dir = dirOf(q, i);
        const prior = owner.get(dir);
        if (prior !== undefined) {
            throw new Error(`compile_trigger_evals: ${q.skill}/${q.id} and ${prior} both compile to ${dir}`);
        }
        owner.set(dir, `${q.skill}/${q.id}`);
        const tags = [`skill:${q.skill}`, `partition:${partitionOf(q.skill)}`];
        if (q.cls !== null) tags.push(`class:${q.cls}`);
        const abs = path.join(outDir, dir);
        fs.mkdirSync(path.join(abs, 'graders'), { recursive: true });
        fs.writeFileSync(path.join(abs, 'prompt.md'), promptBody(q.query, tags, opts.extraTools));
        fs.writeFileSync(
            path.join(abs, 'graders', 'criteria.md'),
            opts.grader === undefined ? graderBody(q.skill, q.trigger) : opts.grader(q),
        );
        cases.push({ skill: q.skill, id: q.id, dir, tags });
    });
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
    /** Pinned by the protocol; the host's default model moves underneath a run. */
    model: string;
    /**
     * `none` or `with-without`. Explicit because the host DEFAULTS to
     * with-without whenever a plugin resolves, which doubles the spend, and for
     * a selection measurement the no-plugin arm cannot select the skill at all.
     */
    ablation: 'none' | 'with-without';
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
    if (req.model === '') throw new Error('print-run: an explicit --model is required');
    if (req.ablation !== 'none' && req.ablation !== 'with-without') {
        throw new Error('print-run: an explicit --ablation (none | with-without) is required');
    }
    return [
        'claude plugin eval',
        `--eval-dir ${req.evalDir}`,
        `--tag ${req.tag}`,
        `--runs ${String(req.runs)}`,
        `--max-cost-usd ${String(req.maxCostUsd)}`,
        `--model ${req.model}`,
        `--ablation ${req.ablation}`,
        '--no-publish',
        req.target,
        `# protocol: ${req.protocol}`,
    ].join(' ');
}

/** One selected case, as written to the baseline plan. */
export interface PlanRow {
    case: string;
    skill: string;
    id: string;
    query_sha256: string;
    /** sha256 of the unit's SKILL.md in the catalogue the target carries. */
    skill_sha256: string;
}

export interface BaselinePlan {
    schema: 'routing-baseline-plan/v1';
    plugin: string;
    units: number;
    per_unit: number;
    catalogue_sha256: string;
    rows: PlanRow[];
}

/**
 * sha256 over the catalogue a target carries: every `<name>/SKILL.md`, sorted
 * by name — the routing condition, and the fingerprint a later compare checks
 * before it trusts a score delta.
 */
export function catalogueHash(catalogueRoot: string): string {
    const h = createHash('sha256');
    for (const name of fs.readdirSync(catalogueRoot).sort()) {
        const f = path.join(catalogueRoot, name, 'SKILL.md');
        if (!fs.existsSync(f)) continue;
        h.update(`${name}\0`).update(fs.readFileSync(f)).update('\0');
    }
    return h.digest('hex');
}

/**
 * Build the throwaway skills-dir plugin a baseline runs against: the projected
 * catalogue under `skills/`, a minimal manifest, and the selected cases under
 * `evals/` in rank order. Returns the plan, which is also written beside it.
 */
export function buildBaselinePlugin(opts: {
    skillsRoot: string;
    catalogueRoot: string;
    pluginRoot: string;
    plugin: string;
    units: number;
    perUnit: number;
}): BaselinePlan {
    refuseTrackedOutput(opts.pluginRoot);
    const picked = selectBaseline(readCorpus(opts.skillsRoot), opts.units, opts.perUnit);
    fs.mkdirSync(path.join(opts.pluginRoot, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
        path.join(opts.pluginRoot, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: opts.plugin, version: '0.0.0', description: 'routing baseline target' }, null, 2) + '\n',
    );
    fs.cpSync(opts.catalogueRoot, path.join(opts.pluginRoot, 'skills'), { recursive: true });
    const width = String(picked.length).length;
    const cases = compileQueries(picked, path.join(opts.pluginRoot, 'evals'), (q, i) =>
        `${String(i + 1).padStart(width, '0')}-${slug(q.skill)}-${slug(q.id)}`,
    );
    const skillHash = (skill: string): string => {
        const f = path.join(opts.catalogueRoot, skill, 'SKILL.md');
        return fs.existsSync(f) ? createHash('sha256').update(fs.readFileSync(f)).digest('hex') : '';
    };
    const plan: BaselinePlan = {
        schema: 'routing-baseline-plan/v1',
        plugin: opts.plugin,
        units: opts.units,
        per_unit: opts.perUnit,
        catalogue_sha256: catalogueHash(opts.catalogueRoot),
        rows: cases.map((c, i) => ({
            case: c.dir,
            skill: c.skill,
            id: c.id,
            query_sha256: sha256((picked[i] as LabelledQuery).query),
            skill_sha256: skillHash(c.skill),
        })),
    };
    fs.writeFileSync(path.join(opts.pluginRoot, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
    return plan;
}

/** The committed baseline artefact 0.2 asks for. */
export interface BaselineArtifact {
    schema: 'routing-baseline/v1';
    captured_at: string;
    commit: string;
    host_version: string;
    model: string;
    protocol: { path: string; sha256: string };
    catalogue_sha256: string;
    cost_usd: number;
    partial: boolean;
    cases: (CaseRow & { id: string; skill_sha256: string })[];
    units: UnitRow[];
}

export function buildArtifact(opts: {
    aggregate: unknown;
    plan: BaselinePlan;
    commit: string;
    model: string;
    protocolPath: string;
    protocolSha256: string;
    invokedOf?: (tracePath: string) => string[] | null;
}): BaselineArtifact {
    const byCase = new Map(opts.plan.rows.map((r) => [r.case, r]));
    const rows = ingestCases(opts.aggregate, (name) => byCase.get(name)?.skill, opts.invokedOf);
    const agg = opts.aggregate as { startedAt?: unknown; claudeVersion?: unknown; costUsd?: unknown; partial?: unknown };
    return {
        schema: 'routing-baseline/v1',
        captured_at: typeof agg.startedAt === 'string' ? agg.startedAt : '',
        commit: opts.commit,
        host_version: typeof agg.claudeVersion === 'string' ? agg.claudeVersion : '',
        model: opts.model,
        protocol: { path: opts.protocolPath, sha256: opts.protocolSha256 },
        catalogue_sha256: opts.plan.catalogue_sha256,
        cost_usd: typeof agg.costUsd === 'number' ? agg.costUsd : 0,
        partial: agg.partial === true,
        cases: rows.map((r) => {
            const p = byCase.get(r.case) as PlanRow;
            return { ...r, query_sha256: p.query_sha256, id: p.id, skill_sha256: p.skill_sha256 };
        }),
        units: unitRows(rows),
    };
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
                '           --runs N --max-cost-usd N --model ID --ablation none|with-without \\\n' +
                '           --protocol PATH\n' +
                '       compile_trigger_evals --baseline-plan --plugin-root DIR --units N [--per-unit N]\n' +
                '           [--plugin NAME] [--catalogue DIR]\n' +
                '       compile_trigger_evals --ingest AGGREGATE.json --plan PLAN.json --protocol PATH \\\n' +
                '           --model ID --commit SHA --artifact OUT.json\n' +
                '       compile_trigger_evals --derive-floors BASELINE.json --tolerance T --floors OUT.json\n\n' +
                'Compiles the trigger corpus into host-shaped eval cases. It never runs them.\n',
        );
        return 0;
    }

    if (argv.includes('--baseline-plan')) {
        const pluginRoot = arg(argv, 'plugin-root');
        const units = Number(arg(argv, 'units') ?? 0);
        if (pluginRoot === null || !Number.isInteger(units) || units < 1) {
            process.stderr.write('compile_trigger_evals: --baseline-plan needs --plugin-root DIR and --units N\n');
            return 2;
        }
        const plan = buildBaselinePlugin({
            skillsRoot: arg(argv, 'skills') ?? path.join(REPO_ROOT, 'src', 'skills'),
            catalogueRoot: arg(argv, 'catalogue') ?? path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'),
            pluginRoot,
            plugin: arg(argv, 'plugin') ?? 'ac',
            units,
            perUnit: Number(arg(argv, 'per-unit') ?? 1),
        });
        process.stdout.write(
            `compile_trigger_evals: ${String(plan.rows.length)} baseline case(s) -> ${pluginRoot}/evals ` +
                `(catalogue ${plan.catalogue_sha256.slice(0, 12)})\nNothing was run.\n`,
        );
        return 0;
    }

    const derive = arg(argv, 'derive-floors');
    if (derive !== null) {
        const outFile = arg(argv, 'floors');
        const tolerance = Number(arg(argv, 'tolerance') ?? Number.NaN);
        if (outFile === null || !(tolerance >= 0 && tolerance < 1)) {
            process.stderr.write('compile_trigger_evals: --derive-floors needs --floors OUT.json and --tolerance T\n');
            return 2;
        }
        const art = JSON.parse(fs.readFileSync(derive, 'utf8')) as BaselineArtifact;
        const floors = deriveFloors(art.units, tolerance);
        fs.writeFileSync(
            outFile,
            JSON.stringify(
                {
                    schema: 'routing-floors/v1',
                    baseline: path.relative(REPO_ROOT, path.resolve(derive)),
                    baseline_sha256: sha256(fs.readFileSync(derive, 'utf8')),
                    tolerance,
                    floors,
                },
                null,
                2,
            ) + '\n',
        );
        process.stdout.write(`compile_trigger_evals: ${String(floors.length)} floor(s) derived -> ${outFile}\n`);
        return 0;
    }

    const ingest = arg(argv, 'ingest');
    if (ingest !== null) {
        const need = ['plan', 'protocol', 'model', 'commit', 'artifact'] as const;
        const vals = Object.fromEntries(need.map((k) => [k, arg(argv, k)]));
        const missing = need.filter((k) => vals[k] === null || vals[k] === '');
        if (missing.length > 0) {
            process.stderr.write(`compile_trigger_evals: --ingest needs ${missing.map((m) => `--${m}`).join(' ')}\n`);
            return 2;
        }
        const protocolPath = vals['protocol'] as string;
        const artifact = buildArtifact({
            aggregate: JSON.parse(fs.readFileSync(ingest, 'utf8')),
            plan: JSON.parse(fs.readFileSync(vals['plan'] as string, 'utf8')) as BaselinePlan,
            commit: vals['commit'] as string,
            model: vals['model'] as string,
            protocolPath: path.relative(REPO_ROOT, path.resolve(protocolPath)),
            protocolSha256: sha256(fs.readFileSync(protocolPath, 'utf8')),
            invokedOf: (p) => (fs.existsSync(p) ? invokedFromTrace(fs.readFileSync(p, 'utf8')) : null),
        });
        fs.writeFileSync(vals['artifact'] as string, JSON.stringify(artifact, null, 2) + '\n');
        const measured = artifact.units.filter((u) => u.recall !== null);
        const mean = measured.reduce((s, u) => s + (u.recall as number), 0) / Math.max(1, measured.length);
        process.stdout.write(
            `compile_trigger_evals: ${String(artifact.cases.length)} run(s), ${String(measured.length)} unit(s) measured, ` +
                `mean recall ${mean.toFixed(3)}, cost ${artifact.cost_usd.toFixed(2)} USD -> ${vals['artifact'] as string}\n`,
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
                    model: arg(argv, 'model') ?? '',
                    ablation: (arg(argv, 'ablation') ?? '') as RunRequest['ablation'],
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
