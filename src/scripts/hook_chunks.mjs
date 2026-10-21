#!/usr/bin/env node
/**
 * hook_chunks.mjs — the one definition of the conditional hook chunks, and
 * their build.
 *
 * A chunk is code the dispatch bundle loads only when a caller needs it
 * (`hooks/svg_rules_loader.ts`, `hooks/egress_engine_loader.ts`). Its entry,
 * its output and its esbuild options live here and nowhere else:
 * `npm run build:hook-chunks` runs this file, and the bundle-composition gate
 * imports it to build the same chunk to a throwaway path and measure it. A
 * second description of the build — a parsed shell script — is how a measured
 * build and a shipped build come apart, which is the reason this is a module.
 *
 * Plain `.mjs` like `write_bundle_digest.mjs`: it runs in `build:hooks` before
 * anything is compiled.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { argv, exit } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildSync } from 'esbuild';

/** Every chunk: its entry and where `build:hook-chunks` writes it, repo-relative. */
export const HOOK_CHUNKS = Object.freeze([
    Object.freeze({ entry: 'src/scripts/_lib/svg_rules.ts', outfile: 'dist/hooks/svg_rules.chunk.cjs' }),
    Object.freeze({ entry: 'src/scripts/_lib/egress_engine.ts', outfile: 'dist/hooks/egress_engine.chunk.cjs' }),
    // `yaml` stays external here, alone among the chunks. Inlined it is
    // 258 KB of the 472 KB chunk — a second copy of a parser the dispatch
    // bundle already carries, shipped so one `session_start` concern can
    // read a settings file. It is a declared runtime dependency of this
    // package, so a CJS `require('yaml')` from `dist/hooks/` resolves it in
    // any install; if it ever does not, `loadLazyConcern` returns null and
    // the dispatcher falls back to the spawn path, which is slower and
    // still correct.
    Object.freeze({
        entry: 'src/scripts/chat_history.ts',
        outfile: 'dist/hooks/chat_history.chunk.cjs',
        external: Object.freeze(['yaml']),
    }),
]);

/** The esbuild options every chunk is built with. */
/**
 * The esbuild options every chunk is built with.
 *
 * `__AGENT_CONFIG_BUNDLE__` is defined here for the same reason `build:hooks`
 * defines it: a chunk carrying a concern carries that concern's CLI entry
 * guard, and without the define the guard falls through to comparing
 * `import.meta.url` against `argv[1]` inside a bundle where every module
 * shares one url. Defined, the guard is statically false and the concern never
 * auto-runs on require.
 *
 * `import.meta` is empty under the `cjs` format, so esbuild would leave
 * `createRequire(import.meta.url)` — which `_lib/agent_settings.ts` runs at
 * module scope — calling `createRequire(undefined)` and throwing on the first
 * require of the chunk. The banner rebuilds the one shape that is actually
 * used, from `__filename`, and the define points `import.meta` at it. The
 * resolved url is the chunk's own path, so `resolvePackageRoot` walks up to the
 * same package root it reaches from `dist/hooks/dispatch.js`.
 */
export const CHUNK_OPTIONS = Object.freeze({
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    define: {
        __AGENT_CONFIG_BUNDLE__: 'true',
        'import.meta.url': '__acChunkMetaUrl',
        'import.meta': '__acChunkMeta',
    },
    banner: {
        js:
            "const __acChunkMetaUrl = require('node:url').pathToFileURL(__filename).href; " +
            'const __acChunkMeta = { url: __acChunkMetaUrl, dirname: __dirname, filename: __filename };',
    },
});

/**
 * Build one chunk from `root` to `outfile` (absolute). Throws when esbuild
 * reports an error.
 *
 * Externals are looked up from {@link HOOK_CHUNKS} by entry rather than passed
 * in, so the gate that measures a chunk and the script that ships it cannot
 * build it with different options — the reason this module exists at all.
 */
export function buildChunk(root, entry, outfile) {
    const declared = HOOK_CHUNKS.find((c) => c.entry === entry);
    const external = declared?.external ?? [];
    const result = buildSync({ ...CHUNK_OPTIONS, external: [...external], absWorkingDir: root, entryPoints: [entry], outfile, logLevel: 'error' });
    if (result.errors.length > 0) throw new Error(`esbuild reported ${String(result.errors.length)} error(s) building ${entry}`);
}

/**
 * Build every chunk and write its digest sidecar. `--out-dir DIR` writes the
 * outputs under DIR instead of the repository, for a test that must not touch
 * the live `dist/`.
 */
export function main(args = argv.slice(2)) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const at = args.indexOf('--out-dir');
    const outRoot = at >= 0 && args[at + 1] !== undefined ? path.resolve(args[at + 1]) : root;
    const digest = path.join(root, 'src', 'scripts', 'write_bundle_digest.mjs');
    for (const chunk of HOOK_CHUNKS) {
        const out = path.join(outRoot, chunk.outfile);
        buildChunk(root, chunk.entry, out);
        const r = spawnSync(process.execPath, [digest, out], { stdio: 'inherit' });
        if (r.status !== 0) return r.status ?? 1;
    }
    return 0;
}

if (argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(argv[1])).href) {
    exit(main());
}
