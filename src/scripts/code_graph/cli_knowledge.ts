/** The code-graph verbs over packages, branches and history: systems, branches, branch-diff, on-branches, provenance. */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { chainOf, currentBranch } from '../_lib/branch_parents.js';
import { branchPackageGraph, defaultBranchSet, diffBranches, gcBranches, indexBranch, listManifests, onBranches, renderDiff, storeBytes, touchManifest } from './branches.js';
import { cacheFor, flag, isFlagValue, resolveRoot, shown } from './cli_args.js';
import {
    removePlan as systemsRemovePlan,
    type RemovePlan,
    renderRemovePlan,
    renderUsage as renderPackageUsage,
    renderWhy,
    usage as systemsUsage,
    type UsageAnswer,
    why as systemsWhy,
    type WhyAnswer,
} from './lanes/systems/verbs.js';
import { cachedProvenance } from './provenance.js';
import { loadGraph } from './query.js';
import { noEntryLine, symbolUsage } from './answer_correctness.js';
import { provenanceAnswer } from './provenance_verbs.js';
import type { CodeGraph } from './types.js';

/** `why` / `usage` / `remove-plan <package>` — the systems lane's package answers. */
export async function cmdSystems(sub: 'why' | 'usage' | 'remove-plan', argv: string[]): Promise<number> {
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const query = positional[0];
    if (!query) {
        process.stderr.write(`usage: code_graph/cli.ts ${sub} <package[@version]> [--branch B] [--json] [--graph P]\n`);
        return 2;
    }
    const root = resolveRoot(argv);
    const graphPath = flag(argv, '--graph') ?? cacheFor(root);
    const branch = flag(argv, '--branch');
    let g: CodeGraph;
    if (branch !== null) {
        if (sub === 'usage') {
            process.stderr.write(`code-graph: usage reads the package's installed files, and ${branch}'s are not installed here — check it out to ask\n`);
            return 1;
        }
        const build = path.dirname(graphPath);
        const m = (await indexBranch(root, build, branch)).manifest;
        g = { ...branchPackageGraph(build, m) } as CodeGraph;
    } else {
        try {
            g = JSON.parse(fs.readFileSync(graphPath, 'utf-8')) as CodeGraph;
        } catch {
            process.stderr.write(`code-graph: no graph at ${shown(root, graphPath)} — run \`code-graph build\` first\n`);
            return 1;
        }
    }
    if (sub === 'usage' && !systemsUsage(g, root, query).length) {
        const u = symbolUsage(loadGraph(graphPath, `native:${shown(root, graphPath)}`), query);
        if (u === null) {
            process.stdout.write(`${noEntryLine(query, 'packages or symbols')}\n`);
            return 1;
        }
        if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(u, null, 2)}\n`);
        else process.stdout.write(`symbol ${u.symbol}: ${u.users} user(s) within 2 hops over stated edges, in ${u.files.length} file(s)\n${u.files.slice(0, 20).map((f) => `  ${f}`).join('\n')}\n`);
        return 0;
    }
    if (!g.nodes.some((n) => n.kind === 'package')) {
        process.stderr.write('code-graph: the graph holds no package facts — no lockfile or manifest was read, or it was built without lanes\n');
        return 1;
    }
    const answer = sub === 'why' ? systemsWhy(g, query) : sub === 'usage' ? systemsUsage(g, root, query) : systemsRemovePlan(g, query);
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(answer, null, 2)}\n`);
    else {
        const lines = sub === 'why' ? renderWhy(answer as WhyAnswer[]) : sub === 'usage' ? renderPackageUsage(answer as UsageAnswer[]) : renderRemovePlan(answer as RemovePlan[]);
        process.stdout.write(`${lines.join('\n')}\n`);
    }
    return answer.length ? 0 : 1;
}

export function branchStoreOf(argv: string[]): { root: string; build: string } {
    const root = resolveRoot(argv);
    return { root, build: path.dirname(flag(argv, '--graph') ?? cacheFor(root)) };
}

