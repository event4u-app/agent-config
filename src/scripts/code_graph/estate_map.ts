/**
 * `code-graph map --estate` — the machine-wide hub (ADR-299, ADR-303).
 *
 * One folder in the user-global home, laid out like a project's `agents/map/`:
 *
 *   <user-global>/map/index.html          the shared Knowledge Map shell, with the Projects area only
 *   <user-global>/map/manifest.json       generation and freshness of the hub
 *   <user-global>/map/projects/hub.json   the projects, their links and the cross-project facts
 *   <user-global>/map/<project id>/       a project's map: its graph home, or a mirror of its agents/map/
 *   <user-global>/map/.build/             estate index, staging — never part of a page
 *
 * The page names client projects, so it is written only outside every git work
 * tree, and the facts it holds are never written into a project map.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

import { enclosingWorkTree } from '../_lib/git_common_dir.js';
import { write_atomic } from '../_lib/fs_atomic.js';
import { type ProjectEntry, readRegistry } from '../_lib/project_registry.js';
import { openEstate, type XEdge } from './estate_index.js';
import { graphHome, hasProjectHome, hubDir } from './graph_home.js';
import { type HubFacts, hubFacts, type HubProjectInput, type HubReaders, DEFAULT_READERS } from './hub_facts.js';
import { AREA_FOLDERS, hasMap, type MapMeta, type MapShell, renderPage, swapIn } from './map.js';
import { buildMapModel } from './map_model.js';
import { verifyMap } from './map_verify.js';
import { SCHEMA_VERSION, type CodeGraph } from './types.js';

export interface HubProject {
    id: string;
    name: string;
    indexed: boolean;
    indexedAt?: string;
    /** Hub-relative page of the project's map; null when there is none to open. */
    page: string | null;
    pageReason?: string;
}

export interface HubPayload extends HubFacts {
    reader: string;
    completeness: 'complete' | 'partial';
    empty?: string;
    findings: [];
    projects: HubProject[];
    edges: XEdge[];
    /** Why there are no links: the estate index is off or empty. */
    edgesReason?: string;
}

/** The hub folder. The name stays for callers that knew the estate map. */
export function estateMapDir(): string {
    return hubDir();
}

const EMPTY_GRAPH: CodeGraph = {
    schema_version: SCHEMA_VERSION,
    source_checksum: '',
    languages: [],
    grammar_abi: 0,
    edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 },
    suppressed_edge_counts: { dynamic_no_candidate: 0 },
    nodes: [],
    edges: [],
};

/** What a project-home map consists of; `.build/` never leaves the project. */
const MIRRORED = ['index.html', 'MAP.md', 'manifest.json', 'code', ...AREA_FOLDERS] as const;

interface Plan {
    payload: HubPayload;
    /** Hub-relative directory → the project map folder it mirrors. */
    mirrors: Map<string, string>;
}

/** The page of a registered project the hub can open: its graph home in the hub, or a mirror of its agents/map/. */
function pageOf(id: string, e: ProjectEntry, out: string, mirrors: Map<string, string>): Pick<HubProject, 'page' | 'pageReason'> {
    if (!fs.existsSync(e.root)) return { page: null, pageReason: 'the project root is gone' };
    if (hasProjectHome(e.root)) {
        const mapDir = graphHome(e.root).mapDir;
        if (!hasMap(mapDir) || !fs.existsSync(path.join(mapDir, 'index.html'))) return { page: null, pageReason: 'no map drawn yet — `code-graph map` in the project' };
        mirrors.set(id, mapDir);
        return { page: `${id}/index.html` };
    }
    for (const dir of [...Object.keys(e.homes), ...(e.graph_home ? [e.graph_home] : [])]) {
        const rel = path.relative(out, dir);
        if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) continue;
        if (fs.existsSync(path.join(dir, 'index.html'))) return { page: `${rel}/index.html` };
    }
    return { page: null, pageReason: 'no map drawn yet — `code-graph map --root <path>`' };
}

