/**
 * Domains: business boundaries — Orders, Billing — as a declared axis across
 * the map, never inferred into a rule.
 *
 * Declared, in this order: a `domains:` section of `agents/map/layers.yaml`,
 * read with the same parser and glob engine as the layers; without one, the
 * structure the code itself declares — `app/Domain/<X>`, `src/Domain/<X>`,
 * `Modules/<X>`, `packages/<x>`. Without either, the map proposes domains from
 * its coupling areas, labelled `inferred`, with a snippet to adopt — and a
 * proposal never becomes a breach or reaches the context pack (K30, D8).
 *
 * A file has at most one declared domain; two globs claiming it is a finding,
 * not a tie-break (D7). Elements reached through files — routes, tables,
 * packages, tickets — may touch several domains: that is the information.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { globToRegExp } from './map_answers.js';

export interface DomainDecl {
    name: string;
    match: RegExp[];
    /** globs naming the domain's public part; others may reach only these */
    publicMatch: RegExp[] | null;
    owner: string | null;
    parent: string | null;
    globs: string[];
}

export interface DomainRules {
    source: 'declared' | 'structure';
    domains: DomainDecl[];
    /** `domain_allow:` — null when undeclared: crossings are then counted, never breaches */
    allow: Map<string, Set<string>> | null;
}

const STRUCTURE: ReadonlyArray<RegExp> = [
    /^(?:app|src)\/Domains?\/([^/]+)\//,
    /^(?:app\/|src\/)?Modules\/([^/]+)\//,
    /^packages\/([^/]+)\//,
];

/** Names a coupling cluster gets that are no business domain. */
const NOT_A_DOMAIN = /^(shared|common|core|lib|libs|utils?|helpers?|support|infrastructure|infra|tests?|fixtures?|vendor|config|scripts|src|app|docs?)$/i;

export function readDomainRules(file: string): DomainRules | null {
    let doc: unknown;
    try {
        doc = parseYaml(fs.readFileSync(file, 'utf-8'));
    } catch {
        return null;
    }
    const d = doc as { domains?: Array<Record<string, unknown>>; domain_allow?: Record<string, unknown> } | null;
    if (!d || !Array.isArray(d.domains)) return null;
    const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((g): g is string => typeof g === 'string') : []);
    const domains = d.domains
        .filter((x) => typeof x?.['name'] === 'string' && Array.isArray(x['paths']))
        .map((x) => {
            const globs = strs(x['paths']);
            const pub = strs(x['public']);
            return {
                name: x['name'] as string,
                match: globs.map(globToRegExp),
                publicMatch: pub.length ? pub.map(globToRegExp) : null,
                owner: typeof x['owner'] === 'string' ? (x['owner'] as string) : null,
                parent: typeof x['parent'] === 'string' ? (x['parent'] as string) : null,
                globs,
            };
        });
    if (!domains.length) return null;
    let allow: DomainRules['allow'] = null;
    if (d.domain_allow && typeof d.domain_allow === 'object') {
        allow = new Map();
        for (const [k, v] of Object.entries(d.domain_allow)) allow.set(k, new Set(strs(v)));
    }
    return { source: 'declared', domains, allow };
}

/** Domains the code's own folder structure declares, each witnessed by the first file under it. */
export function structuralDomains(paths: readonly string[]): DomainRules | null {
    const seen = new Map<string, string>();
    for (const p of paths) {
        for (const re of STRUCTURE) {
            const m = re.exec(p);
            if (!m || NOT_A_DOMAIN.test(m[1] as string)) continue;
            const prefix = p.slice(0, (m.index ?? 0) + m[0].length);
            if (!seen.has(prefix)) seen.set(prefix, m[1] as string);
            break;
        }
    }
    if (seen.size < 2) return null;
    const domains: DomainDecl[] = [...seen.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([prefix, name]) => ({ name, match: [globToRegExp(`${prefix}**`)], publicMatch: null, owner: null, parent: null, globs: [`${prefix}**`] }));
    return { source: 'structure', domains, allow: null };
}

export interface DomainAssignment {
    /** domain per path index, or undefined */
    of: Array<string | undefined>;
    /** path indexes two declared globs claim, with both names */
    overlaps: Array<{ file: number; domains: [string, string] }>;
}

export function assignDomains(paths: readonly string[], rules: DomainRules): DomainAssignment {
    const of: Array<string | undefined> = [];
    const overlaps: DomainAssignment['overlaps'] = [];
    paths.forEach((p, i) => {
        const hits = rules.domains.filter((d) => d.match.some((r) => r.test(p))).map((d) => d.name);
        const uniq = [...new Set(hits)];
        of[i] = uniq[0];
        if (uniq.length > 1) overlaps.push({ file: i, domains: [uniq[0] as string, uniq[1] as string] });
    });
    return { of, overlaps };
}

