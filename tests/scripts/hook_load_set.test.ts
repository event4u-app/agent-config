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

    it('a dispatch whose concern environment cannot be hardened is refused by the generated host command', () => {
        // The verdict tail of the PreToolUse command `hooks/hooks.json` installs.
        const hooksJson = JSON.parse(fs.readFileSync(path.join(REPO, 'hooks', 'hooks.json'), 'utf-8')) as {
            hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> };
        };
        const command = hooksJson.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
        const tail = command.slice(command.indexOf('RC=$?'));
        expect(tail.startsWith('RC=$?')).toBe(true);
        // A preload that makes every env write fail once dispatch starts; LD_PRELOAD in the
        // env forces the hardening to delete it, so the scope open must throw.
        const preload = path.join(root, 'env-writes-fail.cjs');
        fs.writeFileSync(
            preload,
            "const t = { ...process.env }; const fail = () => { throw new Error('injected env write failure'); };\n" +
                'process.env = new Proxy(t, { set: fail, deleteProperty: fail });\n',
        );
        const payload = path.join(root, 'pre.json');
        fs.writeFileSync(payload, JSON.stringify({ session_id: 'env-fail', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(workspace, 'x.txt') }, cwd: workspace }));
        const diag = path.join(root, 'dispatch-stderr.txt');
        const script = `"${process.execPath}" --require "${preload}" "${bundle}" --platform claude --event pre_tool_use --project-dir "${workspace}" < "${payload}" >/dev/null 2>"${diag}"; ${tail}`;
        const r = spawnSync('bash', ['-c', script], { encoding: 'utf-8', env: { ...process.env, LD_PRELOAD: '', AGENT_CONFIG_REPLAY: '1' } });
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('this tool call is refused');
        // The intended fault was the one reached: the dispatcher died on the injected env write.
        expect(fs.readFileSync(diag, 'utf-8')).toContain('injected env write failure');
    }, 60_000);

    it('a dispatch whose closing environment restore fails is refused by the generated host command', () => {
        const hooksJson = JSON.parse(fs.readFileSync(path.join(REPO, 'hooks', 'hooks.json'), 'utf-8')) as {
            hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> };
        };
        const command = hooksJson.hooks.PreToolUse[0]?.hooks[0]?.command ?? '';
        const tail = command.slice(command.indexOf('RC=$?'));
        // Only SETTING the injection vector fails: the hardening (which deletes it) succeeds,
        // the concerns run, and the closing restore (which puts it back) is the write that throws.
        const preload = path.join(root, 'env-restore-fails.cjs');
        fs.writeFileSync(
            preload,
            'const t = { ...process.env };\n' +
                "process.env = new Proxy(t, { set: (o, k, v) => { if (k === 'LD_PRELOAD') throw new Error('injected restore failure'); o[k] = String(v); return true; } });\n",
        );
        const payload = path.join(root, 'pre-restore.json');
        fs.writeFileSync(payload, JSON.stringify({ session_id: 'restore-fail', hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(workspace, 'x.txt') }, cwd: workspace }));
        const diag = path.join(root, 'dispatch-restore-stderr.txt');
        const script = `"${process.execPath}" --require "${preload}" "${bundle}" --platform claude --event pre_tool_use --project-dir "${workspace}" < "${payload}" >/dev/null 2>"${diag}"; ${tail}`;
        const r = spawnSync('bash', ['-c', script], { encoding: 'utf-8', env: { ...process.env, LD_PRELOAD: '', AGENT_CONFIG_REPLAY: '1' } });
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('this tool call is refused');
        const stderr = fs.readFileSync(diag, 'utf-8');
        expect(stderr).toContain('environment restore failed: injected restore failure');
        expect(stderr).toContain('concern environment not restored');
    }, 60_000);

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
