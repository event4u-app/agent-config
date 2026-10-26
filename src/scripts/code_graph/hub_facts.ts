/**
 * Facts that only exist across projects (ADR-299, ADR-303): which registered
 * projects publish the same host port, run the same image, reach the same
 * external service, and which HTTP call in one project lands on a route of
 * another — and, from each project's lockfiles, which version of a package or
 * a runtime each project runs.
 *
 * Everything here is read from files — each project's Compose files and code
 * through the runtime and interfaces lane readers, its routes from its own graph
 * cache — and is names and paths only: no value of an environment variable, no
 * connection to anything. The result is written into the machine-wide hub and
 * nowhere else; a project map never carries another project's name.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { CodeGraph } from './types.js';
import { readDomainRules } from './domains.js';
import { graphHome } from './graph_home.js';
import { readInterfaces } from './lanes/interfaces/index.js';
import { type LaneOutput, spanHash, type Witness } from './lanes/lane_fact.js';
import { readRuntime } from './lanes/runtime/index.js';
import { readSystems } from './lanes/systems/index.js';

export interface HubProjectInput {
    id: string;
    name: string;
    root: string;
}

/** One project's use of a shared fact, with the file and line it was read from in that project. */
export interface HubUse {
    project: string;
    /** The service, image or client that uses it. */
    name: string;
    witness: Witness;
}

export interface HubPortCollision {
    /** `<host port>/<protocol>`. */
    port: string;
    uses: HubUse[];
}

export interface HubSharedImage {
    /** Image repository without tag or digest. */
    image: string;
    /** The references as written, per use. */
    refs: string[];
    uses: HubUse[];
}

export interface HubSharedService {
    /** `host:<name>` or `sdk:<package>` — never a URL with a path or a credential. */
    identity: string;
    kind: 'host' | 'sdk';
    uses: HubUse[];
}

export type HubUnmatched = 'dynamic_baseurl' | 'no_endpoint_match' | 'ambiguous';

export interface HubCall {
    project: string;
    /** The external service the interfaces reader bound the call to. */
    service: string;
    method: string;
    /** The path as the call writes it; empty when the call names none. */
    path: string;
    witness: Witness;
    match?: { project: string; route: string; witness: Witness };
    unmatched?: HubUnmatched;
    /** Routes tied at the best tier when the call is ambiguous. */
    candidates?: number;
}

/** One package or runtime two or more projects run, with each project's version. */
export interface HubVersionRow {
    /** `npm:<name>`, `composer:<name>` or `runtime:<name>` */
    subject: string;
    framework: boolean;
    /** the uses' `name` is the version as that project locks or declares it */
    uses: HubUse[];
    /** true when the projects do not all run the same version */
    differs: boolean;
}

/** A business domain two projects both declare by the same name in their `layers.yaml`. */
export interface HubSharedDomain {
    name: string;
    uses: HubUse[];
}

export interface HubFacts {
    ports: HubPortCollision[];
    /** absent in a hub written before domains */
    domains?: HubSharedDomain[];
    /** absent in a hub written before the systems lane */
    versions?: HubVersionRow[];
    images: HubSharedImage[];
    services: HubSharedService[];
    calls: HubCall[];
    /** Projects whose files could not be read, with the reason. */
    skipped: Array<{ project: string; reason: string }>;
}

export interface HubRoute {
    project: string;
    /** `GET`, `POST`, … or `ANY` when the route accepts every verb. */
    verbs: string[];
    path: string;
    witness: Witness;
}

export interface HubReaders {
    runtime(root: string): LaneOutput;
    interfaces(root: string): LaneOutput;
    routes(project: HubProjectInput): HubRoute[];
    /** absent in a reader set that predates the systems lane: no version rows */
    systems?(root: string): LaneOutput;
}

const PARAM = /\{[^}]*\}|\$\{[^}]*\}|<[^>]*>|:[A-Za-z_]\w*/g;
const PREFIX_SEGMENT = /^(?:api|v\d+)$/;

/**
 * One form for a path on either side of a call: query and fragment cut, every
 * parameter spelling (`{id}`, `:id`, `<int:id>`, `${id}`) as `{}`, lower case,
 * no trailing slash.
 */