/** `branches [index [ref…] | gc | list]` — the per-branch fact store. */
export async function cmdBranches(argv: string[]): Promise<number> {
    const { root, build } = branchStoreOf(argv);
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const action = positional[0] ?? 'list';
    if (action === 'index') {
        const refs = positional.length > 1 ? positional.slice(1) : defaultBranchSet(root);
        for (const ref of refs) {
            try {
                const r = await indexBranch(root, build, ref);
                process.stdout.write(`indexed ${ref} @ ${r.manifest.commit.slice(0, 8)} — ${Object.keys(r.manifest.files).length} files, ${r.written} new fact file(s)\n`);
            } catch (e) {
                process.stdout.write(`skipped ${ref}: ${(e as Error).message.split('\n')[0]}\n`);
            }
        }
        const bytes = storeBytes(build);
        process.stdout.write(`store: ${bytes.manifests} B manifests, ${bytes.facts} B facts\n`);
        return 0;
    }
    if (action === 'gc') {
        const r = gcBranches(root, build);
        for (const d of r.dropped) process.stdout.write(`dropped ${d.ref} — ${d.why}\n`);
        for (const k of r.kept) process.stdout.write(`kept    ${k.ref} — ${k.why}\n`);
        process.stdout.write(`swept ${r.swept} unreferenced fact file(s); no git ref was touched\n`);
        return 0;
    }
    if (action !== 'list') {
        process.stderr.write('usage: code_graph/cli.ts branches [index [ref…] | gc | list]\n');
        return 2;
    }
    const list = listManifests(build);
    if (!list.length) {
        process.stdout.write('no branch is indexed yet — `code-graph branches index`\n');
        return 0;
    }
    for (const m of list) {
        const link = chainOf(root, m.ref).find((l) => l.branch === m.ref);
        process.stdout.write(`${m.ref.padEnd(32)} ${m.commit.slice(0, 8)}  seen ${m.seen}  parent ${link?.parent ?? (link?.source === 'root' ? '— (default)' : 'unknown')}\n`);
    }
    return 0;
}

/** `branch-diff <a> [<b>]` — b defaults to the checked-out branch; both are indexed on demand. */
export async function cmdBranchDiff(argv: string[]): Promise<number> {
    const { root, build } = branchStoreOf(argv);
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const a = positional[0];
    const b = positional[1] ?? currentBranch(root);
    if (!a || !b) {
        process.stderr.write('usage: code_graph/cli.ts branch-diff <a> [<b>]\n');
        return 2;
    }
    const ma = (await indexBranch(root, build, a)).manifest;
    const mb = (await indexBranch(root, build, b)).manifest;
    process.stdout.write(`${renderDiff(diffBranches(build, ma, mb)).join('\n')}\n`);
    return 0;
}

/** `on-branches <package|table.column|symbol|file>` — over the indexed branches; asking keeps them seen. */
export function cmdOnBranches(argv: string[]): number {
    const { build } = branchStoreOf(argv);
    const q = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a))[0];
    if (!q) {
        process.stderr.write('usage: code_graph/cli.ts on-branches <package|table.column|symbol|file>\n');
        return 2;
    }
    const hits = onBranches(build, q);
    const indexed = listManifests(build);
    for (const m of indexed) touchManifest(build, m);
    if (!hits.length) {
        process.stdout.write(`${q}: on none of the ${indexed.length} indexed branch(es)\n`);
        return 1;
    }
    for (const h of hits) process.stdout.write(`${h.ref.padEnd(32)} ${h.commit.slice(0, 8)}  ${h.what}\n`);
    return 0;
}

/** `provenance <ticket|#pr|file|symbol>` — since when, and for which ticket and PR. */
export function cmdProvenance(argv: string[]): number {
    const positional = argv.filter((a) => !a.startsWith('--') && !isFlagValue(argv, a));
    const query = positional[0];
    if (!query) {
        process.stderr.write('usage: code_graph/cli.ts provenance <ticket|#pr|file|symbol> [--graph P]\n');
        return 2;
    }
    const root = resolveRoot(argv);
    const graphPath = flag(argv, '--graph') ?? cacheFor(root);
    const buildDir = path.dirname(graphPath);
    const index = cachedProvenance(root, buildDir);
    if (!index) {
        process.stderr.write('code-graph: no git history here — provenance reads the local history only\n');
        return 1;
    }
    let g: Pick<CodeGraph, 'nodes'> = { nodes: [] };
    try {
        g = JSON.parse(fs.readFileSync(graphPath, 'utf-8')) as CodeGraph;
    } catch {
        /* files and tickets answer without a graph; symbols and routes need one */
    }
    const a = provenanceAnswer(root, g, index, query.replace(/^\.\//, ''), buildDir);
    process.stdout.write(`${a.lines.join('\n')}\n`);
    return a.kind === 'none' ? 1 : 0;
}
