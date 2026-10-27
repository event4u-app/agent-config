#!/usr/bin/env node
/**
 * One source registry for knowledge stores (roadmap I.1, K.1).
 *
 * `src/config/source-registry.json` holds one row per store: name, path,
 * format, writer, readers, privacy class, owner, delete path, hosts, status.
 * This check fails when a source file writes under a knowledge-store root and
 * no row names it as that store's writer — a new writer without a row.
 *
 *   (default)   writers without a row, rows whose writer file is gone
 *   --orphans   rows with a writer but no reader (written, never read)
 *   --count     `stores: N` for active rows
 *   --json      machine output
 *
 * Wiring into CI needs a ratification artifact and a gate-coverage row; until
 * then this runs by hand and from its test.
 *
 * Exit codes: 0 clean · 1 findings · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const REGISTRY_REL = 'src/config/source-registry.json';

export type Owner = 'user' | 'project' | 'team' | 'machine';
export type Privacy = 'public' | 'project' | 'personal' | 'secret';

export interface StoreRow {
    name: string;
    path: string;
    format: string;
    writer: string[];
    readers: string[];
    privacy: Privacy;
    owner: Owner;
    delete_path: string;
    hosts: string;
    status: 'active' | 'parked' | 'retired';
    /** true for stores this package reads but never writes (host memory) */
    read_only?: boolean;
    note?: string;
}

/** Literal roots that mark a knowledge store; a writer naming one needs a row. */
export const STORE_ROOTS: readonly string[] = [
    'agents/memory',
    'agents/knowledge',
    'agents/decisions',
    'agents/memory-quarantine',
    'agents/owner-questions.md',
    '.agent-chat-history',
    'memory-index-v1.sqlite3',
    'session-index',
    'second-brain',
    'decision-traces',
];

const WRITE_CALL = /\b(?:writeFileSync|appendFileSync|writeFile|appendFile|renameSync|DatabaseSync|createWriteStream)\s*\(/;

export interface Finding {
    kind: 'writer-without-row' | 'dead-writer' | 'orphan' | 'bad-row';
    file: string;
    detail: string;
}

export interface NotWriter {
    file: string;
    root: string;
    reason: string;
}

interface RegistryDoc {
    stores: StoreRow[];
    /** a file the scan flags that a reviewer found writes no store; each carries its reason */
    reviewed_not_writers?: NotWriter[];
}

function readDoc(root: string): RegistryDoc {
    return JSON.parse(fs.readFileSync(path.join(root, REGISTRY_REL), 'utf-8')) as RegistryDoc;
}

export function readRegistry(root: string): StoreRow[] {
    return readDoc(root).stores;
}

function walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.(ts|js|mjs)$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name)) out.push(p);
    }
}

