#!/usr/bin/env tsx
/**
 * Scorer for the three-arm procedure-cursor measurement. It must stay
 * deterministic and model-free so no arm is graded by a judge prompt.
 *
 * Reads a run directory the eval tool kept (`--keep-temp`) and answers two
 * questions without a model: which of the pilot's non-judgement exits hold on the
 * final tree (exits_met, split into verified `check:` and sequenced `exists:`
 * classes), and whether the candidate's frozen success criterion holds
 * (task_success). The same code scores all three arms.
 *
 * Candidates live under tests/fixtures/procedure-cursor-eval/<id>/ as `case.json`
 * plus the fixture repository in `repo/`. A predicate names a closed operation;
 * nothing from a case file is executed.
 *
 * CLI:
 *   score --run-dir <dir> --case <case.json>   print one run's score as JSON
 *   validate [--root <dir>]                     check the candidate pool
 *   build-arms --out <dir>                      write the six arm plugin directories
 * Exit: 0 ok · 1 invalid input or an invalid pool.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadSidecar, type SidecarStep } from '../agent-src/templates/scripts/work_engine/procedure/sidecar.js';
import { PROCEDURE_CHECKS } from '../agent-src/templates/scripts/work_engine/procedure/checks.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SKILLS_ROOT = path.join(REPO_ROOT, 'src/skills');
export const POOL_ROOT = path.join(REPO_ROOT, 'tests/fixtures/procedure-cursor-eval');
export const PILOTS = ['existing-ui-audit', 'project-analyzer'] as const;
export type Pilot = (typeof PILOTS)[number];
export const CANDIDATES_PER_PILOT = 15;
const ID_PREFIX: Record<Pilot, string> = { 'existing-ui-audit': 'cand-ui-', 'project-analyzer': 'cand-pa-' };

const JSON_OPS = ['mentions_all', 'mentions_none', 'equals', 'is_null', 'absent', 'not_empty', 'every_has'] as const;
const FILE_OPS = ['exists', 'mentions_all', 'mentions_none'] as const;

export type Predicate =
    | { kind: 'json'; file: string; path: string; op: (typeof JSON_OPS)[number]; values?: unknown[] }
    | { kind: 'file'; path: string; op: (typeof FILE_OPS)[number]; values?: string[] }
    | { kind: 'dir'; path: string; op: 'min_files'; min: number }
    | { kind: 'dir'; path: string; op: 'mentions_all' | 'mentions_none'; values: string[] };

export interface Case {
    id: string;
    pilot: Pilot;
    input: string;
    success: Predicate[];
}

export interface ExitTally {
    met: number;
    total: number;
}

export interface RunScore {
    id: string;
    pilot: Pilot;
    exits: { verified: ExitTally; sequenced: ExitTally };
    task_success: boolean;
    unmet: string[];
}

export class CaseError extends Error {}

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A relative path that stays inside the run directory. */
function contained(rel: unknown): rel is string {
    if (typeof rel !== 'string' || rel === '' || path.isAbsolute(rel)) return false;
    return !path.normalize(rel).split(path.sep).includes('..');
}

function parsePredicate(raw: unknown, where: string): Predicate {
    if (!isDict(raw)) throw new CaseError(`${where} must be an object`);
    const allowed = new Set(['kind', 'file', 'path', 'op', 'values', 'min']);
    for (const k of Object.keys(raw)) if (!allowed.has(k)) throw new CaseError(`${where}: unknown key '${k}'`);
    const { kind, op } = raw;
    if (!contained(raw['path']) && kind !== 'json') throw new CaseError(`${where}: path must be relative and contained`);
    if (kind === 'json') {
        if (!contained(raw['file'])) throw new CaseError(`${where}: file must be relative and contained`);
        if (typeof raw['path'] !== 'string' || raw['path'] === '') throw new CaseError(`${where}: path must name a key`);
        if (!JSON_OPS.includes(op as never)) throw new CaseError(`${where}: unknown json op '${String(op)}'`);
        if ((op === 'mentions_all' || op === 'mentions_none' || op === 'equals' || op === 'every_has') && !Array.isArray(raw['values'])) {
            throw new CaseError(`${where}: op '${String(op)}' needs values`);
        }
        return { kind, file: raw['file'] as string, path: raw['path'], op: op as never, values: raw['values'] as unknown[] };
    }
    if (kind === 'file') {
        if (!FILE_OPS.includes(op as never)) throw new CaseError(`${where}: unknown file op '${String(op)}'`);
        if (op !== 'exists' && !(Array.isArray(raw['values']) && raw['values'].every((v) => typeof v === 'string'))) {
            throw new CaseError(`${where}: op '${String(op)}' needs string values`);
        }
        return { kind, path: raw['path'] as string, op: op as never, values: raw['values'] as string[] };
    }
    if (kind === 'dir' && (op === 'mentions_all' || op === 'mentions_none')) {
        if (!(Array.isArray(raw['values']) && raw['values'].length > 0 && raw['values'].every((v) => typeof v === 'string'))) {
            throw new CaseError(`${where}: op '${op}' needs string values`);
        }
        return { kind, path: raw['path'] as string, op, values: raw['values'] as string[] };
    }
    if (kind === 'dir') {
        if (op !== 'min_files' || typeof raw['min'] !== 'number' || raw['min'] < 1) {
            throw new CaseError(`${where}: dir needs op 'min_files' and a positive min, or a mentions op`);
        }
        return { kind, path: raw['path'] as string, op, min: raw['min'] };
    }
    throw new CaseError(`${where}: unknown kind '${String(kind)}'`);
}

