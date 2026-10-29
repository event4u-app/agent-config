/**
 * `agent-config code-graph map` — write the project map to `agents/map/`.
 *
 * IO around the pure projection in `map_model.ts`: read the engine's graph
 * (building or refreshing it first when needed), derive the model, and write
 * one generation of the map folder (ADR-297, ADR-303):
 *
 *   agents/map/index.html             one self-contained offline file
 *   agents/map/MAP.md                 the same picture in words, budgeted
 *   agents/map/manifest.json          generation, sources and freshness per area
 *   agents/map/code/map.json          the model and the area payloads the pages are rendered from
 *   agents/map/code/areas/<id>.md     one page per code area of five or more files
 *   agents/map/<area>/<area>.json     data, interfaces, runtime, delivery: that area's payload
 *   agents/map/.build/                graph cache, twin, lock, staging — the only gitignored part
 *
 * Same tree in, same bytes out: nothing written here carries a timestamp, a
 * host path or anything else that differs between two builds of one commit.
 */
import { repoName } from './repo_identity.js';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { write_atomic } from '../_lib/fs_atomic.js';
import { gitProbe, hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { buildFromRepo, readProjectProbe } from './build.js';
import { acquire as acquireRefreshLock, heldByThisProcess } from './refresh_lock.js';
import { computeVerdict, graphState } from './detect.js';
import { graphHome } from './graph_home.js';
import { BLAST_SCOPE_ROLES, SOLE_OWNER_MIN_CHURN, SOLE_OWNER_SHARE, finishAnswers, layerOf, readFileFacts, readGitHistory, readLayerRules } from './map_answers.js';
import {
    areaDrift,
    buildMapModel,
    type FileRole,
    MAP_MODEL_VERSION,
    type MapModel,
    type OutcomeEvent,
    outcomeScores,
    prOverlap,
} from './map_model.js';
import { DECLARATIONS_FILE, ORACLE_DIR, SNAPSHOT_DIR } from './lanes/data/read_data.js';
import { produceAreas } from './map_area_payloads.js';
import { sourceWithholding, withholdSources } from './map_withhold.js';
import { attachDomains, domainsOnAreas, mapBranches, mapProvenance } from './map_knowledge.js';
import { nodeOwner } from './verify/owner_index.js';
import { type Overlay, readOverlay } from './verify/overlay.js';
import { workingChanges } from './verify/paths.js';
import { areaProblems, areaSummaryLines, KNOWLEDGE_AREA_IDS, type MapAreas, type MapTour, witnessesOf } from './map_areas.js';
import { loadGraph } from './query.js';
import type { CodeGraph } from './types.js';
import { dead, repoEntryPoints } from './verbs.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const VIEWER_DIR = path.join(_HERE, 'map_viewer');

/** Rough characters-per-token used to hold MAP.md to its budget. */
const CHARS_PER_TOKEN = 4;
export const MAP_TOKEN_BUDGET = 2000;
export const AREA_PAGE_MIN_FILES = 5;

export interface MapMeta {
    title: string;
    commit: string;
    /** The build commit's date (`YYYY-MM-DD`); `''` outside a git repository. */
    built?: string;
    state: string;
    summary: string;
    /**
     * The graph this map was drawn from: the first 16 hex of the SHA-256 of the
     * graph cache's bytes (or of the serialized graph when there is no cache).
     * `graph.json`, `map.json` and `index.html` agree exactly when this matches
     * {@link graphGeneration} of the current cache — the test a reader runs
     * instead of comparing modification times.
     */
    graph_generation?: string;
    /** Set only by `map --demo`: the page is drawn from the demo fixture and says so in its header. */
    demo?: boolean;
}

/** The generation of a graph cache: the first 16 hex of the SHA-256 of its bytes; null when unreadable. */
export function graphGeneration(cachePath: string): string | null {
    try {
        return createHash('sha256').update(fs.readFileSync(cachePath)).digest('hex').slice(0, 16);
    } catch {
        return null;
    }
}

/** Payload folders of the knowledge areas that have one in the map folder (ADR-303). */
export const AREA_FOLDERS = ['data', 'systems', 'interfaces', 'runtime', 'delivery'] as const;

/**
 * `code/map.json` in a map folder, or the top-level `map.json` a release before
 * ADR-303 wrote when only that one exists.
 */
export function mapJsonPath(dir: string): string {
    const now = path.join(dir, 'code', 'map.json');
    const old = path.join(dir, 'map.json');
    return fs.existsSync(now) || !fs.existsSync(old) ? now : old;
}

/** A map has been drawn into `dir` — not merely its `.build/` created by a graph build. */
export function hasMap(dir: string): boolean {
    return fs.existsSync(mapJsonPath(dir));
}

/** What the user puts into `data/` before the first map exists: a snapshot, oracle output, declarations. */
const DATA_USER_INPUTS: ReadonlySet<string> = new Set([SNAPSHOT_DIR, ORACLE_DIR, DECLARATIONS_FILE].map((p) => path.posix.basename(p)));

/** A folder that holds only the user's own data inputs is a map folder waiting for its first map, not someone else's directory. */
export function holdsOnlyMapInputs(dir: string): boolean {
    const entries = fs.readdirSync(dir).filter((e) => e !== '.build');
    if (entries.length === 0) return true;
    if (entries.length !== 1 || entries[0] !== 'data') return false;
    const data = path.join(dir, 'data');
    if (!fs.statSync(data).isDirectory()) return false;
    return fs.readdirSync(data).every((e) => DATA_USER_INPUTS.has(e));
}

/** The generation a drawn map records, or null when it records none (an older map) or cannot be read. */
export function mapGeneration(outDir: string): string | null {
    try {
        const doc = JSON.parse(fs.readFileSync(mapJsonPath(outDir), 'utf-8')) as { meta?: { graph_generation?: unknown } };
        return typeof doc.meta?.graph_generation === 'string' ? doc.meta.graph_generation : null;
    } catch {
        return null;
    }
}

export interface MapBuildResult {
    outDir: string;
    model: MapModel;
    meta: MapMeta;
    written: string[];
    graphBuilt: boolean;
}

function gitHead(root: string): string {
    try {
        return gitProbe(root, ['rev-parse', '--short=12', 'HEAD']).trim();
    } catch {
        return 'no-git';
    }
}

/**
 * Entry points the project's manifests declare, in every package root:
 * `package.json` `bin` / `main` / `module` / `exports`, `composer.json` `bin`,
 * `pyproject.toml` `[project.scripts]`, a Maven `<mainClass>`. Framework entry
 * files are a provider's role (`roleOf`); this only adds what a manifest names.
 */
export function declaredEntryFiles(root: string): string[] {
    const out = new Set<string>();
    for (const [rel, text] of readProjectProbe(root).manifests) {
        const dir = path.posix.dirname(rel);
        const add = (v: unknown): void => {
            if (typeof v !== 'string' || v.includes('*') || /^[a-z]+:/i.test(v)) return;
            out.add(path.posix.normalize(path.posix.join(dir, v.replace(/^\.\//, ''))));
        };
        const base = path.posix.basename(rel);
        try {
            if (base === 'package.json') {
                const pkg = JSON.parse(text) as Record<string, unknown>;
                const leaves = (v: unknown): void => {
                    if (typeof v === 'string') add(v);
                    else if (v && typeof v === 'object') for (const x of Object.values(v)) leaves(x);
                };
                leaves(pkg['bin']);
                add(pkg['main']);
                add(pkg['module']);
                leaves(pkg['exports']);
            } else if (base === 'composer.json') {
                const bin = (JSON.parse(text) as Record<string, unknown>)['bin'];
                if (Array.isArray(bin)) for (const v of bin) add(v);
            } else if (base === 'pyproject.toml') {
                const section = /^\[project\.scripts\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(text)?.[1] ?? '';
                for (const m of section.matchAll(/=\s*["']([\w.]+):[\w.]+["']/g)) {
                    const mod = (m[1] as string).replace(/\./g, '/');
                    add(`${mod}.py`);
                    add(`src/${mod}.py`);
                }
            } else if (base === 'pom.xml') {
                const main = /<mainClass>\s*([\w.]+)\s*<\/mainClass>/.exec(text)?.[1];
                if (main) add(`src/main/java/${main.replace(/\./g, '/')}.java`);
            }
        } catch {
            /* an unreadable manifest declares nothing */
        }
    }
    return [...out].sort();
}

/**
 * The artefact relation graph, but only when `root` IS this package's source
 * tree: the discovery graph reads the package it ships in, so for any other
 * root it would describe the wrong repository.
 */
async function artefactGraph(root: string): Promise<MapInputsArtefacts | null> {
    const pkgRoot = path.resolve(_HERE, '..', '..', '..');
    if (path.resolve(root) !== pkgRoot || !fs.existsSync(path.join(root, 'src', 'skills'))) return null;
    try {
        const dg = await import('../discovery_graph.js');
        const manifest = dg.loadManifest(null) as { artefacts: Array<{ path: string; name?: string; slug?: string; category?: string }> };
        const graph = dg.getGraph(null, false);
        const meta = new Map<string, { path: string; category: string | null }>();
        for (const a of manifest.artefacts) {
            for (const key of [a.name, a.slug, a.path]) if (key) meta.set(key, { path: a.path, category: a.category ?? null });
        }
        return {
            nodes: graph.nodes.map((id) => ({ id, path: meta.get(id)?.path ?? null, category: meta.get(id)?.category ?? null })),
            edges: graph.edges.map((e) => ({ from: e.from, to: e.to, rel: e.rel })),
        };
    } catch (e) {
        process.stderr.write(`code-graph map: artefact layer skipped — ${(e as Error).message.split('\n')[0]}\n`);
        return null;
    }
}
type MapInputsArtefacts = NonNullable<Parameters<typeof buildMapModel>[1]>['artefacts'];

function commitDate(root: string): string {
    try {
        return gitProbe(root, ['log', '-1', '--format=%cs', 'HEAD']).trim();
    } catch {
        return '';
    }
}

function isGitRepo(root: string): boolean {
    try {
        gitProbe(root, ['rev-parse', '--is-inside-work-tree']);
        return true;
    } catch {
        return false;
    }
}

/** The lanes a map is drawn from; a cache whose `lanes_run` lacks one of them is not the map's cache (H24). */
export const MAP_LANES = ['runtime', 'interfaces', 'delivery', 'history', 'decisions', 'data', 'systems', 'flows'] as const;

function hasLaneSet(g: CodeGraph): boolean {
    const ran = new Set((g.lanes_run ?? []).map((r) => r.lane));
    return MAP_LANES.every((l) => ran.has(l));
}

/** The graph the map is drawn from: built when absent, updated when behind or drawn without lanes. */
async function loadOrBuildGraph(
    root: string,
    cachePath: string,
    buildPath: string,
    noBuild: boolean,
    mapDir?: string,
): Promise<{ graph: CodeGraph; built: boolean; overlay?: Overlay }> {
    const verdict = computeVerdict(root, cachePath).verdict;
    const cached = verdict === 'FRESH' && fs.existsSync(cachePath) ? (JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CodeGraph) : null;
    // `edited` — an uncommitted change to an indexed file — reads FRESH to the
    // commit-based verdict, and a map drawn from it would show the old code.
    // Outside a git repository there is nothing to compare against at all, so
    // freshness is unknowable and the incremental build decides per file.
    if (cached && hasLaneSet(cached) && isGitRepo(root)) {
        const state = graphState(root, cachePath);
        if (state === 'fresh') return { graph: cached, built: false };
        // Uncommitted edits that `refresh --touched` already re-read: the committed
        // index seen through its overlay, with no rebuild.
        if (state === 'edited') {
            const committed = cached;
            const ov = readOverlay(cachePath, committed.source_checksum);
            const changes = workingChanges(root);
            // The map's own output is never a source the overlay has to have re-read.
            const own = mapDir ? path.relative(root, mapDir).split(path.sep).join('/') : '';
            const ours = (f: string): boolean => own !== '' && !own.startsWith('..') && f.startsWith(`${own}/`);
            const covered = ov && changes && [...changes.changed, ...changes.deleted].every((f) => ov.files.includes(f) || ours(f));
            if (ov && covered) return { graph: withOverlay(committed, ov), built: false, overlay: ov };
        }
    }
    // `--no-build` (the git hook): the budgeted `refresh` before it owns the
    // build; an unbudgeted one here would hold the refresh lock indefinitely.
    if (noBuild) {
        if (!fs.existsSync(cachePath)) throw new Error('no graph to draw (--no-build)');
        return { graph: JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CodeGraph, built: false };
    }
    const { graph } = await buildFromRepo(root, buildPath, { update: fs.existsSync(buildPath), lanes: true });
    return { graph, built: true };
}

/** The committed graph with every fact a re-read file owns replaced by the overlay's. */
export function withOverlay(g: CodeGraph, ov: Overlay): CodeGraph {
    const files = new Set(ov.files);
    const removed = new Set(ov.removed_nodes);
    const fresh = new Set(ov.nodes.map((n) => n.id));
    const ownerOf = new Map(g.nodes.map((n) => [n.id, nodeOwner(n)] as const));
    const nodes = [...g.nodes.filter((n) => !files.has(nodeOwner(n)) && !removed.has(n.id) && !fresh.has(n.id)), ...ov.nodes];
    const edges = [...g.edges.filter((e) => !files.has(e.fact?.owner ?? ownerOf.get(e.source) ?? e.source)), ...ov.edges];
    return { ...g, nodes, edges };
}

/**
 * Files changed between `rev` and HEAD, plus uncommitted ones — the same reading
 * `affected --since` uses, kept here so the map does not import the CLI. A rev
 * beginning with `-` is refused: it would reach git as an option.
 */
export function diffFiles(root: string, rev: string): string[] | null {
    if (rev.startsWith('-')) return null;
    try {
        const run = (args: string[]): string[] =>
            gitProbe(root, [...args])
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
        return [...new Set([...run(['diff', '--name-only', rev]), ...run(['diff', '--name-only', '--cached', rev])])].sort();
    } catch {
        return null;
    }
}

/** Where `code-graph outcome` records which files a session found useful — local, never sent anywhere. */
export function outcomesPath(root: string): string {
    return path.join(graphHome(root).buildDir, 'map-outcomes.jsonl');
}

export function readOutcomes(root: string): OutcomeEvent[] {
    // A log an older release appended to under the old state directory still counts.
    let text = '';
    for (const p of [path.join(graphHome(root).legacyDir, 'map-outcomes.jsonl'), outcomesPath(root)]) {
        try {
            text += `${fs.readFileSync(p, 'utf-8')}\n`;
        } catch {
            /* never recorded there */
        }
    }
    // Line by line: one malformed line costs that line, not the whole log.
    const out: OutcomeEvent[] = [];
    for (const line of text.split('\n')) {
        if (!line) continue;
        try {
            const e = JSON.parse(line) as Partial<OutcomeEvent> | null;
            if (e && typeof e.path === 'string' && typeof e.at === 'string' && (e.outcome === 'useful' || e.outcome === 'dead-end')) {
                out.push({ path: e.path, outcome: e.outcome, at: e.at });
            }
        } catch {
            /* skip the line */
        }
    }
    return out;
}

export function recordOutcome(root: string, file: string, outcome: OutcomeEvent['outcome'], at: Date = new Date()): void {
    const p = outcomesPath(root);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const rel = path.relative(fs.realpathSync(root), fs.realpathSync(path.resolve(file)));
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`not a file inside ${root}: ${file}`);
    fs.appendFileSync(p, `${JSON.stringify({ path: rel.split(path.sep).join('/'), outcome, at: at.toISOString() })}\n`);
}

/** Open PRs and their files via `gh`; null when `gh` is absent or refuses. */
export function openPrs(root: string): Array<{ number: number; title: string; files: string[] }> | null {
    try {
        const out = execFileSync(
            'gh',
            ['pr', 'list', '--state', 'open', '--limit', '50', '--json', 'number,title,files'],
            { cwd: root, env: hardenedSpawnEnv(), encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 },
        );
        const rows = JSON.parse(out) as Array<{ number: number; title: string; files?: Array<{ path: string }> }>;
        return rows.map((r) => ({ number: r.number, title: r.title, files: (r.files ?? []).map((f) => f.path) }));
    } catch {
        return null;
    }
}

export async function buildMap(
    root: string,
    opts: {
        outDir?: string;
        cachePath?: string;
        diffRev?: string;
        prs?: boolean;
        /** Embed the indexed branches and their difference from this one: local state, so never by default. */
        branches?: boolean;
        noBuild?: boolean;
        /** Marks the map as drawn from the demo fixture (`map --demo`); never set for a real repository. */
        demo?: boolean;
        /** Payloads of the knowledge areas beside Code, one per reader that ran; `{}` when none did. */
        areas?: MapAreas;
        /** Test seam: called after each artefact lands in the new generation. */
        _afterWrite?: (rel: string) => void;
    } = {},
): Promise<MapBuildResult> {
    // Single writer, enforced here rather than trusted to callers: one redraw per
    // process at a time, and none while another process holds the refresh lock.
    if (drawing) throw new Error('a map redraw is already running in this process');
    const release = heldByThisProcess(root) ? (): void => {} : acquireRefreshLock(root);
    if (release === null) throw new Error('another process holds the code-graph refresh lock');
    drawing = true;
    try {
        return await drawGeneration(root, opts);
    } finally {
        drawing = false;
        release();
    }
}

let drawing = false;

async function drawGeneration(root: string, opts: Parameters<typeof buildMap>[1] = {}): Promise<MapBuildResult> {
    const home = graphHome(root);
    const outDir = opts.outDir ?? home.mapDir;
    // A chosen --out directory is only ever written into when it is empty or
    // already holds a map: the writer clears stale area pages, and that must
    // never reach a directory of someone else's Markdown.
    if (
        opts.outDir !== undefined &&
        fs.existsSync(outDir) &&
        !holdsOnlyMapInputs(outDir) &&
        !hasMap(outDir)
    ) {
        throw new Error(`refusing to write a map into ${outDir}: it is not empty and holds no map.json`);
    }
    if (opts.areas) {
        const given = areaProblems(opts.areas);
        if (given.length) throw new Error(`refusing to draw the map: the areas section is unsafe or unreadable — ${given.slice(0, 5).join('; ')}`);
    }
    const { graph, built, overlay } = await loadOrBuildGraph(root, opts.cachePath ?? home.cachePath, opts.cachePath ?? home.buildCachePath, opts.noBuild === true, outDir);
    // After a build the current file is the one to read, whatever an older release left beside it.
    const cachePath = opts.cachePath ?? graphHome(root).cachePath;
    const produced = opts.areas ? { areas: opts.areas, erd: [] } : produceAreas(root, graph, { ...(opts.diffRev !== undefined ? { diffRev: opts.diffRev } : {}), previousTours: previousTours(outDir), cachePath, ...(overlay ? { added: overlay.added } : {}) });
    const areas = produced.areas;
    const problems = areaProblems(areas);
    if (problems.length) throw new Error(`refusing to draw the map: the areas section is unsafe or unreadable — ${problems.slice(0, 5).join('; ')}`);
    let diff: { rev: string; changed: string[] } | undefined;
    if (opts.diffRev !== undefined) {
        const changed = diffFiles(root, opts.diffRev);
        if (changed === null) throw new Error(`cannot resolve rev '${opts.diffRev}' in ${path.basename(root)}`);
        diff = { rev: opts.diffRev, changed };
    }
    const artefacts = await artefactGraph(root);
    const model = buildMapModel(graph, {
        entryFiles: declaredEntryFiles(root),
        ...(diff ? { diff } : {}),
        ...(artefacts ? { artefacts } : {}),
    });
    const previous = readMapAt(outDir);
    if (previous) {
        const drift = areaDrift(previous.model, model);
        if (drift) model.drift = drift;
    }
    const scores = outcomeScores(model, readOutcomes(root));
    if (scores.length) model.outcomes = scores;
    if (opts.prs) {
        const prs = openPrs(root);
        if (prs) model.prOverlap = prOverlap(model, prs);
    }
    if (opts.branches) {
        const b = await mapBranches(root, path.dirname(cachePath));
        if (b) model.branches = b;
    }
    const meta: MapMeta = {
        title: `Map of ${repoName(root)}`,
        commit: gitHead(root),
        built: commitDate(root),
        state: graphState(root, cachePath),
        summary: '',
        graph_generation: graphGeneration(cachePath) ?? createHash('sha256').update(JSON.stringify(graph)).digest('hex').slice(0, 16),
        ...(opts.demo ? { demo: true } : {}),
    };
    answerQuestions(root, outDir, cachePath, graph, model, meta);
    if (model.domains) domainsOnAreas(areas, model, graph);
    meta.summary =
        `${model.files.length} files · ${model.areas.length} areas · ` +
        `${model.analyses.trustedEdges} trusted links · guess share ${pct(model.analyses.guessShare)}`;

    // One generation at a time: everything is written into a staging directory
    // under the gitignored `.build/`, and each entry then replaces its live
    // counterpart, so a failed redraw leaves the last one whole and a killed one
    // leaves nothing outside `.build/`. `.build/` itself is never swapped: it
    // holds the graph and the lock this very redraw runs under.
    const build = path.join(outDir, '.build');
    const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`;
    fs.mkdirSync(build, { recursive: true });
    const next = path.join(build, `.map-next-${suffix}`);
    const prev = path.join(build, `.map-prev-${suffix}`);
    const written: string[] = [];
    try {
        const write = (rel: string, content: string): void => {
            const p = path.join(next, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            write_atomic(p, content);
            written.push(rel.split(path.sep).join('/'));
            opts._afterWrite?.(rel);
        };
        write(path.join('code', 'map.json'), `${JSON.stringify({ meta, model, areas })}\n`);
        for (const [i, a] of model.areas.entries()) {
            if (a.files.length >= AREA_PAGE_MIN_FILES) write(path.join('code', 'areas', `${a.id}.md`), renderAreaMd(model, i, meta));
        }
        for (const id of AREA_FOLDERS) {
            const payload = areas[id];
            if (payload) write(path.join(id, `${id}.json`), `${JSON.stringify({ generation: meta.graph_generation ?? '', [id]: payload })}\n`);
        }
        write('MAP.md', renderMapMd(model, meta, areas));
        write('manifest.json', `${JSON.stringify(mapManifest(model, meta, areas), null, 2)}\n`);
        write('index.html', renderHtml(model, meta, areas));
        for (const page of produced.erd) write(page.file, page.content);
        // An area folder also holds what the user put there (snapshots, oracle output,
        // declarations): it moves into the new generation, only generated pages are replaced.
        for (const id of AREA_FOLDERS) {
            const live = path.join(outDir, id);
            if (!fs.existsSync(live)) continue;
            for (const entry of fs.readdirSync(live)) {
                if (entry === `${id}.json` || /^schema-.*\.md$/.test(entry) || fs.existsSync(path.join(next, id, entry))) continue;
                fs.mkdirSync(path.join(next, id), { recursive: true });
                fs.cpSync(path.join(live, entry), path.join(next, id, entry), { recursive: true, verbatimSymlinks: true });
            }
        }
        swapIn(next, outDir, prev);
        // The render check described the generation it checked, not this one.
        fs.rmSync(path.join(build, 'map-render.json'), { force: true });
    } finally {
        fs.rmSync(next, { recursive: true, force: true });
    }
    return { outDir, model, meta, written, graphBuilt: built };
}

/**
 * The per-file and repo-level answers that need the tree, git or the dead verb:
 * written onto the model before it is serialised, so `map.json`, `MAP.md` and
 * `index.html` read the same values.
 */
function answerQuestions(root: string, outDir: string, cachePath: string, graph: CodeGraph, model: MapModel, meta: MapMeta): void {
    const paths = model.files.map((f) => f.path);
    readFileFacts(root, paths).forEach((facts, i) => {
        const f = model.files[i] as MapModel['files'][number];
        f.lang = facts.lang;
        if (facts.loc !== undefined) f.loc = facts.loc;
    });
    const history = readGitHistory(root);
    if (history) {
        for (const f of model.files) {
            const h = history.get(f.path);
            f.churn = h?.churn ?? 0;
            if (h) {
                f.owners = h.owners;
                f.lastChange = h.lastChange;
                if (h.churn >= SOLE_OWNER_MIN_CHURN && (h.owners[0]?.[1] ?? 0) > SOLE_OWNER_SHARE) f.soleOwner = true;
            }
        }
    }
    const prov = mapProvenance(root, path.join(outDir, '.build'), graph, paths);
    if (prov) model.provenance = prov;
    markDead(root, cachePath, graph, model);
    const rules = readLayerRules(path.join(outDir, 'layers.yaml'));
    if (rules) {
        for (const f of model.files) {
            const layer = layerOf(f.path, rules);
            if (layer) f.layer = layer;
        }
    }
    attachDomains(root, outDir, graph, model);
    finishAnswers(model, rules);
    const withheld = sourceWithholding(root);
    if (withheld) withholdSources(model, withheld);
    model.pin = {
        commit: meta.commit,
        date: history ? headDate(root) : '',
        freshness: meta.state,
        generation: meta.graph_generation ?? '',
    };
}

function headDate(root: string): string {
    try {
        return gitProbe(root, ['log', '-1', '--format=%cs']).trim();
    } catch {
        return '';
    }
}

/**
 * A scope file is dead when the `dead` verb lists every symbol it declares and
 * no trusted edge enters it. The verb runs with the exports gap accepted — the
 * extractor records no exportedness — and `deadBasis` says so on the map.
 */
function markDead(root: string, cachePath: string, graph: CodeGraph, model: MapModel): void {
    let g: ReturnType<typeof loadGraph>;
    try {
        g = loadGraph(cachePath);
    } catch {
        model.analyses.deadBasis = 'no graph cache to run the dead verb on';
        return;
    }
    try {
        const res = dead(g, repoEntryPoints(root), 'fresh', { acceptMissingExports: true });
        if (res.refusal !== null) {
            model.analyses.deadBasis = res.refusal;
            return;
        }
        const deadIds = new Set(res.dead);
        const symbolsOf = new Map<string, string[]>();
        for (const n of graph.nodes) {
            if (n.kind === 'file' || n.kind === 'skipped') continue;
            const list = symbolsOf.get(n.source_file) ?? [];
            list.push(n.id);
            symbolsOf.set(n.source_file, list);
        }
        // A guessed link (name lookup, dynamic call) may be the only way a file is reached.
        const guessedInto = new Set(model.guessEdges.map(([, t]) => t));
        let count = 0;
        for (const [i, f] of model.files.entries()) {
            if (!BLAST_SCOPE_ROLES.has(f.role) || f.role === 'entry' || f.inFiles > 0 || guessedInto.has(i)) continue;
            const syms = symbolsOf.get(f.path) ?? [];
            if (syms.length === 0 || !syms.every((id) => deadIds.has(id))) continue;
            f.dead = true;
            count++;
        }
        model.analyses.deadFiles = count;
        model.analyses.deadBasis =
            'exports unchecked: the extractor records no exportedness, so an exported but unimported file counts as dead; entry files and files reached by a guessed link are never counted';
    } finally {
        g.close?.();
    }
}

/**
 * What a release before ADR-303 wrote at the top of the map folder. A redraw in
 * the current layout moves them out with the previous generation, so no reader
 * finds a stale model beside a fresh page.
 */
const LEGACY_ENTRIES = ['map.json', 'areas', 'map-render.json'] as const;

/** `index.html` lands last: a reader opening the page finds the data it was rendered from. */
function swapOrder(names: string[]): string[] {
    const rank = (n: string): number => (n === 'index.html' ? 2 : n === 'manifest.json' ? 1 : 0);
    return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Replace each entry `next` holds in `live`, one rename pair per entry; entries
 * of `live` that `next` does not hold — someone else's notes, a lineage view,
 * `layers.yaml`, `.build/` — stay where they are. On a failed rename every entry
 * already swapped goes back. Consistent per entry, not atomic: between a pair of
 * renames that entry is briefly absent, and a process killed there leaves the old
 * entries at `prev` (under the gitignored `.build/`).
 */
export function swapIn(next: string, live: string, prev: string, rename: typeof fs.renameSync = fs.renameSync): void {
    fs.mkdirSync(live, { recursive: true });
    fs.mkdirSync(prev, { recursive: true });
    const incoming = fs.readdirSync(next);
    const names = swapOrder([...new Set([...incoming, ...LEGACY_ENTRIES.filter((e) => fs.existsSync(path.join(live, e)))])]);
    const done: Array<{ name: string; hadLive: boolean; placed: boolean }> = [];
    try {
        for (const name of names) {
            const step = { name, hadLive: fs.existsSync(path.join(live, name)), placed: false };
            done.push(step);
            if (step.hadLive) rename(path.join(live, name), path.join(prev, name));
            if (incoming.includes(name)) {
                rename(path.join(next, name), path.join(live, name));
                step.placed = true;
            }
        }
    } catch (e) {
        try {
            for (const step of done.reverse()) {
                if (step.placed) fs.rmSync(path.join(live, step.name), { recursive: true, force: true });
                if (step.hadLive && fs.existsSync(path.join(prev, step.name))) rename(path.join(prev, step.name), path.join(live, step.name));
            }
        } catch {
            throw new Error(`map swap failed and the restore failed too; the previous generation is at ${prev}`, { cause: e });
        }
        fs.rmSync(prev, { recursive: true, force: true });
        throw e;
    }
    fs.rmSync(prev, { recursive: true, force: true });
}

function pct(x: number): string {
    return `${Math.round(x * 1000) / 10} %`;
}

const ROLE_ORDER: readonly FileRole[] = [
    'code',
    'test',
    'entry',
    'view',
    'migration',
    'translation',
    'config',
    'doc',
    'infra',
    'isolated',
];

/**
 * Plain text from the scanned repository (a directory or area name) in
 * Markdown: every character Markdown or a table would read as syntax is
 * escaped, so a name can never become a link, a heading or emphasis.
 */
function md(s: string): string {
    return s.replace(/[\\`*_[\]#<>|!]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');
}

/**
 * A name inside a code span. A backslash does not escape inside one, so a
 * backtick in the name would close the span early and let the rest render as
 * Markdown; it becomes `'` instead. `|` keeps its escape, which GFM tables
 * honour even inside code.
 */
function code(s: string): string {
    return `\`${s.replace(/`/g, "'").replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')}\``;
}

/**
 * MAP.md — the map in words, held to `MAP_TOKEN_BUDGET`. Sections are added in
 * priority order; the first one that would cross the budget is replaced by a
 * line naming every section that was cut, so a reader knows what is missing.
 */
export function renderMapMd(m: MapModel, meta: MapMeta, areas: MapAreas = {}): string {
    const { head, sections } = mapMdParts(m, meta, areas);
    const budget = MAP_TOKEN_BUDGET * CHARS_PER_TOKEN;
    let out = head;
    const cut: string[] = [];
    for (const [name, body] of sections) {
        if (out.length + body.length <= budget) out += `${body}\n`;
        else cut.push(name);
    }
    if (cut.length) {
        out +=
            `> Budget of ${MAP_TOKEN_BUDGET} tokens reached — cut: ${cut.join(', ')}. ` +
            'Read one with `agent-config code-graph map --section <name>`; never open `code/map.json` for it.\n';
    }
    return out;
}

/** The MAP.md header and its sections in priority order, before the budget cuts any. */
export function mapMdParts(m: MapModel, meta: MapMeta, areas: MapAreas = {}): { head: string; sections: Array<[string, string]> } {
    const f = m.files;
    const head = [
        `# ${md(meta.title)}`,
        '',
        `> Map built at \`${meta.commit}\`${meta.built ? ` · ${meta.built}` : ''} by \`agent-config code-graph map\` — this describes that commit; compare it with HEAD yourself.`,
        '> Deterministic, no model call. Rebuild with `agent-config code-graph map`; never edit by hand.',
        '',
        `**${f.length} files · ${m.areas.length} areas · ${m.analyses.trustedEdges} trusted links · guess share ${pct(m.analyses.guessShare)}**`,
        '',
        `Thresholds: seed ${m.thresholds.seed} · infrastructure above in-degree ${m.thresholds.infraInDegree} · ` +
            `areas under ${m.thresholds.smallArea} files fold into "small parts" · an area above ` +
            `${Math.round(m.thresholds.maxAreaShare * 100)} % is split once · lists capped at ${m.thresholds.listCap}.`,
        '',
        m.providers && m.providers.length > 0
            ? `Convention providers: ${m.providers
                  .map((p) => `${md(p.name)} (${p.status}${p.roots.some((r) => r !== '') ? `, ${p.roots.map((r) => code(r || '.')).join(', ')}` : ''})`)
                  .join(' · ')} — plus the framework-neutral default.`
            : 'Convention providers: none detected — only the framework-neutral default ran.',
        '',
        '',
    ].join('\n');

    const sections: Array<[string, string]> = [];
    const areaLabel = (i: number): string => `${m.areas[i]?.id ?? ''} ${md(m.areas[i]?.name ?? '')}`;

    if (m.health) {
        const h = m.health;
        const row = (label: string, v: { value: number; points: number } | undefined, shown: (x: number) => string): string =>
            v ? `| ${label} | ${shown(v.value)} | ${v.points} / 25 |` : `| ${label} | missing | — |`;
        const findings = [
            `${m.analyses.cyclesTotal} file cycles`,
            m.analyses.layerBreaches !== undefined ? `${m.analyses.layerBreaches} layer breaches` : 'no layers.yaml, so no layer breaches checked',
            m.analyses.deadFiles !== undefined ? `${m.analyses.deadFiles} dead files (${m.analyses.deadBasis ?? ''})` : `dead files unknown: ${m.analyses.deadBasis ?? 'not computed'}`,
            ...(m.hotspots ?? []).slice(0, 3).map(([i, c, l]) => `hotspot ${code(f[i]?.path ?? '')}: ${c} commits × ${l} lines`),
            ...m.analyses.surprises.slice(0, 1).map(([s, t]) => `surprising edge ${code(f[s]?.path ?? '')} → ${code(f[t]?.path ?? '')}`),
        ].slice(0, 5);
        sections.push([
            'Health',
            [
                `## Health — ${h.grade ? `${h.grade}, ${h.score} of 100` : 'no grade while a part is missing'}`,
                '',
                '| Part | Value | Points |',
                '|---|---|---|',
                row('Dead code files', h.parts.dead, pct),
                row('File cycles', h.parts.cycles, String),
                row('Guessed edges', h.parts.guesses, pct),
                row('Hotspot files', h.parts.hotspots, pct),
                '',
                'Formula: `health.formula` in `code/map.json`.',
                '',
                'Top findings:',
                '',
                ...findings.map((x) => `- ${x}`),
                '',
            ].join('\n'),
        ]);
    }

    sections.push([
        'Knowledge areas',
        [
            '## Knowledge areas',
            '',
            'Beside Code, each area is filled by its own reader. Every fact carries a witness (file, line, hash) and its confirm state in `code/map.json` → `areas`, and data, interfaces, runtime and delivery also in a folder each.',
            '',
            ...areaSummaryLines(areas).map((l) => `- ${md(l.slice(2))}`),
            '',
        ].join('\n'),
    ]);

    if (m.drift) {
        const d = m.drift;
        sections.push([
            'Since the last map',
            [
                '## Since the last map',
                '',
                ...d.changed.slice(0, 10).map(([a, g, l]) => `- ${areaLabel(a)}: +${g} / −${l} files`),
                ...d.appeared.slice(0, 10).map((a) => `- new: ${areaLabel(a)}`),
                ...d.split.slice(0, 10).map(([name, parts]) => `- split: ${code(name)} → ${parts.map(areaLabel).join(', ')}`),
                ...d.merged.slice(0, 10).map(([a, names]) => `- merged into ${areaLabel(a)}: ${names.map((n) => `${code(n)}`).join(', ')}`),
                ...d.vanished.slice(0, 10).map((name) => `- gone: ${code(name)}`),
                '',
            ].join('\n'),
        ]);
    }

    if (m.prOverlap) {
        const o = m.prOverlap;
        sections.push([
            'Open PRs',
            [
                '## Open PRs by area',
                '',
                `${o.prs.length} open PR(s). Two PRs in the same area are a merge-order risk — advisory only.`,
                '',
                ...(o.conflicts.length
                    ? o.conflicts.slice(0, m.thresholds.listCap).map(([a, b, areas]) => `- #${a} and #${b} share ${areas.map(areaLabel).join(', ')}`)
                    : ['- no two open PRs touch the same area']),
                '',
            ].join('\n'),
        ]);
    }

    if (m.diff) {
        const d = m.diff;
        sections.push([
            'This change',
            [
                `## This change (${code(d.rev)}..working tree)`,
                '',
                `${d.changed.length} changed file(s) on the map, ${d.impacted.length} more with a trusted link into them` +
                    (d.outsideGraph.length ? `, ${d.outsideGraph.length} changed path(s) the graph does not hold` : '') +
                    '. It touches these areas:',
                '',
                '| Area | Changed | Linked into a change |',
                '|---|---|---|',
                ...d.areas.slice(0, m.thresholds.listCap).map(([a, c, i]) => `| ${m.areas[a]?.id ?? ''} ${md(m.areas[a]?.name ?? '')} | ${c} | ${i} |`),
                ...(d.areas.length === 0 ? ['| — none — | | |'] : []),
                '',
            ].join('\n'),
        ]);
    }

    const AREA_ROWS = 25;
    const areaRows = m.areas.slice(0, AREA_ROWS).map((a) => {
        const top = [...a.files]
            .sort((x, y) => (f[y]?.inFiles ?? 0) - (f[x]?.inFiles ?? 0) || x - y)
            .slice(0, 3)
            .map((x) => `${code(path.posix.basename(f[x]?.path ?? ''))}`)
            .join(', ');
        const page = a.files.length >= AREA_PAGE_MIN_FILES ? `[${a.id}](code/areas/${a.id}.md)` : a.id;
        return `| ${page} | ${md(a.name)} | ${a.files.length} | ${pct(a.cohesion)} | ${pct(a.testShare)} | ${pct(a.folderMismatch)} | ${top} |`;
    });
    sections.push([
        'Areas',
        [
            '## Areas',
            '',
            'Files grouped by how they are coupled, not by folder. *Outside hub folder* is the share of an',
            "area's non-test files whose directory differs from its hub's — where the folder layout and the",
            'actual dependencies disagree.',
            '',
            '| Area | Named after (hub) | Files | Cohesion | Tests | Outside hub folder | Most used |',
            '|---|---|---|---|---|---|---|',
            ...areaRows,
            ...(m.areas.length > AREA_ROWS
                ? ['', `${m.areas.length - AREA_ROWS} smaller areas are listed in \`code/map.json\` and in \`index.html\`.`]
                : []),
            '',
        ].join('\n'),
    ]);

    const infra = f.map((x, i) => [x, i] as const).filter(([x]) => x.role === 'infra');
    sections.push([
        'Infrastructure',
        [
            '## Infrastructure',
            '',
            `Files used by more than ${m.thresholds.infraInDegree} other files. They are drawn apart and do not decide areas.`,
            '',
            ...(infra.length ? infra.map(([x]) => `- ${code(x.path)} — used by ${x.inFiles} files`) : ['- none']),
            '',
        ].join('\n'),
    ]);

    sections.push([
        'Surprises',
        [
            '## Surprising links',
            '',
            'Links between two areas that are otherwise barely connected, rarest first.',
            '',
            ...(m.analyses.surprises.length
                ? m.analyses.surprises.map(
                      ([s, t]) => `- ${code(f[s]?.path ?? '')} → ${code(f[t]?.path ?? '')}`,
                  )
                : ['- none']),
            '',
        ].join('\n'),
    ]);

    sections.push([
        'Cycles',
        [
            '## Import cycles',
            '',
            `${m.analyses.cyclesTotal} file-level cycle(s) between code files (doc links excluded); the largest ${m.analyses.cycles.length} shown, the first 8 files of each.`,
            '',
            ...(m.analyses.cycles.length
                ? m.analyses.cycles.map((c, k) => {
                      const size = m.analyses.cycleSizes?.[k] ?? c.length;
                      return `- ${size} files: ${c.map((x) => `${code(f[x]?.path ?? '')}`).join(' · ')}${size > c.length ? ' · …' : ''}`;
                  })
                : ['- none']),
            '',
        ].join('\n'),
    ]);

    const rp = m.analyses.requestPaths.filter((r) => r.handler >= 0);
    if (m.analyses.requestPathsTotal > 0) {
        // GET routes that render a view first: the page a reader recognises.
        const rank = (r: (typeof rp)[number]): number =>
            (r.route.startsWith('GET ') ? 0 : 2) + (r.views.length > 0 ? 0 : 1);
        const withChain = rp
            .filter((r) => r.views.length + r.tables.length + (r.inferredTables?.length ?? 0) > 0)
            .sort((a, b) => rank(a) - rank(b) || (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
        sections.push([
            'Request paths',
            [
                '## Request paths',
                '',
                `${m.analyses.requestPathsTotal} declared routes; ${m.analyses.requestPathsResolved} reach a handler in this tree. ` +
                    'Route → handler → views it renders · tables its models persist, up to three calls deep ' +
                    '(inferred: reached through a call bound by name alone):',
                '',
                ...(withChain.length ? withChain : rp).slice(0, 10).map((r) => {
                    const handlerFile = path.posix.basename(f[r.handler]?.path ?? '');
                    const chain = [
                        handlerFile.replace(/\.php$/, '') === r.handlerSymbol ? handlerFile : `${handlerFile}::${r.handlerSymbol}`,
                        ...r.views.map((v) => path.posix.basename(f[v]?.path ?? '')),
                        ...r.tables.map((t) => `table ${code(t)}`),
                        ...(r.inferredTables ?? []).map((t) => `table ${code(t)} (inferred)`),
                    ];
                    return `- ${code(r.route)} → ${chain.map((c) => (c.startsWith('table') ? c : `${code(c)}`)).join(' → ')}`;
                }),
                '',
            ].join('\n'),
        ]);
    }

    if (m.artefacts) {
        const a = m.artefacts;
        const inbound = new Map<number, number>();
        for (const [, to] of a.edges) inbound.set(to, (inbound.get(to) ?? 0) + 1);
        const top = [...inbound.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, 8);
        sections.push([
            'Artefact layer',
            [
                '## Artefact layer',
                '',
                `This is an agent-config source tree, so its skills, rules, commands and ADRs are drawn as a second layer: ` +
                    Object.entries(a.relationCounts)
                        .sort()
                        .map(([rel, n]) => `${n} \`${rel}\``)
                        .join(' · ') +
                    '. Most referenced:',
                '',
                ...top.map(([n, c]) => `- ${code(a.nodes[n]?.[0] ?? '')} — ${c}`),
                '',
            ].join('\n'),
        ]);
    }

    const entries = f.filter((x) => x.role === 'entry');
    sections.push([
        'Entry points',
        [
            '## Entry points',
            '',
            ...(entries.length
                ? entries.slice(0, m.thresholds.listCap).map((x) => `- ${code(x.path)}`)
                : ['- none declared']),
            ...(entries.length > m.thresholds.listCap ? [`- … ${entries.length - m.thresholds.listCap} more`] : []),
            '',
        ].join('\n'),
    ]);

    const roleLines = ROLE_ORDER.filter((r) => m.analyses.roleCounts[r] > 0).map(
        (r) => `| ${r} | ${m.analyses.roleCounts[r]} |`,
    );
    sections.push([
        'Roles',
        [
            '## Files by role',
            '',
            '*isolated* means no trusted link in or out — never "dead": a file reached by reflection,',
            'a string path or a framework convention the engine does not read is isolated too.',
            '',
            '| Role | Files |',
            '|---|---|',
            ...roleLines,
            '',
        ].join('\n'),
    ]);

    sections.push([
        'External dependencies',
        [
            '## External dependencies',
            '',
            ...(m.analyses.externals.length
                ? m.analyses.externals.map(([spec, n]) => `- ${code(spec)} — imported by ${n} files`)
                : ['- none']),
            '',
        ].join('\n'),
    ]);

    sections.push([
        'Guesses',
        [
            '## Guessed links',
            '',
            `${m.analyses.guessEdgeCount} links were resolved by name only (no import, no type) and are not drawn by default; ` +
                `they are ${pct(m.analyses.guessShare)} of all file-to-file links.`,
            '',
        ].join('\n'),
    ]);

    return { head, sections };
}

export function renderAreaMd(m: MapModel, i: number, meta: MapMeta): string {
    const a = m.areas[i];
    if (!a) return '';
    const f = m.files;
    const inArea = new Set(a.files);
    const outside = new Map<number, number>();
    const inside: number[] = [];
    for (const [s, t, w] of m.edges) {
        if (inArea.has(s) && !inArea.has(t)) outside.set(t, (outside.get(t) ?? 0) + w);
        if (inArea.has(s) && inArea.has(t)) inside.push(w);
    }
    const deps = [...outside.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, m.thresholds.listCap);
    const files = [...a.files].sort((x, y) => (f[y]?.inFiles ?? 0) - (f[x]?.inFiles ?? 0) || x - y);
    return [
        `# ${a.id} — ${md(a.name)}`,
        '',
        `> Part of [${md(meta.title)}](../MAP.md) at \`${meta.commit}\`. Generated; never edit by hand.`,
        '',
        `${a.files.length} files · cohesion ${pct(a.cohesion)} · tests ${pct(a.testShare)} · outside hub folder ${pct(a.folderMismatch)}`,
        '',
        '## Files, most used first',
        '',
        '| File | Role | Used by | Uses |',
        '|---|---|---|---|',
        ...files.slice(0, 60).map((x) => {
            const r = f[x];
            return r ? `| ${code(r.path)} | ${r.role} | ${r.inFiles} | ${r.outFiles} |` : '';
        }),
        ...(files.length > 60 ? [`| … ${files.length - 60} more | | | |`] : []),
        '',
        '## What this area depends on outside itself',
        '',
        ...(deps.length
            ? deps.map(([t, w]) => {
                  const r = f[t];
                  const where = r && r.area >= 0 ? m.areas[r.area]?.id ?? '' : r?.role ?? '';
                  return `- ${code(r?.path ?? '')} (${where}) — ${w} link(s)`;
              })
            : ['- nothing']),
        '',
    ].join('\n');
}

function readViewer(name: string): string {
    return fs.readFileSync(path.join(VIEWER_DIR, name), 'utf-8');
}

/**
 * The viewer's script parts, in the order they run: each reads names the ones
 * before it declared, and the shell, last, routes between the areas and boots.
 */
export const VIEWER_SCRIPTS = [
    'core.js',
    'area_code.js',
    'areas_common.js',
    'history.js',
    'domains.js',
    'area_kit.js',
    'area_overview.js',
    'area_data.js',
    'area_systems.js',
    'area_interfaces.js',
    'area_runtime.js',
    'area_delivery.js',
    'area_impact.js',
    'area_agent.js',
    'area_knowledge.js',
    'area_bugs.js',
    'shell.js',
] as const;
/** The hub's parts: a project map's plus the Projects area, which no project map carries — not even as code. */
export const HUB_SCRIPTS = [...VIEWER_SCRIPTS.slice(0, -1), 'area_projects.js', 'shell.js'] as const;
export const VIEWER_STYLES = ['viewer.css', 'shell.css', 'area_kit.css', 'area_interfaces.css', 'area_impact.css', 'area_agent.css', 'area_ops.css', 'area_systems.css', 'area_knowledge.css', 'area_bugs.css'] as const;

/**
 * The one inline script: every part inside one function scope. Joined BEFORE
 * the page hashes it, so the Content-Security-Policy pins exactly what runs.
 */
export function viewerScript(parts: readonly string[] = VIEWER_SCRIPTS): string {
    const limits = JSON.parse(readViewer('supernodes.json')) as { collapseAbove: number; expandBelow: number; zoomExpand: number; zoomCollapse: number };
    const supers = JSON.stringify({ collapseAbove: limits.collapseAbove, expandBelow: limits.expandBelow, zoomExpand: limits.zoomExpand, zoomCollapse: limits.zoomCollapse });
    return `(function () {\n'use strict';\nvar SUPER_LIMITS = ${supers};\n${parts.map(readViewer).join('\n')}\n})();\n`;
}

export function viewerStyle(): string {
    return VIEWER_STYLES.map(readViewer).join('\n');
}

/** The handover's nav order (inbox round 2026-10-bf): Bugs and Wissen sit between Delivery and Impact. */
export const AREA_NAV = ['overview', 'code', 'data', 'systems', 'interfaces', 'runtime', 'delivery', 'bugs', 'knowledge', 'impact', 'agent'] as const;

/**
 * What the shell routes between when a page is not a project map. Only the
 * hub sets it; there `routes` is `['projects']`, the one area no project map has.
 */
export interface MapShell {
    routes: string[];
    home: string;
    hub?: { projects: number; indexed: number; /** Where the hub lives, home shortened to `~`; shown in its banner. */ dir?: string };
}

/** Escape every `<` so no file or symbol name can close the data block. */
export function embedJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function htmlText(s: string): string {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function sha256(s: string): string {
    return createHash('sha256').update(s, 'utf-8').digest('base64');
}

/**
 * One self-contained page. The script and style are inline and pinned by hash
 * in the Content-Security-Policy, which also forbids every network fetch:
 * the page cannot load anything, so "offline" is enforced rather than hoped.
 */
export function renderHtml(m: MapModel, meta: MapMeta, areas: MapAreas = {}): string {
    return renderPage(m, meta, areas);
}

/** The page behind {@link renderHtml}; the hub passes its own `areas` section and a {@link MapShell}. */
export function renderPage(m: MapModel, meta: MapMeta, areas: object, shell?: MapShell): string {
    const css = viewerStyle();
    const js = viewerScript(shell?.hub ? HUB_SCRIPTS : VIEWER_SCRIPTS);
    const data = embedJson(shell ? { meta, model: m, areas, shell } : { meta, model: m, areas });
    const nav: readonly string[] = shell?.routes ?? AREA_NAV;
    const csp = [
        "default-src 'none'",
        `script-src 'sha256-${sha256(js)}'`,
        `style-src 'sha256-${sha256(css)}'`,
        "img-src 'none'",
        "connect-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ].join('; ');
    return [
        '<!doctype html>',
        '<html lang="en" data-resolved-theme="dark">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
        `<title>${htmlText(meta.title)}</title>`,
        `<style>${css}</style>`,
        '</head>',
        '<body>',
        ...(shell?.hub ? [`<div class="hub-banner" id="hub-banner" role="note"><b id="hub-scope"></b><span class="mono" id="hub-path">${htmlText(shell.hub.dir ?? '')}</span><span id="hub-only"></span></div>`] : []),
        '<header class="top">',
        '<div class="top-row">',
        '<div class="brand">',
        // The AC mark from .github/assets/info-banner.png as vectors: the letters are
        // traced from the image, the rest redrawn. The published package carries no images.
        '<svg class="logo" width="40" height="40" viewBox="0 0 172 172" role="img" aria-label="AC"><defs><linearGradient id="acRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a1a"/><stop offset="0.59" stop-color="#ff6a1a"/><stop offset="0.79" stop-color="#3aa6ff"/><stop offset="1" stop-color="#2f9bff"/></linearGradient>' +
            '<linearGradient id="acCore" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0c0"/><stop offset="0.64" stop-color="#ffd2b0"/><stop offset="0.81" stop-color="#d8f0ff"/><stop offset="1" stop-color="#d8f0ff"/></linearGradient>' +
            '<linearGradient id="acA" gradientUnits="userSpaceOnUse" x1="62.4" y1="51.6" x2="131.6" y2="144.4"><stop offset="0" stop-color="#fafeff"/><stop offset="0.42" stop-color="#fef8ee"/><stop offset="0.595" stop-color="#fecf88"/><stop offset="1" stop-color="#fcc363"/></linearGradient>' +
            '<linearGradient id="acC" x1="0.1" y1="0.1" x2="0.9" y2="0.9"><stop offset="0" stop-color="#fff2e2"/><stop offset="0.45" stop-color="#ffc993"/><stop offset="1" stop-color="#ff8f2c"/></linearGradient>' +
            '<linearGradient id="acTerm" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffb43c"/><stop offset="0.55" stop-color="#ffb43c"/><stop offset="0.8" stop-color="#38c8ff"/></linearGradient><radialGradient id="acOr" cx="0.45" cy="0.4" r="0.6"><stop offset="0" stop-color="#ff9a40"/><stop offset="1" stop-color="#ff5e10"/></radialGradient>' +
            '<radialGradient id="acBl" cx="0.45" cy="0.4" r="0.6"><stop offset="0" stop-color="#7fd6ff"/><stop offset="1" stop-color="#1b86ff"/></radialGradient><filter id="acGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="172" height="172"><feGaussianBlur stdDeviation="1.65" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
            '<filter id="acHalo" filterUnits="userSpaceOnUse" x="0" y="0" width="172" height="172"><feGaussianBlur stdDeviation="4.6"/></filter><filter id="acLH" filterUnits="userSpaceOnUse" x="0" y="0" width="172" height="172"><feGaussianBlur stdDeviation="3"/></filter></defs><rect x="12" y="11.75" width="146.75" height="148.25" rx="24.5" fill="#04070d"/>' +
            '<g stroke="#12253a" stroke-width="0.8" fill="none" opacity="0.9"><path d="M14 137.5 H30 M88 137.5 H134 M50 30 V44 M20 118 H32 M148 60 V75 M100 150 V158 M118 66 H128"/></g><rect x="12" y="11.75" width="146.75" height="148.25" rx="24.5" fill="none" stroke="url(#acRim)" stroke-width="5" filter="url(#acHalo)" opacity="0.87"/>' +
            '<rect x="12" y="11.75" width="146.75" height="148.25" rx="24.5" fill="none" stroke="url(#acRim)" stroke-width="3.4"/><rect x="12" y="11.75" width="146.75" height="148.25" rx="24.5" fill="none" stroke="url(#acCore)" stroke-width="1.9"/><g fill="none" stroke-linecap="round" filter="url(#acGlow)">' +
            '<path d="M24.25 78.5 L40.5 48.75 L53.75 61.25 M40.5 48.75 L60.75 48.25 L70.5 27 M24.25 78.5 L35 96 M24.25 78.5 L44 77.5" stroke="#ff8a2a" stroke-width="0.9"/><path d="M80.5 42 L109 29.75 L140.5 52.75 M109 29.75 V51 M140.5 52.75 L128 61 M89 137.5 H133" stroke="#2fa8ff" stroke-width="0.9"/><path d="M140 88 V102 M142.25 102.75 L151.05 92.75" stroke="#ff5a2a" stroke-width="1.2"/>' +
            '<circle cx="140" cy="85" r="5" stroke="#ff5a2a" stroke-width="1.3"/><circle cx="153.25" cy="90.5" r="5" stroke="#ff5a2a" stroke-width="1.3"/><circle cx="140" cy="105" r="5" stroke="#ff5a2a" stroke-width="1.3"/></g><g filter="url(#acGlow)"><circle cx="40.5" cy="48.75" r="8.25" fill="url(#acOr)" stroke="#ffbf8a" stroke-width="1"/>' +
            '<circle cx="24.25" cy="78.5" r="7.7" fill="url(#acOr)" stroke="#ffbf8a" stroke-width="1"/><circle cx="70.5" cy="27" r="2.85" fill="#ffe6cf"/><circle cx="53.75" cy="61.25" r="1.4" fill="#ff9a3c"/><circle cx="35" cy="96" r="1.4" fill="#ff9a3c"/><circle cx="80.5" cy="42" r="1.6" fill="#8fe2ff"/>' +
            '<circle cx="109" cy="29.75" r="4.9" fill="#bff1ff" stroke="#2fc0ff" stroke-width="1.2"/><circle cx="140.5" cy="52.75" r="7.85" fill="url(#acBl)" stroke="#9fe0ff" stroke-width="0.8"/><circle cx="135" cy="137.5" r="2.4" fill="#bff3ff"/></g>' +
            '<path d="M74.4 47.4L75.6 47.9L75.9 49.6L77.6 51.6L80.9 58.6L84.6 64.9L106.1 109.6L108.4 111.1L111.1 111.4L113.9 110.9L117.4 109.1L122.9 103.9L132.6 114.1L132.9 115.6L132.1 116.6L127.4 121.1L124.6 121.9L95.4 121.6L89.9 110.1L88.9 109.1L74.9 108.6L70.1 99.4L69.1 96.9L69.1 95.4L81.6 95.1L82.6 94.1L78.4 84.4L78.1 82.4L75.1 76.4L73.4 75.1L71.1 77.1L69.6 80.6L67.9 82.4L66.4 85.9L64.9 87.4L64.1 89.9L45.6 118.9L43.9 119.6L32.4 119.6L30.6 121.6L30.4 121.4L30.4 120.4L29.4 118.9L29.9 117.1L55.1 76.1L66.1 58.9L74.1 47.6ZM105.4 59.1L113.1 59.1L120.6 61.1L126.1 64.1L131.6 69.1L131.9 70.6L131.1 71.6L122.9 80.6L121.1 81.4L117.4 77.6L115.1 76.1L110.1 74.9L105.1 75.4L98.4 79.1L97.4 79.1L96.4 78.1L90.6 67.1L90.6 65.9L93.4 63.4L97.9 61.1L105.1 59.4Z" fill="#ffb877" opacity="0.3" filter="url(#acLH)"/>' +
            '<path d="M74.4 47.4L75.6 47.9L75.9 49.6L77.6 51.6L80.9 58.6L84.6 64.9L106.1 109.6L108.4 111.1L111.1 111.4L113.9 110.9L117.4 109.1L122.9 103.9L132.6 114.1L132.9 115.6L132.1 116.6L127.4 121.1L124.6 121.9L95.4 121.6L89.9 110.1L88.9 109.1L74.9 108.6L70.1 99.4L69.1 96.9L69.1 95.4L81.6 95.1L82.6 94.1L78.4 84.4L78.1 82.4L75.1 76.4L73.4 75.1L71.1 77.1L69.6 80.6L67.9 82.4L66.4 85.9L64.9 87.4L64.1 89.9L45.6 118.9L43.9 119.6L32.4 119.6L30.6 121.6L30.4 121.4L30.4 120.4L29.4 118.9L29.9 117.1L55.1 76.1L66.1 58.9L74.1 47.6ZM105.4 59.1L113.1 59.1L120.6 61.1L126.1 64.1L131.6 69.1L131.9 70.6L131.1 71.6L122.9 80.6L121.1 81.4L117.4 77.6L115.1 76.1L110.1 74.9L105.1 75.4L98.4 79.1L97.4 79.1L96.4 78.1L90.6 67.1L90.6 65.9L93.4 63.4L97.9 61.1L105.1 59.4Z" fill="url(#acA)"/>' +
            '<rect x="30.75" y="118.75" width="57.5" height="29.5" rx="3" fill="#04070d" stroke="url(#acTerm)" stroke-width="1.3" filter="url(#acGlow)"/><path d="M40.75 129.5 L47.75 134.5 L40.75 139.5 M51.75 139.75 H61.75" fill="none" stroke="#ffb43c" stroke-width="1.8" stroke-linecap="round"/></svg>',
        shell?.hub ? '<div class="brand-name hub"><b>AGENT CONFIG</b><span>ESTATE MAP</span></div>' : '<div class="brand-name"><b>AGENT CONFIG</b><span>KNOWLEDGE MAP</span></div>',
        '</div>',
        ...(shell?.hub ? ['<span class="chip mono hub-chip" id="hub-chip"></span><span class="hub-back" id="hub-back"></span>'] : []),
        `<nav class="areanav" id="areanav" aria-label="Areas"${shell?.hub ? ' hidden' : ''}>${nav.map((r) => `<a href="#/${r}" data-route="${r}">${r}</a>`).join('')}</nav>`,
        '</div>',
        '<div class="top-row row2">',
        `<div class="pins mono"><span class="chip" id="pin-commit"></span><span class="chip fresh" id="pin-fresh"></span>${shell?.hub ? '' : '<span class="chip snap" id="pin-snap" hidden></span>'}${meta.demo ? '<span class="chip demo" id="pin-demo"></span>' : ''}</div>`,
        '<div class="search"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="5"></circle><path d="M11 11l3.5 3.5"></path></svg>' +
            '<input id="search" type="search" autocomplete="off"><span class="kbd mono">/</span>' +
            '<span class="sr-only" id="search-live" aria-live="polite"></span>' +
            '<div class="pop" id="pop" hidden><div class="kinds" id="kinds" role="group"></div><div class="scrumb" id="searchcrumb" hidden></div><ul class="results" id="results"></ul></div></div>',
        '<div class="actions">',
        '<button type="button" class="btn" id="export"></button>',
        '<button type="button" class="btn icon" id="theme"><svg id="theme-sun" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3"></circle><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"></path></svg>' +
            '<svg id="theme-moon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" hidden><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z"></path></svg></button>',
        '<button type="button" class="btn mono" id="lang" aria-label="Language"></button>',
        '</div>',
        '</div>',
        '</header>',
        '<div class="banner" id="banner" role="status" hidden></div>',
        '<div class="wb" id="wb">',
        '<div class="scrim" id="scrim" hidden></div>',
        '<aside class="rail" id="pane-left" aria-label="Repository">',
        '<div class="pane-head"><span class="cap" id="title-left"></span><button type="button" class="pane-pin" id="pin-left" aria-pressed="false"></button><button type="button" class="pane-close" id="close-left">×</button></div>',
        '<section id="health"></section>',
        '<section id="kpis"></section>',
        '<section id="colorby"></section>',
        '<section id="explorer"></section>',
        '</aside>',
        '<main class="center">',
        '<div class="bar-top">',
        '<button type="button" class="pane-open" id="open-left" aria-controls="pane-left"></button>',
        '<div class="lenses" role="tablist" aria-label="View" id="lenses"></div>',
        '<div class="filters"><span id="edges-label"></span>' +
            '<button type="button" class="fbtn" id="t-sure" aria-pressed="true"></button>' +
            '<button type="button" class="fbtn dash" id="t-guess" aria-pressed="false"></button>' +
            '<button type="button" class="fbtn" id="t-tests" aria-pressed="true"></button>' +
            '<button type="button" class="fbtn" id="t-infra" aria-pressed="false"></button>' +
            '<button type="button" class="fullbtn" id="full" aria-pressed="false"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9"></path></svg><span id="full-label"></span></button></div>',
        '<button type="button" class="pane-open" id="open-right" aria-controls="pane-right"></button>',
        '</div>',
        '<nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>',
        '<div class="view">',
        '<div id="graphwrap">',
        '<div class="stage">',
        '<canvas id="stage" role="img" aria-label="Project map"></canvas>',
        '<div class="overlay">',
        '<div class="seg dd"><button type="button" id="lim" class="lim" aria-haspopup="listbox" aria-expanded="false" aria-controls="limlist" data-value="15"><span id="limtxt">15</span><span class="chev" aria-hidden="true"></span></button>' +
            '<ul id="limlist" class="ddlist" role="listbox" hidden>' + ['15', '30', '50', '100', 'all'].map((v) => `<li role="option" tabindex="-1" data-value="${v}" aria-selected="${v === '15'}">${v}</li>`).join('') + '</ul></div>' +
            '<div class="seg dimseg" role="radiogroup" aria-label="2D / 3D" id="dimseg"><button type="button" role="radio" id="dim2d" aria-checked="true"></button><button type="button" role="radio" id="dim" aria-checked="false"></button></div>',
        '<div class="seg"><button type="button" class="z" id="z-out">−</button><button type="button" class="z" id="z-in">+</button><button type="button" class="fit" id="z-fit"></button></div>',
        '<button type="button" class="backbtn" id="back" hidden></button>',
        '</div>',
        '<div class="hintbar"><span id="hint"></span><span id="zoomtxt"></span></div>',
        '<div class="fullcard" id="fullcard" hidden></div>',
        '</div>',
        '<div class="legend" id="legend"></div>',
        '</div>',
        '<div id="lensview" hidden></div>',
        '</div>',
        '<footer class="foot" id="foot"></footer>',
        '</main>',
        '<aside class="rail side" id="pane-right" aria-label="Detail">',
        '<div class="pane-head"><span class="cap" id="title-right"></span><button type="button" class="pane-pin" id="pin-right" aria-pressed="false"></button><button type="button" class="pane-close" id="close-right">×</button></div>',
        '<div class="tabs" role="tablist" aria-label="Detail" id="tabs"></div>',
        '<div id="panel" aria-live="polite"></div>',
        '</aside>',
        '</div>',
        '<div class="av" id="av" hidden>',
        '<div class="av-bar" id="av-bar"></div>',
        '<div class="av-body no-left" id="av-body">',
        '<div class="scrim" id="av-scrim" hidden></div>',
        '<aside class="av-left" id="av-left" aria-label="List">',
        '<div class="pane-head"><span class="cap" id="av-left-title"></span><button type="button" class="pane-pin" id="av-pin-left" aria-pressed="false"></button><button type="button" class="pane-close" id="av-close-left">×</button></div>',
        '<div id="av-left-body"></div>',
        '</aside>',
        '<main class="av-main" id="av-main"></main>',
        '<aside class="av-side" id="av-side" aria-label="Detail">',
        '<div class="pane-head"><span class="cap" id="av-right-title"></span><button type="button" class="pane-pin" id="av-pin" aria-pressed="false"></button><button type="button" class="pane-close" id="av-close">×</button></div>',
        '<div id="av-detail" aria-live="polite"></div>',
        '<div id="av-right-body" hidden></div>',
        '</aside>',
        '<button type="button" class="pane-open av-open-left" id="av-open-left" aria-controls="av-left"></button>',
        '<button type="button" class="pane-open av-open" id="av-open" aria-controls="av-side"></button>',
        '</div>',
        '</div>',
        `<script type="application/json" id="map-data">${data}</script>`,
        `<script>${js}</script>`,
        '</body>',
        '</html>',
        '',
    ].join('\n');
}

/** One area's line in `manifest.json`: where its payload is, what read it, and how far to trust it. */
export interface ManifestArea {
    /** Map-folder-relative file holding the payload; null when no reader wrote one. */
    path: string | null;
    /** The reader that wrote the payload. */
    source: string | null;
    /** `fresh`, `behind:<n>`, `edited` or `absent` for Code; for the others `fresh`, `stale`, `contradicted`, `incomplete`, `unverifiable`, `empty` or `absent`. */
    freshness: string;
    completeness?: string;
    /** Witnesses (Code: files) the payload carries — a lower bound when the read was partial. */
    facts: number;
    findings?: number;
    /** Findings outside product scope, kept out of `findings` and the default view. */
    fixture_findings?: number;
    /** Why there is nothing, or why the state is not fresh. */
    reason?: string;
}

export interface MapManifest {
    schema: 1;
    generation: string;
    commit: string;
    /** The commit `state` describes — the build's, never HEAD's; compare it with HEAD yourself. */
    built_at_commit: string;
    state: string;
    areas: Record<string, ManifestArea>;
}

/** What this generation of the map folder holds, area by area; no timestamp, so a redraw of one tree writes the same bytes. */
export function mapManifest(m: MapModel, meta: MapMeta, areas: MapAreas): MapManifest {
    const graph = meta.state === 'fresh' ? 'fresh' : meta.state === 'absent' || meta.state === '' ? 'unverifiable' : 'stale';
    const out: Record<string, ManifestArea> = {
        code: { path: 'code/map.json', source: 'code-graph', freshness: meta.state, facts: m.files.length },
    };
    const folders: readonly string[] = AREA_FOLDERS;
    for (const id of KNOWLEDGE_AREA_IDS) {
        const p = areas[id];
        if (!p) {
            out[id] = { path: null, source: null, freshness: 'absent', facts: 0, reason: 'no reader for this area ran on this tree' };
            continue;
        }
        const ws = witnessesOf({ [id]: p });
        const off = ws.filter(([, w]) => w.confirm === 'changed' || w.confirm === 'gone').length;
        const freshness = p.empty !== undefined ? 'empty' : off > 0 ? 'contradicted' : p.completeness !== 'complete' ? 'incomplete' : graph;
        const reason =
            p.empty !== undefined ? p.empty : off > 0 ? `${off} witness(es) changed or gone since they were read` : freshness === 'incomplete' ? 'the reader saw only part of its population' : freshness === 'fresh' ? undefined : `graph state ${meta.state || 'absent'}`;
        out[id] = {
            path: folders.includes(id) ? `${id}/${id}.json` : 'code/map.json',
            source: p.reader,
            freshness,
            completeness: p.completeness,
            facts: ws.length,
            findings: p.findings.length,
            ...(p.fixture_findings ? { fixture_findings: p.fixture_findings } : {}),
            ...(reason ? { reason } : {}),
        };
    }
    return { schema: 1, generation: meta.graph_generation ?? '', commit: meta.commit, built_at_commit: meta.commit, state: meta.state, areas: out };
}

/** The map a previous `code-graph map` wrote, or null when there is none. */
export function readMap(root: string): { meta: MapMeta; model: MapModel } | null {
    return readMapAt(graphHome(root).mapDir);
}

/** The tours of the map in `dir`, so a step whose input changed since is marked stale. */
function previousTours(dir: string): MapTour[] {
    try {
        const parsed = JSON.parse(fs.readFileSync(mapJsonPath(dir), 'utf-8')) as { areas?: { tours?: MapTour[] } };
        return Array.isArray(parsed.areas?.tours) ? parsed.areas.tours : [];
    } catch {
        return [];
    }
}

function readMapAt(dir: string): { meta: MapMeta; model: MapModel } | null {
    const p = mapJsonPath(dir);
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as { meta?: MapMeta; model?: Partial<MapModel> } | null;
        const m = parsed?.model;
        // A map from another model version, or a stray file, reads as "no map"
        // rather than crashing a reader that trusts its shape.
        if (
            !parsed?.meta ||
            !m ||
            m.version !== MAP_MODEL_VERSION ||
            !Array.isArray(m.files) ||
            !Array.isArray(m.areas) ||
            !Array.isArray(m.edges) ||
            typeof m.analyses !== 'object' ||
            m.analyses === null
        ) {
            return null;
        }
        return parsed as { meta: MapMeta; model: MapModel };
    } catch {
        return null;
    }
}

export interface AreaReport {
    id: string;
    name: string;
    kind: string;
    files: Array<{ path: string; role: string; usedBy: number; uses: number }>;
    hubs: string[];
    cohesion: number;
    testShare: number;
    folderMismatch: number;
    dependsOn: Array<{ path: string; area: string; links: number }>;
    usedByAreas: Array<{ area: string; links: number }>;
    page: string | null;
}

/**
 * One area, found by id (`a3`), by exact name, or by a file it contains —
 * exact matches only, so the answer is always about the area that was named.
 */
export function areaReport(
    m: MapModel,
    query: string,
    pageDir: string = path.posix.join('agents', 'map'),
): AreaReport | { refusal: string; candidates: string[] } {
    let i = m.areas.findIndex((a) => a.id === query || a.name === query);
    if (i < 0) {
        const f = m.files.findIndex((x) => x.path === query);
        if (f >= 0) i = m.files[f]?.area ?? -1;
        if (f >= 0 && i < 0) {
            return { refusal: `${query} belongs to no area (role ${m.files[f]?.role ?? '?'})`, candidates: [] };
        }
    }
    if (i < 0) {
        const q = query.toLowerCase();
        const candidates = m.areas
            .filter((a) => a.name.toLowerCase().includes(q))
            .slice(0, 10)
            .map((a) => `${a.id} ${a.name}`);
        return { refusal: `no area is exactly '${query}'`, candidates };
    }
    const a = m.areas[i] as MapModel['areas'][number];
    const inArea = new Set(a.files);
    const out = new Map<number, number>();
    const inbound = new Map<number, number>();
    for (const [s, t, w] of m.edges) {
        if (inArea.has(s) && !inArea.has(t)) out.set(t, (out.get(t) ?? 0) + w);
        if (inArea.has(t) && !inArea.has(s)) {
            const sa = m.files[s]?.area ?? -1;
            if (sa >= 0) inbound.set(sa, (inbound.get(sa) ?? 0) + w);
        }
    }
    const cap = m.thresholds.listCap;
    const files = [...a.files]
        .sort((x, y) => (m.files[y]?.inFiles ?? 0) - (m.files[x]?.inFiles ?? 0) || x - y)
        .map((x) => {
            const r = m.files[x];
            return { path: r?.path ?? '', role: r?.role ?? '', usedBy: r?.inFiles ?? 0, uses: r?.outFiles ?? 0 };
        });
    return {
        id: a.id,
        name: a.name,
        kind: a.kind,
        files: files.slice(0, 60),
        hubs: files.slice(0, 5).map((x) => x.path),
        cohesion: a.cohesion,
        testShare: a.testShare,
        folderMismatch: a.folderMismatch,
        dependsOn: [...out.entries()]
            .sort((x, y) => y[1] - x[1] || x[0] - y[0])
            .slice(0, cap)
            .map(([t, w]) => {
                const r = m.files[t];
                const ai = r?.area ?? -1;
                return { path: r?.path ?? '', area: ai >= 0 ? (m.areas[ai]?.id ?? '') : (r?.role ?? ''), links: w };
            }),
        usedByAreas: [...inbound.entries()]
            .sort((x, y) => y[1] - x[1] || x[0] - y[0])
            .slice(0, cap)
            .map(([ai, w]) => ({ area: `${m.areas[ai]?.id ?? ''} ${m.areas[ai]?.name ?? ''}`, links: w })),
        page: a.files.length >= AREA_PAGE_MIN_FILES ? path.posix.join(pageDir, 'code', 'areas', `${a.id}.md`) : null,
    };
}
