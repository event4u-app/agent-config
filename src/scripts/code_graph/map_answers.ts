/**
 * The risk questions a map answers on top of its structure (road-to-a-map-that-answers):
 * size and language, git history, blast numbers, knowledge per file, layers,
 * violations, hotspots, health with its formula, legend and pin.
 *
 * Two halves. The pure half (`blastOf`, `knowledgeOf`, `callCounts`, `finishAnswers`)
 * works on the graph and the model only. The IO half (`readFileFacts`, `readGitHistory`,
 * `readLayerRules`) is called by the map writer, which owns every read of the tree.
 * The viewer computes none of these values; it only walks shipped edges for the
 * blast membership (decision D3).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import type { FileRole, MapModel } from './map_model.js';
import { EXT_LANG } from './types.js';

/** Roles a change to code reaches; tests and docs are selected, not broken. */
export const BLAST_SCOPE_ROLES: ReadonlySet<FileRole> = new Set(['code', 'entry', 'view', 'infra', 'isolated']);
export const BLAST_DEPTH = 3;
export const GIT_WINDOW_DAYS = 180;
/** Bus-factor finding: one author holds more than this share of at least this many commits. */
export const SOLE_OWNER_SHARE = 0.8;
export const SOLE_OWNER_MIN_CHURN = 3;
const OWNERS_TOP = 3;
const HOTSPOTS_TOP = 20;
const KNOWLEDGE_CAP = 40;
const LAYER_VIOLATIONS_CAP = 50;

export type BlastLevel = 'critical' | 'high' | 'medium' | 'low';

export interface BlastRecord {
    /** Scope files with a trusted edge into this file. */
    direct: number;
    /** Scope files reaching it in two or three hops, not counted in `direct`. */
    transitive: number;
    score: number;
    share: number;
    level: BlastLevel;
}

export type KnowledgeKind =
    | 'contract'
    | 'adr'
    | 'roadmap-active'
    | 'roadmap-later'
    | 'roadmap-planned'
    | 'roadmap-archived'
    | 'evidence'
    | 'draft'
    | 'doc';

export interface Violation {
    kind: 'cycle' | 'layer';
    severity: 'high' | 'medium';
    files: number[];
    /** Layer names, `from → to`, for a layer breach. */
    layers?: [string, string];
}

export interface HealthPart {
    value: number;
    weight: number;
    points: number;
}

export interface MapHealth {
    grade?: 'A' | 'B' | 'C' | 'D' | 'F';
    score?: number;
    parts: { dead?: HealthPart; cycles: HealthPart; guesses: HealthPart; hotspots?: HealthPart };
    formula: string;
}

export interface LegendEntry {
    key: string;
    label: string;
    scale: 'categorical' | 'sequential' | 'depth';
    unit: string;
    /** False when the field it needs is absent from this map; the reason says which. */
    available: boolean;
    reason?: string;
}

export interface MapPin {
    commit: string;
    date: string;
    freshness: string;
    generation: string;
}

/** Absolute, so the part measures the tree and not its own percentile cut. */
export const HOTSPOT_MIN_CHURN = 20;
export const HOTSPOT_MIN_LOC = 500;

export const HEALTH_FORMULA =
    'Score = sum of four parts, 25 points each, each part loses its points linearly up to a limit: ' +
    'dead = 25 × (1 − min(1, dead code files / scope files ÷ 0.20)); ' +
    'cycles = 25 × (1 − min(1, file cycles ÷ (2 % of scope files))); ' +
    'guesses = 25 × (1 − min(1, guessed edge share ÷ 0.30)); ' +
    'hotspots = 25 × (1 − min(1, hotspot files / scope files ÷ 0.05)), a hotspot being a code file with at least ' + HOTSPOT_MIN_CHURN + ' commits in the git window and at least ' + HOTSPOT_MIN_LOC + ' lines. ' +
    'Grade A ≥ 80, B ≥ 60, C ≥ 40, D ≥ 20, else F — withheld while any part is missing.';

