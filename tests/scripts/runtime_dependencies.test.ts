// Runtime-dependency contract for the consumer-facing dispatcher surface.
//
// The global install (`npm install -g @event4u/agent-config`) only ships
// `dependencies` — devDependencies never reach a consumer machine. Every
// script the bash dispatcher (`src/scripts/_dispatch.bash`) executes at
// runtime therefore may only import packages listed under `dependencies`.
//
// CONTRACT FLIP (road-to-credible-install Phase 1, 2026-07-27): `tsx` is
// now a devDependency — the consumer runtime tree ships NO tsx. This is
// safe because the surfaces the 8.1.0 EBADDEVENGINES regression actually
// broke (hooks — every PreToolUse/PostToolUse dispatch — and the
// roadmap-progress hook) are structurally tsx-free: they run the
// precompiled node bundles (dist/hooks/dispatch.js, dist/mcp/server.mjs),
// which this test asserts the dispatcher prefers. Reintroducing tsx into
// `dependencies` OR dropping the bundle preference both fail here.
//
// FLIP COMPLETED (ADR-204, 2026-07-31): the flip originally left the `_cli`
// delegate commands on the `npx tsx` last resort, justified as "maintainer
// commands, one-time fetch". That justification was false — 18 commands
// dispatch through `exec_ts`, and at least 9 of them (`sync`, `validate`,
// `doctor`, `update`, `upgrade`, `export`, `prune`, `uninstall`, `versions`)
// are Tier-0/1 consumer surface listed in the consumer `--help`. Every
// consumer invocation therefore ran `npx tsx` in the CONSUMER's cwd — the
// exact EBADDEVENGINES exposure the flip claimed to have removed, plus a
// ~5.7x latency tax (p50 346-392 ms vs 56-71 ms bundled). They now resolve
// `dist/cli-delegate/<name>.js`. The assertions below pin that structurally
// so the class cannot regrow: a new `_cli` command is covered by the build
// glob automatically, and removing either the glob or the dispatcher
// preference fails.

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
    scripts?: Record<string, string>;
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
    it('tsx is NOT a runtime dependency (consumer tree ships no tsx)', () => {
        expect(runtimeDeps.has('tsx')).toBe(false);
        // The maintainer tree keeps tsx for the dev/tsx fallback paths.
        expect(Object.keys(pkg.devDependencies ?? {})).toContain('tsx');
    });

    it('the hook + mcp hot paths prefer the precompiled node bundles', () => {
        const dispatch = fs.readFileSync(DISPATCH, 'utf-8');
        // cmd_dispatch_hook execs dist/hooks/dispatch.js when present — the
        // structural guarantee that hooks never need tsx in a consumer.
        expect(dispatch).toContain('dist/hooks/dispatch.js');
        // cmd_mcp_run prefers the bundled server.
        expect(dispatch).toContain('dist/mcp/server.mjs');
    });

    it('every _cli delegate command is covered by the precompiled bundle', () => {
        const dispatch = fs.readFileSync(DISPATCH, 'utf-8');
        // exec_ts resolves dist/cli-delegate/<name>.js before touching tsx.
        expect(dispatch).toContain('dist/cli-delegate');

        const scripts = pkg.scripts ?? {};
        const delegateBuild = scripts['build:cli-delegate'] ?? '';
        expect(delegateBuild, 'package.json needs a build:cli-delegate script').not.toBe('');
        expect(delegateBuild).toContain('--outdir=dist/cli-delegate');
        // Wired into the build `prepack` runs, or the tarball ships no bundle.
        expect(scripts.build ?? '').toContain('build:cli-delegate');

        // Coverage is structural, not a hand-maintained list: the build globs
        // the whole `_cli` command directory, so a NEW command is bundled
        // without touching the build script. Assert the glob is still what the
        // build uses, then that every dispatcher target is inside it.
        const ENTRY_GLOB = 'src/scripts/_cli/cmd_*.ts';
        expect(delegateBuild).toContain(ENTRY_GLOB);

        const globbed = new Set(
            fs
                .readdirSync(path.join(REPO_ROOT, 'src', 'scripts', '_cli'))
                .filter((f) => f.startsWith('cmd_') && f.endsWith('.ts'))
                .map((f) => `src/scripts/_cli/${f}`),
        );

        const targets = [
            ...dispatch.matchAll(
                /exec_ts "\$PACKAGE_ROOT\/(src\/scripts\/_cli\/cmd_[A-Za-z0-9_]+\.ts)"/g,
            ),
        ].map((m) => m[1] as string);
        // Sanity: the regex actually found the delegate surface (18 today).
        expect(targets.length).toBeGreaterThan(10);

        const uncovered = targets.filter((t) => !globbed.has(t));
        expect(
            uncovered,
            `dispatcher _cli targets the build glob does not emit: ${uncovered.join(', ')}`,
        ).toEqual([]);

        // The dispatcher maps basename → bundle file, so basenames must be
        // unique across the surface or one command would shadow another.
        const names = targets.map((t) => path.basename(t, '.ts'));
        expect(new Set(names).size, `duplicate _cli basenames: ${names.join(', ')}`).toBe(
            names.length,
        );
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
