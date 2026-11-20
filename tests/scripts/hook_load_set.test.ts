// The runtime load set of the hook bundle: what a dispatch loads OUTSIDE
// `dist/hooks/dispatch.js` on every hot event
// (road-to-a-hook-system-that-pays-for-what-it-does 3.2).
//
// The composition gate reads an esbuild metafile and cannot see a module loaded
// at runtime; a second YAML copy rode every dispatch that way until 2026-11-20.
// This builds a fresh bundle and its chunks into a throwaway package root (so
// neither a stale nor a missing `dist/` can steer it), runs one real dispatch
// per hot event under a `Module._load` preload, and holds two invariants:
//
//   1. nothing is loaded from `node_modules` — the bundle carries its own deps,
//      and chunks get the bundle's `yaml` (`hooks/bundled_yaml.ts`);
//   2. every other file loaded is the bundle itself or a chunk that
//      `hook_chunks.mjs` declares.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HOT_EVENTS, nodeModulesLoads, traceLoads } from '../../src/scripts/_lib/hook_load_trace.js';
import { buildScript } from '../../src/scripts/check_hook_bundle_content.js';
import { HOOK_CHUNKS, main as buildChunks } from '../../src/scripts/hook_chunks.mjs';
import { rewriteOutfile } from '../../src/scripts/rebuild_hook_bundle.js';

const REPO = path.resolve(__dirname, '..', '..');
let root = '';
let workspace = '';
let bundle = '';

/** A package-root-shaped temp dir: real sources by symlink, a freshly built dist/hooks. */
function buildProbeRuntime(): void {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-load-set-'));
    for (const l of ['src', 'node_modules', 'package.json', 'hooks']) fs.symlinkSync(path.join(REPO, l), path.join(root, l));
    fs.mkdirSync(path.join(root, 'dist', 'hooks'), { recursive: true });
    bundle = path.join(root, 'dist', 'hooks', 'dispatch.js');
    const script = buildScript(REPO);
    const rewritten = script === null ? null : rewriteOutfile(script, bundle);
    if (rewritten === null) throw new Error('package.json build:hooks no longer writes dist/hooks/dispatch.js');
    const esbuildOnly = (rewritten.split('&& node ')[0] ?? rewritten).trim();
    const built = spawnSync('sh', ['-c', esbuildOnly], {
        cwd: REPO,
        encoding: 'utf-8',
        env: { ...process.env, PATH: `${path.join(REPO, 'node_modules', '.bin')}:${process.env['PATH'] ?? ''}` },
    });
    if (built.status !== 0) throw new Error(`esbuild failed: ${built.stderr}`);
    const digest = spawnSync(process.execPath, [path.join(REPO, 'src', 'scripts', 'write_bundle_digest.mjs'), bundle], { encoding: 'utf-8' });
    if (digest.status !== 0) throw new Error(`digest failed: ${digest.stderr}`);
    if (buildChunks(['--out-dir', root]) !== 0) throw new Error('chunk build failed');
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-load-set-ws-'));
}

beforeAll(() => buildProbeRuntime(), 120_000);
afterAll(() => {
    for (const d of [root, workspace]) if (d !== '') fs.rmSync(d, { recursive: true, force: true });
});

describe('hook runtime load set', () => {
    const declared = new Set(HOOK_CHUNKS.map((c) => path.basename(c.outfile)));

    for (const event of HOT_EVENTS) {
        it(`${event}: nothing from node_modules, only the bundle and declared chunks`, () => {
            const trace = traceLoads(bundle, event, workspace);
            expect(trace.exit, `${event} dispatch exit`).toBe(0);
            expect(nodeModulesLoads(trace.modules)).toEqual([]);
            const foreign = trace.modules.filter((m) => {
                const base = path.basename(m);
                return path.resolve(m) !== path.resolve(bundle) && !declared.has(base);
            });
            expect(foreign).toEqual([]);
        }, 60_000);
    }

    it('the tracer sees a runtime createRequire load — the class this check exists for', () => {
        const plant = path.join(root, 'dist', 'hooks', 'plant.mjs');
        fs.writeFileSync(
            plant,
            "import { createRequire } from 'node:module';\ncreateRequire(import.meta.url)('yaml');\n",
        );
        const trace = traceLoads(plant, 'pre_tool_use', workspace);
        expect(nodeModulesLoads(trace.modules).some((m) => m.includes(`${path.sep}yaml${path.sep}`))).toBe(true);
    });
});
