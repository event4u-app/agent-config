/**
 * The three package questions, answered from the systems lane's facts:
 *
 *   why          every path from a declaration to the package (`npm explain`,
 *                `composer why`, without running either)
 *   usage        which of the package's public names the code uses, out of how
 *                many — only when the package's files are installed here
 *   remove-plan  what removing it touches: call sites, non-import uses,
 *                dependents, packages that would leave with it, tests
 *
 * Every answer is a proposal with witnesses. "Can be removed" is never said:
 * dynamic loading, reflection and string-built class names are invisible to a
 * file reader (K21).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { CodeEdge, CodeGraph, CodeNode } from '../../types.js';

type G = Pick<CodeGraph, 'nodes' | 'edges'>;

export interface PackageRef {
    id: string;
    name: string;
    version: string;
    ecosystem: string;
    direct: boolean;
    declared: string[];
    witness: string;
}

const MAX_PATHS = 20;
const MAX_DEPTH = 12;
const MAX_SURFACE_FILES = 2000;
/** Partial chains a `why` walk may hold: a dense lockfile's fan-in must not turn the walk exponential. */
const MAX_EXPANSIONS = 20_000;
/** A package name a lockfile may carry; anything else is never joined into a path. */
const SAFE_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(\/[a-z0-9][\w.-]*)?$/i;

function asRef(n: CodeNode): PackageRef {
    const a = n.fact?.attrs ?? {};
    return {
        id: n.id,
        name: String(a['name'] ?? n.label),
        version: String(a['version'] ?? ''),
        ecosystem: String(a['ecosystem'] ?? ''),
        direct: a['direct'] === true,
        declared: Array.isArray(a['declared']) ? (a['declared'] as string[]) : [],
        witness: n.fact ? `${n.fact.witness.file}:${n.fact.witness.line}` : n.source_file,
    };
}

