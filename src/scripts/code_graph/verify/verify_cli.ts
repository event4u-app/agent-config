/**
 * The verify verbs of `agent-config code-graph`:
 *
 *   confirm <id…> | --from-query <symbol> [--kind K,..] [--relation R,..]
 *           [--direction in|out|both] [--depth 1-3] [--limit N]
 *           [--neighbours in|out|both] [--risk-depth witness|auto|text|full] [--json]
 *       re-read the witnesses of those facts: confirmed | moved | changed | gone | added
 *   pack "<task text>" [--diff] [--since <rev>] [--budget N] [--depth 1-3] [--json]
 *       the facts the task touches, seed-first within a token budget, each confirmed
 *   refresh --touched [file…] [--json]
 *       re-read changed and named files into the working-tree overlay, recompute
 *       drift for their facts only, and name the tree the graph was verified at
 *   rebuild-diff [--json]
 *       incremental build against cold build; every difference is a reader defect
 *
 * The cache path is the caller's: it comes from the graph home, so these verbs
 * follow the cache wherever the home puts it.
 */
import { DRIFT_RULES } from '../drift_rules.js';
import { renderDrift } from '../drift.js';
import { loadGraph, type LoadedGraph, tree, type TreeOptions } from '../query.js';
import { openGraphIndex } from '../sqlite_store.js';
import { confirmIds, type ConfirmOptions, driftFor, renderConfirm } from './confirm.js';
import { lowerBound, type LowerBound } from './lower_bound.js';
import { graphChecksum, loadIndexedGraph } from './owner_index.js';
import { basisLabel, computeOverlay, overlayView, readOverlay } from './overlay.js';
import { contextPack } from './pack.js';
import { revChanges, verifyPaths, workingChanges } from './paths.js';
import { nameToken } from './witness_check.js';
import { logRebuildDiff, rebuildDiff, renderRebuildDiff } from './rebuild_diff.js';

function flag(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

const VALUE_FLAGS = new Set(['--from-query', '--kind', '--relation', '--direction', '--depth', '--limit', '--neighbours', '--risk-depth', '--since', '--budget', '--root', '--project', '--graph', '--out']);

function positionals(argv: readonly string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (VALUE_FLAGS.has(a)) {
            i += 1;
            continue;
        }
        if (!a.startsWith('--')) out.push(a);
    }
    return out;
}

const write = (s: string): void => {
    process.stdout.write(s);
};

/** The committed graph seen through the working-tree overlay, read through the index when it can serve. */
export function verifiedGraph(cachePath: string, source: string): LoadedGraph {
    const g = loadIndexedGraph(cachePath, source) ?? loadGraph(cachePath, source);
    return overlayView(g, readOverlay(cachePath, graphChecksum(g)));
}

/**
 * The usage half of an `affected` answer: the graph's known places for the
 * seed's name, paired with a text search. `known` are the files the answer
 * names; the seed's own file is its declaration and never counts as a gap.
 */
export function usageLowerBound(g: LoadedGraph, root: string, cachePath: string, seedId: string, knownIds: Iterable<string>): LowerBound | null {
    const seed = g.byId.get(seedId);
    if (!seed) return null;
    const knownFiles = new Set<string>();
    for (const id of knownIds) {
        const n = g.byId.get(id);
        if (n?.source_file) knownFiles.add(n.source_file);
    }
    const declared = [seed.source_file, seed.fact?.owner].filter((f): f is string => !!f);
    return lowerBound(root, nameToken(seed.label), knownFiles, declared, verifyPaths(cachePath).readerGaps);
}

async function cmdConfirm(argv: string[], root: string, cachePath: string): Promise<number> {
    const json = argv.includes('--json');
    let ids = positionals(argv);
    const fromQuery = flag(argv, '--from-query');
    if (fromQuery !== null) {
        const g = loadIndexedGraph(cachePath, cachePath);
        if (!g) {
            process.stderr.write('code-graph: confirm needs the graph index — run `code-graph build` (confirm never reads the JSON graph)\n');
            return 1;
        }
        try {
            const view = overlayView(g, readOverlay(cachePath, graphChecksum(g)));
            const opts: TreeOptions = { depth: Number(flag(argv, '--depth') ?? 1), limit: Number(flag(argv, '--limit') ?? 20) };
            const kinds = flag(argv, '--kind');
            const rels = flag(argv, '--relation');
            const dir = flag(argv, '--direction');
            if (kinds) opts.kinds = kinds.split(',').map((k) => k.trim()).filter(Boolean);
            if (rels) opts.relations = rels.split(',').map((k) => k.trim()).filter(Boolean);
            if (dir === 'in' || dir === 'out' || dir === 'both') opts.direction = dir;
            const t = tree(view, fromQuery, opts);
            ids = [...ids, ...t.items.filter((i) => i.kind !== 'external').map((i) => i.id)];
            if (!json) write(`from query: ${t.population}\n`);
        } finally {
            g.close();
        }
    }
    if (ids.length === 0) {
        process.stderr.write('usage: code-graph confirm <id…> | --from-query <symbol> [--neighbours in|out|both] [--risk-depth witness|auto|text|full] [--json]\n');
        return 2;
    }
    const opts: ConfirmOptions = {};
    const nb = flag(argv, '--neighbours');
    if (nb === 'in' || nb === 'out' || nb === 'both') opts.neighbours = nb;
    const rd = flag(argv, '--risk-depth');
    if (rd === 'witness' || rd === 'auto' || rd === 'text' || rd === 'full' || rd === 'none') opts.depth = rd;
    const r = confirmIds(root, cachePath, ids, opts);
    if (json) write(`${JSON.stringify(r)}\n`);
    else for (const l of renderConfirm(r)) write(`${l}\n`);
    return r.status === 'ok' ? 0 : 1;
}

