/**
 * `code-graph bugs …` — local bug facts (roadmap Phase 1, Stage H).
 *
 *   bugs import <file> [--org O] [--ttl-days N]   user-run offline snapshot import
 *
 * Writes only under the graph's gitignored `.build/bugs/`; never fetches.
 */
import { flag, isFlagValue, resolveRoot } from './cli_args.js';
import { DEFAULT_TTL_DAYS, bugsPath, importSnapshot } from './bugs.js';
import { graphHome } from './graph_home.js';

const USAGE = 'usage: code_graph/cli.ts bugs import <file> [--org O] [--ttl-days N] [--root P]\n';

export function bugsMain(argv: string[]): number {
    const [sub, ...rest] = argv;
    const positional = rest.filter((a) => !a.startsWith('--') && !isFlagValue(rest, a));
    if (sub === 'import') {
        const file = positional[0];
        if (!file) {
            process.stderr.write(USAGE);
            return 2;
        }
        const ttl = Number(flag(rest, '--ttl-days') ?? DEFAULT_TTL_DAYS);
        const buildDir = graphHome(resolveRoot(rest)).buildDir;
        const org = flag(rest, '--org');
        try {
            const store = importSnapshot(file, buildDir, { ...(org ? { org } : {}), ttlDays: Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_DAYS });
            process.stdout.write(`imported ${store.bugs.length} bug record(s), ${Object.keys(store.fixes).length} fix commit(s) → ${bugsPath(buildDir)} (0600, ttl ${store.ttl_days}d)\n`);
            return 0;
        } catch (e) {
            process.stderr.write(`code-graph bugs: ${(e as Error).message}\n`);
            return 2;
        }
    }
    process.stderr.write(USAGE);
    return 2;
}