/** Package facts matching `name` or `name@version`, any ecosystem. */
export function findPackages(g: G, query: string): PackageRef[] {
    const at = query.lastIndexOf('@');
    const [name, version] = at > 0 ? [query.slice(0, at), query.slice(at + 1)] : [query, null];
    return g.nodes
        .filter((n) => n.kind === 'package')
        .map(asRef)
        .filter((p) => p.name.toLowerCase() === name.toLowerCase() && (version === null || p.version === version))
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

const requiresIn = (g: G): Map<string, CodeEdge[]> => {
    const m = new Map<string, CodeEdge[]>();
    for (const e of g.edges) if (e.relation === 'requires') m.set(e.target, [...(m.get(e.target) ?? []), e]);
    return m;
};

export interface WhyAnswer {
    package: PackageRef;
    /** each path runs from a declared package to the asked one */
    paths: Array<{ steps: string[]; declared: string[] }>;
    truncated: boolean;
}

/** Every path from a direct declaration to the package, shortest first. */
export function why(g: G, query: string): WhyAnswer[] {
    const byId = new Map(g.nodes.map((n) => [n.id, n] as const));
    const into = requiresIn(g);
    return findPackages(g, query).map((pkg) => {
        const paths: WhyAnswer['paths'] = [];
        let truncated = false;
        const queue: string[][] = [[pkg.id]];
        let expanded = 0;
        for (let qi = 0; qi < queue.length; qi++) {
            if (++expanded > MAX_EXPANSIONS) {
                truncated = true;
                break;
            }
            const chain = queue[qi] as string[];
            const head = byId.get(chain[0] as string);
            if (!head) continue;
            const ref = asRef(head);
            if (ref.direct) {
                if (paths.length >= MAX_PATHS) {
                    truncated = true;
                    break;
                }
                paths.push({ steps: chain.map((id) => labelOf(byId.get(id))), declared: ref.declared });
            }
            if (chain.length >= MAX_DEPTH) continue;
            for (const e of into.get(chain[0] as string) ?? []) if (!chain.includes(e.source)) queue.push([e.source, ...chain]);
        }
        return { package: pkg, paths, truncated };
    });
}

const labelOf = (n: CodeNode | undefined): string => (n ? String(n.fact?.attrs?.['name'] ?? n.label) + '@' + String(n.fact?.attrs?.['version'] ?? '') : '?');

export interface CallSite {
    file: string;
    line: number;
    names: string[];
}

function callSites(g: G, pkgId: string): CallSite[] {
    return g.edges
        .filter((e) => e.relation === 'uses' && e.target === pkgId)
        .map((e) => ({
            file: e.source,
            line: e.fact?.witness.line ?? 1,
            names: Array.isArray(e.fact?.attrs?.['names']) ? (e.fact?.attrs?.['names'] as string[]) : [],
        }))
        .sort((a, b) => (a.file < b.file ? -1 : 1));
}

function flowsReaching(g: G, files: ReadonlySet<string>): string[] {
    const out: string[] = [];
    for (const n of g.nodes) {
        if (n.kind !== 'flow') continue;
        const nodes = n.fact?.attrs?.['nodes'];
        if (!Array.isArray(nodes)) continue;
        if ((nodes as string[]).some((id) => files.has(id.split('#')[0] as string))) out.push(n.label);
    }
    return out.sort();
}

export interface UsageAnswer {
    package: PackageRef;
    sites: CallSite[];
    used: string[];
    /** null: the package's files are not installed here, so its surface is unknown */
    surface: { names: number; source: string; usedOfSurface: string[] } | null;
    share: number | null;
    flows: string[];
    reason: string;
}

/** The public names a package offers, read from its installed files. */
export function packageSurface(root: string, ref: PackageRef): { names: Set<string>; source: string } | null {
    if (!SAFE_NAME.test(ref.name) || ref.name.split('/').includes('..')) return null;
    if (ref.ecosystem === 'npm') return npmSurface(root, ref.name);
    if (ref.ecosystem === 'composer') return composerSurface(root, ref.name);
    return null;
}

function npmSurface(root: string, name: string): { names: Set<string>; source: string } | null {
    const dir = path.join(root, 'node_modules', name);
    let manifest: { types?: string; typings?: string; main?: string; module?: string };
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
    } catch {
        return null;
    }
    const typesRoot = path.join(root, 'node_modules', '@types', name.startsWith('@') ? name.slice(1).replace('/', '__') : name);
    const candidates = [manifest.types, manifest.typings, 'index.d.ts'].filter((x): x is string => typeof x === 'string').map((x) => path.join(dir, x));
    candidates.push(path.join(typesRoot, 'index.d.ts'));
    const entry = candidates.find((f) => fs.existsSync(f));
    const names = new Set<string>();
    if (entry) {
        const seen = new Set<string>();
        const visit = (file: string): void => {
            if (seen.has(file) || seen.size > 50) return;
            seen.add(file);
            let text: string;
            try {
                text = fs.readFileSync(file, 'utf-8');
            } catch {
                return;
            }
            for (const m of text.matchAll(/export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:function|class|const|let|var|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1] as string);
            for (const m of text.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
                for (const part of (m[1] as string).split(',')) {
                    const alias = part.trim().split(/\s+as\s+/).pop()?.trim();
                    if (alias) names.add(alias);
                }
            }
            if (/export\s+default\b/.test(text) || /export\s*=/.test(text)) names.add('default');
            for (const m of text.matchAll(/export\s*\*\s*from\s*['"](\.[^'"]+)['"]/g)) {
                const base = path.resolve(path.dirname(file), m[1] as string);
                const next = [`${base}.d.ts`, path.join(base, 'index.d.ts'), base.replace(/\.js$/, '.d.ts')].find((f) => fs.existsSync(f));
                if (next) visit(next);
            }
        };
        visit(entry);
        return names.size ? { names, source: path.relative(root, entry).split(path.sep).join('/') } : null;
    }
    return null;
}

