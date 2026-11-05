/**
 * Requirement coverage as a query: what an ADR's `evidence.basis` and a
 * roadmap's `traceability:` evidence refs resolve to in the graph, and which
 * tests reach those nodes. Reached through `ask` (intent `coverage`), not a verb
 * of its own.
 *
 * The parsers are the ones the gates already use — `adr_cite_check` for basis
 * refs, `check_requirements_trace` for traceability rows — so a ref this query
 * reads is the ref those gates read. A test counts only over a `tests` edge
 * with a stated resolution; a guessed one is counted as withheld, never as
 * coverage. A ref that names nothing in the graph is listed with its reason:
 * an empty `resolved` list must not be mistakable for "nothing was asked".
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { basis_ref_kind, basis_ref_path } from '../adr_cite_check.js';
import { evidenceOf, readAdrFrontmatter } from '../_lib/adr_frontmatter.js';
import { parseTrace } from '../check_requirements_trace.js';
import type { AskRow, AskSource } from './ask.js';
import { isDecisionFile, numberFromFile } from './lanes/decisions/decisions.js';
import type { LoadedGraph } from './query.js';
import { isStatedResolution } from './types.js';

export interface ResolvedRef {
    ref: string;
    /** `path` a file, `id` a `<file>#<symbol>` node id, `label` a bare name matching exactly one node. */
    via: 'path' | 'id' | 'label';
    nodes: string[];
    /** Test nodes with an accepted `tests` edge into a node, its file, or — for a file — what it declares. */
    tests: string[];
    /** `tests` edges into the same targets whose resolution is a guess; reported, never counted. */
    guess_tests_withheld: number;
}

export interface CoverageEntry {
    kind: 'adr' | 'requirement';
    /** `ADR-<n>` or the row's `requirement_id`. */
    id: string;
    /** The file that declared the refs. */
    source: string;
    resolved: ResolvedRef[];
    unresolved: Array<{ ref: string; reason: string }>;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const LABEL_LIMIT = 5;

function walkMarkdown(root: string, rel: string): string[] {
    const out: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const p = `${rel}/${e.name}`;
        if (e.isDirectory()) out.push(...walkMarkdown(root, p));
        else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
    }
    return out;
}

/** The declaration in `file` whose span holds `line`, narrowest first. */
function declarationAt(g: LoadedGraph, file: string, line: number): string | null {
    let best: { id: string; span: number } | null = null;
    for (const id of g.idsInFiles([file])) {
        const loc = g.byId.get(id)?.source_location ?? [];
        if (loc.length < 3) continue;
        const from = loc[0] as number;
        const to = loc[2] as number;
        if (line < from || line > to) continue;
        if (!best || to - from < best.span) best = { id, span: to - from };
    }
    return best?.id ?? null;
}

function testsReaching(g: LoadedGraph, nodes: readonly string[]): { tests: string[]; withheld: number } {
    const targets = new Set<string>();
    for (const id of nodes) {
        targets.add(id);
        const file = g.byId.get(id)?.source_file;
        if (file && g.byId.has(file)) targets.add(file);
        if (file === id) for (const d of g.idsInFiles([id])) targets.add(d);
    }
    const tests = new Set<string>();
    let withheld = 0;
    for (const t of targets) {
        for (const e of g.in.get(t) ?? []) {
            if (e.relation !== 'tests') continue;
            if (isStatedResolution(e.resolved_via)) tests.add(e.source);
            else withheld++;
        }
    }
    return { tests: [...tests].sort(), withheld };
}

/** One ref → the nodes it names, or the reason it names none. */
export function resolveRef(g: LoadedGraph, root: string, ref: string): Omit<ResolvedRef, 'tests' | 'guess_tests_withheld'> | { reason: string } {
    const kind = basis_ref_kind(ref);
    if (kind === 'url') return { reason: 'url — not a code reference' };
    if (kind === 'claim') return { reason: 'claim id — not a code reference' };
    const trimmed = ref.trim();
    if (IDENTIFIER.test(trimmed)) {
        const ids = g.idsByLabel(trimmed, LABEL_LIMIT);
        if (ids.length === 0) return { reason: 'names no node in the graph' };
        // A name carried by several nodes is a guess at which one was meant.
        if (ids.length > 1) return { reason: `ambiguous — ${ids.length}${ids.length >= LABEL_LIMIT ? '+' : ''} nodes carry this name` };
        return { ref, via: 'label', nodes: ids };
    }
    const p = basis_ref_path(trimmed);
    if (p.includes('#')) return g.byId.has(p) ? { ref, via: 'id', nodes: [p] } : { reason: 'names no node in the graph' };
    const abs = path.resolve(root, p);
    if (abs !== path.resolve(root) && !abs.startsWith(path.resolve(root) + path.sep)) return { reason: 'outside the repository' };
    if (!g.byId.has(p)) return { reason: fs.existsSync(abs) ? 'file exists but is not a graph node' : 'no such file' };
    const nodes = [p];
    const anchor = /:(\d+)(?:-\d+)?\s*(?:\([^)]*\))?\s*$/.exec(trimmed);
    if (anchor) {
        const decl = declarationAt(g, p, Number(anchor[1]));
        if (decl) nodes.push(decl);
    }
    return { ref, via: 'path', nodes };
}

