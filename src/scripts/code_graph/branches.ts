/**
 * Every fact knows its branches, without a second graph.
 *
 * A branch manifest maps a branch to its commit and, per relevant path, the git
 * blob it holds there — read with `git ls-tree`, never a checkout. Facts are
 * stored by content: the symbols of one file version, keyed by reader version,
 * path and blob; the packages of one set of lockfiles; the schema of one set of
 * migrations. Two branches that differ in three files cost three fact files,
 * not a second graph (D10, K20). "On which branches does X exist" and a branch
 * diff are read from manifests and the facts they point at.
 *
 * Clean-up (D11): a manifest goes when its local branch is gone or it was not
 * seen for the window; the default branch, the checked-out branch, `release/*`
 * and branches with a remote-tracking ref are pinned; unreferenced facts are
 * swept in the same pass. No git ref is ever deleted, and an offline remote
 * never counts as gone.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { write_atomic } from '../_lib/fs_atomic.js';
import { chainOf, currentBranch, defaultBranch } from '../_lib/branch_parents.js';
import { gitProbe, gitProbeInput } from '../_lib/spawn_env.js';
import { buildFromRepo, extractorFingerprint, walkedPath } from './build.js';
import { extractFile } from './extract.js';
import { readSystems } from './lanes/systems/index.js';
import { type CodeEdge, type CodeNode, EXT_LANG, type Lang } from './types.js';

export const BRANCH_STORE_VERSION = 1;
/** Days a branch may go unseen before its manifest is dropped. */
export const UNSEEN_DAYS = 30;
/** Days of reflog that make a branch "recently checked out". */
export const RECENT_DAYS = 14;

const PACKAGE_FILES = /(^|\/)(package\.json|package-lock\.json|composer\.json|composer\.lock|pnpm-lock\.yaml|yarn\.lock|bun\.lock)$/;
const MIGRATION = /(^|\/)(migrations?|migrate)\/[^/]+\.(php|sql|ts|js|py|rb)$|\.sql$/;

export interface BranchManifest {
    version: number;
    ref: string;
    commit: string;
    /** YYYY-MM-DD the branch was last indexed or asked about */
    seen: string;
    files: Record<string, string>;
    facts: { code: string[]; systems: string | null; data: string | null };
}

interface CodeFact {
    path: string;
    symbols: Array<[string, string, number]>;
}
interface SystemsFact {
    packages: Array<{ id: string; ecosystem: string; name: string; version: string; direct: boolean; dev: boolean }>;
    requires: Array<[string, string]>;
}
interface DataFact {
    tables: string[];
    columns: string[];
}

export function storeDir(buildDir: string): string {
    return path.join(buildDir, 'branches');
}
const manifestFile = (dir: string, ref: string): string => path.join(dir, 'manifests', `${encodeURIComponent(ref)}.json`);
const factFile = (dir: string, kind: 'code' | 'systems' | 'data', key: string): string => path.join(dir, 'facts', kind, `${key}.json`);
const hash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 32);
const today = (): string => new Date().toISOString().slice(0, 10);

function langOf(p: string): Lang | null {
    const ext = path.extname(p).toLowerCase();
    return (EXT_LANG as Record<string, Lang>)[ext] ?? null;
}

/** Blobs of `commit` the readers care about: code, package files, migrations. */
function lsTree(root: string, commit: string): Array<[string, string]> {
    const out = gitProbe(root, ['-c', 'core.quotePath=false', 'ls-tree', '-r', '-z', '--full-tree', commit], { maxBuffer: 512 * 1024 * 1024 });
    const rows: Array<[string, string]> = [];
    for (const rec of out.split('\0')) {
        if (!rec) continue;
        const tab = rec.indexOf('\t');
        const [mode = '', type = '', sha = ''] = rec.slice(0, tab).split(' ');
        const p = rec.slice(tab + 1);
        if (type !== 'blob' || mode === '120000') continue;
        if (!walkedPath(p)) continue;
        if (langOf(p) || PACKAGE_FILES.test(p) || MIGRATION.test(p)) rows.push([p, sha]);
    }
    return rows;
}