export function parseCase(raw: unknown): Case {
    if (!isDict(raw)) throw new CaseError('case must be an object');
    for (const k of Object.keys(raw)) {
        if (!['id', 'pilot', 'input', 'success'].includes(k)) throw new CaseError(`unknown key '${k}'`);
    }
    const { id, pilot, input, success } = raw;
    if (!PILOTS.includes(pilot as Pilot)) throw new CaseError(`unknown pilot '${String(pilot)}'`);
    if (typeof id !== 'string' || !new RegExp(`^${ID_PREFIX[pilot as Pilot]}\\d{2}$`).test(id)) {
        throw new CaseError(`id '${String(id)}' does not match the pilot's prefix`);
    }
    if (typeof input !== 'string' || input.trim() === '') throw new CaseError(`${id}: input must be non-empty`);
    if (!Array.isArray(success) || success.length === 0) throw new CaseError(`${id}: success needs predicates`);
    return { id, pilot: pilot as Pilot, input, success: success.map((p, i) => parsePredicate(p, `${id}.success[${i}]`)) };
}

export function loadCase(file: string): Case {
    return parseCase(JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown);
}

/** Values at a dotted path; a `[]` suffix flattens an array. Absent → undefined. */
export function resolvePath(doc: unknown, dotted: string): unknown[] | undefined {
    let nodes: unknown[] = [doc];
    for (const seg of dotted.split('.')) {
        const flatten = seg.endsWith('[]');
        const key = flatten ? seg.slice(0, -2) : seg;
        const next: unknown[] = [];
        for (const n of nodes) {
            if (!isDict(n) || !(key in n)) continue;
            const v = n[key];
            if (flatten) {
                if (Array.isArray(v)) next.push(...v);
            } else next.push(v);
        }
        if (next.length === 0) return undefined;
        nodes = next;
    }
    return nodes;
}

const mentions = (haystack: unknown, needle: unknown): boolean =>
    JSON.stringify(haystack ?? null).toLowerCase().includes(String(needle).toLowerCase());

function readJson(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
    } catch {
        return undefined;
    }
}

function countFiles(dir: string): number {
    let n = 0;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return 0;
    }
    for (const e of entries) {
        if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
        else if (e.isFile()) n += 1;
    }
    return n;
}

/** Every regular file's text under a directory, concatenated; '' when absent. */
function readTree(dir: string): string {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return '';
    }
    return entries
        .map((e) => (e.isDirectory() ? readTree(path.join(dir, e.name)) : e.isFile() ? fs.readFileSync(path.join(dir, e.name), 'utf-8') : ''))
        .join('\n');
}

/**
 * `rel` under `runDir` when its real path stays inside the run's real path,
 * else null. The run directory is an agent's output, so a symlink in it must
 * not let a file outside satisfy a predicate.
 */
function inRun(runDir: string, rel: string): string | null {
    const abs = path.join(runDir, rel);
    try {
        const root = fs.realpathSync(runDir);
        const real = fs.realpathSync(abs);
        return real === root || real.startsWith(root + path.sep) ? abs : null;
    } catch {
        return null;
    }
}

