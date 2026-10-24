/**
 * Nothing that leaves the machine reads the registry, the estate index or the
 * local lineage ledger (road-to-a-graph-that-follows-you 6.3, ADR-299 § 4).
 *
 * Walked over the static import graph, transitively, from every module that
 * sends: telemetry, the council, the self-repair release, the advisory
 * queries and notice, and the tracked map export. A sender that imports a
 * module that imports the registry is a reader — that is the leak path.
 *
 * `advisories.ts` itself is NOT a root, and that is deliberate: it reads the
 * registry to pick which roots `refresh --all-projects` covers, then hands each
 * root to the senders below, which carry package names and never a path. Its
 * senders are the roots.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src', 'scripts');

/** Modules that, if reached, read local-only estate data. */
const FORBIDDEN = [
    /\/_lib\/project_registry\.ts$/,
    /\/code_graph\/estate_[a-z_]+\.ts$/,
    /\/code_graph\/projects_cli\.ts$/,
    /\/code_graph\/graph_budget\.ts$/,
    /lineage[^/]*\.ts$/,
];
/** File names whose literal mention marks a direct read without an import. */
const FORBIDDEN_LITERALS = ["'registry.json'", "'index-v1.sqlite3'", "'lineage'"];

function list(dir: string, pred: (f: string) => boolean): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && pred(f))
        .map((f) => path.join(dir, f));
}

const SENDERS: Record<string, string[]> = {
    telemetry: [
        ...list(SRC, (f) => f.includes('telemetry')),
        ...list(path.join(SRC, '_lib'), (f) => f.includes('telemetry')),
        ...list(path.join(SRC, 'mcp_server'), (f) => f.includes('telemetry')),
    ],
    council: list(path.join(SRC, 'ai_council'), () => true),
    'self-repair release': [
        path.join(SRC, 'self_repair_cli.ts'),
        path.join(SRC, '_lib', 'self_repair_outgoing.ts'),
        path.join(SRC, '_lib', 'self_repair_payload.ts'),
    ],
    'advisories report': [
        path.join(SRC, '_lib', 'advisory_sources.ts'),
        path.join(SRC, '_lib', 'advisory_notice.ts'),
        path.join(SRC, '_lib', 'advisory_verdicts.ts'),
    ],
    'map export': [path.join(SRC, 'code_graph', 'map.ts'), path.join(SRC, 'code_graph', 'map_model.ts')],
};

const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"](\.{1,2}\/[^'"]+)['"]/g;

type Reader = (file: string) => string;

/** Every module reachable from `roots` by relative static or dynamic import. */
export function reachable(roots: string[], read: Reader): Set<string> {
    const seen = new Set<string>();
    const stack = [...roots];
    while (stack.length) {
        const f = stack.pop() as string;
        if (seen.has(f)) continue;
        seen.add(f);
        let text: string;
        try {
            text = read(f);
        } catch {
            continue;
        }
        for (const m of text.matchAll(SPEC)) {
            const spec = m[1] as string;
            const base = path.resolve(path.dirname(f), spec);
            const ts = base.replace(/\.(m?js)$/, '.ts');
            for (const cand of [ts, `${base}.ts`, path.join(base, 'index.ts')]) {
                if (fs.existsSync(cand) || cand === ts) {
                    stack.push(cand);
                    break;
                }
            }
        }
    }
    return seen;
}

export function readers(roots: string[], read: Reader): string[] {
    const hits: string[] = [];
    for (const f of reachable(roots, read)) {
        if (FORBIDDEN.some((re) => re.test(f))) hits.push(path.relative(ROOT, f));
        else {
            let text = '';
            try {
                text = read(f);
            } catch {
                continue;
            }
            if (FORBIDDEN_LITERALS.some((l) => text.includes(l))) hits.push(`${path.relative(ROOT, f)} (literal)`);
        }
    }
    return hits.sort();
}

const disk: Reader = (f) => fs.readFileSync(f, 'utf-8');

describe('egress never reads the registry, the estate index or the lineage ledger (6.3)', () => {
    for (const [name, roots] of Object.entries(SENDERS)) {
        it(`${name}: ${roots.length} sending module(s), none reaches a reader`, () => {
            expect(roots.length).toBeGreaterThan(0);
            for (const r of roots) expect(fs.existsSync(r), r).toBe(true);
            expect(readers(roots, disk)).toEqual([]);
        });
    }

    it('fails as soon as a sender imports the registry', () => {
        const victim = path.join(SRC, '_lib', 'advisory_sources.ts');
        const patched: Reader = (f) =>
            f === victim ? `import { readRegistry } from './project_registry.js';\n${disk(f)}` : disk(f);
        expect(readers(SENDERS['advisories report']!, patched)).toContain('src/scripts/_lib/project_registry.ts');
    });

    it('fails when a sender reaches the registry through a module in between', () => {
        const victim = path.join(SRC, 'code_graph', 'map_model.ts');
        const patched: Reader = (f) => (f === victim ? `import { projectsMain } from './projects_cli.js';\n${disk(f)}` : disk(f));
        const hits = readers(SENDERS['map export']!, patched);
        expect(hits).toContain('src/scripts/code_graph/projects_cli.ts');
        expect(hits).toContain('src/scripts/_lib/project_registry.ts');
    });

    it('the walk does see the registry from a module that legitimately reads it', () => {
        expect(readers([path.join(SRC, 'advisories.ts')], disk)).toContain('src/scripts/_lib/project_registry.ts');
    });
});
