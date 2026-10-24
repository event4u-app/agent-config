/**
 * Which `agent-config` a background refresh may start — shared by the
 * `code-graph-refresh` session concern and `code-graph auto-refresh on`, so the
 * opt-in can say at once when nothing usable is installed.
 *
 * The executable is never taken from the repository (its root, its
 * `node_modules/.bin`, a relative PATH entry): the same trust rule the host hook
 * shim applies before it runs the dispatcher. And it must be able to do the job:
 * a global install older than the single-flight refresh ignores the flags it
 * does not know and would build unlocked with an old extractor.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** A file only a package that implements `refresh --single-flight` ships (the published tarball carries `src/scripts/`). */
const CAPABILITY_FILE = 'src/scripts/code_graph/refresh_lock.ts';

/**
 * The first `agent-config` on PATH whose real location lies outside `root`.
 * Relative PATH entries are skipped: they resolve against the repository.
 */
export function resolveCli(root: string, envPath: string = process.env['PATH'] ?? ''): string | null {
    let realRoot: string;
    try {
        realRoot = fs.realpathSync(root);
    } catch {
        return null;
    }
    const inside = (p: string): boolean => {
        const rel = path.relative(realRoot, p);
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    };
    for (const dir of envPath.split(path.delimiter)) {
        if (!path.isAbsolute(dir)) continue;
        const candidate = path.join(dir, 'agent-config');
        try {
            fs.accessSync(candidate, fs.constants.X_OK);
            const real = fs.realpathSync(candidate);
            if (fs.statSync(real).isFile() && !inside(real) && !inside(path.resolve(dir))) return candidate;
        } catch {
            /* not here */
        }
    }
    return null;
}

/** The installed package a CLI belongs to: the nearest `package.json` above its real path naming this package. */
export function cliPackage(cli: string): { root: string; version: string } | null {
    try {
        for (let dir = path.dirname(fs.realpathSync(cli)); dir !== path.dirname(dir); dir = path.dirname(dir)) {
            const file = path.join(dir, 'package.json');
            if (!fs.existsSync(file)) continue;
            const pkg = JSON.parse(fs.readFileSync(file, 'utf-8')) as { name?: string; version?: string };
            if (pkg.name === '@event4u/agent-config') return { root: dir, version: pkg.version ?? '?' };
        }
    } catch {
        /* unreadable — no package */
    }
    return null;
}

/**
 * Whether the package a CLI belongs to implements the single-flight refresh.
 * An installed CLI is `<package>/dist/cli/agent-config.js`; the check is the
 * presence of a file only such a package ships, so nothing is executed.
 */
export function cliIsCapable(cli: string): boolean {
    // The same package root the version report uses, so a symlinked or hoisted
    // layout cannot make one call see a package the other does not.
    const pkg = cliPackage(cli);
    return pkg !== null && fs.existsSync(path.join(pkg.root, CAPABILITY_FILE));
}

export type CliVerdict = { cli: string } | { reason: 'no-cli' } | { reason: 'cli-too-old'; cli: string };

/** A trusted `agent-config` that implements the single-flight refresh, or why there is none. */
export function usableCli(root: string, envPath?: string): CliVerdict {
    const cli = resolveCli(root, envPath);
    if (cli === null) return { reason: 'no-cli' };
    return cliIsCapable(cli) ? { cli } : { reason: 'cli-too-old', cli };
}
