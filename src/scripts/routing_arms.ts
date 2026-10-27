#!/usr/bin/env tsx
/**
 * Build the measurement arms that are compared against a frozen routing
 * baseline: catalogue pressure (one plugin per unit, a seeded subset of the
 * catalogue), near-duplicate twins, and the MCP delivery path. Every arm reuses
 * the baseline's own cases — same unit, same corpus query — so a difference
 * between an arm and the baseline is a difference in the catalogue or the path,
 * never in the prompt.
 *
 * ```
 * IT BUILDS TARGETS AND MERGES RESULTS. IT NEVER RUNS ONE.
 * THE CATALOGUE AN ARM SAMPLES MUST HASH TO THE BASELINE'S, OR IT REFUSES.
 * ```
 *
 * Usage:
 *   routing_arms --pressure --baseline ART.json --catalogue DIR --n N --seed S --out DIR
 *   routing_arms --twins --baseline ART.json --catalogue DIR --twins-file TWINS.json --per-unit K --out DIR
 *   routing_arms --mcp --baseline ART.json --catalogue DIR --server-command CMD [--server-arg A]... --out DIR
 *   routing_arms --merge --plan PLAN.json --results DIR --out AGGREGATE.json
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalogueSubset, injectTwin, type PressureSize } from './_lib/catalogue_pressure.js';
import { sha256 } from './_lib/routing_baseline.js';
import {
    catalogueHash,
    compileQueries,
    readCorpus,
    refuseTrackedOutput,
    slug,
    type BaselineArtifact,
    type BaselinePlan,
    type LabelledQuery,
    type PlanRow,
} from './compile_trigger_evals.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** The plugin name every arm uses, so a tool name is predictable. */
export const ARM_PLUGIN = 'ac';
/** The MCP server key in the arm's `.mcp.json`. */
export const ARM_SERVER = 'agent-config';
/** The host's name for the lite server's body tool inside a plugin. */
export const MCP_READ_TOOL = `mcp__plugin_${ARM_PLUGIN}_${ARM_SERVER}__read_skill`;
export const MCP_SUGGEST_TOOL = `mcp__plugin_${ARM_PLUGIN}_${ARM_SERVER}__suggest_skill_for_task`;

export interface ArmPlan extends BaselinePlan {
    arm: string;
    /** Per-row plugin root, for arms that build one target per case. */
    plugins?: Record<string, string>;
    /** Per-row sha256 of the sorted catalogue names the case ran against. */
    subsets?: Record<string, string>;
}

/** The baseline's cases, resolved back to their corpus queries. */
export function baselineQueries(art: BaselineArtifact, skillsRoot: string): { q: LabelledQuery; rank: string }[] {
    const byId = new Map(readCorpus(skillsRoot).map((q) => [`${q.skill}\0${q.id}`, q]));
    return art.cases.map((c) => {
        const q = byId.get(`${c.skill}\0${c.id}`);
        if (q === undefined) throw new Error(`routing_arms: baseline case ${c.case} is no longer in the corpus`);
        return { q, rank: c.case };
    });
}

/** Refuse a catalogue that is not the one the baseline ran against. */
export function assertSameCatalogue(catalogueRoot: string, art: BaselineArtifact): void {
    const got = catalogueHash(catalogueRoot);
    if (got !== art.catalogue_sha256) {
        throw new Error(
            `routing_arms: catalogue ${got.slice(0, 12)} is not the baseline's ${art.catalogue_sha256.slice(0, 12)} — ` +
                'an arm compared against a different catalogue measures the catalogue change, not the arm',
        );
    }
}

function manifest(root: string, description: string): void {
    fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
        path.join(root, '.claude-plugin', 'plugin.json'),
        JSON.stringify({ name: ARM_PLUGIN, version: '0.0.0', description }, null, 2) + '\n',
    );
}

function rowsOf(picked: readonly { q: LabelledQuery; rank: string }[], catalogueRoot: string): PlanRow[] {
    return picked.map(({ q, rank }) => {
        const f = path.join(catalogueRoot, q.skill, 'SKILL.md');
        return {
            case: rank,
            skill: q.skill,
            id: q.id,
            query_sha256: sha256(q.query),
            skill_sha256: fs.existsSync(f) ? createHash('sha256').update(fs.readFileSync(f)).digest('hex') : '',
        };
    });
}

/**
 * 3.1 — one plugin per baseline case, carrying `catalogueSubset(all, unit, n,
 * seed + ":" + unit)`. The seed is per unit so distractors vary across units
 * while staying reproducible for each.
 */
