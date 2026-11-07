#!/usr/bin/env tsx
/**
 * Which test files can a diff reach?
 *
 * tests.yml ran every one of ~2,450 Vitest files on every pull request and every
 * merge-queue entry, however small the diff. This selects the files a change can
 * actually reach, so the merge gate runs those and nothing else, and falls back to
 * the whole suite whenever the answer cannot be computed honestly.
 *
 * The dependency graph is built from the tracked tree, not from Vitest's module
 * graph, because a third of the suite reaches its subject through a SUBPROCESS
 * (`spawnSync(tsx, [path.join(ROOT, 'src', 'scripts', 'x.ts')])`) that no import
 * graph sees. Edges, per tracked code file:
 *
 *   1. static and dynamic `import` / `export … from` / `require` specifiers;
 *   2. path tokens — string literals, the literal segments of a
 *      `path.join` / `path.resolve` / `join` call, and any `src/…`-shaped run of
 *      characters (bash dispatchers, template strings) — resolved against the
 *      repo root and the file's own directory; a token naming a directory makes
 *      the file depend on everything under it;
 *   3. a bare basename (`memory_report.ts`) that names exactly one tracked file;
 *   4. build outputs (`dist/…`, `./agent-config`, `scripts-run`) mapped back to
 *      the source entries that produce them (`DIST_SOURCES`).
 *
 * A test is selected when a changed path lies in its transitive dependency
 * closure. Precision is traded for recall on purpose: a spurious extra file costs
 * seconds, a missed one lets a red change onto `main`. `push: main` keeps the
 * whole suite as the net that catches what selection misses.
 *
 * Reads `git diff --name-only <merge-base>...HEAD` in-repo, like
 * ci_platform_scope.ts — no third-party changed-files action (CVE-2025-30066).
 *
 * Usage: ./scripts-run src/scripts/ci_select_tests [--base <ref>] [--full] [--json]
 * Writes `mode`, `node_shards`, `node_shard_total`, `node_files`, `golden`,
 * `workspace`, `browser`, `code` and `count` to $GITHUB_OUTPUT when set, and a
 * summary to $GITHUB_STEP_SUMMARY.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export type Mode = 'full' | 'targeted' | 'none';

/** A change to any of these can alter how EVERY test runs, so selection is not attempted. */
export const GLOBAL_TRIGGERS: readonly RegExp[] = [
    /^package(-lock)?\.json$/,
    /^vitest\.config\.ts$/,
    /^vite\.config\.ts$/,
    /^tsconfig[^/]*\.json$/,
    /^tests\/_lib\//,
    /^tests\/setup[^/]*$/,
    /^\.github\/workflows\/tests\.yml$/,
    /^\.nvmrc$/,
    /^\.node-version$/,
    /^src\/scripts\/ci_select_tests\.ts$/,
];

/**
 * The former `paths:` filter of tests.yml's pull_request trigger, moved inside
 * the run so the aggregate check always reports. Gates the jobs selection does
 * not cover (install, install-aux, static checks, collector lifecycle).
 */
export const CODE_PATHS: readonly RegExp[] = [
    /^src\//,
    /^tests\//,
    /^package(-lock)?\.json$/,
    /^tsconfig\.json$/,
    /^vite\.config\.ts$/,
    /^vitest\.config\.ts$/,
    /^eslint\.config\.js$/,
    /^Taskfile\.yml$/,
    /^taskfiles\//,
    /^setup\.sh$/,
    /^\.github\/workflows\/tests\.yml$/,
];

/** `null` (unreadable diff) is treated as code: never guessed as narrow. */
export function touchesCode(changed: readonly string[] | null): boolean {
    return changed === null || changed.length === 0 || changed.some((p) => CODE_PATHS.some((re) => re.test(p)));
}

