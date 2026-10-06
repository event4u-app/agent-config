/**
 * Module-level reach — which `_lib` modules does nothing in production call?
 *
 * `check_gate_reachability.ts` already answers this question at TASK-target
 * granularity (is a gate wired into `task ci`) and at EXPORT granularity for
 * the declared loop instruments (`loop_surfaces.ts`). Neither axis sees a
 * whole MODULE under `src/scripts/_lib/` that nothing imports and nothing
 * runs by path — that is the gap this module closes.
 *
 * Two independent readings, by design, because they answer different
 * questions and conflating them either over- or under-counts:
 *
 * - **Name occurrence** ({@link buildNameIndex}) — the GENEROUS reading. A
 *   module named only in a comment or a prose file counts as referenced.
 *   This is the floor: it can only under-count how dead a module is.
 * - **Import-graph reach** ({@link computeReach}) — follows actual import
 *   edges (plus run-by-path targets) from every file OUTSIDE `_lib/`,
 *   treated as live by construction. A module imported only by another
 *   module that is itself unreached stays unreached — reachability does
 *   not propagate through a dead node.
 *
 * Both are regex-based line scans, matching every other gate in this family
 * (`check_gate_reachability.ts`'s own `parseTargets`) rather than a full TS
 * parse: the failure mode of a missed edge is "reports live code as dead",
 * which a human catches in the one-reading-per-module report; a full parser
 * would cost a dependency this family has deliberately avoided everywhere
 * else.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LIB_DIR_REL = 'src/scripts/_lib';
export const SCRIPTS_DIR_REL = 'src/scripts';
export const ROADMAPS_DIR_REL = 'agents/roadmaps';
export const TASKFILES_DIR_REL = 'taskfiles';
export const ROOT_TASKFILE_REL = 'Taskfile.yml';
export const WORKFLOWS_DIR_REL = '.github/workflows';
export const DISPATCH_REL = 'src/scripts/_dispatch.bash';
export const CONFIG_DIR_REL = 'src/config';
export const CONTRACTS_TESTS_DIR_REL = 'tests/contracts';

/** Roots the GENEROUS name-occurrence reading scans — per the roadmap's own list. */
export const NAME_SCAN_ROOTS: readonly string[] = [
    'src',
    TASKFILES_DIR_REL,
    ROOT_TASKFILE_REL,
    '.github',
    'package.json',
    'docs/contracts',
];

const IGNORE_DIR_NAMES = new Set(['node_modules', '.git', 'dist', 'coverage']);
const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.yml', '.yaml', '.json', '.md', '.bash', '.sh']);

function isTestFile(relPath: string): boolean {
    return (
        relPath.endsWith('.test.ts') ||
        relPath.endsWith('.test.tsx') ||
        relPath.endsWith('.d.ts') ||
        relPath.startsWith('tests/')
    );
}

/** Recursively list files under `root`-relative `rel`, filtered to text-ish extensions. */
function walk(root: string, rel: string, out: string[]): void {
    const abs = path.join(root, rel);
    let stat: fs.Stats;
    try {
        stat = fs.statSync(abs);
    } catch {
        return;
    }
    if (stat.isFile()) {
        if (TEXT_EXTS.has(path.extname(rel))) out.push(rel);
        return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of fs.readdirSync(abs).sort()) {
        if (IGNORE_DIR_NAMES.has(entry)) continue;
        walk(root, path.join(rel, entry), out);
    }
}

function listFiles(root: string, rels: readonly string[]): string[] {
    const out: string[] = [];
    for (const r of rels) walk(root, r, out);
    return out;
}

export interface LibModule {
    /** Basename without extension — e.g. `module_reach`. */
    name: string;
    /** Repo-relative path — e.g. `src/scripts/_lib/module_reach.ts`. */
    relPath: string;
    lines: number;
}