export function blastLevel(share: number): BlastLevel {
    if (share >= 0.5) return 'critical';
    if (share >= 0.25) return 'high';
    if (share >= 0.1) return 'medium';
    return 'low';
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Blast numbers for every scope file: a breadth-first walk over trusted
 * in-edges between scope files, to {@link BLAST_DEPTH}.
 */
export function blastOf(
    roles: readonly FileRole[],
    edges: ReadonlyArray<readonly [number, number, number]>,
): Array<BlastRecord | undefined> {
    const inScope = (i: number): boolean => BLAST_SCOPE_ROLES.has(roles[i] as FileRole);
    const into = new Map<number, number[]>();
    for (const [s, t] of edges) {
        if (!inScope(s) || !inScope(t)) continue;
        const list = into.get(t) ?? [];
        list.push(s);
        into.set(t, list);
    }
    const scopeCount = roles.filter((_, i) => inScope(i)).length;
    return roles.map((_, start) => {
        if (!inScope(start)) return undefined;
        const seen = new Set<number>([start]);
        let frontier = [start];
        let direct = 0;
        let transitive = 0;
        for (let depth = 1; depth <= BLAST_DEPTH && frontier.length; depth++) {
            const next: number[] = [];
            for (const f of frontier) {
                for (const s of into.get(f) ?? []) {
                    if (seen.has(s)) continue;
                    seen.add(s);
                    next.push(s);
                    if (depth === 1) direct++;
                    else transitive++;
                }
            }
            frontier = next;
        }
        const share = scopeCount === 0 ? 0 : round3((direct + transitive) / scopeCount);
        return { direct, transitive, score: direct + 0.5 * transitive, share, level: blastLevel(share) };
    });
}

/** The knowledge a path holds, read from where it sits; null for a path that is not knowledge. */
export function knowledgeKind(p: string, role: FileRole): KnowledgeKind | null {
    if (role !== 'doc') return null;
    if (/^agents\/tmp(\.old)?\//.test(p)) return 'draft';
    if (/^agents\/roadmaps\/archive\//.test(p) || /^agents\/roadmaps\/skipped\//.test(p)) return 'roadmap-archived';
    if (/^agents\/roadmaps\/later\//.test(p)) return 'roadmap-later';
    if (/^agents\/roadmaps\/stubs\//.test(p)) return 'roadmap-planned';
    if (/^agents\/roadmaps\/[^/]+\.md$/.test(p)) return 'roadmap-active';
    if (/^agents\/evidence\//.test(p)) return 'evidence';
    if (/^docs\/contracts\//.test(p)) return 'contract';
    if (/^docs\/(decisions|adr)\//.test(p)) return 'adr';
    return role === 'doc' ? 'doc' : null;
}

export interface KnowledgeList {
    files: number[];
    total: number;
    /** Set when drafts outnumber contracts: an agent in doubt reads the draft, not the contract. */
    finding?: { drafts: number; contracts: number };
}

/** Basename of a roadmap that also sits in an inbox folder: two copies, one of them stale. */
export function duplicateBasenames(paths: readonly string[]): Set<string> {
    const inRoadmaps = new Set<string>();
    const inInbox = new Set<string>();
    for (const p of paths) {
        const b = path.posix.basename(p);
        if (!b.startsWith('road-to-')) continue;
        if (p.startsWith('agents/roadmaps/')) inRoadmaps.add(b);
        else if (/^agents\/tmp(\.old)?\//.test(p)) inInbox.add(b);
    }
    return new Set([...inRoadmaps].filter((b) => inInbox.has(b)));
}

/**
 * Per file, the knowledge files linked to it by any edge (trusted or guessed,
 * either direction), knowledge first by kind rank then by path. Knowledge files
 * themselves carry no list.
 */
export function knowledgeOf(
    kinds: ReadonlyArray<KnowledgeKind | null>,
    paths: readonly string[],
    edges: ReadonlyArray<readonly [number, number, number]>,
    guessEdges: ReadonlyArray<readonly [number, number, number]>,
): Array<KnowledgeList | undefined> {
    const links = new Map<number, Set<number>>();
    const add = (code: number, k: number): void => {
        const set = links.get(code) ?? new Set<number>();
        set.add(k);
        links.set(code, set);
    };
    for (const [s, t] of [...edges, ...guessEdges]) {
        const ks = kinds[s] ?? null;
        const kt = kinds[t] ?? null;
        if (ks !== null && kt === null) add(t, s);
        else if (kt !== null && ks === null) add(s, t);
    }
    const rank: Record<KnowledgeKind, number> = {
        contract: 0,
        adr: 1,
        'roadmap-active': 2,
        'roadmap-planned': 3,
        'roadmap-later': 4,
        'roadmap-archived': 5,
        evidence: 6,
        draft: 7,
        doc: 8,
    };
    return paths.map((_, i) => {
        const set = links.get(i);
        if (!set || set.size === 0) return undefined;
        const sorted = [...set].sort(
            (a, b) =>
                rank[kinds[a] as KnowledgeKind] - rank[kinds[b] as KnowledgeKind] ||
                ((paths[a] as string) < (paths[b] as string) ? -1 : 1),
        );
        const drafts = sorted.filter((k) => kinds[k] === 'draft').length;
        const contracts = sorted.filter((k) => kinds[k] === 'contract' || kinds[k] === 'adr').length;
        return {
            files: sorted.slice(0, KNOWLEDGE_CAP),
            total: sorted.length,
            ...(drafts > contracts ? { finding: { drafts, contracts } } : {}),
        };
    });
}

/** Call counts per symbol node id: `[internal, external]` over accepted calls/uses edges. */
export function callCounts(
    edges: ReadonlyArray<{ source: string; target: string; relation: string; accepted: boolean }>,
    fileOfNode: ReadonlyMap<string, string>,
): Map<string, [number, number]> {
    const out = new Map<string, [number, number]>();
    for (const e of edges) {
        if (!e.accepted || (e.relation !== 'calls' && e.relation !== 'uses')) continue;
        const tf = fileOfNode.get(e.target);
        const sf = fileOfNode.get(e.source);
        if (tf === undefined || sf === undefined) continue;
        const c = out.get(e.target) ?? [0, 0];
        if (sf === tf) c[0]++;
        else c[1]++;
        out.set(e.target, c);
    }
    return out;
}


const EXTRA_LANG: Readonly<Record<string, string>> = {
    '.md': 'markdown',
    '.mdx': 'markdown',
    '.json': 'json',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.css': 'css',
    '.scss': 'css',
    '.html': 'html',
    '.sh': 'shell',
    '.xml': 'xml',
};

export function langOf(p: string): string {
    const ext = path.posix.extname(p).toLowerCase();
    return EXT_LANG[ext] ?? EXTRA_LANG[ext] ?? 'other';
}

/** Lines per file; a file that cannot be read, or holds a NUL byte, gets no count. */
export function readFileFacts(root: string, paths: readonly string[]): Array<{ loc?: number; lang: string }> {
    return paths.map((p) => {
        const lang = langOf(p);
        try {
            const buf = fs.readFileSync(path.join(root, p));
            if (buf.includes(0)) return { lang };
            if (buf.length === 0) return { loc: 0, lang };
            let lines = 0;
            for (const b of buf) if (b === 10) lines++;
            if (buf[buf.length - 1] !== 10) lines++;
            return { loc: lines, lang };
        } catch {
            return { lang };
        }
    });
}

export interface GitFacts {
    churn: number;
    owners: Array<[string, number]>;
    lastChange: string;
}

/**
 * One `git log` pass over the window ending at HEAD's commit date — anchored on
 * the commit, not the clock, so two builds of one commit write the same bytes.
 * Author names only: an e-mail is identifying and the page needs no address.
 * Returns null outside a git repository.
 */
export function readGitHistory(root: string, days = GIT_WINDOW_DAYS): Map<string, GitFacts> | null {
    const git = (args: string[]): string =>
        execFileSync('git', ['-C', root, ...args], {
            env: hardenedSpawnEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            maxBuffer: 512 * 1024 * 1024,
        });
    let head: string;
    try {
        head = git(['log', '-1', '--format=%cI']).trim();
    } catch {
        return null;
    }
    if (!head) return null;
    // A shallow clone holds a commit or two: churn read from it would look healthy, not unknown.
    try {
        if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') return null;
    } catch {
        return null;
    }
    const since = new Date(new Date(head).getTime() - days * 86_400_000).toISOString();
    let out: string;
    try {
        // `--relative` makes paths root-relative when root is a package inside a larger repository.
        out = git(['-c', 'core.quotePath=false', 'log', `--since=${since}`, '--no-merges', '--no-renames', '--relative', '--name-only', '--format=%x1e%aN%x1f%cs', '--', '.']);
    } catch {
        return null;
    }
    const acc = new Map<string, { churn: number; authors: Map<string, number>; last: string }>();
    for (const rec of out.split('\x1e')) {
        if (!rec.trim()) continue;
        const [header, ...files] = rec.split('\n');
        const [rawAuthor = '', date = ''] = (header ?? '').split('\x1f');
        // A name configured as an address is an address: it never reaches the map.
        const author = rawAuthor.includes('@') ? '(name withheld)' : rawAuthor;
        for (const f of files) {
            const p = f.trim();
            if (!p) continue;
            const a = acc.get(p) ?? { churn: 0, authors: new Map<string, number>(), last: '' };
            a.churn++;
            a.authors.set(author, (a.authors.get(author) ?? 0) + 1);
            if (date > a.last) a.last = date;
            acc.set(p, a);
        }
    }
    const result = new Map<string, GitFacts>();
    for (const [p, a] of acc) {
        const owners = [...a.authors.entries()]
            .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
            .slice(0, OWNERS_TOP)
            .map(([name, n]) => [name, round3(n / a.churn)] as [string, number]);
        result.set(p, { churn: a.churn, owners, lastChange: a.last });
    }
    return result;
}

export interface LayerRules {
    layers: Array<{ name: string; match: RegExp[] }>;
    allow: Map<string, Set<string>>;
}

/** `**` any depth, `*` within one segment, `?` one character. */
export function globToRegExp(glob: string): RegExp {
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i] as string;
        if (c === '*') {
            if (glob[i + 1] === '*') {
                re += '.*';
                i++;
                if (glob[i + 1] === '/') i++;
            } else re += '[^/]*';
        } else if (c === '?') re += '[^/]';
        else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
}

/**
 * `layers.yaml` beside the map: `layers: [{name, paths: [glob]}]` and
 * `allow: {layer: [layer it may depend on]}`. A layer may always depend on
 * itself. Absent or unreadable → null, and no file gets a layer (decision D2).
 */
export function readLayerRules(file: string): LayerRules | null {
    let doc: unknown;
    try {
        doc = parseYaml(fs.readFileSync(file, 'utf-8'));
    } catch {
        return null;
    }
    const d = doc as { layers?: Array<{ name?: unknown; paths?: unknown }>; allow?: Record<string, unknown> } | null;
    if (!d || !Array.isArray(d.layers)) return null;
    const layers = d.layers
        .filter((l) => typeof l?.name === 'string' && Array.isArray(l.paths))
        .map((l) => ({ name: l.name as string, match: (l.paths as unknown[]).filter((g): g is string => typeof g === 'string').map(globToRegExp) }));
    const allow = new Map<string, Set<string>>();
    for (const [k, v] of Object.entries(d.allow ?? {})) allow.set(k, new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []));
    return layers.length ? { layers, allow } : null;
}

export function layerOf(p: string, rules: LayerRules): string | undefined {
    return rules.layers.find((l) => l.match.some((r) => r.test(p)))?.name;
}


function part(value: number, limit: number): HealthPart {
    const points = Math.round(25 * (1 - Math.min(1, limit === 0 ? 1 : value / limit)) * 10) / 10;
    return { value: round3(value), weight: 25, points };
}

function gradeOf(score: number): NonNullable<MapHealth['grade']> {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'F';
}

/**
 * The repo-level answers, from the per-file fields the writer has already set:
 * languages, violations, hotspots, health, legend. Pure; same model in, same out.
 */
export function finishAnswers(m: MapModel, rules: LayerRules | null): void {
    const scope = m.files.map((f, i) => (BLAST_SCOPE_ROLES.has(f.role) ? i : -1)).filter((i) => i >= 0);

    const langs = new Map<string, [number, number]>();
    for (const f of m.files) {
        if (!f.lang) continue;
        const v = langs.get(f.lang) ?? [0, 0];
        v[0]++;
        v[1] += f.loc ?? 0;
        langs.set(f.lang, v);
    }
    m.languages = [...langs.entries()]
        .map(([lang, [files, loc]]) => [lang, files, loc] as [string, number, number])
        .sort((a, b) => b[2] - a[2] || b[1] - a[1] || (a[0] < b[0] ? -1 : 1));

    const violations: Violation[] = m.analyses.cycles.map((c, k) => ({
        kind: 'cycle' as const,
        severity: (m.analyses.cycleSizes?.[k] ?? c.length) >= 5 ? ('high' as const) : ('medium' as const),
        files: c,
    }));
    let layerBreaches = 0;
    if (rules) {
        for (const [s, t] of m.edges) {
            const a = m.files[s]?.layer;
            const b = m.files[t]?.layer;
            if (!a || !b || a === b || m.files[s]?.role === 'test') continue;
            if (rules.allow.get(a)?.has(b)) continue;
            layerBreaches++;
            if (violations.filter((v) => v.kind === 'layer').length < LAYER_VIOLATIONS_CAP) {
                violations.push({ kind: 'layer', severity: 'high', files: [s, t], layers: [a, b] });
            }
        }
    }
    m.violations = violations;
    if (rules) m.analyses.layerBreaches = layerBreaches;
    else delete m.analyses.layerBreaches;

    const hasChurn = m.files.some((f) => f.churn !== undefined);
    if (hasChurn) {
        m.hotspots = scope
            .map((i) => m.files[i])
            .map((f, k) => ({ i: scope[k] as number, churn: f?.churn ?? 0, loc: f?.loc ?? 0 }))
            .filter((h) => h.churn > 0 && h.loc > 0)
            .map((h) => [h.i, h.churn, h.loc, h.churn * h.loc] as [number, number, number, number])
            .sort((a, b) => b[3] - a[3] || a[0] - b[0])
            .slice(0, HOTSPOTS_TOP);
    }

    const scopeN = Math.max(1, scope.length);
    const deadKnown = m.analyses.deadFiles !== undefined;
    const hotspotFiles = hasChurn
        ? scope.filter((i) => (m.files[i]?.churn ?? 0) >= HOTSPOT_MIN_CHURN && (m.files[i]?.loc ?? 0) >= HOTSPOT_MIN_LOC).length
        : 0;
    const parts: MapHealth['parts'] = {
        cycles: part(m.analyses.cyclesTotal, 0.02 * scopeN),
        guesses: part(m.analyses.guessShare, 0.3),
        ...(deadKnown ? { dead: part((m.analyses.deadFiles as number) / scopeN, 0.2) } : {}),
        ...(hasChurn ? { hotspots: part(hotspotFiles / scopeN, 0.05) } : {}),
    };
    const health: MapHealth = { parts, formula: HEALTH_FORMULA };
    if (parts.dead && parts.hotspots) {
        const score = Math.round((parts.dead.points + parts.cycles.points + parts.guesses.points + parts.hotspots.points) * 10) / 10;
        health.score = score;
        health.grade = gradeOf(score);
    }
    m.health = health;
    m.blastDepth = BLAST_DEPTH;
    m.gitWindowDays = GIT_WINDOW_DAYS;

    const has = (k: 'loc' | 'churn' | 'layer'): boolean => m.files.some((f) => f[k] !== undefined);
    m.legend = [
        { key: 'blast', label: 'Blast', scale: 'depth', unit: 'hops', available: true },
        { key: 'area', label: 'Area', scale: 'categorical', unit: 'community', available: true },
        { key: 'tests', label: 'Test share', scale: 'sequential', unit: 'share', available: true },
        { key: 'role', label: 'Role', scale: 'categorical', unit: 'role', available: true },
        { key: 'folder', label: 'Folder', scale: 'categorical', unit: 'directory', available: true },
        has('layer')
            ? { key: 'layer', label: 'Layer', scale: 'categorical', unit: 'layer', available: true }
            : { key: 'layer', label: 'Layer', scale: 'categorical', unit: 'layer', available: false, reason: 'needs agents/map/layers.yaml' },
        has('churn')
            ? { key: 'churn', label: 'Churn', scale: 'sequential', unit: `commits in ${GIT_WINDOW_DAYS} days`, available: true }
            : { key: 'churn', label: 'Churn', scale: 'sequential', unit: 'commits', available: false, reason: 'needs git history' },
        { key: 'complexity', label: 'Complexity', scale: 'sequential', unit: 'branches', available: false, reason: 'needs complexity per symbol' },
        has('loc')
            ? { key: 'size', label: 'Lines', scale: 'sequential', unit: 'lines', available: true }
            : { key: 'size', label: 'Lines', scale: 'sequential', unit: 'lines', available: false, reason: 'needs loc per file' },
    ];
}

/**
 * Which scope files a change to `start` reaches, by depth, over the model's
 * trusted edges — the walk the viewer runs, for an agent. Index 0 is `start`.
 */
export function blastMembers(m: MapModel, start: number): number[][] {
    const into = new Map<number, number[]>();
    for (const [s, t] of m.edges) {
        const list = into.get(t) ?? [];
        list.push(s);
        into.set(t, list);
    }
    const inScope = (i: number): boolean => BLAST_SCOPE_ROLES.has((m.files[i] as MapModel['files'][number]).role);
    const seen = new Set<number>([start]);
    const byDepth: number[][] = [[start]];
    let frontier = [start];
    for (let d = 1; d <= BLAST_DEPTH; d++) {
        const next: number[] = [];
        for (const f of frontier) {
            for (const s of into.get(f) ?? []) {
                if (seen.has(s) || !inScope(s)) continue;
                seen.add(s);
                next.push(s);
            }
        }
        byDepth.push(next.sort((a, b) => a - b));
        frontier = next;
    }
    return byDepth;
}

/** The repo-level answers in the shape an agent reads them: health, then the top findings. */
export function mapHealthReport(m: MapModel): Record<string, unknown> {
    const p = (i: number): string => (m.files[i] as MapModel['files'][number]).path;
    return {
        health: m.health ?? null,
        findings: {
            cycles: m.analyses.cyclesTotal,
            // The model keeps the ten largest cycles, each cut to its first eight files.
            largest_cycle_first_files: (m.analyses.cycles[0] ?? []).map(p),
            layer_breaches: m.analyses.layerBreaches ?? null,
            hotspots: (m.hotspots ?? []).slice(0, 5).map(([i, churn, loc]) => ({ file: p(i), churn, loc })),
            dead_files: m.analyses.deadFiles ?? null,
            dead_basis: m.analyses.deadBasis ?? null,
            surprises: m.analyses.surprises.slice(0, 5).map(([s, t]) => `${p(s)} → ${p(t)}`),
        },
    };
}
