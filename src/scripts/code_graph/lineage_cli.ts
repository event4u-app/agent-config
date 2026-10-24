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

import { checkLedger, hasLedger, lineageDir, readLedger } from '../_lib/lineage_ledger.js';
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

const USAGE = 'usage: code-graph lineage <check> [--root P]\n';

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
    if (verb === 'check') return cmdCheck(io);
    io.err(USAGE);
    return 2;
}