/** Build outputs and shims, mapped to the tracked sources that produce them. */
export const DIST_SOURCES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
    [/^dist\/cli(\/|$)/, ['src/cli/agent-config.ts', 'src/cli/main.ts']],
    [/^dist\/install(\/|$)/, ['src/scripts/install.ts']],
    [/^dist\/hooks(\/|$)/, ['src/scripts/hooks/dispatch_entry.ts']],
    [/^dist\/mcp(\/|$)/, ['src/scripts/mcp_server/__main__.ts']],
    [/^dist\/cli-delegate(\/|$)/, ['src/scripts/_cli/', 'src/agent-src/scripts/', 'src/scripts/code_graph/cli.ts']],
    [/^dist\/discovery(\/|$)/, ['src/scripts/build_discovery_manifest.ts', 'src/skills/', 'src/rules/', 'src/agent-src/']],
    [/^dist\/agent-src(\/|$)/, ['src/skills/', 'src/rules/', 'src/agent-src/', 'src/domains/']],
    [/^dist\/ui(\/|$)/, ['src/ui/']],
    [/^agent-config$/, ['src/cli/agent-config.ts', 'src/cli/main.ts', 'src/scripts/_dispatch.bash']],
    [/^scripts-run$/, ['src/scripts/run.ts']],
];

/** Edges no token can show: the CLI hands unknown commands to the bash dispatcher. */
const IMPLICIT_EDGES: ReadonlyArray<readonly [string, string]> = [['src/cli/main.ts', 'src/scripts/_dispatch.bash']];

/**
 * The bash dispatcher routes ~110 commands to their scripts. Modelled as one
 * node it made every CLI-spawning suite depend on every script; modelled as a
 * router, a suite depends on the dispatcher's shared code plus the `cmd:<name>`
 * nodes for the commands it names.
 */
export const ROUTER = 'src/scripts/_dispatch.bash';
const CLI_ENTRIES = new Set(['src/cli/agent-config.ts', 'src/cli/main.ts', ROUTER]);
/** Replay suites drive commands named in fixture data, not in their own source. */
const ALL_COMMANDS = /^tests\/golden\//;
const HOOK_ENTRY = 'src/scripts/hooks/dispatch_entry.ts';
const SHIMS = new Set(['agent-config', 'scripts-run']);
const HOOK_COMMAND = 'dispatch:hook';

const ALIASES: Readonly<Record<string, string>> = {
    '@cli/': 'src/cli/',
    '@server/': 'src/server/',
    '@shared/': 'src/shared/',
    '@ui/': 'src/ui/',
    '@install/': 'src/install/',
};