/** Every module directly under `_lib`, excluding test files and declaration files. */
export function listLibModules(root: string): LibModule[] {
    const dir = path.join(root, LIB_DIR_REL);
    if (!fs.existsSync(dir)) return [];
    const out: LibModule[] = [];
    for (const entry of fs.readdirSync(dir).sort()) {
        if (!entry.endsWith('.ts')) continue;
        const relPath = path.posix.join(LIB_DIR_REL, entry);
        if (isTestFile(relPath)) continue;
        const abs = path.join(root, relPath);
        if (!fs.statSync(abs).isFile()) continue;
        const text = fs.readFileSync(abs, 'utf-8');
        out.push({ name: entry.replace(/\.ts$/, ''), relPath, lines: text.split('\n').length });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Resolve a relative import specifier to a repo-relative `.ts` file, or `null`. */
function resolveImport(root: string, importerRel: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) return null; // bare specifier — an npm package or node: builtin
    const importerDir = path.dirname(path.join(root, importerRel));
    const target = path.resolve(importerDir, specifier);
    const candidates = [
        `${target}.ts`,
        `${target}.tsx`,
        target.endsWith('.js') ? target.replace(/\.js$/, '.ts') : null,
        path.join(target, 'index.ts'),
    ].filter((c): c is string => c !== null);
    for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
            return path.relative(root, c).split(path.sep).join('/');
        }
    }
    return null;
}

/** Directed import edges: importer (non-test `.ts` file) → every `.ts` file it resolves to. */
export function buildImportGraph(root: string): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    const files = listFiles(root, ['src']).filter(
        (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !isTestFile(f),
    );
    for (const rel of files) {
        const text = fs.readFileSync(path.join(root, rel), 'utf-8');
        const edges = new Set<string>();
        for (const re of [IMPORT_RE, REQUIRE_RE, DYNAMIC_IMPORT_RE]) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                const resolved = resolveImport(root, rel, m[1] as string);
                if (resolved !== null) edges.add(resolved);
            }
        }
        graph.set(rel, edges);
    }
    return graph;
}

/** A literal `_lib` module path mentioned in a taskfile / workflow / the dispatcher, run by path. */
export function runByPathTargets(root: string): Set<string> {
    const sources: string[] = [];
    for (const rel of [ROOT_TASKFILE_REL, DISPATCH_REL]) {
        const abs = path.join(root, rel);
        if (fs.existsSync(abs)) sources.push(fs.readFileSync(abs, 'utf-8'));
    }
    const tfDir = path.join(root, TASKFILES_DIR_REL);
    if (fs.existsSync(tfDir)) {
        for (const f of fs.readdirSync(tfDir).sort()) {
            if (f.endsWith('.yml') || f.endsWith('.yaml')) sources.push(fs.readFileSync(path.join(tfDir, f), 'utf-8'));
        }
    }
    const wfDir = path.join(root, WORKFLOWS_DIR_REL);
    if (fs.existsSync(wfDir)) {
        for (const f of fs.readdirSync(wfDir).sort()) {
            if (f.endsWith('.yml') || f.endsWith('.yaml')) sources.push(fs.readFileSync(path.join(wfDir, f), 'utf-8'));
        }
    }
    const text = sources.join('\n');
    const targets = new Set<string>();
    // The dispatcher also reaches `_lib` via `$SCRIPT_DIR/_lib/<name>.ts` —
    // `$SCRIPT_DIR` resolves to `src/scripts` at runtime, so the literal
    // `src/scripts/` prefix is optional here.
    const re = /(?:src\/scripts\/)?_lib\/([a-zA-Z0-9_]+)(?:\.ts)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        targets.add(path.posix.join(LIB_DIR_REL, `${m[1] as string}.ts`));
    }
    return targets;
}

export interface ReachResult {
    /** Every file (not only `_lib`) reached, starting from non-`_lib` files + run-by-path targets. */
    reached: Set<string>;
}

/**
 * BFS from every file OUTSIDE `_lib/` (treated as live, per the roadmap's
 * "every top-level script as live" reading, generalised to every non-`_lib`
 * file in `src/`) plus run-by-path targets. A `_lib` module reached only
 * through another unreached `_lib` module never enters the visited set,
 * which is what makes "eight that only other unreached modules import" a
 * distinguishable outcome rather than an automatic pass.
 */
export function computeReach(root: string): ReachResult {
    const graph = buildImportGraph(root);
    const libDir = `${LIB_DIR_REL}/`;
    const roots: string[] = [...graph.keys()].filter((f) => !f.startsWith(libDir));
    for (const t of runByPathTargets(root)) roots.push(t);

    const visited = new Set<string>();
    const stack = [...roots];
    while (stack.length > 0) {
        const n = stack.pop() as string;
        if (visited.has(n)) continue;
        visited.add(n);
        for (const e of graph.get(n) ?? []) if (!visited.has(e)) stack.push(e);
    }
    return { reached: visited };
}

/** `\w` includes `_`, so a snake_case module name tokenises as one identifier. */
const TOKEN_RE = /[A-Za-z0-9_]+/g;