/** Whether one predicate holds on the run directory. Every op except a dir mentions_none fails on an empty run. */
export function holds(runDir: string, p: Predicate): boolean {
    if (p.kind === 'dir') {
        const dir = inRun(runDir, p.path);
        if (p.op === 'min_files') return dir !== null && countFiles(dir) >= p.min;
        const text = dir === null ? '' : readTree(dir);
        // An absent directory invents nothing, so mentions_none holds there; mentions_all needs the text.
        if (p.op === 'mentions_none') return !p.values.some((v) => mentions(text, v));
        return text !== '' && p.values.every((v) => mentions(text, v));
    }
    if (p.kind === 'file') {
        const file = inRun(runDir, p.path);
        if (file === null || !fs.statSync(file).isFile()) return false;
        if (p.op === 'exists') return true;
        const text = fs.readFileSync(file, 'utf-8');
        const values = p.values ?? [];
        return p.op === 'mentions_all' ? values.every((v) => mentions(text, v)) : !values.some((v) => mentions(text, v));
    }
    const json = inRun(runDir, p.file);
    const doc = json === null ? undefined : readJson(json);
    if (doc === undefined) return false;
    const found = resolvePath(doc, p.path);
    if (p.op === 'absent') return found === undefined;
    if (found === undefined) return false;
    const values = p.values ?? [];
    switch (p.op) {
        case 'is_null':
            return found.every((v) => v === null);
        case 'not_empty':
            return found.some((v) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0) && !(isDict(v) && Object.keys(v).length === 0));
        case 'equals':
            return found.length === 1 && JSON.stringify(found[0]) === JSON.stringify(values[0]);
        case 'mentions_all':
            return values.every((v) => mentions(found, v));
        case 'mentions_none':
            return !values.some((v) => mentions(found, v));
        case 'every_has': {
            const items = found.flatMap((v) => (Array.isArray(v) ? v : [v]));
            const filled = (x: unknown): boolean => x !== undefined && x !== null && x !== '';
            return items.length > 0 && items.every((it) => isDict(it) && values.every((k) => filled(it[String(k)])));
        }
    }
}

function stepApplies(runDir: string, step: SidecarStep): boolean {
    if (step.when === undefined) return true;
    const present = inRun(runDir, step.when.path) !== null;
    return step.when.predicate === 'file-exists' ? present : !present;
}

/** The pilot's non-judgement exits that hold on the run's final tree, by class. */
export function scoreExits(runDir: string, pilot: Pilot, skillsRoot = SKILLS_ROOT): RunScore['exits'] {
    const sidecar = loadSidecar(skillsRoot, pilot);
    const verified: ExitTally = { met: 0, total: 0 };
    const sequenced: ExitTally = { met: 0, total: 0 };
    for (const step of sidecar.steps) {
        if (!stepApplies(runDir, step)) continue;
        const exit = step.exit;
        if (exit.kind === 'check') {
            verified.total += 1;
            const check = PROCEDURE_CHECKS[exit.id];
            if (check !== undefined && check({ projectRoot: runDir, skillDir: sidecar.skillDir }).ok) verified.met += 1;
        } else if (exit.kind === 'exists') {
            sequenced.total += 1;
            if (contained(exit.path) && inRun(runDir, exit.path) !== null) sequenced.met += 1;
        }
    }
    return { verified, sequenced };
}

export function scoreRun(runDir: string, c: Case, skillsRoot = SKILLS_ROOT): RunScore {
    const unmet = c.success.flatMap((p, i) => (holds(runDir, p) ? [] : [`success[${i}]`]));
    return { id: c.id, pilot: c.pilot, exits: scoreExits(runDir, c.pilot, skillsRoot), task_success: unmet.length === 0, unmet };
}

/**
 * Problems with the candidate pool: every pilot has exactly the pre-registered
 * number of candidates, each case parses, its directory matches its id, its
 * fixture repository exists, and no candidate is already a success on the
 * untouched fixture — a criterion that holds before the agent acts measures nothing.
 */
export function validatePool(root = POOL_ROOT): string[] {
    const problems: string[] = [];
    const perPilot = new Map<Pilot, number>(PILOTS.map((p) => [p, 0]));
    const dirs = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
    for (const d of dirs) {
        const dir = path.join(root, d.name);
        let c: Case;
        try {
            c = loadCase(path.join(dir, 'case.json'));
        } catch (e) {
            problems.push(`${d.name}: ${(e as Error).message}`);
            continue;
        }
        if (c.id !== d.name) problems.push(`${d.name}: case id is '${c.id}'`);
        const repo = path.join(dir, 'repo');
        if (countFiles(repo) === 0) problems.push(`${d.name}: repo/ is empty or missing`);
        else if (c.success.every((p) => holds(repo, p))) problems.push(`${d.name}: success already holds on the untouched fixture`);
        perPilot.set(c.pilot, (perPilot.get(c.pilot) ?? 0) + 1);
    }
    for (const [pilot, n] of perPilot) {
        if (n !== CANDIDATES_PER_PILOT) problems.push(`${pilot}: ${n} candidates, expected ${CANDIDATES_PER_PILOT}`);
    }
    return problems;
}

export const ARMS = ['A', 'B', 'C'] as const;
export type Arm = (typeof ARMS)[number];
export const PRE_SPLIT_ROOT = path.join(REPO_ROOT, 'tests/skills/fixtures/procedure_conservation');
export const CURSOR_ENTRY_LINE = (pilot: Pilot): string =>
    `Enter this skill's procedure with \`agent-config work --procedure ${pilot}\` and follow the step it hands out; call it again after each step.`;