const CODE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|bash|sh)$/;
const RESOLVE_EXT = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];
const TEST_FILE = /^(tests|src)\/.*\.test\.tsx?$/;
/** Never selectable — mirrors `SHARED_EXCLUDE` in vitest.config.ts. */
const NOT_A_SUITE = [/^tests\/golden\/sandbox\/repo\//, /^tests\/fixtures\//, /^src\/templates\/claude-mod\//];
/** Directories too broad to be a meaningful dependency on their own. */
const TOO_BROAD = new Set(['', '.', 'src', 'tests', 'dist', 'docs', 'agents']);

/** Routed to a dedicated job in tests.yml rather than to the node-tests shards. */
export const ROUTES = {
    golden: /^tests\/golden\//,
    workspace: /^(tests\/server\/workspace\.test\.ts|tests\/scripts\/cli\/python\/)/,
    browser: new Set([
        'tests/cli/ui_render_asset_profile.test.ts',
        'tests/cli/ui_render_film_capture.test.ts',
        'tests/design-artifacts/svg_scenarios.test.ts',
        'tests/cli/uiRenderInteract.test.ts',
        'tests/cli/uiRenderRegion.test.ts',
        'tests/cli/uiRender_geometry.test.ts',
        'tests/scripts/design_slop_render_bench.test.ts',
        'tests/scripts/ui_conformance_probe_sibling.test.ts',
        'tests/scripts/web_launch_render_live.test.ts',
    ]),
    /** Excluded from the node shards by tests.yml; never routed there. */
    nodeExcluded: /^(tests\/golden\/|tests\/server\/workspace\.test\.ts$|tests\/scripts\/collector_lifecycle\.test\.ts$|tests\/scripts\/cli\/python\/)/,
};

/** Above this share of the suite, a targeted run is not worth its bookkeeping. */
export const FULL_RUN_SHARE = 0.6;

export interface Graph {
    /** file → exact tracked paths it depends on */
    fileEdges: Map<string, Set<string>>;
    /** file → directory prefixes (with trailing `/`) it depends on */
    dirEdges: Map<string, Set<string>>;
    /** suite → CLI-shell files it runs as a subprocess rather than imports */
    spawnEdges: Map<string, Set<string>>;
}

export interface Selection {
    mode: Mode;
    reason: string;
    tests: string[];
    /** changed code files no test reaches, even through the area fallback */
    unmapped: string[];
}


const SPEC_RE = /(?:\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]*\s*from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"`])([^'"`\n]+)\1/g;
const JOIN_RE = /\b(?:path\.)?(?:join|resolve)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
const LITERAL_RE = /(['"`])((?:(?!\1)[^\\\n$]|\\.){1,200})\1/g;
const SRC_RUN_RE = /(?:^|[^\w.-])((?:src|tests|dist|docs|agents|templates|hooks)\/[\w@./-]+)/g;
const BASENAME_RE = /^[\w.-]+\.(?:ts|tsx|mjs|js|bash|sh|ya?ml|json|md)$/;

/** Module specifiers: static/dynamic imports, re-exports, require. */
export function importSpecifiers(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(SPEC_RE)) if (m[2] !== undefined && !m[2].includes('${')) out.push(m[2]);
    return out;
}

/** Path-shaped tokens a file mentions, before resolution. */
export function pathTokens(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(JOIN_RE)) {
        const segs: string[] = [];
        for (const lit of (m[1] ?? '').matchAll(LITERAL_RE)) if (lit[2] !== undefined) segs.push(lit[2]);
        if (segs.length > 0) out.add(segs.join('/'));
    }
    for (const m of text.matchAll(LITERAL_RE)) {
        const s = m[2] ?? '';
        if (s.includes('/') || BASENAME_RE.test(s) || s === 'agent-config' || s === 'scripts-run') out.add(s);
    }
    for (const m of text.matchAll(SRC_RUN_RE)) if (m[1] !== undefined) out.add(m[1].replace(/[./]+$/, ''));
    return [...out];
}


interface Tree {
    files: Set<string>;
    dirs: Set<string>;
    byBasename: Map<string, string[]>;
}