export type DomainViolationKind = 'domain' | 'domain-public' | 'domain-cycle' | 'domain-overlap' | 'domain-table';

export interface DomainViolation {
    kind: DomainViolationKind;
    /** file indexes: the two ends of the edge, or the files in question */
    files: number[];
    domains: string[];
    /** a table name, for a table written by several domains */
    table?: string;
}

export interface DomainAnalysis {
    violations: DomainViolation[];
    crossings: number;
    breaches: number;
    /** domain → aggregated outgoing edge counts to other domains */
    edges: Array<[string, string, number]>;
}

export const DOMAIN_VIOLATIONS_CAP = 50;

/**
 * Breaches against the declaration: a crossing `domain_allow` does not list,
 * an edge into another domain's non-public part, cycles between domains, and
 * overlapping claims. Crossings are always counted; a breach needs
 * `domain_allow`. Test files are exempt, as they are for layers.
 */
export function analyseDomains(
    edges: ReadonlyArray<readonly [number, number, number]>,
    isTest: (i: number) => boolean,
    paths: readonly string[],
    a: DomainAssignment,
    rules: DomainRules,
): DomainAnalysis {
    const violations: DomainViolation[] = a.overlaps.map((o) => ({ kind: 'domain-overlap' as const, files: [o.file], domains: o.domains }));
    const decl = new Map(rules.domains.map((d) => [d.name, d] as const));
    const agg = new Map<string, number>();
    let crossings = 0;
    let breaches = 0;
    for (const [s, t] of edges) {
        const ds = a.of[s];
        const dt = a.of[t];
        if (!ds || !dt || ds === dt || isTest(s)) continue;
        crossings++;
        agg.set(`${ds}\0${dt}`, (agg.get(`${ds}\0${dt}`) ?? 0) + 1);
        if (rules.allow && !rules.allow.get(ds)?.has(dt)) {
            breaches++;
            if (violations.length < DOMAIN_VIOLATIONS_CAP) violations.push({ kind: 'domain', files: [s, t], domains: [ds, dt] });
        }
        const pub = decl.get(dt)?.publicMatch;
        if (pub && !pub.some((r) => r.test(paths[t] as string))) {
            breaches++;
            if (violations.length < DOMAIN_VIOLATIONS_CAP) violations.push({ kind: 'domain-public', files: [s, t], domains: [ds, dt] });
        }
    }
    const aggEdges: DomainAnalysis['edges'] = [...agg.entries()].map(([k, n]) => [...(k.split('\0') as [string, string]), n] as [string, string, number]).sort((x, y) => y[2] - x[2] || (x[0] < y[0] ? -1 : 1));
    // Cycles between domains: strongly connected components of the aggregated graph.
    const names = [...new Set(aggEdges.flatMap(([x, y]) => [x, y]))].sort();
    const out = new Map<string, string[]>();
    for (const [x, y] of aggEdges) out.set(x, [...(out.get(x) ?? []), y]);
    let idx = 0;
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const stack: string[] = [];
    const on = new Set<string>();
    const sccs: string[][] = [];
    const strong = (v: string): void => {
        index.set(v, idx);
        low.set(v, idx);
        idx++;
        stack.push(v);
        on.add(v);
        for (const w of out.get(v) ?? []) {
            if (!index.has(w)) {
                strong(w);
                low.set(v, Math.min(low.get(v) as number, low.get(w) as number));
            } else if (on.has(w)) low.set(v, Math.min(low.get(v) as number, index.get(w) as number));
        }
        if (low.get(v) === index.get(v)) {
            const comp: string[] = [];
            for (let w = stack.pop(); w !== undefined; w = stack.pop()) {
                on.delete(w);
                comp.push(w);
                if (w === v) break;
            }
            if (comp.length > 1) sccs.push(comp.sort());
        }
    };
    // A cycle is a breach of a declared architecture; folder structure declares none.
    if (rules.source === 'declared') for (const v of names) if (!index.has(v)) strong(v);
    for (const comp of sccs) {
        const set = new Set(comp);
        const witness = edges.find(([s, t]) => a.of[s] && a.of[t] && a.of[s] !== a.of[t] && set.has(a.of[s] as string) && set.has(a.of[t] as string) && !isTest(s));
        violations.push({ kind: 'domain-cycle', files: witness ? [witness[0], witness[1]] : [], domains: comp });
    }
    return { violations, crossings, breaches: breaches + sccs.length + a.overlaps.length, edges: aggEdges };
}

export interface DomainProposal {
    name: string;
    globs: string[];
    files: number;
    /**
     * Share of the coupling area's files that sit under the proposed folder:
     * near 1, the folder and the coupling agree; low, the cluster spills across
     * folders and the proposal is weak. Read from this map alone, so a redraw
     * of one tree writes the same bytes.
     */
    cohesion: number;
}