/**
 * token → set of repo-relative files mentioning it.
 *
 * Scans {@link NAME_SCAN_ROOTS} plus `tests/` — the latter never counts
 * toward `namedByProduction` ({@link namingFiles} filters test files out),
 * it exists so {@link importingTests} can see which tests mention a module
 * at all, including the `tests/contracts/` subset.
 */
export function buildNameIndex(root: string): Map<string, Set<string>> {
    const files = listFiles(root, [...NAME_SCAN_ROOTS, 'tests']);
    const index = new Map<string, Set<string>>();
    for (const rel of files) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            continue;
        }
        const seen = new Set<string>();
        TOKEN_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = TOKEN_RE.exec(text)) !== null) seen.add(m[0]);
        for (const tok of seen) {
            let set = index.get(tok);
            if (set === undefined) {
                set = new Set();
                index.set(tok, set);
            }
            set.add(rel);
        }
    }
    return index;
}

/** Non-self, non-test files (from the name index) mentioning `moduleName`. */
export function namingFiles(nameIndex: Map<string, Set<string>>, moduleName: string, selfRelPath: string): string[] {
    const hits = nameIndex.get(moduleName) ?? new Set<string>();
    return [...hits].filter((f) => f !== selfRelPath && !isTestFile(f)).sort();
}

/** Every `tests/**` file (from the name index) mentioning `moduleName`. */
export function importingTests(nameIndex: Map<string, Set<string>>, moduleName: string): string[] {
    const hits = nameIndex.get(moduleName) ?? new Set<string>();
    return [...hits].filter((f) => f.startsWith('tests/')).sort();
}

export function hasOwnEntryPoint(root: string, relPath: string): boolean {
    const text = fs.readFileSync(path.join(root, relPath), 'utf-8');
    return text.startsWith('#!/usr/bin/env') || /\bprocess\.argv\[1\]/.test(text) || /_isCliEntry/.test(text);
}

/** Config files under `src/config/` (json/yaml) mentioning the module by name or path. */
export function registryDeclared(root: string, moduleName: string): string[] {
    const dir = path.join(root, CONFIG_DIR_REL);
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const f of files.sort()) {
        const rel = path.posix.join(CONFIG_DIR_REL, f);
        const text = fs.readFileSync(path.join(root, rel), 'utf-8');
        if (new RegExp(`\\b${moduleName}\\b`).test(text)) out.push(rel);
    }
    return out;
}

export type RoadmapEstate = 'active' | 'later' | 'stubs';

export interface RoadmapStepHit {
    roadmapRelPath: string;
    estate: RoadmapEstate;
    /** `' '` open, `'x'` done, `'~'` deferred, `'-'` cancelled, or `null` for prose outside any step. */
    glyph: string | null;
    stepLine: string;
}

function roadmapFiles(root: string): { relPath: string; estate: RoadmapEstate }[] {
    const dir = path.join(root, ROADMAPS_DIR_REL);
    if (!fs.existsSync(dir)) return [];
    const out: { relPath: string; estate: RoadmapEstate }[] = [];
    for (const f of fs.readdirSync(dir).sort()) {
        if (f === 'template.md') continue;
        const abs = path.join(dir, f);
        if (!fs.statSync(abs).isFile()) continue;
        if (!f.endsWith('.md')) continue;
        out.push({ relPath: path.posix.join(ROADMAPS_DIR_REL, f), estate: 'active' });
    }
    for (const [sub, estate] of [
        ['later', 'later'],
        ['stubs', 'stubs'],
    ] as const) {
        const subDir = path.join(dir, sub);
        if (!fs.existsSync(subDir)) continue;
        for (const f of fs.readdirSync(subDir).sort()) {
            if (!f.endsWith('.md')) continue;
            out.push({ relPath: path.posix.join(ROADMAPS_DIR_REL, sub, f), estate });
        }
    }
    return out;
}

const STEP_LINE_RE = /^- \[([ x~-])\]/;

/**
 * Find where `moduleName` is named across the live roadmap estate
 * (active, `later/`, `stubs/`) — per-step when inside a step block,
 * `glyph: null` when the mention sits in prose outside any step.
 */
