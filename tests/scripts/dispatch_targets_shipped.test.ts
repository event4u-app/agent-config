import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every script the CLI dispatcher resolves inside the package must ship in the
 * npm tarball, or be named here as maintainer-only with its reason. A target
 * outside `files[]` resolves in this checkout and fails on every global install.
 */
const MAINTAINER_ONLY: ReadonlyMap<string, string> = new Map([
    [
        'src/cli/python/workspace_analytics.ts',
        'the `analytics` command is visibility: internal (maintainer workspace); its module stays out of the tarball',
    ],
]);

function dispatcherTargets(): string[] {
    const src = fs.readFileSync(path.resolve('src/scripts/_dispatch.bash'), 'utf8');
    const out = new Set<string>();
    for (const m of src.matchAll(/resolve_script "([^"]+)"/g)) {
        out.add(m[1]!);
    }
    for (const m of src.matchAll(/exec_ts "\$PACKAGE_ROOT\/([^"]+)"/g)) {
        out.add(m[1]!);
    }
    return [...out].sort();
}

function isShipped(target: string): boolean {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { files: string[] };
    return pkg.files
        .filter((f) => !f.startsWith('!'))
        .some((f) => (f.endsWith('/') ? target.startsWith(f) : target === f));
}

describe('dispatcher targets ship in the package', () => {
    it('finds the targets it is meant to check', () => {
        expect(dispatcherTargets().length).toBeGreaterThan(20);
    });

    it('every target is in files[] or declared maintainer-only', () => {
        const unshipped = dispatcherTargets().filter((t) => !isShipped(t) && !MAINTAINER_ONLY.has(t));
        expect(unshipped).toEqual([]);
    });

    it('no maintainer-only entry is stale', () => {
        const targets = new Set(dispatcherTargets());
        for (const entry of MAINTAINER_ONLY.keys()) {
            expect(targets.has(entry), `${entry} is no longer a dispatcher target`).toBe(true);
            expect(isShipped(entry), `${entry} now ships; drop it from MAINTAINER_ONLY`).toBe(false);
        }
    });

    it('the local knowledge store ships with its verb', () => {
        expect(isShipped('src/cli/python/knowledge_ingest.ts')).toBe(true);
        expect(isShipped('src/cli/python/workspace_secrets.ts')).toBe(true);
    });
});