function composerSurface(root: string, name: string): { names: Set<string>; source: string } | null {
    const dir = path.join(root, 'vendor', name);
    let manifest: { autoload?: { 'psr-4'?: Record<string, string | string[]>; 'psr-0'?: Record<string, string | string[]> } };
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(dir, 'composer.json'), 'utf-8'));
    } catch {
        return null;
    }
    const dirs = [...Object.values(manifest.autoload?.['psr-4'] ?? {}), ...Object.values(manifest.autoload?.['psr-0'] ?? {})].flat().filter((d): d is string => typeof d === 'string');
    const names = new Set<string>();
    let files = 0;
    const walk = (d: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (files >= MAX_SURFACE_FILES) return;
            const full = path.join(d, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile() && e.name.endsWith('.php')) {
                files++;
                let text: string;
                try {
                    text = fs.readFileSync(full, 'utf-8');
                } catch {
                    continue;
                }
                const m = /^\s*(?:final\s+|abstract\s+|readonly\s+)*(?:class|interface|trait|enum)\s+([A-Za-z_]\w*)/m.exec(text);
                if (m) names.add(m[1] as string);
            }
        }
    };
    for (const d of dirs) walk(path.join(dir, d));
    return names.size ? { names, source: `vendor/${name}/composer.json` } : null;
}

/** Which of the package's public names the code uses, and out of how many. */
export function usage(g: G, root: string, query: string): UsageAnswer[] {
    return findPackages(g, query).map((pkg) => {
        const sites = callSites(g, pkg.id);
        const used = [...new Set(sites.flatMap((s) => s.names))].sort();
        const flows = flowsReaching(g, new Set(sites.map((s) => s.file)));
        const surface = packageSurface(root, pkg);
        if (!surface) {
            const where = pkg.ecosystem === 'composer' ? `vendor/${pkg.name}` : `node_modules/${pkg.name}`;
            return { package: pkg, sites, used, surface: null, share: null, flows, reason: `surface unknown — ${where} is not installed here, so no share is computed` };
        }
        const usedOfSurface = used.filter((n) => surface.names.has(n));
        const share = surface.names.size ? Math.round((usedOfSurface.length / surface.names.size) * 1000) / 10 : null;
        return {
            package: pkg,
            sites,
            used,
            surface: { names: surface.names.size, source: surface.source, usedOfSurface },
            share,
            flows,
            reason: `${usedOfSurface.length} of ${surface.names.size} public names (${surface.source}) are named at ${sites.length} call site(s); dynamic access is not counted`,
        };
    });
}

export interface RemovePlan {
    package: PackageRef;
    declared: string[];
    sites: CallSite[];
    nonimport: string[];
    /** packages that require it — removing the declaration does not uninstall it while one stays */
    dependents: string[];
    /** packages reachable only through it, which would leave with it */
    orphans: string[];
    tests: string[];
    flows: string[];
}

export function removePlan(g: G, query: string): RemovePlan[] {
    const byId = new Map(g.nodes.map((n) => [n.id, n] as const));
    const out = new Map<string, string[]>();
    for (const e of g.edges) if (e.relation === 'requires') out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
    const roots = g.nodes.filter((n) => n.kind === 'package' && n.fact?.attrs?.['direct'] === true).map((n) => n.id);
    const reach = (without: string): Set<string> => {
        const seen = new Set<string>();
        const stack = roots.filter((r) => r !== without);
        while (stack.length) {
            const id = stack.pop() as string;
            if (seen.has(id) || id === without) continue;
            seen.add(id);
            for (const t of out.get(id) ?? []) stack.push(t);
        }
        return seen;
    };
    const all = reach('');
    return findPackages(g, query).map((pkg) => {
        const node = byId.get(pkg.id);
        const sites = callSites(g, pkg.id);
        const after = reach(pkg.id);
        const orphans = [...all].filter((id) => id !== pkg.id && !after.has(id)).map((id) => labelOf(byId.get(id))).sort();
        const dependents = g.edges.filter((e) => e.relation === 'requires' && e.target === pkg.id).map((e) => `${labelOf(byId.get(e.source))} requires ${String(e.fact?.attrs?.['range'] ?? '')}`.trim()).sort();
        const siteFiles = new Set(sites.map((s) => s.file));
        const tests = [...new Set(g.edges.filter((e) => e.relation === 'tests' && siteFiles.has(e.target.split('#')[0] as string)).map((e) => e.source.split('#')[0] as string))].sort();
        return {
            package: pkg,
            declared: pkg.declared,
            sites,
            nonimport: Array.isArray(node?.fact?.attrs?.['nonimport']) ? (node?.fact?.attrs?.['nonimport'] as string[]) : [],
            dependents,
            orphans,
            tests,
            flows: flowsReaching(g, siteFiles),
        };
    });
}