function cover(g: LoadedGraph, root: string, kind: CoverageEntry['kind'], id: string, source: string, refs: readonly string[]): CoverageEntry {
    const entry: CoverageEntry = { kind, id, source, resolved: [], unresolved: [] };
    for (const ref of refs) {
        const r = resolveRef(g, root, ref);
        if ('reason' in r) {
            entry.unresolved.push({ ref, reason: r.reason });
            continue;
        }
        const t = testsReaching(g, r.nodes);
        entry.resolved.push({ ...r, tests: t.tests, guess_tests_withheld: t.withheld });
    }
    return entry;
}

/** ADRs carrying at least one `evidence.basis` ref; a record with none asserts nothing to cover. */
export function adrCoverage(g: LoadedGraph, root: string): CoverageEntry[] {
    const out: CoverageEntry[] = [];
    for (const file of [...walkMarkdown(root, 'docs/decisions'), ...walkMarkdown(root, 'docs/adr')].filter(isDecisionFile)) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, file), 'utf-8');
        } catch {
            continue;
        }
        const fm = readAdrFrontmatter(text);
        const basis = fm ? (evidenceOf(fm)?.basis ?? []) : [];
        if (basis.length === 0) continue;
        const declared = fm?.scalars['adr'];
        const n = declared && /^\d+$/.test(declared.trim()) ? Number(declared.trim()) : numberFromFile(file);
        out.push(cover(g, root, 'adr', n === null ? file : `ADR-${n}`, file, basis));
    }
    return out;
}

/** Every `traceability:` row in the roadmap tree, archived and parked files included. */
export function requirementCoverage(g: LoadedGraph, root: string): CoverageEntry[] {
    const out: CoverageEntry[] = [];
    for (const file of walkMarkdown(root, 'agents/roadmaps')) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, file), 'utf-8');
        } catch {
            continue;
        }
        for (const row of parseTrace(text).rows) out.push(cover(g, root, 'requirement', row.requirement_id, file, row.evidence_refs));
    }
    return out;
}

export function coverageBody(e: CoverageEntry): string {
    const lines = [`${e.kind === 'adr' ? e.id : `requirement ${e.id}`} — declared in ${e.source}`];
    for (const r of e.resolved) {
        lines.push(`resolved: ${r.ref} (${r.via}) → ${r.nodes.join(', ')}`);
        lines.push(`  tests: ${r.tests.length ? r.tests.join(', ') : '(none over an accepted edge)'}${r.guess_tests_withheld ? ` · ${r.guess_tests_withheld} guessed tests edge(s) withheld` : ''}`);
    }
    for (const u of e.unresolved) lines.push(`unresolved: ${u.ref} — ${u.reason}`);
    return lines.join('\n');
}

export function coverageSources(g: LoadedGraph, repoId: string, root: string): AskSource[] {
    const rowId = (e: CoverageEntry): string => (e.kind === 'adr' ? `coverage:${e.id}` : `coverage:${e.source}#${e.id}`);
    const entries = (): CoverageEntry[] => [...adrCoverage(g, root), ...requirementCoverage(g, root)];
    const rowOf = (e: CoverageEntry): AskRow => {
        const tested = e.resolved.filter((r) => r.tests.length > 0).length;
        return {
            id: rowId(e),
            source: 'coverage',
            title: `${e.kind === 'adr' ? e.id : `requirement ${e.id}`}: ${e.resolved.length} resolved (${tested} tested), ${e.unresolved.length} unresolved`,
            read_tokens: Math.ceil(coverageBody(e).length / 4),
            at: null,
            repo_id: repoId,
            branch: null,
            user: null,
            worktree: null,
        };
    };
    return [
        {
            name: 'coverage',
            owner: 'project',
            intents: ['coverage'],
            rows: (q) => {
                const all = entries();
                const adrs = new Set([...q.matchAll(/\bADR[-\s]?0*(\d+)\b/gi)].map((m) => `ADR-${m[1]}`));
                const words = new Set(q.split(/\s+/));
                const named = all.filter((e) => (e.kind === 'adr' ? adrs.has(e.id) : words.has(e.id)));
                return (named.length ? named : all).map(rowOf);
            },
            lookup: (id) => {
                const e = id.startsWith('coverage:') ? entries().find((x) => rowId(x) === id) : undefined;
                return e ? { row: rowOf(e), body: coverageBody(e) } : null;
            },
        },
    ];
}