async function cmdPack(argv: string[], root: string, cachePath: string): Promise<number> {
    const json = argv.includes('--json');
    const task = positionals(argv).join(' ').trim();
    if (task === '' && !argv.includes('--diff')) {
        process.stderr.write('usage: code-graph pack "<task text>" [--diff] [--since <rev>] [--budget N] [--depth 1-3] [--json]\n');
        return 2;
    }
    const diffFiles: string[] = [];
    if (argv.includes('--diff')) {
        const w = workingChanges(root);
        if (w) diffFiles.push(...w.changed);
    }
    const since = flag(argv, '--since');
    if (since !== null) {
        const r = revChanges(root, since);
        if (r === null) {
            process.stderr.write(`code-graph: cannot resolve rev '${since}'\n`);
            return 1;
        }
        diffFiles.push(...r);
    }
    const g = verifiedGraph(cachePath, cachePath);
    try {
        const p = contextPack(g, root, cachePath, task, {
            diffFiles: [...new Set(diffFiles)],
            ...(flag(argv, '--budget') ? { budget: Number(flag(argv, '--budget')) } : {}),
            ...(flag(argv, '--depth') ? { depth: Number(flag(argv, '--depth')) } : {}),
            includeGuesses: argv.includes('--include-guesses'),
        });
        if (json) {
            write(`${JSON.stringify(p)}\n`);
            return 0;
        }
        write(`seeds: ${[...p.seeds.from_task, ...p.seeds.from_diff].join(', ') || '(none)'}\n`);
        for (const r of p.refused_seeds) write(`refused seed "${r.word}": names ${r.candidates.length}${r.more ? '+' : ''} nodes — ${r.candidates.slice(0, 5).join(', ')}\n`);
        write(`population: ${p.population}\n`);
        for (const l of p.lines) write(`  ${l}\n`);
        write(`returned ${p.returned} of ${p.total}${p.hasMore ? ' (more — raise --budget)' : ''} · ${p.budget.used}/${p.budget.tokens} tokens\n`);
        if (p.confirm.status !== 'ok') write(`confirm: ${p.confirm.error ?? 'unavailable'}\n`);
        return 0;
    } finally {
        g.close();
    }
}

export async function cmdRefreshTouched(argv: string[], root: string, cachePath: string): Promise<number> {
    const json = argv.includes('--json');
    const index = openGraphIndex(cachePath);
    if (!index) {
        process.stderr.write('code-graph: no current graph index — run `code-graph build` first\n');
        return 1;
    }
    try {
        const r = await computeOverlay(root, cachePath, { touched: positionals(argv) });
        const ov = r.overlay;
        const touchedIds = [...ov.nodes.map((n) => n.id), ...ov.removed_nodes];
        const findings = driftFor(index, ov, ov.nodes.map((n) => n.id));
        const verified = `graph verified against working tree at ${basisLabel(ov.basis)}`;
        if (json) {
            write(`${JSON.stringify({ files: ov.files, added: ov.added, changed: ov.changed, removed: ov.removed_nodes, tombstones: r.tombstones.filter((t) => t.by === 'overlay').length, lanes: r.lanes, drift: findings, touched_facts: touchedIds.length, verified })}\n`);
            return 0;
        }
        write(`overlay: ${ov.files.length} file(s) re-read · ${ov.added.length} added · ${ov.changed.length} changed · ${ov.removed_nodes.length} removed (tombstoned)\n`);
        for (const id of ov.added.slice(0, 20)) write(`  added   ${id}\n`);
        for (const id of ov.removed_nodes.slice(0, 20)) write(`  gone    ${id}\n`);
        if (r.lanes.failed.length) write(`  lane readers failed: ${r.lanes.failed.join(', ')}\n`);
        write(`drift on ${touchedIds.length} touched fact(s): ${findings.length} finding(s) (${DRIFT_RULES.length} rules)\n`);
        for (const l of renderDrift({ basis: { input: 'graph', lane: 'graph', graph_checksum: index.sourceChecksum, vocabulary_version: 0, facts: 0, relations: 0, skipped: 0, rules: [...new Set(DRIFT_RULES.map((x) => x.id))], waivers: 0 }, findings, refused: [] }).slice(1)) write(`  ${l}\n`);
        write(`${verified}\n`);
        return 0;
    } finally {
        index.close();
    }
}

async function cmdRebuildDiff(argv: string[], root: string, cachePath: string): Promise<number> {
    const d = await rebuildDiff(root, cachePath);
    logRebuildDiff(verifyPaths(cachePath).readerGaps, d);
    if (argv.includes('--json')) write(`${JSON.stringify(d)}\n`);
    else for (const l of renderRebuildDiff(d)) write(`${l}\n`);
    return d.same ? 0 : 1;
}

export async function verifyMain(sub: string, argv: string[], root: string, cachePath: string): Promise<number> {
    if (sub === 'confirm') return cmdConfirm(argv, root, cachePath);
    if (sub === 'pack') return cmdPack(argv, root, cachePath);
    if (sub === 'rebuild-diff') return cmdRebuildDiff(argv, root, cachePath);
    if (sub === 'refresh') return cmdRefreshTouched(argv, root, cachePath);
    return 2;
}