export function planHub(out: string = hubDir(), readers: HubReaders = DEFAULT_READERS): Plan {
    const reg = readRegistry();
    const db = openEstate();
    let indexed = new Map<string, { name: string; indexed_at: string }>();
    let edges: XEdge[] = [];
    try {
        if (db) {
            indexed = new Map(db.projects().map((p) => [p.id, { name: p.name, indexed_at: p.indexed_at }]));
            edges = db.xedges();
        }
    } finally {
        db?.close();
    }
    const mirrors = new Map<string, string>();
    const projects: HubProject[] = Object.entries(reg.projects)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, e]) => {
            const ix = indexed.get(id);
            return {
                id,
                name: ix?.name ?? path.basename(e.root),
                indexed: !!ix,
                ...(ix ? { indexedAt: ix.indexed_at } : {}),
                ...pageOf(id, e, out, mirrors),
            };
        });
    const inputs: HubProjectInput[] = Object.entries(reg.projects).map(([id, e]) => ({ id, name: projects.find((p) => p.id === id)?.name ?? id, root: e.root }));
    const facts = hubFacts(inputs, readers);
    const payload: HubPayload = {
        reader: 'hub',
        completeness: facts.skipped.length ? 'partial' : 'complete',
        findings: [],
        projects,
        edges,
        ...facts,
    };
    if (!projects.length) payload.empty = 'no project is registered on this machine yet';
    if (!edges.length) payload.edgesReason = db ? 'the estate index holds no link between the registered projects' : 'the estate index is off — `code-graph projects index on`, then build or refresh each project';
    return { payload, mirrors };
}

export function renderHub(payload: HubPayload): string {
    const meta: MapMeta = { title: 'Projects hub', commit: '', state: 'fresh', summary: `${payload.projects.length} registered projects` };
    const shell: MapShell = { routes: ['projects'], home: 'projects', hub: { projects: payload.projects.length, indexed: payload.projects.filter((p) => p.indexed).length } };
    return renderPage(buildMapModel(EMPTY_GRAPH), meta, { projects: payload }, shell);
}

function hubManifest(payload: HubPayload): string {
    const facts = payload.ports.length + payload.images.length + payload.services.length + payload.calls.length;
    return `${JSON.stringify(
        {
            schema: 1,
            kind: 'hub',
            areas: {
                projects: {
                    path: 'projects/hub.json',
                    source: payload.reader,
                    freshness: payload.empty !== undefined ? 'empty' : payload.completeness === 'complete' ? 'fresh' : 'incomplete',
                    completeness: payload.completeness,
                    facts,
                    projects: payload.projects.length,
                    ...(payload.empty !== undefined ? { reason: payload.empty } : payload.skipped.length ? { reason: `${payload.skipped.length} project(s) could not be read` } : {}),
                },
            },
        },
        null,
        2,
    )}\n`;
}

/** Write the hub into `out`, one generation at a time; returns the page. */
export function writeHub(out: string, plan: Plan): string {
    const build = path.join(out, '.build');
    fs.mkdirSync(build, { recursive: true });
    const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`;
    const next = path.join(build, `.hub-next-${suffix}`);
    const prev = path.join(build, `.hub-prev-${suffix}`);
    try {
        const write = (rel: string, content: string): void => {
            const p = path.join(next, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            write_atomic(p, content);
        };
        write(path.join('projects', 'hub.json'), `${JSON.stringify(plan.payload)}\n`);
        write('manifest.json', hubManifest(plan.payload));
        for (const [id, mapDir] of plan.mirrors) {
            for (const entry of MIRRORED) {
                const from = path.join(mapDir, entry);
                if (fs.existsSync(from)) fs.cpSync(from, path.join(next, id, entry), { recursive: true });
            }
        }
        write('index.html', renderHub(plan.payload));
        swapIn(next, out, prev);
    } finally {
        fs.rmSync(next, { recursive: true, force: true });
    }
    return path.join(out, 'index.html');
}

export async function estateMapMain(argv: string[]): Promise<number> {
    const i = argv.indexOf('--out');
    const outDir = i >= 0 && i + 1 < argv.length ? path.resolve(argv[i + 1] as string) : estateMapDir();
    const tree = enclosingWorkTree(outDir);
    if (tree !== null) {
        process.stderr.write(`code-graph: refusing to write the estate map inside a git work tree (${tree}): it names client projects\n`);
        return 1;
    }
    const plan = planHub(outDir);
    const page = writeHub(outDir, plan);
    const p = plan.payload;
    process.stdout.write(
        `✅  hub — ${p.projects.length} projects · ${p.edges.length} links · ${p.calls.filter((c) => c.match).length}/${p.calls.length} calls matched · ` +
            `${p.ports.length} port collision(s) · ${p.images.length} shared image(s) · ${p.services.length} shared service(s)\n    wrote ${page}\n`,
    );
    if (argv.includes('--no-verify')) return 0;
    const check = await verifyMap(page, { hash: '#/projects' });
    process.stdout.write(`    render check: ${check.verification}${check.reason ? ` — ${check.reason}` : ''}\n`);
    return check.verification === 'failed' ? 1 : 0;
}
