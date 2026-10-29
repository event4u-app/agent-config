/**
 * `code-graph bugs …` — local bug facts (roadmap Phase 1, Stage H).
 *
 *   bugs import <file> [--org O] [--ttl-days N]   user-run offline snapshot import
 *   bugs fix-share [--limit N]                     H.9 field measure: fix commits later named as an inducer
 *
 * Writes only under the graph's gitignored `.build/bugs/`; never fetches.
 */
import { gitProbe } from '../_lib/spawn_env.js';
import { flag, isFlagValue, resolveRoot } from './cli_args.js';
import { DEFAULT_TTL_DAYS, bugsPath, importSnapshot } from './bugs.js';
import { classifyFix } from './fix_kinds.js';
import { formatShares, shareFromHistory } from './fix_induced_share.js';
import { graphHome } from './graph_home.js';
import { ticketKeysOf, trackerKeysOf } from './provenance.js';

const USAGE = 'usage: code_graph/cli.ts bugs import <file> [--org O] [--ttl-days N] [--root P] | bugs fix-share [--limit N] [--root P]\n';

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
    if (sub === 'fix-share') {
        const root = resolveRoot(rest);
        const limit = Math.max(1, Number(flag(rest, '--limit') ?? 500) || 500);
        const git = (args: readonly string[]): string => gitProbe(root, args, { maxBuffer: 256 * 1024 * 1024, timeout: 120_000 });
        const keys = { ticketKeys: ticketKeysOf(root), trackerKeys: trackerKeysOf(root) };
        const fixes = git(['log', '--no-merges', `-n${limit}`, '--format=%H%x1f%cs%x1f%s%x1f%b%x1e'])
            .split('\x1e')
            .map((r) => r.trim().split('\x1f'))
            .filter(([sha, , subject = '', body = '']) => sha && classifyFix(subject, body, keys).kind !== null)
            .map(([sha = '', date = '']) => ({ sha, date }));
        process.stdout.write(`${formatShares(shareFromHistory(git, fixes))}\n`);
        return 0;
    }
    process.stderr.write(USAGE);
    return 2;
}