/** The common directory of a set of paths, without a trailing slash; '' when there is none. */
function commonDir(paths: readonly string[]): string {
    if (!paths.length) return '';
    const split = paths.map((p) => p.split('/').slice(0, -1));
    const first = split[0] as string[];
    let n = first.length;
    for (const s of split) {
        let k = 0;
        while (k < n && s[k] === first[k]) k++;
        n = k;
    }
    return first.slice(0, n).join('/');
}

/**
 * Proposals from coupling areas: an area whose files share a directory becomes
 * a candidate named by that directory. A proposal is a suggestion with a
 * snippet; a shared-sounding directory is never proposed as a business domain.
 */
export function proposeDomains(areas: ReadonlyArray<{ files: readonly number[] }>, paths: readonly string[], minFiles = 5): DomainProposal[] {
    const byDir = new Map<string, { files: number; inside: number; total: number }>();
    for (const a of areas) {
        if (a.files.length < minFiles) continue;
        const ps = a.files.map((i) => paths[i] as string);
        // The folder most of the area lives in, not the common prefix of all of it: one stray file must not hide the folder.
        const counts = new Map<string, number>();
        for (const p of ps) {
            const segs = p.split('/');
            for (let k = 1; k < segs.length; k++) {
                const d = segs.slice(0, k).join('/');
                counts.set(d, (counts.get(d) ?? 0) + 1);
            }
        }
        const best = [...counts.entries()].filter(([, n]) => n / ps.length >= 0.6).sort((x, y) => y[0].split('/').length - x[0].split('/').length || y[1] - x[1])[0];
        const dir = best?.[0] ?? commonDir(ps);
        if (!dir) continue;
        const name = dir.split('/').pop() as string;
        if (NOT_A_DOMAIN.test(name)) continue;
        const cur = byDir.get(dir) ?? { files: 0, inside: 0, total: 0 };
        cur.files += a.files.length;
        cur.inside += ps.filter((p) => p.startsWith(`${dir}/`)).length;
        cur.total += ps.length;
        byDir.set(dir, cur);
    }
    return [...byDir.entries()]
        .map(([dir, v]) => ({ name: dir.split('/').pop() as string, globs: [`${dir}/**`], files: v.files, cohesion: Math.round((v.inside / Math.max(1, v.total)) * 100) / 100 }))
        .sort((x, y) => y.files - x.files || (x.name < y.name ? -1 : 1))
        .slice(0, 12);
}

export function proposalSnippet(ps: readonly DomainProposal[]): string {
    return ['domains:', ...ps.flatMap((p) => [`  - name: ${p.name}`, '    paths:', ...p.globs.map((g) => `      - "${g}"`)])].join('\n');
}

/** CODEOWNERS owners per path, last matching rule winning; null when the file is absent. */
export function readCodeowners(root: string): ((p: string) => string | null) | null {
    for (const f of ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS']) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, f), 'utf-8');
        } catch {
            continue;
        }
        const rules: Array<[RegExp, string]> = [];
        for (const raw of text.split('\n')) {
            const line = raw.replace(/#.*/, '').trim();
            if (!line) continue;
            const [pattern, ...owners] = line.split(/\s+/);
            if (!pattern || !owners.length) continue;
            const anchored = pattern.startsWith('/') ? pattern.slice(1) : `**/${pattern}`;
            const glob = anchored.endsWith('/') ? `${anchored}**` : anchored.includes('*') || anchored.includes('.') ? anchored : `${anchored}/**`;
            rules.push([globToRegExp(glob), owners.join(' ')]);
        }
        return (p) => {
            let owner: string | null = null;
            for (const [re, o] of rules) if (re.test(p)) owner = o;
            // A CODEOWNERS owner may be an e-mail address; the map carries handles only.
            return owner === null ? null : owner.split(' ').map((x) => (x.includes('@') && !x.startsWith('@') ? '(address withheld)' : x)).join(' ');
        };
    }
    return null;
}

/** The owner a domain inherits when one CODEOWNERS rule set covers all of its files. */
export function ownerFromCodeowners(owners: (p: string) => string | null, files: readonly string[]): string | null {
    const set = new Set(files.map(owners));
    return set.size === 1 ? ([...set][0] ?? null) : null;
}

/** The declared domain of one path under the map folder's `layers.yaml`, or the folder structure's; null outside both. */
export function domainResolver(mapDir: string): ((p: string) => string | null) | null {
    const declared = readDomainRules(path.join(mapDir, 'layers.yaml'));
    if (declared) return (p) => declared.domains.find((d) => d.match.some((r) => r.test(p)))?.name ?? null;
    return (p) => {
        for (const re of STRUCTURE) {
            const m = re.exec(p);
            if (m) return m[1] as string;
        }
        return null;
    };
}
