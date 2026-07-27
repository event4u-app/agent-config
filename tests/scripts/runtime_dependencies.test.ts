// Runtime-dependency contract for the consumer-facing dispatcher surface.
//
// The global install (`npm install -g @event4u/agent-config`) only ships
// `dependencies` — devDependencies never reach a consumer machine. Every
// script the bash dispatcher (`src/scripts/_dispatch.bash`) executes at
// runtime therefore may only import packages listed under `dependencies`,
// and the `tsx` runner itself must be a runtime dependency: when it is
// missing, `require_tsx` falls back to `npx tsx` in the CONSUMER project's
// cwd, where the consumer's npm config and devEngines/engines constraints
// apply — a consumer pinning e.g. `node <24` then hard-fails every hook and
// TS command with EBADDEVENGINES. That regression (8.1.0) silently broke
// hooks and `roadmap:progress` in consumer projects; this test locks the
// contract so it cannot come back.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const DISPATCH = path.join(REPO_ROOT, 'src', 'scripts', '_dispatch.bash');

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

const pkg: PackageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
);
const runtimeDeps = new Set(Object.keys(pkg.dependencies ?? {}));

// Prefix-only builtins (node:test, node:sqlite, …) are absent from
// `builtinModules` by Node's own contract — list the ones this repo uses.
const PREFIX_ONLY_BUILTINS = ['node:sqlite', 'node:test'];
const BUILTINS = new Set([
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
    ...PREFIX_ONLY_BUILTINS,
]);

/** Bare-specifier → npm package name (`@scope/pkg/sub` → `@scope/pkg`). */
function packageName(specifier: string): string {
    const parts = specifier.split('/');
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string);
}

/** Every script path the dispatcher hands to the tsx runner. */
function dispatcherScriptRoots(): string[] {
    const text = fs.readFileSync(DISPATCH, 'utf-8');
    const roots = new Set<string>();
    // resolve_script "<pkg-rel>.ts" / inline exec_ts targets.
    for (const m of text.matchAll(/"((?:src|dist\/agent-src)\/[A-Za-z0-9_/.-]+?\.ts)"/g)) {
        roots.add(m[1] as string);
    }
    // exec_hook "<base>" — base is PACKAGE_ROOT-relative WITHOUT extension.
    for (const m of text.matchAll(/exec_hook\s+"([A-Za-z0-9_/.-]+)"/g)) {
        roots.add(`${m[1] as string}.ts`);
    }
    return [...roots]
        .map((rel) => path.join(REPO_ROOT, rel))
        .filter((abs) => fs.existsSync(abs));
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

/** Resolve a relative import to an on-disk .ts twin (ESM `.js` suffix aware). */
function resolveRelative(fromFile: string, spec: string): string | null {
    const base = path.resolve(path.dirname(fromFile), spec);
    const candidates = [
        base.replace(/\.js$/, '.ts'),
        base.replace(/\.mjs$/, '.mts'),
        base,
        `${base}.ts`,
        path.join(base, 'index.ts'),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
}

/** BFS over relative imports; collect every bare (third-party) specifier. */
function collectBareImports(roots: string[]): Map<string, string[]> {
    const seen = new Set<string>();
    const queue = [...roots];
    const bare = new Map<string, string[]>(); // package → importing files
    while (queue.length > 0) {
        const file = queue.pop() as string;
        if (seen.has(file)) continue;
        seen.add(file);
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        for (const m of text.matchAll(IMPORT_RE)) {
            const spec = (m[1] ?? m[2]) as string | undefined;
            if (!spec) continue;
            if (spec.startsWith('.')) {
                const resolved = resolveRelative(file, spec);
                if (resolved !== null) queue.push(resolved);
                continue;
            }
            if (BUILTINS.has(spec)) continue;
            const name = packageName(spec);
            const files = bare.get(name) ?? [];
            files.push(path.relative(REPO_ROOT, file));
            bare.set(name, files);
        }
    }
    return bare;
}

describe('runtime dependencies — consumer dispatcher surface', () => {
    it('tsx is a runtime dependency (never devDependencies-only)', () => {
        expect(runtimeDeps.has('tsx')).toBe(true);
        expect(Object.keys(pkg.devDependencies ?? {})).not.toContain('tsx');
    });

    it('every dispatcher-referenced script resolves and imports only runtime deps', () => {
        const roots = dispatcherScriptRoots();
        expect(roots.length).toBeGreaterThan(5); // sanity: the regex found the surface
        const bare = collectBareImports(roots);
        const missing = [...bare.entries()]
            .filter(([name]) => !runtimeDeps.has(name))
            .map(
                ([name, files]) =>
                    `${name} (imported by ${[...new Set(files)].slice(0, 3).join(', ')})`,
            );
        expect(missing, `third-party imports not in "dependencies": ${missing.join('; ')}`).toEqual(
            [],
        );
    });
});