/** Contents of many blobs from one `git cat-file --batch` process. */
export function catBlobs(root: string, shas: readonly string[]): Map<string, string> {
    const out = new Map<string, string>();
    if (shas.length === 0) return out;
    const buf = gitProbeInput(root, ['cat-file', '--batch'], `${shas.join('\n')}\n`);
    let at = 0;
    while (at < buf.length) {
        const nl = buf.indexOf(10, at);
        if (nl < 0) break;
        const [sha = '', type = '', size = '0'] = buf.subarray(at, nl).toString('utf-8').split(' ');
        if (type === 'missing') {
            at = nl + 1;
            continue;
        }
        const n = Number(size);
        out.set(sha, buf.subarray(nl + 1, nl + 1 + n).toString('utf-8'));
        at = nl + 1 + n + 1;
    }
    return out;
}

function readJson<T>(file: string): T | null {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
    } catch {
        return null;
    }
}
function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    write_atomic(file, `${JSON.stringify(value)}\n`);
}

/** A temporary tree holding `files` (path → content), handed to a file reader, then removed. */
function withSparseTree<T>(files: ReadonlyMap<string, string>, fn: (dir: string) => T): T {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-branch-'));
    try {
        for (const [p, text] of files) {
            fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
            fs.writeFileSync(path.join(dir, p), text);
        }
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function withSparseTreeAsync<T>(files: ReadonlyMap<string, string>, fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-branch-'));
    try {
        for (const [p, text] of files) {
            fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
            fs.writeFileSync(path.join(dir, p), text);
        }
        return await fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

export interface IndexResult {
    manifest: BranchManifest;
    /** fact files this call had to write — the cost of the branch beyond what was stored */
    written: number;
}

/** Index one branch (or any commit-ish) without checking it out. */
export async function indexBranch(root: string, buildDir: string, ref: string, opts: { day?: string } = {}): Promise<IndexResult> {
    const dir = storeDir(buildDir);
    const commit = gitProbe(root, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
    const entries = lsTree(root, commit);
    const files = Object.fromEntries(entries);
    let written = 0;
    const fp = extractorFingerprint();

    const code = entries.filter(([p]) => langOf(p) !== null);
    const codeKeys = code.map(([p, sha]) => [p, sha, hash(`${fp}\0${p}\0${sha}`)] as const);
    const missing = codeKeys.filter(([, , key]) => !fs.existsSync(factFile(dir, 'code', key)));
    const texts = catBlobs(root, [...new Set(missing.map(([, sha]) => sha))]);
    for (const [p, sha, key] of missing) {
        const text = texts.get(sha);
        if (text === undefined) continue;
        const ex = await extractFile(p, text, langOf(p) as Lang);
        const symbols = ex.nodes.filter((n) => n.kind !== 'file').map((n) => [n.id, n.kind, (n.source_location[0] as number | undefined) ?? 0] as [string, string, number]);
        writeJson(factFile(dir, 'code', key), { path: p, symbols } satisfies CodeFact);
        written++;
    }

    const set = (re: RegExp, extra?: RegExp): Array<[string, string]> => entries.filter(([p]) => re.test(p) || (extra ? extra.test(p) : false)).sort(([a], [b]) => (a < b ? -1 : 1));
    const pkgFiles = set(PACKAGE_FILES);
    let systems: string | null = null;
    if (pkgFiles.length) {
        systems = hash(`systems:${BRANCH_STORE_VERSION}\0${pkgFiles.map(([p, s]) => `${p}:${s}`).join('\n')}`);
        if (!fs.existsSync(factFile(dir, 'systems', systems))) {
            const blobs = catBlobs(root, pkgFiles.map(([, s]) => s));
            const out = withSparseTree(new Map(pkgFiles.map(([p, s]) => [p, blobs.get(s) ?? ''] as const)), (tmp) => readSystems(tmp));
            const fact: SystemsFact = {
                packages: out.facts
                    .filter((f) => f.kind === 'package')
                    .map((f) => ({ id: f.id, ecosystem: String(f.attrs['ecosystem']), name: String(f.attrs['name']), version: String(f.attrs['version']), direct: f.attrs['direct'] === true, dev: f.attrs['dev'] === true })),
                requires: out.relations.filter((r) => r.relation === 'requires').map((r) => [r.from, r.to] as [string, string]),
            };
            writeJson(factFile(dir, 'systems', systems), fact);
            written++;
        }
    }
    const migFiles = set(MIGRATION);
    let data: string | null = null;
    if (migFiles.length) {
        const withManifests = [...migFiles, ...pkgFiles.filter(([p]) => !p.includes('/'))];
        data = hash(`data:${BRANCH_STORE_VERSION}\0${withManifests.map(([p, s]) => `${p}:${s}`).join('\n')}`);
        if (!fs.existsSync(factFile(dir, 'data', data))) {
            const blobs = catBlobs(root, withManifests.map(([, s]) => s));
            // The schema replay is the framework providers' work in the core build, so the sparse tree is built, not lane-read.
            const g = await withSparseTreeAsync(new Map(withManifests.map(([p, s]) => [p, blobs.get(s) ?? ''] as const)), async (tmp) => (await buildFromRepo(tmp, null, {})).graph);
            const fact: DataFact = {
                tables: [...new Set(g.nodes.filter((n) => n.kind === 'table').map((n) => n.label))].sort(),
                columns: [...new Set(g.nodes.filter((n) => n.kind === 'column').map((n) => n.label))].sort(),
            };
            writeJson(factFile(dir, 'data', data), fact);
            written++;
        }
    }
    const manifest: BranchManifest = { version: BRANCH_STORE_VERSION, ref, commit, seen: opts.day ?? today(), files, facts: { code: codeKeys.map(([, , k]) => k), systems, data } };
    writeJson(manifestFile(dir, ref), manifest);
    return { manifest, written };
}

export function listManifests(buildDir: string): BranchManifest[] {
    const d = path.join(storeDir(buildDir), 'manifests');
    let names: string[];
    try {
        names = fs.readdirSync(d).filter((n) => n.endsWith('.json'));
    } catch {
        return [];
    }
    return names
        .map((n) => readJson<BranchManifest>(path.join(d, n)))
        .filter((m): m is BranchManifest => m !== null && m.version === BRANCH_STORE_VERSION)
        .sort((a, b) => (a.ref < b.ref ? -1 : 1));
}

export function readManifest(buildDir: string, ref: string): BranchManifest | null {
    return readJson<BranchManifest>(manifestFile(storeDir(buildDir), ref));
}

/** Mark a branch as seen today: asking about a branch keeps it. */
export function touchManifest(buildDir: string, m: BranchManifest, day = today()): void {
    if (m.seen === day) return;
    writeJson(manifestFile(storeDir(buildDir), m.ref), { ...m, seen: day });
}

export interface BranchFacts {
    symbols: Map<string, { kind: string; file: string; line: number }>;
    packages: Map<string, SystemsFact['packages'][number]>;
    requires: Array<[string, string]>;
    tables: Set<string>;
    columns: Set<string>;
}

export function loadFacts(buildDir: string, m: BranchManifest): BranchFacts {
    const dir = storeDir(buildDir);
    const symbols = new Map<string, { kind: string; file: string; line: number }>();
    for (const key of m.facts.code) {
        const f = readJson<CodeFact>(factFile(dir, 'code', key));
        for (const [id, kind, line] of f?.symbols ?? []) symbols.set(id, { kind, file: f!.path, line });
    }
    const sys = m.facts.systems ? readJson<SystemsFact>(factFile(dir, 'systems', m.facts.systems)) : null;
    const data = m.facts.data ? readJson<DataFact>(factFile(dir, 'data', m.facts.data)) : null;
    return {
        symbols,
        packages: new Map((sys?.packages ?? []).map((p) => [p.id, p] as const)),
        requires: sys?.requires ?? [],
        tables: new Set(data?.tables ?? []),
        columns: new Set(data?.columns ?? []),
    };
}

export interface BranchDiff {
    a: string;
    b: string;
    files: { added: string[]; removed: string[]; changed: string[] };
    symbols: { added: string[]; removed: string[] };
    packages: { added: string[]; removed: string[]; changed: Array<[string, string, string]> };
    tables: { added: string[]; removed: string[] };
    columns: { added: string[]; removed: string[] };
}

/** What `b` holds that `a` does not, and the other way round — manifests first, facts only for what differs. */
export function diffBranches(buildDir: string, a: BranchManifest, b: BranchManifest): BranchDiff {
    const fa = loadFacts(buildDir, a);
    const fb = loadFacts(buildDir, b);
    const only = <T>(x: Iterable<T>, y: { has(v: T): boolean }): T[] => [...x].filter((v) => !y.has(v));
    const ka = new Set(Object.keys(a.files));
    const kb = new Set(Object.keys(b.files));
    const byName = (m: Map<string, SystemsFact['packages'][number]>): Map<string, string> => new Map([...m.values()].filter((p) => p.direct).map((p) => [`${p.ecosystem}:${p.name}`, p.version] as const));
    const pa = byName(fa.packages);
    const pb = byName(fb.packages);
    return {
        a: a.ref,
        b: b.ref,
        files: {
            added: only(kb, ka).sort(),
            removed: only(ka, kb).sort(),
            changed: [...ka].filter((p) => kb.has(p) && a.files[p] !== b.files[p]).sort(),
        },
        symbols: { added: only(fb.symbols.keys(), fa.symbols).sort(), removed: only(fa.symbols.keys(), fb.symbols).sort() },
        packages: {
            added: only(pb.keys(), pa).sort(),
            removed: only(pa.keys(), pb).sort(),
            changed: [...pa.entries()].filter(([k, v]) => pb.has(k) && pb.get(k) !== v).map(([k, v]) => [k, v, pb.get(k) as string] as [string, string, string]).sort(),
        },
        tables: { added: only(fb.tables, fa.tables).sort(), removed: only(fa.tables, fb.tables).sort() },
        columns: { added: only(fb.columns, fa.columns).sort(), removed: only(fa.columns, fb.columns).sort() },
    };
}

export interface OnBranch {
    ref: string;
    commit: string;
    /** what matched there: a package version, a column, a symbol's file and line */
    what: string;
}

/** On which indexed branches a package (any version), a `table.column`, a table, a symbol or a file exists. */
export function onBranches(buildDir: string, query: string): OnBranch[] {
    const out: OnBranch[] = [];
    const q = query.toLowerCase();
    for (const m of listManifests(buildDir)) {
        if (m.files[query]) {
            out.push({ ref: m.ref, commit: m.commit, what: `file ${query} (blob ${(m.files[query] as string).slice(0, 8)})` });
            continue;
        }
        const f = loadFacts(buildDir, m);
        const hits: string[] = [];
        for (const p of f.packages.values()) if (p.name.toLowerCase() === q) hits.push(`${p.ecosystem}:${p.name}@${p.version}${p.direct ? '' : ' (transitive)'}`);
        if (f.columns.has(query)) hits.push(`column ${query}`);
        if (f.tables.has(query)) hits.push(`table ${query}`);
        for (const [id, s] of f.symbols) if (id === query || id.endsWith(`#${query}`) || id.endsWith(`::${query}`)) hits.push(`${s.kind} ${id} at ${s.file}:${s.line}`);
        if (hits.length) out.push({ ref: m.ref, commit: m.commit, what: hits.slice(0, 5).join('; ') });
    }
    return out;
}

/** The branches indexed by default: the checked-out one, its parent chain, and those checked out lately. */
export function defaultBranchSet(root: string, days = RECENT_DAYS): string[] {
    const cur = currentBranch(root);
    const set = new Set<string>();
    const def = defaultBranch(root);
    if (refExists(root, def)) set.add(def);
    if (cur) {
        set.add(cur);
        for (const l of chainOf(root, cur)) if (refExists(root, l.branch)) set.add(l.branch);
    }
    try {
        const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        const log = gitProbe(root, ['reflog', 'show', '--format=%cs%x09%gs', '-n', '500', 'HEAD']);
        for (const line of log.split('\n')) {
            const [date = '', subject = ''] = line.split('\t');
            if (date < since) continue;
            const m = /^checkout: moving from (\S+) to (\S+)$/.exec(subject);
            if (m && refExists(root, m[2] as string)) set.add(m[2] as string);
        }
    } catch {
        /* no reflog: the current branch and its chain stand */
    }
    return [...set].sort();
}

function refExists(root: string, branch: string): boolean {
    try {
        gitProbe(root, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
        return true;
    } catch {
        return false;
    }
}

function hasRemoteTracking(root: string, branch: string): boolean {
    try {
        return gitProbe(root, ['for-each-ref', '--format=%(refname)', `refs/remotes/*/${branch}`]).trim().length > 0;
    } catch {
        return false;
    }
}

export interface GcResult {
    dropped: Array<{ ref: string; why: string }>;
    kept: Array<{ ref: string; why: string }>;
    swept: number;
}

/** Drop stale manifests and the facts nothing references any more; never touches a git ref. */
export function gcBranches(root: string, buildDir: string, opts: { day?: string; unseenDays?: number } = {}): GcResult {
    const dir = storeDir(buildDir);
    const day = opts.day ?? today();
    const cutoff = new Date(new Date(`${day}T00:00:00Z`).getTime() - (opts.unseenDays ?? UNSEEN_DAYS) * 86_400_000).toISOString().slice(0, 10);
    const def = defaultBranch(root);
    const cur = currentBranch(root);
    const dropped: GcResult['dropped'] = [];
    const kept: GcResult['kept'] = [];
    const live: BranchManifest[] = [];
    for (const m of listManifests(buildDir)) {
        const pin = m.ref === def ? 'default branch' : m.ref === cur ? 'checked out' : /^release\//.test(m.ref) ? 'release line' : hasRemoteTracking(root, m.ref) ? 'has a remote-tracking ref' : null;
        if (pin) {
            kept.push({ ref: m.ref, why: pin });
            live.push(m);
            continue;
        }
        const gone = !refExists(root, m.ref);
        if (gone || m.seen < cutoff) {
            fs.rmSync(manifestFile(dir, m.ref), { force: true });
            dropped.push({ ref: m.ref, why: gone ? 'the local branch is gone' : `unseen since ${m.seen}` });
            continue;
        }
        kept.push({ ref: m.ref, why: `seen ${m.seen}` });
        live.push(m);
    }
    const referenced = { code: new Set<string>(), systems: new Set<string>(), data: new Set<string>() };
    for (const m of live) {
        for (const k of m.facts.code) referenced.code.add(k);
        if (m.facts.systems) referenced.systems.add(m.facts.systems);
        if (m.facts.data) referenced.data.add(m.facts.data);
    }
    let swept = 0;
    for (const kind of ['code', 'systems', 'data'] as const) {
        const d = path.join(dir, 'facts', kind);
        let names: string[];
        try {
            names = fs.readdirSync(d);
        } catch {
            continue;
        }
        for (const n of names) {
            if (referenced[kind].has(n.replace(/\.json$/, ''))) continue;
            fs.rmSync(path.join(d, n), { force: true });
            swept++;
        }
    }
    return { dropped, kept, swept };
}

/** Bytes the store holds, for the cost reading (6.2). */
export function storeBytes(buildDir: string): { manifests: number; facts: number } {
    const size = (d: string): number => {
        let n = 0;
        try {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) n += e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size;
        } catch {
            /* absent */
        }
        return n;
    };
    const dir = storeDir(buildDir);
    return { manifests: size(path.join(dir, 'manifests')), facts: size(path.join(dir, 'facts')) };
}

export function renderDiff(d: BranchDiff): string[] {
    const list = (label: string, xs: readonly string[]): string[] => (xs.length ? [`${label} (${xs.length}):`, ...xs.slice(0, 50).map((x) => `  ${x}`), ...(xs.length > 50 ? [`  … ${xs.length - 50} more`] : [])] : []);
    return [
        `branch-diff ${d.a} → ${d.b}`,
        ...list('files added', d.files.added),
        ...list('files removed', d.files.removed),
        ...list('files changed', d.files.changed),
        ...list('symbols added', d.symbols.added),
        ...list('symbols removed', d.symbols.removed),
        ...list('packages added', d.packages.added),
        ...list('packages removed', d.packages.removed),
        ...list('packages changed', d.packages.changed.map(([k, x, y]) => `${k} ${x} → ${y}`)),
        ...list('tables added', d.tables.added),
        ...list('tables removed', d.tables.removed),
        ...list('columns added', d.columns.added),
        ...list('columns removed', d.columns.removed),
    ];
}

/** A package graph of one branch, shaped like the systems lane's facts, for `why` and `remove-plan --branch`. */
export function branchPackageGraph(buildDir: string, m: BranchManifest): { nodes: CodeNode[]; edges: CodeEdge[] } {
    const f = loadFacts(buildDir, m);
    const nodes: CodeNode[] = [...f.packages.values()].map((p) => ({
        id: p.id,
        label: `${p.name}@${p.version}`,
        kind: 'package',
        source_file: '',
        source_location: [],
        fact: { owner: '', witness: { file: `${m.ref}@${m.commit.slice(0, 8)}`, line: 0, hash: '' }, rung: 'T1', lane: 'systems', attrs: { name: p.name, version: p.version, ecosystem: p.ecosystem, direct: p.direct, dev: p.dev, declared: p.direct ? [`${m.ref}`] : [] } },
    }));
    const edges: CodeEdge[] = f.requires.map(([source, target]) => ({ source, target, relation: 'requires', confidence: 'EXTRACTED', resolved_via: 'lane-read', provider: 'native' }));
    return { nodes, edges };
}