const rootsIn = (line: string): string[] => {
    const hits: string[] = [];
    // `path.join('agents', 'memory', …)` reads as `agents/memory/…`.
    const joined = [...line.matchAll(/\bjoin\(([^)]*)\)/g)].map((m) => [...(m[1] as string).matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]).join('/'));
    for (const lit of [...[...line.matchAll(/(['"`])((?:(?!\1).){1,200})\1/g)].map((m) => m[2] as string), ...joined]) {
        for (const r of STORE_ROOTS) if (lit === r || lit.startsWith(`${r}/`) || lit.endsWith(r) || lit.includes(`/${r}`)) hits.push(r);
    }
    return hits;
};

/**
 * Store roots a file writes to: a write call whose line holds a store literal,
 * or names a constant (or a function) whose definition holds one, followed one
 * step. A heuristic over source text — a path built across several helpers is
 * missed, which is why the registry is reviewed and not only scanned.
 */
export function storeWrites(text: string): string[] {
    const lines = text.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
    const named = new Map<string, string[]>();
    for (const l of lines) {
        const def = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/.exec(l);
        const roots = rootsIn(l);
        if (def && roots.length) named.set(def[1] as string, roots);
    }
    // One step: a definition that names an already-named identifier inherits its roots.
    for (const l of lines) {
        const def = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/.exec(l);
        if (!def || named.has(def[1] as string)) continue;
        for (const [n, roots] of [...named]) if (new RegExp(`\\b${n.replace(/\$/g, '\\$')}\\b`).test(l.slice(def.index + def[0].length))) named.set(def[1] as string, roots);
    }
    const hits = new Set<string>();
    for (const l of lines) {
        if (!WRITE_CALL.test(l)) continue;
        for (const r of rootsIn(l)) hits.add(r);
        for (const [n, roots] of named) if (new RegExp(`\\b${n.replace(/\$/g, '\\$')}\\b`).test(l)) for (const r of roots) hits.add(r);
    }
    return [...hits].sort();
}

const OWNERS: ReadonlySet<string> = new Set(['user', 'project', 'team', 'machine']);

export function check(root: string, scanDirs: readonly string[] = ['src/scripts', 'src/shared', 'src/cli', 'src/mcp']): Finding[] {
    const doc = readDoc(root);
    const rows = doc.stores;
    const notWriters = doc.reviewed_not_writers ?? [];
    const findings: Finding[] = [];
    for (const n of notWriters) if (!n.reason?.trim()) findings.push({ kind: 'bad-row', file: REGISTRY_REL, detail: `reviewed_not_writers ${n.file}: needs a reason` });
    for (const r of rows) {
        if (!OWNERS.has(r.owner) || !r.delete_path) findings.push({ kind: 'bad-row', file: REGISTRY_REL, detail: `${r.name}: needs an owner (user|project|team|machine) and a delete path` });
        for (const w of r.writer) if (!fs.existsSync(path.join(root, w))) findings.push({ kind: 'dead-writer', file: w, detail: `${r.name} names a writer that does not exist` });
    }
    const writers = new Map<string, Set<string>>();
    for (const r of rows) for (const w of r.writer) writers.set(w, (writers.get(w) ?? new Set()).add(r.path));
    const files: string[] = [];
    for (const d of scanDirs) walk(path.join(root, d), files);
    for (const f of files.sort()) {
        const rel = path.relative(root, f).split(path.sep).join('/');
        if (rel === 'src/scripts/check_source_registry.ts') continue;
        const hits = storeWrites(fs.readFileSync(f, 'utf-8'));
        if (hits.length === 0) continue;
        const own = writers.get(rel);
        const covered = (h: string): boolean => [...(own ?? [])].some((p) => p.includes(h) || h.includes(p));
        const missing = hits.filter((h) => !covered(h) && !notWriters.some((n) => n.file === rel && n.root === h && n.reason?.trim()));
        if (missing.length) findings.push({ kind: 'writer-without-row', file: rel, detail: `writes under ${missing.join(', ')} but no registry row names it as the writer` });
    }
    return findings;
}

export function orphans(rows: readonly StoreRow[]): Finding[] {
    return rows.filter((r) => r.status === 'active' && !r.read_only && r.writer.length > 0 && r.readers.length === 0).map((r) => ({ kind: 'orphan' as const, file: REGISTRY_REL, detail: `${r.name} is written but nothing reads it` }));
}

export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO_ROOT): number {
    const json = argv.includes('--json');
    let rows: StoreRow[];
    try {
        rows = readRegistry(root);
    } catch (e) {
        process.stderr.write(`check_source_registry: cannot read ${REGISTRY_REL}: ${(e as Error).message}\n`);
        return 2;
    }
    if (argv.includes('--count')) {
        const active = rows.filter((r) => r.status === 'active').length;
        const retired = rows.filter((r) => r.status === 'retired').length;
        process.stdout.write(`stores: ${active} (-${retired})\n`);
        return 0;
    }
    const findings = argv.includes('--orphans') ? orphans(rows) : check(root);
    if (json) process.stdout.write(`${JSON.stringify(findings, null, 1)}\n`);
    else for (const f of findings) process.stdout.write(`❌  [${f.kind}] ${f.file}: ${f.detail}\n`);
    if (!json && findings.length === 0) process.stdout.write(`✅  source registry: ${rows.length} stores, no unregistered writer\n`);
    return findings.length ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(_HERE)) process.exit(main());
