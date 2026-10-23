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
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { write_atomic } from '../_lib/fs_atomic.js';
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { buildFromRepo } from './build.js';
import { computeVerdict, graphState, NATIVE_CACHE_REL } from './detect.js';
import { buildMapModel, type FileRole, type MapModel } from './map_model.js';
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

/** The graph the map is drawn from: built when absent, updated when behind. */
async function loadOrBuildGraph(root: string, cachePath: string): Promise<{ graph: CodeGraph; built: boolean }> {
    const verdict = computeVerdict(root, cachePath).verdict;
    if (verdict === 'FRESH' && fs.existsSync(cachePath)) {
        return { graph: JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CodeGraph, built: false };
    }
    const { graph } = await buildFromRepo(root, cachePath, { update: verdict === 'STALE' });
    return { graph, built: true };
}

export async function buildMap(
    root: string,
    opts: { outDir?: string; cachePath?: string } = {},
): Promise<MapBuildResult> {
    const outDir = opts.outDir ?? path.join(root, MAP_DIR_REL);
    const cachePath = opts.cachePath ?? path.join(root, NATIVE_CACHE_REL);
    const { graph, built } = await loadOrBuildGraph(root, cachePath);
    const model = buildMapModel(graph, { entryFiles: declaredEntryFiles(root) });
    const meta: MapMeta = {
        title: `Map of ${path.basename(root)}`,
        commit: gitHead(root),
        state: graphState(root, cachePath),
        summary: '',
    };
    meta.summary =
        `${model.files.length} files · ${model.areas.length} areas · ` +
        `${model.analyses.trustedEdges} trusted links · guess share ${pct(model.analyses.guessShare)}`;

    const written: string[] = [];
    const write = (rel: string, content: string): void => {
        const p = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        write_atomic(p, content);
        written.push(rel);
    };
    const areasDir = path.join(outDir, 'areas');
    if (fs.existsSync(areasDir)) {
        for (const f of fs.readdirSync(areasDir)) if (f.endsWith('.md')) fs.rmSync(path.join(areasDir, f));
    }
    write('map.json', `${JSON.stringify({ meta, model })}\n`);
    write('MAP.md', renderMapMd(model, meta));
    for (const [i, a] of model.areas.entries()) {
        if (a.files.length >= AREA_PAGE_MIN_FILES) write(path.join('areas', `${a.id}.md`), renderAreaMd(model, i, meta));
    }
    write('index.html', renderHtml(model, meta));
    return { outDir, model, meta, written, graphBuilt: built };
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
    'infra',
    'isolated',
];

/** Escape a value for a Markdown table cell or inline text. */
function md(s: string): string {
    return s.replace(/[|`<>\\]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');
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

    const AREA_ROWS = 25;
    const areaRows = m.areas.slice(0, AREA_ROWS).map((a) => {
        const top = [...a.files]
            .sort((x, y) => (f[y]?.inFiles ?? 0) - (f[x]?.inFiles ?? 0) || x - y)
            .slice(0, 3)
            .map((x) => `\`${md(path.posix.basename(f[x]?.path ?? ''))}\``)
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
            ...(infra.length ? infra.map(([x]) => `- \`${md(x.path)}\` — used by ${x.inFiles} files`) : ['- none']),
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
                      ([s, t]) => `- \`${md(f[s]?.path ?? '')}\` → \`${md(f[t]?.path ?? '')}\``,
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
                ? m.analyses.cycles.map((c) => `- ${c.map((x) => `\`${md(f[x]?.path ?? '')}\``).join(' · ')}`)
                : ['- none']),
            '',
        ].join('\n'),
    ]);

    const entries = f.filter((x) => x.role === 'entry');
    sections.push([
        'Entry points',
        [
            '## Entry points',
            '',
            ...(entries.length
                ? entries.slice(0, m.thresholds.listCap).map((x) => `- \`${md(x.path)}\``)
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
                ? m.analyses.externals.map(([spec, n]) => `- \`${md(spec)}\` — imported by ${n} files`)
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
            return r ? `| \`${md(r.path)}\` | ${r.role} | ${r.inFiles} | ${r.outFiles} |` : '';
        }),
        ...(files.length > 60 ? [`| … ${files.length - 60} more | | | |`] : []),
        '',
        '## What this area depends on outside itself',
        '',
        ...(deps.length
            ? deps.map(([t, w]) => {
                  const r = f[t];
                  const where = r && r.area >= 0 ? m.areas[r.area]?.id ?? '' : r?.role ?? '';
                  return `- \`${md(r?.path ?? '')}\` (${where}) — ${w} link(s)`;
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