export function indexTree(files: readonly string[]): Tree {
    const set = new Set(files);
    const dirs = new Set<string>();
    const byBasename = new Map<string, string[]>();
    for (const f of files) {
        const parts = f.split('/');
        for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join('/')}/`);
        const b = parts[parts.length - 1] as string;
        byBasename.set(b, [...(byBasename.get(b) ?? []), f]);
    }
    return { files: set, dirs, byBasename };
}

function normalize(p: string): string | null {
    const n = path.posix.normalize(p).replace(/^\.\//, '').replace(/\/+$/, '');
    return n.startsWith('..') || n.startsWith('/') ? null : n;
}

function distTargets(p: string): readonly string[] {
    for (const [re, targets] of DIST_SOURCES) if (re.test(p)) return targets;
    return [];
}

/** Resolve one token into exact-file and directory dependencies. */
function resolveToken(token: string, fromDir: string, tree: Tree, files: Set<string>, dirs: Set<string>): void {
    const add = (t: string): void => {
        if (t.endsWith('/')) {
            if (!TOO_BROAD.has(t.replace(/\/$/, '')) && tree.dirs.has(t)) dirs.add(t);
        } else if (tree.files.has(t)) files.add(t);
    };
    let cleaned = token.replace(/^\$\{?\w+\}?\//, '').replace(/^[\w]+:\/\//, '');
    for (const [alias, target] of Object.entries(ALIASES)) if (cleaned.startsWith(alias)) cleaned = target + cleaned.slice(alias.length);
    const candidates = new Set<string>();
    const rel = normalize(path.posix.join(fromDir, cleaned));
    const abs = normalize(cleaned);
    if (cleaned.startsWith('.')) {
        if (rel !== null) candidates.add(rel);
    } else {
        if (abs !== null) candidates.add(abs);
        if (rel !== null) candidates.add(rel);
    }
    for (const c of candidates) {
        for (const t of distTargets(c)) add(t);
        if (c.startsWith('dist/')) continue;
        const stem = c.replace(/\.(js|mjs|cjs)$/, '');
        let hit = false;
        for (const ext of RESOLVE_EXT) {
            for (const base of [c, stem]) {
                if (tree.files.has(base + ext)) {
                    files.add(base + ext);
                    hit = true;
                }
            }
            if (hit) break;
        }
        if (!hit && !TOO_BROAD.has(c) && tree.dirs.has(`${c}/`)) dirs.add(`${c}/`);
    }
    if (BASENAME_RE.test(cleaned)) {
        const owners = tree.byBasename.get(cleaned) ?? [];
        if (owners.length === 1) files.add(owners[0] as string);
    }
}

/**
 * Drop comments so a path named in prose is not read as a dependency. A
 * character scanner rather than a regex, because `'src/**\/*.ts'` contains a
 * block-comment opener; it tracks quotes well enough for that, and a quote
 * inside a regex literal costs at most one line of over-stripping.
 */
export function stripComments(text: string, file: string): string {
    if (/\.(bash|sh)$/.test(file) || file === 'agent-config' || file === 'scripts-run') {
        return text
            .split('\n')
            .filter((l) => !/^\s*#(?!!)/.test(l))
            .join('\n');
    }
    let out = '';
    let quote: string | null = null;
    for (let i = 0; i < text.length; i++) {
        const c = text[i] as string;
        const n = text[i + 1];
        if (quote !== null) {
            out += c;
            if (c === '\\') {
                out += n ?? '';
                i++;
            } else if (c === quote || (c === '\n' && quote !== '`')) quote = null;
            continue;
        }
        if (c === '/' && n === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            out += '\n';
            continue;
        }
        if (c === '/' && n === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end < 0 ? text.length : end + 1;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') quote = c;
        out += c;
    }
    return out;
}

export interface RouterTable {
    /** dispatcher text outside the per-command functions */
    core: string;
    /** command name → body of the function it runs */
    commands: Map<string, string>;
}

export function parseRouter(text: string): RouterTable {
    const fns = new Map<string, string>();
    const outside: string[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = /^([A-Za-z_]\w*)\s*\(\)\s*\{/.exec(lines[i] as string);
        if (m === null) {
            outside.push(lines[i] as string);
            continue;
        }
        const rest = (lines[i] as string).slice(m[0].length);
        if (/\}\s*$/.test(rest)) {
            fns.set(m[1] as string, rest.replace(/\}\s*$/, ''));
            continue;
        }
        const body: string[] = [rest];
        for (i++; i < lines.length && lines[i] !== '}'; i++) body.push(lines[i] as string);
        fns.set(m[1] as string, body.join('\n'));
    }
    const callees = (body: string): string[] => [...fns.keys()].filter((f) => f !== 'main' && new RegExp(`(^|[^\\w-])${f}([^\\w-]|$)`, 'm').test(body));
    const closure = (body: string): string => {
        const seen = new Set<string>();
        const stack = callees(body);
        while (stack.length > 0) {
            const f = stack.pop() as string;
            if (seen.has(f)) continue;
            seen.add(f);
            stack.push(...callees(fns.get(f) ?? ''));
        }
        return [body, ...[...seen].map((f) => fns.get(f) ?? '')].join('\n');
    };
    const commands = new Map<string, string>();
    const mainBody = (fns.get('main') ?? '').split('\n');
    const coreMain: string[] = [];
    for (const line of mainBody) {
        const arm = /^\s+([a-z][\w:|-]*)\)\s+([A-Za-z_]\w*)/.exec(line);
        if (arm === null || !fns.has(arm[2] as string)) {
            coreMain.push(line);
            continue;
        }
        const body = closure(fns.get(arm[2] as string) ?? '');
        for (const name of (arm[1] as string).split('|')) commands.set(name, body);
    }
    return { core: closure([...outside, ...coreMain].join('\n')), commands };
}

