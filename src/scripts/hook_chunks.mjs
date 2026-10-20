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
    Object.freeze({ entry: 'src/scripts/_lib/tool_output_spool.ts', outfile: 'dist/hooks/tool_output_spool.chunk.cjs' }),
]);

/** The esbuild options every chunk is built with. */
export const CHUNK_OPTIONS = Object.freeze({ bundle: true, platform: 'node', format: 'cjs', target: 'node20' });

/** Build one chunk from `root` to `outfile` (absolute). Throws when esbuild reports an error. */
export function buildChunk(root, entry, outfile) {
    const result = buildSync({ ...CHUNK_OPTIONS, absWorkingDir: root, entryPoints: [entry], outfile, logLevel: 'error' });
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
