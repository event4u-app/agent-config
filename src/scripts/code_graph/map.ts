/**
 * `agent-config code-graph map` — write the project map to `agents/map/`.
 *
 * IO around the pure projection in `map_model.ts`: read the engine's graph
 * (building or refreshing it first when needed), derive the model, and write
 * four artefacts a person or an agent reads (ADR-297):
 *
 *   agents/map/index.html        one self-contained offline file
 *   agents/map/MAP.md            the same picture in words, budgeted
 *   agents/map/areas/<id>.md     one page per area of five or more files
 *   agents/map/map.json          the model the other three are rendered from
 *
 * Same tree in, same bytes out: nothing written here carries a timestamp, a
 * host path or anything else that differs between two builds of one commit.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { write_atomic } from '../_lib/fs_atomic.js';
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { buildFromRepo } from './build.js';
import { computeVerdict, graphState, NATIVE_CACHE_REL } from './detect.js';
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
import type { CodeGraph } from './types.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const VIEWER_DIR = path.join(_HERE, 'map_viewer');

export const MAP_DIR_REL = path.join('agents', 'map');
/** Rough characters-per-token used to hold MAP.md to its budget. */
const CHARS_PER_TOKEN = 4;
export const MAP_TOKEN_BUDGET = 2000;
export const AREA_PAGE_MIN_FILES = 5;

