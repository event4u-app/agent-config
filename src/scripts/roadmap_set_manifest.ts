#!/usr/bin/env tsx
/**
 * `roadmap_set_manifest` — the frozen member list of one `/roadmap:process-full`
 * invocation that names several roadmaps (`--roadmaps a,b,c` or `--from-pr <N>`).
 *
 * One invocation, at most one delivery PR. The set is resolved and frozen before
 * the first edit, ordered by the members' own `depends` edges (frontmatter
 * `depends:` and `relates` rows with `relation: depends`), and refused when those
 * edges form a cycle. Parked, archived and missing members are listed as excluded
 * rather than run: a PR that touched a `later/` file names it as a candidate, and
 * a candidate never widens what the run may do. A depends edge to a roadmap
 * outside the set orders nothing, and never pulls that roadmap in.
 *
 * Exit codes: 0 manifest printed · 1 cycle refused · 2 usage or lookup error.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const SLUG_RE = /^road-to-[a-z0-9][a-z0-9-]*$/;
const CANDIDATE_RE = /^agents\/roadmaps\/(?:later\/|stubs\/)?(road-to-[a-z0-9][a-z0-9-]*)\.md$/;
const LOCATIONS: ReadonlyArray<readonly [string, ExclusionReason | null]> = [
    ['', null],
    ['later', 'later'],
    ['stubs', 'stubs'],
    ['archive', 'archive'],
    ['skipped', 'skipped'],
];

export type ExclusionReason = 'later' | 'stubs' | 'archive' | 'skipped' | 'missing';

export type ManifestSource = { kind: 'roadmaps' } | { kind: 'pr'; pr: number; head: string };

export interface Manifest {
    ok: boolean;
    source: ManifestSource;
    /** Active members in the order the run takes them. Empty when a cycle was refused. */
    order: string[];
    excluded: Array<{ slug: string; reason: ExclusionReason }>;
    /** Members whose depends edges never resolved, when `ok` is false. */
    cycle?: string[];
}

/** Roadmap slugs a PR's changed files name, in first-seen order. Archive and skipped are not candidates. */
export function slugsFromFiles(files: readonly string[]): string[] {
    const out: string[] = [];
    for (const f of files) {
        const m = CANDIDATE_RE.exec(f.replace(/\\/g, '/'));
        const slug = m?.[1];
        if (slug !== undefined && !out.includes(slug)) out.push(slug);
    }
    return out;
}

function locate(root: string, slug: string): { file: string; reason: ExclusionReason | null } | null {
    for (const [dir, reason] of LOCATIONS) {
        const file = path.join(root, 'agents', 'roadmaps', dir, `${slug}.md`);
        if (fs.existsSync(file)) return { file, reason };
    }
    return null;
}

/** The slugs this roadmap declares it depends on. Unreadable frontmatter declares none. */
export function dependsOf(text: string): string[] {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (m === null) return [];
    let fm: unknown;
    try {
        fm = parseYaml(m[1] ?? '');
    } catch {
        return [];
    }
    if (fm === null || typeof fm !== 'object') return [];
    const rec = fm as Record<string, unknown>;
    const out: string[] = [];
    if (Array.isArray(rec['depends'])) {
        for (const d of rec['depends']) if (typeof d === 'string') out.push(d.replace(/^(?:later|stubs|archive)\//, ''));
    }
    if (Array.isArray(rec['relates'])) {
        for (const r of rec['relates']) {
            if (r === null || typeof r !== 'object') continue;
            const row = r as Record<string, unknown>;
            if (row['relation'] === 'depends' && typeof row['slug'] === 'string') {
                out.push(row['slug'].replace(/^(?:later|stubs|archive)\//, ''));
            }
        }
    }
    return out;
}

export function buildManifest(root: string, slugs: readonly string[], source: ManifestSource): Manifest {
    const active: string[] = [];
    const excluded: Manifest['excluded'] = [];
    const deps = new Map<string, string[]>();
    for (const slug of slugs) {
        if (!SLUG_RE.test(slug)) throw new Error(`'${slug}' is not a roadmap slug`);
        if (active.includes(slug) || excluded.some((e) => e.slug === slug)) continue;
        const where = locate(root, slug);
        if (where === null) {
            excluded.push({ slug, reason: 'missing' });
            continue;
        }
        if (where.reason !== null) {
            excluded.push({ slug, reason: where.reason });
            continue;
        }
        active.push(slug);
        deps.set(slug, dependsOf(fs.readFileSync(where.file, 'utf8')));
    }
    const inSet = new Set(active);
    const order: string[] = [];
    const placed = new Set<string>();
    let progressed = true;
    while (order.length < active.length && progressed) {
        progressed = false;
        for (const slug of active) {
            if (placed.has(slug)) continue;
            const pending = (deps.get(slug) ?? []).filter((d) => inSet.has(d) && d !== slug && !placed.has(d));
            if (pending.length === 0) {
                order.push(slug);
                placed.add(slug);
                progressed = true;
                break;
            }
        }
    }
    if (order.length < active.length) {
        return { ok: false, source, order: [], excluded, cycle: active.filter((s) => !placed.has(s)) };
    }
    return { ok: true, source, order, excluded };
}

function argValue(argv: readonly string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] ?? null) : null;
}

function prFiles(pr: number, repo: string | null): { files: string[]; head: string } {
    const args = ['pr', 'view', String(pr), '--json', 'files,headRefOid'];
    if (repo !== null) args.push('--repo', repo);
    const out = JSON.parse(execFileSync('gh', args, { encoding: 'utf8' })) as {
        files?: Array<{ path?: string }>;
        headRefOid?: string;
    };
    return {
        files: (out.files ?? []).map((f) => f.path ?? '').filter((p) => p !== ''),
        head: (out.headRefOid ?? '').slice(0, 10),
    };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const usage = 'usage: roadmap_set_manifest (--roadmaps a,b,c | --from-pr N [--repo owner/name]) [--root DIR]\n';
    if (argv.includes('--help')) {
        process.stdout.write(usage);
        return 0;
    }
    const root = argValue(argv, '--root') ?? process.cwd();
    const list = argValue(argv, '--roadmaps');
    const prArg = argValue(argv, '--from-pr');
    let slugs: string[];
    let source: ManifestSource;
    try {
        if (list !== null && prArg === null) {
            slugs = list.split(',').map((s) => s.trim().replace(/\.md$/, '')).filter((s) => s !== '');
            source = { kind: 'roadmaps' };
        } else if (prArg !== null && list === null && /^\d+$/.test(prArg)) {
            const pr = Number(prArg);
            const { files, head } = prFiles(pr, argValue(argv, '--repo'));
            slugs = slugsFromFiles(files);
            source = { kind: 'pr', pr, head };
        } else {
            process.stderr.write(usage);
            return 2;
        }
        const m = buildManifest(root, slugs, source);
        process.stdout.write(`${JSON.stringify(m, null, 2)}\n`);
        if (!m.ok) {
            process.stderr.write(`❌  depends cycle among: ${(m.cycle ?? []).join(', ')} — the set is refused\n`);
            return 1;
        }
        return 0;
    } catch (e) {
        process.stderr.write(`❌  ${(e as Error).message}\n`);
        return 2;
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