const ALLOWED_TOOLS = '[Read, Glob, Grep, Write, Edit, Bash, Skill]';

/** The task prompt, identical in every arm: only the skill files and arm C's appended line differ. */
export function taskPrompt(c: Case): string {
    return `Use the \`${c.pilot}\` skill on the project in the current directory and carry it through to its output.\n\nTask input: ${c.input}\n`;
}

function copyTree(from: string, to: string): void {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, e.name);
        const dst = path.join(to, e.name);
        if (e.isDirectory()) copyTree(src, dst);
        else if (e.isFile()) fs.copyFileSync(src, dst);
    }
}

/**
 * One plugin directory per pilot and arm, each holding only that pilot's skill and
 * one eval case per candidate. The output is generated per run, never committed:
 * arm A is the committed pre-split body, arms B and C copy the split skill as it
 * stands in this checkout.
 */
export function buildArms(outDir: string, poolRoot = POOL_ROOT, skillsRoot = SKILLS_ROOT, preSplitRoot = PRE_SPLIT_ROOT): string[] {
    const cases = fs
        .readdirSync(poolRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => ({ dir: path.join(poolRoot, d.name), c: loadCase(path.join(poolRoot, d.name, 'case.json')) }));
    const written: string[] = [];
    for (const pilot of PILOTS) {
        for (const arm of ARMS) {
            const root = path.join(outDir, pilot, arm);
            fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
            fs.writeFileSync(
                path.join(root, '.claude-plugin', 'plugin.json'),
                `${JSON.stringify({ name: `pc-${pilot}-${arm.toLowerCase()}`, version: '0.0.0' }, null, 2)}\n`,
            );
            const skillDir = path.join(root, 'skills', pilot);
            if (arm === 'A') {
                fs.mkdirSync(skillDir, { recursive: true });
                fs.copyFileSync(path.join(preSplitRoot, `${pilot}.pre-split.txt`), path.join(skillDir, 'SKILL.md'));
            } else copyTree(path.join(skillsRoot, pilot), skillDir);
            for (const { dir, c } of cases.filter((x) => x.c.pilot === pilot)) {
                const caseDir = path.join(root, 'evals', c.id);
                fs.mkdirSync(caseDir, { recursive: true });
                const front = [
                    '---',
                    `name: ${c.id}`,
                    'runs: 3',
                    'max_turns: 40',
                    'timeout_seconds: 1800',
                    `allowed_tools: ${ALLOWED_TOOLS}`,
                    ...(arm === 'C' ? [`append_system_prompt: ${JSON.stringify(CURSOR_ENTRY_LINE(pilot))}`] : []),
                    '---',
                    '',
                ].join('\n');
                fs.writeFileSync(path.join(caseDir, 'prompt.md'), `${front}${taskPrompt(c)}`);
                const scaffold = `cp -R ${JSON.stringify(path.join(dir, 'repo'))}/. .`;
                fs.writeFileSync(
                    path.join(caseDir, 'case.yaml'),
                    `schema_version: "1.1"\nname: ${c.id}\ncontext:\n  scaffold_script: ${JSON.stringify(scaffold)}\n`,
                );
            }
            written.push(root);
        }
    }
    return written;
}

function arg(argv: string[], flag: string): string | undefined {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
}

export function main(argv: string[]): number {
    const [cmd] = argv;
    if (cmd === 'score') {
        const runDir = arg(argv, '--run-dir');
        const caseFile = arg(argv, '--case');
        if (runDir === undefined || caseFile === undefined) {
            process.stderr.write('usage: score --run-dir <dir> --case <case.json>\n');
            return 1;
        }
        try {
            process.stdout.write(`${JSON.stringify(scoreRun(path.resolve(runDir), loadCase(caseFile)), null, 2)}\n`);
            return 0;
        } catch (e) {
            process.stderr.write(`${(e as Error).message}\n`);
            return 1;
        }
    }
    if (cmd === 'validate') {
        const problems = validatePool(path.resolve(arg(argv, '--root') ?? POOL_ROOT));
        for (const p of problems) process.stdout.write(`- ${p}\n`);
        process.stdout.write(problems.length === 0 ? 'pool valid\n' : `${problems.length} problem(s)\n`);
        return problems.length === 0 ? 0 : 1;
    }
    if (cmd === 'build-arms') {
        const out = arg(argv, '--out');
        if (out === undefined) {
            process.stderr.write('usage: build-arms --out <dir>\n');
            return 1;
        }
        for (const root of buildArms(path.resolve(out))) process.stdout.write(`${root}\n`);
        return 0;
    }
    process.stderr.write('usage: bench_procedure_cursor score|validate|build-arms\n');
    return 1;
}

function isMain(): boolean {
    if (process.argv[1] === undefined) return false;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
    }
}

if (isMain()) process.exit(main(process.argv.slice(2)));