/** [imported files, all named files (imports included), named directories] */
function edgesOf(text: string, fromDir: string, tree: Tree): [Set<string>, Set<string>, Set<string>] {
    const imp = new Set<string>();
    const fe = new Set<string>();
    const de = new Set<string>();
    for (const spec of importSpecifiers(text)) resolveToken(spec, fromDir, tree, imp, de);
    for (const tok of pathTokens(text)) resolveToken(tok, fromDir, tree, fe, de);
    for (const i of imp) fe.add(i);
    return [imp, fe, de];
}

/** Where a named code file means "runs it": suites, shell scripts, and the CLI shell. */
function tokensAreEdges(f: string): boolean {
    return f.startsWith('tests/') || isSuite(f) || /\.(bash|sh)$/.test(f) || !CODE_EXT.test(f) || isShell(f);
}

/** The CLI shell: what a suite that spawns the CLI runs regardless of command. */
export function isShell(n: string): boolean {
    return n.startsWith('src/cli/') || n === ROUTER || n === 'agent-config';
}

export function buildGraph(files: readonly string[], read: (f: string) => string | null): Graph {
    const tree = indexTree(files);
    const fileEdges = new Map<string, Set<string>>();
    const dirEdges = new Map<string, Set<string>>();
    const spawnEdges = new Map<string, Set<string>>();
    const texts = new Map<string, string>();
    let router: RouterTable | null = null;
    for (const f of files) {
        if (!CODE_EXT.test(f) && f !== 'agent-config' && f !== 'scripts-run') continue;
        if (f.startsWith('dist/')) continue;
        const raw = read(f);
        if (raw === null) continue;
        const text = stripComments(raw, f);
        texts.set(f, text);
        if (f === ROUTER) router = parseRouter(text);
        const [imp, named, de] = edgesOf(f === ROUTER && router !== null ? router.core : text, path.posix.dirname(f), tree);
        // In module source a named code file is almost always data — a list of
        // script names, an integrity check on a bundle — and as an edge it made
        // `agent_settings.ts` depend on the hook bundle. Imports carry module
        // dependencies there; a named data file is still a read.
        const fe = tokensAreEdges(f) ? named : new Set([...imp, ...[...named].filter((t) => !CODE_EXT.test(t) && !SHIMS.has(t))]);
        fe.delete(f);
        if (f.startsWith('tests/')) {
            const spawned = [...fe].filter((t) => isShell(t) && !imp.has(t));
            for (const t of spawned) fe.delete(t);
            if (spawned.length > 0) spawnEdges.set(f, new Set(spawned));
        }
        fileEdges.set(f, fe);
        dirEdges.set(f, de);
    }
    for (const [from, to] of IMPLICIT_EDGES) if (tree.files.has(to)) fileEdges.get(from)?.add(to);
    if (router === null) return { fileEdges, dirEdges, spawnEdges };

    const names = new Set(router.commands.keys());
    for (const [name, body] of router.commands) {
        const [, fe, de] = edgesOf(body, path.posix.dirname(ROUTER), tree);
        fileEdges.set(`cmd:${name}`, fe);
        dirEdges.set(`cmd:${name}`, de);
    }
    // The launcher imports the hook bundle only for `dispatch:hook`; as a plain
    // edge it put the whole hook system under every CLI suite.
    const hookCmd = new Set<string>();
    for (const [from, fe] of fileEdges) {
        if ((CLI_ENTRIES.has(from) || from.startsWith('src/cli/') || from === 'agent-config') && fe.delete(HOOK_ENTRY)) hookCmd.add(HOOK_ENTRY);
    }
    if (hookCmd.size > 0) {
        fileEdges.set(`cmd:${HOOK_COMMAND}`, hookCmd);
        names.add(HOOK_COMMAND);
    }
    for (const [f, text] of texts) {
        if (!f.startsWith('tests/')) continue;
        const fe = fileEdges.get(f) as Set<string>;
        if (!spawnEdges.has(f) && ![...fe].some((t) => isShell(t))) continue;
        if (ALL_COMMANDS.test(f)) {
            for (const name of names) fe.add(`cmd:${name}`);
            continue;
        }
        for (const m of text.matchAll(LITERAL_RE)) {
            const word = (m[2] ?? '').trim().split(/\s+/)[0] ?? '';
            if (names.has(word)) fe.add(`cmd:${word}`);
        }
    }
    return { fileEdges, dirEdges, spawnEdges };
}


