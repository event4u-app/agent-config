/**
 * `code-graph lineage <verb>` — where harvested mechanisms came from, and what is still missing.
 *
 * Two ledgers answer, never one (council O5): the tracked, source-free decision ledger
 * `provenance/mechanisms.jsonl` of the repo at `--root`, and the local source ledger under
 * the user-global `runtime/lineage/` (`_lib/lineage_ledger.ts`). A verb that needs the
 * local side and the key refuses without them instead of answering from half the data.
 *
 * Exit codes: 0 ok · 1 findings · 2 usage or refused.
 */

import * as path from 'node:path';

import { checkLedger, hasLedger, LineageError, lineageDir, mergeIntoLedger, readLedger } from '../_lib/lineage_ledger.js';
import { gaps, lineageFrom, lineageOf, readDecisions, rejected } from '../_lib/lineage_query.js';
import { buildLocalImport } from '../_lib/lineage_seed.js';
import { resolve_keys } from '../_lib/link_crypto.js';
import type { EnvMap } from '../_lib/user_global_paths.js';

export interface LineageDeps {
    readonly env?: EnvMap;
    /** Link keys; resolved from settings when absent. Tests pass them explicitly. */
    readonly keys?: readonly string[];
    readonly stdout?: (s: string) => void;
    readonly stderr?: (s: string) => void;
}

export interface Io {
    readonly env: EnvMap;
    readonly root: string;
    readonly keys: () => readonly string[];
    readonly out: (s: string) => void;
    readonly err: (s: string) => void;
}

export function flag(argv: readonly string[], name: string): string | undefined {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
}

function cmdCheck(io: Io): number {
    const dir = lineageDir(io.env);
    if (!hasLedger(dir)) {
        io.err(`code-graph lineage: no local lineage ledger at ${dir} — run \`code-graph lineage import\` first\n`);
        return 2;
    }
    const findings = checkLedger(dir, io.keys());
    const { sources, edges } = readLedger(dir);
    if (findings.length > 0) {
        for (const f of findings) io.err(`${f.file}:${String(f.line)} ${f.message}\n`);
        io.err(`code-graph lineage check: ${String(findings.length)} finding(s)\n`);
        return 1;
    }
    io.out(`code-graph lineage check: ${String(sources.length)} source(s), ${String(edges.length)} edge(s) OK at ${dir}\n`);
    return 0;
}

/** Refuse, naming the setting, when no link key is configured. */
export function needKeys(io: Io, verb: string): readonly string[] | null {
    const keys = io.keys();
    if (keys.length > 0) return keys;
    io.err(
        `code-graph lineage ${verb}: no link_encryption_key configured (secrets.link_encryption_key) — ` +
            'the local ledger is sealed with it, so nothing is read or written without it\n',
    );
    return null;
}

function cmdImport(io: Io): number {
    const keys = needKeys(io, 'import');
    if (keys === null) return 2;
    const { ledger, refused } = buildLocalImport(io.root, keys);
    const dir = lineageDir(io.env);
    const added = mergeIntoLedger(dir, ledger);
    for (const r of refused) io.err(`code-graph lineage import: skipped ${r}\n`);
    io.out(
        `code-graph lineage import: ${String(added.sources)} new source(s), ${String(added.edges)} new edge(s) into ${dir}` +
            `${refused.length > 0 ? ` · ${String(refused.length)} skipped` : ''}\n`,
    );
    return refused.length > 0 ? 1 : 0;
}

function cmdOf(io: Io, query: string | undefined): number {
    if (query === undefined || query.startsWith('--')) {
        io.err('usage: code-graph lineage of <mechanism-id|path> [--root P]\n');
        return 2;
    }
    const entries = lineageOf(io.root, query);
    if (entries.length === 0) {
        io.err(`code-graph lineage of: no mechanism matches ${query} in provenance/mechanisms.jsonl\n`);
        return 1;
    }
    let broken = 0;
    for (const e of entries) {
        io.out(`${e.mechanism_id}  ${e.verdict}  ${e.decided_at}  (${String(e.decisions)} decision(s))\n`);
        for (const r of e.realised) {
            if (r.status === 'broken') broken += 1;
            io.out(`  realised_in ${r.path}  ${r.status === 'ok' ? 'ok' : 'BROKEN'}\n`);
        }
    }
    if (broken > 0) io.err(`code-graph lineage of: ${String(broken)} broken edge(s) — the file moved or is gone\n`);
    return broken > 0 ? 1 : 0;
}

function cmdGaps(io: Io): number {
    const view = gaps(readDecisions(io.root));
    for (const g of view) {
        io.out(`${g.mechanism_id}  ${g.verdict}  ${g.owner}${g.reopen_if ? `  reopen if: ${g.reopen_if}` : ''}\n`);
    }
    io.out(`code-graph lineage gaps: ${String(view.length)} open mechanism(s)\n`);
    return 0;
}

function cmdRejected(io: Io): number {
    const view = rejected(readDecisions(io.root));
    for (const r of view) {
        io.out(`${r.mechanism_id}  ${r.reason ?? ''}${r.reopen_if ? `  reopen if: ${r.reopen_if}` : ''}\n`);
    }
    io.out(`code-graph lineage rejected: ${String(view.length)} rejected mechanism(s)\n`);
    return 0;
}

function cmdFrom(io: Io, query: string | undefined): number {
    if (query === undefined || query.startsWith('--')) {
        io.err('usage: code-graph lineage from <source-id|identity> [--root P]\n');
        return 2;
    }
    const dir = lineageDir(io.env);
    if (!hasLedger(dir)) {
        io.err(`code-graph lineage from: no local lineage ledger at ${dir} — the source side exists only on the owner's machine\n`);
        return 2;
    }
    const keys = needKeys(io, 'from');
    if (keys === null) return 2;
    const found = lineageFrom(readLedger(dir), query, keys, readDecisions(io.root));
    if (found === null) {
        io.err('code-graph lineage from: no such source in the local ledger\n');
        return 1;
    }
    io.out(`${found.source.source_id}  ${found.source.kind}  ${found.identity}  license ${found.source.license}  watch ${found.source.watch ? 'on' : 'off'}\n`);
    for (const m of found.mechanisms) {
        io.out(`  ${m.mechanism_id}  ${m.verdict ?? '(no decision)'}  pin ${m.pin}${m.locator ? `  at ${m.locator}` : ''}\n`);
    }
    return 0;
}

const USAGE = 'usage: code-graph lineage <check|import|of|gaps|rejected|from> [args] [--root P]\n';

export async function main(argv: readonly string[], deps: LineageDeps = {}): Promise<number> {
    const env = deps.env ?? process.env;
    const root = path.resolve(flag(argv, '--root') ?? process.cwd());
    let cached: readonly string[] | null = null;
    const io: Io = {
        env,
        root,
        keys: () => (cached ??= deps.keys ?? resolve_keys(root)),
        out: deps.stdout ?? ((s) => void process.stdout.write(s)),
        err: deps.stderr ?? ((s) => void process.stderr.write(s)),
    };
    const verb = argv[0];
    try {
        if (verb === 'check') return cmdCheck(io);
        if (verb === 'import') return cmdImport(io);
        if (verb === 'of') return cmdOf(io, argv[1]);
        if (verb === 'gaps') return cmdGaps(io);
        if (verb === 'rejected') return cmdRejected(io);
        if (verb === 'from') return cmdFrom(io, argv[1]);
    } catch (e) {
        if (e instanceof LineageError) {
            io.err(`code-graph lineage: ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    io.err(USAGE);
    return 2;
}