export function findRoadmapMentions(root: string, moduleName: string): RoadmapStepHit[] {
    const hits: RoadmapStepHit[] = [];
    const nameRe = new RegExp(`\\b${moduleName}\\b`);
    for (const { relPath, estate } of roadmapFiles(root)) {
        const lines = fs.readFileSync(path.join(root, relPath), 'utf-8').split('\n');
        let currentGlyph: string | null = null;
        let currentStepLine = '';
        for (const line of lines) {
            const stepMatch = STEP_LINE_RE.exec(line);
            if (stepMatch !== null) {
                currentGlyph = stepMatch[1] as string;
                currentStepLine = line.trim();
            } else if (/^(#|##|###)\s/.test(line) || line.trim() === '') {
                // a heading or a blank line ends the current step's block for our purposes
                // (kept conservative: a step's cited paths/notes are usually within a few
                // indented lines of its bullet, not past the next heading).
                if (/^(#|##|###)\s/.test(line)) {
                    currentGlyph = null;
                    currentStepLine = '';
                }
            }
            if (nameRe.test(line)) {
                hits.push({ roadmapRelPath: relPath, estate, glyph: currentGlyph, stepLine: currentStepLine });
            }
        }
    }
    return hits;
}

export type ReachGroup = 'contract-test' | 'open-or-deferred-step' | 'named-outside-open-step' | 'named-in-none';

export interface ModuleFact {
    name: string;
    relPath: string;
    lines: number;
    importingTests: string[];
    namedByProduction: boolean;
    namingFiles: string[];
    hasOwnEntryPoint: boolean;
    registryDeclared: string[];
    reachedByImportOrPath: boolean;
    /** Only set when `namedByProduction` is false — the roadmap-based group. */
    group: ReachGroup | null;
    /** The step/file citation backing `group`, when roadmaps were available. */
    groupEvidence: string | null;
    roadmapsAvailable: boolean;
}

export interface ModuleReachReport {
    modules: ModuleFact[];
    roadmapsAvailable: boolean;
}

export function analyseModuleReach(root: string): ModuleReachReport {
    const modules = listLibModules(root);
    const nameIndex = buildNameIndex(root);
    const reach = computeReach(root);
    const roadmapsAvailable = fs.existsSync(path.join(root, ROADMAPS_DIR_REL));

    const facts: ModuleFact[] = modules.map((mod) => {
        const nf = namingFiles(nameIndex, mod.name, mod.relPath);
        const namedByProduction = nf.length > 0;
        let group: ReachGroup | null = null;
        let groupEvidence: string | null = null;

        if (!namedByProduction) {
            const contractHit = importingTests(nameIndex, mod.name).find((f) => f.startsWith(CONTRACTS_TESTS_DIR_REL));
            if (contractHit !== undefined) {
                group = 'contract-test';
                groupEvidence = contractHit;
            } else if (roadmapsAvailable) {
                const mentions = findRoadmapMentions(root, mod.name);
                const openOrDeferred = mentions.find((h) => h.glyph === ' ' || h.glyph === '~');
                if (openOrDeferred !== undefined) {
                    group = 'open-or-deferred-step';
                    groupEvidence = `${openOrDeferred.roadmapRelPath} (${openOrDeferred.estate}): ${openOrDeferred.stepLine}`;
                } else if (mentions.length > 0) {
                    group = 'named-outside-open-step';
                    const m = mentions[0] as RoadmapStepHit;
                    groupEvidence = `${m.roadmapRelPath} (${m.estate})${m.stepLine !== '' ? `: ${m.stepLine}` : ''}`;
                } else {
                    group = 'named-in-none';
                    groupEvidence = null;
                }
            } else {
                // Published package: no roadmaps directory to check against.
                group = 'named-in-none';
                groupEvidence = 'no roadmaps directory present — roadmap groups skipped';
            }
        }

        return {
            name: mod.name,
            relPath: mod.relPath,
            lines: mod.lines,
            importingTests: importingTests(nameIndex, mod.name),
            namedByProduction,
            namingFiles: nf,
            hasOwnEntryPoint: hasOwnEntryPoint(root, mod.relPath),
            registryDeclared: registryDeclared(root, mod.name),
            reachedByImportOrPath: reach.reached.has(mod.relPath),
            group,
            groupEvidence,
            roadmapsAvailable,
        };
    });

    return { modules: facts, roadmapsAvailable };
}

export function groupCounts(modules: readonly ModuleFact[]): Record<ReachGroup, number> {
    const counts: Record<ReachGroup, number> = {
        'contract-test': 0,
        'open-or-deferred-step': 0,
        'named-outside-open-step': 0,
        'named-in-none': 0,
    };
    for (const m of modules) if (m.group !== null) counts[m.group] += 1;
    return counts;
}