export interface MapMeta {
    title: string;
    commit: string;
    state: string;
    summary: string;
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
        return execFileSync('git', ['-C', root, 'rev-parse', '--short=12', 'HEAD'], {
            env: hardenedSpawnEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return 'no-git';
    }
}

/**
 * Entry points a manifest declares: `package.json` `bin` / `main` / `module`,
 * `composer.json` `bin`. Route files and `public/index.php` are recognised by
 * path in `staticRole`; this only adds what a manifest names explicitly.
 */
export function declaredEntryFiles(root: string): string[] {
    const out = new Set<string>();
    const add = (v: unknown): void => {
        if (typeof v !== 'string') return;
        out.add(path.posix.normalize(v.replace(/^\.\//, '')));
    };
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as Record<string, unknown>;
        const bin = pkg['bin'];
        if (typeof bin === 'string') add(bin);
        else if (bin && typeof bin === 'object') for (const v of Object.values(bin)) add(v);
        add(pkg['main']);
        add(pkg['module']);
    } catch {
        /* no package.json */
    }
    try {
        const composer = JSON.parse(fs.readFileSync(path.join(root, 'composer.json'), 'utf-8')) as Record<string, unknown>;
        const bin = composer['bin'];
        if (Array.isArray(bin)) for (const v of bin) add(v);
    } catch {
        /* no composer.json */
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

function isGitRepo(root: string): boolean {
    try {
        execFileSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], {
            env: hardenedSpawnEnv(),
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        return true;
    } catch {
        return false;
    }
}

/** The graph the map is drawn from: built when absent, updated when behind. */
async function loadOrBuildGraph(
    root: string,
    cachePath: string,
    noBuild: boolean,
): Promise<{ graph: CodeGraph; built: boolean }> {
    const verdict = computeVerdict(root, cachePath).verdict;
    // `edited` — an uncommitted change to an indexed file — reads FRESH to the
    // commit-based verdict, and a map drawn from it would show the old code.
    // Outside a git repository there is nothing to compare against at all, so
    // freshness is unknowable and the incremental build decides per file.
    if (verdict === 'FRESH' && fs.existsSync(cachePath) && isGitRepo(root) && graphState(root, cachePath) === 'fresh') {
        return { graph: JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CodeGraph, built: false };
    }
    // `--no-build` (the git hook): the budgeted `refresh` before it owns the
    // build; an unbudgeted one here would hold the refresh lock indefinitely.
    if (noBuild) {
        if (!fs.existsSync(cachePath)) throw new Error('no graph to draw (--no-build)');
        return { graph: JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CodeGraph, built: false };
    }
    const { graph } = await buildFromRepo(root, cachePath, { update: fs.existsSync(cachePath) });
    return { graph, built: true };
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
            execFileSync('git', ['-C', root, ...args], {
                env: hardenedSpawnEnv(),
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
            })
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
        return [...new Set([...run(['diff', '--name-only', rev]), ...run(['diff', '--name-only', '--cached', rev])])].sort();
    } catch {
        return null;
    }
}

/** Where `code-graph outcome` records which files a session found useful — local, never sent anywhere. */
export const OUTCOMES_REL = path.join('agents', 'runtime', 'state', 'map-outcomes.jsonl');

export function readOutcomes(root: string): OutcomeEvent[] {
    let text: string;
    try {
        text = fs.readFileSync(path.join(root, OUTCOMES_REL), 'utf-8');
    } catch {
        return [];
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
    const p = path.join(root, OUTCOMES_REL);
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
        noBuild?: boolean;
        /** Test seam: called after each artefact lands in the new generation. */
        _afterWrite?: (rel: string) => void;
    } = {},
): Promise<MapBuildResult> {
    const outDir = opts.outDir ?? path.join(root, MAP_DIR_REL);
    // A chosen --out directory is only ever written into when it is empty or
    // already holds a map: the writer clears stale area pages, and that must
    // never reach a directory of someone else's Markdown.
    if (
        opts.outDir !== undefined &&
        fs.existsSync(outDir) &&
        fs.readdirSync(outDir).length > 0 &&
        !fs.existsSync(path.join(outDir, 'map.json'))
    ) {
        throw new Error(`refusing to write a map into ${outDir}: it is not empty and holds no map.json`);
    }
    const cachePath = opts.cachePath ?? path.join(root, NATIVE_CACHE_REL);
    const { graph, built } = await loadOrBuildGraph(root, cachePath, opts.noBuild === true);
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
    const meta: MapMeta = {
        title: `Map of ${path.basename(root)}`,
        commit: gitHead(root),
        state: graphState(root, cachePath),
        summary: '',
    };
    meta.summary =
        `${model.files.length} files · ${model.areas.length} areas · ` +
        `${model.analyses.trustedEdges} trusted links · guess share ${pct(model.analyses.guessShare)}`;

    // One generation at a time: everything is written into a sibling directory,
    // which then replaces the live one, so a reader never sees `map.json` of one
    // build beside pages of another, and a failed redraw leaves the last one whole.
    // The default map stages under the gitignored runtime dir, so a killed redraw
    // leaves nothing in agents/ itself; a chosen --out stages beside itself.
    const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`;
    const stage = opts.outDir === undefined ? path.join(root, 'agents', 'runtime', 'state') : path.dirname(outDir);
    fs.mkdirSync(stage, { recursive: true });
    const next = path.join(stage, `.map-next-${suffix}`);
    const prev = path.join(stage, `.map-prev-${suffix}`);
    const written: string[] = [];
    try {
        const write = (rel: string, content: string): void => {
            const p = path.join(next, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            write_atomic(p, content);
            written.push(rel);
            opts._afterWrite?.(rel);
        };
        write('map.json', `${JSON.stringify({ meta, model })}\n`);
        write('MAP.md', renderMapMd(model, meta));
        for (const [i, a] of model.areas.entries()) {
            if (a.files.length >= AREA_PAGE_MIN_FILES) write(path.join('areas', `${a.id}.md`), renderAreaMd(model, i, meta));
        }
        write('index.html', renderHtml(model, meta));
        carryForeignEntries(outDir, next);
        swapIn(next, outDir, prev);
    } finally {
        fs.rmSync(next, { recursive: true, force: true });
    }
    return { outDir, model, meta, written, graphBuilt: built };
}

/**
 * What a map generation consists of; anything else in the directory is someone else's and is
 * carried over. `map-render.json` belongs to a generation although `buildMap` does not write it:
 * it is `code-graph map`'s render check OF that generation, written after the swap, so the
 * previous one's is dropped rather than left describing pages it never saw.
 */
const GENERATION_ENTRIES = new Set(['map.json', 'MAP.md', 'index.html', 'areas', 'map-render.json']);

/** Copy entries the writer does not produce into the new generation, so the swap drops nothing. */
function carryForeignEntries(live: string, next: string): void {
    if (!fs.existsSync(live)) return;
    for (const entry of fs.readdirSync(live)) {
        if (GENERATION_ENTRIES.has(entry)) continue;
        fs.cpSync(path.join(live, entry), path.join(next, entry), { recursive: true, verbatimSymlinks: true });
    }
}

/**
 * Replace `live` by `next` with two renames; on a failed second rename the old generation goes
 * back. Consistent, not atomic: between the renames `live` is briefly absent, and a process
 * killed there leaves the old generation at `prev` (under the gitignored runtime dir for the
 * default map) — a reader sees no map, never a mixed one.
 */
export function swapIn(next: string, live: string, prev: string, rename: typeof fs.renameSync = fs.renameSync): void {
    fs.mkdirSync(path.dirname(live), { recursive: true });
    const hadLive = fs.existsSync(live);
    if (hadLive) rename(live, prev);
    try {
        rename(next, live);
    } catch (e) {
        if (hadLive) rename(prev, live);
        throw e;
    }
    if (hadLive) fs.rmSync(prev, { recursive: true, force: true });
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
export function renderMapMd(m: MapModel, meta: MapMeta): string {
    const f = m.files;
    const head = [
        `# ${md(meta.title)}`,
        '',
        `> Generated by \`agent-config code-graph map\` at \`${meta.commit}\` · graph state \`${meta.state}\`.`,
        '> Deterministic, no model call. Rebuild with `agent-config code-graph map`; never edit by hand.',
        '',
        `**${f.length} files · ${m.areas.length} areas · ${m.analyses.trustedEdges} trusted links · guess share ${pct(m.analyses.guessShare)}**`,
        '',
        `Thresholds: seed ${m.thresholds.seed} · infrastructure above in-degree ${m.thresholds.infraInDegree} · ` +
            `areas under ${m.thresholds.smallArea} files fold into "small parts" · an area above ` +
            `${Math.round(m.thresholds.maxAreaShare * 100)} % is split once · lists capped at ${m.thresholds.listCap}.`,
        '',
        '',
    ].join('\n');

    const sections: Array<[string, string]> = [];
    const areaLabel = (i: number): string => `${m.areas[i]?.id ?? ''} ${md(m.areas[i]?.name ?? '')}`;

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
        const page = a.files.length >= AREA_PAGE_MIN_FILES ? `[${a.id}](areas/${a.id}.md)` : a.id;
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
                ? ['', `${m.areas.length - AREA_ROWS} smaller areas are listed in \`map.json\` and in \`index.html\`.`]
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
            `${m.analyses.cyclesTotal} file-level cycle(s); the largest ${m.analyses.cycles.length} shown, up to 8 files each.`,
            '',
            ...(m.analyses.cycles.length
                ? m.analyses.cycles.map((c) => `- ${c.map((x) => `${code(f[x]?.path ?? '')}`).join(' · ')}`)
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
            .filter((r) => r.views.length + r.tables.length > 0)
            .sort((a, b) => rank(a) - rank(b) || (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
        sections.push([
            'Request paths',
            [
                '## Request paths',
                '',
                `${m.analyses.requestPathsTotal} declared routes; ${m.analyses.requestPathsResolved} reach a handler in this tree. ` +
                    'Route → handler → views it renders · tables its models persist:',
                '',
                ...(withChain.length ? withChain : rp).slice(0, 10).map((r) => {
                    const handlerFile = path.posix.basename(f[r.handler]?.path ?? '');
                    const chain = [
                        handlerFile.replace(/\.php$/, '') === r.handlerSymbol ? handlerFile : `${handlerFile}::${r.handlerSymbol}`,
                        ...r.views.map((v) => path.posix.basename(f[v]?.path ?? '')),
                        ...r.tables.map((t) => `table ${code(t)}`),
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
            'They are in `map.json`, in the per-area pages and in `index.html`.\n';
    }
    return out;
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
export function renderHtml(m: MapModel, meta: MapMeta): string {
    const css = readViewer('viewer.css');
    const js = readViewer('viewer.js');
    const data = embedJson({ meta, model: m });
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
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
        `<title>${htmlText(meta.title)}</title>`,
        `<style>${css}</style>`,
        '</head>',
        '<body>',
        '<header>',
        `<h1>${htmlText(meta.title)}</h1>`,
        '<nav class="crumbs" id="crumbs" aria-label="Breadcrumb"></nav>',
        '<div class="search"><input id="search" type="search" autocomplete="off"><ul class="results" id="results"></ul></div>',
        '<div class="toolbar">',
        '<button type="button" id="lens-areas" aria-pressed="true"></button>',
        '<button type="button" id="lens-folders" aria-pressed="false"></button>',
        '<button type="button" id="lens-artefacts" aria-pressed="false" hidden></button>',
        '<button type="button" id="t-infra" aria-pressed="true"></button>',
        '<button type="button" id="t-guess" aria-pressed="false"></button>',
        '<button type="button" id="t-tests" aria-pressed="true"></button>',
        '<button type="button" id="z-out">−</button>',
        '<button type="button" id="z-in">+</button>',
        '<button type="button" id="z-fit"></button>',
        '<button type="button" id="theme"></button>',
        '<button type="button" id="lang"></button>',
        '</div>',
        '</header>',
        '<main>',
        '<div class="stage"><canvas id="stage" role="img" aria-label="Project map"></canvas></div>',
        '<aside id="panel" aria-live="polite"></aside>',
        '</main>',
        `<script type="application/json" id="map-data">${data}</script>`,
        `<script>${js}</script>`,
        '</body>',
        '</html>',
        '',
    ].join('\n');
}

/** The map a previous `code-graph map` wrote, or null when there is none. */
export function readMap(root: string): { meta: MapMeta; model: MapModel } | null {
    return readMapAt(path.join(root, MAP_DIR_REL));
}

function readMapAt(dir: string): { meta: MapMeta; model: MapModel } | null {
    const p = path.join(dir, 'map.json');
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
export function areaReport(m: MapModel, query: string): AreaReport | { refusal: string; candidates: string[] } {
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
        page: a.files.length >= AREA_PAGE_MIN_FILES ? path.posix.join('agents', 'map', 'areas', `${a.id}.md`) : null,
    };
}