export function buildPressureArm(opts: {
    art: BaselineArtifact;
    skillsRoot: string;
    catalogueRoot: string;
    n: PressureSize;
    seed: string;
    outRoot: string;
}): ArmPlan {
    assertSameCatalogue(opts.catalogueRoot, opts.art);
    refuseTrackedOutput(opts.outRoot);
    const all = fs.readdirSync(opts.catalogueRoot).filter((n) => fs.existsSync(path.join(opts.catalogueRoot, n, 'SKILL.md')));
    const picked = baselineQueries(opts.art, opts.skillsRoot);
    const plugins: Record<string, string> = {};
    const subsets: Record<string, string> = {};
    for (const { q, rank } of picked) {
        const root = path.join(opts.outRoot, rank);
        manifest(root, `pressure arm N=${String(opts.n)}`);
        const names = catalogueSubset(all, q.skill, opts.n, `${opts.seed}:${q.skill}`);
        for (const name of names) {
            fs.cpSync(path.join(opts.catalogueRoot, name), path.join(root, 'skills', name), { recursive: true });
        }
        compileQueries([q], path.join(root, 'evals'), () => rank);
        plugins[rank] = root;
        subsets[rank] = sha256(names.join('\n'));
    }
    const plan: ArmPlan = {
        schema: 'routing-baseline-plan/v1',
        arm: `pressure-n${String(opts.n)}`,
        plugin: ARM_PLUGIN,
        units: picked.length,
        per_unit: 1,
        catalogue_sha256: opts.art.catalogue_sha256,
        rows: rowsOf(picked, opts.catalogueRoot),
        plugins,
        subsets,
    };
    fs.writeFileSync(path.join(opts.outRoot, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
    return plan;
}

/**
 * 3.2 — the full catalogue plus one paraphrased twin per listed skill, and up
 * to `perUnit` corpus positives of each listed skill. The grader stays on the
 * ORIGINAL skill; which of the pair was invoked is read from the trace.
 */
export function buildTwinArm(opts: {
    art: BaselineArtifact;
    skillsRoot: string;
    catalogueRoot: string;
    twins: Record<string, string>;
    perUnit: number;
    outRoot: string;
}): ArmPlan & { twin_texts: Record<string, string> } {
    assertSameCatalogue(opts.catalogueRoot, opts.art);
    refuseTrackedOutput(opts.outRoot);
    manifest(opts.outRoot, 'twin arm');
    const skillsDir = path.join(opts.outRoot, 'skills');
    fs.cpSync(opts.catalogueRoot, skillsDir, { recursive: true });
    const twinTexts: Record<string, string> = {};
    for (const [skill, description] of Object.entries(opts.twins)) {
        twinTexts[skill] = injectTwin(skillsDir, skill, description).text;
    }
    const corpus = readCorpus(opts.skillsRoot);
    const picked: { q: LabelledQuery; rank: string }[] = [];
    for (const skill of Object.keys(opts.twins).sort()) {
        const pos = corpus
            .filter((q) => q.skill === skill && q.trigger)
            .sort((a, b) => (sha256(`${a.skill}\0${a.id}`) < sha256(`${b.skill}\0${b.id}`) ? -1 : 1))
            .slice(0, opts.perUnit);
        for (const q of pos) picked.push({ q, rank: `${String(picked.length + 1).padStart(3, '0')}-${slug(q.skill)}-${slug(q.id)}` });
    }
    compileQueries(
        picked.map((p) => p.q),
        path.join(opts.outRoot, 'evals'),
        (_q, i) => (picked[i] as { rank: string }).rank,
    );
    const plan = {
        schema: 'routing-baseline-plan/v1' as const,
        arm: 'twins',
        plugin: ARM_PLUGIN,
        units: Object.keys(opts.twins).length,
        per_unit: opts.perUnit,
        catalogue_sha256: opts.art.catalogue_sha256,
        rows: rowsOf(picked, opts.catalogueRoot),
        twin_texts: twinTexts,
    };
    fs.writeFileSync(path.join(opts.outRoot, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
    return plan;
}

/** The MCP arm's grader: the lite server's body tool, called for the named unit. */
export function mcpGraderBody(skill: string): string {
    const pattern = `"name":"${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
    return ['---', 'type: tool_used', `tool: ${MCP_READ_TOOL}`, `input_match: '${pattern}'`, 'arm: both', 'weight: 1', '---', ''].join('\n');
}

/**
 * 4.1 — the MCP delivery path: no native skill listing at all, the lite server
 * serving the same catalogue, and selection read as `read_skill(<unit>)`.
 */
export function buildMcpArm(opts: {
    art: BaselineArtifact;
    skillsRoot: string;
    catalogueRoot: string;
    serverCommand: string;
    serverArgs: readonly string[];
    outRoot: string;
}): ArmPlan {
    assertSameCatalogue(opts.catalogueRoot, opts.art);
    refuseTrackedOutput(opts.outRoot);
    manifest(opts.outRoot, 'mcp delivery arm');
    fs.writeFileSync(
        path.join(opts.outRoot, '.mcp.json'),
        JSON.stringify({ mcpServers: { [ARM_SERVER]: { command: opts.serverCommand, args: opts.serverArgs } } }, null, 2) + '\n',
    );
    const picked = baselineQueries(opts.art, opts.skillsRoot);
    compileQueries(
        picked.map((p) => p.q),
        path.join(opts.outRoot, 'evals'),
        (_q, i) => (picked[i] as { rank: string }).rank,
        { grader: (q) => mcpGraderBody(q.skill), extraTools: [MCP_SUGGEST_TOOL, MCP_READ_TOOL] },
    );
    const plan: ArmPlan = {
        schema: 'routing-baseline-plan/v1',
        arm: 'mcp',
        plugin: ARM_PLUGIN,
        units: picked.length,
        per_unit: 1,
        catalogue_sha256: opts.art.catalogue_sha256,
        rows: rowsOf(picked, opts.catalogueRoot),
    };
    fs.writeFileSync(path.join(opts.outRoot, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
    return plan;
}

/**
 * Merge one host aggregate per case (the pressure arm runs one target per
 * case) into a single aggregate the baseline ingester reads. Costs add up; a
 * missing per-case result is reported, not invented.
 */
export function mergeAggregates(plan: ArmPlan, resultsDir: string): { aggregate: Record<string, unknown>; missing: string[] } {
    const cases: unknown[] = [];
    const missing: string[] = [];
    let cost = 0;
    let host = '';
    let started = '';
    let partial = false;
    for (const r of plan.rows) {
        const f = path.join(resultsDir, `${r.case}.json`);
        if (!fs.existsSync(f)) {
            missing.push(r.case);
            continue;
        }
        const a = JSON.parse(fs.readFileSync(f, 'utf8')) as {
            cases?: unknown[];
            costUsd?: number;
            claudeVersion?: string;
            startedAt?: string;
            partial?: boolean;
        };
        cases.push(...(a.cases ?? []));
        cost += a.costUsd ?? 0;
        host = host || (a.claudeVersion ?? '');
        if (started === '' || (a.startedAt ?? '') < started) started = a.startedAt ?? started;
        partial = partial || a.partial === true;
    }
    return {
        aggregate: { claudeVersion: host, startedAt: started, costUsd: cost, partial: partial || missing.length > 0, cases },
        missing,
    };
}

function arg(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

function need(argv: readonly string[], names: readonly string[]): Record<string, string> | null {
    const out: Record<string, string> = {};
    for (const n of names) {
        const v = arg(argv, n);
        if (v === null || v === '') {
            process.stderr.write(`routing_arms: --${n} is required\n`);
            return null;
        }
        out[n] = v;
    }
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const skillsRoot = arg(argv, 'skills') ?? path.join(REPO_ROOT, 'src', 'skills');
    const readArt = (p: string): BaselineArtifact => JSON.parse(fs.readFileSync(p, 'utf8')) as BaselineArtifact;
    try {
        if (argv.includes('--pressure')) {
            const a = need(argv, ['baseline', 'catalogue', 'n', 'seed', 'out']);
            if (a === null) return 2;
            const n: PressureSize = a['n'] === 'full' ? 'full' : (Number(a['n']) as PressureSize);
            const plan = buildPressureArm({ art: readArt(a['baseline'] as string), skillsRoot, catalogueRoot: a['catalogue'] as string, n, seed: a['seed'] as string, outRoot: a['out'] as string });
            process.stdout.write(`routing_arms: ${String(plan.rows.length)} pressure target(s) at N=${String(n)} -> ${a['out'] as string}\n`);
            return 0;
        }
        if (argv.includes('--twins')) {
            const a = need(argv, ['baseline', 'catalogue', 'twins-file', 'per-unit', 'out']);
            if (a === null) return 2;
            const twins = JSON.parse(fs.readFileSync(a['twins-file'] as string, 'utf8')) as Record<string, string>;
            const plan = buildTwinArm({ art: readArt(a['baseline'] as string), skillsRoot, catalogueRoot: a['catalogue'] as string, twins, perUnit: Number(a['per-unit']), outRoot: a['out'] as string });
            process.stdout.write(`routing_arms: ${String(plan.rows.length)} twin case(s) over ${String(plan.units)} pair(s) -> ${a['out'] as string}\n`);
            return 0;
        }
        if (argv.includes('--mcp')) {
            const a = need(argv, ['baseline', 'catalogue', 'server-command', 'out']);
            if (a === null) return 2;
            const serverArgs = argv.flatMap((v, i) => (v === '--server-arg' && i + 1 < argv.length ? [argv[i + 1] as string] : []));
            const plan = buildMcpArm({ art: readArt(a['baseline'] as string), skillsRoot, catalogueRoot: a['catalogue'] as string, serverCommand: a['server-command'] as string, serverArgs, outRoot: a['out'] as string });
            process.stdout.write(`routing_arms: ${String(plan.rows.length)} mcp case(s) -> ${a['out'] as string}\n`);
            return 0;
        }
        if (argv.includes('--merge')) {
            const a = need(argv, ['plan', 'results', 'out']);
            if (a === null) return 2;
            const plan = JSON.parse(fs.readFileSync(a['plan'] as string, 'utf8')) as ArmPlan;
            const { aggregate, missing } = mergeAggregates(plan, a['results'] as string);
            fs.writeFileSync(a['out'] as string, JSON.stringify(aggregate, null, 2) + '\n');
            process.stdout.write(`routing_arms: merged ${String((aggregate['cases'] as unknown[]).length)} case(s), ${String(missing.length)} missing -> ${a['out'] as string}\n`);
            return 0;
        }
    } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    process.stderr.write('usage: routing_arms --pressure | --twins | --mcp | --merge (see the module header)\n');
    return 2;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