export function renderWhy(answers: readonly WhyAnswer[]): string[] {
    if (answers.length === 0) return ['no package of that name in the systems facts (is a lockfile or manifest present, and was the graph built with lanes?)'];
    const lines: string[] = [];
    for (const a of answers) {
        lines.push(`${a.package.name}@${a.package.version} (${a.package.ecosystem}) — ${a.package.witness}`);
        if (a.paths.length === 0) lines.push('  no path from a declaration: the lockfile holds it with nothing that requires it');
        for (const p of a.paths) lines.push(`  ${p.steps.join(' → ')}${p.declared.length ? `   [declared ${p.declared.join('; ')}]` : ''}`);
        if (a.truncated) lines.push(`  … more than ${MAX_PATHS} paths, shortest shown`);
    }
    return lines;
}

export function renderUsage(answers: readonly UsageAnswer[]): string[] {
    if (answers.length === 0) return ['no package of that name in the systems facts'];
    const lines: string[] = [];
    for (const a of answers) {
        lines.push(`${a.package.name}@${a.package.version} — ${a.share === null ? 'share unknown' : `${a.share}% of the public surface named`}`);
        lines.push(`  ${a.reason}`);
        lines.push(`  call sites (${a.sites.length}):`);
        for (const s of a.sites) lines.push(`    ${s.file}:${s.line}${s.names.length ? `  ${s.names.join(', ')}` : ''}`);
        if (a.flows.length) lines.push(`  flows reaching them: ${a.flows.join(', ')}`);
    }
    return lines;
}

export function renderRemovePlan(plans: readonly RemovePlan[]): string[] {
    if (plans.length === 0) return ['no package of that name in the systems facts'];
    const lines: string[] = [];
    for (const p of plans) {
        lines.push(`remove-plan ${p.package.name}@${p.package.version} — a proposal, not a verdict: dynamic use is invisible here`);
        lines.push(`  declarations to delete: ${p.declared.length ? p.declared.join('; ') : '(none — not declared directly)'}`);
        lines.push(`  call sites to change (${p.sites.length}):`);
        for (const s of p.sites) lines.push(`    ${s.file}:${s.line}${s.names.length ? `  ${s.names.join(', ')}` : ''}`);
        lines.push(`  uses without an import (${p.nonimport.length}):${p.nonimport.length ? '' : ' none found'}`);
        for (const n of p.nonimport) lines.push(`    ${n}`);
        if (p.dependents.length) lines.push(`  still installed through: ${p.dependents.join('; ')}`);
        lines.push(`  would leave with it: ${p.orphans.length ? p.orphans.join(', ') : 'nothing'}`);
        if (p.flows.length) lines.push(`  flows through the call sites: ${p.flows.join(', ')}`);
        lines.push(`  tests to run: ${p.tests.length ? p.tests.join(', ') : 'none link to the call sites — run the full suite'}`);
        lines.push('  before acting: `code-graph confirm` the call sites, then run the tests');
    }
    return lines;
}
