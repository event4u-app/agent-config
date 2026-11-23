/**
 * hook_load_trace — what one hook dispatch loads at RUNTIME, outside its bundle.
 *
 * The bundle-composition gate reads an esbuild metafile, so it sees what the
 * bundle CONTAINS. It cannot see a module loaded at runtime: a
 * `createRequire(import.meta.url)('yaml')` call esbuild leaves alone contributes
 * 0 bytes there, and that is exactly how a second YAML copy rode every dispatch
 * until 2026-11-20 (road-to-a-hook-system-that-pays-for-what-it-does). This
 * runs one real dispatch with a preload that wraps `Module._load` and records
 * every non-builtin file it resolves — the lazy chunks and anything from
 * `node_modules`.
 *
 * Limit, stated: the hook covers CommonJS loads (`require`, `createRequire`,
 * the chunk loaders). A dynamic ESM `import()` of a package would not appear;
 * nothing on the dispatch path does that today.
 *
 * Shared by `tests/scripts/hook_load_set.test.ts` (the gate) and
 * `internal/bench/core/bench_hook_ab.ts` (`--trace`).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** The events a tool call or a turn pays on every occurrence. */
export const HOT_EVENTS = ['pre_tool_use', 'post_tool_use', 'user_prompt_submit', 'stop'] as const;
export type HotEvent = (typeof HOT_EVENTS)[number];

const MARK = '__AC_LOAD__ ';

const PRELOAD = `
const M = require('module');
const orig = M._load;
const seen = new Set();
M._load = function (request, parent, isMain) {
  try {
    const f = M._resolveFilename(request, parent, isMain);
    if (typeof f === 'string' && path_is_file(f) && !seen.has(f)) { seen.add(f); process.stderr.write(${JSON.stringify(MARK)} + f + '\\n'); }
  } catch {}
  return orig.apply(this, arguments);
};
function path_is_file(f) { return f.includes('/') || f.includes('\\\\'); }
`;

/** A synthetic payload for `event`, rooted at `workspace`. */
export function syntheticPayload(event: string, workspace: string): string {
    const base = { session_id: 'hook-load-trace', cwd: workspace };
    switch (event) {
        case 'pre_tool_use':
            return JSON.stringify({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: path.join(workspace, 'x.txt') } });
        case 'post_tool_use':
            return JSON.stringify({
                ...base,
                hook_event_name: 'PostToolUse',
                tool_name: 'Edit',
                tool_input: { file_path: path.join(workspace, 'x.txt'), old_string: 'a', new_string: 'b' },
                tool_response: { success: true },
            });
        case 'user_prompt_submit':
            return JSON.stringify({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'hello there' });
        case 'stop':
            return JSON.stringify({ ...base, hook_event_name: 'Stop', stop_hook_active: false });
        default:
            return JSON.stringify({ ...base, hook_event_name: event });
    }
}

export interface LoadTrace {
    readonly exit: number | null;
    /** Absolute paths of every non-builtin module the dispatch resolved, in load order. */
    readonly modules: readonly string[];
}

/** Run one dispatch of `bundle` for `event` against `workspace` and record what it loaded. */
export function traceLoads(bundle: string, event: string, workspace: string, env: NodeJS.ProcessEnv = process.env): LoadTrace {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-load-trace-'));
    const preload = path.join(dir, 'preload.cjs');
    fs.writeFileSync(preload, PRELOAD);
    try {
        const r = spawnSync(process.execPath, ['--require', preload, bundle, '--platform', 'claude', '--event', event, '--project-dir', workspace], {
            input: syntheticPayload(event, workspace),
            encoding: 'utf-8',
            env: { ...env, AGENT_CONFIG_REPLAY: '1' },
            maxBuffer: 16 * 1024 * 1024,
        });
        const modules = (r.stderr ?? '')
            .split('\n')
            .filter((l) => l.startsWith(MARK))
            .map((l) => l.slice(MARK.length));
        return { exit: r.status, modules };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/** Modules in `trace` that resolve inside a `node_modules` directory. */
export function nodeModulesLoads(modules: readonly string[]): string[] {
    return modules.filter((m) => m.split(path.sep).includes('node_modules'));
}