export function isSuite(f: string): boolean {
    return TEST_FILE.test(f) && !NOT_A_SUITE.some((re) => re.test(f));
}

function ancestors(f: string): string[] {
    const parts = f.split('/');
    const out: string[] = [];
    for (let i = 1; i < parts.length; i++) out.push(`${parts.slice(0, i).join('/')}/`);
    return out;
}

export interface Reverse {
    file: Map<string, string[]>;
    dir: Map<string, string[]>;
    spawn: Map<string, string[]>;
}

function invert(edges: Map<string, Set<string>>): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [from, tos] of edges) for (const t of tos) out.set(t, [...(out.get(t) ?? []), from]);
    return out;
}

export function reverse(graph: Graph): Reverse {
    return { file: invert(graph.fileEdges), dir: invert(graph.dirEdges), spawn: invert(graph.spawnEdges) };
}

/**
 * Files a change can reach.
 *
 * File edges (imports, exact paths) are followed transitively.
 *
 * Directory edges are followed ONE hop, from a changed file only, and the file
 * reached that way contributes only the suites that use it directly: most
 * directory tokens in source are paths into the project the tool runs against,
 * not into this repository, and following them transitively connected a roadmap
 * edit to 86 % of the suite through the bash dispatcher.
 *
 * Spawn edges (a suite running the CLI as a subprocess) are followed only while
 * the change has not entered the CLI shell from below. The shell imports every
 * native command eagerly, so a change to any module those commands load reached
 * every CLI suite (~60 % of the suite for a one-line hook edit). A suite that
 * spawns the CLI is selected for a change to the shell itself, or to a command
 * it names; whether the rest of the shell still LOADS is the typecheck's
 * question, and `push: main` runs the whole suite as the net.
 */
export function dependents(graph: Graph, changed: readonly string[], rev: Reverse = reverse(graph)): Set<string> {
    const state = new Map<string, boolean>();
    const queue: Array<[string, boolean]> = changed.map((c) => [c, false]);
    for (const c of changed) state.set(c, false);
    while (queue.length > 0) {
        const [cur, deep] = queue.shift() as [string, boolean];
        if (state.get(cur) !== deep) continue;
        const visit = (n: string, d: boolean): void => {
            const prev = state.get(n);
            if (prev === false || prev === d) return;
            state.set(n, d);
            queue.push([n, d]);
        };
        for (const n of rev.file.get(cur) ?? []) visit(n, deep || (isShell(n) && !isShell(cur)));
        if (!deep) for (const n of rev.spawn.get(cur) ?? []) visit(n, false);
    }
    const seen = new Set(state.keys());
    for (const c of changed) {
        // A module naming a code directory is a resolver (`run.ts`, the
        // dispatcher): the script it resolves is reached by its own suites'
        // tokens. A module naming a data directory reads it.
        const data = !CODE_EXT.test(c);
        for (const w of ancestors(c).flatMap((d) => rev.dir.get(d) ?? [])) {
            if (isSuite(w)) seen.add(w);
            else if (data) for (const n of rev.file.get(w) ?? []) if (isSuite(n)) seen.add(n);
        }
    }
    return seen;
}