export function normalisePath(p: string): string {
    let s = (p.split(/[?#]/)[0] ?? '').replace(PARAM, '{}').toLowerCase();
    s = s.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return s.startsWith('/') ? s : `/${s}`;
}

/** The path with its leading API prefixes (`/api`, `/v1`, …) removed — the alias tier. */
export function withoutPrefixes(normalised: string): string {
    const segs = normalised.split('/').filter(Boolean);
    while (segs.length && PREFIX_SEGMENT.test(segs[0] as string)) segs.shift();
    return `/${segs.join('/')}`;
}

/** A path made of nothing but parameters says nothing about where it goes. */
function isDynamic(normalised: string): boolean {
    return normalised.split('/').filter(Boolean).every((s) => s === '{}');
}

/**
 * The route of another project a call lands on, by path tier (exact form, then
 * prefix alias) and verb tier (the same verb, then a route that takes any verb).
 * Only a single route at the best tier that has any is a match.
 */
export function matchCall(
    call: { project: string; method: string; path: string },
    routes: readonly HubRoute[],
): { route: HubRoute } | { unmatched: HubUnmatched; candidates?: number } {
    const want = normalisePath(call.path);
    if (!call.path || isDynamic(want)) return { unmatched: 'dynamic_baseurl' };
    const verb = call.method.toUpperCase();
    const tiers = new Map<number, HubRoute[]>();
    for (const r of routes) {
        if (r.project === call.project) continue;
        const have = normalisePath(r.path);
        const pathTier = have === want ? 0 : withoutPrefixes(have) === withoutPrefixes(want) ? 1 : -1;
        if (pathTier < 0) continue;
        const verbTier = r.verbs.includes(verb) ? 0 : r.verbs.includes('ANY') || verb === '' ? 1 : -1;
        if (verbTier < 0) continue;
        const tier = pathTier * 2 + verbTier;
        tiers.set(tier, [...(tiers.get(tier) ?? []), r]);
    }
    const best = [...tiers.keys()].sort((a, b) => a - b)[0];
    if (best === undefined) return { unmatched: 'no_endpoint_match' };
    const hits = tiers.get(best) as HubRoute[];
    return hits.length === 1 ? { route: hits[0] as HubRoute } : { unmatched: 'ambiguous', candidates: hits.length };
}

const ANY_VERBS = new Set(['ANY', 'ALL', 'MATCH', '*']);

/** The route nodes of a project's graph cache; none when it has no graph. */
export function graphRoutes(project: HubProjectInput): HubRoute[] {
    const cache = graphHome(project.root).cachePath;
    if (!fs.existsSync(cache)) return [];
    let graph: CodeGraph;
    try {
        graph = JSON.parse(fs.readFileSync(cache, 'utf-8')) as CodeGraph;
    } catch {
        return [];
    }
    const lines = new Map<string, string[]>();
    const lineOf = (file: string, line: number): string => {
        if (!lines.has(file)) {
            try {
                lines.set(file, fs.readFileSync(path.join(project.root, file), 'utf-8').split('\n'));
            } catch {
                lines.set(file, []);
            }
        }
        return lines.get(file)?.[line - 1] ?? '';
    };
    const out: HubRoute[] = [];
    for (const n of graph.nodes) {
        if (n.kind !== 'route') continue;
        const m = /^(\S+)\s+(\S.*)$/.exec(n.label);
        if (!m) continue;
        const verbs = (m[1] as string).toUpperCase().split(/[|,]/).map((v) => (ANY_VERBS.has(v) ? 'ANY' : v));
        const line = n.source_location[0] ?? 1;
        out.push({ project: project.id, verbs, path: m[2] as string, witness: { file: n.source_file, line, hash: spanHash(lineOf(n.source_file, line)) } });
    }
    return out;
}

export const DEFAULT_READERS: HubReaders = {
    runtime: (root) => readRuntime(root, { codeEnv: false }),
    interfaces: (root) => readInterfaces(root),
    routes: graphRoutes,
    systems: (root) => readSystems(root),
};

function str(v: unknown): string | null {
    return typeof v === 'string' && v !== '' ? v : null;
}

function grouped<T extends { uses: HubUse[] }>(by: Map<string, T>): T[] {
    return [...by.entries()]
        .filter(([, v]) => new Set(v.uses.map((u) => u.project)).size >= 2)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);
}

/** The cross-project facts of the registered projects; `readers` is a seam for tests. */
export function hubFacts(projects: readonly HubProjectInput[], readers: HubReaders = DEFAULT_READERS): HubFacts {
    const ports = new Map<string, HubPortCollision>();
    const images = new Map<string, HubSharedImage>();
    const services = new Map<string, HubSharedService>();
    const versions = new Map<string, HubVersionRow>();
    const domains = new Map<string, HubSharedDomain>();
    const calls: HubCall[] = [];
    const routes: HubRoute[] = [];
    const skipped: HubFacts['skipped'] = [];
    for (const p of [...projects].sort((a, b) => a.id.localeCompare(b.id))) {
        if (!fs.existsSync(p.root)) {
            skipped.push({ project: p.id, reason: 'root is gone' });
            continue;
        }
        routes.push(...readers.routes(p));
        let rt: LaneOutput;
        let itf: LaneOutput;
        try {
            rt = readers.runtime(p.root);
            itf = readers.interfaces(p.root);
        } catch (e) {
            skipped.push({ project: p.id, reason: `unreadable: ${(e as Error).message.split('\n')[0]}` });
            continue;
        }
        for (const f of rt.facts) {
            if (f.kind === 'port' && f.attrs['is_published'] === true) {
                const key = `${String(f.attrs['published'])}/${String(f.attrs['protocol'] ?? 'tcp')}`;
                const row = ports.get(key) ?? { port: key, uses: [] };
                row.uses.push({ project: p.id, name: str(f.attrs['service']) ?? f.name, witness: f.witness });
                ports.set(key, row);
            }
            const repo = f.kind === 'image' ? str(f.attrs['repo']) : null;
            if (repo !== null && f.attrs['redacted'] !== true) {
                const row = images.get(repo) ?? { image: repo, refs: [], uses: [] };
                row.uses.push({ project: p.id, name: f.name, witness: f.witness });
                if (!row.refs.includes(f.name)) row.refs.push(f.name);
                images.set(repo, row);
            }
        }
        // Only a declared name links two projects: structure and proposals never do.
        const layersFile = path.join(graphHome(p.root).mapDir, 'layers.yaml');
        const declared = readDomainRules(layersFile);
        if (declared) {
            let text = '';
            try {
                text = fs.readFileSync(layersFile, 'utf-8');
            } catch {
                text = '';
            }
            const rel = path.relative(p.root, layersFile).split(path.sep).join('/');
            for (const d of declared.domains) {
                const lines = text.split('\n');
                const i = lines.findIndex((l) => new RegExp(`name:\\s*["']?${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`).test(l));
                const line = i >= 0 ? i + 1 : 1;
                const row = domains.get(d.name) ?? { name: d.name, uses: [] };
                row.uses.push({ project: p.id, name: d.name, witness: { file: rel, line, hash: spanHash(lines[line - 1] ?? '') } });
                domains.set(d.name, row);
            }
        }
        let sys: LaneOutput | null = null;
        try {
            sys = readers.systems ? readers.systems(p.root) : null;
        } catch {
            sys = null;
        }
        for (const f of sys?.facts ?? []) {
            const direct = f.kind === 'package' && f.attrs['direct'] === true;
            if (!direct && f.kind !== 'runtime') continue;
            const subject = f.kind === 'runtime' ? `runtime:${f.name}` : `${String(f.attrs['ecosystem'])}:${String(f.attrs['name'])}`;
            const version = f.kind === 'runtime' ? (Array.isArray(f.attrs['values']) ? (f.attrs['values'] as string[]).join(' / ') : '') : String(f.attrs['version'] ?? '');
            const row = versions.get(subject) ?? { subject, framework: f.attrs['framework'] === true, uses: [], differs: false };
            if (!row.uses.some((u) => u.project === p.id && u.name === version)) row.uses.push({ project: p.id, name: version, witness: f.witness });
            versions.set(subject, row);
        }
        const ops = new Map<string, { service: string; method: string; path: string; protocol: string }>();
        for (const f of itf.facts) {
            if (f.kind === 'operation') {
                ops.set(f.id, { service: String(f.attrs['service'] ?? ''), method: String(f.attrs['method'] ?? ''), path: String(f.attrs['path'] ?? ''), protocol: String(f.attrs['protocol'] ?? '') });
            }
            if (f.kind !== 'service' || f.attrs['guess'] === true) continue;
            const ids = [
                ...(Array.isArray(f.attrs['hosts']) ? f.attrs['hosts'] : []).map((h) => `host:${String(h).toLowerCase()}`),
                ...(str(f.attrs['sdk_package']) ? [`sdk:${String(f.attrs['sdk_package'])}`] : []),
            ];
            for (const id of new Set(ids)) {
                const row = services.get(id) ?? { identity: id, kind: id.startsWith('sdk:') ? 'sdk' : 'host', uses: [] };
                row.uses.push({ project: p.id, name: f.name, witness: f.witness });
                services.set(id, row);
            }
        }
        for (const r of itf.relations) {
            if (r.relation !== 'calls-out' || r.attrs['protocol'] !== 'rest') continue;
            const op = ops.get(r.to);
            calls.push({
                project: p.id,
                service: op?.service ?? r.to,
                method: String(r.attrs['method'] ?? op?.method ?? '').toUpperCase(),
                path: String(r.attrs['path'] ?? op?.path ?? ''),
                witness: r.witness,
            });
        }
    }
    for (const c of calls) {
        const m = matchCall(c, routes);
        if ('route' in m) c.match = { project: m.route.project, route: `${m.route.verbs.join('|')} ${m.route.path}`, witness: m.route.witness };
        else {
            c.unmatched = m.unmatched;
            if (m.candidates !== undefined) c.candidates = m.candidates;
        }
    }
    calls.sort((a, b) => a.project.localeCompare(b.project) || a.witness.file.localeCompare(b.witness.file) || a.witness.line - b.witness.line);
    const versionRows = grouped(versions).map((r) => ({ ...r, differs: new Set(r.uses.map((u) => u.name)).size > 1 }));
    versionRows.sort((a, b) => Number(b.framework) - Number(a.framework) || Number(b.differs) - Number(a.differs) || a.subject.localeCompare(b.subject));
    return { ports: grouped(ports), versions: versionRows, domains: grouped(domains), images: grouped(images), services: grouped(services), calls, skipped };
}