/** Area fallback for an unreached source: suites named after its stem or its directory. */
export function areaSuites(changed: string, suites: readonly string[]): string[] {
    const stem = path.posix.basename(changed).replace(/\.[^.]+$/, '');
    const dir = path.posix.basename(path.posix.dirname(changed));
    const byStem = suites.filter((s) => path.posix.basename(s).startsWith(`${stem}.`) || path.posix.basename(s).startsWith(`${stem}_`));
    if (byStem.length > 0) return byStem;
    if (TOO_BROAD.has(dir) || dir === 'scripts' || dir === '_lib') return [];
    return suites.filter((s) => s.split('/').includes(dir) || path.posix.basename(s).startsWith(`${dir}_`));
}

export function select(changed: readonly string[] | null, files: readonly string[], graph: Graph | null, fullShare = FULL_RUN_SHARE): Selection {
    if (changed === null) return { mode: 'full', reason: 'diff could not be read', tests: [], unmapped: [] };
    if (changed.length === 0) return { mode: 'full', reason: 'empty diff is undecidable, not proof of nothing to test', tests: [], unmapped: [] };
    const trigger = changed.find((p) => GLOBAL_TRIGGERS.some((re) => re.test(p)));
    if (trigger !== undefined) return { mode: 'full', reason: `global trigger changed: ${trigger}`, tests: [], unmapped: [] };
    if (graph === null) return { mode: 'full', reason: 'dependency graph unavailable', tests: [], unmapped: [] };

    const suites = files.filter(isSuite);
    const rev = reverse(graph);
    // A committed bundle under dist/ is not a graph node; its sources stand in.
    const seeds = [...new Set(changed.flatMap((c) => (c.startsWith('dist/') ? distTargets(c).filter((t) => !t.endsWith('/')) : [c])))];
    const reached = dependents(graph, seeds, rev);
    const picked = new Set(suites.filter((s) => reached.has(s)));
    const unmapped: string[] = [];
    for (const c of changed) {
        if (!CODE_EXT.test(c) || isSuite(c) || !c.startsWith('src/')) continue;
        const own = dependents(graph, [c], rev);
        if (suites.some((s) => own.has(s))) continue;
        const area = areaSuites(c, suites);
        for (const s of area) picked.add(s);
        if (area.length === 0) unmapped.push(c);
    }
    const tests = [...picked].sort();
    if (tests.length === 0) return { mode: 'none', reason: 'no test file can reach this diff', tests, unmapped };
    if (tests.length > suites.length * fullShare) {
        return { mode: 'full', reason: `${tests.length}/${suites.length} files reached — above the ${fullShare * 100} % full-run share`, tests: [], unmapped };
    }
    return { mode: 'targeted', reason: `${tests.length}/${suites.length} files reached`, tests, unmapped };
}

/** Node-shard count for a targeted list: fixed per-shard setup cost vs parallelism. */
export function shardCount(n: number): number {
    if (n <= 0) return 0;
    if (n <= 40) return 1;
    if (n <= 160) return 2;
    return 4;
}

export interface Routing {
    node_files: string[];
    node_shards: number[];
    golden: boolean;
    workspace: boolean;
    browser: boolean;
}

export function route(sel: Selection): Routing {
    if (sel.mode === 'full') return { node_files: [], node_shards: [1, 2, 3, 4], golden: true, workspace: true, browser: true };
    const node = sel.tests.filter((t) => !ROUTES.nodeExcluded.test(t) && !ROUTES.browser.has(t));
    return {
        node_files: node,
        node_shards: Array.from({ length: shardCount(node.length) }, (_, i) => i + 1),
        golden: sel.tests.some((t) => ROUTES.golden.test(t)),
        workspace: sel.tests.some((t) => ROUTES.workspace.test(t)),
        browser: sel.tests.some((t) => ROUTES.browser.has(t)),
    };
}


function git(args: readonly string[]): string | null {
    const r = spawnSync('git', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
}

export function changedPaths(base: string): string[] | null {
    const mb = git(['merge-base', base, 'HEAD'])?.trim();
    if (mb === undefined || mb === '') return null;
    const diff = git(['diff', '--name-only', '--no-renames', `${mb}...HEAD`]);
    return diff === null ? null : diff.split('\n').filter((l) => l.trim() !== '');
}

function trackedFiles(): string[] | null {
    const out = git(['ls-files', '-z']);
    return out === null ? null : out.split('\0').filter((l) => l !== '');
}

export function main(argv: readonly string[]): number {
    const i = argv.indexOf('--base');
    const base = i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : 'origin/main';
    const forceFull = argv.includes('--full');
    const files = trackedFiles();
    const changed = forceFull ? null : changedPaths(base);
    let sel: Selection;
    if (forceFull) sel = { mode: 'full', reason: 'full run requested', tests: [], unmapped: [] };
    else if (files === null) sel = { mode: 'full', reason: 'tracked tree could not be listed', tests: [], unmapped: [] };
    else {
        const graph = changed === null ? null : buildGraph(files, (f) => {
            try {
                return fs.readFileSync(f, 'utf-8');
            } catch {
                return null;
            }
        });
        sel = select(changed, files, graph);
    }
    const code = forceFull || touchesCode(changed);
    const r = route(sel);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ ...sel, ...r }, null, 2)}\n`);
    } else {
        process.stdout.write(`mode=${sel.mode}\nreason=${sel.reason}\ncount=${sel.tests.length}\n`);
        for (const t of sel.tests) process.stdout.write(`  ${t}\n`);
    }
    const out = process.env['GITHUB_OUTPUT'];
    if (out !== undefined && out !== '') {
        fs.appendFileSync(
            out,
            [
                `mode=${sel.mode}`,
                `count=${sel.tests.length}`,
                `node_files=${r.node_files.join(' ')}`,
                `node_shards=${JSON.stringify(r.node_shards)}`,
                `node_shard_total=${r.node_shards.length}`,
                `golden=${r.golden}`,
                `workspace=${r.workspace}`,
                `browser=${r.browser}`,
                `code=${code}`,
                '',
            ].join('\n'),
        );
    }
    const summary = process.env['GITHUB_STEP_SUMMARY'];
    if (summary !== undefined && summary !== '') {
        const lines = [
            `### Test selection: ${sel.mode}`,
            sel.reason,
            '',
            `node shards: ${r.node_shards.length} · golden: ${r.golden} · workspace: ${r.workspace} · browser: ${r.browser} · install/static: ${code}`,
        ];
        if (sel.unmapped.length > 0) lines.push('', `Changed sources no test reaches (${sel.unmapped.length}):`, ...sel.unmapped.map((u) => `- \`${u}\``));
        if (sel.mode === 'targeted') lines.push('', '<details><summary>Selected files</summary>', '', ...sel.tests.map((t) => `- \`${t}\``), '', '</details>');
        fs.appendFileSync(summary, `${lines.join('\n')}\n`);
    }
    return 0;
}

if (process.argv[1] !== undefined && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url) {
    process.exit(main(process.argv.slice(2)));
}
